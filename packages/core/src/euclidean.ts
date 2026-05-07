import type { RhythmPattern } from './rhythm';
import { rhythmNecklaceClass } from './rhythm';

export function euclidean(k: number, n: number): RhythmPattern {
  if (k >= n) return Array(n).fill(1) as RhythmPattern;
  if (k <= 0) return Array(n).fill(0) as RhythmPattern;

  let groups: number[][] = [
    ...Array.from({ length: k }, () => [1]),
    ...Array.from({ length: n - k }, () => [0]),
  ];

  while (true) {
    const ones = groups.filter(g => g[0] === 1);
    const zeros = groups.filter(g => g[0] === 0);
    if (zeros.length <= 1) break;
    const merged: number[][] = [];
    const pairs = Math.min(ones.length, zeros.length);
    for (let i = 0; i < pairs; i++) {
      merged.push([...ones[i]!, ...zeros[i]!]);
    }
    const remainder = ones.length > zeros.length
      ? ones.slice(pairs)
      : zeros.slice(pairs);
    groups = [...merged, ...remainder];
  }

  return groups.flat() as RhythmPattern;
}

export interface KnownClave {
  name: string;
  pattern: RhythmPattern;
  origin: string;
}

export const KNOWN_CLAVES: KnownClave[] = [
  { name: 'Tresillo', pattern: [1,0,0,1,0,0,1,0] as RhythmPattern, origin: 'Cuban' },
  { name: 'Cinquillo', pattern: [1,0,1,1,0,1,1,0] as RhythmPattern, origin: 'Cuban' },
  { name: 'Son Clave (3-side)', pattern: [1,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0] as RhythmPattern, origin: 'Cuban' },
  { name: 'Rumba Clave (3-side)', pattern: [1,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0] as RhythmPattern, origin: 'Cuban' },
  { name: 'Bossa Nova', pattern: [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0] as RhythmPattern, origin: 'Brazilian' },
  { name: 'Soukous', pattern: [1,0,0,1,0,0,1,0,0,0,1,0] as RhythmPattern, origin: 'Congolese' },
  { name: 'Aksak', pattern: [1,0,1,0,1,0,1,0,1] as RhythmPattern, origin: 'Turkish' },
  { name: 'Venda', pattern: [1,0,1,1,0,1,1] as RhythmPattern, origin: 'South African' },
];

export function matchClave(pattern: RhythmPattern): KnownClave | null {
  const necklace = rhythmNecklaceClass(pattern);
  for (const clave of KNOWN_CLAVES) {
    if (clave.pattern.length !== pattern.length) continue;
    if (rhythmNecklaceClass(clave.pattern) === necklace) return clave;
  }
  return null;
}
