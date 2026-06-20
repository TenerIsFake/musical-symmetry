"""Train the multi-head ear model.

Two model variants share the same architecture and head set; they differ only
in which corpus they are trained on:

  * ``--model isolated``  single-source / isolated-instrument clips (NSynth,
    IDMT-SMT-Guitar/Bass, MedleyDB stems) plus the synthesized-effects corpus.
  * ``--model mix``       full-mix clips (MUSDB18 mixtures, MTG-Jamendo) for a
    model that tolerates overlapping sources.

Loss is the SUM of ``masked_bce`` across the three heads, so a clip only
trains the heads its source actually labels (see dataset.py).

Training is GPU-bound and multi-hour on real corpora. Nothing is trained in
this repo; see README.md for the offline runbook.
"""
import argparse

import tensorflow as tf

from dataset import make_dataset, make_dataset_from_tfrecords
from model import build_model, masked_bce, HEADS


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Train the multi-head ear model.")
    p.add_argument("--model", choices=["isolated", "mix"], required=True,
                   help="which corpus variant to train")
    p.add_argument("--data", required=False, default=None,
                   help="path/spec for the corpus root")
    p.add_argument("--out", required=True, help="output dir for the Keras SavedModel")
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--n-mels", type=int, default=128)
    p.add_argument("--frames", type=int, default=64)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--tfrecords", default=None,
                   help="Glob pattern for pre-computed TFRecord shards. "
                        "When set, uses the TFRecord pipeline instead of make_dataset.")
    args = p.parse_args(argv)
    # Validate: one of --data or --tfrecords is required
    if args.tfrecords is None and args.data is None:
        p.error("one of --data or --tfrecords is required")
    return args


def make_spec(args):
    """Translate CLI args into the dataset spec consumed by make_dataset."""
    return {
        "variant": args.model,
        "data_root": args.data,
        "synth_dir": f"{args.data}/synth",
        "mood_dir": f"{args.data}/mood",
        "clip_seconds": 1.0,
    }


@tf.function
def _train_step(model, optimizer, feats, labels, masks):
    """One gradient step. Total loss = sum of masked BCE over the three heads."""
    with tf.GradientTape() as tape:
        preds = model(feats, training=True)
        # model outputs are ordered by HEADS insertion order
        pred_by_head = dict(zip(HEADS.keys(), preds))
        loss = tf.constant(0.0)
        for head in HEADS:
            loss = loss + masked_bce(labels[head], pred_by_head[head], masks[head])
    grads = tape.gradient(loss, model.trainable_variables)
    optimizer.apply_gradients(zip(grads, model.trainable_variables))
    return loss


def train(args):
    if args.tfrecords:
        ds = make_dataset_from_tfrecords(
            args.tfrecords,
            n_mels=args.n_mels,
            frames=args.frames,
            batch_size=args.batch_size,
        )
    else:
        ds = make_dataset(make_spec(args), n_mels=args.n_mels, frames=args.frames,
                          batch_size=args.batch_size)
    model = build_model(n_mels=args.n_mels, frames=args.frames)
    optimizer = tf.keras.optimizers.Adam(args.lr)

    for epoch in range(args.epochs):
        running, steps = 0.0, 0
        for feats, labels, masks in ds:
            loss = _train_step(model, optimizer, feats, labels, masks)
            running += float(loss)
            steps += 1
        avg = running / max(steps, 1)
        print(f"[{args.model}] epoch {epoch + 1}/{args.epochs}  loss={avg:.4f}")

    model.save(args.out)  # Keras SavedModel
    print(f"saved SavedModel -> {args.out}")
    return model


if __name__ == "__main__":
    train(parse_args())
