import { useState, useEffect, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { useFlashcards } from '../hooks/useFlashcards';

interface AtlasEntry {
  forteNumber: string;
  primeForm: PitchClass[];
  group: string;
  stabilizerOrder: number;
  intervalVector: [number, number, number, number, number, number];
  mullikenLabel: string;
  maximallyEven: boolean;
  myhillProperty: boolean;
  distinctTranspositions: number;
  cardinality: number;
}

interface Props {
  forteNumber: string;
}

function QuickAddButton({ forteNumber }: { forteNumber: string }) {
  const { user } = useUser();
  const { decks, fetchDecks, addCard } = useFlashcards();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) fetchDecks();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!user) return null;

  async function handleSelect(deckId: number) {
    setOpen(false);
    setAdding(true);
    try {
      await addCard(deckId, forteNumber);
      setToast(`Added to deck!`);
      setTimeout(() => setToast(''), 2500);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to add');
      setTimeout(() => setToast(''), 3000);
    }
    setAdding(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={adding}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition text-sm"
      >
        {adding ? 'Adding…' : '+ Add to Deck'}
      </button>
      {toast && (
        <div className="absolute right-0 top-12 bg-gray-700 text-sm text-white px-3 py-2 rounded shadow-lg whitespace-nowrap z-10">
          {toast}
        </div>
      )}
      {open && (
        <div className="absolute right-0 top-12 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[180px]">
          {decks.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">
              No decks yet.{' '}
              <a href="#flashcards" className="text-indigo-400 hover:underline">Create one</a>
            </div>
          ) : (
            <ul className="py-1">
              {decks.map(deck => (
                <li key={deck.id}>
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors"
                    onClick={() => handleSelect(deck.id)}
                  >
                    <span className="block font-medium">{deck.name}</span>
                    <span className="block text-xs text-gray-500">{deck.card_count} cards</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AtlasEntryPage({ forteNumber }: Props) {
  const [entry, setEntry] = useState<AtlasEntry | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/atlas/${forteNumber}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setEntry)
      .catch(() => setError('Set class not found'));
  }, [forteNumber]);

  if (error) return <div className="text-center mt-20 text-red-400">{error}</div>;
  if (!entry) return <div className="text-center mt-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a href="#atlas" className="text-indigo-400 text-sm hover:underline mb-4 block">Back to Atlas</a>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold font-mono">{entry.forteNumber}</h1>
        <span className="px-3 py-1 bg-indigo-900 text-indigo-300 rounded text-lg">{entry.group}</span>
        <div className="ml-auto">
          <QuickAddButton forteNumber={entry.forteNumber} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Prime Form</h2>
          <div className="flex gap-2">
            {entry.primeForm.map(pc => (
              <span key={pc} className="px-3 py-1.5 bg-green-900 text-green-300 rounded font-mono text-lg">
                {NOTE_NAMES[pc]}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Properties</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Symmetry Group</span>
            <span className="text-white font-mono">{entry.group}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Mulliken Label</span>
            <span className="text-white font-mono">{entry.mullikenLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Interval Vector</span>
            <span className="text-white font-mono">[{entry.intervalVector.join(', ')}]</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Stabilizer Order</span>
            <span className="text-white font-mono">{entry.stabilizerOrder}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Distinct Transpositions</span>
            <span className="text-white font-mono">{entry.distinctTranspositions}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Maximally Even</span>
            <span className={entry.maximallyEven ? 'text-green-400' : 'text-gray-500'}>{entry.maximallyEven ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Myhill Property</span>
            <span className={entry.myhillProperty ? 'text-green-400' : 'text-gray-500'}>{entry.myhillProperty ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href={`#classifier?pcs=${entry.primeForm.join(',')}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
        >
          Open in Classifier
        </a>
        <a
          href={`/api/og/orbit?pcs=${entry.primeForm.join(',')}`}
          target="_blank"
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
        >
          View OG Card
        </a>
      </div>
    </div>
  );
}
