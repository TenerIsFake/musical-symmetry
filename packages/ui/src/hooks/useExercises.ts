import { useState, useCallback } from 'react';
import { API_BASE } from '../utils/apiBase';

export interface Exercise {
  key: string;
  title: string;
  description: string;
  tool: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prefilledParams?: Record<string, string>;
}

interface UseExercisesResult {
  suggestions: Exercise[];
  completed: string[];
  loading: boolean;
  loadSuggestions: () => Promise<void>;
  completeExercise: (key: string, sketchId?: number) => Promise<void>;
}

export function useExercises(): UseExercisesResult {
  const [suggestions, setSuggestions] = useState<Exercise[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const [suggestRes, completedRes] = await Promise.all([
        fetch(`${API_BASE}/api/exercises`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/exercises/completed`, { credentials: 'include' }),
      ]);
      if (suggestRes.ok) {
        const data = (await suggestRes.json()) as { exercises: Exercise[] };
        setSuggestions(data.exercises);
      }
      if (completedRes.ok) {
        const data = (await completedRes.json()) as { completed: string[] };
        setCompleted(data.completed);
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, []);

  const completeExercise = useCallback(async (key: string, sketchId?: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/exercises/${encodeURIComponent(key)}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sketchId !== undefined ? { sketchId } : {}),
      });
      if (res.ok) {
        setCompleted(prev => prev.includes(key) ? prev : [...prev, key]);
        setSuggestions(prev => prev.filter(e => e.key !== key));
      }
    } catch {
      // ignore network errors
    }
  }, []);

  return { suggestions, completed, loading, loadSuggestions, completeExercise };
}
