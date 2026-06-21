"""TDD tests for OpenMIC-2018 + IRMAS + MedleyDB-sample ingest (instrument breadth).

Pure mapper tests run without any filesystem setup.
Writer smoke tests use tiny in-memory fixtures built with soundfile.
"""
import csv
import io
import json
import os
import tempfile

import numpy as np
import pytest
import soundfile as sf

# ---------------------------------------------------------------------------
# Imports under test
# ---------------------------------------------------------------------------
from labels import INSTRUMENTS
from prep.ingest import (
    _OPENMIC,
    _IRMAS,
    openmic_instruments,
    irmas_instrument,
    parse_openmic_labels,
    ingest_irmas,
    ingest_openmic,
    ingest_medleydb_sample,
)


# ===========================================================================
# Pure mapper tests (no filesystem)
# ===========================================================================

class TestOpenmicMap:
    def test_all_openmic_values_in_vocab(self):
        """Every value in the _OPENMIC map must be in INSTRUMENTS."""
        bad = [v for v in _OPENMIC.values() if v not in INSTRUMENTS]
        assert bad == [], f"_OPENMIC values not in INSTRUMENTS: {bad}"

    def test_dedup_and_drop_unknown(self):
        """Known names map and dedup; unrecognised names are dropped."""
        result = openmic_instruments(["guitar", "drums", "xylophone-ish"])
        assert result == ["Electric guitar", "Acoustic kit"]

    def test_dedup_same_target(self):
        """Trumpet and trombone both map to Brass; result deduped to one entry."""
        result = openmic_instruments(["trumpet", "trombone"])
        assert result == ["Brass"]

    def test_empty_input(self):
        assert openmic_instruments([]) == []

    def test_all_unknown(self):
        assert openmic_instruments(["xylophone-ish", "theremin-type"]) == []


class TestIrmasMap:
    def test_all_irmas_values_in_vocab(self):
        """Every value in the _IRMAS map must be in INSTRUMENTS."""
        bad = [v for v in _IRMAS.values() if v not in INSTRUMENTS]
        assert bad == [], f"_IRMAS values not in INSTRUMENTS: {bad}"

    def test_gel_electric_guitar(self):
        assert irmas_instrument("gel") == ["Electric guitar"]

    def test_gac_acoustic_guitar(self):
        assert irmas_instrument("gac") == ["Acoustic guitar"]

    def test_unknown_code(self):
        assert irmas_instrument("zzz") == []

    def test_case_insensitive(self):
        assert irmas_instrument("GEL") == ["Electric guitar"]

    def test_all_codes_map_correctly(self):
        expected = {
            "cel": "Strings", "cla": "Woodwinds", "flu": "Woodwinds",
            "gac": "Acoustic guitar", "gel": "Electric guitar", "org": "Organ",
            "pia": "Acoustic piano", "sax": "Saxophone", "tru": "Brass",
            "vio": "Strings", "voi": "Vocals",
        }
        for code, label in expected.items():
            assert irmas_instrument(code) == [label], f"code={code!r}"


class TestParseOpenmicLabels:
    def _make_csv(self, rows):
        """Build a CSV string with header + given rows."""
        lines = ["sample_key,instrument,relevance,num_responses"]
        for row in rows:
            lines.append(",".join(str(c) for c in row))
        return "\n".join(lines)

    def test_basic_parse(self, tmp_path):
        content = self._make_csv([
            ("abc001", "guitar", "0.8", "10"),
            ("abc001", "drums", "0.3", "10"),   # below threshold -> excluded
            ("abc002", "piano", "0.6", "8"),
        ])
        csv_path = tmp_path / "labels.csv"
        csv_path.write_text(content)
        result = parse_openmic_labels(str(csv_path), relevance_thresh=0.5)
        assert result == {
            "abc001": ["guitar"],     # drums excluded (0.3 < 0.5)
            "abc002": ["piano"],
        }

    def test_exact_threshold_included(self, tmp_path):
        """relevance == threshold should be included (>=)."""
        content = self._make_csv([("k1", "violin", "0.5", "5")])
        csv_path = tmp_path / "labels.csv"
        csv_path.write_text(content)
        result = parse_openmic_labels(str(csv_path), relevance_thresh=0.5)
        assert "k1" in result
        assert "violin" in result["k1"]

    def test_header_skipped(self, tmp_path):
        """Header row must not appear as a key."""
        content = self._make_csv([("k1", "guitar", "0.9", "5")])
        csv_path = tmp_path / "labels.csv"
        csv_path.write_text(content)
        result = parse_openmic_labels(str(csv_path))
        assert "sample_key" not in result

    def test_empty_csv(self, tmp_path):
        content = "sample_key,instrument,relevance,num_responses\n"
        csv_path = tmp_path / "labels.csv"
        csv_path.write_text(content)
        result = parse_openmic_labels(str(csv_path))
        assert result == {}


# ===========================================================================
# Writer smoke tests (filesystem fixtures)
# ===========================================================================

def _write_tiny_wav(path, sr=16000, duration=0.1):
    """Write a tiny silent WAV at *path*."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    samples = np.zeros(int(sr * duration), dtype=np.float32)
    sf.write(path, samples, sr)


def _write_tiny_ogg(path, sr=16000, duration=0.1):
    """Write a tiny silent OGG at *path*."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    samples = np.zeros(int(sr * duration), dtype=np.float32)
    sf.write(path, samples, sr, format="OGG", subtype="VORBIS")


class TestIngestIrmas:
    def test_writes_real_instrument(self, tmp_path):
        """A bracketed WAV file produces one clip with correct instrument JSON and prefix."""
        # IRMAS structure: <root>/<code>/<filename>[code][tag].wav
        irmas_root = tmp_path / "irmas"
        audio_dir = irmas_root / "gel"
        audio_dir.mkdir(parents=True)
        wav_path = audio_dir / "001__[gel][nod]1.wav"
        _write_tiny_wav(str(wav_path))

        out_dir = tmp_path / "out"
        count = ingest_irmas(str(irmas_root), str(out_dir))

        assert count == 1
        wavs = [f for f in os.listdir(str(out_dir)) if f.endswith(".wav")]
        assert len(wavs) == 1
        assert wavs[0].startswith("irmas_")

        base = os.path.join(str(out_dir), wavs[0][:-4])
        with open(base + ".instrument.json") as fh:
            inst = json.load(fh)
        assert inst == ["Electric guitar"]

    def test_skips_unknown_code(self, tmp_path):
        """Files whose bracket code is unknown are silently skipped."""
        irmas_root = tmp_path / "irmas"
        audio_dir = irmas_root / "zzz"
        audio_dir.mkdir(parents=True)
        wav_path = audio_dir / "001__[zzz]1.wav"
        _write_tiny_wav(str(wav_path))

        out_dir = tmp_path / "out"
        count = ingest_irmas(str(irmas_root), str(out_dir))
        assert count == 0

    def test_skips_no_bracket(self, tmp_path):
        """Files with no bracket annotation are skipped."""
        irmas_root = tmp_path / "irmas"
        audio_dir = irmas_root / "gel"
        audio_dir.mkdir(parents=True)
        wav_path = audio_dir / "001_nobracket.wav"
        _write_tiny_wav(str(wav_path))

        out_dir = tmp_path / "out"
        count = ingest_irmas(str(irmas_root), str(out_dir))
        assert count == 0

    def test_no_effects_npy(self, tmp_path):
        """inst/ clips must NOT have an effects.npy (real_instrument source)."""
        irmas_root = tmp_path / "irmas"
        audio_dir = irmas_root / "pia"
        audio_dir.mkdir(parents=True)
        _write_tiny_wav(str(audio_dir / "x__[pia]1.wav"))

        out_dir = tmp_path / "out"
        ingest_irmas(str(irmas_root), str(out_dir))

        npy_files = [f for f in os.listdir(str(out_dir)) if f.endswith(".npy")]
        assert npy_files == []


class TestIngestOpenmic:
    def test_writes_clip_with_prefix(self, tmp_path):
        """Tiny OGG → clip with openmic_ prefix and correct instrument JSON."""
        openmic_root = tmp_path / "openmic"
        key = "abcdef0123456789abcdef"   # 22-char key; first 3 chars = subdir
        audio_dir = openmic_root / "audio" / key[:3]
        audio_dir.mkdir(parents=True)
        _write_tiny_ogg(str(audio_dir / f"{key}.ogg"))

        labels_by_key = {key: ["guitar", "drums"]}
        out_dir = tmp_path / "out"
        count = ingest_openmic(str(openmic_root), str(out_dir), labels_by_key)

        assert count == 1
        wavs = [f for f in os.listdir(str(out_dir)) if f.endswith(".wav")]
        assert len(wavs) == 1
        assert wavs[0].startswith("openmic_")

        base = os.path.join(str(out_dir), wavs[0][:-4])
        with open(base + ".instrument.json") as fh:
            inst = json.load(fh)
        assert inst == ["Electric guitar", "Acoustic kit"]

    def test_skips_key_with_empty_instruments(self, tmp_path):
        """Key whose labels all map to unknown -> no clip written."""
        openmic_root = tmp_path / "openmic"
        key = "zzzzzzzzzzzzzzzzzzzzzz"
        audio_dir = openmic_root / "audio" / key[:3]
        audio_dir.mkdir(parents=True)
        _write_tiny_ogg(str(audio_dir / f"{key}.ogg"))

        labels_by_key = {key: ["xylophone-ish"]}
        out_dir = tmp_path / "out"
        count = ingest_openmic(str(openmic_root), str(out_dir), labels_by_key)
        assert count == 0

    def test_no_effects_npy(self, tmp_path):
        """inst/ clips must NOT have an effects.npy (real_instrument source)."""
        openmic_root = tmp_path / "openmic"
        key = "aabbcc112233445566778899"
        audio_dir = openmic_root / "audio" / key[:3]
        audio_dir.mkdir(parents=True)
        _write_tiny_ogg(str(audio_dir / f"{key}.ogg"))

        labels_by_key = {key: ["piano"]}
        out_dir = tmp_path / "out"
        ingest_openmic(str(openmic_root), str(out_dir), labels_by_key)

        npy_files = [f for f in os.listdir(str(out_dir)) if f.endswith(".npy")]
        assert npy_files == []


class TestIngestMedleydbSample:
    def _make_medleydb_fixture(self, root):
        """Build a minimal MedleyDB sample directory structure with a YAML metadata file."""
        import yaml
        track_name = "MusicDelta_Beethoven"
        track_dir = root / track_name
        stems_dir = track_dir / f"{track_name}_STEMS"
        stems_dir.mkdir(parents=True)

        stem_file = stems_dir / "MusicDelta_Beethoven_STEM_01.wav"
        _write_tiny_wav(str(stem_file))

        metadata = {
            "stems": {
                "S01": {
                    "filename": stem_file.name,
                    "instrument": "violin",
                }
            }
        }
        meta_path = track_dir / f"{track_name}_METADATA.yaml"
        meta_path.write_text(yaml.dump(metadata))
        return root

    def test_yaml_instrument_extraction(self, tmp_path):
        """YAML-parsed stem instrument maps to correct vocab label."""
        import yaml
        root = tmp_path / "medleydb_sample"
        self._make_medleydb_fixture(root)

        out_dir = tmp_path / "out"
        count = ingest_medleydb_sample(str(root), str(out_dir))

        assert count == 1
        wavs = [f for f in os.listdir(str(out_dir)) if f.endswith(".wav")]
        assert len(wavs) == 1
        assert wavs[0].startswith("medleydbsample_")

        base = os.path.join(str(out_dir), wavs[0][:-4])
        with open(base + ".instrument.json") as fh:
            inst = json.load(fh)
        assert inst == ["Strings"]

    def test_no_effects_npy(self, tmp_path):
        """inst/ clips must NOT have an effects.npy."""
        root = tmp_path / "medleydb_sample"
        self._make_medleydb_fixture(root)

        out_dir = tmp_path / "out"
        ingest_medleydb_sample(str(root), str(out_dir))

        npy_files = [f for f in os.listdir(str(out_dir)) if f.endswith(".npy")]
        assert npy_files == []

    def test_unknown_instrument_skipped(self, tmp_path):
        """Stem with instrument not in _MEDLEYDB maps to 'Other'; clip is still written."""
        import yaml
        root = tmp_path / "medleydb_sample2"
        track_dir = root / "SomeTrack"
        stems_dir = track_dir / "SomeTrack_STEMS"
        stems_dir.mkdir(parents=True)

        stem_file = stems_dir / "SomeTrack_STEM_01.wav"
        _write_tiny_wav(str(stem_file))

        metadata = {
            "stems": {
                "S01": {
                    "filename": stem_file.name,
                    "instrument": "sitar",  # not in _MEDLEYDB -> "Other"
                }
            }
        }
        (track_dir / "SomeTrack_METADATA.yaml").write_text(yaml.dump(metadata))

        out_dir = tmp_path / "out"
        count = ingest_medleydb_sample(str(root), str(out_dir))
        # "Other" is in INSTRUMENTS, so clip should be written
        assert count == 1
        with open(
            os.path.join(str(out_dir),
                         [f for f in os.listdir(str(out_dir)) if f.endswith(".instrument.json")][0])
        ) as fh:
            assert json.load(fh) == ["Other"]
