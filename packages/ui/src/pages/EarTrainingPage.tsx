import { useState, useCallback, useEffect, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { playPitchClasses } from '../utils/audio';

// ─── Set class data ────────────────────────────────────────────────────────────

interface SetClassEntry {
  forte: string;
  pcs: PitchClass[];
  name: string;
  cardinality: number;
}

const TRICHORDS: SetClassEntry[] = [
  { forte: '3-1',  pcs: [0,1,2],   name: 'Chromatic cluster',         cardinality: 3 },
  { forte: '3-2',  pcs: [0,1,3],   name: 'Minor second + minor third', cardinality: 3 },
  { forte: '3-3',  pcs: [0,1,4],   name: 'Minor second + major third', cardinality: 3 },
  { forte: '3-4',  pcs: [0,1,5],   name: 'Minor second + perfect fourth', cardinality: 3 },
  { forte: '3-5',  pcs: [0,1,6],   name: 'Minor second + tritone',    cardinality: 3 },
  { forte: '3-6',  pcs: [0,2,4],   name: 'Whole-tone dyad',           cardinality: 3 },
  { forte: '3-7',  pcs: [0,2,5],   name: 'Quartal trichord',          cardinality: 3 },
  { forte: '3-8',  pcs: [0,2,6],   name: 'Tritone + whole tone',      cardinality: 3 },
  { forte: '3-9',  pcs: [0,2,7],   name: 'Suspended chord',           cardinality: 3 },
  { forte: '3-10', pcs: [0,3,6],   name: 'Diminished trichord',       cardinality: 3 },
  { forte: '3-11', pcs: [0,3,7],   name: 'Minor triad',               cardinality: 3 },
  { forte: '3-12', pcs: [0,4,8],   name: 'Augmented triad',           cardinality: 3 },
];

// Easy: just major (3-11 transposed to [0,4,7]) and minor (3-11 = [0,3,7])
// We represent them both as 3-11 but call them "Major triad" vs "Minor triad"
// For easy mode we show two additional versions distinguished by root interval
const EASY_CHOICES: SetClassEntry[] = [
  { forte: '3-11M', pcs: [0,4,7], name: 'Major triad', cardinality: 3 },
  { forte: '3-11m', pcs: [0,3,7], name: 'Minor triad',  cardinality: 3 },
  { forte: '3-12',  pcs: [0,4,8], name: 'Augmented triad', cardinality: 3 },
];

// Hexachords pool (first 12 of cardinality 6 for Hard mode variety)
const HEXACHORDS: SetClassEntry[] = [
  { forte: '6-1',  pcs: [0,1,2,3,4,5],   name: 'Chromatic hexachord',   cardinality: 6 },
  { forte: '6-7',  pcs: [0,1,2,6,7,8],   name: 'Double cluster',        cardinality: 6 },
  { forte: '6-20', pcs: [0,1,4,5,8,9],   name: 'Hexatonic scale',       cardinality: 6 },
  { forte: '6-32', pcs: [0,2,4,5,7,9],   name: 'Major hexatonic',       cardinality: 6 },
  { forte: '6-33', pcs: [0,2,3,5,7,9],   name: 'Minor hexatonic',       cardinality: 6 },
  { forte: '6-35', pcs: [0,2,4,6,8,10],  name: 'Whole-tone scale',      cardinality: 6 },
];

type Difficulty = 'easy' | 'medium' | 'hard';
type PlayMode = 'chord' | 'arpeggio';

const DIFFICULTY_POOL: Record<Difficulty, SetClassEntry[]> = {
  easy:   EASY_CHOICES,
  medium: TRICHORDS,
  hard:   [...TRICHORDS, ...HEXACHORDS],
};

const DIFFICULTY_CHOICES_COUNT: Record<Difficulty, number> = {
  easy:   3,
  medium: 4,
  hard:   6,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Shuffle array, return copy */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Transpose pcs by semitones, mod 12 */
function transposePcs(pcs: PitchClass[], semitones: number): PitchClass[] {
  return pcs.map(pc => ((pc + semitones) % 12) as PitchClass);
}

interface Question {
  entry: SetClassEntry;
  transposedPcs: PitchClass[];
  root: number; // transposition semitones
  choices: SetClassEntry[];
}

function buildQuestion(difficulty: Difficulty): Question {
  const pool = DIFFICULTY_POOL[difficulty];
  const entry = pickRandom(pool);
  const root = Math.floor(Math.random() * 12);
  const transposedPcs = transposePcs(entry.pcs, root) as PitchClass[];

  // Build choices: include correct answer + random distractors
  const choiceCount = DIFFICULTY_CHOICES_COUNT[difficulty];
  const distractors = shuffle(pool.filter(e => e.forte !== entry.forte)).slice(0, choiceCount - 1);
  const choices = shuffle([entry, ...distractors]);

  return { entry, transposedPcs, root, choices };
}

// ─── Score state ──────────────────────────────────────────────────────────────

interface ScoreState {
  correct: number;
  incorrect: number;
  streak: number;
  bestStreak: number;
}

const INITIAL_SCORE: ScoreState = { correct: 0, incorrect: 0, streak: 0, bestStreak: 0 };

// ─── Component ────────────────────────────────────────────────────────────────

export default function EarTrainingPage() {
  const { user } = useUser();
  const isPro = user?.tier === 'pro' || user?.tier === 'research';

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playMode, setPlayMode] = useState<PlayMode>('chord');
  const [question, setQuestion] = useState<Question>(() => buildQuestion('easy'));
  const [score, setScore] = useState<ScoreState>(INITIAL_SCORE);
  const [answered, setAnswered] = useState<'correct' | 'incorrect' | null>(null);
  const [selectedForte, setSelectedForte] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When difficulty changes, reset and generate new question
  useEffect(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setQuestion(buildQuestion(difficulty));
    setAnswered(null);
    setSelectedForte(null);
  }, [difficulty]);

  const handlePlay = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    playPitchClasses(question.transposedPcs, playMode, 1.5);
    const totalDuration = playMode === 'arpeggio'
      ? question.transposedPcs.length * 0.3 + 1.6
      : 1.7;
    setTimeout(() => setIsPlaying(false), totalDuration * 1000);
  }, [isPlaying, question, playMode]);

  // Auto-play on new question
  useEffect(() => {
    const t = setTimeout(() => {
      setIsPlaying(true);
      playPitchClasses(question.transposedPcs, playMode, 1.5);
      const totalDuration = playMode === 'arpeggio'
        ? question.transposedPcs.length * 0.3 + 1.6
        : 1.7;
      setTimeout(() => setIsPlaying(false), totalDuration * 1000);
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const handleGuess = useCallback((choice: SetClassEntry) => {
    if (answered) return;
    const isCorrect = choice.forte === question.entry.forte;
    setSelectedForte(choice.forte);
    setAnswered(isCorrect ? 'correct' : 'incorrect');

    setScore(prev => {
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      return {
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });

    // Advance to next question after delay
    nextTimerRef.current = setTimeout(() => {
      setQuestion(buildQuestion(difficulty));
      setAnswered(null);
      setSelectedForte(null);
    }, 2000);
  }, [answered, question, difficulty]);

  const handleSkip = useCallback(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setQuestion(buildQuestion(difficulty));
    setAnswered(null);
    setSelectedForte(null);
  }, [difficulty]);

  const handleReset = useCallback(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setScore(INITIAL_SCORE);
    setQuestion(buildQuestion(difficulty));
    setAnswered(null);
    setSelectedForte(null);
  }, [difficulty]);

  const total = score.correct + score.incorrect;
  const accuracy = total > 0 ? Math.round((score.correct / total) * 100) : 0;

  // Difficulty button helper
  function DiffBtn({ d, label }: { d: Difficulty; label: string }) {
    const active = difficulty === d;
    const locked = !isPro && d !== 'easy';
    return (
      <button
        onClick={() => !locked && setDifficulty(d)}
        disabled={locked}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          active
            ? 'bg-indigo-700 text-white'
            : locked
            ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
        title={locked ? 'Pro tier required' : undefined}
      >
        {label}{locked && ' 🔒'}
      </button>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Ear Training</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Listen to a pitch-class set and identify its Forte number or name.
      </p>

      {/* Score bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Correct',  value: score.correct,  color: 'text-green-400' },
          { label: 'Wrong',    value: score.incorrect, color: 'text-red-400' },
          { label: 'Streak',   value: score.streak,    color: 'text-yellow-400' },
          { label: 'Accuracy', value: `${accuracy}%`,  color: 'text-indigo-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex gap-1">
          <DiffBtn d="easy"   label="Easy" />
          <DiffBtn d="medium" label="Medium" />
          <DiffBtn d="hard"   label="Hard" />
        </div>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setPlayMode(pm => pm === 'chord' ? 'arpeggio' : 'chord')}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            {playMode === 'chord' ? 'Chord' : 'Arpeggio'}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Question card */}
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-sm">
            Question #{total + (answered ? 0 : 1)}
          </span>
          <span className="text-gray-500 text-xs capitalize">
            {difficulty} · {playMode}
          </span>
        </div>

        {/* Play button */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <button
            onClick={handlePlay}
            disabled={isPlaying}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all shadow-lg ${
              isPlaying
                ? 'bg-indigo-800 scale-95 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer hover:scale-105'
            }`}
            title="Play the set"
            aria-label="Play"
          >
            {isPlaying ? '♪' : '▶'}
          </button>
          <span className="text-xs text-gray-500">
            {isPlaying ? 'Playing…' : 'Click to replay'}
          </span>
        </div>

        {/* Pitch class display (visible after answering) */}
        {answered && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg text-center">
            <div className="text-xs text-gray-500 mb-1">Pitch classes heard</div>
            <div className="flex justify-center gap-1 flex-wrap">
              {question.transposedPcs.map((pc, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-700 rounded text-sm text-white font-mono">
                  {NOTE_NAMES[pc]}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Root: {NOTE_NAMES[question.root as PitchClass]} · Prime form: [{question.entry.pcs.join(',')}]
            </div>
          </div>
        )}

        {/* Answer choices */}
        <div className="grid grid-cols-1 gap-2">
          {question.choices.map(choice => {
            const isCorrectChoice = choice.forte === question.entry.forte;
            const isSelected = choice.forte === selectedForte;
            let btnClass = 'bg-gray-700 text-gray-200 hover:bg-gray-600';
            if (answered) {
              if (isCorrectChoice) btnClass = 'bg-green-700 text-white';
              else if (isSelected && !isCorrectChoice) btnClass = 'bg-red-700 text-white';
              else btnClass = 'bg-gray-700 text-gray-500';
            }
            return (
              <button
                key={choice.forte}
                onClick={() => handleGuess(choice)}
                disabled={!!answered}
                className={`w-full px-4 py-3 rounded-lg text-left transition-colors ${btnClass} disabled:cursor-default`}
              >
                <span className="font-mono font-bold text-sm mr-3">{choice.forte}</span>
                <span className="text-sm">{choice.name}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {answered && (
          <div className={`mt-4 text-center font-semibold text-lg ${
            answered === 'correct' ? 'text-green-400' : 'text-red-400'
          }`}>
            {answered === 'correct'
              ? `Correct! ${score.streak > 1 ? `${score.streak} in a row!` : ''}`
              : `Wrong. It was ${question.entry.forte} — ${question.entry.name}`}
          </div>
        )}
      </div>

      {/* Skip button */}
      {!answered && (
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors underline"
          >
            Skip this one
          </button>
        </div>
      )}

      {/* Best streak */}
      {score.bestStreak > 2 && (
        <div className="mt-4 text-center text-xs text-gray-500">
          Best streak: <span className="text-yellow-400 font-bold">{score.bestStreak}</span>
        </div>
      )}

      {/* Free tier notice */}
      {!isPro && (
        <div className="mt-6 p-3 bg-gray-800 rounded-lg text-sm text-gray-400 text-center">
          Free tier: Easy mode only (major, minor, augmented triads).{' '}
          <a href="#dashboard" className="text-indigo-400 hover:text-indigo-300 underline">
            Upgrade to Pro
          </a>{' '}
          for all trichords and hexachords.
        </div>
      )}
    </div>
  );
}
