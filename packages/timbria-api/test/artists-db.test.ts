import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, insertGear } from '../src/catalog/db.js';
import { runArtistMigration, insertArtist, insertArtistGear, getArtistProfile, setGearStatus } from '../src/artists/db.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runCatalogMigration(); runArtistMigration(); });

describe('artists db', () => {
  it('builds a grouped profile and flips status', () => {
    const fx = insertFxType({ name: 'Plate Reverb', category: 'reverb', fingerprint: '', tells: '', era: '', typical_use: '' });
    const gear = insertGear({ name: 'EMT 140', fx_type_id: fx, manufacturer: 'EMT', kind: 'hardware' });
    const artist = insertArtist({ name: 'Test Artist', role: 'artist', era: '', genre: '', notes: '' });
    const agId = insertArtistGear({ artist_id: artist, gear_item_id: gear, context: 'vocal chain',
      source_url: 'https://example.com', confidence: 'high', status: 'draft', added_by: 'curated', reviewed_at: null });
    let prof = getArtistProfile(artist);
    expect(prof?.gear[0].status).toBe('draft');
    setGearStatus(agId, 'approved');
    prof = getArtistProfile(artist);
    expect(prof?.gear[0].status).toBe('approved');
    expect(prof?.gear[0].gear_name).toBe('EMT 140');
  });
});
