import { Router } from 'express';
import { generateAtlasEntries } from './data.js';

export const atlasRouter = Router();

atlasRouter.get('/', (_req, res) => {
  const entries = generateAtlasEntries();
  const summary = entries.map(e => ({
    forteNumber: e.forteNumber,
    primeForm: e.primeForm,
    group: e.group,
    cardinality: e.cardinality,
    intervalVector: e.intervalVector,
    maximallyEven: e.maximallyEven,
  }));
  res.json({ entries: summary, count: summary.length });
});

atlasRouter.get('/:forteNumber', (req, res) => {
  const entries = generateAtlasEntries();
  const entry = entries.find(e => e.forteNumber === req.params.forteNumber);
  if (!entry) {
    res.status(404).json({ error: 'Set class not found' });
    return;
  }
  res.json(entry);
});

atlasRouter.get('/group/:group', (req, res) => {
  const entries = generateAtlasEntries();
  const filtered = entries.filter(e => e.group === req.params.group);
  res.json({ entries: filtered, count: filtered.length });
});

atlasRouter.get('/cardinality/:n', (req, res) => {
  const n = parseInt(req.params.n);
  if (n < 2 || n > 11) {
    res.status(400).json({ error: 'Cardinality must be 2-11' });
    return;
  }
  const entries = generateAtlasEntries();
  const filtered = entries.filter(e => e.cardinality === n);
  res.json({ entries: filtered, count: filtered.length });
});
