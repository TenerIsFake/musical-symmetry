import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://symmetry.tendrid.us';

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

export function useFlashcards() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [currentDeck, setCurrentDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [dueCards, setDueCards] = useState<FlashcardCard[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/flashcards/decks`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDecks(data.decks);
      }
    } catch { /* not logged in */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDecks(); }, [fetchDecks]);

  async function createDeck(name: string, description: string): Promise<FlashcardDeck> {
    const res = await fetch(`${API_BASE}/api/flashcards/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    await fetchDecks();
    return data.deck;
  }

  async function fetchCards(deckId: number): Promise<FlashcardCard[]> {
    const res = await fetch(`${API_BASE}/api/flashcards/decks/${deckId}/cards`, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    setCards(data.cards);
    return data.cards;
  }

  async function fetchDueCards(deckId: number): Promise<FlashcardCard[]> {
    const res = await fetch(`${API_BASE}/api/flashcards/decks/${deckId}/due`, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    setDueCards(data.cards);
    return data.cards;
  }

  async function addCard(
    deckId: number,
    forte: string,
    frontField: string = 'forte',
    backFields: string[] = ['prime_form', 'interval_vector'],
  ): Promise<FlashcardCard> {
    const res = await fetch(`${API_BASE}/api/flashcards/decks/${deckId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ forte, frontField, backFields }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    const data = await res.json();
    await fetchCards(deckId);
    await fetchDecks();
    return data.card;
  }

  async function updateProgress(
    cardId: number,
    easeFactor: number,
    interval: number,
    repetitions: number,
    nextDue: string,
  ): Promise<void> {
    await fetch(`${API_BASE}/api/flashcards/cards/${cardId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ easeFactor, interval, repetitions, nextDue }),
    });
  }

  async function deleteDeck(deckId: number): Promise<void> {
    await fetch(`${API_BASE}/api/flashcards/decks/${deckId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setCurrentDeck(null);
    setCards([]);
    await fetchDecks();
  }

  async function deleteCard(cardId: number, deckId: number): Promise<void> {
    await fetch(`${API_BASE}/api/flashcards/cards/${cardId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await fetchCards(deckId);
    await fetchDecks();
  }

  return {
    decks,
    currentDeck,
    setCurrentDeck,
    cards,
    dueCards,
    loading,
    fetchDecks,
    createDeck,
    fetchCards,
    fetchDueCards,
    addCard,
    updateProgress,
    deleteDeck,
    deleteCard,
  };
}
