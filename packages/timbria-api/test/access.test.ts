import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeAccessMiddleware, requireOwner } from '../src/auth/access.js';

function appWith(email: string | null) {
  const app = express();
  const access = makeAccessMiddleware(async () => (email ? { email } : null));
  app.use(access);
  app.get('/me', (req, res) => res.json({ email: (req as any).userEmail ?? null }));
  app.get('/admin', requireOwner('owner@x.com'), (_req, res) => res.json({ ok: true }));
  return app;
}

describe('requireOwner misconfiguration', () => {
  it('throws if constructed with empty ownerEmail (fail-closed config)', () => {
    expect(() => requireOwner('')).toThrow();
    expect(() => requireOwner(undefined as any)).toThrow();
  });
});

describe('access middleware', () => {
  it('attaches verified email', async () => {
    const res = await request(appWith('a@x.com')).get('/me');
    expect(res.body.email).toBe('a@x.com');
  });
  it('owner gate allows owner, blocks others', async () => {
    expect((await request(appWith('owner@x.com')).get('/admin')).status).toBe(200);
    expect((await request(appWith('a@x.com')).get('/admin')).status).toBe(403);
  });
  it('blocks when no valid token', async () => {
    expect((await request(appWith(null)).get('/admin')).status).toBe(403);
  });
});
