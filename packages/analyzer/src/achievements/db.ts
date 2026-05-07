import { getDb } from '../auth/db.js';
import { ACHIEVEMENTS } from './registry.js';

export function runAchievementMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL,
      granted_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, achievement_id)
    );
  `);
}

export function checkAndGrantAchievements(userId: string): string[] {
  const db = getDb();

  const already = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(userId) as { achievement_id: string }[];
  const alreadySet = new Set(already.map(r => r.achievement_id));

  const newlyGranted: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (alreadySet.has(achievement.id)) continue;
    try {
      const earned = achievement.check(userId, db);
      if (earned) {
        db.prepare('INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)').run(userId, achievement.id);
        newlyGranted.push(achievement.id);
      }
    } catch {
      // Silently skip failed checks
    }
  }

  return newlyGranted;
}

export function getUserAchievements(userId: string): Array<{ achievement_id: string; granted_at: string }> {
  const db = getDb();
  return db.prepare('SELECT achievement_id, granted_at FROM achievements WHERE user_id = ? ORDER BY granted_at ASC').all(userId) as Array<{ achievement_id: string; granted_at: string }>;
}
