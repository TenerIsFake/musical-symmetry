import type { PitchClass } from './types';
import { toPcSet } from './pcset';

export function isRetrogradePalindrome(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  if (sorted.length < 2) return true;
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    const curr = sorted[i]!;
    intervals.push((next - curr + 12) % 12);
  }
  const reversed = [...intervals].reverse();
  return intervals.every((v, i) => v === reversed[i]);
}
