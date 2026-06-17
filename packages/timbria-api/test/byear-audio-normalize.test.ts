import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { normalizeAudio, AudioError } from '../src/byear/audio-normalize.js';

function toneWav(): Buffer {
  const r = spawnSync('ffmpeg', ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-ac', '1', '-ar', '16000', '-f', 'wav', 'pipe:1'], { maxBuffer: 1 << 24 });
  return r.stdout;
}

describe('normalizeAudio', () => {
  it('decodes a real tone to ~1s PCM with non-trivial RMS', async () => {
    const out = await normalizeAudio(toneWav());
    expect(out.durationSec).toBeGreaterThan(0.9);
    expect(out.durationSec).toBeLessThan(1.1);
    expect(out.rms).toBeGreaterThan(0.05);
    expect(out.pcm.length).toBeGreaterThan(16000);
  });

  it('rejects silent/garbage input', async () => {
    await expect(normalizeAudio(Buffer.from('not audio'))).rejects.toBeInstanceOf(AudioError);
  });
});
