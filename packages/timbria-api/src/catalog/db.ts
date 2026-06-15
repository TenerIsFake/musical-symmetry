import { getDb, registerMigration } from '../db.js';
import type { FxType, GearItem, Sound } from '../types.js';

export function runCatalogMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS fx_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      fingerprint TEXT NOT NULL DEFAULT '', tells TEXT NOT NULL DEFAULT '',
      era TEXT NOT NULL DEFAULT '', typical_use TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gear_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      fx_type_id INTEGER REFERENCES fx_type(id) ON DELETE SET NULL,
      manufacturer TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'hardware'
    );
    CREATE TABLE IF NOT EXISTS sound (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
      chain TEXT NOT NULL DEFAULT '[]', artist_id INTEGER
    );
  `);
}
registerMigration(runCatalogMigration);

export function insertFxType(f: Omit<FxType, 'id'>): number {
  const db = getDb();
  const r = db.prepare(`INSERT INTO fx_type (name,category,fingerprint,tells,era,typical_use)
    VALUES (@name,@category,@fingerprint,@tells,@era,@typical_use)`).run(f);
  return Number(r.lastInsertRowid);
}
export function getFxType(id: number): FxType | undefined {
  return getDb().prepare('SELECT * FROM fx_type WHERE id = ?').get(id) as FxType | undefined;
}
export function listFxTypes(): FxType[] {
  return getDb().prepare('SELECT * FROM fx_type ORDER BY category, name').all() as FxType[];
}
export function insertGear(g: Omit<GearItem, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO gear_item (name,fx_type_id,manufacturer,kind)
    VALUES (@name,@fx_type_id,@manufacturer,@kind)`).run(g);
  return Number(r.lastInsertRowid);
}
export function listGear(): GearItem[] {
  return getDb().prepare('SELECT * FROM gear_item ORDER BY name').all() as GearItem[];
}
export function insertSound(s: Omit<Sound, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO sound (name,description,chain,artist_id)
    VALUES (?,?,?,?)`).run(s.name, s.description, JSON.stringify(s.chain), s.artist_id);
  return Number(r.lastInsertRowid);
}
export function listSounds(): Sound[] {
  const rows = getDb().prepare('SELECT * FROM sound ORDER BY name').all() as any[];
  return rows.map(r => ({ ...r, chain: JSON.parse(r.chain) }));
}
