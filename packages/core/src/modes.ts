import type { PitchClass, ModeAnalysis } from './types';
import { mod12, toPcSet } from './pcset';

const DORIAN_TEMPLATE = [0, 2, 3, 5, 7, 9, 10];

export function isRetrogradePalindrome(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  if (sorted.length < 2) return true;
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    const curr = sorted[i]!;
    intervals.push((next - curr + 12) % 12);
  }
  const reversed = [...intervals].reverse();
  return intervals.every((v, i) => v === reversed[i]);
}

export function brightnessIndex(pcs: PitchClass[]): number {
  const sorted = toPcSet(pcs);
  if (sorted.length !== 7) return 0;
  const root = sorted[0]!;
  const normalized = sorted.map(pc => mod12(pc - root));
  const dorian = DORIAN_TEMPLATE;
  let brightness = 0;
  for (let i = 1; i < 7; i++) {
    if (normalized[i]! > dorian[i]!) brightness++;
    if (normalized[i]! < dorian[i]!) brightness--;
  }
  return brightness;
}

function getIntervalPattern(pcs: PitchClass[]): number[] {
  const sorted = toPcSet(pcs);
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    const curr = sorted[i]!;
    intervals.push((next - curr + 12) % 12);
  }
  return intervals;
}

function detectModeName(intervals: number[]): string {
  const patterns: Record<string, number[]> = {
    Ionian:     [2, 2, 1, 2, 2, 2, 1],
    Dorian:     [2, 1, 2, 2, 2, 1, 2],
    Phrygian:   [1, 2, 2, 2, 1, 2, 2],
    Lydian:     [2, 2, 2, 1, 2, 2, 1],
    Mixolydian: [2, 2, 1, 2, 2, 1, 2],
    Aeolian:    [2, 1, 2, 2, 1, 2, 2],
    Locrian:    [1, 2, 2, 1, 2, 2, 2],
  };
  for (const [name, pattern] of Object.entries(patterns)) {
    if (intervals.length === pattern.length && intervals.every((v, i) => v === pattern[i])) {
      return name;
    }
  }
  return 'Unknown';
}

function isPalindromic(intervals: number[]): boolean {
  const reversed = [...intervals].reverse();
  return intervals.every((v, i) => v === reversed[i]);
}

export function analyzeModes(pcs: PitchClass[]): ModeAnalysis[] {
  const sorted = toPcSet(pcs);
  if (sorted.length !== 7) return [];
  const modes: ModeAnalysis[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const root = sorted[i]!;
    const rotated = sorted.map(pc => mod12(pc - root)) as PitchClass[];
    const rotatedSorted = toPcSet(rotated);
    const intervals = getIntervalPattern(rotatedSorted);
    const name = detectModeName(intervals);
    const brightness = brightnessIndex(rotatedSorted);
    modes.push({
      name,
      root,
      intervalPattern: intervals,
      brightnessIndex: brightness,
      isPalindrome: isPalindromic(intervals),
      mullikenLabel: '',
    });
  }
  return modes.sort((a, b) => b.brightnessIndex - a.brightnessIndex);
}
