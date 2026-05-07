import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireTier } from '../auth/middleware.js';
import { queryHistory, toggleBookmark, deleteHistory, updateTags, exportCsv } from './db.js';
import '../auth/types.js';

export const historyRouter = Router();

// GET /api/history
historyRouter.get('/', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const { limit, offset, search, bookmarked } = req.query;
    const rows = queryHistory(user.id, {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      search: search ? String(search) : undefined,
      bookmarkedOnly: bookmarked === '1' || bookmarked === 'true',
      tier: user.tier,
    });
    res.json({ entries: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/history/export.csv
historyRouter.get('/export.csv', requireTier('research'), (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const csv = exportCsv(user.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analysis-history.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/history/:id/bookmark
historyRouter.post('/:id/bookmark', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    toggleBookmark(id, user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/history/:id/tags
historyRouter.post('/:id/tags', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const { tags } = req.body;
    if (typeof tags !== 'string') {
      res.status(400).json({ error: 'tags must be a string' });
      return;
    }
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagList.length > 20) {
      res.status(400).json({ error: 'Maximum 20 comma-separated tags allowed' });
      return;
    }
    updateTags(id, user.id, tagList.join(','));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// DELETE /api/history/:id
historyRouter.delete('/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    deleteHistory(id, user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
