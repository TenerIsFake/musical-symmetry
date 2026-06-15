import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, getFxType } from '../src/catalog/db.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runCatalogMigration(); });

describe('catalog db', () => {
  it('creates fx_type and round-trips a row', () => {
    const id = insertFxType({ name: 'Plate Reverb', category: 'reverb',
      fingerprint: 'dense, bright, no distinct echoes', tells: 'fast metallic decay',
      era: '1957–', typical_use: 'vocals, snare' });
    const row = getFxType(id);
    expect(row?.name).toBe('Plate Reverb');
    expect(row?.category).toBe('reverb');
  });
});
