import { Router } from 'express';
import {
  createMagicToken,
  verifyMagicToken,
  getOrCreateUser,
  getUserById,
  getUserByApiKey,
  regenerateApiKey,
  deleteAccount,
} from './db.js';
import { requireAuth } from './middleware.js';
import { isEmailConfigured, sendMagicLinkEmail } from './email.js';
import { cancelSubscription } from './stripe.js';
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

/**
 * DELETE /api/auth/account — erase this account and everything identifying it.
 *
 * Apple Guideline 5.1.1(v) requires an account-deletion path that a user can
 * start inside the app. Before 2026-09-21 this project had none: the published
 * page told people to send an email, which satisfies Google Play's Data Safety
 * rules but not Apple's, and is a poor answer to a GDPR erasure request either
 * way. The same endpoint backs the iOS Settings screen, the web Dashboard and
 * the Android app.
 *
 * The caller must retype their own email address. Deletion is irreversible and
 * a stray tap should not be sufficient.
 *
 * Stripe is cancelled BEFORE the database work, and deliberately outside the
 * transaction — it is a network call, and holding SQLite open across one turns
 * a slow response into a locked database. A failed cancellation is logged and
 * does not stop the erasure: the user's right to leave outranks our billing
 * bookkeeping, and a subscription with no account cannot be renewed into
 * anything meaningful.
 */
authRouter.delete('/account', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const confirm = typeof req.body?.confirm === 'string' ? req.body.confirm.trim() : '';

    if (confirm.toLowerCase() !== user.email.toLowerCase()) {
      res.status(400).json({
        error: 'Type your account email address exactly to confirm deletion.',
      });
      return;
    }

    let cancelled: string | null = null;
    if (user.stripe_subscription_id) {
      if (await cancelSubscription(user.stripe_subscription_id)) {
        cancelled = user.stripe_subscription_id;
      }
    }

    try {
      deleteAccount(user.id);
    } catch (err) {
      // The database work is transactional and has rolled back, so the account
      // survives — but Stripe has already cancelled and there is nothing to
      // undo it with. This cannot be made atomic across two systems, so make
      // it loud instead: the id below is what a human needs to reinstate it.
      if (cancelled) {
        console.error(
          '[billing] ORPHANED CANCELLATION — subscription', cancelled,
          'was cancelled at Stripe but the account deletion then failed and rolled back.',
          'The account still exists with no active subscription. Reinstate it by hand.',
          err instanceof Error ? err.message : err,
        );
      }
      throw err;
    }

    // The session store is keyed by sid and holds no user column, so the
    // caller's session is destroyed here rather than swept by user id.
    req.session?.destroy(() => {});
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
