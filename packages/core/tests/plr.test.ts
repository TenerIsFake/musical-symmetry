import { describe, it, expect } from 'vitest';
import { applyP, applyL, applyR, applyCompound, allFirstOrder, allSecondOrder } from '../src/plr';
import type { Chord } from '../src/types';

const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
const Cmin: Chord = { root: 0, quality: 'minor', pitchClasses: [0, 3, 7] };
const Emin: Chord = { root: 4, quality: 'minor', pitchClasses: [4, 7, 11] };
const Amin: Chord = { root: 9, quality: 'minor', pitchClasses: [0, 4, 9] };

describe('P (Parallel)', () => {
  it('C major → C minor', () => {
    const result = applyP(Cmaj);
    expect(result.root).toBe(0);
    expect(result.quality).toBe('minor');
    expect(result.pitchClasses).toEqual([0, 3, 7]);
  });
  it('C minor → C major', () => {
    const result = applyP(Cmin);
    expect(result.root).toBe(0);
    expect(result.quality).toBe('major');
    expect(result.pitchClasses).toEqual([0, 4, 7]);
  });
  it('P is an involution (P² = identity)', () => {
    expect(applyP(applyP(Cmaj))).toEqual(Cmaj);
  });
});

describe('L (Leading-tone exchange)', () => {
  it('C major → E minor', () => {
    const result = applyL(Cmaj);
    expect(result.root).toBe(4);
    expect(result.quality).toBe('minor');
    expect(result.pitchClasses).toEqual([4, 7, 11]);
  });
  it('L is an involution', () => {
    expect(applyL(applyL(Cmaj))).toEqual(Cmaj);
  });
});

describe('R (Relative)', () => {
  it('C major → A minor', () => {
    const result = applyR(Cmaj);
    expect(result.root).toBe(9);
    expect(result.quality).toBe('minor');
    expect(result.pitchClasses).toEqual([0, 4, 9]);
  });
  it('R is an involution', () => {
    expect(applyR(applyR(Cmaj))).toEqual(Cmaj);
  });
});

describe('compound transformations', () => {
  it('PL: C major → Ab major', () => {
    const result = applyCompound(Cmaj, 'PL');
    expect(result.root).toBe(8);
    expect(result.quality).toBe('major');
  });
  it('PR: C major → Eb major', () => {
    const result = applyCompound(Cmaj, 'PR');
    expect(result.root).toBe(3);
    expect(result.quality).toBe('major');
  });
  it('LR: C major → sequence', () => {
    const result = applyCompound(Cmaj, 'LR');
    expect(result).toBeDefined();
  });
});

describe('allFirstOrder', () => {
  it('returns 3 suggestions from C major', () => {
    const results = allFirstOrder(Cmaj);
    expect(results).toHaveLength(3);
    expect(results.map(r => r.operator)).toEqual(['P', 'L', 'R']);
    results.forEach(r => {
      expect(r.commonTones).toHaveLength(2);
    });
  });
});

describe('allSecondOrder', () => {
  it('returns 6 suggestions from C major', () => {
    const results = allSecondOrder(Cmaj);
    expect(results).toHaveLength(6);
    results.forEach(r => {
      expect(r.operator.length).toBe(2);
    });
  });
});
