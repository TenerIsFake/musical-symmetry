import type { PitchClass } from './types';
import { ALL_PITCH_CLASSES } from './types';
import { transpose, invert, areEqual } from './pcset';

export function transpositionalStabilizer(pcs: PitchClass[]): PitchClass[] {
  return ALL_PITCH_CLASSES.filter(n => areEqual(transpose(pcs, n), pcs));
}

export function inversionalAxes(pcs: PitchClass[]): PitchClass[] {
  return ALL_PITCH_CLASSES.filter(k => areEqual(invert(pcs, k), pcs));
}

export function stabilizerOrder(pcs: PitchClass[]): number {
  return transpositionalStabilizer(pcs).length + inversionalAxes(pcs).length;
}

export function distinctTranspositions(pcs: PitchClass[]): number {
  return 12 / transpositionalStabilizer(pcs).length;
}

export function abstractGroup(pcs: PitchClass[]): string {
  // Single pitch class (or empty set) has full dihedral symmetry D12
  if (pcs.length <= 1) return 'D12';
  const tOrder = transpositionalStabilizer(pcs).length;
  const iCount = inversionalAxes(pcs).length;
  if (iCount > 0) {
    if (tOrder === 1) return 'Z2';
    return `D${tOrder}`;
  }
  if (tOrder === 1) return 'C1';
  return `C${tOrder}`;
}
