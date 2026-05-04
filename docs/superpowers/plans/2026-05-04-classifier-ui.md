# Classifier UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive web UI that classifies pitch-class sets by symmetry group and suggests progressions via PLR selection rules.

**Architecture:** Vite + React SPA importing @musical-symmetry/core. All computation is client-side. Visualizations (Tonnetz, orbit) use D3.js SVGs. Audio via Tone.js.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, D3.js, Tone.js, Docker/nginx

---

## Task 1: Project Scaffold

- [ ] Create Vite + React + TypeScript project at `packages/ui/`
- [ ] Configure Tailwind CSS v3
- [ ] Link `@musical-symmetry/core` as workspace dependency
- [ ] Add root `package.json` with workspaces field
- [ ] Verify `npm install` and `npm run dev` work

### Files to Create

**`/package.json`** (root workspace config)
```json
{
  "name": "musical-symmetry",
  "private": true,
  "workspaces": [
    "packages/core",
    "packages/ui"
  ]
}
```

**`packages/ui/package.json`**
```json
{
  "name": "@musical-symmetry/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@musical-symmetry/core": "workspace:*",
    "d3": "^7.9.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tone": "^15.0.4"
  },
  "devDependencies": {
    "@testing-library/react": "^14.2.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@types/d3": "^7.4.3",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.0",
    "vite": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

**`packages/ui/vite.config.ts`**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3009,
  },
  build: {
    outDir: 'dist',
  },
});
```

**`packages/ui/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

**`packages/ui/tailwind.config.js`**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        order1: '#22c55e',
        order2: '#eab308',
        order3: '#ef4444',
      },
    },
  },
  plugins: [],
};
```

**`packages/ui/postcss.config.js`**
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**`packages/ui/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Musical Symmetry Classifier</title>
  </head>
  <body class="bg-gray-900 text-white min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`packages/ui/src/main.tsx`**
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**`packages/ui/src/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**`packages/ui/src/App.tsx`**
```tsx
import { useReducer } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

export type Action =
  | { type: 'TOGGLE_PC'; pc: PitchClass }
  | { type: 'SET_PCS'; pcs: PitchClass[] }
  | { type: 'CLEAR' };

export interface AppState {
  selectedPCs: PitchClass[];
}

const initialState: AppState = { selectedPCs: [] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'TOGGLE_PC': {
      const has = state.selectedPCs.includes(action.pc);
      return {
        selectedPCs: has
          ? state.selectedPCs.filter(p => p !== action.pc)
          : [...state.selectedPCs, action.pc].sort((a, b) => a - b),
      };
    }
    case 'SET_PCS':
      return { selectedPCs: [...action.pcs].sort((a, b) => a - b) };
    case 'CLEAR':
      return { selectedPCs: [] };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Musical Symmetry Classifier</h1>
        <p className="text-gray-400 mt-1">
          Select pitch classes to analyze symmetry groups and explore progressions
        </p>
      </header>
      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Piano, Text Input, Classification, Progressions */}
          <p className="text-gray-500">
            Selected: {JSON.stringify(state.selectedPCs)}
          </p>
          <button
            onClick={() => dispatch({ type: 'CLEAR' })}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        <div className="space-y-6">
          {/* Tonnetz, Orbit, Mode Explorer */}
        </div>
      </main>
    </div>
  );
}
```

### Test Command
```bash
cd packages/ui && npm run typecheck
```

### Commit Message
```
feat(ui): scaffold Vite + React + Tailwind project with workspace link
```

---

## Task 2: App Shell + State Management

- [ ] Create `useClassifier` hook that wraps `classify()` and memoizes results
- [ ] Create `useChord` hook that identifies chord from selected PCs
- [ ] Wire hooks into App, pass state down via props (no context needed at this scale)
- [ ] Create test file verifying hook logic

### Files to Create

**`packages/ui/src/hooks/useClassifier.ts`**
```typescript
import { useMemo } from 'react';
import { classify } from '@musical-symmetry/core';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';

export function useClassifier(pcs: PitchClass[]): SymmetryAnalysis | null {
  return useMemo(() => {
    if (pcs.length < 2) return null;
    return classify(pcs);
  }, [pcs.join(',')]);
}
```

**`packages/ui/src/hooks/useChord.ts`**
```typescript
import { useMemo } from 'react';
import { identifyChord } from '@musical-symmetry/core';
import type { PitchClass, Chord } from '@musical-symmetry/core';

export function useChord(pcs: PitchClass[]): Chord | null {
  return useMemo(() => {
    if (pcs.length !== 3) return null;
    return identifyChord(pcs);
  }, [pcs.join(',')]);
}
```

**`packages/ui/src/hooks/__tests__/useClassifier.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

describe('classify integration', () => {
  it('classifies C major triad', () => {
    const result = classify([0, 4, 7] as PitchClass[]);
    expect(result.intervalVector).toEqual([0, 0, 1, 1, 1, 0]);
    expect(result.abstractGroup).toBeDefined();
  });

  it('classifies augmented triad as highly symmetric', () => {
    const result = classify([0, 4, 8] as PitchClass[]);
    expect(result.stabilizerOrder).toBeGreaterThan(1);
  });

  it('returns null-safe for empty', () => {
    const result = classify([] as PitchClass[]);
    expect(result).toBeDefined();
  });
});
```

**`packages/ui/src/vitest.setup.ts`**
```typescript
import '@testing-library/jest-dom';
```

Add to `packages/ui/vite.config.ts` (replace entire file):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3009,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    globals: true,
  },
});
```

### Test Command
```bash
cd packages/ui && npm test
```

### Commit Message
```
feat(ui): add useClassifier and useChord hooks with tests
```

---

## Task 3: Piano Keyboard Input Component

- [ ] Build 1-octave piano SVG with clickable keys
- [ ] White keys and black keys rendered proportionally
- [ ] Active notes highlighted (green for selected)
- [ ] Dispatch TOGGLE_PC on click

### Files to Create

**`packages/ui/src/components/PianoKeyboard.tsx`**
```tsx
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  selectedPCs: PitchClass[];
  onToggle: (pc: PitchClass) => void;
}

const WHITE_KEYS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
const BLACK_KEYS: { pc: PitchClass; offset: number }[] = [
  { pc: 1, offset: 1 },
  { pc: 3, offset: 2 },
  { pc: 6, offset: 4 },
  { pc: 8, offset: 5 },
  { pc: 10, offset: 6 },
];

const WHITE_WIDTH = 40;
const WHITE_HEIGHT = 150;
const BLACK_WIDTH = 24;
const BLACK_HEIGHT = 95;
const TOTAL_WIDTH = WHITE_WIDTH * 7;

export default function PianoKeyboard({ selectedPCs, onToggle }: Props) {
  const isSelected = (pc: PitchClass) => selectedPCs.includes(pc);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Piano Input</h2>
      <svg
        viewBox={`0 0 ${TOTAL_WIDTH} ${WHITE_HEIGHT}`}
        className="w-full max-w-md cursor-pointer"
        aria-label="Piano keyboard"
      >
        {/* White keys */}
        {WHITE_KEYS.map((pc, i) => (
          <rect
            key={`w-${pc}`}
            x={i * WHITE_WIDTH}
            y={0}
            width={WHITE_WIDTH - 2}
            height={WHITE_HEIGHT}
            rx={3}
            className={
              isSelected(pc)
                ? 'fill-green-500 stroke-green-700'
                : 'fill-white stroke-gray-300 hover:fill-gray-100'
            }
            strokeWidth={1}
            onClick={() => onToggle(pc)}
          />
        ))}
        {/* Black keys */}
        {BLACK_KEYS.map(({ pc, offset }) => (
          <rect
            key={`b-${pc}`}
            x={offset * WHITE_WIDTH - BLACK_WIDTH / 2}
            y={0}
            width={BLACK_WIDTH}
            height={BLACK_HEIGHT}
            rx={2}
            className={
              isSelected(pc)
                ? 'fill-green-600 stroke-green-800'
                : 'fill-gray-900 stroke-gray-700 hover:fill-gray-800'
            }
            strokeWidth={1}
            onClick={() => onToggle(pc)}
          />
        ))}
        {/* Labels on white keys */}
        {WHITE_KEYS.map((pc, i) => (
          <text
            key={`label-${pc}`}
            x={i * WHITE_WIDTH + WHITE_WIDTH / 2 - 1}
            y={WHITE_HEIGHT - 10}
            textAnchor="middle"
            className="text-[9px] fill-gray-500 pointer-events-none select-none"
          >
            {NOTE_NAMES[pc]}
          </text>
        ))}
      </svg>
    </div>
  );
}
```

**`packages/ui/src/components/__tests__/PianoKeyboard.test.tsx`**
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PianoKeyboard from '../PianoKeyboard';
import type { PitchClass } from '@musical-symmetry/core';

describe('PianoKeyboard', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <PianoKeyboard selectedPCs={[]} onToggle={() => {}} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onToggle when a key is clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <PianoKeyboard selectedPCs={[]} onToggle={onToggle} />
    );
    const rects = container.querySelectorAll('rect');
    fireEvent.click(rects[0]!);
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it('highlights selected pitch classes', () => {
    const { container } = render(
      <PianoKeyboard selectedPCs={[0, 4, 7] as PitchClass[]} onToggle={() => {}} />
    );
    const rects = container.querySelectorAll('rect');
    // First white key (C=0) should have green fill class
    expect(rects[0]!.getAttribute('class')).toContain('green');
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Piano
```

### Commit Message
```
feat(ui): add interactive piano keyboard component
```

---

## Task 4: Classification Panel

- [ ] Display SymmetryAnalysis results in a structured card
- [ ] Show: abstract group, Mulliken label, interval vector, properties
- [ ] Handle null state (less than 2 notes selected)
- [ ] Show identified chord name when applicable

### Files to Create

**`packages/ui/src/components/ClassificationPanel.tsx`**
```tsx
import type { SymmetryAnalysis, Chord } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  analysis: SymmetryAnalysis | null;
  chord: Chord | null;
}

function PropertyBadge({ label, value, color = 'blue' }: { label: string; value: string | boolean; color?: string }) {
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  const colorClass = typeof value === 'boolean'
    ? value ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
    : `bg-${color}-900 text-${color}-300`;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`px-2 py-0.5 rounded text-xs font-mono ${colorClass}`}>
        {displayValue}
      </span>
    </div>
  );
}

export default function ClassificationPanel({ analysis, chord }: Props) {
  if (!analysis) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Classification</h2>
        <p className="text-gray-500 text-sm italic">Select at least 2 pitch classes to analyze</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Classification</h2>

      {chord && (
        <div className="mb-3 pb-3 border-b border-gray-700">
          <span className="text-lg font-bold text-white">
            {NOTE_NAMES[chord.root]} {chord.quality}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <PropertyBadge label="Abstract Group" value={analysis.abstractGroup} />
        <PropertyBadge label="Mulliken Label" value={analysis.mullikenLabel} />
        <PropertyBadge
          label="Interval Vector"
          value={`[${analysis.intervalVector.join(', ')}]`}
        />
        <PropertyBadge
          label="Stabilizer Order"
          value={String(analysis.stabilizerOrder)}
        />
        <PropertyBadge
          label="Distinct Transpositions"
          value={String(analysis.distinctTranspositions)}
        />
        <PropertyBadge label="Maximally Even" value={analysis.maximallyEven} />
        <PropertyBadge label="Myhill Property" value={analysis.myhillProperty} />
        <PropertyBadge label="Palindromic" value={analysis.isRetrogradePalindrome} />
      </div>

      {analysis.characterTableEntry && Object.keys(analysis.characterTableEntry).length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Character Table</h3>
          <div className="grid grid-cols-3 gap-1 text-xs font-mono">
            {Object.entries(analysis.characterTableEntry).map(([op, val]) => (
              <div key={op} className="flex justify-between bg-gray-900 px-2 py-1 rounded">
                <span className="text-gray-400">{op}</span>
                <span className={val === 1 ? 'text-green-400' : 'text-red-400'}>
                  {val === 1 ? '+1' : '-1'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**`packages/ui/src/components/__tests__/ClassificationPanel.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ClassificationPanel from '../ClassificationPanel';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

describe('ClassificationPanel', () => {
  it('shows placeholder when analysis is null', () => {
    const { getByText } = render(
      <ClassificationPanel analysis={null} chord={null} />
    );
    expect(getByText(/Select at least 2/)).toBeInTheDocument();
  });

  it('displays analysis results', () => {
    const analysis = classify([0, 4, 7] as PitchClass[]);
    const { getByText } = render(
      <ClassificationPanel analysis={analysis} chord={null} />
    );
    expect(getByText('Abstract Group')).toBeInTheDocument();
    expect(getByText('Mulliken Label')).toBeInTheDocument();
  });

  it('displays chord name when provided', () => {
    const analysis = classify([0, 4, 7] as PitchClass[]);
    const chord = { root: 0 as PitchClass, quality: 'major' as const, pitchClasses: [0, 4, 7] as PitchClass[] };
    const { getByText } = render(
      <ClassificationPanel analysis={analysis} chord={chord} />
    );
    expect(getByText(/C major/)).toBeInTheDocument();
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Classification
```

### Commit Message
```
feat(ui): add classification panel displaying symmetry analysis
```

---

## Task 5: Progression Suggestions Panel

- [ ] Show 1st, 2nd, 3rd order suggestions in expandable sections
- [ ] Color-code by order (green/yellow/red)
- [ ] Display operator, target chord, common tones, VL distance
- [ ] Only render when a valid triad is selected

### Files to Create

**`packages/ui/src/components/ProgressionPanel.tsx`**
```tsx
import { useMemo, useState } from 'react';
import { allFirstOrder, allSecondOrder, allThirdOrder, NOTE_NAMES } from '@musical-symmetry/core';
import type { Chord, ProgressionSuggestion, PitchClass } from '@musical-symmetry/core';

interface Props {
  chord: Chord | null;
}

const ORDER_COLORS = {
  1: { bg: 'bg-green-900/50', border: 'border-green-700', text: 'text-green-400', label: '1st Order' },
  2: { bg: 'bg-yellow-900/50', border: 'border-yellow-700', text: 'text-yellow-400', label: '2nd Order' },
  3: { bg: 'bg-red-900/50', border: 'border-red-700', text: 'text-red-400', label: '3rd Order' },
};

function SuggestionRow({ s }: { s: ProgressionSuggestion }) {
  const order = s.order as 1 | 2 | 3;
  const colors = ORDER_COLORS[order];

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded ${colors.bg} border ${colors.border}`}>
      <div className="flex items-center gap-3">
        <span className={`font-mono font-bold ${colors.text}`}>{s.operator}</span>
        <span className="text-white text-sm">
          {NOTE_NAMES[s.to.root]} {s.to.quality}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>CT: {s.commonTones.map(pc => NOTE_NAMES[pc as PitchClass]).join(', ') || 'none'}</span>
        <span>VL: {s.voiceLeadingDistance}</span>
      </div>
    </div>
  );
}

export default function ProgressionPanel({ chord }: Props) {
  const [expandedOrder, setExpandedOrder] = useState<number>(1);

  const suggestions = useMemo(() => {
    if (!chord || (chord.quality !== 'major' && chord.quality !== 'minor')) return null;
    return {
      first: allFirstOrder(chord),
      second: allSecondOrder(chord),
      third: allThirdOrder(chord),
    };
  }, [chord?.root, chord?.quality]);

  if (!suggestions) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Progressions</h2>
        <p className="text-gray-500 text-sm italic">Select a major or minor triad to see suggestions</p>
      </div>
    );
  }

  const sections = [
    { order: 1, items: suggestions.first },
    { order: 2, items: suggestions.second },
    { order: 3, items: suggestions.third },
  ] as const;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Progressions</h2>

      <div className="flex gap-2 mb-4">
        {sections.map(({ order }) => {
          const colors = ORDER_COLORS[order];
          return (
            <button
              key={order}
              onClick={() => setExpandedOrder(order)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                expandedOrder === order
                  ? `${colors.bg} ${colors.text} border ${colors.border}`
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {colors.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {sections
          .filter(s => s.order === expandedOrder)
          .flatMap(s => s.items)
          .map((s, i) => (
            <SuggestionRow key={i} s={s} />
          ))}
      </div>
    </div>
  );
}
```

**`packages/ui/src/components/__tests__/ProgressionPanel.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProgressionPanel from '../ProgressionPanel';
import type { PitchClass, Chord } from '@musical-symmetry/core';

describe('ProgressionPanel', () => {
  it('shows placeholder when no chord', () => {
    const { getByText } = render(<ProgressionPanel chord={null} />);
    expect(getByText(/Select a major or minor/)).toBeInTheDocument();
  });

  it('renders suggestions for C major', () => {
    const chord: Chord = { root: 0 as PitchClass, quality: 'major', pitchClasses: [0, 4, 7] as PitchClass[] };
    const { getByText } = render(<ProgressionPanel chord={chord} />);
    expect(getByText('P')).toBeInTheDocument();
    expect(getByText('L')).toBeInTheDocument();
    expect(getByText('R')).toBeInTheDocument();
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Progression
```

### Commit Message
```
feat(ui): add PLR progression suggestions panel with order tabs
```

---

## Task 6: Pitch-Class Clock / Orbit Diagram

- [ ] Draw 12-position clock face (SVG circle with PC labels)
- [ ] Highlight selected pitch classes
- [ ] Draw symmetry axes (inversional axes as dashed lines through center)
- [ ] Show transpositional stabilizer as arc annotations

### Files to Create

**`packages/ui/src/components/OrbitDiagram.tsx`**
```tsx
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  selectedPCs: PitchClass[];
  analysis: SymmetryAnalysis | null;
}

const CX = 150;
const CY = 150;
const RADIUS = 120;
const DOT_RADIUS = 14;

function pcToXY(pc: PitchClass, radius = RADIUS): [number, number] {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

export default function OrbitDiagram({ selectedPCs, analysis }: Props) {
  const allPCs: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // Draw axes for inversional symmetry
  const axes: [number, number, number, number][] = [];
  if (analysis) {
    for (const axis of analysis.inversionalAxes) {
      const [x1, y1] = pcToXY(axis as PitchClass, RADIUS + 15);
      const opposite = ((axis + 6) % 12) as PitchClass;
      const [x2, y2] = pcToXY(opposite, RADIUS + 15);
      axes.push([x1, y1, x2, y2]);
    }
  }

  // Polygon connecting selected PCs
  const polygonPoints = selectedPCs
    .map(pc => pcToXY(pc).join(','))
    .join(' ');

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Orbit Diagram</h2>
      <svg viewBox="0 0 300 300" className="w-full max-w-sm mx-auto">
        {/* Outer circle */}
        <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#374151" strokeWidth={1} />

        {/* Symmetry axes */}
        {axes.map(([x1, y1, x2, y2], i) => (
          <line
            key={`axis-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.6}
          />
        ))}

        {/* Polygon connecting selected notes */}
        {selectedPCs.length >= 3 && (
          <polygon
            points={polygonPoints}
            fill="rgba(34, 197, 94, 0.15)"
            stroke="#22c55e"
            strokeWidth={1.5}
          />
        )}

        {/* Lines for 2 notes */}
        {selectedPCs.length === 2 && (
          <line
            x1={pcToXY(selectedPCs[0]!)[0]}
            y1={pcToXY(selectedPCs[0]!)[1]}
            x2={pcToXY(selectedPCs[1]!)[0]}
            y2={pcToXY(selectedPCs[1]!)[1]}
            stroke="#22c55e"
            strokeWidth={1.5}
          />
        )}

        {/* PC nodes */}
        {allPCs.map(pc => {
          const [x, y] = pcToXY(pc);
          const isActive = selectedPCs.includes(pc);
          return (
            <g key={pc}>
              <circle
                cx={x}
                cy={y}
                r={DOT_RADIUS}
                fill={isActive ? '#22c55e' : '#1f2937'}
                stroke={isActive ? '#16a34a' : '#4b5563'}
                strokeWidth={1.5}
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="text-[10px] select-none pointer-events-none"
                fill={isActive ? '#fff' : '#9ca3af'}
              >
                {NOTE_NAMES[pc]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

**`packages/ui/src/components/__tests__/OrbitDiagram.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import OrbitDiagram from '../OrbitDiagram';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

describe('OrbitDiagram', () => {
  it('renders SVG with 12 nodes', () => {
    const { container } = render(
      <OrbitDiagram selectedPCs={[]} analysis={null} />
    );
    const circles = container.querySelectorAll('circle');
    // 1 outer ring + 12 pc nodes = 13
    expect(circles.length).toBe(13);
  });

  it('highlights selected PCs', () => {
    const pcs = [0, 4, 7] as PitchClass[];
    const analysis = classify(pcs);
    const { container } = render(
      <OrbitDiagram selectedPCs={pcs} analysis={analysis} />
    );
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Orbit
```

### Commit Message
```
feat(ui): add pitch-class clock orbit diagram with symmetry axes
```

---

## Task 7: Tonnetz Visualization (D3.js)

- [ ] Render triangular lattice (P/L/R edges)
- [ ] Highlight current chord as filled triangle
- [ ] Show PLR arrows when progression is selected
- [ ] Pan/zoom via D3 zoom behavior

### Files to Create

**`packages/ui/src/components/TonnetzViz.tsx`**
```tsx
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { Chord, PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  chord: Chord | null;
  targetChord: Chord | null;
}

interface TonnetzNode {
  pc: PitchClass;
  x: number;
  y: number;
}

// Generate Tonnetz grid: x-axis = perfect 5ths (7), y-axis = major 3rds (4)
function generateGrid(cols: number, rows: number): TonnetzNode[] {
  const nodes: TonnetzNode[] = [];
  const spacing = 60;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pc = ((col * 7 + row * 4) % 12) as PitchClass;
      const x = col * spacing + (row % 2) * (spacing / 2);
      const y = row * spacing * 0.866;
      nodes.push({ pc, x, y });
    }
  }
  return nodes;
}

// Find triangles (major = root+4+7, minor = root+3+7 in pc space)
function findTriangles(nodes: TonnetzNode[], chord: Chord): [TonnetzNode, TonnetzNode, TonnetzNode][] {
  const [p0, p1, p2] = chord.pitchClasses;
  const results: [TonnetzNode, TonnetzNode, TonnetzNode][] = [];

  for (const n0 of nodes.filter(n => n.pc === p0)) {
    for (const n1 of nodes.filter(n => n.pc === p1)) {
      const dist01 = Math.hypot(n1.x - n0.x, n1.y - n0.y);
      if (dist01 > 80) continue;
      for (const n2 of nodes.filter(n => n.pc === p2)) {
        const dist02 = Math.hypot(n2.x - n0.x, n2.y - n0.y);
        const dist12 = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        if (dist02 < 80 && dist12 < 80) {
          results.push([n0, n1, n2]);
        }
      }
    }
  }
  return results;
}

export default function TonnetzViz({ chord, targetChord }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const COLS = 8;
  const ROWS = 5;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 500;
    const height = 280;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', 'translate(20, 20)');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    const nodes = generateGrid(COLS, ROWS);

    // Draw edges between nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.hypot(nodes[j]!.x - nodes[i]!.x, nodes[j]!.y - nodes[i]!.y);
        if (dist < 70) {
          g.append('line')
            .attr('x1', nodes[i]!.x).attr('y1', nodes[i]!.y)
            .attr('x2', nodes[j]!.x).attr('y2', nodes[j]!.y)
            .attr('stroke', '#374151')
            .attr('stroke-width', 0.5);
        }
      }
    }

    // Highlight chord triangles
    if (chord) {
      const triangles = findTriangles(nodes, chord);
      for (const [a, b, c] of triangles) {
        g.append('polygon')
          .attr('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`)
          .attr('fill', 'rgba(34, 197, 94, 0.3)')
          .attr('stroke', '#22c55e')
          .attr('stroke-width', 1.5);
      }
    }

    // Highlight target chord
    if (targetChord) {
      const triangles = findTriangles(nodes, targetChord);
      for (const [a, b, c] of triangles) {
        g.append('polygon')
          .attr('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`)
          .attr('fill', 'rgba(234, 179, 8, 0.25)')
          .attr('stroke', '#eab308')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3 2');
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const isInChord = chord?.pitchClasses.includes(node.pc);
      g.append('circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', 12)
        .attr('fill', isInChord ? '#22c55e' : '#1f2937')
        .attr('stroke', isInChord ? '#16a34a' : '#4b5563')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', node.x)
        .attr('y', node.y + 3.5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', isInChord ? '#fff' : '#9ca3af')
        .text(NOTE_NAMES[node.pc]);
    }
  }, [chord, targetChord]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Tonnetz</h2>
      <svg ref={svgRef} className="w-full" style={{ minHeight: '240px' }} />
    </div>
  );
}
```

**`packages/ui/src/components/__tests__/TonnetzViz.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TonnetzViz from '../TonnetzViz';
import type { PitchClass, Chord } from '@musical-symmetry/core';

describe('TonnetzViz', () => {
  it('renders SVG element', () => {
    const { container } = render(<TonnetzViz chord={null} targetChord={null} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with a chord without crashing', () => {
    const chord: Chord = { root: 0 as PitchClass, quality: 'major', pitchClasses: [0, 4, 7] as PitchClass[] };
    const { container } = render(<TonnetzViz chord={chord} targetChord={null} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Tonnetz
```

### Commit Message
```
feat(ui): add D3.js Tonnetz triangular lattice visualization
```

---

## Task 8: Mode Explorer Panel

- [ ] Display all modes of the current scale (7-note sets only)
- [ ] Show brightness index, palindrome status
- [ ] Sort by brightness (brightest first)
- [ ] Click a mode to select its pitch classes

### Files to Create

**`packages/ui/src/components/ModeExplorer.tsx`**
```tsx
import { useMemo } from 'react';
import { analyzeModes, NOTE_NAMES } from '@musical-symmetry/core';
import type { PitchClass, ModeAnalysis } from '@musical-symmetry/core';

interface Props {
  selectedPCs: PitchClass[];
  onSelectMode: (pcs: PitchClass[]) => void;
}

function BrightnessBar({ index }: { index: number }) {
  // Range is typically -3 to +3 for diatonic modes
  const normalized = (index + 3) / 6;
  const width = Math.max(5, Math.min(100, normalized * 100));
  const color = index > 0 ? 'bg-yellow-400' : index < 0 ? 'bg-blue-400' : 'bg-gray-400';
  return (
    <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ModeExplorer({ selectedPCs, onSelectMode }: Props) {
  const modes = useMemo(() => {
    if (selectedPCs.length !== 7) return [];
    return analyzeModes(selectedPCs);
  }, [selectedPCs.join(',')]);

  if (selectedPCs.length !== 7) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Mode Explorer</h2>
        <p className="text-gray-500 text-sm italic">Select exactly 7 pitch classes to explore modes</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Mode Explorer</h2>
      <div className="space-y-2">
        {modes.map((mode: ModeAnalysis, i: number) => (
          <button
            key={i}
            onClick={() => {
              const pcs = mode.intervalPattern.reduce<PitchClass[]>(
                (acc, interval) => {
                  const last = acc[acc.length - 1]!;
                  const next = ((last + interval) % 12) as PitchClass;
                  return [...acc, next];
                },
                [mode.root],
              ).slice(0, 7);
              onSelectMode(pcs);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded bg-gray-900 hover:bg-gray-700 transition-colors text-left"
          >
            <span className="text-white font-medium w-24 shrink-0">
              {NOTE_NAMES[mode.root]} {mode.name}
            </span>
            <BrightnessBar index={mode.brightnessIndex} />
            <span className="text-xs text-gray-400 w-8 text-right">
              {mode.brightnessIndex > 0 ? '+' : ''}{mode.brightnessIndex}
            </span>
            {mode.isPalindrome && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300">
                palindrome
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**`packages/ui/src/components/__tests__/ModeExplorer.test.tsx`**
```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ModeExplorer from '../ModeExplorer';
import type { PitchClass } from '@musical-symmetry/core';

describe('ModeExplorer', () => {
  it('shows placeholder for non-7-note sets', () => {
    const { getByText } = render(
      <ModeExplorer selectedPCs={[0, 4, 7] as PitchClass[]} onSelectMode={() => {}} />
    );
    expect(getByText(/Select exactly 7/)).toBeInTheDocument();
  });

  it('renders modes for C major scale', () => {
    const cMajor = [0, 2, 4, 5, 7, 9, 11] as PitchClass[];
    const { getByText } = render(
      <ModeExplorer selectedPCs={cMajor} onSelectMode={() => {}} />
    );
    expect(getByText(/Ionian/)).toBeInTheDocument();
    expect(getByText(/Dorian/)).toBeInTheDocument();
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Mode
```

### Commit Message
```
feat(ui): add mode explorer with brightness index and palindrome badges
```

---

## Task 9: Audio Playback (Tone.js)

- [ ] Play selected pitch classes as a chord (simultaneous)
- [ ] Play arpeggio (sequential)
- [ ] Play progression (current -> selected suggestion)
- [ ] Simple transport controls (play/stop)

### Files to Create

**`packages/ui/src/hooks/useAudio.ts`**
```typescript
import { useRef, useCallback } from 'react';
import * as Tone from 'tone';
import type { PitchClass } from '@musical-symmetry/core';

const PC_TO_NOTE: Record<number, string> = {
  0: 'C4', 1: 'C#4', 2: 'D4', 3: 'Eb4', 4: 'E4', 5: 'F4',
  6: 'F#4', 7: 'G4', 8: 'Ab4', 9: 'A4', 10: 'Bb4', 11: 'B4',
};

export function useAudio() {
  const synthRef = useRef<Tone.PolySynth | null>(null);

  const ensureSynth = useCallback(async () => {
    await Tone.start();
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      }).toDestination();
    }
    return synthRef.current;
  }, []);

  const playChord = useCallback(async (pcs: PitchClass[], duration = '2n') => {
    const synth = await ensureSynth();
    const notes = pcs.map(pc => PC_TO_NOTE[pc]!);
    synth.triggerAttackRelease(notes, duration);
  }, [ensureSynth]);

  const playArpeggio = useCallback(async (pcs: PitchClass[], noteLength = 0.3) => {
    const synth = await ensureSynth();
    const now = Tone.now();
    pcs.forEach((pc, i) => {
      synth.triggerAttackRelease(PC_TO_NOTE[pc]!, '8n', now + i * noteLength);
    });
  }, [ensureSynth]);

  const playProgression = useCallback(async (from: PitchClass[], to: PitchClass[]) => {
    const synth = await ensureSynth();
    const now = Tone.now();
    const fromNotes = from.map(pc => PC_TO_NOTE[pc]!);
    const toNotes = to.map(pc => PC_TO_NOTE[pc]!);
    synth.triggerAttackRelease(fromNotes, '2n', now);
    synth.triggerAttackRelease(toNotes, '2n', now + 1.2);
  }, [ensureSynth]);

  const stop = useCallback(() => {
    synthRef.current?.releaseAll();
  }, []);

  return { playChord, playArpeggio, playProgression, stop };
}
```

**`packages/ui/src/components/AudioControls.tsx`**
```tsx
import type { PitchClass } from '@musical-symmetry/core';
import { useAudio } from '../hooks/useAudio';

interface Props {
  selectedPCs: PitchClass[];
}

export default function AudioControls({ selectedPCs }: Props) {
  const { playChord, playArpeggio, stop } = useAudio();

  const disabled = selectedPCs.length === 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Audio</h2>
      <div className="flex gap-2">
        <button
          disabled={disabled}
          onClick={() => playChord(selectedPCs)}
          className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Play Chord
        </button>
        <button
          disabled={disabled}
          onClick={() => playArpeggio(selectedPCs)}
          className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Arpeggio
        </button>
        <button
          onClick={stop}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
```

**`packages/ui/src/hooks/__tests__/useAudio.test.ts`**
```typescript
import { describe, it, expect } from 'vitest';

describe('useAudio', () => {
  it('module exports useAudio function', async () => {
    const mod = await import('../useAudio');
    expect(mod.useAudio).toBeDefined();
    expect(typeof mod.useAudio).toBe('function');
  });
});
```

### Test Command
```bash
cd packages/ui && npm test -- --grep Audio
```

### Commit Message
```
feat(ui): add Tone.js audio playback with chord and arpeggio modes
```

---

## Task 10: Docker Build + Deployment Config

- [ ] Create Dockerfile (multi-stage: node build -> nginx serve)
- [ ] Create nginx.conf for SPA routing
- [ ] Add to docker-compose at port 3009
- [ ] Add build/deploy scripts

### Files to Create

**`packages/ui/Dockerfile`**
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy workspace root and both packages
COPY package.json ./
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/

RUN npm install --workspaces

COPY packages/core/ packages/core/
COPY packages/ui/ packages/ui/

RUN npm run build -w packages/ui

# Serve stage
FROM nginx:alpine
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**`packages/ui/nginx.conf`**
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

**`docker-compose.yml`** (add to root or create)
```yaml
version: '3.8'

services:
  musical-symmetry-ui:
    build:
      context: .
      dockerfile: packages/ui/Dockerfile
    container_name: musical-symmetry-ui
    ports:
      - "3009:80"
    restart: unless-stopped
    labels:
      - "com.centurylinklabs.watchtower.enable=false"
```

**`packages/ui/.dockerignore`**
```
node_modules
dist
.git
*.md
```

### Test Command
```bash
# Build test (no Docker daemon needed for validation)
cd packages/ui && npm run build

# Full Docker test
docker compose build musical-symmetry-ui
docker compose up -d musical-symmetry-ui
curl -s http://localhost:3009 | head -5
```

### Commit Message
```
feat(ui): add Docker build with nginx serving static SPA on port 3009
```

---

## Task 11: Wire All Components into App + Responsive Layout

- [ ] Import all components into App.tsx
- [ ] Pass state and dispatch through props
- [ ] Responsive grid: single column on mobile, 2 columns on lg
- [ ] Add text input component for note entry

### Files to Create/Update

**`packages/ui/src/components/TextInput.tsx`**
```tsx
import { useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

interface Props {
  onSetPCs: (pcs: PitchClass[]) => void;
}

const NAME_TO_PC: Record<string, PitchClass> = {
  c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5,
  'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
};

function parseInput(input: string): PitchClass[] | null {
  const trimmed = input.trim().toLowerCase();

  // Try pc-set notation: {0,4,7} or [0,4,7]
  const setMatch = trimmed.match(/[{\[]([\d,\s]+)[}\]]/);
  if (setMatch) {
    const nums = setMatch[1]!.split(',').map(s => parseInt(s.trim()));
    if (nums.every(n => n >= 0 && n <= 11)) {
      return nums as PitchClass[];
    }
  }

  // Try note names: C E G or C,E,G
  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  if (parts.length > 0 && parts.every(p => p in NAME_TO_PC)) {
    return parts.map(p => NAME_TO_PC[p]!);
  }

  return null;
}

export default function TextInput({ onSetPCs }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    const result = parseInput(value);
    if (result) {
      onSetPCs(result);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Text Input</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="C E G  or  {0,4,7}"
          className={`flex-1 px-3 py-1.5 rounded bg-gray-900 border text-sm font-mono
            ${error ? 'border-red-500' : 'border-gray-600'} focus:outline-none focus:border-indigo-500`}
        />
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-sm font-medium"
        >
          Set
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">Invalid input. Use note names or pc-set notation.</p>}
    </div>
  );
}
```

**`packages/ui/src/App.tsx`** (final version, replaces scaffold)
```tsx
import { useReducer } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { useClassifier } from './hooks/useClassifier';
import { useChord } from './hooks/useChord';
import PianoKeyboard from './components/PianoKeyboard';
import TextInput from './components/TextInput';
import ClassificationPanel from './components/ClassificationPanel';
import ProgressionPanel from './components/ProgressionPanel';
import OrbitDiagram from './components/OrbitDiagram';
import TonnetzViz from './components/TonnetzViz';
import ModeExplorer from './components/ModeExplorer';
import AudioControls from './components/AudioControls';

export type Action =
  | { type: 'TOGGLE_PC'; pc: PitchClass }
  | { type: 'SET_PCS'; pcs: PitchClass[] }
  | { type: 'CLEAR' };

export interface AppState {
  selectedPCs: PitchClass[];
}

const initialState: AppState = { selectedPCs: [] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'TOGGLE_PC': {
      const has = state.selectedPCs.includes(action.pc);
      return {
        selectedPCs: has
          ? state.selectedPCs.filter(p => p !== action.pc)
          : [...state.selectedPCs, action.pc].sort((a, b) => a - b),
      };
    }
    case 'SET_PCS':
      return { selectedPCs: [...action.pcs].sort((a, b) => a - b) };
    case 'CLEAR':
      return { selectedPCs: [] };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const analysis = useClassifier(state.selectedPCs);
  const chord = useChord(state.selectedPCs);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Musical Symmetry Classifier</h1>
          <p className="text-gray-400 mt-1">
            Select pitch classes to analyze symmetry groups and explore progressions
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: 'CLEAR' })}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium"
        >
          Clear All
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: inputs + analysis */}
        <div className="space-y-6">
          <PianoKeyboard
            selectedPCs={state.selectedPCs}
            onToggle={(pc) => dispatch({ type: 'TOGGLE_PC', pc })}
          />
          <TextInput onSetPCs={(pcs) => dispatch({ type: 'SET_PCS', pcs })} />
          <AudioControls selectedPCs={state.selectedPCs} />
          <ClassificationPanel analysis={analysis} chord={chord} />
          <ProgressionPanel chord={chord} />
        </div>

        {/* Right column: visualizations */}
        <div className="space-y-6">
          <OrbitDiagram selectedPCs={state.selectedPCs} analysis={analysis} />
          <TonnetzViz chord={chord} targetChord={null} />
          <ModeExplorer
            selectedPCs={state.selectedPCs}
            onSelectMode={(pcs) => dispatch({ type: 'SET_PCS', pcs })}
          />
        </div>
      </main>
    </div>
  );
}
```

### Test Command
```bash
cd packages/ui && npm run typecheck && npm test
```

### Commit Message
```
feat(ui): wire all components into responsive app layout
```

---

## Summary of File Tree

```
musical-symmetry/
├── package.json                          (workspace root)
├── docker-compose.yml                    (ui service, port 3009)
├── packages/
│   ├── core/                             (existing, unchanged)
│   └── ui/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       ├── Dockerfile
│       ├── nginx.conf
│       ├── .dockerignore
│       └── src/
│           ├── main.tsx
│           ├── index.css
│           ├── App.tsx
│           ├── vitest.setup.ts
│           ├── hooks/
│           │   ├── useClassifier.ts
│           │   ├── useChord.ts
│           │   ├── useAudio.ts
│           │   └── __tests__/
│           │       ├── useClassifier.test.ts
│           │       └── useAudio.test.ts
│           └── components/
│               ├── PianoKeyboard.tsx
│               ├── TextInput.tsx
│               ├── ClassificationPanel.tsx
│               ├── ProgressionPanel.tsx
│               ├── OrbitDiagram.tsx
│               ├── TonnetzViz.tsx
│               ├── ModeExplorer.tsx
│               ├── AudioControls.tsx
│               └── __tests__/
│                   ├── PianoKeyboard.test.tsx
│                   ├── ClassificationPanel.test.tsx
│                   ├── ProgressionPanel.test.tsx
│                   ├── OrbitDiagram.test.tsx
│                   ├── TonnetzViz.test.tsx
│                   └── ModeExplorer.test.tsx
```

## Dependencies Between Tasks

```
Task 1 (scaffold) ─── must complete first
   │
   ├── Task 2 (hooks) ─── depends on Task 1
   │      │
   │      ├── Task 3 (piano) ─── depends on Task 1
   │      ├── Task 4 (classification) ─── depends on Task 2
   │      ├── Task 5 (progressions) ─── depends on Task 2
   │      ├── Task 6 (orbit) ─── depends on Task 2
   │      ├── Task 7 (tonnetz) ─── depends on Task 2
   │      ├── Task 8 (modes) ─── depends on Task 2
   │      └── Task 9 (audio) ─── depends on Task 1
   │
   └── Task 11 (wire up) ─── depends on Tasks 2-9
         │
         └── Task 10 (Docker) ─── depends on Task 11

Tasks 3-9 can run in parallel after Task 2 completes.
```

## Verification Checklist

After all tasks complete, verify:
- [ ] `npm install` at root succeeds (workspace resolution)
- [ ] `npm run typecheck -w packages/ui` passes
- [ ] `npm test -w packages/ui` passes (all test files)
- [ ] `npm run build -w packages/ui` produces dist/
- [ ] `docker compose build musical-symmetry-ui` succeeds
- [ ] `docker compose up -d musical-symmetry-ui && curl http://localhost:3009` returns HTML
- [ ] UI loads in browser at http://10.0.0.155:3009
- [ ] Clicking piano keys toggles notes and triggers classification
- [ ] Selecting C-E-G shows "C major", interval vector, progressions
- [ ] Tonnetz shows green triangle for selected chord
- [ ] Orbit diagram shows axes for symmetric sets
- [ ] Mode explorer appears for 7-note scales
- [ ] Audio plays chord/arpeggio via Tone.js
