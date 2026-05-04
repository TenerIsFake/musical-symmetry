import type { PitchClass } from './types';
import { mod12, toPcSet } from './pcset';

export type IntervalVector = [number, number, number, number, number, number];

export function intervalVector(pcs: PitchClass[]): IntervalVector {
  const sorted = toPcSet(pcs);
  const vec: IntervalVector = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = mod12(sorted[j]! - sorted[i]!);
      const ic = diff <= 6 ? diff : 12 - diff;
      if (ic >= 1 && ic <= 6) {
        vec[ic - 1]!++;
      }
    }
  }
  return vec;
}

export function myhillProperty(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  const n = sorted.length;
  if (n < 2) return false;
  for (let genericInterval = 1; genericInterval < n; genericInterval++) {
    const specificSizes = new Set<number>();
    for (let i = 0; i < n; i++) {
      const j = (i + genericInterval) % n;
      const diff = mod12(sorted[j]! - sorted[i]!);
      specificSizes.add(diff);
    }
    if (specificSizes.size !== 2) return false;
  }
  return true;
}

export function zRelated(a: PitchClass[], b: PitchClass[]): boolean {
  const va = intervalVector(a);
  const vb = intervalVector(b);
  const sameVector = va.every((v, i) => v === vb[i]);
  if (!sameVector) return false;
  const sa = toPcSet(a);
  const sb = toPcSet(b);
  if (sa.length !== sb.length) return false;
  for (let n = 0; n < 12; n++) {
    const transposed = toPcSet(sa.map(pc => pc + n));
    if (transposed.length === sb.length && transposed.every((v, i) => v === sb[i])) return false;
    const inverted = toPcSet(sa.map(pc => n - pc));
    if (inverted.length === sb.length && inverted.every((v, i) => v === sb[i])) return false;
  }
  return true;
}
