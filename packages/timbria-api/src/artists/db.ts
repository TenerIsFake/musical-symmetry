import { getDb, registerMigration } from '../db.js';
import type { Artist, ArtistGear } from '../types.js';

export function runArtistMigration(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS artist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT '', era TEXT DEFAULT '', genre TEXT DEFAULT '', notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS artist_gear (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
      gear_item_id INTEGER NOT NULL REFERENCES gear_item(id) ON DELETE CASCADE,
      context TEXT DEFAULT '', source_url TEXT DEFAULT '',
      confidence TEXT DEFAULT 'low', status TEXT DEFAULT 'draft',
      added_by TEXT DEFAULT 'curated', reviewed_at TEXT
    );
  `);
}
registerMigration(runArtistMigration);

export function insertArtist(a: Omit<Artist, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO artist (name,role,era,genre,notes)
    VALUES (@name,@role,@era,@genre,@notes)
    ON CONFLICT(name) DO UPDATE SET role=excluded.role RETURNING id`).get(a) as any;
  return r.id;
}
export function findArtistByName(name: string): Artist | undefined {
  return getDb().prepare('SELECT * FROM artist WHERE name = ? COLLATE NOCASE').get(name) as Artist | undefined;
}
export function insertArtistGear(g: Omit<ArtistGear, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO artist_gear
    (artist_id,gear_item_id,context,source_url,confidence,status,added_by,reviewed_at)
    VALUES (@artist_id,@gear_item_id,@context,@source_url,@confidence,@status,@added_by,@reviewed_at)`).run(g);
  return Number(r.lastInsertRowid);
}
export function setGearStatus(id: number, status: 'approved'): void {
  getDb().prepare(`UPDATE artist_gear SET status = ?, reviewed_at = datetime('now') WHERE id = ?`).run(status, id);
}
export function deleteArtistGear(id: number): void {
  getDb().prepare('DELETE FROM artist_gear WHERE id = ?').run(id);
}
export interface ProfileGearLine extends ArtistGear { gear_name: string; }
export function getArtistProfile(id: number): { artist: Artist; gear: ProfileGearLine[] } | undefined {
  const artist = getDb().prepare('SELECT * FROM artist WHERE id = ?').get(id) as Artist | undefined;
  if (!artist) return undefined;
  const gear = getDb().prepare(`SELECT ag.*, gi.name AS gear_name FROM artist_gear ag
    JOIN gear_item gi ON gi.id = ag.gear_item_id WHERE ag.artist_id = ?
    ORDER BY ag.context, gi.name`).all(id) as ProfileGearLine[];
  return { artist, gear };
}
export function listDrafts(): ProfileGearLine[] {
  return getDb().prepare(`SELECT ag.*, gi.name AS gear_name FROM artist_gear ag
    JOIN gear_item gi ON gi.id = ag.gear_item_id WHERE ag.status = 'draft' ORDER BY ag.id`).all() as ProfileGearLine[];
}
