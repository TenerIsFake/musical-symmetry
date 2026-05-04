import { describe, it, expect } from 'vitest';
import { analyzeTimeline } from '../src/analyzer.js';
import type { TimedNote } from '../src/types.js';

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
