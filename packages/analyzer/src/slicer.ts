import type { PitchClass } from '@musical-symmetry/core';
import type { TimedNote, TimeSlice } from './types.js';

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
