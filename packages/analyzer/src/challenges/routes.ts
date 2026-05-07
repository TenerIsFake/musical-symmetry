import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getUserById, getUserByApiKey, getDb } from '../auth/db.js';
import {
  getTodayChallenge,
  generateTodayChallenge,
  submitChallenge,
  getUserChallengeStreak,
  getLeaderboard,
} from './db.js';
import '../auth/types.js';

export const challengesRouter = Router();

// Attach user if authenticated (but don't reject anonymous requests)
function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const user = getUserByApiKey(apiKey);
    if (user) req.user = user;
  } else if (req.session?.userId) {
    const user = getUserById(req.session.userId);
    if (user) req.user = user;
  }
  next();
}

// GET /api/challenges/today
challengesRouter.get('/today', optionalAuth, (req, res) => {
  try {
    const challenge = generateTodayChallenge();
    const distractors = JSON.parse(challenge.distractors) as string[];
    const pitchClasses = JSON.parse(challenge.pitch_classes) as number[];

    let submitted: boolean | undefined;
    let userAnswer: string | undefined;

    if (req.user) {
      const db = getDb();
      const sub = db.prepare(
        'SELECT answer FROM daily_submissions WHERE user_id = ? AND challenge_id = ?'
      ).get(req.user.id, challenge.id) as { answer: string } | undefined;
      submitted = !!sub;
      userAnswer = sub?.answer;
    }

    res.json({
      id: challenge.id,
      date: challenge.date,
      forte: challenge.forte,
      pitchClasses,
      questionType: challenge.question_type,
      distractors,
      ...(req.user !== undefined ? { submitted, userAnswer } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/challenges/today/submit
challengesRouter.post('/today/submit', requireAuth, (req, res) => {
  try {
    const challenge = getTodayChallenge();
    if (!challenge) {
      res.status(404).json({ error: 'No challenge for today' });
      return;
    }

    const { answer, elapsedSec } = req.body as { answer?: string; elapsedSec?: number };
    if (!answer || typeof answer !== 'string') {
      res.status(400).json({ error: 'answer is required' });
      return;
    }

    const result = submitChallenge(
      req.user!.id,
      challenge.id,
      answer,
      typeof elapsedSec === 'number' ? elapsedSec : null,
    );

    const streak = getUserChallengeStreak(req.user!.id);

    res.json({ ...result, streak });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/challenges/leaderboard
challengesRouter.get('/leaderboard', (_req, res) => {
  try {
    const entries = getLeaderboard(10);
    res.json({ leaderboard: entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/challenges/streak
challengesRouter.get('/streak', requireAuth, (req, res) => {
  try {
    const streak = getUserChallengeStreak(req.user!.id);
    res.json({ streak });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});
