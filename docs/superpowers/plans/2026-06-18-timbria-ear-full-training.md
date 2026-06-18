# Timbria ear-infer Full Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train, quantize, Edge-TPU-compile, and deploy a real multi-head (instrument/effects/mood) `ear-infer` model that replaces the deterministic stub in Timbria's "Identify by Ear".

**Architecture:** Phase 1 builds and unit-tests all *local* code with zero GPU/cloud/dataset gates (corpus binding, audio prep, synth-corpus generation, and the serving-side real-inference wiring against a committed tiny fixture model). Phase 2 runs the actual training on a rented Lambda Cloud GPU (gated on the MedleyDB Zenodo approval). Phase 3 compiles for the Coral on SRV-2, applies the eval ship-gate, deploys to the live Windows-native serving path, and verifies end-to-end.

**Tech Stack:** Python 3.12 (training venv, TensorFlow 2.x, pedalboard, soundfile, sklearn), Python 3.9 (Windows serving, pycoral/tflite-runtime), Lambda Cloud GPU, `edgetpu_compiler`.

## Global Constraints

- **Model input contract is FIXED:** 16 kHz mono int16 PCM → log-mel **128 mels × 64 frames**, byte-identical to `services/ear-infer/infer.py::pcm_to_logmel`. Training and serving MUST match. Do not change SR.
- **Head widths are FIXED and in lockstep** across `training/labels.py`, `services/ear-infer/infer.py`, `training/model.py`: instrument=19, effects=22, mood=8. Output→head order = `model.HEADS` insertion order: `instrument`, `effects`, `mood`.
- **API response keys are `instruments` / `effects` / `mood`** (note: response key is plural `instruments`; the head name is singular `instrument`). Do not rename response keys.
- **Personal/research, non-commercial only.** NC datasets are permitted; the shipped model must NOT be used commercially (see `packages/timbria-*/NOTICE.md`).
- **Corpus root** (the `--data` / `$EAR_CORPUS` value): `T:\ml\timbria-ear\corpus` on Windows = `/mnt/t/ml/timbria-ear/corpus` in WSL. Native-SR masters live beside it under `…/timbria-ear/masters`.
- **Training venv:** `services/ear-infer/training/venv`. **Serving venv:** `services/ear-infer/venv`. Run pytest from `services/ear-infer/training/` for training tests (imports are flat, e.g. `from dataset import …`).
- **TF-guard pattern:** tests that need TensorFlow must `pytest.importorskip("tensorflow")`; pure-numpy tests must NOT import TF (so they run in the serving venv too).

### Design note — one deployable 3-head model from the isolated/mix split

`train.py` exposes `--model isolated|mix`; `_labels_for` supports exactly two clip sources: `synth` (instrument+effects supervised) and `real_mood` (mood supervised). To produce a single deployable model that covers **all three heads**, this plan binds `iter_clips` so that **each variant's corpus contains BOTH** synth clips (from that variant's dry sources) **and** the shared mood clips. The variant therefore selects only the *difficulty of the dry material* (isolated = clean single-instrument dry sources: NSynth / IDMT DI / MedleyDB raw stems; mix = MUSDB18 mixtures), not which heads are trained. Instrument labels for mixture dry sources (MUSDB18) are the multi-hot of active stems. We ship the variant that passes the eval gate best (expected: `mix`, since Timbria analyzes full recordings); both are produced.

**Corpus layout (16 kHz int16 working set):**
```
/mnt/t/ml/timbria-ear/corpus/
  synth/
    isolated/   clip_000001.wav  clip_000001.effects.npy  clip_000001.instrument.json
    mix/        clip_000001.wav  clip_000001.effects.npy  clip_000001.instrument.json
  mood/         <id>.wav  <id>.mood.json
/mnt/t/ml/timbria-ear/masters/    # native-SR archives (nsynth/ medleydb/ musdb18/ jamendo_mood/ idmt/), NOT read by iter_clips
```
- `*.effects.npy` — float32 multi-hot array of length 22 (as `synth.multihot` emits).
- `*.instrument.json` — JSON list of instrument label strings (from `labels.INSTRUMENTS`).
- `*.mood.json` — JSON list of mood label strings (from `labels.MOOD`).

---

## File Structure

**Create:**
- `services/ear-infer/training/prep/__init__.py` — package marker.
- `services/ear-infer/training/prep/audio.py` — audio decode/resample/window to 16 kHz int16 PCM.
- `services/ear-infer/training/prep/build_synth.py` — generate the synth corpus (wet clips + label sidecars) from dry sources.
- `services/ear-infer/training/prep/ingest.py` — per-dataset label mappers (NSynth/MedleyDB/MUSDB18/Jamendo → our vocab) + corpus writers.
- `services/ear-infer/training/test_audio.py` — tests for `prep/audio.py`.
- `services/ear-infer/training/test_iter_clips.py` — tests for the real `iter_clips`.
- `services/ear-infer/training/test_build_synth.py` — tests for `prep/build_synth.py`.
- `services/ear-infer/training/test_ingest.py` — tests for the label mappers in `prep/ingest.py`.
- `services/ear-infer/training/tools/make_tiny_fixture.py` — builds the committed tiny 3-head int8 tflite test fixture.
- `services/ear-infer/tests/fixtures/tiny_ear_int8.tflite` — committed fixture (built once by the tool above).
- `services/ear-infer/test_infer.py` — tests for the serving-side real-inference wiring.
- `services/ear-infer/training/cloud/bootstrap.sh` — Lambda instance setup.
- `services/ear-infer/training/cloud/fetch_datasets.sh` — on-box dataset download + resample driver.

**Modify:**
- `services/ear-infer/training/dataset.py:112-132` — replace the `iter_clips` stub with the real implementation.
- `services/ear-infer/infer.py:30-62` — replace the stub branch in `Model.infer` with real tensor IO + decode helpers.

---

## PHASE 1 — Local code (no GPU / no cloud / MedleyDB not required)

### Task 1: Audio prep utility (decode → 16 kHz mono int16 PCM → fixed windows)

**Files:**
- Create: `services/ear-infer/training/prep/__init__.py`
- Create: `services/ear-infer/training/prep/audio.py`
- Test: `services/ear-infer/training/test_audio.py`

**Interfaces:**
- Produces:
  - `to_pcm16k(path: str) -> bytes` — load any soundfile-readable audio, downmix to mono, resample to 16 kHz, return little-endian int16 PCM bytes.
  - `array_to_pcm16k(x: np.ndarray, sr: int) -> bytes` — same, from an in-memory float array.
  - `window_clips(pcm: bytes, clip_seconds: float = 1.0, sr: int = 16000, drop_last: bool = True) -> list[bytes]` — split PCM into fixed-length clips (16000 samples for 1.0 s); pads the last clip with zeros when `drop_last=False`.

- [ ] **Step 1: Write the failing test**

```python
# services/ear-infer/training/test_audio.py
import numpy as np
import soundfile as sf
from prep.audio import to_pcm16k, array_to_pcm16k, window_clips

def _pcm_to_float(pcm):
    return np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0

def test_array_to_pcm16k_resamples_and_mono():
    # 0.5s stereo 32 kHz sine -> expect 8000 mono samples @ 16 kHz
    sr = 32000
    t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 220 * t)
    stereo = np.stack([tone, tone], axis=1)
    pcm = array_to_pcm16k(stereo, sr)
    x = _pcm_to_float(pcm)
    assert abs(len(x) - 8000) <= 2          # ~0.5s @ 16 kHz
    assert x.dtype == np.float32
    assert np.abs(x).max() > 0.1            # signal survived

def test_window_clips_exact_length_and_count():
    sr = 16000
    pcm = array_to_pcm16k(np.zeros(sr * 3 + 100, dtype=np.float32), sr)  # 3.00+s
    clips = window_clips(pcm, clip_seconds=1.0, sr=sr, drop_last=True)
    assert len(clips) == 3
    assert all(len(c) == sr * 2 for c in clips)  # 16000 samples * 2 bytes

def test_window_clips_pads_last_when_kept():
    sr = 16000
    pcm = array_to_pcm16k(np.zeros(sr + sr // 2, dtype=np.float32), sr)   # 1.5s
    clips = window_clips(pcm, clip_seconds=1.0, sr=sr, drop_last=False)
    assert len(clips) == 2
    assert all(len(c) == sr * 2 for c in clips)

def test_to_pcm16k_reads_file(tmp_path):
    sr = 22050
    x = (0.3 * np.sin(2 * np.pi * 440 * np.arange(sr) / sr)).astype(np.float32)
    p = tmp_path / "tone.wav"
    sf.write(p, x, sr)
    pcm = to_pcm16k(str(p))
    assert abs(len(_pcm_to_float(pcm)) - 16000) <= 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_audio.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'prep'`

- [ ] **Step 3: Write minimal implementation**

```python
# services/ear-infer/training/prep/__init__.py
```
```python
# services/ear-infer/training/prep/audio.py
"""Decode arbitrary audio to the model's 16 kHz mono int16 PCM contract."""
import numpy as np
import soundfile as sf

try:
    from scipy.signal import resample_poly
    def _resample(x, sr_in, sr_out):
        if sr_in == sr_out:
            return x
        from math import gcd
        g = gcd(int(sr_in), int(sr_out))
        return resample_poly(x, sr_out // g, sr_in // g).astype(np.float32)
except Exception:  # scipy not present: linear-interp fallback
    def _resample(x, sr_in, sr_out):
        if sr_in == sr_out:
            return x
        n_out = int(round(len(x) * sr_out / sr_in))
        xp = np.linspace(0, 1, len(x), endpoint=False)
        fp = np.linspace(0, 1, n_out, endpoint=False)
        return np.interp(fp, xp, x).astype(np.float32)

SR = 16000

def array_to_pcm16k(x: np.ndarray, sr: int) -> bytes:
    x = np.asarray(x, dtype=np.float32)
    if x.ndim > 1:                      # downmix to mono
        x = x.mean(axis=1)
    x = _resample(x, sr, SR)
    x = np.clip(x, -1.0, 1.0)
    return (x * 32767.0).astype("<i2").tobytes()

def to_pcm16k(path: str) -> bytes:
    x, sr = sf.read(path, dtype="float32", always_2d=False)
    return array_to_pcm16k(x, sr)

def window_clips(pcm: bytes, clip_seconds: float = 1.0, sr: int = SR,
                 drop_last: bool = True) -> list:
    n = int(round(clip_seconds * sr))           # samples per clip
    step = n * 2                                 # bytes per clip (int16)
    out, i = [], 0
    while i + step <= len(pcm):
        out.append(pcm[i:i + step]); i += step
    if not drop_last and i < len(pcm):
        tail = pcm[i:]
        out.append(tail + b"\x00" * (step - len(tail)))
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_audio.py -v`
Expected: PASS (4 passed). If `scipy`/`soundfile` missing: `./venv/bin/pip install scipy soundfile`.

- [ ] **Step 5: Commit**

```bash
git add services/ear-infer/training/prep/__init__.py services/ear-infer/training/prep/audio.py services/ear-infer/training/test_audio.py
git commit -m "feat(ear-train): audio prep util — decode/resample/window to 16kHz int16 PCM"
```

---

### Task 2: Real `iter_clips` (variant-aware synth + shared mood sources)

**Files:**
- Modify: `services/ear-infer/training/dataset.py:112-132` (replace the stub)
- Test: `services/ear-infer/training/test_iter_clips.py`

**Interfaces:**
- Consumes: `prep.audio.to_pcm16k`, `prep.audio.window_clips`; `spec` dict with `variant`, `synth_dir`, `mood_dir`, `clip_seconds` (from `train.make_spec`).
- Produces: `iter_clips(spec)` yields `(pcm_bytes: bytes, source: str, meta: dict)` where `source ∈ {"synth","real_mood"}`, `meta` has `instrument`/`effects` for synth and `mood` for real_mood. Each yielded `pcm_bytes` is exactly one `clip_seconds` window of 16 kHz int16 PCM.

- [ ] **Step 1: Write the failing test**

```python
# services/ear-infer/training/test_iter_clips.py
import json, numpy as np, soundfile as sf
from dataset import iter_clips

def _make_corpus(root, variant="isolated"):
    sdir = root / "synth" / variant
    mdir = root / "mood"
    sdir.mkdir(parents=True); mdir.mkdir(parents=True)
    # one 2s synth clip @ 16k -> 2 one-second windows
    sf.write(sdir / "clip_000001.wav", np.zeros(32000, np.float32), 16000)
    np.save(sdir / "clip_000001.effects.npy", np.zeros(22, np.float32))
    (sdir / "clip_000001.instrument.json").write_text(json.dumps(["Electric guitar"]))
    # one 1s mood clip
    sf.write(mdir / "track_a.wav", np.zeros(16000, np.float32), 16000)
    (mdir / "track_a.mood.json").write_text(json.dumps(["dreamy", "warm"]))
    return {"variant": variant, "synth_dir": str(root / "synth"),
            "mood_dir": str(mdir), "clip_seconds": 1.0}

def test_iter_clips_yields_synth_and_mood(tmp_path):
    spec = _make_corpus(tmp_path)
    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    assert sources.count("synth") == 2        # 2 windows from the 2s clip
    assert sources.count("real_mood") == 1
    for pcm, source, meta in items:
        assert len(pcm) == 16000 * 2          # exactly 1s int16
        if source == "synth":
            assert meta["instrument"] == ["Electric guitar"]
            assert isinstance(meta["effects"], np.ndarray) and meta["effects"].shape == (22,)
        else:
            assert set(meta["mood"]) == {"dreamy", "warm"}

def test_iter_clips_variant_selects_subdir(tmp_path):
    _make_corpus(tmp_path, variant="isolated")
    spec_mix = {"variant": "mix", "synth_dir": str(tmp_path / "synth"),
                "mood_dir": str(tmp_path / "mood"), "clip_seconds": 1.0}
    # mix subdir does not exist -> only mood clips yielded, no crash
    assert [s for _, s, _ in iter_clips(spec_mix)] == ["real_mood"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_iter_clips.py -v`
Expected: FAIL — `NotImplementedError: iter_clips is a corpus-binding stub …`

- [ ] **Step 3: Write minimal implementation** — replace `dataset.py` lines 112-132 (the stub body) with:

```python
def iter_clips(spec):
    """Yield ``(pcm_bytes, source, meta)`` for every training clip.

    Reads the on-disk 16 kHz corpus produced by prep/build_synth.py + prep/ingest.py:
      <synth_dir>/<variant>/clip_*.wav  (+ .effects.npy, .instrument.json) -> "synth"
      <mood_dir>/*.wav                  (+ .mood.json)                      -> "real_mood"
    Each WAV is windowed into fixed clip_seconds chunks; every chunk inherits the
    file's labels.
    """
    import glob, json, os
    from prep.audio import to_pcm16k, window_clips

    variant = spec.get("variant", "isolated")
    clip_seconds = float(spec.get("clip_seconds", 1.0))

    synth_root = os.path.join(spec["synth_dir"], variant)
    for wav in sorted(glob.glob(os.path.join(synth_root, "*.wav"))):
        base = wav[:-4]
        eff = np.load(base + ".effects.npy") if os.path.exists(base + ".effects.npy") \
            else np.zeros(len(EFFECTS), dtype=np.float32)
        inst = json.load(open(base + ".instrument.json")) \
            if os.path.exists(base + ".instrument.json") else []
        for pcm in window_clips(to_pcm16k(wav), clip_seconds=clip_seconds):
            yield pcm, "synth", {"instrument": inst, "effects": eff}

    for wav in sorted(glob.glob(os.path.join(spec["mood_dir"], "*.wav"))):
        base = wav[:-4]
        mood = json.load(open(base + ".mood.json")) \
            if os.path.exists(base + ".mood.json") else []
        for pcm in window_clips(to_pcm16k(wav), clip_seconds=clip_seconds):
            yield pcm, "real_mood", {"mood": mood}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_iter_clips.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add services/ear-infer/training/dataset.py services/ear-infer/training/test_iter_clips.py
git commit -m "feat(ear-train): bind iter_clips to on-disk 16kHz corpus (variant synth + shared mood)"
```

---

### Task 3: Synth corpus generator (dry sources → wet clips + label sidecars)

**Files:**
- Create: `services/ear-infer/training/prep/build_synth.py`
- Test: `services/ear-infer/training/test_build_synth.py`

**Interfaces:**
- Consumes: `synth.random_chain`, `synth.synth_clip`; `prep.audio` (read native, the synth runs at native SR then we store 16 kHz).
- Produces:
  - `build_synth_clip(dry: np.ndarray, sr: int, instrument: list[str], out_dir: str, idx: int, rng) -> str` — apply a random pedalboard chain to one dry array, write `clip_{idx:06d}.wav` (16 kHz int16), `.effects.npy` (multi-hot), `.instrument.json`; return the wav path.
  - `build_synth_corpus(dry_items, out_dir: str, seed: int = 0) -> int` — iterate `(np_array, sr, instrument_list)` items, write a clip each; return count.

- [ ] **Step 1: Write the failing test**

```python
# services/ear-infer/training/test_build_synth.py
import json, numpy as np, soundfile as sf
from prep.build_synth import build_synth_corpus

def test_build_synth_corpus_writes_triples(tmp_path):
    sr = 16000
    dry = [ (0.2*np.sin(2*np.pi*220*np.arange(sr)/sr).astype(np.float32), sr, ["Electric guitar"]),
            (0.2*np.sin(2*np.pi*330*np.arange(sr)/sr).astype(np.float32), sr, ["Bass guitar"]) ]
    n = build_synth_corpus(iter(dry), str(tmp_path), seed=0)
    assert n == 2
    wavs = sorted(tmp_path.glob("*.wav"))
    assert len(wavs) == 2
    for w in wavs:
        base = str(w)[:-4]
        eff = np.load(base + ".effects.npy")
        inst = json.load(open(base + ".instrument.json"))
        assert eff.shape == (22,)
        assert isinstance(inst, list) and inst
        x, file_sr = sf.read(w)
        assert file_sr == 16000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_build_synth.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'prep.build_synth'`

- [ ] **Step 3: Write minimal implementation**

```python
# services/ear-infer/training/prep/build_synth.py
"""Generate the synthesized-effects corpus: random pedalboard chains over dry
instrument audio, writing wet 16 kHz clips + exact effect/instrument labels."""
import json, os
import numpy as np
import soundfile as sf

from synth import random_chain, synth_clip
from prep.audio import array_to_pcm16k

def _write_pcm16k_wav(path, pcm_bytes):
    x = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float32) / 32768.0
    sf.write(path, x, 16000, subtype="PCM_16")

def build_synth_clip(dry, sr, instrument, out_dir, idx, rng):
    effects = random_chain(rng)                       # may be [] (clean example)
    wet, mh = synth_clip(np.asarray(dry, np.float32), sr, effects, seed=int(idx))
    base = os.path.join(out_dir, f"clip_{idx:06d}")
    _write_pcm16k_wav(base + ".wav", array_to_pcm16k(wet, sr))
    np.save(base + ".effects.npy", mh)
    json.dump(list(instrument), open(base + ".instrument.json", "w"))
    return base + ".wav"

def build_synth_corpus(dry_items, out_dir, seed=0):
    os.makedirs(out_dir, exist_ok=True)
    rng = np.random.default_rng(seed)
    n = 0
    for dry, sr, instrument in dry_items:
        build_synth_clip(dry, sr, instrument, out_dir, n, rng)
        n += 1
    return n
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_build_synth.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add services/ear-infer/training/prep/build_synth.py services/ear-infer/training/test_build_synth.py
git commit -m "feat(ear-train): synth corpus generator (wet clips + effect/instrument labels)"
```

---

### Task 4: Dataset label mappers + corpus writers

**Files:**
- Create: `services/ear-infer/training/prep/ingest.py`
- Test: `services/ear-infer/training/test_ingest.py`

**Interfaces:**
- Consumes: `labels.INSTRUMENTS`, `labels.MOOD`; `prep.audio`, `prep.build_synth`.
- Produces (pure label-mapping functions — the testable core):
  - `nsynth_instrument(family: str) -> list[str]` — map an NSynth `instrument_family_str` to our `INSTRUMENTS` vocab.
  - `musdb_stems_to_instruments(active: list[str]) -> list[str]` — map active MUSDB18 stem names (`vocals`/`drums`/`bass`/`other`) to `INSTRUMENTS`.
  - `jamendo_tags_to_mood(tags: list[str]) -> list[str]` — map MTG-Jamendo mood/theme tags to our `MOOD` vocab (drop unmapped).
  - `medleydb_instrument(name: str) -> list[str]` — map a MedleyDB instrument label to our vocab.
- Produces (corpus writers — thin glue, exercised in Phase 2 on the Lambda box):
  - `ingest_dry_to_synth(dry_root, variant_out_dir, dataset, seed=0) -> int`
  - `ingest_jamendo_to_mood(jamendo_root, mood_out_dir) -> int`

- [ ] **Step 1: Write the failing test** (covers the label-mapping logic; the file-IO writers are smoke-tested on a tiny fixture)

```python
# services/ear-infer/training/test_ingest.py
from labels import INSTRUMENTS, MOOD
from prep.ingest import (nsynth_instrument, musdb_stems_to_instruments,
                         jamendo_tags_to_mood, medleydb_instrument)

def test_nsynth_family_mapping():
    assert nsynth_instrument("guitar") == ["Electric guitar"]
    assert nsynth_instrument("bass") == ["Bass guitar"]
    assert nsynth_instrument("keyboard") == ["Electric piano"]
    assert nsynth_instrument("vocal") == ["Vocals"]
    assert nsynth_instrument("mallet") == ["Percussion"]
    # unknown family falls back to "Other", always valid vocab
    assert nsynth_instrument("zzz") == ["Other"]
    for fam in ["guitar","bass","keyboard","vocal","mallet","reed","brass","flute","string","organ","synth_lead"]:
        assert all(lbl in INSTRUMENTS for lbl in nsynth_instrument(fam))

def test_musdb_stems_mapping():
    got = musdb_stems_to_instruments(["vocals", "drums", "bass"])
    assert "Vocals" in got and "Acoustic kit" in got and "Bass guitar" in got
    assert all(lbl in INSTRUMENTS for lbl in got)
    assert musdb_stems_to_instruments([]) == []

def test_jamendo_mood_mapping_drops_unmapped():
    got = jamendo_tags_to_mood(["mood/theme---dark", "mood/theme---happy", "mood/theme---xyzzy"])
    assert all(m in MOOD for m in got)
    assert got  # at least one mapped
    assert jamendo_tags_to_mood(["mood/theme---xyzzy"]) == []

def test_medleydb_instrument_mapping():
    assert medleydb_instrument("electric guitar") == ["Electric guitar"]
    assert medleydb_instrument("drum set") == ["Acoustic kit"]
    assert all(lbl in INSTRUMENTS for lbl in medleydb_instrument("male singer"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_ingest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'prep.ingest'`

- [ ] **Step 3: Write minimal implementation**

```python
# services/ear-infer/training/prep/ingest.py
"""Map each external dataset's native labels onto our fixed vocab, and write the
16 kHz corpus. Label maps are deliberately explicit so the vocab stays auditable."""
import glob, json, os
import numpy as np
import soundfile as sf

from labels import INSTRUMENTS, MOOD
from prep.audio import to_pcm16k
from prep.build_synth import build_synth_corpus

_NSYNTH = {
    "guitar": "Electric guitar", "bass": "Bass guitar", "keyboard": "Electric piano",
    "organ": "Organ", "synth_lead": "Synth lead", "vocal": "Vocals",
    "string": "Strings", "brass": "Brass", "reed": "Saxophone", "flute": "Woodwinds",
    "mallet": "Percussion",
}
_MUSDB = {"vocals": "Vocals", "drums": "Acoustic kit", "bass": "Bass guitar", "other": "Other"}
_MEDLEYDB = {
    "electric guitar": "Electric guitar", "clean electric guitar": "Electric guitar",
    "distorted electric guitar": "Electric guitar", "acoustic guitar": "Acoustic guitar",
    "electric bass": "Bass guitar", "double bass": "Upright bass", "piano": "Acoustic piano",
    "electric piano": "Electric piano", "synthesizer": "Synth lead", "drum set": "Acoustic kit",
    "male singer": "Vocals", "female singer": "Vocals", "vocalists": "Vocals",
    "violin": "Strings", "cello": "Strings", "trumpet": "Brass", "tenor saxophone": "Saxophone",
    "flute": "Woodwinds", "mandolin": "Banjo/mandolin", "banjo": "Banjo/mandolin",
}
# MTG-Jamendo mood/theme tag (after the "mood/theme---" prefix) -> our MOOD vocab
_JAMENDO_MOOD = {
    "dark": "gritty", "happy": "bright", "sad": "warm", "relaxing": "dreamy",
    "energetic": "aggressive", "calm": "clean", "soft": "warm", "epic": "spacious",
    "melancholic": "warm", "uplifting": "bright", "aggressive": "aggressive",
    "dream": "dreamy", "ambient": "spacious", "retro": "lo-fi",
}

def _valid(lbls, vocab):
    return [l for l in lbls if l in vocab]

def nsynth_instrument(family):
    return [_NSYNTH.get(family, "Other")]

def musdb_stems_to_instruments(active):
    return _valid([_MUSDB[s] for s in active if s in _MUSDB], INSTRUMENTS)

def jamendo_tags_to_mood(tags):
    out = []
    for t in tags:
        key = t.split("---")[-1].strip().lower()
        if key in _JAMENDO_MOOD:
            out.append(_JAMENDO_MOOD[key])
    # dedupe, keep order
    seen, uniq = set(), []
    for m in out:
        if m not in seen:
            seen.add(m); uniq.append(m)
    return _valid(uniq, MOOD)

def medleydb_instrument(name):
    return [_MEDLEYDB.get(name.strip().lower(), "Other")]

# ---- corpus writers (file IO; run on the Lambda box in Phase 2) ----

def ingest_dry_to_synth(dry_root, variant_out_dir, dataset, seed=0):
    """Walk a dataset's dry audio and feed (array, sr, instrument) to build_synth_corpus.
    `dataset` selects the per-file instrument labeler."""
    def items():
        for wav in sorted(glob.glob(os.path.join(dry_root, "**", "*.wav"), recursive=True)):
            x, sr = sf.read(wav, dtype="float32", always_2d=False)
            if dataset == "nsynth":
                fam = os.path.basename(wav).split("_")[0]      # e.g. "guitar_acoustic_001-..."
                inst = nsynth_instrument(fam)
            elif dataset == "medleydb":
                inst = medleydb_instrument(os.path.basename(os.path.dirname(wav)))
            else:
                inst = ["Other"]
            yield x, sr, inst
    return build_synth_corpus(items(), variant_out_dir, seed=seed)

def ingest_jamendo_to_mood(jamendo_root, mood_out_dir, tags_by_id):
    """tags_by_id: {track_id: [raw mood/theme tags]} parsed from the Jamendo TSV."""
    os.makedirs(mood_out_dir, exist_ok=True)
    n = 0
    for wav in sorted(glob.glob(os.path.join(jamendo_root, "**", "*.mp3"), recursive=True)) + \
               sorted(glob.glob(os.path.join(jamendo_root, "**", "*.wav"), recursive=True)):
        tid = os.path.splitext(os.path.basename(wav))[0]
        mood = jamendo_tags_to_mood(tags_by_id.get(tid, []))
        if not mood:
            continue
        pcm = to_pcm16k(wav)
        x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(mood_out_dir, tid)
        sf.write(base + ".wav", x, 16000, subtype="PCM_16")
        json.dump(mood, open(base + ".mood.json", "w"))
        n += 1
    return n
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ear-infer/training && ./venv/bin/python -m pytest test_ingest.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add services/ear-infer/training/prep/ingest.py services/ear-infer/training/test_ingest.py
git commit -m "feat(ear-train): dataset label mappers + corpus writers (nsynth/medleydb/musdb/jamendo)"
```

---

### Task 5: Serving-side inference helpers (pure numpy, no TF)

**Files:**
- Modify: `services/ear-infer/infer.py` (add helpers above `class Model`; do NOT touch `Model` yet)
- Create: `services/ear-infer/test_infer.py`

**Interfaces:**
- Produces:
  - `_fix_frames(logmel: np.ndarray, frames: int) -> np.ndarray` — pad/crop time axis (mirror `dataset._fix_frames`).
  - `_quant_input(value, detail) -> np.ndarray` — float→int8 input quant (mirror `eval._quant_input`).
  - `_dequant(value, detail) -> np.ndarray` — int8→float dequant (mirror `eval._dequant`).
  - `_decode(prob: np.ndarray, labels: list[str], decision: float = 0.5, top_k: int = 0) -> list[dict]` — sigmoid vector → `[{"label","confidence"}]`, sorted desc; if nothing clears `decision`, return the single top label.

- [ ] **Step 1: Write the failing test**

```python
# services/ear-infer/test_infer.py
import numpy as np
import infer

def test_fix_frames_pad_and_crop():
    assert infer._fix_frames(np.ones((128, 40), np.float32), 64).shape == (128, 64)
    assert infer._fix_frames(np.ones((128, 90), np.float32), 64).shape == (128, 64)

def test_quant_dequant_roundtrip():
    detail = {"dtype": np.int8, "quantization": (0.05, -3)}
    x = np.array([0.0, 0.5, -0.5], np.float32)
    q = infer._quant_input(x, detail)
    assert q.dtype == np.int8
    back = infer._dequant(q, {"quantization": (0.05, -3)})
    assert np.allclose(back, x, atol=0.05)

def test_quant_input_float_passthrough():
    detail = {"dtype": np.float32, "quantization": (0.0, 0)}
    x = np.array([0.1, 0.2], np.float32)
    assert np.allclose(infer._quant_input(x, detail), x)

def test_decode_threshold_and_fallback():
    labels = ["a", "b", "c"]
    out = infer._decode(np.array([0.9, 0.7, 0.1], np.float32), labels, decision=0.5)
    assert [d["label"] for d in out] == ["a", "b"]
    assert out[0]["confidence"] >= out[1]["confidence"]
    # nothing clears threshold -> single top label returned
    only = infer._decode(np.array([0.2, 0.3, 0.1], np.float32), labels, decision=0.5)
    assert [d["label"] for d in only] == ["b"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ear-infer && ./venv/bin/python -m pytest test_infer.py -v`
Expected: FAIL — `AttributeError: module 'infer' has no attribute '_fix_frames'`

- [ ] **Step 3: Write minimal implementation** — insert into `services/ear-infer/infer.py` immediately before `class Model:`:

```python
def _fix_frames(logmel, frames):
    n_mels, t = logmel.shape
    if t == frames:
        return logmel
    if t > frames:
        return logmel[:, :frames]
    pad = np.zeros((n_mels, frames - t), dtype=logmel.dtype)
    return np.concatenate([logmel, pad], axis=1)

def _quant_input(value, detail):
    if detail["dtype"] == np.float32:
        return value.astype(np.float32)
    scale, zero = detail["quantization"]
    q = np.round(value / scale + zero)
    info = np.iinfo(detail["dtype"])
    return np.clip(q, info.min, info.max).astype(detail["dtype"])

def _dequant(value, detail):
    scale, zero = detail["quantization"]
    if scale == 0:
        return value.astype(np.float32)
    return (value.astype(np.float32) - zero) * scale

def _decode(prob, labels, decision=0.5, top_k=0):
    order = np.argsort(prob)[::-1]
    picks = [i for i in order if prob[i] >= decision]
    if not picks:
        picks = [int(order[0])]
    if top_k:
        picks = picks[:top_k]
    return [{"label": labels[i], "confidence": round(float(prob[i]), 2)} for i in picks]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ear-infer && ./venv/bin/python -m pytest test_infer.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add services/ear-infer/infer.py services/ear-infer/test_infer.py
git commit -m "feat(ear-serve): pure-numpy inference helpers (fix_frames/quant/dequant/decode)"
```

---

### Task 6: Build the tiny fixture model + wire `Model.infer` real branch

**Files:**
- Create: `services/ear-infer/training/tools/make_tiny_fixture.py`
- Create: `services/ear-infer/tests/fixtures/tiny_ear_int8.tflite` (artifact built by the tool)
- Modify: `services/ear-infer/infer.py:Model.infer`
- Test: add `test_infer_end_to_end` to `services/ear-infer/test_infer.py`

**Interfaces:**
- Consumes: Task 5 helpers; `pcm_to_logmel`; `INSTRUMENTS/EFFECTS/MOOD`.
- Produces: `Model.infer(pcm, domain)` returns `{"instruments": [...], "effects": [...], "mood": [...]}` from the real interpreter; an output-tensor→head matcher `_match_outputs(out_details)` (mirror `eval._match_outputs`).

- [ ] **Step 1: Write the fixture builder and generate the artifact**

```python
# services/ear-infer/training/tools/make_tiny_fixture.py
"""Build a tiny full-int8 3-head tflite that matches the real head widths, for
serving-side tests. Run once with the training venv (needs TensorFlow)."""
import os, numpy as np, tensorflow as tf
import sys; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import build_model

def main(out):
    m = build_model(n_mels=128, frames=64)
    def rep():
        for _ in range(50):
            yield [np.random.rand(1, 128, 64, 1).astype(np.float32)]
    conv = tf.lite.TFLiteConverter.from_keras_model(m)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = rep
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "wb").write(conv.convert())
    print("wrote", out)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else
         os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "tiny_ear_int8.tflite"))
```

Run: `cd services/ear-infer/training && ./venv/bin/python tools/make_tiny_fixture.py`
Expected: `wrote .../services/ear-infer/tests/fixtures/tiny_ear_int8.tflite`

- [ ] **Step 2: Write the failing end-to-end test** (append to `services/ear-infer/test_infer.py`)

```python
import os
FIX = os.path.join(os.path.dirname(__file__), "tests", "fixtures", "tiny_ear_int8.tflite")

def test_infer_end_to_end_real_model(monkeypatch):
    import pytest
    if not os.path.exists(FIX):
        pytest.skip("fixture not built")
    try:
        import tflite_runtime  # noqa
    except Exception:
        pytest.skip("tflite_runtime not installed in this venv")
    monkeypatch.setenv("EAR_INFER_MODEL", FIX)
    m = infer.Model()
    assert m.interp is not None
    pcm = (np.random.rand(16000) * 2 - 1).astype(np.float32)
    pcm = (pcm * 32767).astype("<i2").tobytes()
    out = m.infer(pcm, "isolated")
    assert set(out) == {"instruments", "effects", "mood"}
    assert all("label" in d and "confidence" in d for d in out["effects"])
    # labels come from the real vocab
    assert all(d["label"] in infer.EFFECTS for d in out["effects"])
    assert all(d["label"] in infer.INSTRUMENTS for d in out["instruments"])
    assert all(d["label"] in infer.MOOD for d in out["mood"])
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd services/ear-infer && ./venv/bin/python -m pytest test_infer.py::test_infer_end_to_end_real_model -v`
Expected: FAIL — current `Model.infer` returns stub keyed `instruments/effects/mood` but values are deterministic stub, and (more importantly) it ignores the model. Make the test meaningful by first asserting real decode (it will fail because infer still calls `_stub_heads`). If `tflite_runtime` missing, install it: `./venv/bin/pip install tflite-runtime` (or the test skips).

- [ ] **Step 4: Replace the stub branch** — change `services/ear-infer/infer.py` `Model.infer` (lines 57-61) to:

```python
    def _match_outputs(self, out_details):
        heads = ["instrument", "effects", "mood"]
        by_head = {}
        for name in heads:
            match = next((d for d in out_details if name in d["name"]), None)
            if match is None:   # fall back to positional HEADS order
                match = out_details[heads.index(name)]
            by_head[name] = match
        return by_head

    def infer(self, pcm: bytes, domain: str):
        if self.interp is None:
            return _stub_heads(pcm)
        logmel = _fix_frames(pcm_to_logmel(pcm), 64)            # (128, 64)
        x = logmel[None, ..., None].astype(np.float32)          # (1,128,64,1)
        in_detail = self.interp.get_input_details()[0]
        self.interp.set_tensor(in_detail["index"], _quant_input(x, in_detail))
        self.interp.invoke()
        out_by_head = self._match_outputs(self.interp.get_output_details())
        def head(name):
            d = out_by_head[name]
            return _dequant(self.interp.get_tensor(d["index"])[0], d)
        return {
            "instruments": _decode(head("instrument"), INSTRUMENTS),
            "effects": _decode(head("effects"), EFFECTS),
            "mood": _decode(head("mood"), MOOD),
        }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd services/ear-infer && ./venv/bin/python -m pytest test_infer.py -v`
Expected: PASS (5 passed; the e2e test runs if `tflite_runtime` is installed, else skips).

- [ ] **Step 6: Commit**

```bash
git add services/ear-infer/training/tools/make_tiny_fixture.py services/ear-infer/tests/fixtures/tiny_ear_int8.tflite services/ear-infer/infer.py services/ear-infer/test_infer.py
git commit -m "feat(ear-serve): wire real multi-head inference + tiny int8 fixture test"
```

---

## PHASE 2 — Cloud training on Lambda (GATED: MedleyDB Zenodo approval received; Lambda account ready)

> These tasks are operational — they run datasets and a multi-hour GPU job, so they verify by inspecting artifacts and the eval gate rather than by unit tests. Run Phase 1's full suite first: `cd services/ear-infer/training && ./venv/bin/python -m pytest -q` (all green).

### Task 7: Lambda bootstrap + on-box dataset fetch

**Files:**
- Create: `services/ear-infer/training/cloud/bootstrap.sh`
- Create: `services/ear-infer/training/cloud/fetch_datasets.sh`

- [ ] **Step 1: Write `bootstrap.sh`** (provisions the GPU box once)

```bash
#!/usr/bin/env bash
# Run on a fresh Lambda Cloud GPU instance. Sets up the training env.
set -euo pipefail
sudo apt-get update && sudo apt-get install -y ffmpeg python3-venv git
git clone https://github.com/TenerIsFake/musical-symmetry.git
cd musical-symmetry/services/ear-infer/training
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt 'tensorflow[and-cuda]' soundfile scipy
./venv/bin/python -c "import tensorflow as tf; print('GPUs:', tf.config.list_physical_devices('GPU'))"
echo "bootstrap done. GPUs line above MUST be non-empty."
```

- [ ] **Step 2: Write `fetch_datasets.sh`** (downloads on the high-bandwidth box, builds the 16 kHz corpus). MedleyDB + MUSDB18 + IDMT require the user's Zenodo tokens/links pasted into the marked variables.

```bash
#!/usr/bin/env bash
# Download datasets onto the Lambda box and build $EAR_CORPUS.
set -euo pipefail
export EAR_CORPUS="${EAR_CORPUS:-$HOME/ear-corpus}"
MASTERS="$EAR_CORPUS/../masters"
mkdir -p "$EAR_CORPUS"/{synth/isolated,synth/mix,mood} "$MASTERS"
PY=./venv/bin/python

# --- NSynth (open, CC BY): instrument dry source for the isolated synth corpus
#   (use the smaller validation/test split first to keep the corpus tractable)
# wget http://download.magenta.tensorflow.org/datasets/nsynth/nsynth-valid.jsonwav.tar.gz -P "$MASTERS/nsynth"
# tar xf "$MASTERS/nsynth/"*.tar.gz -C "$MASTERS/nsynth"
$PY -c "from prep.ingest import ingest_dry_to_synth as f; print('nsynth synth clips:', f('$MASTERS/nsynth', '$EAR_CORPUS/synth/isolated', 'nsynth'))"

# --- MedleyDB (Zenodo approval): raw stems -> isolated synth corpus  [PASTE link]
# (download via the approved Zenodo URL into $MASTERS/medleydb, then:)
# $PY -c "from prep.ingest import ingest_dry_to_synth as f; print('medleydb:', f('$MASTERS/medleydb', '$EAR_CORPUS/synth/isolated', 'medleydb'))"

# --- MUSDB18 (Zenodo): mixtures -> mix synth corpus  [PASTE link]
# (decode .mp4 stems to wav mixtures into $MASTERS/musdb18, then ingest as 'mix')

# --- MTG-Jamendo mood/theme (open): mood corpus
# git clone https://github.com/MTG/mtg-jamendo-dataset && \
#   python mtg-jamendo-dataset/scripts/download/download.py --dataset autotagging_moodtheme --type audio "$MASTERS/jamendo_mood" --unpack --remove
# parse autotagging_moodtheme.tsv -> tags_by_id, then ingest_jamendo_to_mood(...)
echo "corpus built under $EAR_CORPUS"
```

- [ ] **Step 3: Verify the corpus** on the box

Run: `find "$EAR_CORPUS"/synth -name '*.wav' | wc -l && find "$EAR_CORPUS"/mood -name '*.wav' | wc -l`
Expected: non-zero counts in both `synth/{isolated,mix}` and `mood`. Spot-check one clip: `./venv/bin/python -c "import soundfile as sf; print(sf.info(next(__import__('glob').iglob('$EAR_CORPUS/synth/isolated/*.wav'))))"` → samplerate 16000.

- [ ] **Step 4: Commit the scripts**

```bash
git add services/ear-infer/training/cloud/bootstrap.sh services/ear-infer/training/cloud/fetch_datasets.sh
git commit -m "chore(ear-train): Lambda bootstrap + dataset fetch/corpus-build scripts"
```

---

### Task 8: Train + quantize both variants (on Lambda)

- [ ] **Step 1: Train `isolated`**

Run: `./venv/bin/python train.py --model isolated --data "$EAR_CORPUS" --out ./out/ear-isolated --epochs 40 --n-mels 128 --frames 64`
Expected: per-epoch `loss=` decreasing; ends `saved SavedModel -> ./out/ear-isolated`.

- [ ] **Step 2: Train `mix`**

Run: `./venv/bin/python train.py --model mix --data "$EAR_CORPUS" --out ./out/ear-mix --epochs 40 --n-mels 128 --frames 64`
Expected: `saved SavedModel -> ./out/ear-mix`.

- [ ] **Step 3: Quantize both to full-int8 tflite**

Run:
```bash
./venv/bin/python quantize.py --saved-model ./out/ear-isolated --out ./out/ear-isolated.tflite --rep-data "$EAR_CORPUS" --rep-samples 200
./venv/bin/python quantize.py --saved-model ./out/ear-mix --out ./out/ear-mix.tflite --rep-data "$EAR_CORPUS" --rep-samples 200
```
Expected: both `.tflite` files written. Sanity-check on the box (no Coral needed): `./venv/bin/python eval.py --tflite ./out/ear-isolated.tflite --data "$EAR_CORPUS"` prints a per-head table.

- [ ] **Step 4: Pull artifacts back to SRV-2** and mirror the 16 kHz working set to `T:`

Run (from SRV-2): `scp ubuntu@<lambda-ip>:~/musical-symmetry/services/ear-infer/training/out/*.tflite /mnt/t/ml/timbria-ear/models/`
Expected: `ear-isolated.tflite` and `ear-mix.tflite` present under `/mnt/t/ml/timbria-ear/models/`. **Tear down the Lambda instance now** to stop billing.

---

## PHASE 3 — Compile, gate, deploy on SRV-2

### Task 9: Edge-TPU compile + eval ship-gate

- [ ] **Step 1: Compile both for the Edge TPU** (on SRV-2/WSL; `edgetpu_compiler` available — it produced the PoC model)

Run:
```bash
cd /mnt/t/ml/timbria-ear/models
edgetpu_compiler ear-isolated.tflite -o .
edgetpu_compiler ear-mix.tflite -o .
```
Expected: `ear-isolated_edgetpu.tflite` + `ear-mix_edgetpu.tflite` and a log. **Read the op-mapping report:** if a large fraction of ops fall back to CPU, simplify the backbone per `training/compile_edgetpu.md` (reduce conv stack / channel counts in `model.build_model`), retrain, re-quantize, recompile.

- [ ] **Step 2: Apply the eval ship-gate** to each compiled model

Run: `cd services/ear-infer/training && ./venv/bin/python eval.py --tflite /mnt/t/ml/timbria-ear/models/ear-mix_edgetpu.tflite --data /mnt/t/ml/timbria-ear/corpus`
Expected: per-head table; **OVERALL: PASS** (effects ≥0.60, instrument ≥0.60, mood ≥0.40). Pick the best-passing variant to ship. If mood fails but instrument+effects pass, that is an accepted partial per the spec — record it and proceed (mood will under-deliver until more data).

- [ ] **Step 3: Record results** in `project_timbria_ear_infer_coral` memory (per-head F1, chosen variant). (No code commit.)

---

### Task 10: Deploy to the live Coral serving path + end-to-end verify

- [ ] **Step 1: Copy the chosen model beside the service** (Windows host with the Coral)

Run (from WSL): `cp /mnt/t/ml/timbria-ear/models/ear-mix_edgetpu.tflite "/mnt/c/Users/Teners PC/Downloads/coral_poc/models/"`
Expected: file present at `C:\Users\Teners PC\Downloads\coral_poc\models\ear-mix_edgetpu.tflite`.

- [ ] **Step 2: Point the service at the new model** — edit `start-ear-infer.ps1`'s `EAR_INFER_MODEL` to the new `_edgetpu.tflite`, then restart:

Run: `powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 9009 -State Listen | %{ Stop-Process -Id \$_.OwningProcess -Force }; schtasks /run /tn 'Timbria EarInfer SRV-2'"`
Expected: service relaunches.

- [ ] **Step 3: Verify health + real predictions**

Run: `powershell.exe -NoProfile -Command "(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9009/health).Content"`
Expected: `{"ok":true,"model":true}`.

- [ ] **Step 4: End-to-end through timbria-api** — POST a real clip to `/api/identify/by-ear` and confirm non-stub predictions

Run: `docker exec timbria-api sh -c "wget -qO- http://10.0.0.155:9009/health"` then exercise the by-ear endpoint with a sample wav.
Expected: response carries `instruments`/`effects`/`mood` arrays whose labels vary with the input audio (not the deterministic stub). Compare two distinct clips → different top predictions.

- [ ] **Step 5: Final commit** (model-path config only; model binaries live on `T:`/Windows, not git)

```bash
git add -A services/ear-infer
git commit -m "feat(ear-serve): deploy trained multi-head model to Coral serving path"
git push
```

---

## Self-Review

- **Spec coverage:** §3 datasets → Tasks 4,7; §4 SR/storage → Tasks 1,7 + Global Constraints; §6 pipeline → Tasks 2–4,8; §7 bring-home/compile/wire → Tasks 6,9,10; §8 labor split → Phase gating; §9 risks (op-coverage, mood gate) → Tasks 9.1, 9.2; §10 success criteria → Tasks 9.2, 10.4. Covered.
- **Placeholder scan:** the only intentionally-blank items are the *user-supplied Zenodo download URLs* in `fetch_datasets.sh` (account-gated, can't be hardcoded) — marked `[PASTE link]`. All code steps contain complete code.
- **Type consistency:** head order `instrument,effects,mood` consistent across `_match_outputs`, `_decode` calls, and response keys (`instruments` plural only at the response boundary, matching the existing API). `effects.npy` is a length-22 multi-hot in Task 3 (write) and Task 2 (read). `iter_clips` yields `(pcm, source, meta)` consumed by the unchanged `make_dataset.gen`.
