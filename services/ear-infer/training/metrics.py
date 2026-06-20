"""Shared metric utilities for threshold tuning and evaluation."""
import numpy as np
from sklearn.metrics import f1_score


def macro_f1_over_supported(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Macro-F1 averaged only over classes with at least one true positive.

    Args:
        y_true: int array shape (n_clips, n_classes)
        y_pred: int array shape (n_clips, n_classes)

    Returns:
        float in [0, 1]; returns 0.0 if no class has support.
    """
    n_classes = y_true.shape[1]
    class_f1s = []
    for c in range(n_classes):
        if y_true[:, c].sum() == 0:
            continue  # zero-support class — skip
        f = f1_score(y_true[:, c], y_pred[:, c], zero_division=0)
        class_f1s.append(f)
    if not class_f1s:
        return 0.0
    return float(np.mean(class_f1s))
