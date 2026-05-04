import { describe, it, expect } from 'vitest';
import { CHORD_TEMPLATES, identifyChord } from '../src/chords';
import type { PitchClass } from '../src/types';

describe('CHORD_TEMPLATES', () => {
  it('has triads and seventh chords', () => {
    expect(CHORD_TEMPLATES.length).toBeGreaterThan(40);
  });
});

describe('identifyChord', () => {
  it('{0, 4, 7} → C major', () => {
    const result = identifyChord([0, 4, 7] as PitchClass[]);
    expect(result).not.toBeNull();
    expect(result!.root).toBe(0);
    expect(result!.quality).toBe('major');
  });
  it('{0, 3, 7} → C minor', () => {
    const result = identifyChord([0, 3, 7] as PitchClass[]);
    expect(result!.root).toBe(0);
    expect(result!.quality).toBe('minor');
  });
  it('{0, 4, 7, 11} → Cmaj7', () => {
    const result = identifyChord([0, 4, 7, 11] as PitchClass[]);
    expect(result).not.toBeNull();
  });
  it('{0, 4, 8} → C augmented', () => {
    const result = identifyChord([0, 4, 8] as PitchClass[]);
    expect(result!.quality).toBe('augmented');
  });
  it('{0, 3, 6} → C diminished', () => {
    const result = identifyChord([0, 3, 6] as PitchClass[]);
    expect(result!.quality).toBe('diminished');
  });
});
