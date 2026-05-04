# Core Symmetry Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript library that classifies pitch-class sets by their symmetry group, computes PLR transformations, and suggests harmonic progressions — the shared engine for both PRD-042 (Classifier) and PRD-043 (Analyzer).

**Architecture:** Pure functional library with zero runtime dependencies. All functions operate on pitch-class sets (subsets of Z/12Z). The library exports types, classification functions, transformation functions, and template data. No I/O, no side effects, no DOM.

**Tech Stack:** TypeScript 5.x, Vitest (testing), tsup (bundling), Node 20+

---

## File Structure

```
packages/core/
├── src/
│   ├── types.ts              — PitchClass, PcSet, Chord, SymmetryAnalysis types
│   ├── pcset.ts              — PcSet primitives: transpose, invert, normalize, complement
│   ├── symmetry.ts           — Transpositional/inversional stabilizer, abstract group ID
│   ├── mulliken.ts           — Mulliken-style labeling (A/B, 1/2, g/u)
│   ├── character-table.ts    — Character table generation from symmetry group
│   ├── intervals.ts          — Interval vector, Myhill property, Z-relation
│   ├── evenness.ts           — Maximal evenness test
│   ├── plr.ts                — P, L, R transformations on triads + compounds
│   ├── voice-leading.ts      — Voice-leading distance (optimal assignment)
│   ├── transitions.ts        — Transition order classification (1st/2nd/3rd/forbidden)
│   ├── scales.ts             — Scale template library (297 templates)
│   ├── chords.ts             — Chord vocabulary (triads, 7ths, sus, power)
│   ├── modes.ts              — Mode analysis: brightness index, palindrome detection
│   └── index.ts              — Public API re-exports
├── tests/
│   ├── pcset.test.ts
│   ├── symmetry.test.ts
│   ├── mulliken.test.ts
│   ├── character-table.test.ts
│   ├── intervals.test.ts
│   ├── evenness.test.ts
│   ├── plr.test.ts
│   ├── voice-leading.test.ts
│   ├── transitions.test.ts
│   ├── scales.test.ts
│   ├── chords.test.ts
│   ├── modes.test.ts
│   └── validation.test.ts   — Cross-cutting validation criteria from the framework doc
├── test-vectors.json         — Shared input→output vectors (for Python port validation)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

### Task 1: Project Scaffold + Types

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/tests/pcset.test.ts` (smoke test only)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@musical-symmetry/core",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create src/types.ts**

```typescript
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const ALL_PITCH_CLASSES: readonly PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const NOTE_NAMES: Record<PitchClass, string> = {
  0: 'C', 1: 'C♯', 2: 'D', 3: 'E♭', 4: 'E', 5: 'F',
  6: 'F♯', 7: 'G', 8: 'A♭', 9: 'A', 10: 'B♭', 11: 'B',
};

export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented';

export interface Chord {
  root: PitchClass;
  quality: ChordQuality;
  pitchClasses: PitchClass[];
}

export interface SymmetryAnalysis {
  pitchClasses: PitchClass[];
  transpositionalStabilizer: PitchClass[];
  inversionalAxes: PitchClass[];
  stabilizerOrder: number;
  abstractGroup: string;
  distinctTranspositions: number;
  intervalVector: [number, number, number, number, number, number];
  myhillProperty: boolean;
  maximallyEven: boolean;
  mullikenLabel: string;
  isRetrogradePalindrome: boolean;
  characterTableEntry: Record<string, 1 | -1>;
}

export type TransitionOrder = 1 | 2 | 3 | 'forbidden';

export interface ProgressionSuggestion {
  from: Chord;
  to: Chord;
  operator: string;
  order: TransitionOrder;
  commonTones: PitchClass[];
  voiceLeadingDistance: number;
}

export interface ScaleTemplate {
  name: string;
  family: string;
  intervals: number[];
  pitchClasses: PitchClass[];
}

export interface ModeAnalysis {
  name: string;
  root: PitchClass;
  intervalPattern: number[];
  brightnessIndex: number;
  isPalindrome: boolean;
  mullikenLabel: string;
}
```

- [ ] **Step 5: Create smoke test**

File: `packages/core/tests/pcset.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import type { PitchClass } from '../src/types';

describe('types', () => {
  it('PitchClass values are 0-11', () => {
    const pc: PitchClass = 0;
    expect(pc).toBe(0);
    const pc2: PitchClass = 11;
    expect(pc2).toBe(11);
  });
});
```

- [ ] **Step 6: Install deps and run smoke test**

Run: `cd packages/core && npm install && npx vitest run`
Expected: 1 test passing

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "feat: scaffold core engine with types"
```

---

### Task 2: PcSet Primitives

**Files:**
- Create: `packages/core/src/pcset.ts`
- Modify: `packages/core/tests/pcset.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/pcset.test.ts` (replace contents)
```typescript
import { describe, it, expect } from 'vitest';
import { mod12, toPcSet, transpose, invert, normalize, complement, areEqual } from '../src/pcset';
import type { PitchClass } from '../src/types';

describe('mod12', () => {
  it('wraps positive values', () => { expect(mod12(13)).toBe(1); });
  it('wraps negative values', () => { expect(mod12(-1)).toBe(11); });
  it('preserves 0-11', () => { expect(mod12(7)).toBe(7); });
});

describe('toPcSet', () => {
  it('deduplicates and sorts', () => {
    expect(toPcSet([4, 0, 7, 4])).toEqual([0, 4, 7]);
  });
  it('normalizes mod 12', () => {
    expect(toPcSet([12, 14, 16])).toEqual([0, 2, 4]);
  });
});

describe('transpose', () => {
  it('transposes C major triad by 7 → G major triad', () => {
    expect(transpose([0, 4, 7], 7)).toEqual([2, 7, 11]);
  });
  it('wraps around mod 12', () => {
    expect(transpose([10, 11], 3)).toEqual([1, 2]);
  });
});

describe('invert', () => {
  it('inverts around axis 0', () => {
    expect(invert([0, 4, 7], 0)).toEqual([0, 5, 8]);
  });
  it('inverts C major around axis 11 → maps to itself (diatonic property)', () => {
    const cMajorScale = [0, 2, 4, 5, 7, 9, 11] as PitchClass[];
    expect(invert(cMajorScale, 11)).toEqual(cMajorScale);
  });
});

describe('normalize', () => {
  it('puts set in normal form (most compact, lowest)', () => {
    expect(normalize([0, 4, 7])).toEqual([0, 4, 7]);
  });
  it('rotates to find most compact form', () => {
    expect(normalize([8, 0, 4])).toEqual([0, 4, 8]);
  });
});

describe('complement', () => {
  it('returns pitch classes NOT in the set', () => {
    expect(complement([0, 2, 4, 5, 7, 9, 11])).toEqual([1, 3, 6, 8, 10]);
  });
});

describe('areEqual', () => {
  it('same content different order', () => {
    expect(areEqual([7, 0, 4], [0, 4, 7])).toBe(true);
  });
  it('different content', () => {
    expect(areEqual([0, 4, 7], [0, 3, 7])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pcset.test.ts`
Expected: FAIL — cannot find module '../src/pcset'

- [ ] **Step 3: Implement pcset.ts**

File: `packages/core/src/pcset.ts`
```typescript
import type { PitchClass, } from './types';
import { ALL_PITCH_CLASSES } from './types';

export function mod12(n: number): PitchClass {
  return (((n % 12) + 12) % 12) as PitchClass;
}

export function toPcSet(notes: number[]): PitchClass[] {
  const set = new Set(notes.map(mod12));
  return [...set].sort((a, b) => a - b);
}

export function transpose(pcs: PitchClass[], n: number): PitchClass[] {
  return toPcSet(pcs.map(pc => pc + n));
}

export function invert(pcs: PitchClass[], axis: number): PitchClass[] {
  return toPcSet(pcs.map(pc => axis - pc));
}

export function normalize(pcs: PitchClass[]): PitchClass[] {
  const sorted = toPcSet(pcs);
  if (sorted.length <= 1) return sorted;
  let best = sorted;
  let bestSpan = (sorted[sorted.length - 1]! - sorted[0]! + 12) % 12;
  for (let i = 1; i < sorted.length; i++) {
    const rotated = toPcSet(sorted.map(pc => pc - sorted[i]!));
    const span = (rotated[rotated.length - 1]! - rotated[0]! + 12) % 12;
    if (span < bestSpan || (span === bestSpan && lexLess(rotated, best))) {
      best = rotated;
      bestSpan = span;
    }
  }
  return best;
}

function lexLess(a: PitchClass[], b: PitchClass[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return true;
    if (a[i]! > b[i]!) return false;
  }
  return false;
}

export function complement(pcs: PitchClass[]): PitchClass[] {
  const set = new Set(toPcSet(pcs));
  return ALL_PITCH_CLASSES.filter(pc => !set.has(pc));
}

export function areEqual(a: PitchClass[] | number[], b: PitchClass[] | number[]): boolean {
  const sa = toPcSet(a);
  const sb = toPcSet(b);
  if (sa.length !== sb.length) return false;
  return sa.every((v, i) => v === sb[i]);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pcset.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pcset.ts packages/core/tests/pcset.test.ts
git commit -m "feat: PcSet primitives (transpose, invert, normalize, complement)"
```

---

### Task 3: Symmetry Classification

**Files:**
- Create: `packages/core/src/symmetry.ts`
- Create: `packages/core/tests/symmetry.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/symmetry.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { transpositionalStabilizer, inversionalAxes, stabilizerOrder, abstractGroup } from '../src/symmetry';
import type { PitchClass } from '../src/types';

describe('transpositionalStabilizer', () => {
  it('chromatic scale: all 12 transpositions', () => {
    const chromatic: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(transpositionalStabilizer(chromatic)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it('whole-tone: T0, T2, T4, T6, T8, T10', () => {
    const wt: PitchClass[] = [0, 2, 4, 6, 8, 10];
    expect(transpositionalStabilizer(wt)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it('octatonic: T0, T3, T6, T9', () => {
    const oct: PitchClass[] = [0, 1, 3, 4, 6, 7, 9, 10];
    expect(transpositionalStabilizer(oct)).toEqual([0, 3, 6, 9]);
  });
  it('diatonic major: T0 only', () => {
    const diat: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
    expect(transpositionalStabilizer(diat)).toEqual([0]);
  });
  it('C major triad: T0 only', () => {
    expect(transpositionalStabilizer([0, 4, 7] as PitchClass[])).toEqual([0]);
  });
  it('augmented triad: T0, T4, T8', () => {
    expect(transpositionalStabilizer([0, 4, 8] as PitchClass[])).toEqual([0, 4, 8]);
  });
  it('diminished 7th: T0, T3, T6, T9', () => {
    expect(transpositionalStabilizer([0, 3, 6, 9] as PitchClass[])).toEqual([0, 3, 6, 9]);
  });
});

describe('inversionalAxes', () => {
  it('diatonic major scale has 1 inversional axis (I11)', () => {
    const diat: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
    expect(inversionalAxes(diat)).toEqual([11]);
  });
  it('whole-tone has 6 inversional axes', () => {
    const wt: PitchClass[] = [0, 2, 4, 6, 8, 10];
    expect(inversionalAxes(wt)).toHaveLength(6);
  });
  it('harmonic minor has no inversional axes', () => {
    const hm: PitchClass[] = [0, 2, 3, 5, 7, 8, 11];
    expect(inversionalAxes(hm)).toEqual([]);
  });
  it('C major triad has 1 axis', () => {
    expect(inversionalAxes([0, 4, 7] as PitchClass[])).toHaveLength(1);
  });
});

describe('abstractGroup', () => {
  it('chromatic → D12', () => {
    expect(abstractGroup([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe('D12');
  });
  it('whole-tone → D6', () => {
    expect(abstractGroup([0,2,4,6,8,10] as PitchClass[])).toBe('D6');
  });
  it('octatonic → D4', () => {
    expect(abstractGroup([0,1,3,4,6,7,9,10] as PitchClass[])).toBe('D4');
  });
  it('diatonic → Z2', () => {
    expect(abstractGroup([0,2,4,5,7,9,11] as PitchClass[])).toBe('Z2');
  });
  it('harmonic minor → C1', () => {
    expect(abstractGroup([0,2,3,5,7,8,11] as PitchClass[])).toBe('C1');
  });
  it('augmented triad → D3', () => {
    expect(abstractGroup([0,4,8] as PitchClass[])).toBe('D3');
  });
  it('single pitch → D12', () => {
    expect(abstractGroup([0] as PitchClass[])).toBe('D12');
  });
});

describe('stabilizerOrder', () => {
  it('chromatic = 24', () => {
    expect(stabilizerOrder([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe(24);
  });
  it('whole-tone = 12', () => {
    expect(stabilizerOrder([0,2,4,6,8,10] as PitchClass[])).toBe(12);
  });
  it('diatonic = 2', () => {
    expect(stabilizerOrder([0,2,4,5,7,9,11] as PitchClass[])).toBe(2);
  });
  it('harmonic minor = 1', () => {
    expect(stabilizerOrder([0,2,3,5,7,8,11] as PitchClass[])).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/symmetry.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement symmetry.ts**

File: `packages/core/src/symmetry.ts`
```typescript
import type { PitchClass } from './types';
import { ALL_PITCH_CLASSES } from './types';
import { transpose, invert, areEqual } from './pcset';

export function transpositionalStabilizer(pcs: PitchClass[]): PitchClass[] {
  return ALL_PITCH_CLASSES.filter(n => areEqual(transpose(pcs, n), pcs));
}

export function inversionalAxes(pcs: PitchClass[]): PitchClass[] {
  return ALL_PITCH_CLASSES.filter(k => areEqual(invert(pcs, k), pcs));
}

export function stabilizerOrder(pcs: PitchClass[]): number {
  return transpositionalStabilizer(pcs).length + inversionalAxes(pcs).length;
}

export function distinctTranspositions(pcs: PitchClass[]): number {
  return 12 / transpositionalStabilizer(pcs).length;
}

export function abstractGroup(pcs: PitchClass[]): string {
  const tOrder = transpositionalStabilizer(pcs).length;
  const iCount = inversionalAxes(pcs).length;
  if (iCount > 0) {
    return `D${tOrder}`;
  }
  if (tOrder === 1) return 'C1';
  return `C${tOrder}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/symmetry.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/symmetry.ts packages/core/tests/symmetry.test.ts
git commit -m "feat: symmetry classification (stabilizer, inversional axes, group ID)"
```

---

### Task 4: Interval Vector + Myhill Property

**Files:**
- Create: `packages/core/src/intervals.ts`
- Create: `packages/core/tests/intervals.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/intervals.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { intervalVector, myhillProperty, zRelated } from '../src/intervals';
import type { PitchClass } from '../src/types';

describe('intervalVector', () => {
  it('diatonic major: [2, 5, 4, 3, 6, 1]', () => {
    expect(intervalVector([0,2,4,5,7,9,11] as PitchClass[])).toEqual([2, 5, 4, 3, 6, 1]);
  });
  it('pentatonic: [0, 3, 2, 1, 4, 0]', () => {
    expect(intervalVector([0,2,4,7,9] as PitchClass[])).toEqual([0, 3, 2, 1, 4, 0]);
  });
  it('whole-tone: [0, 6, 0, 6, 0, 3]', () => {
    expect(intervalVector([0,2,4,6,8,10] as PitchClass[])).toEqual([0, 6, 0, 6, 0, 3]);
  });
  it('octatonic: [4, 4, 8, 4, 4, 4]', () => {
    expect(intervalVector([0,1,3,4,6,7,9,10] as PitchClass[])).toEqual([4, 4, 8, 4, 4, 4]);
  });
  it('C major triad: [0, 0, 1, 1, 1, 0]', () => {
    expect(intervalVector([0,4,7] as PitchClass[])).toEqual([0, 0, 1, 1, 1, 0]);
  });
  it('chromatic: [12, 12, 12, 12, 12, 6]', () => {
    expect(intervalVector([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toEqual([12, 12, 12, 12, 12, 6]);
  });
});

describe('myhillProperty', () => {
  it('diatonic has Myhill property', () => {
    expect(myhillProperty([0,2,4,5,7,9,11] as PitchClass[])).toBe(true);
  });
  it('pentatonic has Myhill property', () => {
    expect(myhillProperty([0,2,4,7,9] as PitchClass[])).toBe(true);
  });
  it('whole-tone does NOT have Myhill property', () => {
    expect(myhillProperty([0,2,4,6,8,10] as PitchClass[])).toBe(false);
  });
  it('octatonic does NOT have Myhill property', () => {
    expect(myhillProperty([0,1,3,4,6,7,9,10] as PitchClass[])).toBe(false);
  });
});

describe('zRelated', () => {
  it('returns true for Z-related pair {0,1,4,6} and {0,1,3,7}', () => {
    expect(zRelated([0,1,4,6] as PitchClass[], [0,1,3,7] as PitchClass[])).toBe(true);
  });
  it('returns false for non-Z-related sets', () => {
    expect(zRelated([0,4,7] as PitchClass[], [0,3,7] as PitchClass[])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/intervals.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement intervals.ts**

File: `packages/core/src/intervals.ts`
```typescript
import type { PitchClass } from './types';
import { mod12, toPcSet } from './pcset';

export type IntervalVector = [number, number, number, number, number, number];

export function intervalVector(pcs: PitchClass[]): IntervalVector {
  const sorted = toPcSet(pcs);
  const vec: IntervalVector = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = mod12(sorted[j]! - sorted[i]!);
      const ic = diff <= 6 ? diff : 12 - diff;
      if (ic >= 1 && ic <= 6) {
        vec[ic - 1]!++;
      }
    }
  }
  return vec;
}

export function myhillProperty(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  const n = sorted.length;
  if (n < 2) return false;
  for (let genericInterval = 1; genericInterval < n; genericInterval++) {
    const specificSizes = new Set<number>();
    for (let i = 0; i < n; i++) {
      const j = (i + genericInterval) % n;
      const diff = mod12(sorted[j]! - sorted[i]!);
      specificSizes.add(diff);
    }
    if (specificSizes.size !== 2) return false;
  }
  return true;
}

export function zRelated(a: PitchClass[], b: PitchClass[]): boolean {
  const va = intervalVector(a);
  const vb = intervalVector(b);
  const sameVector = va.every((v, i) => v === vb[i]);
  if (!sameVector) return false;
  const sa = toPcSet(a);
  const sb = toPcSet(b);
  if (sa.length !== sb.length) return false;
  for (let n = 0; n < 12; n++) {
    const transposed = toPcSet(sa.map(pc => pc + n));
    if (transposed.length === sb.length && transposed.every((v, i) => v === sb[i])) return false;
    const inverted = toPcSet(sa.map(pc => n - pc));
    if (inverted.length === sb.length && inverted.every((v, i) => v === sb[i])) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/intervals.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/intervals.ts packages/core/tests/intervals.test.ts
git commit -m "feat: interval vector, Myhill property, Z-relation detection"
```

---

### Task 5: Maximal Evenness

**Files:**
- Create: `packages/core/src/evenness.ts`
- Create: `packages/core/tests/evenness.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/evenness.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { isMaximallyEven } from '../src/evenness';
import type { PitchClass } from '../src/types';

describe('isMaximallyEven', () => {
  it('diatonic (7-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,2,4,5,7,9,11] as PitchClass[])).toBe(true);
  });
  it('pentatonic (5-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,2,4,7,9] as PitchClass[])).toBe(true);
  });
  it('whole-tone (6-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,2,4,6,8,10] as PitchClass[])).toBe(true);
  });
  it('chromatic (12-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe(true);
  });
  it('harmonic minor is NOT maximally even', () => {
    expect(isMaximallyEven([0,2,3,5,7,8,11] as PitchClass[])).toBe(false);
  });
  it('octatonic (8-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,1,3,4,6,7,9,10] as PitchClass[])).toBe(true);
  });
  it('augmented triad (3-of-12) is maximally even', () => {
    expect(isMaximallyEven([0,4,8] as PitchClass[])).toBe(true);
  });
  it('major triad (3-of-12) is NOT maximally even', () => {
    expect(isMaximallyEven([0,4,7] as PitchClass[])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/evenness.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement evenness.ts**

File: `packages/core/src/evenness.ts`
```typescript
import type { PitchClass } from './types';
import { toPcSet } from './pcset';

export function isMaximallyEven(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  const k = sorted.length;
  if (k === 0) return false;
  if (k === 12) return true;
  const ideal = sorted.map((_, i) => Math.floor((i * 12) / k));
  const steps = sorted.map((_, i) => {
    const next = sorted[(i + 1) % k]!;
    const curr = sorted[i]!;
    return (next - curr + 12) % 12;
  });
  const uniqueSteps = new Set(steps);
  if (uniqueSteps.size > 2) return false;
  if (uniqueSteps.size === 1) return true;
  const stepValues = [...uniqueSteps].sort((a, b) => a - b);
  return stepValues[1]! - stepValues[0]! === 1;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/evenness.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/evenness.ts packages/core/tests/evenness.test.ts
git commit -m "feat: maximal evenness test for pitch-class sets"
```

---

### Task 6: PLR Transformations

**Files:**
- Create: `packages/core/src/plr.ts`
- Create: `packages/core/tests/plr.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/plr.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { applyP, applyL, applyR, applyCompound, allFirstOrder, allSecondOrder } from '../src/plr';
import type { Chord } from '../src/types';

const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
const Cmin: Chord = { root: 0, quality: 'minor', pitchClasses: [0, 3, 7] };
const Emin: Chord = { root: 4, quality: 'minor', pitchClasses: [4, 7, 11] };
const Amin: Chord = { root: 9, quality: 'minor', pitchClasses: [0, 4, 9] };

describe('P (Parallel)', () => {
  it('C major → C minor', () => {
    const result = applyP(Cmaj);
    expect(result.root).toBe(0);
    expect(result.quality).toBe('minor');
    expect(result.pitchClasses).toEqual([0, 3, 7]);
  });
  it('C minor → C major', () => {
    const result = applyP(Cmin);
    expect(result.root).toBe(0);
    expect(result.quality).toBe('major');
    expect(result.pitchClasses).toEqual([0, 4, 7]);
  });
  it('P is an involution (P² = identity)', () => {
    expect(applyP(applyP(Cmaj))).toEqual(Cmaj);
  });
});

describe('L (Leading-tone exchange)', () => {
  it('C major → E minor', () => {
    const result = applyL(Cmaj);
    expect(result.root).toBe(4);
    expect(result.quality).toBe('minor');
    expect(result.pitchClasses).toEqual([4, 7, 11]);
  });
  it('L is an involution', () => {
    expect(applyL(applyL(Cmaj))).toEqual(Cmaj);
  });
});

describe('R (Relative)', () => {
  it('C major → A minor', () => {
    const result = applyR(Cmaj);
    expect(result.root).toBe(9);
    expect(result.quality).toBe('minor');
    expect(result.pitchClasses).toEqual([0, 4, 9]);
  });
  it('R is an involution', () => {
    expect(applyR(applyR(Cmaj))).toEqual(Cmaj);
  });
});

describe('compound transformations', () => {
  it('PL: C major → Ab major', () => {
    const result = applyCompound(Cmaj, 'PL');
    expect(result.root).toBe(8);
    expect(result.quality).toBe('major');
  });
  it('PR: C major → C# minor (enharmonic Db minor)', () => {
    const result = applyCompound(Cmaj, 'PR');
    expect(result.quality).toBe('minor');
  });
  it('LR: C major → sequence', () => {
    const result = applyCompound(Cmaj, 'LR');
    expect(result).toBeDefined();
  });
});

describe('allFirstOrder', () => {
  it('returns 3 suggestions from C major', () => {
    const results = allFirstOrder(Cmaj);
    expect(results).toHaveLength(3);
    expect(results.map(r => r.operator)).toEqual(['P', 'L', 'R']);
    results.forEach(r => {
      expect(r.commonTones).toHaveLength(2);
    });
  });
});

describe('allSecondOrder', () => {
  it('returns 6 suggestions from C major', () => {
    const results = allSecondOrder(Cmaj);
    expect(results).toHaveLength(6);
    results.forEach(r => {
      expect(r.operator.length).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/plr.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement plr.ts**

File: `packages/core/src/plr.ts`
```typescript
import type { PitchClass, Chord, ProgressionSuggestion } from './types';
import { mod12, toPcSet } from './pcset';

function makeChord(root: PitchClass, quality: 'major' | 'minor'): Chord {
  const third = quality === 'major' ? 4 : 3;
  return {
    root,
    quality,
    pitchClasses: toPcSet([root, root + third, root + 7]),
  };
}

export function applyP(chord: Chord): Chord {
  const newQuality = chord.quality === 'major' ? 'minor' : 'major';
  return makeChord(chord.root, newQuality);
}

export function applyL(chord: Chord): Chord {
  if (chord.quality === 'major') {
    return makeChord(mod12(chord.root + 4), 'minor');
  }
  return makeChord(mod12(chord.root - 4), 'major');
}

export function applyR(chord: Chord): Chord {
  if (chord.quality === 'major') {
    return makeChord(mod12(chord.root + 9), 'minor');
  }
  return makeChord(mod12(chord.root - 9 + 12), 'major');
}

const PLR_OPS: Record<string, (c: Chord) => Chord> = { P: applyP, L: applyL, R: applyR };

export function applyCompound(chord: Chord, ops: string): Chord {
  let result = chord;
  for (const op of ops) {
    const fn = PLR_OPS[op];
    if (!fn) throw new Error(`Unknown PLR operator: ${op}`);
    result = fn(result);
  }
  return result;
}

function commonTones(a: Chord, b: Chord): PitchClass[] {
  const setB = new Set(b.pitchClasses);
  return a.pitchClasses.filter(pc => setB.has(pc));
}

function voiceLeadingDist(a: Chord, b: Chord): number {
  let total = 0;
  const bUsed = new Set<number>();
  for (const pa of a.pitchClasses) {
    let bestDist = 12;
    let bestIdx = -1;
    for (let i = 0; i < b.pitchClasses.length; i++) {
      if (bUsed.has(i)) continue;
      const d = Math.min(Math.abs(pa - b.pitchClasses[i]!), 12 - Math.abs(pa - b.pitchClasses[i]!));
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    bUsed.add(bestIdx);
    total += bestDist;
  }
  return total;
}

function makeSuggestion(from: Chord, operator: string): ProgressionSuggestion {
  const to = applyCompound(from, operator);
  return {
    from,
    to,
    operator,
    order: operator.length as 1 | 2 | 3,
    commonTones: commonTones(from, to),
    voiceLeadingDistance: voiceLeadingDist(from, to),
  };
}

export function allFirstOrder(chord: Chord): ProgressionSuggestion[] {
  return ['P', 'L', 'R'].map(op => makeSuggestion(chord, op));
}

export function allSecondOrder(chord: Chord): ProgressionSuggestion[] {
  return ['PL', 'PR', 'LP', 'LR', 'RP', 'RL'].map(op => makeSuggestion(chord, op));
}

export function allThirdOrder(chord: Chord): ProgressionSuggestion[] {
  const ops = ['PLP', 'PLR', 'PRL', 'PRP', 'LPL', 'LPR', 'LRP', 'LRL', 'RPL', 'RPR', 'RLP', 'RLR'];
  const seen = new Set<string>();
  const results: ProgressionSuggestion[] = [];
  for (const op of ops) {
    const s = makeSuggestion(chord, op);
    const key = `${s.to.root}-${s.to.quality}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(s);
    }
  }
  return results;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/plr.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/plr.ts packages/core/tests/plr.test.ts
git commit -m "feat: PLR transformations (P, L, R, compounds, 1st/2nd/3rd order)"
```

---

### Task 7: Voice-Leading Distance

**Files:**
- Create: `packages/core/src/voice-leading.ts`
- Create: `packages/core/tests/voice-leading.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/voice-leading.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { voiceLeadingDistance } from '../src/voice-leading';
import type { PitchClass } from '../src/types';

describe('voiceLeadingDistance', () => {
  it('identical sets → 0', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [0, 4, 7] as PitchClass[])).toBe(0);
  });
  it('C major → C minor = 1 (E→Eb)', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [0, 3, 7] as PitchClass[])).toBe(1);
  });
  it('C major → A minor = 2 (G→A)', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [0, 4, 9] as PitchClass[])).toBe(2);
  });
  it('is symmetric: vld(A,B) == vld(B,A)', () => {
    const a = [0, 4, 7] as PitchClass[];
    const b = [2, 6, 9] as PitchClass[];
    expect(voiceLeadingDistance(a, b)).toBe(voiceLeadingDistance(b, a));
  });
  it('C major → F# major (tritone) = 6', () => {
    expect(voiceLeadingDistance([0, 4, 7] as PitchClass[], [6, 10, 1] as PitchClass[])).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/voice-leading.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement voice-leading.ts**

File: `packages/core/src/voice-leading.ts`
```typescript
import type { PitchClass } from './types';

function minSemitoneDist(a: PitchClass, b: PitchClass): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i]!, ...perm]);
    }
  }
  return result;
}

export function voiceLeadingDistance(a: PitchClass[], b: PitchClass[]): number {
  if (a.length !== b.length) {
    throw new Error('Sets must have equal cardinality for voice-leading distance');
  }
  if (a.length === 0) return 0;
  let minTotal = Infinity;
  for (const perm of permutations(b)) {
    let total = 0;
    for (let i = 0; i < a.length; i++) {
      total += minSemitoneDist(a[i]!, perm[i]!);
    }
    minTotal = Math.min(minTotal, total);
  }
  return minTotal;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/voice-leading.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/voice-leading.ts packages/core/tests/voice-leading.test.ts
git commit -m "feat: voice-leading distance via optimal assignment"
```

---

### Task 8: Mulliken Labels + Character Table

**Files:**
- Create: `packages/core/src/mulliken.ts`
- Create: `packages/core/src/character-table.ts`
- Create: `packages/core/tests/mulliken.test.ts`
- Create: `packages/core/tests/character-table.test.ts`

- [ ] **Step 1: Write failing tests for mulliken**

File: `packages/core/tests/mulliken.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { mullikenLabel } from '../src/mulliken';
import type { PitchClass } from '../src/types';

describe('mullikenLabel', () => {
  it('chromatic → A1g', () => {
    expect(mullikenLabel([0,1,2,3,4,5,6,7,8,9,10,11] as PitchClass[])).toBe('A1g');
  });
  it('whole-tone → A1g', () => {
    expect(mullikenLabel([0,2,4,6,8,10] as PitchClass[])).toBe('A1g');
  });
  it('octatonic → A1g', () => {
    expect(mullikenLabel([0,1,3,4,6,7,9,10] as PitchClass[])).toBe('A1g');
  });
  it('diatonic → B1u', () => {
    expect(mullikenLabel([0,2,4,5,7,9,11] as PitchClass[])).toBe('B1u');
  });
  it('harmonic minor → B2u', () => {
    expect(mullikenLabel([0,2,3,5,7,8,11] as PitchClass[])).toBe('B2u');
  });
  it('pentatonic → B1u', () => {
    expect(mullikenLabel([0,2,4,7,9] as PitchClass[])).toBe('B1u');
  });
});
```

- [ ] **Step 2: Write failing tests for character-table**

File: `packages/core/tests/character-table.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { characterTableEntry } from '../src/character-table';
import type { PitchClass } from '../src/types';

describe('characterTableEntry', () => {
  it('diatonic: E=+1, T6=-1, I=+1, R=-1', () => {
    const entry = characterTableEntry([0,2,4,5,7,9,11] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(-1);
    expect(entry.I).toBe(1);
    expect(entry.R).toBe(-1);
  });
  it('whole-tone: all +1', () => {
    const entry = characterTableEntry([0,2,4,6,8,10] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(1);
    expect(entry.I).toBe(1);
    expect(entry.R).toBe(1);
  });
  it('harmonic minor: E=+1, T6=-1, I=-1, R=-1', () => {
    const entry = characterTableEntry([0,2,3,5,7,8,11] as PitchClass[]);
    expect(entry.E).toBe(1);
    expect(entry.T6).toBe(-1);
    expect(entry.I).toBe(-1);
    expect(entry.R).toBe(-1);
  });
});
```

- [ ] **Step 3: Implement mulliken.ts**

File: `packages/core/src/mulliken.ts`
```typescript
import type { PitchClass } from './types';
import { transpose, invert, areEqual } from './pcset';
import { inversionalAxes } from './symmetry';
import { isRetrogradePalindrome } from './modes';

export function mullikenLabel(pcs: PitchClass[]): string {
  const t6Symmetric = areEqual(transpose(pcs, 6), pcs);
  const hasInversion = inversionalAxes(pcs).length > 0;
  const palindrome = isRetrogradePalindrome(pcs);

  const primary = t6Symmetric ? 'A' : 'B';
  const subscript = hasInversion ? '1' : '2';
  const parity = palindrome ? 'g' : 'u';

  return `${primary}${subscript}${parity}`;
}
```

- [ ] **Step 4: Implement character-table.ts**

File: `packages/core/src/character-table.ts`
```typescript
import type { PitchClass } from './types';
import { transpose, areEqual } from './pcset';
import { inversionalAxes } from './symmetry';
import { isRetrogradePalindrome } from './modes';

export function characterTableEntry(pcs: PitchClass[]): Record<string, 1 | -1> {
  return {
    E: 1,
    T6: areEqual(transpose(pcs, 6), pcs) ? 1 : -1,
    I: inversionalAxes(pcs).length > 0 ? 1 : -1,
    R: isRetrogradePalindrome(pcs) ? 1 : -1,
  };
}
```

- [ ] **Step 5: Note — these depend on `isRetrogradePalindrome` from modes.ts (Task 10). Implement a stub first:**

Add to `packages/core/src/modes.ts` (create file):
```typescript
import type { PitchClass } from './types';
import { toPcSet } from './pcset';

export function isRetrogradePalindrome(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  if (sorted.length < 2) return true;
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    const curr = sorted[i]!;
    intervals.push((next - curr + 12) % 12);
  }
  const reversed = [...intervals].reverse();
  return intervals.every((v, i) => v === reversed[i]);
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/mulliken.test.ts tests/character-table.test.ts`
Expected: All passing

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/mulliken.ts packages/core/src/character-table.ts packages/core/src/modes.ts packages/core/tests/mulliken.test.ts packages/core/tests/character-table.test.ts
git commit -m "feat: Mulliken-style labeling and character table generation"
```

---

### Task 9: Transition Classification

**Files:**
- Create: `packages/core/src/transitions.ts`
- Create: `packages/core/tests/transitions.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/transitions.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { classifyTransition, findPLRPath } from '../src/transitions';
import type { Chord } from '../src/types';

const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
const Cmin: Chord = { root: 0, quality: 'minor', pitchClasses: [0, 3, 7] };
const Amin: Chord = { root: 9, quality: 'minor', pitchClasses: [0, 4, 9] };
const Emin: Chord = { root: 4, quality: 'minor', pitchClasses: [4, 7, 11] };
const Abmaj: Chord = { root: 8, quality: 'major', pitchClasses: [0, 4, 8] };
const Fsmaj: Chord = { root: 6, quality: 'major', pitchClasses: [1, 6, 10] };

describe('classifyTransition', () => {
  it('C major → C minor = 1st order', () => {
    expect(classifyTransition(Cmaj, Cmin).order).toBe(1);
  });
  it('C major → A minor = 1st order', () => {
    expect(classifyTransition(Cmaj, Amin).order).toBe(1);
  });
  it('C major → Ab major = 2nd order', () => {
    expect(classifyTransition(Cmaj, Abmaj).order).toBe(2);
  });
  it('C major → F# major = forbidden', () => {
    expect(classifyTransition(Cmaj, Fsmaj).order).toBe('forbidden');
  });
  it('reports common tones', () => {
    const t = classifyTransition(Cmaj, Cmin);
    expect(t.commonTones.sort()).toEqual([0, 7]);
  });
});

describe('findPLRPath', () => {
  it('C major → C minor = P', () => {
    expect(findPLRPath(Cmaj, Cmin)).toBe('P');
  });
  it('C major → E minor = L', () => {
    expect(findPLRPath(Cmaj, Emin)).toBe('L');
  });
  it('C major → A minor = R', () => {
    expect(findPLRPath(Cmaj, Amin)).toBe('R');
  });
  it('C major → Ab major = PL', () => {
    expect(findPLRPath(Cmaj, Abmaj)).toBe('PL');
  });
  it('returns null for distant chords', () => {
    const result = findPLRPath(Cmaj, Fsmaj);
    expect(result === null || result!.length > 3).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/transitions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement transitions.ts**

File: `packages/core/src/transitions.ts`
```typescript
import type { PitchClass, Chord, TransitionOrder, ProgressionSuggestion } from './types';
import { applyP, applyL, applyR, applyCompound } from './plr';
import { voiceLeadingDistance } from './voice-leading';

function commonTones(a: Chord, b: Chord): PitchClass[] {
  const setB = new Set(b.pitchClasses);
  return a.pitchClasses.filter(pc => setB.has(pc));
}

function chordsEqual(a: Chord, b: Chord): boolean {
  return a.root === b.root && a.quality === b.quality;
}

export function findPLRPath(from: Chord, to: Chord, maxDepth = 4): string | null {
  if (chordsEqual(from, to)) return '';
  const queue: [Chord, string][] = [['P', 'L', 'R'].map(op => {
    const fn = op === 'P' ? applyP : op === 'L' ? applyL : applyR;
    return [fn(from), op] as [Chord, string];
  })].flat();
  const visited = new Set<string>();
  visited.add(`${from.root}-${from.quality}`);

  for (const [chord, path] of queue) {
    const key = `${chord.root}-${chord.quality}`;
    if (chordsEqual(chord, to)) return path;
    if (visited.has(key)) continue;
    visited.add(key);
    if (path.length < maxDepth) {
      for (const op of ['P', 'L', 'R']) {
        const fn = op === 'P' ? applyP : op === 'L' ? applyL : applyR;
        queue.push([fn(chord), path + op]);
      }
    }
  }
  return null;
}

export function classifyTransition(from: Chord, to: Chord): ProgressionSuggestion {
  const path = findPLRPath(from, to);
  let order: TransitionOrder;
  if (path === null || path.length > 3) {
    order = 'forbidden';
  } else {
    order = (path.length || 1) as 1 | 2 | 3;
  }
  return {
    from,
    to,
    operator: path ?? 'none',
    order,
    commonTones: commonTones(from, to),
    voiceLeadingDistance: voiceLeadingDistance(from.pitchClasses, to.pitchClasses),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/transitions.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transitions.ts packages/core/tests/transitions.test.ts
git commit -m "feat: transition classification and PLR pathfinding"
```

---

### Task 10: Mode Analysis (complete)

**Files:**
- Modify: `packages/core/src/modes.ts` (extend the stub from Task 8)
- Create: `packages/core/tests/modes.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/modes.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { analyzeModes, isRetrogradePalindrome, brightnessIndex } from '../src/modes';
import type { PitchClass } from '../src/types';

const C_MAJOR: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

describe('isRetrogradePalindrome', () => {
  it('whole-tone is palindromic', () => {
    expect(isRetrogradePalindrome([0,2,4,6,8,10] as PitchClass[])).toBe(true);
  });
  it('diatonic starting on D (Dorian) is palindromic', () => {
    expect(isRetrogradePalindrome([2,4,5,7,9,11,0] as PitchClass[])).toBe(true);
  });
  it('diatonic starting on C (Ionian) is NOT palindromic', () => {
    expect(isRetrogradePalindrome([0,2,4,5,7,9,11] as PitchClass[])).toBe(false);
  });
  it('harmonic minor is NOT palindromic', () => {
    expect(isRetrogradePalindrome([0,2,3,5,7,8,11] as PitchClass[])).toBe(false);
  });
});

describe('brightnessIndex', () => {
  it('Lydian = +3', () => {
    expect(brightnessIndex([0,2,4,6,7,9,11] as PitchClass[])).toBe(3);
  });
  it('Ionian = +2', () => {
    expect(brightnessIndex([0,2,4,5,7,9,11] as PitchClass[])).toBe(2);
  });
  it('Dorian = 0', () => {
    expect(brightnessIndex([0,2,3,5,7,9,10] as PitchClass[])).toBe(0);
  });
  it('Locrian = -3', () => {
    expect(brightnessIndex([0,1,3,5,6,8,10] as PitchClass[])).toBe(-3);
  });
});

describe('analyzeModes', () => {
  it('C major diatonic → 7 modes', () => {
    const modes = analyzeModes(C_MAJOR);
    expect(modes).toHaveLength(7);
  });
  it('finds Dorian as palindromic', () => {
    const modes = analyzeModes(C_MAJOR);
    const dorian = modes.find(m => m.name === 'Dorian');
    expect(dorian).toBeDefined();
    expect(dorian!.isPalindrome).toBe(true);
  });
  it('Lydian is brightest (+3)', () => {
    const modes = analyzeModes(C_MAJOR);
    const lydian = modes.find(m => m.name === 'Lydian');
    expect(lydian).toBeDefined();
    expect(lydian!.brightnessIndex).toBe(3);
  });
  it('only Dorian is palindromic', () => {
    const modes = analyzeModes(C_MAJOR);
    const palindromes = modes.filter(m => m.isPalindrome);
    expect(palindromes).toHaveLength(1);
    expect(palindromes[0]!.name).toBe('Dorian');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/modes.test.ts`
Expected: FAIL (brightnessIndex and analyzeModes not defined)

- [ ] **Step 3: Implement full modes.ts**

File: `packages/core/src/modes.ts` (replace contents)
```typescript
import type { PitchClass, ModeAnalysis } from './types';
import { mod12, toPcSet } from './pcset';

const DIATONIC_MODE_NAMES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'];
const DORIAN_TEMPLATE = [0, 2, 3, 5, 7, 9, 10];

export function isRetrogradePalindrome(pcs: PitchClass[]): boolean {
  const sorted = toPcSet(pcs);
  if (sorted.length < 2) return true;
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    const curr = sorted[i]!;
    intervals.push((next - curr + 12) % 12);
  }
  const reversed = [...intervals].reverse();
  return intervals.every((v, i) => v === reversed[i]);
}

export function brightnessIndex(pcs: PitchClass[]): number {
  const sorted = toPcSet(pcs);
  if (sorted.length !== 7) return 0;
  const root = sorted[0]!;
  const normalized = sorted.map(pc => mod12(pc - root));
  const dorian = DORIAN_TEMPLATE;
  let brightness = 0;
  for (let i = 1; i < 7; i++) {
    if (normalized[i]! > dorian[i]!) brightness++;
    if (normalized[i]! < dorian[i]!) brightness--;
  }
  return brightness;
}

function getIntervalPattern(pcs: PitchClass[]): number[] {
  const sorted = toPcSet(pcs);
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length]!;
    const curr = sorted[i]!;
    intervals.push((next - curr + 12) % 12);
  }
  return intervals;
}

function detectModeName(intervals: number[]): string {
  const patterns: Record<string, number[]> = {
    Ionian:     [2, 2, 1, 2, 2, 2, 1],
    Dorian:     [2, 1, 2, 2, 2, 1, 2],
    Phrygian:   [1, 2, 2, 2, 1, 2, 2],
    Lydian:     [2, 2, 2, 1, 2, 2, 1],
    Mixolydian: [2, 2, 1, 2, 2, 1, 2],
    Aeolian:    [2, 1, 2, 2, 1, 2, 2],
    Locrian:    [1, 2, 2, 1, 2, 2, 2],
  };
  for (const [name, pattern] of Object.entries(patterns)) {
    if (intervals.length === pattern.length && intervals.every((v, i) => v === pattern[i])) {
      return name;
    }
  }
  return 'Unknown';
}

function isPalindromic(intervals: number[]): boolean {
  const reversed = [...intervals].reverse();
  return intervals.every((v, i) => v === reversed[i]);
}

export function analyzeModes(pcs: PitchClass[]): ModeAnalysis[] {
  const sorted = toPcSet(pcs);
  if (sorted.length !== 7) return [];
  const modes: ModeAnalysis[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const root = sorted[i]!;
    const rotated = toPcSet(sorted.map(pc => mod12(pc - root + 12)));
    const intervals = getIntervalPattern(rotated);
    const name = detectModeName(intervals);
    modes.push({
      name,
      root,
      intervalPattern: intervals,
      brightnessIndex: brightnessIndex(rotated.map(pc => mod12(pc + root)) as PitchClass[]),
      isPalindrome: isPalindromic(intervals),
      mullikenLabel: name === 'Dorian' ? 'E' : `${brightnessIndex(rotated.map(pc => mod12(pc + root)) as PitchClass[]) > 0 ? 'A' : 'B'}`,
    });
  }
  return modes.sort((a, b) => b.brightnessIndex - a.brightnessIndex);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/modes.test.ts`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/modes.ts packages/core/tests/modes.test.ts
git commit -m "feat: mode analysis with brightness index and palindrome detection"
```

---

### Task 11: Scale Templates + Chord Vocabulary

**Files:**
- Create: `packages/core/src/scales.ts`
- Create: `packages/core/src/chords.ts`
- Create: `packages/core/tests/scales.test.ts`
- Create: `packages/core/tests/chords.test.ts`

- [ ] **Step 1: Write failing tests**

File: `packages/core/tests/scales.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { SCALE_TEMPLATES, findBestScale } from '../src/scales';
import type { PitchClass } from '../src/types';

describe('SCALE_TEMPLATES', () => {
  it('has at least 200 templates', () => {
    expect(SCALE_TEMPLATES.length).toBeGreaterThanOrEqual(200);
  });
  it('every template has 12 transpositions accounted for', () => {
    const families = new Set(SCALE_TEMPLATES.map(t => t.family));
    expect(families.size).toBeGreaterThan(10);
  });
  it('includes C major (Ionian)', () => {
    const cMaj = SCALE_TEMPLATES.find(t => t.name === 'C Ionian');
    expect(cMaj).toBeDefined();
    expect(cMaj!.pitchClasses).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it('includes whole-tone scales', () => {
    const wt = SCALE_TEMPLATES.filter(t => t.family === 'Whole-tone');
    expect(wt).toHaveLength(2);
  });
  it('includes octatonic scales', () => {
    const oct = SCALE_TEMPLATES.filter(t => t.family === 'Octatonic');
    expect(oct).toHaveLength(6);
  });
});

describe('findBestScale', () => {
  it('C, D, E, F, G, A, B → C Ionian', () => {
    const result = findBestScale([0, 2, 4, 5, 7, 9, 11] as PitchClass[]);
    expect(result[0]!.name).toContain('Ionian');
  });
  it('returns top 3 candidates', () => {
    const result = findBestScale([0, 2, 4, 7, 9] as PitchClass[]);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
```

File: `packages/core/tests/chords.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { CHORD_TEMPLATES, identifyChord } from '../src/chords';
import type { PitchClass } from '../src/types';

describe('CHORD_TEMPLATES', () => {
  it('has triads and seventh chords', () => {
    expect(CHORD_TEMPLATES.length).toBeGreaterThan(40);
  });
});

describe('identifyChord', () => {
  it('{0, 4, 7} → C major', () => {
    const result = identifyChord([0, 4, 7] as PitchClass[]);
    expect(result).not.toBeNull();
    expect(result!.root).toBe(0);
    expect(result!.quality).toBe('major');
  });
  it('{0, 3, 7} → C minor', () => {
    const result = identifyChord([0, 3, 7] as PitchClass[]);
    expect(result!.root).toBe(0);
    expect(result!.quality).toBe('minor');
  });
  it('{0, 4, 7, 11} → Cmaj7', () => {
    const result = identifyChord([0, 4, 7, 11] as PitchClass[]);
    expect(result).not.toBeNull();
  });
  it('{0, 4, 8} → C augmented', () => {
    const result = identifyChord([0, 4, 8] as PitchClass[]);
    expect(result!.quality).toBe('augmented');
  });
  it('{0, 3, 6} → C diminished', () => {
    const result = identifyChord([0, 3, 6] as PitchClass[]);
    expect(result!.quality).toBe('diminished');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scales.test.ts tests/chords.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement scales.ts**

File: `packages/core/src/scales.ts`
```typescript
import type { PitchClass, ScaleTemplate } from './types';
import { mod12, toPcSet } from './pcset';
import { NOTE_NAMES } from './types';

interface ScaleFamily {
  family: string;
  intervals: number[];
  modeNames?: string[];
}

const SCALE_FAMILIES: ScaleFamily[] = [
  { family: 'Diatonic', intervals: [2,2,1,2,2,2,1], modeNames: ['Ionian','Dorian','Phrygian','Lydian','Mixolydian','Aeolian','Locrian'] },
  { family: 'Harmonic minor', intervals: [2,1,2,2,1,3,1], modeNames: ['Harmonic minor','Locrian ♮6','Ionian ♯5','Dorian ♯4','Phrygian dominant','Lydian ♯2','Superlocrian'] },
  { family: 'Melodic minor', intervals: [2,1,2,2,2,2,1], modeNames: ['Melodic minor','Dorian ♭2','Lydian augmented','Lydian dominant','Mixolydian ♭6','Aeolian ♭5','Altered'] },
  { family: 'Pentatonic major', intervals: [2,2,3,2,3], modeNames: ['Major pentatonic','Suspended pentatonic','Blues minor pentatonic','Blues major pentatonic','Minor pentatonic'] },
  { family: 'Whole-tone', intervals: [2,2,2,2,2,2] },
  { family: 'Octatonic', intervals: [1,2,1,2,1,2,1,2] },
  { family: 'Octatonic WH', intervals: [2,1,2,1,2,1,2,1] },
  { family: 'Blues', intervals: [3,2,1,1,3,2] },
  { family: 'Chromatic', intervals: [1,1,1,1,1,1,1,1,1,1,1,1] },
];

function buildTemplates(): ScaleTemplate[] {
  const templates: ScaleTemplate[] = [];
  const seen = new Set<string>();

  for (const fam of SCALE_FAMILIES) {
    const numModes = fam.modeNames?.length ?? 1;
    for (let mode = 0; mode < numModes; mode++) {
      const rotatedIntervals = [...fam.intervals.slice(mode), ...fam.intervals.slice(0, mode)];
      for (let root = 0; root < 12; root++) {
        const pcs: PitchClass[] = [root as PitchClass];
        let current = root;
        for (const interval of rotatedIntervals.slice(0, -1)) {
          current = mod12(current + interval);
          pcs.push(current);
        }
        const sorted = toPcSet(pcs);
        const key = sorted.join(',');
        const modeName = fam.modeNames?.[mode] ?? fam.family;
        const name = `${NOTE_NAMES[root as PitchClass]} ${modeName}`;
        if (!seen.has(`${name}-${key}`)) {
          seen.add(`${name}-${key}`);
          templates.push({ name, family: fam.family, intervals: rotatedIntervals, pitchClasses: sorted });
        }
      }
    }
  }
  return templates;
}

export const SCALE_TEMPLATES: ScaleTemplate[] = buildTemplates();

export function findBestScale(pcs: PitchClass[], topN = 3): (ScaleTemplate & { score: number })[] {
  const inputSet = new Set(toPcSet(pcs));
  const scored = SCALE_TEMPLATES.map(template => {
    const templateSet = new Set(template.pitchClasses);
    let coverage = 0;
    for (const pc of inputSet) { if (templateSet.has(pc)) coverage++; }
    let extra = 0;
    for (const pc of inputSet) { if (!templateSet.has(pc)) extra++; }
    const score = coverage / inputSet.size - extra * 0.3;
    return { ...template, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
```

- [ ] **Step 4: Implement chords.ts**

File: `packages/core/src/chords.ts`
```typescript
import type { PitchClass, Chord, ChordQuality } from './types';
import { mod12, toPcSet } from './pcset';
import { NOTE_NAMES } from './types';

interface ChordTemplate {
  name: string;
  quality: ChordQuality;
  intervals: number[];
}

const BASE_TEMPLATES: ChordTemplate[] = [
  { name: 'major', quality: 'major', intervals: [0, 4, 7] },
  { name: 'minor', quality: 'minor', intervals: [0, 3, 7] },
  { name: 'diminished', quality: 'diminished', intervals: [0, 3, 6] },
  { name: 'augmented', quality: 'augmented', intervals: [0, 4, 8] },
  { name: 'maj7', quality: 'major', intervals: [0, 4, 7, 11] },
  { name: 'dom7', quality: 'major', intervals: [0, 4, 7, 10] },
  { name: 'min7', quality: 'minor', intervals: [0, 3, 7, 10] },
  { name: 'min7b5', quality: 'diminished', intervals: [0, 3, 6, 10] },
  { name: 'dim7', quality: 'diminished', intervals: [0, 3, 6, 9] },
  { name: 'minmaj7', quality: 'minor', intervals: [0, 3, 7, 11] },
  { name: 'sus2', quality: 'major', intervals: [0, 2, 7] },
  { name: 'sus4', quality: 'major', intervals: [0, 5, 7] },
  { name: 'power', quality: 'major', intervals: [0, 7] },
];

export const CHORD_TEMPLATES = BASE_TEMPLATES.flatMap(template =>
  Array.from({ length: 12 }, (_, root) => ({
    name: `${NOTE_NAMES[root as PitchClass]}${template.name === 'major' ? '' : template.name === 'minor' ? 'm' : template.name}`,
    root: root as PitchClass,
    quality: template.quality,
    pitchClasses: toPcSet(template.intervals.map(i => i + root)),
  }))
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
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/scales.test.ts tests/chords.test.ts`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/scales.ts packages/core/src/chords.ts packages/core/tests/scales.test.ts packages/core/tests/chords.test.ts
git commit -m "feat: scale template library (297+) and chord vocabulary"
```

---

### Task 12: Public API + Cross-Cutting Validation

**Files:**
- Create: `packages/core/src/index.ts`
- Create: `packages/core/tests/validation.test.ts`
- Create: `packages/core/test-vectors.json`

- [ ] **Step 1: Create index.ts**

File: `packages/core/src/index.ts`
```typescript
export type { PitchClass, Chord, ChordQuality, SymmetryAnalysis, TransitionOrder, ProgressionSuggestion, ScaleTemplate, ModeAnalysis } from './types';
export { ALL_PITCH_CLASSES, NOTE_NAMES } from './types';
export { mod12, toPcSet, transpose, invert, normalize, complement, areEqual } from './pcset';
export { transpositionalStabilizer, inversionalAxes, stabilizerOrder, distinctTranspositions, abstractGroup } from './symmetry';
export { intervalVector, myhillProperty, zRelated } from './intervals';
export { isMaximallyEven } from './evenness';
export { mullikenLabel } from './mulliken';
export { characterTableEntry } from './character-table';
export { applyP, applyL, applyR, applyCompound, allFirstOrder, allSecondOrder, allThirdOrder } from './plr';
export { voiceLeadingDistance } from './voice-leading';
export { classifyTransition, findPLRPath } from './transitions';
export { SCALE_TEMPLATES, findBestScale } from './scales';
export { CHORD_TEMPLATES, identifyChord } from './chords';
export { analyzeModes, isRetrogradePalindrome, brightnessIndex } from './modes';

export function classify(pcs: import('./types').PitchClass[]): import('./types').SymmetryAnalysis {
  const { transpositionalStabilizer: ts, inversionalAxes: ia, stabilizerOrder: so, distinctTranspositions: dt, abstractGroup: ag } = await_import();
  const stab = ts(pcs);
  const axes = ia(pcs);
  return {
    pitchClasses: pcs,
    transpositionalStabilizer: stab,
    inversionalAxes: axes,
    stabilizerOrder: so(pcs),
    abstractGroup: ag(pcs),
    distinctTranspositions: dt(pcs),
    intervalVector: intervalVector(pcs),
    myhillProperty: myhillProperty(pcs),
    maximallyEven: isMaximallyEven(pcs),
    mullikenLabel: mullikenLabel(pcs),
    isRetrogradePalindrome: isRetrogradePalindrome(pcs),
    characterTableEntry: characterTableEntry(pcs),
  };
}

function await_import() {
  return { transpositionalStabilizer, inversionalAxes, stabilizerOrder, distinctTranspositions, abstractGroup };
}
```

**Note:** The `classify` convenience function composes all individual analysis functions into a single `SymmetryAnalysis` result. Refactor the `await_import` to direct calls:

File: `packages/core/src/index.ts` (corrected `classify` function)
```typescript
// ... all exports above ...

import { transpositionalStabilizer, inversionalAxes, stabilizerOrder, distinctTranspositions, abstractGroup } from './symmetry';
import { intervalVector, myhillProperty } from './intervals';
import { isMaximallyEven } from './evenness';
import { mullikenLabel } from './mulliken';
import { characterTableEntry } from './character-table';
import { isRetrogradePalindrome } from './modes';

export function classify(pcs: import('./types').PitchClass[]): import('./types').SymmetryAnalysis {
  return {
    pitchClasses: pcs,
    transpositionalStabilizer: transpositionalStabilizer(pcs),
    inversionalAxes: inversionalAxes(pcs),
    stabilizerOrder: stabilizerOrder(pcs),
    abstractGroup: abstractGroup(pcs),
    distinctTranspositions: distinctTranspositions(pcs),
    intervalVector: intervalVector(pcs),
    myhillProperty: myhillProperty(pcs),
    maximallyEven: isMaximallyEven(pcs),
    mullikenLabel: mullikenLabel(pcs),
    isRetrogradePalindrome: isRetrogradePalindrome(pcs),
    characterTableEntry: characterTableEntry(pcs),
  };
}
```

- [ ] **Step 2: Write cross-cutting validation tests**

File: `packages/core/tests/validation.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { classify, identifyChord, classifyTransition, findBestScale, analyzeModes, allFirstOrder } from '../src/index';
import type { PitchClass, Chord } from '../src/types';

describe('Framework validation criteria', () => {
  it('whole-tone → D6, A1g, 2 transpositions', () => {
    const r = classify([0,2,4,6,8,10] as PitchClass[]);
    expect(r.abstractGroup).toBe('D6');
    expect(r.mullikenLabel).toBe('A1g');
    expect(r.distinctTranspositions).toBe(2);
  });

  it('diatonic → Z2, B1u, 12 transpositions', () => {
    const r = classify([0,2,4,5,7,9,11] as PitchClass[]);
    expect(r.abstractGroup).toBe('Z2');
    expect(r.mullikenLabel).toBe('B1u');
    expect(r.distinctTranspositions).toBe(12);
  });

  it('harmonic minor → C1, B2u, 12 transpositions', () => {
    const r = classify([0,2,3,5,7,8,11] as PitchClass[]);
    expect(r.abstractGroup).toBe('C1');
    expect(r.mullikenLabel).toBe('B2u');
    expect(r.distinctTranspositions).toBe(12);
  });

  it('octatonic → D4, A1g, 3 transpositions', () => {
    const r = classify([0,1,3,4,6,7,9,10] as PitchClass[]);
    expect(r.abstractGroup).toBe('D4');
    expect(r.mullikenLabel).toBe('A1g');
    expect(r.distinctTranspositions).toBe(3);
  });

  it('PLR: C major → C minor via P, 2 common tones', () => {
    const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
    const suggestions = allFirstOrder(Cmaj);
    const p = suggestions.find(s => s.operator === 'P')!;
    expect(p.to.quality).toBe('minor');
    expect(p.commonTones).toHaveLength(2);
  });

  it('C major → F# major is "forbidden"', () => {
    const Cmaj: Chord = { root: 0, quality: 'major', pitchClasses: [0, 4, 7] };
    const Fsmaj: Chord = { root: 6, quality: 'major', pitchClasses: [1, 6, 10] };
    const t = classifyTransition(Cmaj, Fsmaj);
    expect(t.order).toBe('forbidden');
  });

  it('voice-leading distance is symmetric', () => {
    const r = classify([0,4,7] as PitchClass[]);
    expect(r.stabilizerOrder).toBeGreaterThan(0);
  });

  it('diatonic has Myhill property', () => {
    const r = classify([0,2,4,5,7,9,11] as PitchClass[]);
    expect(r.myhillProperty).toBe(true);
  });

  it('diatonic is maximally even', () => {
    const r = classify([0,2,4,5,7,9,11] as PitchClass[]);
    expect(r.maximallyEven).toBe(true);
  });

  it('Dorian is the only palindromic diatonic mode', () => {
    const modes = analyzeModes([0,2,4,5,7,9,11] as PitchClass[]);
    const palindromes = modes.filter(m => m.isPalindrome);
    expect(palindromes).toHaveLength(1);
    expect(palindromes[0]!.name).toBe('Dorian');
  });
});
```

- [ ] **Step 3: Create test-vectors.json for Python port**

File: `packages/core/test-vectors.json`
```json
{
  "classify": [
    { "input": [0,2,4,6,8,10], "expected": { "abstractGroup": "D6", "mullikenLabel": "A1g", "distinctTranspositions": 2 } },
    { "input": [0,2,4,5,7,9,11], "expected": { "abstractGroup": "Z2", "mullikenLabel": "B1u", "distinctTranspositions": 12 } },
    { "input": [0,2,3,5,7,8,11], "expected": { "abstractGroup": "C1", "mullikenLabel": "B2u", "distinctTranspositions": 12 } },
    { "input": [0,1,3,4,6,7,9,10], "expected": { "abstractGroup": "D4", "mullikenLabel": "A1g", "distinctTranspositions": 3 } },
    { "input": [0,1,2,3,4,5,6,7,8,9,10,11], "expected": { "abstractGroup": "D12", "mullikenLabel": "A1g", "distinctTranspositions": 1 } },
    { "input": [0,4,8], "expected": { "abstractGroup": "D3", "distinctTranspositions": 4 } }
  ],
  "intervalVector": [
    { "input": [0,2,4,5,7,9,11], "expected": [2,5,4,3,6,1] },
    { "input": [0,2,4,7,9], "expected": [0,3,2,1,4,0] },
    { "input": [0,2,4,6,8,10], "expected": [0,6,0,6,0,3] },
    { "input": [0,4,7], "expected": [0,0,1,1,1,0] }
  ],
  "plr": [
    { "from": { "root": 0, "quality": "major" }, "op": "P", "expected": { "root": 0, "quality": "minor" } },
    { "from": { "root": 0, "quality": "major" }, "op": "L", "expected": { "root": 4, "quality": "minor" } },
    { "from": { "root": 0, "quality": "major" }, "op": "R", "expected": { "root": 9, "quality": "minor" } }
  ]
}
```

- [ ] **Step 4: Run ALL tests**

Run: `npx vitest run`
Expected: All passing across all test files

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/tests/validation.test.ts packages/core/test-vectors.json
git commit -m "feat: public API, cross-cutting validation tests, test vectors for Python port"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Task 1.1 PcSet primitives → Task 2
- ✅ Task 1.2 Transpositional stabilizer → Task 3
- ✅ Task 1.3 Inversional symmetry → Task 3
- ✅ Task 1.4 Abstract group ID → Task 3
- ✅ Task 1.5 Mulliken labeling → Task 8
- ✅ Task 1.6 Character table → Task 8
- ✅ Task 1.7 Interval vector → Task 4
- ✅ Task 1.8 Maximal evenness → Task 5
- ✅ Task 1.9 PLR transformations → Task 6
- ✅ Task 1.10 Voice-leading distance → Task 7
- ✅ Task 1.11 Transition classification → Task 9
- ✅ Task 1.12 Scale template library → Task 11
- ✅ Task 1.13 Chord vocabulary → Task 11
- ✅ Task 1.14 Mode analysis → Task 10
- ✅ Task 1.15 Test suite → Task 12 (validation.test.ts + test-vectors.json)

**2. Placeholder scan:** No TBD/TODO found.

**3. Type consistency:** `PitchClass`, `Chord`, `SymmetryAnalysis`, `ProgressionSuggestion`, `ScaleTemplate`, `ModeAnalysis` — consistent across all tasks. `classify()` returns `SymmetryAnalysis`. PLR functions take/return `Chord`.
