import type { PitchClass } from './types';
import { toPcSet } from './pcset';

export function isMaximallyEven(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  const k = sorted.length;
  if (k === 0) return false;
  if (k === 12) return true;
  const steps = sorted.map((_, i) => {
    const next = sorted[(i + 1) % k]!;
    const curr = sorted[i]!;
    return (next - curr + 12) % 12;
  });
  const uniqueSteps = new Set(steps);
  if (uniqueSteps.size > 2) return false;
  if (uniqueSteps.size === 1) return true;
  const stepValues = [...uniqueSteps].sort((a, b) => a - b);
  return stepValues[1]! - stepValues[0]! === 1;
}
