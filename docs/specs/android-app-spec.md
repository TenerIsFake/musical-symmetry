# Musical Symmetry — Android App Spec

## Overview

A native Android app bringing the Musical Symmetry Toolkit to phones and tablets. Interactive pitch-class exploration, file analysis, and real-time microphone pitch detection — fully offline.

## Target

- **Platform:** Android 10+ (API 29+), phone and tablet
- **Language:** Kotlin 2.0+
- **UI:** Jetpack Compose (Material 3, dynamic color)
- **Architecture:** MVI (Model-View-Intent) with Kotlin Coroutines + Flow
- **Distribution:** Google Play (free, no IAP initially)

---

## Core Engine Port

### Option A: Native Kotlin (recommended)

Port `@musical-symmetry/core` to a Kotlin module (`core`). The math is pure functions over integers mod 12 — maps cleanly to Kotlin value classes and sealed types.

**Why native:**
- Zero runtime dependency (no JS engine or WebView)
- Kotlin/Native potential for future KMP (Kotlin Multiplatform) sharing with iOS
- Full offline capability
- Compose previews work with native types
- Oboe library for low-latency audio (~10ms vs ~100ms in WebView)

**Effort:** ~3 days. Type mapping:

| TypeScript | Kotlin |
|-----------|--------|
| `PitchClass` (0-11) | `@JvmInline value class PitchClass(val value: Int)` |
| `SymmetryAnalysis` | `data class SymmetryAnalysis(...)` |
| `Chord` | `data class Chord(...)` |
| `classify(pcs)` | `SymmetryAnalyzer.classify(pcs: Set<PitchClass>)` |
| `allFirstOrder(chord)` | `PlrEngine.firstOrder(chord: Chord)` |
| `voiceLeadingDistance(a, b)` | `VoiceLeading.distance(a: List<PitchClass>, b: List<PitchClass>)` |
| `generalizedVoiceLeading(a, b)` | `VoiceLeading.generalized(a: List<PitchClass>, b: List<PitchClass>)` |

**Test strategy:** Load `test-vectors.json` from assets. Run identical inputs through both engines, compare outputs.

### Option B: WebView Wrapper

Embed the Vite build in a WebView. Bridge for mic access.

**Why not:** High audio latency, no offline file analysis, feels non-native, Play Store policy risks for "thin wrappers."

---

## App Structure

### Screen 1: Classifier (main)

Interactive pitch-class selector with real-time symmetry analysis.

**UI Components (Compose):**
- **Piano keyboard** (horizontally scrollable, Compose Canvas)
  - Tap to toggle pitch classes
  - Selected keys animate green with haptic feedback
  - Supports multi-touch for chord input
- **Symmetry card** (LazyColumn item)
  - Group name, Mulliken label, stabilizer order
  - Interval vector as colored circles
  - Character table as compact grid
  - Maximally even / Myhill / palindrome chips (Material 3 FilterChip)
  - Molecular analog card (point group ↔ molecule)
- **Chord panel** (when 3+ notes selected)
  - Root + quality
  - PLR progressions as horizontal pager (HorizontalPager)
  - Tap suggestion → play + navigate
- **Orbit diagram** (Compose Canvas)
  - Animated polygon on pitch-class clock
  - Dashed symmetry axes
- **Tonnetz** (Compose Canvas with transformGestureDetector)
  - Pinch-zoom, pan
  - Current chord highlighted

**Gestures:**
- Long-press progression card → play full path
- Double-tap orbit → show group info bottom sheet
- Shake-to-clear (SensorManager accelerometer)

### Screen 2: Analyzer

Upload MIDI/MusicXML/WAV → symmetry timeline.

**Flow:**
1. System file picker (ActivityResultContracts.OpenDocument)
2. Parse file natively
3. Display timeline (Compose + Vico chart library or Canvas)
4. Tap bar → slice detail bottom sheet with full analysis
5. Voice-leading distance displayed as connecting line thickness

**File parsing:**
- **MIDI:** `javax.sound.midi` (available on Android) or lightweight Kotlin parser
- **MusicXML:** `XmlPullParser` (built-in)
- **WAV/Audio:** `AudioTrack` buffer → YIN pitch detection

### Screen 3: Live Audio

Real-time microphone pitch detection.

**Architecture:**
```
AudioRecord (low-level, 2048 samples, 44100Hz)
    ↓
Kotlin Coroutine (Dispatchers.Default)
    ↓
YIN autocorrelation (manual implementation)
    ↓
StateFlow<PitchClass?> → Compose recomposition
```

**Key details:**
- Use `AudioRecord` directly (not MediaRecorder) for raw PCM access
- Buffer size: 2048 samples at 44.1kHz = ~46ms windows
- YIN in pure Kotlin (no NDK needed for this size)
- Oboe (C++ via JNI) available if lower latency needed later
- Detected notes accumulate in classifier state
- Animated waveform via Compose Canvas
- Sensitivity slider (Material 3 Slider)

**Latency target:** <30ms (AudioRecord + Kotlin YIN, no JNI)

### Screen 4: Mode Explorer

7-note scale → all modes ranked by brightness.

- Reuses `analyzeModes()` port
- Each mode row: brightness bar (LinearProgressIndicator) + palindrome chip
- Tap to hear mode (ascending/descending)
- Tap to load into classifier

### Navigation

Bottom navigation (NavigationBar) with 4 destinations + Settings gear in top app bar.

### Settings (Preferences DataStore)

- **Tuning reference:** A4 = 440Hz (415-466 slider)
- **Mic sensitivity:** Low / Medium / High
- **Notation:** Sharps vs Flats
- **Haptics:** On/Off
- **Theme:** Follow system / Dark / Light / Dynamic color

---

## Module Structure

```
musical-symmetry-android/
├── core/                              ← Pure Kotlin module (no Android deps)
│   ├── src/main/kotlin/
│   │   ├── types/
│   │   │   ├── PitchClass.kt
│   │   │   ├── Chord.kt
│   │   │   └── SymmetryAnalysis.kt
│   │   ├── analysis/
│   │   │   ├── PcSet.kt
│   │   │   ├── Symmetry.kt
│   │   │   ├── Intervals.kt
│   │   │   ├── Evenness.kt
│   │   │   ├── Mulliken.kt
│   │   │   ├── CharacterTable.kt
│   │   │   ├── Modes.kt
│   │   │   └── Classify.kt
│   │   ├── plr/
│   │   │   ├── PlrOperations.kt
│   │   │   └── Transitions.kt
│   │   ├── voiceleading/
│   │   │   └── VoiceLeading.kt
│   │   └── data/
│   │       ├── ChordTemplates.kt
│   │       └── ScaleTemplates.kt
│   └── src/test/kotlin/
│       ├── TestVectors.kt
│       ├── SymmetryTests.kt
│       └── ...
│
├── audio/                             ← Android module (audio processing)
│   ├── src/main/kotlin/
│   │   ├── PitchDetector.kt          ← YIN implementation
│   │   ├── MicEngine.kt              ← AudioRecord wrapper
│   │   ├── MidiParser.kt
│   │   ├── MusicXmlParser.kt
│   │   ├── WavParser.kt
│   │   └── AudioFileAnalyzer.kt
│   └── src/test/kotlin/
│
├── app/                               ← Compose UI
│   ├── src/main/kotlin/
│   │   ├── MainActivity.kt
│   │   ├── navigation/
│   │   │   └── AppNavigation.kt
│   │   ├── ui/
│   │   │   ├── classifier/
│   │   │   │   ├── ClassifierScreen.kt
│   │   │   │   ├── PianoKeyboard.kt
│   │   │   │   ├── SymmetryCard.kt
│   │   │   │   ├── OrbitDiagram.kt
│   │   │   │   ├── TonnetzCanvas.kt
│   │   │   │   └── ProgressionPager.kt
│   │   │   ├── analyzer/
│   │   │   │   ├── AnalyzerScreen.kt
│   │   │   │   ├── TimelineChart.kt
│   │   │   │   └── SliceDetailSheet.kt
│   │   │   ├── live/
│   │   │   │   ├── LiveAudioScreen.kt
│   │   │   │   └── WaveformCanvas.kt
│   │   │   ├── modes/
│   │   │   │   └── ModeExplorerScreen.kt
│   │   │   └── settings/
│   │   │       └── SettingsScreen.kt
│   │   ├── viewmodel/
│   │   │   ├── ClassifierViewModel.kt
│   │   │   ├── AnalyzerViewModel.kt
│   │   │   ├── LiveAudioViewModel.kt
│   │   │   └── ModeExplorerViewModel.kt
│   │   └── theme/
│   │       ├── Theme.kt
│   │       └── Type.kt
│   └── src/main/assets/
│       └── test-vectors.json
│
├── build.gradle.kts (root)
├── settings.gradle.kts
└── gradle.properties
```

---

## Implementation Phases

### Phase 1: Core + Classifier (1 week)
- Port core engine to Kotlin with test vector validation
- ClassifierScreen with piano keyboard + symmetry card
- Orbit diagram (Compose Canvas)
- No audio yet

### Phase 2: File Analysis (3-4 days)
- MIDI and MusicXML parsers
- Analyzer screen with timeline chart
- Voice-leading distance visualization
- Slice detail bottom sheet

### Phase 3: Live Audio (3-4 days)
- AudioRecord microphone input
- YIN pitch detection in Kotlin coroutine
- Live audio screen with waveform
- Sensitivity controls

### Phase 4: Polish (2-3 days)
- Tonnetz visualization with gesture transforms
- PLR progression pager with audio playback
- Mode Explorer screen
- Haptics, animations, tablet adaptive layout
- Play Store listing + screenshots

**Total estimate:** ~2.5 weeks

---

## Technical Notes

### Audio Latency

| Approach | Latency |
|----------|---------|
| AudioRecord (Java/Kotlin) | ~20-30ms |
| Oboe (C++ JNI) | ~5-10ms |
| WebView Web Audio | ~100-200ms |

Start with AudioRecord (simpler). Migrate to Oboe if users report lag.

### Kotlin Multiplatform Potential

The `core` module is pure Kotlin with no Android dependencies. It could become a KMP module shared with an iOS target (via Kotlin/Native), eliminating the need for a separate Swift port. This is a viable future path but adds complexity — start native-only.

### Voice-Leading Visualization

The timeline chart should encode voice-leading distance as line thickness between adjacent bars:
- VL=0 (static): thick solid line
- VL 1-2 (smooth): medium line
- VL 3-4 (moderate): thin line
- VL>4 (leap): dashed line

This gives an immediate visual sense of harmonic "flow."

### Offline-First

Entire app works without network. All parsing and analysis on-device. Binary size target: <15MB APK (pure Kotlin, no native libs initially).

---

## Play Store Metadata

**Name:** Musical Symmetry  
**Short description:** Analyze the mathematical symmetry hidden in music  
**Category:** Education → Music & Audio  
**Tags:** music theory, symmetry, group theory, pitch class, chord analysis, neo-riemannian, tonnetz  
**Content rating:** Everyone  
**Price:** Free  

**Full description (first paragraph):**
Explore the mathematical symmetry hidden in music. Musical Symmetry analyzes pitch-class sets using group theory — the same math that describes crystal structures and particle physics. Select notes on an interactive piano, upload MIDI files, or sing into your microphone to discover the abstract symmetry groups, Mulliken labels, voice-leading distances, and Neo-Riemannian transformations that connect chords.
