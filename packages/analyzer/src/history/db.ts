import { getDb } from '../auth/db.js';

export function runHistoryMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK(type IN ('classify','analyze')),
      pitch_classes TEXT NOT NULL,
      forte      TEXT,
      prime_form TEXT,
      interval_vector TEXT,
      tags       TEXT DEFAULT '',
      bookmarked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_history_user ON analysis_history(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_bookmarked ON analysis_history(user_id, bookmarked);
  `);
}

export interface HistoryRow {
  id: number;
  user_id: string;
  type: string;
  pitch_classes: string;
  forte: string | null;
  prime_form: string | null;
  interval_vector: string | null;
  tags: string;
  bookmarked: number;
  created_at: string;
}

export interface QueryHistoryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  bookmarkedOnly?: boolean;
  since?: string;
  tier?: string;
}

export function insertHistory(
  userId: string,
  type: 'classify' | 'analyze',
  pitchClasses: string,
  forte: string | null,
  primeForm: string | null,
  intervalVector: string | null,
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO analysis_history (user_id, type, pitch_classes, forte, prime_form, interval_vector)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type, pitchClasses, forte, primeForm, intervalVector);
}

export function queryHistory(userId: string, options: QueryHistoryOptions = {}): HistoryRow[] {
  const db = getDb();
  const {
    limit = 50,
    offset = 0,
    search,
    bookmarkedOnly = false,
    tier,
  } = options;

  const conditions: string[] = ['user_id = ?'];
  const params: (string | number)[] = [userId];

  // Free tier: only last 7 days OR bookmarked rows
  if (!tier || (tier !== 'pro' && tier !== 'research')) {
    conditions.push("(created_at >= date('now','-7 days') OR bookmarked = 1)");
  }

  if (bookmarkedOnly) {
    conditions.push('bookmarked = 1');
  }

  if (search) {
    conditions.push("(forte LIKE ? OR prime_form LIKE ? OR tags LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.join(' AND ');
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
  const safeOffset = Math.max(0, Number(offset) || 0);

  return db.prepare(`
    SELECT * FROM analysis_history
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, safeOffset) as HistoryRow[];
}

export function toggleBookmark(historyId: number, userId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE analysis_history
    SET bookmarked = CASE WHEN bookmarked = 1 THEN 0 ELSE 1 END
    WHERE id = ? AND user_id = ?
  `).run(historyId, userId);
}

export function deleteHistory(historyId: number, userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM analysis_history WHERE id = ? AND user_id = ?').run(historyId, userId);
}

export function updateTags(historyId: number, userId: string, tags: string): void {
  const db = getDb();
  db.prepare('UPDATE analysis_history SET tags = ? WHERE id = ? AND user_id = ?').run(tags, historyId, userId);
}

export function exportCsv(userId: string): string {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, type, pitch_classes, forte, prime_form, interval_vector, tags, bookmarked, created_at
    FROM analysis_history
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as Omit<HistoryRow, 'user_id'>[];

  const header = 'id,type,pitch_classes,forte,prime_form,interval_vector,tags,bookmarked,created_at';
  const csvEscape = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = rows.map(r =>
    [r.id, r.type, r.pitch_classes, r.forte, r.prime_form, r.interval_vector, r.tags, r.bookmarked, r.created_at]
      .map(csvEscape)
      .join(',')
  );

  return [header, ...lines].join('\n');
}
