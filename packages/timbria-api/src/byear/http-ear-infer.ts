import type { EarInfer, Domain } from './ear-infer.js';
import type { EarResult } from './types.js';

export class HttpEarInfer implements EarInfer {
  constructor(private baseUrl: string, private timeoutMs = 5000) {}

  async infer(pcm: Buffer, domain: Domain): Promise<EarResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pcm_base64: pcm.toString('base64'), domain }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`ear-infer HTTP ${res.status}`);
      const j = (await res.json()) as EarResult;
      return { instruments: j.instruments ?? [], effects: j.effects ?? [], mood: j.mood ?? [] };
    } finally {
      clearTimeout(t);
    }
  }
}
