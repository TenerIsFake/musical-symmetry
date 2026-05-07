import { getDb } from '../auth/db.js';

export function runLearningMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      path_id     TEXT NOT NULL,
      lesson_id   TEXT NOT NULL,
      completed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, path_id, lesson_id)
    );
    CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
  `);
}

export function getLessonProgress(userId: string): Array<{ path_id: string; lesson_id: string; completed_at: string }> {
  const db = getDb();
  return db.prepare(
    'SELECT path_id, lesson_id, completed_at FROM lesson_progress WHERE user_id = ? ORDER BY completed_at ASC'
  ).all(userId) as Array<{ path_id: string; lesson_id: string; completed_at: string }>;
}

export function markLessonComplete(userId: string, pathId: string, lessonId: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO lesson_progress (user_id, path_id, lesson_id) VALUES (?, ?, ?)'
  ).run(userId, pathId, lessonId);
}

export function resetProgress(userId: string, pathId: string): void {
  const db = getDb();
  db.prepare(
    'DELETE FROM lesson_progress WHERE user_id = ? AND path_id = ?'
  ).run(userId, pathId);
}
