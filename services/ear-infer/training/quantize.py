"""Quantize a trained SavedModel to full-integer (int8) TFLite.

Full int8 quantization is required for the Edge TPU: the compiler only maps
integer ops. The representative dataset is what calibrates the activation
ranges, so it must reflect the real log-mel feature distribution the model
sees at serving time (same transform as dataset.logmel_from_pcm).

Output is an int8-in / int8-out .tflite, ready for ``edgetpu_compiler``
(see compile_edgetpu.md).
"""
import argparse

import numpy as np
import tensorflow as tf

from dataset import make_dataset, make_dataset_from_tfrecords, logmel_from_pcm  # noqa: F401  (logmel re-exported for rep-data scripts)


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Quantize a SavedModel to int8 TFLite.")
    p.add_argument("--saved-model", required=True, help="dir of the Keras SavedModel")
    p.add_argument("--out", required=True, help="output .tflite path")
    p.add_argument("--rep-data", required=False, default=None,
                   help="spec/path for representative-dataset clips (calibration)")
    p.add_argument("--tfrecords", default=None,
                   help="glob of TFRecord shards for the representative dataset (instead of --rep-data)")
    p.add_argument("--n-mels", type=int, default=128)
    p.add_argument("--frames", type=int, default=64)
    p.add_argument("--rep-samples", type=int, default=200,
                   help="number of calibration samples to draw")
    args = p.parse_args(argv)
    # Validate: one of --rep-data or --tfrecords is required
    if args.tfrecords is None and args.rep_data is None:
        p.error("one of --rep-data or --tfrecords is required")
    return args


def representative_dataset(args):
    """Yield single-example float32 log-mel tensors for calibration.

    Pulls real features through the same pipeline used for training so the
    int8 range matches production. Draws from either TFRecords (if --tfrecords
    is set) or make_dataset (--rep-data), yielding un-batched features one at a time.
    """
    if args.tfrecords:
        ds = make_dataset_from_tfrecords(
            args.tfrecords,
            n_mels=args.n_mels,
            frames=args.frames,
            batch_size=1,
            shuffle=0
        )
    else:
        spec = {"data_root": args.rep_data, "synth_dir": f"{args.rep_data}/synth",
                "mood_dir": f"{args.rep_data}/mood", "clip_seconds": 1.0}
        ds = make_dataset(spec, n_mels=args.n_mels, frames=args.frames, batch_size=1,
                          shuffle=0)
    count = 0
    for feats, _labels, _masks in ds:
        # feats shape (1, n_mels, frames, 1), already float32 log-mel range
        yield [tf.cast(feats, tf.float32)]
        count += 1
        if count >= args.rep_samples:
            break


def quantize(args):
    converter = tf.lite.TFLiteConverter.from_saved_model(args.saved_model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = lambda: representative_dataset(args)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8

    tflite_model = converter.convert()
    with open(args.out, "wb") as f:
        f.write(tflite_model)
    print(f"wrote int8 TFLite ({len(tflite_model)} bytes) -> {args.out}")
    return args.out


if __name__ == "__main__":
    quantize(parse_args())
