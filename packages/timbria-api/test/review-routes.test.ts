import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import express from 'express';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, insertGear } from '../src/catalog/db.js';
import { runArtistMigration, insertArtist, insertArtistGear } from '../src/artists/db.js';
import { reviewRouter } from '../src/review/routes.js';

function ownerApp() {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { (req as any).userEmail = 'owner@x.com'; next(); });
  app.use('/api/review', reviewRouter('owner@x.com'));
  return app;
}
beforeEach(() => {
  setDbForTest(new Database(':memory:')); runCatalogMigration(); runArtistMigration();
  const fx = insertFxType({ name: 'X', category: 'reverb', fingerprint: '', tells: '', era: '', typical_use: '' });
  const g = insertGear({ name: 'Unit', fx_type_id: fx, manufacturer: '', kind: 'hardware' });
  const a = insertArtist({ name: 'A', role: '', era: '', genre: '', notes: '' });
  insertArtistGear({ artist_id: a, gear_item_id: g, context: 'vox', source_url: 'u', confidence: 'high', status: 'draft', added_by: 'curated', reviewed_at: null });
});

describe('review routes', () => {
  it('lists drafts then approves one', async () => {
    const app = ownerApp();
    const list = await request(app).get('/api/review');
    expect(list.body.length).toBe(1);
    const id = list.body[0].id;
    expect((await request(app).post(`/api/review/${id}/approve`)).status).toBe(200);
    expect((await request(app).get('/api/review')).body.length).toBe(0);
  });
});
