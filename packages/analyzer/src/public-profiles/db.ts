import { getDb } from '../auth/db.js';

export function runPublicProfilesMigration(): void {
  const db = getDb();
  try { db.exec('ALTER TABLE collections ADD COLUMN published INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE collections ADD COLUMN slug TEXT'); } catch {}
  try { db.exec('ALTER TABLE collections ADD COLUMN published_at TEXT'); } catch {}
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_public_slug ON collections(user_id, slug)');
}

export interface PublicCollectionSummary {
  slug: string;
  name: string;
  description: string | null;
  itemCount: number;
  publishedAt: string;
}

export interface PublicCollectionItem {
  pitchClasses: number[];
  label: string | null;
  notes: string | null;
}

export interface PublicCollectionDetail {
  slug: string;
  name: string;
  description: string | null;
  publishedAt: string;
  items: PublicCollectionItem[];
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function makeUniqueSlug(userId: string, name: string, baseSlug?: string): string {
  const db = getDb();
  let slug = baseSlug || generateSlug(name) || 'collection';
  let candidate = slug;
  let n = 1;
  while (true) {
    const existing = db.prepare(
      'SELECT id FROM collections WHERE user_id = ? AND slug = ?'
    ).get(userId, candidate) as { id: string } | undefined;
    if (!existing) return candidate;
    candidate = `${slug}-${n++}`;
  }
}

export function publishCollection(
  collectionId: string,
  userId: string,
  slug: string
): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE collections
    SET published = 1, slug = ?, published_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(slug, collectionId, userId);
  return result.changes > 0;
}

export function unpublishCollection(collectionId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE collections
    SET published = 0, slug = NULL, published_at = NULL
    WHERE id = ? AND user_id = ?
  `).run(collectionId, userId);
  return result.changes > 0;
}

export function getPublicCollections(username: string): { username: string; displayName: string | null; collections: PublicCollectionSummary[] } | null {
  const db = getDb();

  // Match by slugified name or by email prefix
  const user = db.prepare(`
    SELECT id, name, email FROM users
    WHERE lower(replace(replace(coalesce(name, ''), ' ', '-'), '.', '')) = lower(?)
       OR lower(substr(email, 1, instr(email, '@') - 1)) = lower(?)
  `).get(username, username) as { id: string; name: string | null; email: string } | undefined;

  if (!user) return null;

  const rows = db.prepare(`
    SELECT c.slug, c.name, c.published_at,
           COUNT(ci.id) as item_count
    FROM collections c
    LEFT JOIN collection_items ci ON ci.collection_id = c.id
    WHERE c.user_id = ? AND c.published = 1 AND c.slug IS NOT NULL
    GROUP BY c.id
    ORDER BY c.published_at DESC
  `).all(user.id) as { slug: string; name: string; published_at: string; item_count: number }[];

  return {
    username,
    displayName: user.name,
    collections: rows.map(r => ({
      slug: r.slug,
      name: r.name,
      description: null,
      itemCount: r.item_count,
      publishedAt: r.published_at,
    })),
  };
}

export function getPublicCollection(
  username: string,
  slug: string
): { username: string; displayName: string | null; collection: PublicCollectionDetail } | null {
  const db = getDb();

  const user = db.prepare(`
    SELECT id, name, email FROM users
    WHERE lower(replace(replace(coalesce(name, ''), ' ', '-'), '.', '')) = lower(?)
       OR lower(substr(email, 1, instr(email, '@') - 1)) = lower(?)
  `).get(username, username) as { id: string; name: string | null; email: string } | undefined;

  if (!user) return null;

  const collection = db.prepare(`
    SELECT id, name, published_at, slug
    FROM collections
    WHERE user_id = ? AND slug = ? AND published = 1
  `).get(user.id, slug) as { id: string; name: string; published_at: string; slug: string } | undefined;

  if (!collection) return null;

  const items = db.prepare(`
    SELECT pitch_classes, label, notes
    FROM collection_items
    WHERE collection_id = ?
    ORDER BY created_at DESC
  `).all(collection.id) as { pitch_classes: string; label: string | null; notes: string | null }[];

  return {
    username,
    displayName: user.name,
    collection: {
      slug: collection.slug,
      name: collection.name,
      description: null,
      publishedAt: collection.published_at,
      items: items.map(i => ({
        pitchClasses: JSON.parse(i.pitch_classes) as number[],
        label: i.label,
        notes: i.notes,
      })),
    },
  };
}

export function getCollectionPublishState(
  collectionId: string,
  userId: string
): { published: boolean; slug: string | null } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT published, slug FROM collections WHERE id = ? AND user_id = ?
  `).get(collectionId, userId) as { published: number; slug: string | null } | undefined;
  if (!row) return null;
  return { published: row.published === 1, slug: row.slug };
}

export function countPublishedCollections(userId: string): number {
  const db = getDb();
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM collections WHERE user_id = ? AND published = 1'
  ).get(userId) as { c: number };
  return row.c;
}
