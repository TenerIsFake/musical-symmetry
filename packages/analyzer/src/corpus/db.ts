import { getDb } from '../auth/db.js';

export function runCorpusMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS corpora (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      file_count  INTEGER NOT NULL,
      stats_json  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_corpora_user ON corpora(user_id);
  `);
}

export function saveCorpus(
  userId: string,
  name: string,
  fileCount: number,
  stats: any,
): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO corpora (user_id, name, file_count, stats_json)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, name, fileCount, JSON.stringify(stats));
  return result.lastInsertRowid as number;
}

export function listCorpora(
  userId: string,
): Array<{ id: number; name: string; fileCount: number; createdAt: string }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, file_count, created_at
       FROM corpora
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(userId) as Array<{
      id: number;
      name: string;
      file_count: number;
      created_at: string;
    }>;
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    fileCount: r.file_count,
    createdAt: r.created_at,
  }));
}

export function getCorpus(
  id: number,
  userId: string,
): { id: number; name: string; fileCount: number; stats: any; createdAt: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, file_count, stats_json, created_at
       FROM corpora
       WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as
    | { id: number; name: string; file_count: number; stats_json: string; created_at: string }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    fileCount: row.file_count,
    stats: JSON.parse(row.stats_json),
    createdAt: row.created_at,
  };
}

export function deleteCorpus(id: number, userId: string): boolean {
  const db = getDb();
  const result = db
    .prepare(`DELETE FROM corpora WHERE id = ? AND user_id = ?`)
    .run(id, userId);
  return result.changes > 0;
}
