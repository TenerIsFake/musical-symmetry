import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

export interface CorpusStats {
  fileCount: number;
  totalSlices: number;
  topSetClasses: Array<{ forte: string; count: number; percentage: number }>;
  groupDistribution: Record<string, number>;
  cardinalityDistribution: Record<number, number>;
  zRelationDensity: number;
  averageIntervalVector: number[];
  perFileSummary: Array<{
    filename: string;
    sliceCount: number;
    topForte: string;
    dominantGroup: string;
  }>;
}

// Z-related pairs from the Forte catalog (both must appear for a Z-relation)
// These are the known Z-pairs for cardinalities 4–10
const Z_PAIRS: [string, string][] = [
  ['4-15', '4-29'],
  ['5-12', '5-36'], ['5-14', '5-38'], ['5-17', '5-37'],
  ['6-13', '6-42'], ['6-17', '6-43'], ['6-19', '6-44'], ['6-28', '6-49'],
  ['6-29', '6-50'], ['6-31', '6-45'], ['6-32', '6-46'], ['6-34', '6-47'],
  ['6-35', '6-48'],
  ['7-12', '7-36'], ['7-14', '7-38'], ['7-17', '7-37'],
  ['8-15', '8-29'],
];

function getForteNumber(pitchClasses: number[]): string {
  if (pitchClasses.length < 2) return '';
  try {
    // Use classify to get the abstract group, then map to forte number heuristically
    // We build the Forte number from cardinality + normalized prime form lookup
    const pcs = pitchClasses as PitchClass[];
    const analysis = classify(pcs);
    // Store the interval vector as a signature key for lookup
    const ivKey = analysis.intervalVector.join(',');
    const card = pcs.length;
    const entry = getForteIvMap().get(`${card}:${ivKey}`);
    return entry ?? `${card}-?`;
  } catch {
    return '';
  }
}

// Build a map of cardinality:iv → forte number from the catalog
// We lazily initialize this on first call
let _forteIvMap: Map<string, string> | null = null;

// Minimal forte catalog (prime forms) for IV-based lookup
const FORTE_PRIMES: [string, number[]][] = [
  ['2-1',[0,1]],['2-2',[0,2]],['2-3',[0,3]],['2-4',[0,4]],['2-5',[0,5]],['2-6',[0,6]],
  ['3-1',[0,1,2]],['3-2',[0,1,3]],['3-3',[0,1,4]],['3-4',[0,1,5]],['3-5',[0,1,6]],
  ['3-6',[0,2,4]],['3-7',[0,2,5]],['3-8',[0,2,6]],['3-9',[0,2,7]],['3-10',[0,3,6]],
  ['3-11',[0,3,7]],['3-12',[0,4,8]],
  ['4-1',[0,1,2,3]],['4-2',[0,1,2,4]],['4-3',[0,1,3,4]],['4-4',[0,1,2,5]],
  ['4-5',[0,1,2,6]],['4-6',[0,1,2,7]],['4-7',[0,1,4,5]],['4-8',[0,1,5,6]],
  ['4-9',[0,1,6,7]],['4-10',[0,2,3,5]],['4-11',[0,1,3,5]],['4-12',[0,2,3,6]],
  ['4-13',[0,1,3,6]],['4-14',[0,2,3,7]],['4-15',[0,1,4,6]],['4-16',[0,1,5,7]],
  ['4-17',[0,3,4,7]],['4-18',[0,1,4,7]],['4-19',[0,1,4,8]],['4-20',[0,1,5,8]],
  ['4-21',[0,2,4,6]],['4-22',[0,2,4,7]],['4-23',[0,2,5,7]],['4-24',[0,2,4,8]],
  ['4-25',[0,2,6,8]],['4-26',[0,3,5,8]],['4-27',[0,2,5,8]],['4-28',[0,3,6,9]],
  ['4-29',[0,1,3,7]],
  ['5-1',[0,1,2,3,4]],['5-2',[0,1,2,3,5]],['5-3',[0,1,2,4,5]],['5-4',[0,1,2,3,6]],
  ['5-5',[0,1,2,3,7]],['5-6',[0,1,2,5,6]],['5-7',[0,1,2,6,7]],['5-8',[0,2,3,4,6]],
  ['5-9',[0,1,2,4,6]],['5-10',[0,1,3,4,6]],['5-11',[0,2,3,4,7]],['5-12',[0,1,3,5,6]],
  ['5-13',[0,1,2,4,8]],['5-14',[0,1,2,5,7]],['5-15',[0,1,2,6,8]],['5-16',[0,1,3,4,7]],
  ['5-17',[0,1,3,4,8]],['5-18',[0,1,4,5,7]],['5-19',[0,1,3,6,7]],['5-20',[0,1,3,7,8]],
  ['5-21',[0,1,4,5,8]],['5-22',[0,1,4,7,8]],['5-23',[0,2,3,5,7]],['5-24',[0,1,3,5,7]],
  ['5-25',[0,2,3,5,8]],['5-26',[0,2,4,5,8]],['5-27',[0,1,3,5,8]],['5-28',[0,2,3,6,8]],
  ['5-29',[0,1,3,6,8]],['5-30',[0,1,4,6,8]],['5-31',[0,1,3,6,9]],['5-32',[0,1,4,6,9]],
  ['5-33',[0,2,4,6,8]],['5-34',[0,2,4,6,9]],['5-35',[0,2,4,7,9]],['5-36',[0,1,2,4,7]],
  ['5-37',[0,3,4,5,8]],['5-38',[0,1,2,5,8]],
  ['6-1',[0,1,2,3,4,5]],['6-2',[0,1,2,3,4,6]],['6-3',[0,1,2,3,5,6]],
  ['6-4',[0,1,2,4,5,6]],['6-5',[0,1,2,3,6,7]],['6-6',[0,1,2,5,6,7]],
  ['6-7',[0,1,2,6,7,8]],['6-8',[0,2,3,4,5,7]],['6-9',[0,1,2,3,5,7]],
  ['6-10',[0,1,3,4,5,7]],['6-11',[0,1,2,4,5,7]],['6-12',[0,1,2,4,6,7]],
  ['6-13',[0,1,3,4,6,7]],['6-14',[0,1,3,4,5,8]],['6-15',[0,1,2,4,5,8]],
  ['6-16',[0,1,4,5,6,8]],['6-17',[0,1,2,4,7,8]],['6-18',[0,1,2,5,7,8]],
  ['6-19',[0,1,3,4,7,8]],['6-20',[0,1,4,5,8,9]],['6-21',[0,2,3,4,6,8]],
  ['6-22',[0,1,2,4,6,8]],['6-23',[0,2,3,5,6,8]],['6-24',[0,1,3,4,6,8]],
  ['6-25',[0,1,3,5,6,8]],['6-26',[0,1,3,5,7,8]],['6-27',[0,1,3,4,6,9]],
  ['6-28',[0,1,3,5,6,9]],['6-29',[0,1,3,6,8,9]],['6-30',[0,1,3,6,7,9]],
  ['6-31',[0,1,3,5,8,9]],['6-32',[0,2,4,5,7,9]],['6-33',[0,2,3,5,7,9]],
  ['6-34',[0,1,3,5,7,9]],['6-35',[0,2,4,6,8,10]],
  ['6-36',[0,1,2,3,4,7]],['6-37',[0,1,2,3,4,8]],['6-38',[0,1,2,3,7,8]],
  ['6-39',[0,2,3,4,5,8]],['6-40',[0,1,2,3,5,8]],['6-41',[0,1,2,3,6,8]],
  ['6-42',[0,1,2,3,6,9]],['6-43',[0,1,2,5,6,8]],['6-44',[0,1,2,5,6,9]],
  ['6-45',[0,2,3,4,6,9]],['6-46',[0,1,2,4,6,9]],['6-47',[0,1,2,4,7,9]],
  ['6-48',[0,1,2,5,7,9]],['6-49',[0,1,3,4,7,9]],['6-50',[0,1,4,6,8,9]],
];

function getForteIvMap(): Map<string, string> {
  if (_forteIvMap) return _forteIvMap;
  _forteIvMap = new Map();
  for (const [forte, pcs] of FORTE_PRIMES) {
    try {
      const analysis = classify(pcs as PitchClass[]);
      const key = `${pcs.length}:${analysis.intervalVector.join(',')}`;
      // Only store the first (canonical) forte for each IV key
      if (!_forteIvMap.has(key)) {
        _forteIvMap.set(key, forte);
      }
    } catch {
      // skip
    }
  }
  return _forteIvMap;
}

export function computeCorpusStats(
  timelines: Array<{ filename: string; slices: any[] }>,
): CorpusStats {
  const fileCount = timelines.length;
  let totalSlices = 0;

  // Accumulators
  const forteCounts: Map<string, number> = new Map();
  const groupCounts: Map<string, number> = new Map();
  const cardinalityCounts: Map<number, number> = new Map();
  const intervalVectorSum: number[] = [0, 0, 0, 0, 0, 0];
  let ivContribCount = 0;

  const perFileSummary: CorpusStats['perFileSummary'] = [];

  for (const { filename, slices } of timelines) {
    let fileSliceCount = 0;
    const fileForte: Map<string, number> = new Map();
    const fileGroup: Map<string, number> = new Map();

    for (const sliceEntry of slices) {
      const analysis = sliceEntry.analysis;
      if (!analysis) continue;

      totalSlices++;
      fileSliceCount++;

      // Forte number
      const pcs: number[] = analysis.pitchClasses ?? sliceEntry.slice?.pitchClasses ?? [];
      const forteKey = getForteNumber(pcs);
      if (forteKey) {
        forteCounts.set(forteKey, (forteCounts.get(forteKey) ?? 0) + 1);
        fileForte.set(forteKey, (fileForte.get(forteKey) ?? 0) + 1);
      }

      // Group
      const group: string = analysis.abstractGroup ?? 'C1';
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
      fileGroup.set(group, (fileGroup.get(group) ?? 0) + 1);

      // Cardinality
      const card: number = pcs.length;
      if (card > 0) {
        cardinalityCounts.set(card, (cardinalityCounts.get(card) ?? 0) + 1);
      }

      // Interval vector accumulation
      const iv: number[] = analysis.intervalVector ?? [];
      if (iv.length === 6) {
        for (let i = 0; i < 6; i++) intervalVectorSum[i] += iv[i];
        ivContribCount++;
      }
    }

    // Per-file summary
    let topForte = '';
    let topForteCount = 0;
    for (const [f, c] of fileForte.entries()) {
      if (c > topForteCount) { topForteCount = c; topForte = f; }
    }

    let dominantGroup = 'C1';
    let topGroupCount = 0;
    for (const [g, c] of fileGroup.entries()) {
      if (c > topGroupCount) { topGroupCount = c; dominantGroup = g; }
    }

    perFileSummary.push({ filename, sliceCount: fileSliceCount, topForte, dominantGroup });
  }

  // Top set classes (top 20 by count)
  const sortedForte = [...forteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([forte, count]) => ({
      forte,
      count,
      percentage: totalSlices > 0 ? Math.round((count / totalSlices) * 10000) / 100 : 0,
    }));

  // Group distribution as plain object
  const groupDistribution: Record<string, number> = {};
  for (const [g, c] of groupCounts.entries()) groupDistribution[g] = c;

  // Cardinality distribution
  const cardinalityDistribution: Record<number, number> = {};
  for (const [card, c] of cardinalityCounts.entries()) cardinalityDistribution[card] = c;

  // Z-relation density: fraction of slices whose forte has a Z-partner also present
  const presentFortes = new Set(forteCounts.keys());
  let zRelatedSlices = 0;
  for (const [a, b] of Z_PAIRS) {
    if (presentFortes.has(a) && presentFortes.has(b)) {
      zRelatedSlices += (forteCounts.get(a) ?? 0) + (forteCounts.get(b) ?? 0);
    }
  }
  const zRelationDensity = totalSlices > 0
    ? Math.round((zRelatedSlices / totalSlices) * 10000) / 100
    : 0;

  // Average interval vector
  const averageIntervalVector = ivContribCount > 0
    ? intervalVectorSum.map(v => Math.round((v / ivContribCount) * 100) / 100)
    : [0, 0, 0, 0, 0, 0];

  return {
    fileCount,
    totalSlices,
    topSetClasses: sortedForte,
    groupDistribution,
    cardinalityDistribution,
    zRelationDensity,
    averageIntervalVector,
    perFileSummary,
  };
}
