import { useState, useEffect, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import {
  classify,
  complement,
  transpose,
  NOTE_NAMES,
  intervalVector,
} from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { forteNumber } from '../data/forte-numbers';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = 'identify_set' | 'identify_group' | 'match_vector' | 'find_complement' | 'transpose';

interface QuestionBase {
  type: QuestionType;
}
interface IdentifySetQ extends QuestionBase { type: 'identify_set'; pcs: number[]; answer: string }
interface IdentifyGroupQ extends QuestionBase { type: 'identify_group'; pcs: number[]; answer: string }
interface MatchVectorQ extends QuestionBase { type: 'match_vector'; vector: number[]; answer: string }
interface FindComplementQ extends QuestionBase { type: 'find_complement'; pcs: number[]; answer: number[] }
interface TransposeQ extends QuestionBase { type: 'transpose'; pcs: number[]; by: number; answer: number[] }

type Question = IdentifySetQ | IdentifyGroupQ | MatchVectorQ | FindComplementQ | TransposeQ;

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  questions: Question[];
  classroom_id: string | null;
  due_date: string | null;
  created_at: string;
  creator_id?: string;
  // student list fields
  submission_id?: string | null;
  score?: number | null;
  submitted_at?: string | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  answers: string; // JSON
  score: number;
  submitted_at: string;
  email?: string;
  name?: string | null;
}

interface SubmitResult {
  submissionId: string;
  score: number;
  breakdown: boolean[];
  results: Array<{
    correct: boolean;
    studentAnswer: unknown;
    correctAnswer: unknown;
    question: Question;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomPcs(size: number): PitchClass[] {
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as PitchClass[];
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size).sort((a, b) => a - b) as PitchClass[];
}

function pcsLabel(pcs: number[]): string {
  return '{' + pcs.map(pc => NOTE_NAMES[pc as PitchClass]).join(', ') + '}';
}

function generateQuestion(type: QuestionType): Question {
  const size = Math.floor(Math.random() * 4) + 3; // 3–6 notes
  const pcs = randomPcs(size);
  const analysis = classify(pcs);

  switch (type) {
    case 'identify_set': {
      const fn = forteNumber(pcs) ?? 'unknown';
      return { type, pcs, answer: fn };
    }
    case 'identify_group': {
      return { type, pcs, answer: analysis.abstractGroup };
    }
    case 'match_vector': {
      const iv = intervalVector(pcs);
      const fn = forteNumber(pcs) ?? 'unknown';
      return { type, vector: Array.from(iv), answer: fn };
    }
    case 'find_complement': {
      const comp = complement(pcs);
      return { type, pcs, answer: comp };
    }
    case 'transpose': {
      const by = Math.floor(Math.random() * 11) + 1;
      const transposed = transpose(pcs, by);
      return { type, pcs, by, answer: transposed };
    }
  }
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  identify_set: 'Identify Set Class (Forte number)',
  identify_group: 'Name Symmetry Group',
  match_vector: 'Match Interval Vector',
  find_complement: 'Find Complement',
  transpose: 'Transpose Set',
};

const QUESTION_TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  identify_set: 'Given a pitch-class set, identify its Forte number (e.g., 4-Z15)',
  identify_group: 'Given a pitch-class set, name its abstract symmetry group',
  match_vector: 'Given an interval vector, identify which Forte number has it',
  find_complement: 'Given a pitch-class set, list its complement',
  transpose: 'Transpose a pitch-class set by N semitones',
};

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = '/api/assignments';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
  const json = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
  return json;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionDisplay({ q, index }: { q: Question; index: number }) {
  switch (q.type) {
    case 'identify_set':
      return (
        <span>
          <span className="font-semibold text-gray-200">Q{index + 1}.</span>{' '}
          What is the Forte number for the set {pcsLabel(q.pcs)}?
        </span>
      );
    case 'identify_group':
      return (
        <span>
          <span className="font-semibold text-gray-200">Q{index + 1}.</span>{' '}
          What symmetry group does {pcsLabel(q.pcs)} belong to?
        </span>
      );
    case 'match_vector':
      return (
        <span>
          <span className="font-semibold text-gray-200">Q{index + 1}.</span>{' '}
          Which Forte number has interval vector [
          {Array.from(q.vector).join(', ')}]?
        </span>
      );
    case 'find_complement':
      return (
        <span>
          <span className="font-semibold text-gray-200">Q{index + 1}.</span>{' '}
          List the complement of {pcsLabel(q.pcs)} as comma-separated pitch classes (0–11).
        </span>
      );
    case 'transpose':
      return (
        <span>
          <span className="font-semibold text-gray-200">Q{index + 1}.</span>{' '}
          Transpose {pcsLabel(q.pcs)} up by {q.by} semitone{q.by !== 1 ? 's' : ''}.
          List the result as comma-separated pitch classes.
        </span>
      );
  }
}

// ─── Student: answer input for a single question ──────────────────────────────

function AnswerInput({
  q,
  value,
  onChange,
}: {
  q: { type: QuestionType };
  value: string;
  onChange: (v: string) => void;
}) {
  if (q.type === 'identify_set' || q.type === 'identify_group' || q.type === 'match_vector') {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={
          q.type === 'identify_set' || q.type === 'match_vector'
            ? 'e.g. 4-Z15'
            : 'e.g. Z2'
        }
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="e.g. 0, 2, 4, 7"
      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
    />
  );
}

// ─── Result feedback ──────────────────────────────────────────────────────────

function ResultFeedback({ result }: { result: SubmitResult['results'][number] }) {
  const correct = result.correct;
  return (
    <div className={`rounded p-3 border ${correct ? 'border-green-700 bg-green-900/20' : 'border-red-700 bg-red-900/20'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-sm font-bold ${correct ? 'text-green-400' : 'text-red-400'}`}>
          {correct ? '✓ Correct' : '✗ Incorrect'}
        </span>
      </div>
      {!correct && (
        <div className="text-sm text-gray-300">
          <span className="text-gray-500">Your answer: </span>
          <span className="text-red-300">
            {Array.isArray(result.studentAnswer)
              ? (result.studentAnswer as number[]).join(', ')
              : String(result.studentAnswer || '(blank)')}
          </span>
          <br />
          <span className="text-gray-500">Correct answer: </span>
          <span className="text-green-300">
            {Array.isArray(result.correctAnswer)
              ? (result.correctAnswer as number[]).join(', ')
              : String(result.correctAnswer)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Educator: Question builder row ──────────────────────────────────────────

function QuestionBuilderRow({
  question,
  index,
  onRemove,
  onRegenerate,
}: {
  question: Question;
  index: number;
  onRemove: () => void;
  onRegenerate: (type: QuestionType) => void;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-gray-300 flex-1">
          <QuestionDisplay q={question} index={index} />
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onRegenerate(question.type)}
            className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-400 hover:bg-gray-600 transition-colors"
            title="Regenerate this question"
          >
            ↺
          </button>
          <button
            onClick={onRemove}
            className="px-2 py-1 bg-red-900/50 rounded text-xs text-red-400 hover:bg-red-800/50 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-600">
        Answer: {Array.isArray(question.answer)
          ? (question.answer as number[]).join(', ')
          : question.answer}
      </div>
    </div>
  );
}

// ─── Educator View ────────────────────────────────────────────────────────────

function EducatorView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Submission[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [addType, setAddType] = useState<QuestionType>('identify_set');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ assignments: Assignment[] }>('');
      setAssignments(data.assignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, generateQuestion(addType)]);
  };

  const removeQuestion = (i: number) => {
    setQuestions(prev => prev.filter((_, idx) => idx !== i));
  };

  const regenerateQuestion = (i: number, type: QuestionType) => {
    setQuestions(prev => prev.map((q, idx) => idx === i ? generateQuestion(type) : q));
  };

  const handleCreate = async () => {
    if (!title.trim()) { setCreateError('Title is required'); return; }
    if (questions.length === 0) { setCreateError('Add at least one question'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch<{ assignment: Assignment }>('', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          questions,
          due_date: dueDate || undefined,
        }),
      });
      setShowCreate(false);
      setTitle(''); setDescription(''); setDueDate(''); setQuestions([]);
      void load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment and all its submissions?')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' });
      void load();
      if (selectedId === id) { setSelectedId(null); setResults(null); }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const loadResults = async (id: string) => {
    setSelectedId(id);
    setResultsLoading(true);
    try {
      const data = await apiFetch<{ submissions: Submission[] }>(`/${id}/results`);
      setResults(data.submissions);
    } catch {
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading assignments...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">My Assignments</h2>
          <p className="text-sm text-gray-400 mt-0.5">Create and manage graded worksheets for your students.</p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setCreateError(null); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium text-white transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New Assignment'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-gray-800 rounded-lg p-5 space-y-4 border border-gray-700">
          <h3 className="font-semibold text-gray-100">New Assignment</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Week 3 — Set Classes Quiz"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional instructions for students"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Question builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">Questions ({questions.length})</label>
            </div>

            <div className="space-y-2 mb-3">
              {questions.map((q, i) => (
                <QuestionBuilderRow
                  key={i}
                  question={q}
                  index={i}
                  onRemove={() => removeQuestion(i)}
                  onRegenerate={type => regenerateQuestion(i, type)}
                />
              ))}
              {questions.length === 0 && (
                <p className="text-gray-600 text-sm italic">No questions yet — add one below.</p>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={addType}
                onChange={e => setAddType(e.target.value as QuestionType)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
                  <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <button
                onClick={addQuestion}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium text-gray-200 transition-colors"
              >
                Add Question
              </button>
            </div>
            {addType && (
              <p className="text-xs text-gray-500 mt-1">{QUESTION_TYPE_DESCRIPTIONS[addType]}</p>
            )}
          </div>

          {createError && <p className="text-red-400 text-sm">{createError}</p>}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-medium text-white transition-colors"
          >
            {creating ? 'Creating...' : 'Create Assignment'}
          </button>
        </div>
      )}

      {/* Assignment list */}
      {assignments.length === 0 && !showCreate && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-1">No assignments yet</p>
          <p className="text-sm">Click "New Assignment" to create your first worksheet.</p>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map(a => (
          <div key={a.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-100 truncate">{a.title}</h3>
                {a.description && (
                  <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{a.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}</span>
                  {a.due_date && <span>Due {new Date(a.due_date).toLocaleDateString()}</span>}
                  <span>Created {new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => selectedId === a.id ? setSelectedId(null) : loadResults(a.id)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium text-gray-300 transition-colors"
                >
                  {selectedId === a.id ? 'Hide Results' : 'Results'}
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-xs font-medium text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Results panel */}
            {selectedId === a.id && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                {resultsLoading ? (
                  <p className="text-gray-400 text-sm">Loading results...</p>
                ) : results && results.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No submissions yet.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 mb-2">
                      {results?.length} submission{results?.length !== 1 ? 's' : ''}
                    </p>
                    {results?.map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-gray-900 rounded p-2 text-sm">
                        <span className="text-gray-300 truncate">{s.name || s.email}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`font-mono font-semibold ${
                            s.score >= 80 ? 'text-green-400' :
                            s.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {s.score.toFixed(1)}%
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(s.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Average */}
                    {results && results.length > 0 && (
                      <div className="flex items-center justify-between bg-gray-800 rounded p-2 text-sm border-t border-gray-700 mt-1">
                        <span className="text-gray-400 font-medium">Class average</span>
                        <span className="font-mono font-semibold text-indigo-400">
                          {(results.reduce((sum, s) => sum + s.score, 0) / results.length).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Student View ─────────────────────────────────────────────────────────────

function StudentView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ assignments: Assignment[] }>('');
      setAssignments(data.assignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openAssignment = async (id: string) => {
    setActiveId(id);
    setSubmitResult(null);
    setSubmitError(null);
    setActiveLoading(true);
    try {
      const data = await apiFetch<{ assignment: Assignment; submission: Submission | null }>(
        `/${id}`
      );
      setActiveAssignment(data.assignment);
      setAnswers(data.assignment.questions.map(() => ''));
      if (data.submission) {
        // Already submitted — show score only view
        const answers = JSON.parse(data.submission.answers) as unknown[];
        setAnswers(answers.map(a => Array.isArray(a) ? (a as number[]).join(', ') : String(a)));
      }
    } catch {
      setActiveAssignment(null);
    } finally {
      setActiveLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeAssignment) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const parsed = activeAssignment.questions.map((q, i) => {
        const raw = answers[i] ?? '';
        if (q.type === 'find_complement' || q.type === 'transpose') {
          return raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        }
        return raw.trim();
      });
      const result = await apiFetch<SubmitResult>(`/${activeAssignment.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: parsed }),
      });
      setSubmitResult(result);
      void load(); // Refresh list to show submission status
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading assignments...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  // Active assignment view
  if (activeId && (activeAssignment || activeLoading)) {
    if (activeLoading) return <p className="text-gray-400 text-sm">Loading...</p>;
    const a = activeAssignment!;
    const alreadySubmitted = assignments.find(x => x.id === activeId)?.submission_id != null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setActiveId(null); setActiveAssignment(null); setSubmitResult(null); }}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-100">{a.title}</h2>
            {a.due_date && (
              <p className="text-xs text-gray-500">Due {new Date(a.due_date).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {a.description && (
          <p className="text-sm text-gray-300 bg-gray-800 rounded p-3">{a.description}</p>
        )}

        {/* Show result if just submitted */}
        {submitResult && (
          <div className="bg-gray-800 rounded-lg p-5 border border-indigo-700">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold text-indigo-400">
                {submitResult.score.toFixed(1)}%
              </span>
              <span className="text-gray-400 text-sm">
                ({submitResult.breakdown.filter(Boolean).length} / {submitResult.breakdown.length} correct)
              </span>
            </div>
            <div className="space-y-3">
              {submitResult.results.map((r, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm text-gray-300">
                    <QuestionDisplay q={r.question} index={i} />
                  </p>
                  <ResultFeedback result={r} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questions */}
        {!submitResult && (
          <div className="space-y-4">
            {a.questions.map((q, i) => {
              const submitted = alreadySubmitted;
              return (
                <div key={i} className="bg-gray-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-gray-300">
                    <QuestionDisplay q={q} index={i} />
                  </p>
                  <AnswerInput
                    q={q}
                    value={answers[i] ?? ''}
                    onChange={v => setAnswers(prev => prev.map((a, idx) => idx === i ? v : a))}
                  />
                  {submitted && (
                    <p className="text-xs text-gray-500 italic">Already submitted</p>
                  )}
                </div>
              );
            })}

            {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

            {!alreadySubmitted && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-medium text-white transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Answers'}
              </button>
            )}
            {alreadySubmitted && (
              <p className="text-center text-green-400 text-sm font-medium">
                You have already submitted this assignment.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Available Assignments</h2>
        <p className="text-sm text-gray-400 mt-0.5">Complete these worksheets assigned by your instructor.</p>
      </div>

      {assignments.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-1">No assignments available</p>
          <p className="text-sm">Your instructor has not assigned any work yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map(a => {
          const submitted = a.submission_id != null;
          return (
            <button
              key={a.id}
              onClick={() => openAssignment(a.id)}
              className="w-full text-left bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-indigo-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-100 truncate">{a.title}</h3>
                  {a.description && (
                    <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{a.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}</span>
                    {a.due_date && <span>Due {new Date(a.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {submitted ? (
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${
                        (a.score ?? 0) >= 80 ? 'text-green-400' :
                        (a.score ?? 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(a.score ?? 0).toFixed(1)}%
                      </span>
                      <p className="text-xs text-gray-500">Submitted</p>
                    </div>
                  ) : (
                    <span className="px-2 py-1 bg-indigo-900/50 rounded text-xs font-medium text-indigo-400">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <p className="text-gray-300 text-lg">Sign in to access assignments.</p>
        <a
          href="#dashboard"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium text-white transition-colors"
        >
          Sign in
        </a>
      </div>
    );
  }

  const canCreate = user.tier === 'pro' || user.tier === 'research';

  return (
    <div className="space-y-6">
      {/* Tier info banner for free users */}
      {!canCreate && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-300 font-medium">You are on the Free tier</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Upgrade to Pro to create your own assignments. Free users can complete assigned work.
            </p>
          </div>
          <a
            href="#dashboard"
            className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium text-white transition-colors"
          >
            Upgrade
          </a>
        </div>
      )}

      {canCreate ? <EducatorView /> : <StudentView />}
    </div>
  );
}
