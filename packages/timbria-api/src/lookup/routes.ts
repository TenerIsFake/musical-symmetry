import { Router } from 'express';
import { getDb } from '../db.js';
import { insertArtist, insertArtistGear, findArtistByName } from '../artists/db.js';
import type { ParsedGear } from './parse.js';
import type { Tier } from '../auth/tier.js';

export interface LookupRouteDeps {
  resolveTier: (email: string | null) => Promise<Tier>;
  doLookup: (artist: string, gearIndex: Map<string, number>) => Promise<ParsedGear[]>;
}

export function makeLookupRouter(deps: LookupRouteDeps): Router {
  const r = Router();
  const lastRun = new Map<string, number>();
  const CACHE_MS = 24 * 60 * 60_000;

  r.post('/artists/:name/lookup', async (req, res) => {
    const tier = await deps.resolveTier((req as any).userEmail ?? null);
    if (tier !== 'pro' && tier !== 'research') return res.status(402).json({ error: 'upgrade required' });

    const name = req.params.name;
    if (Date.now() - (lastRun.get(name.toLowerCase()) ?? 0) < CACHE_MS)
      return res.json({ status: 'cached', inserted: 0 });

    const gearIndex = new Map<string, number>(
      (getDb().prepare('SELECT id, lower(name) AS n FROM gear_item').all() as any[]).map(x => [x.n, x.id]));
    const drafts = await deps.doLookup(name, gearIndex);
    if (drafts.length === 0) return res.json({ status: 'no-sourced-gear', inserted: 0 });
    lastRun.set(name.toLowerCase(), Date.now());

    const artistId = findArtistByName(name)?.id
      ?? insertArtist({ name, role: '', era: '', genre: '', notes: '' });
    const tx = getDb().transaction((rows: ParsedGear[]) => {
      for (const d of rows) insertArtistGear({ artist_id: artistId, gear_item_id: d.gear_item_id,
        context: d.context, source_url: d.source_url, confidence: d.confidence,
        status: 'draft', added_by: 'llm-lookup', reviewed_at: null });
    });
    tx(drafts);
    return res.json({ status: 'drafted', inserted: drafts.length });
  });
  return r;
}
