export interface Instrument {
  name: string;
  family: 'woodwind' | 'brass' | 'string' | 'percussion' | 'keyboard';
  rangeLow: number;    // MIDI note
  rangeHigh: number;   // MIDI note
  sweetLow: number;    // sweet spot low
  sweetHigh: number;   // sweet spot high
}

export const INSTRUMENTS: Instrument[] = [
  // Woodwinds
  { name: 'Piccolo', family: 'woodwind', rangeLow: 74, rangeHigh: 108, sweetLow: 79, sweetHigh: 96 },
  { name: 'Flute', family: 'woodwind', rangeLow: 60, rangeHigh: 96, sweetLow: 65, sweetHigh: 88 },
  { name: 'Oboe', family: 'woodwind', rangeLow: 58, rangeHigh: 91, sweetLow: 62, sweetHigh: 84 },
  { name: 'Clarinet', family: 'woodwind', rangeLow: 50, rangeHigh: 94, sweetLow: 55, sweetHigh: 86 },
  { name: 'Bass Clarinet', family: 'woodwind', rangeLow: 38, rangeHigh: 77, sweetLow: 43, sweetHigh: 72 },
  { name: 'Bassoon', family: 'woodwind', rangeLow: 34, rangeHigh: 75, sweetLow: 38, sweetHigh: 67 },
  { name: 'Contrabassoon', family: 'woodwind', rangeLow: 22, rangeHigh: 55, sweetLow: 26, sweetHigh: 50 },
  // Brass
  { name: 'French Horn', family: 'brass', rangeLow: 35, rangeHigh: 77, sweetLow: 41, sweetHigh: 72 },
  { name: 'Trumpet', family: 'brass', rangeLow: 55, rangeHigh: 82, sweetLow: 58, sweetHigh: 77 },
  { name: 'Trombone', family: 'brass', rangeLow: 40, rangeHigh: 72, sweetLow: 43, sweetHigh: 67 },
  { name: 'Bass Trombone', family: 'brass', rangeLow: 34, rangeHigh: 65, sweetLow: 36, sweetHigh: 60 },
  { name: 'Tuba', family: 'brass', rangeLow: 28, rangeHigh: 58, sweetLow: 31, sweetHigh: 53 },
  // Strings
  { name: 'Violin', family: 'string', rangeLow: 55, rangeHigh: 103, sweetLow: 55, sweetHigh: 93 },
  { name: 'Viola', family: 'string', rangeLow: 48, rangeHigh: 91, sweetLow: 48, sweetHigh: 84 },
  { name: 'Cello', family: 'string', rangeLow: 36, rangeHigh: 76, sweetLow: 36, sweetHigh: 72 },
  { name: 'Double Bass', family: 'string', rangeLow: 28, rangeHigh: 62, sweetLow: 28, sweetHigh: 55 },
  { name: 'Harp', family: 'string', rangeLow: 24, rangeHigh: 103, sweetLow: 36, sweetHigh: 96 },
  // Keyboard
  { name: 'Piano', family: 'keyboard', rangeLow: 21, rangeHigh: 108, sweetLow: 36, sweetHigh: 96 },
  { name: 'Celesta', family: 'keyboard', rangeLow: 60, rangeHigh: 108, sweetLow: 65, sweetHigh: 96 },
  { name: 'Organ', family: 'keyboard', rangeLow: 36, rangeHigh: 96, sweetLow: 41, sweetHigh: 89 },
  // Percussion (pitched)
  { name: 'Xylophone', family: 'percussion', rangeLow: 65, rangeHigh: 108, sweetLow: 72, sweetHigh: 96 },
  { name: 'Marimba', family: 'percussion', rangeLow: 45, rangeHigh: 96, sweetLow: 48, sweetHigh: 84 },
  { name: 'Vibraphone', family: 'percussion', rangeLow: 53, rangeHigh: 89, sweetLow: 60, sweetHigh: 84 },
  { name: 'Glockenspiel', family: 'percussion', rangeLow: 79, rangeHigh: 108, sweetLow: 84, sweetHigh: 103 },
  { name: 'Timpani', family: 'percussion', rangeLow: 40, rangeHigh: 55, sweetLow: 41, sweetHigh: 53 },
];
