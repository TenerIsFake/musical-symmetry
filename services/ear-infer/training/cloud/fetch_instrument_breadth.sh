#!/usr/bin/env bash
# fetch_instrument_breadth.sh — download OpenMIC-2018, IRMAS, and MedleyDB-sample
# to the masters directory for the ear-infer instrument-breadth ingest.
#
# Usage:
#   bash fetch_instrument_breadth.sh [MASTERS_DIR]
#
# Defaults to /mnt/t/ml/timbria-ear/masters if not specified.
# Download commands are commented out — verify exact file URLs before running.
#
# Dataset sizes:
#   OpenMIC-2018  ~4-5 GB   (Zenodo record 1432913, CC BY 4.0)
#   IRMAS         ~3 GB     (Zenodo record 1290750, CC BY-NC 4.0)
#   MedleyDB sample  <1 GB  (marl/medleydb GitHub releases)

set -euo pipefail

M="${1:-/mnt/t/ml/timbria-ear/masters}"

# ---------------------------------------------------------------------------
# OpenMIC-2018 (Zenodo record 1432913, CC BY 4.0)
# Reference: Humphrey et al., "OpenMIC-2018: An Open Dataset for Multiple
# Instrument Recognition", ISMIR 2018.
# ---------------------------------------------------------------------------
mkdir -p "$M/openmic-2018"
# wget -c https://zenodo.org/records/1432913/files/openmic-2018-v1.0.0.tgz \
#      -P "$M/openmic-2018"
# tar xzf "$M/openmic-2018/openmic-2018-v1.0.0.tgz" \
#     -C "$M/openmic-2018" --strip-components=1
# Expected after extraction:
#   $M/openmic-2018/audio/<key[:3]>/<key>.ogg
#   $M/openmic-2018/openmic-2018-aggregated-labels.csv

# ---------------------------------------------------------------------------
# IRMAS Training Data (Zenodo record 1290750, CC BY-NC 4.0)
# Reference: Bosch et al., "A Comparison of Sound Segregation Techniques for
# Predominant Instrument Recognition in Musical Audio Signals", ISMIR 2012.
# ---------------------------------------------------------------------------
mkdir -p "$M/irmas"
# wget -c https://zenodo.org/records/1290750/files/IRMAS-TrainingData.zip \
#      -P "$M/irmas"
# unzip -q "$M/irmas/IRMAS-TrainingData.zip" -d "$M/irmas"
# Expected after extraction:
#   $M/irmas/IRMAS-TrainingData/<code>/001__[code][tag]1.wav  ...

# ---------------------------------------------------------------------------
# MedleyDB sample (marl/medleydb GitHub, CC BY-NC-SA 4.0)
# Check https://github.com/marl/medleydb for the current sample release URL.
# ---------------------------------------------------------------------------
mkdir -p "$M/medleydb_sample"
# wget -c <VERIFIED_URL_FROM_MARL_MEDLEYDB_RELEASES> \
#      -P "$M/medleydb_sample"
# tar xzf "$M/medleydb_sample/<archive>.tar.gz" \
#     -C "$M/medleydb_sample" --strip-components=1
# Expected after extraction:
#   $M/medleydb_sample/<Track>/<Track>_STEMS/<stem>.wav
#   $M/medleydb_sample/<Track>/<Track>_METADATA.yaml

echo "Instrument breadth datasets ready under: $M"
echo "Sizes: openmic ~4-5GB, irmas ~3GB, medleydb_sample <1GB"
