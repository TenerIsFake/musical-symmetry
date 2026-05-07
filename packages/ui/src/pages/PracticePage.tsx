import { useState, useEffect, useRef, useCallback } from 'react';
import { toCSEG, contourSimilarity } from '@musical-symmetry/core';
import type { CSEG } from '@musical-symmetry/core';
import ContourDiagram from '../components/ContourDiagram';
import { useMicPitchDetect } from '../hooks/useMicPitchDetect';
import { useUser } from '../context/UserContext';
import { playPitchClasses } from '../utils/audio';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'setup' | 'listening' | 'scored';

interface ScoreRecord {
  difficulty: Difficulty;
  score: number;
  grade: string;
  timestamp: number;
  presetName?: string;
}

interface PresetContour {
  name: string;
  pitches: number[]; // MIDI-ish values 48–72
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { noteCount: number; label: string; description: string }> = {
  easy:   { noteCount: 4, label: 'Easy',   description: '4 notes, wide intervals, slow tempo' },
  medium: { noteCount: 6, label: 'Medium', description: '6 notes, mixed intervals' },
  hard:   { noteCount: 8, label: 'Hard',   description: '8+ notes, narrow intervals, fast tempo' },
};

const FREE_DAILY_LIMIT = 3;
const LS_SCORE_KEY = 'musical-symmetry-practice-scores';
const LS_ATTEMPTS_KEY = 'musical-symmetry-practice-attempts';

// ─── Famous preset contours ────────────────────────────────────────────────────
// Pitches are approximate MIDI values; exact tuning less important than contour shape.

const PRESET_CONTOURS: PresetContour[] = [
  {
    name: 'Ode to Joy',
    pitches: [64, 64, 65, 67, 67, 65, 64, 62], // arch shape: plateau, step up, step down
  },
  {
    name: 'Happy Birthday',
    pitches: [60, 60, 62, 60, 65, 64], // ascending then arch
  },
  {
    name: 'Twinkle Twinkle',
    pitches: [60, 60, 67, 67, 69, 69, 67], // up-plateau-down
  },
  {
    name: 'Mary Had a Little Lamb',
    pitches: [64, 62, 60, 62, 64, 64, 64], // descending steps then return
  },
  {
    name: 'Somewhere Over the Rainbow',
    pitches: [60, 72, 71, 67, 69, 71, 72], // octave leap + descent
  },
  {
    name: 'Jingle Bells',
    pitches: [64, 64, 64, 64, 64, 64, 64, 67], // repeated note then leap
  },
  {
    name: 'Amazing Grace',
    pitches: [60, 65, 65, 67, 65, 67, 69], // stepwise ascending arch
  },
  {
    name: 'Greensleeves',
    pitches: [57, 60, 62, 63, 62, 60, 57], // descending arch
  },
  {
    name: 'Bach Minuet (G major)',
    pitches: [67, 65, 64, 62, 64, 67, 66, 64], // arpeggiated descent + resolution
  },
  {
    name: 'Beethoven 5th (motive)',
    pitches: [67, 67, 67, 63, 65, 65, 65, 62], // repeated then drop, repeated then drop
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateRandomContour(length: number, difficulty: Difficulty): number[] {
  const root = 60; // Middle C
  const pitches: number[] = [root];

  const stepRange: Record<Difficulty, [number, number]> = {
    easy:   [3, 5],
    medium: [1, 4],
    hard:   [1, 2],
  };

  const [minStep, maxStep] = stepRange[difficulty];

  // Easy: prefer clear direction (long runs); Hard: more zig-zag
  let direction = Math.random() < 0.5 ? 1 : -1;
  let runCount = 0;
  const maxRun = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 1;

  for (let i = 1; i < length; i++) {
    const step = minStep + Math.floor(Math.random() * (maxStep - minStep + 1));

    if (runCount >= maxRun) {
      direction = -direction;
      runCount = 0;
    }

    const next = pitches[pitches.length - 1]! + direction * step;

    // Clamp to MIDI range 48–72 and reverse direction at edges
    if (next < 48 || next > 72) {
      direction = -direction;
      pitches.push(pitches[pitches.length - 1]! + direction * step);
    } else {
      pitches.push(next);
    }

    runCount++;
  }

  return pitches;
}

function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

function scoreToGrade(score: number): string {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B';
  if (score >= 0.65) return 'C';
  if (score >= 0.5) return 'D';
  return 'F';
}

function scoreToPercent(score: number): number {
  return Math.round(score * 100);
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-400';
    case 'B': return 'text-blue-400';
    case 'C': return 'text-yellow-400';
    case 'D': return 'text-orange-400';
    default:  return 'text-red-400';
  }
}

function loadScores(): ScoreRecord[] {
  try {
    const raw = localStorage.getItem(LS_SCORE_KEY);
    return raw ? (JSON.parse(raw) as ScoreRecord[]) : [];
  } catch {
    return [];
  }
}

function saveScore(record: ScoreRecord): void {
  const scores = loadScores();
  scores.push(record);
  // Keep last 200 entries
  if (scores.length > 200) scores.splice(0, scores.length - 200);
  localStorage.setItem(LS_SCORE_KEY, JSON.stringify(scores));
}

function loadTodayAttempts(): number {
  try {
    const raw = localStorage.getItem(LS_ATTEMPTS_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw) as { date: string; count: number };
    const today = new Date().toISOString().slice(0, 10);
    return date === today ? count : 0;
  } catch {
    return 0;
  }
}

function incrementTodayAttempts(): void {
  const count = loadTodayAttempts() + 1;
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(LS_ATTEMPTS_KEY, JSON.stringify({ date: today, count }));
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function LeaderboardPanel({ difficulty }: { difficulty: Difficulty }) {
  const scores = loadScores()
    .filter(s => s.difficulty === difficulty)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (scores.length === 0) {
    return <p className="text-gray-500 text-sm italic">No scores yet for {difficulty} mode.</p>;
  }

  return (
    <div className="space-y-1">
      {scores.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-sm bg-gray-700 rounded px-3 py-1.5">
          <span className="text-gray-400">#{i + 1} {s.presetName ?? 'Random'}</span>
          <span className="flex items-center gap-2">
            <span className={`font-bold ${gradeColor(s.grade)}`}>{s.grade}</span>
            <span className="text-gray-300">{scoreToPercent(s.score)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function PracticePage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [phase, setPhase] = useState<Phase>('setup');
  const [targetPitches, setTargetPitches] = useState<number[]>([]);
  const [attemptPitches, setAttemptPitches] = useState<number[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetContour | null>(null);
  const [usePreset, setUsePreset] = useState(false);
  const [lastScore, setLastScore] = useState<{ csim: number; grade: string; exactMatch: boolean } | null>(null);
  const [todayAttempts, setTodayAttempts] = useState(loadTodayAttempts);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const { isListening, detectedFreq, error: micError, start: startMic, stop: stopMic } = useMicPitchDetect();

  // Track the last captured MIDI pitch to debounce rapid duplicates
  const lastMidiRef = useRef<number | null>(null);
  const stableCountRef = useRef<number>(0);
  const STABLE_FRAMES = 8; // require ~8 frames of same pitch before recording

  const targetNoteCount = DIFFICULTY_CONFIG[difficulty].noteCount;

  // ─── Gate checks ──────────────────────────────────────────────────────────────

  const isFreeBlocked = tier === 'free' && difficulty !== 'easy';
  const isDailyLimitReached = tier === 'free' && todayAttempts >= FREE_DAILY_LIMIT;

  // ─── Target generation ────────────────────────────────────────────────────────

  const generateTarget = useCallback(() => {
    if (usePreset && selectedPreset) {
      setTargetPitches(selectedPreset.pitches);
    } else {
      setTargetPitches(generateRandomContour(targetNoteCount, difficulty));
    }
    setAttemptPitches([]);
    setLastScore(null);
    setPhase('setup');
  }, [difficulty, usePreset, selectedPreset, targetNoteCount]);

  // Generate on mount and difficulty/preset changes
  useEffect(() => {
    generateTarget();
  }, [generateTarget]);

  // ─── Detect pitches during listening ─────────────────────────────────────────

  useEffect(() => {
    if (!isListening || phase !== 'listening') return;
    if (detectedFreq === null) {
      stableCountRef.current = 0;
      return;
    }

    const midi = freqToMidi(detectedFreq);

    if (midi === lastMidiRef.current) {
      stableCountRef.current += 1;
    } else {
      stableCountRef.current = 1;
      lastMidiRef.current = midi;
    }

    if (stableCountRef.current === STABLE_FRAMES) {
      setAttemptPitches(prev => {
        if (prev.length >= targetNoteCount) return prev; // already full
        const next = [...prev, midi];
        if (next.length === targetNoteCount) {
          // Stop listening; scoring handled below in separate effect
        }
        return next;
      });
    }
  }, [detectedFreq, isListening, phase, targetNoteCount]);

  // ─── Auto-score when enough notes collected ───────────────────────────────────

  useEffect(() => {
    if (phase !== 'listening') return;
    if (attemptPitches.length < targetNoteCount) return;

    stopMic();

    const targetCSEG: CSEG = toCSEG(targetPitches);
    const attemptCSEG: CSEG = toCSEG(attemptPitches);
    const csim = contourSimilarity(targetCSEG, attemptCSEG);

    const exactMatch =
      targetCSEG.length === attemptCSEG.length &&
      targetCSEG.every((v, i) => v === attemptCSEG[i]);

    const finalScore = exactMatch ? Math.min(1, csim + 0.1) : csim;
    const grade = scoreToGrade(finalScore);

    setLastScore({ csim: finalScore, grade, exactMatch });
    setPhase('scored');

    const record: ScoreRecord = {
      difficulty,
      score: finalScore,
      grade,
      timestamp: Date.now(),
      presetName: usePreset && selectedPreset ? selectedPreset.name : undefined,
    };
    saveScore(record);
    incrementTodayAttempts();
    setTodayAttempts(loadTodayAttempts());
  }, [attemptPitches, targetNoteCount, phase, targetPitches, difficulty, usePreset, selectedPreset, stopMic]);

  // ─── Actions ──────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (isDailyLimitReached) return;
    lastMidiRef.current = null;
    stableCountRef.current = 0;
    setAttemptPitches([]);
    setLastScore(null);
    setPhase('listening');
    await startMic();
  }, [isDailyLimitReached, startMic]);

  const handlePlayTarget = useCallback(() => {
    if (targetPitches.length === 0) return;
    // Convert MIDI to pitch-class offsets from middle C for audio util
    const pcs = targetPitches.map(m => m - 60);
    playPitchClasses(pcs, 'arpeggio', 0.5);
  }, [targetPitches]);

  const handleTryAgain = useCallback(() => {
    stopMic();
    setAttemptPitches([]);
    setLastScore(null);
    lastMidiRef.current = null;
    stableCountRef.current = 0;
    setPhase('setup');
  }, [stopMic]);

  const handleNextChallenge = useCallback(() => {
    stopMic();
    generateTarget();
  }, [stopMic, generateTarget]);

  // ─── Derived CSEGs for display ────────────────────────────────────────────────

  const targetCSEG: CSEG = targetPitches.length > 0 ? toCSEG(targetPitches) : [];
  const attemptCSEG: CSEG = attemptPitches.length > 0 ? toCSEG(attemptPitches) : [];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Difficulty selector ── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3 text-gray-100">Difficulty</h2>
        <div className="flex gap-3 flex-wrap">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
            const locked = tier === 'free' && d !== 'easy';
            return (
              <button
                key={d}
                onClick={() => { if (!locked) setDifficulty(d); }}
                disabled={locked || phase === 'listening'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                  difficulty === d
                    ? 'bg-indigo-600 text-white'
                    : locked
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {DIFFICULTY_CONFIG[d].label}
                {locked && (
                  <span className="ml-2 text-xs text-yellow-400 font-bold">PRO</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-gray-500 text-xs mt-2">{DIFFICULTY_CONFIG[difficulty].description}</p>

        {tier === 'free' && (
          <p className="text-gray-400 text-xs mt-2">
            Free tier: Easy mode only, {FREE_DAILY_LIMIT} attempts per day
            ({Math.max(0, FREE_DAILY_LIMIT - todayAttempts)} remaining today).
            {' '}<a href="#dashboard" className="text-indigo-400 underline hover:text-indigo-300">Upgrade to Pro</a> for unlimited access.
          </p>
        )}
      </div>

      {/* ── Target selector ── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3 text-gray-100">Target Contour</h2>
        <div className="flex gap-3 flex-wrap mb-4 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={usePreset}
              onChange={e => setUsePreset(e.target.checked)}
              disabled={phase === 'listening'}
              className="accent-indigo-500"
            />
            Use a famous melody
          </label>
          {usePreset && (
            <select
              value={selectedPreset?.name ?? ''}
              onChange={e => {
                const p = PRESET_CONTOURS.find(c => c.name === e.target.value) ?? null;
                setSelectedPreset(p);
              }}
              disabled={phase === 'listening'}
              className="bg-gray-700 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- pick a melody --</option>
              {PRESET_CONTOURS.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={generateTarget}
            disabled={phase === 'listening'}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {usePreset ? 'Load' : 'New Random'}
          </button>
          <button
            onClick={handlePlayTarget}
            disabled={targetPitches.length === 0}
            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Hear the target melody"
          >
            Play Target
          </button>
        </div>

        {targetCSEG.length > 0 && (
          <ContourDiagram
            cseg={targetCSEG}
            label={usePreset && selectedPreset ? selectedPreset.name : `Random (${difficulty})`}
            width={480}
            height={180}
          />
        )}
      </div>

      {/* ── Listening / Controls ── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3 text-gray-100">Your Attempt</h2>

        {isDailyLimitReached && tier === 'free' ? (
          <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg p-4 text-sm text-yellow-300">
            You've used all {FREE_DAILY_LIMIT} free attempts for today.{' '}
            <a href="#dashboard" className="underline text-yellow-200 hover:text-white">Upgrade to Pro</a> for unlimited practice.
          </div>
        ) : phase === 'setup' ? (
          <div className="flex flex-col gap-3">
            <p className="text-gray-400 text-sm">
              Study the target contour above, then press <strong className="text-gray-200">Start</strong> and sing or play the shape.
              The mic will capture the first <strong className="text-gray-200">{targetNoteCount}</strong> stable pitches it detects.
            </p>
            {isFreeBlocked ? (
              <p className="text-yellow-400 text-sm">Upgrade to Pro to access {difficulty} mode.</p>
            ) : (
              <button
                onClick={handleStart}
                className="self-start px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition-colors"
              >
                Start Listening
              </button>
            )}
          </div>
        ) : phase === 'listening' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="animate-pulse inline-block w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-300 text-sm">
                Listening… {attemptPitches.length} / {targetNoteCount} notes captured
              </span>
              <button
                onClick={() => { stopMic(); setPhase('setup'); setAttemptPitches([]); }}
                className="ml-auto px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
            {micError && (
              <p className="text-red-400 text-sm">Mic error: {micError}</p>
            )}
            {detectedFreq !== null && (
              <p className="text-gray-500 text-xs">Current freq: {Math.round(detectedFreq)} Hz</p>
            )}
            {attemptCSEG.length > 0 && (
              <ContourDiagram
                cseg={attemptCSEG}
                label="Your attempt (live)"
                width={480}
                height={180}
                highlightIndex={attemptCSEG.length - 1}
              />
            )}
          </div>
        ) : /* phase === 'scored' */ (
          <div className="space-y-4">
            {/* Score display */}
            {lastScore && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="text-center">
                  <div className={`text-6xl font-black ${gradeColor(lastScore.grade)}`}>
                    {lastScore.grade}
                  </div>
                  <div className="text-2xl font-bold text-gray-200 mt-1">
                    {scoreToPercent(lastScore.csim)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">CSIM similarity</div>
                </div>
                <div className="space-y-1 text-sm text-gray-300">
                  {lastScore.exactMatch && (
                    <div className="text-green-400 font-medium">Perfect contour match! +bonus</div>
                  )}
                  <div>Contour similarity: <span className="text-gray-100 font-medium">{scoreToPercent(lastScore.csim)}%</span></div>
                  <div>Notes captured: <span className="text-gray-100 font-medium">{attemptPitches.length}</span></div>
                </div>
              </div>
            )}

            {/* Side-by-side contours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ContourDiagram
                cseg={targetCSEG}
                label="Target"
                width={400}
                height={160}
              />
              <ContourDiagram
                cseg={attemptCSEG}
                label="Your attempt"
                width={400}
                height={160}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleTryAgain}
                disabled={isDailyLimitReached && tier === 'free'}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Try Again
              </button>
              <button
                onClick={handleNextChallenge}
                disabled={isDailyLimitReached && tier === 'free'}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                Next Challenge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Personal best leaderboard ── */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-100">Personal Bests</h2>
          <button
            onClick={() => setShowLeaderboard(v => !v)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {showLeaderboard ? 'Hide' : 'Show'}
          </button>
        </div>
        {showLeaderboard && (
          <div className="space-y-4">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <div key={d}>
                <h3 className="text-sm font-medium text-gray-400 mb-2 capitalize">{d}</h3>
                {tier === 'free' && d !== 'easy' ? (
                  <p className="text-gray-600 text-sm italic">Pro feature</p>
                ) : (
                  <LeaderboardPanel difficulty={d} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
