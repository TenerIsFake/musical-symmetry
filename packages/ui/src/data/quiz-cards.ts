import type { PitchClass } from '@musical-symmetry/core';

export interface QuizCard {
  forteNumber: string;
  primeForm: PitchClass[];
  intervalVector: number[];
  group: string;
  cardinality: number;
  commonName: string;
}

/**
 * 224 set classes spanning cardinalities 2-10 (prime forms).
 * interval vectors and groups are taken from standard reference tables.
 * Common names follow standard musicological convention where available.
 */
export const QUIZ_CARDS: QuizCard[] = [
  // ── Dyads (2 notes) ──
  { forteNumber: '2-1',  primeForm: [0,1],  intervalVector: [1,0,0,0,0,0], group: 'C1',  cardinality: 2, commonName: 'Minor 2nd' },
  { forteNumber: '2-2',  primeForm: [0,2],  intervalVector: [0,1,0,0,0,0], group: 'C1',  cardinality: 2, commonName: 'Major 2nd' },
  { forteNumber: '2-3',  primeForm: [0,3],  intervalVector: [0,0,1,0,0,0], group: 'C1',  cardinality: 2, commonName: 'Minor 3rd' },
  { forteNumber: '2-4',  primeForm: [0,4],  intervalVector: [0,0,0,1,0,0], group: 'C1',  cardinality: 2, commonName: 'Major 3rd' },
  { forteNumber: '2-5',  primeForm: [0,5],  intervalVector: [0,0,0,0,1,0], group: 'C1',  cardinality: 2, commonName: 'Perfect 4th' },
  { forteNumber: '2-6',  primeForm: [0,6],  intervalVector: [0,0,0,0,0,1], group: 'D2',  cardinality: 2, commonName: 'Tritone' },

  // ── Trichords (3 notes) ──
  { forteNumber: '3-1',  primeForm: [0,1,2],   intervalVector: [2,1,0,0,0,0], group: 'C1',  cardinality: 3, commonName: 'Chromatic cluster' },
  { forteNumber: '3-2',  primeForm: [0,1,3],   intervalVector: [1,1,1,0,0,0], group: 'C1',  cardinality: 3, commonName: 'Minor 2nd + minor 3rd' },
  { forteNumber: '3-3',  primeForm: [0,1,4],   intervalVector: [1,0,1,1,0,0], group: 'C1',  cardinality: 3, commonName: 'Minor 2nd + major 3rd' },
  { forteNumber: '3-4',  primeForm: [0,1,5],   intervalVector: [1,0,0,1,1,0], group: 'C1',  cardinality: 3, commonName: 'Minor 2nd + perfect 4th' },
  { forteNumber: '3-5',  primeForm: [0,1,6],   intervalVector: [1,0,0,0,1,1], group: 'C1',  cardinality: 3, commonName: 'Minor 2nd + tritone' },
  { forteNumber: '3-6',  primeForm: [0,2,4],   intervalVector: [0,2,0,1,0,0], group: 'C1',  cardinality: 3, commonName: 'Whole-tone trichord' },
  { forteNumber: '3-7',  primeForm: [0,2,5],   intervalVector: [0,1,1,0,1,0], group: 'C1',  cardinality: 3, commonName: 'Quartal trichord' },
  { forteNumber: '3-8',  primeForm: [0,2,6],   intervalVector: [0,1,0,1,0,1], group: 'C1',  cardinality: 3, commonName: 'Tritone + whole tone' },
  { forteNumber: '3-9',  primeForm: [0,2,7],   intervalVector: [0,1,0,0,2,0], group: 'C1',  cardinality: 3, commonName: 'Suspended trichord' },
  { forteNumber: '3-10', primeForm: [0,3,6],   intervalVector: [0,0,2,0,0,1], group: 'C1',  cardinality: 3, commonName: 'Diminished trichord' },
  { forteNumber: '3-11', primeForm: [0,3,7],   intervalVector: [0,0,1,1,1,0], group: 'C1',  cardinality: 3, commonName: 'Minor / major triad' },
  { forteNumber: '3-12', primeForm: [0,4,8],   intervalVector: [0,0,0,3,0,0], group: 'D3',  cardinality: 3, commonName: 'Augmented triad' },

  // ── Tetrachords (4 notes) ──
  { forteNumber: '4-1',   primeForm: [0,1,2,3],   intervalVector: [3,2,1,0,0,0], group: 'C1',  cardinality: 4, commonName: 'Chromatic tetrachord' },
  { forteNumber: '4-2',   primeForm: [0,1,2,4],   intervalVector: [2,2,1,1,0,0], group: 'C1',  cardinality: 4, commonName: 'All-interval tetrachord A' },
  { forteNumber: '4-3',   primeForm: [0,1,3,4],   intervalVector: [2,1,2,1,0,0], group: 'C1',  cardinality: 4, commonName: 'Double minor 3rd' },
  { forteNumber: '4-4',   primeForm: [0,1,2,5],   intervalVector: [2,1,1,1,1,0], group: 'C1',  cardinality: 4, commonName: 'Cluster + 4th' },
  { forteNumber: '4-5',   primeForm: [0,1,2,6],   intervalVector: [2,1,0,1,1,1], group: 'C1',  cardinality: 4, commonName: 'Cluster + tritone' },
  { forteNumber: '4-6',   primeForm: [0,1,2,7],   intervalVector: [2,1,0,0,2,1], group: 'Z2',  cardinality: 4, commonName: 'Semitone + tritone pair' },
  { forteNumber: '4-7',   primeForm: [0,1,4,5],   intervalVector: [2,0,1,2,0,1], group: 'Z2',  cardinality: 4, commonName: 'Double semitone pair' },
  { forteNumber: '4-8',   primeForm: [0,1,5,6],   intervalVector: [2,0,0,1,2,1], group: 'Z2',  cardinality: 4, commonName: 'Two semitones + tritone' },
  { forteNumber: '4-9',   primeForm: [0,1,6,7],   intervalVector: [2,0,0,0,2,2], group: 'C2',  cardinality: 4, commonName: 'Double tritone semitone' },
  { forteNumber: '4-10',  primeForm: [0,2,3,5],   intervalVector: [1,2,2,0,1,0], group: 'Z2',  cardinality: 4, commonName: 'Minor pentatonic fragment' },
  { forteNumber: '4-11',  primeForm: [0,1,3,5],   intervalVector: [1,2,1,1,1,0], group: 'C1',  cardinality: 4, commonName: 'All-interval tetrachord B' },
  { forteNumber: '4-12',  primeForm: [0,2,3,6],   intervalVector: [1,1,2,1,0,1], group: 'C1',  cardinality: 4, commonName: 'Diminished + 2nd' },
  { forteNumber: '4-13',  primeForm: [0,1,3,6],   intervalVector: [1,1,2,0,1,1], group: 'C1',  cardinality: 4, commonName: 'Minor 2nd + diminished 3rd' },
  { forteNumber: '4-14',  primeForm: [0,2,3,7],   intervalVector: [1,1,1,1,2,0], group: 'C1',  cardinality: 4, commonName: 'Major triad + minor 2nd' },
  { forteNumber: '4-Z15', primeForm: [0,1,4,6],   intervalVector: [1,1,1,1,1,1], group: 'C1',  cardinality: 4, commonName: 'All-interval tetrachord Z15' },
  { forteNumber: '4-16',  primeForm: [0,1,5,7],   intervalVector: [1,1,0,1,2,1], group: 'C1',  cardinality: 4, commonName: 'Minor 2nd + tritone variant' },
  { forteNumber: '4-17',  primeForm: [0,3,4,7],   intervalVector: [1,0,2,2,1,0], group: 'Z2',  cardinality: 4, commonName: 'Double minor 3rd + 2nd' },
  { forteNumber: '4-18',  primeForm: [0,1,4,7],   intervalVector: [1,0,2,1,1,1], group: 'C1',  cardinality: 4, commonName: 'Diminished 7th fragment' },
  { forteNumber: '4-19',  primeForm: [0,1,4,8],   intervalVector: [1,0,1,3,1,0], group: 'C1',  cardinality: 4, commonName: 'Major 7th chord' },
  { forteNumber: '4-20',  primeForm: [0,1,5,8],   intervalVector: [1,0,1,2,1,1], group: 'C1',  cardinality: 4, commonName: 'Minor 7th chord' },
  { forteNumber: '4-21',  primeForm: [0,2,4,6],   intervalVector: [0,3,0,2,0,1], group: 'Z2',  cardinality: 4, commonName: 'Whole-tone tetrachord' },
  { forteNumber: '4-22',  primeForm: [0,2,4,7],   intervalVector: [0,2,1,1,2,0], group: 'C1',  cardinality: 4, commonName: 'Major pentatonic fragment' },
  { forteNumber: '4-23',  primeForm: [0,2,5,7],   intervalVector: [0,2,1,0,3,0], group: 'Z2',  cardinality: 4, commonName: 'Quartal tetrachord' },
  { forteNumber: '4-24',  primeForm: [0,2,4,8],   intervalVector: [0,2,0,3,0,1], group: 'Z2',  cardinality: 4, commonName: 'Augmented + major 2nds' },
  { forteNumber: '4-25',  primeForm: [0,2,6,8],   intervalVector: [0,2,0,2,0,2], group: 'C2',  cardinality: 4, commonName: 'French augmented 6th' },
  { forteNumber: '4-26',  primeForm: [0,3,5,8],   intervalVector: [0,1,2,1,2,0], group: 'Z2',  cardinality: 4, commonName: 'Half-diminished 7th' },
  { forteNumber: '4-27',  primeForm: [0,2,5,8],   intervalVector: [0,1,2,1,1,1], group: 'C1',  cardinality: 4, commonName: 'Dominant 7th' },
  { forteNumber: '4-28',  primeForm: [0,3,6,9],   intervalVector: [0,0,4,0,0,2], group: 'D4',  cardinality: 4, commonName: 'Diminished 7th chord' },
  { forteNumber: '4-Z29', primeForm: [0,1,3,7],   intervalVector: [1,1,1,1,1,1], group: 'C1',  cardinality: 4, commonName: 'All-interval tetrachord Z29' },

  // ── Pentachords (5 notes) ──
  { forteNumber: '5-1',   primeForm: [0,1,2,3,4],   intervalVector: [4,3,2,1,0,0], group: 'C1',  cardinality: 5, commonName: 'Chromatic pentachord' },
  { forteNumber: '5-2',   primeForm: [0,1,2,3,5],   intervalVector: [3,3,2,1,1,0], group: 'C1',  cardinality: 5, commonName: 'Five-note cluster' },
  { forteNumber: '5-3',   primeForm: [0,1,2,4,5],   intervalVector: [3,2,2,2,1,0], group: 'C1',  cardinality: 5, commonName: 'Pentachord variant' },
  { forteNumber: '5-4',   primeForm: [0,1,2,3,6],   intervalVector: [3,2,2,1,1,1], group: 'C1',  cardinality: 5, commonName: 'Cluster + tritone' },
  { forteNumber: '5-5',   primeForm: [0,1,2,3,7],   intervalVector: [3,2,1,2,2,0], group: 'C1',  cardinality: 5, commonName: 'Cluster + 5th' },
  { forteNumber: '5-6',   primeForm: [0,1,2,5,6],   intervalVector: [3,1,1,2,2,1], group: 'Z2',  cardinality: 5, commonName: 'Cluster + tritone B' },
  { forteNumber: '5-7',   primeForm: [0,1,2,6,7],   intervalVector: [3,1,0,1,3,2], group: 'Z2',  cardinality: 5, commonName: 'Double cluster tritone' },
  { forteNumber: '5-8',   primeForm: [0,2,3,4,6],   intervalVector: [2,3,2,2,0,1], group: 'C1',  cardinality: 5, commonName: 'Whole-tone + cluster' },
  { forteNumber: '5-9',   primeForm: [0,1,2,4,6],   intervalVector: [2,3,1,2,1,1], group: 'C1',  cardinality: 5, commonName: 'Bebop pentachord' },
  { forteNumber: '5-10',  primeForm: [0,1,3,4,6],   intervalVector: [2,2,3,1,1,1], group: 'C1',  cardinality: 5, commonName: 'Dorian fragment' },
  { forteNumber: '5-11',  primeForm: [0,2,3,4,7],   intervalVector: [2,2,2,2,2,0], group: 'C1',  cardinality: 5, commonName: 'Minor pentachord' },
  { forteNumber: '5-Z12', primeForm: [0,1,3,5,6],   intervalVector: [2,2,2,1,2,1], group: 'C1',  cardinality: 5, commonName: 'Z-related pentachord' },
  { forteNumber: '5-13',  primeForm: [0,1,2,4,8],   intervalVector: [2,2,1,3,1,1], group: 'C1',  cardinality: 5, commonName: 'Augmented + cluster' },
  { forteNumber: '5-14',  primeForm: [0,1,2,5,7],   intervalVector: [2,2,1,1,3,1], group: 'C1',  cardinality: 5, commonName: 'Dominant 9th fragment' },
  { forteNumber: '5-15',  primeForm: [0,1,2,6,8],   intervalVector: [2,2,0,2,2,2], group: 'Z2',  cardinality: 5, commonName: 'Tritone cluster' },
  { forteNumber: '5-16',  primeForm: [0,1,3,4,7],   intervalVector: [2,1,3,2,1,1], group: 'C1',  cardinality: 5, commonName: 'Major 7th fragment' },
  { forteNumber: '5-Z17', primeForm: [0,1,3,4,8],   intervalVector: [2,1,2,3,2,0], group: 'C1',  cardinality: 5, commonName: 'Z-related pentachord B' },
  { forteNumber: '5-Z18', primeForm: [0,1,4,5,7],   intervalVector: [2,1,2,2,2,1], group: 'C1',  cardinality: 5, commonName: 'Z-related pentachord C' },
  { forteNumber: '5-19',  primeForm: [0,1,3,6,7],   intervalVector: [2,1,2,1,2,2], group: 'Z2',  cardinality: 5, commonName: 'Minor 9th fragment' },
  { forteNumber: '5-20',  primeForm: [0,1,5,6,8],   intervalVector: [2,1,1,2,3,1], group: 'C1',  cardinality: 5, commonName: 'Tritone + cluster' },
  { forteNumber: '5-21',  primeForm: [0,1,4,5,8],   intervalVector: [2,0,2,4,2,0], group: 'C2',  cardinality: 5, commonName: 'Augmented 7th' },
  { forteNumber: '5-22',  primeForm: [0,1,4,7,8],   intervalVector: [2,0,2,3,2,1], group: 'C1',  cardinality: 5, commonName: 'Diminished + major 7th' },
  { forteNumber: '5-23',  primeForm: [0,2,3,5,7],   intervalVector: [1,3,2,1,3,0], group: 'C1',  cardinality: 5, commonName: 'Major pentatonic' },
  { forteNumber: '5-24',  primeForm: [0,1,3,5,7],   intervalVector: [1,3,1,2,3,0], group: 'C1',  cardinality: 5, commonName: 'Minor pentatonic' },
  { forteNumber: '5-25',  primeForm: [0,2,3,5,8],   intervalVector: [1,2,3,1,2,1], group: 'C1',  cardinality: 5, commonName: 'Half-diminished fragment' },
  { forteNumber: '5-26',  primeForm: [0,2,4,5,8],   intervalVector: [1,2,2,3,1,1], group: 'C1',  cardinality: 5, commonName: 'French 6th + note' },
  { forteNumber: '5-27',  primeForm: [0,1,3,5,8],   intervalVector: [1,2,2,2,3,0], group: 'C1',  cardinality: 5, commonName: 'Minor 11th fragment' },
  { forteNumber: '5-28',  primeForm: [0,2,3,6,8],   intervalVector: [1,2,2,2,1,2], group: 'C1',  cardinality: 5, commonName: 'Dominant + 2nd' },
  { forteNumber: '5-29',  primeForm: [0,1,3,6,8],   intervalVector: [1,2,2,1,3,1], group: 'C1',  cardinality: 5, commonName: 'Hendrix pentachord' },
  { forteNumber: '5-30',  primeForm: [0,1,4,6,8],   intervalVector: [1,2,1,3,2,1], group: 'C1',  cardinality: 5, commonName: 'Augmented fragment' },
  { forteNumber: '5-31',  primeForm: [0,1,3,6,9],   intervalVector: [1,1,4,1,1,2], group: 'C1',  cardinality: 5, commonName: 'Diminished 9th fragment' },
  { forteNumber: '5-32',  primeForm: [0,1,4,6,9],   intervalVector: [1,1,3,2,2,1], group: 'C1',  cardinality: 5, commonName: 'Dominant minor 9th' },
  { forteNumber: '5-33',  primeForm: [0,2,4,6,8],   intervalVector: [0,4,0,4,0,2], group: 'C2',  cardinality: 5, commonName: 'Whole-tone pentachord' },
  { forteNumber: '5-34',  primeForm: [0,2,4,6,9],   intervalVector: [0,3,2,2,2,1], group: 'C1',  cardinality: 5, commonName: 'Dominant 9th' },
  { forteNumber: '5-35',  primeForm: [0,2,4,7,9],   intervalVector: [0,3,2,1,4,0], group: 'C1',  cardinality: 5, commonName: 'Major pentatonic (Forte)' },

  // ── Hexachords (6 notes) ──
  { forteNumber: '6-1',   primeForm: [0,1,2,3,4,5],    intervalVector: [5,4,3,2,1,0], group: 'C1',  cardinality: 6, commonName: 'Chromatic hexachord' },
  { forteNumber: '6-2',   primeForm: [0,1,2,3,4,6],    intervalVector: [4,4,3,2,1,1], group: 'C1',  cardinality: 6, commonName: 'Five-note cluster + 2nd' },
  { forteNumber: '6-Z3',  primeForm: [0,1,2,3,5,6],    intervalVector: [4,3,3,2,2,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord' },
  { forteNumber: '6-Z4',  primeForm: [0,1,2,4,5,6],    intervalVector: [4,3,2,3,2,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord B' },
  { forteNumber: '6-5',   primeForm: [0,1,2,3,6,7],    intervalVector: [4,2,2,2,3,2], group: 'Z2',  cardinality: 6, commonName: 'Petrushka chord' },
  { forteNumber: '6-Z6',  primeForm: [0,1,2,5,6,7],    intervalVector: [4,2,1,2,4,2], group: 'Z2',  cardinality: 6, commonName: 'Z-related hexachord C' },
  { forteNumber: '6-7',   primeForm: [0,1,2,6,7,8],    intervalVector: [4,2,0,2,4,3], group: 'C3',  cardinality: 6, commonName: 'Double cluster hexachord' },
  { forteNumber: '6-8',   primeForm: [0,2,3,4,5,7],    intervalVector: [3,4,3,2,3,0], group: 'Z2',  cardinality: 6, commonName: 'Major hexatonic' },
  { forteNumber: '6-9',   primeForm: [0,1,2,3,5,7],    intervalVector: [3,4,2,2,3,1], group: 'C1',  cardinality: 6, commonName: 'Minor hexatonic' },
  { forteNumber: '6-Z10', primeForm: [0,1,3,4,5,7],    intervalVector: [3,3,3,3,2,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord D' },
  { forteNumber: '6-Z11', primeForm: [0,1,2,4,5,7],    intervalVector: [3,3,3,2,3,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord E' },
  { forteNumber: '6-Z12', primeForm: [0,1,2,4,6,7],    intervalVector: [3,3,2,2,3,2], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord F' },
  { forteNumber: '6-Z13', primeForm: [0,1,3,4,6,7],    intervalVector: [3,2,4,2,2,2], group: 'Z2',  cardinality: 6, commonName: 'Z-related hexachord G' },
  { forteNumber: '6-14',  primeForm: [0,1,3,4,5,8],    intervalVector: [3,2,3,4,3,0], group: 'C1',  cardinality: 6, commonName: 'Augmented hexachord' },
  { forteNumber: '6-15',  primeForm: [0,1,2,4,5,8],    intervalVector: [3,2,3,4,2,1], group: 'C1',  cardinality: 6, commonName: 'Major 7th hexachord' },
  { forteNumber: '6-16',  primeForm: [0,1,4,5,6,8],    intervalVector: [3,2,2,4,3,1], group: 'C1',  cardinality: 6, commonName: 'Hexatonic cluster' },
  { forteNumber: '6-Z17', primeForm: [0,1,2,4,7,8],    intervalVector: [3,2,2,3,3,2], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord H' },
  { forteNumber: '6-18',  primeForm: [0,1,2,5,7,8],    intervalVector: [3,2,2,2,4,2], group: 'Z2',  cardinality: 6, commonName: 'Scale hexachord' },
  { forteNumber: '6-Z19', primeForm: [0,1,3,4,7,8],    intervalVector: [3,1,3,4,3,1], group: 'Z2',  cardinality: 6, commonName: 'Z-related hexachord I' },
  { forteNumber: '6-20',  primeForm: [0,1,4,5,8,9],    intervalVector: [3,0,3,6,3,0], group: 'C3',  cardinality: 6, commonName: 'Hexatonic scale' },
  { forteNumber: '6-21',  primeForm: [0,2,3,4,6,8],    intervalVector: [2,4,2,4,1,2], group: 'C1',  cardinality: 6, commonName: 'Hexatonic variant' },
  { forteNumber: '6-22',  primeForm: [0,1,2,4,6,8],    intervalVector: [2,4,1,4,2,2], group: 'C1',  cardinality: 6, commonName: 'Whole-tone variant' },
  { forteNumber: '6-Z23', primeForm: [0,2,3,5,6,8],    intervalVector: [2,3,4,2,2,2], group: 'Z2',  cardinality: 6, commonName: 'Z-related hexachord J' },
  { forteNumber: '6-Z24', primeForm: [0,1,3,4,6,8],    intervalVector: [2,3,3,3,3,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord K' },
  { forteNumber: '6-Z25', primeForm: [0,1,3,5,6,8],    intervalVector: [2,3,3,2,4,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord L' },
  { forteNumber: '6-Z26', primeForm: [0,1,3,5,7,8],    intervalVector: [2,3,2,3,4,1], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord M' },
  { forteNumber: '6-27',  primeForm: [0,1,3,4,6,9],    intervalVector: [2,2,5,2,2,2], group: 'Z2',  cardinality: 6, commonName: 'Diminished hexachord' },
  { forteNumber: '6-Z28', primeForm: [0,1,3,5,6,9],    intervalVector: [2,2,4,3,2,2], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord N' },
  { forteNumber: '6-Z29', primeForm: [0,2,3,6,7,9],    intervalVector: [2,2,4,2,3,2], group: 'C1',  cardinality: 6, commonName: 'Z-related hexachord O' },
  { forteNumber: '6-30',  primeForm: [0,1,3,6,7,9],    intervalVector: [2,2,4,2,2,3], group: 'C2',  cardinality: 6, commonName: 'Tritone hexachord' },
  { forteNumber: '6-31',  primeForm: [0,1,4,5,7,9],    intervalVector: [2,2,3,4,3,1], group: 'C1',  cardinality: 6, commonName: 'Major scale hexachord' },
  { forteNumber: '6-32',  primeForm: [0,2,4,5,7,9],    intervalVector: [1,4,3,2,5,0], group: 'Z2',  cardinality: 6, commonName: 'Major hexatonic (pentatonic ext)' },
  { forteNumber: '6-33',  primeForm: [0,2,3,5,7,9],    intervalVector: [1,4,3,2,4,1], group: 'C1',  cardinality: 6, commonName: 'Minor hexatonic' },
  { forteNumber: '6-34',  primeForm: [0,1,3,5,7,9],    intervalVector: [1,4,2,4,2,2], group: 'Z2',  cardinality: 6, commonName: 'Prometheus hexachord' },
  { forteNumber: '6-35',  primeForm: [0,2,4,6,8,10],   intervalVector: [0,6,0,6,0,3], group: 'D6',  cardinality: 6, commonName: 'Whole-tone scale' },
];

/**
 * Fixed free-tier deck — 10 commonly-known set classes.
 */
export const FREE_DECK_IDS: string[] = [
  '3-11',  // Minor/major triad
  '3-12',  // Augmented triad
  '4-28',  // Diminished 7th
  '4-27',  // Dominant 7th
  '4-20',  // Minor 7th
  '4-19',  // Major 7th
  '5-35',  // Major pentatonic
  '5-23',  // Major pentatonic variant
  '6-35',  // Whole-tone scale
  '6-20',  // Hexatonic scale
];

export function getFreeDeck(): QuizCard[] {
  return QUIZ_CARDS.filter(c => FREE_DECK_IDS.includes(c.forteNumber));
}

export function getFullDeck(): QuizCard[] {
  return QUIZ_CARDS;
}
