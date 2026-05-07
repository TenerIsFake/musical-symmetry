import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import {
  createDeck,
  getDecks,
  getDeckCards,
  getDueCards,
  addCard,
  updateCardProgress,
  deleteDeck,
  deleteCard,
} from './db.js';
import '../auth/types.js';

export const flashcardsRouter = Router();

flashcardsRouter.use(requireAuth);

// GET /api/flashcards/decks — list decks with card counts
flashcardsRouter.get('/decks', (req, res) => {
  const decks = getDecks(req.user!.id);
  res.json({ decks });
});

// POST /api/flashcards/decks — create deck
flashcardsRouter.post('/decks', (req, res) => {
  try {
    const { name, description = '' } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Deck name is required' });
      return;
    }
    const deck = createDeck(req.user!.id, name.trim(), description.trim());
    res.status(201).json({ deck });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Free tier limit')) {
      res.status(403).json({ error: msg, upgrade: 'https://symmetry.tendrid.us/#dashboard' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

// GET /api/flashcards/decks/:id/cards — get all cards in deck
flashcardsRouter.get('/decks/:id/cards', (req, res) => {
  try {
    const deckId = parseInt(req.params.id, 10);
    if (isNaN(deckId)) { res.status(400).json({ error: 'Invalid deck id' }); return; }
    const cards = getDeckCards(deckId, req.user!.id);
    res.json({ cards });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(msg.includes('access denied') ? 403 : 500).json({ error: msg });
  }
});

// GET /api/flashcards/decks/:id/due — get due cards
flashcardsRouter.get('/decks/:id/due', (req, res) => {
  try {
    const deckId = parseInt(req.params.id, 10);
    if (isNaN(deckId)) { res.status(400).json({ error: 'Invalid deck id' }); return; }
    const cards = getDueCards(deckId, req.user!.id);
    res.json({ cards });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(msg.includes('access denied') ? 403 : 500).json({ error: msg });
  }
});

// POST /api/flashcards/decks/:id/cards — add card
flashcardsRouter.post('/decks/:id/cards', (req, res) => {
  try {
    const deckId = parseInt(req.params.id, 10);
    if (isNaN(deckId)) { res.status(400).json({ error: 'Invalid deck id' }); return; }
    const { forte, frontField = 'forte', backFields = ['prime_form', 'interval_vector'] } = req.body;
    if (!forte || typeof forte !== 'string') {
      res.status(400).json({ error: 'forte is required' });
      return;
    }
    const backFieldsStr = Array.isArray(backFields) ? JSON.stringify(backFields) : backFields;
    const card = addCard(deckId, req.user!.id, forte.trim(), frontField, backFieldsStr);
    res.status(201).json({ card });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Free tier limit')) {
      res.status(403).json({ error: msg, upgrade: 'https://symmetry.tendrid.us/#dashboard' });
      return;
    }
    if (msg.includes('access denied')) {
      res.status(403).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

// PUT /api/flashcards/cards/:id/progress — update SM-2 progress
flashcardsRouter.put('/cards/:id/progress', (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    if (isNaN(cardId)) { res.status(400).json({ error: 'Invalid card id' }); return; }
    const { easeFactor, interval, repetitions, nextDue } = req.body;
    if (
      typeof easeFactor !== 'number' ||
      typeof interval !== 'number' ||
      typeof repetitions !== 'number' ||
      typeof nextDue !== 'string'
    ) {
      res.status(400).json({ error: 'easeFactor, interval, repetitions, nextDue are required' });
      return;
    }
    updateCardProgress(cardId, req.user!.id, easeFactor, interval, repetitions, nextDue);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(msg.includes('access denied') ? 403 : 500).json({ error: msg });
  }
});

// DELETE /api/flashcards/decks/:id — delete deck
flashcardsRouter.delete('/decks/:id', (req, res) => {
  const deckId = parseInt(req.params.id, 10);
  if (isNaN(deckId)) { res.status(400).json({ error: 'Invalid deck id' }); return; }
  const deleted = deleteDeck(deckId, req.user!.id);
  res.json({ deleted });
});

// DELETE /api/flashcards/cards/:id — delete card
flashcardsRouter.delete('/cards/:id', (req, res) => {
  const cardId = parseInt(req.params.id, 10);
  if (isNaN(cardId)) { res.status(400).json({ error: 'Invalid card id' }); return; }
  const deleted = deleteCard(cardId, req.user!.id);
  res.json({ deleted });
});
