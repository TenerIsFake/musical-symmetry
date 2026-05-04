import { describe, it, expect } from 'vitest';
import { intervalVector, myhillProperty, zRelated } from '../src/intervals';
import type { PitchClass } from '../src/types';

describe('intervalVector', () => {
  it('diatonic major: [2, 5, 4, 3, 6, 1]', () => {
    expect(intervalVector([0,2,4,5,7,9,11] as PitchClass[])).toEqual([2, 5, 4, 3, 6, 1]);
  });
  it('pentatonic: [0, 3, 2, 1, 4, 0]', () => {
    expect(intervalVector([0,2,4,7,9] as PitchClass[])).toEqual([0, 3, 2, 1, 4, 0]);
  });
  it('whole-tone: [0, 6, 0, 6, 0, 3]', () => {
    expect(intervalVector([0,2,4,6,8,10] as PitchClass[])).toEqual([0, 6, 0, 6, 0, 3]);
  });
  it('octatonic: [4, 4, 8, 4, 4, 4]', () => {
    expect(intervalVector([0,1,3,4,6,7,9,10] as PitchClass[])).toEqual([4, 4, 8, 4, 4, 4]);
  });
  it('C major triad: [0, 0, 1, 1, 1, 0]', () => {
    expect(intervalVector([0,4,7] as PitchClass[])).toEqual([0, 0, 1, 1, 1, 0]);
  });
  it('chromatic: [12, 12, 12, 12, 12, 6]', () => {
    expect(intervalVector([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toEqual([12, 12, 12, 12, 12, 6]);
  });
});

describe('myhillProperty', () => {
  it('diatonic has Myhill property', () => {
    expect(myhillProperty([0,2,4,5,7,9,11] as PitchClass[])).toBe(true);
  });
  it('pentatonic has Myhill property', () => {
    expect(myhillProperty([0,2,4,7,9] as PitchClass[])).toBe(true);
  });
  it('whole-tone does NOT have Myhill property', () => {
    expect(myhillProperty([0,2,4,6,8,10] as PitchClass[])).toBe(false);
  });
  it('octatonic does NOT have Myhill property', () => {
    expect(myhillProperty([0,1,3,4,6,7,9,10] as PitchClass[])).toBe(false);
  });
});

describe('zRelated', () => {
  it('returns true for Z-related pair {0,1,4,6} and {0,1,3,7}', () => {
    expect(zRelated([0,1,4,6] as PitchClass[], [0,1,3,7] as PitchClass[])).toBe(true);
  });
  it('returns false for non-Z-related sets', () => {
    expect(zRelated([0,4,7] as PitchClass[], [0,3,7] as PitchClass[])).toBe(false);
  });
});
