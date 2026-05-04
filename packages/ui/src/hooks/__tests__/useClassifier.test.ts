import { describe, it, expect } from 'vitest';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

describe('classify integration', () => {
  it('classifies C major triad', () => {
    const result = classify([0, 4, 7] as PitchClass[]);
    expect(result.intervalVector).toEqual([0, 0, 1, 1, 1, 0]);
    expect(result.abstractGroup).toBeDefined();
  });

  it('classifies augmented triad as highly symmetric', () => {
    const result = classify([0, 4, 8] as PitchClass[]);
    expect(result.stabilizerOrder).toBeGreaterThan(1);
  });

  it('returns valid result for empty set', () => {
    const result = classify([] as PitchClass[]);
    expect(result).toBeDefined();
  });
});
