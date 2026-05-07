import crypto from 'node:crypto';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { router } from './routes.js';
import { authRouter } from './auth/routes.js';
import { billingRouter } from './auth/stripe.js';
import { collectionsRouter } from './collections/routes.js';
import { classroomRouter } from './classroom/routes.js';
import { initClassroomWs } from './classroom/ws.js';
import { atlasRouter } from './atlas/routes.js';
import { workspacesRouter } from './workspaces/routes.js';
import { digestRouter } from './digest/routes.js';
import { genreRouter } from './genre/routes.js';
import { contourRouter } from './contour/routes.js';
import { assignmentsRouter } from './assignments/routes.js';
import { runDigestMigration, sendWeeklyDigests, getLastDigestSentAt } from './digest/weekly-digest.js';
import { getDb } from './auth/db.js';
import { SqliteSessionStore } from './auth/session-store.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3010');

app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const ALLOWED_ORIGINS = [
  'https://symmetry.tendrid.us',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3009'] : []),
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// Raw body for Stripe webhook (must come before express.json())
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'musical-symmetry-dev-secret'
  ? process.env.SESSION_SECRET
  : crypto.randomBytes(32).toString('hex');

const db = getDb();
const sessionStore = new SqliteSessionStore(db);
app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Auth & billing routes
app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/classroom', classroomRouter);
app.use('/api/atlas', atlasRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/digest', digestRouter);
app.use('/api/genre', genreRouter);
app.use('/api/contour', contourRouter);
app.use('/api/assignments', assignmentsRouter);

// Existing API routes
app.use('/api', router);

function pruneStaleData() {
  sessionStore.prune();
  db.prepare("DELETE FROM api_usage WHERE timestamp < datetime('now', '-7 days')").run();
  db.prepare("DELETE FROM magic_tokens WHERE created_at < datetime('now', '-1 hour')").run();
}

pruneStaleData();
setInterval(pruneStaleData, 60 * 60 * 1000);

// Digest migrations and scheduler
runDigestMigration();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function checkAndSendDigest(): void {
  const lastSent = getLastDigestSentAt();
  if (lastSent) {
    const elapsed = Date.now() - new Date(lastSent).getTime();
    if (elapsed < SEVEN_DAYS_MS) {
      const nextMs = SEVEN_DAYS_MS - elapsed;
      const nextHours = Math.round(nextMs / (60 * 60 * 1000));
      console.log(`[digest] Last sent ${lastSent} — next digest in ~${nextHours}h`);
      return;
    }
  }

  // Check if it's Sunday 9am CT (UTC-5 standard / UTC-6 daylight)
  // We fire if we're within the same Sunday-9am window, or if no digest has ever been sent
  const now = new Date();
  const ctOffset = -6; // CDT; use -5 for CST
  const ctHour = (now.getUTCHours() + 24 + ctOffset) % 24;
  const ctDay = new Date(now.getTime() + ctOffset * 60 * 60 * 1000).getUTCDay(); // 0 = Sunday

  if (!lastSent || (ctDay === 0 && ctHour >= 9 && ctHour < 10)) {
    console.log('[digest] Triggering weekly digest send...');
    sendWeeklyDigests().catch((err: unknown) => {
      console.error('[digest] Scheduler error:', err);
    });
  }
}

// Check on startup, then every hour
checkAndSendDigest();
setInterval(checkAndSendDigest, 60 * 60 * 1000);

const server = createServer(app);
initClassroomWs(server);

server.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app, server };
