# Chrometria — Live Chord/Key ID with Symmetry Overlay

**Status:** Design — approved 2026-05-14
**Author:** Brainstormed with Claude (Session 110-area)
**Target release:** v1 (mobile-first, Capacitor Android first)

---

## 1. One-line

A Shazam-style chord and key identifier that adds Chrometria-specific symmetry context (orbit diagram, set class, interval vector), designed mobile-first with a tier-differentiated information-density paywall.

## 2. Motivation

Chrometria ships 24 tools today but its discovery flow — "open the app and explore a deep set-theory toolkit" — has a steep entry ramp. A Shazam-style live identifier creates an instant "wow" moment that:

- **Differentiates** the product (E motivation): no other music-theory tool ships live chord ID with symmetry overlay
- **Scratches a personal itch** (F motivation): the "what am I playing?" + "what's the structural identity?" lookup is something the founder regularly wants
- **Mobile-first amplification** (D motivation): the Capacitor Android wrapper has been shipping but lacks a flagship feature designed *for* the phone form factor

The feature is also a **conversion lever**: Free users get a working chord identifier (genuine value, branded PNG-shareable), but Pro users get the *symmetry depth* — the Chrometria thing nobody else does.

## 3. Scope

### In scope (v1)

- New top-level page `/chord-id` — the 25th tool
- Two modes on the page: **Live** (continuous + snapshot capture) and **Session** (record + analyze timeline)
- Real-time chord identification by name (e.g., "Cmaj7")
- Rolling-window key/tonal-center inference
- Visual triptych (Pro): chord-clockface, key-fifth-rose, orbit-diagram
- Tier-gated info density (Free = chord name hero; Pro = triptych; Research = + academic export)
- Snapshot save (Free: last 3; Pro/Research: unlimited)
- Branded PNG image export (all tiers — viral lever)
- Session record (Free: 30s cap; Pro/Research: unlimited)
- MIDI / audio re-export (Pro+); MusicXML / LaTeX / BibTeX (Research)
- Two-tier confidence model with Pro-tunable thresholds
- Mobile-first layout: hero-plus-tabs, FAB capture button, haptic confirm

### Deferred to v2+ (each will get its own spec)

- Merging into `LiveDetectionPage` once usage data exists
- AI-augmented composition
- Live-performance integration
- Perceptual research tooling
- Novel visualization mode
- Symmetry-first hero ("Navigator mode" — option C from brainstorm Q7)
- Swipe-between-cards layout (post-v1 power-user upgrade)
- Custom acoustic instrument profiles
- iOS Capacitor build

### Explicitly out of scope (won't build)

- Recognizing recorded music (Shazam-style fingerprinting) — we only identify chords from live input
- Lyrics, song titles, artists, or any non-theoretical metadata
- Notation rendering (handled by existing tools — Score Annotation, Progression Builder)

## 4. Architecture

### Where it sits in the codebase

| Layer | Reuse / New |
|---|---|
| Routing | NEW page `/chord-id` registered in `packages/ui/src/App.tsx` |
| Mobile placement | NEW: lives in **Practice** Capacitor app as a primary bottom-nav destination |
| Audio pipeline | REUSE `MicControls` component, existing pitch detection used by `LiveDetectionPage` |
| Chord ID | REUSE `identifyChord(pcs)` from `packages/core/src/chords.ts` |
| Key detection | NEW: rolling-window Krumhansl-Schmuckler key profile inference; extends primitives in `packages/core/src/modes.ts` |
| Confidence engine | NEW: two-tier (tentative + confirmed) stability check, lives in `packages/ui/src/hooks/useConfidentChord.ts` |
| Chord-clockface visual | NEW component `packages/ui/src/components/ChordClockface.tsx` |
| Key-fifth-rose visual | NEW component `packages/ui/src/components/KeyFifthRose.tsx` |
| Orbit-diagram visual | REUSE existing component from `ClassifierPage` |
| Session storage | NEW: per-user `snapshots` and `id_sessions` tables in existing DB schema |
| Image renderer | NEW: server-side PNG renderer for branded snapshot export (`packages/analyzer/src/snapshot-render.ts` using `@vercel/og` or `node-canvas`) |
| MIDI exporter | NEW: chord-history → MIDI conversion (`packages/core/src/midi-export.ts`) |
| Tier gating | REUSE existing `useUser()` hook and tier flag |

### Data flow

```
Mic input
  ↓
Pitch detection (existing pipeline)
  ↓
Rolling-window pitch-class aggregation (1.2s default)
  ↓
identifyChord(pcs)  →  candidate list with confidence scores
  ↓
Stability check (800ms continuous match @ ≥0.65 confidence)
  ↓
Confidence engine emits {tentative | confirmed} state
  ↓                              ↓
Rendered as subdued Chord card   Rendered as full-opacity Chord card + haptic
                                  ↓
                                  Key inference (Krumhansl-Schmuckler over 30s chord history)
                                  ↓
                                  Symmetry inference (set class lookup from chord PCs)
                                  ↓
                                  Pro triptych populates Key + Symmetry cards
```

Snapshot capture path:
```
User taps FAB
  ↓
Current state (chord, key, symmetry) frozen
  ↓
Snapshot row inserted (per-tier cap enforced)
  ↓
Image renderer composes branded PNG
  ↓
User can share / download
```

Session record path:
```
User taps Record on Session tab
  ↓
Audio recorded to in-memory blob (Free: 30s hard cap; Pro: unlimited)
  ↓
Tap Stop
  ↓
Full chord-history timeline rendered (chords as horizontal segments, key as colored arc above)
  ↓
Pro: replay / MIDI export / audio re-export
Research: + MusicXML / LaTeX / BibTeX export
```

## 5. UI design

### Live mode (default tab)

Hero-plus-tabs mobile layout:

```
┌────────────────────────┐
│  9:41    [● ● ●]       │  ← system bar
│  [Live | Session]      │  ← top tabs (sticky)
│                        │
│  ┌──────────────────┐  │
│  │     Cmaj7        │  │  ← hero card (chord name + clockface)
│  │                  │  │
│  │    [clockface]   │  │
│  │                  │  │
│  └──────────────────┘  │
│                        │
│  [Key | Symmetry]      │  ← secondary tabs (Pro only)
│                        │
│  ┌──────────────────┐  │
│  │ [fifth-rose]     │  │  ← active secondary card
│  │ F major · V₇     │  │
│  └──────────────────┘  │
│                        │
│            ╭───╮       │
│            │ ● │       │  ← FAB (capture)
│            ╰───╯       │
└────────────────────────┘
```

- **Free tier**: hero card only (chord name + clockface); secondary tabs hidden
- **Pro tier**: hero card + secondary card with Key/Symmetry tab toggle
- **Research tier**: identical layout to Pro; differences live in export options

### Session mode (second tab)

```
┌────────────────────────┐
│  [Live | Session]      │
│                        │
│  ┌──────────────────┐  │
│  │   00:00 / 0:30   │  │  ← timer (Free) / unlimited (Pro)
│  │                  │  │
│  │   ●  RECORD      │  │  ← big record button
│  │                  │  │
│  └──────────────────┘  │
│                        │
│  Last 3 sessions:      │
│  • C  → Am → F → G    │  ← saved sessions list
│  • Cm → Ab → Eb → Bb  │
│  • F  → Dm → Gm → C   │
└────────────────────────┘
```

After recording stops:

```
┌────────────────────────┐
│  Timeline (3 chords)   │
│                        │
│  ████░░░░░░░░░░ Cmaj7  │  ← chord segments, length = duration
│  ░░░░████░░░░░░ Am7    │
│  ░░░░░░░░████░░ Fmaj7  │
│                        │
│  Key arc: F major ────│  ← key timeline above
│                        │
│  [Replay] [Export ▾]  │
└────────────────────────┘
```

## 6. Confidence and timing model

Two-tier rendering: every frame produces a *tentative* identification; the *confirmed* identification is what gets visually committed (and haptic-pulsed).

| Constant | Default | Pro-tunable range |
|---|---|---|
| Rolling analysis window | 1.2s | 400–2000ms |
| Stability threshold (continuous match required) | 800ms | 300–1500ms |
| Confidence floor for "confirmed" | 0.65 | 0.50–0.90 |
| Downgrade hysteresis (anti-flicker) | 200ms | (fixed) |
| Key inference window | 30s rolling | 10–60s |
| Key change-trigger threshold | 0.7 confidence in new key sustained for 8s | (fixed) |

Confidence is computed as: (notes in PC set matching chord template) / (total prominent notes), weighted by note prominence (RMS amplitude × duration).

## 7. Tier breakdown

Student is treated as Pro-equivalent for this feature — the chord-ID surface is educational by nature, and locking Student users out of the triptych would contradict the tier's positioning.

| Feature | Free ($0) | Student ($3/mo) | Pro ($7/mo) | Research ($15/mo) |
|---|---|---|---|---|
| Live chord ID | ✓ | ✓ | ✓ | ✓ |
| Soft-pulse silence state | ✓ | ✓ | ✓ | ✓ |
| Single-pitch chip | ✓ | ✓ | ✓ | ✓ |
| Tentative + confirmed two-tier rendering | ✓ | ✓ | ✓ | ✓ |
| Snapshots saved | Last 3 | Unlimited | Unlimited | Unlimited |
| Branded PNG image export | ✓ | ✓ | ✓ | ✓ |
| Visual triptych (key + symmetry cards) | — | ✓ | ✓ | ✓ |
| Tunable confidence threshold | — | ✓ | ✓ | ✓ |
| Top-3 candidate reveal | — | ✓ | ✓ | ✓ |
| "Why not confirmed?" diagnostic | — | ✓ | ✓ | ✓ |
| Mic input level indicator | — | ✓ | ✓ | ✓ |
| Modulation callout | — | ✓ | ✓ | ✓ |
| Session record cap | 30s | Unlimited | Unlimited | Unlimited |
| Session timeline replay | — | ✓ | ✓ | ✓ |
| MIDI export from session | — | ✓ | ✓ | ✓ |
| Audio re-export | — | ✓ | ✓ | ✓ |
| MusicXML / LaTeX / BibTeX export | — | — | — | ✓ |
| DAW-ready chord-MIDI alignment | — | — | — | ✓ |
| Batch session export | — | — | — | ✓ |

## 8. Edge cases and behavior

| Situation | Free behavior | Pro additions |
|---|---|---|
| Silence | Soft pulsing "Listening…" — no error text | + visible mic input level indicator |
| Ambiguous chord | Show top guess in tentative styling | + top-3 candidates list with confidence bars + "why not confirmed?" diagnostic |
| Single pitch | "♪ C5 — keep playing" chip | + pitch trend chart |
| Polyphonic overload (orchestra/loud room) | Cap at top-3 most prominent PCs, commit to subset | + full pitch-prominence histogram |
| Modulation mid-session | New key proposed if drift exceeds threshold | + "modulating: F → G mixolydian" callout |
| Mic permission denied | Inline modal explaining why mic is needed + retry button | (same) |
| Mic unavailable (no hardware / lock screen) | "Microphone not available" error state | (same) |
| Tier limit hit (Free 4th snapshot) | Modal: "You've used your 3 snapshot saves — upgrade to Pro for unlimited" | (n/a) |
| Session record at 30s on Free | Auto-stop + "Upgrade to Pro for unlimited recording" toast | (n/a) |

## 9. Image export specification

Branded PNG generated server-side (via analyzer service) for snapshot sharing:

- Dimensions: 1200×1200 (square, Instagram-friendly) and 1200×630 (Twitter/OG card) — two formats generated per snapshot
- Top: chord name in large display font (matches in-app typography)
- Center: clockface visualization (200×200 with PCs as highlighted dots)
- Bottom strip: "chrometria.tendrid.us" wordmark + small Chrometria logo
- Background: dark navy with subtle constellation pattern (brand identity)
- Generated on-demand when user taps "Share" from a snapshot

Visual branding rules (logo placement, palette, typography) deferred to a separate design-system spec.

## 10. Testing strategy

| What | How |
|---|---|
| Chord ID accuracy | Unit tests against synthetic sine-wave chord renders covering all 224 set classes from `Atlas` |
| Confidence/stability promotion | Time-stepped synthetic input where chord changes at known times; assert promotion happens at threshold + window |
| Hysteresis (anti-flicker) | Inject single-frame artifacts in middle of stable chord; assert no downgrade |
| Key detection | Recorded MIDI piano corpus with known key annotations; integration test target: 85% top-1 accuracy on confirmed-style window |
| Modulation detection | Synthetic test progressions that modulate at known timestamps; assert key-change-trigger within 8s ± 2s of actual modulation |
| Mobile UX | Manual smoke test on Capacitor build; haptic-on-confirm; FAB tap → image export round-trip |
| Free vs Pro tier gating | `UserContext` mock for tier flag; assert triptych tabs hidden / candidate list hidden on Free |
| Edge cases | Silence-only input → no false positives; monophonic input → single-pitch chip; polyphonic recording → graceful subset |
| Image export | Snapshot fixture → PNG bytes match golden file (per snapshot variant) |
| Session export | Recorded fixture → MIDI/MusicXML output validates against schema and replays in MuseScore |

## 11. Telemetry (for v2 decisions)

**Precondition:** Chrometria currently has no analytics infrastructure (the privacy page explicitly says "we do not use third-party analytics"). To make the success criteria in §13 measurable, this feature requires a **first-party telemetry endpoint** added as parallel work:

- New analyzer endpoint `POST /telemetry/events` accepting `{event_name, tier, timestamp, anonymous_session_id, properties}` payloads
- No third-party SDKs (posthog, plausible, GA, etc.) — preserves the existing privacy commitment
- Anonymous session IDs only; no user-account linkage in stored events
- Documented in updated PrivacyPage: "we collect anonymous usage events about which features get used and how often"
- Stored in a new `telemetry_events` table; queryable for v1.1 baseline analysis

Events to instrument (anonymized, tagged with tier flag):

- `chord_id.page_view`
- `chord_id.first_confirmed_chord` (with `latency_ms` property)
- `chord_id.snapshot_captured`
- `chord_id.image_exported`
- `chord_id.session_recorded` (with `duration_s` property)
- `chord_id.free_snapshot_cap_hit`
- `chord_id.tier_upgrade_clicked` (with `source` property: "snapshot_cap_modal" / "triptych_tease" / "session_cap_toast")
- `chord_id.edge_case` (with `type` property: "silence" / "single_pitch" / "polyphonic_overload" / "ambiguous")

This data drives the v1.1 calibration: establish baselines, then set the success thresholds in §13.

## 12. Open questions (post-v1, not blocking)

- **iOS support**: Capacitor iOS build path is open; not blocking Android v1 launch
- **Web pitch detection quality on non-Chrome browsers**: Web Audio API support varies; document in `docs/` if Firefox/Safari users hit issues
- **Acoustic instrument profiles**: a future feature where users select "piano" / "guitar" / "voice" for pitch-detection tuning — likely v2
- **Offline mode**: identify chord locally on-device without server roundtrips — entire pipeline is already client-side, so probably free once snapshot export is decoupled from server-side render
- **Sharing UX**: branded PNG is the v1 share; consider adding "share to Instagram story" deeplinks in v2

## 13. Success criteria

Because Chrometria has no historical analytics baselines, success criteria split into two phases:

### v1 launch — non-numeric quality bars (must-haves before ship)

- **Accuracy**: ≥80% top-1 chord ID on the synthetic-chord test suite (covers all 224 set classes) — fails-the-ship if below
- **Latency**: median time-to-first-confirmed-chord ≤ 2.5s on the mobile build with built-in mic on a mid-tier Android device (test rig: Pixel 6a or equivalent) — fails-the-ship if slower
- **Stability**: no P0 audio-pipeline bugs in the 2-week soak period before public rollout
- **Privacy**: PrivacyPage updated to reflect new first-party telemetry; legal review checkbox before launch

### v1.1 baseline establishment — first 4 weeks post-launch

Don't set conversion thresholds upfront — collect baselines first. Measure:

- Chord ID page-view rate per active user
- Time-to-first-confirmed-chord distribution (p50, p90)
- Snapshot capture rate (per user, per session)
- Image export rate (per snapshot)
- Session record duration distribution
- Free-tier snapshot-cap modal hit rate (proves the cap is engaged at all)
- Free → Pro upgrade rate attributable to Chord ID, segmented by trigger source

### v1.2 targets — after 4-week baseline

Set numeric goals informed by the v1.1 data. Example targets to consider once baselines exist:

- Snapshot-cap modal → Pro conversion ≥ N% (where N is informed by overall site Free → Pro rate)
- Median time-to-first-confirmed-chord trending down quarter-over-quarter
- Chord ID page becomes a top-5 referrer for Pro upgrade events

This staged approach avoids guessing at success thresholds without data and prevents the failure mode where launch "succeeds" or "fails" against arbitrary numbers.
