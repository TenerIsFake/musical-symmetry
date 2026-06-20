"""Tests for --loss flag wiring in train.py (V2-T2).

Two tests gated behind pytest.importorskip("tensorflow"):
1. test_parse_args_loss_choices: verifies --loss CLI arg parses correctly.
2. test_train_runs_each_loss: runs train() for 1 epoch under bce/posweight/focal
   on a tiny TFRecord dataset; asserts the SavedModel dir is written for each.
"""
import json
import os
import glob as _glob
import tempfile

import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")


# ---------------------------------------------------------------------------
# Tiny TFRecord fixture helper (adapted from test_tfrecords.py pattern)
# ---------------------------------------------------------------------------

def _write_tiny_tfrecords(out_dir, n_mels=128, frames=64, n_examples=4):
    """Write a tiny synthetic TFRecord with n_examples for fast training tests.

    Each example has:
      - feats: (n_mels, frames, 1) float32 logmel (random)
      - labels: {head: (width,) float32} from HEADS
      - masks:  {head: (1,) float32} alternating 1/0 per example
    """
    from dataset import serialize_example
    from labels import INSTRUMENTS, EFFECTS, MOOD

    rng = np.random.default_rng(0)
    shard_path = os.path.join(out_dir, "part-00000.tfrecord")
    writer = tf.io.TFRecordWriter(shard_path)

    heads_widths = {
        "instrument": len(INSTRUMENTS),
        "effects": len(EFFECTS),
        "mood": len(MOOD),
    }

    for i in range(n_examples):
        logmel = rng.random((n_mels, frames), dtype=np.float32)
        labels = {h: rng.random(w).astype(np.float32) for h, w in heads_widths.items()}
        # alternate masks so posweight has some positives to count
        masks = {h: np.array([float(i % 2 == 0)], dtype=np.float32) for h in heads_widths}
        writer.write(serialize_example(logmel, labels, masks))

    writer.close()
    return str(out_dir / "part-*.tfrecord") if hasattr(out_dir, "__truediv__") else os.path.join(out_dir, "part-*.tfrecord")


# ---------------------------------------------------------------------------
# Test 1: parse_args --loss choices
# ---------------------------------------------------------------------------

def test_parse_args_loss_choices():
    """--loss focal parses; default is bce; invalid choice errors."""
    from train import parse_args

    # explicit focal
    args = parse_args(["--tfrecords", "x", "--model", "isolated", "--out", "o", "--loss", "focal"])
    assert args.loss == "focal"

    # default is bce
    args_default = parse_args(["--tfrecords", "x", "--model", "isolated", "--out", "o"])
    assert args_default.loss == "bce"

    # posweight choice
    args_pw = parse_args(["--tfrecords", "x", "--model", "isolated", "--out", "o", "--loss", "posweight"])
    assert args_pw.loss == "posweight"

    # focal-gamma / focal-alpha defaults
    assert args.focal_gamma == 2.0
    assert args.focal_alpha == 0.25

    # invalid choice raises SystemExit
    with pytest.raises(SystemExit):
        parse_args(["--tfrecords", "x", "--model", "isolated", "--out", "o", "--loss", "invalid"])


# ---------------------------------------------------------------------------
# Test 2: train() runs for 1 epoch under each loss mode
# ---------------------------------------------------------------------------

def test_train_runs_each_loss(tmp_path):
    """Smoke-test: each of bce/posweight/focal runs 1 epoch without error and
    writes the SavedModel output directory. No accuracy assertions — just shape
    correctness and that the path exists.
    """
    from train import parse_args, train
    from dataset import make_dataset_from_tfrecords

    # Write tiny TFRecords once; reuse for all three runs
    tfr_dir = tmp_path / "tfrecords"
    tfr_dir.mkdir()
    _write_tiny_tfrecords(tfr_dir, n_mels=128, frames=64, n_examples=4)
    tfr_glob = str(tfr_dir / "part-*.tfrecord")

    for loss_mode in ("bce", "posweight", "focal"):
        out_dir = str(tmp_path / f"model_{loss_mode}")
        argv = [
            "--tfrecords", tfr_glob,
            "--model", "isolated",
            "--out", out_dir,
            "--epochs", "1",
            "--batch-size", "4",
            "--loss", loss_mode,
        ]
        if loss_mode == "focal":
            argv += ["--focal-gamma", "1.5", "--focal-alpha", "0.3"]

        args = parse_args(argv)
        model = train(args)

        # SavedModel directory must exist and contain at least saved_model.pb
        assert os.path.isdir(out_dir), (
            f"loss={loss_mode}: expected SavedModel dir at {out_dir}"
        )
        pb_candidates = (
            _glob.glob(os.path.join(out_dir, "saved_model.pb")) +
            _glob.glob(os.path.join(out_dir, "*.keras")) +
            _glob.glob(os.path.join(out_dir, "**", "saved_model.pb"), recursive=True)
        )
        assert pb_candidates or os.listdir(out_dir), (
            f"loss={loss_mode}: output dir exists but appears empty: {os.listdir(out_dir)}"
        )
