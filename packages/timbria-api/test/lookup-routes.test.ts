import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import express from 'express';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, insertGear } from '../src/catalog/db.js';
import { runArtistMigration, listDrafts } from '../src/artists/db.js';
import { makeLookupRouter } from '../src/lookup/routes.js';

let calls = 0;
function app() {
  const a = express(); a.use(express.json());
  a.use((req, _res, next) => { (req as any).userEmail = 'pro@x.com'; next(); });
  a.use('/api', makeLookupRouter({
    resolveTier: async () => 'pro',
    doLookup: async () => { calls++; return [{ gear_item_id: 1, context: 'vox', source_url: 'https://s', confidence: 'high' as const }]; },
  }));
  return a;
}
beforeEach(() => {
  calls = 0; setDbForTest(new Database(':memory:')); runCatalogMigration(); runArtistMigration();
  const fx = insertFxType({ name: 'X', category: 'reverb', fingerprint: '', tells: '', era: '', typical_use: '' });
  insertGear({ name: 'Unit', fx_type_id: fx, manufacturer: '', kind: 'hardware' });
});

describe('lookup route', () => {
  it('inserts drafts and caches by artist (no second lookup within window)', async () => {
    const a = app();
    const r1 = await request(a).post('/api/artists/NewArtist/lookup');
    expect(r1.status).toBe(200);
    expect(listDrafts().length).toBe(1);
    await request(a).post('/api/artists/NewArtist/lookup'); // cached
    expect(calls).toBe(1);
  });

  it('rejects free tier with 402 and does not run lookup', async () => {
    let ran = 0;
    const a = express(); a.use(express.json());
    a.use((req: any, _res, next) => { req.userEmail = 'free@x.com'; next(); });
    a.use('/api', makeLookupRouter({ resolveTier: async () => 'free', doLookup: async () => { ran++; return []; } }));
    const res = await request(a).post('/api/artists/Whoever/lookup');
    expect(res.status).toBe(402);
    expect(ran).toBe(0);
  });

  it('does not cache an empty result (remains retryable)', async () => {
    let ran = 0;
    const a = express(); a.use(express.json());
    a.use((req: any, _res, next) => { req.userEmail = 'pro@x.com'; next(); });
    a.use('/api', makeLookupRouter({ resolveTier: async () => 'pro', doLookup: async () => { ran++; return []; } }));
    await request(a).post('/api/artists/Empty/lookup');
    await request(a).post('/api/artists/Empty/lookup');
    expect(ran).toBe(2); // second call still ran — empty result was not cached
  });
});
