# Tone — Sound, FX & Gear Knowledge Base (Feature B)

**Date:** 2026-06-15
**Status:** Design approved, pending spec review
**Sibling app to Chrometria** (working name: "Tone")

## Context

Chrometria analyzes the *harmonic* dimension of music — pitch-class sets under
the dihedral group D₁₂ (which notes, and their symmetry). This project addresses
the orthogonal **timbre/production** dimension: what effects, processing, and
equipment give a song its *sound*. None of Chrometria's `core` symmetry engine
applies here, so this is a **sibling app**, not a Chrometria section.

The full vision has three subsystems, to be built in order, each with its own
spec:

- **B — Knowledge base + identifier** (this spec): the data backbone + the
  human-facing reference, artist-gear registry, and guided identifier.
- **C — Recreation** (future spec): "I want this vibe" → chain + dial-in
  settings. A thin intent-layer over B's data.
- **A — Audio inference** (future spec): audio in → extracted signal hints
  (reverb decay, stereo width, spectral tilt, distortion harmonics) mapped onto
  B's vocabulary. The hard, partial-by-nature moonshot; rides on B.

**This spec covers B only**, **web-first**. Native (Android/iOS/desktop)
versions are explicitly deferred to a future spec, mirroring Chrometria's app
split.

## Architecture

New packages in the existing `musical-symmetry` monorepo, deployed as a
standalone sibling app:

- **`packages/tone-ui`** — separate React frontend on its own subdomain
  (`tone.tendrid.us`). Imports the existing design system, `UserContext`, and
  RevenueCat tier-gating from the monorepo so it inherits login/tiers/look
  without rebuilding them. Does **not** import `core` (irrelevant to timbre).
- **`packages/tone-api`** — new Express/TS service mirroring the `analyzer`
  package's shape (Express + SQLite, node:20-alpine container). Serves the data
  API, runs the server-side gear lookup, and manages the review queue.
- **Storage:** SQLite (`tone.db`) — matches the homelab pattern; data is
  curated-plus-growing, well within SQLite's range.
- **Deployment:** own container + Cloudflare tunnel hostname `tone.tendrid.us`
  behind Cloudflare Access (like the other services). The `#review` admin view
  is further gated to the owner.

Rejected alternative: a standalone repo in Python/Flask. Cleaner isolation but
forces re-plumbing auth, tiers, and the design system — wasted work given the
explicit "share login/tiers/look" requirement.

## Data model (SQLite, in `tone-api`)

Six tables. Tables 1–3 are the vocabulary; 4–5 are the artist-gear registry;
6 drives the identifier.

1. **`fx_type`** — categories of sound-shaping (Plate Reverb, FET Compressor
   (1176-style), Tape Saturation, Analog Poly Synth, …). Columns: `id`, `name`,
   `category` (reverb/dynamics/distortion/modulation/delay/eq/pitch/source-
   instrument/source-synth/mic/amp/utility), `fingerprint` (plain-English: what
   it does to the sound), `tells` (audible identification cues), `era`,
   `typical_use`.
2. **`gear_item`** — specific units (UA 1176LN, EMT 140 Plate, Shure SM7B,
   Roland Juno-106). Columns: `id`, `name`, `fx_type_id` (FK), `manufacturer`,
   `kind` (hardware/plugin/instrument/synth/mic/amp).
3. **`sound`** — iconic sonic signatures ("80s gated-reverb snare", "dreampop
   wall-of-guitar"). Columns: `id`, `name`, `description`, `chain` (ordered list
   of fx_type/gear references), `artist_id` (optional FK). In B this powers
   identification reference; C extends each with dial-in settings.
4. **`artist`** — players/producers/engineers/bands. Columns: `id`, `name`,
   `role`, `era`, `genre`, `notes`.
5. **`artist_gear`** ⭐ — the registry. Columns: `id`, `artist_id` (FK),
   `gear_item_id` (FK), `context` ("lead vocal chain", "main synth"),
   `source_url` (citation), `confidence` (low/med/high), `status`
   (draft/approved), `added_by` (curated/llm-lookup), `reviewed_at`. **This is
   where sourcing model (iii) lives.**
6. **`id_node`** — identifier decision-tree. Columns: `id`, `question`,
   `branches` (answer → next node id), `leaf_fx_type_ids` (FKs for leaf nodes),
   `explanation`.

This single model serves all three B modes: catalog browse (1–3), artist lookup
(4–5), guided identify (6). The `draft/approved/confidence/source_url` fields
make every claim traceable rather than rumor.

**Storage note:** the ordered-list columns (`sound.chain`, `id_node.branches`,
`id_node.leaf_fx_type_ids`) are stored as **JSON-encoded text** in their row, not
as separate join tables — simpler for SQLite and these are read whole, never
queried by element. Cross-entity relations (`gear_item.fx_type_id`,
`artist_gear.*`) remain proper FK columns.

## User modes (`tone-ui`)

Three hash-routed sections, like Chrometria:

1. **Catalog (`#catalog`)** — browse/search the FX & gear library. Each entry:
   fingerprint, audible tells, era, notable units, and which `sound`s use it.
   The reference/teaching surface.
2. **Artist profiles (`#artists`)** ⭐ — search an artist → documented rig from
   `artist_gear`, grouped by context, **each line showing source citation +
   confidence badge**. If unknown, a **"Look it up"** button starts the lookup
   flow. Approved entries read as authoritative; draft/low-confidence rows are
   visibly badged "unverified."
3. **Identify (`#identify`)** — guided `id_node` decision-tree ("short metallic
   space or long washy?", "steady tone or pulsing in time?") narrowing to likely
   `fx_type`(s) with explanation + links into Catalog. Knowledge tool only — no
   audio upload (that's feature A).

**Tier fit (reuses RevenueCat gating):** Catalog + basic Identify = Free; full
artist registry, deep identifier branches, and "Look it up" = Pro/Research.
Mirrors Chrometria's depth-tiering.

## Lookup + review flow (sourcing model iii)

On "Look it up" for an unknown/stale artist:

1. **Draft.** `tone-api` runs a server-side lookup: web search for the artist's
   gear → LLM structures findings into candidate `artist_gear` rows, each with
   the **source URL** and a **confidence** (high = multiple corroborating
   sources or a direct quote; low = single unsourced mention). Claims without a
   citation are **dropped, not invented or downgraded**.
2. **Queue.** Rows insert as `status = draft`, visible immediately in the
   profile but badged "unverified — pending review."
3. **Review.** `#review` (owner-gated) lists drafts (artist, gear, quoted
   source, confidence) with one-tap **Approve / Edit / Reject**. Approve →
   `approved`, drops the badge; reject deletes.
4. **Trust after.** Approved rows keep their citation permanently; every claim
   traces to a source.

**Server-side rationale:** LLM/web API key stays in `tone-api` (never browser),
rate-limited and cached (one lookup per artist, not repeated), logged.

**Stated limitation:** gear lore is frequently wrong or outdated even in good
sources. The citation + confidence + approval chain does not make data *true* —
it makes it *traceable and reviewable*. The UI never presents a draft as fact.

## Error handling

- **Lookup finds nothing / junk LLM output:** returns "no sourced gear found";
  never fabricates a rig. Profile stays empty with a note.
- **Lookup backend down / rate-limited:** catalog, identify, and approved
  profiles keep working — lookup degrades independently.
- **Web/LLM timeout:** bounded timeout; draft job fails cleanly and is
  retryable; single insert transaction → no half-written rows.
- **Stale data:** `reviewed_at` lets profiles show "last verified <date>".

## Testing

- **Unit tests** (existing `__tests__` pattern): the LLM-output→`artist_gear`
  parser (drops uncited claims? clamps confidence?), `id_node` tree traversal,
  tier-gate checks.
- **Lookup mocked** in CI — no live web/LLM calls; fixture responses drive
  parser tests.
- **Seed smoke test:** load curated seed; assert catalog/identify render and a
  known artist profile resolves.

## Out of scope (this spec)

- Feature C (recreation/settings) and Feature A (audio inference) — separate
  specs, built after B.
- Native app versions — deferred to a future spec; web-first.
- Chrometria `core` symmetry engine integration — N/A by design.

## Open items

- **App name** — working name "Tone"; final name TBD with user.
- Curated seed scope — how many artists/sounds/fx_types to hand-seed before
  relying on lookup (decide during planning).
