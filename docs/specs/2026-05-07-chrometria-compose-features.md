# Chrometria Compose — 10-Feature Spec

**Date:** 2026-05-07
**Target:** Standalone Compose app (Kotlin) + web SPA (shared analyzer API)
**Shared API:** All features use the existing analyzer at port 3010 — one account, one tier, cross-app progress.
**Status:** All 10 features implemented and deployed (2026-05-07).

## Pricing Model (updated 2026-05-07)

| Tier | Price | Scope |
|------|-------|-------|
| Free | $0 | All 3 apps + web with per-feature limits, ads shown |
| Student | $3/mo | Pro features on Practice app only |
| Pro | $7/mo | Full access across all 4 platforms (Reference + Practice + Compose + web), no ads |
| Research | $15/mo | Everything + bulk API, Lilypond, corpus, unlimited |

One subscription, one account, works on every platform. Google Play IAP purchases call back to the analyzer API to set the tier server-side.

---

## Cross-App Data Architecture

All three apps (Reference, Practice, Compose) and the web SPA authenticate against the same analyzer API. Shared data:

- **Auth/tier:** Magic-link sessions + API keys, same `users` table
- **History:** `analysis_history` table records every classification regardless of source app
- **Achievements:** Granted by the API based on cumulative activity across all clients
- **Bookmarks/Collections:** Accessible from any client
- **Sketches:** New `sketches` table (Feature 1) — editable from Compose, viewable from Reference

Each API request includes an `X-Client` header (`web`, `reference-android`, `practice-android`, `compose-android`) for analytics but not for gating.

### API Changes (shared across all features)

**File:** `packages/analyzer/src/auth/middleware.ts`

Add rate-limit entries to `TIER_LIMITS`:
```
sketch: { anonymous: 0, free: 3, pro: 50, research: -1 }
compose: { anonymous: 0, free: 5, pro: 100, research: -1 }
euclidean: { anonymous: 5, free: 20, pro: -1, research: -1 }
orchestration: { anonymous: 0, free: 0, pro: 10, research: -1 }
```

---

## Feature 1 — Sketchpad / Workbench

### Goal
Multi-track workspace that layers melody, rhythm, and chord progression into a unified composition sketch with playback and save/load.

### User Story
As a Pro user, I want to combine a melody, rhythm, and chord progression into a single sketch so that I can hear how set-theory-derived materials sound together.

### Acceptance Criteria
1. Three tracks visible simultaneously: melody (piano roll), rhythm (step sequencer), chords (progression strip)
2. Unified transport bar: play/pause/stop, tempo (BPM), loop toggle
3. Tracks are time-aligned — playback advances all three in sync
4. Save sketch to API with name and description; load saved sketches
5. Free tier: 1 saved sketch, 8 bars max. Pro: 50 sketches, 64 bars. Research: unlimited.
6. Export entire sketch as MIDI file (all tracks merged)
7. Each track can be populated from its dedicated tool (e.g., build a melody on MelodyPage, import into sketch)

### Implementation Plan

**New files:**
- `packages/analyzer/src/sketches/db.ts` — migration + CRUD
- `packages/analyzer/src/sketches/routes.ts` — REST endpoints
- `packages/ui/src/pages/SketchpadPage.tsx` — main workbench UI
- `packages/ui/src/hooks/useSketchpad.ts` — state management + API
- `packages/ui/src/components/SketchTransport.tsx` — play/pause/tempo/loop bar
- `packages/ui/src/components/SketchTrackMelody.tsx` — inline piano roll
- `packages/ui/src/components/SketchTrackRhythm.tsx` — inline step sequencer
- `packages/ui/src/components/SketchTrackChords.tsx` — inline chord strip

**Modified files:**
- `packages/analyzer/src/index.ts` — mount router + migration
- `packages/ui/src/App.tsx` — add route
- `packages/ui/src/pages/MelodyPage.tsx` — "Send to Sketch" button
- `packages/ui/src/pages/RhythmPage.tsx` — "Send to Sketch" button
- `packages/ui/src/pages/ProgressionPage.tsx` — "Send to Sketch" button

**DB Schema:**
```sql
CREATE TABLE IF NOT EXISTS sketches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL DEFAULT 'Untitled Sketch',
  description TEXT DEFAULT '',
  tempo INTEGER NOT NULL DEFAULT 120,
  bars INTEGER NOT NULL DEFAULT 8,
  melody_data TEXT DEFAULT '[]',       -- JSON: [{pitch, start, duration}]
  rhythm_data TEXT DEFAULT '[]',       -- JSON: [0|1] per step per bar
  chord_data TEXT DEFAULT '[]',        -- JSON: [{pcs, name, bar, beats}]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**API Endpoints:**
| Method | Path | Auth | Tier |
|--------|------|------|------|
| GET | /api/sketches | requireAuth | all |
| GET | /api/sketches/:id | requireAuth | all |
| POST | /api/sketches | requireAuth | free+ (gated count) |
| PUT | /api/sketches/:id | requireAuth | owner |
| DELETE | /api/sketches/:id | requireAuth | owner |
| GET | /api/sketches/:id/midi | requireAuth | pro+ |

**Playback:** Web Audio API — `SketchTransport` owns an `AudioContext`, schedules notes ahead using `currentTime + lookahead`. Melody track uses oscillator or sample, rhythm uses noise burst / click, chords use stacked oscillators.

### Effort: L (16-20 hours)

---

## Feature 2 — Set-Class Palette

### Goal
Given a set class, generate all transpositions, inversions, and voicings as drag-and-drop building blocks for the sketchpad.

### User Story
As a composer, I want to pick a set class like 3-11 and see all 24 transpositions/inversions laid out so I can drag voicings into my chord track.

### Acceptance Criteria
1. Search/browse set classes by Forte number or by playing notes
2. For a selected set class, display all distinct transpositions (12/stabilizerOrder) and inversional forms
3. Each form shows its pitch classes, note names, and a mini keyboard diagram
4. Click to audition; drag to chord track of active sketch
5. Filter by: cardinality, symmetry group, interval content
6. Bookmark favorite set classes (uses existing bookmarks API)

### Implementation Plan

**New files:**
- `packages/ui/src/pages/SetClassPalettePage.tsx` — browser + voicing grid
- `packages/ui/src/components/PaletteCard.tsx` — single voicing card (mini keyboard, audition, drag handle)
- `packages/core/src/voicings.ts` — `allTranspositions(pcs)`, `allInversions(pcs)`, `allForms(pcs)`

**Modified files:**
- `packages/core/src/index.ts` — export new functions
- `packages/ui/src/App.tsx` — add route
- `packages/ui/src/pages/SketchpadPage.tsx` — accept drops on chord track

**Core functions:**
```typescript
// voicings.ts
export function allTranspositions(pcs: PitchClass[]): PitchClass[][] {
  // Returns distinctTranspositions(pcs) unique transpositions
}

export function allInversions(pcs: PitchClass[]): PitchClass[][] {
  // Returns all T_n I forms, deduplicated
}

export function allForms(pcs: PitchClass[]): { type: 'T' | 'TnI'; n: number; pcs: PitchClass[] }[] {
  // Combined, labeled, deduplicated
}
```

### Tier Gating
- Free: browse + audition, cardinality ≤ 4
- Pro: all cardinalities, drag to sketch
- Research: batch export all forms as CSV/JSON

### Effort: M (8-10 hours)

---

## Feature 3 — Constraint Composer

### Goal
Generate melodic or harmonic material that satisfies user-defined set-class and contour constraints.

### User Story
As a composition student, I want to say "give me a 4-bar melody using only pitch classes from {0,2,4,7,9} with ascending contour" and get valid candidates I can use.

### Acceptance Criteria
1. User specifies constraints:
   - Pitch-class set (required): select from palette or type Forte number
   - Contour class (optional): pick from dropdown or draw shape
   - Length: number of notes (4-32)
   - Register: octave range (e.g., C4-C6)
   - Rhythm pattern (optional): link to a rhythm from the rhythm editor
2. Generator produces up to 10 candidates that satisfy ALL constraints
3. Each candidate can be auditioned, edited, or sent to sketch
4. Algorithm uses backtracking search with constraint pruning, not random guessing
5. Generation completes in < 2 seconds for reasonable constraints

### Implementation Plan

**New files:**
- `packages/core/src/constraint-composer.ts` — generator engine
- `packages/ui/src/pages/ConstraintComposerPage.tsx` — constraint form + results
- `packages/ui/src/components/ConstraintForm.tsx` — input fields
- `packages/ui/src/components/CandidateCard.tsx` — audition + send to sketch

**Modified files:**
- `packages/core/src/index.ts` — export generator
- `packages/ui/src/App.tsx` — add route

**Core algorithm:**
```typescript
// constraint-composer.ts
interface CompositionConstraints {
  pitchClassSet: PitchClass[];          // allowed pitch classes
  length: number;                       // number of notes
  contourClass?: string;                // e.g., '<0213>'
  registerLow?: number;                 // MIDI note number (e.g., 60 = C4)
  registerHigh?: number;                // MIDI note number (e.g., 84 = C6)
  avoidRepeats?: boolean;               // no consecutive same pitch
  maxLeap?: number;                     // max interval between consecutive notes (semitones)
}

interface CompositionCandidate {
  notes: { pitch: number; pc: PitchClass }[];  // MIDI pitches
  contour: number[];                             // CSEG
  satisfiedConstraints: string[];
}

export function generateCandidates(
  constraints: CompositionConstraints,
  maxResults?: number,
): CompositionCandidate[]
```

The generator builds a search tree: at each position, try each pitch class in each allowed octave. Prune branches that violate contour, leap, or register constraints. Return first `maxResults` (default 10) complete solutions.

### Tier Gating
- Free: length ≤ 8, pc set only (no contour/register constraints)
- Pro: length ≤ 32, all constraints
- Research: length ≤ 64, batch generation, export as Lilypond

### Effort: M (10-12 hours)

---

## Feature 4 — Harmonic Path Navigator

### Goal
Interactive Neo-Riemannian Tonnetz map where users build chord progressions by walking PLR paths visually.

### User Story
As a composer, I want to tap C major and see its P, L, R neighbors on a map, then tap through a path to build a progression I can hear and export.

### Acceptance Criteria
1. Visual Tonnetz grid — triads as nodes, PLR operations as colored edges
2. Tap a starting chord; its 3 PLR neighbors highlight with operation labels
3. Tap a neighbor to move there; the path accumulates as a progression
4. Path display shows: chord sequence, total VL distance, common tones at each step
5. Playback the entire path as audio
6. "Undo step" and "clear path" controls
7. Export path as progression to sketch chord track
8. Show second-order and third-order neighbors (fade by distance)

### Implementation Plan

**New files:**
- `packages/ui/src/pages/HarmonicPathPage.tsx` — main page
- `packages/ui/src/components/TonnetzNavigator.tsx` — interactive SVG Tonnetz
- `packages/ui/src/components/PathProgressionStrip.tsx` — accumulated path display

**Modified files:**
- `packages/ui/src/App.tsx` — add route
- `packages/ui/src/pages/SketchpadPage.tsx` — accept path import

**Tonnetz layout:** Use the standard triangular Tonnetz where:
- X axis = major thirds (interval class 4)
- Y axis = minor thirds (interval class 3)
- Each node is a triad; adjacent nodes share 2 common tones

The SVG renders a viewport of ~20x12 nodes. User can pan/zoom. The active node pulses; PLR neighbors get colored rings (P=red, L=blue, R=green). Second-order neighbors show at 50% opacity.

Uses existing core functions: `applyP`, `applyL`, `applyR`, `applyCompound`, `allFirstOrder`, `allSecondOrder`, `allThirdOrder`, `voiceLeadingDistance`.

### Tier Gating
- Free: walk up to 8 chords, no export
- Pro: unlimited path length, export to sketch, save paths
- Research: seventh chord Tonnetz, custom tunings

### Effort: M (10-12 hours)

---

## Feature 5 — MIDI I/O

### Goal
Real-time MIDI input from hardware controllers and MIDI output to DAWs, turning the app into a theory-aware MIDI processor.

### User Story
As a working musician, I want to play chords on my MIDI controller and see real-time set-class analysis, then route the output to my DAW with voice-leading optimized voicings.

### Acceptance Criteria
1. MIDI Input: list available MIDI devices, select one, receive Note On/Off in real time
2. Live analysis: classify incoming pitch-class set on every note change (reuse `useLiveMidi` hook logic)
3. MIDI Output: select output device, send Note On/Off
4. Voice-leading filter: when enabled, re-voice incoming chords to minimize VL distance from previous chord
5. Transpose filter: shift all notes by ±N semitones
6. Set-class filter: quantize incoming notes to nearest member of a target set class
7. Latency display showing round-trip processing time
8. Works in browser (Web MIDI API) — Kotlin Android version uses `android.media.midi`

### Implementation Plan

**New files:**
- `packages/ui/src/pages/MidiIOPage.tsx` — device selection + filter chain + live display
- `packages/ui/src/hooks/useMidiOutput.ts` — Web MIDI API output wrapper
- `packages/ui/src/components/MidiFilterChain.tsx` — toggle filters: VL optimizer, transpose, quantize
- `packages/core/src/quantize.ts` — `quantizeToSet(pitch, targetPcs)` snaps MIDI note to nearest pitch in target set

**Modified files:**
- `packages/core/src/index.ts` — export quantize
- `packages/ui/src/App.tsx` — add route
- `packages/ui/src/hooks/useLiveMidi.ts` — extract shared logic for MIDI input handling

**Core function:**
```typescript
// quantize.ts
export function quantizeToSet(midiNote: number, targetPcs: PitchClass[]): number {
  const pc = midiNote % 12;
  const octave = Math.floor(midiNote / 12);
  // Find closest pc in targetPcs by semitone distance
  let bestPc = targetPcs[0]!;
  let bestDist = 12;
  for (const t of targetPcs) {
    const d = Math.min(Math.abs(pc - t), 12 - Math.abs(pc - t));
    if (d < bestDist) { bestDist = d; bestPc = t; }
  }
  return octave * 12 + bestPc;
}
```

### Tier Gating
- Free: MIDI input only, no output, no filters
- Pro: input + output + all filters
- Research: multi-channel routing, filter chain presets

### Effort: M (8-10 hours)

---

## Feature 6 — Export to DAW

### Goal
Export sketches and individual tool outputs as MIDI file, MusicXML, and Lilypond for import into professional DAWs and notation software.

### User Story
As a composer, I want to export my sketch as a MIDI file so I can continue working on it in Ableton Live.

### Acceptance Criteria
1. MIDI export: multi-track MIDI file (Type 1) with one track per sketch layer
2. MusicXML export: basic notation (note heads, rests, bar lines) importable by Finale/MuseScore
3. Lilypond export: extend existing `toLilypond()` to handle multi-voice sketches
4. Export available from: SketchpadPage, MelodyPage, RhythmPage, ProgressionPage
5. Filename includes sketch name and date
6. MIDI export preserves tempo, time signature, and track names

### Implementation Plan

**New files:**
- `packages/ui/src/utils/musicxml-writer.ts` — MusicXML generation
- `packages/ui/src/utils/sketch-export.ts` — unified export dispatcher

**Modified files:**
- `packages/ui/src/utils/midi-writer.ts` — extend `downloadMidi` for multi-track Type 1 MIDI
- `packages/ui/src/utils/export-academic.ts` — extend `toLilypond` for multi-voice
- `packages/ui/src/pages/SketchpadPage.tsx` — export menu with format choice
- `packages/ui/src/components/ExportMenu.tsx` — add MusicXML option globally

**MusicXML structure:**
```typescript
// musicxml-writer.ts
interface MusicXMLOptions {
  title: string;
  composer?: string;
  tempo: number;
  timeSignature: [number, number];  // [beats, beatType]
  parts: {
    name: string;
    notes: { pitch: number; duration: number; rest?: boolean }[];
  }[];
}

export function toMusicXML(options: MusicXMLOptions): string
// Returns valid MusicXML 4.0 string
```

### Tier Gating
- Free: MIDI export (single track only)
- Pro: multi-track MIDI + MusicXML
- Research: all formats + Lilypond + batch export

### Effort: S (6-8 hours)

---

## Feature 7 — Euclidean Rhythm Generator

### Goal
Generate Euclidean rhythms (Bjorklund's algorithm) — maximally even distributions of k onsets in n steps — and integrate with the rhythm editor and sketchpad.

### User Story
As a composer, I want to type "5 onsets in 8 steps" and instantly get the Euclidean rhythm [10110110], hear it, and use it in my sketch.

### Acceptance Criteria
1. Input: k (onsets) and n (steps) via sliders or number inputs
2. Output: the Euclidean rhythm pattern, visualized as a circular diagram and step grid
3. Display: necklace class, IOI vector, evenness score, whether it matches a known clave
4. Known clave matching: if the pattern matches Tresillo, Son Clave, Bossa Nova, etc., show the name
5. Rotation control: rotate the pattern and see how it maps to different claves
6. "Send to Rhythm Track" button for sketch integration
7. Comparison mode: generate two Euclidean rhythms and see their similarity

### Implementation Plan

**New files:**
- `packages/core/src/euclidean.ts` — Bjorklund algorithm + clave matching
- `packages/ui/src/pages/EuclideanPage.tsx` — generator UI
- `packages/ui/src/components/CircularRhythmDiagram.tsx` — circular onset visualization

**Modified files:**
- `packages/core/src/index.ts` — export euclidean functions
- `packages/ui/src/App.tsx` — add route
- `packages/ui/src/pages/RhythmPage.tsx` — "Generate Euclidean" button

**Core algorithm:**
```typescript
// euclidean.ts
import type { RhythmPattern, Beat } from './rhythm';

export function euclidean(k: number, n: number): RhythmPattern {
  // Bjorklund's algorithm (binary word distribution)
  if (k >= n) return Array(n).fill(1) as RhythmPattern;
  if (k <= 0) return Array(n).fill(0) as RhythmPattern;

  let groups: number[][] = [
    ...Array(k).fill(null).map(() => [1]),
    ...Array(n - k).fill(null).map(() => [0]),
  ];

  while (true) {
    const ones = groups.filter(g => g[0] === 1);
    const zeros = groups.filter(g => g[0] === 0);
    if (zeros.length <= 1) break;
    const merged: number[][] = [];
    const pairs = Math.min(ones.length, zeros.length);
    for (let i = 0; i < pairs; i++) {
      merged.push([...ones[i]!, ...zeros[i]!]);
    }
    const remainder = ones.length > zeros.length
      ? ones.slice(pairs)
      : zeros.slice(pairs);
    groups = [...merged, ...remainder];
  }

  return groups.flat() as RhythmPattern;
}

export interface KnownClave {
  name: string;
  pattern: RhythmPattern;
  k: number;
  n: number;
}

export const KNOWN_CLAVES: KnownClave[] = [
  { name: 'Tresillo', pattern: [1,0,0,1,0,0,1,0], k: 3, n: 8 },
  { name: 'Cinquillo', pattern: [1,0,1,1,0,1,1,0], k: 5, n: 8 },
  { name: 'Son Clave', pattern: [1,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0], k: 5, n: 16 },
  { name: 'Bossa Nova', pattern: [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0], k: 5, n: 16 },
  { name: 'Aksak', pattern: [1,0,1,0,1,0,1,0,1], k: 5, n: 9 },
];

export function matchClave(pattern: RhythmPattern): KnownClave | null
// Checks all rotations of pattern against known claves
```

### Tier Gating
- Free: n ≤ 16
- Pro: n ≤ 64, send to sketch
- Research: n ≤ 128, batch generate family tables

### Effort: S (4-6 hours)

---

## Feature 8 — Orchestration Suggestions

### Goal
Given a set class and register, suggest instrument combinations that voice it effectively, based on interval content and range analysis.

### User Story
As an orchestration student, I want to input a set class and get suggestions like "spread voicing in strings" or "close-position brass cluster" with reasoning.

### Acceptance Criteria
1. Input: pitch-class set (from palette or manual entry) + register range
2. Output: ranked list of orchestration suggestions with:
   - Instrument combination (e.g., "Fl, Ob, Cl" or "Vln I, Vla, Vc")
   - Voicing diagram showing which instrument plays which pitch
   - Reasoning based on interval content (e.g., "ic1 present → avoid unison doubling in brass")
   - Audio preview using basic instrument timbres
3. Suggestions are rule-based (not AI), using orchestration heuristics:
   - Wide intervals (ic5, ic6) → strings, woodwinds
   - Close clusters (ic1, ic2) → brass, organ
   - Symmetric sets → balanced scoring across families
   - Register extremes → appropriate instrument ranges
4. At least 3 suggestions per query

### Implementation Plan

**New files:**
- `packages/core/src/orchestration.ts` — suggestion engine
- `packages/ui/src/pages/OrchestrationPage.tsx` — input + results
- `packages/ui/src/components/VoicingDiagram.tsx` — visual instrument → pitch assignment
- `packages/ui/src/data/instrument-ranges.ts` — MIDI ranges for ~30 orchestral instruments

**Modified files:**
- `packages/core/src/index.ts` — export orchestration functions
- `packages/ui/src/App.tsx` — add route

**Core types:**
```typescript
// orchestration.ts
interface Instrument {
  name: string;
  family: 'woodwind' | 'brass' | 'string' | 'percussion' | 'keyboard';
  rangeLow: number;    // MIDI note
  rangeHigh: number;   // MIDI note
  sweet: [number, number]; // sweet spot range
}

interface OrchestrationSuggestion {
  instruments: Instrument[];
  voicing: { instrument: string; midiNote: number; pc: PitchClass }[];
  reasoning: string[];
  score: number;  // 0-100 quality score
}

export function suggestOrchestrations(
  pcs: PitchClass[],
  options?: {
    registerLow?: number;
    registerHigh?: number;
    families?: ('woodwind' | 'brass' | 'string')[];
    maxResults?: number;
  }
): OrchestrationSuggestion[]
```

### Tier Gating
- Free: not available
- Pro: 10 queries/day, standard orchestral instruments
- Research: unlimited, extended instruments, custom timbres

### Effort: M (10-12 hours)

---

## Feature 9 — Transformation Chains

### Goal
Apply sequences of T_n, I_n, and PLR operations to a seed chord and hear the result, building progressions algorithmically.

### User Story
As a theory student, I want to start with a C major triad, apply P then T5 then I, hear each step, and understand the transformation path.

### Acceptance Criteria
1. Input a seed chord (play on keyboard, select from palette, or type pc set)
2. Build a chain of operations from a toolbar: T0-T11, I0-I11, P, L, R
3. Each operation appends to the chain; the result updates live
4. Display: seed → op1 → result1 → op2 → result2 → ... as a visual pipeline
5. At each step show: resulting pc set, Forte number, common tones with previous, VL distance
6. Playback: hear the progression of chords from seed through all transformations
7. "Randomize chain" button: generate a random chain of N operations
8. Export chain as progression to sketch

### Implementation Plan

**New files:**
- `packages/core/src/transform-chain.ts` — chain evaluator
- `packages/ui/src/pages/TransformChainPage.tsx` — chain builder UI
- `packages/ui/src/components/ChainPipeline.tsx` — visual operation pipeline
- `packages/ui/src/components/OperationToolbar.tsx` — T/I/PLR buttons

**Modified files:**
- `packages/core/src/index.ts` — export chain functions
- `packages/ui/src/App.tsx` — add route

**Core types:**
```typescript
// transform-chain.ts
import type { PitchClass, Chord } from './types';
import { transpose, invert, toPcSet } from './pcset';
import { applyP, applyL, applyR } from './plr';
import { identifyChord } from './chords';

type Operation =
  | { type: 'T'; n: number }      // transpose by n
  | { type: 'I'; n: number }      // invert around axis n
  | { type: 'P' }                 // parallel
  | { type: 'L' }                 // leading-tone exchange
  | { type: 'R' };                // relative

interface ChainStep {
  operation: Operation;
  inputPcs: PitchClass[];
  outputPcs: PitchClass[];
  chordName: string | null;
  commonTones: PitchClass[];
  vlDistance: number;
}

export function evaluateChain(
  seed: PitchClass[],
  operations: Operation[],
): ChainStep[]

export function randomChain(length: number): Operation[]
```

T/I operations work on raw pitch-class sets. PLR operations require a Chord (root + quality), so the engine attempts `identifyChord()` first; if the set isn't a triad, PLR ops are skipped with a warning.

### Tier Gating
- Free: chain length ≤ 4, T/I only
- Pro: chain length ≤ 24, T/I/PLR, export to sketch
- Research: unlimited, batch chains, Lilypond export

### Effort: S (6-8 hours)

---

## Feature 10 — Practice Integration (Cross-App Bridge)

### Goal
Pull learning progress and challenge results from the Practice app and generate contextual composition exercises in Compose.

### User Story
As a student using both apps, I want Compose to know I just completed the "Symmetry Groups" learning path and suggest composition exercises that apply those concepts.

### Acceptance Criteria
1. Dashboard widget on SketchpadPage showing: current learning path progress, daily challenge streak, recent achievements
2. "Suggested exercises" section that generates prompts based on what the user recently learned:
   - Completed "Intro to Set Theory" → "Compose a melody using set class 3-11 and its complement"
   - Completed "Symmetry Groups" → "Build a progression that stays within the D6 symmetry group"
   - Earned "Z-Pair Explorer" achievement → "Compare melodies using a Z-related pair"
3. Exercise prompts link to the appropriate tool (Constraint Composer, Harmonic Path, etc.) with constraints pre-filled
4. Completion tracking: user marks exercises as done, contributing to achievement progress
5. Works without Practice app installed — gracefully degrades if no learning data exists

### Implementation Plan

**New files:**
- `packages/analyzer/src/exercises/db.ts` — exercise completion table
- `packages/analyzer/src/exercises/routes.ts` — suggested + completed exercises
- `packages/analyzer/src/exercises/generator.ts` — rule-based exercise generation from learning state
- `packages/ui/src/components/ExerciseSuggestions.tsx` — dashboard widget
- `packages/ui/src/hooks/useExercises.ts` — API hook

**Modified files:**
- `packages/analyzer/src/index.ts` — mount router + migration
- `packages/ui/src/pages/SketchpadPage.tsx` — embed ExerciseSuggestions widget

**DB Schema:**
```sql
CREATE TABLE IF NOT EXISTS exercise_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  exercise_key TEXT NOT NULL,          -- e.g., 'melody-3-11-complement'
  completed_at TEXT DEFAULT (datetime('now')),
  sketch_id INTEGER REFERENCES sketches(id),  -- optional link to resulting sketch
  UNIQUE(user_id, exercise_key)
);
```

**API Endpoints:**
| Method | Path | Auth | Tier |
|--------|------|------|------|
| GET | /api/exercises/suggested | requireAuth | free+ |
| POST | /api/exercises/:key/complete | requireAuth | free+ |
| GET | /api/exercises/completed | requireAuth | free+ |

**Exercise generator logic:** Reads from `lesson_progress`, `analysis_history`, `achievements` tables. Each learning path lesson has a mapping to 1-3 exercise templates. The generator picks exercises for the most recently completed lessons that haven't been exercised yet.

### Tier Gating
- Free: 1 suggested exercise at a time
- Pro: 5 suggestions, exercise history
- Research: unlimited, custom exercise creation

### Effort: S (6-8 hours)

---

## Summary

| # | Feature | Package(s) | Effort | New Core Functions | New DB Tables |
|---|---------|-----------|--------|-------------------|--------------|
| 1 | Sketchpad | core, ui, analyzer | L | — | sketches |
| 2 | Set-Class Palette | core, ui | M | allTranspositions, allInversions, allForms | — |
| 3 | Constraint Composer | core, ui | M | generateCandidates | — |
| 4 | Harmonic Path Navigator | ui | M | — (uses existing PLR) | — |
| 5 | MIDI I/O | core, ui | M | quantizeToSet | — |
| 6 | Export to DAW | ui | S | — | — |
| 7 | Euclidean Rhythm | core, ui | S | euclidean, matchClave | — |
| 8 | Orchestration | core, ui | M | suggestOrchestrations | — |
| 9 | Transformation Chains | core, ui | S | evaluateChain, randomChain | — |
| 10 | Practice Integration | ui, analyzer | S | — | exercise_completions |

**Total estimated effort:** 85-106 hours

**Recommended build order:**
1. Feature 7 (Euclidean) — smallest, adds to core, validates pattern
2. Feature 9 (Transform Chains) — small, adds to core
3. Feature 2 (Set-Class Palette) — medium, needed by Feature 3
4. Feature 1 (Sketchpad) — large, central hub, depends on nothing
5. Feature 6 (Export to DAW) — small, extends sketchpad
6. Feature 3 (Constraint Composer) — medium, uses palette data
7. Feature 4 (Harmonic Path) — medium, standalone
8. Feature 5 (MIDI I/O) — medium, standalone
9. Feature 8 (Orchestration) — medium, standalone
10. Feature 10 (Practice Integration) — small, needs all other features stable

**Batching for implementation:**
- **Batch 1 (core foundations):** Features 7, 9, 2 — new core functions, no DB
- **Batch 2 (the hub):** Features 1, 6 — sketchpad + export
- **Batch 3 (creative tools):** Features 3, 4, 5 — composition generators
- **Batch 4 (polish):** Features 8, 10 — orchestration + cross-app bridge
