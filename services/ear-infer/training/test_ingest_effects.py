"""TDD tests for INGEST-B: IDMT-SMT-Audio-Effects ingest (real single-effect labels)."""
import json
import os

import numpy as np
import pytest
import soundfile as sf

from labels import EFFECTS, INSTRUMENTS
from prep.ingest import (
    idmt_effect_label,
    idmt_effects_instrument,
    ingest_idmt_audio_effects,
)


# ---------------------------------------------------------------------------
# Part 1 — idmt_effect_label: folder name -> effect label list or None
# ---------------------------------------------------------------------------

def test_idmt_effect_label():
    assert idmt_effect_label("NoFX") == []
    assert idmt_effect_label("FeedbackDelay") == ["Delay/echo"]
    assert idmt_effect_label("SlapbackDelay") == ["Slapback"]
    assert idmt_effect_label("Chorus") == ["Chorus"]
    assert idmt_effect_label("EQ") is None
    assert idmt_effect_label("Bogus") is None


def test_idmt_effect_label_values_in_vocab():
    """Every non-None, non-empty returned label must be in the EFFECTS vocab."""
    folders = [
        "Chorus", "Distortion", "Flanger", "Phaser", "Tremolo", "Vibrato",
        "Overdrive", "Reverb", "FeedbackDelay", "SlapbackDelay",
    ]
    for folder in folders:
        result = idmt_effect_label(folder)
        assert result is not None, f"Expected a list for {folder!r}, got None"
        for lbl in result:
            assert lbl in EFFECTS, f"{lbl!r} from folder {folder!r} not in EFFECTS vocab"


# ---------------------------------------------------------------------------
# Part 2 — idmt_effects_instrument: top subset folder -> instrument label list
# ---------------------------------------------------------------------------

def test_idmt_effects_instrument():
    assert idmt_effects_instrument("Gitarre monophon") == ["Electric guitar"]
    assert idmt_effects_instrument("Bass monophon2") == ["Bass guitar"]
    # Both must be in INSTRUMENTS vocab
    assert "Electric guitar" in INSTRUMENTS
    assert "Bass guitar" in INSTRUMENTS


# ---------------------------------------------------------------------------
# Part 3 — ingest_idmt_audio_effects: filesystem fixture, writes + skips
# ---------------------------------------------------------------------------

def _write_tiny_wav(path, sr=22050, duration=0.1):
    """Write a tiny valid wav to path."""
    n = int(sr * duration)
    data = (0.3 * np.sin(2 * np.pi * 440 * np.linspace(0, duration, n))).astype(np.float32)
    sf.write(path, data, sr, subtype="PCM_16")


def test_ingest_writes_and_skips_eq(tmp_path):
    """Fixture: Gitarre monophon/Samples/{Chorus,NoFX,EQ}/ each with one wav.
    Expects: 2 clips written (Chorus + NoFX), EQ skipped.
    Chorus clip: effects.npy has exactly the Chorus index set.
    NoFX clip: effects.npy is all zeros.
    Both clips: instrument.json == ["Electric guitar"].
    """
    # Build fixture directory structure
    subset = "Gitarre monophon"
    for effect_folder in ("Chorus", "NoFX", "EQ"):
        effect_dir = tmp_path / subset / "Samples" / effect_folder
        effect_dir.mkdir(parents=True, exist_ok=True)
        _write_tiny_wav(str(effect_dir / "note_01.wav"))

    out_dir = tmp_path / "out"
    count = ingest_idmt_audio_effects(str(tmp_path), str(out_dir))

    assert count == 2, f"Expected 2 clips written, got {count}"

    # Collect written clips
    written_wavs = sorted([
        f for f in os.listdir(str(out_dir)) if f.endswith(".wav")
    ])
    assert len(written_wavs) == 2

    # Inspect sidecars for each clip
    chorus_npy = None
    nofx_npy = None

    for wav_name in written_wavs:
        base = wav_name.replace(".wav", "")
        npy_path = os.path.join(str(out_dir), base + ".effects.npy")
        json_path = os.path.join(str(out_dir), base + ".instrument.json")

        assert os.path.exists(npy_path), f"Missing {npy_path}"
        assert os.path.exists(json_path), f"Missing {json_path}"

        arr = np.load(npy_path)
        assert arr.shape == (len(EFFECTS),), f"effects.npy wrong shape: {arr.shape}"
        assert arr.dtype == np.float32

        with open(json_path) as f:
            inst = json.load(f)
        assert inst == ["Electric guitar"], f"instrument.json wrong: {inst}"

        # Classify clip by effects vector
        chorus_idx = EFFECTS.index("Chorus")
        if arr[chorus_idx] == 1.0:
            chorus_npy = arr
        else:
            nofx_npy = arr

    assert chorus_npy is not None, "Chorus clip not found"
    assert nofx_npy is not None, "NoFX clip not found"

    # Chorus clip: only Chorus index is 1, rest 0
    chorus_idx = EFFECTS.index("Chorus")
    assert chorus_npy[chorus_idx] == 1.0
    assert chorus_npy.sum() == 1.0, "Chorus clip should have exactly 1 effect set"

    # NoFX clip: all zeros
    assert nofx_npy.sum() == 0.0, "NoFX clip effects.npy should be all zeros"
