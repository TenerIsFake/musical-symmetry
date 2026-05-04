import type { PitchClass, Chord, ProgressionSuggestion } from './types';
import { mod12, toPcSet } from './pcset';

function makeChord(root: PitchClass, quality: 'major' | 'minor'): Chord {
  const third = quality === 'major' ? 4 : 3;
  return {
    root,
    quality,
    pitchClasses: toPcSet([root, root + third, root + 7]),
  };
}

export function applyP(chord: Chord): Chord {
  const newQuality = chord.quality === 'major' ? 'minor' : 'major';
  return makeChord(chord.root, newQuality);
}

export function applyL(chord: Chord): Chord {
  if (chord.quality === 'major') {
    return makeChord(mod12(chord.root + 4), 'minor');
  }
  return makeChord(mod12(chord.root - 4), 'major');
}

export function applyR(chord: Chord): Chord {
  if (chord.quality === 'major') {
    return makeChord(mod12(chord.root + 9), 'minor');
  }
  return makeChord(mod12(chord.root - 9 + 12), 'major');
}

const PLR_OPS: Record<string, (c: Chord) => Chord> = { P: applyP, L: applyL, R: applyR };

export function applyCompound(chord: Chord, ops: string): Chord {
  let result = chord;
  for (const op of ops) {
    const fn = PLR_OPS[op];
    if (!fn) throw new Error(`Unknown PLR operator: ${op}`);
    result = fn(result);
  }
  return result;
}

function commonTones(a: Chord, b: Chord): PitchClass[] {
  const setB = new Set(b.pitchClasses);
  return a.pitchClasses.filter(pc => setB.has(pc));
}

function voiceLeadingDist(a: Chord, b: Chord): number {
  let total = 0;
  const bUsed = new Set<number>();
  for (const pa of a.pitchClasses) {
    let bestDist = 12;
    let bestIdx = -1;
    for (let i = 0; i < b.pitchClasses.length; i++) {
      if (bUsed.has(i)) continue;
      const d = Math.min(Math.abs(pa - b.pitchClasses[i]!), 12 - Math.abs(pa - b.pitchClasses[i]!));
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    bUsed.add(bestIdx);
    total += bestDist;
  }
  return total;
}

function makeSuggestion(from: Chord, operator: string): ProgressionSuggestion {
  const to = applyCompound(from, operator);
  return {
    from,
    to,
    operator,
    order: operator.length as 1 | 2 | 3,
    commonTones: commonTones(from, to),
    voiceLeadingDistance: voiceLeadingDist(from, to),
  };
}

export function allFirstOrder(chord: Chord): ProgressionSuggestion[] {
  return ['P', 'L', 'R'].map(op => makeSuggestion(chord, op));
}

export function allSecondOrder(chord: Chord): ProgressionSuggestion[] {
  return ['PL', 'PR', 'LP', 'LR', 'RP', 'RL'].map(op => makeSuggestion(chord, op));
}

export function allThirdOrder(chord: Chord): ProgressionSuggestion[] {
  const ops = ['PLP', 'PLR', 'PRL', 'PRP', 'LPL', 'LPR', 'LRP', 'LRL', 'RPL', 'RPR', 'RLP', 'RLR'];
  const seen = new Set<string>();
  const results: ProgressionSuggestion[] = [];
  for (const op of ops) {
    const s = makeSuggestion(chord, op);
    const key = `${s.to.root}-${s.to.quality}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(s);
    }
  }
  return results;
}
