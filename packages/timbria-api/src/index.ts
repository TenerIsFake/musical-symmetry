import express, { type Express } from 'express';
import cors from 'cors';
import { runAllMigrations } from './db.js';
import { catalogRouter } from './catalog/routes.js';
import { identifyRouter } from './identify/routes.js';
import { makeAccessMiddleware, cfAccessVerifier } from './auth/access.js';
import { makeTierResolver, revenueCatEntitlements } from './auth/tier.js';
import { artistsRouter } from './artists/routes.js';
import { reviewRouter } from './review/routes.js';
import { makeLookupRouter } from './lookup/routes.js';
import { runLookup } from './lookup/lookup.js';

const owner = process.env.OWNER_EMAIL || 'tenerjenkins@gmail.com';

export const tierResolver = makeTierResolver({
  ownerEmail: owner,
  fetchEntitlements: revenueCatEntitlements,
});

// Production seam: web search is not wired for Feature B MVP.
// The orchestrator treats a throw as "no evidence" → route returns 'no-sourced-gear'.
// Replace with a real search provider (e.g. Brave Search API) in a future task.
async function prodWebSearch(_query: string): Promise<string> {
  throw new Error('web search not configured');
}

// Production seam: calls Anthropic Messages API using ANTHROPIC_API_KEY env var.
// Falls back gracefully (throws → orchestrator returns []) if key is absent.
async function prodLlm(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`anthropic ${resp.status}`);
  const data: any = await resp.json();
  return data?.content?.[0]?.text ?? '';
}

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/healthcheck', (_req, res) => res.json({ status: 'ok' }));
  if (process.env.NODE_ENV !== 'test') app.use(makeAccessMiddleware(cfAccessVerifier()));
  app.use('/api', catalogRouter);
  app.use('/api/identify', identifyRouter);
  app.use('/api/artists', artistsRouter);
  app.use('/api/review', reviewRouter(owner));
  app.use('/api', makeLookupRouter({
    resolveTier: tierResolver,
    doLookup: (artist, gearIndex) => runLookup(artist, gearIndex, {
      webSearch: prodWebSearch,
      llm: prodLlm,
      timeoutMs: 20000,
    }),
  }));
  return app;
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  runAllMigrations();
  const app = createApp();
  const port = Number(process.env.PORT || 3061);
  app.listen(port, () => {
    import('./seed/load-seed.js').then(({ loadSeed }) => loadSeed());
    console.log(`timbria-api on ${port}`);
  });
}
