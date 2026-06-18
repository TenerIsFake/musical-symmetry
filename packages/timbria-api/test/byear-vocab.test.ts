import { describe, it, expect } from 'vitest';
import { INSTRUMENT_LABELS, EFFECT_LABELS, MOOD_LABELS } from '../src/byear/vocab.js';

describe('byear vocab', () => {
  it('has the expected vocabulary sizes and no duplicates', () => {
    expect(EFFECT_LABELS.length).toBe(22);
    expect(INSTRUMENT_LABELS.length).toBe(19);
    expect(MOOD_LABELS.length).toBe(8);
    for (const v of [INSTRUMENT_LABELS, EFFECT_LABELS, MOOD_LABELS]) {
      expect(new Set(v).size).toBe(v.length);
    }
  });
});
