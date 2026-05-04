import { describe, it, expect } from 'vitest';
import { classifyTransition, findPLRPath } from '../src/transitions';
import type { Chord } from '../src/types';

const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
const Cmin: Chord = { root: 0, quality: 'minor', pitchClasses: [0, 3, 7] };
const Amin: Chord = { root: 9, quality: 'minor', pitchClasses: [0, 4, 9] };
const Emin: Chord = { root: 4, quality: 'minor', pitchClasses: [4, 7, 11] };
const Abmaj: Chord = { root: 8, quality: 'major', pitchClasses: [0, 4, 8] };
const Fsmaj: Chord = { root: 6, quality: 'major', pitchClasses: [1, 6, 10] };

describe('classifyTransition', () => {
  it('C major → C minor = 1st order (P)', () => {
    expect(classifyTransition(Cmaj, Cmin).order).toBe(1);
  });
  it('C major → A minor = 1st order (R)', () => {
    expect(classifyTransition(Cmaj, Amin).order).toBe(1);
  });
  it('C major → Ab major = 2nd order (PL)', () => {
    expect(classifyTransition(Cmaj, Abmaj).order).toBe(2);
  });
  it('C major → F# major = forbidden (>3 steps)', () => {
    expect(classifyTransition(Cmaj, Fsmaj).order).toBe('forbidden');
  });
  it('reports common tones', () => {
    const t = classifyTransition(Cmaj, Cmin);
    expect(t.commonTones.sort()).toEqual([0, 7]);
  });
});

describe('findPLRPath', () => {
  it('C major → C minor = P', () => {
    expect(findPLRPath(Cmaj, Cmin)).toBe('P');
  });
  it('C major → E minor = L', () => {
    expect(findPLRPath(Cmaj, Emin)).toBe('L');
  });
  it('C major → A minor = R', () => {
    expect(findPLRPath(Cmaj, Amin)).toBe('R');
  });
  it('C major → Ab major = 2 steps', () => {
    const path = findPLRPath(Cmaj, Abmaj);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
  });
  it('returns null for distant chords beyond maxDepth', () => {
    const result = findPLRPath(Cmaj, Fsmaj, 3);
    expect(result).toBeNull();
  });
});
