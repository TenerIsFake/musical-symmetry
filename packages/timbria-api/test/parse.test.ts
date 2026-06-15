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
    expect(out[0].confidence).toBe('low'); // clamped from invalid 'super-high'
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

describe('parseLookup hardening', () => {
  it('keeps a valid claim whose gear id is 0', () => {
    const idx = new Map<string, number>([['zero box', 0]]);
    const raw = JSON.stringify({ gear: [{ gear: 'Zero Box', context: 'x', source_url: 'https://s', confidence: 'med' }] });
    const out = parseLookup(raw, idx);
    expect(out).toHaveLength(1);
    expect(out[0].gear_item_id).toBe(0);
  });
  it('drops a non-string gear value (array)', () => {
    const idx = new Map<string, number>([['emt 140', 1]]);
    const raw = JSON.stringify({ gear: [{ gear: ['EMT 140'], source_url: 'https://s', confidence: 'high' }] });
    expect(parseLookup(raw, idx)).toHaveLength(0);
  });
  it('accepts uppercase URL scheme', () => {
    const idx = new Map<string, number>([['emt 140', 1]]);
    const raw = JSON.stringify({ gear: [{ gear: 'EMT 140', source_url: 'HTTPS://S', confidence: 'high' }] });
    expect(parseLookup(raw, idx)).toHaveLength(1);
  });
  it('defaults absent/invalid confidence to low', () => {
    const idx = new Map<string, number>([['emt 140', 1]]);
    const raw = JSON.stringify({ gear: [{ gear: 'EMT 140', source_url: 'https://s' }] });
    expect(parseLookup(raw, idx)[0].confidence).toBe('low');
  });
});
