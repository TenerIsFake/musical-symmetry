/**
 * Account deletion — Apple Guideline 5.1.1(v) requires an in-app path to delete
 * an account, and until 2026-09-21 no deletion code existed anywhere in this
 * codebase; the published page asked users to send an email.
 *
 * Deletion is irreversible, so these tests care most about the cases that fail
 * QUIETLY: rows left behind in tables that do NOT cascade, and a Stripe
 * subscription left billing a deleted account.
 *
 * The cascade map was read off the schema per COLUMN, not per table — a first
 * pass got that wrong and credited `classroom_members` with a cascade it only
 * has on `classroom_id`, never on `user_id`. ON DELETE CASCADE genuinely covers:
 * achievements, analysis_history, collections (and collection_items), corpora,
 * daily_submissions, exercise_completions, flashcard_decks (and
 * flashcard_cards), lesson_progress.
 *
 * These reference users with NO cascade and must be deleted by hand:
 *   workspaces.user_id · assignments.creator_id · assignment_submissions.student_id
 *   classroom_members.user_id · classrooms.teacher_id · sketches.user_id
 *   api_usage.user_id (nullable — unlinked, not deleted)
 * plus magic_tokens, which has no FK and is keyed by email.
 *
 * Note this connection runs `foreign_keys = ON`, so an unhandled child row does
 * not orphan quietly — the DELETE throws and the account becomes undeletable.
 *
 * `sessions` is an express-session store: sid/sess/expired, with no user column
 * at all. It cannot be deleted by user id, which is why the route destroys the
 * caller's session instead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let authDb: typeof import('../src/auth/db.js');
let db: import('better-sqlite3').Database;

beforeEach(async () => {
  process.env.DB_PATH = ':memory:';
  vi.resetModules();
  authDb = await import('../src/auth/db.js');
  db = authDb.getDb();
});

function makeUser(email = 'gone@example.com') {
  return authDb.getOrCreateUser('magic', { email });
}

/**
 * The non-cascading tables are created by their own route modules at import
 * time, not by auth/db. Recreated here verbatim from those modules so the test
 * exercises the real shapes — including `sketches.user_id INTEGER`, which is a
 * type mismatch against `users.id TEXT` and cannot be silently "fixed" here.
 */
function createNonCascadingTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
      type TEXT NOT NULL, data TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, classroom_id TEXT,
      FOREIGN KEY (creator_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, student_id TEXT NOT NULL,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (student_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS sketches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id), title TEXT);
  `);
}

describe('deleteAccount', () => {
  it('removes the user row', () => {
    const user = makeUser();
    authDb.deleteAccount(user.id);
    const found = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
    expect(found).toBeUndefined();
  });

  it('removes rows from every table that does NOT cascade', () => {
    const user = makeUser();
    createNonCascadingTables();
    db.prepare("INSERT INTO workspaces (id,user_id,name,type,data) VALUES ('w1',?,'n','classifier','{}')").run(user.id);
    db.prepare("INSERT INTO classrooms (id,teacher_id,name) VALUES ('c1',?,'n')").run(user.id);
    db.prepare("INSERT INTO assignments (id,creator_id) VALUES ('a1',?)").run(user.id);
    db.prepare("INSERT INTO assignment_submissions (id,assignment_id,student_id) VALUES ('s1','a1',?)").run(user.id);
    db.prepare("INSERT INTO sketches (user_id,title) VALUES (?,'t')").run(user.id);
    db.prepare("INSERT INTO api_usage (user_id,endpoint) VALUES (?,'/x')").run(user.id);
    authDb.createMagicToken(user.email);

    authDb.deleteAccount(user.id);

    const left: Record<string, number> = {};
    for (const [table, col] of [
      ['workspaces', 'user_id'], ['classrooms', 'teacher_id'],
      ['assignments', 'creator_id'], ['assignment_submissions', 'student_id'],
      ['sketches', 'user_id'],
    ] as const) {
      left[table] = (db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${col} = ?`)
        .get(user.id) as { c: number }).c;
    }
    left['magic_tokens'] = (db.prepare('SELECT COUNT(*) c FROM magic_tokens WHERE email = ?')
      .get(user.email) as { c: number }).c;
    expect(left).toEqual({
      workspaces: 0, classrooms: 0, assignments: 0,
      assignment_submissions: 0, sketches: 0, magic_tokens: 0,
    });
  });

  it('deletes a teacher whose assignment has submissions from OTHER students', () => {
    // The obvious implementation deletes only the leaving user's own
    // submissions, then their assignments — which trips the FK from a second
    // student's submission and makes the account undeletable. A user must
    // never be trapped because someone else interacted with their content.
    const teacher = makeUser('teacher@example.com');
    const student = makeUser('student@example.com');
    createNonCascadingTables();
    db.prepare("INSERT INTO assignments (id,creator_id) VALUES ('a1',?)").run(teacher.id);
    db.prepare("INSERT INTO assignment_submissions (id,assignment_id,student_id) VALUES ('s1','a1',?)")
      .run(student.id);

    expect(() => authDb.deleteAccount(teacher.id)).not.toThrow();

    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(teacher.id)).toBeUndefined();
    // the other student survives untouched
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(student.id)).toBeTruthy();
    expect((db.prepare('SELECT COUNT(*) c FROM assignment_submissions').get() as { c: number }).c)
      .toBe(0);
  });

  it('keeps api_usage rows for aggregate stats but unlinks them from the user', () => {
    // Deleting usage rows would silently rewrite historical rate-limit and
    // volume data. The row survives; the identity does not.
    const user = makeUser();
    db.prepare("INSERT INTO api_usage (user_id,endpoint) VALUES (?,'/x')").run(user.id);
    authDb.deleteAccount(user.id);
    const rows = db.prepare('SELECT user_id FROM api_usage').all() as { user_id: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBeNull();
  });
});

/**
 * A guard that cannot go stale.
 *
 * The cascade map above was wrong twice while this file was being written: a
 * first pass credited `classroom_members` with ON DELETE CASCADE, because the
 * table does have one — on `classroom_id`, not on `user_id`. Personal data
 * would have survived the account that owned it.
 *
 * So rather than trusting a list, this walks the source for every column that
 * references users(id) WITHOUT a cascade, and fails if `deleteAccount` does not
 * handle it. Add a table with a user foreign key and this test breaks until
 * deletion covers it.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('deletion coverage stays in step with the schema', () => {
  it('handles every column that references users(id) without ON DELETE CASCADE', async () => {
    const { MANUAL_DELETE } = await import('../src/auth/db.js');
    const handled = new Set<string>([
      ...MANUAL_DELETE.map(([t, c]) => `${t}.${c}`),
      'api_usage.user_id',   // unlinked, not deleted — see deleteAccount
      'users.id',            // the row itself
    ]);

    const found = new Set<string>();
    for (const file of sourceFiles(join(import.meta.dirname, '..', 'src'))) {
      const text = readFileSync(file, 'utf8');
      // walk CREATE TABLE blocks so a column can be attributed to its table
      for (const block of text.matchAll(
        /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/g)) {
        const [, table, body] = block;
        for (const line of body.split('\n')) {
          if (!/REFERENCES\s+users\(id\)/.test(line)) continue;
          if (/ON DELETE CASCADE/.test(line)) continue;
          const named = line.match(/FOREIGN KEY\s*\(\s*(\w+)\s*\)/);
          const inline = line.match(/^\s*(\w+)\s+\w+/);
          const column = named?.[1] ?? inline?.[1];
          if (column) found.add(`${table}.${column}`);
        }
      }
    }

    expect(found.size).toBeGreaterThan(0);   // the scan itself must not silently find nothing
    const unhandled = [...found].filter((ref) => !handled.has(ref)).sort();
    expect(unhandled).toEqual([]);
  });
});

/**
 * Cancelling the subscription is separate from the database work on purpose:
 * it is a network call, and holding a SQLite transaction open across one is a
 * good way to turn a slow Stripe response into a locked database. The route
 * cancels first, then deletes. `stripe.ts` also already imports `db.ts`, so
 * putting the call inside deleteAccount would be circular.
 */
describe('cancelSubscription', () => {
  beforeEach(() => { delete process.env.STRIPE_SECRET_KEY; });

  it('is a safe no-op when Stripe is not configured', async () => {
    const { cancelSubscription } = await import('../src/auth/stripe.js');
    await expect(cancelSubscription('sub_123')).resolves.toBe(false);
  });

  it('cancels the subscription at Stripe when configured', async () => {
    const cancel = vi.fn().mockResolvedValue({ id: 'sub_123', status: 'canceled' });
    vi.doMock('stripe', () => ({
      default: class { subscriptions = { cancel }; },
    }));
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    const { cancelSubscription } = await import('../src/auth/stripe.js');

    await expect(cancelSubscription('sub_123')).resolves.toBe(true);
    expect(cancel).toHaveBeenCalledWith('sub_123');
  });

  it('reports failure rather than throwing when Stripe rejects', async () => {
    // A dead subscription must never block erasure. Apple and GDPR both care
    // that the account goes; a billing error is for the logs, not the user.
    vi.doMock('stripe', () => ({
      default: class { subscriptions = { cancel: vi.fn().mockRejectedValue(new Error('no such sub')) }; },
    }));
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    const { cancelSubscription } = await import('../src/auth/stripe.js');
    // the failure is logged on purpose; keep it out of the test output
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(cancelSubscription('sub_gone')).resolves.toBe(false);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

/**
 * The route. Guideline 5.1.1(v) wants deletion initiable in the app, so this is
 * the endpoint the iOS Settings screen, the web Dashboard and the Android app
 * all call. It requires the user to retype their email: deletion is
 * irreversible and a stray tap must not be enough.
 */
describe('DELETE /api/auth/account', () => {
  // NOTE: resetModules() must happen BEFORE the user is created, or the router
  // ends up bound to a different in-memory database than the test wrote to.
  // A first version got this wrong and every authenticated case returned 401.
  async function appWith(email?: string) {
    vi.resetModules();
    process.env.DB_PATH = ':memory:';
    const authMod = await import('../src/auth/db.js');
    authMod.getDb();
    const user = email ? authMod.getOrCreateUser('magic', { email }) : undefined;

    const express = (await import('express')).default;
    const { authRouter } = await import('../src/auth/routes.js');
    const app = express();
    app.use(express.json());
    // stand in for express-session; the real store has no user column
    app.use((req: any, _res, next) => {
      req.session = { userId: user?.id, destroy: (cb: any) => cb?.(null) };
      next();
    });
    app.use('/api/auth', authRouter);
    return { app, user, authMod };
  }

  it('rejects an unauthenticated caller', async () => {
    const request = (await import('supertest')).default;
    const { app } = await appWith(undefined);
    const res = await request(app).delete('/api/auth/account').send({ confirm: 'x@y.z' });
    expect(res.status).toBe(401);
  });

  it('refuses when the typed confirmation does not match the account email', async () => {
    const request = (await import('supertest')).default;
    const { app, user, authMod } = await appWith('real@example.com');
    const res = await request(app).delete('/api/auth/account').send({ confirm: 'typo@example.com' });
    expect(res.status).toBe(400);
    expect(authMod.getUserById(user!.id)).toBeTruthy();   // still there
  });

  it('deletes the account when the confirmation matches', async () => {
    const request = (await import('supertest')).default;
    const { app, user, authMod } = await appWith('real@example.com');
    const res = await request(app).delete('/api/auth/account').send({ confirm: 'real@example.com' });
    expect(res.status).toBe(204);
    expect(authMod.getUserById(user!.id)).toBeUndefined();
  });
});

/**
 * The one gap an adversarial review found: Stripe is cancelled before the
 * database work, outside the transaction (deliberately — see the route). If
 * `deleteAccount` then throws, better-sqlite3 rolls the transaction back and
 * the account survives, but the subscription has already been cancelled at
 * Stripe with nothing to undo it. Narrow, but it leaves a live account with
 * silently cancelled billing and no record of why.
 *
 * It cannot be made atomic without a distributed transaction, so the
 * requirement is that it be loud: the subscription id must reach the log so a
 * human can put it back.
 */
describe('a database failure after Stripe has been cancelled', () => {
  it('logs the orphaned cancellation with its subscription id', async () => {
    vi.resetModules();
    process.env.DB_PATH = ':memory:';
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    vi.doMock('stripe', () => ({
      default: class { subscriptions = { cancel: vi.fn().mockResolvedValue({}) }; },
    }));
    const authMod = await import('../src/auth/db.js');
    authMod.getDb();
    const user = authMod.getOrCreateUser('magic', { email: 'boom@example.com' });
    authMod.getDb().prepare('UPDATE users SET stripe_subscription_id = ? WHERE id = ?')
      .run('sub_orphan', user.id);

    // force the database half to fail, after the cancellation has happened
    vi.spyOn(authMod, 'deleteAccount').mockImplementation(() => {
      throw new Error('database is locked');
    });

    const express = (await import('express')).default;
    const { authRouter } = await import('../src/auth/routes.js');
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.session = { userId: user.id, destroy: (cb: any) => cb?.(null) };
      next();
    });
    app.use('/api/auth', authRouter);

    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = (await import('supertest')).default;
    const res = await request(app).delete('/api/auth/account')
      .send({ confirm: 'boom@example.com' });

    expect(res.status).toBe(500);
    const output = logged.mock.calls.flat().join(' ');
    expect(output).toContain('sub_orphan');
    logged.mockRestore();
  });
});
