import { describe, it, expect } from 'vitest';

describe('useAudio', () => {
  it('module exports useAudio function', async () => {
    const mod = await import('../useAudio');
    expect(mod.useAudio).toBeDefined();
    expect(typeof mod.useAudio).toBe('function');
  });
});
