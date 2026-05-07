import { useState, useEffect, useRef, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { playPitchClasses } from '../utils/audio';

// ─── Math ──────────────────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function generateCycle(start: number, interval: number): number[] {
  const cycle = [start];
  let current = (start + interval) % 12;
  while (current !== start) {
    cycle.push(current);
    current = (current + interval) % 12;
  }
  return cycle;
}

function allCycles(interval: number): number[][] {
  const visited = new Set<number>();
  const cycles: number[][] = [];
  for (let i = 0; i < 12; i++) {
    if (visited.has(i)) continue;
    const cycle = generateCycle(i, interval);
    cycle.forEach(n => visited.add(n));
    cycles.push(cycle);
  }
  return cycles;
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function playSequence(pcs: number[], noteDuration = 0.5): void {
  const ctx = new AudioContext();
  const baseFreq = 261.63; // Middle C
  pcs.forEach((pc, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = baseFreq * Math.pow(2, pc / 12);
    gain.gain.value = 0.35;
    osc.connect(gain).connect(ctx.destination);
    const startTime = ctx.currentTime + i * noteDuration;
    osc.start(startTime);
    gain.gain.setValueAtTime(0.35, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 0.9);
    osc.stop(startTime + noteDuration);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

interface IntervalDef {
  semitones: number;
  label: string;
  name: string;
}

const INTERVALS: IntervalDef[] = [
  { semitones: 1, label: 'm2', name: 'Minor 2nd' },
  { semitones: 2, label: 'M2', name: 'Major 2nd' },
  { semitones: 3, label: 'm3', name: 'Minor 3rd' },
  { semitones: 4, label: 'M3', name: 'Major 3rd' },
  { semitones: 5, label: 'P4', name: 'Perfect 4th' },
  { semitones: 6, label: 'TT', name: 'Tritone' },
  { semitones: 7, label: 'P5', name: 'Perfect 5th' },
];

// Palette for coloring distinct cycles
const CYCLE_COLORS = [
  { fill: '#6366f1', stroke: '#4f46e5', text: '#c7d2fe' }, // indigo
  { fill: '#f59e0b', stroke: '#d97706', text: '#fde68a' }, // amber
  { fill: '#10b981', stroke: '#059669', text: '#a7f3d0' }, // emerald
  { fill: '#f43f5e', stroke: '#e11d48', text: '#fecdd3' }, // rose
  { fill: '#a855f7', stroke: '#9333ea', text: '#e9d5ff' }, // purple
  { fill: '#06b6d4', stroke: '#0891b2', text: '#a5f3fc' }, // cyan
];

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const CX = 160;
const CY = 160;
const RADIUS = 128;
const DOT_RADIUS = 16;

function pcToXY(pc: number, radius = RADIUS): [number, number] {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function buildPathD(pcs: number[]): string {
  if (pcs.length === 0) return '';
  const points = pcs.map(pc => pcToXY(pc));
  const [fx, fy] = points[0]!;
  const rest = points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ');
  // close the loop back to start
  return `M ${fx} ${fy} ${rest} L ${fx} ${fy}`;
}

// ─── Animated path component ─────────────────────────────────────────────────

interface AnimatedCyclePathProps {
  pcs: number[];
  color: { fill: string; stroke: string };
  animStep: number; // -1 = show full path; 0..n = show first n+1 edges
  isPlaying: boolean;
}

function AnimatedCyclePath({ pcs, color, animStep, isPlaying }: AnimatedCyclePathProps) {
  if (pcs.length === 0) return null;

  // Build partial path up to animStep
  const displayCount = isPlaying ? Math.min(animStep + 2, pcs.length + 1) : pcs.length + 1;
  const pts = pcs.map(pc => pcToXY(pc));

  const segments: [number, number, number, number][] = [];
  for (let i = 0; i < Math.min(displayCount - 1, pts.length); i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    // last segment closes back to start
    if (i === pcs.length - 1) {
      segments.push([x1, y1, pts[0]![0], pts[0]![1]]);
    } else {
      segments.push([x1, y1, x2, y2]);
    }
  }

  return (
    <>
      {segments.map(([x1, y1, x2, y2], i) => (
        <line
          key={`seg-${i}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color.stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntervalCyclesPage() {
  const [selectedInterval, setSelectedInterval] = useState<number>(7); // P5 default
  const [isPlaying, setIsPlaying] = useState(false);
  const [animStep, setAnimStep] = useState(-1);
  const [activeCycleIdx, setActiveCycleIdx] = useState(0); // which cycle to play/animate
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cycles = allCycles(selectedInterval);
  const cycleLength = 12 / gcd(12, selectedInterval);
  const numCycles = gcd(12, selectedInterval);

  // Build a map: pc -> cycleIndex
  const pcToCycleIdx = new Map<number, number>();
  cycles.forEach((cycle, idx) => {
    cycle.forEach(pc => pcToCycleIdx.set(pc, idx));
  });

  // Clear animation on interval change
  useEffect(() => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setIsPlaying(false);
    setAnimStep(-1);
    setActiveCycleIdx(0);
  }, [selectedInterval]);

  const handlePlay = useCallback(() => {
    if (isPlaying) return;
    const cycle = cycles[activeCycleIdx] ?? [];
    if (cycle.length === 0) return;

    setIsPlaying(true);
    setAnimStep(0);

    const noteDuration = 0.55;
    // play the sequence (cycle + wrap back to start note for resolution)
    playSequence([...cycle, cycle[0]!], noteDuration);

    // animate edges in sync
    const totalSteps = cycle.length; // edges = cycle.length (last edge closes)
    let step = 0;
    const tick = () => {
      step++;
      if (step < totalSteps) {
        setAnimStep(step);
        animTimerRef.current = setTimeout(tick, noteDuration * 1000);
      } else {
        // show full closed loop briefly, then freeze
        setAnimStep(totalSteps);
        animTimerRef.current = setTimeout(() => {
          setIsPlaying(false);
          setAnimStep(-1);
        }, 1200);
      }
    };
    animTimerRef.current = setTimeout(tick, noteDuration * 1000);
  }, [isPlaying, cycles, activeCycleIdx]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
  }, []);

  const intervalDef = INTERVALS.find(i => i.semitones === selectedInterval)!;

  // Highlight which notes are "active" during animation
  const animHighlightSet = new Set<number>();
  if (isPlaying && animStep >= 0) {
    const cycle = cycles[activeCycleIdx] ?? [];
    for (let i = 0; i <= Math.min(animStep, cycle.length - 1); i++) {
      animHighlightSet.add(cycle[i]!);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Interval Selector ── */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Select Interval</h2>
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map(iv => (
            <button
              key={iv.semitones}
              onClick={() => setSelectedInterval(iv.semitones)}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                selectedInterval === iv.semitones
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="font-mono mr-1">{iv.label}</span>
              <span className="text-xs opacity-75">({iv.name})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Clock Face ── */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Cycle Diagram</h2>
          <svg
            viewBox="0 0 320 320"
            className="w-full max-w-sm mx-auto"
            role="img"
            aria-label={`Interval cycle diagram for ${intervalDef.name}`}
          >
            {/* Background circle */}
            <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#374151" strokeWidth={1} />

            {/* Cycle paths — show all cycles dimly, active cycle bright */}
            {cycles.map((cycle, cycleIdx) => {
              const color = CYCLE_COLORS[cycleIdx % CYCLE_COLORS.length]!;
              const isActive = cycleIdx === activeCycleIdx;
              if (isPlaying && isActive) {
                return (
                  <AnimatedCyclePath
                    key={cycleIdx}
                    pcs={cycle}
                    color={color}
                    animStep={animStep}
                    isPlaying={isPlaying}
                  />
                );
              }
              // Static path (full loop)
              return (
                <path
                  key={cycleIdx}
                  d={buildPathD(cycle)}
                  fill="none"
                  stroke={color.stroke}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  opacity={isActive ? 0.8 : 0.35}
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Nodes */}
            {(Array.from({ length: 12 }, (_, i) => i) as number[]).map(pc => {
              const [x, y] = pcToXY(pc);
              const cycleIdx = pcToCycleIdx.get(pc) ?? 0;
              const color = CYCLE_COLORS[cycleIdx % CYCLE_COLORS.length]!;
              const isHighlighted = animHighlightSet.has(pc);
              const isActiveCycleNode = (cycles[activeCycleIdx] ?? []).includes(pc);
              const labelRadius = RADIUS + 22;
              const [lx, ly] = pcToXY(pc, labelRadius);

              return (
                <g key={pc}>
                  <circle
                    cx={x} cy={y}
                    r={isHighlighted ? DOT_RADIUS + 3 : DOT_RADIUS}
                    fill={isHighlighted ? color.fill : isActiveCycleNode ? color.fill + '99' : '#1f2937'}
                    stroke={color.stroke}
                    strokeWidth={isHighlighted ? 3 : isActiveCycleNode ? 2 : 1}
                    style={{ transition: 'r 0.15s, fill 0.15s' }}
                  />
                  <text
                    x={x} y={y + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isActiveCycleNode ? 'bold' : 'normal'}
                    fill={isHighlighted ? '#fff' : isActiveCycleNode ? color.text : '#9ca3af'}
                    className="select-none pointer-events-none"
                  >
                    {NOTE_NAMES[pc as PitchClass]}
                  </text>
                  {/* outer label for active cycle */}
                  {isActiveCycleNode && (
                    <text
                      x={lx} y={ly + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="semibold"
                      fill={color.text}
                      className="select-none pointer-events-none"
                    >
                      {NOTE_NAMES[pc as PitchClass]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Cycle selector tabs (only shown if >1 cycle) */}
          {cycles.length > 1 && (
            <div className="mt-3 flex gap-2 justify-center flex-wrap">
              {cycles.map((cycle, idx) => {
                const color = CYCLE_COLORS[idx % CYCLE_COLORS.length]!;
                return (
                  <button
                    key={idx}
                    onClick={() => { setActiveCycleIdx(idx); setAnimStep(-1); setIsPlaying(false); }}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      activeCycleIdx === idx ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: color.fill + '33',
                      borderColor: color.stroke,
                      border: '1px solid',
                      color: color.text,
                    }}
                  >
                    Cycle {idx + 1}: {cycle.map(pc => NOTE_NAMES[pc as PitchClass]).join('–')}
                  </button>
                );
              })}
            </div>
          )}

          {/* Play button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={handlePlay}
              disabled={isPlaying}
              className={`px-6 py-2 rounded font-semibold text-sm transition-colors ${
                isPlaying
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isPlaying ? 'Playing…' : 'Play Cycle'}
            </button>
          </div>
        </div>

        {/* ── Info Panel ── */}
        <div className="space-y-4">
          {/* Stats card */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Cycle Statistics</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">Interval</dt>
                <dd className="text-white font-semibold">{intervalDef.name} ({selectedInterval} semitone{selectedInterval !== 1 ? 's' : ''})</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Cycle length</dt>
                <dd className="text-white font-semibold">{cycleLength} notes</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Distinct cycles</dt>
                <dd className="text-white font-semibold">{numCycles}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">gcd(12, {selectedInterval})</dt>
                <dd className="text-white font-mono">{gcd(12, selectedInterval)}</dd>
              </div>
            </dl>
          </div>

          {/* All cycles listed */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">All Cycles</h2>
            <div className="space-y-3">
              {cycles.map((cycle, idx) => {
                const color = CYCLE_COLORS[idx % CYCLE_COLORS.length]!;
                return (
                  <div
                    key={idx}
                    className="rounded p-3 cursor-pointer"
                    style={{ backgroundColor: color.fill + '1a', borderLeft: `3px solid ${color.stroke}` }}
                    onClick={() => { setActiveCycleIdx(idx); setAnimStep(-1); setIsPlaying(false); }}
                  >
                    <div className="text-xs font-semibold mb-1" style={{ color: color.text }}>
                      Cycle {idx + 1}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cycle.map((pc, step) => (
                        <span key={step} className="flex items-center gap-0.5">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
                            style={{ backgroundColor: color.fill + '44', color: color.text }}
                          >
                            {NOTE_NAMES[pc as PitchClass]}
                          </span>
                          {step < cycle.length - 1 && (
                            <span className="text-gray-600 text-xs">→</span>
                          )}
                        </span>
                      ))}
                      <span className="text-gray-600 text-xs self-center">→ (back to {NOTE_NAMES[cycle[0]! as PitchClass]})</span>
                    </div>
                    <button
                      className="mt-2 text-xs px-3 py-1 rounded transition-colors"
                      style={{ backgroundColor: color.fill + '55', color: color.text }}
                      onClick={e => {
                        e.stopPropagation();
                        playPitchClasses(cycle as PitchClass[], 'arpeggio', 1.2);
                      }}
                    >
                      Hear as chord
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Educational Panel ── */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">The Math Behind Interval Cycles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <p className="mb-2">
              An <strong className="text-white">interval cycle</strong> is what you get when you repeatedly add the same
              interval to a starting pitch class, wrapping around mod 12. The cycle ends when you return to where you started.
            </p>
            <p className="mb-2">
              The length of any cycle generated by interval <em>i</em> is always{' '}
              <strong className="text-white font-mono">12 / gcd(12, i)</strong>.
              For <strong className="text-white">{intervalDef.name}</strong> ({selectedInterval}
              {selectedInterval !== 1 ? ' semitones' : ' semitone'}), that's{' '}
              <strong className="text-white">12 / gcd(12, {selectedInterval}) = 12 / {gcd(12, selectedInterval)} = {cycleLength}</strong>.
            </p>
            <p>
              Because all 12 pitch classes must appear in <em>some</em> cycle, there are exactly{' '}
              <strong className="text-white">gcd(12, {selectedInterval}) = {numCycles}</strong>{' '}
              distinct cycle{numCycles !== 1 ? 's' : ''}.
            </p>
          </div>
          <div>
            <p className="mb-2">
              <strong className="text-white">Why does this work?</strong> The 12 pitch classes form a group Z₁₂ under addition mod 12.
              Adding interval <em>i</em> repeatedly generates a cyclic subgroup of order 12/gcd(12,<em>i</em>).
              The full orbit of any starting note under this operation is a coset of that subgroup.
            </p>
            <p className="mb-2">
              <strong className="text-white">Famous examples:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 text-xs">
              <li><strong className="text-white">Perfect 5th (7)</strong>: one cycle of 12 — the circle of fifths</li>
              <li><strong className="text-white">Perfect 4th (5)</strong>: one cycle of 12 — circle of fourths (same, reversed)</li>
              <li><strong className="text-white">Minor 3rd (3)</strong>: three cycles of 4 — diminished 7th chords</li>
              <li><strong className="text-white">Major 3rd (4)</strong>: four cycles of 3 — augmented triads</li>
              <li><strong className="text-white">Tritone (6)</strong>: six cycles of 2 — tritone pairs</li>
              <li><strong className="text-white">Whole tone (2)</strong>: two cycles of 6 — whole-tone scales</li>
              <li><strong className="text-white">Half step (1)</strong>: one cycle of 12 — the chromatic scale</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
