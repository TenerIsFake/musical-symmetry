import express from 'express';
import session from 'express-session';
import { router } from './routes.js';
import { authRouter } from './auth/routes.js';
import { billingRouter } from './auth/stripe.js';
import { getDb } from './auth/db.js';
import { SqliteSessionStore } from './auth/session-store.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3010');

app.use(express.json());

// Session middleware
const db = getDb();
app.use(session({
  store: new SqliteSessionStore(db),
  secret: process.env.SESSION_SECRET || 'musical-symmetry-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

// Auth & billing routes
app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);

// Existing API routes
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app };
