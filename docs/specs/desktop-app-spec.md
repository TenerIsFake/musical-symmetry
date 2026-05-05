# Musical Symmetry — Desktop App Spec

## Overview

A cross-platform desktop application (macOS, Windows, Linux) that packages the Musical Symmetry web UI as a native app with enhanced capabilities: drag-and-drop file analysis, system audio capture, MIDI device input, and batch processing of entire music libraries.

## Target

- **Platforms:** macOS 12+, Windows 10+, Linux (AppImage/deb/rpm)
- **Framework:** Tauri 2.x (Rust backend, existing web frontend)
- **Language:** Rust (backend/system), TypeScript (frontend — reuse packages/ui)
- **Distribution:** GitHub Releases + Homebrew (macOS) + winget (Windows) + Flathub (Linux)
- **License:** MIT

---

## Why Tauri (not Electron)

| Factor | Tauri | Electron |
|--------|-------|----------|
| Binary size | ~5-10MB | ~150MB |
| RAM usage | ~30-50MB | ~200MB+ |
| Startup time | <1s | 2-3s |
| System audio | Via CPAL crate | Via Chromium (limited) |
| MIDI access | Via midir crate | Via Web MIDI (browser sandbox) |
| Auto-update | Built-in | Squirrel/electron-updater |
| Security | Sandboxed by default | Full Node.js access |

Tauri uses the system WebView (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) so there's no bundled browser.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Tauri Shell                        │
│  ┌──────────────────────────────────────────────┐   │
│  │        packages/ui (Vite build)               │   │
│  │  React + D3 + Tailwind (existing web UI)      │   │
│  └────────────────────┬─────────────────────────┘   │
│                       │ invoke()                      │
│  ┌────────────────────▼─────────────────────────┐   │
│  │           Rust Backend (src-tauri/)            │   │
│  │                                               │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │  Audio  │ │   MIDI   │ │  File System │  │   │
│  │  │  CPAL   │ │  midir   │ │  (native fs) │  │   │
│  │  └────┬────┘ └────┬─────┘ └──────┬───────┘  │   │
│  │       │            │              │           │   │
│  │  ┌────▼────────────▼──────────────▼───────┐  │   │
│  │  │        Core Engine (Rust port)          │  │   │
│  │  │   OR: call into packages/core via       │  │   │
│  │  │   wasm-bindgen (compile TS→Wasm)        │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Engine Strategy

**Option A: Keep TypeScript core in frontend (recommended for v1)**
- The existing `@musical-symmetry/core` runs in the WebView — no port needed
- Rust backend handles only system-level operations (audio, MIDI, filesystem)
- Frontend sends raw note data to the existing classify/analyze pipeline
- Ship faster, zero porting effort

**Option B: Rust port (v2 optimization)**
- Port core to Rust for batch processing speed (100x for library scanning)
- Keep frontend TypeScript for interactive UI
- Backend exposes `tauri::command` functions that call Rust engine
- Worth it only when batch-processing thousands of files

**Recommendation:** Option A for initial release, Option B as performance optimization when users request batch analysis.

---

## Features Beyond Web Version

### 1. Native File System Integration

- **Drag-and-drop** files onto the app window (Tauri's native drag handler)
- **Batch analysis:** Select a folder of MIDI/MusicXML/WAV files → process all, generate report
- **File watcher:** Monitor a folder, auto-analyze new files (for producers)
- **Export:** Save analysis as JSON, CSV, or PDF report

### 2. System Audio Capture

Capture audio from any app (Spotify, DAW, YouTube) — not just microphone.

**macOS:** Virtual audio device via `BlackHole` or `ScreenCaptureKit` (macOS 13+)  
**Windows:** WASAPI loopback capture (built into Windows)  
**Linux:** PulseAudio/PipeWire monitor source

```rust
// Rust backend (CPAL)
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

#[tauri::command]
fn list_audio_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    host.input_devices()
        .map(|d| AudioDevice { name: d.name().unwrap_or_default() })
        .collect()
}

#[tauri::command]
fn start_capture(device_name: String, window: tauri::Window) {
    // Stream PCM → YIN → emit "pitch-detected" event to frontend
}
```

### 3. MIDI Device Input

Connect a MIDI keyboard → notes appear directly in the classifier.

```rust
use midir::{MidiInput, MidiInputConnection};

#[tauri::command]
fn list_midi_inputs() -> Vec<String> {
    let midi_in = MidiInput::new("musical-symmetry").unwrap();
    midi_in.ports().iter()
        .map(|p| midi_in.port_name(p).unwrap_or_default())
        .collect()
}

#[tauri::command]
fn connect_midi(port_name: String, window: tauri::Window) {
    // Parse MIDI note-on/off → emit to frontend
}
```

### 4. Batch Library Analysis

Scan an entire music collection and generate a "symmetry profile" database.

**Output:** SQLite database with per-file analysis:
```sql
CREATE TABLE analyses (
    id INTEGER PRIMARY KEY,
    filepath TEXT,
    filename TEXT,
    total_slices INTEGER,
    dominant_group TEXT,
    mean_voice_leading REAL,
    group_distribution JSON,
    analyzed_at TIMESTAMP
);
```

**UI:** Searchable table with sorting (by group, VL distance, etc.), filter by symmetry type, click to open detail view.

### 5. DAW Integration (future)

- **VST3/AU plugin:** Real-time symmetry display inside a DAW
- **OSC output:** Stream analysis data to Max/MSP, Pure Data, or TouchDesigner
- **MIDI output:** Generate PLR suggestions as MIDI notes routed to a synth

---

## Desktop-Specific UI Enhancements

### Multi-window Support
- Main classifier window
- Detachable Tonnetz/orbit diagrams (for second monitor)
- Floating timeline during file playback

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `1-9, 0, -, =` | Toggle pitch classes C through B |
| `Space` | Play current chord |
| `Cmd/Ctrl + O` | Open file for analysis |
| `Cmd/Ctrl + Shift + O` | Open folder for batch |
| `M` | Toggle microphone |
| `Cmd/Ctrl + E` | Export analysis |
| `Esc` | Clear selection |

### System Tray
- Mini mode: sits in system tray, always listening to system audio
- Shows current detected chord as tray icon tooltip
- Click to expand full UI

---

## Project Structure

```
musical-symmetry-desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── audio/
│   │   │   ├── mod.rs
│   │   │   ├── capture.rs        ← CPAL system audio
│   │   │   ├── pitch_detect.rs   ← YIN in Rust
│   │   │   └── devices.rs        ← enumerate audio devices
│   │   ├── midi/
│   │   │   ├── mod.rs
│   │   │   ├── device.rs         ← midir MIDI input
│   │   │   └── parser.rs         ← MIDI file parsing (for batch)
│   │   ├── fs/
│   │   │   ├── mod.rs
│   │   │   ├── watcher.rs        ← folder monitoring
│   │   │   └── batch.rs          ← batch analysis orchestration
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   └── schema.rs         ← SQLite for batch results
│   │   └── commands.rs            ← all #[tauri::command] functions
│   └── icons/
│
├── src/                           ← Frontend (reuses packages/ui components)
│   ├── App.tsx                    ← Extended with desktop-specific features
│   ├── components/
│   │   ├── BatchPanel.tsx         ← Batch analysis UI
│   │   ├── MidiDeviceSelector.tsx
│   │   ├── AudioDeviceSelector.tsx
│   │   └── LibraryView.tsx        ← SQLite query results
│   └── hooks/
│       ├── useTauriAudio.ts       ← invoke() wrappers
│       ├── useTauriMidi.ts
│       └── useTauriFs.ts
│
├── package.json
├── vite.config.ts
└── README.md
```

---

## Implementation Phases

### Phase 1: Package Web UI (3 days)
- Set up Tauri project wrapping existing packages/ui build
- Basic window management, menu bar, keyboard shortcuts
- Drag-and-drop file → send to existing analyzer API logic (bundled in-process)
- Build for macOS + Windows + Linux

### Phase 2: Native Audio (4-5 days)
- CPAL audio capture (mic + system loopback)
- YIN pitch detection in Rust (high performance for real-time)
- Audio device selector in UI
- System tray mini-mode

### Phase 3: MIDI Device Input (2-3 days)
- midir integration
- MIDI device selector
- Note-on/off → pitch class toggle in classifier
- MIDI learn mode (hold a chord on keyboard → instant analysis)

### Phase 4: Batch Processing (4-5 days)
- Folder scanner (recursive MIDI/MusicXML/WAV detection)
- Parallel analysis (Rayon for multi-core)
- SQLite storage
- Library view UI with search/filter/sort
- Export to CSV/JSON

### Phase 5: Polish (2-3 days)
- Multi-window support
- Auto-updater (Tauri built-in)
- App icons, DMG/MSI/AppImage packaging
- GitHub Releases CI pipeline

**Total estimate:** ~3 weeks

---

## Technical Notes

### Performance: Rust YIN vs TypeScript YIN

| Implementation | 2048-sample frame | Full song (3min @ 60fps) |
|---------------|-------------------|--------------------------|
| TypeScript (browser) | ~2-5ms | ~18-45 seconds |
| Rust (CPAL + SIMD) | ~0.05ms | ~0.5 seconds |

The 40-100x speedup means batch processing a 1000-file library takes minutes, not hours.

### Cross-Platform Audio Capture

| Platform | System Audio Method | Mic Method |
|----------|-------------------|------------|
| macOS | ScreenCaptureKit / BlackHole | CoreAudio via CPAL |
| Windows | WASAPI Loopback | WASAPI via CPAL |
| Linux | PipeWire/PulseAudio monitor | ALSA/PipeWire via CPAL |

System audio capture requires explicit user permission on macOS 13+ (ScreenCaptureKit prompt). Windows WASAPI loopback requires no special permissions. Linux varies by audio server.

### Binary Sizes (estimated)

| Platform | Binary | With Rust audio |
|----------|--------|-----------------|
| macOS (universal) | ~8MB | ~12MB |
| Windows (x64) | ~6MB | ~10MB |
| Linux (x64) | ~7MB | ~11MB |

Compare to Electron equivalent: ~150MB.

### Auto-Update

Tauri's built-in updater checks a JSON manifest on GitHub Releases:
```json
{
  "version": "1.2.0",
  "platforms": {
    "darwin-aarch64": { "url": "https://github.com/.../releases/download/v1.2.0/app.app.tar.gz" },
    "windows-x86_64": { "url": "https://github.com/.../releases/download/v1.2.0/app.msi.zip" }
  }
}
```

---

## Distribution

| Platform | Format | Channel |
|----------|--------|---------|
| macOS | .dmg (universal binary) | GitHub Releases + Homebrew tap |
| Windows | .msi installer | GitHub Releases + winget |
| Linux | AppImage + .deb + .rpm | GitHub Releases + Flathub |

**CI:** GitHub Actions matrix build (macos-latest, windows-latest, ubuntu-latest) on every tag push.
