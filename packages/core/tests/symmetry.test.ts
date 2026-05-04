import { describe, it, expect } from 'vitest';
import { transpositionalStabilizer, inversionalAxes, stabilizerOrder, abstractGroup } from '../src/symmetry';
import type { PitchClass } from '../src/types';

describe('transpositionalStabilizer', () => {
  it('chromatic scale: all 12 transpositions', () => {
    const chromatic: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(transpositionalStabilizer(chromatic)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it('whole-tone: T0, T2, T4, T6, T8, T10', () => {
    const wt: PitchClass[] = [0, 2, 4, 6, 8, 10];
    expect(transpositionalStabilizer(wt)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it('octatonic: T0, T3, T6, T9', () => {
    const oct: PitchClass[] = [0, 1, 3, 4, 6, 7, 9, 10];
    expect(transpositionalStabilizer(oct)).toEqual([0, 3, 6, 9]);
  });
  it('diatonic major: T0 only', () => {
    const diat: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
    expect(transpositionalStabilizer(diat)).toEqual([0]);
  });
  it('C major triad: T0 only', () => {
    expect(transpositionalStabilizer([0, 4, 7] as PitchClass[])).toEqual([0]);
  });
  it('augmented triad: T0, T4, T8', () => {
    expect(transpositionalStabilizer([0, 4, 8] as PitchClass[])).toEqual([0, 4, 8]);
  });
  it('diminished 7th: T0, T3, T6, T9', () => {
    expect(transpositionalStabilizer([0, 3, 6, 9] as PitchClass[])).toEqual([0, 3, 6, 9]);
  });
});

describe('inversionalAxes', () => {
  it('diatonic major scale has 1 inversional axis (I4)', () => {
    const diat: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
    expect(inversionalAxes(diat)).toEqual([4]);
  });
  it('whole-tone has 6 inversional axes (all even)', () => {
    const wt: PitchClass[] = [0, 2, 4, 6, 8, 10];
    expect(inversionalAxes(wt)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it('harmonic minor has no inversional axes', () => {
    const hm: PitchClass[] = [0, 2, 3, 5, 7, 8, 11];
    expect(inversionalAxes(hm)).toEqual([]);
  });
  it('C major triad has no inversional self-symmetry', () => {
    expect(inversionalAxes([0, 4, 7] as PitchClass[])).toEqual([]);
  });
  it('augmented triad has 3 axes', () => {
    expect(inversionalAxes([0, 4, 8] as PitchClass[])).toEqual([0, 4, 8]);
  });
});

describe('abstractGroup', () => {
  it('chromatic → D12', () => {
    expect(abstractGroup([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe('D12');
  });
  it('whole-tone → D6', () => {
    expect(abstractGroup([0,2,4,6,8,10] as PitchClass[])).toBe('D6');
  });
  it('octatonic → D4', () => {
    expect(abstractGroup([0,1,3,4,6,7,9,10] as PitchClass[])).toBe('D4');
  });
  it('diatonic → Z2 (identity + one inversion)', () => {
    expect(abstractGroup([0,2,4,5,7,9,11] as PitchClass[])).toBe('Z2');
  });
  it('harmonic minor → C1 (no symmetry)', () => {
    expect(abstractGroup([0,2,3,5,7,8,11] as PitchClass[])).toBe('C1');
  });
  it('augmented triad → D3', () => {
    expect(abstractGroup([0,4,8] as PitchClass[])).toBe('D3');
  });
  it('single pitch → D12', () => {
    expect(abstractGroup([0] as PitchClass[])).toBe('D12');
  });
  it('major triad → C1 (no self-symmetry)', () => {
    expect(abstractGroup([0,4,7] as PitchClass[])).toBe('C1');
  });
});

describe('stabilizerOrder', () => {
  it('chromatic = 24', () => {
    expect(stabilizerOrder([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe(24);
  });
  it('whole-tone = 12', () => {
    expect(stabilizerOrder([0,2,4,6,8,10] as PitchClass[])).toBe(12);
  });
  it('diatonic = 2', () => {
    expect(stabilizerOrder([0,2,4,5,7,9,11] as PitchClass[])).toBe(2);
  });
  it('harmonic minor = 1', () => {
    expect(stabilizerOrder([0,2,3,5,7,8,11] as PitchClass[])).toBe(1);
  });
});
