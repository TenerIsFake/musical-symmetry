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
