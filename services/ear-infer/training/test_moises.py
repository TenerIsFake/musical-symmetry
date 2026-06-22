"""TDD tests for Moises stem ingest (moises_instrument mapper + ingest_moises writer).

Brief: /home/tener/musical-symmetry/.git/sdd/moises-brief.md

Tests:
  1. test_moises_map_in_vocab  — mapper vocab coverage + specific mappings + drops
  2. test_stem_parse           — regex stem extraction from real Moises filenames
  3. test_ingest_moises_windows_and_skips — writer windowing + metronome drop + no effects.npy
"""
import json
import os
import re

import numpy as np
import pytest
import soundfile as sf

from labels import INSTRUMENTS
from prep.ingest import _MOISES, moises_instrument, ingest_moises


# ---------------------------------------------------------------------------
# 1. Mapper vocabulary coverage + specific mappings + drops
# ---------------------------------------------------------------------------

class TestMoisesMapInVocab:
    def test_all_moises_values_in_instruments(self):
        """Every value in _MOISES must be in INSTRUMENTS."""
        bad = [v for v in _MOISES.values() if v not in INSTRUMENTS]
        assert bad == [], f"_MOISES values not in INSTRUMENTS: {bad}"

    def test_bass_maps_to_bass_guitar(self):
        assert moises_instrument("bass") == ["Bass guitar"]

    def test_vocals_maps_to_vocals(self):
        assert moises_instrument("vocals") == ["Vocals"]

    def test_backing_vocals_maps_to_vocals(self):
        assert moises_instrument("backing_vocals") == ["Vocals"]

    def test_drum_components_map_to_acoustic_kit(self):
        for stem in ("kick", "snare", "cymbals"):
            assert moises_instrument(stem) == ["Acoustic kit"], f"stem={stem!r}"

    def test_other_returns_empty(self):
        """'other' is the residual bucket; must be dropped."""
        assert moises_instrument("other") == []

    def test_metronome_returns_empty(self):
        """'metronome' is a click track; must be dropped."""
        assert moises_instrument("metronome") == []

    def test_unknown_stem_returns_empty(self):
        assert moises_instrument("theremin") == []

    def test_case_insensitive_and_stripped(self):
        assert moises_instrument("  Bass  ") == ["Bass guitar"]
        assert moises_instrument("VOCALS") == ["Vocals"]


# ---------------------------------------------------------------------------
# 2. Stem-name regex parse
# ---------------------------------------------------------------------------

class TestStemParse:
    _PATTERN = r"-([a-z_]+)-[A-G][^/]*\.wav$"

    def _extract(self, basename):
        m = re.search(self._PATTERN, basename)
        return m.group(1) if m else None

    def test_bass_stem(self):
        assert self._extract("3. Althea-bass-E major-83bpm-440hz.wav") == "bass"

    def test_backing_vocals_stem(self):
        assert self._extract("Song Title-backing_vocals-G major-120bpm-440hz.wav") == "backing_vocals"

    def test_vocals_stem(self):
        assert self._extract("My Song-vocals-C major-100bpm-440hz.wav") == "vocals"

    def test_drums_kit_component(self):
        assert self._extract("Track-kick-A minor-95bpm-440hz.wav") == "kick"

    def test_no_match_returns_none(self):
        assert self._extract("not-a-moises-file.wav") is None


# ---------------------------------------------------------------------------
# 3. Writer: windowing + metronome skip + no effects.npy
# ---------------------------------------------------------------------------

def _write_wav(path, sr=16000, duration=5.0):
    """Write a silent WAV of the given duration at the given sample rate."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    samples = np.zeros(int(sr * duration), dtype=np.float32)
    sf.write(path, samples, sr)


class TestIngestMoisesWindowsAndSkips:
    def _make_moises_fixture(self, root):
        """Build:
          <root>/Art/Alb/Song/
            Song-bass-C major-120bpm-440hz.wav   (5s, 16kHz)
            Song-metronome-C major-120bpm-440hz.wav (5s, 16kHz)
        """
        song_dir = os.path.join(str(root), "Art", "Alb", "Song")
        os.makedirs(song_dir, exist_ok=True)
        _write_wav(os.path.join(song_dir, "Song-bass-C major-120bpm-440hz.wav"))
        _write_wav(os.path.join(song_dir, "Song-metronome-C major-120bpm-440hz.wav"))

    def test_bass_stem_produces_clips(self, tmp_path):
        """A 5s bass stem → up to 3 clips (we have 5 1-s windows; max_clips_per_stem=3)."""
        root = tmp_path / "moises"
        out = tmp_path / "out"
        self._make_moises_fixture(root)

        count = ingest_moises(str(root), str(out), max_clips_per_stem=3)

        # metronome yields 0; bass yields ≥1 and ≤3
        assert 1 <= count <= 3

    def test_bass_clip_instrument_json(self, tmp_path):
        """Each bass clip's .instrument.json must be ["Bass guitar"]."""
        root = tmp_path / "moises"
        out = tmp_path / "out"
        self._make_moises_fixture(root)

        ingest_moises(str(root), str(out), max_clips_per_stem=3)

        json_files = sorted(f for f in os.listdir(str(out)) if f.endswith(".instrument.json"))
        assert json_files, "No instrument.json files written"
        for jf in json_files:
            with open(os.path.join(str(out), jf)) as fh:
                assert json.load(fh) == ["Bass guitar"]

    def test_moises_prefix(self, tmp_path):
        """All output WAV files must have the moises_ prefix."""
        root = tmp_path / "moises"
        out = tmp_path / "out"
        self._make_moises_fixture(root)

        ingest_moises(str(root), str(out), max_clips_per_stem=3)

        wavs = [f for f in os.listdir(str(out)) if f.endswith(".wav")]
        assert wavs, "No wav files written"
        for w in wavs:
            assert w.startswith("moises_"), f"Expected moises_ prefix, got {w!r}"

    def test_metronome_produces_zero_clips(self, tmp_path):
        """Metronome stem must be dropped entirely (0 clips)."""
        root = tmp_path / "moises"
        out = tmp_path / "out"
        # Only put a metronome stem in the fixture
        song_dir = os.path.join(str(root), "Art", "Alb", "Song")
        os.makedirs(song_dir, exist_ok=True)
        _write_wav(os.path.join(song_dir, "Song-metronome-C major-120bpm-440hz.wav"))

        count = ingest_moises(str(root), str(out), max_clips_per_stem=3)
        assert count == 0

    def test_no_effects_npy(self, tmp_path):
        """Moises clips are source=real_instrument; no effects.npy must be written."""
        root = tmp_path / "moises"
        out = tmp_path / "out"
        self._make_moises_fixture(root)

        ingest_moises(str(root), str(out), max_clips_per_stem=3)

        npy_files = [f for f in os.listdir(str(out)) if f.endswith(".npy")]
        assert npy_files == [], f"Unexpected .npy files: {npy_files}"
