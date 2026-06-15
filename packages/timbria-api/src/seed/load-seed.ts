import { getDb } from '../db.js';
import { SEED_FX, SEED_GEAR, SEED_SOUNDS, SEED_IDENTIFY } from './seed-data.js';

export function loadSeed(): void {
  const db = getDb();
  const fxId = new Map<string, number>();
  const upFx = db.prepare(`INSERT INTO fx_type (name,category,fingerprint,tells,era,typical_use)
    VALUES (@name,@category,@fingerprint,@tells,@era,@typical_use)
    ON CONFLICT(name) DO UPDATE SET category=excluded.category RETURNING id`);
  for (const f of SEED_FX) fxId.set(f.name, (upFx.get(f) as any).id);

  const upGear = db.prepare(`INSERT INTO gear_item (name,fx_type_id,manufacturer,kind)
    VALUES (?,?,?,?) ON CONFLICT(name) DO NOTHING`);
  for (const g of SEED_GEAR) upGear.run(g.name, fxId.get(g.fxName) ?? null, g.manufacturer, g.kind);

  const upSound = db.prepare(`INSERT INTO sound (name,description,chain,artist_id)
    VALUES (?,?,?,NULL) ON CONFLICT(name) DO NOTHING`);
  for (const s of SEED_SOUNDS)
    upSound.run(s.name, s.description, JSON.stringify(s.chainFxNames.map(n => fxId.get(n)).filter(Boolean)));

  // Identify tree: clear + rebuild (small, authored set) to keep ids consistent
  db.exec('DELETE FROM id_node');
  const nodeId = new Map<string, number>();
  const ins = db.prepare(`INSERT INTO id_node (question,branches,leaf_fx_type_ids,explanation)
    VALUES (?, '[]', ?, ?) RETURNING id`);
  for (const n of SEED_IDENTIFY)
    nodeId.set(n.key, (ins.get(n.question, JSON.stringify(n.leafFxNames.map(x => fxId.get(x)).filter(Boolean)), n.explanation) as any).id);
  const upd = db.prepare('UPDATE id_node SET branches = ? WHERE id = ?');
  for (const n of SEED_IDENTIFY)
    upd.run(JSON.stringify(n.branches.map(b => ({ answer: b.answer, next: nodeId.get(b.next) }))), nodeId.get(n.key));
}
