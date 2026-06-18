"""Build a tiny full-int8 3-head tflite that matches the real head widths, for
serving-side tests. Run once with the training venv (needs TensorFlow)."""
import os, numpy as np, tensorflow as tf
import sys; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import build_model

def main(out):
    m = build_model(n_mels=128, frames=64)
    def rep():
        for _ in range(50):
            yield [np.random.rand(1, 128, 64, 1).astype(np.float32)]
    conv = tf.lite.TFLiteConverter.from_keras_model(m)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = rep
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    _d = os.path.dirname(out)
    if _d:
        os.makedirs(_d, exist_ok=True)
    open(out, "wb").write(conv.convert())
    print("wrote", out)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else
         os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "tiny_ear_int8.tflite"))
