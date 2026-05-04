import { XMLParser } from 'fast-xml-parser';
import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote } from '../types.js';

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
