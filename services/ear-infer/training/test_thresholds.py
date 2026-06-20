"""Tests for tune_thresholds.py pure-function helpers + eval.py threshold loading.

Pure-function tests (best_threshold, macro_f1_over_supported) do NOT need
TensorFlow and are never skipped by importorskip — they only use numpy and the
helpers factored out of tune_thresholds.py / metrics.py.

Tests that import eval.py (which imports tensorflow) are individually guarded
with pytest.importorskip("tensorflow") inside the test body.
"""
import json
import os
import sys
import tempfile

import numpy as np
import pytest

# ---------------------------------------------------------------------------
# Helpers imported from production modules (pure-numpy, no TF)
# ---------------------------------------------------------------------------
from metrics import macro_f1_over_supported
from tune_thresholds import best_threshold


# ---------------------------------------------------------------------------
# test_tune_picks_better_threshold  (pure numpy — never skipped)
# ---------------------------------------------------------------------------

def test_tune_picks_better_threshold():
    """best_threshold should pick < 0.5 when positives cluster around prob ~0.3.

    Scenario: 100 clips, 3 classes.
    - Class 0: always negative (prob ~0.05), true = 0.
    - Class 1: always positive (prob ~0.30), true = 1.
    - Class 2: always negative (prob ~0.05), true = 0.

    At threshold=0.5, class 1 is never predicted → F1=0.
    At threshold=0.2 (or 0.25), class 1 fires correctly → F1=high.
    """
    rng = np.random.default_rng(42)
    n = 100

    # probs shape: (n, 3)
    probs = np.column_stack([
        rng.uniform(0.02, 0.08, n),   # class 0: always negative
        rng.uniform(0.25, 0.35, n),   # class 1: always positive, prob ~0.3
        rng.uniform(0.02, 0.08, n),   # class 2: always negative
    ])

    trues = np.zeros((n, 3), dtype=np.int32)
    trues[:, 1] = 1  # only class 1 is positive

    grid = np.arange(0.05, 0.55, 0.05)
    chosen_thresh, best_f1 = best_threshold(probs, trues, grid)

    # Must pick something below the 0.5 default
    assert chosen_thresh < 0.5, (
        f"Expected threshold < 0.5, got {chosen_thresh:.2f}"
    )
    # The F1 at the chosen threshold must beat 0.5-threshold F1
    preds_at_half = (probs >= 0.5).astype(np.int32)
    f1_at_half = macro_f1_over_supported(trues, preds_at_half)
    assert best_f1 > f1_at_half, (
        f"best_f1={best_f1:.3f} should exceed f1_at_half={f1_at_half:.3f}"
    )


# ---------------------------------------------------------------------------
# test_macro_supported_ignores_zero_support  (pure numpy — never skipped)
# ---------------------------------------------------------------------------

def test_macro_supported_ignores_zero_support():
    """macro_f1_over_supported must average only classes with support > 0.

    Setup: 5 classes, but classes 3 and 4 never appear in trues.
    Classes 0-2 each have a clean F1 of 1.0.
    macro-over-all would divide by 5 (diluted by 0-F1 classes).
    macro-over-supported averages only the 3 supported classes → F1=1.0.
    """
    n = 20
    # perfect predictions for classes 0-2; classes 3-4 absent
    trues = np.zeros((n, 5), dtype=np.int32)
    preds = np.zeros((n, 5), dtype=np.int32)
    for c in range(3):
        trues[:, c] = 1
        preds[:, c] = 1  # perfect recall+precision

    macro_supported = macro_f1_over_supported(trues, preds)
    # All 3 supported classes have F1=1.0 → mean = 1.0
    assert abs(macro_supported - 1.0) < 1e-6, (
        f"macro_f1_over_supported should be 1.0, got {macro_supported:.4f}"
    )

    # Also verify it differs from a naive macro-over-all-5
    # Classes 3,4: support=0, prediction=0 → sklearn gives F1=0.0 for each
    from sklearn.metrics import f1_score
    macro_all = f1_score(trues, preds, average="macro", zero_division=0)
    assert macro_supported > macro_all, (
        f"macro_supported ({macro_supported:.3f}) should exceed macro_all ({macro_all:.3f})"
    )


# ---------------------------------------------------------------------------
# test_eval_loads_thresholds_json  (needs tensorflow via eval import)
# ---------------------------------------------------------------------------

def test_eval_loads_thresholds_json():
    """eval._load_thresholds should load a JSON and default missing heads to 0.5.

    Tests both the flat schema (backward-compat) and the nested schema written
    by tune_thresholds.py after the V2-T3 whole-branch review fix.
    """
    pytest.importorskip("tensorflow")
    from eval import _load_thresholds
    from model import HEADS

    # --- Flat schema (backward-compat): {"instrument":0.35, "effects":0.40} ---
    partial = {"instrument": 0.35, "effects": 0.40}
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(partial, f)
        thresh_path = f.name

    try:
        loaded = _load_thresholds(thresh_path)
        assert loaded["instrument"] == 0.35
        assert loaded["effects"] == 0.40
        # Missing heads default to 0.5
        assert loaded["mood"] == 0.5
        # All HEADS keys present
        assert set(loaded.keys()) == set(HEADS)
    finally:
        os.unlink(thresh_path)

    # --- Nested schema written by tune_thresholds.py after whole-branch fix ---
    nested = {
        "thresholds": {"instrument": 0.30, "effects": 0.35, "mood": 0.45},
        "_meta": {"tuned_on": "val/*.tfrecord", "macro_f1_supported": {"instrument": 0.72}},
    }
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(nested, f)
        nested_path = f.name

    try:
        loaded_nested = _load_thresholds(nested_path)
        assert loaded_nested["instrument"] == 0.30
        assert loaded_nested["effects"] == 0.35
        assert loaded_nested["mood"] == 0.45
        assert set(loaded_nested.keys()) == set(HEADS)
    finally:
        os.unlink(nested_path)

    # --- With None path: all heads default to 0.5 ---
    defaults = _load_thresholds(None)
    assert all(v == 0.5 for v in defaults.values())
    assert set(defaults.keys()) == set(HEADS)


# ---------------------------------------------------------------------------
# Fix 2: Cross-module schema lock test
# Producer (tune_thresholds) → consumer (eval + infer) round-trip
# ---------------------------------------------------------------------------

def test_sidecar_schema_roundtrip_both_loaders():
    """Both eval._load_thresholds and infer._load_thresholds must read the exact
    dict that tune_thresholds.main writes (nested schema).

    This is the producer→consumer schema lock: a head-key rename in one module
    breaks this test.

    infer is imported via sys.path manipulation matching how test_infer.py works.
    """
    pytest.importorskip("tensorflow")
    from eval import _load_thresholds as eval_load

    # Add the ear-infer serving dir to sys.path so we can import infer
    ear_infer_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if ear_infer_dir not in sys.path:
        sys.path.insert(0, ear_infer_dir)
    from infer import _load_thresholds as infer_load

    # Build the EXACT dict tune_thresholds.main writes (nested schema)
    chosen = {"instrument": 0.3, "effects": 0.25, "mood": 0.45}
    achieved_f1 = {"instrument": 0.72, "effects": 0.68, "mood": 0.55}
    sidecar = {
        "thresholds": chosen,
        "_meta": {
            "tuned_on": "val/shard-*.tfrecord",
            "macro_f1_supported": achieved_f1,
        },
    }

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(sidecar, f)
        sidecar_path = f.name

    try:
        # eval loader
        eval_result = eval_load(sidecar_path)
        assert eval_result["instrument"] == 0.3, f"eval instrument: {eval_result}"
        assert eval_result["effects"] == 0.25, f"eval effects: {eval_result}"
        assert eval_result["mood"] == 0.45, f"eval mood: {eval_result}"

        # infer loader (uses EAR_INFER_THRESHOLDS env var path)
        import os as _os
        old_env = _os.environ.get("EAR_INFER_THRESHOLDS")
        _os.environ["EAR_INFER_THRESHOLDS"] = sidecar_path
        try:
            infer_result = infer_load(None)
        finally:
            if old_env is None:
                _os.environ.pop("EAR_INFER_THRESHOLDS", None)
            else:
                _os.environ["EAR_INFER_THRESHOLDS"] = old_env

        assert infer_result["instrument"] == 0.3, f"infer instrument: {infer_result}"
        assert infer_result["effects"] == 0.25, f"infer effects: {infer_result}"
        assert infer_result["mood"] == 0.45, f"infer mood: {infer_result}"

        # Both loaders must agree
        assert eval_result == infer_result, (
            f"eval and infer disagree: eval={eval_result} infer={infer_result}"
        )
    finally:
        os.unlink(sidecar_path)


def test_sidecar_flat_schema_still_loads():
    """Flat schema {"instrument":..} must still load in both eval and infer loaders.

    Backward-compat guard: sidecars written before the nested-schema fix must
    still work.
    """
    pytest.importorskip("tensorflow")
    from eval import _load_thresholds as eval_load

    ear_infer_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if ear_infer_dir not in sys.path:
        sys.path.insert(0, ear_infer_dir)
    from infer import _load_thresholds as infer_load

    flat = {"instrument": 0.2, "effects": 0.15, "mood": 0.3}

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(flat, f)
        flat_path = f.name

    try:
        eval_result = eval_load(flat_path)
        assert eval_result == flat, f"eval flat: {eval_result}"

        import os as _os
        old_env = _os.environ.get("EAR_INFER_THRESHOLDS")
        _os.environ["EAR_INFER_THRESHOLDS"] = flat_path
        try:
            infer_result = infer_load(None)
        finally:
            if old_env is None:
                _os.environ.pop("EAR_INFER_THRESHOLDS", None)
            else:
                _os.environ["EAR_INFER_THRESHOLDS"] = old_env

        assert infer_result == flat, f"infer flat: {infer_result}"
    finally:
        os.unlink(flat_path)


def test_same_shard_warning_fires(capsys):
    """eval._load_thresholds must warn to stderr when tuned_on == tfrecords_glob."""
    pytest.importorskip("tensorflow")
    from eval import _load_thresholds

    glob = "test/shard-*.tfrecord"
    sidecar = {
        "thresholds": {"instrument": 0.3, "effects": 0.25, "mood": 0.45},
        "_meta": {"tuned_on": glob, "macro_f1_supported": {}},
    }

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(sidecar, f)
        sidecar_path = f.name

    try:
        _load_thresholds(sidecar_path, tfrecords_glob=glob)
        captured = capsys.readouterr()
        assert "WARNING" in captured.err, (
            f"Expected WARNING in stderr, got: {captured.err!r}"
        )
        assert glob in captured.err, (
            f"Expected glob in warning message, got: {captured.err!r}"
        )
    finally:
        os.unlink(sidecar_path)


def test_different_shard_no_warning(capsys):
    """eval._load_thresholds must NOT warn when tuned_on != tfrecords_glob."""
    pytest.importorskip("tensorflow")
    from eval import _load_thresholds

    sidecar = {
        "thresholds": {"instrument": 0.3, "effects": 0.25, "mood": 0.45},
        "_meta": {"tuned_on": "val/shard-*.tfrecord", "macro_f1_supported": {}},
    }

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(sidecar, f)
        sidecar_path = f.name

    try:
        _load_thresholds(sidecar_path, tfrecords_glob="test/shard-*.tfrecord")
        captured = capsys.readouterr()
        assert "WARNING" not in captured.err, (
            f"Unexpected WARNING in stderr: {captured.err!r}"
        )
    finally:
        os.unlink(sidecar_path)
