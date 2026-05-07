import type { SymmetryAnalysis, PitchClass } from '@musical-symmetry/core';

const PC_TO_LILYPOND: Record<PitchClass, string> = {
  0: 'c',
  1: 'cis',
  2: 'd',
  3: 'ees',
  4: 'e',
  5: 'f',
  6: 'fis',
  7: 'g',
  8: 'aes',
  9: 'a',
  10: 'bes',
  11: 'b',
};

/**
 * Generate a Lilypond snippet showing the pitch-class set as notation.
 */
export function toLilypond(
  pcs: PitchClass[],
  options?: { clef?: string; title?: string },
): string {
  const clef = options?.clef ?? 'treble';
  const setLabel = `{${pcs.join(',')}}`;
  const title = options?.title ?? `Pitch-Class Set ${setLabel}`;
  const notes = pcs.map((pc) => PC_TO_LILYPOND[pc]).join(' ');

  return [
    '\\version "2.24.0"',
    `\\header { title = "${title}" }`,
    `\\relative c' {`,
    `  \\clef ${clef}`,
    `  ${notes}`,
    '}',
  ].join('\n');
}

/**
 * Generate a LaTeX table with the full symmetry analysis.
 */
export function toLatexTable(
  analysis: SymmetryAnalysis,
  options?: { caption?: string; label?: string },
): string {
  const setLabel = `\\{${analysis.pitchClasses.join(', ')}\\}`;
  const caption = options?.caption ?? `Analysis of pc-set $${setLabel}$`;
  const label = options?.label ?? `tab:set-${analysis.pitchClasses.join('')}`;

  const iv = toLatexIntervalVector(analysis.intervalVector);
  const myhill = analysis.myhillProperty ? 'Yes' : 'No';
  const maxEven = analysis.maximallyEven ? 'Yes' : 'No';

  const rows = [
    `Pitch classes & $${setLabel}$ \\\\`,
    `Interval vector & ${iv} \\\\`,
    `Symmetry group & $${analysis.abstractGroup}$ \\\\`,
    `Stabilizer order & ${analysis.stabilizerOrder} \\\\`,
    `Distinct transpositions & ${analysis.distinctTranspositions} \\\\`,
    `Maximally even & ${maxEven} \\\\`,
    `Myhill property & ${myhill} \\\\`,
  ];

  return [
    '\\begin{table}[h]',
    '\\centering',
    `\\caption{${caption}}`,
    `\\label{${label}}`,
    '\\begin{tabular}{ll}',
    '\\toprule',
    'Property & Value \\\\',
    '\\midrule',
    ...rows,
    '\\bottomrule',
    '\\end{tabular}',
    '\\end{table}',
  ].join('\n');
}

/**
 * Generate a LaTeX interval vector in standard angle-bracket notation.
 */
export function toLatexIntervalVector(iv: number[]): string {
  return `$\\langle ${iv.join(', ')} \\rangle$`;
}

/**
 * Generate a BibTeX citation for the Chrometria analysis tool.
 */
export function toBibtex(): string {
  const year = new Date().getFullYear();
  return [
    '@software{musical-symmetry,',
    '  author  = {Tendrid},',
    '  title   = {{Chrometria}: A Pitch-Class Set Analyzer},',
    `  year    = {${year}},`,
    '  url     = {https://symmetry.tendrid.us},',
    '  note    = {Interactive web tool for symmetry group analysis of',
    '             pitch-class sets},',
    '}',
  ].join('\n');
}

/**
 * Trigger a browser download of a string as a file.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType = 'text/plain',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
