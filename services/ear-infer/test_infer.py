import numpy as np
import infer

def test_fix_frames_pad_and_crop():
    assert infer._fix_frames(np.ones((128, 40), np.float32), 64).shape == (128, 64)
    assert infer._fix_frames(np.ones((128, 90), np.float32), 64).shape == (128, 64)

def test_quant_dequant_roundtrip():
    detail = {"dtype": np.int8, "quantization": (0.05, -3)}
    x = np.array([0.0, 0.5, -0.5], np.float32)
    q = infer._quant_input(x, detail)
    assert q.dtype == np.int8
    back = infer._dequant(q, {"quantization": (0.05, -3)})
    assert np.allclose(back, x, atol=0.05)

def test_quant_input_float_passthrough():
    detail = {"dtype": np.float32, "quantization": (0.0, 0)}
    x = np.array([0.1, 0.2], np.float32)
    assert np.allclose(infer._quant_input(x, detail), x)

def test_decode_threshold_and_fallback():
    labels = ["a", "b", "c"]
    out = infer._decode(np.array([0.9, 0.7, 0.1], np.float32), labels, decision=0.5)
    assert [d["label"] for d in out] == ["a", "b"]
    assert out[0]["confidence"] >= out[1]["confidence"]
    # nothing clears threshold -> single top label returned
    only = infer._decode(np.array([0.2, 0.3, 0.1], np.float32), labels, decision=0.5)
    assert [d["label"] for d in only] == ["b"]

import os
FIX = os.path.join(os.path.dirname(__file__), "tests", "fixtures", "tiny_ear_int8.tflite")

def test_infer_end_to_end_real_model(monkeypatch):
    import pytest
    if not os.path.exists(FIX):
        pytest.skip("fixture not built")

    # Try to obtain a TFLite interpreter from whichever backend is importable.
    # Order: tflite_runtime (lightweight), pycoral (Edge TPU), tensorflow.lite (full TF).
    interp = None
    for _loader in (
        lambda: __import__("tflite_runtime.interpreter", fromlist=["Interpreter"]).Interpreter(model_path=FIX),
        lambda: __import__("pycoral.utils.edgetpu", fromlist=["make_interpreter"]).make_interpreter(FIX),
        lambda: __import__("tensorflow", fromlist=["lite"]).lite.Interpreter(model_path=FIX),
    ):
        try:
            interp = _loader()
            break
        except Exception:
            continue
    if interp is None:
        pytest.skip("no TFLite backend (tflite_runtime / pycoral / tensorflow) available in this venv")

    interp.allocate_tensors()
    # Inject interpreter directly so we bypass EAR_INFER_MODEL path lookup
    m = infer.Model.__new__(infer.Model)
    m.interp = interp

    pcm = (np.random.rand(16000) * 2 - 1).astype(np.float32)
    pcm = (pcm * 32767).astype("<i2").tobytes()
    out = m.infer(pcm, "isolated")
    assert set(out) == {"instruments", "effects", "mood"}
    assert all("label" in d and "confidence" in d for d in out["effects"])
    # labels come from the real vocab — these assertions also catch head mis-routing
    # (mis-routing would crash with IndexError or return labels from the wrong vocab)
    assert all(d["label"] in infer.EFFECTS for d in out["effects"])
    assert all(d["label"] in infer.INSTRUMENTS for d in out["instruments"])
    assert all(d["label"] in infer.MOOD for d in out["mood"])
