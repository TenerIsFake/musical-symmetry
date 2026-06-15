import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, listFxTypes, listGear, listSounds } from '../src/catalog/db.js';
import { runIdentifyMigration, getRoot } from '../src/identify/db.js';
import { loadSeed } from '../src/seed/load-seed.js';
import { SEED_FX, SEED_GEAR, SEED_SOUNDS } from '../src/seed/seed-data.js';

beforeEach(() => {
  setDbForTest(new Database(':memory:'));
  runCatalogMigration(); runIdentifyMigration();
});

describe('seed loader', () => {
  it('loads the full canon and is idempotent', () => {
    loadSeed(); loadSeed(); // twice — must not duplicate
    // Counts derived from the source arrays so this stays correct as the catalog grows.
    expect(listFxTypes().length).toBe(SEED_FX.length);
    expect(listGear().length).toBe(SEED_GEAR.length);
    expect(listSounds().length).toBe(SEED_SOUNDS.length);
    expect(getRoot()?.question).toMatch(/character|effect/i);
  });

  it('every seeded gear and sound references an fx that exists (referential integrity)', () => {
    loadSeed();
    const fxNames = new Set(SEED_FX.map((f) => f.name));
    for (const g of SEED_GEAR) expect(fxNames.has(g.fxName), `gear "${g.name}" -> "${g.fxName}"`).toBe(true);
    for (const s of SEED_SOUNDS)
      for (const n of s.chainFxNames) expect(fxNames.has(n), `sound "${s.name}" -> "${n}"`).toBe(true);
    // gear actually linked to an fx_type row (FK resolved, not null)
    const gear = listGear();
    expect(gear.every((g) => typeof g.fx_type_id === 'number' && g.fx_type_id > 0)).toBe(true);
  });
});
