import { describe, it, expect } from 'vitest';
import { runLookup } from '../src/lookup/lookup.js';

describe('runLookup', () => {
  const gearIndex = new Map<string, number>([['ua 1176', 2]]);
  it('pipes search→llm→parse and returns drafts', async () => {
    const drafts = await runLookup('Some Artist', gearIndex, {
      webSearch: async () => 'web text mentioning an 1176',
      llm: async () => JSON.stringify({ gear: [{ gear: 'UA 1176', context: 'vocals', source_url: 'https://i', confidence: 'high' }] }),
      timeoutMs: 1000,
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].gear_item_id).toBe(2);
  });
  it('returns [] when llm throws', async () => {
    const drafts = await runLookup('X', gearIndex, {
      webSearch: async () => 'txt', llm: async () => { throw new Error('boom'); }, timeoutMs: 1000 });
    expect(drafts).toHaveLength(0);
  });
});
