import type { PitchClass } from './types';
import { toPcSet } from './pcset';

export interface PcSetForm {
  type: 'T' | 'TnI';
  n: number;
  pcs: PitchClass[];
}

export function allTranspositions(pcs: PitchClass[]): PitchClass[][] {
  const seen = new Set<string>();
  const results: PitchClass[][] = [];
  for (let n = 0; n < 12; n++) {
    const transposed = toPcSet(pcs.map(pc => ((pc + n) % 12) as PitchClass));
    const key = transposed.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      results.push(transposed);
    }
  }
  return results;
}

export function allInversions(pcs: PitchClass[]): PitchClass[][] {
  const seen = new Set<string>();
  const results: PitchClass[][] = [];
  for (let n = 0; n < 12; n++) {
    const inverted = toPcSet(pcs.map(pc => ((n - pc + 12) % 12) as PitchClass));
    const key = inverted.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      results.push(inverted);
    }
  }
  return results;
}

export function allForms(pcs: PitchClass[]): PcSetForm[] {
  const results: PcSetForm[] = [];
  const seen = new Set<string>();

  for (let n = 0; n < 12; n++) {
    const transposed = toPcSet(pcs.map(pc => ((pc + n) % 12) as PitchClass));
    const key = transposed.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type: 'T', n, pcs: transposed });
    }
  }

  for (let n = 0; n < 12; n++) {
    const inverted = toPcSet(pcs.map(pc => ((n - pc + 12) % 12) as PitchClass));
    const key = inverted.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type: 'TnI', n, pcs: inverted });
    }
  }

  return results;
}
