// ─── Tuning System Definitions ───────────────────────────────────────────────

export interface TuningSystem {
  name: string;
  divisions: number;        // equal divisions of the octave (or tritave for BP)
  referenceFreq: number;    // Hz for the reference pitch
  referencePitch: number;   // pitch index for the reference (e.g. 9 for A in 12-TET)
  noteNames: string[];      // names for each degree
  intervalNames?: string[]; // names for each interval class (up to floor(n/2))
  /** Frequency ratio per step (2^(1/n) for standard TET, or 3^(1/13) for BP) */
  stepRatio: number;
  /** For display: is this a tritave system? */
  isTritave?: boolean;
}

// ─── 12-TET ──────────────────────────────────────────────────────────────────

export const TUNING_12TET: TuningSystem = {
  name: '12-TET',
  divisions: 12,
  referenceFreq: 440,
  referencePitch: 9,
  stepRatio: Math.pow(2, 1 / 12),
  noteNames: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
  intervalNames: ['m2', 'M2', 'm3', 'M3', 'P4', 'TT'],
};

// ─── 19-TET ──────────────────────────────────────────────────────────────────

export const TUNING_19TET: TuningSystem = {
  name: '19-TET',
  divisions: 19,
  referenceFreq: 440,
  referencePitch: 15, // A is at index 15 in 19-TET
  stepRatio: Math.pow(2, 1 / 19),
  noteNames: [
    'C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'E♯/F♭', 'F',
    'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B', 'B♯/C♭',
  ],
  intervalNames: [
    '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°',
  ],
};

// ─── 24-TET (Quarter-tones) ───────────────────────────────────────────────────

export const TUNING_24TET: TuningSystem = {
  name: '24-TET',
  divisions: 24,
  referenceFreq: 440,
  referencePitch: 18, // A is at index 18 in 24-TET
  stepRatio: Math.pow(2, 1 / 24),
  noteNames: [
    'C', 'C+', 'C♯', 'C♯+', 'D', 'D+', 'D♯', 'D♯+',
    'E', 'E+', 'F', 'F+', 'F♯', 'F♯+', 'G', 'G+',
    'G♯', 'G♯+', 'A', 'A+', 'A♯', 'A♯+', 'B', 'B+',
  ],
  intervalNames: [
    'qt', 'sm2', 'n-m2', 'm2', 'n-M2', 'M2', 'n-m3', 'm3',
    'n-M3', 'M3', 'n-P4', 'P4',
  ],
};

// ─── 31-TET ───────────────────────────────────────────────────────────────────

export const TUNING_31TET: TuningSystem = {
  name: '31-TET',
  divisions: 31,
  referenceFreq: 440,
  referencePitch: 25, // A is at index 25 in 31-TET
  stepRatio: Math.pow(2, 1 / 31),
  noteNames: Array.from({ length: 31 }, (_, i) => {
    // 31-TET: 5-limit JI approximation with meantone-like enharmonics
    const names31 = [
      'C', 'C↑', 'C♯', 'D♭', 'D↓', 'D', 'D↑', 'D♯', 'E♭', 'E↓',
      'E', 'E↑/F↓', 'F', 'F↑', 'F♯', 'G♭', 'G↓', 'G', 'G↑', 'G♯',
      'A♭', 'A↓', 'A', 'A↑', 'A♯', 'B♭', 'B↓', 'B', 'B↑/C↓', 'B♯/C♭', 'C̈',
    ];
    return names31[i] ?? `${i}`;
  }),
  intervalNames: Array.from({ length: 15 }, (_, i) => `${i + 1}°`),
};

// ─── Bohlen-Pierce (13 divisions of the tritave) ──────────────────────────────

export const TUNING_BOHLEN_PIERCE: TuningSystem = {
  name: 'Bohlen-Pierce',
  divisions: 13,
  referenceFreq: 440,
  referencePitch: 0, // A is the reference, at step 0
  stepRatio: Math.pow(3, 1 / 13), // tritave (3:1) divided into 13 equal steps
  isTritave: true,
  noteNames: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  ],
  intervalNames: [
    '1°', '2°', '3°', '4°', '5°', '6°',
  ],
};

// ─── All tuning systems ───────────────────────────────────────────────────────

export const ALL_TUNINGS: TuningSystem[] = [
  TUNING_12TET,
  TUNING_19TET,
  TUNING_24TET,
  TUNING_31TET,
  TUNING_BOHLEN_PIERCE,
];

// ─── Frequency Calculation ────────────────────────────────────────────────────

/**
 * Compute the frequency of a pitch in the given tuning system.
 *
 * @param pitchIndex  Degree within the octave/tritave (0-indexed).
 * @param octave      Which octave/tritave above or below the reference octave
 *                    (0 = the octave containing the reference pitch).
 * @param tuning      The tuning system.
 */
export function frequencyInTuning(
  pitchIndex: number,
  octave: number,
  tuning: TuningSystem,
): number {
  const n = tuning.divisions;
  const ref = tuning.referencePitch;
  const refFreq = tuning.referenceFreq;
  const ratio = tuning.stepRatio;

  // Number of steps from reference pitch to the target pitch (in octave 0)
  const stepsFromRef = pitchIndex - ref + octave * n;
  return refFreq * Math.pow(ratio, stepsFromRef);
}

// ─── Generalized Z_n Set Operations ──────────────────────────────────────────

function modN(n: number): (x: number) => number {
  return x => (((x % n) + n) % n);
}

/**
 * Transpose a pitch-class set by k steps in Z_n.
 */
export function generalizedTranspose(pcs: number[], interval: number, n: number): number[] {
  const mod = modN(n);
  const set = new Set(pcs.map(pc => mod(pc + interval)));
  return [...set].sort((a, b) => a - b);
}

/**
 * Invert a pitch-class set around axis in Z_n.
 */
export function generalizedInvert(pcs: number[], axis: number, n: number): number[] {
  const mod = modN(n);
  const set = new Set(pcs.map(pc => mod(axis - pc)));
  return [...set].sort((a, b) => a - b);
}

/**
 * Generalized interval vector for Z_n.
 * Returns an array of length floor(n/2) where entry i counts ordered pairs
 * at interval class (i+1).
 */
export function generalizedIntervalVector(pcs: number[], n: number): number[] {
  const icMax = Math.floor(n / 2);
  const vec = new Array<number>(icMax).fill(0);
  const sorted = [...new Set(pcs.map(modN(n)))].sort((a, b) => a - b);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = ((sorted[j]! - sorted[i]!) + n) % n;
      const ic = diff <= icMax ? diff : n - diff;
      if (ic >= 1 && ic <= icMax) {
        vec[ic - 1]!++;
      }
    }
  }
  return vec;
}

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Compute the abstract symmetry group of a pitch-class set in Z_n.
 * Returns a string like 'C1', 'C3', 'Z2', 'D4', etc.
 */
export function generalizedSymmetryGroup(pcs: number[], n: number): string {
  const mod = modN(n);
  const sorted = [...new Set(pcs.map(mod))].sort((a, b) => a - b);

  if (sorted.length <= 1) return `D${n}`;

  // Transpositional stabilizer
  let tOrder = 0;
  for (let k = 0; k < n; k++) {
    const t = generalizedTranspose(sorted, k, n);
    if (setsEqual(t, sorted)) tOrder++;
  }

  // Inversional axes
  let iCount = 0;
  for (let k = 0; k < n; k++) {
    const inv = generalizedInvert(sorted, k, n);
    if (setsEqual(inv, sorted)) iCount++;
  }

  if (iCount > 0) {
    if (tOrder === 1) return 'Z2';
    return `D${tOrder}`;
  }
  if (tOrder === 1) return 'C1';
  return `C${tOrder}`;
}

/**
 * Test whether a pitch-class set is maximally even in Z_n.
 * A set of k elements in Z_n is maximally even when all step sizes between
 * consecutive elements (on the circle) are either floor(n/k) or ceil(n/k).
 */
export function generalizedMaximallyEven(pcs: number[], n: number): boolean {
  const mod = modN(n);
  const sorted = [...new Set(pcs.map(mod))].sort((a, b) => a - b);
  const k = sorted.length;
  if (k === 0) return false;
  if (k === n) return true;

  const steps = sorted.map((_, i) => {
    const next = sorted[(i + 1) % k]!;
    const curr = sorted[i]!;
    return (next - curr + n) % n;
  });

  const uniqueSteps = new Set(steps);
  if (uniqueSteps.size > 2) return false;
  if (uniqueSteps.size === 1) return true;
  const stepValues = [...uniqueSteps].sort((a, b) => a - b);
  return stepValues[1]! - stepValues[0]! === 1;
}

/**
 * "Compare to 12-TET" mapping.
 *
 * Given a pitch index in the source tuning, returns the nearest 12-TET
 * pitch class (0–11) and the deviation in cents.
 */
export function nearestTwelveTET(
  pitchIndex: number,
  tuning: TuningSystem,
): { pc12: number; centsDeviation: number } {
  const n = tuning.divisions;
  // Cents per step in the source tuning (relative to octave = 1200 cents,
  // or tritave = 1902 cents for BP)
  const octaveCents = tuning.isTritave ? 1902 : 1200;
  const centsPerStep = octaveCents / n;
  const pitchCents = pitchIndex * centsPerStep;

  // Map to 0–1200 range (within one octave)
  const pitchCentsOct = ((pitchCents % 1200) + 1200) % 1200;
  const pc12Raw = pitchCentsOct / 100;
  const pc12 = Math.round(pc12Raw) % 12;
  const centsDeviation = pitchCentsOct - pc12 * 100;

  return { pc12, centsDeviation };
}
