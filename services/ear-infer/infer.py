import hashlib, json, os
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
            c = conf >= 0.66
            out.append({"label": labels[idx], "confidence": conf,
                        "confident": c, "flag": "" if c else "★"})
        return out
    return {"instruments": pick(INSTRUMENTS,1,0), "effects": pick(EFFECTS,2,5), "mood": pick(MOOD,2,11)}

def _fix_frames(logmel, frames):
    n_mels, t = logmel.shape
    if t == frames:
        return logmel
    if t > frames:
        return logmel[:, :frames]
    pad = np.zeros((n_mels, frames - t), dtype=logmel.dtype)
    return np.concatenate([logmel, pad], axis=1)

def _quant_input(value, detail):
    if detail["dtype"] == np.float32:
        return value.astype(np.float32)
    scale, zero = detail["quantization"]
    q = np.round(value / scale + zero)
    info = np.iinfo(detail["dtype"])
    return np.clip(q, info.min, info.max).astype(detail["dtype"])

def _dequant(value, detail):
    scale, zero = detail["quantization"]
    if scale == 0:
        return value.astype(np.float32)
    return (value.astype(np.float32) - zero) * scale

_THRESHOLD_DEFAULTS = {"instrument": 0.5, "effects": 0.5, "mood": 0.5}

def _load_thresholds(model_path):
    """Load per-head decision thresholds from a sidecar JSON file.

    Search order:
    1. EAR_INFER_THRESHOLDS env var (explicit path)
    2. <model_path_without_extension>.thresholds.json  (next to the model)
    3. <model_path>.thresholds.json                     (next to the model, alt naming)

    Accepts both JSON schemas:
    - Flat:   {"instrument": 0.35, "effects": 0.40, "mood": 0.5}
    - Nested: {"thresholds": {"instrument":0.35, ...}, "_meta": {...}}

    When the nested schema is detected (top-level "thresholds" key present),
    reads thresholds from that sub-dict.

    Returns a dict with keys instrument/effects/mood, defaulting missing keys to 0.5.
    Never raises — on any error returns all-0.5 defaults.
    """
    candidates = []
    env_path = os.environ.get("EAR_INFER_THRESHOLDS")
    if env_path:
        candidates.append(env_path)
    if model_path:
        stem, _ = os.path.splitext(model_path)
        candidates.append(stem + ".thresholds.json")
        candidates.append(model_path + ".thresholds.json")
    for path in candidates:
        try:
            with open(path, "r") as fh:
                data = json.load(fh)
            # Detect nested schema: {"thresholds": {...}, "_meta": {...}}
            thresh_map = data["thresholds"] if "thresholds" in data else data
            result = dict(_THRESHOLD_DEFAULTS)
            for key in _THRESHOLD_DEFAULTS:
                if key in thresh_map:
                    result[key] = float(thresh_map[key])
            return result
        except Exception:
            continue
    return dict(_THRESHOLD_DEFAULTS)


def _decode(prob, labels, decision=0.5, high_confidence=None, top_k=0):
    """Decode a sigmoid head into [{label, confidence, confident, flag}].

    A prediction clears `decision` to be returned at all. It is marked
    ``confident`` only if its probability also reaches `high_confidence`
    (a stricter bar); otherwise it gets ``flag="★"`` so the UI can star
    low-confidence/over-fired suggestions. If `high_confidence` is None it
    defaults to a bar above the decision threshold.
    """
    if high_confidence is None:
        high_confidence = max(0.66, decision + 0.2)
    order = np.argsort(prob)[::-1]
    picks = [i for i in order if prob[i] >= decision]
    if not picks:
        picks = [int(order[0])]
    if top_k:
        picks = picks[:top_k]
    out = []
    for i in picks:
        p = float(prob[i])
        conf = p >= high_confidence
        out.append({"label": labels[i], "confidence": round(p, 2),
                    "confident": conf, "flag": "" if conf else "★"})
    return out

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
        self.thresholds = _load_thresholds(path)
        # Per-head "confident" bar: a prediction clears the decision threshold to be
        # returned, but is only unflagged if it also reaches this higher bar.
        self.high_confidence = {h: max(0.66, t + 0.2) for h, t in self.thresholds.items()}

    def _match_outputs(self, out_details):
        # TFLite strips Keras output-layer names to "StatefulPartitionedCall:N", so
        # substring-matching on head names fails and positional order is not guaranteed.
        # The three head widths are DISTINCT (instrument=19, effects=22, mood=8), making
        # width-matching robust and unambiguous.
        head_widths = {
            "instrument": len(INSTRUMENTS),   # 19
            "effects":    len(EFFECTS),        # 22
            "mood":       len(MOOD),           # 8
        }
        by_head = {}
        for head_name, width in head_widths.items():
            matches = [d for d in out_details if d["shape"][-1] == width]
            if len(matches) != 1:
                raise ValueError(
                    f"_match_outputs: expected exactly 1 output tensor with width {width} "
                    f"for head '{head_name}', found {len(matches)}. "
                    f"Output tensors: {[(d['name'], d['shape']) for d in out_details]}"
                )
            by_head[head_name] = matches[0]
        return by_head

    def infer(self, pcm: bytes, domain: str):
        if self.interp is None:
            return _stub_heads(pcm)
        logmel = _fix_frames(pcm_to_logmel(pcm), 64)            # (128, 64)
        x = logmel[None, ..., None].astype(np.float32)          # (1,128,64,1)
        in_detail = self.interp.get_input_details()[0]
        self.interp.set_tensor(in_detail["index"], _quant_input(x, in_detail))
        self.interp.invoke()
        out_by_head = self._match_outputs(self.interp.get_output_details())
        def head(name):
            d = out_by_head[name]
            return _dequant(self.interp.get_tensor(d["index"])[0], d)
        # Resilient: derive the confident-bar from thresholds if not set in __init__
        # (covers code/tests that construct Model without going through __init__).
        hc = getattr(self, "high_confidence", None) or {
            h: max(0.66, t + 0.2) for h, t in self.thresholds.items()}
        return {
            "instruments": _decode(head("instrument"), INSTRUMENTS, decision=self.thresholds["instrument"], high_confidence=hc["instrument"]),
            "effects":     _decode(head("effects"),    EFFECTS,     decision=self.thresholds["effects"],    high_confidence=hc["effects"]),
            "mood":        _decode(head("mood"),        MOOD,        decision=self.thresholds["mood"],       high_confidence=hc["mood"]),
        }
