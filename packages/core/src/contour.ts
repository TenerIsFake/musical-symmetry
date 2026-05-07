export type CSEG = number[];
export type COMMatrix = ('+' | '-' | '0')[][];

export interface ContourAnalysis {
  cseg: CSEG;
  comMatrix: COMMatrix;
  cas: ('+' | '-' | '0')[];
  isPalindrome: boolean;
  isInversionallySymmetric: boolean;
  depth: number;
}

export function toCSEG(pitches: number[]): CSEG {
  if (pitches.length === 0) return [];
  const sorted = [...new Set(pitches)].sort((a, b) => a - b);
  const rankMap = new Map<number, number>();
  sorted.forEach((p, i) => rankMap.set(p, i));
  return pitches.map(p => rankMap.get(p)!);
}

export function comMatrix(cseg: CSEG): COMMatrix {
  const n = cseg.length;
  const matrix: COMMatrix = Array.from({ length: n }, () => Array(n).fill('0') as ('+' | '-' | '0')[]);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (cseg[j]! > cseg[i]!) matrix[i]![j] = '+';
      else if (cseg[j]! < cseg[i]!) matrix[i]![j] = '-';
      else matrix[i]![j] = '0';
    }
  }
  return matrix;
}

export function contourAdjacencySeries(cseg: CSEG): ('+' | '-' | '0')[] {
  const cas: ('+' | '-' | '0')[] = [];
  for (let i = 0; i < cseg.length - 1; i++) {
    if (cseg[i + 1]! > cseg[i]!) cas.push('+');
    else if (cseg[i + 1]! < cseg[i]!) cas.push('-');
    else cas.push('0');
  }
  return cas;
}

export function contourInversion(cseg: CSEG): CSEG {
  if (cseg.length === 0) return [];
  const max = Math.max(...cseg);
  return cseg.map(v => max - v);
}

export function contourRetrograde(cseg: CSEG): CSEG {
  return [...cseg].reverse();
}

export function contourRetrogradeInversion(cseg: CSEG): CSEG {
  return contourRetrograde(contourInversion(cseg));
}

export function isContourPalindrome(cseg: CSEG): boolean {
  const n = cseg.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    if (cseg[i] !== cseg[n - 1 - i]) return false;
  }
  return true;
}

function csegEqual(a: CSEG, b: CSEG): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isInversionallySymmetric(cseg: CSEG): boolean {
  return csegEqual(cseg, contourInversion(cseg));
}

export function contourSimilarity(a: CSEG, b: CSEG): number {
  if (a.length !== b.length || a.length < 2) return 0;
  const comA = comMatrix(a);
  const comB = comMatrix(b);
  const n = a.length;
  let matches = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      total++;
      if (comA[i]![j] === comB[i]![j]) matches++;
    }
  }
  return total === 0 ? 1 : matches / total;
}

export function contourDepth(cseg: CSEG): number {
  let maxGap = 0;
  for (let i = 0; i < cseg.length - 1; i++) {
    const gap = Math.abs(cseg[i + 1]! - cseg[i]!);
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

export function contourClass(cseg: CSEG): string {
  if (cseg.length === 0) return 'c0-000';
  const normalized = toCSEG(cseg);
  const inv = contourInversion(normalized);
  const ret = contourRetrograde(normalized);
  const ri = contourRetrogradeInversion(normalized);
  const forms = [normalized, inv, ret, ri].sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i]! !== b[i]!) return a[i]! - b[i]!;
    }
    return 0;
  });
  const canonical = forms[0]!;
  const id = canonical.join('');
  return `c${cseg.length}-${id}`;
}

export function analyzeContour(pitches: number[]): ContourAnalysis {
  const cseg = toCSEG(pitches);
  return {
    cseg,
    comMatrix: comMatrix(cseg),
    cas: contourAdjacencySeries(cseg),
    isPalindrome: isContourPalindrome(cseg),
    isInversionallySymmetric: isInversionallySymmetric(cseg),
    depth: contourDepth(cseg),
  };
}
