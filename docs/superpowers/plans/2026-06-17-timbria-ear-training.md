# Timbria B — ear-infer Model Training Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Build the pipeline that produces the `ear-isolated`/`ear-mix` `.tflite` (+ `_edgetpu.tflite`) models the `ear-infer` service loads — synthesis → multi-head CNN train → int8 quantize → Edge-TPU compile → per-class P/R eval gate.

**Honest scope:** The **synthesis engine + label vocab are fully implemented and tested here** (pedalboard is CPU-light). The **TensorFlow stages (model/dataset/train/quantize/eval) are runnable pipeline code with TF-guarded smoke tests**; the *actual* training needs ~tens of GB of datasets + a GPU + `edgetpu_compiler` and runs OFFLINE per the runbook. No trained model is produced in-session — that is expected.

**Architecture:** `synth.py` applies known pedalboard FX chains to dry audio → clips auto-labeled with their exact effect multi-hot vector. `dataset.py` mixes synthesis + real datasets into a `tf.data` pipeline with per-head label masking. `model.py` is a compact EfficientNet-lite-style CNN with 3 sigmoid heads (instrument/effects/mood). `train.py` runs the masked multi-task loss. `quantize.py` does int8 PTQ → `.tflite`. `eval.py` reports per-class precision/recall (the ship gate). `compile_edgetpu.md` covers `edgetpu_compiler`.

**Tech Stack:** Python 3.12, pedalboard, numpy, soundfile (synthesis); tensorflow, scikit-learn (training/eval). Lives in `services/ear-infer/training/`, its own venv.

**Label single-source-of-truth:** `services/ear-infer/infer.py` already defines `INSTRUMENTS`/`EFFECTS`/`MOOD`. The training `labels.py` mirrors them and a test asserts they match, so the three copies (TS `vocab.ts`, service `infer.py`, training `labels.py`) cannot silently drift.

---

## Task 1: labels.py + drift guard

**Files:** create `services/ear-infer/training/labels.py`, `services/ear-infer/training/test_labels.py`

- [ ] **Step 1: failing test** `services/ear-infer/training/test_labels.py`:
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # import the service's infer.py
from labels import INSTRUMENTS, EFFECTS, MOOD
import infer as service

def test_labels_match_service_vocab():
    assert INSTRUMENTS == service.INSTRUMENTS
    assert EFFECTS == service.EFFECTS
    assert MOOD == service.MOOD

def test_no_duplicate_labels():
    for v in (INSTRUMENTS, EFFECTS, MOOD):
        assert len(set(v)) == len(v)
```

- [ ] **Step 2: run** `cd /home/tener/musical-symmetry/services/ear-infer/training && python3 -m pytest test_labels.py -q` → FAIL (no labels.py). (Set up venv first — see Task 2 Step 2; for this task numpy isn't needed, only pytest.)

- [ ] **Step 3: implement** `labels.py` — copy the three lists from `services/ear-infer/infer.py` verbatim:
```python
INSTRUMENTS = ["Electric guitar","Acoustic guitar","Bass guitar","Upright bass","Acoustic piano",
  "Electric piano","Organ","Synth lead","Synth pad/bass","Acoustic kit","Electronic/drum machine",
  "Percussion","Vocals","Strings","Brass","Saxophone","Woodwinds","Banjo/mandolin","Other"]
EFFECTS = ["Reverb","Spring reverb","Delay/echo","Slapback","Chorus","Flanger","Phaser","Tremolo",
  "Vibrato","Rotary","Overdrive","Distortion","Fuzz","Tape saturation","Bitcrusher","Compression",
  "Noise gate","Sidechain pump","Wah","Auto-wah","Octave/pitch-shift","Harmonizer"]
MOOD = ["warm","bright","gritty","dreamy","aggressive","clean","lo-fi","spacious"]
```

- [ ] **Step 4: run** → 2 pass.
- [ ] **Step 5: commit**
```bash
cd /home/tener/musical-symmetry
git add services/ear-infer/training/labels.py services/ear-infer/training/test_labels.py
git commit -m "feat(ear-train): label vocab mirror + drift guard vs service"
```

---

## Task 2: synth.py — pedalboard FX-chain synthesis (the core, fully tested)

**Files:** create `services/ear-infer/training/synth.py`, `services/ear-infer/training/test_synth.py`, `services/ear-infer/training/requirements.txt`

**Behavior:** `synth_clip(dry: np.ndarray, sr, effects: list[str], seed) -> (np.ndarray, multihot)` applies the named effects (mapped to pedalboard plugins with randomized params) to a dry mono signal and returns the processed audio + the effect multi-hot vector (len == len(EFFECTS)). `random_chain(rng) -> list[str]` picks 0–3 effects. A `EFFECT_TO_PLUGIN` dict maps a subset of the EFFECTS vocab to concrete pedalboard plugins (the ones pedalboard supports directly: Reverb, Delay, Chorus, Phaser, Distortion, Compressor, etc.); unmapped effects are simply not generatable yet (documented).

- [ ] **Step 1: failing test** `services/ear-infer/training/test_synth.py`:
```python
import numpy as np
from synth import synth_clip, EFFECT_TO_PLUGIN, multihot
from labels import EFFECTS

SR = 16000
def dry_tone(sec=1.0):
    t = np.linspace(0, sec, int(SR*sec), endpoint=False)
    return (0.3*np.sin(2*np.pi*220*t)).astype(np.float32)

def test_multihot_marks_applied_effects():
    mh = multihot(["Reverb", "Delay/echo"])
    assert mh.shape == (len(EFFECTS),)
    assert mh[EFFECTS.index("Reverb")] == 1.0 and mh[EFFECTS.index("Delay/echo")] == 1.0
    assert mh.sum() == 2.0

def test_synth_applies_effect_and_changes_signal():
    dry = dry_tone()
    eff = "Reverb"
    if eff not in EFFECT_TO_PLUGIN:  # guard if mapping name differs
        eff = next(iter(EFFECT_TO_PLUGIN))
    wet, mh = synth_clip(dry, SR, [eff], seed=1)
    assert wet.shape[0] == dry.shape[0] or abs(wet.shape[0]-dry.shape[0]) < SR  # length ~preserved
    assert not np.allclose(wet[:len(dry)], dry, atol=1e-3)  # effect changed the audio
    assert mh[EFFECTS.index(eff)] == 1.0

def test_dry_clip_has_zero_multihot():
    dry = dry_tone()
    wet, mh = synth_clip(dry, SR, [], seed=2)
    assert mh.sum() == 0.0
```

- [ ] **Step 2: venv + deps, run to confirm FAIL**
```bash
cd /home/tener/musical-symmetry/services/ear-infer/training
python3 -m venv venv && ./venv/bin/pip install -q numpy pedalboard soundfile pytest
./venv/bin/python -m pytest test_synth.py -q   # FAIL: synth.py missing
```

- [ ] **Step 3: implement** `synth.py`:
```python
import numpy as np
from pedalboard import Pedalboard, Reverb, Delay, Chorus, Phaser, Distortion, Compressor, Gain
from labels import EFFECTS

# Map a subset of the EFFECTS vocab to concrete pedalboard plugins.
EFFECT_TO_PLUGIN = {
    "Reverb": lambda rng: Reverb(room_size=rng.uniform(0.3, 0.9), wet_level=rng.uniform(0.2, 0.6)),
    "Delay/echo": lambda rng: Delay(delay_seconds=rng.uniform(0.1, 0.5), feedback=rng.uniform(0.2, 0.6), mix=rng.uniform(0.2, 0.5)),
    "Chorus": lambda rng: Chorus(rate_hz=rng.uniform(0.5, 3.0), depth=rng.uniform(0.2, 0.6), mix=rng.uniform(0.3, 0.6)),
    "Phaser": lambda rng: Phaser(rate_hz=rng.uniform(0.5, 2.0), depth=rng.uniform(0.3, 0.8), mix=rng.uniform(0.3, 0.6)),
    "Distortion": lambda rng: Distortion(drive_db=rng.uniform(10, 35)),
    "Overdrive": lambda rng: Distortion(drive_db=rng.uniform(5, 20)),
    "Compression": lambda rng: Compressor(threshold_db=rng.uniform(-30, -10), ratio=rng.uniform(2, 8)),
}

def multihot(effects):
    mh = np.zeros(len(EFFECTS), dtype=np.float32)
    for e in effects:
        mh[EFFECTS.index(e)] = 1.0
    return mh

def random_chain(rng, max_n=3):
    pool = list(EFFECT_TO_PLUGIN.keys())
    n = rng.integers(0, max_n + 1)
    return list(rng.choice(pool, size=n, replace=False)) if n else []

def synth_clip(dry: np.ndarray, sr: int, effects, seed: int = 0):
    rng = np.random.default_rng(seed)
    board = Pedalboard([EFFECT_TO_PLUGIN[e](rng) for e in effects if e in EFFECT_TO_PLUGIN])
    wet = board(dry.astype(np.float32), sr) if len(board) else dry.astype(np.float32)
    return wet, multihot(effects)
```

- [ ] **Step 4: run** → 3 pass. Write `requirements.txt`:
```
numpy
pedalboard
soundfile
tensorflow      # training stages (CPU or GPU); heavy — see README
scikit-learn    # eval metrics
```

- [ ] **Step 5: commit**
```bash
cd /home/tener/musical-symmetry
git add services/ear-infer/training/synth.py services/ear-infer/training/test_synth.py services/ear-infer/training/requirements.txt
git status --porcelain   # confirm no venv staged
git commit -m "feat(ear-train): pedalboard FX-chain synthesis with auto-labels"
```
(Ensure `services/ear-infer/training/venv/` is gitignored — the root `.gitignore` already ignores `services/ear-infer/venv/`; add `services/ear-infer/training/venv/` too.)

---

## Task 3: TensorFlow pipeline (model/dataset/train/quantize/eval) + TF-guarded smoke test

**Files:** create `model.py`, `dataset.py`, `train.py`, `quantize.py`, `eval.py`, `test_model.py` under `services/ear-infer/training/`

**Behavior:** `build_model(n_mels, frames)` returns a Keras model: a small conv backbone → 3 sigmoid heads named `instrument`(19)/`effects`(22)/`mood`(8). `masked_bce(y_true, y_pred, mask)` applies binary cross-entropy only where a per-head mask is 1 (so samples missing a head don't train it). `train.py` wires `dataset.py` → `model` → masked losses. `quantize.py` does int8 PTQ with a representative-dataset generator → `.tflite`. `eval.py` computes per-class precision/recall (sklearn) and prints a pass/fail vs thresholds. The smoke test is **guarded**: it skips cleanly if TensorFlow isn't importable, else asserts the model's 3 output shapes and one masked-loss value.

- [ ] **Step 1: failing test** `services/ear-infer/training/test_model.py`:
```python
import importlib.util, numpy as np, pytest

tf_missing = importlib.util.find_spec("tensorflow") is None
pytestmark = pytest.mark.skipif(tf_missing, reason="tensorflow not installed in this env")

def test_model_has_three_heads_with_right_widths():
    from model import build_model
    m = build_model(n_mels=128, frames=64)
    out = {o.name.split('/')[0]: o.shape[-1] for o in m.outputs}
    # head widths
    import model as M
    assert m.output_names_widths() == {"instrument": 19, "effects": 22, "mood": 8}

def test_masked_bce_ignores_unsupervised_head():
    from model import masked_bce
    import numpy as np
    y_true = np.array([[1.0, 0.0]]); y_pred = np.array([[0.9, 0.1]])
    # mask all zeros -> loss contribution zero
    assert float(masked_bce(y_true, y_pred, mask=np.array([[0.0]]))) == 0.0
```

- [ ] **Step 2:** With TF NOT installed, run `./venv/bin/python -m pytest test_model.py -q` → tests SKIP (not fail). That is the accepted state in this environment. (If the engineer chooses to install TF — `./venv/bin/pip install tensorflow` — the tests must then PASS; install is optional here, required offline.)

- [ ] **Step 3: implement** the pipeline files. `model.py`:
```python
import tensorflow as tf
from labels import INSTRUMENTS, EFFECTS, MOOD

HEADS = {"instrument": len(INSTRUMENTS), "effects": len(EFFECTS), "mood": len(MOOD)}

def build_model(n_mels=128, frames=64):
    inp = tf.keras.Input(shape=(n_mels, frames, 1), name="logmel")
    x = inp
    for f in (16, 32, 64):
        x = tf.keras.layers.Conv2D(f, 3, padding="same", activation="relu")(x)
        x = tf.keras.layers.MaxPool2D()(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outs = [tf.keras.layers.Dense(w, activation="sigmoid", name=name)(x) for name, w in HEADS.items()]
    m = tf.keras.Model(inp, outs)
    m.output_names_widths = lambda: dict(HEADS)  # convenience for tests
    return m

def masked_bce(y_true, y_pred, mask):
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)  # per-sample
    mask = tf.reshape(tf.cast(mask, tf.float32), [-1])
    denom = tf.reduce_sum(mask) + 1e-8
    return tf.reduce_sum(bce * mask) / denom
```
`dataset.py` — a `tf.data.Dataset` builder that yields `(logmel, {head: labels}, {head: mask})`; for synthesized clips the effects+instrument masks are 1 and mood mask 0; for MTG-Jamendo mood clips the mood mask is 1 and others 0. Include a `logmel_from_pcm` matching the service's `pcm_to_logmel`. (Full code in the file; mirrors `services/ear-infer/infer.py::pcm_to_logmel`.)
`train.py` — argparse (epochs, data dirs, out path); builds dataset + model; custom train step applying `masked_bce` per head summed; saves a Keras model + the SavedModel dir.
`quantize.py` — loads the SavedModel, runs `tf.lite.TFLiteConverter` with `optimizations=[DEFAULT]` and a representative-dataset generator (yields real logmel samples) for full int8; writes `<name>.tflite`.
`eval.py` — loads a `.tflite`, runs the held-out set, computes per-class precision/recall with `sklearn.metrics`, prints a table and a PASS/FAIL vs thresholds (effects/instrument ≥ target; mood at a lower beta bar).

- [ ] **Step 4: run** `./venv/bin/python -m pytest -q` (whole training dir) — labels (2) + synth (3) PASS, model tests SKIP if TF absent. Confirm the suite is green (skips are not failures).

- [ ] **Step 5: commit**
```bash
cd /home/tener/musical-symmetry
git add services/ear-infer/training/model.py services/ear-infer/training/dataset.py services/ear-infer/training/train.py services/ear-infer/training/quantize.py services/ear-infer/training/eval.py services/ear-infer/training/test_model.py
git commit -m "feat(ear-train): multi-head CNN + masked-loss train/quantize/eval pipeline (TF-guarded)"
```

---

## Task 4: Runbook (README + edgetpu compile)

**Files:** create `services/ear-infer/training/README.md`, `services/ear-infer/training/compile_edgetpu.md`

- [ ] **Step 1:** Write `README.md` covering, with exact commands: (1) datasets to fetch and where (NSynth, IDMT-SMT-Guitar/Bass, MedleyDB, MUSDB18 for mixes, MTG-Jamendo mood subset); (2) `pip install -r requirements.txt` (+ note tensorflow GPU setup); (3) generate the synthetic corpus via `synth.py`; (4) `python train.py --model isolated ...` then `--model mix ...`; (5) `python quantize.py ...` → `.tflite`; (6) compile (link to `compile_edgetpu.md`); (7) `python eval.py ...` ship gate; (8) drop `ear-isolated_edgetpu.tflite` next to the service and set `EAR_INFER_MODEL`. State clearly that training needs a GPU and is multi-hour, and that `Model.infer`'s real branch in `../infer.py` gets wired to the trained model's IO at this point.

- [ ] **Step 2:** Write `compile_edgetpu.md`: install the Edge TPU compiler (Debian/x86 only, via Coral apt repo — note it does NOT run on ARM or Windows; use the x86 path or Colab), `edgetpu_compiler ear-isolated.tflite`, read the op-mapping report (% ops on TPU), and what to do if too many ops fall back to CPU (simplify backbone). Note the runtime side (pycoral on the Windows host) is already in `services/ear-infer/README.md`.

- [ ] **Step 3: commit**
```bash
cd /home/tener/musical-symmetry
git add services/ear-infer/training/README.md services/ear-infer/training/compile_edgetpu.md
git commit -m "docs(ear-train): training + edgetpu-compile runbook"
```

## Final verification
- [ ] `cd services/ear-infer/training && ./venv/bin/python -m pytest -q` — labels + synth pass, TF model tests skip cleanly (or pass if TF installed). No failures.
- [ ] No `venv/` committed anywhere.
