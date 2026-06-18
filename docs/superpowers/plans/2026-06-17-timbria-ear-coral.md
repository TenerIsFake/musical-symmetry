# Timbria A-coral — Remote ear-infer + Resilient Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let `timbria-api` reach a Windows-native Coral inference service over HTTP, with an automatic CPU/stub fallback and a circuit breaker, swappable by env — no usbip, no hard Coral dependency.

**Architecture:** A `HttpEarInfer` (implements the existing `EarInfer` contract) POSTs base64 PCM to a remote `ear-infer` service and parses the JSON heads back. A `ResilientEarInfer` wraps a primary + fallback `EarInfer`: on a primary failure it trips a breaker and routes to the fallback for a cooldown window. `index.ts` builds the backend from `EAR_INFER_URL` (set → `Resilient(Http, Stub)`, unset → `Stub`). Separately, a Python `ear-infer` FastAPI service runs the model (Edge TPU when present, CPU `tflite-runtime` otherwise, deterministic stub when no model file).

**Tech Stack:** TypeScript (ESM `.js` specifiers), vitest, Express; Python (FastAPI, numpy, tflite-runtime/pycoral) for the service.

**Builds on:** `packages/timbria-api/src/byear/ear-infer.ts` already exports `type Domain`, `interface EarInfer { infer(pcm:Buffer,domain:Domain):Promise<EarResult> }`, `class StubEarInfer`. `EarResult` is `{instruments,effects,mood: EarLabel[]}` from `byear/types.ts`.

---

## Task 1: HttpEarInfer (remote inference client)

**Files:**
- Create `packages/timbria-api/src/byear/http-ear-infer.ts`
- Test: `packages/timbria-api/test/byear-http-ear-infer.test.ts`

**Contract:** `POST {baseUrl}/infer` with JSON `{ pcm_base64: string, domain: 'isolated'|'mix' }`; response JSON `{ instruments:[{label,confidence}], effects:[...], mood:[...] }`. Uses `AbortController` for a timeout; throws on non-2xx or timeout.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/tener/musical-symmetry/packages/timbria-api && npx vitest run test/byear-http-ear-infer.test.ts`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement**

```ts
// packages/timbria-api/src/byear/http-ear-infer.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/byear-http-ear-infer.test.ts` → PASS (2). Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
cd /home/tener/musical-symmetry
git add packages/timbria-api/src/byear/http-ear-infer.ts packages/timbria-api/test/byear-http-ear-infer.test.ts
git commit -m "feat(byear): HttpEarInfer remote inference client"
```

---

## Task 2: ResilientEarInfer (circuit breaker + fallback)

**Files:**
- Create `packages/timbria-api/src/byear/resilient-ear-infer.ts`
- Test: `packages/timbria-api/test/byear-resilient-ear-infer.test.ts`

**Behavior:** wraps `primary` + `fallback`. While the breaker is open (`now() < openUntil`) it calls only `fallback`. Otherwise it tries `primary`; on success returns it; on throw it sets `openUntil = now() + cooldownMs` and returns `fallback`. A injectable `now()` makes it deterministic.

- [ ] **Step 1: Write the failing test**

```ts
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
    // breaker open: next call (within cooldown) must NOT hit primary again
    t = 500;
    expect((await r.infer(Buffer.from([1]), 'isolated')).instruments[0].label).toBe('fb');
    expect(primary.infer).toHaveBeenCalledOnce(); // only the first attempt
  });

  it('retries primary after cooldown expires', async () => {
    let t = 0;
    const primary = fail();
    const r = new ResilientEarInfer(primary, ok('fb'), { cooldownMs: 1000, now: () => t });
    await r.infer(Buffer.from([1]), 'isolated'); // opens breaker at t=0..1000
    t = 1001;
    await r.infer(Buffer.from([1]), 'isolated'); // cooldown passed -> tries primary again
    expect(primary.infer).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/byear-resilient-ear-infer.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/timbria-api/src/byear/resilient-ear-infer.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/byear-resilient-ear-infer.test.ts` → PASS (3). `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
cd /home/tener/musical-symmetry
git add packages/timbria-api/src/byear/resilient-ear-infer.ts packages/timbria-api/test/byear-resilient-ear-infer.test.ts
git commit -m "feat(byear): ResilientEarInfer circuit breaker + fallback"
```

---

## Task 3: Env-driven backend selection in index.ts

**Files:**
- Create `packages/timbria-api/src/byear/build-ear-infer.ts`
- Modify `packages/timbria-api/src/index.ts` (use the builder)
- Test: `packages/timbria-api/test/byear-build-ear-infer.test.ts`

**Behavior:** `buildEarInfer(env)` returns `StubEarInfer` when `EAR_INFER_URL` is unset; otherwise `ResilientEarInfer(new HttpEarInfer(url), new StubEarInfer())`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildEarInfer } from '../src/byear/build-ear-infer.js';
import { StubEarInfer } from '../src/byear/ear-infer.js';
import { ResilientEarInfer } from '../src/byear/resilient-ear-infer.js';

describe('buildEarInfer', () => {
  it('returns StubEarInfer when EAR_INFER_URL is unset', () => {
    expect(buildEarInfer({})).toBeInstanceOf(StubEarInfer);
  });
  it('returns ResilientEarInfer when EAR_INFER_URL is set', () => {
    expect(buildEarInfer({ EAR_INFER_URL: 'http://win:9009' })).toBeInstanceOf(ResilientEarInfer);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/byear-build-ear-infer.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/timbria-api/src/byear/build-ear-infer.ts
import type { EarInfer } from './ear-infer.js';
import { StubEarInfer } from './ear-infer.js';
import { HttpEarInfer } from './http-ear-infer.js';
import { ResilientEarInfer } from './resilient-ear-infer.js';

export function buildEarInfer(env: Record<string, string | undefined> = process.env): EarInfer {
  const url = env.EAR_INFER_URL;
  if (!url) return new StubEarInfer();
  return new ResilientEarInfer(new HttpEarInfer(url), new StubEarInfer());
}
```

In `index.ts`, replace the `new StubEarInfer()` argument to `makeByEarRouter(...)` with `buildEarInfer()`, and update the import to bring in `buildEarInfer` from `./byear/build-ear-infer.js` (you can drop the direct `StubEarInfer` import there if it becomes unused).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/byear-build-ear-infer.test.ts` → PASS (2). Then `npx vitest run` (full suite green) and `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
cd /home/tener/musical-symmetry
git add packages/timbria-api/src/byear/build-ear-infer.ts packages/timbria-api/src/index.ts packages/timbria-api/test/byear-build-ear-infer.test.ts
git commit -m "feat(byear): env-driven ear-infer backend selection"
```

---

## Task 4: Python ear-infer service (Edge TPU / CPU / stub)

**Files:**
- Create `services/ear-infer/app.py` (FastAPI), `services/ear-infer/infer.py` (model+mel), `services/ear-infer/requirements.txt`, `services/ear-infer/README.md` (runbook), `services/ear-infer/test_app.py`

**Behavior:** `POST /infer` accepts `{pcm_base64, domain}`, decodes to int16 PCM, computes a log-mel spectrogram (numpy), runs the model and returns the 3 heads. Model loading order: `EAR_INFER_MODEL` env points at an `_edgetpu.tflite` (load on Edge TPU via pycoral) or a plain `.tflite` (CPU via tflite-runtime); if unset/missing, use a **deterministic stub** (hash of pcm → labels from a vocab copy) so the service runs anywhere. The smoke test exercises the stub path (no model, no Coral needed).

- [ ] **Step 1: Write the failing test**

```python
# services/ear-infer/test_app.py
import base64
from fastapi.testclient import TestClient
from app import app

def test_infer_stub_returns_three_heads():
    c = TestClient(app)
    pcm = (b"\x01\x00" * 8000)  # 0.5s of 16k mono s16le
    r = c.post("/infer", json={"pcm_base64": base64.b64encode(pcm).decode(), "domain": "isolated"})
    assert r.status_code == 200
    body = r.json()
    for head in ("instruments", "effects", "mood"):
        assert head in body and isinstance(body[head], list)
    for item in body["effects"]:
        assert set(item) == {"label", "confidence"}
        assert 0.0 <= item["confidence"] <= 1.0
```

- [ ] **Step 2: Set up venv + deps, run to verify it fails**

```bash
cd /home/tener/musical-symmetry/services/ear-infer
python3 -m venv venv && ./venv/bin/pip install -q fastapi 'uvicorn[standard]' numpy httpx
./venv/bin/python -m pytest test_app.py -q   # FAILS: app.py missing
```

- [ ] **Step 3: Implement `infer.py` then `app.py`**

```python
# services/ear-infer/infer.py
import hashlib, os
import numpy as np

INSTRUMENTS = ["Electric guitar","Acoustic guitar","Bass guitar","Upright bass","Acoustic piano",
  "Electric piano","Organ","Synth lead","Synth pad/bass","Acoustic kit","Electronic/drum machine",
  "Percussion","Vocals","Strings","Brass","Saxophone","Woodwinds","Banjo/mandolin","Other"]
EFFECTS = ["Reverb","Spring reverb","Delay/echo","Slapback","Chorus","Flanger","Phaser","Tremolo",
  "Vibrato","Rotary","Overdrive","Distortion","Fuzz","Tape saturation","Bitcrusher","Compression",
  "Noise gate","Sidechain pump","Wah","Auto-wah","Octave/pitch-shift","Harmonizer"]
MOOD = ["warm","bright","gritty","dreamy","aggressive","clean","lo-fi","spacious"]

SR = 16000

def pcm_to_logmel(pcm: bytes, n_mels: int = 128) -> np.ndarray:
    x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    if x.size == 0:
        return np.zeros((n_mels, 1), dtype=np.float32)
    # lightweight magnitude spectrogram -> mel-ish pooling (no external DSP dep)
    n_fft = 1024
    hop = 256
    frames = max(1, 1 + (len(x) - n_fft) // hop) if len(x) >= n_fft else 1
    spec = np.zeros((n_fft // 2 + 1, frames), dtype=np.float32)
    win = np.hanning(n_fft).astype(np.float32)
    for i in range(frames):
        seg = x[i * hop : i * hop + n_fft]
        if len(seg) < n_fft:
            seg = np.pad(seg, (0, n_fft - len(seg)))
        spec[:, i] = np.abs(np.fft.rfft(seg * win))
    # pool the (n_fft/2+1) bins down to n_mels with simple averaging
    edges = np.linspace(0, spec.shape[0], n_mels + 1, dtype=int)
    mel = np.stack([spec[edges[i]:max(edges[i] + 1, edges[i + 1])].mean(0) for i in range(n_mels)])
    return np.log1p(mel).astype(np.float32)

def _stub_heads(pcm: bytes):
    seed = int.from_bytes(hashlib.sha256(pcm).digest()[:4], "big")
    def pick(labels, n, off):
        out = []
        for i in range(n):
            idx = (seed + i * 31 + off) % len(labels)
            conf = round(0.55 + ((seed >> (i + off)) & 7) / 20, 2)
            out.append({"label": labels[idx], "confidence": conf})
        return out
    return {"instruments": pick(INSTRUMENTS, 1, 0), "effects": pick(EFFECTS, 2, 5), "mood": pick(MOOD, 2, 11)}

class Model:
    """Loads an Edge-TPU or CPU tflite model if EAR_INFER_MODEL is set; else deterministic stub."""
    def __init__(self):
        self.interp = None
        path = os.environ.get("EAR_INFER_MODEL")
        if path and os.path.exists(path):
            try:
                if path.endswith("_edgetpu.tflite"):
                    from pycoral.utils.edgetpu import make_interpreter  # type: ignore
                    self.interp = make_interpreter(path)
                else:
                    from tflite_runtime.interpreter import Interpreter  # type: ignore
                    self.interp = Interpreter(model_path=path)
                self.interp.allocate_tensors()
            except Exception:
                self.interp = None  # fall back to stub if runtime/model unavailable

    def infer(self, pcm: bytes, domain: str):
        if self.interp is None:
            return _stub_heads(pcm)
        # Real model path: compute features, run, map output tensors to heads.
        # (Wired here once a trained model + its IO signature exist — see README.)
        _ = pcm_to_logmel(pcm)
        return _stub_heads(pcm)  # placeholder until trained model IO is finalized
```

```python
# services/ear-infer/app.py
import base64
from fastapi import FastAPI
from pydantic import BaseModel
from infer import Model

app = FastAPI(title="timbria-ear-infer")
_model = Model()

class InferReq(BaseModel):
    pcm_base64: str
    domain: str = "isolated"

@app.post("/infer")
def infer(req: InferReq):
    pcm = base64.b64decode(req.pcm_base64)
    return _model.infer(pcm, req.domain)

@app.get("/health")
def health():
    return {"ok": True, "model": _model.interp is not None}
```

`services/ear-infer/requirements.txt`:
```
fastapi
uvicorn[standard]
numpy
# Edge TPU (Windows host): pycoral ; CPU: tflite-runtime  — install per platform, see README
```

`services/ear-infer/README.md` — runbook covering: run on Windows with the Coral (`pip install pycoral`, `set EAR_INFER_MODEL=...\\ear-isolated_edgetpu.tflite`, `uvicorn app:app --host 0.0.0.0 --port 9009`), point `timbria-api` at it via `EAR_INFER_URL=http://<windows-ip>:9009`, and the CPU/stub modes.

- [ ] **Step 4: Run to verify it passes**

```bash
cd /home/tener/musical-symmetry/services/ear-infer && ./venv/bin/python -m pytest test_app.py -q
```
Expected: 1 passed (stub path).

- [ ] **Step 5: Commit**

```bash
cd /home/tener/musical-symmetry
git add services/ear-infer/app.py services/ear-infer/infer.py services/ear-infer/requirements.txt services/ear-infer/README.md services/ear-infer/test_app.py
git commit -m "feat(ear-infer): FastAPI inference service (Edge TPU / CPU / stub) + runbook"
```
(Do NOT commit `services/ear-infer/venv/` — add it to `.gitignore` if not already ignored.)

---

## Final verification
- [ ] `cd packages/timbria-api && npx vitest run && npx tsc --noEmit` (all green; the pre-existing unrelated `lookup-button.test.tsx` tsc error excluded)
- [ ] `cd services/ear-infer && ./venv/bin/python -m pytest -q`

## Roadmap (next)
- **B** (separate plan/runbook): training pipeline that produces the `_edgetpu.tflite` the service loads — `infer.py`'s `Model.infer` real path is finalized against that model's IO.
