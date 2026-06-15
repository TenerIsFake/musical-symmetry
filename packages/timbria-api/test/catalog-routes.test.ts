import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import { setDbForTest, runAllMigrations } from '../src/db.js';
import { loadSeed } from '../src/seed/load-seed.js';
import { SEED_FX } from '../src/seed/seed-data.js';
import { createApp } from '../src/index.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runAllMigrations(); loadSeed(); });

describe('catalog + identify routes', () => {
  it('GET /api/fx returns seeded fx types', async () => {
    const res = await request(createApp()).get('/api/fx');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(SEED_FX.length);
    expect(res.body[0]).toHaveProperty('fingerprint');
  });
  it('GET /api/identify/tree returns the root node', async () => {
    const res = await request(createApp()).get('/api/identify/tree');
    expect(res.status).toBe(200);
    expect(res.body.root.question).toMatch(/character|effect/i);
  });
});
