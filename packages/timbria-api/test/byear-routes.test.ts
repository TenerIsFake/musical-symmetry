import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { spawnSync } from 'node:child_process';
import { makeByEarRouter } from '../src/byear/routes.js';
import { StubEarInfer } from '../src/byear/ear-infer.js';

function toneWav(): Buffer {
  const r = spawnSync('ffmpeg', ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-ac', '1', '-ar', '16000', '-f', 'wav', 'pipe:1'], { maxBuffer: 1 << 24 });
  return r.stdout;
}
function app() {
  const a = express();
  a.use('/api/identify', makeByEarRouter(new StubEarInfer(), (cat) =>
    cat === 'reverb' ? [1, 2] : cat === 'delay' ? [7] : []));
  return a;
}
describe('POST /api/identify/by-ear', () => {
  it('returns detections + fxTypeIds for an uploaded clip', async () => {
    const res = await request(app()).post('/api/identify/by-ear').attach('clip', toneWav(), 'tone.wav');
    expect(res.status).toBe(200);
    expect(res.body.domain).toBe('isolated');
    expect(Array.isArray(res.body.effects)).toBe(true);
    expect(Array.isArray(res.body.fxTypeIds)).toBe(true);
  });
  it('400s when no clip is attached', async () => {
    const res = await request(app()).post('/api/identify/by-ear');
    expect(res.status).toBe(400);
  });
  it('400s on undecodable audio', async () => {
    const res = await request(app()).post('/api/identify/by-ear').attach('clip', Buffer.from('garbage'), 'x.wav');
    expect(res.status).toBe(400);
  });
});
