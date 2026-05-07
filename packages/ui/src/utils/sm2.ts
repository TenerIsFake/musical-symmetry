/**
 * SM-2 spaced-repetition algorithm
 * Based on the original SuperMemo SM-2 algorithm by Piotr Wozniak.
 *
 * Quality grades:
 *   5 — perfect response
 *   4 — correct after a hesitation
 *   3 — correct with serious difficulty
 *   2 — incorrect; easy correct answer
 *   1 — incorrect; remembered correct answer
 *   0 — complete blackout
 */

export interface Card {
  id: string;
  easeFactor: number;    // default 2.5, min 1.3
  interval: number;      // days until next review; starts at 0
  repetitions: number;   // number of successful reviews
  nextReview: number;    // Unix timestamp (ms) for next review
}

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export function createCard(id: string): Card {
  return {
    id,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: Date.now(),
  };
}

export function gradeCard(card: Card, quality: Quality): Card {
  const ef = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  let repetitions = card.repetitions;
  let interval = card.interval;

  if (quality < 3) {
    // Failed — reset repetitions
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(card.interval * ef);
    }
    repetitions += 1;
  }

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return { ...card, easeFactor: ef, interval, repetitions, nextReview };
}

export function isDue(card: Card): boolean {
  return Date.now() >= card.nextReview;
}

export function daysUntilDue(card: Card): number {
  const ms = card.nextReview - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
