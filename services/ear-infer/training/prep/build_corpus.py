"""CLI driver: orchestrate all ingest paths to populate the 16 kHz corpus.

Usage:
    python -m prep.build_corpus --masters <MASTERS> --corpus <CORPUS> \
        [--nsynth-max N] [--seed S] [--jamendo-tsv <TSV>]

Corpus layout produced:
    <corpus>/synth/isolated/   source=synth   (instruments + effects)
    <corpus>/inst/             source=real_instrument
    <corpus>/mood/             source=real_mood

Each ingest stage is wrapped in try/except so a missing dataset does not abort
the whole build.  A summary dict of {stage: clip_count} is printed and returned.
"""
import argparse
import logging
import os
import sys

from prep.ingest import (
    ingest_idmt_instruments,
    ingest_dry_to_synth,
    ingest_idmt_audio_effects,
    ingest_musdb_to_mix,
    ingest_jamendo_to_mood,
    parse_jamendo_moodtheme_tsv,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def main(argv=None):
    """Orchestrate all ingest stages. Returns summary dict of counts."""
    parser = argparse.ArgumentParser(
        description="Build the 16 kHz ear-infer corpus from masters.")
    parser.add_argument("--masters", required=True,
                        help="Root directory containing raw dataset folders.")
    parser.add_argument("--corpus", required=True,
                        help="Output corpus root (will be created if absent).")
    parser.add_argument("--nsynth-max", type=int, default=40000,
                        help="Max NSynth files per split (default 40000; None=all).")
    parser.add_argument("--seed", type=int, default=0,
                        help="Global RNG seed passed to all ingest calls.")
    parser.add_argument("--jamendo-tsv", default=None,
                        help="Path to autotagging_moodtheme.tsv "
                             "(default: <masters>/jamendo_mood/autotagging_moodtheme.tsv).")
    args = parser.parse_args(argv)

    masters = args.masters
    corpus = args.corpus
    seed = args.seed
    nsynth_max = args.nsynth_max
    jamendo_tsv = args.jamendo_tsv or os.path.join(
        masters, "jamendo_mood", "autotagging_moodtheme.tsv")

    synth_out = os.path.join(corpus, "synth", "isolated")
    inst_out = os.path.join(corpus, "inst")
    mood_out = os.path.join(corpus, "mood")

    os.makedirs(synth_out, exist_ok=True)
    os.makedirs(inst_out, exist_ok=True)
    os.makedirs(mood_out, exist_ok=True)

    summary = {}

    # ------------------------------------------------------------------
    # Stage 1a: IDMT instruments (synth/isolated)
    # ------------------------------------------------------------------
    try:
        n = ingest_idmt_instruments(masters, synth_out, seed=seed)
        log.info("idmt_instruments: %d clips written", n)
        summary["idmt_instruments"] = n
    except Exception as exc:
        log.error("idmt_instruments FAILED: %s", exc)
        summary["idmt_instruments"] = 0

    # ------------------------------------------------------------------
    # Stage 1b: NSynth splits (synth/isolated)
    # ------------------------------------------------------------------
    nsynth_total = 0
    for split in ("train", "valid", "test"):
        audio_dir = os.path.join(masters, "nsynth", f"nsynth-{split}", "audio")
        if not os.path.isdir(audio_dir):
            log.info("nsynth/%s: audio dir not found, skipping", split)
            continue
        try:
            n = ingest_dry_to_synth(audio_dir, synth_out, "nsynth",
                                    seed=seed, max_files=nsynth_max)
            log.info("nsynth/%s: %d clips written", split, n)
            nsynth_total += n
        except Exception as exc:
            log.error("nsynth/%s FAILED: %s", split, exc)
    summary["nsynth"] = nsynth_total

    # ------------------------------------------------------------------
    # Stage 1c: IDMT-SMT-Audio-Effects (synth/isolated)
    # ------------------------------------------------------------------
    idmt_effects_extracted = os.path.join(
        masters, "idmt_audio_effects",
        "IDMT-SMT-AUDIO-EFFECTS", "IDMT-SMT-AUDIO-EFFECTS", "extracted")
    try:
        n = ingest_idmt_audio_effects(idmt_effects_extracted, synth_out, seed=seed)
        log.info("idmt_audio_effects: %d clips written", n)
        summary["idmt_audio_effects"] = n
    except Exception as exc:
        log.error("idmt_audio_effects FAILED: %s", exc)
        summary["idmt_audio_effects"] = 0

    # ------------------------------------------------------------------
    # Stage 2: MUSDB18-HQ (inst)
    # ------------------------------------------------------------------
    try:
        n = ingest_musdb_to_mix(os.path.join(masters, "musdb18hq"), inst_out, seed=seed)
        log.info("musdb18hq: %d clips written", n)
        summary["musdb18hq"] = n
    except Exception as exc:
        log.error("musdb18hq FAILED: %s", exc)
        summary["musdb18hq"] = 0

    # ------------------------------------------------------------------
    # Stage 3: Jamendo mood/theme (mood)
    # ------------------------------------------------------------------
    try:
        tags_by_id = parse_jamendo_moodtheme_tsv(jamendo_tsv)
        n = ingest_jamendo_to_mood(
            os.path.join(masters, "jamendo_mood"), mood_out, tags_by_id)
        log.info("jamendo_mood: %d clips written", n)
        summary["jamendo_mood"] = n
    except Exception as exc:
        log.error("jamendo_mood FAILED: %s", exc)
        summary["jamendo_mood"] = 0

    print("Summary:", summary)
    return summary


if __name__ == "__main__":
    main()
