"""Sweep per-head decision thresholds on a validation set to maximize macro-F1
over supported classes, then write a JSON sidecar for eval.py.

Usage:
    tune_thresholds.py --tflite model.tflite --tfrecords "val/*.tfrecord" --out thresholds.json
    tune_thresholds.py --tflite model.tflite --tfrecords "val/*.tfrecord" --out thresholds.json --grid 0.05 0.50

The script reuses eval.run_interpreter (which must return raw probs after the
V2-T3 refactor). For each head it sweeps the given grid and picks the threshold
that maximises macro_f1_over_supported. Defaults to 0.5 if no class has support.
"""
import argparse
import json

import numpy as np
from sklearn.metrics import f1_score

from model import HEADS


# ---------------------------------------------------------------------------
# Pure helpers (no tflite needed — unit-testable)
# ---------------------------------------------------------------------------

def macro_f1_over_supported(trues: np.ndarray, preds: np.ndarray) -> float:
    """Macro-F1 averaged only over classes that have at least one true positive.

    Args:
        trues: int array shape (n_clips, n_classes)
        preds: int array shape (n_clips, n_classes)

    Returns:
        float in [0, 1]; returns 0.0 if no class has support.
    """
    n_classes = trues.shape[1]
    class_f1s = []
    for c in range(n_classes):
        if trues[:, c].sum() == 0:
            continue  # zero-support class — skip
        f = f1_score(trues[:, c], preds[:, c], zero_division=0)
        class_f1s.append(f)
    if not class_f1s:
        return 0.0
    return float(np.mean(class_f1s))


def best_threshold(
    probs: np.ndarray,
    trues: np.ndarray,
    grid: np.ndarray,
) -> tuple[float, float]:
    """Sweep threshold candidates and return the one maximising macro_f1_over_supported.

    Args:
        probs: float array shape (n_clips, n_classes) — raw sigmoid probabilities.
        trues: int array shape (n_clips, n_classes) — ground-truth binary labels.
        grid: 1-D array of threshold values to try (e.g. np.arange(0.05, 0.55, 0.05)).

    Returns:
        (best_thresh, best_f1) — the chosen threshold and the F1 it achieves.
        Falls back to (0.5, 0.0) if trues has no supported classes.
    """
    best_t = 0.5
    best_f = 0.0
    for t in grid:
        preds = (probs >= t).astype(np.int32)
        f = macro_f1_over_supported(trues, preds)
        if f > best_f:
            best_f = f
            best_t = float(t)
    return best_t, best_f


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

_DEFAULT_GRID = np.arange(0.05, 0.55, 0.05)


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Sweep per-head decision thresholds on a validation set."
    )
    p.add_argument("--tflite", required=True, help="path to quantized .tflite model")
    p.add_argument("--tfrecords", required=True, help="glob for validation TFRecord shards")
    p.add_argument("--out", required=True, help="output JSON path for thresholds sidecar")
    p.add_argument(
        "--grid",
        nargs=2,
        type=float,
        metavar=("START", "STOP"),
        default=None,
        help="threshold sweep range [START, STOP) with step 0.05 (default 0.05 0.50)",
    )
    p.add_argument("--n-mels", type=int, default=128)
    p.add_argument("--frames", type=int, default=64)
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # Import here so pure functions are testable without TF
    import tensorflow as tf  # noqa: F401 — needed to register TFRecord ops
    from dataset import make_dataset_from_tfrecords
    from eval import run_interpreter

    if args.grid is not None:
        start, stop = args.grid
        grid = np.arange(start, stop + 1e-9, 0.05)
    else:
        grid = _DEFAULT_GRID

    ds = make_dataset_from_tfrecords(
        args.tfrecords,
        n_mels=args.n_mels,
        frames=args.frames,
        batch_size=1,
        shuffle=0,
    )

    # run_interpreter now returns raw probs (after V2-T3 refactor)
    probs_all, trues_all, masked_all = run_interpreter(args.tflite, ds)

    chosen = {}
    for head in HEADS:
        keep = np.array(masked_all[head]) > 0.5
        if not keep.any():
            print(f"{head}: no masked clips — defaulting to 0.5")
            chosen[head] = 0.5
            continue

        p = np.array(probs_all[head])[keep]   # (n_kept, n_classes)
        t_arr = np.array(trues_all[head])[keep]  # (n_kept, n_classes)

        thresh, f1 = best_threshold(p, t_arr, grid)
        chosen[head] = round(thresh, 4)
        print(f"{head}: threshold={thresh:.2f}  macro_f1_supported={f1:.4f}")

    with open(args.out, "w") as fh:
        json.dump(chosen, fh, indent=2)
    print(f"\nWrote thresholds to {args.out}")


if __name__ == "__main__":
    main()
