import { getDb, registerMigration } from '../db.js';
import type { IdNode } from '../types.js';

export function runIdentifyMigration(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS id_node (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL DEFAULT '',
      branches TEXT NOT NULL DEFAULT '[]',
      leaf_fx_type_ids TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL DEFAULT ''
    );
  `);
}
registerMigration(runIdentifyMigration);

function rowToNode(r: any): IdNode {
  return { id: r.id, question: r.question, explanation: r.explanation,
    branches: JSON.parse(r.branches), leaf_fx_type_ids: JSON.parse(r.leaf_fx_type_ids) };
}
export function insertNode(n: Omit<IdNode, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO id_node (question,branches,leaf_fx_type_ids,explanation)
    VALUES (?,?,?,?)`).run(n.question, JSON.stringify(n.branches),
    JSON.stringify(n.leaf_fx_type_ids), n.explanation);
  return Number(r.lastInsertRowid);
}
export function getNode(id: number): IdNode | undefined {
  const r = getDb().prepare('SELECT * FROM id_node WHERE id = ?').get(id);
  return r ? rowToNode(r) : undefined;
}
export function getRoot(): IdNode | undefined {
  const all = getDb().prepare('SELECT * FROM id_node ORDER BY id').all().map(rowToNode);
  const referenced = new Set<number>();
  for (const n of all) for (const b of n.branches) referenced.add(b.next);
  return all.find(n => !referenced.has(n.id));
}
