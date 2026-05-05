import { useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

const KEY_TO_PC: Record<string, PitchClass> = {
  a: 0,   // C
  w: 1,   // C#
  s: 2,   // D
  e: 3,   // Eb
  d: 4,   // E
  f: 5,   // F
  t: 6,   // F#
  g: 7,   // G
  y: 8,   // Ab
  h: 9,   // A
  u: 10,  // Bb
  j: 11,  // B
};

interface KeyboardActions {
  togglePC: (pc: PitchClass) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardActions) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        actions.undo();
        return;
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        actions.redo();
        return;
      }

      // Clear: Backspace or Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        actions.clear();
        return;
      }

      // Note keys
      const pc = KEY_TO_PC[e.key.toLowerCase()];
      if (pc !== undefined && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        actions.togglePC(pc);
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
