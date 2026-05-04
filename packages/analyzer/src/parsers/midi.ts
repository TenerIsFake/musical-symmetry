import { parseMidi as parseMidiFile } from 'midi-file';
import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote } from '../types.js';

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
