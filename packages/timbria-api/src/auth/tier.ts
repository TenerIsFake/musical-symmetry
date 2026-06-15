import type { RequestHandler } from 'express';

export type Tier = 'free' | 'student' | 'pro' | 'research';
const RANK: Record<Tier, number> = { free: 0, student: 1, pro: 2, research: 3 };

export interface TierDeps {
  ownerEmail: string;
  fetchEntitlements: (email: string) => Promise<string[]>; // active RevenueCat entitlement ids
}

export function makeTierResolver(deps: TierDeps): (email: string | null) => Promise<Tier> {
  const cache = new Map<string, { tier: Tier; at: number }>();
  return async (email) => {
    if (!email) return 'free';
    if (email === deps.ownerEmail) return 'research';
    const hit = cache.get(email);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.tier;
    const ents = await deps.fetchEntitlements(email);
    const tier: Tier = ents.includes('research') ? 'research'
      : ents.includes('pro') ? 'pro' : ents.includes('student') ? 'student' : 'free';
    cache.set(email, { tier, at: Date.now() });
    return tier;
  };
}

// Production entitlement fetch (RevenueCat REST v1 subscriber endpoint)
export async function revenueCatEntitlements(email: string): Promise<string[]> {
  const key = process.env.REVENUECAT_API_KEY!;
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return [];
  const data: any = await r.json();
  return Object.keys(data?.subscriber?.entitlements ?? {});
}

export function requireTier(min: Tier, resolve: (email: string | null) => Promise<Tier>): RequestHandler {
  return async (req, res, next) => {
    const tier = await resolve((req as any).userEmail ?? null);
    if (RANK[tier] >= RANK[min]) return next();
    return res.status(402).json({ error: 'upgrade required', required: min, current: tier });
  };
}
