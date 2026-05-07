import { useState, useCallback, useEffect, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { createCard, gradeCard, isDue, type Card, type Quality } from '../utils/sm2';
import { QUIZ_CARDS, getFreeDeck, getFullDeck, type QuizCard } from '../data/quiz-cards';
import { GROUP_DESCRIPTIONS } from '../data/group-descriptions';

// ─── Types ─────────────────────────────────────────────────────────────────────

type QuizType = 'forte' | 'symmetry' | 'vector';

interface ReviewState {
  cards: Record<string, Card>;      // id → Card
  history: ReviewEntry[];
  lastReset: number;
  dailyCount: number;
  dailyDate: string;                // YYYY-MM-DD
}

interface ReviewEntry {
  cardId: string;
  quality: Quality;
  timestamp: number;
}

const STORAGE_KEY = 'ms_quiz_state';
const FREE_DAILY_LIMIT = 10;

// ─── SM-2 state helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReviewState;
  } catch {
    // ignore parse errors
  }
  return { cards: {}, history: [], lastReset: Date.now(), dailyCount: 0, dailyDate: todayStr() };
}

function saveState(s: ReviewState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // quota exceeded — silently ignore
  }
}

function getOrCreateCard(state: ReviewState, id: string): Card {
  return state.cards[id] ?? createCard(id);
}

// ─── Deck helpers ──────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Pick the next card to review:
 * 1. Prioritize due cards (lowest nextReview first)
 * 2. Fall back to new cards (never reviewed)
 */
function pickNextCard(deck: QuizCard[], state: ReviewState): QuizCard | null {
  if (deck.length === 0) return null;

  const due = deck
    .map(c => ({ card: c, sm2: getOrCreateCard(state, c.forteNumber) }))
    .filter(({ sm2 }) => isDue(sm2))
    .sort((a, b) => a.sm2.nextReview - b.sm2.nextReview);

  if (due.length > 0) return due[0]!.card;

  // No due cards — pick a new (never-reviewed) card
  const newCards = deck.filter(c => !state.cards[c.forteNumber]);
  if (newCards.length > 0) return pickRandom(newCards);

  // All cards reviewed and not yet due — pick soonest
  const soonest = deck
    .map(c => ({ card: c, sm2: getOrCreateCard(state, c.forteNumber) }))
    .sort((a, b) => a.sm2.nextReview - b.sm2.nextReview);
  return soonest[0]?.card ?? null;
}

// ─── Quiz question builders ────────────────────────────────────────────────────

/** "Name the set class" — show notes, identify Forte number */
interface ForteQuestion {
  type: 'forte';
  card: QuizCard;
  shownPcs: PitchClass[];   // possibly transposed
  transposition: number;
  choices: string[];         // Forte numbers
}

/** "Identify the symmetry group" — show prime form, name group */
interface SymmetryQuestion {
  type: 'symmetry';
  card: QuizCard;
  choices: string[];         // group symbols
}

/** "Match interval vector" — show vector, pick Forte number */
interface VectorQuestion {
  type: 'vector';
  card: QuizCard;
  choices: QuizCard[];       // 4 choices including correct
}

type ActiveQuestion = ForteQuestion | SymmetryQuestion | VectorQuestion;

function transposePcs(pcs: PitchClass[], semitones: number): PitchClass[] {
  return pcs.map(pc => ((pc + semitones) % 12) as PitchClass);
}

function buildQuestion(quizType: QuizType, card: QuizCard, allCards: QuizCard[]): ActiveQuestion {
  if (quizType === 'forte') {
    const transposition = Math.floor(Math.random() * 12);
    const shownPcs = transposePcs(card.primeForm, transposition);
    // Distractors from same cardinality
    const pool = allCards.filter(c => c.cardinality === card.cardinality && c.forteNumber !== card.forteNumber);
    const distractors = shuffle(pool).slice(0, 3).map(c => c.forteNumber);
    const choices = shuffle([card.forteNumber, ...distractors]);
    return { type: 'forte', card, shownPcs, transposition, choices };
  }

  if (quizType === 'symmetry') {
    const allGroups = [...new Set(QUIZ_CARDS.map(c => c.group))].sort();
    const distractors = shuffle(allGroups.filter(g => g !== card.group)).slice(0, 3);
    const choices = shuffle([card.group, ...distractors]);
    return { type: 'symmetry', card, choices };
  }

  // vector
  const pool = allCards.filter(c => c.forteNumber !== card.forteNumber);
  const distractors = shuffle(pool).slice(0, 3);
  const choices = shuffle([card, ...distractors]);
  return { type: 'vector', card, choices };
}

// ─── Score state ───────────────────────────────────────────────────────────────

interface SessionScore {
  correct: number;
  incorrect: number;
  streak: number;
  bestStreak: number;
}

const INITIAL_SCORE: SessionScore = { correct: 0, incorrect: 0, streak: 0, bestStreak: 0 };

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: SessionScore }) {
  const total = score.correct + score.incorrect;
  const accuracy = total > 0 ? Math.round((score.correct / total) * 100) : 0;
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Correct',  value: score.correct,     color: 'text-green-400' },
        { label: 'Wrong',    value: score.incorrect,   color: 'text-red-400'   },
        { label: 'Streak',   value: score.streak,      color: 'text-yellow-400'},
        { label: 'Accuracy', value: `${accuracy}%`,   color: 'text-indigo-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

function IntervalVectorDisplay({ vec, label }: { vec: number[]; label?: string }) {
  const labels = ['ic1','ic2','ic3','ic4','ic5','ic6'];
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="flex gap-1">
        {vec.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-9 h-9 bg-gray-700 rounded flex items-center justify-center font-mono text-lg font-bold text-white">
              {v}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">{labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PcBadges({ pcs, label }: { pcs: PitchClass[]; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="flex gap-1 flex-wrap justify-center">
        {pcs.map((pc, i) => (
          <span key={i} className="px-2.5 py-1 bg-indigo-900/60 border border-indigo-700/40 rounded text-sm font-mono text-white">
            {NOTE_NAMES[pc]}
          </span>
        ))}
      </div>
    </div>
  );
}

function GroupBadge({ group }: { group: string }) {
  return (
    <span className="inline-block px-3 py-1 bg-purple-900/60 border border-purple-700/40 rounded text-sm font-mono font-bold text-purple-200">
      {group}
    </span>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function QuizPage() {
  const { user } = useUser();
  const isPro = user?.tier === 'pro' || user?.tier === 'research';

  const [quizType, setQuizType] = useState<QuizType>('forte');
  const [reviewState, setReviewState] = useState<ReviewState>(loadState);
  const [score, setScore] = useState<SessionScore>(INITIAL_SCORE);
  const [question, setQuestion] = useState<ActiveQuestion | null>(null);
  const [answered, setAnswered] = useState<'correct' | 'incorrect' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deck selection
  const deck = isPro ? getFullDeck() : getFreeDeck();

  // Daily count management
  const dailyUsed = reviewState.dailyDate === todayStr() ? reviewState.dailyCount : 0;
  const dailyLimitReached = !isPro && dailyUsed >= FREE_DAILY_LIMIT;

  // Due cards
  const dueCount = deck.filter(c => isDue(getOrCreateCard(reviewState, c.forteNumber))).length;
  const newCount = deck.filter(c => !reviewState.cards[c.forteNumber]).length;
  const cardsAvailableToday = Math.min(deck.length, FREE_DAILY_LIMIT - dailyUsed);

  // Initialize first question
  useEffect(() => {
    if (!question && !dailyLimitReached) {
      const card = pickNextCard(deck, reviewState);
      if (card) setQuestion(buildQuestion(quizType, card, deck));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When quiz type changes, rebuild question
  const handleQuizTypeChange = useCallback((type: QuizType) => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setQuizType(type);
    setAnswered(null);
    setSelectedId(null);
    const card = pickNextCard(deck, reviewState);
    if (card) setQuestion(buildQuestion(type, card, deck));
  }, [deck, reviewState]);

  const advanceToNext = useCallback((currentType: QuizType, currentState: ReviewState) => {
    const nextCard = pickNextCard(deck, currentState);
    if (nextCard) {
      setQuestion(buildQuestion(currentType, nextCard, deck));
    } else {
      setQuestion(null);
    }
    setAnswered(null);
    setSelectedId(null);
  }, [deck]);

  const handleAnswer = useCallback((choiceId: string) => {
    if (answered || !question) return;

    const correctId = question.card.forteNumber;
    const isCorrect = choiceId === correctId;

    setSelectedId(choiceId);
    setAnswered(isCorrect ? 'correct' : 'incorrect');

    const quality: Quality = isCorrect ? 4 : 1;

    // Update SM-2 card
    const sm2Card = getOrCreateCard(reviewState, correctId);
    const updatedSm2 = gradeCard(sm2Card, quality);

    const newDate = todayStr();
    const isNewDay = reviewState.dailyDate !== newDate;

    const newState: ReviewState = {
      ...reviewState,
      cards: { ...reviewState.cards, [correctId]: updatedSm2 },
      history: [
        ...reviewState.history.slice(-500),
        { cardId: correctId, quality, timestamp: Date.now() },
      ],
      dailyCount: isNewDay ? 1 : reviewState.dailyCount + 1,
      dailyDate: newDate,
    };
    setReviewState(newState);
    saveState(newState);

    setScore(prev => {
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      return {
        correct: prev.correct + (isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (isCorrect ? 0 : 1),
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });

    // Auto-advance
    nextTimerRef.current = setTimeout(() => {
      advanceToNext(quizType, newState);
    }, 2200);
  }, [answered, question, reviewState, quizType, advanceToNext]);

  const handleSkip = useCallback(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    advanceToNext(quizType, reviewState);
  }, [quizType, reviewState, advanceToNext]);

  const handleReset = useCallback(() => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setScore(INITIAL_SCORE);
    setAnswered(null);
    setSelectedId(null);
    const card = pickNextCard(deck, reviewState);
    if (card) setQuestion(buildQuestion(quizType, card, deck));
  }, [deck, reviewState, quizType]);

  const handleResetProgress = useCallback(() => {
    if (!confirm('Reset all spaced-repetition progress? This cannot be undone.')) return;
    const fresh: ReviewState = { cards: {}, history: [], lastReset: Date.now(), dailyCount: 0, dailyDate: todayStr() };
    setReviewState(fresh);
    saveState(fresh);
    setScore(INITIAL_SCORE);
    setAnswered(null);
    setSelectedId(null);
    const card = pickNextCard(deck, fresh);
    if (card) setQuestion(buildQuestion(quizType, card, deck));
  }, [deck, quizType]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  function QuizTypeBtn({ type, label }: { type: QuizType; label: string }) {
    const locked = !isPro && type !== 'forte';
    return (
      <button
        onClick={() => !locked && handleQuizTypeChange(type)}
        disabled={locked}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          quizType === type
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

  // ─── Question renderers ────────────────────────────────────────────────────

  function renderForteQuestion(q: ForteQuestion) {
    return (
      <>
        <div className="text-xs text-gray-500 mb-4 text-center">
          What is the Forte number of this pitch-class set?
        </div>
        <div className="flex flex-col items-center gap-4 mb-6">
          <PcBadges pcs={q.shownPcs} label="Pitch classes" />
          <div className="text-xs text-gray-600">
            Prime form: [{q.card.primeForm.join(', ')}] (hidden until answered)
          </div>
        </div>
        {answered && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg text-center text-xs text-gray-400">
            <div className="mb-1">
              Transposition: +{q.transposition} semitones from prime form
            </div>
            <div>
              Prime form: [{q.card.primeForm.join(', ')}] &nbsp;·&nbsp; {q.card.commonName}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {q.choices.map(forte => {
            const isCorrect = forte === q.card.forteNumber;
            const isSelected = forte === selectedId;
            let cls = 'bg-gray-700 text-gray-200 hover:bg-gray-600';
            if (answered) {
              if (isCorrect) cls = 'bg-green-700 text-white';
              else if (isSelected) cls = 'bg-red-700 text-white';
              else cls = 'bg-gray-700 text-gray-500';
            }
            return (
              <button
                key={forte}
                onClick={() => handleAnswer(forte)}
                disabled={!!answered}
                className={`px-4 py-3 rounded-lg font-mono font-bold text-center transition-colors ${cls} disabled:cursor-default`}
              >
                {forte}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderSymmetryQuestion(q: SymmetryQuestion) {
    return (
      <>
        <div className="text-xs text-gray-500 mb-4 text-center">
          What is the abstract symmetry group of this set class?
        </div>
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="bg-gray-900 rounded-lg px-6 py-4 text-center">
            <div className="text-xs text-gray-500 mb-1">Forte number</div>
            <div className="font-mono text-2xl font-bold text-white">{q.card.forteNumber}</div>
            <div className="text-xs text-gray-400 mt-1">{q.card.commonName}</div>
          </div>
          <PcBadges pcs={q.card.primeForm} label="Prime form" />
          <IntervalVectorDisplay vec={q.card.intervalVector} label="Interval vector" />
        </div>
        {answered && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg text-center text-xs text-gray-400">
            {GROUP_DESCRIPTIONS[q.card.group] ? (
              <>
                <div className="font-semibold text-gray-300 mb-1">{q.card.group}: {GROUP_DESCRIPTIONS[q.card.group]!.plain}</div>
                <div className="italic">{GROUP_DESCRIPTIONS[q.card.group]!.feel}</div>
              </>
            ) : (
              <div>Group: <span className="font-mono">{q.card.group}</span></div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {q.choices.map(group => {
            const isCorrect = group === q.card.group;
            const isSelected = group === selectedId;
            let cls = 'bg-gray-700 text-gray-200 hover:bg-gray-600';
            if (answered) {
              if (isCorrect) cls = 'bg-green-700 text-white';
              else if (isSelected) cls = 'bg-red-700 text-white';
              else cls = 'bg-gray-700 text-gray-500';
            }
            return (
              <button
                key={group}
                onClick={() => handleAnswer(group)}
                disabled={!!answered}
                className={`px-4 py-3 rounded-lg text-center transition-colors ${cls} disabled:cursor-default`}
              >
                <div className="font-mono font-bold text-lg">{group}</div>
                {GROUP_DESCRIPTIONS[group] && (
                  <div className="text-xs mt-0.5 opacity-70 truncate">{GROUP_DESCRIPTIONS[group]!.plain}</div>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderVectorQuestion(q: VectorQuestion) {
    return (
      <>
        <div className="text-xs text-gray-500 mb-4 text-center">
          Which set class has this interval vector?
        </div>
        <div className="flex justify-center mb-6">
          <IntervalVectorDisplay vec={q.card.intervalVector} label="Interval vector to match" />
        </div>
        {answered && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg text-center text-xs text-gray-400">
            <PcBadges pcs={q.card.primeForm} label={`Prime form of ${q.card.forteNumber}`} />
            <div className="mt-1">{q.card.commonName}</div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2">
          {q.choices.map(choice => {
            const isCorrect = choice.forteNumber === q.card.forteNumber;
            const isSelected = choice.forteNumber === selectedId;
            let cls = 'bg-gray-700 text-gray-200 hover:bg-gray-600';
            if (answered) {
              if (isCorrect) cls = 'bg-green-700 text-white';
              else if (isSelected) cls = 'bg-red-700 text-white';
              else cls = 'bg-gray-700 text-gray-500';
            }
            return (
              <button
                key={choice.forteNumber}
                onClick={() => handleAnswer(choice.forteNumber)}
                disabled={!!answered}
                className={`w-full px-4 py-3 rounded-lg text-left transition-colors ${cls} disabled:cursor-default`}
              >
                <span className="font-mono font-bold text-sm mr-3">{choice.forteNumber}</span>
                <span className="text-sm">{choice.commonName}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Set Class Quiz</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Spaced-repetition flashcards for set class mastery — Forte numbers, symmetry groups, interval vectors.
      </p>

      {/* Score bar */}
      <ScoreBar score={score} />

      {/* Stats row */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
        <span>Due today: <span className="text-indigo-400 font-semibold">{dueCount}</span></span>
        <span>New: <span className="text-cyan-400 font-semibold">{newCount}</span></span>
        <span>Deck: <span className="text-gray-300 font-semibold">{deck.length} cards</span></span>
        {!isPro && (
          <span>
            Daily: <span className={dailyUsed >= FREE_DAILY_LIMIT ? 'text-red-400' : 'text-green-400'} >
              {dailyUsed}/{FREE_DAILY_LIMIT}
            </span>
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="flex gap-1">
          <QuizTypeBtn type="forte"    label="Name the Set" />
          <QuizTypeBtn type="symmetry" label="Symmetry Group" />
          <QuizTypeBtn type="vector"   label="Match Vector" />
        </div>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            New Session
          </button>
          <button
            onClick={handleResetProgress}
            className="px-3 py-1.5 rounded text-sm bg-gray-800 text-gray-500 hover:bg-gray-700 transition-colors"
            title="Reset all spaced-repetition progress"
          >
            Reset Progress
          </button>
        </div>
      </div>

      {/* Daily limit reached */}
      {dailyLimitReached ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-xl font-bold text-white mb-2">Daily limit reached!</div>
          <div className="text-gray-400 text-sm mb-4">
            You've completed your {FREE_DAILY_LIMIT} free cards for today. Come back tomorrow, or upgrade to practice unlimited cards.
          </div>
          <div className="text-sm text-gray-500 mb-4">
            Session accuracy: {score.correct + score.incorrect > 0
              ? Math.round((score.correct / (score.correct + score.incorrect)) * 100)
              : 0}% &nbsp;·&nbsp; Best streak: {score.bestStreak}
          </div>
          <a
            href="#dashboard"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Upgrade to Pro
          </a>
        </div>
      ) : question ? (
        <>
          {/* Question card */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm capitalize">
                {quizType === 'forte' ? 'Name the set class' : quizType === 'symmetry' ? 'Identify symmetry group' : 'Match interval vector'}
              </span>
              <div className="flex items-center gap-2">
                <GroupBadge group={answered ? question.card.group : '?'} />
                {answered && (
                  <span className="text-xs text-gray-500">
                    {question.card.forteNumber}
                  </span>
                )}
              </div>
            </div>

            {question.type === 'forte'    && renderForteQuestion(question)}
            {question.type === 'symmetry' && renderSymmetryQuestion(question)}
            {question.type === 'vector'   && renderVectorQuestion(question)}

            {/* Feedback */}
            {answered && (
              <div className={`mt-5 text-center font-semibold text-lg ${
                answered === 'correct' ? 'text-green-400' : 'text-red-400'
              }`}>
                {answered === 'correct'
                  ? `Correct!${score.streak > 1 ? ` ${score.streak} in a row!` : ''}`
                  : `Wrong — it was ${question.card.forteNumber} (${question.card.commonName})`}
              </div>
            )}
          </div>

          {/* SM-2 grade buttons (after answering) */}
          {answered && (
            <div className="mb-4">
              <div className="text-xs text-gray-500 text-center mb-2">How well did you know it?</div>
              <div className="flex gap-2 justify-center">
                {([
                  { q: 0, label: 'Blackout',  color: 'bg-red-900 text-red-200'    },
                  { q: 1, label: 'Wrong',      color: 'bg-orange-900 text-orange-200' },
                  { q: 2, label: 'Hard',       color: 'bg-yellow-900 text-yellow-200' },
                  { q: 3, label: 'OK',         color: 'bg-lime-900 text-lime-200'  },
                  { q: 4, label: 'Good',       color: 'bg-green-800 text-green-200' },
                  { q: 5, label: 'Perfect',    color: 'bg-emerald-700 text-white'  },
                ] as const).map(({ q, label, color }) => (
                  <button
                    key={q}
                    onClick={() => {
                      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
                      // Re-grade with finer quality
                      const sm2Card = getOrCreateCard(reviewState, question.card.forteNumber);
                      const updatedSm2 = gradeCard(sm2Card, q);
                      const newDate = todayStr();
                      const isNewDay = reviewState.dailyDate !== newDate;
                      const newState: ReviewState = {
                        ...reviewState,
                        cards: { ...reviewState.cards, [question.card.forteNumber]: updatedSm2 },
                        history: [
                          ...reviewState.history.slice(-500),
                          { cardId: question.card.forteNumber, quality: q, timestamp: Date.now() },
                        ],
                        dailyCount: isNewDay ? 1 : reviewState.dailyCount,
                        dailyDate: newDate,
                      };
                      setReviewState(newState);
                      saveState(newState);
                      advanceToNext(quizType, newState);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${color} hover:opacity-90 transition-opacity`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skip */}
          {!answered && (
            <div className="text-center">
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors underline"
              >
                Skip this card
              </button>
            </div>
          )}

          {/* Best streak */}
          {score.bestStreak > 2 && (
            <div className="mt-4 text-center text-xs text-gray-500">
              Best streak: <span className="text-yellow-400 font-bold">{score.bestStreak}</span>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <div className="text-lg font-semibold text-white mb-2">No cards available</div>
          <div className="text-sm">All cards are scheduled for future review. Check back tomorrow!</div>
        </div>
      )}

      {/* Tier notice */}
      {!isPro && (
        <div className="mt-6 p-3 bg-gray-800 rounded-lg text-sm text-gray-400 text-center">
          Free tier: {FREE_DAILY_LIMIT} cards/day from {getFreeDeck().length} common set classes — {quizType === 'forte' ? '' : 'Forte quiz only. '}
          {!isPro && quizType !== 'forte' && 'Symmetry & vector quizzes are Pro-only. '}
          <a href="#dashboard" className="text-indigo-400 hover:text-indigo-300 underline">
            Upgrade to Pro
          </a>{' '}
          for unlimited cards, all quiz types, and full 224-card deck.
        </div>
      )}

      {/* Progress summary (Pro only) */}
      {isPro && reviewState.history.length > 0 && (
        <details className="mt-6">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
            Progress history ({reviewState.history.length} reviews)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 mb-1">Cards mastered (ef ≥ 2.5)</div>
              <div className="text-2xl font-bold text-green-400">
                {Object.values(reviewState.cards).filter(c => c.easeFactor >= 2.5 && c.repetitions >= 3).length}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 mb-1">Cards in rotation</div>
              <div className="text-2xl font-bold text-indigo-400">
                {Object.keys(reviewState.cards).length}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 mb-1">Total reviews</div>
              <div className="text-2xl font-bold text-white">
                {reviewState.history.length}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-gray-500 mb-1">All-time accuracy</div>
              <div className="text-2xl font-bold text-yellow-400">
                {reviewState.history.length > 0
                  ? `${Math.round(reviewState.history.filter(h => h.quality >= 3).length / reviewState.history.length * 100)}%`
                  : '—'}
              </div>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
