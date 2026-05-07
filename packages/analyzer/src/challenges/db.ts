import { getDb } from '../auth/db.js';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

export function runChallengeMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_challenges (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT NOT NULL UNIQUE,
      forte         TEXT NOT NULL,
      pitch_classes TEXT NOT NULL,
      question_type TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      distractors   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_submissions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id),
      answer       TEXT NOT NULL,
      correct      INTEGER NOT NULL,
      elapsed_sec  INTEGER,
      submitted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, challenge_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_submissions_user ON daily_submissions(user_id, challenge_id);
  `);
}

// Question types that rotate each day
const QUESTION_TYPES = ['symmetry_group', 'cardinality', 'forte_number', 'interval_vector'] as const;
type QuestionType = typeof QUESTION_TYPES[number];

interface DailyChallenge {
  id: number;
  date: string;
  forte: string;
  pitch_classes: string;
  question_type: string;
  correct_answer: string;
  distractors: string;
}

// Simple seeded pseudo-random number generator (mulberry32)
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Forte numbers with known cardinality-3 to cardinality-6 sets
// Representative catalog of well-known sets
const FORTE_CATALOG: Array<{ forte: string; pcs: PitchClass[] }> = [
  // Trichords (3-note sets)
  { forte: '3-1',  pcs: [0, 1, 2] },
  { forte: '3-2',  pcs: [0, 1, 3] },
  { forte: '3-3',  pcs: [0, 1, 4] },
  { forte: '3-4',  pcs: [0, 1, 5] },
  { forte: '3-5',  pcs: [0, 1, 6] },
  { forte: '3-6',  pcs: [0, 2, 4] },
  { forte: '3-7',  pcs: [0, 2, 5] },
  { forte: '3-8',  pcs: [0, 2, 6] },
  { forte: '3-9',  pcs: [0, 2, 7] },
  { forte: '3-10', pcs: [0, 3, 6] },
  { forte: '3-11', pcs: [0, 3, 7] },
  { forte: '3-12', pcs: [0, 4, 8] },
  // Tetrachords (4-note sets)
  { forte: '4-1',  pcs: [0, 1, 2, 3] },
  { forte: '4-2',  pcs: [0, 1, 2, 4] },
  { forte: '4-3',  pcs: [0, 1, 3, 4] },
  { forte: '4-4',  pcs: [0, 1, 2, 5] },
  { forte: '4-5',  pcs: [0, 1, 2, 6] },
  { forte: '4-6',  pcs: [0, 1, 2, 7] },
  { forte: '4-7',  pcs: [0, 1, 4, 5] },
  { forte: '4-8',  pcs: [0, 1, 5, 6] },
  { forte: '4-9',  pcs: [0, 1, 6, 7] },
  { forte: '4-10', pcs: [0, 2, 3, 5] },
  { forte: '4-11', pcs: [0, 1, 3, 5] },
  { forte: '4-12', pcs: [0, 2, 3, 6] },
  { forte: '4-13', pcs: [0, 1, 3, 6] },
  { forte: '4-14', pcs: [0, 2, 3, 7] },
  { forte: '4-16', pcs: [0, 1, 5, 7] },
  { forte: '4-17', pcs: [0, 3, 4, 7] },
  { forte: '4-18', pcs: [0, 1, 4, 7] },
  { forte: '4-19', pcs: [0, 1, 4, 8] },
  { forte: '4-20', pcs: [0, 1, 5, 8] },
  { forte: '4-21', pcs: [0, 2, 4, 6] },
  { forte: '4-22', pcs: [0, 2, 4, 7] },
  { forte: '4-23', pcs: [0, 2, 5, 7] },
  { forte: '4-24', pcs: [0, 2, 4, 8] },
  { forte: '4-25', pcs: [0, 2, 6, 8] },
  { forte: '4-26', pcs: [0, 3, 5, 8] },
  { forte: '4-27', pcs: [0, 2, 5, 8] },
  { forte: '4-28', pcs: [0, 3, 6, 9] },
  { forte: '4-29', pcs: [0, 1, 3, 7] },
  // Pentachords (5-note sets)
  { forte: '5-1',  pcs: [0, 1, 2, 3, 4] },
  { forte: '5-2',  pcs: [0, 1, 2, 3, 5] },
  { forte: '5-3',  pcs: [0, 1, 2, 4, 5] },
  { forte: '5-5',  pcs: [0, 1, 2, 3, 7] },
  { forte: '5-6',  pcs: [0, 1, 2, 5, 6] },
  { forte: '5-7',  pcs: [0, 1, 2, 6, 7] },
  { forte: '5-10', pcs: [0, 1, 3, 4, 6] },
  { forte: '5-11', pcs: [0, 2, 3, 4, 7] },
  { forte: '5-13', pcs: [0, 1, 2, 4, 8] },
  { forte: '5-15', pcs: [0, 1, 2, 6, 8] },
  { forte: '5-19', pcs: [0, 1, 3, 6, 7] },
  { forte: '5-20', pcs: [0, 1, 3, 7, 8] },
  { forte: '5-21', pcs: [0, 1, 4, 5, 8] },
  { forte: '5-22', pcs: [0, 1, 4, 7, 8] },
  { forte: '5-23', pcs: [0, 2, 3, 5, 7] },
  { forte: '5-24', pcs: [0, 1, 3, 5, 7] },
  { forte: '5-25', pcs: [0, 2, 3, 5, 8] },
  { forte: '5-26', pcs: [0, 2, 4, 5, 8] },
  { forte: '5-27', pcs: [0, 1, 3, 5, 8] },
  { forte: '5-28', pcs: [0, 2, 3, 6, 8] },
  { forte: '5-29', pcs: [0, 1, 3, 6, 8] },
  { forte: '5-30', pcs: [0, 1, 4, 6, 8] },
  { forte: '5-31', pcs: [0, 1, 3, 6, 9] },
  { forte: '5-32', pcs: [0, 1, 4, 6, 9] },
  { forte: '5-33', pcs: [0, 2, 4, 6, 8] },
  { forte: '5-34', pcs: [0, 2, 4, 6, 9] },
  { forte: '5-35', pcs: [0, 2, 4, 7, 9] },
  // Hexachords (6-note sets)
  { forte: '6-1',  pcs: [0, 1, 2, 3, 4, 5] },
  { forte: '6-2',  pcs: [0, 1, 2, 3, 4, 6] },
  { forte: '6-5',  pcs: [0, 1, 2, 3, 6, 7] },
  { forte: '6-7',  pcs: [0, 1, 2, 6, 7, 8] },
  { forte: '6-8',  pcs: [0, 2, 3, 4, 5, 7] },
  { forte: '6-9',  pcs: [0, 1, 2, 3, 5, 7] },
  { forte: '6-14', pcs: [0, 1, 3, 4, 5, 8] },
  { forte: '6-15', pcs: [0, 1, 2, 4, 5, 8] },
  { forte: '6-16', pcs: [0, 1, 4, 5, 6, 8] },
  { forte: '6-20', pcs: [0, 1, 4, 5, 8, 9] },
  { forte: '6-21', pcs: [0, 2, 3, 4, 6, 8] },
  { forte: '6-22', pcs: [0, 1, 2, 4, 6, 8] },
  { forte: '6-27', pcs: [0, 1, 3, 4, 6, 9] },
  { forte: '6-30', pcs: [0, 1, 3, 6, 7, 9] },
  { forte: '6-32', pcs: [0, 2, 4, 5, 7, 9] },
  { forte: '6-33', pcs: [0, 2, 3, 5, 7, 9] },
  { forte: '6-34', pcs: [0, 1, 3, 5, 7, 9] },
  { forte: '6-35', pcs: [0, 2, 4, 6, 8, 10] },
];

function buildQuestionAndDistractors(
  questionType: QuestionType,
  analysis: ReturnType<typeof classify>,
  forte: string,
  rng: () => number,
): { correctAnswer: string; distractors: string[] } {
  let correctAnswer: string;
  let pool: string[];

  switch (questionType) {
    case 'symmetry_group': {
      correctAnswer = analysis.abstractGroup;
      const allGroups = [
        'Z1', 'Z2', 'Z3', 'Z4', 'Z6', 'Z12',
        'D1', 'D2', 'D3', 'D4', 'D6', 'D12',
        'Z1 x Z2', 'Z2 x Z2',
      ];
      pool = allGroups.filter(g => g !== correctAnswer);
      break;
    }
    case 'cardinality': {
      correctAnswer = String(analysis.pitchClasses.length);
      pool = ['2', '3', '4', '5', '6', '7', '8', '9'].filter(c => c !== correctAnswer);
      break;
    }
    case 'forte_number': {
      correctAnswer = forte;
      // Pick 3 distractors from catalog
      const otherFortes = FORTE_CATALOG.map(e => e.forte).filter(f => f !== forte);
      pool = otherFortes;
      break;
    }
    case 'interval_vector': {
      const iv = analysis.intervalVector;
      correctAnswer = `<${iv.join(',')}>`;
      // Generate plausible wrong interval vectors
      pool = [];
      for (let i = 0; i < 20; i++) {
        const fake = iv.map((v, idx) => {
          const delta = Math.floor(rng() * 3) - 1;
          const capped = idx < 5 ? 6 : 3;
          return Math.max(0, Math.min(capped, v + delta));
        });
        const candidate = `<${fake.join(',')}>`;
        if (candidate !== correctAnswer && !pool.includes(candidate)) {
          pool.push(candidate);
        }
        if (pool.length >= 10) break;
      }
      break;
    }
  }

  // Pick 3 distractors, then build 4 shuffled choices (correct + 3 wrong)
  const shuffled = pool.sort(() => rng() - 0.5);
  const wrongThree = shuffled.slice(0, 3);
  const allChoices = [...wrongThree, correctAnswer].sort(() => rng() - 0.5);

  return { correctAnswer, distractors: allChoices };
}

export function getTodayChallenge(): DailyChallenge | null {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare('SELECT * FROM daily_challenges WHERE date = ?').get(today) as DailyChallenge | null;
}

export function generateTodayChallenge(): DailyChallenge {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Return existing if present
  const existing = db.prepare('SELECT * FROM daily_challenges WHERE date = ?').get(today) as DailyChallenge | null;
  if (existing) return existing;

  const date = new Date(today);
  const seed = date.getFullYear() * 1000 + dayOfYear(date);
  const rng = seededRng(seed);

  // Pick set from catalog deterministically
  const idx = Math.floor(rng() * FORTE_CATALOG.length) % FORTE_CATALOG.length;
  const { forte, pcs } = FORTE_CATALOG[idx];

  // Pick question type by day-of-year mod 4
  const qtIdx = dayOfYear(date) % QUESTION_TYPES.length;
  const questionType = QUESTION_TYPES[qtIdx];

  const analysis = classify(pcs);
  const { correctAnswer, distractors } = buildQuestionAndDistractors(questionType, analysis, forte, rng);

  try {
    const result = db.prepare(`
      INSERT INTO daily_challenges (date, forte, pitch_classes, question_type, correct_answer, distractors)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(today, forte, JSON.stringify(pcs), questionType, correctAnswer, JSON.stringify(distractors));

    return db.prepare('SELECT * FROM daily_challenges WHERE id = ?').get(result.lastInsertRowid) as DailyChallenge;
  } catch {
    // Race condition — another process inserted it first
    return db.prepare('SELECT * FROM daily_challenges WHERE date = ?').get(today) as DailyChallenge;
  }
}

export interface SubmitResult {
  correct: boolean;
  correctAnswer: string;
}

export function submitChallenge(
  userId: string,
  challengeId: number,
  answer: string,
  elapsedSec: number | null,
): SubmitResult {
  const db = getDb();

  const challenge = db.prepare('SELECT * FROM daily_challenges WHERE id = ?').get(challengeId) as DailyChallenge | null;
  if (!challenge) throw new Error('Challenge not found');

  const correct = answer.trim() === challenge.correct_answer.trim() ? 1 : 0;

  try {
    db.prepare(`
      INSERT INTO daily_submissions (user_id, challenge_id, answer, correct, elapsed_sec)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, challengeId, answer, correct, elapsedSec ?? null);
  } catch {
    // UNIQUE constraint — already submitted
    const sub = db.prepare(
      'SELECT answer, correct FROM daily_submissions WHERE user_id = ? AND challenge_id = ?'
    ).get(userId, challengeId) as { answer: string; correct: number } | undefined;
    return {
      correct: (sub?.correct ?? 0) === 1,
      correctAnswer: challenge.correct_answer,
    };
  }

  return {
    correct: correct === 1,
    correctAnswer: challenge.correct_answer,
  };
}

export function getUserChallengeStreak(userId: string): number {
  const db = getDb();

  // Walk backwards from today, counting consecutive days with correct submissions
  let streak = 0;
  const checkDate = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);

    const row = db.prepare(`
      SELECT ds.correct
      FROM daily_submissions ds
      JOIN daily_challenges dc ON dc.id = ds.challenge_id
      WHERE ds.user_id = ? AND dc.date = ?
    `).get(userId, dateStr) as { correct: number } | undefined;

    if (!row || row.correct === 0) {
      // If today and no submission yet, skip — streak continues from yesterday
      if (i === 0 && !row) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      break;
    }

    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export interface LeaderboardEntry {
  name: string;
  streak: number;
}

export function getLeaderboard(limit = 10): LeaderboardEntry[] {
  const db = getDb();

  // Get all users who have any correct submissions
  const users = db.prepare(`
    SELECT DISTINCT user_id FROM daily_submissions WHERE correct = 1
  `).all() as { user_id: string }[];

  const entries: LeaderboardEntry[] = [];

  for (const { user_id } of users) {
    const streak = getUserChallengeStreak(user_id);
    if (streak === 0) continue;

    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(user_id) as { name: string | null; email: string } | undefined;
    if (!user) continue;

    let displayName: string;
    if (user.name && user.name.trim().length > 0) {
      const parts = user.name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] + '.' : '';
      displayName = lastInitial ? `${firstName} ${lastInitial}` : firstName;
    } else {
      // Use email prefix masked
      displayName = user.email.split('@')[0].slice(0, 8) + '…';
    }

    entries.push({ name: displayName, streak });
  }

  entries.sort((a, b) => b.streak - a.streak);
  return entries.slice(0, limit);
}
