export interface GenreProfile {
  name: string;
  commonForteNumbers: string[];   // Most frequent set classes
  intervalVectorAvg: [number, number, number, number, number, number]; // Average IV
  typicalProgressions: number[][][]; // Common chord sequences as pc arrays
  characteristics: string[];      // Human-readable traits
}

export const GENRE_PROFILES: GenreProfile[] = [
  {
    name: 'Classical (Common Practice)',
    commonForteNumbers: ['3-11', '3-12', '4-27', '4-26'],
    intervalVectorAvg: [2, 2, 3, 3, 3, 1],
    typicalProgressions: [[[0,4,7],[0,5,9],[7,11,2],[0,4,7]]],  // I-IV-V-I
    characteristics: ['Triadic harmony', 'Functional progressions', 'Voice-leading smoothness'],
  },
  {
    name: 'Jazz',
    commonForteNumbers: ['4-26', '4-27', '5-34', '5-35', '4-14'],
    intervalVectorAvg: [3, 3, 3, 3, 3, 2],
    typicalProgressions: [[[0,4,7,11],[5,9,0,4],[7,11,2,5],[0,4,7,11]]],  // ii-V-I with 7ths
    characteristics: ['Extended chords', 'Tritone substitutions', 'Chromatic voice leading'],
  },
  {
    name: 'Pop/Rock',
    commonForteNumbers: ['3-11', '3-12', '4-22'],
    intervalVectorAvg: [1, 2, 3, 3, 3, 1],
    typicalProgressions: [[[0,4,7],[9,0,4],[5,9,0],[7,11,2]]],  // I-vi-IV-V
    characteristics: ['Diatonic triads', 'Predictable patterns', 'Pentatonic melodies'],
  },
  {
    name: 'Impressionist',
    commonForteNumbers: ['5-35', '4-22', '3-12', '6-35'],
    intervalVectorAvg: [2, 3, 3, 3, 3, 2],
    typicalProgressions: [],
    characteristics: ['Whole-tone scales', 'Parallel motion', 'Non-functional harmony'],
  },
  {
    name: 'Atonal/Serialist',
    commonForteNumbers: ['3-5', '4-z15', '5-z12', '6-z44'],
    intervalVectorAvg: [3, 3, 3, 3, 3, 3],
    typicalProgressions: [],
    characteristics: ['Interval-class equality', 'Set-class diversity', 'No tonal center'],
  },
  {
    name: 'EDM/Electronic',
    commonForteNumbers: ['3-11', '4-22', '3-9'],
    intervalVectorAvg: [1, 2, 2, 3, 3, 1],
    typicalProgressions: [[[0,4,7],[9,0,4],[5,9,0],[0,4,7]]],
    characteristics: ['Power chords', 'Repetitive loops', 'Minor keys dominant'],
  },
];
