import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runIdentifyMigration, insertNode, getNode, getRoot } from '../src/identify/db.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runIdentifyMigration(); });

describe('identify db', () => {
  it('stores a branch node and a leaf, resolves root', () => {
    const leaf = insertNode({ question: '', branches: [], leaf_fx_type_ids: [1], explanation: 'Plate reverb.' });
    const root = insertNode({ question: 'Short metallic or long washy?',
      branches: [{ answer: 'metallic', next: leaf }], leaf_fx_type_ids: [], explanation: '' });
    expect(getRoot()?.id).toBe(root);
    expect(getNode(leaf)?.leaf_fx_type_ids).toEqual([1]);
  });
});
