import { describe, it, expect } from 'vitest';
import { voiceLeadingDistance } from '../src/voice-leading';
import type { PitchClass } from '../src/types';

describe('voiceLeadingDistance', () => {
  it('identical sets → 0', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [0, 4, 7] as PitchClass[])).toBe(0);
  });
  it('C major → C minor = 1 (E→Eb)', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [0, 3, 7] as PitchClass[])).toBe(1);
  });
  it('C major → A minor = 2 (G→A)', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [0, 4, 9] as PitchClass[])).toBe(2);
  });
  it('is symmetric: vld(A,B) == vld(B,A)', () => {
    const a = [0, 4, 7] as PitchClass[];
    const b = [2, 6, 9] as PitchClass[];
    expect(voiceLeadingDistance(a, b)).toBe(voiceLeadingDistance(b, a));
  });
  it('C major → F# major (tritone) = 6', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [6, 10, 1] as PitchClass[])).toBe(6);
  });
});
