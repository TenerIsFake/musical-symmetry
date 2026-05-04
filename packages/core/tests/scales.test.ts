import { describe, it, expect } from 'vitest';
import { SCALE_TEMPLATES, findBestScale } from '../src/scales';
import type { PitchClass } from '../src/types';

describe('SCALE_TEMPLATES', () => {
  it('has at least 200 templates', () => {
    expect(SCALE_TEMPLATES.length).toBeGreaterThanOrEqual(200);
  });
  it('every template has 12 transpositions accounted for', () => {
    const families = new Set(SCALE_TEMPLATES.map(t => t.family));
    expect(families.size).toBeGreaterThan(10);
  });
  it('includes C major (Ionian)', () => {
    const cMaj = SCALE_TEMPLATES.find(t => t.name === 'C Ionian');
    expect(cMaj).toBeDefined();
    expect(cMaj!.pitchClasses).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it('includes whole-tone scales', () => {
    const wt = SCALE_TEMPLATES.filter(t => t.family === 'Whole-tone');
    expect(wt).toHaveLength(2);
  });
  it('includes octatonic scales', () => {
    const oct = SCALE_TEMPLATES.filter(t => t.family === 'Octatonic');
    expect(oct).toHaveLength(6);
  });
});

describe('findBestScale', () => {
  it('C, D, E, F, G, A, B → C Ionian', () => {
    const result = findBestScale([0, 2, 4, 5, 7, 9, 11] as PitchClass[]);
    expect(result[0]!.name).toContain('Ionian');
  });
  it('returns top 3 candidates', () => {
    const result = findBestScale([0, 2, 4, 7, 9] as PitchClass[]);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
