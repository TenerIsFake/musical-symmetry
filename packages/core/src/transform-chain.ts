import type { PitchClass, Chord } from './types';
import { NOTE_NAMES } from './types';
import { transpose, invert, toPcSet } from './pcset';
import { applyP, applyL, applyR } from './plr';
import { identifyChord } from './chords';
import { voiceLeadingDistance } from './voice-leading';

export type Operation =
  | { type: 'T'; n: number }
  | { type: 'I'; n: number }
  | { type: 'P' }
  | { type: 'L' }
  | { type: 'R' };

export interface ChainStep {
  operation: Operation;
  inputPcs: PitchClass[];
  outputPcs: PitchClass[];
  chordName: string | null;
  commonTones: PitchClass[];
  vlDistance: number;
}

function chordDisplayName(chord: Chord): string {
  const rootName = NOTE_NAMES[chord.root];
  if (chord.quality === 'major') return rootName;
  if (chord.quality === 'minor') return `${rootName}m`;
  return `${rootName} ${chord.quality}`;
}

export function evaluateChain(seed: PitchClass[], operations: Operation[]): ChainStep[] {
  const steps: ChainStep[] = [];
  let current = toPcSet(seed);

  for (const op of operations) {
    let output: PitchClass[];

    if (op.type === 'T') {
      output = transpose(current, op.n);
    } else if (op.type === 'I') {
      output = invert(current, op.n);
    } else {
      // PLR — need a Chord object. Try to identify the current set as a triad.
      const identified = identifyChord(current);
      if (!identified || (identified.quality !== 'major' && identified.quality !== 'minor')) {
        // Can't apply PLR to non-triads — skip with identity
        output = current;
      } else {
        const chord: Chord = {
          root: identified.root,
          quality: identified.quality as 'major' | 'minor',
          pitchClasses: current,
        };
        const fn = op.type === 'P' ? applyP : op.type === 'L' ? applyL : applyR;
        const result = fn(chord);
        output = result.pitchClasses;
      }
    }

    const outputSet = new Set(output);
    const common = current.filter(pc => outputSet.has(pc));
    const vl = current.length === output.length ? voiceLeadingDistance(current, output) : 0;
    const named = identifyChord(output);

    steps.push({
      operation: op,
      inputPcs: current,
      outputPcs: output,
      chordName: named ? chordDisplayName(named) : null,
      commonTones: common,
      vlDistance: vl,
    });

    current = output;
  }

  return steps;
}

export function operationLabel(op: Operation): string {
  if (op.type === 'T') return `T${op.n}`;
  if (op.type === 'I') return `I${op.n}`;
  return op.type;
}

export function randomChain(length: number): Operation[] {
  const ops: Operation[] = [];
  const types = ['T', 'I', 'P', 'L', 'R'] as const;
  for (let i = 0; i < length; i++) {
    const t = types[Math.floor(Math.random() * types.length)]!;
    if (t === 'T' || t === 'I') {
      ops.push({ type: t, n: Math.floor(Math.random() * 12) });
    } else {
      ops.push({ type: t });
    }
  }
  return ops;
}
