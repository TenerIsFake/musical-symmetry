# Timbria "Identify by Ear" — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorming) → implementation
**Scope:** App feature (A) + custom model training pipeline (B), one spec.

## Goal

Give Timbria an actual ear: a user provides audio (upload, mic recording, or a URL),
and Timbria detects the **instruments**, **effects/FX**, and **mood/character** present,
then maps those onto the existing `fx_type` gear/settings experience. Today Timbria only
identifies gear by name/description (a decision tree + Gemini lookup); this adds listening.

## Non-goals

- Replacing the existing decision-tree / Gemini identify paths — by-ear is an *entry point*
  into the same gear/settings views, not a parallel system.
- Real-time/continuous audio analysis — requests are bursty and on-demand.
- Perfect mood detection — `mood` ships as a clearly-labeled beta head.

---

## Architecture

```
timbria-ui (:3017)  "Identify by Ear" panel: [upload] [● record] [paste URL]
   │  POST /api/identify/by-ear  (multipart clip | { url })
timbria-api (:3061, Node/TS, Express)
   │  ingest → audio-normalize (ffmpeg → mel-spectrogram) → route by domain
   │     • isolated (mic/stem)  → ear-isolated
   │     • full mix (url/song)  → ear-mix  (+ opt async Demucs → per-stem)
   │  → ear-infer (HTTP) → fx-mapper → { instruments, effects, mood, perStem? }
   ▼  HTTP JSON
ear-infer service  (spectrogram → { instrument[], effects[], mood[] })
   • Windows-native (pycoral, native USB Coral)      ← primary, no usbip
   • WSL CPU fallback (tflite-runtime)               ← if Coral down/busy
   • models: ear-isolated{,_edgetpu}.tflite · ear-mix{,_edgetpu}.tflite

── offline (Sub-project B) ──────────────────────────────────────────
training/: data-synth (pedalboard FX chains) + datasets → train multi-head
CNN → int8 quantize → tflite → edgetpu_compile → artifacts dropped into ear-infer
```

### Why these boundaries

- **`ear-infer` has a frozen JSON contract** (`spectrogram in → 3 label heads out`). This is
  what lets the Coral/CPU split, the two models, and future retrains happen without touching
  `timbria-api`. The app codes against the contract, not the model.
- **All ML is either offline (training) or behind one HTTP boundary (inference).** `timbria-api`
  stays pure Node/TS with no Python/ML deps.
- **Coral reached over HTTP, not usbip.** WSL2 has no native USB; usbipd is fragile. Running
  `ear-infer` Windows-native (where the Coral is natively attached) and calling it over HTTP
  removes usbip entirely and shares infra direction with CoralWatch. CPU fallback in WSL makes
  the Coral an *optional accelerator*, never a hard dependency.

### Units (each independently testable)

| Unit | Responsibility | Depends on |
|------|----------------|-----------|
| `audio-normalize` (TS) | clip/url/mic blob → canonical PCM window + log-mel spectrogram | ffmpeg |
| `ear-infer` (Python) | spectrogram → `{instrument[], effects[], mood[]}`; CPU + Coral backends | tflite-runtime / pycoral |
| `ear-infer` client (TS) | HTTP call + circuit breaker + CPU/Coral selection | ear-infer |
| `by-ear` route (TS) | orchestration: ingest, route isolated/mix, Demucs job, assemble response | the above |
| `fx-mapper` (TS) | model labels → `leaf_fx_type_ids`; mood → settings hints | identify DB |
| `training/` (Python) | data synthesis + train + quantize + compile + eval harness | datasets, pedalboard, TF, edgetpu_compiler |

---

## Models (Sub-project B)

**Shared architecture, trained twice** (`ear-isolated`, `ear-mix`):
- **Input:** fixed-size log-mel spectrogram (~128 mels × ~3 s window; static shape for Edge TPU).
- **Backbone:** compact EfficientNet-lite0 / MobileNetV2-style CNN, Edge-TPU-supported ops only
  (conv, depthwise, relu6, pooling, FC).
- **Heads (all multi-label sigmoid, so both models are architecturally identical):**
  - `instrument` (~19): Electric guitar, Acoustic guitar, Bass guitar, Upright bass, Acoustic
    piano, Electric piano (Rhodes/Wurli), Organ, Synth lead, Synth pad/bass, Acoustic kit,
    Electronic/drum machine, Percussion, Vocals, Strings, Brass, Saxophone, Woodwinds,
    Banjo/mandolin, Other/unknown.
  - `effects` (~22): Reverb, Spring reverb, Delay/echo, Slapback, Chorus, Flanger, Phaser,
    Tremolo, Vibrato, Rotary (Leslie), Overdrive, Distortion, Fuzz, Tape/analog saturation,
    Bitcrusher, Compression, Noise gate, Sidechain pump, Wah, Auto-wah/envelope filter,
    Octave/pitch-shift, Harmonizer.
  - `mood` (~8, beta): warm, bright, gritty, dreamy, aggressive, clean, lo-fi, spacious.

### Training data (synthesis is the key)

- **Effects labels are generated, not collected.** Dry stems (NSynth, IDMT-SMT-Guitar/Bass,
  MedleyDB stems) → apply 0–3 randomized effects via **`pedalboard`** → output auto-labeled with
  its exact effect multi-hot vector. Unlimited, perfectly labeled.
- **Instrument labels** come from the source dataset.
- **`ear-mix` data** = multitrack sets (MUSDB18, MedleyDB) → per-stem FX → **sum to a mix** →
  label = union of per-stem effects + instruments present. Auto-labeled realistic mixes.
- **`mood`** = MTG-Jamendo mood/theme subset (real tracks, human tags). Fuzziest head → beta.
- **Per-head loss masking:** a sample trains only the heads it has labels for (synth FX samples
  lack mood; MTG-Jamendo lacks clean FX labels). Each batch masks unsupervised heads.

### Quantize & compile

Post-training int8 (TFLite converter + representative set) → `.tflite` (CPU) →
`edgetpu_compiler` → `_edgetpu.tflite`. The compile step checks the op-mapping report so most
ops land on the TPU; if too many fall back to CPU, simplify the backbone.

---

## UX & mapping (Sub-project A)

Panel sits beside the existing decision-tree identify.

```
[ Upload ] [ ● Record 5s ] [ Paste URL ]
   → (full mix shows "separating stems…" only if user asks for per-stem)
   Results:
     Instruments: Electric guitar 0.88
     Effects:     ✓ Reverb 0.92  ✓ Delay 0.78  ✓ Overdrive 0.61   (each a button)
     Mood (beta): Dreamy 0.7 · Spacious 0.6
     [full mix] per-stem (on request): guitar → reverb,delay · vox → comp
   click an effect → existing Timbria gear/settings for that fx_type (+ "refine with Gemini")
```

- **`effects` → `fx_type_ids`:** the model's fixed effect vocabulary maps via a **static config
  table** (`fx-mapper`) to one or more Timbria `fx_type` ids. Clicking opens that fx_type's
  gear/settings, or jumps into the decision tree at the `id_node` leaf whose `leaf_fx_type_ids`
  match — manual and by-ear paths converge.
- **`instrument` → filter/context** (don't suggest a bass amp for a detected piano).
- **`mood` → settings bias** (pre-select mood-tagged presets / nudge parameters). Beta.
- **Human-in-the-loop:** results are candidates the user confirms (same ethos as Timbria's
  LLM-built library). Tapping the right effect sets the entry point.

### API

- `POST /api/identify/by-ear` — multipart audio **or** `{ url }`. Returns
  `{ domain, instruments[], effects[], mood[], fxTypeCandidates[], jobId? }`.
- `GET /api/identify/by-ear/job/:id` — poll the async Demucs per-stem job; returns
  `{ status, perStem? }` when done.

---

## Errors, latency, resilience

- **Coral/`ear-infer` down or busy** → automatic CPU fallback; client circuit breaker pins to
  CPU for a cooldown after a failed Windows ping.
- **Demucs fails/times out** → fall back to `ear-mix` on the whole mix (holistic, no per-stem).
- **URL fetch fails** → reuse `link-analyzer` safeguards; clear error.
- **Bad audio** (silent/short/corrupt) → validated post-ffmpeg (duration + RMS floor) → rejected.
- **All-low-confidence** → "try the guided questions," route into the existing decision tree.
- **Upload hygiene** → size cap, type allowlist, temp-file cleanup (carry the doc2audiobook lesson).

**Latency — two-tier full-mix path:** isolated clips are sub-second (synchronous). Demucs is
slow, so full-mix returns the fast `ear-mix` result *synchronously*; per-stem breakdown is an
opt-in **async job** the UI polls. Common case stays snappy.

---

## Testing

| Unit | Strategy |
|------|----------|
| `audio-normalize` | Golden: known wav → expected spectrogram shape/stats; decodes mp3/m4a/wav; rejects silent/short |
| `ear-infer` | Contract tests w/ a tiny fixture model: JSON shape; CPU & edgetpu agree within tolerance; both model files load |
| `ear-infer` client | Circuit-breaker behavior; CPU fallback on Windows-service failure (mocked) |
| `fx-mapper` | **Exhaustive** — every model label maps to a real `fx_type_id`, no orphans |
| `by-ear` route | Integration w/ stubbed `ear-infer`: isolated-vs-mix routing, Demucs-fail fallback, low-confidence fallback, URL error |
| `training/` (B) | Synth-label round-trip (applied FX == label), tiny convergence run, quantize+compile produces loadable artifacts, **eval harness = per-class P/R gate before a model ships** (mood at a lower beta bar) |

## Acceptance gates

- Per-class precision/recall thresholds on held-out validation before a model ships; `mood` beta.
- Edge-TPU compile: ≥ a target % of ops mapped to the TPU.
- A by-ear detection lands the user on a valid `fx_type` gear/settings view (the convergence goal).

---

## Implementation phasing (build order)

1. **A-contract:** `ear-infer` JSON contract + a **stub model** (deterministic fake labels) so the
   whole app path is buildable before any real model exists.
2. **A-app:** `audio-normalize`, `by-ear` route (isolated path, sync), `fx-mapper`, UI panel
   (upload + record). Ships against the stub/CPU backend.
3. **A-mix:** URL input (`link-analyzer`), `ear-mix` routing, two-tier Demucs async job.
4. **A-coral:** Windows-native `ear-infer` deploy + CPU fallback + circuit breaker.
5. **B-isolated:** synthesis + train + quantize + compile `ear-isolated`; eval gate; drop in.
6. **B-mix:** mix synthesis + train `ear-mix`; eval gate; drop in.

Phases 1–4 are app code (buildable now). Phases 5–6 are an offline training effort (large
datasets + GPU + the physical Coral) — code/runbook built now, models produced by running it.
