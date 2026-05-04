import { useMemo } from 'react';
import { identifyChord } from '@musical-symmetry/core';
import type { PitchClass, Chord } from '@musical-symmetry/core';

export function useChord(pcs: PitchClass[]): Chord | null {
  return useMemo(() => {
    if (pcs.length !== 3) return null;
    return identifyChord(pcs);
  }, [pcs.join(',')]);
}
