import type { Request, Response, NextFunction } from 'express';
import { getUserByApiKey, getUserById, recordUsage, getUsageCount, type User } from './db.js';
import './types.js';

type Tier = 'anonymous' | 'free' | 'pro' | 'research';

const TIER_LIMITS: Record<Tier, Record<string, number>> = {
  anonymous: { classify: 50, batch: 0, analyze: 3, og: 20 },
  free:      { classify: 100, batch: 10, analyze: 10, og: 50 },
  pro:       { classify: 1000, batch: 100, analyze: 100, og: -1 },
  research:  { classify: 10000, batch: 1000, analyze: 1000, og: -1 },
};

function resolveUser(req: Request): { user: User | null; tier: Tier } {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const user = getUserByApiKey(apiKey);
    if (user) {
      req.user = user;
      return { user, tier: (user.tier as Tier) || 'free' };
    }
  }

  // Check session
  if (req.session?.userId) {
    const user = getUserById(req.session.userId);
    if (user) {
      req.user = user;
      return { user, tier: (user.tier as Tier) || 'free' };
    }
  }

  return { user: null, tier: 'anonymous' };
}

export function rateLimit(endpoint: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { user, tier } = resolveUser(req);

    const limit = TIER_LIMITS[tier]?.[endpoint];
    if (limit === undefined) {
      // No limit defined for this endpoint, allow through
      next();
      return;
    }

    if (limit === 0) {
      res.status(403).json({
        error: `Endpoint '${endpoint}' is not available on the ${tier} tier`,
        upgrade: 'https://symmetry.tendrid.us/pricing',
      });
      return;
    }

    // Unlimited
    if (limit === -1) {
      recordUsage(user?.id || null, endpoint);
      next();
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const used = getUsageCount(user?.id || null, endpoint, since, user ? undefined : clientIp);

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - used).toString());

    if (used >= limit) {
      const retryAfterSeconds = 3600;
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      res.status(429).json({
        error: 'Rate limit exceeded',
        limit,
        used,
        tier,
        retryAfter: retryAfterSeconds,
        upgrade: tier !== 'research' ? 'https://symmetry.tendrid.us/pricing' : undefined,
      });
      return;
    }

    recordUsage(user?.id || null, endpoint, user ? undefined : clientIp);
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { user } = resolveUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
