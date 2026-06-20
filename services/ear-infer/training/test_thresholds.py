"""Tests for tune_thresholds.py pure-function helpers + eval.py threshold loading.

All tests guard against tflite/GPU unavailability via pytest.importorskip("tensorflow").
Pure-function tests (best_threshold, macro_f1_over_supported) do NOT need a real model;
they only need numpy + the pure helpers factored out of tune_thresholds.py.
"""
import json
import os
import tempfile

import numpy as np
import pytest

pytest.importorskip("tensorflow")

# ---------------------------------------------------------------------------
# Helpers imported from production modules
# ---------------------------------------------------------------------------
from metrics import macro_f1_over_supported
from tune_thresholds import best_threshold


# ---------------------------------------------------------------------------
# test_tune_picks_better_threshold
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
# test_macro_supported_ignores_zero_support
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
# test_eval_loads_thresholds_json
# ---------------------------------------------------------------------------

def test_eval_loads_thresholds_json():
    """eval._load_thresholds should load a JSON and default missing heads to 0.5."""
    from eval import _load_thresholds
    from model import HEADS

    # --- With a valid thresholds JSON (partial) ---
    partial = {"instrument": 0.35, "effects": 0.40}
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False
    ) as f:
        json.dump(partial, f)
        thresh_path = f.name

    try:
        # Test loading from file
        loaded = _load_thresholds(thresh_path)
        assert loaded["instrument"] == 0.35
        assert loaded["effects"] == 0.40
        # Missing heads default to 0.5
        assert loaded["mood"] == 0.5
        # All HEADS keys present
        assert set(loaded.keys()) == set(HEADS)
    finally:
        os.unlink(thresh_path)

    # --- With None path: all heads default to 0.5 ---
    defaults = _load_thresholds(None)
    assert all(v == 0.5 for v in defaults.values())
    assert set(defaults.keys()) == set(HEADS)
