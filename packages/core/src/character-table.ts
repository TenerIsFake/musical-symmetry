import type { PitchClass } from './types';
import { transpose, areEqual } from './pcset';
import { inversionalAxes } from './symmetry';
import { isRetrogradePalindrome } from './modes';

export function characterTableEntry(pcs: PitchClass[]): Record<string, 1 | -1> {
  return {
    E: 1,
    T6: areEqual(transpose(pcs, 6), pcs) ? 1 : -1,
    I: inversionalAxes(pcs).length > 0 ? 1 : -1,
    R: isRetrogradePalindrome(pcs) ? 1 : -1,
  };
}
