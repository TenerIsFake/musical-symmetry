import { describe, it, expect } from 'vitest';
import type { PitchClass } from '../src/types';

describe('types', () => {
  it('PitchClass values are 0-11', () => {
    const pc: PitchClass = 0;
    expect(pc).toBe(0);
    const pc2: PitchClass = 11;
    expect(pc2).toBe(11);
  });
});
