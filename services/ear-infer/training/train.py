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
import itertools
import math

import tensorflow as tf

from dataset import make_dataset, make_dataset_from_tfrecords, make_balanced_dataset_from_tfrecords
from model import (
    build_model, masked_bce, masked_bce_weighted, masked_focal,
    compute_pos_weights, HEADS,
)


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
    p.add_argument("--loss", choices=["bce", "posweight", "focal"], default="bce",
                   help="loss function: bce (default), posweight (BCE with pos-weight "
                        "auto-computed from data), focal (focal loss)")
    p.add_argument("--focal-gamma", type=float, default=2.0,
                   help="focal loss gamma (default 2.0); only used when --loss focal")
    p.add_argument("--focal-alpha", type=float, default=0.25,
                   help="focal loss alpha (default 0.25); only used when --loss focal")
    p.add_argument("--balance", choices=["none", "source"], default="none",
                   help="sampling balance strategy: none (default, unchanged behaviour) "
                        "or source (interleave 3 source sub-datasets at equal weight)")
    p.add_argument("--steps-per-epoch", type=int, default=0,
                   help="steps per epoch when --balance source (0 = auto-derive from data count)")
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


def _make_train_step(model, optimizer, head_loss_fn):
    """Return a @tf.function-compiled train step bound to this model/optimizer/loss.

    Binding per-call (rather than as a module-level @tf.function) keeps the
    compiled graph static for a given training run while allowing different loss
    strategies across runs without retracing the previous run's graph.
    """
    @tf.function
    def _step(feats, labels, masks):
        """One gradient step. Total loss = sum of per-head loss over the three heads."""
        with tf.GradientTape() as tape:
            preds = model(feats, training=True)
            # model outputs are ordered by HEADS insertion order
            pred_by_head = dict(zip(HEADS.keys(), preds))
            loss = tf.constant(0.0)
            for head in HEADS:
                loss = loss + head_loss_fn(head, labels[head], pred_by_head[head], masks[head])
        grads = tape.gradient(loss, model.trainable_variables)
        optimizer.apply_gradients(zip(grads, model.trainable_variables))
        return loss

    return _step


def _make_head_loss_fn(args, pos_weights):
    """Build a per-head loss callable capturing args and pos_weights.

    The branch on args.loss is resolved here (once, before the training loop)
    so the resulting closure is a single Python function with no runtime
    branching — keeping the @tf.function graph static.
    """
    if args.loss == "posweight":
        # Convert numpy arrays to constant tensors at trace time
        pw_tensors = {h: tf.constant(pos_weights[h]) for h in pos_weights}

        def head_loss_fn(head, y_true, y_pred, mask):
            return masked_bce_weighted(y_true, y_pred, mask, pw_tensors[head])

    elif args.loss == "focal":
        gamma = args.focal_gamma
        alpha = args.focal_alpha

        def head_loss_fn(head, y_true, y_pred, mask):
            return masked_focal(y_true, y_pred, mask, gamma=gamma, alpha=alpha)

    else:  # "bce" — default; preserves existing behaviour
        def head_loss_fn(head, y_true, y_pred, mask):
            return masked_bce(y_true, y_pred, mask)

    return head_loss_fn


def train(args):
    # ------------------------------------------------------------------
    # Build the dataset(s).
    # When --balance source is requested we need TWO datasets:
    #   * finite_ds — for computing pos_weights (never iterate the infinite ds)
    #   * ds        — the (possibly infinite) training dataset
    # ------------------------------------------------------------------
    use_balance = getattr(args, "balance", "none") == "source"

    if args.tfrecords:
        # Always build the finite dataset (needed for pos_weights and as the
        # training ds when balance==none).
        finite_ds = make_dataset_from_tfrecords(
            args.tfrecords,
            n_mels=args.n_mels,
            frames=args.frames,
            batch_size=args.batch_size,
        )
        if use_balance:
            ds = make_balanced_dataset_from_tfrecords(
                args.tfrecords,
                n_mels=args.n_mels,
                frames=args.frames,
                batch_size=args.batch_size,
            )
        else:
            ds = finite_ds
    else:
        finite_ds = make_dataset(make_spec(args), n_mels=args.n_mels, frames=args.frames,
                                 batch_size=args.batch_size)
        ds = finite_ds

    # Determine steps_per_epoch when using the infinite balanced dataset.
    steps_per_epoch = getattr(args, "steps_per_epoch", 0)
    if use_balance:
        if steps_per_epoch and steps_per_epoch > 0:
            _steps = steps_per_epoch
        else:
            # Count examples from the finite dataset once to derive a sensible default.
            n_examples = sum(batch[0].shape[0] for batch in finite_ds)
            _steps = math.ceil(n_examples / args.batch_size)
        print(f"[balance=source] steps_per_epoch={_steps}")
    else:
        _steps = None  # unused for finite datasets

    # Resolve loss strategy ONCE before the training loop so _train_step's
    # @tf.function graph is static (no retracing per step).
    # CRITICAL: compute pos_weights on finite_ds, never on the infinite ds.
    if args.loss == "posweight":
        pos_weights = compute_pos_weights(finite_ds)
        for head, pw in pos_weights.items():
            print(f"[pos_weight] {head}: max={pw.max():.2f} mean={pw.mean():.2f}")
    else:
        pos_weights = None

    head_loss_fn = _make_head_loss_fn(args, pos_weights)

    model = build_model(n_mels=args.n_mels, frames=args.frames)
    optimizer = tf.keras.optimizers.Adam(args.lr)
    train_step = _make_train_step(model, optimizer, head_loss_fn)

    for epoch in range(args.epochs):
        running, steps = 0.0, 0
        if use_balance:
            # Infinite dataset: break after _steps batches using islice.
            batch_iter = itertools.islice(iter(ds), _steps)
        else:
            # Finite dataset: iterate naturally until exhausted (unchanged).
            batch_iter = iter(ds)
        for feats, labels, masks in batch_iter:
            loss = train_step(feats, labels, masks)
            running += float(loss)
            steps += 1
        avg = running / max(steps, 1)
        print(f"[{args.model}] epoch {epoch + 1}/{args.epochs}  loss={avg:.4f}")

    # Keras 3 (TF 2.16+) moved SavedModel export off model.save() — which now
    # requires a .keras/.h5 extension — to model.export(dir). quantize.py reads
    # this dir via tf.lite.TFLiteConverter.from_saved_model. Fall back to
    # model.save for Keras 2 environments.
    try:
        model.export(args.out)  # Keras 3 SavedModel
    except AttributeError:
        model.save(args.out)    # Keras 2 SavedModel
    print(f"saved SavedModel -> {args.out}")
    return model


if __name__ == "__main__":
    train(parse_args())
