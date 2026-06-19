"""Map each external dataset's native labels onto our fixed vocab, and write the
16 kHz corpus. Label maps are deliberately explicit so the vocab stays auditable."""
import glob, json, logging, os
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
