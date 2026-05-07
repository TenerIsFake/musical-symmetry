import { useState, useEffect, useRef, useCallback } from 'react';
import {
  euclidean,
  matchClave,
  analyzeRhythm,
  rotateRhythm,
  isMaximallyEvenRhythm,
} from '@musical-symmetry/core';
import type { RhythmPattern, KnownClave } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';

// ─── Web Audio Helpers ────────────────────────────────────────────────────────

function playKick(ctx: AudioContext, time: number): void {
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.08);
  oscGain.gain.setValueAtTime(0.7, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.15);

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

function playTick(ctx: AudioContext, time: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200, time);
  gain.gain.setValueAtTime(0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.04);
}

// ─── Circular Diagram ─────────────────────────────────────────────────────────

interface CircularDiagramProps {
  pattern: RhythmPattern;
  currentStep: number;
}

function CircularDiagram({ pattern, currentStep }: CircularDiagramProps) {
  const n = pattern.length;
  const cx = 150;
  const cy = 150;
  const outerR = 120;
  const dotR = Math.max(5, Math.min(12, 120 / n));

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full max-w-xs mx-auto select-none"
      aria-label="Euclidean rhythm circular diagram"
    >
      {/* Track ring */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#374151" strokeWidth={1.5} />

      {/* Center pulse */}
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill={currentStep >= 0 ? '#6366f1' : '#1f2937'}
        className="transition-colors duration-100"
      />

      {/* Steps */}
      {pattern.map((beat, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = cx + outerR * Math.cos(angle);
        const y = cy + outerR * Math.sin(angle);
        const isOnset = beat === 1;
        const isCurrent = i === currentStep;

        let fill: string;
        let stroke: string;
        if (isCurrent) {
          fill = isOnset ? '#a5b4fc' : '#4b5563';
          stroke = '#e5e7eb';
        } else {
          fill = isOnset ? '#6366f1' : '#111827';
          stroke = isOnset ? '#818cf8' : '#374151';
        }

        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={dotR}
              fill={fill}
              stroke={stroke}
              strokeWidth={isCurrent ? 2.5 : isOnset ? 2 : 1}
              className="transition-colors duration-75"
            />
            {/* Draw line from center to onset */}
            {isOnset && (
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="#4338ca"
                strokeWidth={0.8}
                strokeOpacity={0.4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Step Grid ────────────────────────────────────────────────────────────────

interface StepGridProps {
  pattern: RhythmPattern;
  currentStep: number;
}

function StepGrid({ pattern, currentStep }: StepGridProps) {
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {pattern.map((beat, i) => {
        const isOnset = beat === 1;
        const isCurrent = i === currentStep;
        return (
          <div
            key={i}
            className={`
              flex items-center justify-center rounded text-xs font-mono transition-colors duration-75
              ${pattern.length <= 16 ? 'w-8 h-8' : pattern.length <= 32 ? 'w-6 h-6' : 'w-5 h-5'}
              ${isCurrent
                ? isOnset ? 'bg-indigo-300 text-gray-900' : 'bg-gray-500 text-gray-200'
                : isOnset ? 'bg-indigo-700 text-white' : 'bg-gray-800 text-gray-600 border border-gray-700'
              }
            `}
            title={`Step ${i + 1}: ${isOnset ? 'onset' : 'rest'}`}
          >
            {isOnset ? '•' : '·'}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EuclideanPage() {
  const { user } = useUser();
  const isPro = user?.tier === 'pro' || user?.tier === 'research';

  const maxN = isPro ? 64 : 16;

  const [n, setN] = useState(16);
  const [k, setK] = useState(5);
  const [rotation, setRotation] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  // Clamp n when tier changes
  useEffect(() => {
    if (n > maxN) setN(maxN);
  }, [maxN, n]);

  // Clamp k when n changes
  const clampedK = Math.min(k, n);
  useEffect(() => {
    if (k > n) setK(n);
  }, [n, k]);

  const basePattern: RhythmPattern = euclidean(clampedK, n);
  const pattern: RhythmPattern = rotateRhythm(basePattern, rotation);

  const analysis = analyzeRhythm(pattern);
  const isMaximallyEven = isMaximallyEvenRhythm(pattern);
  const claveMatch: KnownClave | null = matchClave(pattern);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const isPlayingRef = useRef(false);
  const patternRef = useRef(pattern);
  const nRef = useRef(n);
  const bpmRef = useRef(bpm);

  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { nRef.current = n; }, [n]);
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
    const lookahead = 0.1;
    const scheduleAhead = 0.05;

    while (nextStepTimeRef.current < ctx.currentTime + lookahead) {
      const step = currentStepRef.current;
      const beat = patternRef.current[step];
      if (beat === 1) {
        playKick(ctx, nextStepTimeRef.current);
      } else {
        playTick(ctx, nextStepTimeRef.current);
      }

      const stepToShow = step;
      const delay = Math.max(0, (nextStepTimeRef.current - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (isPlayingRef.current) setCurrentStep(stepToShow);
      }, delay);

      const secondsPerBeat = 60 / bpmRef.current;
      const secondsPerStep = secondsPerBeat / (nRef.current / 4);
      nextStepTimeRef.current += secondsPerStep;
      currentStepRef.current = (currentStepRef.current + 1) % nRef.current;
    }

    schedulerRef.current = setTimeout(scheduleStep, scheduleAhead * 1000);
  }, []);

  const startPlayback = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') void ctx.resume();

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

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // When n changes mid-play, reset
  useEffect(() => {
    if (isPlaying) stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* n slider */}
          <div className="flex items-center gap-3 min-w-0">
            <label className="text-sm text-gray-400 whitespace-nowrap">
              Steps <span className="text-white font-semibold">(n={n})</span>
            </label>
            <input
              type="range"
              min={2}
              max={maxN}
              value={n}
              onChange={e => {
                const val = Number(e.target.value);
                setN(val);
                setRotation(0);
              }}
              className="w-36 accent-indigo-500"
            />
            {!isPro && (
              <span className="text-xs text-amber-400 whitespace-nowrap">
                Pro: up to 64
              </span>
            )}
          </div>

          {/* k slider */}
          <div className="flex items-center gap-3 min-w-0">
            <label className="text-sm text-gray-400 whitespace-nowrap">
              Onsets <span className="text-white font-semibold">(k={clampedK})</span>
            </label>
            <input
              type="range"
              min={0}
              max={n}
              value={clampedK}
              onChange={e => setK(Number(e.target.value))}
              className="w-36 accent-purple-500"
            />
          </div>

          {/* rotation slider */}
          <div className="flex items-center gap-3 min-w-0">
            <label className="text-sm text-gray-400 whitespace-nowrap">
              Rotation <span className="text-white font-semibold">({rotation})</span>
            </label>
            <input
              type="range"
              min={0}
              max={n - 1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="w-28 accent-teal-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {/* Reset rotation */}
          <button
            onClick={() => setRotation(0)}
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            Reset Rotation
          </button>

          {/* Send to Rhythm Track placeholder */}
          <button
            className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-500 cursor-not-allowed"
            title="Coming soon: link to Sketchpad rhythm track"
            disabled
          >
            Send to Rhythm Track
          </button>
        </div>
      </div>

      {/* Clave match badge */}
      {claveMatch && (
        <div className="flex items-center gap-3 bg-amber-900/30 border border-amber-700/50 rounded-xl px-4 py-3">
          <span className="text-amber-400 text-lg">🥁</span>
          <div>
            <span className="text-amber-300 font-semibold">{claveMatch.name}</span>
            <span className="text-gray-400 text-sm ml-2">— {claveMatch.origin} rhythm</span>
          </div>
          <span className="ml-auto text-xs text-amber-600 bg-amber-900/50 px-2 py-0.5 rounded">Clave Match</span>
        </div>
      )}

      {/* Maximally even badge */}
      {isMaximallyEven && (
        <div className="flex items-center gap-3 bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-2">
          <span className="text-green-400 font-semibold text-sm">Maximally Even</span>
          <span className="text-gray-400 text-xs">Every IOI is ⌊{n}/{clampedK}⌋ or ⌈{n}/{clampedK}⌉</span>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Circular diagram */}
        <div className="bg-gray-800/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 text-center">
            E({clampedK},{n}) — Circular View
          </h2>
          <CircularDiagram pattern={pattern} currentStep={currentStep} />
        </div>

        {/* Step grid + analysis */}
        <div className="space-y-4">
          {/* Step grid */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Step Grid</h2>
            <StepGrid pattern={pattern} currentStep={currentStep} />
            <div className="text-center mt-2 text-xs text-gray-500 font-mono">
              {pattern.map(b => b === 1 ? 'X' : '.').join('')}
            </div>
          </div>

          {/* Analysis readout */}
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-300">Analysis</h2>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">Onsets / Steps</div>
                <div className="text-xl font-bold text-purple-400">
                  {analysis.onsets}<span className="text-base text-gray-500">/{analysis.length}</span>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">Evenness</div>
                <div className="text-xl font-bold text-amber-400">{(analysis.evenness * 100).toFixed(1)}%</div>
                <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                  <div
                    className="bg-amber-400 h-1 rounded-full transition-all"
                    style={{ width: `${analysis.evenness * 100}%` }}
                  />
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">Rot. Symmetry</div>
                <div className="text-xl font-bold text-indigo-400">{analysis.rotationalSymmetry}</div>
                <div className="text-xs text-gray-500">
                  {analysis.rotationalSymmetry === 1 ? 'Trivial only' : `${analysis.rotationalSymmetry} self-maps`}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2.5">
                <div className="text-xs text-gray-400">Palindrome</div>
                <div className={`text-xl font-bold ${analysis.isPalindrome ? 'text-green-400' : 'text-gray-500'}`}>
                  {analysis.isPalindrome ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Necklace class */}
            <div className="bg-gray-800 rounded-lg p-2.5">
              <div className="text-xs text-gray-400 mb-1">Necklace Class</div>
              <code className="text-xs font-mono text-green-300 break-all">
                {analysis.necklaceClass || <span className="text-gray-500">—</span>}
              </code>
            </div>

            {/* IOI Vector */}
            <div className="bg-gray-800 rounded-lg p-2.5">
              <div className="text-xs text-gray-400 mb-1.5">IOI Vector</div>
              {analysis.interOnsetIntervals.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {analysis.interOnsetIntervals.map((ioi, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-indigo-900/60 border border-indigo-700 rounded text-indigo-300 text-sm font-mono"
                    >
                      {ioi}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500 text-sm">No onsets</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Theory note */}
      <div className="bg-gray-800/30 rounded-xl p-4 text-sm text-gray-400 space-y-1">
        <p>
          <span className="text-gray-200 font-medium">Bjorklund's algorithm</span> distributes{' '}
          <em>k</em> onsets across <em>n</em> steps as maximally evenly as possible.{' '}
          The notation E(<em>k</em>,<em>n</em>) denotes the Euclidean rhythm with <em>k</em> onsets in <em>n</em> steps.{' '}
          Many world rhythms (tresillo, bossa nova, soukous) are rotations of Euclidean rhythms.
        </p>
        <p>
          <span className="text-gray-200 font-medium">Maximally even</span> means every inter-onset interval
          is either ⌊n/k⌋ or ⌈n/k⌉ — the rhythmic counterpart of maximally even scales (Clough-Douthett).
        </p>
      </div>
    </div>
  );
}
