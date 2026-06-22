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

# --- BACKBONE-V5 tests ---

def test_build_model_output_shapes():
    """3 outputs with exact shapes (None,19), (None,22), (None,8) in HEADS order; input (None,128,64,1)."""
    import tensorflow as tf
    from model import build_model, HEADS
    m = build_model(n_mels=128, frames=64)
    assert len(m.inputs) == 1
    assert tuple(m.inputs[0].shape) == (None, 128, 64, 1)
    assert len(m.outputs) == 3
    expected = list(HEADS.values())  # [19, 22, 8]
    for out, width in zip(m.outputs, expected):
        assert out.shape[-1] == width, f"Expected width {width}, got {out.shape[-1]}"

def test_build_model_more_capacity():
    """New backbone must have >300k params (old ~100k was 3 plain Conv blocks)."""
    from model import build_model
    m = build_model(n_mels=128, frames=64)
    total = m.count_params()
    assert total > 300_000, f"Expected >300k params, got {total}"

def test_forward_pass_sigmoid_range():
    """Random (2,128,64,1) batch -> 3 outputs each in [0,1] with correct widths."""
    import numpy as np, tensorflow as tf
    from model import build_model, HEADS
    m = build_model(n_mels=128, frames=64)
    x = np.random.rand(2, 128, 64, 1).astype(np.float32)
    outs = m(x, training=False)
    assert len(outs) == 3
    for out, (name, width) in zip(outs, HEADS.items()):
        arr = out.numpy()
        assert arr.shape == (2, width), f"Head {name}: expected (2,{width}), got {arr.shape}"
        assert float(arr.min()) >= 0.0, f"Head {name}: min value {arr.min()} < 0"
        assert float(arr.max()) <= 1.0, f"Head {name}: max value {arr.max()} > 1"

def test_outputs_named_for_heads():
    """Keras output_names must exactly match the head names (instrument/effects/mood).
    Note: in TF2, m.outputs[i].name is an opaque tensor id; use m.output_names instead,
    which is set by the Keras layer names at model construction time."""
    from model import build_model, HEADS
    m = build_model(n_mels=128, frames=64)
    model_output_names = list(m.output_names)
    for head_name in HEADS:
        assert head_name in model_output_names, (
            f"Head '{head_name}' not found in m.output_names: {model_output_names}"
        )

def test_int8_tflite_conversion():
    """Build model -> int8 TFLite convert -> non-empty bytes (confirms quantization path works)."""
    import numpy as np, tensorflow as tf
    from model import build_model
    m = build_model(n_mels=128, frames=64)
    def rep():
        for _ in range(10):
            yield [np.random.rand(1, 128, 64, 1).astype(np.float32)]
    conv = tf.lite.TFLiteConverter.from_keras_model(m)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = rep
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    tflite_bytes = conv.convert()
    assert len(tflite_bytes) > 0, "int8 TFLite conversion produced empty output"
