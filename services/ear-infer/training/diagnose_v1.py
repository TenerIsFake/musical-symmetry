"""Offline diagnosis of the v1 ear model failure (no GPU needed).

Two questions:
  1) How sparse are the per-head labels in the held-out shards? (imbalance check)
  2) Does lowering the decision threshold recover macro-F1 on the v1 tflite?
     If yes -> the model learned signal; the 0.5 threshold + summed-BCE imbalance
     is the cause, and the fix is per-head thresholds + pos-weighting (not more data).
"""
import glob, sys
import numpy as np
import tensorflow as tf
from sklearn.metrics import precision_recall_fscore_support

sys.path.insert(0, ".")
from dataset import make_dataset_from_tfrecords
from model import HEADS  # {"instrument":19,"effects":22,"mood":8}

TFLITE = "/mnt/t/ml/timbria-ear/models/v1-isolated/ear-isolated.tflite"
EVAL_GLOB = "/home/tener/ear-tfrecords/part-0003*.tfrecord"

ds = make_dataset_from_tfrecords(EVAL_GLOB, batch_size=1, shuffle=0)

# ---- 1) label sparsity per head (only masked-in clips count) ----
pos_sum = {h: np.zeros(w) for h, w in HEADS.items()}
n_masked = {h: 0 for h in HEADS}
for feat, labels, masks in ds.unbatch():
    for h in HEADS:
        if float(masks[h].numpy().reshape(-1)[0]) > 0.5:
            pos_sum[h] += labels[h].numpy()
            n_masked[h] += 1
print("=== per-head label stats on held-out ===")
for h, w in HEADS.items():
    nm = n_masked[h]
    avg_pos = pos_sum[h].sum() / nm if nm else 0
    base = 1.0 / w
    print(f"{h:11} masked_clips={nm:6d}  avg_positives/clip={avg_pos:.3f}  "
          f"avg_positive_rate/class={avg_pos/w:.4f}  (random-precision~{base:.3f})")

# ---- 2) run v1 tflite, collect probs, sweep thresholds ----
interp = tf.lite.Interpreter(model_path=TFLITE); interp.allocate_tensors()
ind = interp.get_input_details()[0]
outs = interp.get_output_details()
# route outputs to heads by width (same fix as eval.py/infer.py)
out_by_head = {}
for h, w in HEADS.items():
    out_by_head[h] = next(d for d in outs if d["shape"][-1] == w)

def quant_in(x):
    s, z = ind["quantization"]
    if s == 0: return x.astype(ind["dtype"])
    return np.clip(np.round(x/s + z), np.iinfo(ind["dtype"]).min, np.iinfo(ind["dtype"]).max).astype(ind["dtype"])
def deq(v, d):
    s, z = d["quantization"]
    return (v.astype(np.float32) - z) * s if s != 0 else v.astype(np.float32)

probs = {h: [] for h in HEADS}; trues = {h: [] for h in HEADS}; msk = {h: [] for h in HEADS}
for feat, labels, masks in ds.unbatch():
    x = feat.numpy()[None, ...]
    interp.set_tensor(ind["index"], quant_in(x)); interp.invoke()
    for h in HEADS:
        d = out_by_head[h]
        probs[h].append(deq(interp.get_tensor(d["index"])[0], d))
        trues[h].append(labels[h].numpy().astype(np.int32))
        msk[h].append(float(masks[h].numpy().reshape(-1)[0]))

print("\n=== prob ranges (are sigmoids even spread, or stuck low?) ===")
for h in HEADS:
    p = np.array(probs[h]); print(f"{h:11} prob min={p.min():.3f} mean={p.mean():.3f} max={p.max():.3f}")

print("\n=== macro-F1 vs decision threshold (masked clips only) ===")
print(f"{'thresh':>7} " + " ".join(f"{h:>11}" for h in HEADS))
for thr in [0.5,0.4,0.3,0.25,0.2,0.15,0.1,0.05]:
    row = []
    for h in HEADS:
        keep = np.array(msk[h]) > 0.5
        if not keep.any(): row.append(float("nan")); continue
        yt = np.array(trues[h])[keep]; yp = (np.array(probs[h])[keep] >= thr).astype(np.int32)
        _, _, f, _ = precision_recall_fscore_support(yt, yp, average="macro", zero_division=0)
        row.append(f)
    print(f"{thr:>7.2f} " + " ".join(f"{v:>11.3f}" for v in row))
print("\n(If F1 rises sharply as threshold drops -> model HAS signal; fix = per-head"
      " threshold + pos-weighted loss. If F1 stays ~0 everywhere -> deeper problem.)")
