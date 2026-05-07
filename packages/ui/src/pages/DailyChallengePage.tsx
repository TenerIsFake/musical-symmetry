import { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';

const NOTE_NAMES: Record<number, string> = {
  0: 'C', 1: 'C♯', 2: 'D', 3: 'E♭', 4: 'E', 5: 'F',
  6: 'F♯', 7: 'G', 8: 'A♭', 9: 'A', 10: 'B♭', 11: 'B',
};

const QUESTION_LABELS: Record<string, string> = {
  symmetry_group: 'What is the symmetry group of this set?',
  cardinality: 'How many pitch classes are in this set?',
  forte_number: 'What is the Forte number of this set?',
  interval_vector: 'What is the interval vector of this set?',
};

interface Challenge {
  id: number;
  date: string;
  forte: string;
  pitchClasses: number[];
  questionType: string;
  distractors: string[];
  submitted?: boolean;
  userAnswer?: string;
}

interface SubmitResult {
  correct: boolean;
  correctAnswer: string;
  streak: number;
}

interface LeaderboardEntry {
  name: string;
  streak: number;
}

// Simple piano key visualization for pitch classes
function PianoViz({ pitchClasses }: { pitchClasses: number[] }) {
  const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const blackKeys: Record<number, number> = { 1: 0.7, 3: 1.7, 6: 3.7, 8: 4.7, 10: 5.7 }; // position in white-key units

  return (
    <div className="flex gap-0.5 items-end my-4 justify-center" aria-label="Piano keyboard showing selected notes">
      <div className="relative flex">
        {whiteKeys.map((pc, i) => (
          <div
            key={pc}
            className={`relative w-8 h-20 border border-gray-600 rounded-b-sm flex items-end justify-center pb-1 text-xs font-medium ${
              pitchClasses.includes(pc)
                ? 'bg-indigo-400 text-white border-indigo-300'
                : 'bg-gray-100 text-gray-700'
            }`}
            style={{ zIndex: 1 }}
            title={NOTE_NAMES[pc]}
          >
            {pitchClasses.includes(pc) && (
              <span className="text-[10px] font-bold">{NOTE_NAMES[pc]}</span>
            )}
            {/* Black key overlay */}
            {Object.entries(blackKeys).map(([bpc, pos]) => {
              if (pos >= i && pos < i + 1) {
                const bpcNum = parseInt(bpc);
                return (
                  <div
                    key={bpcNum}
                    className={`absolute top-0 w-5 h-12 rounded-b-sm flex items-end justify-center pb-0.5 text-[9px] font-bold ${
                      pitchClasses.includes(bpcNum)
                        ? 'bg-indigo-600 text-indigo-100'
                        : 'bg-gray-900 text-gray-100'
                    }`}
                    style={{
                      left: `${(pos - i) * 32 + 20}px`,
                      zIndex: 2,
                    }}
                    title={NOTE_NAMES[bpcNum]}
                  >
                    {pitchClasses.includes(bpcNum) && NOTE_NAMES[bpcNum]}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Timer({ running }: { running: boolean; onTick?: (s: number) => void }) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className="text-gray-400 text-sm font-mono">
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}

function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4 text-sm">
        No streaks yet — be the first!
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800">
            <th className="px-4 py-2 text-left text-gray-400 font-medium">Rank</th>
            <th className="px-4 py-2 text-left text-gray-400 font-medium">Name</th>
            <th className="px-4 py-2 text-right text-gray-400 font-medium">Streak</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr
              key={i}
              className={`border-b border-gray-800 last:border-0 ${i === 0 ? 'bg-amber-900/20' : ''}`}
            >
              <td className="px-4 py-2 text-gray-400">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
              </td>
              <td className="px-4 py-2 text-white">{entry.name}</td>
              <td className="px-4 py-2 text-right">
                <span className="text-amber-400 font-semibold">
                  {entry.streak} 🔥
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DailyChallengePage() {
  const { user } = useUser();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  // Load challenge
  useEffect(() => {
    fetch('/api/challenges/today', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: Challenge) => {
        setChallenge(data);
        if (!data.submitted) {
          setTimerRunning(true);
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoadingChallenge(false));
  }, []);

  // Load leaderboard
  useEffect(() => {
    fetch('/api/challenges/leaderboard')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: { leaderboard: LeaderboardEntry[] }) => setLeaderboard(data.leaderboard))
      .catch(() => {})
      .finally(() => setLoadingLeaderboard(false));
  }, []);

  // Timer tracking
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const handleSubmit = async (answer: string) => {
    if (!challenge || submitting) return;
    setSelectedAnswer(answer);
    setSubmitting(true);
    setTimerRunning(false);

    try {
      const res = await fetch('/api/challenges/today/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, elapsedSec: elapsedSeconds }),
      });
      const data = await res.json() as SubmitResult;
      setResult(data);
      // Refresh leaderboard after submission
      fetch('/api/challenges/leaderboard')
        .then(r => r.ok ? r.json() : null)
        .then((d: { leaderboard: LeaderboardEntry[] } | null) => {
          if (d) setLeaderboard(d.leaderboard);
        })
        .catch(() => {});
    } catch {
      setError('Failed to submit. Please try again.');
      setTimerRunning(true);
      setSelectedAnswer(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingChallenge) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-red-400">{error || 'Failed to load challenge.'}</p>
      </div>
    );
  }

  const noteNames = challenge.pitchClasses.map(pc => NOTE_NAMES[pc]).join(', ');
  const questionLabel = QUESTION_LABELS[challenge.questionType] ?? 'Answer the question:';

  // Build shuffled answer choices (correct + distractors)
  // Use a stable shuffle based on challenge id
  const allAnswers = (() => {
    const correctAnswer = result?.correctAnswer ?? (challenge.submitted ? challenge.userAnswer ?? '' : '');
    const answers = [...challenge.distractors];
    // Insert correct answer at deterministic position
    const insertAt = challenge.id % (answers.length + 1);
    answers.splice(insertAt, 0, correctAnswer || '');
    // If we don't know the correct answer yet (pre-submit), we need to show distractors + one blank slot
    // Actually: before submission, correctAnswer is unknown from client perspective. We'll just show distractors.
    // The server only sends distractors; correct answer is revealed after submission.
    // So pre-submit: show 4 choices = distractors + ... we need to request all 4 options from server.
    // Since the spec says "correct + distractors shuffled", server should return all options.
    // But our server returns only distractors (3 wrong + correct is hidden).
    // Let's render all 4 options: distractors array has 3 items, and we need to build a shuffled set
    // that includes the right answer mixed in — but we don't know which is right until after submit.
    // Solution: return all 4 from server. For now, treat distractors as all 4 options (the server
    // will have put the correct one in there already for the shuffle). Actually re-read the spec:
    // distractors = the 3 wrong answers. We need to add the correct answer to make 4 choices.
    // The correct answer IS revealed in the API response... let's just include it.
    return answers;
  })();

  // Simpler: get all choices including correct answer from the challenge data
  // The challenge.distractors contains 3 wrong answers. We don't expose correct until after submit.
  // So let's fetch the correct answer separately from a non-auth endpoint...
  // Actually the simplest solution: server sends all 4 choices pre-shuffled as a single array.
  // Since we already built our routes to send distractors (3 items), let's shuffle those 3 + a placeholder.
  // We'll handle this by showing only the distractors as options before submission,
  // and after submission show all 4. But that's bad UX.
  //
  // Best fix: the server should send 4 shuffled choices. Let's adjust: we'll treat `distractors`
  // as the full set of choices (including the correct one mixed in). We update the server to do this.
  // For now, frontend uses challenge.distractors as the complete shuffled options list.
  // The db.ts already returns 3 distractors; we'll fix this in routes to send all 4 shuffled.
  //
  // For the frontend: we'll use challenge.distractors as all answer choices (expecting 4 items).
  const choices = challenge.distractors;

  const alreadySubmitted = challenge.submitted || result !== null;
  const correctAnswer = result?.correctAnswer ?? '';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Challenge Card */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Daily Challenge</span>
            <p className="text-gray-400 text-sm mt-0.5">{new Date(challenge.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          {!alreadySubmitted && (
            <div className="flex items-center gap-2">
              <Timer running={timerRunning} />
            </div>
          )}
          {alreadySubmitted && result && (
            <div className={`text-sm font-semibold px-3 py-1 rounded ${result.correct ? 'bg-indigo-900/60 text-indigo-300' : 'bg-red-900/60 text-red-300'}`}>
              {result.correct ? 'Correct!' : 'Incorrect'}
            </div>
          )}
        </div>

        {/* Pitch class display */}
        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-1">Pitch classes:</p>
          <p className="text-white font-mono text-lg">{`{${noteNames}}`}</p>
          <PianoViz pitchClasses={challenge.pitchClasses} />
        </div>

        {/* Question */}
        <p className="text-white font-medium text-lg mb-4">{questionLabel}</p>

        {/* Answer choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {choices.map((choice, i) => {
            let btnClass = 'bg-gray-700 text-gray-200 hover:bg-gray-600';
            if (alreadySubmitted) {
              if (choice === correctAnswer) {
                btnClass = 'bg-indigo-700 text-white ring-2 ring-indigo-400';
              } else if (choice === selectedAnswer && !result?.correct) {
                btnClass = 'bg-red-800 text-red-200';
              } else if (choice === challenge.userAnswer && !result) {
                // Previously submitted — highlight their answer
                const wasCorrect = challenge.userAnswer === challenge.distractors.find(d => d === challenge.userAnswer);
                btnClass = wasCorrect ? 'bg-indigo-700 text-white' : 'bg-red-800 text-red-200';
              } else {
                btnClass = 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-60';
              }
            }

            return (
              <button
                key={i}
                disabled={alreadySubmitted || submitting}
                onClick={() => handleSubmit(choice)}
                className={`px-4 py-3 rounded-lg text-left font-mono text-sm transition-colors ${btnClass} ${!alreadySubmitted ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {/* Post-submission result */}
        {alreadySubmitted && result && (
          <div className={`mt-4 p-4 rounded-lg ${result.correct ? 'bg-indigo-900/30 border border-indigo-700' : 'bg-red-900/30 border border-red-700'}`}>
            <p className={`font-semibold mb-1 ${result.correct ? 'text-indigo-300' : 'text-red-300'}`}>
              {result.correct ? 'Correct!' : 'Not quite.'}
            </p>
            <p className="text-gray-300 text-sm">
              The correct answer is <code className="bg-gray-900 px-1.5 py-0.5 rounded text-indigo-300">{result.correctAnswer}</code>
            </p>
            {result.correct && result.streak > 0 && (
              <p className="text-amber-400 text-sm mt-2 font-semibold">
                🔥 {result.streak}-day streak!
              </p>
            )}
            {!result.correct && (
              <p className="text-gray-400 text-sm mt-2">
                Keep practicing — come back tomorrow to continue.
              </p>
            )}
          </div>
        )}

        {/* Already submitted (from previous session load) */}
        {challenge.submitted && !result && (
          <div className="mt-4 p-4 rounded-lg bg-gray-700/40 border border-gray-600">
            <p className="text-gray-300 text-sm">
              You already completed today's challenge. Check back tomorrow!
            </p>
            {!user && (
              <p className="text-gray-400 text-sm mt-2">
                <a href="#dashboard" className="text-indigo-400 hover:text-indigo-300 underline">Sign in</a> to track your streak.
              </p>
            )}
          </div>
        )}

        {/* Not signed in prompt (before submission) */}
        {!user && !alreadySubmitted && (
          <p className="text-gray-500 text-xs mt-4 text-center">
            <a href="#dashboard" className="text-indigo-400 hover:text-indigo-300 underline">Sign in</a> to track your streak and appear on the leaderboard.
          </p>
        )}
      </div>

      {/* Forte info (shown after submit) */}
      {alreadySubmitted && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">About this set</h3>
          <p className="text-gray-400 text-sm">
            <span className="font-medium text-white">Forte number:</span> {challenge.forte}
            <span className="mx-3 text-gray-600">|</span>
            <span className="font-medium text-white">Cardinality:</span> {challenge.pitchClasses.length}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Explore this set in the{' '}
            <a href={`#atlas/${challenge.forte}`} className="text-indigo-400 hover:text-indigo-300 underline">
              Atlas
            </a>
          </p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-base font-semibold text-white mb-4">Leaderboard — Top Streaks</h3>
        {loadingLeaderboard ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Leaderboard entries={leaderboard} />
        )}
      </div>
    </div>
  );
}
