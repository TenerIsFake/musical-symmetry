import numpy as np
import soundfile as sf
from prep.audio import to_pcm16k, array_to_pcm16k, window_clips

def _pcm_to_float(pcm):
    return np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0

def test_array_to_pcm16k_resamples_and_mono():
    # 0.5s stereo 32 kHz sine -> expect 8000 mono samples @ 16 kHz
    sr = 32000
    t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 220 * t)
    stereo = np.stack([tone, tone], axis=1)
    pcm = array_to_pcm16k(stereo, sr)
    x = _pcm_to_float(pcm)
    assert abs(len(x) - 8000) <= 2          # ~0.5s @ 16 kHz
    assert x.dtype == np.float32
    assert np.abs(x).max() > 0.1            # signal survived

def test_window_clips_exact_length_and_count():
    sr = 16000
    pcm = array_to_pcm16k(np.zeros(sr * 3 + 100, dtype=np.float32), sr)  # 3.00+s
    clips = window_clips(pcm, clip_seconds=1.0, sr=sr, drop_last=True)
    assert len(clips) == 3
    assert all(len(c) == sr * 2 for c in clips)  # 16000 samples * 2 bytes

def test_window_clips_pads_last_when_kept():
    sr = 16000
    pcm = array_to_pcm16k(np.zeros(sr + sr // 2, dtype=np.float32), sr)   # 1.5s
    clips = window_clips(pcm, clip_seconds=1.0, sr=sr, drop_last=False)
    assert len(clips) == 2
    assert all(len(c) == sr * 2 for c in clips)

def test_to_pcm16k_reads_file(tmp_path):
    sr = 22050
    x = (0.3 * np.sin(2 * np.pi * 440 * np.arange(sr) / sr)).astype(np.float32)
    p = tmp_path / "tone.wav"
    sf.write(p, x, sr)
    pcm = to_pcm16k(str(p))
    assert abs(len(_pcm_to_float(pcm)) - 16000) <= 2
