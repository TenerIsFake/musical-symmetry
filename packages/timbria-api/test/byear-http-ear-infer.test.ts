import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpEarInfer } from '../src/byear/http-ear-infer.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('HttpEarInfer', () => {
  it('POSTs base64 pcm + domain and parses the heads', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      const body = JSON.parse(init.body);
      expect(url).toBe('http://win:9009/infer');
      expect(body.domain).toBe('isolated');
      expect(typeof body.pcm_base64).toBe('string');
      return { ok: true, status: 200, json: async () => ({
        instruments: [{ label: 'Electric guitar', confidence: 0.8 }],
        effects: [{ label: 'Reverb', confidence: 0.9 }],
        mood: [{ label: 'dreamy', confidence: 0.6 }],
      }) } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpEarInfer('http://win:9009');
    const r = await client.infer(Buffer.from([1, 2, 3, 4]), 'isolated');
    expect(r.effects[0].label).toBe('Reverb');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) } as any)));
    await expect(new HttpEarInfer('http://win:9009').infer(Buffer.from([0]), 'mix')).rejects.toThrow();
  });
});
