import json, numpy as np, soundfile as sf
from prep.build_synth import build_synth_corpus

def test_build_synth_corpus_writes_triples(tmp_path):
    sr = 16000
    dry = [ (0.2*np.sin(2*np.pi*220*np.arange(sr)/sr).astype(np.float32), sr, ["Electric guitar"]),
            (0.2*np.sin(2*np.pi*330*np.arange(sr)/sr).astype(np.float32), sr, ["Bass guitar"]) ]
    n = build_synth_corpus(iter(dry), str(tmp_path), seed=0)
    assert n == 2
    wavs = sorted(tmp_path.glob("*.wav"))
    assert len(wavs) == 2
    for w in wavs:
        base = str(w)[:-4]
        eff = np.load(base + ".effects.npy")
        inst = json.load(open(base + ".instrument.json"))
        assert eff.shape == (22,)
        assert isinstance(inst, list) and inst
        x, file_sr = sf.read(w)
        assert file_sr == 16000
