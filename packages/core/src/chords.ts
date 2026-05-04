import type { PitchClass, Chord, ChordQuality } from './types';
import { mod12, toPcSet } from './pcset';
import { NOTE_NAMES } from './types';

interface ChordTemplate {
  name: string;
  quality: ChordQuality;
  intervals: number[];
}

const BASE_TEMPLATES: ChordTemplate[] = [
  { name: 'major',    quality: 'major',      intervals: [0, 4, 7] },
  { name: 'minor',    quality: 'minor',      intervals: [0, 3, 7] },
  { name: 'diminished', quality: 'diminished', intervals: [0, 3, 6] },
  { name: 'augmented',  quality: 'augmented',  intervals: [0, 4, 8] },
  { name: 'maj7',     quality: 'major',      intervals: [0, 4, 7, 11] },
  { name: 'dom7',     quality: 'major',      intervals: [0, 4, 7, 10] },
  { name: 'min7',     quality: 'minor',      intervals: [0, 3, 7, 10] },
  { name: 'min7b5',   quality: 'diminished', intervals: [0, 3, 6, 10] },
  { name: 'dim7',     quality: 'diminished', intervals: [0, 3, 6, 9] },
  { name: 'minmaj7',  quality: 'minor',      intervals: [0, 3, 7, 11] },
  { name: 'sus2',     quality: 'major',      intervals: [0, 2, 7] },
  { name: 'sus4',     quality: 'major',      intervals: [0, 5, 7] },
  { name: 'power',    quality: 'major',      intervals: [0, 7] },
];

export const CHORD_TEMPLATES: Array<{
  name: string;
  root: PitchClass;
  quality: ChordQuality;
  pitchClasses: PitchClass[];
}> = BASE_TEMPLATES.flatMap(template =>
  Array.from({ length: 12 }, (_, root) => ({
    name: `${NOTE_NAMES[root as PitchClass]}${
      template.name === 'major'
        ? ''
        : template.name === 'minor'
          ? 'm'
          : template.name
    }`,
    root: root as PitchClass,
    quality: template.quality,
    pitchClasses: toPcSet(template.intervals.map(i => mod12(i + root))),
  })),
);

export function identifyChord(pcs: PitchClass[]): Chord | null {
  const sorted = toPcSet(pcs);
  const key = sorted.join(',');
  for (const template of CHORD_TEMPLATES) {
    if (template.pitchClasses.join(',') === key) {
      return { root: template.root, quality: template.quality, pitchClasses: sorted };
    }
  }
  return null;
}
