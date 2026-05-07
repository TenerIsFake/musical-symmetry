# Melodic Contour Analysis

## Goal

Classify ordered pitch sequences by their contour shape (CSEG class), interval succession, and symmetry properties — bridging the gap between unordered set-class analysis and real musical melody.

## User Stories

- As a **free** user, I want to input a short melody and see its contour class so I can understand melodic shape abstractly.
- As a **Pro** user, I want to record melodies from my mic and get real-time contour classification with phrase segmentation so I can analyze improvisations.
- As a **Research** user, I want batch contour analysis of MIDI files with CSV export and contour similarity matrices so I can compare melodic material across compositions.

## Acceptance Criteria

1. New `packages/core/src/contour.ts` exports: `toCSEG()`, `contourClass()`, `contourInterval()`, `contourSimilarity()`, `isContourPalindrome()`, `contourInversion()`, `contourRetrograde()`
2. New UI page at `#melody` with:
   - Piano-roll input (click to place notes in sequence)
   - "Record from mic" button (reuses existing pitch-detect pipeline)
   - Contour diagram (rising/falling/same arrows)
   - CSEG class label and COM (Contour Adjacency Series) display
   - Phrase segmentation markers (based on rests > 300ms or contour reversals)
   - "Related contours" panel showing transformations (inversion, retrograde, retrograde-inversion)
3. Contour similarity score between two melodies (Marvin & Laprade's CSIM metric)
4. Integration with Live Detection — add a "Contour Mode" toggle that switches from set-accumulation to ordered-sequence tracking
5. API endpoint `POST /api/contour/analyze` accepting `{ notes: {pc, octave, durationMs}[] }` returning full contour analysis
6. API endpoint `POST /api/contour/compare` accepting two melodies, returning similarity metrics
7. Free tier: manual input up to 12 notes, no mic recording in contour mode
8. Pro tier: mic recording, up to 64 notes, phrase segmentation
9. Research tier: unlimited notes, batch file analysis, CSV export, similarity matrices

## Background: Contour Theory

**CSEG (Contour Segment):** An ordered sequence of relative pitch positions. `[C4, E4, D4, G4]` → CSEG `<0 2 1 3>` (rank from lowest=0 to highest=n-1).

**Contour Class:** The equivalence class under reduction — two melodies have the same contour class if their CSEGs match after removing repeated adjacent values.

**COM (Comparison Matrix):** An n×n matrix where `COM[i][j]` = `+` if note j is higher than note i, `-` if lower, `0` if same. The upper triangle encodes all contour relationships.

**CSIM (Contour Similarity):** Proportion of matching entries in the COM upper triangles of two same-length CSEGs. Range [0, 1].

**Contour Palindrome:** A CSEG that equals its retrograde (e.g., `<0 2 1 2 0>`).

## Implementation Plan

### Package: `packages/core`

**Create:** `packages/core/src/contour.ts`
```typescript
export type CSEG = number[];  // ordered relative pitch positions
export type COMMatrix = ('+' | '-' | '0')[][];

export interface ContourAnalysis {
  cseg: CSEG;
  comMatrix: COMMatrix;
  cas: ('+' | '-' | '0')[];      // Contour Adjacency Series (successive intervals)
  isPalindrome: boolean;
  isInversionallySymmetric: boolean;
  depth: number;                  // max contour depth (largest gap between adjacent ranks)
}

// Core functions
export function toCSEG(pitches: number[]): CSEG;
export function comMatrix(cseg: CSEG): COMMatrix;
export function contourAdjacencySeries(cseg: CSEG): ('+' | '-' | '0')[];
export function contourInversion(cseg: CSEG): CSEG;
export function contourRetrograde(cseg: CSEG): CSEG;
export function contourRetrogradeInversion(cseg: CSEG): CSEG;
export function isContourPalindrome(cseg: CSEG): boolean;
export function contourSimilarity(a: CSEG, b: CSEG): number;  // CSIM [0,1]
export function contourDepth(cseg: CSEG): number;
export function contourClass(cseg: CSEG): string;  // canonical label e.g. "c4-003"
```

**Modify:** `packages/core/src/index.ts` — add contour exports

### Package: `packages/ui`

**Create:** `packages/ui/src/pages/MelodyPage.tsx`
- Piano-roll sequencer (SVG grid, click to place notes)
- Record-from-mic toggle (reuses `useMicPitchDetect` hook)
- Contour diagram visualization (directional arrows + line graph)
- CSEG label + CAS display
- Phrase segmentation markers
- Related contours panel (inversion, retrograde, RI)
- Comparison mode: input second melody, show CSIM score

**Create:** `packages/ui/src/components/ContourDiagram.tsx`
- SVG line chart of CSEG with numbered nodes
- Color-coded rising (green) / falling (red) / same (gray) segments
- Optional: animate playback cursor

**Create:** `packages/ui/src/components/PianoRollInput.tsx`
- Grid: x-axis = time slots (1–64), y-axis = chromatic pitches (C3–C6)
- Click to place/remove notes
- Drag to reorder
- Clear/randomize buttons

**Create:** `packages/ui/src/components/ContourCompare.tsx`
- Side-by-side contour diagrams
- COM matrix heatmap
- CSIM similarity score gauge

**Modify:** `packages/ui/src/App.tsx` — add `melody` route + nav link

**Modify:** `packages/ui/src/pages/LiveDetectionPage.tsx` — add "Contour Mode" toggle that preserves note order and displays contour in real time

### Package: `packages/analyzer`

**Create:** `packages/analyzer/src/contour/routes.ts`
```
POST /api/contour/analyze  — single melody analysis
POST /api/contour/compare  — two-melody comparison
POST /api/contour/batch     — Research tier: array of melodies → similarity matrix
```

**Modify:** `packages/analyzer/src/index.ts` — mount contourRouter
**Modify:** `packages/analyzer/src/auth/middleware.ts` — add contour rate limits

### Database

No schema changes. Contour analysis is stateless (compute-only).

## Tier Gating

| Feature | Free | Pro | Research |
|---------|------|-----|----------|
| Manual note input | 12 notes max | 64 notes | Unlimited |
| Mic contour recording | — | Yes (60s) | Yes (5min) |
| Phrase segmentation | — | Yes | Yes |
| Contour comparison | 1 pair | Unlimited | Batch matrix |
| CSV/JSON export | — | — | Yes |
| API access | 5 req/day | 100 req/day | 1000 req/day |

## Effort Estimate

- Core math library: ~3 hours
- UI page + components: ~5 hours
- API routes: ~1 hour
- Live Detection integration: ~1 hour
- **Total: ~10 hours**

## Dependencies

- None new — reuses existing pitch-detect pipeline, Web Audio, and SVG rendering
- Morris (1987) contour theory papers for algorithm reference (already in public domain)
