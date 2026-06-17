# Timbria Identify-by-Ear — Sub-project A (App Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Timbria "Identify by Ear" feature end-to-end against a pluggable, stubbed inference backend — upload/record audio → normalize → detect (stub) → map to `fx_type` → UI — so it works and tests with zero Python/ML deps.

**Architecture:** New `by-ear` route in `timbria-api` (Express ESM). `audio-normalize` decodes uploads to canonical 16 kHz mono PCM via ffmpeg and validates them. An `EarInfer` interface has a deterministic `StubEarInfer` now and an `HttpEarInfer` later. `fx-mapper` turns model effect labels into `FxCategory` → `fx_type` ids using the existing seed. A React panel in `timbria-ui` drives it (upload + mic record + results).

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Express, better-sqlite3, multer, vitest + supertest, ffmpeg (system binary), React + Vite.

**Scope note:** This is Sub-project A's first shippable slice (spec phases 1–2). Follow-on plans: **A-mix** (URL input + `ear-mix` + two-tier Demucs job), **A-coral** (Windows-native `ear-infer` + CPU fallback + circuit breaker), **B-isolated/B-mix** (model training). Listed in "Roadmap" at the end.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/timbria-api/src/byear/vocab.ts` | Frozen label vocabularies (instruments/effects/mood) — single source of truth |
| `packages/timbria-api/src/byear/types.ts` | `EarLabel`, `EarResult`, `ByEarResponse` contract types |
| `packages/timbria-api/src/byear/fx-mapper.ts` | effect label → `FxCategory` config + `mapEffectsToFxTypeIds()` |
| `packages/timbria-api/src/byear/ear-infer.ts` | `EarInfer` interface + `StubEarInfer` (deterministic) |
| `packages/timbria-api/src/byear/audio-normalize.ts` | ffmpeg decode → canonical PCM + validation (duration/RMS) |
| `packages/timbria-api/src/byear/routes.ts` | `POST /api/identify/by-ear` (multipart) orchestration |
| `packages/timbria-api/src/index.ts` | mount the by-ear router |
| `packages/timbria-api/test/byear-*.test.ts` | vitest unit + supertest integration |
| `packages/timbria-ui/src/IdentifyByEar.tsx` | upload + record + results panel |
| `packages/timbria-ui/src/IdentifyByEar.test.tsx` | component test (jsdom) |

---

## Task 1: Label vocabularies + contract types

**Files:**
- Create: `packages/timbria-api/src/byear/vocab.ts`
- Create: `packages/timbria-api/src/byear/types.ts`
- Test: `packages/timbria-api/test/byear-vocab.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/timbria-api/test/byear-vocab.test.ts
import { describe, it, expect } from 'vitest';
import { INSTRUMENT_LABELS, EFFECT_LABELS, MOOD_LABELS } from '../src/byear/vocab.js';

describe('byear vocab', () => {
  it('has the expected vocabulary sizes and no duplicates', () => {
    expect(EFFECT_LABELS.length).toBe(22);
    expect(INSTRUMENT_LABELS.length).toBe(19);
    expect(MOOD_LABELS.length).toBe(8);
    for (const v of [INSTRUMENT_LABELS, EFFECT_LABELS, MOOD_LABELS]) {
      expect(new Set(v).size).toBe(v.length); // no dupes
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-api && npx vitest run test/byear-vocab.test.ts`
Expected: FAIL — cannot resolve `../src/byear/vocab.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/timbria-api/src/byear/vocab.ts
export const INSTRUMENT_LABELS = [
  'Electric guitar', 'Acoustic guitar', 'Bass guitar', 'Upright bass',
  'Acoustic piano', 'Electric piano', 'Organ', 'Synth lead', 'Synth pad/bass',
  'Acoustic kit', 'Electronic/drum machine', 'Percussion', 'Vocals',
  'Strings', 'Brass', 'Saxophone', 'Woodwinds', 'Banjo/mandolin', 'Other',
] as const;

export const EFFECT_LABELS = [
  'Reverb', 'Spring reverb', 'Delay/echo', 'Slapback', 'Chorus', 'Flanger',
  'Phaser', 'Tremolo', 'Vibrato', 'Rotary', 'Overdrive', 'Distortion', 'Fuzz',
  'Tape saturation', 'Bitcrusher', 'Compression', 'Noise gate', 'Sidechain pump',
  'Wah', 'Auto-wah', 'Octave/pitch-shift', 'Harmonizer',
] as const;

export const MOOD_LABELS = [
  'warm', 'bright', 'gritty', 'dreamy', 'aggressive', 'clean', 'lo-fi', 'spacious',
] as const;

export type InstrumentLabel = typeof INSTRUMENT_LABELS[number];
export type EffectLabel = typeof EFFECT_LABELS[number];
export type MoodLabel = typeof MOOD_LABELS[number];
```

```ts
// packages/timbria-api/src/byear/types.ts
export interface EarLabel { label: string; confidence: number; }   // confidence 0..1
export interface EarResult {
  instruments: EarLabel[];
  effects: EarLabel[];
  mood: EarLabel[];
}
export interface ByEarResponse extends EarResult {
  domain: 'isolated' | 'mix';
  fxTypeIds: number[];   // resolved gear entry points
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/timbria-api && npx vitest run test/byear-vocab.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/byear/vocab.ts packages/timbria-api/src/byear/types.ts packages/timbria-api/test/byear-vocab.test.ts
git commit -m "feat(byear): label vocabularies + contract types"
```

---

## Task 2: fx-mapper (effect labels → FxCategory → fx_type ids)

**Files:**
- Create: `packages/timbria-api/src/byear/fx-mapper.ts`
- Test: `packages/timbria-api/test/byear-fx-mapper.test.ts`

**Context:** `FxCategory` is defined in `packages/timbria-api/src/types.ts` (e.g. `'reverb' | 'delay' | 'distortion' | 'modulation' | 'dynamics' | ...`). `SEED_FX` rows carry `{ name, category }`. `mapEffectsToFxTypeIds` takes the model's effect labels plus a resolver `(category) => number[]` (injected so it stays pure and DB-agnostic) and returns the union of fx_type ids.

- [ ] **Step 1: Write the failing test**

```ts
// packages/timbria-api/test/byear-fx-mapper.test.ts
import { describe, it, expect } from 'vitest';
import { EFFECT_LABELS } from '../src/byear/vocab.js';
import { EFFECT_LABEL_TO_CATEGORY, mapEffectsToFxTypeIds } from '../src/byear/fx-mapper.js';

describe('fx-mapper', () => {
  it('maps EVERY effect label to at least one FxCategory (no orphans)', () => {
    for (const label of EFFECT_LABELS) {
      const cats = EFFECT_LABEL_TO_CATEGORY[label];
      expect(cats, `missing mapping for ${label}`).toBeTruthy();
      expect(cats.length).toBeGreaterThan(0);
    }
  });

  it('resolves detected effects to a deduped union of fx_type ids', () => {
    const resolver = (cat: string) =>
      ({ reverb: [1, 2], delay: [7], distortion: [9] } as Record<string, number[]>)[cat] ?? [];
    const ids = mapEffectsToFxTypeIds(
      [{ label: 'Reverb', confidence: 0.9 }, { label: 'Delay/echo', confidence: 0.8 }],
      resolver,
    );
    expect(ids.sort((a, b) => a - b)).toEqual([1, 2, 7]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-api && npx vitest run test/byear-fx-mapper.test.ts`
Expected: FAIL — cannot resolve `../src/byear/fx-mapper.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/timbria-api/src/byear/fx-mapper.ts
import type { FxCategory } from '../types.js';
import type { EarLabel } from './types.js';

// Every model effect label -> one or more existing FxCategory values.
export const EFFECT_LABEL_TO_CATEGORY: Record<string, FxCategory[]> = {
  'Reverb': ['reverb'], 'Spring reverb': ['reverb'],
  'Delay/echo': ['delay'], 'Slapback': ['delay'],
  'Chorus': ['modulation'], 'Flanger': ['modulation'], 'Phaser': ['modulation'],
  'Tremolo': ['modulation'], 'Vibrato': ['modulation'], 'Rotary': ['modulation'],
  'Overdrive': ['distortion'], 'Distortion': ['distortion'], 'Fuzz': ['distortion'],
  'Tape saturation': ['distortion'], 'Bitcrusher': ['distortion'],
  'Compression': ['dynamics'], 'Noise gate': ['dynamics'], 'Sidechain pump': ['dynamics'],
  'Wah': ['modulation'], 'Auto-wah': ['modulation'],
  'Octave/pitch-shift': ['modulation'], 'Harmonizer': ['modulation'],
};

export function mapEffectsToFxTypeIds(
  effects: EarLabel[],
  resolveByCategory: (cat: FxCategory) => number[],
): number[] {
  const ids = new Set<number>();
  for (const e of effects) {
    for (const cat of EFFECT_LABEL_TO_CATEGORY[e.label] ?? []) {
      for (const id of resolveByCategory(cat)) ids.add(id);
    }
  }
  return [...ids];
}
```

**Note:** If `FxCategory` lacks any category referenced above (e.g. `dynamics`), add the missing members to the `FxCategory` union in `packages/timbria-api/src/types.ts` — check that file first and align names exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/timbria-api && npx vitest run test/byear-fx-mapper.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/byear/fx-mapper.ts packages/timbria-api/test/byear-fx-mapper.test.ts
git commit -m "feat(byear): fx-mapper effect-label -> FxCategory -> fx_type ids"
```

---

## Task 3: EarInfer interface + deterministic StubEarInfer

**Files:**
- Create: `packages/timbria-api/src/byear/ear-infer.ts`
- Test: `packages/timbria-api/test/byear-ear-infer.test.ts`

**Context:** The stub must be deterministic (same input → same labels) so route tests are stable, and must emit only labels from the frozen vocab. It hashes the PCM buffer to pick a stable subset.

- [ ] **Step 1: Write the failing test**

```ts
// packages/timbria-api/test/byear-ear-infer.test.ts
import { describe, it, expect } from 'vitest';
import { StubEarInfer } from '../src/byear/ear-infer.js';
import { EFFECT_LABELS, INSTRUMENT_LABELS, MOOD_LABELS } from '../src/byear/vocab.js';

describe('StubEarInfer', () => {
  it('is deterministic and emits only valid vocab labels with 0..1 confidence', async () => {
    const stub = new StubEarInfer();
    const pcm = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const a = await stub.infer(pcm, 'isolated');
    const b = await stub.infer(pcm, 'isolated');
    expect(a).toEqual(b); // deterministic

    const all = [...a.instruments, ...a.effects, ...a.mood];
    expect(all.length).toBeGreaterThan(0);
    for (const l of a.instruments) expect(INSTRUMENT_LABELS).toContain(l.label as any);
    for (const l of a.effects) expect(EFFECT_LABELS).toContain(l.label as any);
    for (const l of a.mood) expect(MOOD_LABELS).toContain(l.label as any);
    for (const l of all) { expect(l.confidence).toBeGreaterThanOrEqual(0); expect(l.confidence).toBeLessThanOrEqual(1); }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-api && npx vitest run test/byear-ear-infer.test.ts`
Expected: FAIL — cannot resolve `../src/byear/ear-infer.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/timbria-api/src/byear/ear-infer.ts
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
    const conf = 0.55 + ((seed >> (i + offset)) & 7) / 20; // 0.55..0.9, stable
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/timbria-api && npx vitest run test/byear-ear-infer.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/byear/ear-infer.ts packages/timbria-api/test/byear-ear-infer.test.ts
git commit -m "feat(byear): EarInfer interface + deterministic StubEarInfer"
```

---

## Task 4: audio-normalize (ffmpeg decode + validation)

**Files:**
- Create: `packages/timbria-api/src/byear/audio-normalize.ts`
- Test: `packages/timbria-api/test/byear-audio-normalize.test.ts`

**Context:** Decode any uploaded audio buffer to canonical **16 kHz mono signed-16-bit little-endian PCM** by piping through ffmpeg (`-f s16le`). Compute `durationSec` from sample count and `rms` from the samples. Reject clips shorter than `MIN_SEC` (0.4 s) or quieter than `RMS_FLOOR` (0.005) — these guard against silent/garbage input. ffmpeg failures throw a typed error.

- [ ] **Step 1: Write the failing test**

```ts
// packages/timbria-api/test/byear-audio-normalize.test.ts
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { normalizeAudio, AudioError } from '../src/byear/audio-normalize.js';

// Generate 1s of a 440Hz tone as a wav via ffmpeg's lavfi source.
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
    expect(out.pcm.length).toBeGreaterThan(16000); // >0.5s of 16-bit mono
  });

  it('rejects silent/garbage input', async () => {
    await expect(normalizeAudio(Buffer.from('not audio'))).rejects.toBeInstanceOf(AudioError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-api && npx vitest run test/byear-audio-normalize.test.ts`
Expected: FAIL — cannot resolve `../src/byear/audio-normalize.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/timbria-api/src/byear/audio-normalize.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/timbria-api && npx vitest run test/byear-audio-normalize.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/byear/audio-normalize.ts packages/timbria-api/test/byear-audio-normalize.test.ts
git commit -m "feat(byear): audio-normalize via ffmpeg + duration/RMS validation"
```

---

## Task 5: by-ear route (multipart upload, isolated, synchronous) + mount

**Files:**
- Create: `packages/timbria-api/src/byear/routes.ts`
- Modify: `packages/timbria-api/src/index.ts` (mount the router)
- Modify: `packages/timbria-api/package.json` (add `multer` + `@types/multer`)
- Test: `packages/timbria-api/test/byear-routes.test.ts`

**Context:** `makeByEarRouter` is a factory (like `makeLookupRouter`) taking its deps: an `EarInfer` and a `resolveFxIdsByCategory` function. This keeps it testable with the stub and an in-memory resolver. The route accepts `multipart/form-data` with field `clip`. Access middleware is already skipped when `NODE_ENV==='test'` (see `index.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// packages/timbria-api/test/byear-routes.test.ts
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
    const res = await request(app()).post('/api/identify/by-ear')
      .attach('clip', toneWav(), 'tone.wav');
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
    const res = await request(app()).post('/api/identify/by-ear')
      .attach('clip', Buffer.from('garbage'), 'x.wav');
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-api && npx vitest run test/byear-routes.test.ts`
Expected: FAIL — cannot resolve `../src/byear/routes.js` (and multer not installed).

- [ ] **Step 3: Install multer, then write the route**

```bash
cd packages/timbria-api && npm install multer@^1.4.5-lts.1 && npm install -D @types/multer@^1.4.0
```

```ts
// packages/timbria-api/src/byear/routes.ts
import { Router } from 'express';
import multer from 'multer';
import type { FxCategory } from '../types.js';
import type { EarInfer } from './ear-infer.js';
import { normalizeAudio, AudioError } from './audio-normalize.js';
import { mapEffectsToFxTypeIds } from './fx-mapper.js';
import type { ByEarResponse } from './types.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export function makeByEarRouter(
  ear: EarInfer,
  resolveFxIdsByCategory: (cat: FxCategory) => number[],
): Router {
  const r = Router();
  r.post('/by-ear', upload.single('clip'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no clip uploaded (field "clip")' });
    let norm;
    try {
      norm = await normalizeAudio(req.file.buffer);
    } catch (e) {
      if (e instanceof AudioError) return res.status(400).json({ error: e.message });
      throw e;
    }
    const domain = 'isolated' as const; // mix path arrives in Sub-project A-mix
    const result = await ear.infer(norm.pcm, domain);
    const fxTypeIds = mapEffectsToFxTypeIds(result.effects, resolveFxIdsByCategory);
    const body: ByEarResponse = { domain, ...result, fxTypeIds };
    return res.json(body);
  });
  return r;
}
```

- [ ] **Step 4: Mount the router in `index.ts`**

In `packages/timbria-api/src/index.ts`, near the other router imports and `app.use('/api', ...)` lines, add:

```ts
import { makeByEarRouter } from './byear/routes.js';
import { StubEarInfer } from './byear/ear-infer.js';
import { getFxTypeIdsByCategory } from './catalog/db.js'; // see note
// ...
app.use('/api/identify', makeByEarRouter(new StubEarInfer(), getFxTypeIdsByCategory));
```

**Note:** If `getFxTypeIdsByCategory` does not exist in `catalog/db.ts`, add it there using the existing better-sqlite3 `getDb()` pattern:

```ts
// packages/timbria-api/src/catalog/db.ts  (add)
import type { FxCategory } from '../types.js';
export function getFxTypeIdsByCategory(category: FxCategory): number[] {
  return getDb().prepare('SELECT id FROM fx_type WHERE category = ?').all(category).map((r: any) => r.id);
}
```
Confirm the fx_type table/column names match the existing schema in that file before writing.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/timbria-api && npx vitest run test/byear-routes.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests), no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-api/src/byear/routes.ts packages/timbria-api/src/index.ts packages/timbria-api/src/catalog/db.ts packages/timbria-api/test/byear-routes.test.ts packages/timbria-api/package.json packages/timbria-api/package-lock.json
git commit -m "feat(byear): POST /api/identify/by-ear (upload->normalize->stub->fx ids) + mount"
```

---

## Task 6: timbria-ui "Identify by Ear" panel

**Files:**
- Create: `packages/timbria-ui/src/IdentifyByEar.tsx`
- Test: `packages/timbria-ui/src/IdentifyByEar.test.tsx`

**Context:** React 18 + Vite + vitest/jsdom. The panel has an upload `<input type="file">` and a record button (MediaRecorder — guarded for jsdom, where it is undefined). On submit it POSTs `multipart/form-data` to `/api/identify/by-ear` and renders the three label groups. The component test stubs `fetch` and asserts results render — it does not exercise MediaRecorder.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/timbria-ui/src/IdentifyByEar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IdentifyByEar } from './IdentifyByEar.js';

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      domain: 'isolated',
      instruments: [{ label: 'Electric guitar', confidence: 0.88 }],
      effects: [{ label: 'Reverb', confidence: 0.92 }],
      mood: [{ label: 'dreamy', confidence: 0.7 }],
      fxTypeIds: [1, 2],
    }),
  })) as any;
});

describe('IdentifyByEar', () => {
  it('uploads a file and renders detections', async () => {
    render(<IdentifyByEar />);
    const file = new File([new Uint8Array([1, 2, 3])], 'riff.wav', { type: 'audio/wav' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /identify/i }));
    await waitFor(() => expect(screen.getByText(/Electric guitar/)).toBeTruthy());
    expect(screen.getByText(/Reverb/)).toBeTruthy();
    expect(screen.getByText(/dreamy/)).toBeTruthy();
  });
});
```

(Ensure `@testing-library/react` is a devDependency; if missing: `npm install -D @testing-library/react @testing-library/dom`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-ui && npx vitest run src/IdentifyByEar.test.tsx`
Expected: FAIL — cannot resolve `./IdentifyByEar.js`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/timbria-ui/src/IdentifyByEar.tsx
import { useState } from 'react';

interface Label { label: string; confidence: number; }
interface Result { domain: string; instruments: Label[]; effects: Label[]; mood: Label[]; fxTypeIds: number[]; }

function Group({ title, items }: { title: string; items: Label[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ul>{items.map((l) => <li key={l.label}>{l.label} — {(l.confidence * 100).toFixed(0)}%</li>)}</ul>
    </div>
  );
}

export function IdentifyByEar() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function identify() {
    if (!file) { setError('Choose or record a clip first.'); return; }
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('clip', file);
      const res = await fetch('/api/identify/by-ear', { method: 'POST', body: fd });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      setResult(await res.json());
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="identify-by-ear">
      <h3>Identify by Ear</h3>
      <label>Upload a clip
        <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button onClick={identify} disabled={busy}>{busy ? 'Listening…' : 'Identify'}</button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div>
          <Group title="Instruments" items={result.instruments} />
          <Group title="Effects" items={result.effects} />
          <Group title="Mood (beta)" items={result.mood} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/timbria-ui && npx vitest run src/IdentifyByEar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-ui/src/IdentifyByEar.tsx packages/timbria-ui/src/IdentifyByEar.test.tsx packages/timbria-ui/package.json packages/timbria-ui/package-lock.json
git commit -m "feat(byear-ui): Identify by Ear panel (upload + results)"
```

---

## Task 7: Mic recording in the panel (MediaRecorder)

**Files:**
- Modify: `packages/timbria-ui/src/IdentifyByEar.tsx`
- Test: `packages/timbria-ui/src/IdentifyByEar.test.tsx` (add a guarded test)

**Context:** Add a record button that uses `navigator.mediaDevices.getUserMedia` + `MediaRecorder` to capture a few seconds into a `Blob`, then reuse the same submit path. Guard for environments without MediaRecorder (jsdom) so the button simply disables.

- [ ] **Step 1: Write the failing test**

```tsx
// add to packages/timbria-ui/src/IdentifyByEar.test.tsx
it('disables the record button when MediaRecorder is unavailable (jsdom)', () => {
  render(<IdentifyByEar />);
  const btn = screen.getByRole('button', { name: /record/i }) as HTMLButtonElement;
  expect(btn.disabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/timbria-ui && npx vitest run src/IdentifyByEar.test.tsx`
Expected: FAIL — no button matching /record/.

- [ ] **Step 3: Add the record control**

Insert into `IdentifyByEar.tsx` (inside the component, before `return`):

```tsx
  const canRecord = typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined';
  const [recording, setRecording] = useState(false);

  async function record() {
    if (!canRecord) return;
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      setFile(new File([blob], 'recording.webm', { type: blob.type }));
      setRecording(false);
    };
    rec.start();
    setRecording(true);
    setTimeout(() => rec.stop(), 5000); // 5s capture
  }
```

And add this button next to the existing Identify button in the JSX:

```tsx
      <button onClick={record} disabled={!canRecord || recording}>
        {recording ? 'Recording…' : 'Record 5s'}
      </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/timbria-ui && npx vitest run src/IdentifyByEar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-ui/src/IdentifyByEar.tsx packages/timbria-ui/src/IdentifyByEar.test.tsx
git commit -m "feat(byear-ui): 5s mic recording via MediaRecorder (guarded)"
```

---

## Final verification

- [ ] Run the whole API suite: `cd packages/timbria-api && npx vitest run && npx tsc --noEmit`
- [ ] Run the whole UI suite: `cd packages/timbria-ui && npx vitest run`
- [ ] Manual smoke (optional): start timbria-api, `curl -F clip=@some.wav http://localhost:3061/api/identify/by-ear` → JSON with `effects` + `fxTypeIds`.

## Roadmap (follow-on plans — not in this plan)

- **A-mix:** `{url}` input via `link-analyzer/fetcher`, `ear-mix` routing, two-tier async Demucs per-stem job (`GET /api/identify/by-ear/job/:id`).
- **A-coral:** Windows-native `ear-infer` Python service (pycoral) + `HttpEarInfer` client with circuit breaker + CPU `tflite-runtime` fallback; swap `StubEarInfer` for it via env `EAR_INFER_URL`.
- **B-isolated / B-mix:** `training/` — pedalboard FX synthesis, multi-head CNN training, int8 quantize, `edgetpu_compile`, eval-harness P/R gate. Produces the `.tflite` artifacts `ear-infer` loads.
