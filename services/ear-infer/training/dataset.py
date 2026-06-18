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
import numpy as np
import tensorflow as tf

from labels import INSTRUMENTS, EFFECTS, MOOD

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
    """
    import glob, json, os
    from prep.audio import to_pcm16k, window_clips

    variant = spec.get("variant", "isolated")
    clip_seconds = float(spec.get("clip_seconds", 1.0))

    synth_root = os.path.join(spec["synth_dir"], variant)
    for wav in sorted(glob.glob(os.path.join(synth_root, "*.wav"))):
        base = wav[:-4]
        eff = np.load(base + ".effects.npy") if os.path.exists(base + ".effects.npy") \
            else np.zeros(len(EFFECTS), dtype=np.float32)
        inst = json.load(open(base + ".instrument.json")) \
            if os.path.exists(base + ".instrument.json") else []
        for pcm in window_clips(to_pcm16k(wav), clip_seconds=clip_seconds):
            yield pcm, "synth", {"instrument": inst, "effects": eff}

    for wav in sorted(glob.glob(os.path.join(spec["mood_dir"], "*.wav"))):
        base = wav[:-4]
        mood = json.load(open(base + ".mood.json")) \
            if os.path.exists(base + ".mood.json") else []
        for pcm in window_clips(to_pcm16k(wav), clip_seconds=clip_seconds):
            yield pcm, "real_mood", {"mood": mood}


def make_dataset(spec, n_mels=128, frames=64, batch_size=32, shuffle=1024):
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
