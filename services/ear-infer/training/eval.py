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

from dataset import make_dataset
from model import HEADS

THRESHOLDS = {"effects": 0.60, "instrument": 0.60, "mood": 0.40}
DECISION = 0.5  # sigmoid -> binary label threshold


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Evaluate a .tflite and apply ship gate.")
    p.add_argument("--tflite", required=True, help="path to the .tflite model")
    p.add_argument("--data", required=True, help="held-out corpus spec/path")
    p.add_argument("--n-mels", type=int, default=128)
    p.add_argument("--frames", type=int, default=64)
    return p.parse_args(argv)


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
    by_head = {}
    for name in heads:
        match = next((d for d in out_details if name in d["name"]), None)
        if match is None:
            raise ValueError(f"no TFLite output tensor matches head '{name}'; "
                             f"available: {[d['name'] for d in out_details]}")
        by_head[name] = match
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
    ds = make_dataset({"data_root": args.data, "synth_dir": f"{args.data}/synth",
                       "mood_dir": f"{args.data}/mood", "clip_seconds": 1.0},
                      n_mels=args.n_mels, frames=args.frames, batch_size=1, shuffle=0)
    preds, trues, masked = run_interpreter(args.tflite, ds)
    results = score(preds, trues, masked)
    ok = report(results)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))
