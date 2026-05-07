/**
 * Unified export dispatcher for Sketchpad sketches.
 * Converts sketch data to MIDI, MusicXML, or Lilypond and triggers download.
 */

import { multiTrackToMidi } from './midi-writer';
import { toMusicXML } from './musicxml-writer';
import { toLilypond } from './export-academic';
import type { PitchClass } from '@musical-symmetry/core';

export interface SketchData {
  name: string;
  tempo: number;
  timeSigTop: number;
  timeSigBottom: number;
  bars: number;
  melodyData: { pc: number; step: number }[];
  rhythmData: (0 | 1)[];
  chordData: { pcs: number[]; name: string; bar: number }[];
}

// One step = one sixteenth note at 4 steps/beat
const STEPS_PER_BEAT = 4;

// COMMON_CHORDS label → pcs lookup (mirrors SketchpadPage)
const COMMON_CHORD_PCS: Record<string, number[]> = {
  'C maj': [0, 4, 7],
  'D maj': [2, 6, 9],
  'E maj': [4, 8, 11],
  'F maj': [5, 9, 0],
  'G maj': [7, 11, 2],
  'A maj': [9, 1, 4],
  'C min': [0, 3, 7],
  'D min': [2, 5, 9],
  'E min': [4, 7, 11],
  'A min': [9, 0, 4],
  'G7':    [7, 11, 2, 5],
  'Cdim':  [0, 3, 6],
};

// ---- Download helper ----

function downloadFile(content: string | Blob, filename: string, mimeType?: string): void {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType ?? 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Helpers to build note arrays ----

/** Convert sketch melody data to a list of {midiNote, startTick, durationTicks} objects. */
function buildMelodyMidiNotes(
  melodyData: { pc: number; step: number }[],
  ppq: number,
): { midiNote: number; startTick: number; durationTicks: number; velocity: number }[] {
  // One step = ppq / STEPS_PER_BEAT ticks
  const ticksPerStep = ppq / STEPS_PER_BEAT;
  return melodyData.map(n => ({
    midiNote: 60 + n.pc, // pc 0 = C4 (MIDI 60)
    startTick: Math.round(n.step * ticksPerStep),
    durationTicks: Math.round(ticksPerStep * 0.9),
    velocity: 90,
  }));
}

/** Convert rhythm data (0/1 per step) to percussion notes on channel 10. */
function buildRhythmMidiNotes(
  rhythmData: (0 | 1)[],
  ppq: number,
): { midiNote: number; startTick: number; durationTicks: number; velocity: number }[] {
  const ticksPerStep = ppq / STEPS_PER_BEAT;
  const notes: { midiNote: number; startTick: number; durationTicks: number; velocity: number }[] = [];
  for (let i = 0; i < rhythmData.length; i++) {
    if (rhythmData[i]) {
      notes.push({
        midiNote: 38, // snare drum (GM)
        startTick: Math.round(i * ticksPerStep),
        durationTicks: Math.round(ticksPerStep * 0.5),
        velocity: 100,
      });
    }
  }
  return notes;
}

/** Convert chord data to MIDI notes (one chord per bar, held for the full bar). */
function buildChordMidiNotes(
  chordData: { pcs: number[]; name: string; bar: number }[],
  ppq: number,
  timeSigTop: number,
): { midiNote: number; startTick: number; durationTicks: number; velocity: number }[] {
  const ticksPerBar = ppq * timeSigTop;
  const notes: { midiNote: number; startTick: number; durationTicks: number; velocity: number }[] = [];
  for (const chord of chordData) {
    const pcs = chord.pcs.length > 0 ? chord.pcs : (COMMON_CHORD_PCS[chord.name] ?? []);
    const startTick = chord.bar * ticksPerBar;
    for (const pc of pcs) {
      notes.push({
        midiNote: 48 + pc, // chord in octave 3
        startTick,
        durationTicks: Math.round(ticksPerBar * 0.95),
        velocity: 70,
      });
    }
  }
  return notes;
}

// ---- Export functions ----

/**
 * Export sketch as multi-track Type-1 MIDI.
 * - Track 1: melody (channel 1)
 * - Track 2: rhythm (channel 10, GM percussion)
 * - Track 3: chords (channel 2)
 */
export function exportSketchAsMidi(sketch: SketchData): void {
  const ppq = 480;
  const safeName = sketch.name.trim() || 'sketch';

  const melodyNotes = buildMelodyMidiNotes(sketch.melodyData, ppq);
  const rhythmNotes = buildRhythmMidiNotes(sketch.rhythmData, ppq);
  const chordNotes = buildChordMidiNotes(sketch.chordData, ppq, sketch.timeSigTop);

  const tracks = [
    { name: 'Melody', channel: 1,  notes: melodyNotes },
    { name: 'Rhythm', channel: 10, notes: rhythmNotes },
    { name: 'Chords', channel: 2,  notes: chordNotes  },
  ];

  const blob = multiTrackToMidi(tracks, sketch.tempo, ppq);
  downloadFile(blob, `${safeName}.mid`);
}

/**
 * Export sketch melody and chords as MusicXML.
 */
export function exportSketchAsMusicXML(sketch: SketchData): void {
  const safeName = sketch.name.trim() || 'sketch';
  const ppq = 4; // quarter-note units directly

  // Melody part: one note per step that has a note, rests elsewhere
  const stepsTotal = sketch.bars * STEPS_PER_BEAT;
  const stepDuration = 1 / STEPS_PER_BEAT; // in quarter units

  // Build a step-indexed melody map
  const melodyByStep = new Map<number, number[]>();
  for (const n of sketch.melodyData) {
    const existing = melodyByStep.get(n.step) ?? [];
    existing.push(60 + n.pc);
    melodyByStep.set(n.step, existing);
  }

  // Melody notes list: pick first MIDI note per step, rest if empty
  const melodyXmlNotes = Array.from({ length: stepsTotal }, (_, s) => {
    const pitches = melodyByStep.get(s);
    if (pitches && pitches.length > 0) {
      return { pitch: pitches[0]!, duration: stepDuration, rest: false };
    }
    return { pitch: 60, duration: stepDuration, rest: true };
  });

  // Chord part: one chord held per bar
  const chordXmlNotes: { pitch: number; duration: number; rest: boolean }[] = [];
  for (let b = 0; b < sketch.bars; b++) {
    const chordEntry = sketch.chordData.find(c => c.bar === b);
    if (chordEntry) {
      const pcs = chordEntry.pcs.length > 0
        ? chordEntry.pcs
        : (COMMON_CHORD_PCS[chordEntry.name] ?? []);
      if (pcs.length > 0) {
        // Represent chord as the root note for MusicXML simplicity
        chordXmlNotes.push({
          pitch: 48 + (pcs[0]!),
          duration: sketch.timeSigTop,
          rest: false,
        });
        continue;
      }
    }
    chordXmlNotes.push({ pitch: 60, duration: sketch.timeSigTop, rest: true });
  }

  const xml = toMusicXML({
    title: sketch.name || 'Untitled Sketch',
    tempo: sketch.tempo,
    timeSignature: [sketch.timeSigTop, sketch.timeSigBottom],
    parts: [
      { name: 'Melody', notes: melodyXmlNotes },
      { name: 'Chords', notes: chordXmlNotes },
    ],
  });

  downloadFile(xml, `${safeName}.musicxml`, 'application/vnd.recordare.musicxml+xml');
  void ppq;
}

/**
 * Export sketch melody as Lilypond notation.
 */
export function exportSketchAsLilypond(sketch: SketchData): void {
  const safeName = sketch.name.trim() || 'sketch';

  // Collect unique pitch classes from melody
  const usedPcs = Array.from(new Set(sketch.melodyData.map(n => n.pc))).sort(
    (a, b) => a - b,
  ) as PitchClass[];

  const ly = toLilypond(usedPcs, { title: sketch.name || 'Untitled Sketch' });
  downloadFile(ly, `${safeName}.ly`, 'text/x-lilypond');
}
