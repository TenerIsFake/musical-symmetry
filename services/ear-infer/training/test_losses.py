"""Tests for imbalance-aware loss functions (V2-T1).

TF is optional in CI; skip gracefully if not installed.
"""
import importlib.util
import pytest

tf_missing = importlib.util.find_spec("tensorflow") is None
pytestmark = pytest.mark.skipif(tf_missing, reason="tensorflow not installed in this env")


def test_masked_bce_weighted_reduces_to_bce_when_weight_1():
    """With pos_weight=ones, weighted BCE must match plain masked_bce (atol 1e-4)."""
    import numpy as np
    from model import masked_bce, masked_bce_weighted

    rng = np.random.default_rng(42)
    width = 8
    batch = 6
    y_true = (rng.random((batch, width)) > 0.5).astype("float32")
    y_pred = rng.random((batch, width)).astype("float32") * 0.8 + 0.1  # keep away from 0/1
    mask = np.ones((batch, 1), dtype="float32")
    pos_weight = np.ones(width, dtype="float32")

    loss_bce = float(masked_bce(y_true, y_pred, mask))
    loss_weighted = float(masked_bce_weighted(y_true, y_pred, mask, pos_weight))

    assert abs(loss_bce - loss_weighted) < 1e-4, (
        f"Expected weighted≈bce when weight=1, got bce={loss_bce:.6f} weighted={loss_weighted:.6f}"
    )


def test_masked_bce_weighted_penalizes_missed_positive_more():
    """High pos_weight on a missed-positive class must yield higher loss than weight=1."""
    import numpy as np
    from model import masked_bce_weighted

    width = 4
    # y_true has a positive in class 0 that the pred misses badly
    y_true = np.array([[1.0, 0.0, 0.0, 0.0]], dtype="float32")
    y_pred = np.array([[0.05, 0.05, 0.05, 0.05]], dtype="float32")  # near-zero → big miss
    mask = np.ones((1, 1), dtype="float32")

    pw_1 = np.ones(width, dtype="float32")
    pw_high = np.array([10.0, 1.0, 1.0, 1.0], dtype="float32")  # penalise class-0 miss

    loss_1 = float(masked_bce_weighted(y_true, y_pred, mask, pw_1))
    loss_high = float(masked_bce_weighted(y_true, y_pred, mask, pw_high))

    assert loss_high > loss_1, (
        f"Expected high pos_weight to increase loss, got pw=1: {loss_1:.4f}, pw=10: {loss_high:.4f}"
    )


def test_masked_focal_lower_for_confident():
    """Focal loss properties:
    1. Confident-correct pred yields lower focal loss than uncertain pred.
    2. A batch with mask=0 returns ~0 loss.
    """
    import numpy as np
    from model import masked_focal

    width = 4
    y_true = np.ones((1, width), dtype="float32")
    mask_one = np.ones((1, 1), dtype="float32")

    # Confident correct: pred close to 1 for all classes
    y_pred_confident = np.full((1, width), 0.95, dtype="float32")
    # Uncertain: pred = 0.5
    y_pred_uncertain = np.full((1, width), 0.5, dtype="float32")

    loss_confident = float(masked_focal(y_true, y_pred_confident, mask_one))
    loss_uncertain = float(masked_focal(y_true, y_pred_uncertain, mask_one))

    assert loss_confident < loss_uncertain, (
        f"Expected focal loss to be lower for confident pred: "
        f"confident={loss_confident:.6f}, uncertain={loss_uncertain:.6f}"
    )

    # Masked-out batch → loss ≈ 0
    mask_zero = np.zeros((1, 1), dtype="float32")
    loss_masked_out = float(masked_focal(y_true, y_pred_confident, mask_zero))
    assert abs(loss_masked_out) < 1e-6, (
        f"Expected ~0 loss when mask=0, got {loss_masked_out:.8f}"
    )


def test_compute_pos_weights():
    """compute_pos_weights with a tiny dataset:
    - Class 0 in 'instrument' head: positive in 1 of 4 masked examples → pos_weight ≈ 3.0
    - Class 1 in 'instrument' head: positive in all 4 → pos_weight ≈ clip_min (1.0)
    - Shape must be (width,) per head; values in [clip_min, clip_max].
    """
    import numpy as np
    import tensorflow as tf
    from model import compute_pos_weights

    # Minimal HEADS for this test: just one head with 2 classes
    test_heads = {"instrument": 2}
    clip = (1.0, 50.0)

    # 4 examples, all masked (mask=1)
    # class 0: positive in example 0 only → 1 pos / 3 neg → weight ≈ 3.0
    # class 1: positive in all 4 examples → 4 pos / 0 neg → neg=max(0,0)=0, weight=clip_min=1.0
    labels_np = np.array([
        [1.0, 1.0],
        [0.0, 1.0],
        [0.0, 1.0],
        [0.0, 1.0],
    ], dtype="float32")  # shape (4, 2)
    masks_np = np.ones((4, 1), dtype="float32")
    feats_np = np.zeros((4, 8), dtype="float32")  # dummy features

    # Build a tf.data dataset with the structure (feat, labels_dict, masks_dict)
    labels_ds = [{"instrument": labels_np[i]} for i in range(4)]
    masks_ds = [{"instrument": masks_np[i]} for i in range(4)]
    feats_ds = [feats_np[i] for i in range(4)]

    dataset = tf.data.Dataset.from_tensor_slices((
        feats_np,
        {"instrument": labels_np},
        {"instrument": masks_np},
    ))
    # Batch so compute_pos_weights can unbatch
    dataset = dataset.batch(4)

    result = compute_pos_weights(dataset, heads=test_heads, clip=clip)

    assert "instrument" in result, "Expected 'instrument' key in result"
    pw = result["instrument"]
    assert pw.shape == (2,), f"Expected shape (2,), got {pw.shape}"

    # class 0: 1 pos, 3 neg → 3/1 = 3.0
    assert abs(pw[0] - 3.0) < 0.1, f"Expected pw[0]≈3.0, got {pw[0]:.4f}"
    # class 1: 4 pos, 0 neg → neg=0 → 0/4=0 → clip to 1.0
    assert abs(pw[1] - clip[0]) < 0.1, f"Expected pw[1]≈{clip[0]}, got {pw[1]:.4f}"

    # All values within clip range
    assert float(pw.min()) >= clip[0] - 1e-6, f"Min weight below clip_min: {pw.min()}"
    assert float(pw.max()) <= clip[1] + 1e-6, f"Max weight above clip_max: {pw.max()}"
