"""Decode arbitrary audio to the model's 16 kHz mono int16 PCM contract."""
import numpy as np
import soundfile as sf

try:
    from scipy.signal import resample_poly
    def _resample(x, sr_in, sr_out):
        if sr_in == sr_out:
            return x
        from math import gcd
        g = gcd(int(sr_in), int(sr_out))
        return resample_poly(x, sr_out // g, sr_in // g).astype(np.float32)
except Exception:  # scipy not present: linear-interp fallback
    def _resample(x, sr_in, sr_out):
        if sr_in == sr_out:
            return x
        n_out = int(round(len(x) * sr_out / sr_in))
        xp = np.linspace(0, 1, len(x), endpoint=False)
        fp = np.linspace(0, 1, n_out, endpoint=False)
        return np.interp(fp, xp, x).astype(np.float32)

SR = 16000

def array_to_pcm16k(x: np.ndarray, sr: int) -> bytes:
    x = np.asarray(x, dtype=np.float32)
    if x.ndim > 1:                      # downmix to mono
        x = x.mean(axis=1)
    x = _resample(x, sr, SR)
    x = np.clip(x, -1.0, 1.0)
    return (x * 32767.0).astype("<i2").tobytes()

def to_pcm16k(path: str) -> bytes:
    x, sr = sf.read(path, dtype="float32", always_2d=False)
    return array_to_pcm16k(x, sr)

def window_clips(pcm: bytes, clip_seconds: float = 1.0, sr: int = SR,
                 drop_last: bool = True) -> list:
    n = int(round(clip_seconds * sr))           # samples per clip
    step = n * 2                                 # bytes per clip (int16)
    out, i = [], 0
    while i + step <= len(pcm):
        out.append(pcm[i:i + step]); i += step
    if not drop_last and i < len(pcm):
        tail = pcm[i:]
        out.append(tail + b"\x00" * (step - len(tail)))
    return out
