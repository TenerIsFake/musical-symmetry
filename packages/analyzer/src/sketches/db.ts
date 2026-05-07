import { getDb } from '../auth/db.js';

export function runSketchMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sketches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      name            TEXT NOT NULL DEFAULT 'Untitled Sketch',
      description     TEXT DEFAULT '',
      tempo           INTEGER NOT NULL DEFAULT 120,
      time_sig_top    INTEGER NOT NULL DEFAULT 4,
      time_sig_bottom INTEGER NOT NULL DEFAULT 4,
      bars            INTEGER NOT NULL DEFAULT 8,
      melody_data     TEXT DEFAULT '[]',
      rhythm_data     TEXT DEFAULT '[]',
      chord_data      TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sketches_user ON sketches(user_id);
  `);
}

export interface Sketch {
  id: number;
  user_id: number;
  name: string;
  description: string;
  tempo: number;
  time_sig_top: number;
  time_sig_bottom: number;
  bars: number;
  melody_data: string;
  rhythm_data: string;
  chord_data: string;
  created_at: string;
  updated_at: string;
}

export interface SketchInput {
  name?: string;
  description?: string;
  tempo?: number;
  time_sig_top?: number;
  time_sig_bottom?: number;
  bars?: number;
  melody_data?: string;
  rhythm_data?: string;
  chord_data?: string;
}

export function getSketchesByUser(userId: number): Sketch[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM sketches WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(userId) as Sketch[];
}

export function getSketchById(id: number, userId: number): Sketch | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM sketches WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Sketch | undefined;
}

export function createSketch(userId: number, data: SketchInput): Sketch {
  const db = getDb();
  const {
    name = 'Untitled Sketch',
    description = '',
    tempo = 120,
    time_sig_top = 4,
    time_sig_bottom = 4,
    bars = 8,
    melody_data = '[]',
    rhythm_data = '[]',
    chord_data = '[]',
  } = data;

  const result = db.prepare(`
    INSERT INTO sketches
      (user_id, name, description, tempo, time_sig_top, time_sig_bottom, bars, melody_data, rhythm_data, chord_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, description, tempo, time_sig_top, time_sig_bottom, bars, melody_data, rhythm_data, chord_data);

  return db.prepare('SELECT * FROM sketches WHERE id = ?').get(result.lastInsertRowid) as Sketch;
}

export function updateSketch(id: number, userId: number, data: SketchInput): Sketch | undefined {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM sketches WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) return undefined;

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (data.name !== undefined)            { fields.push('name = ?');            values.push(data.name); }
  if (data.description !== undefined)     { fields.push('description = ?');     values.push(data.description); }
  if (data.tempo !== undefined)           { fields.push('tempo = ?');           values.push(data.tempo); }
  if (data.time_sig_top !== undefined)    { fields.push('time_sig_top = ?');    values.push(data.time_sig_top); }
  if (data.time_sig_bottom !== undefined) { fields.push('time_sig_bottom = ?'); values.push(data.time_sig_bottom); }
  if (data.bars !== undefined)            { fields.push('bars = ?');            values.push(data.bars); }
  if (data.melody_data !== undefined)     { fields.push('melody_data = ?');     values.push(data.melody_data); }
  if (data.rhythm_data !== undefined)     { fields.push('rhythm_data = ?');     values.push(data.rhythm_data); }
  if (data.chord_data !== undefined)      { fields.push('chord_data = ?');      values.push(data.chord_data); }

  if (fields.length === 0) return getSketchById(id, userId);

  fields.push("updated_at = datetime('now')");
  values.push(id, userId);

  db.prepare(`UPDATE sketches SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return db.prepare('SELECT * FROM sketches WHERE id = ?').get(id) as Sketch;
}

export function deleteSketch(id: number, userId: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sketches WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function countSketchesByUser(userId: number): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM sketches WHERE user_id = ?').get(userId) as { count: number };
  return row.count;
}
