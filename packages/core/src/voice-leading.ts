import type { PitchClass } from './types';

function minSemitoneDist(a: PitchClass, b: PitchClass): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i]!, ...perm]);
    }
  }
  return result;
}

export function voiceLeadingDistance(a: PitchClass[], b: PitchClass[]): number {
  if (a.length !== b.length) {
    throw new Error('Sets must have equal cardinality for voice-leading distance');
  }
  if (a.length === 0) return 0;
  let minTotal = Infinity;
  for (const perm of permutations(b)) {
    let total = 0;
    for (let i = 0; i < a.length; i++) {
      total += minSemitoneDist(a[i]!, perm[i]!);
    }
    minTotal = Math.min(minTotal, total);
  }
  return minTotal;
}
