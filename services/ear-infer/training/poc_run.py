"""Proof-of-concept end-to-end run: synthesize -> train (effects head) -> quantize int8.

Deliberately small + CPU-only. Proves the merged pipeline (synth.py, model.py,
dataset.py feature code) actually trains and emits a real int8 .tflite. The
instrument/mood heads are left unsupervised (we only have synthetic effect labels),
so only the effects head learns — that's the one head trainable purely from synthesis.

Outputs the int8 tflite to /mnt/t/ml/timbria-ear/models/. edgetpu_compile + on-Coral
inference happen in a following shell step.
"""
import os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import tensorflow as tf
from labels import EFFECTS, INSTRUMENTS, MOOD
from synth import synth_clip, random_chain, multihot
from dataset import logmel_from_pcm, _fix_frames
from model import build_model, masked_bce

SR = 16000
N_MELS = 128
FRAMES = 64
MODELS_DIR = "/mnt/t/ml/timbria-ear/models"


def dry_signal(rng, sec=1.1):
    """A varied dry source so the model can't trivially memorize: random
    mixture of a few sines + a little noise."""
    n = int(SR * sec)
    t = np.linspace(0, sec, n, endpoint=False)
    sig = np.zeros(n, dtype=np.float32)
    for _ in range(rng.integers(1, 4)):
        f = rng.uniform(80, 1200)
        sig += rng.uniform(0.1, 0.3) * np.sin(2 * np.pi * f * t).astype(np.float32)
    sig += rng.uniform(0.0, 0.03) * rng.standard_normal(n).astype(np.float32)
    return (sig / (np.max(np.abs(sig)) + 1e-6) * 0.7).astype(np.float32)


def features_from_wet(wet):
    """Wet float -> int16 PCM bytes -> logmel (matches the SERVING path exactly)."""
    pcm = np.clip(wet, -1, 1)
    pcm16 = (pcm * 32767).astype("<i2").tobytes()
    mel = logmel_from_pcm(pcm16, n_mels=N_MELS)     # (N_MELS, frames)
    mel = _fix_frames(mel, FRAMES)                   # (N_MELS, FRAMES)
    return mel.astype(np.float32)


def build_corpus(n, seed=0):
    rng = np.random.default_rng(seed)
    X = np.zeros((n, N_MELS, FRAMES, 1), dtype=np.float32)
    Yeff = np.zeros((n, len(EFFECTS)), dtype=np.float32)
    for i in range(n):
        chain = random_chain(rng)                    # 0-3 generatable effects
        dry = dry_signal(rng)
        wet, mh = synth_clip(dry, SR, chain, seed=int(rng.integers(1 << 31)))
        X[i, ..., 0] = features_from_wet(np.asarray(wet).reshape(-1))
        Yeff[i] = mh
    return X, Yeff


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)
    n_train, n_val = 3000, 600
    print(f"[synth] generating {n_train}+{n_val} clips ...", flush=True)
    t0 = time.time()
    Xtr, Ytr = build_corpus(n_train, seed=1)
    Xva, Yva = build_corpus(n_val, seed=2)
    print(f"[synth] done in {time.time()-t0:.0f}s  X={Xtr.shape}  pos-rate={Ytr.mean():.3f}", flush=True)

    model = build_model(N_MELS, FRAMES)
    opt = tf.keras.optimizers.Adam(1e-3)
    eff_idx = 1  # build_model output order is [instrument, effects, mood]

    ds = tf.data.Dataset.from_tensor_slices((Xtr, Ytr)).shuffle(2048).batch(64)

    @tf.function
    def step(x, yeff):
        with tf.GradientTape() as tape:
            preds = model(x, training=True)
            eff = preds[eff_idx]
            mask = tf.ones((tf.shape(x)[0], 1))
            loss = masked_bce(yeff, eff, mask)
        grads = tape.gradient(loss, model.trainable_variables)
        opt.apply_gradients(zip(grads, model.trainable_variables))
        return loss

    EPOCHS = 12
    for ep in range(EPOCHS):
        losses = [float(step(x, y)) for x, y in ds]
        # quick val macro-F1 on effects (threshold 0.5)
        pv = model.predict(Xva, verbose=0)[eff_idx]
        pred = (pv > 0.5).astype(np.float32)
        tp = (pred * Yva).sum(); fp = (pred * (1 - Yva)).sum(); fn = ((1 - pred) * Yva).sum()
        prec = tp / (tp + fp + 1e-6); rec = tp / (tp + fn + 1e-6)
        f1 = 2 * prec * rec / (prec + rec + 1e-6)
        print(f"[train] epoch {ep+1}/{EPOCHS} loss={np.mean(losses):.4f} "
              f"val P={prec:.2f} R={rec:.2f} F1={f1:.2f}", flush=True)

    saved = os.path.join(MODELS_DIR, "poc_saved")
    model.export(saved)
    print(f"[save] SavedModel -> {saved}", flush=True)

    # int8 PTQ
    def rep():
        for i in range(min(200, len(Xtr))):
            yield [Xtr[i:i+1]]
    conv = tf.lite.TFLiteConverter.from_saved_model(saved)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = rep
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    tfl = conv.convert()
    out = os.path.join(MODELS_DIR, "poc_effects_int8.tflite")
    with open(out, "wb") as f:
        f.write(tfl)
    print(f"[quantize] int8 tflite -> {out} ({len(tfl)} bytes)", flush=True)

    # stash a couple of held-out samples + their labels for the on-Coral check
    np.savez(os.path.join(MODELS_DIR, "poc_val_sample.npz"),
             X=Xva[:8].astype(np.float32), Y=Yva[:8].astype(np.float32),
             effects=np.array(EFFECTS, dtype=object))
    print("[save] poc_val_sample.npz", flush=True)


if __name__ == "__main__":
    main()
