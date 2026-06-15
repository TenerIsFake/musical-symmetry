import express, { type Express } from 'express';
import cors from 'cors';
import { runAllMigrations } from './db.js';
import { catalogRouter } from './catalog/routes.js';
import { identifyRouter } from './identify/routes.js';
import { makeAccessMiddleware, cfAccessVerifier } from './auth/access.js';
import { makeTierResolver, revenueCatEntitlements } from './auth/tier.js';
import { artistsRouter } from './artists/routes.js';
import { reviewRouter } from './review/routes.js';

const owner = process.env.OWNER_EMAIL || 'tenerjenkins@gmail.com';

export const tierResolver = makeTierResolver({
  ownerEmail: owner,
  fetchEntitlements: revenueCatEntitlements,
});

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
