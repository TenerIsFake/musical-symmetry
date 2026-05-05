import { describe, it, expect } from 'vitest';
import { generateAtlasEntries, type AtlasEntry } from '../src/atlas/data.js';

describe('Atlas data', () => {
  let entries: AtlasEntry[];

  it('generates all set classes', () => {
    entries = generateAtlasEntries();
    expect(entries.length).toBeGreaterThan(200);
    expect(entries.length).toBeLessThanOrEqual(352);
  });

  it('each entry has required fields', () => {
    for (const e of entries.slice(0, 10)) {
      expect(e.forteNumber).toMatch(/^\d+-\d+/);
      expect(e.primeForm).toBeInstanceOf(Array);
      expect(e.primeForm.length).toBeGreaterThanOrEqual(2);
      expect(e.group).toBeTruthy();
      expect(e.intervalVector).toHaveLength(6);
    }
  });

  it('includes well-known entries', () => {
    const majorTriad = entries.find(e => e.forteNumber === '3-11');
    expect(majorTriad).toBeDefined();
    expect(majorTriad!.group).toBe('C1');
  });
});
