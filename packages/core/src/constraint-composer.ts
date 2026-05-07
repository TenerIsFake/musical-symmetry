import type { PitchClass } from './types';
import { toCSEG } from './contour';

export interface CompositionConstraints {
  pitchClassSet: PitchClass[];
  length: number;
  contourClass?: number[];       // target CSEG (e.g. [0,2,1,3])
  registerLow?: number;          // MIDI note (default 60 = C4)
  registerHigh?: number;         // MIDI note (default 84 = C6)
  avoidRepeats?: boolean;        // no consecutive same pitch
  maxLeap?: number;              // max semitone jump between consecutive notes
}

export interface CompositionCandidate {
  notes: { midi: number; pc: PitchClass }[];
  contour: number[];
}

function csegMatches(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function generateCandidates(
  constraints: CompositionConstraints,
  maxResults: number = 10,
): CompositionCandidate[] {
  const {
    pitchClassSet,
    length,
    contourClass,
    registerLow = 60,
    registerHigh = 84,
    avoidRepeats = false,
    maxLeap,
  } = constraints;

  // Build list of allowed MIDI pitches
  const allowed: number[] = [];
  for (let midi = registerLow; midi <= registerHigh; midi++) {
    if (pitchClassSet.includes((midi % 12) as PitchClass)) {
      allowed.push(midi);
    }
  }

  if (allowed.length === 0 || length <= 0) return [];

  const results: CompositionCandidate[] = [];
  const sequence: number[] = [];
  let iterations = 0;
  const ITERATION_LIMIT = 100_000;

  function backtrack(pos: number): void {
    if (results.length >= maxResults || iterations > ITERATION_LIMIT) return;

    if (pos === length) {
      const contour = toCSEG(sequence);
      if (contourClass !== undefined && !csegMatches(contour, contourClass)) return;
      const notes = sequence.map(midi => ({
        midi,
        pc: (midi % 12) as PitchClass,
      }));
      results.push({ notes, contour });
      return;
    }

    for (const midi of allowed) {
      iterations++;
      if (iterations > ITERATION_LIMIT) return;
      if (results.length >= maxResults) return;

      // Check avoidRepeats
      if (avoidRepeats && pos > 0 && sequence[pos - 1] === midi) continue;

      // Check maxLeap
      if (maxLeap !== undefined && pos > 0) {
        const prev = sequence[pos - 1]!;
        if (Math.abs(midi - prev) > maxLeap) continue;
      }

      sequence[pos] = midi;
      backtrack(pos + 1);
    }
    sequence.length = pos;
  }

  backtrack(0);
  return results;
}
