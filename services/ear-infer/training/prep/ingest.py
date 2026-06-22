"""Map each external dataset's native labels onto our fixed vocab, and write the
16 kHz corpus. Label maps are deliberately explicit so the vocab stays auditable."""
import csv
import glob
import json
import logging
import os
import re

import numpy as np
import soundfile as sf

log = logging.getLogger(__name__)

from labels import INSTRUMENTS, EFFECTS, MOOD
from prep.audio import array_to_pcm16k, to_pcm16k
from prep.build_synth import build_synth_corpus, build_synth_clip_from_path
from prep.parallel import parallel_count

_NSYNTH = {
    "guitar": "Electric guitar", "bass": "Bass guitar", "keyboard": "Electric piano",
    "organ": "Organ", "synth_lead": "Synth lead", "vocal": "Vocals",
    "string": "Strings", "brass": "Brass", "reed": "Saxophone", "flute": "Woodwinds",
    "mallet": "Percussion",
}
_MUSDB = {"vocals": "Vocals", "drums": "Acoustic kit", "bass": "Bass guitar", "other": "Other"}
_MEDLEYDB = {
    "electric guitar": "Electric guitar", "clean electric guitar": "Electric guitar",
    "distorted electric guitar": "Electric guitar", "acoustic guitar": "Acoustic guitar",
    "electric bass": "Bass guitar", "double bass": "Upright bass", "piano": "Acoustic piano",
    "electric piano": "Electric piano", "synthesizer": "Synth lead", "drum set": "Acoustic kit",
    "male singer": "Vocals", "female singer": "Vocals", "vocalists": "Vocals",
    "violin": "Strings", "cello": "Strings", "trumpet": "Brass", "tenor saxophone": "Saxophone",
    "flute": "Woodwinds", "mandolin": "Banjo/mandolin", "banjo": "Banjo/mandolin",
}
# MTG-Jamendo mood/theme tag (after the "mood/theme---" prefix) -> our MOOD vocab
_JAMENDO_MOOD = {
    "dark": "gritty", "happy": "bright", "sad": "warm", "relaxing": "dreamy",
    "energetic": "aggressive", "calm": "clean", "soft": "warm", "epic": "spacious",
    "melancholic": "warm", "uplifting": "bright", "aggressive": "aggressive",
    "dream": "dreamy", "ambient": "spacious", "retro": "lo-fi",
}

# ---------------------------------------------------------------------------
# OpenMIC-2018 label map (20 classes -> our 19-class vocab)
# ---------------------------------------------------------------------------
_OPENMIC = {
    "accordion": "Other", "banjo": "Banjo/mandolin", "bass": "Bass guitar",
    "cello": "Strings", "clarinet": "Woodwinds", "cymbals": "Acoustic kit",
    "drums": "Acoustic kit", "flute": "Woodwinds", "guitar": "Electric guitar",
    "mallet_percussion": "Percussion", "mandolin": "Banjo/mandolin", "organ": "Organ",
    "piano": "Acoustic piano", "saxophone": "Saxophone", "synthesizer": "Synth lead",
    "trombone": "Brass", "trumpet": "Brass", "ukulele": "Acoustic guitar",
    "violin": "Strings", "voice": "Vocals",
}

# IRMAS 3-letter codes -> our vocab
_IRMAS = {
    "cel": "Strings", "cla": "Woodwinds", "flu": "Woodwinds",
    "gac": "Acoustic guitar", "gel": "Electric guitar", "org": "Organ",
    "pia": "Acoustic piano", "sax": "Saxophone", "tru": "Brass",
    "vio": "Strings", "voi": "Vocals",
}


def openmic_instruments(names):
    """list of OpenMIC instrument names -> deduped in-vocab list (drop unknown)."""
    out = []
    for n in names:
        m = _OPENMIC.get(n)
        if m and m not in out:
            out.append(m)
    return [x for x in out if x in INSTRUMENTS]


def irmas_instrument(code):
    """3-letter IRMAS code -> [vocab label] or [] if unknown."""
    m = _IRMAS.get(code.strip().lower())
    return [m] if m and m in INSTRUMENTS else []


def parse_openmic_labels(csv_path, relevance_thresh=0.5):
    """Parse OpenMIC-2018 aggregated labels CSV.

    Columns: sample_key, instrument, relevance, num_responses (header present).
    Returns {sample_key: [raw openmic instrument names]} for rows with
    float(relevance) >= relevance_thresh. Header row is skipped.
    """
    result = {}
    with open(csv_path, encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh)
        for row in reader:
            if not row or row[0] == "sample_key":
                continue
            if len(row) < 3:
                continue
            sample_key, instrument, relevance = row[0], row[1], row[2]
            try:
                if float(relevance) >= relevance_thresh:
                    result.setdefault(sample_key, []).append(instrument)
            except ValueError:
                continue
    return result


def _valid(lbls, vocab):
    return [l for l in lbls if l in vocab]

def nsynth_instrument(family):
    return [_NSYNTH.get(family, "Other")]

def musdb_stems_to_instruments(active):
    return _valid([_MUSDB[s] for s in active if s in _MUSDB], INSTRUMENTS)

def jamendo_tags_to_mood(tags):
    out = []
    for t in tags:
        key = t.split("---")[-1].strip().lower()
        if key in _JAMENDO_MOOD:
            out.append(_JAMENDO_MOOD[key])
    # dedupe, keep order
    seen, uniq = set(), []
    for m in out:
        if m not in seen:
            seen.add(m); uniq.append(m)
    return _valid(uniq, MOOD)

def medleydb_instrument(name):
    return [_MEDLEYDB.get(name.strip().lower(), "Other")]

# ---- corpus writers (file IO; run on the Lambda box in Phase 2) ----

def ingest_dry_to_synth(dry_root, variant_out_dir, dataset, seed=0, max_files=None,
                         prefix="", max_workers=16):
    """Walk a dataset's dry audio and write synthesised clips.

    `dataset` selects the per-file instrument labeler.
    `max_files` limits to the first N files (sorted for determinism); None = all.
    `prefix` is prepended to each output filename to avoid collisions when multiple
    callers write into the same out_dir.
    `max_workers` controls the thread-pool size (<=1 = serial).
    """
    os.makedirs(variant_out_dir, exist_ok=True)

    wavs = sorted(glob.glob(os.path.join(dry_root, "**", "*.wav"), recursive=True))
    if max_files is not None:
        wavs = wavs[:max_files]

    # Pre-compute instrument labels (pure string ops, no I/O; safe on main thread)
    work_items = []
    for idx, wav in enumerate(wavs):
        if dataset == "nsynth":
            fam = os.path.basename(wav).split("_")[0]
            inst = nsynth_instrument(fam)
        elif dataset == "medleydb":
            inst = medleydb_instrument(os.path.basename(os.path.dirname(wav)))
        else:
            inst = ["Other"]
        work_items.append((wav, inst, idx))

    def worker(item):
        wav_path, instrument, idx = item
        return build_synth_clip_from_path(wav_path, instrument, variant_out_dir,
                                          idx, seed, prefix=prefix)

    return parallel_count(work_items, worker, max_workers=max_workers)

IDMT_INSTRUMENT = {
    "idmt_guitar": "Electric guitar",
    "idmt_bass":   "Bass guitar",
    "idmt_drums":  "Acoustic kit",
    "idmt_piano":  "Acoustic piano",
    "idmt_chords": "Electric guitar",
    "idmt_chord_sequences": "Electric guitar",
}


def ingest_idmt_instruments(masters_root, variant_out_dir, seed=0, max_workers=16):
    """Walk each IDMT folder under masters_root, apply random synth chains,
    and write clips.  Returns total clips written.
    Each dataset key gets a unique filename prefix to avoid collisions.
    `max_workers` controls the thread-pool size (<=1 = serial).
    """
    os.makedirs(variant_out_dir, exist_ok=True)
    total = 0
    for folder_key, instrument_label in IDMT_INSTRUMENT.items():
        folder = os.path.join(masters_root, folder_key)
        if not os.path.isdir(folder):
            continue

        wavs = sorted(glob.glob(os.path.join(folder, "**", "*.wav"), recursive=True))

        # Pre-assign stable indices from the sorted list; prefix disambiguates per-key
        work_items = [(wav, idx) for idx, wav in enumerate(wavs)]
        prefix = f"{folder_key}_"

        def worker(item, instrument_label=instrument_label, out_dir=variant_out_dir,
                   prefix=prefix, seed=seed):
            wav_path, idx = item
            return build_synth_clip_from_path(wav_path, [instrument_label], out_dir,
                                              idx, seed, prefix=prefix)

        total += parallel_count(work_items, worker, max_workers=max_workers)
    return total


def musdb_active_instruments(track_dir, rms_thresh=0.01):
    """Return in-vocab instrument labels for stems whose RMS exceeds rms_thresh.

    Reads vocals, drums, bass, other stems from track_dir, mono-mixes each,
    and includes the corresponding INSTRUMENTS label when RMS > rms_thresh.
    """
    stems = ("vocals", "drums", "bass", "other")
    active = []
    for stem in stems:
        path = os.path.join(track_dir, f"{stem}.wav")
        if not os.path.exists(path):
            continue
        try:
            x, _ = sf.read(path, dtype="float32", always_2d=False)
        except Exception:
            log.warning("musdb_active_instruments: skipped unreadable stem %s", path)
            continue
        if x.ndim > 1:
            x = x.mean(axis=1)
        rms = float(np.sqrt(np.mean(x ** 2)))
        if rms > rms_thresh:
            active.append(stem)
    return musdb_stems_to_instruments(active)


def ingest_musdb_to_mix(musdb_root, mix_out_dir, seed=0, max_workers=16):
    """Write one 16 kHz PCM clip per MUSDB18 track (mixture.wav), with
    active-instrument sidecar JSON and a zeroed effects.npy placeholder.

    Effects are never used as labels (source='real_instrument' masks them).
    Returns the number of tracks written.
    `max_workers` controls the thread-pool size (<=1 = serial).
    """
    os.makedirs(mix_out_dir, exist_ok=True)

    # Collect valid track dirs with pre-assigned stable indices (sorted for determinism)
    work_items = []
    idx = 0
    for split in ("train", "test"):
        split_dir = os.path.join(musdb_root, split)
        if not os.path.isdir(split_dir):
            continue
        for track_name in sorted(os.listdir(split_dir)):
            track_dir = os.path.join(split_dir, track_name)
            if not os.path.isdir(track_dir):
                continue
            mixture_path = os.path.join(track_dir, "mixture.wav")
            if not os.path.exists(mixture_path):
                continue
            work_items.append((track_dir, mixture_path, idx))
            idx += 1

    def worker(item):
        track_dir, mixture_path, item_idx = item
        # musdb_active_instruments does I/O (reads stems) — done inside worker
        instruments = musdb_active_instruments(track_dir)
        try:
            x, sr = sf.read(mixture_path, dtype="float32", always_2d=False)
        except Exception:
            log.warning("ingest_musdb_to_mix: skipped unreadable mixture %s", mixture_path)
            return False
        pcm = array_to_pcm16k(x, sr)
        # Decode PCM bytes back to float32 for soundfile write
        samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(mix_out_dir, f"clip_{item_idx:06d}")
        sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
        with open(base + ".instrument.json", "w") as f:
            json.dump(instruments, f)
        np.save(base + ".effects.npy", np.zeros(len(EFFECTS), dtype=np.float32))
        return True

    return parallel_count(work_items, worker, max_workers=max_workers)


# ---------------------------------------------------------------------------
# INGEST-B: IDMT-SMT-Audio-Effects (real single-effect-labeled guitar/bass)
# ---------------------------------------------------------------------------

# IDMT effect-folder name -> our EFFECTS vocab label.
# NoFX = clean (no entry here; handled explicitly in idmt_effect_label).
# EQ has no vocab equivalent -> clips dropped (not in this map).
_IDMT_EFFECT = {
    "Chorus": "Chorus", "Distortion": "Distortion", "Flanger": "Flanger",
    "Phaser": "Phaser", "Tremolo": "Tremolo", "Vibrato": "Vibrato",
    "Overdrive": "Overdrive", "Reverb": "Reverb",
    "FeedbackDelay": "Delay/echo", "SlapbackDelay": "Slapback",
}


def idmt_effect_label(folder):
    """Folder name -> effect label list, or None to SKIP the clip.

    NoFX -> [] (clean, valid). Mapped -> [vocab name]. EQ/unknown -> None (skip).
    """
    if folder == "NoFX":
        return []
    if folder in _IDMT_EFFECT:
        return [_IDMT_EFFECT[folder]]
    return None


def idmt_effects_instrument(top_folder):
    """Top subset folder -> instrument label list ('Gitarre*'->guitar, 'Bass*'->bass)."""
    t = top_folder.lower()
    if t.startswith("gitarre"):
        return ["Electric guitar"]
    if t.startswith("bass"):
        return ["Bass guitar"]
    return ["Other"]


def ingest_idmt_audio_effects(extracted_root, out_dir, seed=0, prefix="", max_workers=16):
    """Walk <extracted_root>/<subset>/Samples/<effect>/*.wav. For each wav:

    eff = idmt_effect_label(<effect folder>); if eff is None -> skip (e.g. EQ).
    inst = idmt_effects_instrument(<subset folder>).
    Write <prefix>clip_{i:06d}.wav (16 kHz int16 via prep.audio.to_pcm16k then write PCM_16),
    <prefix>clip_{i:06d}.effects.npy (multi-hot of eff over EFFECTS; all-zero for NoFX),
    <prefix>clip_{i:06d}.instrument.json (inst). Skip unreadable files. Return count written.
    These are source='synth' clips (instrument+effects both supervised).
    `prefix` is prepended to each output filename to avoid collisions when multiple
    callers write into the same out_dir.
    `max_workers` controls the thread-pool size (<=1 = serial).
    """
    from synth import multihot  # local import to keep module-level deps minimal

    os.makedirs(out_dir, exist_ok=True)

    # Collect all valid (non-EQ, non-unknown) work items with pre-assigned stable indices.
    # EQ/unknown skipping happens here (cheap, no I/O), so indices are deterministic.
    work_items = []   # list of (wav_path, eff_list, inst_list, idx)
    idx = 0

    for subset in sorted(os.listdir(extracted_root)):
        subset_path = os.path.join(extracted_root, subset)
        samples_path = os.path.join(subset_path, "Samples")
        if not os.path.isdir(samples_path):
            continue

        inst = idmt_effects_instrument(subset)

        for effect_folder in sorted(os.listdir(samples_path)):
            eff = idmt_effect_label(effect_folder)
            if eff is None:
                continue  # skip EQ and unknown folders

            effect_path = os.path.join(samples_path, effect_folder)
            if not os.path.isdir(effect_path):
                continue

            for wav_name in sorted(os.listdir(effect_path)):
                if not wav_name.lower().endswith(".wav"):
                    continue
                wav_path = os.path.join(effect_path, wav_name)
                work_items.append((wav_path, eff, inst, idx))
                idx += 1

    def worker(item):
        wav_path, eff, inst, item_idx = item
        try:
            pcm = to_pcm16k(wav_path)
        except Exception:
            log.warning("ingest_idmt_audio_effects: skipped unreadable file %s", wav_path)
            return False
        samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(out_dir, f"{prefix}clip_{item_idx:06d}")
        sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
        np.save(base + ".effects.npy", multihot(eff))
        with open(base + ".instrument.json", "w") as f:
            json.dump(inst, f)
        return True

    return parallel_count(work_items, worker, max_workers=max_workers)


def parse_jamendo_moodtheme_tsv(tsv_path):
    """Parse MTG-Jamendo autotagging_moodtheme.tsv.

    Columns (tab-separated): TRACK_ID ARTIST_ID ALBUM_ID PATH DURATION TAG1 TAG2 ...
    Returns {track_id: [raw mood/theme tags]} where track_id is the basename of PATH
    without extension (e.g. PATH "00/1234.mp3" → "1234").
    Keeps only tags starting with "mood/theme---". Skips the header row.
    """
    result = {}
    with open(tsv_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\r\n")
            if not line:
                continue
            parts = line.split("\t")
            # Skip header (first column == "TRACK_ID")
            if parts[0] == "TRACK_ID":
                continue
            if len(parts) < 5:
                continue
            path_field = parts[3]
            track_id = os.path.basename(path_field).split(".")[0]
            raw_tags = parts[5:]  # columns 6 onward (0-indexed: 5+)
            mood_tags = [t for t in raw_tags if t.startswith("mood/theme---")]
            result[track_id] = mood_tags
    return result


def ingest_jamendo_to_mood(jamendo_root, mood_out_dir, tags_by_id, max_workers=16):
    """tags_by_id: {track_id: [raw mood/theme tags]} parsed from the Jamendo TSV.
    `max_workers` controls the thread-pool size (<=1 = serial).
    Tracks with no mapped mood are filtered out BEFORE dispatching (cheap tag lookup,
    no file reads), so they never enter the pool.
    """
    os.makedirs(mood_out_dir, exist_ok=True)

    all_audio = (
        sorted(glob.glob(os.path.join(jamendo_root, "**", "*.mp3"), recursive=True)) +
        sorted(glob.glob(os.path.join(jamendo_root, "**", "*.wav"), recursive=True))
    )

    # Filter to mood-tagged tracks BEFORE dispatching (pure dict/string ops, no I/O)
    work_items = []
    for audio_path in all_audio:
        tid = os.path.basename(audio_path).split(".")[0]
        mood = jamendo_tags_to_mood(tags_by_id.get(tid, []))
        if not mood:
            continue
        work_items.append((audio_path, tid, mood))

    def worker(item):
        audio_path, tid, mood = item
        try:
            pcm = to_pcm16k(audio_path)
        except Exception:
            log.warning("ingest_jamendo_to_mood: skipped unreadable file %s", audio_path)
            return False
        x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(mood_out_dir, tid)
        sf.write(base + ".wav", x, 16000, subtype="PCM_16")
        with open(base + ".mood.json", "w") as f:
            json.dump(mood, f)
        return True

    return parallel_count(work_items, worker, max_workers=max_workers)


# ---------------------------------------------------------------------------
# INGEST-BREADTH A: OpenMIC-2018 (real recordings -> inst/, real_instrument)
# ---------------------------------------------------------------------------

def ingest_openmic(openmic_root, out_dir, labels_by_key, prefix="openmic_"):
    """Write one 16 kHz PCM clip per OpenMIC-2018 key that has >=1 in-vocab instrument.

    Audio lives at <openmic_root>/audio/<key[:3]>/<key>.ogg.
    labels_by_key: {sample_key: [raw openmic instrument names]} from parse_openmic_labels.
    Writes <prefix>clip_{i:06d}.wav + .instrument.json to out_dir.
    Skips keys with empty mapped instruments; skips unreadable files with log.warning.
    No effects.npy written (source=real_instrument).
    Returns count of clips written.
    """
    os.makedirs(out_dir, exist_ok=True)
    count = 0
    for key in sorted(labels_by_key):
        inst = openmic_instruments(labels_by_key[key])
        if not inst:
            continue
        audio_path = os.path.join(openmic_root, "audio", key[:3], f"{key}.ogg")
        try:
            pcm = to_pcm16k(audio_path)
        except Exception:
            log.warning("ingest_openmic: skipped unreadable file %s", audio_path)
            continue
        samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(out_dir, f"{prefix}clip_{count:06d}")
        sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
        with open(base + ".instrument.json", "w") as f:
            json.dump(inst, f)
        count += 1
    return count


# ---------------------------------------------------------------------------
# INGEST-BREADTH B: IRMAS TrainingData (real recordings -> inst/, real_instrument)
# ---------------------------------------------------------------------------

def ingest_irmas(irmas_root, out_dir, prefix="irmas_"):
    """Write one 16 kHz PCM clip per IRMAS wav that has a known bracket code.

    Walks <irmas_root>/**/*.wav; parses the [xxx] bracket token in each filename
    to get the instrument code via irmas_instrument().
    Writes <prefix>clip_{i:06d}.wav + .instrument.json to out_dir.
    Skips files with unknown/missing bracket code or unreadable audio.
    No effects.npy written (source=real_instrument).
    Returns count of clips written.
    """
    os.makedirs(out_dir, exist_ok=True)
    wavs = sorted(glob.glob(os.path.join(irmas_root, "**", "*.wav"), recursive=True))
    count = 0
    for wav_path in wavs:
        basename = os.path.basename(wav_path)
        m = re.search(r"\[([a-z]{3})\]", basename)
        if not m:
            continue
        inst = irmas_instrument(m.group(1))
        if not inst:
            continue
        try:
            pcm = to_pcm16k(wav_path)
        except Exception:
            log.warning("ingest_irmas: skipped unreadable file %s", wav_path)
            continue
        samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(out_dir, f"{prefix}clip_{count:06d}")
        sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
        with open(base + ".instrument.json", "w") as f:
            json.dump(inst, f)
        count += 1
    return count


# ---------------------------------------------------------------------------
# INGEST-BREADTH C: MedleyDB sample (real recordings -> inst/, real_instrument)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# INGEST-BREADTH D: Moises separated stems (real_instrument, windowed)
# ---------------------------------------------------------------------------

_MOISES = {
    "vocals": "Vocals", "backing_vocals": "Vocals", "bass": "Bass guitar",
    "lead": "Electric guitar", "rhythm": "Electric guitar", "piano": "Acoustic piano",
    "keys": "Electric piano", "strings": "Strings", "wind": "Woodwinds",
    "kick": "Acoustic kit", "snare": "Acoustic kit", "hat": "Acoustic kit",
    "toms": "Acoustic kit", "cymbals": "Acoustic kit", "other_kit": "Acoustic kit",
}
# DROP (return []): "other" (residual), "metronome" (click track), unknown stems.


def moises_instrument(stem):
    """Moises stem token -> [vocab label] or [] if other/metronome/unknown."""
    m = _MOISES.get(stem.strip().lower())
    return [m] if m and m in INSTRUMENTS else []


def ingest_moises(moises_root, out_dir, max_clips_per_stem=20, prefix="moises_"):
    """Walk <moises_root>/**/*.wav. Parse stem from filename; inst=moises_instrument(stem);
    skip if empty (other/metronome/unknown). Read via to_pcm16k (resamples 96k->16k),
    window into 1s clips (prep.audio.window_clips), take up to max_clips_per_stem windows
    EVENLY SPACED across the stem (not just the first N — a 7min stem's start may be silent;
    sample across it). For each chosen window write <prefix>clip_{i:06d}.wav (16k PCM_16) +
    .instrument.json (inst list). source=real_instrument (no effects.npy). Skip unreadable
    (log.warning). Return clip count. Uses a global running idx across all stems (prefix makes
    it collision-free vs musdb's bare clip_ + openmic_/irmas_/medleydbsample_).
    """
    from prep.audio import window_clips  # local import mirrors pattern above

    os.makedirs(out_dir, exist_ok=True)
    wavs = sorted(glob.glob(os.path.join(moises_root, "**", "*.wav"), recursive=True))

    idx = 0  # global running index across all stems
    for wav_path in wavs:
        basename = os.path.basename(wav_path)
        m = re.search(r"-([a-z_]+)-[A-G][^/]*\.wav$", basename)
        if not m:
            continue
        stem = m.group(1)
        inst = moises_instrument(stem)
        if not inst:
            continue  # other / metronome / unknown -> drop

        try:
            pcm = to_pcm16k(wav_path)
        except Exception:
            log.warning("ingest_moises: skipped unreadable file %s", wav_path)
            continue

        windows = window_clips(pcm)
        if not windows:
            continue

        # Even-spacing: sample across the stem rather than just the head
        step = max(1, len(windows) // max_clips_per_stem)
        chosen = windows[::step][:max_clips_per_stem]

        for clip in chosen:
            samples = np.frombuffer(clip, dtype="<i2").astype(np.float32) / 32768.0
            base = os.path.join(out_dir, f"{prefix}clip_{idx:06d}")
            sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
            with open(base + ".instrument.json", "w") as fh:
                json.dump(inst, fh)
            idx += 1

    return idx


def ingest_medleydb_sample(sample_root, out_dir, prefix="medleydbsample_"):
    """Write one 16 kHz PCM clip per stem in a MedleyDB sample directory.

    Directory layout:
        <sample_root>/<Track>/<Track>_STEMS/<stem>.wav
        <sample_root>/<Track>/<Track>_METADATA.yaml  (PyYAML)

    The METADATA.yaml has a 'stems' dict mapping stem-id -> {'filename': ..., 'instrument': ...}.
    Uses medleydb_instrument(instrument_name) to map to vocab.
    Writes <prefix>clip_{i:06d}.wav + .instrument.json to out_dir.
    Skips stems with missing yaml, missing instrument field, or unreadable audio.
    No effects.npy written (source=real_instrument).
    Returns count of clips written.
    """
    import yaml  # PyYAML; installed in venv (pip install pyyaml)

    os.makedirs(out_dir, exist_ok=True)
    count = 0

    for track_name in sorted(os.listdir(sample_root)):
        track_dir = os.path.join(sample_root, track_name)
        if not os.path.isdir(track_dir):
            continue
        meta_path = os.path.join(track_dir, f"{track_name}_METADATA.yaml")
        if not os.path.isfile(meta_path):
            log.warning("ingest_medleydb_sample: no metadata yaml for track %s", track_name)
            continue
        try:
            with open(meta_path, encoding="utf-8") as fh:
                meta = yaml.safe_load(fh)
        except Exception as exc:
            log.warning("ingest_medleydb_sample: failed to parse yaml %s: %s", meta_path, exc)
            continue

        stems_info = meta.get("stems") or {}
        stems_dir = os.path.join(track_dir, f"{track_name}_STEMS")

        for stem_id in sorted(stems_info):
            stem_data = stems_info[stem_id]
            stem_filename = stem_data.get("filename")
            instrument_name = stem_data.get("instrument")
            if not stem_filename or not instrument_name:
                log.warning(
                    "ingest_medleydb_sample: missing filename/instrument for stem %s in %s",
                    stem_id, track_name)
                continue
            wav_path = os.path.join(stems_dir, stem_filename)
            inst = medleydb_instrument(instrument_name)
            if not inst:
                continue
            try:
                pcm = to_pcm16k(wav_path)
            except Exception:
                log.warning("ingest_medleydb_sample: skipped unreadable stem %s", wav_path)
                continue
            samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
            base = os.path.join(out_dir, f"{prefix}clip_{count:06d}")
            sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
            with open(base + ".instrument.json", "w") as f:
                json.dump(inst, f)
            count += 1
    return count
