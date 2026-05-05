import { describe, it, expect } from 'vitest';

describe('useMicPitchDetect', () => {
  it('module exports useMicPitchDetect function', async () => {
    const mod = await import('../useMicPitchDetect');
    expect(mod.useMicPitchDetect).toBeDefined();
    expect(typeof mod.useMicPitchDetect).toBe('function');
  });
});
