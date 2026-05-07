import { useState, useRef, useCallback, useEffect } from 'react';
import {
  TUNING_12TET,
  TUNING_19TET,
  TUNING_24TET,
  TUNING_31TET,
  TUNING_BOHLEN_PIERCE,
  frequencyInTuning,
  generalizedIntervalVector,
  generalizedSymmetryGroup,
  generalizedMaximallyEven,
  nearestTwelveTET,
} from '@musical-symmetry/core';
import type { TuningSystem } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';

// ─── Tier-gated tuning options ────────────────────────────────────────────────

const FREE_TUNINGS: TuningSystem[] = [TUNING_12TET, TUNING_19TET];
const PRO_TUNINGS: TuningSystem[] = [TUNING_12TET, TUNING_19TET, TUNING_24TET, TUNING_31TET, TUNING_BOHLEN_PIERCE];

// ─── Educational descriptions ─────────────────────────────────────────────────

const TUNING_INFO: Record<string, { description: string; detail: string }> = {
  '12-TET': {
    description: 'The standard Western tuning: 12 equal steps per octave.',
    detail:
      'Twelve-tone equal temperament divides the octave into 12 equal semitones. It is a compromise that makes every key equally in-tune (or out-of-tune) and enables free transposition. The fifth is about 1.96 cents flat of pure (3:2).',
  },
  '19-TET': {
    description: '19 equal steps per octave — excellent thirds, unusual semitones.',
    detail:
      '19-TET has a minor third closer to just (6:5) than 12-TET, and its major third is closer to pure (5:4). It also has enharmonic equivalents distinct from 12-TET: D♯ ≠ E♭. Advocated by Renaissance theorist Guillaume Costeley and 20th-century theorist Joseph Yasser.',
  },
  '24-TET': {
    description: 'Quarter-tone system: halfway between every 12-TET semitone.',
    detail:
      'Used in Arabic maqam music and by 20th-century avant-garde composers (Haba, Wyschnegradsky, Boulez). Each 12-TET semitone is split into two equal quarter-tones of 50 cents, allowing intervals like the neutral third (3/4 of a tone) and neutral second.',
  },
  '31-TET': {
    description: '31 steps per octave — near-pure thirds and extended enharmonics.',
    detail:
      '31-TET approximates just intonation extremely well: its major third is only 0.8 cents from pure (5:4) and its fifth is 5.2 cents flat. It was proposed by Christiaan Huygens in 1661. Enharmonics that are equal in 12-TET split apart, giving the system many distinct accidentals.',
  },
  'Bohlen-Pierce': {
    description: 'Based on the tritave (3:1): 13 steps per 3:1 ratio instead of 2:1.',
    detail:
      'Bohlen-Pierce was independently discovered by Heinz Bohlen and John Pierce. Instead of dividing the octave (2:1), it divides the tritave (3:1) into 13 equal steps. This eliminates intervals with the ratio 2 entirely, giving a very alien sound. It approximates ratios of odd integers well (3:1, 5:3, 7:3, 7:5, 9:5…).',
  },
};

// ─── Circular pitch-class diagram ─────────────────────────────────────────────

interface CircleDiagramProps {
  tuning: TuningSystem;
  selected: number[];
  onToggle: (index: number) => void;
  compareMode: boolean;
}

function CircleDiagram({ tuning, selected, onToggle, compareMode }: CircleDiagramProps) {
  const n = tuning.divisions;
  const cx = 150;
  const cy = 150;
  const radius = 110;
  const dotR = Math.max(8, Math.min(13, 260 / n));

  // Draw polygon connecting selected pitches
  const polygonPoints = selected
    .map(i => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="-20 -20 340 340"
      className="w-full max-w-xs mx-auto select-none"
      aria-label={`Pitch-class circle for ${tuning.name}`}
    >
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#374151" strokeWidth={1.5} />

      {/* Polygon for selected notes */}
      {selected.length >= 3 && (
        <polygon
          points={polygonPoints}
          fill="rgba(99,102,241,0.12)"
          stroke="#6366f1"
          strokeWidth={1.5}
        />
      )}
      {selected.length === 2 && (() => {
        const a0 = (2 * Math.PI * selected[0]!) / n - Math.PI / 2;
        const a1 = (2 * Math.PI * selected[1]!) / n - Math.PI / 2;
        return (
          <line
            x1={cx + radius * Math.cos(a0)} y1={cy + radius * Math.sin(a0)}
            x2={cx + radius * Math.cos(a1)} y2={cy + radius * Math.sin(a1)}
            stroke="#6366f1" strokeWidth={1.5}
          />
        );
      })()}

      {/* Pitch-class nodes */}
      {Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const isActive = selected.includes(i);
        const label = tuning.noteNames[i] ?? `${i}`;

        // 12-TET compare: show deviation
        let compareLabel: string | null = null;
        let compareColor = '#9ca3af';
        if (compareMode) {
          const { pc12, centsDeviation } = nearestTwelveTET(i, tuning);
          const noteNames12 = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
          compareLabel = `${noteNames12[pc12]}${centsDeviation >= 0 ? '+' : ''}${centsDeviation.toFixed(0)}¢`;
          compareColor = Math.abs(centsDeviation) < 10 ? '#4ade80' : Math.abs(centsDeviation) < 30 ? '#fbbf24' : '#f87171';
        }

        // For small labels, show only index
        const showName = n <= 24;

        return (
          <g key={i} onClick={() => onToggle(i)} style={{ cursor: 'pointer' }}>
            <circle
              cx={x} cy={y} r={dotR}
              fill={isActive ? '#6366f1' : '#1f2937'}
              stroke={isActive ? '#818cf8' : '#374151'}
              strokeWidth={isActive ? 2 : 1.5}
              className="transition-colors duration-75"
            />
            {showName && (
              <text
                x={x} y={y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={dotR > 10 ? 8 : 6}
                fill={isActive ? '#e0e7ff' : '#6b7280'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {label.length <= 3 ? label : `${i}`}
              </text>
            )}
            {!showName && (
              <text
                x={x} y={y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={5.5}
                fill={isActive ? '#e0e7ff' : '#6b7280'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {i}
              </text>
            )}
            {/* Compare label outside the circle */}
            {compareMode && isActive && compareLabel && (() => {
              const labelR = radius + 22;
              const lx = cx + labelR * Math.cos(angle);
              const ly = cy + labelR * Math.sin(angle);
              return (
                <text
                  x={lx} y={ly}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={6}
                  fill={compareColor}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {compareLabel}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* Center label */}
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={10}
        fill="#4b5563"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {tuning.name}
      </text>
    </svg>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────

interface AnalysisPanelProps {
  selected: number[];
  tuning: TuningSystem;
}

function AnalysisPanel({ selected, tuning }: AnalysisPanelProps) {
  const n = tuning.divisions;

  if (selected.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        Click pitch-class nodes to build a set.
      </div>
    );
  }

  const iv = generalizedIntervalVector(selected, n);
  const group = generalizedSymmetryGroup(selected, n);
  const isMe = generalizedMaximallyEven(selected, n);

  return (
    <div className="space-y-3">
      {/* Group + ME */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Symmetry Group</div>
          <div className="text-2xl font-bold text-indigo-400">{group}</div>
          <div className="text-xs text-gray-500">in Z<sub>{n}</sub></div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Maximally Even</div>
          <div className={`text-2xl font-bold ${isMe ? 'text-green-400' : 'text-gray-500'}`}>
            {isMe ? 'Yes' : 'No'}
          </div>
          <div className="text-xs text-gray-500">
            {isMe ? `${selected.length} of ${n} evenly distributed` : 'Uneven spacing'}
          </div>
        </div>
      </div>

      {/* Set content */}
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2">Selected Pitch Classes</div>
        <div className="flex flex-wrap gap-1.5">
          {[...selected].sort((a, b) => a - b).map(pc => (
            <span
              key={pc}
              className="px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700 text-indigo-300 text-sm font-mono"
            >
              {tuning.noteNames[pc] ?? pc}
            </span>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {selected.length} of {n} pitch classes
        </div>
      </div>

      {/* Interval vector */}
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2">
          Interval Vector (Z<sub>{n}</sub>) — {iv.length} interval classes
        </div>
        <div className="flex flex-wrap gap-1.5">
          {iv.map((count, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-200 text-sm font-mono min-w-[2rem] text-center">
                {count}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5">
                {tuning.intervalNames?.[i] ?? `ic${i + 1}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Compare Panel ────────────────────────────────────────────────────────────

interface ComparePanelProps {
  selected: number[];
  tuning: TuningSystem;
}

function ComparePanel({ selected, tuning }: ComparePanelProps) {
  if (selected.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-4">
        Select notes to see their 12-TET equivalents.
      </div>
    );
  }

  const noteNames12 = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-2">
        Each note mapped to the nearest 12-TET pitch class with cents deviation.
      </div>
      <div className="space-y-1.5">
        {[...selected].sort((a, b) => a - b).map(pc => {
          const { pc12, centsDeviation } = nearestTwelveTET(pc, tuning);
          const name = tuning.noteNames[pc] ?? `${pc}`;
          const name12 = noteNames12[pc12]!;
          const absDeviation = Math.abs(centsDeviation);
          const deviationColor =
            absDeviation < 10 ? 'text-green-400' :
            absDeviation < 30 ? 'text-yellow-400' :
            'text-red-400';
          return (
            <div key={pc} className="flex items-center gap-2 text-sm">
              <span className="w-12 font-mono text-indigo-300">{name}</span>
              <span className="text-gray-600">→</span>
              <span className="w-8 font-mono text-gray-200">{name12}</span>
              <span className={`text-xs font-mono ${deviationColor}`}>
                {centsDeviation >= 0 ? '+' : ''}{centsDeviation.toFixed(1)}¢
              </span>
              <div className="flex-1 bg-gray-700 rounded-full h-1">
                <div
                  className={`h-1 rounded-full transition-all ${absDeviation < 10 ? 'bg-green-400' : absDeviation < 30 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, (absDeviation / 50) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-600 mt-2">
        Green = within 10¢ (nearly identical) · Yellow = 10–30¢ (noticeable) · Red = &gt;30¢ (very different)
      </div>
    </div>
  );
}

// ─── Audio Playback ───────────────────────────────────────────────────────────

function playNote(freq: number, ctx: AudioContext, time: number, duration = 0.5): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.25, time + 0.02);
  gain.gain.setValueAtTime(0.25, time + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, time + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

// ─── Research-tier custom tuning ──────────────────────────────────────────────

interface CustomTuning {
  divisions: number;
}

function makeCustomTuning(ct: CustomTuning): TuningSystem {
  return {
    name: `${ct.divisions}-TET (custom)`,
    divisions: ct.divisions,
    referenceFreq: 440,
    referencePitch: 0,
    stepRatio: Math.pow(2, 1 / ct.divisions),
    noteNames: Array.from({ length: ct.divisions }, (_, i) => `${i}`),
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TuningPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';
  const isResearch = tier === 'research';

  const availableTunings = isPro ? PRO_TUNINGS : FREE_TUNINGS;

  const [tuning, setTuning] = useState<TuningSystem>(TUNING_12TET);
  const [selected, setSelected] = useState<number[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'compare' | 'education'>('analysis');
  const [customDivisions, setCustomDivisions] = useState(17);
  const [useCustom, setUseCustom] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const activeTuning = isResearch && useCustom ? makeCustomTuning({ divisions: customDivisions }) : tuning;

  const togglePc = useCallback((i: number) => {
    setSelected(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i],
    );
  }, []);

  const clearSelected = useCallback(() => setSelected([]), []);

  const handleTuningChange = useCallback((t: TuningSystem) => {
    setTuning(t);
    setSelected([]);
    setUseCustom(false);
  }, []);

  // Play selected notes as an arpeggio
  const playSelected = useCallback(() => {
    if (selected.length === 0) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const sorted = [...selected].sort((a, b) => a - b);
    const now = ctx.currentTime + 0.05;
    const duration = 0.45;
    const gap = 0.5;
    sorted.forEach((pc, i) => {
      const freq = frequencyInTuning(pc, 0, activeTuning);
      playNote(freq, ctx, now + i * gap, duration);
    });
  }, [selected, activeTuning]);

  // Play all notes as a chromatic run
  const playAll = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const n = activeTuning.divisions;
    const now = ctx.currentTime + 0.05;
    const gap = 0.3;
    for (let i = 0; i < n; i++) {
      const freq = frequencyInTuning(i, 0, activeTuning);
      playNote(freq, ctx, now + i * gap, 0.25);
    }
  }, [activeTuning]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'compare', label: 'Compare to 12-TET' },
    { id: 'education', label: 'About' },
  ];

  const info = TUNING_INFO[activeTuning.name] ?? TUNING_INFO[tuning.name];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-gray-800/50 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tuning selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Tuning:</span>
            <div className="flex flex-wrap gap-1">
              {availableTunings.map(t => (
                <button
                  key={t.name}
                  onClick={() => handleTuningChange(t)}
                  className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                    tuning.name === t.name && !useCustom
                      ? 'bg-indigo-700 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {t.name}
                </button>
              ))}

              {/* Locked tunings for free users */}
              {!isPro &&
                PRO_TUNINGS.filter(t => !FREE_TUNINGS.includes(t)).map(t => (
                  <button
                    key={t.name}
                    disabled
                    title="Pro tier required"
                    className="px-2.5 py-1 rounded text-sm font-medium bg-gray-800 text-gray-600 cursor-not-allowed opacity-60"
                  >
                    {t.name} 🔒
                  </button>
                ))}
            </div>
          </div>

          {/* Research: custom divisions */}
          {isResearch && (
            <div className="flex items-center gap-2 border-l border-gray-700 pl-3">
              <span className="text-xs text-purple-400 font-semibold">Research:</span>
              <label className="text-sm text-gray-400">Divisions:</label>
              <input
                type="number"
                min={5}
                max={72}
                value={customDivisions}
                onChange={e => {
                  const v = Math.max(5, Math.min(72, Number(e.target.value)));
                  setCustomDivisions(v);
                  setSelected([]);
                }}
                className="w-16 rounded bg-gray-700 border border-gray-600 text-gray-200 text-sm px-2 py-1"
              />
              <button
                onClick={() => { setUseCustom(true); setSelected([]); }}
                className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                  useCustom ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-purple-700 hover:text-white'
                }`}
              >
                Use Custom
              </button>
            </div>
          )}

          <span className="w-px h-5 bg-gray-600 mx-1" />

          {/* Actions */}
          <button
            onClick={playSelected}
            disabled={selected.length === 0}
            className="px-3 py-1.5 rounded text-sm font-medium bg-green-700 text-white hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ▶ Play Set
          </button>
          <button
            onClick={playAll}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Play Scale
          </button>
          <button
            onClick={clearSelected}
            disabled={selected.length === 0}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setCompareMode(m => !m)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              compareMode ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            12-TET Labels
          </button>
        </div>

        {!isPro && (
          <div className="mt-3 text-xs text-amber-400">
            Free tier: 12-TET and 19-TET only.{' '}
            <a href="#dashboard" className="underline hover:text-amber-300">Upgrade to Pro</a> for 24-TET, 31-TET, and Bohlen-Pierce.
            <span className="text-purple-400 ml-2">
              Research tier also unlocks custom divisions.
            </span>
          </div>
        )}
        {isPro && !isResearch && (
          <div className="mt-3 text-xs text-gray-500">
            <span className="text-purple-400">Research tier</span> unlocks custom tuning definitions (any N-TET from 5–72).
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Circle diagram */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-1 text-center">
            {activeTuning.name} — {activeTuning.divisions} equal divisions
            {activeTuning.isTritave ? ' of the tritave (3:1)' : ' of the octave (2:1)'}
          </h2>
          <p className="text-xs text-gray-500 text-center mb-3">
            Click nodes to select pitch classes
          </p>
          <CircleDiagram
            tuning={activeTuning}
            selected={selected}
            onToggle={togglePc}
            compareMode={compareMode}
          />
          {compareMode && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Labels show nearest 12-TET pitch + cents deviation
            </p>
          )}
        </div>

        {/* Analysis panels */}
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-700 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'analysis' && (
            <AnalysisPanel selected={selected} tuning={activeTuning} />
          )}

          {activeTab === 'compare' && (
            <div className="space-y-3">
              <ComparePanel selected={selected} tuning={activeTuning} />
              {activeTuning.name === '12-TET' && (
                <p className="text-xs text-gray-500">
                  This is 12-TET — all deviations are 0¢ by definition.
                </p>
              )}
            </div>
          )}

          {activeTab === 'education' && info && (
            <div className="space-y-3 text-sm text-gray-400">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="font-semibold text-gray-200 mb-1">{activeTuning.name}</div>
                <p className="text-indigo-300 mb-2">{info.description}</p>
                <p>{info.detail}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-xs space-y-1">
                <div className="text-gray-300 font-medium mb-1">System parameters</div>
                <div>Divisions: <span className="text-indigo-300">{activeTuning.divisions}</span></div>
                <div>Step size: <span className="text-indigo-300">
                  {(1200 / activeTuning.divisions).toFixed(3)}¢
                  {activeTuning.isTritave ? ' (of 1902¢ tritave)' : ''}
                </span></div>
                <div>Reference: <span className="text-indigo-300">
                  {activeTuning.noteNames[activeTuning.referencePitch] ?? activeTuning.referencePitch} = {activeTuning.referenceFreq} Hz
                </span></div>
                <div>Step ratio: <span className="text-indigo-300">
                  {activeTuning.stepRatio.toFixed(6)}
                </span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Frequency table */}
      {selected.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">
            Frequencies — octave 0 ({activeTuning.referenceFreq} Hz reference)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1 pr-4">Index</th>
                  <th className="text-left py-1 pr-4">Name</th>
                  <th className="text-left py-1 pr-4">Frequency (Hz)</th>
                  {!activeTuning.isTritave && (
                    <th className="text-left py-1 pr-4">Cents from C</th>
                  )}
                  {compareMode && <th className="text-left py-1 pr-4">12-TET approx.</th>}
                </tr>
              </thead>
              <tbody>
                {[...selected].sort((a, b) => a - b).map(pc => {
                  const freq = frequencyInTuning(pc, 0, activeTuning);
                  const cents = pc * (1200 / activeTuning.divisions);
                  const { pc12, centsDeviation } = nearestTwelveTET(pc, activeTuning);
                  const noteNames12 = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
                  return (
                    <tr key={pc} className="border-b border-gray-800 hover:bg-gray-800/40">
                      <td className="py-1.5 pr-4 font-mono text-gray-400">{pc}</td>
                      <td className="py-1.5 pr-4 font-medium text-indigo-300">
                        {activeTuning.noteNames[pc] ?? pc}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-gray-200">{freq.toFixed(3)}</td>
                      {!activeTuning.isTritave && (
                        <td className="py-1.5 pr-4 font-mono text-gray-400">{cents.toFixed(1)}¢</td>
                      )}
                      {compareMode && (
                        <td className="py-1.5 pr-4 text-xs font-mono">
                          <span className="text-gray-200">{noteNames12[pc12]}</span>
                          <span className={`ml-1 ${Math.abs(centsDeviation) < 10 ? 'text-green-400' : Math.abs(centsDeviation) < 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {centsDeviation >= 0 ? '+' : ''}{centsDeviation.toFixed(1)}¢
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Theory note */}
      <div className="bg-gray-800/30 rounded-xl p-4 text-sm text-gray-400 space-y-2">
        <p>
          <span className="text-gray-200 font-medium">Math:</span> Every N-TET tuning defines a cyclic group Z<sub>N</sub>. All the symmetry operations from 12-TET — transposition, inversion, interval vectors, maximal evenness — generalize immediately: replace "mod 12" with "mod N". The interval class count becomes ⌊N/2⌋ instead of 6.
        </p>
        <p>
          <span className="text-gray-200 font-medium">Bohlen-Pierce</span> breaks the octave convention entirely — its "scale" repeats at the tritave (3:1 ≈ 1902 cents) rather than the octave (2:1 = 1200 cents), making 13 equal steps per tritave. All Z<sub>13</sub> symmetry math applies.
        </p>
        <p>
          <span className="text-gray-200 font-medium">Cents deviation</span> measures how far each pitch in the chosen tuning is from the nearest 12-TET semitone. Values near 0¢ sound like familiar 12-TET notes; large deviations produce the characteristic "out of tune" or "exotic" quality of microtonal music.
        </p>
      </div>
    </div>
  );
}
