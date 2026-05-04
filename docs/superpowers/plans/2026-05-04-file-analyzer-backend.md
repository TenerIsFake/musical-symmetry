# File Analyzer Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js backend service that parses MIDI and MusicXML files, extracts pitch-class sets per beat/measure, and returns symmetry analysis timelines via a REST API.

**Architecture:** Express.js service in `packages/analyzer/` that accepts file uploads (multipart), parses them with midi-file (MIDI) and fast-xml-parser (MusicXML), segments notes into time slices (beat or measure granularity), runs `@musical-symmetry/core` classify() on each slice, and returns a JSON timeline. Also introduces ordered sequence types for future retrograde/RI analysis.

**Tech Stack:** Node.js, Express, TypeScript, midi-file, fast-xml-parser, multer (file upload), vitest

---

## File Structure

```
packages/analyzer/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              — Express server entry point
│   ├── types.ts              — TimedNote, TimeSlice, AnalysisTimeline types
│   ├── parsers/
│   │   ├── midi.ts           — Parse MIDI buffer → TimedNote[]
│   │   └── musicxml.ts       — Parse MusicXML string → TimedNote[]
│   ├── slicer.ts             — Group TimedNote[] into TimeSlice[] by beat/measure
│   ├── analyzer.ts           — Run classify() on each slice, produce AnalysisTimeline
│   └── routes.ts             — Express route handlers (/analyze endpoint)
└── tests/
    ├── midi.test.ts
    ├── musicxml.test.ts
    ├── slicer.test.ts
    ├── analyzer.test.ts
    └── fixtures/
        ├── c-major-scale.mid     — Generated programmatically in test
        └── c-major-triad.musicxml — Minimal MusicXML fixture
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `packages/analyzer/package.json`
- Create: `packages/analyzer/tsconfig.json`
- Modify: `package.json` (root workspace)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@musical-symmetry/analyzer",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@musical-symmetry/core": "file:../core",
    "express": "^4.19.0",
    "fast-xml-parser": "^4.4.0",
    "midi-file": "^1.2.4",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "tsx": "^4.11.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Add to root workspace**

Update root `package.json` workspaces array to include `"packages/analyzer"`.

- [ ] **Step 4: Install dependencies**

Run: `cd /home/tener/musical-symmetry && npm install`
Expected: Clean install, `packages/analyzer/node_modules` created with workspace link to core.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/package.json packages/analyzer/tsconfig.json package.json
git commit -m "feat(analyzer): scaffold file analyzer backend package"
```

---

## Task 2: Types

**Files:**
- Create: `packages/analyzer/src/types.ts`

- [ ] **Step 1: Create types file**

```typescript
import type { PitchClass, SymmetryAnalysis, Chord } from '@musical-symmetry/core';

export interface TimedNote {
  pitch: number;
  pitchClass: PitchClass;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  channel: number;
}

export interface TimeSlice {
  startBeat: number;
  endBeat: number;
  measureNumber: number;
  pitchClasses: PitchClass[];
  notes: TimedNote[];
}

export interface SliceAnalysis {
  slice: TimeSlice;
  analysis: SymmetryAnalysis;
  chord: Chord | null;
}

export interface AnalysisTimeline {
  filename: string;
  format: 'midi' | 'musicxml';
  temposBPM: number[];
  timeSignatures: string[];
  totalBeats: number;
  totalMeasures: number;
  slices: SliceAnalysis[];
}

export type SliceMode = 'beat' | 'measure';

export interface AnalyzeOptions {
  sliceMode: SliceMode;
  minNotesPerSlice: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/analyzer/src/types.ts
git commit -m "feat(analyzer): add TimedNote, TimeSlice, AnalysisTimeline types"
```

---

## Task 3: MIDI Parser

**Files:**
- Create: `packages/analyzer/src/parsers/midi.ts`
- Create: `packages/analyzer/tests/midi.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseMidi } from '../src/parsers/midi';

function buildMidiBuffer(): Buffer {
  // Minimal MIDI file: format 0, 1 track, 480 ticks/beat
  // Contains C4 (60), E4 (64), G4 (67) as quarter notes
  const { writeMidi } = await import('midi-file');

  const midi = {
    header: { format: 0, numTracks: 1, ticksPerBeat: 480 },
    tracks: [[
      { type: 'setTempo', deltaTime: 0, microsecondsPerBeat: 500000 },
      { type: 'timeSignature', deltaTime: 0, numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 },
      { type: 'noteOn', deltaTime: 0, channel: 0, noteNumber: 60, velocity: 80 },
      { type: 'noteOff', deltaTime: 480, channel: 0, noteNumber: 60, velocity: 0 },
      { type: 'noteOn', deltaTime: 0, channel: 0, noteNumber: 64, velocity: 80 },
      { type: 'noteOff', deltaTime: 480, channel: 0, noteNumber: 64, velocity: 0 },
      { type: 'noteOn', deltaTime: 0, channel: 0, noteNumber: 67, velocity: 80 },
      { type: 'noteOff', deltaTime: 480, channel: 0, noteNumber: 67, velocity: 0 },
      { type: 'endOfTrack', deltaTime: 0 },
    ]],
  };

  const bytes = writeMidi(midi);
  return Buffer.from(bytes);
}

describe('parseMidi', () => {
  it('extracts TimedNotes from MIDI buffer', async () => {
    const buf = await buildMidiBuffer();
    const result = parseMidi(buf);
    expect(result.notes).toHaveLength(3);
    expect(result.notes[0]!.pitchClass).toBe(0); // C
    expect(result.notes[1]!.pitchClass).toBe(4); // E
    expect(result.notes[2]!.pitchClass).toBe(7); // G
  });

  it('calculates beat positions correctly', async () => {
    const buf = await buildMidiBuffer();
    const result = parseMidi(buf);
    expect(result.notes[0]!.startBeat).toBeCloseTo(0, 5);
    expect(result.notes[1]!.startBeat).toBeCloseTo(1, 5);
    expect(result.notes[2]!.startBeat).toBeCloseTo(2, 5);
  });

  it('extracts tempo and time signature', async () => {
    const buf = await buildMidiBuffer();
    const result = parseMidi(buf);
    expect(result.temposBPM).toContain(120);
    expect(result.timeSignatures).toContain('4/4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/analyzer && npx vitest run tests/midi.test.ts`
Expected: FAIL — `parseMidi` not found

- [ ] **Step 3: Write implementation**

```typescript
import { parseMidi as parseMidiFile } from 'midi-file';
import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote } from '../types';

export interface MidiParseResult {
  notes: TimedNote[];
  temposBPM: number[];
  timeSignatures: string[];
  ticksPerBeat: number;
}

export function parseMidi(buffer: Buffer): MidiParseResult {
  const midi = parseMidiFile(new Uint8Array(buffer));
  const ticksPerBeat = midi.header.ticksPerBeat ?? 480;

  const temposBPM: number[] = [];
  const timeSignatures: string[] = [];
  const notes: TimedNote[] = [];

  for (const track of midi.tracks) {
    let tick = 0;
    const activeNotes = new Map<string, { pitch: number; startTick: number; velocity: number; channel: number }>();

    for (const event of track) {
      tick += event.deltaTime;

      if (event.type === 'setTempo') {
        temposBPM.push(Math.round(60_000_000 / event.microsecondsPerBeat));
      }

      if (event.type === 'timeSignature') {
        timeSignatures.push(`${event.numerator}/${event.denominator}`);
      }

      if (event.type === 'noteOn' && event.velocity > 0) {
        const key = `${event.channel}-${event.noteNumber}`;
        activeNotes.set(key, {
          pitch: event.noteNumber,
          startTick: tick,
          velocity: event.velocity,
          channel: event.channel,
        });
      }

      if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        const key = `${event.channel}-${event.noteNumber}`;
        const note = activeNotes.get(key);
        if (note) {
          activeNotes.delete(key);
          const durationTicks = tick - note.startTick;
          notes.push({
            pitch: note.pitch,
            pitchClass: (note.pitch % 12) as PitchClass,
            startBeat: note.startTick / ticksPerBeat,
            durationBeats: durationTicks / ticksPerBeat,
            velocity: note.velocity,
            channel: note.channel,
          });
        }
      }
    }
  }

  if (temposBPM.length === 0) temposBPM.push(120);
  if (timeSignatures.length === 0) timeSignatures.push('4/4');

  notes.sort((a, b) => a.startBeat - b.startBeat);
  return { notes, temposBPM, timeSignatures, ticksPerBeat };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/analyzer && npx vitest run tests/midi.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/parsers/midi.ts packages/analyzer/tests/midi.test.ts
git commit -m "feat(analyzer): add MIDI parser extracting TimedNotes with beat positions"
```

---

## Task 4: MusicXML Parser

**Files:**
- Create: `packages/analyzer/src/parsers/musicxml.ts`
- Create: `packages/analyzer/tests/musicxml.test.ts`
- Create: `packages/analyzer/tests/fixtures/c-major-triad.musicxml`

- [ ] **Step 1: Create test fixture**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration><type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration><type>quarter</type>
      </note>
      <note>
        <pitch><step>G</step><octave>4</octave></pitch>
        <duration>1</duration><type>quarter</type>
      </note>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>1</duration><type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>
```

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMusicXml } from '../src/parsers/musicxml';

const fixture = readFileSync(join(__dirname, 'fixtures/c-major-triad.musicxml'), 'utf-8');

describe('parseMusicXml', () => {
  it('extracts notes from MusicXML', () => {
    const result = parseMusicXml(fixture);
    expect(result.notes).toHaveLength(4);
    expect(result.notes[0]!.pitchClass).toBe(0); // C
    expect(result.notes[1]!.pitchClass).toBe(4); // E
    expect(result.notes[2]!.pitchClass).toBe(7); // G
    expect(result.notes[3]!.pitchClass).toBe(0); // C (octave 5)
  });

  it('calculates sequential beat positions', () => {
    const result = parseMusicXml(fixture);
    expect(result.notes[0]!.startBeat).toBeCloseTo(0, 5);
    expect(result.notes[1]!.startBeat).toBeCloseTo(1, 5);
    expect(result.notes[2]!.startBeat).toBeCloseTo(2, 5);
    expect(result.notes[3]!.startBeat).toBeCloseTo(3, 5);
  });

  it('extracts time signature', () => {
    const result = parseMusicXml(fixture);
    expect(result.timeSignatures).toContain('4/4');
  });
});
```

- [ ] **Step 3: Write implementation**

```typescript
import { XMLParser } from 'fast-xml-parser';
import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote } from '../types';

export interface MusicXmlParseResult {
  notes: TimedNote[];
  temposBPM: number[];
  timeSignatures: string[];
}

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

function pitchToMidi(step: string, octave: number, alter: number = 0): number {
  return (octave + 1) * 12 + STEP_TO_SEMITONE[step]! + alter;
}

export function parseMusicXml(xml: string): MusicXmlParseResult {
  const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'note' || name === 'measure' });
  const doc = parser.parse(xml);

  const notes: TimedNote[] = [];
  const temposBPM: number[] = [];
  const timeSignatures: string[] = [];

  const partwise = doc['score-partwise'];
  const parts = Array.isArray(partwise.part) ? partwise.part : [partwise.part];

  for (const part of parts) {
    const measures = Array.isArray(part.measure) ? part.measure : [part.measure];
    let currentBeat = 0;
    let divisions = 1;

    for (let mIdx = 0; mIdx < measures.length; mIdx++) {
      const measure = measures[mIdx];

      if (measure.attributes) {
        if (measure.attributes.divisions) {
          divisions = Number(measure.attributes.divisions);
        }
        if (measure.attributes.time) {
          const beats = measure.attributes.time.beats;
          const beatType = measure.attributes.time['beat-type'];
          timeSignatures.push(`${beats}/${beatType}`);
        }
      }

      if (measure.direction?.sound?.['@_tempo']) {
        temposBPM.push(Number(measure.direction.sound['@_tempo']));
      }

      const noteElements = Array.isArray(measure.note) ? measure.note : measure.note ? [measure.note] : [];

      for (const noteEl of noteElements) {
        if (noteEl.rest) {
          currentBeat += Number(noteEl.duration) / divisions;
          continue;
        }

        if (!noteEl.pitch) {
          currentBeat += Number(noteEl.duration) / divisions;
          continue;
        }

        const step = noteEl.pitch.step;
        const octave = Number(noteEl.pitch.octave);
        const alter = noteEl.pitch.alter ? Number(noteEl.pitch.alter) : 0;
        const midiPitch = pitchToMidi(step, octave, alter);
        const durationBeats = Number(noteEl.duration) / divisions;

        const isChordTone = noteEl.chord !== undefined;

        if (!isChordTone) {
          notes.push({
            pitch: midiPitch,
            pitchClass: (midiPitch % 12) as PitchClass,
            startBeat: currentBeat,
            durationBeats,
            velocity: 80,
            channel: 0,
          });
          currentBeat += durationBeats;
        } else {
          const prevStart = notes.length > 0 ? notes[notes.length - 1]!.startBeat : currentBeat;
          notes.push({
            pitch: midiPitch,
            pitchClass: (midiPitch % 12) as PitchClass,
            startBeat: prevStart,
            durationBeats,
            velocity: 80,
            channel: 0,
          });
        }
      }
    }
  }

  if (temposBPM.length === 0) temposBPM.push(120);
  if (timeSignatures.length === 0) timeSignatures.push('4/4');

  return { notes, temposBPM, timeSignatures };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/analyzer && npx vitest run tests/musicxml.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/parsers/musicxml.ts packages/analyzer/tests/musicxml.test.ts packages/analyzer/tests/fixtures/c-major-triad.musicxml
git commit -m "feat(analyzer): add MusicXML parser with pitch/beat extraction"
```

---

## Task 5: Time Slicer

**Files:**
- Create: `packages/analyzer/src/slicer.ts`
- Create: `packages/analyzer/tests/slicer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { sliceByBeat, sliceByMeasure } from '../src/slicer';
import type { TimedNote } from '../src/types';
import type { PitchClass } from '@musical-symmetry/core';

const notes: TimedNote[] = [
  { pitch: 60, pitchClass: 0, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 64, pitchClass: 4, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 67, pitchClass: 7, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 65, pitchClass: 5, startBeat: 1, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 69, pitchClass: 9, startBeat: 1, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 60, pitchClass: 0, startBeat: 1, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 67, pitchClass: 7, startBeat: 2, durationBeats: 2, velocity: 80, channel: 0 },
  { pitch: 71, pitchClass: 11, startBeat: 2, durationBeats: 2, velocity: 80, channel: 0 },
  { pitch: 62, pitchClass: 2, startBeat: 2, durationBeats: 2, velocity: 80, channel: 0 },
];

describe('sliceByBeat', () => {
  it('groups notes into 1-beat slices', () => {
    const slices = sliceByBeat(notes, 4);
    expect(slices).toHaveLength(4);
    expect(slices[0]!.pitchClasses).toEqual([0, 4, 7]);
    expect(slices[1]!.pitchClasses).toEqual([0, 5, 9]);
  });

  it('includes sustained notes in their start beat', () => {
    const slices = sliceByBeat(notes, 4);
    // Beat 2-3: G B D sustained for 2 beats
    expect(slices[2]!.pitchClasses).toEqual([2, 7, 11]);
    // Beat 3 has no new note-ons, but sustained notes carry over
    expect(slices[3]!.pitchClasses).toEqual([2, 7, 11]);
  });

  it('deduplicates pitch classes within a slice', () => {
    const slices = sliceByBeat(notes, 4);
    const pcsSet = new Set(slices[0]!.pitchClasses);
    expect(pcsSet.size).toBe(slices[0]!.pitchClasses.length);
  });
});

describe('sliceByMeasure', () => {
  it('groups all notes in a measure', () => {
    const slices = sliceByMeasure(notes, 4, 4);
    expect(slices).toHaveLength(1);
    expect(slices[0]!.pitchClasses.sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/analyzer && npx vitest run tests/slicer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote, TimeSlice } from './types';

export function sliceByBeat(notes: TimedNote[], totalBeats: number): TimeSlice[] {
  const slices: TimeSlice[] = [];

  for (let beat = 0; beat < totalBeats; beat++) {
    const sliceNotes = notes.filter(n =>
      n.startBeat < beat + 1 && n.startBeat + n.durationBeats > beat
    );

    const pcsSet = new Set(sliceNotes.map(n => n.pitchClass));
    const pitchClasses = [...pcsSet].sort((a, b) => a - b) as PitchClass[];

    slices.push({
      startBeat: beat,
      endBeat: beat + 1,
      measureNumber: Math.floor(beat / 4) + 1,
      pitchClasses,
      notes: sliceNotes,
    });
  }

  return slices;
}

export function sliceByMeasure(notes: TimedNote[], totalBeats: number, beatsPerMeasure: number): TimeSlice[] {
  const slices: TimeSlice[] = [];
  const totalMeasures = Math.ceil(totalBeats / beatsPerMeasure);

  for (let m = 0; m < totalMeasures; m++) {
    const mStart = m * beatsPerMeasure;
    const mEnd = mStart + beatsPerMeasure;

    const sliceNotes = notes.filter(n =>
      n.startBeat < mEnd && n.startBeat + n.durationBeats > mStart
    );

    const pcsSet = new Set(sliceNotes.map(n => n.pitchClass));
    const pitchClasses = [...pcsSet].sort((a, b) => a - b) as PitchClass[];

    slices.push({
      startBeat: mStart,
      endBeat: mEnd,
      measureNumber: m + 1,
      pitchClasses,
      notes: sliceNotes,
    });
  }

  return slices;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/analyzer && npx vitest run tests/slicer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/slicer.ts packages/analyzer/tests/slicer.test.ts
git commit -m "feat(analyzer): add beat and measure time slicing for note streams"
```

---

## Task 6: Analysis Pipeline

**Files:**
- Create: `packages/analyzer/src/analyzer.ts`
- Create: `packages/analyzer/tests/analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeTimeline } from '../src/analyzer';
import type { TimedNote } from '../src/types';
import type { PitchClass } from '@musical-symmetry/core';

const notes: TimedNote[] = [
  { pitch: 60, pitchClass: 0, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 64, pitchClass: 4, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 67, pitchClass: 7, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 65, pitchClass: 5, startBeat: 1, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 69, pitchClass: 9, startBeat: 1, durationBeats: 1, velocity: 80, channel: 0 },
  { pitch: 60, pitchClass: 0, startBeat: 1, durationBeats: 1, velocity: 80, channel: 0 },
];

describe('analyzeTimeline', () => {
  it('produces SliceAnalysis for each beat', () => {
    const result = analyzeTimeline(notes, {
      sliceMode: 'beat',
      minNotesPerSlice: 2,
      totalBeats: 2,
      temposBPM: [120],
      timeSignatures: ['4/4'],
      filename: 'test.mid',
      format: 'midi',
    });
    expect(result.slices).toHaveLength(2);
    expect(result.slices[0]!.analysis.abstractGroup).toBeDefined();
    expect(result.slices[0]!.chord).not.toBeNull();
  });

  it('skips slices with fewer notes than minNotesPerSlice', () => {
    const singleNote: TimedNote[] = [
      { pitch: 60, pitchClass: 0, startBeat: 0, durationBeats: 1, velocity: 80, channel: 0 },
    ];
    const result = analyzeTimeline(singleNote, {
      sliceMode: 'beat',
      minNotesPerSlice: 2,
      totalBeats: 1,
      temposBPM: [120],
      timeSignatures: ['4/4'],
      filename: 'test.mid',
      format: 'midi',
    });
    expect(result.slices).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/analyzer && npx vitest run tests/analyzer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import { classify, identifyChord } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { sliceByBeat, sliceByMeasure } from './slicer';
import type { TimedNote, SliceAnalysis, AnalysisTimeline, SliceMode } from './types';

export interface AnalyzeTimelineOptions {
  sliceMode: SliceMode;
  minNotesPerSlice: number;
  totalBeats: number;
  temposBPM: number[];
  timeSignatures: string[];
  filename: string;
  format: 'midi' | 'musicxml';
}

export function analyzeTimeline(notes: TimedNote[], options: AnalyzeTimelineOptions): AnalysisTimeline {
  const { sliceMode, minNotesPerSlice, totalBeats, temposBPM, timeSignatures, filename, format } = options;

  const beatsPerMeasure = parseInt(timeSignatures[0]?.split('/')[0] ?? '4');
  const slices = sliceMode === 'beat'
    ? sliceByBeat(notes, totalBeats)
    : sliceByMeasure(notes, totalBeats, beatsPerMeasure);

  const analyzed: SliceAnalysis[] = [];

  for (const slice of slices) {
    if (slice.pitchClasses.length < minNotesPerSlice) continue;

    const analysis = classify(slice.pitchClasses);
    const chord = slice.pitchClasses.length === 3 ? identifyChord(slice.pitchClasses) : null;

    analyzed.push({ slice, analysis, chord });
  }

  return {
    filename,
    format,
    temposBPM,
    timeSignatures,
    totalBeats,
    totalMeasures: Math.ceil(totalBeats / beatsPerMeasure),
    slices: analyzed,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/analyzer && npx vitest run tests/analyzer.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/analyzer.ts packages/analyzer/tests/analyzer.test.ts
git commit -m "feat(analyzer): add analysis pipeline running classify() on time slices"
```

---

## Task 7: Express Server + Upload Route

**Files:**
- Create: `packages/analyzer/src/routes.ts`
- Create: `packages/analyzer/src/index.ts`

- [ ] **Step 1: Create routes**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { parseMidi } from './parsers/midi';
import { parseMusicXml } from './parsers/musicxml';
import { analyzeTimeline } from './analyzer';
import type { SliceMode } from './types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const router = Router();

router.post('/analyze', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const sliceMode = (req.body.sliceMode as SliceMode) || 'beat';
    const minNotes = parseInt(req.body.minNotes) || 2;
    const filename = req.file.originalname;
    const ext = filename.split('.').pop()?.toLowerCase();

    let notes;
    let temposBPM: number[];
    let timeSignatures: string[];
    let format: 'midi' | 'musicxml';

    if (ext === 'mid' || ext === 'midi') {
      format = 'midi';
      const parsed = parseMidi(req.file.buffer);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else if (ext === 'xml' || ext === 'musicxml' || ext === 'mxl') {
      format = 'musicxml';
      const xml = req.file.buffer.toString('utf-8');
      const parsed = parseMusicXml(xml);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else {
      res.status(400).json({ error: `Unsupported file type: .${ext}. Use .mid, .midi, .xml, or .musicxml` });
      return;
    }

    if (notes.length === 0) {
      res.status(400).json({ error: 'No notes found in file' });
      return;
    }

    const totalBeats = Math.ceil(Math.max(...notes.map(n => n.startBeat + n.durationBeats)));

    const timeline = analyzeTimeline(notes, {
      sliceMode,
      minNotesPerSlice: minNotes,
      totalBeats,
      temposBPM,
      timeSignatures,
      filename,
      format,
    });

    res.json(timeline);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Parse error: ${message}` });
  }
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'musical-symmetry-analyzer' });
});
```

- [ ] **Step 2: Create server entry point**

```typescript
import express from 'express';
import { router } from './routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3010');

app.use(express.json());
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app };
```

- [ ] **Step 3: Commit**

```bash
git add packages/analyzer/src/routes.ts packages/analyzer/src/index.ts
git commit -m "feat(analyzer): add Express server with /api/analyze upload endpoint"
```

---

## Task 8: Integration Test

**Files:**
- Create: `packages/analyzer/tests/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseMidi } from '../src/parsers/midi';
import { parseMusicXml } from '../src/parsers/musicxml';
import { analyzeTimeline } from '../src/analyzer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { writeMidi } from 'midi-file';

describe('end-to-end: MIDI → analysis', () => {
  it('analyzes a C major arpeggio MIDI file', () => {
    const midi = {
      header: { format: 0 as const, numTracks: 1, ticksPerBeat: 480 },
      tracks: [[
        { type: 'setTempo' as const, deltaTime: 0, microsecondsPerBeat: 500000 },
        { type: 'timeSignature' as const, deltaTime: 0, numerator: 4, denominator: 4, metronome: 24, thirtyseconds: 8 },
        { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 60, velocity: 80 },
        { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 64, velocity: 80 },
        { type: 'noteOn' as const, deltaTime: 0, channel: 0, noteNumber: 67, velocity: 80 },
        { type: 'noteOff' as const, deltaTime: 480, channel: 0, noteNumber: 60, velocity: 0 },
        { type: 'noteOff' as const, deltaTime: 0, channel: 0, noteNumber: 64, velocity: 0 },
        { type: 'noteOff' as const, deltaTime: 0, channel: 0, noteNumber: 67, velocity: 0 },
        { type: 'endOfTrack' as const, deltaTime: 0 },
      ]],
    };

    const bytes = writeMidi(midi);
    const buffer = Buffer.from(bytes);
    const parsed = parseMidi(buffer);

    expect(parsed.notes).toHaveLength(3);

    const timeline = analyzeTimeline(parsed.notes, {
      sliceMode: 'beat',
      minNotesPerSlice: 3,
      totalBeats: 1,
      temposBPM: parsed.temposBPM,
      timeSignatures: parsed.timeSignatures,
      filename: 'test.mid',
      format: 'midi',
    });

    expect(timeline.slices).toHaveLength(1);
    expect(timeline.slices[0]!.analysis.intervalVector).toEqual([0, 0, 1, 1, 1, 0]);
    expect(timeline.slices[0]!.chord).not.toBeNull();
    expect(timeline.slices[0]!.chord!.quality).toBe('major');
  });
});

describe('end-to-end: MusicXML → analysis', () => {
  it('analyzes C major triad fixture', () => {
    const xml = readFileSync(join(__dirname, 'fixtures/c-major-triad.musicxml'), 'utf-8');
    const parsed = parseMusicXml(xml);

    const timeline = analyzeTimeline(parsed.notes, {
      sliceMode: 'measure',
      minNotesPerSlice: 2,
      totalBeats: 4,
      temposBPM: parsed.temposBPM,
      timeSignatures: parsed.timeSignatures,
      filename: 'c-major-triad.musicxml',
      format: 'musicxml',
    });

    expect(timeline.slices).toHaveLength(1);
    expect(timeline.slices[0]!.analysis.abstractGroup).toBeDefined();
    expect(timeline.format).toBe('musicxml');
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd packages/analyzer && npx vitest run`
Expected: All test files pass (midi, musicxml, slicer, analyzer, integration)

- [ ] **Step 3: Commit**

```bash
git add packages/analyzer/tests/integration.test.ts
git commit -m "test(analyzer): add end-to-end integration tests for MIDI and MusicXML pipelines"
```

---

## Task 9: Docker + Deploy

**Files:**
- Create: `packages/analyzer/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/analyzer/package.json packages/analyzer/

RUN npm install --workspaces

COPY packages/core/ packages/core/
COPY packages/analyzer/ packages/analyzer/

EXPOSE 3010
CMD ["npx", "tsx", "packages/analyzer/src/index.ts"]
```

- [ ] **Step 2: Add to docker-compose.yml**

```yaml
  musical-symmetry-analyzer:
    build:
      context: .
      dockerfile: packages/analyzer/Dockerfile
    container_name: musical-symmetry-analyzer
    ports:
      - "3010:3010"
    environment:
      - PORT=3010
    restart: unless-stopped
    labels:
      - "com.centurylinklabs.watchtower.enable=false"
```

- [ ] **Step 3: Build and deploy**

Run: `docker compose build musical-symmetry-analyzer && docker compose up -d musical-symmetry-analyzer`
Expected: Container starts, health check returns OK.

Verify: `curl http://localhost:3010/api/health`
Expected: `{"status":"ok","service":"musical-symmetry-analyzer"}`

- [ ] **Step 4: Commit**

```bash
git add packages/analyzer/Dockerfile docker-compose.yml
git commit -m "feat(analyzer): add Docker deployment on port 3010"
```

---

## Summary of API

**POST `/api/analyze`** (multipart form-data)
- `file`: MIDI (.mid/.midi) or MusicXML (.xml/.musicxml) file
- `sliceMode`: `"beat"` | `"measure"` (default: `"beat"`)
- `minNotes`: minimum notes per slice to analyze (default: `2`)

Returns: `AnalysisTimeline` JSON with symmetry analysis per time slice.

**GET `/api/health`** — Service health check.
