import { createContext, useContext, useState, type ReactNode } from 'react';

interface ResearchModeContext {
  researchMode: boolean;
  toggle: () => void;
}

const Ctx = createContext<ResearchModeContext>({ researchMode: false, toggle: () => {} });

export function ResearchModeProvider({ children }: { children: ReactNode }) {
  const [researchMode, setResearchMode] = useState(() => {
    return localStorage.getItem('research-mode') === 'true';
  });

  const toggle = () => {
    setResearchMode(prev => {
      const next = !prev;
      localStorage.setItem('research-mode', String(next));
      return next;
    });
  };

  return <Ctx.Provider value={{ researchMode, toggle }}>{children}</Ctx.Provider>;
}

export function useResearchMode() {
  return useContext(Ctx);
}
