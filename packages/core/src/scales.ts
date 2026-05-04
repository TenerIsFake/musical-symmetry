import type { PitchClass, ScaleTemplate } from './types';
import { mod12, toPcSet } from './pcset';
import { NOTE_NAMES } from './types';

interface ScaleFamily {
  family: string;
  intervals: number[];
  modeNames?: string[];
}

const SCALE_FAMILIES: ScaleFamily[] = [
  {
    family: 'Diatonic',
    intervals: [2, 2, 1, 2, 2, 2, 1],
    modeNames: ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'],
  },
  {
    family: 'Harmonic minor',
    intervals: [2, 1, 2, 2, 1, 3, 1],
    modeNames: [
      'Harmonic minor', 'Locrian ♮6', 'Ionian ♯5', 'Dorian ♯4',
      'Phrygian dominant', 'Lydian ♯2', 'Superlocrian',
    ],
  },
  {
    family: 'Melodic minor',
    intervals: [2, 1, 2, 2, 2, 2, 1],
    modeNames: [
      'Melodic minor', 'Dorian ♭2', 'Lydian augmented', 'Lydian dominant',
      'Mixolydian ♭6', 'Aeolian ♭5', 'Altered',
    ],
  },
  {
    family: 'Pentatonic major',
    intervals: [2, 2, 3, 2, 3],
    modeNames: [
      'Major pentatonic', 'Suspended pentatonic', 'Blues minor pentatonic',
      'Blues major pentatonic', 'Minor pentatonic',
    ],
  },
  {
    family: 'Whole-tone',
    intervals: [2, 2, 2, 2, 2, 2],
  },
  {
    // Half-whole octatonic
    family: 'Octatonic',
    intervals: [1, 2, 1, 2, 1, 2, 1, 2],
  },
  {
    // Whole-half octatonic — same family label so both sets are counted under 'Octatonic'
    family: 'Octatonic',
    intervals: [2, 1, 2, 1, 2, 1, 2, 1],
  },
  {
    family: 'Blues',
    intervals: [3, 2, 1, 1, 3, 2],
  },
  {
    family: 'Chromatic',
    intervals: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    family: 'Double harmonic',
    intervals: [1, 3, 1, 2, 1, 3, 1],
    modeNames: [
      'Double harmonic major', 'Lydian ♯2 ♯6', 'Ultra Phrygian',
      'Hungarian minor', 'Oriental', 'Ionian ♯2 ♯5', 'Locrian bb3 bb7',
    ],
  },
  {
    family: 'Neapolitan major',
    intervals: [1, 2, 2, 2, 2, 2, 1],
    modeNames: [
      'Neapolitan major', 'Lydian ♯6', 'Mixolydian augmented',
      'Aeolian dominant', 'Locrian major', 'Altered dominant', 'Altered diminished',
    ],
  },
  {
    family: 'Neapolitan minor',
    intervals: [1, 2, 2, 2, 1, 3, 1],
    modeNames: [
      'Neapolitan minor', 'Lydian ♯6', 'Mixolydian augmented',
      'Aeolian ♯4', 'Locrian dominant', 'Ionian ♯2', 'Ultralocrian',
    ],
  },
];

function buildTemplates(): ScaleTemplate[] {
  const templates: ScaleTemplate[] = [];

  SCALE_FAMILIES.forEach((fam, famIndex) => {
    // Deduplicate by family-index + sorted pc-set string so that:
    // - Each distinct pc-set per family entry appears once
    // - The two Octatonic entries each contribute their 3 distinct sets (total 6)
    // - The single Whole-tone entry contributes its 2 distinct sets
    const seen = new Set<string>();
    const numModes = fam.modeNames?.length ?? 1;

    for (let mode = 0; mode < numModes; mode++) {
      const rotatedIntervals = [
        ...fam.intervals.slice(mode),
        ...fam.intervals.slice(0, mode),
      ];

      for (let root = 0; root < 12; root++) {
        const pcs: PitchClass[] = [root as PitchClass];
        let current = root;
        for (const interval of rotatedIntervals.slice(0, -1)) {
          current = mod12(current + interval);
          pcs.push(current as PitchClass);
        }
        const sorted = toPcSet(pcs);
        const pcKey = sorted.join(',');
        const dedupKey = `${famIndex}-${mode}-${pcKey}`;

        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          const modeName = fam.modeNames?.[mode] ?? fam.family;
          const name = `${NOTE_NAMES[root as PitchClass]} ${modeName}`;
          templates.push({
            name,
            family: fam.family,
            intervals: rotatedIntervals,
            pitchClasses: sorted,
          });
        }
      }
    }
  });

  return templates;
}

export const SCALE_TEMPLATES: ScaleTemplate[] = buildTemplates();

export function findBestScale(
  pcs: PitchClass[],
  topN = 3,
): (ScaleTemplate & { score: number })[] {
  const inputSet = new Set(toPcSet(pcs));
  const scored = SCALE_TEMPLATES.map(template => {
    const templateSet = new Set(template.pitchClasses);
    let coverage = 0;
    for (const pc of inputSet) {
      if (templateSet.has(pc)) coverage++;
    }
    let extra = 0;
    for (const pc of inputSet) {
      if (!templateSet.has(pc)) extra++;
    }
    const score = coverage / inputSet.size - extra * 0.3;
    return { ...template, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
