import numpy as np
import pytest
from synth import synth_clip, EFFECT_TO_PLUGIN, multihot
from labels import EFFECTS

SR = 16000
def dry_tone(sec=1.0):
    t = np.linspace(0, sec, int(SR*sec), endpoint=False)
    return (0.3*np.sin(2*np.pi*220*t)).astype(np.float32)

def test_multihot_marks_applied_effects():
    mh = multihot(["Reverb", "Delay/echo"])
    assert mh.shape == (len(EFFECTS),)
    assert mh[EFFECTS.index("Reverb")] == 1.0 and mh[EFFECTS.index("Delay/echo")] == 1.0
    assert mh.sum() == 2.0

def test_synth_applies_effect_and_changes_signal():
    dry = dry_tone()
    eff = "Reverb" if "Reverb" in EFFECT_TO_PLUGIN else next(iter(EFFECT_TO_PLUGIN))
    wet, mh = synth_clip(dry, SR, [eff], seed=1)
    assert abs(wet.shape[0]-dry.shape[0]) < SR
    assert not np.allclose(wet[:len(dry)], dry, atol=1e-3)
    assert mh[EFFECTS.index(eff)] == 1.0

def test_dry_clip_has_zero_multihot():
    dry = dry_tone()
    wet, mh = synth_clip(dry, SR, [], seed=2)
    assert mh.sum() == 0.0

def test_synth_clip_rejects_ungeneratable_effect():
    dry = dry_tone()
    with pytest.raises(ValueError):
        synth_clip(dry, SR, ["Spring reverb"], seed=3)  # in EFFECTS but no plugin
