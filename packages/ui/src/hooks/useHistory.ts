import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/apiBase';

export interface HistoryEntry {
  id: number;
  type: string;
  pitch_classes: string;
  forte: string | null;
  prime_form: string | null;
  interval_vector: string | null;
  tags: string;
  bookmarked: number;
  created_at: string;
}

interface UseHistoryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  bookmarkedOnly?: boolean;
}

export function useHistory(enabled: boolean, options: UseHistoryOptions = {}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { limit = 50, offset = 0, search, bookmarkedOnly } = options;

  const fetchHistory = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (offset) params.set('offset', String(offset));
      if (search) params.set('search', search);
      if (bookmarkedOnly) params.set('bookmarked', '1');

      const res = await fetch(`${API_BASE}/api/history?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      } else {
        setError('Failed to load history');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, [enabled, limit, offset, search, bookmarkedOnly]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleBookmark = useCallback(async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/history/${id}/bookmark`, {
        method: 'POST',
        credentials: 'include',
      });
      await fetchHistory();
    } catch {}
  }, [fetchHistory]);

  const deleteEntry = useCallback(async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/history/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch {}
  }, []);

  const updateTags = useCallback(async (id: number, tags: string) => {
    try {
      await fetch(`${API_BASE}/api/history/${id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tags }),
      });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, tags } : e));
    } catch {}
  }, []);

  return { entries, loading, error, refresh: fetchHistory, toggleBookmark, deleteEntry, updateTags };
}
