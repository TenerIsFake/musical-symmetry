import { useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useCollections } from '../hooks/useCollections';

interface Props {
  pitchClasses: PitchClass[];
  chordName?: string;
}

export default function SaveButton({ pitchClasses, chordName }: Props) {
  const { collections, createCollection, addToCollection } = useCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saved, setSaved] = useState(false);

  if (pitchClasses.length < 2) return null;

  const label = chordName || pitchClasses.map(pc => NOTE_NAMES[pc]).join(', ');

  async function handleSave(collectionId: string) {
    await addToCollection(collectionId, pitchClasses, label);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    await createCollection(newName.trim());
    setNewName('');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-3">
          <p className="text-xs text-gray-400 mb-2">Save to collection:</p>
          {collections.length === 0 && (
            <p className="text-xs text-gray-500 italic mb-2">No collections yet</p>
          )}
          {collections.map(c => (
            <button
              key={c.id}
              onClick={() => handleSave(c.id)}
              className="block w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
            >
              {c.name} ({c.item_count})
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-700 flex gap-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New collection..."
              className="flex-1 px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
