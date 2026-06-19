"""TDD tests for corpus-build driver (prep/build_corpus.py).

Three test cases:
  1. test_parse_jamendo_tsv        -- Part 2: parse_jamendo_moodtheme_tsv
  2. test_ingest_dry_to_synth_max_files -- Part 1: max_files param
  3. test_build_corpus_smoke       -- Part 3: build_corpus.main orchestration
"""
import json
import os
import textwrap

import numpy as np
import pytest
import soundfile as sf


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _write_tiny_wav(path, sr=22050, duration=0.1):
    """Write a short sine-wave wav to *path* (creates parent dirs)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    n = int(sr * duration)
    data = (0.3 * np.sin(2 * np.pi * 440 * np.linspace(0, duration, n))).astype(np.float32)
    sf.write(path, data, sr, subtype="PCM_16")


# ---------------------------------------------------------------------------
# Part 2 — parse_jamendo_moodtheme_tsv
# ---------------------------------------------------------------------------

def test_parse_jamendo_tsv(tmp_path):
    """2-row TSV → correct id→tags dict; header skipped; non-mood tags excluded."""
    from prep.ingest import parse_jamendo_moodtheme_tsv

    tsv = tmp_path / "autotagging_moodtheme.tsv"
    tsv.write_text(textwrap.dedent("""\
        TRACK_ID\tARTIST_ID\tALBUM_ID\tPATH\tDURATION\tTAG1\tTAG2\tTAG3
        1234\t10\t20\t00/1234.mp3\t180\tmood/theme---dark\tinstrument---guitar\tmood/theme---happy
        5678\t11\t21\t01/5678.mp3\t200\tinstrument---piano\tgenre---pop
    """))

    result = parse_jamendo_moodtheme_tsv(str(tsv))

    # Correct IDs
    assert set(result.keys()) == {"1234", "5678"}

    # Track 1234: only mood/theme tags kept
    assert sorted(result["1234"]) == sorted(["mood/theme---dark", "mood/theme---happy"])

    # Track 5678: no mood/theme tags → empty list
    assert result["5678"] == []


def test_jamendo_low_mp3_id_matches(tmp_path):
    """Audio file 1001308.low.mp3 → id '1001308'; TSV path 48/948.mp3 → id '948'.
    Both use first-dot split so they match correctly in tags_by_id lookup."""
    from prep.ingest import parse_jamendo_moodtheme_tsv, ingest_jamendo_to_mood

    # Create TSV with path 48/948.mp3 (single extension)
    tsv = tmp_path / "autotagging_moodtheme.tsv"
    tsv.write_text(textwrap.dedent("""\
        TRACK_ID\tARTIST_ID\tALBUM_ID\tPATH\tDURATION\tTAG1
        948\t10\t20\t48/948.mp3\t180\tmood/theme---dark
        1001308\t11\t21\t51/1001308.low.mp3\t200\tmood/theme---happy
    """))

    # Parse TSV — should get keys '948' and '1001308'
    tags_by_id = parse_jamendo_moodtheme_tsv(str(tsv))
    assert "948" in tags_by_id, "TSV id '948' not found (path 48/948.mp3)"
    assert "1001308" in tags_by_id, "TSV id '1001308' not found (path 51/1001308.low.mp3)"

    # Create actual audio files with matching IDs
    jamendo_root = tmp_path / "jamendo"
    jamendo_root.mkdir()

    # Write WAV files but name them with .low.mp3 suffix to simulate the bug scenario
    # (soundfile can't write mp3, but to_pcm16k reads via libsndfile which handles any audio)
    wav_948 = jamendo_root / "948.low.wav"
    wav_1001308 = jamendo_root / "1001308.low.wav"
    _write_tiny_wav(str(wav_948))
    _write_tiny_wav(str(wav_1001308))

    # Ingest should find both WAV files and write mood clips
    out_dir = tmp_path / "mood_out"
    count = ingest_jamendo_to_mood(str(jamendo_root), str(out_dir), tags_by_id, max_workers=1)

    # Both files match their mood tags → both should be written
    assert count == 2, f"Expected 2 mood clips, got {count}"

    # Verify files exist with correct names (ids extracted from .low.wav → bare numeric id)
    assert os.path.exists(str(out_dir / "948.wav")), "948.wav not written"
    assert os.path.exists(str(out_dir / "1001308.wav")), "1001308.wav not written"


# ---------------------------------------------------------------------------
# Part 1 — ingest_dry_to_synth max_files
# ---------------------------------------------------------------------------

def test_ingest_dry_to_synth_max_files(tmp_path):
    """5 wavs present, max_files=2 → exactly 2 clips written."""
    from prep.ingest import ingest_dry_to_synth

    dry_root = tmp_path / "dry"
    out_dir = tmp_path / "out"

    # Write 5 tiny wav files (named so glob returns them deterministically sorted)
    for i in range(5):
        _write_tiny_wav(str(dry_root / f"note_{i:02d}.wav"))

    count = ingest_dry_to_synth(str(dry_root), str(out_dir), dataset="nsynth",
                                seed=0, max_files=2)

    assert count == 2, f"Expected 2 clips, got {count}"

    # Count actual .wav files in out_dir
    written = [f for f in os.listdir(str(out_dir)) if f.endswith(".wav")]
    assert len(written) == 2


# ---------------------------------------------------------------------------
# Part 3 — build_corpus smoke test
# ---------------------------------------------------------------------------

def test_build_corpus_smoke(tmp_path):
    """Tiny synthetic masters tree → corpus gets ≥1 clip in each subdir; summary returned.

    Collision check: IDMT guitar (2 wavs) + NSynth-valid (2 wavs) + IDMT audio-effects (2 wavs)
    all write into synth/isolated.  Without per-stage prefixes they would collide and overwrite,
    leaving fewer files than the sum of summary counts.  With prefixes every filename is unique.
    """
    from prep import build_corpus

    masters = tmp_path / "masters"
    corpus = tmp_path / "corpus"

    # --- IDMT guitar stub (for ingest_idmt_instruments) — 2 wavs ---
    _write_tiny_wav(str(masters / "idmt_guitar" / "a.wav"))
    _write_tiny_wav(str(masters / "idmt_guitar" / "b.wav"))

    # --- NSynth stub (nsynth-valid/audio) — 2 wavs ---
    nsynth_audio = masters / "nsynth" / "nsynth-valid" / "audio"
    _write_tiny_wav(str(nsynth_audio / "guitar_acoustic_001-060-025.wav"))
    _write_tiny_wav(str(nsynth_audio / "guitar_acoustic_001-060-050.wav"))

    # --- IDMT audio-effects stub — 2 wavs ---
    # Path: <extracted_root>/<subset>/Samples/<effect>/<wav>
    # extracted_root = masters/idmt_audio_effects/IDMT-SMT-AUDIO-EFFECTS/IDMT-SMT-AUDIO-EFFECTS/extracted
    extracted = (masters / "idmt_audio_effects" /
                 "IDMT-SMT-AUDIO-EFFECTS" / "IDMT-SMT-AUDIO-EFFECTS" / "extracted")
    _write_tiny_wav(str(extracted / "Gitarre monophon" / "Samples" / "Chorus" / "c.wav"))
    _write_tiny_wav(str(extracted / "Gitarre monophon" / "Samples" / "Chorus" / "d.wav"))

    # --- MUSDB18-HQ stub ---
    track_dir = masters / "musdb18hq" / "train" / "T"
    for stem in ("vocals", "drums", "bass", "other", "mixture"):
        _write_tiny_wav(str(track_dir / f"{stem}.wav"))

    # --- Jamendo stub ---
    # Audio file: masters/jamendo_mood/00/1.wav  (using wav since mp3 hard in fixture)
    # TSV: tags_by_id must map "1" → mood tag
    jamendo_audio = masters / "jamendo_mood" / "00" / "1.wav"
    _write_tiny_wav(str(jamendo_audio))

    tsv_path = masters / "jamendo_mood" / "autotagging_moodtheme.tsv"
    tsv_path.parent.mkdir(parents=True, exist_ok=True)
    tsv_path.write_text(textwrap.dedent("""\
        TRACK_ID\tARTIST_ID\tALBUM_ID\tPATH\tDURATION\tTAG1
        1\t10\t20\t00/1.mp3\t180\tmood/theme---dark
    """))

    # Run build_corpus with small nsynth_max to avoid processing all (only 2 files anyway)
    summary = build_corpus.main([
        "--masters", str(masters),
        "--corpus", str(corpus),
        "--nsynth-max", "10",
        "--seed", "0",
        "--jamendo-tsv", str(tsv_path),
    ])

    assert isinstance(summary, dict), "main() must return a summary dict"

    # Each output dir must exist and contain ≥1 clip wav
    synth_dir = corpus / "synth" / "isolated"
    inst_dir = corpus / "inst"
    mood_dir = corpus / "mood"

    assert synth_dir.exists(), "corpus/synth/isolated must be created"
    assert inst_dir.exists(), "corpus/inst must be created"
    assert mood_dir.exists(), "corpus/mood must be created"

    synth_wavs = list(synth_dir.glob("*.wav"))
    inst_wavs = list(inst_dir.glob("*.wav"))
    mood_wavs = list(mood_dir.glob("*.wav"))

    assert len(synth_wavs) >= 1, f"synth/isolated: expected ≥1 wav, got {len(synth_wavs)}"
    assert len(inst_wavs) >= 1, f"inst: expected ≥1 wav, got {len(inst_wavs)}"
    assert len(mood_wavs) >= 1, f"mood: expected ≥1 wav, got {len(mood_wavs)}"

    # Summary dict must have numeric counts (not error-raised)
    for key, val in summary.items():
        assert isinstance(val, (int, float)), f"summary[{key!r}] is not numeric: {val!r}"

    # --- Collision / overwrite assertion ---
    # On-disk wav count in synth/isolated must equal the sum of all synth-isolated writers'
    # summary counts.  Without per-stage prefixes, clip_000000 / clip_000001 from each stage
    # would overwrite each other, leaving fewer files than the sum.
    expected_synth_count = (
        summary.get("idmt_instruments", 0) +
        summary.get("nsynth", 0) +
        summary.get("idmt_audio_effects", 0)
    )
    ondisk_count = len(synth_wavs)
    assert ondisk_count == expected_synth_count, (
        f"synth/isolated on-disk count ({ondisk_count}) != summary sum "
        f"({expected_synth_count}); likely a filename collision/overwrite"
    )

    # All filenames must be globally unique (no overwrite)
    wav_names = [w.name for w in synth_wavs]
    assert len(wav_names) == len(set(wav_names)), (
        f"Duplicate filenames detected in synth/isolated: "
        f"{[n for n in wav_names if wav_names.count(n) > 1]}"
    )
