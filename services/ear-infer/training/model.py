import tensorflow as tf
from labels import INSTRUMENTS, EFFECTS, MOOD

HEADS = {"instrument": len(INSTRUMENTS), "effects": len(EFFECTS), "mood": len(MOOD)}

def build_model(n_mels=128, frames=64):
    inp = tf.keras.Input(shape=(n_mels, frames, 1), name="logmel")
    x = inp
    for f in (16, 32, 64):
        x = tf.keras.layers.Conv2D(f, 3, padding="same", activation="relu")(x)
        x = tf.keras.layers.MaxPool2D()(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outs = [tf.keras.layers.Dense(w, activation="sigmoid", name=name)(x) for name, w in HEADS.items()]
    m = tf.keras.Model(inp, outs)
    m.output_names_widths = lambda: dict(HEADS)
    return m

def masked_bce(y_true, y_pred, mask):
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    mask = tf.reshape(tf.cast(mask, tf.float32), [-1])
    denom = tf.reduce_sum(mask) + 1e-8
    return tf.reduce_sum(bce * mask) / denom
