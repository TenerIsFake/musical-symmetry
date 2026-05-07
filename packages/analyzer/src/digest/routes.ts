import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../auth/db.js';
import {
  sendWeeklyDigests,
  buildPreviewHtml,
  getSetClassOfTheWeek,
  getLastDigestSentAt,
} from './weekly-digest.js';
import '../auth/types.js';

export const digestRouter = Router();

// GET /api/digest/preview — returns the digest HTML for the authenticated user
digestRouter.get('/preview', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const html = buildPreviewHtml(user.id);

    if (!html) {
      res.status(404).json({ error: 'Could not generate preview — user not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/digest/send — admin-only trigger to send all weekly digests
digestRouter.post('/send', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (user.tier !== 'research') {
      res.status(403).json({ error: 'Admin access required (research tier)' });
      return;
    }

    const result = await sendWeeklyDigests();
    res.json({
      message: 'Digest send complete',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/digest/status — admin-only: last send time and set class of week
digestRouter.get('/status', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;

    if (user.tier !== 'research') {
      res.status(403).json({ error: 'Admin access required (research tier)' });
      return;
    }

    const lastSent = getLastDigestSentAt();
    const setClass = getSetClassOfTheWeek();

    res.json({
      lastSent,
      setClassOfTheWeek: setClass,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/digest/unsubscribe — token-based opt-out (no auth required)
digestRouter.get('/unsubscribe', (req: Request, res: Response): void => {
  try {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Invalid unsubscribe token' });
      return;
    }

    let userId: string;
    try {
      userId = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      res.status(400).json({ error: 'Malformed unsubscribe token' });
      return;
    }

    if (!userId || userId.length === 0) {
      res.status(400).json({ error: 'Malformed unsubscribe token' });
      return;
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    db.prepare('UPDATE users SET digest_optout = 1 WHERE id = ?').run(userId);

    // Return a minimal HTML confirmation page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribed — Musical Symmetry</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:80px auto;padding:0 20px;text-align:center;">
    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin-bottom:12px;">You've been unsubscribed</h1>
    <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin-bottom:24px;">
      You won't receive weekly digest emails anymore. You can re-enable them from your account settings.
    </p>
    <a href="${process.env.APP_URL || 'https://symmetry.tendrid.us'}"
       style="display:inline-block;background:#6366f1;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Back to Musical Symmetry
    </a>
  </div>
</body>
</html>`);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/digest/resubscribe — re-enable digests for authenticated user
digestRouter.post('/resubscribe', requireAuth, (req: Request, res: Response): void => {
  try {
    const user = req.user!;
    const db = getDb();
    db.prepare('UPDATE users SET digest_optout = 0 WHERE id = ?').run(user.id);
    res.json({ message: 'Weekly digests re-enabled' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
