"""Tests for quantize.py representative_dataset with TFRecords support."""
import argparse
import json
import glob as _glob

import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")


def _make_tiny_tfrecord_corpus(root):
    """Create a minimal TFRecord corpus for testing quantize.representative_dataset.

    Writes a single TFRecord shard with 2 examples. Reuses the pattern from test_tfrecords.py.
    A 2-second synth clip yields 2 one-second windows.
    """
    import soundfile as sf
    from prep.make_tfrecords import main as make_tfrecords_main

    sdir = root / "synth" / "isolated"
    mdir = root / "mood"
    sdir.mkdir(parents=True)
    mdir.mkdir(parents=True)

    # Generate 2-second audio (yields 2 windows of 1 second each)
    rng = np.random.default_rng(42)
    synth_audio = (rng.random(32000, dtype=np.float32) * 2 - 1)
    sf.write(sdir / "clip_test.wav", synth_audio, 16000)
    np.save(sdir / "clip_test.effects.npy", np.zeros(22, np.float32))
    (sdir / "clip_test.instrument.json").write_text(json.dumps(["Electric guitar"]))

    # Create TFRecords
    out_dir = root / "tfrecords"
    out_dir.mkdir()
    make_tfrecords_main([
        "--corpus", str(root),
        "--out", str(out_dir),
        "--variant", "isolated",
        "--shards", "1",
    ])

    return str(out_dir / "part-*.tfrecord")


def test_quantize_representative_from_tfrecords(tmp_path):
    """Test that representative_dataset yields correct shapes from TFRecords.

    Creates a tiny TFRecord, builds args with --tfrecords, calls
    representative_dataset, and verifies it yields (1,128,64,1) tensors.
    """
    from quantize import representative_dataset, parse_args

    # Create TFRecord corpus
    tfr_glob = _make_tiny_tfrecord_corpus(tmp_path)

    # Build args namespace (simulating argparse result)
    args = argparse.Namespace(
        tfrecords=tfr_glob,
        rep_data=None,
        n_mels=128,
        frames=64,
        rep_samples=2
    )

    # Iterate the representative_dataset generator
    yielded = []
    for item in representative_dataset(args):
        yielded.append(item)

    # Check we got 2 items (matching rep_samples)
    assert len(yielded) == 2, f"expected 2 items, got {len(yielded)}"

    # Each item is a list with one tensor
    for item in yielded:
        assert isinstance(item, list), f"item should be a list, got {type(item)}"
        assert len(item) == 1, f"item list should have 1 element, got {len(item)}"

        feat = item[0]
        assert feat.shape == (1, 128, 64, 1), f"expected (1,128,64,1), got {feat.shape}"
        assert feat.dtype == tf.float32, f"expected float32, got {feat.dtype}"


def test_quantize_args_require_rep_data_or_tfrecords(tmp_path):
    """Test that parse_args requires at least one of --rep-data or --tfrecords."""
    from quantize import parse_args

    # Neither --rep-data nor --tfrecords: should error
    with pytest.raises(SystemExit):
        parse_args([
            "--saved-model", str(tmp_path / "model"),
            "--out", str(tmp_path / "model.tflite"),
            # missing both --rep-data and --tfrecords
        ])

    # --rep-data alone: OK
    args = parse_args([
        "--saved-model", str(tmp_path / "model"),
        "--out", str(tmp_path / "model.tflite"),
        "--rep-data", str(tmp_path / "data"),
    ])
    assert args.rep_data == str(tmp_path / "data")
    assert args.tfrecords is None

    # --tfrecords alone: OK
    args = parse_args([
        "--saved-model", str(tmp_path / "model"),
        "--out", str(tmp_path / "model.tflite"),
        "--tfrecords", str(tmp_path / "*.tfrecord"),
    ])
    assert args.tfrecords == str(tmp_path / "*.tfrecord")
    assert args.rep_data is None

    # Both: OK (tfrecords takes precedence in representative_dataset)
    args = parse_args([
        "--saved-model", str(tmp_path / "model"),
        "--out", str(tmp_path / "model.tflite"),
        "--rep-data", str(tmp_path / "data"),
        "--tfrecords", str(tmp_path / "*.tfrecord"),
    ])
    assert args.tfrecords == str(tmp_path / "*.tfrecord")
    assert args.rep_data == str(tmp_path / "data")
