import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getUserAchievements } from './db.js';
import { ACHIEVEMENTS } from './registry.js';

export const achievementsRouter = Router();

// GET / — returns all achievements with earned/locked status for current user
achievementsRouter.get('/', requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const earned = getUserAchievements(userId);
  const earnedMap = new Map(earned.map(e => [e.achievement_id, e.granted_at]));

  const result = ACHIEVEMENTS.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    earned: earnedMap.has(a.id),
    grantedAt: earnedMap.get(a.id) || null,
  }));

  res.json({ achievements: result, earned: earned.length, total: ACHIEVEMENTS.length });
});
