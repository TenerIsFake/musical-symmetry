import importlib.util, pytest
tf_missing = importlib.util.find_spec("tensorflow") is None
pytestmark = pytest.mark.skipif(tf_missing, reason="tensorflow not installed in this env")

def test_model_has_three_heads_with_right_widths():
    from model import build_model
    m = build_model(n_mels=128, frames=64)
    assert m.output_names_widths() == {"instrument": 19, "effects": 22, "mood": 8}

def test_masked_bce_zero_when_mask_zero():
    import numpy as np
    from model import masked_bce
    y_true = np.array([[1.0, 0.0]], dtype="float32"); y_pred = np.array([[0.9, 0.1]], dtype="float32")
    assert float(masked_bce(y_true, y_pred, mask=np.array([[0.0]], dtype="float32"))) == 0.0
