import type { PitchClass } from './types';
import { intervalVector } from './intervals';

export interface InstrumentSpec {
  name: string;
  family: string;
  rangeLow: number;
  rangeHigh: number;
  sweetLow: number;
  sweetHigh: number;
}

export interface VoicingAssignment {
  instrument: string;
  midiNote: number;
  pc: PitchClass;
}

export interface OrchestrationSuggestion {
  label: string;
  instruments: string[];
  voicing: VoicingAssignment[];
  reasoning: string[];
  score: number; // 0-100
}

// Heuristic template definitions
interface VoicingTemplate {
  label: string;
  instrumentNames: string[];
  style: 'spread' | 'close' | 'blend' | 'mixed';
}

const TEMPLATES: VoicingTemplate[] = [
  { label: 'String Spread', instrumentNames: ['Violin', 'Viola', 'Cello', 'Double Bass'], style: 'spread' },
  { label: 'String Trio', instrumentNames: ['Violin', 'Viola', 'Cello'], style: 'spread' },
  { label: 'Woodwind Choir', instrumentNames: ['Flute', 'Oboe', 'Clarinet', 'Bassoon'], style: 'blend' },
  { label: 'Woodwind Trio', instrumentNames: ['Flute', 'Oboe', 'Clarinet'], style: 'blend' },
  { label: 'Brass Close', instrumentNames: ['French Horn', 'Trumpet', 'Trombone', 'Tuba'], style: 'close' },
  { label: 'Brass Trio', instrumentNames: ['French Horn', 'Trumpet', 'Trombone'], style: 'close' },
  { label: 'Mixed Ensemble', instrumentNames: ['Flute', 'French Horn', 'Violin', 'Cello'], style: 'mixed' },
  { label: 'Chamber Mixed', instrumentNames: ['Clarinet', 'French Horn', 'Violin', 'Cello', 'Piano'], style: 'mixed' },
];

function pickMidiNote(
  pc: PitchClass,
  instr: InstrumentSpec,
  targetOctaveBase: number,
  preferSweet: boolean
): number {
  // Find the MIDI note closest to targetOctaveBase that matches this pc
  // and is within the instrument's range
  const low = preferSweet ? instr.sweetLow : instr.rangeLow;
  const high = preferSweet ? instr.sweetHigh : instr.rangeHigh;

  // Find starting octave near target
  let best: number | null = null;
  let bestDist = Infinity;

  for (let midi = low; midi <= high; midi++) {
    if (midi % 12 === pc) {
      const dist = Math.abs(midi - targetOctaveBase);
      if (dist < bestDist) {
        bestDist = dist;
        best = midi;
      }
    }
  }

  if (best !== null) return best;

  // Fallback: search full range
  for (let midi = instr.rangeLow; midi <= instr.rangeHigh; midi++) {
    if (midi % 12 === pc) return midi;
  }

  // Last resort: compute from pc
  return pc + Math.round(targetOctaveBase / 12) * 12;
}

function scoreVoicing(
  voicing: VoicingAssignment[],
  instrs: InstrumentSpec[],
  iv: [number, number, number, number, number, number]
): { score: number; reasoning: string[] } {
  let score = 50; // base score
  const reasoning: string[] = [];

  // Check all notes within sweet spot
  const allInSweet = voicing.every(v => {
    const instr = instrs.find(i => i.name === v.instrument);
    return instr ? v.midiNote >= instr.sweetLow && v.midiNote <= instr.sweetHigh : false;
  });
  if (allInSweet) {
    score += 20;
    reasoning.push('All notes within instrument sweet spots for optimal tone.');
  } else {
    const someInSweet = voicing.some(v => {
      const instr = instrs.find(i => i.name === v.instrument);
      return instr ? v.midiNote >= instr.sweetLow && v.midiNote <= instr.sweetHigh : false;
    });
    if (someInSweet) {
      score += 8;
      reasoning.push('Most notes within sweet spots; some in extended range.');
    } else {
      reasoning.push('Notes in extended range — may sound strained.');
    }
  }

  // Check no instrument doubling (all instruments distinct — guaranteed by template selection)
  const names = voicing.map(v => v.instrument);
  const uniqueNames = new Set(names);
  if (uniqueNames.size === names.length) {
    score += 10;
    reasoning.push('No instrument doubling — each voice is unique.');
  }

  // Spacing: lower voices should have wider intervals (ic 4,5,6), upper voices closer
  const sorted = [...voicing].sort((a, b) => a.midiNote - b.midiNote);
  if (sorted.length >= 2) {
    const bottomInterval = (sorted[1]!.midiNote - sorted[0]!.midiNote) % 12;
    const bottomIc = bottomInterval > 6 ? 12 - bottomInterval : bottomInterval;
    const topInterval = sorted.length >= 2
      ? (sorted[sorted.length - 1]!.midiNote - sorted[sorted.length - 2]!.midiNote) % 12
      : 0;
    const topIc = topInterval > 6 ? 12 - topInterval : topInterval;

    if (bottomIc >= 4 && topIc <= 4) {
      score += 15;
      reasoning.push('Good spacing: wide intervals in bass, close intervals in upper voices.');
    } else if (bottomIc >= 3) {
      score += 7;
      reasoning.push('Reasonable spacing with open bass voicing.');
    }
  }

  // Register spread
  if (sorted.length >= 2) {
    const spread = sorted[sorted.length - 1]!.midiNote - sorted[0]!.midiNote;
    if (spread >= 24 && spread <= 48) {
      score += 10;
      reasoning.push(`Good register spread of ${spread} semitones (2-4 octaves).`);
    } else if (spread > 48) {
      score += 5;
      reasoning.push(`Wide spread of ${spread} semitones — dramatic voicing.`);
    } else {
      score += 2;
      reasoning.push(`Compact spread of ${spread} semitones — dense texture.`);
    }
  }

  // Interval content insights
  const [ic1, ic2, ic3, ic4, ic5, ic6] = iv;
  if ((ic5 ?? 0) > 0 || (ic4 ?? 0) > 0) {
    reasoning.push('Perfect fourths/fifths (ic4/ic5) suggest open, stable harmonies.');
  }
  if ((ic1 ?? 0) > 0 || (ic2 ?? 0) > 0) {
    reasoning.push('Semitones/whole-tones (ic1/ic2) add tension — place in upper voices.');
  }
  if ((ic6 ?? 0) > 0) {
    reasoning.push('Tritone (ic6) creates ambiguity — effective in middle register.');
  }
  if ((ic3 ?? 0) > 1) {
    reasoning.push('Multiple thirds (ic3) suggest rich, chordal harmonic content.');
  }

  return { score: Math.min(100, score), reasoning };
}

export function suggestOrchestrations(
  pcs: PitchClass[],
  availableInstruments: InstrumentSpec[],
  options?: {
    registerLow?: number;
    registerHigh?: number;
    families?: string[];
    maxResults?: number;
  }
): OrchestrationSuggestion[] {
  if (pcs.length === 0) return [];

  const registerLow = options?.registerLow ?? 36;
  const registerHigh = options?.registerHigh ?? 96;
  const maxResults = options?.maxResults ?? 5;

  // Filter instruments by family and register overlap
  const filtered = availableInstruments.filter(instr => {
    if (options?.families && options.families.length > 0) {
      if (!options.families.includes(instr.family)) return false;
    }
    // Must have some overlap with desired register
    return instr.rangeHigh >= registerLow && instr.rangeLow <= registerHigh;
  });

  const iv = intervalVector(pcs);
  const n = pcs.length;

  const suggestions: OrchestrationSuggestion[] = [];

  for (const template of TEMPLATES) {
    // Find instruments from template that exist in available/filtered set
    const templateInstrs = template.instrumentNames
      .map(name => filtered.find(i => i.name === name))
      .filter((i): i is InstrumentSpec => i !== undefined);

    if (templateInstrs.length < Math.min(n, 2)) continue;

    // Pick n instruments from the template (trimming or cycling if needed)
    let selectedInstrs: InstrumentSpec[];
    if (templateInstrs.length >= n) {
      // Use first n instruments sorted by range (low to high)
      selectedInstrs = [...templateInstrs]
        .sort((a, b) => a.sweetLow - b.sweetLow)
        .slice(0, n);
    } else {
      // Not enough instruments in template for all pcs — skip
      continue;
    }

    // Sort pcs so lowest pc goes to lowest instrument
    const sortedPcs = [...pcs].sort((a, b) => a - b);

    // Compute register spread target
    const regSpread = registerHigh - registerLow;
    const step = n > 1 ? regSpread / (n - 1) : 0;

    // Assign pcs to instruments (low instrument → low pc)
    const voicing: VoicingAssignment[] = sortedPcs.map((pc, idx) => {
      const instr = selectedInstrs[idx]!;
      const targetMidi = registerLow + Math.round(idx * step);
      const midi = pickMidiNote(pc, instr, targetMidi, true);
      return { instrument: instr.name, midiNote: midi, pc };
    });

    const { score, reasoning } = scoreVoicing(voicing, selectedInstrs, iv);

    // Add template style description
    const styleDesc =
      template.style === 'spread' ? 'Wide open voicing across string family.'
      : template.style === 'close' ? 'Close-position brass voicing.'
      : template.style === 'blend' ? 'Blended woodwind choir texture.'
      : 'Mixed-family color contrasts.';

    suggestions.push({
      label: template.label,
      instruments: selectedInstrs.map(i => i.name),
      voicing,
      reasoning: [styleDesc, ...reasoning],
      score,
    });
  }

  // Sort by score descending, return top results
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
