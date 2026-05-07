import { useState, useMemo, useCallback } from 'react';
import {
  applyP, applyL, applyR,
  allFirstOrder,
  voiceLeadingDistance,
  NOTE_NAMES,
  identifyChord,
} from '@musical-symmetry/core';
import type { Chord, PitchClass } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { playChordProgression } from '../utils/audio';

// ---- Constants ----

const FREE_MAX_PATH = 8;
const PRO_MAX_PATH = 24;

// All 24 major/minor triads
function buildAllTriads(): Chord[] {
  const triads: Chord[] = [];
  for (let root = 0; root < 12; root++) {
    const r = root as PitchClass;
    const majorPcs: PitchClass[] = [r, ((r + 4) % 12) as PitchClass, ((r + 7) % 12) as PitchClass];
    triads.push({ root: r, quality: 'major', pitchClasses: majorPcs });
    const minorPcs: PitchClass[] = [r, ((r + 3) % 12) as PitchClass, ((r + 7) % 12) as PitchClass];
    triads.push({ root: r, quality: 'minor', pitchClasses: minorPcs });
  }
  return triads;
}

const ALL_TRIADS = buildAllTriads();

function chordKey(c: Chord): string {
  return `${c.root}-${c.quality}`;
}

function chordLabel(c: Chord): string {
  const name = NOTE_NAMES[c.root];
  return c.quality === 'major' ? name : `${name}m`;
}

function chordEquals(a: Chord, b: Chord): boolean {
  return a.root === b.root && a.quality === b.quality;
}

// ---- Tonnetz SVG layout ----

// Layout: major triads on top row, minor on bottom, spread by root pitch class
// Grid dimensions
const SVG_WIDTH = 900;
const SVG_HEIGHT = 220;
const NODE_R = 22;
const PADDING_X = 50;
const PADDING_Y = 30;
const COL_SPACING = (SVG_WIDTH - PADDING_X * 2) / 11;

function nodePosition(chord: Chord): { x: number; y: number } {
  const col = chord.root;
  const x = PADDING_X + col * COL_SPACING;
  const y = chord.quality === 'major' ? PADDING_Y + NODE_R : SVG_HEIGHT - PADDING_Y - NODE_R;
  return { x, y };
}

// PLR operation colors
const OP_COLORS: Record<string, string> = {
  P: '#f87171',  // red-400
  L: '#60a5fa',  // blue-400
  R: '#34d399',  // emerald-400
};

interface PathStep {
  chord: Chord;
  op: string;
  vlDist: number;
  commonTones: PitchClass[];
}

// ---- Tonnetz SVG Component ----

interface TonnetzSVGProps {
  active: Chord;
  path: PathStep[];
  onClickNeighbor: (chord: Chord, op: string) => void;
  atLimit: boolean;
}

function TonnetzSVG({ active, path, onClickNeighbor, atLimit }: TonnetzSVGProps) {
  const neighbors = useMemo(() => {
    const sugs = allFirstOrder(active);
    return sugs.map(s => ({
      chord: s.to as Chord,
      op: s.operator,
      commonTones: s.commonTones as PitchClass[],
      vlDist: s.voiceLeadingDistance,
    }));
  }, [active]);

  const neighborKeys = useMemo(() => new Set(neighbors.map(n => chordKey(n.chord))), [neighbors]);

  // Edges: compute PLR connections for all 24 triads
  const edges = useMemo(() => {
    const result: Array<{ from: Chord; to: Chord; op: string }> = [];
    const seen = new Set<string>();
    for (const chord of ALL_TRIADS) {
      const ops = allFirstOrder(chord);
      for (const s of ops) {
        const a = chordKey(chord);
        const b = chordKey(s.to as Chord);
        const edgeKey = [a, b].sort().join('|') + s.operator;
        if (!seen.has(edgeKey)) {
          seen.add(edgeKey);
          result.push({ from: chord, to: s.to as Chord, op: s.operator });
        }
      }
    }
    return result;
  }, []);

  const activeKey = chordKey(active);

  // Path visited keys (excluding current)
  const pathVisitedKeys = useMemo(() => {
    return new Set(path.map(s => chordKey(s.chord)));
  }, [path]);

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      aria-label="Tonnetz lattice"
    >
      {/* Edges */}
      {edges.map((e, i) => {
        const p1 = nodePosition(e.from);
        const p2 = nodePosition(e.to);
        const color = OP_COLORS[e.op] ?? '#6b7280';
        const isActiveEdge =
          (chordKey(e.from) === activeKey && neighborKeys.has(chordKey(e.to))) ||
          (chordKey(e.to) === activeKey && neighborKeys.has(chordKey(e.from)));
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={color}
            strokeWidth={isActiveEdge ? 2.5 : 1}
            strokeOpacity={isActiveEdge ? 0.85 : 0.2}
          />
        );
      })}

      {/* Nodes */}
      {ALL_TRIADS.map(chord => {
        const { x, y } = nodePosition(chord);
        const key = chordKey(chord);
        const isActive = key === activeKey;
        const neighborInfo = neighbors.find(n => chordKey(n.chord) === key);
        const isNeighbor = !!neighborInfo;
        const isVisited = pathVisitedKeys.has(key);

        let fillColor = '#1f2937'; // gray-800
        let strokeColor = '#4b5563'; // gray-600
        let strokeWidth = 1;
        let cursor = 'default';
        let textColor = '#9ca3af'; // gray-400

        if (isActive) {
          fillColor = '#4f46e5'; // indigo-600
          strokeColor = '#818cf8'; // indigo-400
          strokeWidth = 3;
          textColor = '#ffffff';
        } else if (isNeighbor && !atLimit) {
          const opColor = OP_COLORS[neighborInfo.op] ?? '#6b7280';
          fillColor = '#111827';
          strokeColor = opColor;
          strokeWidth = 2.5;
          cursor = 'pointer';
          textColor = '#e5e7eb';
        } else if (isVisited) {
          fillColor = '#312e81'; // indigo-900
          strokeColor = '#6366f1'; // indigo-500
          strokeWidth = 1.5;
          textColor = '#a5b4fc';
        }

        return (
          <g
            key={key}
            onClick={() => {
              if (isNeighbor && !atLimit) {
                onClickNeighbor(chord, neighborInfo.op);
              }
            }}
            style={{ cursor }}
            aria-label={chordLabel(chord)}
          >
            {/* Pulse ring for active */}
            {isActive && (
              <circle
                cx={x}
                cy={y}
                r={NODE_R + 6}
                fill="none"
                stroke="#818cf8"
                strokeWidth={2}
                strokeOpacity={0.5}
              />
            )}
            {/* Neighbor op-color ring */}
            {isNeighbor && !atLimit && (
              <circle
                cx={x}
                cy={y}
                r={NODE_R + 5}
                fill="none"
                stroke={OP_COLORS[neighborInfo.op] ?? '#6b7280'}
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={NODE_R}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <text
              x={x}
              y={y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={chord.root >= 10 ? 9 : 10}
              fontWeight={isActive ? 'bold' : 'normal'}
              fill={textColor}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {chordLabel(chord)}
            </text>
            {/* Op label on neighbor */}
            {isNeighbor && !atLimit && (
              <text
                x={x}
                y={y + NODE_R + 13}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight="bold"
                fill={OP_COLORS[neighborInfo.op] ?? '#6b7280'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {neighborInfo.op}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Starting chord picker ----

function ChordPicker({
  value,
  onChange,
}: {
  value: Chord;
  onChange: (chord: Chord) => void;
}) {
  return (
    <select
      value={chordKey(value)}
      onChange={e => {
        const [rootStr, quality] = e.target.value.split('-');
        const root = parseInt(rootStr ?? '0', 10) as PitchClass;
        const chord = ALL_TRIADS.find(c => c.root === root && c.quality === quality);
        if (chord) onChange(chord);
      }}
      className="bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
    >
      {ALL_TRIADS.map(c => (
        <option key={chordKey(c)} value={chordKey(c)}>
          {chordLabel(c)} ({c.quality})
        </option>
      ))}
    </select>
  );
}

// ---- Path display ----

function PathDisplay({ startChord, path }: { startChord: Chord; path: PathStep[] }) {
  if (path.length === 0) {
    return (
      <span className="text-gray-500 italic text-sm">Click a neighbor on the Tonnetz to begin walking.</span>
    );
  }

  const totalVL = path.reduce((acc, s) => acc + s.vlDist, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <span className="font-mono font-bold text-indigo-300">{chordLabel(startChord)}</span>
        {path.map((step, i) => (
          <span key={i} className="flex items-center gap-1">
            <span
              className="text-xs font-bold px-1 py-0.5 rounded"
              style={{ color: OP_COLORS[step.op], background: 'rgba(0,0,0,0.3)' }}
            >
              →{step.op}→
            </span>
            <span className="font-mono font-bold text-indigo-300">{chordLabel(step.chord)}</span>
          </span>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-gray-400">
        <span>Steps: <span className="text-white font-semibold">{path.length}</span></span>
        <span>Total VL: <span className="text-cyan-400 font-semibold">{totalVL}</span></span>
      </div>
    </div>
  );
}

// ---- Step detail table ----

function StepTable({ startChord, path }: { startChord: Chord; path: PathStep[] }) {
  if (path.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-700">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Op</th>
            <th className="pb-2 pr-4">From</th>
            <th className="pb-2 pr-4">To</th>
            <th className="pb-2 pr-4">Common Tones</th>
            <th className="pb-2">VL</th>
          </tr>
        </thead>
        <tbody>
          {path.map((step, i) => {
            const fromChord = i === 0 ? startChord : path[i - 1]!.chord;
            return (
              <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                <td className="py-2 pr-4">
                  <span
                    className="font-mono font-bold text-xs px-1.5 py-0.5 rounded"
                    style={{ color: OP_COLORS[step.op], background: 'rgba(0,0,0,0.4)' }}
                  >
                    {step.op}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-gray-300">{chordLabel(fromChord)}</td>
                <td className="py-2 pr-4 font-mono text-indigo-300 font-bold">{chordLabel(step.chord)}</td>
                <td className="py-2 pr-4 text-xs text-gray-400">
                  {step.commonTones.length > 0
                    ? step.commonTones.map(pc => NOTE_NAMES[pc]).join(' ')
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="py-2 font-mono text-cyan-400">{step.vlDist}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Main Page ----

export default function HarmonicPathPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';
  const isResearch = tier === 'research';
  const maxPath = isResearch ? Infinity : isPro ? PRO_MAX_PATH : FREE_MAX_PATH;

  // Starting chord
  const [startChord, setStartChord] = useState<Chord>(() => ALL_TRIADS[0]!);

  // Current active chord (head of navigation)
  const [activeChord, setActiveChord] = useState<Chord>(() => ALL_TRIADS[0]!);

  // Path steps (from start, each step records the destination chord)
  const [path, setPath] = useState<PathStep[]>([]);

  const atLimit = path.length >= maxPath;

  const handleSelectStart = (chord: Chord) => {
    setStartChord(chord);
    setActiveChord(chord);
    setPath([]);
  };

  const handleClickNeighbor = useCallback((chord: Chord, op: string) => {
    if (atLimit) return;
    const dist = voiceLeadingDistance(activeChord.pitchClasses, chord.pitchClasses);
    // Common tones
    const setB = new Set(chord.pitchClasses);
    const common = activeChord.pitchClasses.filter(pc => setB.has(pc)) as PitchClass[];
    setPath(prev => [...prev, { chord, op, vlDist: dist, commonTones: common }]);
    setActiveChord(chord);
  }, [activeChord, atLimit]);

  const handleUndo = () => {
    setPath(prev => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const prevChord = next.length === 0 ? startChord : next[next.length - 1]!.chord;
      setActiveChord(prevChord);
      return next;
    });
  };

  const handleClear = () => {
    setPath([]);
    setActiveChord(startChord);
  };

  const handlePlay = () => {
    const chords: number[][] = [startChord.pitchClasses, ...path.map(s => s.chord.pitchClasses)];
    playChordProgression(chords, 80);
  };

  const handleSendToSketch = () => {
    const data = {
      startChord,
      path,
      label: `Tonnetz: ${chordLabel(startChord)} → ${path.map(s => chordLabel(s.chord)).join(' → ')}`,
    };
    sessionStorage.setItem('harmonic-path-export', JSON.stringify(data));
    window.location.hash = 'sketchpad';
  };

  return (
    <div className="space-y-6">

      {/* Starting chord picker */}
      <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-300">Starting chord:</span>
          <ChordPicker value={startChord} onChange={handleSelectStart} />
          <span className="text-xs text-gray-500">
            Active: <span className="text-indigo-300 font-mono font-bold">{chordLabel(activeChord)}</span>
            {' '}({activeChord.quality})
          </span>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
          {(['P', 'L', 'R'] as const).map(op => (
            <span key={op} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: OP_COLORS[op] }}
              />
              <span style={{ color: OP_COLORS[op] }}>{op}</span>
              <span>
                {op === 'P' ? '(Parallel — same root, flip quality)' :
                 op === 'L' ? '(Leading-tone exchange)' :
                 '(Relative — share 2 common tones)'}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* Tonnetz SVG */}
      <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-white">Tonnetz Map</h2>
          <div className="flex gap-1.5 text-xs text-gray-500">
            <span className="bg-gray-900 rounded px-2 py-0.5">Top row = major</span>
            <span className="bg-gray-900 rounded px-2 py-0.5">Bottom row = minor</span>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg bg-gray-900">
          <TonnetzSVG
            active={activeChord}
            path={path}
            onClickNeighbor={handleClickNeighbor}
            atLimit={atLimit}
          />
        </div>

        {atLimit && (
          <div className="mt-3 text-amber-400 text-xs bg-amber-900/30 border border-amber-700 rounded px-3 py-2">
            {isResearch
              ? 'Path limit reached.'
              : isPro
              ? `Pro tier path limit reached (${PRO_MAX_PATH} steps). Upgrade to Research for unlimited.`
              : `Free tier: up to ${FREE_MAX_PATH} steps. Upgrade to Pro for longer paths.`}
          </div>
        )}
      </section>

      {/* Path display + controls */}
      <section className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white mb-2">Path</h2>
          <PathDisplay startChord={startChord} path={path} />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePlay}
            disabled={path.length === 0}
            className="px-3 py-1.5 rounded text-sm font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ▶ Play
          </button>
          <button
            onClick={handleUndo}
            disabled={path.length === 0}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo
          </button>
          <button
            onClick={handleClear}
            disabled={path.length === 0}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          {isPro ? (
            <button
              onClick={handleSendToSketch}
              disabled={path.length === 0}
              className="px-3 py-1.5 rounded text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send to Sketch
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-500 cursor-not-allowed">
              Send to Sketch
              <span className="text-xs bg-purple-900 text-purple-300 border border-purple-700 rounded px-1.5 py-0.5">Pro</span>
            </span>
          )}
        </div>
      </section>

      {/* Step detail table */}
      {path.length > 0 && (
        <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-base font-semibold text-white mb-3">Step Detail</h2>
          <StepTable startChord={startChord} path={path} />
        </section>
      )}

      {/* Upgrade prompt */}
      {!isPro && (
        <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 text-center">
          <p className="text-purple-300 text-sm font-medium">
            Upgrade to Pro for paths up to 24 steps, Send to Sketch, and saved paths.
          </p>
          <a
            href="#dashboard"
            className="inline-block mt-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
          >
            Upgrade to Pro
          </a>
        </div>
      )}
    </div>
  );
}
