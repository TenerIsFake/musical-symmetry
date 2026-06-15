import { Router } from 'express';
import { listFxTypes, getFxType, listGear, listSounds } from './db.js';

export const catalogRouter = Router();
catalogRouter.get('/fx', (_req, res) => res.json(listFxTypes()));
catalogRouter.get('/fx/:id', (req, res) => {
  const row = getFxType(Number(req.params.id));
  return row ? res.json(row) : res.status(404).json({ error: 'not found' });
});
catalogRouter.get('/gear', (_req, res) => res.json(listGear()));
catalogRouter.get('/sounds', (_req, res) => res.json(listSounds()));
