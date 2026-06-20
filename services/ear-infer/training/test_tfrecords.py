"""Tests for TFRecord serialization pipeline.

Three tests gated behind pytest.importorskip("tensorflow"):
1. serialize/parse round-trip (row-major flatten/reshape symmetry, dtypes, shapes)
2. make_tfrecords writes shards and total count matches iter_clips
3. THE equivalence test: TFRecord dataset == make_dataset on the same tiny corpus
"""
import json
import os
import glob as _glob

import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")

# ---------------------------------------------------------------------------
# Helpers shared by tests
# ---------------------------------------------------------------------------

def _make_corpus(root, variant="isolated"):
    """Create a tiny synthetic corpus used in tests 2 & 3.

    Corpus layout mirrors test_iter_clips.py:
      - one 2-second synth wav  -> 2 one-second windows
      - one 1-second mood wav   -> 1 window
    Total clips: 3.
    """
    import soundfile as sf

    sdir = root / "synth" / variant
    mdir = root / "mood"
    sdir.mkdir(parents=True)
    mdir.mkdir(parents=True)

    # Generate non-silent audio with distinct content per file using seeds
    # so every clip produces a unique feature fingerprint.
    rng = np.random.default_rng(42)

    # synth: 2s clip @ 16 kHz -> 2 windows (non-silent random audio)
    synth_audio = (rng.random(32000, dtype=np.float32) * 2 - 1)
    sf.write(sdir / "clip_000001.wav", synth_audio, 16000)
    np.save(sdir / "clip_000001.effects.npy", np.zeros(22, np.float32))
    (sdir / "clip_000001.instrument.json").write_text(json.dumps(["Electric guitar"]))

    # mood: 1s clip (different seed to ensure distinct audio)
    rng_mood = np.random.default_rng(123)
    mood_audio = (rng_mood.random(16000, dtype=np.float32) * 2 - 1)
    sf.write(mdir / "track_a.wav", mood_audio, 16000)
    (mdir / "track_a.mood.json").write_text(json.dumps(["dreamy", "warm"]))

    return {
        "variant": variant,
        "data_root": str(root),
        "synth_dir": str(root / "synth"),
        "mood_dir": str(mdir),
        "inst_dir": str(root / "inst"),   # does not exist -> skipped silently
        "clip_seconds": 1.0,
    }


# ---------------------------------------------------------------------------
# Test 1: serialize_example / _parse_example round-trip
# ---------------------------------------------------------------------------

def test_serialize_parse_roundtrip():
    from dataset import serialize_example, _parse_example
    from labels import INSTRUMENTS, EFFECTS, MOOD

    rng = np.random.default_rng(42)
    logmel = rng.random((128, 64), dtype=np.float32)

    labels = {
        "instrument": rng.random(len(INSTRUMENTS), dtype=np.float32),
        "effects":    rng.random(len(EFFECTS),     dtype=np.float32),
        "mood":       rng.random(len(MOOD),         dtype=np.float32),
    }
    masks = {
        "instrument": np.array([1.0], dtype=np.float32),
        "effects":    np.array([1.0], dtype=np.float32),
        "mood":       np.array([0.0], dtype=np.float32),
    }

    serialized = serialize_example(logmel, labels, masks)
    assert isinstance(serialized, bytes), "serialize_example must return bytes"

    feat, lbl_out, msk_out = _parse_example(serialized)

    # --- feature shape, dtype, values ---
    assert feat.shape == (128, 64, 1), f"expected (128,64,1), got {feat.shape}"
    assert feat.dtype == tf.float32
    np.testing.assert_allclose(
        feat.numpy()[..., 0], logmel, atol=1e-6,
        err_msg="logmel round-trip mismatch (row-major flatten/reshape)"
    )

    # --- label vectors ---
    from labels import INSTRUMENTS, EFFECTS, MOOD
    assert lbl_out["instrument"].shape == (len(INSTRUMENTS),)
    assert lbl_out["effects"].shape    == (len(EFFECTS),)
    assert lbl_out["mood"].shape       == (len(MOOD),)
    assert lbl_out["instrument"].dtype == tf.float32

    np.testing.assert_array_equal(lbl_out["instrument"].numpy(), labels["instrument"])
    np.testing.assert_array_equal(lbl_out["effects"].numpy(),    labels["effects"])
    np.testing.assert_array_equal(lbl_out["mood"].numpy(),       labels["mood"])

    # --- masks ---
    assert msk_out["instrument"].shape == (1,)
    assert msk_out["effects"].shape    == (1,)
    assert msk_out["mood"].shape       == (1,)
    assert msk_out["instrument"].dtype == tf.float32

    np.testing.assert_array_equal(msk_out["instrument"].numpy(), masks["instrument"])
    np.testing.assert_array_equal(msk_out["effects"].numpy(),    masks["effects"])
    np.testing.assert_array_equal(msk_out["mood"].numpy(),       masks["mood"])


# ---------------------------------------------------------------------------
# Test 2: make_tfrecords writes shards + count matches iter_clips
# ---------------------------------------------------------------------------

def test_make_tfrecords_writes_shards(tmp_path):
    from prep.make_tfrecords import main as make_tfrecords_main
    from dataset import _parse_example, iter_clips

    spec = _make_corpus(tmp_path)
    out_dir = tmp_path / "tfrecords"
    out_dir.mkdir()

    make_tfrecords_main([
        "--corpus", str(tmp_path),
        "--out",    str(out_dir),
        "--variant", "isolated",
        "--shards", "2",
    ])

    # two shard files must exist
    shards = sorted(_glob.glob(str(out_dir / "part-*.tfrecord")))
    assert len(shards) == 2, f"expected 2 shard files, found: {shards}"

    # total examples == what iter_clips yields
    expected_count = sum(1 for _ in iter_clips(spec))
    total = 0
    for shard in shards:
        for _ in tf.data.TFRecordDataset([shard]):
            total += 1
    assert total == expected_count, (
        f"TFRecord count {total} != iter_clips count {expected_count}"
    )


# ---------------------------------------------------------------------------
# Test 3: TFRecord dataset == make_dataset (the equivalence test)
# ---------------------------------------------------------------------------

def test_tfrecord_dataset_matches_make_dataset(tmp_path):
    """THE gate: TFRecord dataset must yield the same feature arrays and
    label/mask vectors as make_dataset on the same tiny corpus.

    Order may differ (sharding), so we compare by a hash of the feature tensor.
    Element specs (shapes/dtypes) must also be identical.
    """
    from prep.make_tfrecords import main as make_tfrecords_main
    from dataset import make_dataset, make_dataset_from_tfrecords

    spec = _make_corpus(tmp_path)
    out_dir = tmp_path / "tfrecords"
    out_dir.mkdir()

    make_tfrecords_main([
        "--corpus", str(tmp_path),
        "--out",    str(out_dir),
        "--variant", "isolated",
        "--shards", "2",
    ])

    # --- collect from make_dataset (shuffle=0 for determinism) ---
    ds_wav = make_dataset(spec, n_mels=128, frames=64, batch_size=1, shuffle=0)
    wav_examples = []
    for feat, labels, masks in ds_wav:
        wav_examples.append((
            feat.numpy().squeeze(),           # (128, 64)
            {k: v.numpy().squeeze() for k, v in labels.items()},
            {k: v.numpy().squeeze() for k, v in masks.items()},
        ))

    # --- collect from make_dataset_from_tfrecords (shuffle=0) ---
    tfr_glob = str(out_dir / "part-*.tfrecord")
    ds_tfr = make_dataset_from_tfrecords(tfr_glob, n_mels=128, frames=64, batch_size=1, shuffle=0)
    tfr_examples = []
    for feat, labels, masks in ds_tfr:
        tfr_examples.append((
            feat.numpy().squeeze(),
            {k: v.numpy().squeeze() for k, v in labels.items()},
            {k: v.numpy().squeeze() for k, v in masks.items()},
        ))

    # --- element spec must match ---
    assert ds_wav.element_spec == ds_tfr.element_spec, (
        f"element_spec mismatch:\n  wav: {ds_wav.element_spec}\n  tfr: {ds_tfr.element_spec}"
    )

    # --- same count ---
    assert len(wav_examples) == len(tfr_examples), (
        f"count mismatch: wav={len(wav_examples)}, tfr={len(tfr_examples)}"
    )

    # --- compare as sets (order may differ due to sharding) ---
    def _fingerprint(feat_arr):
        """Stable float32 hash for sorting/matching."""
        return tuple(feat_arr.flatten().round(5).tolist())

    wav_by_fp = {_fingerprint(f): (f, l, m) for f, l, m in wav_examples}
    tfr_by_fp = {_fingerprint(f): (f, l, m) for f, l, m in tfr_examples}

    assert set(wav_by_fp.keys()) == set(tfr_by_fp.keys()), (
        "feature fingerprint sets do not match — TFRecord and wav pipelines yield different clips"
    )

    # Assert that we have distinct fingerprints (one per clip, not deduped)
    # This ensures the fixture generates non-identical audio per file.
    expected_clip_count = 3  # 2 synth windows + 1 mood window
    assert len(wav_by_fp) == expected_clip_count, (
        f"expected {expected_clip_count} distinct fingerprints, got {len(wav_by_fp)}"
    )

    for fp in wav_by_fp:
        wav_feat, wav_lbl, wav_msk = wav_by_fp[fp]
        tfr_feat, tfr_lbl, tfr_msk = tfr_by_fp[fp]

        np.testing.assert_allclose(tfr_feat, wav_feat, atol=1e-6,
                                   err_msg=f"feature mismatch for clip fingerprint {fp[:3]}...")

        for head in ("instrument", "effects", "mood"):
            np.testing.assert_array_equal(
                tfr_lbl[head], wav_lbl[head],
                err_msg=f"label[{head}] mismatch"
            )
            np.testing.assert_array_equal(
                tfr_msk[head], wav_msk[head],
                err_msg=f"mask[{head}] mismatch"
            )


# ---------------------------------------------------------------------------
# Test 4: --max-windows-per-clip CLI arg flows through to TFRecord count
# ---------------------------------------------------------------------------

def test_make_tfrecords_max_windows_per_clip(tmp_path):
    """Verify --max-windows-per-clip limits windows written to TFRecords.

    The test corpus has:
      - one 2s synth clip -> 2 windows by default
      - one 1s mood clip -> 1 window by default
    Total: 3 examples by default.

    With --max-windows-per-clip 1, each file is capped to 1 window:
      - synth file: 1 window (capped from 2)
      - mood file: 1 window (unchanged)
    Total: 2 examples.
    """
    from prep.make_tfrecords import main as make_tfrecords_main
    from dataset import iter_clips

    spec = _make_corpus(tmp_path)
    out_dir = tmp_path / "tfrecords"
    out_dir.mkdir()

    # Run with --max-windows-per-clip 1
    total = make_tfrecords_main([
        "--corpus", str(tmp_path),
        "--out",    str(out_dir),
        "--variant", "isolated",
        "--shards", "2",
        "--max-windows-per-clip", "1",
    ])

    # Verify the returned count matches 2 (not 3)
    assert total == 2, f"expected 2 examples with cap=1, got {total}"

    # Also verify by reading back the shards
    shard_files = sorted(_glob.glob(str(out_dir / "part-*.tfrecord")))
    shard_total = 0
    for shard in shard_files:
        for _ in tf.data.TFRecordDataset([shard]):
            shard_total += 1
    assert shard_total == 2, f"shard count {shard_total} != expected 2"
