import crypto from 'node:crypto';
import { Router } from 'express';
import { getDb } from '../auth/db.js';
import { requireAuth } from '../auth/middleware.js';
import '../auth/types.js';

export const assignmentsRouter = Router();

// ─── Schema migration ───────────────────────────────────────────────────────

function initAssignmentSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL,
      classroom_id TEXT,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_creator ON assignments(creator_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON assignments(classroom_id);

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      answers TEXT NOT NULL,
      score REAL,
      submitted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (student_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);
  `);
}

initAssignmentSchema();

// ─── Tier limits ────────────────────────────────────────────────────────────

const ASSIGNMENT_LIMITS: Record<string, number> = {
  free: 0,      // can complete only
  pro: 5,       // up to 5 active
  research: -1, // unlimited
};

// ─── Scoring ─────────────────────────────────────────────────────────────────

type Question =
  | { type: 'identify_set'; pcs: number[]; answer: string }
  | { type: 'identify_group'; pcs: number[]; answer: string }
  | { type: 'match_vector'; vector: number[]; answer: string }
  | { type: 'find_complement'; pcs: number[]; answer: number[] }
  | { type: 'transpose'; pcs: number[]; by: number; answer: number[] };

function scoreSubmission(questions: Question[], rawAnswers: unknown[]): { score: number; breakdown: boolean[] } {
  let correct = 0;
  const breakdown: boolean[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const studentAnswer = rawAnswers[i];
    let isCorrect = false;

    if (q.type === 'identify_set' || q.type === 'identify_group' || q.type === 'match_vector') {
      isCorrect = typeof studentAnswer === 'string' &&
        studentAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
    } else if (q.type === 'find_complement' || q.type === 'transpose') {
      if (Array.isArray(studentAnswer)) {
        const expected = [...q.answer].sort((a, b) => a - b);
        const actual = [...studentAnswer].map(Number).sort((a, b) => a - b);
        isCorrect = expected.length === actual.length &&
          expected.every((v, idx) => v === actual[idx]);
      }
    }

    if (isCorrect) correct++;
    breakdown.push(isCorrect);
  }

  const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;
  return { score, breakdown };
}

// ─── All routes require auth ─────────────────────────────────────────────────

assignmentsRouter.use(requireAuth);

// POST /api/assignments — create (educator only: pro or research)
assignmentsRouter.post('/', (req, res) => {
  const user = req.user!;
  const limit = ASSIGNMENT_LIMITS[user.tier] ?? 0;

  if (limit === 0) {
    res.status(403).json({
      error: 'Creating assignments requires a Pro or Research tier',
      upgrade: 'https://symmetry.tendrid.us/#dashboard',
    });
    return;
  }

  const { title, description, questions, classroom_id, due_date } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (title.length > 200) {
    res.status(400).json({ error: 'title must be 200 characters or fewer' });
    return;
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: 'questions must be a non-empty array' });
    return;
  }
  if (questions.length > 100) {
    res.status(400).json({ error: 'Maximum 100 questions per assignment' });
    return;
  }

  const db = getDb();

  // Enforce active assignment limits for pro tier
  if (limit > 0) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM assignments WHERE creator_id = ?'
    ).get(user.id) as { count: number };
    if (row.count >= limit) {
      res.status(403).json({
        error: `Pro tier is limited to ${limit} active assignments. Delete one or upgrade to Research.`,
        upgrade: 'https://symmetry.tendrid.us/#dashboard',
      });
      return;
    }
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO assignments (id, creator_id, title, description, questions, classroom_id, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    user.id,
    title.trim(),
    description || null,
    JSON.stringify(questions),
    classroom_id || null,
    due_date || null,
  );

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  res.status(201).json({ assignment });
});

// GET /api/assignments — list mine (educator) or assigned to me (student)
assignmentsRouter.get('/', (req, res) => {
  const user = req.user!;
  const db = getDb();

  const canCreate = (ASSIGNMENT_LIMITS[user.tier] ?? 0) !== 0;

  if (canCreate) {
    // Educator: list assignments I created
    const assignments = db.prepare(
      'SELECT * FROM assignments WHERE creator_id = ? ORDER BY created_at DESC'
    ).all(user.id);
    res.json({ assignments, role: 'educator' });
  } else {
    // Student: list assignments they have submitted or all available
    // Return all non-expired assignments (not created by self) plus submission status
    const assignments = db.prepare(`
      SELECT a.*,
             s.id as submission_id,
             s.score,
             s.submitted_at
      FROM assignments a
      LEFT JOIN assignment_submissions s
        ON s.assignment_id = a.id AND s.student_id = ?
      WHERE a.creator_id != ?
      ORDER BY a.created_at DESC
    `).all(user.id, user.id);
    res.json({ assignments, role: 'student' });
  }
});

// GET /api/assignments/:id — assignment detail (strips answers for students)
assignmentsRouter.get('/:id', (req, res) => {
  const user = req.user!;
  const db = getDb();

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) as {
    id: string; creator_id: string; title: string; description: string | null;
    questions: string; classroom_id: string | null; due_date: string | null; created_at: string;
  } | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  const questions: Question[] = JSON.parse(assignment.questions);
  const isCreator = assignment.creator_id === user.id;

  // Students get questions without the answers
  const questionsForUser = isCreator
    ? questions
    : questions.map(q => {
        const { answer: _answer, ...rest } = q as Record<string, unknown>;
        void _answer;
        return rest;
      });

  // Include student's own submission if present
  const submission = db.prepare(
    'SELECT * FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?'
  ).get(req.params.id, user.id);

  res.json({
    assignment: { ...assignment, questions: questionsForUser },
    isCreator,
    submission: submission || null,
  });
});

// POST /api/assignments/:id/submit — student submits answers
assignmentsRouter.post('/:id/submit', (req, res) => {
  const user = req.user!;
  const db = getDb();

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) as {
    id: string; creator_id: string; questions: string;
  } | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  if (assignment.creator_id === user.id) {
    res.status(400).json({ error: 'You cannot submit to your own assignment' });
    return;
  }

  // Check for existing submission
  const existing = db.prepare(
    'SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?'
  ).get(req.params.id, user.id);
  if (existing) {
    res.status(409).json({ error: 'You have already submitted this assignment' });
    return;
  }

  const { answers } = req.body;
  if (!Array.isArray(answers)) {
    res.status(400).json({ error: 'answers must be an array' });
    return;
  }

  const questions: Question[] = JSON.parse(assignment.questions);
  const { score, breakdown } = scoreSubmission(questions, answers);

  // Build per-question result with correct answers revealed
  const results = questions.map((q, i) => ({
    correct: breakdown[i],
    studentAnswer: answers[i],
    correctAnswer: q.answer,
    question: q,
  }));

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO assignment_submissions (id, assignment_id, student_id, answers, score)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.id, user.id, JSON.stringify(answers), score);

  res.status(201).json({ submissionId: id, score, breakdown, results });
});

// GET /api/assignments/:id/results — educator sees all submissions
assignmentsRouter.get('/:id/results', (req, res) => {
  const user = req.user!;
  const db = getDb();

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) as {
    id: string; creator_id: string;
  } | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  if (assignment.creator_id !== user.id) {
    res.status(403).json({ error: 'Only the assignment creator can view results' });
    return;
  }

  const submissions = db.prepare(`
    SELECT s.*, u.email, u.name
    FROM assignment_submissions s
    JOIN users u ON u.id = s.student_id
    WHERE s.assignment_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.params.id);

  res.json({ submissions });
});

// DELETE /api/assignments/:id — educator deletes
assignmentsRouter.delete('/:id', (req, res) => {
  const user = req.user!;
  const db = getDb();

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) as {
    id: string; creator_id: string;
  } | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Assignment not found' });
    return;
  }

  if (assignment.creator_id !== user.id) {
    res.status(403).json({ error: 'Only the assignment creator can delete it' });
    return;
  }

  db.prepare('DELETE FROM assignment_submissions WHERE assignment_id = ?').run(req.params.id);
  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);

  res.json({ deleted: true });
});
