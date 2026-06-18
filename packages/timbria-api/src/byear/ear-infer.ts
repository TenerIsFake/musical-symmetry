import { createHash } from 'node:crypto';
import { INSTRUMENT_LABELS, EFFECT_LABELS, MOOD_LABELS } from './vocab.js';
import type { EarResult, EarLabel } from './types.js';

export type Domain = 'isolated' | 'mix';

export interface EarInfer {
  infer(pcm: Buffer, domain: Domain): Promise<EarResult>;
}

function pickDeterministic(seed: number, labels: readonly string[], n: number, offset: number): EarLabel[] {
  const out: EarLabel[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (seed + i * 31 + offset) % labels.length;
    const conf = 0.55 + ((seed >> (i + offset)) & 7) / 20;
    out.push({ label: labels[idx], confidence: Math.round(conf * 100) / 100 });
  }
  return out;
}

/** Deterministic fake backend so the whole app path works before any real model exists. */
export class StubEarInfer implements EarInfer {
  async infer(pcm: Buffer, _domain: Domain): Promise<EarResult> {
    const h = createHash('sha256').update(pcm).digest();
    const seed = h.readUInt32BE(0);
    return {
      instruments: pickDeterministic(seed, INSTRUMENT_LABELS, 1, 0),
      effects: pickDeterministic(seed, EFFECT_LABELS, 2, 5),
      mood: pickDeterministic(seed, MOOD_LABELS, 2, 11),
    };
  }
}
