import { describe, it, expect, vi } from 'vitest';
import { ResilientEarInfer } from '../src/byear/resilient-ear-infer.js';
import type { EarInfer } from '../src/byear/ear-infer.js';
import type { EarResult } from '../src/byear/types.js';

const R = (tag: string): EarResult => ({ instruments: [{ label: tag, confidence: 1 }], effects: [], mood: [] });
const ok = (tag: string): EarInfer => ({ infer: vi.fn(async () => R(tag)) });
const fail = (): EarInfer => ({ infer: vi.fn(async () => { throw new Error('down'); }) });

describe('ResilientEarInfer', () => {
  it('returns primary when healthy (fallback untouched)', async () => {
    const fb = ok('fb');
    const r = new ResilientEarInfer(ok('primary'), fb, { cooldownMs: 1000, now: () => 0 });
    expect((await r.infer(Buffer.from([1]), 'isolated')).instruments[0].label).toBe('primary');
    expect(fb.infer).not.toHaveBeenCalled();
  });

  it('falls back and opens the breaker on primary failure', async () => {
    let t = 0;
    const primary = fail();
    const r = new ResilientEarInfer(primary, ok('fb'), { cooldownMs: 1000, now: () => t });
    expect((await r.infer(Buffer.from([1]), 'isolated')).instruments[0].label).toBe('fb');
    t = 500;
    expect((await r.infer(Buffer.from([1]), 'isolated')).instruments[0].label).toBe('fb');
    expect(primary.infer).toHaveBeenCalledOnce();
  });

  it('retries primary after cooldown expires', async () => {
    let t = 0;
    const primary = fail();
    const r = new ResilientEarInfer(primary, ok('fb'), { cooldownMs: 1000, now: () => t });
    await r.infer(Buffer.from([1]), 'isolated');
    t = 1001;
    await r.infer(Buffer.from([1]), 'isolated');
    expect(primary.infer).toHaveBeenCalledTimes(2);
  });
});
