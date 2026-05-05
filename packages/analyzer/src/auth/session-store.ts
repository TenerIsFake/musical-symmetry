import session from 'express-session';
import type Database from 'better-sqlite3';

/**
 * Simple SQLite session store for express-session.
 * Uses the sessions table created by db.ts initSchema.
 */
export class SqliteSessionStore extends session.Store {
  private db: Database.Database;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  get(sid: string, callback: (err?: Error | null, session?: session.SessionData | null) => void): void {
    try {
      const row = this.db.prepare(
        "SELECT sess FROM sessions WHERE sid = ? AND expired > datetime('now')"
      ).get(sid) as { sess: string } | undefined;

      if (!row) {
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err as Error);
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: Error) => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge || 86400000; // 1 day default
      const expired = new Date(Date.now() + maxAge).toISOString();
      const sess = JSON.stringify(sessionData);

      this.db.prepare(`
        INSERT INTO sessions (sid, sess, expired)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
      `).run(sid, sess, expired);

      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  destroy(sid: string, callback?: (err?: Error) => void): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: Error) => void): void {
    try {
      const maxAge = sessionData.cookie?.maxAge || 86400000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      this.db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?').run(expired, sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  /** Remove expired sessions (call periodically) */
  prune(): void {
    this.db.prepare("DELETE FROM sessions WHERE expired <= datetime('now')").run();
  }
}
