"""Precompute log-mel features from the corpus into TFRecord shards.

Usage::

    python prep/make_tfrecords.py \\
        --corpus /path/to/ear-corpus \\
        --out    /path/to/tfrecords \\
        [--variant isolated] \\
        [--shards 32]

The script reads every clip from ``iter_clips(spec)``, computes
``logmel = _fix_frames(logmel_from_pcm(pcm), frames)`` and
``labels, masks = _labels_for(source, **meta)``, then serializes each clip
with ``serialize_example(...)`` and distributes them round-robin across
``--shards`` TFRecord files named ``part-{i:05d}.tfrecord``.

Do NOT run this against the real 76 GB corpus during tests — only the tiny
synthetic fixtures used by ``test_tfrecords.py``.
"""
import argparse
import os
import sys

import numpy as np

# ---------------------------------------------------------------------------
# Allow running from the training directory or from prep/
# ---------------------------------------------------------------------------
_HERE = os.path.dirname(__file__)
_PARENT = os.path.dirname(_HERE)
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)

import tensorflow as tf

from dataset import (
    _fix_frames,
    _labels_for,
    logmel_from_pcm,
    serialize_example,
    iter_clips,
    _TFR_N_MELS,
    _TFR_FRAMES,
)

# Model contract: n_mels and frames are baked into every TFRecord Example.
N_MELS = _TFR_N_MELS
FRAMES = _TFR_FRAMES


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Precompute log-mel features into TFRecord shards."
    )
    p.add_argument("--corpus",  required=True,
                   help="Root directory of the ear corpus.")
    p.add_argument("--out",     required=True,
                   help="Output directory for shard files.")
    p.add_argument("--variant", default="isolated",
                   help="Corpus variant (isolated or mix); default: isolated.")
    p.add_argument("--shards",  type=int, default=32,
                   help="Number of TFRecord shard files; default: 32.")
    p.add_argument("--max-windows-per-clip", type=int, default=2,
                   help="Windows kept per source clip; <=0 means all; default: 2.")
    p.add_argument("--by-source", action="store_true", default=False,
                   help="Route each example to a per-source subdir "
                        "(<out>/synth/, <out>/inst/, <out>/mood/) instead of "
                        "the default single-dir round-robin layout.")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    os.makedirs(args.out, exist_ok=True)

    spec = {
        "variant":    args.variant,
        "data_root":  args.corpus,
        "synth_dir":  os.path.join(args.corpus, "synth"),
        "mood_dir":   os.path.join(args.corpus, "mood"),
        "inst_dir":   os.path.join(args.corpus, "inst"),
        "clip_seconds": 1.0,
    }

    # Add max_windows_per_clip if specified and > 0
    if args.max_windows_per_clip and args.max_windows_per_clip > 0:
        spec["max_windows_per_clip"] = args.max_windows_per_clip

    total = 0

    if args.by_source:
        # --by-source: route each example to a per-source subdir.
        # source → subdir name mapping
        SOURCE_TO_SUBDIR = {
            "synth":           "synth",
            "real_instrument": "inst",
            "real_mood":       "mood",
        }
        # Create shard writers per source (on first encounter)
        source_writers = {}   # subdir -> list of TFRecordWriter
        source_counts  = {}   # subdir -> list of int (per-shard counts)
        source_totals  = {}   # subdir -> int (total examples)

        for pcm, source, meta in iter_clips(spec):
            subdir = SOURCE_TO_SUBDIR.get(source)
            if subdir is None:
                raise ValueError(f"unknown source {source!r}")

            # Lazily create writers for this source
            if subdir not in source_writers:
                sub_out = os.path.join(args.out, subdir)
                os.makedirs(sub_out, exist_ok=True)
                paths = [
                    os.path.join(sub_out, f"part-{i:05d}.tfrecord")
                    for i in range(args.shards)
                ]
                source_writers[subdir] = [tf.io.TFRecordWriter(p) for p in paths]
                source_counts[subdir]  = [0] * args.shards
                source_totals[subdir]  = 0

            logmel = _fix_frames(logmel_from_pcm(pcm, n_mels=N_MELS), FRAMES)
            labels, masks = _labels_for(
                source,
                instrument=meta.get("instrument"),
                effects=meta.get("effects"),
                mood=meta.get("mood"),
            )
            serialized = serialize_example(logmel, labels, masks)
            # Round-robin within this source's own shards
            shard_idx = source_totals[subdir] % args.shards
            source_writers[subdir][shard_idx].write(serialized)
            source_counts[subdir][shard_idx] += 1
            source_totals[subdir] += 1
            total += 1

        for subdir, writers in source_writers.items():
            for w in writers:
                w.close()

        print(f"Wrote {total} examples (--by-source):")
        for subdir in sorted(source_totals):
            print(f"  {subdir}/: {source_totals[subdir]} examples "
                  f"across {args.shards} shards")

    else:
        # Default: single-dir round-robin (unchanged behaviour)
        shard_paths = [
            os.path.join(args.out, f"part-{i:05d}.tfrecord")
            for i in range(args.shards)
        ]
        writers = [tf.io.TFRecordWriter(p) for p in shard_paths]
        shard_counts = [0] * args.shards

        for pcm, source, meta in iter_clips(spec):
            logmel = _fix_frames(logmel_from_pcm(pcm, n_mels=N_MELS), FRAMES)
            labels, masks = _labels_for(
                source,
                instrument=meta.get("instrument"),
                effects=meta.get("effects"),
                mood=meta.get("mood"),
            )
            serialized = serialize_example(logmel, labels, masks)
            shard_idx = total % args.shards
            writers[shard_idx].write(serialized)
            shard_counts[shard_idx] += 1
            total += 1

        for w in writers:
            w.close()

        print(f"Wrote {total} examples across {args.shards} shards:")
        for i, (path, count) in enumerate(zip(shard_paths, shard_counts)):
            if count > 0:
                print(f"  {os.path.basename(path)}: {count} examples")

    return total


if __name__ == "__main__":
    main()
