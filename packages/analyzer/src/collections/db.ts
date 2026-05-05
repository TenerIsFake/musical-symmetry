import { randomBytes } from 'crypto';
import { getDb } from '../auth/db.js';

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface CollectionWithCount extends Collection {
  item_count: number;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  pitch_classes: string;
  label: string | null;
  notes: string | null;
  created_at: string;
}

export function createCollection(userId: string, name: string, maxCollections?: number): Collection {
  const db = getDb();
  if (maxCollections !== undefined) {
    const count = db.prepare('SELECT COUNT(*) as c FROM collections WHERE user_id = ?').get(userId) as { c: number };
    if (count.c >= maxCollections) {
      throw new Error(`Collection limit reached (${maxCollections}). Upgrade for unlimited.`);
    }
  }
  const id = generateId();
  db.prepare('INSERT INTO collections (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, name);
  return db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as Collection;
}

export function listCollections(userId: string): CollectionWithCount[] {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, COUNT(ci.id) as item_count
    FROM collections c
    LEFT JOIN collection_items ci ON ci.collection_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(userId) as CollectionWithCount[];
}

export function addItem(collectionId: string, pitchClasses: number[], label?: string, notes?: string): CollectionItem {
  const db = getDb();
  const id = generateId();
  const pcsJson = JSON.stringify(pitchClasses);
  db.prepare('INSERT INTO collection_items (id, collection_id, pitch_classes, label, notes) VALUES (?, ?, ?, ?, ?)')
    .run(id, collectionId, pcsJson, label || null, notes || null);
  return db.prepare('SELECT * FROM collection_items WHERE id = ?').get(id) as CollectionItem;
}

export function getCollectionItems(collectionId: string): CollectionItem[] {
  const db = getDb();
  return db.prepare('SELECT * FROM collection_items WHERE collection_id = ? ORDER BY created_at DESC')
    .all(collectionId) as CollectionItem[];
}

export function deleteItem(itemId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM collection_items WHERE id = ? AND collection_id IN (
      SELECT id FROM collections WHERE user_id = ?
    )
  `).run(itemId, userId);
  return result.changes > 0;
}

export function deleteCollection(collectionId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM collections WHERE id = ? AND user_id = ?').run(collectionId, userId);
  return result.changes > 0;
}
