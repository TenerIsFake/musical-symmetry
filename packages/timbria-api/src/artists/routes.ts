import { Router } from 'express';
import { findArtistByName, getArtistProfile } from './db.js';

export const artistsRouter = Router();
artistsRouter.get('/:name', (req, res) => {
  const a = findArtistByName(req.params.name);
  if (!a) return res.status(404).json({ error: 'unknown artist', name: req.params.name });
  return res.json(getArtistProfile(a.id));
});
