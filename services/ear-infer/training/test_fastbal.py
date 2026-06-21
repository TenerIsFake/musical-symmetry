"""Tests for FASTBAL: by-source TFRecord partitioning + fast balanced sampler.

Four tests gated behind pytest.importorskip("tensorflow"):
1. test_by_source_partitions        — --by-source routes each example to the
   correct subdir; counts match iter_clips windows per source.
2. test_fast_balanced_equalizes     — 300 draws from make_balanced_dataset_from_source_dirs
   land each source near 1/3 (fast path, NO filtering).
3. test_fast_balanced_element_spec  — element_spec == make_dataset_from_tfrecords.
4. test_source_dir_missing_renormalizes — tree with only synth+mood (no inst) →
   no crash, each draws ~1/2, no inst examples.
"""
import json
import os
import glob as _glob

import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _classify_by_mask(masks):
    """Return 'synth', 'mood', or 'inst' from a masks dict of (1,) tensors."""
    mi = float(masks["instrument"][0]) > 0.5
    me = float(masks["effects"][0]) > 0.5
    mm = float(masks["mood"][0]) > 0.5

    if me:   return "synth"
    if mm:   return "mood"
    if mi:   return "inst"
    raise ValueError(f"unclassifiable mask: instr={mi} eff={me} mood={mm}")


def _write_source_dir_tree(root, n_mels=None, frames=None,
                           n_synth=6, n_inst=1, n_mood=1):
    """Write a pre-partitioned by-source TFRecord tree under *root*.

    Layout:
        root/synth/part-00000.tfrecord   (n_synth examples)
        root/inst/part-00000.tfrecord    (n_inst  examples)
        root/mood/part-00000.tfrecord    (n_mood  examples)

    Uses serialize_example / _labels_for from dataset.py.
    Returns the root path.
    """
    from dataset import serialize_example, _labels_for, _TFR_N_MELS, _TFR_FRAMES

    if n_mels is None:
        n_mels = _TFR_N_MELS
    if frames is None:
        frames = _TFR_FRAMES

    rng = np.random.default_rng(99)

    for subdir, source, n in [("synth", "synth", n_synth),
                               ("inst",  "real_instrument", n_inst),
                               ("mood",  "real_mood", n_mood)]:
        if n <= 0:
            continue
        sdir = os.path.join(root, subdir)
        os.makedirs(sdir, exist_ok=True)
        writer = tf.io.TFRecordWriter(os.path.join(sdir, "part-00000.tfrecord"))
        for _ in range(n):
            logmel = rng.random((n_mels, frames), dtype=np.float32)
            if source == "synth":
                labels, masks = _labels_for("synth", instrument=["Electric guitar"], effects=None)
            elif source == "real_instrument":
                labels, masks = _labels_for("real_instrument", instrument=["Electric guitar"])
            else:
                labels, masks = _labels_for("real_mood", mood=["dreamy"])
            writer.write(serialize_example(logmel, labels, masks))
        writer.close()

    return root


def _make_tiny_corpus(root, variant="isolated"):
    """Tiny corpus fixture: 2-s synth clip (2 windows) + 1-s mood clip (1 window).

    Mirrors test_tfrecords._make_corpus; returns spec dict.
    """
    import soundfile as sf

    sdir = os.path.join(root, "synth", variant)
    mdir = os.path.join(root, "mood")
    idir = os.path.join(root, "inst")
    os.makedirs(sdir, exist_ok=True)
    os.makedirs(mdir, exist_ok=True)
    os.makedirs(idir, exist_ok=True)

    rng = np.random.default_rng(42)
    synth_audio = (rng.random(32000, dtype=np.float32) * 2 - 1)
    sf.write(os.path.join(sdir, "clip_000001.wav"), synth_audio, 16000)
    np.save(os.path.join(sdir, "clip_000001.effects.npy"), np.zeros(22, np.float32))
    with open(os.path.join(sdir, "clip_000001.instrument.json"), "w") as f:
        json.dump(["Electric guitar"], f)

    rng_mood = np.random.default_rng(123)
    mood_audio = (rng_mood.random(16000, dtype=np.float32) * 2 - 1)
    sf.write(os.path.join(mdir, "track_a.wav"), mood_audio, 16000)
    with open(os.path.join(mdir, "track_a.mood.json"), "w") as f:
        json.dump(["dreamy", "warm"], f)

    # inst dir is empty -> silently skipped by iter_clips
    return {
        "variant": variant,
        "data_root": root,
        "synth_dir": os.path.join(root, "synth"),
        "mood_dir": mdir,
        "inst_dir": idir,
        "clip_seconds": 1.0,
    }


# ---------------------------------------------------------------------------
# Test 1: --by-source partitions correctly
# ---------------------------------------------------------------------------

def test_by_source_partitions(tmp_path):
    """make_tfrecords --by-source routes each example to synth/inst/mood subdirs.

    The tiny corpus: 1 synth file (2s → 2 windows) + 1 mood file (1s → 1 window).
    Expected: synth/ has 2 examples; mood/ has 1 example; inst/ has 0 (no inst clips).
    """
    from prep.make_tfrecords import main as make_tfrecords_main
    from dataset import iter_clips

    root = str(tmp_path / "corpus")
    spec = _make_tiny_corpus(root)
    out_dir = str(tmp_path / "tfr_by_source")
    os.makedirs(out_dir, exist_ok=True)

    make_tfrecords_main([
        "--corpus", root,
        "--out", out_dir,
        "--variant", "isolated",
        "--shards", "2",
        "--by-source",
    ])

    # Compute expected per-source window counts from iter_clips
    expected_per_source = {}
    for _, source, _ in iter_clips(spec):
        # map source → subdir name
        sub = {"synth": "synth", "real_instrument": "inst", "real_mood": "mood"}[source]
        expected_per_source[sub] = expected_per_source.get(sub, 0) + 1

    # Check that present subdirs exist and have the right example counts
    for sub, expected_count in expected_per_source.items():
        sub_dir = os.path.join(out_dir, sub)
        assert os.path.isdir(sub_dir), f"expected subdir {sub_dir} to exist"
        shards = sorted(_glob.glob(os.path.join(sub_dir, "*.tfrecord")))
        assert shards, f"no .tfrecord files in {sub_dir}"
        total = sum(1 for shard in shards for _ in tf.data.TFRecordDataset([shard]))
        assert total == expected_count, (
            f"subdir '{sub}': expected {expected_count} examples, got {total}"
        )

    # Check that there are no cross-source contaminations by verifying mask patterns
    for sub in ("synth", "inst", "mood"):
        sub_dir = os.path.join(out_dir, sub)
        if not os.path.isdir(sub_dir):
            continue
        from dataset import _parse_example, _TFR_N_MELS, _TFR_FRAMES
        shards = sorted(_glob.glob(os.path.join(sub_dir, "*.tfrecord")))
        for shard in shards:
            for raw in tf.data.TFRecordDataset([shard]):
                _, _, masks = _parse_example(raw, _TFR_N_MELS, _TFR_FRAMES)
                got = _classify_by_mask(masks)
                assert got == sub, (
                    f"mask mismatch in {sub}/: expected '{sub}', got '{got}'"
                )


# ---------------------------------------------------------------------------
# Test 2: fast balanced equalizes ~1/3 each
# ---------------------------------------------------------------------------

def test_fast_balanced_equalizes(tmp_path):
    """300 draws from make_balanced_dataset_from_source_dirs with a 6/1/1 tree
    should yield each source in [0.25, 0.42] — proving equal-weight sampling
    overrides the raw imbalance WITHOUT any filter pass.
    """
    from dataset import make_balanced_dataset_from_source_dirs

    root = str(tmp_path / "by_source")
    _write_source_dir_tree(root, n_synth=6, n_inst=1, n_mood=1)

    N = 300
    ds = make_balanced_dataset_from_source_dirs(root, batch_size=1, shuffle=0)

    counts = {"synth": 0, "mood": 0, "inst": 0}
    drawn = 0
    for feat, labels, masks in ds:
        unbatched_masks = {k: v[0] for k, v in masks.items()}
        source = _classify_by_mask(unbatched_masks)
        counts[source] += 1
        drawn += 1
        if drawn >= N:
            break

    assert drawn == N, f"could not draw {N} examples (got {drawn})"

    for src, cnt in counts.items():
        share = cnt / N
        assert 0.25 <= share <= 0.42, (
            f"source '{src}': share={share:.3f} outside [0.25, 0.42] — counts={counts}"
        )


# ---------------------------------------------------------------------------
# Test 3: element_spec parity with make_dataset_from_tfrecords
# ---------------------------------------------------------------------------

def test_fast_balanced_element_spec(tmp_path):
    """make_balanced_dataset_from_source_dirs must have the same element_spec
    as make_dataset_from_tfrecords (shapes, dtypes, dict keys).
    """
    from dataset import make_balanced_dataset_from_source_dirs, make_dataset_from_tfrecords

    root = str(tmp_path / "by_source")
    _write_source_dir_tree(root, n_synth=2, n_inst=1, n_mood=1)

    ds_fast = make_balanced_dataset_from_source_dirs(root, batch_size=4, shuffle=0)

    # Build a plain dataset from all source shards for spec comparison
    all_glob = os.path.join(root, "*", "*.tfrecord")
    ds_plain = make_dataset_from_tfrecords(all_glob, batch_size=4, shuffle=0)

    assert ds_fast.element_spec == ds_plain.element_spec, (
        f"element_spec mismatch:\n"
        f"  fast: {ds_fast.element_spec}\n"
        f"  plain: {ds_plain.element_spec}"
    )


# ---------------------------------------------------------------------------
# Test 4: missing source dir renormalizes without crash
# ---------------------------------------------------------------------------

def test_source_dir_missing_renormalizes(tmp_path):
    """A tree with only synth + mood (no inst/) must not crash.

    The two present sources must each draw ~1/2 (in [0.38, 0.62]).
    No 'inst' examples should appear.
    """
    from dataset import make_balanced_dataset_from_source_dirs

    root = str(tmp_path / "by_source_2")
    # Only synth and mood; n_inst=0 → inst/ subdir not created
    _write_source_dir_tree(root, n_synth=4, n_inst=0, n_mood=4)

    N = 200
    ds = make_balanced_dataset_from_source_dirs(root, batch_size=1, shuffle=0)

    counts = {"synth": 0, "mood": 0, "inst": 0}
    drawn = 0
    for feat, labels, masks in ds:
        unbatched_masks = {k: v[0] for k, v in masks.items()}
        source = _classify_by_mask(unbatched_masks)
        counts[source] += 1
        drawn += 1
        if drawn >= N:
            break

    assert drawn == N, f"only got {drawn}/{N} examples"
    assert counts["inst"] == 0, f"unexpected inst examples: {counts['inst']}"

    for src in ("synth", "mood"):
        share = counts[src] / N
        assert 0.38 <= share <= 0.62, (
            f"source '{src}': share={share:.3f} outside [0.38, 0.62] — counts={counts}"
        )
