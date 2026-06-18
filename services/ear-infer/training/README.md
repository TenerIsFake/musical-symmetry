# timbria-ear training pipeline (offline)

Trains the multi-head ear model (instruments / effects / mood), quantizes it to
full-int8 TFLite, compiles it for the Coral Edge TPU, and gates shipping on
held-out metrics.

> **Nothing is trained in this repo.** Training needs a GPU and is multi-hour.
> The TF code here is syntax-validated and TF-guarded so CI passes without
> TensorFlow installed; the `test_model.py` tests **skip** when TF is absent.
> Run the steps below on an offline GPU box, then ship the resulting
> `*_edgetpu.tflite` back to the service host.

The three heads and their widths come from `labels.py`
(instrument = 19, effects = 22, mood = 8) and must stay in lockstep with
`../infer.py` / `../labels.py`.

---

## 0. Why two models

| variant            | corpus                                            | use |
|--------------------|---------------------------------------------------|-----|
| `--model isolated` | single-instrument / stem clips + synth effects    | the shipped model for the "isolated" domain |
| `--model mix`      | full mixtures (MUSDB18) + mood-tagged tracks      | tolerates overlapping sources |

Both share the architecture in `model.py`. They differ only in the corpus and
in which heads each clip supervises (see masking in `dataset.py`).

---

## 1. Fetch datasets

Create a corpus root and drop each dataset where shown. Paths are referenced by
the `--data` / `--rep-data` specs (`<root>/synth`, `<root>/mood`, etc.).

```bash
export EAR_CORPUS=/data/ear-corpus
mkdir -p "$EAR_CORPUS"/{nsynth,idmt,medleydb,musdb18,jamendo_mood,synth,mood}
```

| dataset | feeds | where it goes | notes |
|---------|-------|---------------|-------|
| **NSynth** (magenta) | instrument head | `$EAR_CORPUS/nsynth/` | per-note isolated instrument samples |
| **IDMT-SMT-Guitar / -Bass** | instrument + dry source for synth | `$EAR_CORPUS/idmt/` | clean DI guitar/bass; ideal dry input for `synth.py` |
| **MedleyDB** (v1/v2 stems) | instrument head | `$EAR_CORPUS/medleydb/` | isolated stems with instrument labels |
| **MUSDB18** | `mix` variant | `$EAR_CORPUS/musdb18/` | full mixtures for the mix model |
| **MTG-Jamendo mood/theme subset** | mood head | `$EAR_CORPUS/jamendo_mood/` | only the mood/theme tag split; map tags → `MOOD` vocab |

Download per each dataset's own license/instructions (NSynth + MUSDB18 via
their official mirrors; IDMT-SMT and MedleyDB require registration; MTG-Jamendo
via its GitHub downloader, `--type` mood/theme).

All audio must be resampled to **16 kHz mono int16 PCM** to match
`logmel_from_pcm` (identical to `../infer.py::pcm_to_logmel`).

---

## 2. Environment

```bash
cd services/ear-infer/training
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

**TensorFlow GPU.** `requirements.txt` pins plain `tensorflow` (CPU-capable).
For GPU training install a CUDA-matched build, e.g.:

```bash
./venv/bin/pip install 'tensorflow[and-cuda]'      # Linux + NVIDIA
./venv/bin/python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

`sklearn` (eval metrics) is also in `requirements.txt`. None of this is
installed in CI — the pipeline is offline-only.

---

## 3. Generate the synthetic effects corpus

`synth.py` applies `pedalboard` effect chains to dry clips and emits exact
effect multi-hot labels. Feed it the dry DI material (IDMT-SMT works well) and
write the wet clips + labels into `$EAR_CORPUS/synth/`.

```bash
# illustrative driver — adapt to your dry-clip loader
./venv/bin/python - <<'PY'
import numpy as np, soundfile as sf, glob, os
from synth import synth_clip, random_chain
SR = 16000
out = os.path.join(os.environ["EAR_CORPUS"], "synth")
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(0)
for i, path in enumerate(glob.glob(os.path.join(os.environ["EAR_CORPUS"], "idmt", "**", "*.wav"), recursive=True)):
    dry, sr = sf.read(path, dtype="float32")
    if dry.ndim > 1: dry = dry.mean(1)
    effects = random_chain(rng)
    wet, mh = synth_clip(dry, SR, effects, seed=i)
    sf.write(os.path.join(out, f"clip_{i:06d}.wav"), wet, SR)
    np.save(os.path.join(out, f"clip_{i:06d}.effects.npy"), mh)
PY
```

Then bind `dataset.iter_clips` to this layout (it is a documented stub): yield
`(pcm_bytes, "synth", {"instrument": <label>, "effects": <labels>})` for synth
clips and `(pcm_bytes, "real_mood", {"mood": <labels>})` for Jamendo clips. The
masking (effects+instrument supervised for synth; mood supervised for real)
is already implemented in `dataset._labels_for`.

---

## 4. Train

```bash
# isolated (shipped) model
./venv/bin/python train.py \
  --model isolated --data "$EAR_CORPUS" --out ./out/ear-isolated \
  --epochs 40 --n-mels 128 --frames 64

# mix model
./venv/bin/python train.py \
  --model mix --data "$EAR_CORPUS" --out ./out/ear-mix \
  --epochs 40 --n-mels 128 --frames 64
```

Loss = sum of `masked_bce` across the three heads, so each clip only trains the
heads its source labels. Output is a Keras SavedModel directory.

---

## 5. Quantize to int8 TFLite

```bash
./venv/bin/python quantize.py \
  --saved-model ./out/ear-isolated \
  --out ./out/ear-isolated.tflite \
  --rep-data "$EAR_CORPUS" --rep-samples 200
```

Full-int8 (int8 in / int8 out) — required for the Edge TPU. The representative
dataset is drawn through the same `logmel_from_pcm` transform as serving, so
activation ranges calibrate correctly.

---

## 6. Compile for the Edge TPU

See **[compile_edgetpu.md](compile_edgetpu.md)** for installing
`edgetpu_compiler` and reading the op-mapping report. Quick version:

```bash
edgetpu_compiler ./out/ear-isolated.tflite -o ./out/
# produces ./out/ear-isolated_edgetpu.tflite + a log of ops mapped to the TPU
```

If too many ops fall back to CPU, simplify the backbone (see that doc).

---

## 7. Eval ship gate

```bash
./venv/bin/python eval.py \
  --tflite ./out/ear-isolated_edgetpu.tflite \
  --data "$EAR_CORPUS"    # held-out split
```

Prints a per-head precision / recall / macro-F1 table and an overall
**PASS / FAIL**. Ship thresholds:

| head       | macro-F1 gate |
|------------|---------------|
| effects    | ≥ 0.60 |
| instrument | ≥ 0.60 |
| mood       | ≥ 0.40 (lower beta bar — mood is subjective) |

`eval.py` exits non-zero on FAIL, so it can gate CI/release. Do **not** ship a
model that fails.

> The `eval.py` interpreter path also runs on a plain (non-`_edgetpu`) `.tflite`
> on a dev box without a Coral, which is handy for sanity-checking the quantized
> model before compiling.

---

## 8. Deploy

1. Copy the compiled model beside the service:
   `cp ./out/ear-isolated_edgetpu.tflite ../models/`  (Windows host with Coral).
2. Point the service at it:
   ```powershell
   set EAR_INFER_MODEL=C:\path\to\models\ear-isolated_edgetpu.tflite
   ```
   The `_edgetpu.tflite` suffix tells `../infer.py` to load via `pycoral`
   (plain `.tflite` → `tflite-runtime`). Runtime install is covered in
   `../README.md`.
3. **Wire the real inference branch.** `../infer.py::Model.infer` currently
   computes `pcm_to_logmel` then returns the deterministic stub
   (`sub-project B` placeholder). Replace that branch to:
   - reshape the log-mel to `(1, n_mels, frames, 1)` and pad/crop to `frames`
     (mirror `dataset._fix_frames`);
   - int8-quantize the input using the interpreter's input quantization params
     (mirror `eval._quant_input`);
   - run `interp.invoke()`, read the three output tensors, dequantize
     (mirror `eval._dequant`), and decode each head's sigmoid vector into
     `[{label, confidence}]` using `INSTRUMENTS` / `EFFECTS` / `MOOD`.

   The output-tensor → head mapping follows `model.HEADS` insertion order
   (`instrument`, `effects`, `mood`).
