import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { router } from './routes.js';
import { authRouter } from './auth/routes.js';
import { billingRouter } from './auth/stripe.js';
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

// Existing API routes
app.use('/api', router);

function pruneStaleData() {
  sessionStore.prune();
  db.prepare("DELETE FROM api_usage WHERE timestamp < datetime('now', '-7 days')").run();
  db.prepare("DELETE FROM magic_tokens WHERE created_at < datetime('now', '-1 hour')").run();
}

pruneStaleData();
setInterval(pruneStaleData, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app };
