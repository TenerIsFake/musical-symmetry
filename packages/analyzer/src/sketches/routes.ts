import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import '../auth/types.js';
import {
  getSketchesByUser,
  getSketchById,
  createSketch,
  updateSketch,
  deleteSketch,
  countSketchesByUser,
  type SketchInput,
} from './db.js';

export const sketchesRouter = Router();

sketchesRouter.use(requireAuth);

const SKETCH_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  research: Infinity,
};

const BAR_LIMITS: Record<string, number> = {
  free: 8,
  pro: 64,
  research: Infinity,
};

// GET /api/sketches — list user's sketches
sketchesRouter.get('/', (req, res) => {
  const userId = parseInt(req.user!.id, 10);
  const sketches = getSketchesByUser(userId);
  res.json({ sketches });
});

// GET /api/sketches/:id — get single sketch
sketchesRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid sketch id' }); return; }
  const userId = parseInt(req.user!.id, 10);
  const sketch = getSketchById(id, userId);
  if (!sketch) { res.status(404).json({ error: 'Sketch not found' }); return; }
  res.json({ sketch });
});

// POST /api/sketches — create sketch
sketchesRouter.post('/', (req, res) => {
  try {
    const userId = parseInt(req.user!.id, 10);
    const tier = req.user!.tier ?? 'free';
    const sketchLimit = SKETCH_LIMITS[tier] ?? 3;
    const barLimit = BAR_LIMITS[tier] ?? 8;

    const count = countSketchesByUser(userId);
    if (count >= sketchLimit) {
      res.status(403).json({
        error: `${tier === 'free' ? 'Free' : 'Pro'} tier limit: max ${sketchLimit} sketches. Upgrade for more.`,
        upgrade: 'https://symmetry.tendrid.us/#dashboard',
      });
      return;
    }

    const {
      name,
      description,
      tempo,
      time_sig_top,
      time_sig_bottom,
      bars,
      melody_data,
      rhythm_data,
      chord_data,
    } = req.body as SketchInput;

    if (bars !== undefined && typeof bars === 'number' && bars > barLimit) {
      res.status(403).json({
        error: `${tier === 'free' ? 'Free' : 'Pro'} tier limit: max ${barLimit} bars. Upgrade for more.`,
        upgrade: 'https://symmetry.tendrid.us/#dashboard',
      });
      return;
    }

    const sketch = createSketch(userId, {
      name,
      description,
      tempo,
      time_sig_top,
      time_sig_bottom,
      bars,
      melody_data,
      rhythm_data,
      chord_data,
    });
    res.status(201).json({ sketch });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// PUT /api/sketches/:id — update sketch
sketchesRouter.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid sketch id' }); return; }
    const userId = parseInt(req.user!.id, 10);
    const tier = req.user!.tier ?? 'free';
    const barLimit = BAR_LIMITS[tier] ?? 8;

    const {
      name,
      description,
      tempo,
      time_sig_top,
      time_sig_bottom,
      bars,
      melody_data,
      rhythm_data,
      chord_data,
    } = req.body as SketchInput;

    if (bars !== undefined && typeof bars === 'number' && bars > barLimit) {
      res.status(403).json({
        error: `${tier === 'free' ? 'Free' : 'Pro'} tier limit: max ${barLimit} bars. Upgrade for more.`,
        upgrade: 'https://symmetry.tendrid.us/#dashboard',
      });
      return;
    }

    const sketch = updateSketch(id, userId, {
      name,
      description,
      tempo,
      time_sig_top,
      time_sig_bottom,
      bars,
      melody_data,
      rhythm_data,
      chord_data,
    });
    if (!sketch) { res.status(404).json({ error: 'Sketch not found' }); return; }
    res.json({ sketch });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/sketches/:id — delete sketch
sketchesRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid sketch id' }); return; }
  const userId = parseInt(req.user!.id, 10);
  const deleted = deleteSketch(id, userId);
  if (!deleted) { res.status(404).json({ error: 'Sketch not found' }); return; }
  res.json({ deleted: true });
});
