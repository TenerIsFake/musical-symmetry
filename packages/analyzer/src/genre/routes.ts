import { Router } from 'express';
import { detectGenre, suggestNextChord } from './analyzer.js';
import { rateLimit } from '../auth/middleware.js';

export const genreRouter = Router();

/**
 * POST /api/genre/detect
 * Body: { forteNumbers: string[], intervalVector: number[] }
 * Returns: { matches: GenreMatch[] }
 *
 * Tier gating:
 *   Free      → top 1 match only
 *   Pro       → all 3 matches
 *   Research  → all 3 matches + batch support (see /batch endpoint)
 */
genreRouter.post('/detect', rateLimit('genre-detect'), (req, res) => {
  try {
    const { forteNumbers, intervalVector } = req.body as {
      forteNumbers?: unknown;
      intervalVector?: unknown;
    };

    if (!Array.isArray(forteNumbers)) {
      res.status(400).json({ error: '"forteNumbers" must be an array of strings' });
      return;
    }

    if (!Array.isArray(intervalVector) || intervalVector.length !== 6) {
      res.status(400).json({ error: '"intervalVector" must be an array of exactly 6 numbers' });
      return;
    }

    const fns = forteNumbers.map(String);
    const iv = intervalVector.map(Number) as [number, number, number, number, number, number];

    const allMatches = detectGenre(fns, iv);

    // Determine tier from req.user (attached by rateLimit middleware)
    const user = (req as any).user as { tier?: string } | undefined;
    const tier = user?.tier ?? 'anonymous';

    const matches = tier === 'free' || tier === 'anonymous'
      ? allMatches.slice(0, 1)
      : allMatches;

    res.json({ matches });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/genre/suggest
 * Body: { progression: number[][], genre?: string }
 * Returns: { suggestions: Array<{ pcs: number[], name: string, reason: string }> }
 *
 * Tier gating:
 *   Free     → 403 (not available)
 *   Pro      → enabled
 *   Research → enabled
 */
genreRouter.post('/suggest', rateLimit('genre-suggest'), (req, res) => {
  try {
    const { progression, genre } = req.body as {
      progression?: unknown;
      genre?: unknown;
    };

    if (!Array.isArray(progression) || progression.length === 0) {
      res.status(400).json({ error: '"progression" must be a non-empty array of pitch-class arrays' });
      return;
    }

    // Validate each chord
    for (const chord of progression) {
      if (!Array.isArray(chord)) {
        res.status(400).json({ error: 'Each chord in "progression" must be an array of pitch classes (0–11)' });
        return;
      }
    }

    const genreStr = typeof genre === 'string' ? genre : undefined;
    const suggestions = suggestNextChord(progression as number[][], genreStr);

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
