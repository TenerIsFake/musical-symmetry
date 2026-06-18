"""Map each external dataset's native labels onto our fixed vocab, and write the
16 kHz corpus. Label maps are deliberately explicit so the vocab stays auditable."""
import glob, json, os
import numpy as np
import soundfile as sf

from labels import INSTRUMENTS, MOOD
from prep.audio import to_pcm16k
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

def ingest_dry_to_synth(dry_root, variant_out_dir, dataset, seed=0):
    """Walk a dataset's dry audio and feed (array, sr, instrument) to build_synth_corpus.
    `dataset` selects the per-file instrument labeler."""
    def items():
        for wav in sorted(glob.glob(os.path.join(dry_root, "**", "*.wav"), recursive=True)):
            x, sr = sf.read(wav, dtype="float32", always_2d=False)
            if dataset == "nsynth":
                fam = os.path.basename(wav).split("_")[0]      # e.g. "guitar_acoustic_001-..."
                inst = nsynth_instrument(fam)
            elif dataset == "medleydb":
                inst = medleydb_instrument(os.path.basename(os.path.dirname(wav)))
            else:
                inst = ["Other"]
            yield x, sr, inst
    return build_synth_corpus(items(), variant_out_dir, seed=seed)

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
