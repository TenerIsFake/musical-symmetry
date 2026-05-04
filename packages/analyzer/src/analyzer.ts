import { classify, identifyChord } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { sliceByBeat, sliceByMeasure } from './slicer.js';
import type { TimedNote, SliceAnalysis, AnalysisTimeline, SliceMode } from './types.js';

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
