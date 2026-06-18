# Timbria — Personal / Research Project (Non-Commercial)

**Timbria is a personal, non-commercial research project.** It is not a
monetized product. It is served privately (behind Cloudflare Access) and is not
sold, subscription-gated, or ad-supported.

## Why this matters: ML model data provenance

Timbria's "Identify by Ear" feature uses a machine-learning model (the
`ear-infer` multi-head model: instrument / effects / mood). That model may be
trained on research datasets released under **non-commercial** licenses, e.g.:

| dataset | license |
|---------|---------|
| MedleyDB | CC BY-NC |
| MUSDB18 | CC BY-NC-SA |
| MTG-Jamendo (mood/theme) | mixed, largely non-commercial |
| IDMT-SMT-Guitar | CC BY-NC-ND |
| NSynth | CC BY 4.0 (commercial-OK) |

A model trained on non-commercial data — **and its predictions** — inherit those
non-commercial restrictions, regardless of this repository's permissive (MIT)
*code* license. MIT covers the source code; it does not relicense third-party
training data or model weights derived from it.

## Guardrail before any commercialization

If Timbria is ever monetized, the ear-infer model **must first be retrained on
commercially-licensed data only** (e.g. NSynth CC BY 4.0 for instrument/effects,
plus a commercially-cleared mood source). Do not ship a non-commercially-trained
model in a paid product.

_This NOTICE concerns product positioning and ML-data provenance. The repository
source code remains under the MIT License (see the repo root `LICENSE`)._
