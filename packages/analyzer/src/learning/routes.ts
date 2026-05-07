import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getLessonProgress, markLessonComplete, resetProgress } from './db.js';

export const learningRouter = Router();

// GET /api/learning/progress — return all completed lessons for the authenticated user
learningRouter.get('/progress', requireAuth, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const progress = getLessonProgress(userId);
  res.json({ progress });
});

// POST /api/learning/progress/:pathId/:lessonId/complete — mark a lesson complete (idempotent)
learningRouter.post('/progress/:pathId/:lessonId/complete', requireAuth, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const { pathId, lessonId } = req.params;

  if (!pathId || !lessonId) {
    res.status(400).json({ error: 'pathId and lessonId are required' });
    return;
  }

  markLessonComplete(userId, pathId, lessonId);
  res.json({ ok: true });
});

// DELETE /api/learning/progress/:pathId — reset all progress for a path
learningRouter.delete('/progress/:pathId', requireAuth, (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const { pathId } = req.params;

  if (!pathId) {
    res.status(400).json({ error: 'pathId is required' });
    return;
  }

  resetProgress(userId, pathId);
  res.json({ ok: true });
});
