import type { PitchClass } from './types';
import { transpose, areEqual } from './pcset';
import { inversionalAxes } from './symmetry';
import { isRetrogradePalindrome } from './modes';

export function mullikenLabel(pcs: PitchClass[]): string {
  const t6Symmetric = areEqual(transpose(pcs, 6), pcs);
  const hasInversion = inversionalAxes(pcs).length > 0;
  const palindrome = isRetrogradePalindrome(pcs);

  const primary = t6Symmetric ? 'A' : 'B';
  const subscript = hasInversion ? '1' : '2';
  const parity = palindrome ? 'g' : 'u';

  return `${primary}${subscript}${parity}`;
}
