from labels import INSTRUMENTS, MOOD
from prep.ingest import (nsynth_instrument, musdb_stems_to_instruments,
                         jamendo_tags_to_mood, medleydb_instrument)

def test_nsynth_family_mapping():
    assert nsynth_instrument("guitar") == ["Electric guitar"]
    assert nsynth_instrument("bass") == ["Bass guitar"]
    assert nsynth_instrument("keyboard") == ["Electric piano"]
    assert nsynth_instrument("vocal") == ["Vocals"]
    assert nsynth_instrument("mallet") == ["Percussion"]
    # unknown family falls back to "Other", always valid vocab
    assert nsynth_instrument("zzz") == ["Other"]
    for fam in ["guitar","bass","keyboard","vocal","mallet","reed","brass","flute","string","organ","synth_lead"]:
        assert all(lbl in INSTRUMENTS for lbl in nsynth_instrument(fam))

def test_musdb_stems_mapping():
    got = musdb_stems_to_instruments(["vocals", "drums", "bass"])
    assert "Vocals" in got and "Acoustic kit" in got and "Bass guitar" in got
    assert all(lbl in INSTRUMENTS for lbl in got)
    assert musdb_stems_to_instruments([]) == []

def test_jamendo_mood_mapping_drops_unmapped():
    got = jamendo_tags_to_mood(["mood/theme---dark", "mood/theme---happy", "mood/theme---xyzzy"])
    assert all(m in MOOD for m in got)
    assert got  # at least one mapped
    assert jamendo_tags_to_mood(["mood/theme---xyzzy"]) == []

def test_medleydb_instrument_mapping():
    assert medleydb_instrument("electric guitar") == ["Electric guitar"]
    assert medleydb_instrument("drum set") == ["Acoustic kit"]
    assert all(lbl in INSTRUMENTS for lbl in medleydb_instrument("male singer"))
