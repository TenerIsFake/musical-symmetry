"""Evaluate a quantized .tflite over a held-out set and apply the ship gate.

Runs the TFLite interpreter, collects per-head raw probabilities vs ground truth,
and computes per-class precision / recall / F1 with sklearn. Prints a per-head
table plus an overall PASS / FAIL against the ship thresholds:

    effects    macro-F1-over-supported >= 0.60
    instrument macro-F1-over-supported >= 0.60
    mood       macro-F1-over-supported >= 0.40   (lower bar: mood is subjective)

Gate metric (V2-T3): macro-F1 over *supported* classes only (classes with >0
true positives in the eval set). This avoids penalising corpus gaps where an
instrument / effect simply doesn't appear — the model isn't tested on skills it
was never given data for.

Also reports micro-F1 (over all masked clips/classes) and macro-F1-over-all for
reference.
"""
import argparse
import json

import numpy as np
import tensorflow as tf
from sklearn.metrics import f1_score, precision_recall_fscore_support

from dataset import make_dataset, make_dataset_from_tfrecords
from metrics import macro_f1_over_supported
from model import HEADS

THRESHOLDS = {"effects": 0.60, "instrument": 0.60, "mood": 0.40}
DECISION = 0.5  # default sigmoid → binary threshold when no sidecar is provided


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Evaluate a .tflite and apply ship gate.")
    p.add_argument("--tflite", required=True, help="path to the .tflite model")
    p.add_argument("--data", required=False, default=None, help="held-out corpus spec/path")
    p.add_argument("--n-mels", type=int, default=128)
    p.add_argument("--frames", type=int, default=64)
    p.add_argument("--tfrecords", default=None,
                   help="Glob pattern for pre-computed TFRecord shards. "
                        "When set, uses the TFRecord pipeline instead of make_dataset.")
    p.add_argument("--thresholds", default=None,
                   help="Path to a per-head thresholds JSON sidecar produced by "
                        "tune_thresholds.py. If omitted, all heads use DECISION=0.5.")
    args = p.parse_args(argv)
    # Validate: one of --data or --tfrecords is required
    if args.tfrecords is None and args.data is None:
        p.error("one of --data or --tfrecords is required")
    return args


def _load_thresholds(path_or_none):
    """Load per-head threshold dict from JSON, or return all-0.5 defaults."""
    if path_or_none is None:
        return {h: DECISION for h in HEADS}
    with open(path_or_none) as fh:
        data = json.load(fh)
    # Fill any missing heads with DECISION
    return {h: float(data.get(h, DECISION)) for h in HEADS}


def _dequant(value, detail):
    """Undo int8 quantization for an output tensor if needed."""
    scale, zero = detail["quantization"]
    if scale == 0:
        return value.astype(np.float32)
    return (value.astype(np.float32) - zero) * scale


def _quant_input(value, detail):
    """Quantize a float input to the interpreter's input dtype if int8."""
    if detail["dtype"] == np.float32:
        return value.astype(np.float32)
    scale, zero = detail["quantization"]
    q = np.round(value / scale + zero)
    info = np.iinfo(detail["dtype"])
    return np.clip(q, info.min, info.max).astype(detail["dtype"])


def _match_outputs(out_details, heads):
    """Route each head to the output tensor whose last shape dim matches head width.

    TFLite renames output layer names to "StatefulPartitionedCall:N", so substring
    matching on head names fails. Instead, match by the last shape dimension, which
    corresponds to the number of classes per head. The three head widths are DISTINCT
    (instrument=19, effects=22, mood=8), making this unambiguous and robust.

    Args:
        out_details: list of dicts with keys 'name', 'shape', 'index', etc.
        heads: dict {head_name: width} e.g. {"instrument": 19, "effects": 22, "mood": 8}

    Returns:
        dict {head_name: out_detail} mapping each head to its output tensor.

    Raises:
        ValueError: if any head's width doesn't match exactly one output tensor.
    """
    by_head = {}
    for head_name, width in heads.items():
        matches = [d for d in out_details if d["shape"][-1] == width]
        if len(matches) != 1:
            raise ValueError(
                f"_match_outputs: expected exactly 1 output tensor with width {width} "
                f"for head '{head_name}', found {len(matches)}. "
                f"Output tensors: {[(d['name'], d['shape']) for d in out_details]}"
            )
        by_head[head_name] = matches[0]
    return by_head


def run_interpreter(tflite_path, dataset):
    """Run the TFLite interpreter and return RAW sigmoid probabilities.

    Returns:
        probs  -- dict {head: list of 1-D float32 arrays (raw dequantized sigmoid)}
        trues  -- dict {head: list of 1-D int32 arrays (ground-truth labels)}
        masked -- dict {head: list of float (1.0 = head applies to this clip)}

    Note: V2-T3 change — previously returned binarised preds; now returns raw
    probs so callers can apply their own per-head thresholds.
    """
    interp = tf.lite.Interpreter(model_path=tflite_path)
    interp.allocate_tensors()
    in_detail = interp.get_input_details()[0]
    out_details = interp.get_output_details()
    # map output tensors to heads by name (TFLite may reorder outputs during conversion)
    out_by_head = _match_outputs(out_details, HEADS)

    probs = {h: [] for h in HEADS}
    trues = {h: [] for h in HEADS}
    masked = {h: [] for h in HEADS}

    for feats, labels, masks in dataset.unbatch():
        x = feats.numpy()[None, ...]
        interp.set_tensor(in_detail["index"], _quant_input(x, in_detail))
        interp.invoke()
        for head in HEADS:
            od = out_by_head[head]
            raw = interp.get_tensor(od["index"])[0]
            prob = _dequant(raw, od)
            probs[head].append(prob.astype(np.float32))
            trues[head].append(labels[head].numpy().astype(np.int32))
            masked[head].append(float(masks[head].numpy().reshape(-1)[0]))
    return probs, trues, masked


def score(probs, trues, masked, thresholds=None):
    """Binarise raw probs with per-head thresholds and compute metrics.

    Args:
        probs:      dict {head: list of float32 prob vectors}
        trues:      dict {head: list of int32 label vectors}
        masked:     dict {head: list of float mask values}
        thresholds: dict {head: float threshold} or None (defaults all to 0.5)

    Returns:
        dict {head: None | {precision, recall, macro_f1_all, macro_f1_supported,
                             micro_f1, n_supported_classes, thresh_used}}
    """
    if thresholds is None:
        thresholds = {h: DECISION for h in HEADS}

    results = {}
    for head in HEADS:
        keep = np.array(masked[head]) > 0.5
        if not keep.any():
            results[head] = None
            continue

        thresh = thresholds.get(head, DECISION)
        y_prob = np.array(probs[head])[keep]
        y_pred = (y_prob >= thresh).astype(np.int32)
        y_true = np.array(trues[head])[keep]

        # macro precision/recall/F1 over all classes (legacy reference)
        p, r, f_all, _ = precision_recall_fscore_support(
            y_true, y_pred, average="macro", zero_division=0
        )
        # micro-F1 over all masked clips/classes
        micro = f1_score(y_true, y_pred, average="micro", zero_division=0)
        # macro-F1 over supported classes only (gate metric)
        f_supported = macro_f1_over_supported(y_true, y_pred)
        n_supported = int(sum(1 for c in range(y_true.shape[1]) if y_true[:, c].sum() > 0))

        results[head] = {
            "precision": p,
            "recall": r,
            "macro_f1_all": f_all,
            "macro_f1_supported": f_supported,
            "micro_f1": micro,
            "n_supported_classes": n_supported,
            "thresh_used": thresh,
        }
    return results


def report(results):
    """Print per-head metrics table and return True if all heads pass the gate."""
    header = (
        f"{'head':12} {'sup_cls':>7} {'micro_f1':>9} "
        f"{'mac_supp':>9} {'mac_all':>8} {'thresh':>7} {'gate':>6}"
    )
    print(header)
    print("-" * len(header))

    overall_pass = True
    for head in HEADS:
        res = results[head]
        thr = THRESHOLDS[head]
        if res is None:
            print(f"{head:12} {'(no masked examples)':>50}")
            overall_pass = False
            continue
        gate = res["macro_f1_supported"] >= thr
        overall_pass = overall_pass and gate
        print(
            f"{head:12} {res['n_supported_classes']:>7d} "
            f"{res['micro_f1']:>9.3f} "
            f"{res['macro_f1_supported']:>9.3f} "
            f"{res['macro_f1_all']:>8.3f} "
            f"{res['thresh_used']:>7.3f} "
            f"{'PASS' if gate else 'FAIL':>6}"
        )
    print("-" * len(header))
    print("OVERALL:", "PASS" if overall_pass else "FAIL")
    return overall_pass


def main(args):
    if args.tfrecords:
        ds = make_dataset_from_tfrecords(
            args.tfrecords,
            n_mels=args.n_mels,
            frames=args.frames,
            batch_size=1,
            shuffle=0,
        )
    else:
        ds = make_dataset({"data_root": args.data, "synth_dir": f"{args.data}/synth",
                           "mood_dir": f"{args.data}/mood", "clip_seconds": 1.0},
                          n_mels=args.n_mels, frames=args.frames, batch_size=1, shuffle=0)
    thresholds = _load_thresholds(args.thresholds)
    probs, trues, masked = run_interpreter(args.tflite, ds)
    results = score(probs, trues, masked, thresholds=thresholds)
    ok = report(results)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))
