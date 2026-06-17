import { describe, it, expect } from 'vitest';
import { EFFECT_LABELS } from '../src/byear/vocab.js';
import { EFFECT_LABEL_TO_CATEGORY, mapEffectsToFxTypeIds } from '../src/byear/fx-mapper.js';

describe('fx-mapper', () => {
  it('maps EVERY effect label to at least one FxCategory (no orphans)', () => {
    for (const label of EFFECT_LABELS) {
      const cats = EFFECT_LABEL_TO_CATEGORY[label];
      expect(cats, `missing mapping for ${label}`).toBeTruthy();
      expect(cats.length).toBeGreaterThan(0);
    }
  });

  it('resolves detected effects to a deduped union of fx_type ids', () => {
    const resolver = (cat: string) =>
      ({ reverb: [1, 2], delay: [7], distortion: [9] } as Record<string, number[]>)[cat] ?? [];
    const ids = mapEffectsToFxTypeIds(
      [{ label: 'Reverb', confidence: 0.9 }, { label: 'Delay/echo', confidence: 0.8 }],
      resolver,
    );
    expect(ids.sort((a, b) => a - b)).toEqual([1, 2, 7]);
  });
});
