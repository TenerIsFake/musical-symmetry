"""TDD tests for INGEST-A: real_instrument source, IDMT map, and musdb_active_instruments."""
import json
import os
import tempfile

import numpy as np
import pytest
import soundfile as sf

from labels import INSTRUMENTS, EFFECTS
from dataset import _labels_for
from prep.ingest import IDMT_INSTRUMENT, musdb_active_instruments


# ---------------------------------------------------------------------------
# Part 1 — real_instrument source in _labels_for
# ---------------------------------------------------------------------------

def test_real_instrument_source_masks():
    """real_instrument: instrument supervised (mask=1), effects+mood masked (mask=0)."""
    labels, masks = _labels_for("real_instrument", instrument=["Vocals", "Bass guitar"])

    # Mask values
    assert masks["instrument"].item() == 1.0
    assert masks["effects"].item() == 0.0
    assert masks["mood"].item() == 0.0

    # Instrument multi-hot: only Vocals and Bass guitar should be set
    inst_vec = labels["instrument"]
    assert inst_vec[INSTRUMENTS.index("Vocals")] == 1.0
    assert inst_vec[INSTRUMENTS.index("Bass guitar")] == 1.0
    # Total set bits = 2
    assert int(inst_vec.sum()) == 2

    # effects and mood vectors are zero (no labels passed)
    assert labels["effects"].sum() == 0.0
    assert labels["mood"].sum() == 0.0


def test_real_instrument_source_unknown_raises():
    """Ensure unknown sources still raise ValueError."""
    with pytest.raises(ValueError, match="unknown clip source"):
        _labels_for("unknown_source")


# ---------------------------------------------------------------------------
# Part 2 — IDMT_INSTRUMENT map: all values in INSTRUMENTS vocab
# ---------------------------------------------------------------------------

def test_idmt_instrument_map_in_vocab():
    """Every value in IDMT_INSTRUMENT must be a valid INSTRUMENTS label."""
    for folder_key, instrument_label in IDMT_INSTRUMENT.items():
        assert instrument_label in INSTRUMENTS, (
            f"IDMT_INSTRUMENT[{folder_key!r}] = {instrument_label!r} not in INSTRUMENTS vocab"
        )


# ---------------------------------------------------------------------------
# Part 3 — musdb_active_instruments: RMS gating with synthetic stems
# ---------------------------------------------------------------------------

def _write_stem(track_dir, name, data, sr=44100):
    """Write a mono or stereo float32 wav into track_dir."""
    path = os.path.join(track_dir, f"{name}.wav")
    sf.write(path, data, sr, subtype="PCM_16")


def test_musdb_active_instruments_rms_gate():
    """Loud bass+vocals ⇒ included; silent drums+other ⇒ excluded."""
    with tempfile.TemporaryDirectory() as track_dir:
        sr = 44100
        duration = 2  # seconds
        n = sr * duration

        # Loud stems (sine wave at amplitude 0.5 ≫ rms_thresh=0.01)
        loud = (0.5 * np.sin(2 * np.pi * 440 * np.linspace(0, duration, n))).astype(np.float32)
        _write_stem(track_dir, "bass", loud, sr)
        _write_stem(track_dir, "vocals", loud, sr)

        # Silent stems (zeros)
        silent = np.zeros(n, dtype=np.float32)
        _write_stem(track_dir, "drums", silent, sr)
        _write_stem(track_dir, "other", silent, sr)

        result = musdb_active_instruments(track_dir)

    # Both loud instruments must appear
    assert "Vocals" in result
    assert "Bass guitar" in result

    # Silent ones must be absent
    assert "Acoustic kit" not in result
    assert "Other" not in result

    # All returned labels must be in INSTRUMENTS vocab
    for lbl in result:
        assert lbl in INSTRUMENTS, f"{lbl!r} not in INSTRUMENTS"


def test_musdb_active_instruments_all_silent():
    """All-silent track returns empty list."""
    with tempfile.TemporaryDirectory() as track_dir:
        sr = 44100
        n = sr * 1
        silent = np.zeros(n, dtype=np.float32)
        for stem in ("vocals", "drums", "bass", "other"):
            _write_stem(track_dir, stem, silent, sr)

        result = musdb_active_instruments(track_dir)

    assert result == []


def test_musdb_active_instruments_all_loud():
    """All-loud track returns all four mapped labels."""
    with tempfile.TemporaryDirectory() as track_dir:
        sr = 44100
        n = sr * 1
        loud = (0.5 * np.ones(n)).astype(np.float32)
        for stem in ("vocals", "drums", "bass", "other"):
            _write_stem(track_dir, stem, loud, sr)

        result = musdb_active_instruments(track_dir)

    assert set(result) == {"Vocals", "Acoustic kit", "Bass guitar", "Other"}
