"""Evaluate a quantized .tflite over a held-out set and apply the ship gate.

Runs the TFLite interpreter, collects per-head predictions vs ground truth,
and computes per-class precision / recall / F1 with sklearn. Prints a per-head
table plus an overall PASS / FAIL against the ship thresholds:

    effects   macro-F1 >= 0.60
    instrument macro-F1 >= 0.60
    mood       macro-F1 >= 0.40   (lower beta bar: mood is subjective)

Only the heads a given clip actually labels (mask == 1) contribute to that
clip's score for that head — same masking discipline as training.
"""
import argparse

import numpy as np
import tensorflow as tf
from sklearn.metrics import precision_recall_fscore_support

from dataset import make_dataset, make_dataset_from_tfrecords
from model import HEADS

THRESHOLDS = {"effects": 0.60, "instrument": 0.60, "mood": 0.40}
DECISION = 0.5  # sigmoid -> binary label threshold


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Evaluate a .tflite and apply ship gate.")
    p.add_argument("--tflite", required=True, help="path to the .tflite model")
    p.add_argument("--data", required=False, default=None, help="held-out corpus spec/path")
    p.add_argument("--n-mels", type=int, default=128)
    p.add_argument("--frames", type=int, default=64)
    p.add_argument("--tfrecords", default=None,
                   help="Glob pattern for pre-computed TFRecord shards. "
                        "When set, uses the TFRecord pipeline instead of make_dataset.")
    args = p.parse_args(argv)
    # Validate: one of --data or --tfrecords is required
    if args.tfrecords is None and args.data is None:
        p.error("one of --data or --tfrecords is required")
    return args


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
    interp = tf.lite.Interpreter(model_path=tflite_path)
    interp.allocate_tensors()
    in_detail = interp.get_input_details()[0]
    out_details = interp.get_output_details()
    # map output tensors to heads by name (TFLite may reorder outputs during conversion)
    out_by_head = _match_outputs(out_details, HEADS)

    preds = {h: [] for h in HEADS}
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
            preds[head].append((prob >= DECISION).astype(np.int32))
            trues[head].append(labels[head].numpy().astype(np.int32))
            masked[head].append(float(masks[head].numpy().reshape(-1)[0]))
    return preds, trues, masked


def score(preds, trues, masked):
    results = {}
    for head in HEADS:
        keep = np.array(masked[head]) > 0.5
        if not keep.any():
            results[head] = None
            continue
        y_pred = np.array(preds[head])[keep]
        y_true = np.array(trues[head])[keep]
        p, r, f, _ = precision_recall_fscore_support(
            y_true, y_pred, average="macro", zero_division=0
        )
        results[head] = {"precision": p, "recall": r, "macro_f1": f}
    return results


def report(results):
    print(f"{'head':12} {'precision':>10} {'recall':>10} {'macro-F1':>10} {'thresh':>8} {'gate':>6}")
    overall_pass = True
    for head in HEADS:
        res = results[head]
        thr = THRESHOLDS[head]
        if res is None:
            print(f"{head:12} {'(no masked examples)':>40}")
            overall_pass = False
            continue
        gate = res["macro_f1"] >= thr
        overall_pass = overall_pass and gate
        print(f"{head:12} {res['precision']:>10.3f} {res['recall']:>10.3f} "
              f"{res['macro_f1']:>10.3f} {thr:>8.2f} {'PASS' if gate else 'FAIL':>6}")
    print("-" * 60)
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
    preds, trues, masked = run_interpreter(args.tflite, ds)
    results = score(preds, trues, masked)
    ok = report(results)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))
