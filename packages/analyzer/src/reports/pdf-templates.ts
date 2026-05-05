import type { SymmetryAnalysis, Chord, PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

export function chordLabel(pcs: PitchClass[], chord: Chord | null): string {
  if (chord) return `${NOTE_NAMES[chord.root]} ${chord.quality}`;
  return `{${pcs.map(pc => NOTE_NAMES[pc]).join(', ')}}`;
}

export function groupSummary(analysis: SymmetryAnalysis): string {
  const lines = [
    `Symmetry Group: ${analysis.abstractGroup}`,
    `Stabilizer Order: ${analysis.stabilizerOrder}`,
    `Distinct Transpositions: ${analysis.distinctTranspositions}`,
    `Interval Vector: [${analysis.intervalVector.join(', ')}]`,
    `Mulliken Label: ${analysis.mullikenLabel}`,
    `Maximally Even: ${analysis.maximallyEven ? 'Yes' : 'No'}`,
    `Myhill Property: ${analysis.myhillProperty ? 'Yes' : 'No'}`,
  ];
  return lines.join('\n');
}
