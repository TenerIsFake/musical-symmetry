import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/apiBase';

interface Collection {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
}

interface CollectionItem {
  id: string;
  pitch_classes: string;
  label: string | null;
  notes: string | null;
  created_at: string;
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/collections`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
      }
    } catch { /* not logged in */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  async function createCollection(name: string) {
    const res = await fetch(`${API_BASE}/api/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    await fetchCollections();
  }

  async function addToCollection(collectionId: string, pitchClasses: number[], label?: string) {
    const res = await fetch(`${API_BASE}/api/collections/${collectionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pitchClasses, label }),
    });
    if (!res.ok) throw new Error('Failed to save');
    await fetchCollections();
  }

  async function getItems(collectionId: string): Promise<CollectionItem[]> {
    const res = await fetch(`${API_BASE}/api/collections/${collectionId}/items`, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items;
  }

  async function deleteCollection(id: string) {
    await fetch(`${API_BASE}/api/collections/${id}`, { method: 'DELETE', credentials: 'include' });
    await fetchCollections();
  }

  return { collections, loading, createCollection, addToCollection, getItems, deleteCollection, refresh: fetchCollections };
}
