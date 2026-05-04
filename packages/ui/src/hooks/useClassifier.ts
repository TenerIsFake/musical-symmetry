import { useMemo } from 'react';
import { classify } from '@musical-symmetry/core';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';

export function useClassifier(pcs: PitchClass[]): SymmetryAnalysis | null {
  return useMemo(() => {
    if (pcs.length < 2) return null;
    return classify(pcs);
  }, [pcs.join(',')]);
}
