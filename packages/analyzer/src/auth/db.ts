import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

const DB_PATH = process.env.DB_PATH || '/data/musical-symmetry.db';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      provider TEXT NOT NULL,
      provider_id TEXT,
      tier TEXT DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      api_key TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id),
      ip_address TEXT,
      endpoint TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_user_endpoint
      ON api_usage(user_id, endpoint, timestamp);

  `);

  // Migration: add ip_address column if missing
  const columns = db.prepare("PRAGMA table_info(api_usage)").all() as { name: string }[];
  if (!columns.some(c => c.name === 'ip_address')) {
    db.exec("ALTER TABLE api_usage ADD COLUMN ip_address TEXT");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_usage_ip_endpoint
      ON api_usage(ip_address, endpoint, timestamp);

    CREATE TABLE IF NOT EXISTS magic_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

    CREATE TABLE IF NOT EXISTS collection_items (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      pitch_classes TEXT NOT NULL,
      label TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_collection_items_coll ON collection_items(collection_id);
  `);
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function generateApiKey(): string {
  return 'ms_' + randomBytes(16).toString('hex');
}

export interface ProviderData {
  email: string;
  name?: string;
  providerId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  provider: string;
  provider_id: string | null;
  tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  api_key: string | null;
  created_at: string;
  last_login: string | null;
}

const CREATOR_EMAILS = ['tenerjenkins@gmail.com'];

export function getOrCreateUser(provider: string, data: ProviderData): User {
  const db = getDb();
  const isCreator = CREATOR_EMAILS.includes(data.email.toLowerCase());

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email) as User | undefined;
  if (existing) {
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(existing.id);
    if (isCreator && existing.tier !== 'research') {
      db.prepare('UPDATE users SET tier = ? WHERE id = ?').run('research', existing.id);
      return { ...existing, tier: 'research', last_login: new Date().toISOString() };
    }
    return { ...existing, last_login: new Date().toISOString() };
  }

  const id = generateId();
  const apiKey = generateApiKey();
  const tier = isCreator ? 'research' : 'free';
  db.prepare(`
    INSERT INTO users (id, email, name, provider, provider_id, api_key, tier, last_login)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, data.email, data.name || null, provider, data.providerId || null, apiKey, tier);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
}

export function getUserByApiKey(key: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE api_key = ?').get(key) as User | undefined;
}

export function getUserById(id: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByStripeCustomerId(customerId: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(customerId) as User | undefined;
}

export function recordUsage(userId: string | null, endpoint: string, ipAddress?: string): void {
  const db = getDb();
  db.prepare('INSERT INTO api_usage (user_id, ip_address, endpoint) VALUES (?, ?, ?)').run(userId, ipAddress || null, endpoint);
}

export function getUsageCount(userId: string | null, endpoint: string, since: string, ipAddress?: string): number {
  const db = getDb();
  if (userId) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM api_usage WHERE user_id = ? AND endpoint = ? AND timestamp >= ?'
    ).get(userId, endpoint, since) as { count: number };
    return row.count;
  }
  if (ipAddress) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM api_usage WHERE ip_address = ? AND endpoint = ? AND timestamp >= ?'
    ).get(ipAddress, endpoint, since) as { count: number };
    return row.count;
  }
  return 0;
}

export function updateTier(userId: string, tier: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, userId);
}

export function createMagicToken(email: string): string {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO magic_tokens (token, email) VALUES (?, ?)').run(token, email);
  return token;
}

export function verifyMagicToken(token: string): string | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT email, used FROM magic_tokens WHERE token = ? AND created_at >= datetime('now', '-15 minutes')"
  ).get(token) as { email: string; used: number } | undefined;

  if (!row || row.used) return null;

  db.prepare('UPDATE magic_tokens SET used = 1 WHERE token = ?').run(token);
  return row.email;
}

export function regenerateApiKey(userId: string): string {
  const db = getDb();
  const newKey = generateApiKey();
  db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(newKey, userId);
  return newKey;
}

/**
 * Tables referencing users(id) WITHOUT ON DELETE CASCADE, in deletion order
 * (children before parents). Read off the schema 2026-09-21, not assumed.
 *
 * Everything else cascades and is handled by the DELETE on users: achievements,
 * analysis_history, classroom_members, collections (-> collection_items),
 * corpora, daily_submissions, exercise_completions, flashcard_decks (->
 * flashcard_cards), lesson_progress.
 *
 * These tables are created by their own route modules at import time, so in a
 * partially-loaded process some may not exist yet — hence the existence check.
 */
export const MANUAL_DELETE: ReadonlyArray<readonly [table: string, column: string]> = [
  ['assignment_submissions', 'student_id'],
  ['assignments', 'creator_id'],
  ['classroom_members', 'user_id'],
  ['classrooms', 'teacher_id'],
  ['workspaces', 'user_id'],
  ['sketches', 'user_id'],
];

function tableExists(db: Database.Database, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name);
}

/**
 * Delete an account and everything identifying about it. Apple Guideline
 * 5.1.1(v); also the honest answer to a GDPR erasure request.
 *
 * `foreign_keys = ON` is set for this connection, so a bare DELETE on users
 * does not orphan rows — it THROWS. Every non-cascading child must go first,
 * which is why this list is explicit rather than inferred.
 *
 * `api_usage` is deliberately unlinked rather than deleted: those rows drive
 * rate-limit and volume accounting, and removing them would silently rewrite
 * historical totals. The row survives, the identity does not.
 *
 * `sessions` is an express-session store keyed by sid with no user column, so
 * it cannot be cleaned by user id; the route destroys the caller's session.
 */
export function deleteAccount(userId: string): void {
  const db = getDb();
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as
    { email: string } | undefined;
  if (!row) return;

  db.transaction(() => {
    db.prepare('UPDATE api_usage SET user_id = NULL WHERE user_id = ?').run(userId);

    // Submissions made by OTHER students against this user's assignments.
    // Without this the account is undeletable the moment anyone hands work in:
    // deleting the assignment trips the submission's foreign key. A user must
    // never be trapped because someone else interacted with their content.
    if (tableExists(db, 'assignment_submissions') && tableExists(db, 'assignments')) {
      db.prepare(`DELETE FROM assignment_submissions
                  WHERE assignment_id IN (SELECT id FROM assignments WHERE creator_id = ?)`)
        .run(userId);
    }

    for (const [table, column] of MANUAL_DELETE) {
      if (!tableExists(db, table)) continue;
      db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(userId);
    }
    db.prepare('DELETE FROM magic_tokens WHERE email = ?').run(row.email);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  })();
}
