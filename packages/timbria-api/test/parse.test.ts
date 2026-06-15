import { describe, it, expect } from 'vitest';
import { parseLookup } from '../src/lookup/parse.js';

const gearIndex = new Map<string, number>([['emt 140', 1], ['ua 1176', 2]]);

describe('parseLookup', () => {
  it('keeps cited, mappable rows and clamps confidence', () => {
    const raw = JSON.stringify({ gear: [
      { gear: 'EMT 140', context: 'vocals', source_url: 'https://x', confidence: 'super-high' },
      { gear: 'UA 1176', context: 'drums', source_url: 'https://y', confidence: 'med' },
    ]});
    const out = parseLookup(raw, gearIndex);
    expect(out).toHaveLength(2);
    expect(out[0].confidence).toBe('high'); // clamped from invalid 'super-high'
    expect(out[1].gear_item_id).toBe(2);
  });
  it('drops rows with no source_url', () => {
    const raw = JSON.stringify({ gear: [{ gear: 'EMT 140', context: 'vox', confidence: 'high' }] });
    expect(parseLookup(raw, gearIndex)).toHaveLength(0);
  });
  it('drops rows whose gear is not in the catalog', () => {
    const raw = JSON.stringify({ gear: [{ gear: 'Unknown Box', source_url: 'https://x', confidence: 'high' }] });
    expect(parseLookup(raw, gearIndex)).toHaveLength(0);
  });
  it('returns [] on malformed JSON', () => {
    expect(parseLookup('not json', gearIndex)).toHaveLength(0);
  });
});
