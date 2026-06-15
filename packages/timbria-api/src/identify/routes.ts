import { Router } from 'express';
import { getRoot, getNode } from './db.js';

export const identifyRouter = Router();
identifyRouter.get('/tree', (_req, res) => res.json({ root: getRoot() ?? null }));
identifyRouter.get('/node/:id', (req, res) => {
  const n = getNode(Number(req.params.id));
  return n ? res.json(n) : res.status(404).json({ error: 'not found' });
});
