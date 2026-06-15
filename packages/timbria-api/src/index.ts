import express, { type Express } from 'express';
import cors from 'cors';
import { runAllMigrations } from './db.js';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/healthcheck', (_req, res) => res.json({ status: 'ok' }));
  return app;
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  runAllMigrations();
  const app = createApp();
  const port = Number(process.env.PORT || 3061);
  app.listen(port, () => console.log(`timbria-api on ${port}`));
}
