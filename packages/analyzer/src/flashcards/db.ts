import { getDb, getUserById } from '../auth/db.js';

export function runFlashcardMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user ON flashcard_decks(user_id);

    CREATE TABLE IF NOT EXISTS flashcard_cards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id     INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
      forte       TEXT NOT NULL,
      front_field TEXT NOT NULL DEFAULT 'forte',
      back_fields TEXT NOT NULL DEFAULT '["prime_form","interval_vector"]',
      ease_factor REAL DEFAULT 2.5,
      interval    INTEGER DEFAULT 0,
      next_due    TEXT DEFAULT (datetime('now')),
      repetitions INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_flashcard_cards_deck ON flashcard_cards(deck_id);
  `);
}

const FREE_DECK_LIMIT = 1;
const FREE_CARD_LIMIT = 10;

export interface FlashcardDeck {
  id: number;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  card_count: number;
}

export interface FlashcardCard {
  id: number;
  deck_id: number;
  forte: string;
  front_field: string;
  back_fields: string;
  ease_factor: number;
  interval: number;
  next_due: string;
  repetitions: number;
}

function getUserTier(userId: string): string {
  const user = getUserById(userId);
  return user?.tier ?? 'free';
}

export function createDeck(userId: string, name: string, description: string): FlashcardDeck {
  const db = getDb();
  const tier = getUserTier(userId);

  if (tier === 'free') {
    const row = db.prepare('SELECT COUNT(*) as count FROM flashcard_decks WHERE user_id = ?').get(userId) as { count: number };
    if (row.count >= FREE_DECK_LIMIT) {
      throw new Error(`Free tier limit: max ${FREE_DECK_LIMIT} deck. Upgrade to Pro for unlimited decks.`);
    }
  }

  const result = db.prepare(
    'INSERT INTO flashcard_decks (user_id, name, description) VALUES (?, ?, ?)'
  ).run(userId, name, description);

  const deck = db.prepare('SELECT * FROM flashcard_decks WHERE id = ?').get(result.lastInsertRowid) as Omit<FlashcardDeck, 'card_count'>;
  return { ...deck, card_count: 0 };
}

export function getDecks(userId: string): FlashcardDeck[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, COUNT(c.id) as card_count
    FROM flashcard_decks d
    LEFT JOIN flashcard_cards c ON c.deck_id = d.id
    WHERE d.user_id = ?
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `).all(userId) as FlashcardDeck[];
}

export function getDeckCards(deckId: number, userId: string): FlashcardCard[] {
  const db = getDb();
  const deck = db.prepare('SELECT id FROM flashcard_decks WHERE id = ? AND user_id = ?').get(deckId, userId);
  if (!deck) throw new Error('Deck not found or access denied');
  return db.prepare('SELECT * FROM flashcard_cards WHERE deck_id = ? ORDER BY id').all(deckId) as FlashcardCard[];
}

export function getDueCards(deckId: number, userId: string): FlashcardCard[] {
  const db = getDb();
  const deck = db.prepare('SELECT id FROM flashcard_decks WHERE id = ? AND user_id = ?').get(deckId, userId);
  if (!deck) throw new Error('Deck not found or access denied');
  return db.prepare(
    "SELECT * FROM flashcard_cards WHERE deck_id = ? AND next_due <= datetime('now') ORDER BY next_due"
  ).all(deckId) as FlashcardCard[];
}

export function addCard(
  deckId: number,
  userId: string,
  forte: string,
  frontField: string,
  backFields: string,
): FlashcardCard {
  const db = getDb();
  const deck = db.prepare('SELECT id FROM flashcard_decks WHERE id = ? AND user_id = ?').get(deckId, userId);
  if (!deck) throw new Error('Deck not found or access denied');

  const tier = getUserTier(userId);
  if (tier === 'free') {
    const row = db.prepare('SELECT COUNT(*) as count FROM flashcard_cards WHERE deck_id = ?').get(deckId) as { count: number };
    if (row.count >= FREE_CARD_LIMIT) {
      throw new Error(`Free tier limit: max ${FREE_CARD_LIMIT} cards per deck. Upgrade to Pro for unlimited cards.`);
    }
  }

  const result = db.prepare(
    'INSERT INTO flashcard_cards (deck_id, forte, front_field, back_fields) VALUES (?, ?, ?, ?)'
  ).run(deckId, forte, frontField, backFields);

  return db.prepare('SELECT * FROM flashcard_cards WHERE id = ?').get(result.lastInsertRowid) as FlashcardCard;
}

export function updateCardProgress(
  cardId: number,
  userId: string,
  easeFactor: number,
  interval: number,
  repetitions: number,
  nextDue: string,
): void {
  const db = getDb();
  // Verify ownership via join
  const card = db.prepare(`
    SELECT c.id FROM flashcard_cards c
    JOIN flashcard_decks d ON d.id = c.deck_id
    WHERE c.id = ? AND d.user_id = ?
  `).get(cardId, userId);
  if (!card) throw new Error('Card not found or access denied');

  db.prepare(
    'UPDATE flashcard_cards SET ease_factor = ?, interval = ?, repetitions = ?, next_due = ? WHERE id = ?'
  ).run(easeFactor, interval, repetitions, nextDue, cardId);
}

export function deleteDeck(deckId: number, userId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM flashcard_decks WHERE id = ? AND user_id = ?').run(deckId, userId);
  return result.changes > 0;
}

export function deleteCard(cardId: number, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM flashcard_cards WHERE id = ? AND deck_id IN (
      SELECT id FROM flashcard_decks WHERE user_id = ?
    )
  `).run(cardId, userId);
  return result.changes > 0;
}
