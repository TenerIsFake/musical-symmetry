import { describe, it, expect } from 'vitest';
import { classify, identifyChord, classifyTransition, findBestScale, analyzeModes, allFirstOrder } from '../src/index';
import type { PitchClass, Chord } from '../src/types';

describe('Framework validation criteria', () => {
  it('whole-tone → D6, A1g, 2 transpositions', () => {
    const r = classify([0,2,4,6,8,10] as PitchClass[]);
    expect(r.abstractGroup).toBe('D6');
    expect(r.mullikenLabel).toBe('A1g');
    expect(r.distinctTranspositions).toBe(2);
  });

  it('diatonic → Z2, B1u, 12 transpositions', () => {
    const r = classify([0,2,4,5,7,9,11] as PitchClass[]);
    expect(r.abstractGroup).toBe('Z2');
    expect(r.mullikenLabel).toBe('B1u');
    expect(r.distinctTranspositions).toBe(12);
  });

  it('harmonic minor → C1, B2u, 12 transpositions', () => {
    const r = classify([0,2,3,5,7,8,11] as PitchClass[]);
    expect(r.abstractGroup).toBe('C1');
    expect(r.mullikenLabel).toBe('B2u');
    expect(r.distinctTranspositions).toBe(12);
  });

  it('octatonic → D4, A1u, 3 transpositions', () => {
    const r = classify([0,1,3,4,6,7,9,10] as PitchClass[]);
    expect(r.abstractGroup).toBe('D4');
    expect(r.mullikenLabel).toBe('A1u');
    expect(r.distinctTranspositions).toBe(3);
  });

  it('PLR: C major → C minor via P, 2 common tones', () => {
    const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
    const suggestions = allFirstOrder(Cmaj);
    const p = suggestions.find(s => s.operator === 'P')!;
    expect(p.to.quality).toBe('minor');
    expect(p.commonTones).toHaveLength(2);
  });

  it('C major → F# major is "forbidden"', () => {
    const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
    const Fsmaj: Chord = { root: 6, quality: 'major', pitchClasses: [1, 6, 10] };
    const t = classifyTransition(Cmaj, Fsmaj);
    expect(t.order).toBe('forbidden');
  });

  it('diatonic has Myhill property', () => {
    const r = classify([0,2,4,5,7,9,11] as PitchClass[]);
    expect(r.myhillProperty).toBe(true);
  });

  it('diatonic is maximally even', () => {
    const r = classify([0,2,4,5,7,9,11] as PitchClass[]);
    expect(r.maximallyEven).toBe(true);
  });

  it('Dorian is the only palindromic diatonic mode', () => {
    const modes = analyzeModes([0,2,4,5,7,9,11] as PitchClass[]);
    const palindromes = modes.filter(m => m.isPalindrome);
    expect(palindromes).toHaveLength(1);
    expect(palindromes[0]!.name).toBe('Dorian');
  });

  it('classify returns all required fields', () => {
    const r = classify([0,4,7] as PitchClass[]);
    expect(r.pitchClasses).toEqual([0,4,7]);
    expect(r.transpositionalStabilizer).toBeDefined();
    expect(r.inversionalAxes).toBeDefined();
    expect(r.stabilizerOrder).toBeGreaterThan(0);
    expect(r.abstractGroup).toBeDefined();
    expect(r.distinctTranspositions).toBeGreaterThan(0);
    expect(r.intervalVector).toHaveLength(6);
    expect(typeof r.myhillProperty).toBe('boolean');
    expect(typeof r.maximallyEven).toBe('boolean');
    expect(r.mullikenLabel).toMatch(/^[AB][12][gu]$/);
    expect(typeof r.isRetrogradePalindrome).toBe('boolean');
    expect(r.characterTableEntry.E).toBe(1);
  });
});
