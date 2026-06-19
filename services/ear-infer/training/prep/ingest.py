"""Map each external dataset's native labels onto our fixed vocab, and write the
16 kHz corpus. Label maps are deliberately explicit so the vocab stays auditable."""
import glob, json, logging, os
import numpy as np
import soundfile as sf

log = logging.getLogger(__name__)

from labels import INSTRUMENTS, EFFECTS, MOOD
from prep.audio import array_to_pcm16k, to_pcm16k
from prep.build_synth import build_synth_corpus

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

def ingest_dry_to_synth(dry_root, variant_out_dir, dataset, seed=0, max_files=None, prefix=""):
    """Walk a dataset's dry audio and feed (array, sr, instrument) to build_synth_corpus.
    `dataset` selects the per-file instrument labeler.
    `max_files` limits to the first N files (sorted for determinism); None = all.
    `prefix` is prepended to each output filename to avoid collisions when multiple
    callers write into the same out_dir."""
    def items():
        wavs = sorted(glob.glob(os.path.join(dry_root, "**", "*.wav"), recursive=True))
        if max_files is not None:
            wavs = wavs[:max_files]
        for wav in wavs:
            x, sr = sf.read(wav, dtype="float32", always_2d=False)
            if dataset == "nsynth":
                fam = os.path.basename(wav).split("_")[0]      # e.g. "guitar_acoustic_001-..."
                inst = nsynth_instrument(fam)
            elif dataset == "medleydb":
                inst = medleydb_instrument(os.path.basename(os.path.dirname(wav)))
            else:
                inst = ["Other"]
            yield x, sr, inst
    return build_synth_corpus(items(), variant_out_dir, seed=seed, prefix=prefix)

IDMT_INSTRUMENT = {
    "idmt_guitar": "Electric guitar",
    "idmt_bass":   "Bass guitar",
    "idmt_drums":  "Acoustic kit",
    "idmt_piano":  "Acoustic piano",
    "idmt_chords": "Electric guitar",
    "idmt_chord_sequences": "Electric guitar",
}


def ingest_idmt_instruments(masters_root, variant_out_dir, seed=0):
    """Walk each IDMT folder under masters_root, apply random synth chains,
    and write clips via build_synth_corpus.  Returns total clips written.
    Each dataset key gets a unique filename prefix to avoid collisions."""
    total = 0
    for folder_key, instrument_label in IDMT_INSTRUMENT.items():
        folder = os.path.join(masters_root, folder_key)
        if not os.path.isdir(folder):
            continue

        def items(folder=folder, instrument_label=instrument_label):
            for wav in sorted(glob.glob(os.path.join(folder, "**", "*.wav"), recursive=True)):
                try:
                    x, sr = sf.read(wav, dtype="float32", always_2d=False)
                except Exception:
                    log.warning("ingest_idmt_instruments: skipped unreadable file %s", wav)
                    continue
                yield x, sr, [instrument_label]

        total += build_synth_corpus(items(), variant_out_dir, seed=seed,
                                    prefix=f"{folder_key}_")
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


def ingest_musdb_to_mix(musdb_root, mix_out_dir, seed=0):
    """Write one 16 kHz PCM clip per MUSDB18 track (mixture.wav), with
    active-instrument sidecar JSON and a zeroed effects.npy placeholder.

    Effects are never used as labels (source='real_instrument' masks them).
    Returns the number of tracks written.
    """
    os.makedirs(mix_out_dir, exist_ok=True)
    n = 0
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
            instruments = musdb_active_instruments(track_dir)
            try:
                x, sr = sf.read(mixture_path, dtype="float32", always_2d=False)
            except Exception:
                log.warning("ingest_musdb_to_mix: skipped unreadable mixture %s", mixture_path)
                continue
            pcm = array_to_pcm16k(x, sr)
            # Decode PCM bytes back to float32 for soundfile write
            samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
            base = os.path.join(mix_out_dir, f"clip_{n:06d}")
            sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
            with open(base + ".instrument.json", "w") as f:
                json.dump(instruments, f)
            np.save(base + ".effects.npy", np.zeros(len(EFFECTS), dtype=np.float32))
            n += 1
    return n


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


def ingest_idmt_audio_effects(extracted_root, out_dir, seed=0, prefix=""):
    """Walk <extracted_root>/<subset>/Samples/<effect>/*.wav. For each wav:

    eff = idmt_effect_label(<effect folder>); if eff is None -> skip (e.g. EQ).
    inst = idmt_effects_instrument(<subset folder>).
    Write <prefix>clip_{i:06d}.wav (16 kHz int16 via prep.audio.to_pcm16k then write PCM_16),
    <prefix>clip_{i:06d}.effects.npy (multi-hot of eff over EFFECTS; all-zero for NoFX),
    <prefix>clip_{i:06d}.instrument.json (inst). Skip unreadable files. Return count written.
    These are source='synth' clips (instrument+effects both supervised).
    `prefix` is prepended to each output filename to avoid collisions when multiple
    callers write into the same out_dir."""
    from synth import multihot  # local import to keep module-level deps minimal

    os.makedirs(out_dir, exist_ok=True)
    n = 0

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
                try:
                    pcm = to_pcm16k(wav_path)
                except Exception:
                    log.warning("ingest_idmt_audio_effects: skipped unreadable file %s", wav_path)
                    continue

                samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
                base = os.path.join(out_dir, f"{prefix}clip_{n:06d}")
                sf.write(base + ".wav", samples, 16000, subtype="PCM_16")
                np.save(base + ".effects.npy", multihot(eff))
                with open(base + ".instrument.json", "w") as f:
                    json.dump(inst, f)
                n += 1

    return n


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
            track_id = os.path.splitext(os.path.basename(path_field))[0]
            raw_tags = parts[5:]  # columns 6 onward (0-indexed: 5+)
            mood_tags = [t for t in raw_tags if t.startswith("mood/theme---")]
            result[track_id] = mood_tags
    return result


def ingest_jamendo_to_mood(jamendo_root, mood_out_dir, tags_by_id):
    """tags_by_id: {track_id: [raw mood/theme tags]} parsed from the Jamendo TSV."""
    os.makedirs(mood_out_dir, exist_ok=True)
    n = 0
    for wav in sorted(glob.glob(os.path.join(jamendo_root, "**", "*.mp3"), recursive=True)) + \
               sorted(glob.glob(os.path.join(jamendo_root, "**", "*.wav"), recursive=True)):
        tid = os.path.splitext(os.path.basename(wav))[0]
        mood = jamendo_tags_to_mood(tags_by_id.get(tid, []))
        if not mood:
            continue
        pcm = to_pcm16k(wav)
        x = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
        base = os.path.join(mood_out_dir, tid)
        sf.write(base + ".wav", x, 16000, subtype="PCM_16")
        with open(base + ".mood.json", "w") as f:
            json.dump(mood, f)
        n += 1
    return n
