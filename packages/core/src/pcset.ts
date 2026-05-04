import type { PitchClass } from './types';
import { ALL_PITCH_CLASSES } from './types';

export function mod12(n: number): PitchClass {
  return (((n % 12) + 12) % 12) as PitchClass;
}

export function toPcSet(notes: number[]): PitchClass[] {
  const set = new Set(notes.map(mod12));
  return [...set].sort((a, b) => a - b);
}

export function transpose(pcs: PitchClass[], n: number): PitchClass[] {
  return toPcSet(pcs.map(pc => pc + n));
}

export function invert(pcs: PitchClass[], axis: number): PitchClass[] {
  return toPcSet(pcs.map(pc => axis - pc));
}

export function normalize(pcs: PitchClass[]): PitchClass[] {
  const sorted = toPcSet(pcs);
  if (sorted.length <= 1) return sorted;
  let best = sorted;
  let bestSpan = (sorted[sorted.length - 1]! - sorted[0]! + 12) % 12;
  for (let i = 1; i < sorted.length; i++) {
    const rotated = toPcSet(sorted.map(pc => pc - sorted[i]!));
    const span = (rotated[rotated.length - 1]! - rotated[0]! + 12) % 12;
    if (span < bestSpan || (span === bestSpan && lexLess(rotated, best))) {
      best = rotated;
      bestSpan = span;
    }
  }
  return best;
}

function lexLess(a: PitchClass[], b: PitchClass[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return true;
    if (a[i]! > b[i]!) return false;
  }
  return false;
}

export function complement(pcs: PitchClass[]): PitchClass[] {
  const set = new Set(toPcSet(pcs));
  return ALL_PITCH_CLASSES.filter(pc => !set.has(pc));
}

export function areEqual(a: PitchClass[] | number[], b: PitchClass[] | number[]): boolean {
  const sa = toPcSet(a);
  const sb = toPcSet(b);
  if (sa.length !== sb.length) return false;
  return sa.every((v, i) => v === sb[i]);
}
