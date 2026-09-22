/**
 * The corpus behind `test-vectors.json`.
 *
 * Shared deliberately between the generator and the test, so there is exactly
 * one definition of "what we promise about this engine". The generator records
 * what these cases produce; the test replays them; a future XCTest suite asserts
 * the Swift port produces the same file.
 *
 * Two rules keep this honest:
 *   - Every public export is either listed here or in EXCLUDED_EXPORTS with a
 *     stated reason. `tests/conformance.test.ts` fails otherwise.
 *   - Nothing here may be random or time-dependent. The only export that is,
 *     is excluded below.
 */
import type { PitchClass, Chord } from '../types';
import type { RhythmPattern } from '../rhythm';
import type { Operation } from '../transform-chain';
import type { InstrumentSpec } from '../orchestration';
import { TUNING_12TET, TUNING_19TET, TUNING_BOHLEN_PIERCE } from '../tuning';

/** Floats are compared to this tolerance, never for exact equality. */
export const FLOAT_TOLERANCE = 1e-9;

/**
 * JSON has no NaN or Infinity — `JSON.stringify(NaN)` is `null`. Left alone,
 * the vectors would silently record `null` where the engine produces NaN, and
 * the Swift port would be held to a contract that misstates the real answer.
 *
 * Found the hard way: `findBestScale([], 3)` returns three NaN scores (an
 * empty set divides by zero somewhere in the scoring), which round-tripped to
 * null and made the replay disagree with the file it had just generated.
 *
 * ⚠️ Those NaNs are a latent bug in the engine, pinned here rather than fixed:
 * changing the behaviour is a product decision, and characterization vectors
 * exist to record what IS true so a change cannot happen by accident.
 */
export function encodeValue(value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { __num: Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity' };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, encodeValue(v)]));
  }
  return value;
}

export interface Case {
  name: string;
  args?: unknown[];
}

/** All 4,095 non-empty subsets of the twelve pitch classes, in bitmask order. */
function allPcSets(): PitchClass[][] {
  const sets: PitchClass[][] = [];
  for (let mask = 1; mask < 4096; mask++) {
    const pcs: PitchClass[] = [];
    for (let pc = 0; pc < 12; pc++) if (mask & (1 << pc)) pcs.push(pc as PitchClass);
    sets.push(pcs);
  }
  return sets;
}

/** The 24 consonant triads — the domain PLR operations are defined on. */
function allTriads(): Chord[] {
  const chords: Chord[] = [];
  for (let root = 0; root < 12; root++) {
    chords.push({
      root: root as PitchClass, quality: 'major',
      pitchClasses: [root, (root + 4) % 12, (root + 7) % 12] as PitchClass[],
    });
    chords.push({
      root: root as PitchClass, quality: 'minor',
      pitchClasses: [root, (root + 3) % 12, (root + 7) % 12] as PitchClass[],
    });
  }
  return chords;
}

const PC_SETS = allPcSets();
const TRIADS = allTriads();

/**
 * A fixed, varied sample for functions where exhaustive enumeration would add
 * size without adding confidence. Chosen to include the degenerate shapes that
 * break implementations: empty, singleton, the whole aggregate, and sets with
 * strong symmetry (whole-tone, diminished seventh, augmented triad).
 */
const SAMPLE_SETS: PitchClass[][] = [
  [], [0], [0, 1], [0, 4, 7], [0, 3, 6], [0, 4, 8], [0, 3, 6, 9],
  [0, 2, 4, 6, 8, 10], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 2, 4, 5, 7, 9, 11], [0, 1, 4, 6], [1, 5, 9], [11, 0, 1],
];

const SAMPLE_MELODIES: number[][] = [
  [], [60], [60, 62], [60, 64, 67, 72], [72, 67, 64, 60],
  [60, 62, 61, 63, 62], [67, 60, 64, 62, 65],
];

const SAMPLE_RHYTHMS: RhythmPattern[] = [
  [], [1], [1, 0], [1, 0, 0, 1, 0, 0, 1, 0],
  [1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
];

const SAMPLE_CHAINS: Operation[][] = [
  [], [{ type: 'T', n: 1 }], [{ type: 'I', n: 0 }],
  [{ type: 'P' }, { type: 'L' }, { type: 'R' }],
  [{ type: 'T', n: 5 }, { type: 'P' }, { type: 'I', n: 3 }],
];

const SAMPLE_OPERATIONS: Operation[] = [
  { type: 'T', n: 0 }, { type: 'T', n: 7 }, { type: 'I', n: 11 },
  { type: 'P' }, { type: 'L' }, { type: 'R' },
];

const INSTRUMENTS: InstrumentSpec[] = [
  { name: 'Violin', family: 'strings', rangeLow: 55, rangeHigh: 103, sweetLow: 60, sweetHigh: 91 },
  { name: 'Cello', family: 'strings', rangeLow: 36, rangeHigh: 76, sweetLow: 43, sweetHigh: 69 },
  { name: 'Flute', family: 'woodwinds', rangeLow: 60, rangeHigh: 96, sweetLow: 67, sweetHigh: 91 },
  { name: 'Horn', family: 'brass', rangeLow: 34, rangeHigh: 77, sweetLow: 48, sweetHigh: 72 },
];

function pairs<T>(items: T[], stride: number): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    out.push([items[i]!, items[(i + stride) % items.length]!]);
  }
  return out;
}

export const VECTOR_CASES: Case[] = [
  // ── constants: data the Swift port must reproduce exactly ────────────────
  { name: 'ALL_PITCH_CLASSES' },
  { name: 'NOTE_NAMES' },
  { name: 'SCALE_TEMPLATES' },
  { name: 'CHORD_TEMPLATES' },
  { name: 'KNOWN_CLAVES' },
  { name: 'TUNING_12TET' },
  { name: 'TUNING_19TET' },
  { name: 'TUNING_24TET' },
  { name: 'TUNING_31TET' },
  { name: 'TUNING_BOHLEN_PIERCE' },
  { name: 'ALL_TUNINGS' },

  // ── exhaustive over all 4,095 pitch-class sets ───────────────────────────
  ...PC_SETS.flatMap((pcs): Case[] => [
    { name: 'classify', args: [pcs] },
    { name: 'normalize', args: [pcs] },
    { name: 'intervalVector', args: [pcs] },
    { name: 'identifyChord', args: [pcs] },
  ]),

  // ── exhaustive over the 24 triads ────────────────────────────────────────
  ...TRIADS.flatMap((chord): Case[] => [
    { name: 'applyP', args: [chord] },
    { name: 'applyL', args: [chord] },
    { name: 'applyR', args: [chord] },
    { name: 'applyCompound', args: [chord, 'PLR'] },
    { name: 'allFirstOrder', args: [chord] },
    { name: 'allSecondOrder', args: [chord] },
    { name: 'allThirdOrder', args: [chord] },
  ]),
  ...pairs(TRIADS, 5).flatMap(([from, to]): Case[] => [
    { name: 'classifyTransition', args: [from, to] },
    { name: 'findPLRPath', args: [from, to, 4] },
  ]),

  // ── sampled: set theory ──────────────────────────────────────────────────
  ...SAMPLE_SETS.flatMap((pcs): Case[] => [
    { name: 'complement', args: [pcs] },
    { name: 'transpositionalStabilizer', args: [pcs] },
    { name: 'inversionalAxes', args: [pcs] },
    { name: 'stabilizerOrder', args: [pcs] },
    { name: 'distinctTranspositions', args: [pcs] },
    { name: 'abstractGroup', args: [pcs] },
    { name: 'myhillProperty', args: [pcs] },
    { name: 'isMaximallyEven', args: [pcs] },
    { name: 'mullikenLabel', args: [pcs] },
    { name: 'characterTableEntry', args: [pcs] },
    { name: 'isRetrogradePalindrome', args: [pcs] },
    { name: 'brightnessIndex', args: [pcs] },
    { name: 'analyzeModes', args: [pcs] },
    { name: 'findBestScale', args: [pcs, 3] },
    { name: 'allTranspositions', args: [pcs] },
    { name: 'allInversions', args: [pcs] },
    { name: 'allForms', args: [pcs] },
    { name: 'transpose', args: [pcs, 7] },
    { name: 'invert', args: [pcs, 3] },
  ]),
  ...pairs(SAMPLE_SETS, 3).flatMap(([a, b]): Case[] => [
    { name: 'zRelated', args: [a, b] },
    { name: 'areEqual', args: [a, b] },
    { name: 'voiceLeadingDistance', args: [a, b] },
    { name: 'generalizedVoiceLeading', args: [a, b] },
  ]),
  ...[-13, -1, 0, 5, 12, 25].map((n): Case => ({ name: 'mod12', args: [n] })),
  ...[[], [60, 64, 67], [-1, 12, 25], [127]].map((notes): Case =>
    ({ name: 'toPcSet', args: [notes] })),

  // ── sampled: contour (no unit tests before this) ─────────────────────────
  ...SAMPLE_MELODIES.flatMap((pitches): Case[] => [
    { name: 'toCSEG', args: [pitches] },
    { name: 'analyzeContour', args: [pitches] },
  ]),
  ...SAMPLE_MELODIES.map(p => p).flatMap((pitches): Case[] => {
    // the contour functions take a CSEG, which toCSEG derives from pitches;
    // recorded here as the literal CSEG so the Swift test needs no bootstrap
    const cseg = pitches.map((v, i) =>
      pitches.filter(o => o < v).length + (pitches.slice(0, i).filter(o => o === v).length ? 0 : 0));
    return [
      { name: 'comMatrix', args: [cseg] },
      { name: 'contourAdjacencySeries', args: [cseg] },
      { name: 'contourInversion', args: [cseg] },
      { name: 'contourRetrograde', args: [cseg] },
      { name: 'contourRetrogradeInversion', args: [cseg] },
      { name: 'isContourPalindrome', args: [cseg] },
      { name: 'isInversionallySymmetric', args: [cseg] },
      { name: 'contourDepth', args: [cseg] },
      { name: 'contourClass', args: [cseg] },
    ];
  }),
  { name: 'contourSimilarity', args: [[0, 1, 2], [2, 1, 0]] },
  { name: 'contourSimilarity', args: [[0, 2, 1], [0, 2, 1]] },

  // ── sampled: rhythm (no unit tests before this) ──────────────────────────
  ...SAMPLE_RHYTHMS.flatMap((pattern): Case[] => [
    { name: 'analyzeRhythm', args: [pattern] },
    { name: 'rotateRhythm', args: [pattern, 3] },
    { name: 'rhythmNecklaceClass', args: [pattern] },
    { name: 'rhythmEvenness', args: [pattern] },
    { name: 'interOnsetIntervals', args: [pattern] },
    { name: 'isMaximallyEvenRhythm', args: [pattern] },
    { name: 'matchClave', args: [pattern] },
  ]),
  ...pairs(SAMPLE_RHYTHMS, 2).map(([a, b]): Case =>
    ({ name: 'rhythmSimilarity', args: [a, b] })),

  // ── euclidean rhythms: exhaustive over musically useful k/n ──────────────
  ...Array.from({ length: 17 }, (_, n) => n).flatMap((n): Case[] =>
    Array.from({ length: n + 1 }, (_, k) => ({ name: 'euclidean', args: [k, n] }))),

  // ── transform chains (no unit tests before this) ─────────────────────────
  ...SAMPLE_CHAINS.map((ops): Case => ({ name: 'evaluateChain', args: [[0, 4, 7], ops] })),
  ...SAMPLE_OPERATIONS.map((op): Case => ({ name: 'operationLabel', args: [op] })),

  // ── tuning (no unit tests before this) ───────────────────────────────────
  ...[TUNING_12TET, TUNING_19TET, TUNING_BOHLEN_PIERCE].flatMap((tuning): Case[] => [
    { name: 'frequencyInTuning', args: [0, 4, tuning] },
    { name: 'frequencyInTuning', args: [7, 5, tuning] },
    { name: 'nearestTwelveTET', args: [3, tuning] },
  ]),
  ...[12, 19, 24, 31].flatMap((n): Case[] => [
    { name: 'generalizedTranspose', args: [[0, 4, 7], 3, n] },
    { name: 'generalizedInvert', args: [[0, 4, 7], 2, n] },
    { name: 'generalizedIntervalVector', args: [[0, 4, 7], n] },
    { name: 'generalizedSymmetryGroup', args: [[0, 4, 7], n] },
    { name: 'generalizedMaximallyEven', args: [[0, 4, 7], n] },
  ]),

  // ── quantize, composer, orchestration (no unit tests before this) ────────
  ...[0, 60, 61, 127].flatMap((midi): Case[] => [
    { name: 'quantizeToSet', args: [midi, [0, 2, 4, 5, 7, 9, 11]] },
    { name: 'quantizeToSet', args: [midi, [0, 4, 8]] },
  ]),
  { name: 'generateCandidates', args: [{ pitchClassSet: [0, 4, 7], length: 4 }, 5] },
  { name: 'generateCandidates', args: [{ pitchClassSet: [0, 2, 4, 6, 8, 10], length: 3, avoidRepeats: true }, 3] },
  { name: 'suggestOrchestrations', args: [[0, 4, 7], INSTRUMENTS, { maxResults: 3 }] },
  { name: 'suggestOrchestrations', args: [[], INSTRUMENTS] },
];

export const EXCLUDED_EXPORTS: { name: string; reason: string }[] = [
  {
    name: 'randomChain',
    reason:
      'Uses Math.random (transform-chain.ts:90), so it has no fixed output to ' +
      'record and no cross-language equivalent — Swift would not reproduce V8\'s ' +
      'sequence even from the same seed. Its building blocks are covered instead: ' +
      'every Operation shape appears in the operationLabel and evaluateChain cases, ' +
      'so the only untested part is the draw itself.',
  },
];
