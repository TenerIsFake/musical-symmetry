import numpy as np
from pedalboard import Pedalboard, Reverb, Delay, Chorus, Phaser, Distortion, Compressor
from labels import EFFECTS

EFFECT_TO_PLUGIN = {
    "Reverb": lambda rng: Reverb(room_size=rng.uniform(0.3, 0.9), wet_level=rng.uniform(0.2, 0.6)),
    "Delay/echo": lambda rng: Delay(delay_seconds=rng.uniform(0.1, 0.5), feedback=rng.uniform(0.2, 0.6), mix=rng.uniform(0.2, 0.5)),
    "Chorus": lambda rng: Chorus(rate_hz=rng.uniform(0.5, 3.0), depth=rng.uniform(0.2, 0.6), mix=rng.uniform(0.3, 0.6)),
    "Phaser": lambda rng: Phaser(rate_hz=rng.uniform(0.5, 2.0), depth=rng.uniform(0.3, 0.8), mix=rng.uniform(0.3, 0.6)),
    "Distortion": lambda rng: Distortion(drive_db=rng.uniform(10, 35)),
    # pedalboard has no Overdrive class; Distortion at lower drive is the proxy
    "Overdrive": lambda rng: Distortion(drive_db=rng.uniform(5, 20)),
    "Compression": lambda rng: Compressor(threshold_db=rng.uniform(-30, -10), ratio=rng.uniform(2, 8)),
}

def multihot(effects):
    mh = np.zeros(len(EFFECTS), dtype=np.float32)
    for e in effects:
        mh[EFFECTS.index(e)] = 1.0
    return mh

def random_chain(rng, max_n=3):
    pool = list(EFFECT_TO_PLUGIN.keys())
    n = int(rng.integers(0, max_n + 1))
    return list(rng.choice(pool, size=n, replace=False)) if n else []

def synth_clip(dry: np.ndarray, sr: int, effects, seed: int = 0):
    unknown = [e for e in effects if e not in EFFECT_TO_PLUGIN]
    if unknown:
        raise ValueError(f"no pedalboard plugin for effects: {unknown} "
                         f"(generatable: {sorted(EFFECT_TO_PLUGIN)})")
    rng = np.random.default_rng(seed)
    board = Pedalboard([EFFECT_TO_PLUGIN[e](rng) for e in effects])
    wet = board(dry.astype(np.float32), sr) if len(board) else dry.astype(np.float32)
    return wet, multihot(effects)
