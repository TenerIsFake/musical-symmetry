import { Router } from 'express';
import { listDrafts, setGearStatus, deleteArtistGear } from '../artists/db.js';
import { requireOwner } from '../auth/access.js';

export function reviewRouter(ownerEmail: string): Router {
  const r = Router();
  r.use(requireOwner(ownerEmail));
  r.get('/', (_req, res) => res.json(listDrafts()));
  r.post('/:id/approve', (req, res) => { setGearStatus(Number(req.params.id), 'approved'); res.json({ ok: true }); });
  r.post('/:id/reject', (req, res) => { deleteArtistGear(Number(req.params.id)); res.json({ ok: true }); });
  return r;
}
