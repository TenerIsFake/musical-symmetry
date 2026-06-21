"""tf.data input pipeline for the multi-head ear model.

Two clip *sources* feed the same model, with different label availability:

  * **synthesized** clips (from ``synth.py`` over dry instrument samples):
    we know exactly which **effects** were applied AND which **instrument**
    the dry sample is, but we have NO ground-truth mood. So the effects and
    instrument heads are supervised (mask = 1) and mood is ignored (mask = 0).

  * **real mood-tagged** clips (e.g. the MTG-Jamendo mood subset): we have a
    human mood tag but no reliable per-effect / per-instrument label. So the
    mood head is supervised (mask = 1) and the other two are ignored (mask = 0).

The masking is consumed by ``model.masked_bce`` in ``train.py``: a head whose
mask is 0 contributes nothing to the loss for that example, so the two sources
can be interleaved in a single dataset without leaking wrong labels.

The heavy audio decoding (reading WAV/FLAC off disk, resampling to 16 kHz,
windowing into fixed-length clips) is intentionally left as a thin, documented
stub: ``iter_clips(spec)``. Wire it to your on-disk corpus layout. Everything
that determines model correctness — the feature transform and the mask logic —
is concrete below.
"""
import glob
import os
import numpy as np
import tensorflow as tf

from labels import INSTRUMENTS, EFFECTS, MOOD

# ---------------------------------------------------------------------------
# TFRecord schema constants
# N_MELS / FRAMES are baked into serialized Examples; model contract must match.
# ---------------------------------------------------------------------------
_TFR_N_MELS = 128
_TFR_FRAMES = 64

SR = 16000  # matches services/ear-infer/infer.py


def logmel_from_pcm(pcm_bytes, n_mels=128):
    """Log-mel feature, byte-for-byte equivalent to
    ``services/ear-infer/infer.py::pcm_to_logmel``.

    Input is little-endian int16 PCM @ 16 kHz. Returns a float32
    ``(n_mels, frames)`` array. Keeping this identical to the serving path is
    critical: the model must see at train time exactly what infer.py feeds it.
    """
    x = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float32) / 32768.0
    if x.size == 0:
        return np.zeros((n_mels, 1), dtype=np.float32)
    n_fft, hop = 1024, 256
    frames = max(1, 1 + (len(x) - n_fft) // hop) if len(x) >= n_fft else 1
    spec = np.zeros((n_fft // 2 + 1, frames), dtype=np.float32)
    win = np.hanning(n_fft).astype(np.float32)
    for i in range(frames):
        seg = x[i * hop : i * hop + n_fft]
        if len(seg) < n_fft:
            seg = np.pad(seg, (0, n_fft - len(seg)))
        spec[:, i] = np.abs(np.fft.rfft(seg * win))
    edges = np.linspace(0, spec.shape[0], n_mels + 1, dtype=int)
    mel = np.stack(
        [spec[edges[i] : max(edges[i] + 1, edges[i + 1])].mean(0) for i in range(n_mels)]
    )
    return np.log1p(mel).astype(np.float32)


def _fix_frames(logmel, frames):
    """Pad/crop the time axis of an ``(n_mels, T)`` feature to exactly ``frames``."""
    n_mels, t = logmel.shape
    if t == frames:
        return logmel
    if t > frames:
        return logmel[:, :frames]
    pad = np.zeros((n_mels, frames - t), dtype=logmel.dtype)
    return np.concatenate([logmel, pad], axis=1)


def _labels_for(source, instrument=None, effects=None, mood=None):
    """Build the per-head label + mask dicts for one clip.

    ``source`` is ``"synth"`` or ``"real_mood"``.

      synth      -> effects + instrument supervised (mask 1), mood masked (0)
      real_mood  -> mood supervised (mask 1), effects + instrument masked (0)

    ``effects`` / ``mood`` may be passed as a list of label strings or as a
    pre-built multi-hot array. ``instrument`` is a single label string or index.
    """
    inst_vec = np.zeros(len(INSTRUMENTS), dtype=np.float32)
    eff_vec = np.zeros(len(EFFECTS), dtype=np.float32)
    mood_vec = np.zeros(len(MOOD), dtype=np.float32)

    def _multihot(vec, value, vocab):
        if value is None:
            return vec
        if isinstance(value, np.ndarray):
            return value.astype(np.float32)
        items = [value] if isinstance(value, (str, int, np.integer)) else value
        for it in items:
            idx = it if isinstance(it, (int, np.integer)) else vocab.index(it)
            vec[idx] = 1.0
        return vec

    inst_vec = _multihot(inst_vec, instrument, INSTRUMENTS)
    eff_vec = _multihot(eff_vec, effects, EFFECTS)
    mood_vec = _multihot(mood_vec, mood, MOOD)

    if source == "synth":
        masks = {"instrument": 1.0, "effects": 1.0, "mood": 0.0}
    elif source == "real_mood":
        masks = {"instrument": 0.0, "effects": 0.0, "mood": 1.0}
    elif source == "real_instrument":
        masks = {"instrument": 1.0, "effects": 0.0, "mood": 0.0}
    else:
        raise ValueError(f"unknown clip source: {source!r}")

    labels = {"instrument": inst_vec, "effects": eff_vec, "mood": mood_vec}
    mask_arrs = {k: np.array([v], dtype=np.float32) for k, v in masks.items()}
    return labels, mask_arrs


def iter_clips(spec):
    """Yield ``(pcm_bytes, source, meta)`` for every training clip.

    Reads the on-disk 16 kHz corpus produced by prep/build_synth.py + prep/ingest.py:
      <synth_dir>/<variant>/clip_*.wav  (+ .effects.npy, .instrument.json) -> "synth"
      <mood_dir>/*.wav                  (+ .mood.json)                      -> "real_mood"
    Each WAV is windowed into fixed clip_seconds chunks; every chunk inherits the
    file's labels.

    If ``spec["max_windows_per_clip"]`` is set to a positive integer, only the first
    N windows of each file are yielded. Default (key absent or None) = all windows.
    """
    import glob, json, os
    from prep.audio import to_pcm16k, window_clips

    variant = spec.get("variant", "isolated")
    clip_seconds = float(spec.get("clip_seconds", 1.0))
    max_windows = spec.get("max_windows_per_clip")

    synth_root = os.path.join(spec["synth_dir"], variant)
    for wav in sorted(glob.glob(os.path.join(synth_root, "*.wav"))):
        base = wav[:-4]
        eff = np.load(base + ".effects.npy") if os.path.exists(base + ".effects.npy") \
            else np.zeros(len(EFFECTS), dtype=np.float32)
        if os.path.exists(base + ".instrument.json"):
            with open(base + ".instrument.json") as f:
                inst = json.load(f)
        else:
            inst = []
        windows = window_clips(to_pcm16k(wav), clip_seconds=clip_seconds)
        windows = windows[:max_windows] if max_windows else windows
        for pcm in windows:
            yield pcm, "synth", {"instrument": inst, "effects": eff}

    for wav in sorted(glob.glob(os.path.join(spec["mood_dir"], "*.wav"))):
        base = wav[:-4]
        if os.path.exists(base + ".mood.json"):
            with open(base + ".mood.json") as f:
                mood = json.load(f)
        else:
            mood = []
        windows = window_clips(to_pcm16k(wav), clip_seconds=clip_seconds)
        windows = windows[:max_windows] if max_windows else windows
        for pcm in windows:
            yield pcm, "real_mood", {"mood": mood}

    # real_instrument clips from inst/ directory
    inst_dir = spec.get("inst_dir") or os.path.join(spec.get("data_root", ""), "inst")
    if inst_dir and os.path.exists(inst_dir):
        for wav in sorted(glob.glob(os.path.join(inst_dir, "*.wav"))):
            base = wav[:-4]
            if os.path.exists(base + ".instrument.json"):
                with open(base + ".instrument.json") as f:
                    inst = json.load(f)
            else:
                inst = []
            windows = window_clips(to_pcm16k(wav), clip_seconds=clip_seconds)
            windows = windows[:max_windows] if max_windows else windows
            for pcm in windows:
                yield pcm, "real_instrument", {"instrument": inst}


# ---------------------------------------------------------------------------
# TFRecord (de)serialization — SHARED schema; writer and reader both use these.
# ---------------------------------------------------------------------------

def serialize_example(logmel, labels, masks):
    """Serialize one clip to a ``tf.train.Example`` proto (bytes).

    Args:
        logmel: ``(n_mels, frames)`` float32 ndarray.
        labels: dict keyed ``instrument``/``effects``/``mood`` → float32 ndarrays.
        masks:  dict keyed ``instrument``/``effects``/``mood`` → float32 ndarray
                of shape ``(1,)``.

    Returns:
        Serialized ``bytes`` suitable for writing to a ``TFRecordWriter``.
    """

    def _float_feature(arr):
        return tf.train.Feature(float_list=tf.train.FloatList(value=arr.flatten().tolist()))

    feature = {
        # log-mel: row-major (C order) flatten of (n_mels, frames)
        "logmel":          _float_feature(logmel),
        # per-head multi-hot label vectors
        "instrument":      _float_feature(labels["instrument"]),
        "effects":         _float_feature(labels["effects"]),
        "mood":            _float_feature(labels["mood"]),
        # per-head supervision masks (len-1 float each)
        "mask_instrument": _float_feature(masks["instrument"]),
        "mask_effects":    _float_feature(masks["effects"]),
        "mask_mood":       _float_feature(masks["mood"]),
    }
    example = tf.train.Example(features=tf.train.Features(feature=feature))
    return example.SerializeToString()


def _parse_example(serialized, n_mels=_TFR_N_MELS, frames=_TFR_FRAMES):
    """Parse a serialized ``tf.train.Example`` into the same element structure
    that ``make_dataset``'s generator yields (before batching).

    Returns:
        ``(feat, labels, masks)`` where:
          * ``feat``   — ``(n_mels, frames, 1)`` float32 tensor
          * ``labels`` — ``{head: (width,) float32}``
          * ``masks``  — ``{head: (1,) float32}``
    """
    desc = {
        "logmel":          tf.io.FixedLenFeature([n_mels * frames],   tf.float32),
        "instrument":      tf.io.FixedLenFeature([len(INSTRUMENTS)],  tf.float32),
        "effects":         tf.io.FixedLenFeature([len(EFFECTS)],      tf.float32),
        "mood":            tf.io.FixedLenFeature([len(MOOD)],          tf.float32),
        "mask_instrument": tf.io.FixedLenFeature([1],                  tf.float32),
        "mask_effects":    tf.io.FixedLenFeature([1],                  tf.float32),
        "mask_mood":       tf.io.FixedLenFeature([1],                  tf.float32),
    }
    parsed = tf.io.parse_single_example(serialized, desc)

    # restore (n_mels, frames) from row-major flat → add channel dim
    feat = tf.reshape(parsed["logmel"], (n_mels, frames, 1))

    labels = {
        "instrument": parsed["instrument"],
        "effects":    parsed["effects"],
        "mood":       parsed["mood"],
    }
    masks = {
        "instrument": parsed["mask_instrument"],
        "effects":    parsed["mask_effects"],
        "mood":       parsed["mask_mood"],
    }
    return feat, labels, masks


# ---------------------------------------------------------------------------
# Source-filter predicates (operate on unbatched (feat, labels, masks) elements)
# ---------------------------------------------------------------------------

def is_synth(feat, labels, masks):
    """True when the example comes from the 'synth' source (effects mask == 1)."""
    return tf.reshape(masks["effects"], [-1])[0] > 0.5


def is_mood(feat, labels, masks):
    """True when the example comes from the 'real_mood' source (mood mask == 1)."""
    return tf.reshape(masks["mood"], [-1])[0] > 0.5


def is_real_instrument(feat, labels, masks):
    """True when the example comes from the 'real_instrument' source.

    Pattern: instrument=1, effects=0, mood=0.
    """
    mi = tf.reshape(masks["instrument"], [-1])[0] > 0.5
    me = tf.reshape(masks["effects"],    [-1])[0] > 0.5
    mm = tf.reshape(masks["mood"],       [-1])[0] > 0.5
    return mi & ~me & ~mm


def make_balanced_dataset_from_tfrecords(tfrecord_glob, weights=None, n_mels=_TFR_N_MELS,
                                         frames=_TFR_FRAMES, batch_size=32, shuffle=1024):
    """Parse shards, split into 3 source sub-datasets by mask pattern, and
    interleave them with sample_from_datasets at the given weights (default
    equal [1/3,1/3,1/3]).

    Each sub-dataset is .repeat() so the rare sources don't exhaust
    (stop_on_empty_dataset=False).  Returns a batched+prefetched dataset with
    the SAME element spec as make_dataset_from_tfrecords.

    IMPORTANT: the returned dataset is INFINITE — callers must bound iteration
    with steps_per_epoch.
    """
    files = sorted(glob.glob(tfrecord_glob))
    base = (
        tf.data.TFRecordDataset(files, num_parallel_reads=tf.data.AUTOTUNE)
        .map(lambda s: _parse_example(s, n_mels, frames),
             num_parallel_calls=tf.data.AUTOTUNE)
    )
    synth_ds = base.filter(is_synth).repeat()
    inst_ds  = base.filter(is_real_instrument).repeat()
    mood_ds  = base.filter(is_mood).repeat()
    w = weights or [1 / 3, 1 / 3, 1 / 3]
    ds = tf.data.Dataset.sample_from_datasets(
        [synth_ds, inst_ds, mood_ds], weights=w, stop_on_empty_dataset=False
    )
    if shuffle:
        ds = ds.shuffle(shuffle)
    return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


def make_dataset_from_tfrecords(tfrecord_glob, n_mels=_TFR_N_MELS, frames=_TFR_FRAMES,
                                batch_size=32, shuffle=1024):
    """Build a ``tf.data.Dataset`` from pre-computed TFRecord shards.

    Output element spec is identical to ``make_dataset``'s:
    ``((n_mels, frames, 1) float32, {head: (width,)}, {head: (1,)})`` then
    batched to ``batch_size``.

    Args:
        tfrecord_glob: glob pattern (str) matching the shard files.
        n_mels:        must match the value used by ``make_tfrecords``.
        frames:        must match the value used by ``make_tfrecords``.
        batch_size:    examples per batch.
        shuffle:       shuffle buffer size; 0 / None to disable.
    """
    files = sorted(glob.glob(tfrecord_glob))
    ds = tf.data.TFRecordDataset(files, num_parallel_reads=tf.data.AUTOTUNE)
    ds = ds.map(
        lambda s: _parse_example(s, n_mels, frames),
        num_parallel_calls=tf.data.AUTOTUNE,
    )
    if shuffle:
        ds = ds.shuffle(shuffle)
    return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


def make_balanced_dataset_from_source_dirs(root, weights=None, n_mels=_TFR_N_MELS,
                                           frames=_TFR_FRAMES, batch_size=32, shuffle=1024):
    """Fast source-balanced dataset from a by-source TFRecord tree.

    Expected layout::

        <root>/synth/*.tfrecord
        <root>/inst/*.tfrecord
        <root>/mood/*.tfrecord

    Each source's shards are read directly (NO filtering), ``.repeat()``'d,
    and interleaved via ``sample_from_datasets`` at *weights* (default equal
    1/3 each).  Sources with no shards are silently dropped and the weights
    are renormalized over the present sources.

    Returns an **infinite** batched+prefetched dataset.  Element spec is
    identical to :func:`make_dataset_from_tfrecords`.

    Args:
        root:       Directory containing synth/, inst/, mood/ subdirectories.
        weights:    Per-source sampling weights ``[w_synth, w_inst, w_mood]``
                    (default equal).  Renormalized if a source is absent.
        n_mels:     Must match the value used by ``make_tfrecords``.
        frames:     Must match the value used by ``make_tfrecords``.
        batch_size: Examples per batch.
        shuffle:    Shuffle buffer size; 0/None to disable.
    """
    subs = [("synth", "synth"), ("inst", "inst"), ("mood", "mood")]
    eqw = weights or [1 / 3, 1 / 3, 1 / 3]
    dss, w = [], []
    for (name, sub), wi in zip(subs, eqw):
        files = sorted(glob.glob(os.path.join(root, sub, "*.tfrecord")))
        if not files:
            continue
        d = (
            tf.data.TFRecordDataset(files, num_parallel_reads=tf.data.AUTOTUNE)
            .map(lambda s: _parse_example(s, n_mels, frames),
                 num_parallel_calls=tf.data.AUTOTUNE)
            .repeat()
        )
        dss.append(d)
        w.append(wi)
    if not dss:
        raise ValueError(f"no source shards found under {root}")
    # Renormalize weights over present sources
    total_w = sum(w)
    w = [x / total_w for x in w]
    ds = tf.data.Dataset.sample_from_datasets(dss, weights=w, stop_on_empty_dataset=False)
    if shuffle:
        ds = ds.shuffle(shuffle)
    return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


def make_dataset(spec, n_mels=_TFR_N_MELS, frames=_TFR_FRAMES, batch_size=32, shuffle=1024):
    """Build a ``tf.data.Dataset`` of
    ``(logmel[..., None], {head: labels}, {head: mask})`` tuples.

    The generator turns each clip from :func:`iter_clips` into a fixed-shape
    log-mel feature plus the per-head label/mask dicts produced by
    :func:`_labels_for`. Masks are 1 for the heads a given source supervises and
    0 otherwise, so synthesized and real clips can share one dataset.
    """

    def gen():
        for pcm_bytes, source, meta in iter_clips(spec):
            logmel = _fix_frames(logmel_from_pcm(pcm_bytes, n_mels=n_mels), frames)
            labels, masks = _labels_for(
                source,
                instrument=meta.get("instrument"),
                effects=meta.get("effects"),
                mood=meta.get("mood"),
            )
            yield logmel[..., None], labels, masks

    feat_sig = tf.TensorSpec(shape=(n_mels, frames, 1), dtype=tf.float32)
    label_sig = {
        "instrument": tf.TensorSpec(shape=(len(INSTRUMENTS),), dtype=tf.float32),
        "effects": tf.TensorSpec(shape=(len(EFFECTS),), dtype=tf.float32),
        "mood": tf.TensorSpec(shape=(len(MOOD),), dtype=tf.float32),
    }
    mask_sig = {
        "instrument": tf.TensorSpec(shape=(1,), dtype=tf.float32),
        "effects": tf.TensorSpec(shape=(1,), dtype=tf.float32),
        "mood": tf.TensorSpec(shape=(1,), dtype=tf.float32),
    }

    ds = tf.data.Dataset.from_generator(
        gen, output_signature=(feat_sig, label_sig, mask_sig)
    )
    if shuffle:
        ds = ds.shuffle(shuffle)
    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds
