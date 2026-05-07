import { getDb } from '../auth/db.js';

export function runExerciseMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exercise_key TEXT NOT NULL,
      completed_at TEXT DEFAULT (datetime('now')),
      sketch_id INTEGER,
      UNIQUE(user_id, exercise_key)
    );
    CREATE INDEX IF NOT EXISTS idx_exercise_completions_user ON exercise_completions(user_id);
  `);
}

export function getCompletedExercises(userId: string): string[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT exercise_key FROM exercise_completions WHERE user_id = ? ORDER BY completed_at ASC'
  ).all(userId) as Array<{ exercise_key: string }>;
  return rows.map(r => r.exercise_key);
}

export function completeExercise(userId: string, exerciseKey: string, sketchId?: number): void {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO exercise_completions (user_id, exercise_key, sketch_id) VALUES (?, ?, ?)'
  ).run(userId, exerciseKey, sketchId ?? null);
}

export function isExerciseComplete(userId: string, exerciseKey: string): boolean {
  const db = getDb();
  const row = db.prepare(
    'SELECT 1 FROM exercise_completions WHERE user_id = ? AND exercise_key = ?'
  ).get(userId, exerciseKey);
  return row !== undefined;
}
