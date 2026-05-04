export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const ALL_PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const NOTE_NAMES: Record<PitchClass, string> = {
  0: 'C', 1: 'C♯', 2: 'D', 3: 'E♭', 4: 'E', 5: 'F',
  6: 'F♯', 7: 'G', 8: 'A♭', 9: 'A', 10: 'B♭', 11: 'B',
};

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented';

export interface Chord {
  root: PitchClass;
  quality: ChordQuality;
  pitchClasses: PitchClass[];
}

export interface SymmetryAnalysis {
  pitchClasses: PitchClass[];
  transpositionalStabilizer: PitchClass[];
  inversionalAxes: PitchClass[];
  stabilizerOrder: number;
  abstractGroup: string;
  distinctTranspositions: number;
  intervalVector: [number, number, number, number, number, number];
  myhillProperty: boolean;
  maximallyEven: boolean;
  mullikenLabel: string;
  isRetrogradePalindrome: boolean;
  characterTableEntry: Record<string, 1 | -1>;
}

export type TransitionOrder = 1 | 2 | 3 | 'forbidden';

export interface ProgressionSuggestion {
  from: Chord;
  to: Chord;
  operator: string;
  order: TransitionOrder;
  commonTones: PitchClass[];
  voiceLeadingDistance: number;
}

export interface ScaleTemplate {
  name: string;
  family: string;
  intervals: number[];
  pitchClasses: PitchClass[];
}

export interface ModeAnalysis {
  name: string;
  root: PitchClass;
  intervalPattern: number[];
  brightnessIndex: number;
  isPalindrome: boolean;
  mullikenLabel: string;
}
