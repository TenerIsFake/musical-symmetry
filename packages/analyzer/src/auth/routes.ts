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
import './types.js';

export const authRouter = Router();

// POST /api/auth/magic-link — Generate a magic link token
authRouter.post('/magic-link', (req, res) => {
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

    const token = createMagicToken(email);

    // In production, send this via email. For now, return it directly.
    res.json({
      message: 'Magic link generated (dev mode: token returned in response)',
      token,
      verifyUrl: `/api/auth/verify?token=${token}`,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// GET /api/auth/verify — Verify magic link token & create session
authRouter.get('/verify', (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const email = verifyMagicToken(token);
    if (!email) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const user = getOrCreateUser('magic', { email });

    req.session.userId = user.id;
    res.json({
      message: 'Authenticated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
    });
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
