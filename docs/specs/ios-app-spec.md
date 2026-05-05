# Musical Symmetry — iOS App Spec

## Overview

A native iOS app that brings the Musical Symmetry Toolkit to iPhone/iPad. Users can explore pitch-class set symmetry interactively, analyze music files, and detect pitches in real-time from the device microphone — all offline, no server required.

## Target

- **Platform:** iOS 17+, iPhone and iPad
- **Language:** Swift 5.9+, SwiftUI
- **Architecture:** MVVM with Swift Concurrency (async/await, actors)
- **Distribution:** App Store (free, no IAP initially)

---

## Core Engine Port

### Option A: Native Swift (recommended)

Port `@musical-symmetry/core` to a Swift package (`MusicalSymmetryCore`). The math is pure functions over integers mod 12 — ideal for Swift value types.

**Why native:**
- Zero runtime dependency (no JS engine)
- Accelerate framework for vectorized pitch detection (10-50x faster than JS)
- Full offline capability
- SwiftUI previews work with native types
- Core Audio for low-latency mic input (~5ms vs ~50ms in WebView)

**Effort:** ~3 days. The core is ~500 lines of pure functions. Type mapping:

| TypeScript | Swift |
|-----------|-------|
| `PitchClass` (0-11 literal union) | `enum PitchClass: Int, CaseIterable` |
| `SymmetryAnalysis` | `struct SymmetryAnalysis` |
| `Chord` | `struct Chord` |
| `classify(pcs)` | `SymmetryAnalyzer.classify(_ pcs: Set<PitchClass>)` |
| `allFirstOrder(chord)` | `PLREngine.firstOrder(from: chord)` |

**Test strategy:** Port `test-vectors.json` from the TypeScript project. Run identical inputs through both engines, compare outputs. This is already set up — the test vectors file was created for exactly this purpose.

### Option B: WebView Wrapper (faster to ship, worse UX)

Embed the Vite-built UI in a WKWebView. Add a Swift bridge for microphone access.

**Why not:** 50ms+ audio latency, no offline file analysis, feels non-native, App Store reviewers flag "just a website" apps.

**Recommendation:** Option A. The math port is straightforward and the UX difference is dramatic.

---

## App Structure

### Tab 1: Classifier (main screen)

Interactive pitch-class selector → real-time symmetry analysis.

**UI Components:**
- **Piano roll** (horizontal scrollable, 2+ octaves for iPad, 1 octave for iPhone)
  - Tap to toggle pitch classes
  - Selected keys glow green with haptic feedback
- **Symmetry card** (below piano)
  - Group name (e.g., "C₁"), Mulliken label, stabilizer order
  - Interval vector as colored dots
  - Character table as a mini grid (±1 with red/green)
  - Maximally even / Myhill / palindrome badges
- **Chord identifier** (when 3 notes selected)
  - Root + quality
  - PLR progressions as swipeable cards
  - Tap a suggestion to hear it + navigate to its analysis
- **Orbit diagram** (pitch-class clock)
  - SwiftUI Canvas or SpriteKit
  - Animated polygon connecting selected PCs
  - Dashed axes for inversional symmetry
- **Tonnetz view** (pinch-to-zoom, drag-to-pan)
  - SceneKit or SwiftUI Canvas
  - Current chord = green triangle, target = yellow

**Gestures:**
- Long-press a suggestion card → play the progression (current → target)
- 3D Touch / Haptic Touch on orbit diagram → show group info popover
- Shake to clear selection

### Tab 2: Analyzer

Upload or open MIDI/MusicXML/WAV files → symmetry timeline.

**Flow:**
1. Document picker (UTType: .midi, .musicXML, .wav, .audio)
2. Parse file using native Swift parsers
3. Display timeline as a scrollable bar chart (SwiftUI Charts framework)
4. Tap a bar → slice detail sheet with full SymmetryAnalysis
5. Pinch to zoom timeline, scroll to scrub

**File parsing:**
- **MIDI:** Use `AVMIDIPlayer` or lightweight Swift MIDI parser (AudioKit's `MIDIFile`)
- **MusicXML:** `XMLParser` (Foundation) — same logic as the TS parser
- **WAV/Audio:** `AVAudioFile` → `AVAudioPCMBuffer` → pitch detection

### Tab 3: Live Audio

Real-time microphone pitch detection → auto-populate classifier.

**Architecture:**
```
AVAudioEngine → inputNode tap → Float32 buffer
    ↓
YIN pitch detection (Accelerate vDSP)
    ↓
PitchClass → @Published var detectedPC
    ↓
SwiftUI updates classifier state
```

**Key details:**
- Use `AVAudioEngine` with an input node tap (buffer size 2048, 44.1kHz)
- YIN autocorrelation via `vDSP_dotpr` and `vDSP_measqv` for SIMD acceleration
- Detected pitches accumulate in the classifier (same TOGGLE_PC logic)
- Visual: animated waveform + current note display
- Configurable sensitivity threshold (slider)
- "Lock" button: freeze current detection as the selected set

**Latency target:** <20ms from sound to UI update (achievable with Core Audio)

### Tab 4: Mode Explorer

Select a 7-note scale → see all modes ranked by brightness.

- Reuses `analyzeModes()` port
- Each mode row shows brightness bar + palindrome badge
- Tap to hear the mode (ascending + descending)
- Tap to switch the classifier to that mode's pitch classes

### Settings

- **Tuning reference:** A4 = 440Hz (adjustable 415-466)
- **Mic sensitivity:** Low / Medium / High
- **Notation:** Sharps vs Flats preference
- **Haptics:** On/Off
- **Color scheme:** Follow system / Dark / Light

---

## Swift Package Structure

```
MusicalSymmetry/
├── MusicalSymmetryCore/          ← Swift Package (pure logic, no UIKit)
│   ├── Sources/
│   │   ├── Types.swift           ← PitchClass enum, Chord, SymmetryAnalysis
│   │   ├── PCSet.swift           ← mod12, transpose, invert, normalize
│   │   ├── Symmetry.swift        ← stabilizer, axes, abstractGroup
│   │   ├── Intervals.swift       ← intervalVector, myhillProperty
│   │   ├── Evenness.swift        ← isMaximallyEven
│   │   ├── Mulliken.swift        ← mullikenLabel
│   │   ├── CharacterTable.swift  ← characterTableEntry
│   │   ├── PLR.swift             ← applyP, applyL, applyR, allFirstOrder...
│   │   ├── VoiceLeading.swift    ← voiceLeadingDistance
│   │   ├── Scales.swift          ← SCALE_TEMPLATES, findBestScale
│   │   ├── Chords.swift          ← CHORD_TEMPLATES, identifyChord
│   │   ├── Modes.swift           ← analyzeModes, brightnessIndex
│   │   ├── Transitions.swift     ← classifyTransition, findPLRPath
│   │   └── Classify.swift        ← convenience classify() function
│   └── Tests/
│       ├── TestVectors.swift     ← Load test-vectors.json, compare outputs
│       ├── PCSetTests.swift
│       ├── SymmetryTests.swift
│       └── ...
│
├── MusicalSymmetryAudio/         ← Swift Package (audio processing)
│   ├── Sources/
│   │   ├── PitchDetector.swift   ← YIN via Accelerate
│   │   ├── MicEngine.swift       ← AVAudioEngine wrapper
│   │   ├── MIDIParser.swift      ← MIDI file → [TimedNote]
│   │   ├── MusicXMLParser.swift  ← MusicXML → [TimedNote]
│   │   └── AudioFileParser.swift ← AVAudioFile → pitch detection
│   └── Tests/
│
├── MusicalSymmetryApp/           ← SwiftUI App
│   ├── App.swift
│   ├── ContentView.swift         ← TabView shell
│   ├── Views/
│   │   ├── ClassifierView.swift
│   │   ├── PianoKeyboardView.swift
│   │   ├── SymmetryCardView.swift
│   │   ├── OrbitDiagramView.swift
│   │   ├── TonnetzView.swift
│   │   ├── ProgressionCardView.swift
│   │   ├── AnalyzerView.swift
│   │   ├── TimelineChartView.swift
│   │   ├── LiveAudioView.swift
│   │   ├── ModeExplorerView.swift
│   │   └── SettingsView.swift
│   ├── ViewModels/
│   │   ├── ClassifierViewModel.swift
│   │   ├── AnalyzerViewModel.swift
│   │   ├── LiveAudioViewModel.swift
│   │   └── ModeExplorerViewModel.swift
│   └── Resources/
│       ├── test-vectors.json     ← Copied from TS project
│       └── Assets.xcassets
```

---

## Implementation Phases

### Phase 1: Core + Classifier (1 week)
- Port `MusicalSymmetryCore` to Swift with test vector validation
- Build ClassifierView with piano keyboard + symmetry card
- Orbit diagram (SwiftUI Canvas)
- No audio yet

### Phase 2: File Analysis (3-4 days)
- MIDI and MusicXML parsers
- Analyzer tab with timeline chart (Swift Charts)
- Slice detail view

### Phase 3: Live Audio (3-4 days)
- AVAudioEngine mic input
- YIN pitch detection with Accelerate
- Live audio tab
- Sensitivity controls

### Phase 4: Polish (2-3 days)
- Tonnetz visualization
- PLR progression cards with audio playback
- Mode Explorer tab
- Haptics, animations, iPad layout
- App Store screenshots + metadata

**Total estimate:** ~2.5 weeks

---

## Technical Notes

### Pitch Detection Performance

The YIN algorithm on a 2048-sample buffer:
- **JavaScript (browser):** ~2-5ms per frame
- **Swift + Accelerate:** ~0.1-0.3ms per frame (vDSP SIMD)

This 10x speedup means we can run detection at 60fps without frame drops, enabling smooth real-time visualization.

### Offline-First

The entire app works without network. No API calls, no server dependency. The core engine and all parsers run natively on-device. This is a key advantage over the web version.

### Shared Test Vectors

The `test-vectors.json` file in `packages/core/` contains input/output pairs for every core function. The iOS test suite loads this file and verifies the Swift port produces identical results. This is the single source of truth for correctness across both platforms.

### Audio Playback

Use `AVAudioEngine` with `AVAudioPlayerNode` and programmatic tone generation (sine/triangle oscillator) rather than sampled instruments. Keeps the app small (<5MB) and matches the web version's Tone.js approach.

---

## App Store Metadata

**Name:** Musical Symmetry  
**Subtitle:** Pitch-Class Set Analyzer  
**Category:** Music → Music Education  
**Keywords:** music theory, symmetry, pitch class, group theory, neo-riemannian, tonnetz, chord analysis, interval vector, set theory  
**Age Rating:** 4+  
**Price:** Free  

**Description (first paragraph):**
Explore the mathematical symmetry hidden in music. Musical Symmetry analyzes pitch-class sets using group theory — the same math that describes crystal structures and particle physics. Select notes on an interactive piano, upload MIDI files, or sing into your microphone to discover the abstract symmetry groups, Mulliken labels, and Neo-Riemannian transformations that connect chords.
