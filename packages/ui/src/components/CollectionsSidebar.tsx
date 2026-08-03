import { useState, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { useCollections } from '../hooks/useCollections';
import { useUser } from '../context/UserContext';
import { API_BASE } from '../utils/apiBase';

interface Props {
  onLoadPcs: (pcs: PitchClass[]) => void;
}

interface PublishState {
  published: boolean;
  slug: string | null;
}

export default function CollectionsSidebar({ onLoadPcs }: Props) {
  const { collections, getItems, deleteCollection, loading, refresh } = useCollections();
  const { user } = useUser();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; pitch_classes: string; label: string | null }[]>([]);
  const [publishStates, setPublishStates] = useState<Record<string, PublishState>>({});
  const [publishLoading, setPublishLoading] = useState<Record<string, boolean>>({});

  const canPublish = user?.tier === 'pro' || user?.tier === 'research';

  useEffect(() => {
    if (expandedId) {
      getItems(expandedId).then(setItems);
    }
  }, [expandedId, getItems]);

  // Sync publish state from collections data (which includes published+slug after migration)
  useEffect(() => {
    if (!canPublish || collections.length === 0) return;
    const states: Record<string, PublishState> = {};
    for (const c of collections as (typeof collections[number] & { published?: number; slug?: string | null })[]) {
      states[c.id] = { published: !!c.published, slug: c.slug ?? null };
    }
    setPublishStates(states);
  }, [canPublish, collections]);

  async function togglePublish(collectionId: string) {
    const current = publishStates[collectionId];
    const isPublished = current?.published ?? false;
    setPublishLoading(prev => ({ ...prev, [collectionId]: true }));

    try {
      if (isPublished) {
        const res = await fetch(`${API_BASE}/api/public/collections/${collectionId}/publish`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          setPublishStates(prev => ({ ...prev, [collectionId]: { published: false, slug: null } }));
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to unpublish');
        }
      } else {
        const res = await fetch(`${API_BASE}/api/public/collections/${collectionId}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const data = await res.json();
          setPublishStates(prev => ({ ...prev, [collectionId]: { published: true, slug: data.slug } }));
        } else {
          const err = await res.json();
          alert(err.error || 'Failed to publish');
        }
      }
    } finally {
      setPublishLoading(prev => ({ ...prev, [collectionId]: false }));
      refresh();
    }
  }

  if (loading) return null;
  if (collections.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Saved Collections</h2>
      {collections.map(c => {
        const pubState = publishStates[c.id];
        const isPublished = pubState?.published ?? false;
        const isPublishBusy = publishLoading[c.id] ?? false;

        return (
          <div key={c.id} className="mb-2">
            <button
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              className="flex items-center justify-between w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
            >
              <span className="flex items-center gap-1.5">
                {isPublished && (
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-green-400"
                    title="Published"
                  />
                )}
                {c.name} ({c.item_count})
              </span>
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
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {canPublish && (
                    <button
                      onClick={() => togglePublish(c.id)}
                      disabled={isPublishBusy}
                      className={`text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-50 ${
                        isPublished
                          ? 'bg-green-700 text-green-100 hover:bg-green-800'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                      }`}
                    >
                      {isPublishBusy ? '…' : isPublished ? 'Published' : 'Publish'}
                    </button>
                  )}
                  {isPublished && pubState?.slug && (
                    <a
                      href={`#u/${user?.email?.split('@')[0] || 'me'}/${pubState.slug}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      View
                    </a>
                  )}
                  <button
                    onClick={() => { if (confirm('Delete this collection?')) deleteCollection(c.id); }}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Delete collection
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
