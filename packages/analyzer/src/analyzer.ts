import { classify, identifyChord, generalizedVoiceLeading } from '@musical-symmetry/core';
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
  format: 'midi' | 'musicxml' | 'audio';
}

export function analyzeTimeline(notes: TimedNote[], options: AnalyzeTimelineOptions): AnalysisTimeline {
  const { sliceMode, minNotesPerSlice, totalBeats, temposBPM, timeSignatures, filename, format } = options;

  const beatsPerMeasure = parseInt(timeSignatures[0]?.split('/')[0] ?? '4');
  const slices = sliceMode === 'beat'
    ? sliceByBeat(notes, totalBeats)
    : sliceByMeasure(notes, totalBeats, beatsPerMeasure);

  const analyzed: SliceAnalysis[] = [];
  let prevPCs: PitchClass[] | null = null;

  for (const slice of slices) {
    if (slice.pitchClasses.length < minNotesPerSlice) continue;

    const analysis = classify(slice.pitchClasses);
    const chord = slice.pitchClasses.length === 3 ? identifyChord(slice.pitchClasses) : null;

    let voiceLeadingFromPrev: number | null = null;
    if (prevPCs !== null && prevPCs.length <= 7 && slice.pitchClasses.length <= 7) {
      voiceLeadingFromPrev = generalizedVoiceLeading(prevPCs, slice.pitchClasses);
    }

    analyzed.push({ slice, analysis, chord, voiceLeadingFromPrev });
    prevPCs = slice.pitchClasses;
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
