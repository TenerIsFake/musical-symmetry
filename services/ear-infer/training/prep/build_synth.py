"""Generate the synthesized-effects corpus: random pedalboard chains over dry
instrument audio, writing wet 16 kHz clips + exact effect/instrument labels."""
import json, logging, os
import numpy as np
import soundfile as sf

from synth import random_chain, synth_clip
from prep.audio import array_to_pcm16k

log = logging.getLogger(__name__)

def _write_pcm16k_wav(path, pcm_bytes):
    x = np.frombuffer(pcm_bytes, dtype="<i2").astype(np.float32) / 32768.0
    sf.write(path, x, 16000, subtype="PCM_16")

def build_synth_clip(dry, sr, instrument, out_dir, idx, rng, prefix=""):
    effects = random_chain(rng)                       # may be [] (clean example)
    wet, mh = synth_clip(np.asarray(dry, np.float32), sr, effects, seed=int(idx))
    base = os.path.join(out_dir, f"{prefix}clip_{idx:06d}")
    _write_pcm16k_wav(base + ".wav", array_to_pcm16k(wet, sr))
    np.save(base + ".effects.npy", mh)
    with open(base + ".instrument.json", "w") as f:
        json.dump(list(instrument), f)
    return base + ".wav"

def build_synth_corpus(dry_items, out_dir, seed=0, prefix=""):
    os.makedirs(out_dir, exist_ok=True)
    rng = np.random.default_rng(seed)
    n = 0
    for dry, sr, instrument in dry_items:
        build_synth_clip(dry, sr, instrument, out_dir, n, rng, prefix=prefix)
        n += 1
    return n


def build_synth_clip_from_path(wav_path, instrument, out_dir, idx, seed, prefix=""):
    """Read a dry wav, apply a random chain, write the clip + sidecars. Returns True on success.

    Reads happen HERE (in the worker thread) so they parallelize over I/O latency.
    seed is the corpus-level seed; per-clip RNG is derived from seed + idx for
    reproducible chains regardless of thread-completion order.
    """
    try:
        x, sr = sf.read(wav_path, dtype="float32", always_2d=False)
    except Exception as e:
        log.warning("build_synth: unreadable %s: %s", wav_path, e)
        return False
    rng = np.random.default_rng(seed + idx)
    build_synth_clip(x, sr, instrument, out_dir, idx, rng, prefix=prefix)
    return True
