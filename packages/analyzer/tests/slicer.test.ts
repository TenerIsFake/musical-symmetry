import { describe, it, expect } from 'vitest';
import { sliceByBeat, sliceByMeasure } from '../src/slicer.js';
import type { TimedNote } from '../src/types.js';

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

  it('includes sustained notes in subsequent beats', () => {
    const slices = sliceByBeat(notes, 4);
    expect(slices[2]!.pitchClasses).toEqual([2, 7, 11]);
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
