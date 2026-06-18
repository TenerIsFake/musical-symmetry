# Timbria ear-infer — Full Multi-Head Model Training (v1)

**Date:** 2026-06-18
**Status:** Design approved (brainstorming) — pending spec review, then implementation plan
**Owner:** Tener Jenkins (SRV-2)
**Related:** `services/ear-infer/training/README.md` (runbook), `2026-06-17-timbria-identify-by-ear-design.md` (sub-project A/B), memory `project_timbria_ear_infer_coral` (serving path, now live on the Coral)

---

## 1. Goal

Produce a **real, trained** multi-head `ear-infer` model that replaces the deterministic
PoC stub, so Timbria's "Identify by Ear" feature returns genuine predictions for the three
heads: **instrument (19)**, **effects (22)**, **mood (8)**. Train both runbook variants:
`isolated` (shipped) and `mix` (overlapping-source tolerant). Deliver an int8, Edge-TPU-compiled
`*_edgetpu.tflite` deployed to the live Windows-native Coral serving path.

## 2. Context & hard constraints

- **Timbria is personal / research, non-commercial** (decided 2026-06-18; `NOTICE.md` in both
  timbria packages). This permits training on **non-commercial (NC)** datasets. **Guardrail:** if
  Timbria is ever monetized, the model must be retrained on commercially-licensed data first.
- **The Coral Edge TPU is inference-only** — it cannot train (no backprop). Training happens on a
  GPU elsewhere; the TPU only runs the compiled int8 model.
- **SRV-2 has no training GPU** (Intel HD 520 only). Training runs on a **rented cloud GPU**.
- **Model input SR is a fixed contract at 16 kHz** / 128-mel / 64-frame log-mels, matching
  `infer.py::pcm_to_logmel` and the existing serving path. Training and serving SR must match;
  16 kHz is also deliberate for Edge-TPU op-coverage and latency. Raising it is out of scope here.
- **Head widths must stay in lockstep** with `labels.py` / `infer.py`: instrument=19, effects=22,
  mood=8 (`model.HEADS` insertion order = instrument, effects, mood).

## 3. Datasets → heads

Research/personal use ⇒ NC licenses are acceptable.

| Head | Dataset(s) | License | Access | Notes |
|------|-----------|---------|--------|-------|
| instrument | **NSynth** | CC BY 4.0 | open (magenta / HF mirror) | per-note isolated instrument samples; natively 16 kHz |
| instrument | **MedleyDB** v1+v2 stems | CC BY-NC | **Zenodo, human-approved request** | isolated instrument-labeled stems; loader = `marl/medleydb` (tools/metadata only — audio is separate) |
| effects | **synth.py** (pedalboard chains over dry clips) | n/a (synthetic) | local | dry source = NSynth / IDMT-SMT DI; emits exact multi-hot effect labels |
| effects (dry src) | **IDMT-SMT-Guitar/Bass** | CC BY-NC-ND | Zenodo (account) | clean DI; optional — NSynth notes also serve as dry input |
| mood | **MTG-Jamendo** mood/theme subset | mixed, largely NC | open (GitHub downloader) | `download.py --dataset autotagging_moodtheme --type audio`; map tags → MOOD vocab |
| mix variant | **MUSDB18** | CC BY-NC-SA | Zenodo (account) | full mixtures; `.mp4` NI-stems (44.1 kHz AAC) or HQ `.wav` (~30 GB) |

**Only MedleyDB requires a written access request** (message drafted, sent separately). All others
are open or plain Zenodo-account downloads.

## 4. Sample-rate & storage policy

- **Store the corpus at native sample rate** on `T:\ml\timbria-ear\` (5.7 TB free) — preserves
  hi-res masters so a future higher-SR model needs no re-download.
- **Precompute a 16 kHz / mono / int16 working set** (and/or cached log-mels) for fast training,
  via the same transform as serving (`logmel_from_pcm` ≡ `infer.py::pcm_to_logmel`).
- MUSDB18 tracks: native = 44.1 kHz (AAC stems or HQ wav); resample down to 16 kHz like the rest.

**Corpus layout** (matches runbook `$EAR_CORPUS`):
```
T:\ml\timbria-ear\
  masters\           # native-SR archived sources (nsynth, medleydb, musdb18, jamendo_mood, idmt)
  corpus\            # 16 kHz int16 working set, runbook layout:
    nsynth\  medleydb\  synth\  mood\  musdb18\
```
Bind `dataset.iter_clips` (currently a documented stub) to this layout, yielding
`(pcm_bytes, source, {head: labels})` with the masking already implemented in `dataset._labels_for`.

## 5. Compute: Lambda Cloud

- Single **GPU instance** (RTX 4090 / A10 / A100-class — the CNN is small; any one suffices).
  Expect **a few hours** total for both variants; cost **a few dollars**.
- Workflow: provision instance → install `tensorflow[and-cuda]` + `requirements.txt` → transfer the
  16 kHz corpus → run training → pull artifacts back. A setup/bootstrap script will be provided.
- Datasets are downloaded **onto the Lambda box** where bandwidth is high; the 16 kHz working set is
  also mirrored to `T:` for reproducibility.

## 6. Pipeline (executes the existing runbook)

For each variant `V ∈ {isolated, mix}`:
1. **Synth corpus** — `synth.py` over dry clips → `corpus/synth/` with effect multi-hot labels.
2. **Train** — `train.py --model V --data $EAR_CORPUS --out ./out/ear-V --epochs 40 --n-mels 128 --frames 64`.
   Loss = summed `masked_bce` over the three heads (each clip supervises only its labeled heads).
3. **Quantize** — `quantize.py --saved-model ./out/ear-V --out ./out/ear-V.tflite --rep-data $EAR_CORPUS --rep-samples 200` (full int8 in/out).
4. **Compile** — `edgetpu_compiler ./out/ear-V.tflite` → `ear-V_edgetpu.tflite` (done on SRV-2; see §7).
5. **Eval ship-gate** — `eval.py --tflite ./out/ear-V_edgetpu.tflite --data $EAR_CORPUS` (held-out split).

**Ship thresholds (enforced; eval exits non-zero on FAIL):**

| head | macro-F1 gate |
|------|---------------|
| effects | ≥ 0.60 |
| instrument | ≥ 0.60 |
| mood | ≥ 0.40 (subjective; lower bar) |

Do **not** ship a model that fails its gate.

## 7. Bring-home, compile, deploy, wire

1. Pull `ear-V.tflite` (pre-compile) back to SRV-2.
2. **`edgetpu_compiler` on SRV-2/WSL** → `ear-V_edgetpu.tflite`. Read the op-mapping report; if too
   many ops fall back to CPU, simplify the backbone per `training/compile_edgetpu.md` (the PoC
   effects-only head mapped 100%, but the full multi-head backbone is untested).
3. Deploy: copy the chosen model to `C:\Users\Teners PC\Downloads\coral_poc\models\` and point the
   service at it via `EAR_INFER_MODEL` (the `_edgetpu.tflite` suffix selects the pycoral/TPU path).
4. **Wire the real inference branch** — replace `infer.py::Model.infer`'s stub (`sub-project B`
   placeholder) with: reshape log-mel → `(1, n_mels, frames, 1)`, pad/crop to `frames`
   (mirror `dataset._fix_frames`); int8-quantize input (mirror `eval._quant_input`); `interp.invoke()`;
   read the 3 output tensors, dequantize (mirror `eval._dequant`); decode each head's sigmoid vector
   into `[{label, confidence}]` via `INSTRUMENTS`/`EFFECTS`/`MOOD`. Output→head order = `model.HEADS`.
5. **Verify end-to-end on the real Coral**: `POST /api/identify/by-ear` → real predictions; confirm
   `/health` `{"ok":true,"model":true}` and timbria-api container reachability at `10.0.0.155:9009`.

## 8. Division of labor

- **User (account-gated):** send the MedleyDB Zenodo request; create the Lambda Cloud account + launch
  the GPU instance; run the single provided training command; (optionally) accept Zenodo downloads for
  IDMT-SMT / MUSDB18.
- **Claude/SRV-2 (everything else):** all download + resample + synth scripting; `dataset.iter_clips`
  binding; Lambda bootstrap script + training bundle; local `edgetpu_compiler`; deploy; `infer.py`
  real-inference wiring; end-to-end verification.

## 9. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| MedleyDB approval latency (human) | Start instrument head on **NSynth alone**; fold MedleyDB in when approved |
| Edge-TPU op-coverage for full multi-head backbone | Read compiler report; simplify backbone per `compile_edgetpu.md`; CPU-int8 fallback path already exists |
| Corpus size / transfer time to Lambda | Download datasets directly on the Lambda box; mirror only the 16 kHz working set to `T:` |
| Mood macro-F1 below 0.40 | Mood is subjective; if it fails, ship instrument+effects and leave mood head unsupervised/stub for v1.x |
| Cloud cost overrun | Single instance, fixed epochs (40), tear down immediately after artifact pull |

## 10. Success criteria

- Both `isolated` and `mix` models trained, quantized int8, Edge-TPU-compiled, and **passing their
  eval ship-gates** (or a documented, accepted partial: instrument+effects pass, mood deferred).
- `infer.py` returns **real** per-head predictions (no stub) over HTTP on the Coral.
- End-to-end `POST /api/identify/by-ear` returns real predictions via the live serving path.

## 11. Out of scope (future)

- Raising the model input SR above 16 kHz (would change the serving contract + recompile).
- Any commercialization of Timbria (would require retraining on clean/commercial data).
- On-device (Coral) training — impossible by design.
- Real-time / streaming inference; multi-clip aggregation.
