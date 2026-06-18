import type { EarInfer, Domain } from './ear-infer.js';
import type { EarResult } from './types.js';

export interface ResilientOpts { cooldownMs?: number; now?: () => number; }

export class ResilientEarInfer implements EarInfer {
  private openUntil = 0;
  private cooldownMs: number;
  private now: () => number;

  constructor(private primary: EarInfer, private fallback: EarInfer, opts: ResilientOpts = {}) {
    this.cooldownMs = opts.cooldownMs ?? 30000;
    this.now = opts.now ?? Date.now;
  }

  async infer(pcm: Buffer, domain: Domain): Promise<EarResult> {
    if (this.now() < this.openUntil) return this.fallback.infer(pcm, domain);
    try {
      return await this.primary.infer(pcm, domain);
    } catch {
      this.openUntil = this.now() + this.cooldownMs;
      return this.fallback.infer(pcm, domain);
    }
  }
}
