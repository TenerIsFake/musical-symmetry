export type { PitchClass, Chord, ChordQuality, SymmetryAnalysis, TransitionOrder, ProgressionSuggestion, ScaleTemplate, ModeAnalysis } from './types';
export { ALL_PITCH_CLASSES, NOTE_NAMES } from './types';
export { mod12, toPcSet, transpose, invert, normalize, complement, areEqual } from './pcset';
export { transpositionalStabilizer, inversionalAxes, stabilizerOrder, distinctTranspositions, abstractGroup } from './symmetry';
export { intervalVector, myhillProperty, zRelated } from './intervals';
export { isMaximallyEven } from './evenness';
export { mullikenLabel } from './mulliken';
export { characterTableEntry } from './character-table';
export { applyP, applyL, applyR, applyCompound, allFirstOrder, allSecondOrder, allThirdOrder } from './plr';
export { voiceLeadingDistance, generalizedVoiceLeading } from './voice-leading';
export { classifyTransition, findPLRPath } from './transitions';
export { SCALE_TEMPLATES, findBestScale } from './scales';
export { CHORD_TEMPLATES, identifyChord } from './chords';
export { analyzeModes, isRetrogradePalindrome, brightnessIndex } from './modes';
export type { CSEG, COMMatrix, ContourAnalysis } from './contour';
export { toCSEG, comMatrix, contourAdjacencySeries, contourInversion, contourRetrograde, contourRetrogradeInversion, isContourPalindrome, isInversionallySymmetric, contourSimilarity, contourDepth, contourClass, analyzeContour } from './contour';

import type { PitchClass, SymmetryAnalysis } from './types';
import { transpositionalStabilizer, inversionalAxes, stabilizerOrder, distinctTranspositions, abstractGroup } from './symmetry';
import { intervalVector, myhillProperty } from './intervals';
import { isMaximallyEven } from './evenness';
import { mullikenLabel } from './mulliken';
import { characterTableEntry } from './character-table';
import { isRetrogradePalindrome } from './modes';

export function classify(pcs: PitchClass[]): SymmetryAnalysis {
  return {
    pitchClasses: pcs,
    transpositionalStabilizer: transpositionalStabilizer(pcs),
    inversionalAxes: inversionalAxes(pcs),
    stabilizerOrder: stabilizerOrder(pcs),
    abstractGroup: abstractGroup(pcs),
    distinctTranspositions: distinctTranspositions(pcs),
    intervalVector: intervalVector(pcs),
    myhillProperty: myhillProperty(pcs),
    maximallyEven: isMaximallyEven(pcs),
    mullikenLabel: mullikenLabel(pcs),
    isRetrogradePalindrome: isRetrogradePalindrome(pcs),
    characterTableEntry: characterTableEntry(pcs),
  };
}
