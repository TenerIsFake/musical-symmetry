import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/apiBase';

export interface MelodyNote {
  pc: number;
  step: number;
}

export interface Sketch {
  id?: number;
  name: string;
  description: string;
  tempo: number;
  time_sig_top: number;
  time_sig_bottom: number;
  bars: number;
  melody_data: string;
  rhythm_data: string;
  chord_data: string;
  created_at?: string;
  updated_at?: string;
}

export type SavedSketch = Sketch & { id: number; created_at: string; updated_at: string };

export function defaultSketch(): Sketch {
  return {
    name: 'Untitled Sketch',
    description: '',
    tempo: 120,
    time_sig_top: 4,
    time_sig_bottom: 4,
    bars: 8,
    melody_data: '[]',
    rhythm_data: '[]',
    chord_data: '[]',
  };
}

export function useSketchpad() {
  const [sketches, setSketches] = useState<SavedSketch[]>([]);
  const [currentSketch, setCurrentSketch] = useState<Sketch>(defaultSketch());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSketches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/sketches`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { sketches: SavedSketch[] };
        setSketches(data.sketches);
      }
    } catch {
      // not logged in or network error
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSketches(); }, [loadSketches]);

  async function saveSketch(): Promise<SavedSketch> {
    const method = currentSketch.id ? 'PUT' : 'POST';
    const url = currentSketch.id
      ? `${API_BASE}/api/sketches/${currentSketch.id}`
      : `${API_BASE}/api/sketches`;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(currentSketch),
    });

    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }

    const data = await res.json() as { sketch: SavedSketch };
    const saved = data.sketch;
    setCurrentSketch(saved);
    await loadSketches();
    return saved;
  }

  async function deleteSketch(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sketches/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json() as { error: string };
      throw new Error(err.error);
    }
    if (currentSketch.id === id) {
      setCurrentSketch(defaultSketch());
    }
    await loadSketches();
  }

  function updateLocalSketch(changes: Partial<Sketch>): void {
    setCurrentSketch(prev => ({ ...prev, ...changes }));
  }

  function loadSketchIntoEditor(sketch: SavedSketch): void {
    setCurrentSketch(sketch);
  }

  function newSketch(): void {
    setCurrentSketch(defaultSketch());
    setError(null);
  }

  return {
    sketches,
    currentSketch,
    loading,
    error,
    setError,
    loadSketches,
    saveSketch,
    deleteSketch,
    updateLocalSketch,
    loadSketchIntoEditor,
    newSketch,
  };
}
