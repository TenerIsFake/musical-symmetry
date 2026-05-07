import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getCompletedExercises, completeExercise } from './db.js';
import { getSuggestedExercises } from './generator.js';

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

// GET / — suggested exercises for the authenticated user
exercisesRouter.get('/', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const maxResults = Math.min(10, Math.max(1, parseInt(req.query['max'] as string) || 5));
  const exercises = getSuggestedExercises(userId, maxResults);
  res.json({ exercises });
});

// GET /completed — list completed exercise keys
exercisesRouter.get('/completed', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const completed = getCompletedExercises(userId);
  res.json({ completed });
});

// POST /:key/complete — mark an exercise done
exercisesRouter.post('/:key/complete', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const { key } = req.params;

  if (!key) {
    res.status(400).json({ error: 'exercise key is required' });
    return;
  }

  const sketchId = req.body?.sketchId as number | undefined;
  completeExercise(userId, key, sketchId);
  res.json({ ok: true });
});
