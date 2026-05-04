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
  const queue: [Chord, string][] = [];
  const visited = new Set<string>();
  visited.add(`${from.root}-${from.quality}`);

  for (const [op, fn] of [['P', applyP], ['L', applyL], ['R', applyR]] as const) {
    queue.push([fn(from), op]);
  }

  for (const [chord, path] of queue) {
    const key = `${chord.root}-${chord.quality}`;
    if (chordsEqual(chord, to)) return path;
    if (visited.has(key)) continue;
    visited.add(key);
    if (path.length < maxDepth) {
      for (const [op, fn] of [['P', applyP], ['L', applyL], ['R', applyR]] as const) {
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
