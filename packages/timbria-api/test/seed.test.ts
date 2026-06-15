import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, listFxTypes, listGear, listSounds } from '../src/catalog/db.js';
import { runIdentifyMigration, getRoot } from '../src/identify/db.js';
import { loadSeed } from '../src/seed/load-seed.js';

beforeEach(() => {
  setDbForTest(new Database(':memory:'));
  runCatalogMigration(); runIdentifyMigration();
});

describe('seed loader', () => {
  it('loads canon and is idempotent', () => {
    loadSeed(); loadSeed(); // twice — must not duplicate
    expect(listFxTypes().length).toBe(12);
    expect(listGear().length).toBe(6);
    expect(listSounds().length).toBe(3);
    expect(getRoot()?.question).toMatch(/space/i);
  });
});
