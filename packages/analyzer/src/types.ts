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
