import { generalizedVoiceLeading, applyP, applyL, applyR, identifyChord, NOTE_NAMES } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { GENRE_PROFILES, type GenreProfile } from './profiles.js';

export interface GenreMatch {
  genre: string;
  confidence: number;  // 0–1
  characteristics: string[];
  explanation: string;
}

/**
 * Cosine similarity between two same-length numeric vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Jaccard similarity between two sets of strings.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Detect genre based on the Forte numbers present and the average interval vector
 * of the input. Returns top 3 matches sorted by confidence.
 */
export function detectGenre(
  forteNumbers: string[],
  avgIntervalVector: [number, number, number, number, number, number],
): GenreMatch[] {
  const scored: Array<{ profile: GenreProfile; score: number }> = [];

  for (const profile of GENRE_PROFILES) {
    const ivSim  = cosineSimilarity(avgIntervalVector, profile.intervalVectorAvg);
    const fnSim  = jaccardSimilarity(forteNumbers, profile.commonForteNumbers);
    // Weighted blend: IV carries 60%, Forte numbers 40%
    const blended = 0.6 * ivSim + 0.4 * fnSim;
    scored.push({ profile, score: blended });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ profile, score }) => {
    const confidence = Math.min(1, Math.max(0, score));
    const topFn = forteNumbers.slice(0, 3).join(', ') || 'none';
    const explanation =
      `Matched on interval-vector similarity (${(cosineSimilarity(avgIntervalVector, profile.intervalVectorAvg) * 100).toFixed(0)}%) ` +
      `and set-class overlap (${(jaccardSimilarity(forteNumbers, profile.commonForteNumbers) * 100).toFixed(0)}%). ` +
      `Input Forte numbers: ${topFn}.`;
    return {
      genre: profile.name,
      confidence,
      characteristics: profile.characteristics,
      explanation,
    };
  });
}

// ---- Chord suggestion helpers ----

function chordName(pcs: PitchClass[]): string {
  const chord = identifyChord(pcs);
  if (!chord) return `{${pcs.join(',')}}`;
  const suffix: Record<string, string> = {
    major: '', minor: 'm', diminished: 'dim', augmented: 'aug',
  };
  return `${NOTE_NAMES[chord.root]}${suffix[chord.quality] ?? chord.quality}`;
}

/**
 * Suggest next chords given a progression and optional genre context.
 * Uses the genre profile's typical progressions for pattern-matching,
 * plus PLR neighbors of the last chord, ranked by voice-leading distance.
 */
export function suggestNextChord(
  currentPcs: number[][],
  genre?: string,
): { pcs: number[]; name: string; reason: string }[] {
  const profile = genre
    ? GENRE_PROFILES.find(p => p.name === genre)
    : GENRE_PROFILES[0];

  const lastPcs = currentPcs[currentPcs.length - 1];
  if (!lastPcs || lastPcs.length === 0) return [];

  const lastPc = lastPcs as PitchClass[];
  const suggestions: Map<string, { pcs: number[]; name: string; reason: string; vlDist: number }> = new Map();

  const addSuggestion = (pcs: number[], reason: string) => {
    const key = pcs.slice().sort((a, b) => a - b).join(',');
    if (suggestions.has(key)) return;
    const vlDist = generalizedVoiceLeading(lastPc, pcs as PitchClass[]);
    suggestions.set(key, { pcs, name: chordName(pcs as PitchClass[]), reason, vlDist });
  };

  // 1. Pattern-match against typical progressions from the genre profile
  if (profile) {
    for (const prog of profile.typicalProgressions) {
      for (let i = 0; i < prog.length - 1; i++) {
        const cur = prog[i]!;
        const next = prog[i + 1]!;
        const curKey = cur.slice().sort((a, b) => a - b).join(',');
        const lastKey = lastPc.slice().sort((a, b) => a - b).join(',');
        if (curKey === lastKey) {
          addSuggestion(next, `Follows typical ${profile.name} progression`);
        }
      }
    }
  }

  // 2. PLR neighbors of the last chord
  const lastChord = identifyChord(lastPc);
  if (lastChord && (lastChord.quality === 'major' || lastChord.quality === 'minor')) {
    const p = applyP(lastChord);
    const l = applyL(lastChord);
    const r = applyR(lastChord);
    addSuggestion(p.pitchClasses, 'P transform (parallel mode)');
    addSuggestion(l.pitchClasses, 'L transform (leading-tone exchange)');
    addSuggestion(r.pitchClasses, 'R transform (relative)');
  }

  // 3. If genre profile has typical progressions, also suggest tonic-region chords
  if (profile && profile.typicalProgressions.length > 0) {
    const firstProg = profile.typicalProgressions[0]!;
    if (firstProg.length > 0) {
      addSuggestion(firstProg[0]!, `Common tonic in ${profile.name}`);
    }
  }

  // Sort by voice-leading distance (prefer smooth motion), cap at 5
  return Array.from(suggestions.values())
    .sort((a, b) => a.vlDist - b.vlDist)
    .slice(0, 5)
    .map(({ pcs, name, reason }) => ({ pcs, name, reason }));
}
