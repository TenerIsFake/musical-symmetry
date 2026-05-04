import { describe, it, expect } from 'vitest';
import { mod12, toPcSet, transpose, invert, normalize, complement, areEqual } from '../src/pcset';
import type { PitchClass } from '../src/types';

describe('mod12', () => {
  it('wraps positive values', () => { expect(mod12(13)).toBe(1); });
  it('wraps negative values', () => { expect(mod12(-1)).toBe(11); });
  it('preserves 0-11', () => { expect(mod12(7)).toBe(7); });
});

describe('toPcSet', () => {
  it('deduplicates and sorts', () => {
    expect(toPcSet([4, 0, 7, 4])).toEqual([0, 4, 7]);
  });
  it('normalizes mod 12', () => {
    expect(toPcSet([12, 14, 16])).toEqual([0, 2, 4]);
  });
});

describe('transpose', () => {
  it('transposes C major triad by 7 → G major triad', () => {
    expect(transpose([0, 4, 7], 7)).toEqual([2, 7, 11]);
  });
  it('wraps around mod 12', () => {
    expect(transpose([10, 11], 3)).toEqual([1, 2]);
  });
});

describe('invert', () => {
  it('inverts around axis 0', () => {
    expect(invert([0, 4, 7], 0)).toEqual([0, 5, 8]);
  });
  it('inverts C major around axis 11 → produces enharmonic diatonic set', () => {
    const cMajorScale = [0, 2, 4, 5, 7, 9, 11] as PitchClass[];
    // I_11: (11 - pc) mod 12 maps {0,2,4,5,7,9,11} → {0,2,4,6,7,9,11}
    expect(invert(cMajorScale, 11)).toEqual([0, 2, 4, 6, 7, 9, 11]);
  });
});

describe('normalize', () => {
  it('puts set in normal form (most compact, lowest)', () => {
    expect(normalize([0, 4, 7])).toEqual([0, 4, 7]);
  });
  it('rotates to find most compact form', () => {
    expect(normalize([8, 0, 4])).toEqual([0, 4, 8]);
  });
});

describe('complement', () => {
  it('returns pitch classes NOT in the set', () => {
    expect(complement([0, 2, 4, 5, 7, 9, 11])).toEqual([1, 3, 6, 8, 10]);
  });
});

describe('areEqual', () => {
  it('same content different order', () => {
    expect(areEqual([7, 0, 4], [0, 4, 7])).toBe(true);
  });
  it('different content', () => {
    expect(areEqual([0, 4, 7], [0, 3, 7])).toBe(false);
  });
});
