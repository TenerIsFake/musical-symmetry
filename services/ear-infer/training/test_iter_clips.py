import json, numpy as np, soundfile as sf
from dataset import iter_clips

def _make_corpus(root, variant="isolated"):
    sdir = root / "synth" / variant
    mdir = root / "mood"
    sdir.mkdir(parents=True); mdir.mkdir(parents=True)
    # one 2s synth clip @ 16k -> 2 one-second windows
    sf.write(sdir / "clip_000001.wav", np.zeros(32000, np.float32), 16000)
    np.save(sdir / "clip_000001.effects.npy", np.zeros(22, np.float32))
    (sdir / "clip_000001.instrument.json").write_text(json.dumps(["Electric guitar"]))
    # one 1s mood clip
    sf.write(mdir / "track_a.wav", np.zeros(16000, np.float32), 16000)
    (mdir / "track_a.mood.json").write_text(json.dumps(["dreamy", "warm"]))
    return {"variant": variant, "synth_dir": str(root / "synth"),
            "mood_dir": str(mdir), "clip_seconds": 1.0}

def test_iter_clips_yields_synth_and_mood(tmp_path):
    spec = _make_corpus(tmp_path)
    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    assert sources.count("synth") == 2        # 2 windows from the 2s clip
    assert sources.count("real_mood") == 1
    for pcm, source, meta in items:
        assert len(pcm) == 16000 * 2          # exactly 1s int16
        if source == "synth":
            assert meta["instrument"] == ["Electric guitar"]
            assert isinstance(meta["effects"], np.ndarray) and meta["effects"].shape == (22,)
        else:
            assert set(meta["mood"]) == {"dreamy", "warm"}

def test_iter_clips_variant_selects_subdir(tmp_path):
    _make_corpus(tmp_path, variant="isolated")
    spec_mix = {"variant": "mix", "synth_dir": str(tmp_path / "synth"),
                "mood_dir": str(tmp_path / "mood"), "clip_seconds": 1.0}
    # mix subdir does not exist -> only mood clips yielded, no crash
    assert [s for _, s, _ in iter_clips(spec_mix)] == ["real_mood"]

def test_iter_clips_reads_inst_as_real_instrument(tmp_path):
    spec = _make_corpus(tmp_path)
    # add inst corpus with one 1s clip + instrument.json sidecar
    idir = tmp_path / "inst"
    idir.mkdir(parents=True)
    sf.write(idir / "track.wav", np.zeros(16000, np.float32), 16000)
    (idir / "track.instrument.json").write_text(json.dumps(["Vocals", "Bass guitar"]))
    # update spec to include inst_dir
    spec["inst_dir"] = str(idir)

    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    # expect synth (2 windows) + mood (1) + real_instrument (1)
    assert sources.count("synth") == 2
    assert sources.count("real_mood") == 1
    assert sources.count("real_instrument") == 1

    # verify the real_instrument item
    for pcm, source, meta in items:
        if source == "real_instrument":
            assert meta["instrument"] == ["Vocals", "Bass guitar"]
            assert len(pcm) == 16000 * 2  # exactly 1s int16

def test_iter_clips_inst_dir_absent_ok(tmp_path):
    spec = _make_corpus(tmp_path)
    # inst_dir points to a non-existent directory
    spec["inst_dir"] = str(tmp_path / "inst_does_not_exist")

    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    # expect only synth (2) + mood (1), no crash, no real_instrument
    assert sources.count("synth") == 2
    assert sources.count("real_mood") == 1
    assert sources.count("real_instrument") == 0

def test_iter_clips_max_windows_per_clip_synth(tmp_path):
    """When max_windows_per_clip=1, cap synth windows to 1 per file."""
    spec = _make_corpus(tmp_path)
    spec["max_windows_per_clip"] = 1
    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    # expect synth (1 window, capped from 2) + mood (1)
    assert sources.count("synth") == 1
    assert sources.count("real_mood") == 1

def test_iter_clips_max_windows_per_clip_mood(tmp_path):
    """When max_windows_per_clip=1, cap mood windows to 1 per file."""
    spec = _make_corpus(tmp_path)
    # Create a 2-second mood clip -> 2 windows by default
    import json, soundfile as sf
    mdir = tmp_path / "mood"
    sf.write(mdir / "track_multi.wav", np.zeros(32000, np.float32), 16000)
    (mdir / "track_multi.mood.json").write_text(json.dumps(["dreamy"]))

    spec["max_windows_per_clip"] = 1
    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    # original: synth (2) + mood (1 from track_a + 2 from track_multi) = 5
    # with cap=1: synth (1) + mood (1 from track_a, capped to 1 from track_multi) = 3
    assert sources.count("synth") == 1
    assert sources.count("real_mood") == 2  # 1 from track_a, 1 from track_multi

def test_iter_clips_max_windows_unset_unchanged(tmp_path):
    """Without max_windows_per_clip, behavior is unchanged."""
    spec = _make_corpus(tmp_path)
    # No max_windows_per_clip key
    items = list(iter_clips(spec))
    sources = [s for _, s, _ in items]
    # expect synth (2 windows from 2s clip) + mood (1)
    assert sources.count("synth") == 2
    assert sources.count("real_mood") == 1
