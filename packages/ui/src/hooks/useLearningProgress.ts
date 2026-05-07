import { useState, useEffect, useCallback } from 'react';

interface LessonProgressEntry {
  path_id: string;
  lesson_id: string;
  completed_at: string;
}

interface UseLearningProgressResult {
  completedLessons: Set<string>;
  loading: boolean;
  markComplete: (pathId: string, lessonId: string) => Promise<void>;
  resetPath: (pathId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLearningProgress(enabled: boolean): UseLearningProgressResult {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/learning/progress', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { progress: LessonProgressEntry[] };
        setCompletedLessons(new Set(data.progress.map(p => `${p.path_id}/${p.lesson_id}`)));
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markComplete = useCallback(async (pathId: string, lessonId: string) => {
    try {
      const res = await fetch(`/api/learning/progress/${pathId}/${lessonId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setCompletedLessons(prev => new Set([...prev, `${pathId}/${lessonId}`]));
      }
    } catch {
      // ignore network errors
    }
  }, []);

  const resetPath = useCallback(async (pathId: string) => {
    try {
      const res = await fetch(`/api/learning/progress/${pathId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setCompletedLessons(prev => {
          const next = new Set(prev);
          for (const key of next) {
            if (key.startsWith(`${pathId}/`)) {
              next.delete(key);
            }
          }
          return next;
        });
      }
    } catch {
      // ignore network errors
    }
  }, []);

  return { completedLessons, loading, markComplete, resetPath, refresh };
}
