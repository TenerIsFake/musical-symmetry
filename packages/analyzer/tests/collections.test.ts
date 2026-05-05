import { describe, it, expect, beforeAll } from 'vitest';

let db: typeof import('../src/collections/db.js');
let authDb: typeof import('../src/auth/db.js');

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  authDb = await import('../src/auth/db.js');
  authDb.getDb();
  db = await import('../src/collections/db.js');
});

describe('Collections DB', () => {
  let userId: string;
  let collectionId: string;

  it('creates a user for testing', () => {
    const user = authDb.getOrCreateUser('magic', { email: 'test@example.com' });
    userId = user.id;
    expect(userId).toBeTruthy();
  });

  it('creates a collection', () => {
    const coll = db.createCollection(userId, 'My Favorites');
    expect(coll.id).toBeTruthy();
    expect(coll.name).toBe('My Favorites');
    collectionId = coll.id;
  });

  it('adds items to a collection', () => {
    const item = db.addItem(collectionId, [0, 4, 7], 'C major');
    expect(item.id).toBeTruthy();
    expect(item.pitch_classes).toBe('[0,4,7]');
  });

  it('lists user collections with item counts', () => {
    const collections = db.listCollections(userId);
    expect(collections).toHaveLength(1);
    expect(collections[0]!.item_count).toBe(1);
  });

  it('gets collection items', () => {
    const items = db.getCollectionItems(collectionId);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe('C major');
  });

  it('enforces max 5 collections for free tier', () => {
    for (let i = 0; i < 4; i++) {
      db.createCollection(userId, `Collection ${i + 2}`);
    }
    expect(() => db.createCollection(userId, 'One too many', 5)).toThrow('limit');
  });

  it('deletes a collection', () => {
    db.deleteCollection(collectionId, userId);
    const collections = db.listCollections(userId);
    expect(collections.every(c => c.id !== collectionId)).toBe(true);
  });
});
