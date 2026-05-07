import type { PitchClass } from './types';

export function quantizeToSet(midiNote: number, targetPcs: PitchClass[]): number {
  if (targetPcs.length === 0) return midiNote;
  const pc = (midiNote % 12) as PitchClass;
  const octave = Math.floor(midiNote / 12);
  let bestPc = targetPcs[0]!;
  let bestDist = 12;
  for (const t of targetPcs) {
    const d = Math.min(Math.abs(pc - t), 12 - Math.abs(pc - t));
    if (d < bestDist) { bestDist = d; bestPc = t; }
  }
  // Keep in same octave region
  const candidate = octave * 12 + bestPc;
  const candidateUp = candidate + 12;
  const candidateDown = candidate - 12;
  // Return the closest to the original note
  let best = candidate;
  if (Math.abs(candidateUp - midiNote) < Math.abs(best - midiNote)) best = candidateUp;
  if (candidateDown >= 0 && Math.abs(candidateDown - midiNote) < Math.abs(best - midiNote)) best = candidateDown;
  return best;
}
