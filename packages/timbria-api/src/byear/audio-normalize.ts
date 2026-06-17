import { spawn } from 'node:child_process';

export class AudioError extends Error {}

export interface NormalizedAudio { pcm: Buffer; durationSec: number; rms: number; }

const SAMPLE_RATE = 16000;
const MIN_SEC = 0.4;
const RMS_FLOOR = 0.005;

function ffmpegToPcm(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', 'pipe:0', '-ac', '1', '-ar', String(SAMPLE_RATE),
      '-f', 's16le', 'pipe:1'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.on('error', (e) => reject(new AudioError(`ffmpeg spawn failed: ${e.message}`)));
    ff.on('close', (code) => {
      const out = Buffer.concat(chunks);
      if (code !== 0 || out.length === 0) reject(new AudioError('could not decode audio'));
      else resolve(out);
    });
    ff.stdin.on('error', () => { /* EPIPE if ffmpeg rejects input early */ });
    ff.stdin.end(input);
  });
}

export async function normalizeAudio(input: Buffer): Promise<NormalizedAudio> {
  const pcm = await ffmpegToPcm(input);
  const n = Math.floor(pcm.length / 2);
  const durationSec = n / SAMPLE_RATE;
  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += (pcm.readInt16LE(i * 2) / 32768) ** 2;
  const rms = Math.sqrt(sumSq / Math.max(n, 1));
  if (durationSec < MIN_SEC) throw new AudioError(`clip too short (${durationSec.toFixed(2)}s)`);
  if (rms < RMS_FLOOR) throw new AudioError('clip is silent');
  return { pcm, durationSec, rms };
}
