import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import {
  createCollection, listCollections, addItem,
  getCollectionItems, deleteItem, deleteCollection,
} from './db.js';
import '../auth/types.js';

export const collectionsRouter = Router();

const TIER_COLLECTION_LIMITS: Record<string, number> = {
  free: 5,
  pro: 100,
  research: 1000,
};

collectionsRouter.use(requireAuth);

collectionsRouter.get('/', (req, res) => {
  const collections = listCollections(req.user!.id);
  res.json({ collections });
});

collectionsRouter.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ error: 'Name is required (max 100 chars)' });
      return;
    }
    const limit = TIER_COLLECTION_LIMITS[req.user!.tier] || 5;
    const collection = createCollection(req.user!.id, name.trim(), limit);
    res.status(201).json({ collection });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('limit')) {
      res.status(403).json({ error: msg, upgrade: 'https://symmetry.tendrid.us/#dashboard' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

collectionsRouter.get('/:id/items', (req, res) => {
  const items = getCollectionItems(req.params.id);
  res.json({ items });
});

collectionsRouter.post('/:id/items', (req, res) => {
  const { pitchClasses, label, notes } = req.body;
  if (!Array.isArray(pitchClasses) || pitchClasses.length < 2) {
    res.status(400).json({ error: 'pitchClasses must have at least 2 entries' });
    return;
  }
  const pcs = pitchClasses.map(Number).filter(n => n >= 0 && n <= 11);
  const item = addItem(req.params.id, pcs, label, notes);
  res.status(201).json({ item });
});

collectionsRouter.delete('/:id', (req, res) => {
  const deleted = deleteCollection(req.params.id, req.user!.id);
  res.json({ deleted });
});

collectionsRouter.delete('/items/:itemId', (req, res) => {
  const deleted = deleteItem(req.params.itemId, req.user!.id);
  res.json({ deleted });
});
