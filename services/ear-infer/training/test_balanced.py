"""Tests for source-balanced sampling (BALANCED feature, task V2-T4).

Three tests gated behind pytest.importorskip("tensorflow"):
1. test_filters_partition_by_source   — 3 filter predicates select exactly the
   known synth(6)/mood(1)/inst(1) counts from a controlled fixture.
2. test_balanced_equalizes_sources    — ~300 draws from make_balanced_dataset
   land each source near 1/3, proving rare sources are no longer starved.
3. test_balanced_element_spec_matches — element_spec equals make_dataset_from_tfrecords.
"""
import os
import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")


# ---------------------------------------------------------------------------
# Fixture builder: 6 synth + 1 mood + 1 real_instrument examples
# ---------------------------------------------------------------------------

def _write_balanced_fixture(out_dir, n_mels=128, frames=64):
    """Write 8 TFRecord examples with a controlled source mix.

    Sources are encoded via mask patterns per the brief:
      synth           -> instrument=1, effects=1, mood=0
      real_instrument -> instrument=1, effects=0, mood=0
      real_mood       -> instrument=0, effects=0, mood=1

    Returns (path_glob, counts) where counts = {"synth":6,"mood":1,"inst":1}.
    """
    from dataset import serialize_example, _labels_for
    from labels import INSTRUMENTS, EFFECTS, MOOD

    rng = np.random.default_rng(7)
    shard_path = os.path.join(out_dir, "balanced-fixture.tfrecord")
    writer = tf.io.TFRecordWriter(shard_path)

    # 6 synth examples
    for _ in range(6):
        logmel = rng.random((n_mels, frames), dtype=np.float32)
        labels, masks = _labels_for(
            "synth",
            instrument=["Electric guitar"],
            effects=None,
            mood=None,
        )
        writer.write(serialize_example(logmel, labels, masks))

    # 1 real_mood example
    logmel = rng.random((n_mels, frames), dtype=np.float32)
    labels, masks = _labels_for("real_mood", mood=["dreamy"])
    writer.write(serialize_example(logmel, labels, masks))

    # 1 real_instrument example
    logmel = rng.random((n_mels, frames), dtype=np.float32)
    labels, masks = _labels_for("real_instrument", instrument=["Electric guitar"])
    writer.write(serialize_example(logmel, labels, masks))

    writer.close()
    glob_pattern = os.path.join(out_dir, "balanced-fixture.tfrecord")
    return glob_pattern, {"synth": 6, "mood": 1, "inst": 1}


# ---------------------------------------------------------------------------
# Helper: classify a single (unbatched) example by mask pattern
# ---------------------------------------------------------------------------

def _classify_by_mask(masks):
    """Return 'synth', 'mood', or 'inst' from a masks dict of (1,) tensors."""
    mi = float(masks["instrument"][0]) > 0.5
    me = float(masks["effects"][0]) > 0.5
    mm = float(masks["mood"][0]) > 0.5

    if me:                          # effects=1 → synth
        return "synth"
    if mm:                          # mood=1 → real_mood
        return "mood"
    if mi:                          # instrument=1, effects=0, mood=0 → real_instrument
        return "inst"
    raise ValueError(f"unclassifiable mask: instr={mi} eff={me} mood={mm}")


# ---------------------------------------------------------------------------
# Test 1: filter predicates partition the fixture by source
# ---------------------------------------------------------------------------

def test_filters_partition_by_source(tmp_path):
    """The three is_synth / is_mood / is_real_instrument predicates select
    exactly the expected counts from the known 6+1+1 fixture.
    """
    from dataset import (
        _parse_example, is_synth, is_mood, is_real_instrument,
        _TFR_N_MELS, _TFR_FRAMES,
    )

    tfr_path, expected = _write_balanced_fixture(str(tmp_path))

    base = (
        tf.data.TFRecordDataset([tfr_path])
        .map(lambda s: _parse_example(s, _TFR_N_MELS, _TFR_FRAMES),
             num_parallel_calls=1)
    )

    def _count(ds_filtered):
        return sum(1 for _ in ds_filtered)

    n_synth = _count(base.filter(is_synth))
    n_mood  = _count(base.filter(is_mood))
    n_inst  = _count(base.filter(is_real_instrument))

    assert n_synth == expected["synth"], f"synth: expected {expected['synth']}, got {n_synth}"
    assert n_mood  == expected["mood"],  f"mood:  expected {expected['mood']},  got {n_mood}"
    assert n_inst  == expected["inst"],  f"inst:  expected {expected['inst']},  got {n_inst}"

    # Verify exhaustive partition: no overlap, union = total
    total = sum(1 for _ in base)
    assert n_synth + n_mood + n_inst == total, (
        f"filters are not a partition: {n_synth}+{n_mood}+{n_inst} != {total}"
    )


# ---------------------------------------------------------------------------
# Test 2: balanced sampling equalises sources (~1/3 each over ~300 draws)
# ---------------------------------------------------------------------------

def test_balanced_equalizes_sources(tmp_path):
    """take 300 examples from make_balanced_dataset_from_tfrecords with equal
    weights; assert each source's share is in [0.25, 0.42].

    Without balancing the raw distribution is 6/8=75% synth, 12.5% each for
    mood and inst.  The balanced ds must pull all three near 33%.
    """
    from dataset import make_balanced_dataset_from_tfrecords

    tfr_path, _ = _write_balanced_fixture(str(tmp_path))

    N = 300
    ds = make_balanced_dataset_from_tfrecords(
        tfr_path,
        weights=[1 / 3, 1 / 3, 1 / 3],
        batch_size=1,
        shuffle=0,
    )

    counts = {"synth": 0, "mood": 0, "inst": 0}
    drawn = 0
    for feat, labels, masks in ds:
        # unbatch: squeeze the batch-1 dimension for masks
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
            f"source '{src}': share={share:.3f} is outside [0.25, 0.42] — "
            f"counts={counts}"
        )


# ---------------------------------------------------------------------------
# Test 3: element_spec matches make_dataset_from_tfrecords
# ---------------------------------------------------------------------------

def test_balanced_element_spec_matches(tmp_path):
    """make_balanced_dataset_from_tfrecords must have the same element_spec
    (shapes, dtypes, dict keys) as make_dataset_from_tfrecords.
    """
    from dataset import make_balanced_dataset_from_tfrecords, make_dataset_from_tfrecords

    tfr_path, _ = _write_balanced_fixture(str(tmp_path))

    ds_plain    = make_dataset_from_tfrecords(tfr_path, batch_size=4, shuffle=0)
    ds_balanced = make_balanced_dataset_from_tfrecords(tfr_path, batch_size=4, shuffle=0)

    assert ds_balanced.element_spec == ds_plain.element_spec, (
        f"element_spec mismatch:\n"
        f"  balanced: {ds_balanced.element_spec}\n"
        f"  plain:    {ds_plain.element_spec}"
    )
