import { describe, it, expect } from 'vitest';
import { StubEarInfer } from '../src/byear/ear-infer.js';
import { EFFECT_LABELS, INSTRUMENT_LABELS, MOOD_LABELS } from '../src/byear/vocab.js';

describe('StubEarInfer', () => {
  it('is deterministic and emits only valid vocab labels with 0..1 confidence', async () => {
    const stub = new StubEarInfer();
    const pcm = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const a = await stub.infer(pcm, 'isolated');
    const b = await stub.infer(pcm, 'isolated');
    expect(a).toEqual(b);

    const all = [...a.instruments, ...a.effects, ...a.mood];
    expect(all.length).toBeGreaterThan(0);
    for (const l of a.instruments) expect(INSTRUMENT_LABELS).toContain(l.label as any);
    for (const l of a.effects) expect(EFFECT_LABELS).toContain(l.label as any);
    for (const l of a.mood) expect(MOOD_LABELS).toContain(l.label as any);
    for (const l of all) { expect(l.confidence).toBeGreaterThanOrEqual(0); expect(l.confidence).toBeLessThanOrEqual(1); }
  });
});
