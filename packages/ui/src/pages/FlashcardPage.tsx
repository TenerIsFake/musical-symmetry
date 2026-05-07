import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useFlashcards, type FlashcardDeck, type FlashcardCard } from '../hooks/useFlashcards';
import { gradeCard, type Quality } from '../utils/sm2';

// ─── Types ──────────────────────────────────────────────────────────────────────

type View = 'deck-list' | 'deck-editor' | 'study';

// ─── Utilities ──────────────────────────────────────────────────────────────────

function formatField(field: string): string {
  const map: Record<string, string> = {
    forte: 'Forte Number',
    prime_form: 'Prime Form',
    interval_vector: 'Interval Vector',
    group: 'Symmetry Group',
    mulliken_label: 'Mulliken Label',
    cardinality: 'Cardinality',
  };
  return map[field] ?? field;
}

// ─── Create Deck Modal ──────────────────────────────────────────────────────────

function CreateDeckModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (deck: FlashcardDeck) => void;
}) {
  const { createDeck } = useFlashcards();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const deck = await createDeck(name.trim(), description.trim());
      onCreated(deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deck');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold mb-4">New Flashcard Deck</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Trichords"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Deck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Card Modal ──────────────────────────────────────────────────────────────

function AddCardModal({ deckId, onClose, onAdded }: {
  deckId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { addCard } = useFlashcards();
  const [forte, setForte] = useState('');
  const [frontField, setFrontField] = useState('forte');
  const [backFields, setBackFields] = useState<string[]>(['prime_form', 'interval_vector']);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const FIELD_OPTIONS = ['forte', 'prime_form', 'interval_vector', 'group', 'mulliken_label', 'cardinality'];

  function toggleBackField(f: string) {
    setBackFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forte.trim()) return;
    if (backFields.length === 0) { setError('Select at least one back field'); return; }
    setSaving(true);
    setError('');
    try {
      await addCard(deckId, forte.trim(), frontField, backFields);
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold mb-4">Add Card</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Forte Number</label>
            <input
              autoFocus
              value={forte}
              onChange={e => setForte(e.target.value)}
              placeholder="e.g. 3-11"
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Format: cardinality-index (e.g. 3-11, 4-17, 6-35)</p>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Front (question)</label>
            <select
              value={frontField}
              onChange={e => setFrontField(e.target.value)}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FIELD_OPTIONS.map(f => (
                <option key={f} value={f}>{formatField(f)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Back (answer fields)</label>
            <div className="flex flex-wrap gap-2">
              {FIELD_OPTIONS.filter(f => f !== frontField).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleBackField(f)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    backFields.includes(f)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {formatField(f)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!forte.trim() || saving}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Deck List View ─────────────────────────────────────────────────────────────

function DeckListView({
  decks,
  loading,
  onSelectDeck,
  onCreateDeck,
}: {
  decks: FlashcardDeck[];
  loading: boolean;
  onSelectDeck: (deck: FlashcardDeck) => void;
  onCreateDeck: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Decks</h2>
        <button
          onClick={onCreateDeck}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded transition-colors"
        >
          + New Deck
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && decks.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-4">No decks yet. Create your first flashcard deck to start studying set classes.</p>
          <button
            onClick={onCreateDeck}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded transition-colors"
          >
            Create a Deck
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map(deck => (
          <button
            key={deck.id}
            onClick={() => onSelectDeck(deck)}
            className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-indigo-600 rounded-xl p-5 text-left transition-all group"
          >
            <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{deck.name}</h3>
            {deck.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{deck.description}</p>
            )}
            <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
              <span>{deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}</span>
              <span>·</span>
              <span>Created {new Date(deck.created_at).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Deck Editor View ────────────────────────────────────────────────────────────

function DeckEditorView({
  deck,
  onBack,
  onStudy,
}: {
  deck: FlashcardDeck;
  onBack: () => void;
  onStudy: () => void;
}) {
  const { fetchCards, deleteCard, deleteDeck } = useFlashcards();
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    setLoadingCards(true);
    fetchCards(deck.id).then(c => { setCards(c); setLoadingCards(false); });
  }, [deck.id]);

  async function handleDeleteCard(cardId: number) {
    await deleteCard(cardId, deck.id);
    const updated = await fetchCards(deck.id);
    setCards(updated);
  }

  async function handleDeleteDeck() {
    if (!window.confirm(`Delete deck "${deck.name}"? This cannot be undone.`)) return;
    await deleteDeck(deck.id);
    onBack();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <h2 className="text-xl font-semibold flex-1">{deck.name}</h2>
        <button
          onClick={onStudy}
          disabled={cards.length === 0}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 text-sm font-medium rounded transition-colors disabled:opacity-40"
        >
          Study
        </button>
        <button
          onClick={() => setShowAddCard(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded transition-colors"
        >
          + Add Card
        </button>
        <button
          onClick={handleDeleteDeck}
          className="px-3 py-2 bg-gray-700 hover:bg-red-700 text-sm rounded transition-colors"
          title="Delete deck"
        >
          Delete Deck
        </button>
      </div>

      {deck.description && (
        <p className="text-gray-400 text-sm">{deck.description}</p>
      )}

      {loadingCards && <p className="text-gray-400 text-sm">Loading cards…</p>}

      {!loadingCards && cards.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
          No cards yet. Add a card to get started.
        </div>
      )}

      <div className="space-y-2">
        {cards.map(card => {
          const backFields: string[] = (() => {
            try { return JSON.parse(card.back_fields); } catch { return [card.back_fields]; }
          })();
          return (
            <div key={card.id} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-4">
              <div className="font-mono text-indigo-300 text-lg w-16 shrink-0">{card.forte}</div>
              <div className="flex-1 text-sm text-gray-400">
                <span className="text-gray-300">{formatField(card.front_field)}</span>
                <span className="mx-2">→</span>
                {backFields.map(f => formatField(f)).join(', ')}
              </div>
              <div className="text-xs text-gray-500 w-24 text-right shrink-0">
                {card.repetitions > 0
                  ? `${card.repetitions} review${card.repetitions === 1 ? '' : 's'}`
                  : 'New'}
              </div>
              <button
                onClick={() => handleDeleteCard(card.id)}
                className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                title="Delete card"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {showAddCard && (
        <AddCardModal
          deckId={deck.id}
          onClose={() => setShowAddCard(false)}
          onAdded={async () => {
            const updated = await fetchCards(deck.id);
            setCards(updated);
          }}
        />
      )}
    </div>
  );
}

// ─── Study Mode View ─────────────────────────────────────────────────────────────

interface AtlasEntry {
  forteNumber: string;
  primeForm: number[];
  group: string;
  stabilizerOrder: number;
  intervalVector: number[];
  mullikenLabel: string;
  cardinality: number;
}

function StudyView({
  deck,
  onBack,
}: {
  deck: FlashcardDeck;
  onBack: () => void;
}) {
  const { fetchDueCards, updateProgress } = useFlashcards();
  const [queue, setQueue] = useState<FlashcardCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [atlasEntry, setAtlasEntry] = useState<AtlasEntry | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [grading, setGrading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://symmetry.tendrid.us';

  useEffect(() => {
    fetchDueCards(deck.id).then(cards => {
      setQueue(cards);
      setLoading(false);
      if (cards.length === 0) setDone(true);
    });
  }, [deck.id]);

  const currentCard = queue[currentIndex] ?? null;

  useEffect(() => {
    if (!currentCard) return;
    setAtlasEntry(null);
    setEntryLoading(true);
    fetch(`${API_BASE}/api/atlas/${currentCard.forte}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setAtlasEntry(data); setEntryLoading(false); })
      .catch(() => setEntryLoading(false));
  }, [currentCard?.forte]);

  async function handleGrade(quality: Quality) {
    if (!currentCard || grading) return;
    setGrading(true);

    const card = {
      id: String(currentCard.id),
      easeFactor: currentCard.ease_factor,
      interval: currentCard.interval,
      repetitions: currentCard.repetitions,
      nextReview: new Date(currentCard.next_due).getTime(),
    };
    const updated = gradeCard(card, quality);
    const nextDue = new Date(updated.nextReview).toISOString().replace('T', ' ').slice(0, 19);

    await updateProgress(currentCard.id, updated.easeFactor, updated.interval, updated.repetitions, nextDue);

    // Move to next card
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setDone(true);
    } else {
      setCurrentIndex(nextIndex);
      setRevealed(false);
    }
    setGrading(false);
  }

  function renderFieldValue(field: string): string {
    if (!atlasEntry) return '…';
    switch (field) {
      case 'forte': return atlasEntry.forteNumber;
      case 'prime_form': return `[${atlasEntry.primeForm.join(', ')}]`;
      case 'interval_vector': return `<${atlasEntry.intervalVector.join('')}>`;
      case 'group': return atlasEntry.group;
      case 'mulliken_label': return atlasEntry.mullikenLabel;
      case 'cardinality': return String(atlasEntry.cardinality);
      default: return '?';
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading due cards…</p>;

  if (done || queue.length === 0) {
    return (
      <div className="space-y-6">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to Deck
        </button>
        <div className="bg-gray-800 rounded-xl p-10 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-semibold">All caught up!</h2>
          <p className="text-gray-400">No cards are due for review right now. Come back later.</p>
          <button onClick={onBack} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  const backFields: string[] = (() => {
    try { return JSON.parse(currentCard.back_fields); } catch { return [currentCard.back_fields]; }
  })();

  const progressPct = Math.round((currentIndex / queue.length) * 100);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>
        <div className="flex-1 bg-gray-700 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-sm text-gray-400">{currentIndex + 1} / {queue.length}</span>
      </div>

      {/* Card */}
      <div
        className="bg-gray-800 rounded-2xl p-8 min-h-[280px] flex flex-col items-center justify-center gap-6 cursor-pointer select-none border border-gray-700 hover:border-indigo-600 transition-colors"
        onClick={() => !revealed && setRevealed(true)}
      >
        {/* Front */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">{formatField(currentCard.front_field)}</p>
          {entryLoading ? (
            <div className="text-4xl font-mono text-white">…</div>
          ) : (
            <div className="text-4xl font-mono font-bold text-white">{renderFieldValue(currentCard.front_field)}</div>
          )}
        </div>

        {/* Back */}
        {revealed ? (
          <div className="w-full border-t border-gray-700 pt-6 space-y-3">
            {backFields.map(field => (
              <div key={field} className="flex justify-between items-center">
                <span className="text-sm text-gray-400">{formatField(field)}</span>
                <span className="text-sm font-mono text-green-300">{renderFieldValue(field)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Click to reveal</p>
        )}
      </div>

      {/* Rating buttons */}
      {revealed && (
        <div className="grid grid-cols-4 gap-3">
          {([
            { label: 'Again', quality: 0 as Quality, cls: 'bg-red-700 hover:bg-red-600' },
            { label: 'Hard', quality: 3 as Quality, cls: 'bg-orange-700 hover:bg-orange-600' },
            { label: 'Good', quality: 4 as Quality, cls: 'bg-indigo-600 hover:bg-indigo-500' },
            { label: 'Easy', quality: 5 as Quality, cls: 'bg-green-700 hover:bg-green-600' },
          ] as const).map(({ label, quality, cls }) => (
            <button
              key={label}
              onClick={() => handleGrade(quality)}
              disabled={grading}
              className={`${cls} text-white py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function FlashcardPage() {
  const { user, loading: userLoading } = useUser();
  const { decks, loading, fetchDecks, setCurrentDeck, currentDeck } = useFlashcards();
  const [view, setView] = useState<View>('deck-list');
  const [showCreateDeck, setShowCreateDeck] = useState(false);

  if (userLoading) return <p className="text-gray-400">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <h2 className="text-2xl font-semibold">Flashcard Deck Builder</h2>
        <p className="text-gray-400">Sign in to create and study personalized flashcard decks for all 224 set classes.</p>
        <a
          href="#dashboard"
          className="inline-block px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors"
        >
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div>
      {view === 'deck-list' && (
        <DeckListView
          decks={decks}
          loading={loading}
          onSelectDeck={deck => { setCurrentDeck(deck); setView('deck-editor'); }}
          onCreateDeck={() => setShowCreateDeck(true)}
        />
      )}

      {view === 'deck-editor' && currentDeck && (
        <DeckEditorView
          deck={currentDeck}
          onBack={() => { fetchDecks(); setView('deck-list'); }}
          onStudy={() => setView('study')}
        />
      )}

      {view === 'study' && currentDeck && (
        <StudyView
          deck={currentDeck}
          onBack={() => setView('deck-editor')}
        />
      )}

      {showCreateDeck && (
        <CreateDeckModal
          onClose={() => setShowCreateDeck(false)}
          onCreated={deck => {
            setCurrentDeck(deck);
            setShowCreateDeck(false);
            setView('deck-editor');
          }}
        />
      )}
    </div>
  );
}
