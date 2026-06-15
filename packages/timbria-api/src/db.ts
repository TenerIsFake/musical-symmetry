import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

let _db: DB | null = null;

export function getDb(): DB {
  if (_db) return _db;
  const path = process.env.TIMBRIA_DB || './timbria.db';
  _db = new Database(path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

// Allows tests to use an isolated in-memory db
export function setDbForTest(db: DB): void {
  _db = db;
}

const migrations: Array<() => void> = [];
export function registerMigration(fn: () => void): void {
  migrations.push(fn);
}
export function runAllMigrations(): void {
  for (const m of migrations) m();
}
