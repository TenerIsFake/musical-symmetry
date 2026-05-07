import { useState, useEffect, useRef, useCallback } from 'react';
import {
  analyzeRhythm,
  rotateRhythm,
  rhythmSimilarity,
} from '@musical-symmetry/core';
import type { Beat, RhythmPattern, RhythmAnalysis } from '@musical-symmetry/core';

// ─── Famous Rhythm Presets ────────────────────────────────────────────────────

interface RhythmPreset {
  name: string;
  pattern: Beat[];
  description: string;
}

const FAMOUS_RHYTHMS: RhythmPreset[] = [
  {
    name: 'Tresillo',
    pattern: [1,0,0,1,0,0,1,0] as Beat[],
    description: '3+3+2 subdivision — Cuban foundation',
  },
  {
    name: 'Son Clave (3-2)',
    pattern: [1,0,0,1,0,0,1,0,0,0,1,0,1,0,0,0] as Beat[],
    description: 'Afro-Cuban 3-2 clave in 16 steps',
  },
  {
    name: 'Rumba Clave',
    pattern: [1,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0] as Beat[],
    description: 'Afro-Cuban rumba clave',
  },
  {
    name: 'Bossa Nova',
    pattern: [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0] as Beat[],
    description: 'Brazilian bossa nova clave',
  },
  {
    name: 'Standard Bell',
    pattern: [1,0,1,1,0,1,1,0,1,0,1,1] as Beat[],
    description: 'West African bell (Ewe/Yoruba) — 12-step',
  },
  {
    name: 'Shiko',
    pattern: [1,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0] as Beat[],
    description: 'Afro-Cuban shiko clave',
  },
  {
    name: 'Gahu',
    pattern: [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0] as Beat[],
    description: 'Ewe Gahu bell pattern',
  },
];

// ─── Web Audio helpers ────────────────────────────────────────────────────────

function createAudioContext(): AudioContext {
  return new AudioContext();
}

/**
 * Synthesize a short kick/click using an oscillator + noise burst.
 */
function playClick(ctx: AudioContext, time: number, isAccent = false): void {
  // Sine "thud" at ~60-80 Hz with pitch drop
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(isAccent ? 120 : 80, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.08);
  oscGain.gain.setValueAtTime(0.7, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.15);

  // Short noise burst for transient
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(time);
}

// ─── Circular Sequencer SVG ───────────────────────────────────────────────────

interface CircularSequencerProps {
  pattern: RhythmPattern;
  currentStep: number;
  onToggle: (index: number) => void;
  highlightRotations?: boolean;
  analysis: RhythmAnalysis | null;
}

function CircularSequencer({ pattern, currentStep, onToggle, highlightRotations, analysis }: CircularSequencerProps) {
  const n = pattern.length;
  const cx = 150;
  const cy = 150;
  const outerR = 120;
  const stepR = 14;

  // Compute which steps are "symmetry copies" of step 0 under rotational symmetry
  const symmetrySteps = new Set<number>();
  if (highlightRotations && analysis && analysis.rotationalSymmetry > 1) {
    const period = n / analysis.rotationalSymmetry;
    for (let k = 0; k < analysis.rotationalSymmetry; k++) {
      symmetrySteps.add(Math.round(k * period) % n);
    }
  }

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full max-w-xs mx-auto select-none"
      aria-label="Circular step sequencer"
    >
      {/* Track ring */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#374151" strokeWidth={2} />

      {/* Center pulse indicator */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={currentStep >= 0 ? '#6366f1' : '#1f2937'}
        className="transition-colors duration-100"
      />

      {/* Steps */}
      {pattern.map((beat, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = cx + outerR * Math.cos(angle);
        const y = cy + outerR * Math.sin(angle);
        const isActive = beat === 1;
        const isCurrent = i === currentStep;
        const isSymmetry = symmetrySteps.has(i);

        let fill = isActive ? '#6366f1' : '#1f2937';
        let stroke = isActive ? '#818cf8' : '#374151';
        if (isCurrent) {
          fill = isActive ? '#a5b4fc' : '#4b5563';
          stroke = '#e5e7eb';
        }
        if (isSymmetry && !isCurrent) {
          stroke = '#f59e0b';
        }

        return (
          <g key={i} onClick={() => onToggle(i)} style={{ cursor: 'pointer' }}>
            <circle
              cx={x}
              cy={y}
              r={stepR}
              fill={fill}
              stroke={stroke}
              strokeWidth={isCurrent ? 2.5 : 1.5}
              className="transition-colors duration-75"
            />
            <text
              x={x}
              y={y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill={isActive ? '#e0e7ff' : '#6b7280'}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Analysis Panel ───────────────────────────────────────────────────────────

interface AnalysisPanelProps {
  analysis: RhythmAnalysis;
}

function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const { length, onsets, rotationalSymmetry, isPalindrome, necklaceClass, evenness, interOnsetIntervals } = analysis;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Rotational Symmetry</div>
          <div className="text-2xl font-bold text-indigo-400">{rotationalSymmetry}</div>
          <div className="text-xs text-gray-500">
            {rotationalSymmetry === 1 ? 'Only trivial (identity)' : `${rotationalSymmetry} self-maps`}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Palindrome</div>
          <div className={`text-2xl font-bold ${isPalindrome ? 'text-green-400' : 'text-gray-500'}`}>
            {isPalindrome ? 'Yes' : 'No'}
          </div>
          <div className="text-xs text-gray-500">Reflective symmetry</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Evenness</div>
          <div className="text-2xl font-bold text-amber-400">{(evenness * 100).toFixed(1)}%</div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
            <div
              className="bg-amber-400 h-1.5 rounded-full transition-all"
              style={{ width: `${evenness * 100}%` }}
            />
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Onsets / Beats</div>
          <div className="text-2xl font-bold text-purple-400">{onsets}<span className="text-base text-gray-500">/{length}</span></div>
          <div className="text-xs text-gray-500">Density: {onsets > 0 ? ((onsets / length) * 100).toFixed(0) : 0}%</div>
        </div>
      </div>

      {/* Necklace Class */}
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-1">Necklace Class (canonical rotation)</div>
        <code className="text-xs font-mono text-green-300 break-all">
          {necklaceClass || <span className="text-gray-500">—</span>}
        </code>
      </div>

      {/* IOI Vector */}
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2">Inter-Onset Intervals</div>
        {interOnsetIntervals.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {interOnsetIntervals.map((ioi, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 rounded text-indigo-300 text-sm font-mono"
              >
                {ioi}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500 text-sm">No onsets or only one onset</span>
        )}
        {interOnsetIntervals.length > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            Sum: {interOnsetIntervals.reduce((a, b) => a + b, 0)} (= {length} steps)
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compare Panel ────────────────────────────────────────────────────────────

interface ComparePanelProps {
  patternA: RhythmPattern;
  patternB: RhythmPattern;
}

function ComparePanel({ patternA, patternB }: ComparePanelProps) {
  const sim = rhythmSimilarity(patternA, patternB);
  const analysisA = analyzeRhythm(patternA);
  const analysisB = analyzeRhythm(patternB);

  return (
    <div className="space-y-3">
      <div className="bg-gray-800 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-400 mb-1">Similarity Score</div>
        <div className="text-4xl font-bold text-indigo-400">{(sim * 100).toFixed(1)}%</div>
        <div className="text-xs text-gray-500 mt-1">
          {sim >= 0.9 ? 'Nearly identical' : sim >= 0.7 ? 'Closely related' : sim >= 0.5 ? 'Moderately similar' : 'Quite different'}
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
          <div
            className="bg-indigo-400 h-2 rounded-full transition-all"
            style={{ width: `${sim * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {[
          { label: 'Pattern A', a: analysisA },
          { label: 'Pattern B', a: analysisB },
        ].map(({ label, a }) => (
          <div key={label} className="bg-gray-800 rounded-lg p-2 space-y-1">
            <div className="text-xs font-semibold text-gray-300">{label}</div>
            <div className="text-xs text-gray-400">Rot. sym: <span className="text-indigo-400">{a.rotationalSymmetry}</span></div>
            <div className="text-xs text-gray-400">Palindrome: <span className={a.isPalindrome ? 'text-green-400' : 'text-gray-500'}>{a.isPalindrome ? 'Yes' : 'No'}</span></div>
            <div className="text-xs text-gray-400">Evenness: <span className="text-amber-400">{(a.evenness * 100).toFixed(1)}%</span></div>
            <div className="text-xs text-gray-400">IOI: <span className="text-gray-300 font-mono">[{a.interOnsetIntervals.join(',')}]</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STEP_OPTIONS = [8, 12, 16, 24, 32] as const;

function makeEmptyPattern(n: number): RhythmPattern {
  return Array(n).fill(0) as RhythmPattern;
}

export default function RhythmPage() {
  const [steps, setSteps] = useState<8 | 12 | 16 | 24 | 32>(16);
  const [pattern, setPattern] = useState<RhythmPattern>(() => makeEmptyPattern(16));
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [highlightRotations, setHighlightRotations] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [patternB, setPatternB] = useState<RhythmPattern>(() => makeEmptyPattern(16));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const isPlayingRef = useRef(false);
  const patternRef = useRef(pattern);
  const stepsRef = useRef(steps);
  const bpmRef = useRef(bpm);

  // Keep refs in sync
  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentStep(-1);
    currentStepRef.current = 0;
    if (schedulerRef.current) clearTimeout(schedulerRef.current);
    schedulerRef.current = null;
  }, []);

  const scheduleStep = useCallback(() => {
    if (!audioCtxRef.current || !isPlayingRef.current) return;
    const ctx = audioCtxRef.current;
    const lookahead = 0.1; // seconds
    const scheduleAhead = 0.05; // schedule this far in advance

    while (nextStepTimeRef.current < ctx.currentTime + lookahead) {
      const step = currentStepRef.current;
      const beat = patternRef.current[step];
      if (beat === 1) {
        playClick(ctx, nextStepTimeRef.current, step === 0);
      }

      // Update UI step display (schedule with rAF-like approach)
      const stepToShow = step;
      const delay = Math.max(0, (nextStepTimeRef.current - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (isPlayingRef.current) setCurrentStep(stepToShow);
      }, delay);

      const secondsPerBeat = 60 / bpmRef.current;
      const secondsPerStep = secondsPerBeat / (stepsRef.current / 4); // steps per bar, 4/4
      nextStepTimeRef.current += secondsPerStep;
      currentStepRef.current = (currentStepRef.current + 1) % stepsRef.current;
    }

    schedulerRef.current = setTimeout(scheduleStep, scheduleAhead * 1000);
  }, []);

  const startPlayback = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    currentStepRef.current = 0;
    nextStepTimeRef.current = ctx.currentTime + 0.05;
    isPlayingRef.current = true;
    setIsPlaying(true);
    scheduleStep();
  }, [scheduleStep]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, stopPlayback]);

  // Stop playback when component unmounts
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const toggleBeat = useCallback((index: number) => {
    setPattern(prev => {
      const next = [...prev] as RhythmPattern;
      next[index] = next[index] === 1 ? 0 : 1;
      return next;
    });
  }, []);

  const toggleBeatB = useCallback((index: number) => {
    setPatternB(prev => {
      const next = [...prev] as RhythmPattern;
      next[index] = next[index] === 1 ? 0 : 1;
      return next;
    });
  }, []);

  const handleStepsChange = useCallback((n: 8 | 12 | 16 | 24 | 32) => {
    stopPlayback();
    setSteps(n);
    setPattern(prev => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n) as RhythmPattern;
      return [...prev, ...makeEmptyPattern(n - prev.length)] as RhythmPattern;
    });
    setPatternB(prev => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n) as RhythmPattern;
      return [...prev, ...makeEmptyPattern(n - prev.length)] as RhythmPattern;
    });
  }, [stopPlayback]);

  const loadPreset = useCallback((preset: RhythmPreset) => {
    stopPlayback();
    const n = steps;
    let p = [...preset.pattern] as RhythmPattern;
    if (p.length < n) p = [...p, ...makeEmptyPattern(n - p.length)] as RhythmPattern;
    else if (p.length > n) p = p.slice(0, n) as RhythmPattern;
    setPattern(p);
  }, [steps, stopPlayback]);

  const loadPresetB = useCallback((preset: RhythmPreset) => {
    const n = steps;
    let p = [...preset.pattern] as RhythmPattern;
    if (p.length < n) p = [...p, ...makeEmptyPattern(n - p.length)] as RhythmPattern;
    else if (p.length > n) p = p.slice(0, n) as RhythmPattern;
    setPatternB(p);
  }, [steps]);

  const clearPattern = useCallback(() => {
    stopPlayback();
    setPattern(makeEmptyPattern(steps));
  }, [steps, stopPlayback]);

  const analysis: RhythmAnalysis = analyzeRhythm(pattern);

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-gray-800/50 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Steps selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-gray-400">Steps:</span>
            <div className="flex gap-1">
              {STEP_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => handleStepsChange(n)}
                  className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                    steps === n ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* BPM */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">BPM:</span>
            <input
              type="range"
              min={60}
              max={200}
              value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              className="w-28 accent-indigo-500"
            />
            <span className="text-sm text-white w-8 text-right">{bpm}</span>
          </div>

          {/* Play/Stop */}
          <button
            onClick={togglePlayback}
            className={`px-4 py-1.5 rounded font-medium text-sm transition-colors ${
              isPlaying ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>

          {/* Clear */}
          <button
            onClick={clearPattern}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            Clear
          </button>

          {/* Highlight rotations */}
          <button
            onClick={() => setHighlightRotations(h => !h)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              highlightRotations ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Highlight steps that are symmetry copies of each other"
          >
            Show Symmetry
          </button>

          {/* Compare mode */}
          <button
            onClick={() => setCompareMode(c => !c)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              compareMode ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Compare Mode
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className={`grid gap-6 ${compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* Pattern A */}
        <div className="space-y-4">
          {compareMode && <h3 className="text-base font-semibold text-gray-200">Pattern A</h3>}

          {/* Circular Sequencer */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 text-center">Step Sequencer</h2>
            <CircularSequencer
              pattern={pattern}
              currentStep={currentStep}
              onToggle={toggleBeat}
              highlightRotations={highlightRotations}
              analysis={analysis}
            />
            {highlightRotations && analysis.rotationalSymmetry > 1 && (
              <p className="text-xs text-amber-400 text-center mt-2">
                Gold rings mark steps related by symmetry (period = {steps / analysis.rotationalSymmetry})
              </p>
            )}
          </div>

          {/* Presets */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Famous Rhythms</h2>
            <div className="flex flex-wrap gap-1.5">
              {FAMOUS_RHYTHMS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  title={preset.description}
                  className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-indigo-700 hover:text-white transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pattern B (compare mode only) */}
        {compareMode && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-200">Pattern B</h3>

            <div className="bg-gray-800/50 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 text-center">Step Sequencer</h2>
              <CircularSequencer
                pattern={patternB}
                currentStep={-1}
                onToggle={toggleBeatB}
                highlightRotations={false}
                analysis={analyzeRhythm(patternB)}
              />
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-2">Famous Rhythms</h2>
              <div className="flex flex-wrap gap-1.5">
                {FAMOUS_RHYTHMS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => loadPresetB(preset)}
                    title={preset.description}
                    className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-purple-700 hover:text-white transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analysis section */}
      <div className={`grid gap-6 ${compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Analysis Panel for A */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <h2 className="text-base font-semibold text-gray-200 mb-3">
            {compareMode ? 'Analysis — Pattern A' : 'Rhythm Analysis'}
          </h2>
          <AnalysisPanel analysis={analysis} />
        </div>

        {/* Compare panel or Analysis panel for B */}
        {compareMode && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h2 className="text-base font-semibold text-gray-200 mb-3">Analysis — Pattern B</h2>
              <AnalysisPanel analysis={analyzeRhythm(patternB)} />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h2 className="text-base font-semibold text-gray-200 mb-3">Similarity Comparison</h2>
              <ComparePanel patternA={pattern} patternB={patternB} />
            </div>
          </div>
        )}
      </div>

      {/* Theory note */}
      <div className="bg-gray-800/30 rounded-xl p-4 text-sm text-gray-400 space-y-1">
        <p><span className="text-gray-200 font-medium">Math:</span> A rhythm in <em>n</em> steps is a binary necklace in Z<sub>n</sub> — exactly like pitch-class sets. Rotational symmetry = number of rotations that are self-maps (by Burnside's lemma). Evenness = 1 − mean resultant length of onsets on the unit circle (circular variance). The necklace class is the lexicographically smallest rotation.</p>
        <p><span className="text-gray-200 font-medium">Maximally even rhythms</span> (like the 3+3+2 tresillo) are the rhythmic counterparts of maximally even scales: each inter-onset interval is ⌊n/k⌋ or ⌈n/k⌉.</p>
      </div>
    </div>
  );
}
