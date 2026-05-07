export type Beat = 0 | 1;
export type RhythmPattern = Beat[];

export interface RhythmAnalysis {
  pattern: RhythmPattern;
  length: number;
  onsets: number;
  rotationalSymmetry: number;   // highest k where rotation by k positions = identity
  isPalindrome: boolean;        // reflective symmetry
  necklaceClass: string;        // canonical form (lexicographically smallest rotation)
  evenness: number;             // how evenly distributed onsets are (0-1)
  interOnsetIntervals: number[];  // IOI vector (distances between successive onsets)
}

/**
 * Rotate pattern left by `positions` steps.
 */
export function rotateRhythm(pattern: RhythmPattern, positions: number): RhythmPattern {
  const n = pattern.length;
  if (n === 0) return [];
  const k = ((positions % n) + n) % n;
  return [...pattern.slice(k), ...pattern.slice(0, k)] as RhythmPattern;
}

/**
 * Compute the canonical (lexicographically smallest) rotation as a binary string.
 * This is the necklace representative.
 */
export function rhythmNecklaceClass(pattern: RhythmPattern): string {
  const n = pattern.length;
  if (n === 0) return '';
  let best = pattern.join('');
  for (let i = 1; i < n; i++) {
    const rotated = rotateRhythm(pattern, i).join('');
    if (rotated < best) best = rotated;
  }
  return best;
}

/**
 * Compute the inter-onset intervals (IOIs) — distances between consecutive onsets,
 * wrapping around. Returns empty array if fewer than 2 onsets.
 */
export function interOnsetIntervals(pattern: RhythmPattern): number[] {
  const n = pattern.length;
  const onsetPositions: number[] = [];
  for (let i = 0; i < n; i++) {
    if (pattern[i] === 1) onsetPositions.push(i);
  }
  if (onsetPositions.length < 2) return onsetPositions.length === 1 ? [n] : [];
  const iois: number[] = [];
  for (let i = 0; i < onsetPositions.length; i++) {
    const curr = onsetPositions[i]!;
    const next = onsetPositions[(i + 1) % onsetPositions.length]!;
    iois.push((next - curr + n) % n || n);
  }
  return iois;
}

/**
 * Evenness via circular variance of onset positions.
 * Returns a value in [0, 1] where 1 = perfectly even.
 * Uses the mean resultant length of the circular distribution.
 */
export function rhythmEvenness(pattern: RhythmPattern): number {
  const n = pattern.length;
  const onsets = pattern.reduce((acc: number, b) => acc + b, 0 as number);
  if (onsets === 0) return 0;
  if (onsets === n) return 1;

  // Project each onset onto the unit circle and compute mean resultant length.
  let sumCos = 0;
  let sumSin = 0;
  for (let i = 0; i < n; i++) {
    if (pattern[i] === 1) {
      const angle = (2 * Math.PI * i) / n;
      sumCos += Math.cos(angle);
      sumSin += Math.sin(angle);
    }
  }
  // Circular variance: R = |mean resultant| / onsets
  const R = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / onsets;
  // R ranges from 0 (maximally dispersed) to 1 (all clumped at one point).
  // We want evenness = 1 when R = 0, so return 1 - R.
  return 1 - R;
}

/**
 * Determine the highest k < n such that rotating by k gives the same pattern.
 * Returns the minimum positive period (or n if the pattern has no sub-period).
 * "Rotational symmetry order" = number of rotations that are self-maps.
 */
function rotationalSymmetryOrder(pattern: RhythmPattern): number {
  const n = pattern.length;
  if (n === 0) return 0;
  const s = pattern.join('');
  // Count how many rotations map the pattern to itself
  let count = 0;
  for (let k = 0; k < n; k++) {
    if (rotateRhythm(pattern, k).join('') === s) count++;
  }
  // count always >= 1 (k=0 is always self-map)
  return count;
}

/**
 * Check if a pattern is a palindrome (reflective symmetry):
 * pattern[i] == pattern[n-1-i] for all i.
 */
function isPalindromeRhythm(pattern: RhythmPattern): boolean {
  const n = pattern.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    if (pattern[i] !== pattern[n - 1 - i]) return false;
  }
  return true;
}

/**
 * Check if a rhythm is maximally even (Clough-Douthett criterion adapted).
 * A k-onset n-cycle is maximally even if each IOI is floor or ceil of n/k.
 */
export function isMaximallyEvenRhythm(pattern: RhythmPattern): boolean {
  const n = pattern.length;
  const k = pattern.reduce((acc: number, b) => acc + b, 0 as number);
  if (k === 0 || k === n) return k === n; // all rests = not ME; all onsets = trivially ME
  const iois = interOnsetIntervals(pattern);
  if (iois.length === 0) return false;
  const lo = Math.floor(n / k);
  const hi = Math.ceil(n / k);
  const uniqueIois = new Set(iois);
  if (uniqueIois.size > 2) return false;
  if (uniqueIois.size === 1) {
    const v = [...uniqueIois][0]!;
    return v === lo || v === hi;
  }
  const vals = [...uniqueIois].sort((a, b) => a - b);
  return vals[0] === lo && vals[1] === hi;
}

/**
 * Compute similarity between two rhythm patterns using swap distance (normalized).
 * Returns a value in [0, 1] where 1 = identical, 0 = maximally different.
 * Uses edit distance (Hamming if same length, else normalized Levenshtein).
 */
export function rhythmSimilarity(a: RhythmPattern, b: RhythmPattern): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  if (a.length === b.length) {
    // Hamming distance (simple and musically meaningful for same-length patterns)
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return 1 - diff / a.length;
  }

  // Levenshtein distance for different lengths
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }
  const maxLen = Math.max(m, n);
  return 1 - dp[m]![n]! / maxLen;
}

export function analyzeRhythm(pattern: RhythmPattern): RhythmAnalysis {
  return {
    pattern,
    length: pattern.length,
    onsets: pattern.reduce((acc: number, b) => acc + b, 0 as number),
    rotationalSymmetry: rotationalSymmetryOrder(pattern),
    isPalindrome: isPalindromeRhythm(pattern),
    necklaceClass: rhythmNecklaceClass(pattern),
    evenness: rhythmEvenness(pattern),
    interOnsetIntervals: interOnsetIntervals(pattern),
  };
}
