import { describe, it, expect } from 'vitest';
import { mullikenLabel } from '../src/mulliken';
import type { PitchClass } from '../src/types';

describe('mullikenLabel', () => {
  it('chromatic → A1g', () => {
    expect(mullikenLabel([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe('A1g');
  });
  it('whole-tone → A1g', () => {
    expect(mullikenLabel([0,2,4,6,8,10] as PitchClass[])).toBe('A1g');
  });
  it('octatonic → A1u (NOT palindromic: intervals [1,2,1,2,1,2,1,2] ≠ reversed)', () => {
    expect(mullikenLabel([0,1,3,4,6,7,9,10] as PitchClass[])).toBe('A1u');
  });
  it('diatonic → B1u', () => {
    expect(mullikenLabel([0,2,4,5,7,9,11] as PitchClass[])).toBe('B1u');
  });
  it('harmonic minor → B2u', () => {
    expect(mullikenLabel([0,2,3,5,7,8,11] as PitchClass[])).toBe('B2u');
  });
  it('pentatonic → B1u', () => {
    expect(mullikenLabel([0,2,4,7,9] as PitchClass[])).toBe('B1u');
  });
  it('augmented triad → B1g (T6 gives [2,6,10]≠[0,4,8]; palindromic intervals [4,4,4])', () => {
    expect(mullikenLabel([0,4,8] as PitchClass[])).toBe('B1g');
  });
  it('diminished 7th → A1g (intervals [3,3,3,3] palindromic)', () => {
    expect(mullikenLabel([0,3,6,9] as PitchClass[])).toBe('A1g');
  });
});
