"""TDD tests for parallel ingest (task PARALLEL).

Three tests:
  1. test_parallel_count_serial_and_pooled_equal  -- parallel_count with max_workers=1 vs =8
  2. test_idmt_audio_effects_parallel_matches_serial -- deterministic output regardless of workers
  3. test_idmt_instruments_parallel_no_collision   -- no filename collisions under max_workers=8
"""
import json
import os
import threading

import numpy as np
import pytest
import soundfile as sf


def _write_tiny_wav(path, sr=22050, duration=0.1):
    """Write a tiny valid wav to path (creates parent dirs)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    n = int(sr * duration)
    data = (0.3 * np.sin(2 * np.pi * 440 * np.linspace(0, duration, n))).astype(np.float32)
    sf.write(path, data, sr, subtype="PCM_16")


# ---------------------------------------------------------------------------
# Test 1 — parallel_count: serial and pooled return same count and see all items
# ---------------------------------------------------------------------------

def test_parallel_count_serial_and_pooled_equal():
    """parallel_count with max_workers=1 and =8 must return the same count
    and process every item exactly once (truthy worker counts all)."""
    from prep.parallel import parallel_count

    items = list(range(12))
    seen_serial = []
    seen_pooled = []
    lock = threading.Lock()

    def worker_serial(item):
        seen_serial.append(item)
        return True

    def worker_pooled(item):
        with lock:
            seen_pooled.append(item)
        return True

    count_serial = parallel_count(items, worker_serial, max_workers=1)
    count_pooled = parallel_count(items, worker_pooled, max_workers=8)

    # Both must report all items processed
    assert count_serial == len(items), f"serial count {count_serial} != {len(items)}"
    assert count_pooled == len(items), f"pooled count {count_pooled} != {len(items)}"

    # Both workers saw all items
    assert sorted(seen_serial) == items
    assert sorted(seen_pooled) == items


# ---------------------------------------------------------------------------
# Test 2 — ingest_idmt_audio_effects parallel matches serial: identical output set
# ---------------------------------------------------------------------------

def test_idmt_audio_effects_parallel_matches_serial(tmp_path):
    """Run ingest_idmt_audio_effects with max_workers=1 and max_workers=8 into
    separate output dirs.  Assert:
    - Same count returned.
    - Identical SET of output wav/npy/json basenames (prefixes + indices deterministic).
    - EQ skipped in both (count reflects Chorus + NoFX only out of Chorus/NoFX/EQ).
    """
    from prep.ingest import ingest_idmt_audio_effects

    # Build tiny fixture: Gitarre monophon/Samples/{Chorus,NoFX,EQ} each 3 wavs,
    # plus Bass monophon/Samples/{Flanger,NoFX} each 3 wavs → 6+6=12 total, EQ skipped (3)
    root = tmp_path / "extracted"

    for subset, effects in [
        ("Gitarre monophon", ["Chorus", "NoFX", "EQ"]),
        ("Bass monophon",    ["Flanger", "NoFX"]),
    ]:
        for effect in effects:
            effect_dir = root / subset / "Samples" / effect
            effect_dir.mkdir(parents=True, exist_ok=True)
            for i in range(3):
                _write_tiny_wav(str(effect_dir / f"note_{i:02d}.wav"))

    out_serial = tmp_path / "out_serial"
    out_pooled = tmp_path / "out_pooled"

    count_serial = ingest_idmt_audio_effects(str(root), str(out_serial), seed=0,
                                              prefix="idmtfx_", max_workers=1)
    count_pooled = ingest_idmt_audio_effects(str(root), str(out_pooled), seed=0,
                                              prefix="idmtfx_", max_workers=8)

    assert count_serial == count_pooled, (
        f"serial count {count_serial} != pooled count {count_pooled}"
    )

    # EQ clips must be skipped (3 EQ wavs in Gitarre monophon)
    # Gitarre monophon: Chorus=3 + NoFX=3 + EQ=3(skipped) → 6 written
    # Bass monophon:    Flanger=3 + NoFX=3              → 6 written
    # Total: 12 written (15 source wavs minus 3 EQ)
    assert count_serial == 12, f"Expected 12 clips (EQ skipped), got {count_serial}"

    def _basenames(d):
        return {f.rsplit(".", 1)[0] for f in os.listdir(str(d))}

    basenames_serial = _basenames(out_serial)
    basenames_pooled = _basenames(out_pooled)

    assert basenames_serial == basenames_pooled, (
        f"Output filename sets differ:\n  serial:  {sorted(basenames_serial)}\n"
        f"  pooled: {sorted(basenames_pooled)}"
    )


# ---------------------------------------------------------------------------
# Test 3 — ingest_idmt_instruments parallel: no filename collisions
# ---------------------------------------------------------------------------

def test_idmt_instruments_parallel_no_collision(tmp_path):
    """Tiny fixture with idmt_guitar (3 wavs) + idmt_bass (4 wavs).
    Run ingest_idmt_instruments with max_workers=8.
    Assert:
    - on-disk wav count == returned count == total input wavs (7)
    - all output filenames are unique (no collisions)
    """
    from prep.ingest import ingest_idmt_instruments

    masters = tmp_path / "masters"

    # 3 guitar wavs
    for i in range(3):
        _write_tiny_wav(str(masters / "idmt_guitar" / f"guitar_{i:02d}.wav"))

    # 4 bass wavs
    for i in range(4):
        _write_tiny_wav(str(masters / "idmt_bass" / f"bass_{i:02d}.wav"))

    out_dir = tmp_path / "out"

    count = ingest_idmt_instruments(str(masters), str(out_dir), seed=0, max_workers=8)

    # Verify count
    assert count == 7, f"Expected 7 clips written, got {count}"

    # Verify on-disk
    written_wavs = [f for f in os.listdir(str(out_dir)) if f.endswith(".wav")]
    assert len(written_wavs) == 7, (
        f"Expected 7 wav files on disk, got {len(written_wavs)}: {sorted(written_wavs)}"
    )

    # All unique
    assert len(written_wavs) == len(set(written_wavs)), (
        f"Filename collisions detected: {[n for n in written_wavs if written_wavs.count(n) > 1]}"
    )
