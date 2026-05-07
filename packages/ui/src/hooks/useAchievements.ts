import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://symmetry.tendrid.us';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  grantedAt: string | null;
}

export function useAchievements(enabled: boolean) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [earned, setEarned] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    fetch(`${API_BASE}/api/achievements`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setAchievements(data.achievements);
        setEarned(data.earned);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  return { achievements, earned, total, loading };
}
