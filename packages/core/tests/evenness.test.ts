import { describe, it, expect } from 'vitest';
import { isMaximallyEven } from '../src/evenness';
import type { PitchClass } from '../src/types';

describe('isMaximallyEven', () => {
  it('diatonic (7-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,2,4,5,7,9,11] as PitchClass[])).toBe(true);
  });
  it('pentatonic (5-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,2,4,7,9] as PitchClass[])).toBe(true);
  });
  it('whole-tone (6-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,2,4,6,8,10] as PitchClass[])).toBe(true);
  });
  it('chromatic (12-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe(true);
  });
  it('harmonic minor is NOT maximally even', () => {
    expect(isMaximallyEven([0,2,3,5,7,8,11] as PitchClass[])).toBe(false);
  });
  it('octatonic (8-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,1,3,4,6,7,9,10] as PitchClass[])).toBe(true);
  });
  it('augmented triad (3-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,4,8] as PitchClass[])).toBe(true);
  });
  it('major triad (3-of-12) is NOT maximally even', () => {
    expect(isMaximallyEven([0,4,7] as PitchClass[])).toBe(false);
  });
});
