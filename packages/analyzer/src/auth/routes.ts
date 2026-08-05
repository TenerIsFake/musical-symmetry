import { Router } from 'express';
import {
  createMagicToken,
  verifyMagicToken,
  getOrCreateUser,
  getUserById,
  getUserByApiKey,
  regenerateApiKey,
} from './db.js';
import { requireAuth } from './middleware.js';
import { isEmailConfigured, sendMagicLinkEmail } from './email.js';
import './types.js';

export const authRouter = Router();

// ── Rate limiting for magic-link requests ────────────────────────────────────
// Simple in-memory sliding-window limiter (no extra dependencies). Limits both
// per-IP and per-email to blunt login-email bombing and abuse. State is
// per-process, which is fine for this single-instance deployment.
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_REQUESTS = 5;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return false;
}

// Periodically drop empty buckets so the map does not grow unbounded.
const rateCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, times] of rateBuckets) {
    const recent = times.filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) rateBuckets.delete(key);
    else rateBuckets.set(key, recent);
  }
}, RATE_WINDOW_MS);
rateCleanup.unref?.();

// POST /api/auth/magic-link — Generate a magic link token
authRouter.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    if (isRateLimited(`ip:${req.ip}`) || isRateLimited(`email:${email.toLowerCase()}`)) {
      res.status(429).json({ error: 'Too many login requests. Please try again later.' });
      return;
    }

    const token = createMagicToken(email);

    if (isEmailConfigured()) {
      const sent = await sendMagicLinkEmail(email, token);
      if (!sent) {
        res.status(500).json({ error: 'Failed to send login email' });
        return;
      }
      res.json({ message: 'Check your email for a login link' });
    } else if (process.env.NODE_ENV !== 'production') {
      // Dev convenience only. NEVER return the token in production: doing so
      // would let anyone log in as any email address.
      res.json({
        message: 'Magic link generated (dev mode: token returned in response)',
        token,
        verifyUrl: `/api/auth/verify?token=${token}`,
      });
    } else {
      // Production with email misconfigured: fail closed.
      console.error('magic-link requested but RESEND_API_KEY is not configured');
      res.status(503).json({ error: 'Login is temporarily unavailable. Please try again later.' });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/auth/verify — Verify magic link token & create session.
// This URL is what users click in the login email, so on success we redirect
// (302) into the SPA dashboard instead of returning raw JSON. The SPA uses
// hash routing, so the dashboard lives at /#dashboard.
authRouter.get('/verify', (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.redirect(302, '/#dashboard?login=missing-token');
      return;
    }

    const email = verifyMagicToken(token);
    if (!email) {
      res.redirect(302, '/#dashboard?login=invalid-or-expired');
      return;
    }

    const user = getOrCreateUser('magic', { email });

    req.session.userId = user.id;
    res.redirect(302, '/#dashboard?login=success');
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/auth/me — Return current user info
authRouter.get('/me', (req, res) => {
  try {
    if (!req.session?.userId) {
      // Check API key
      const apiKey = req.headers['x-api-key'] as string | undefined;
      if (apiKey) {
        const user = getUserByApiKey(apiKey);
        if (user) {
          res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            tier: user.tier,
            hasApiKey: !!user.api_key,
            created_at: user.created_at,
          });
          return;
        }
      }
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      hasApiKey: !!user.api_key,
      created_at: user.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/auth/logout — Clear session
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// GET /api/auth/api-key — Generate or return API key
authRouter.get('/api-key', requireAuth, (req, res) => {
  try {
    const user = req.user!;

    if (req.query.regenerate === 'true') {
      const newKey = regenerateApiKey(user.id);
      res.json({ apiKey: newKey, message: 'API key regenerated' });
      return;
    }

    res.json({ apiKey: user.api_key });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
