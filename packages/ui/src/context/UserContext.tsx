import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'research';
  hasApiKey: boolean;
}

interface UserContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<UserContextValue>({ user: null, loading: true, refresh: () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  return <Ctx.Provider value={{ user, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useUser() {
  return useContext(Ctx);
}
