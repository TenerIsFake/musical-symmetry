import { useState, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { useCollections } from '../hooks/useCollections';

interface Props {
  onLoadPcs: (pcs: PitchClass[]) => void;
}

export default function CollectionsSidebar({ onLoadPcs }: Props) {
  const { collections, getItems, deleteCollection, loading } = useCollections();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; pitch_classes: string; label: string | null }[]>([]);

  useEffect(() => {
    if (expandedId) {
      getItems(expandedId).then(setItems);
    }
  }, [expandedId, getItems]);

  if (loading) return null;
  if (collections.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Saved Collections</h2>
      {collections.map(c => (
        <div key={c.id} className="mb-2">
          <button
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
            className="flex items-center justify-between w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
          >
            <span>{c.name} ({c.item_count})</span>
            <span className="text-gray-500 text-xs">{expandedId === c.id ? 'v' : '>'}</span>
          </button>
          {expandedId === c.id && (
            <div className="ml-3 mt-1 space-y-1">
              {items.map(item => {
                const pcs = JSON.parse(item.pitch_classes) as PitchClass[];
                return (
                  <button
                    key={item.id}
                    onClick={() => onLoadPcs(pcs)}
                    className="block w-full text-left px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    {item.label || item.pitch_classes}
                  </button>
                );
              })}
              <button
                onClick={() => { if (confirm('Delete this collection?')) deleteCollection(c.id); }}
                className="text-xs text-red-500 hover:text-red-400 mt-1"
              >
                Delete collection
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
