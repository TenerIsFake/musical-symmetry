import numpy as np
import tensorflow as tf
from labels import INSTRUMENTS, EFFECTS, MOOD

HEADS = {"instrument": len(INSTRUMENTS), "effects": len(EFFECTS), "mood": len(MOOD)}

def _sep_block(x, filters, stride, name):
    # depthwise-separable conv block: DW 3x3 (stride) -> BN -> ReLU -> PW 1x1 -> BN -> ReLU
    x = tf.keras.layers.DepthwiseConv2D(3, strides=stride, padding="same", use_bias=False, name=f"{name}_dw")(x)
    x = tf.keras.layers.BatchNormalization(name=f"{name}_dwbn")(x)
    x = tf.keras.layers.ReLU(name=f"{name}_dwrelu")(x)
    x = tf.keras.layers.Conv2D(filters, 1, padding="same", use_bias=False, name=f"{name}_pw")(x)
    x = tf.keras.layers.BatchNormalization(name=f"{name}_pwbn")(x)
    x = tf.keras.layers.ReLU(name=f"{name}_pwrelu")(x)
    return x

def build_model(n_mels=128, frames=64):
    inp = tf.keras.Input(shape=(n_mels, frames, 1), name="logmel")
    # stem
    x = tf.keras.layers.Conv2D(32, 3, strides=2, padding="same", use_bias=False, name="stem")(inp)
    x = tf.keras.layers.BatchNormalization(name="stem_bn")(x)
    x = tf.keras.layers.ReLU(name="stem_relu")(x)
    # depthwise-separable blocks (downsample via stride)
    x = _sep_block(x, 64,  2, "blk1")
    x = _sep_block(x, 128, 2, "blk2")
    x = _sep_block(x, 128, 1, "blk3")
    x = _sep_block(x, 256, 2, "blk4")
    x = _sep_block(x, 512, 1, "blk5")
    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    # per-head bottleneck: Dense(128)->ReLU->Dense(width, sigmoid). Head OUTPUT layer named per HEADS.
    outs = []
    for name, w in HEADS.items():
        h = tf.keras.layers.Dense(128, activation="relu", name=f"{name}_fc")(x)
        h = tf.keras.layers.Dense(w, activation="sigmoid", name=name)(h)
        outs.append(h)
    m = tf.keras.Model(inp, outs)
    m.output_names_widths = lambda: dict(HEADS)
    return m

def masked_bce(y_true, y_pred, mask):
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    mask = tf.reshape(tf.cast(mask, tf.float32), [-1])
    denom = tf.reduce_sum(mask) + 1e-8
    return tf.reduce_sum(bce * mask) / denom


def masked_bce_weighted(y_true, y_pred, mask, pos_weight):
    """Masked BCE with per-class positive weighting. pos_weight: (width,) tensor/array,
    weight applied to the positive term of each class (neg term weight = 1).
    Manual BCE so we can weight per class, then mean over classes, then mask over batch."""
    eps = 1e-7
    p = tf.clip_by_value(y_pred, eps, 1.0 - eps)
    pw = tf.cast(pos_weight, tf.float32)
    bce = -(pw * y_true * tf.math.log(p) + (1.0 - y_true) * tf.math.log(1.0 - p))  # (batch,width)
    bce = tf.reduce_mean(bce, axis=-1)  # (batch,)  mean over classes -> matches masked_bce reduction
    m = tf.reshape(tf.cast(mask, tf.float32), [-1])
    return tf.reduce_sum(bce * m) / (tf.reduce_sum(m) + 1e-8)


def masked_focal(y_true, y_pred, mask, gamma=2.0, alpha=0.25):
    """Masked multi-label focal loss. Down-weights easy examples by (1-p_t)^gamma."""
    eps = 1e-7
    p = tf.clip_by_value(y_pred, eps, 1.0 - eps)
    pt = y_true * p + (1.0 - y_true) * (1.0 - p)           # prob of the true class
    a = y_true * alpha + (1.0 - y_true) * (1.0 - alpha)
    fl = -a * tf.pow(1.0 - pt, gamma) * tf.math.log(pt)    # (batch,width)
    fl = tf.reduce_mean(fl, axis=-1)                        # (batch,)
    m = tf.reshape(tf.cast(mask, tf.float32), [-1])
    return tf.reduce_sum(fl * m) / (tf.reduce_sum(m) + 1e-8)


def compute_pos_weights(dataset, heads=HEADS, clip=(1.0, 50.0)):
    """One pass over a (feat, labels, masks) dataset. For each head, count positives and
    masked examples per class; return {head: (width,) float32 pos_weight} where
    pos_weight_c = clip( neg_c / pos_c , clip_min, clip_max ), pos_c floored at 1.
    Only clips with mask=1 for that head count."""
    pos = {h: np.zeros(w, np.float64) for h, w in heads.items()}
    tot = {h: 0.0 for h in heads}
    for _, labels, masks in dataset.unbatch():
        for h in heads:
            mk = float(tf.reshape(masks[h], [-1])[0])
            if mk > 0.5:
                pos[h] += labels[h].numpy(); tot[h] += 1.0
    out = {}
    for h, w in heads.items():
        pc = np.maximum(pos[h], 1.0)
        neg = np.maximum(tot[h] - pos[h], 0.0)
        out[h] = np.clip(neg / pc, clip[0], clip[1]).astype(np.float32)
    return out
