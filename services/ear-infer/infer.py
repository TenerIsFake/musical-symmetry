import hashlib, os
import numpy as np

INSTRUMENTS = ["Electric guitar","Acoustic guitar","Bass guitar","Upright bass","Acoustic piano",
  "Electric piano","Organ","Synth lead","Synth pad/bass","Acoustic kit","Electronic/drum machine",
  "Percussion","Vocals","Strings","Brass","Saxophone","Woodwinds","Banjo/mandolin","Other"]
EFFECTS = ["Reverb","Spring reverb","Delay/echo","Slapback","Chorus","Flanger","Phaser","Tremolo",
  "Vibrato","Rotary","Overdrive","Distortion","Fuzz","Tape saturation","Bitcrusher","Compression",
  "Noise gate","Sidechain pump","Wah","Auto-wah","Octave/pitch-shift","Harmonizer"]
MOOD = ["warm","bright","gritty","dreamy","aggressive","clean","lo-fi","spacious"]
SR = 16000

def pcm_to_logmel(pcm: bytes, n_mels: int = 128) -> np.ndarray:
    x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
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
    mel = np.stack([spec[edges[i]:max(edges[i] + 1, edges[i + 1])].mean(0) for i in range(n_mels)])
    return np.log1p(mel).astype(np.float32)

def _stub_heads(pcm: bytes):
    seed = int.from_bytes(hashlib.sha256(pcm).digest()[:4], "big")
    def pick(labels, n, off):
        out = []
        for i in range(n):
            idx = (seed + i * 31 + off) % len(labels)
            conf = round(0.55 + ((seed >> (i + off)) & 7) / 20, 2)
            out.append({"label": labels[idx], "confidence": conf})
        return out
    return {"instruments": pick(INSTRUMENTS,1,0), "effects": pick(EFFECTS,2,5), "mood": pick(MOOD,2,11)}

class Model:
    def __init__(self):
        self.interp = None
        path = os.environ.get("EAR_INFER_MODEL")
        if path and os.path.exists(path):
            try:
                if path.endswith("_edgetpu.tflite"):
                    from pycoral.utils.edgetpu import make_interpreter
                    self.interp = make_interpreter(path)
                else:
                    from tflite_runtime.interpreter import Interpreter
                    self.interp = Interpreter(model_path=path)
                self.interp.allocate_tensors()
            except Exception:
                self.interp = None

    def infer(self, pcm: bytes, domain: str):
        if self.interp is None:
            return _stub_heads(pcm)
        _ = pcm_to_logmel(pcm)
        return _stub_heads(pcm)  # placeholder until a trained model's IO signature is wired (sub-project B)
