import { useState, useEffect, useCallback } from 'react';
import { LEARNING_PATHS } from '../data/learning-paths/index.js';
import type { LearningPath, Lesson } from '../data/learning-paths/types.js';
import { useLearningProgress } from '../hooks/useLearningProgress.js';
import { API_BASE } from '../utils/apiBase';

// --- Simple Markdown Renderer ---
function renderMarkdown(md: string): string {
  return md
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-900 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Paragraphs: blank-line-separated blocks
    .split(/\n{2,}/)
    .map(block => {
      const trimmed = block.trim();
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) return trimmed;
      // Bullet list
      if (trimmed.split('\n').every(l => l.trim().startsWith('- '))) {
        const items = trimmed.split('\n').map(l => `<li class="ml-4 list-disc">${l.trim().slice(2)}</li>`).join('');
        return `<ul class="space-y-1 my-2 text-gray-300">${items}</ul>`;
      }
      if (!trimmed) return '';
      return `<p class="text-gray-300 leading-relaxed my-2">${trimmed.replace(/\n/g, ' ')}</p>`;
    })
    .join('\n');
}

// --- Path List View ---
interface PathListProps {
  completedLessons: Set<string>;
  userLoggedIn: boolean;
}

function PathList({ completedLessons, userLoggedIn }: PathListProps) {
  const FREE_LESSON_LIMIT = 2;

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-1">Learning Paths</h2>
        <p className="text-gray-400 text-sm">Structured lessons guiding you through music theory and symmetry.</p>
      </div>
      {LEARNING_PATHS.map(path => {
        const total = path.lessons.length;
        const completed = path.lessons.filter(l => completedLessons.has(`${path.id}/${l.id}`)).length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
          <a
            key={path.id}
            href={`#learn/${path.id}`}
            className="block bg-gray-800 rounded-lg p-5 hover:bg-gray-750 transition-colors border border-gray-700 hover:border-indigo-600"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{path.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">{path.title}</h3>
                <p className="text-sm text-gray-400 mt-1">{path.description}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{total} lessons</span>
                    {!userLoggedIn ? (
                      <span className="text-amber-500">{FREE_LESSON_LIMIT} free — sign in for full access</span>
                    ) : (
                      <span>{completed}/{total} complete</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// --- Path Overview ---
interface PathOverviewProps {
  path: LearningPath;
  completedLessons: Set<string>;
  userLoggedIn: boolean;
}

function PathOverview({ path, completedLessons, userLoggedIn }: PathOverviewProps) {
  const FREE_LESSON_LIMIT = 2;
  const total = path.lessons.length;
  const completed = path.lessons.filter(l => completedLessons.has(`${path.id}/${l.id}`)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <a href="#learn" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← All Paths
        </a>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <span className="text-4xl">{path.icon}</span>
        <div>
          <h2 className="text-xl font-bold text-white">{path.title}</h2>
          <p className="text-gray-400 text-sm mt-1">{path.description}</p>
          <p className="text-xs text-gray-500 mt-2">{completed}/{total} complete</p>
        </div>
      </div>
      <div className="space-y-2">
        {path.lessons.map((lesson, idx) => {
          const isCompleted = completedLessons.has(`${path.id}/${lesson.id}`);
          const isLocked = !userLoggedIn && idx >= FREE_LESSON_LIMIT;
          return (
            <a
              key={lesson.id}
              href={isLocked ? '#dashboard' : `#learn/${path.id}/${lesson.id}`}
              className={`flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3 border transition-colors ${
                isLocked
                  ? 'border-gray-700 opacity-60 cursor-pointer'
                  : isCompleted
                  ? 'border-green-700 hover:border-green-500'
                  : 'border-gray-700 hover:border-indigo-600'
              }`}
              title={isLocked ? 'Sign in to unlock this lesson' : undefined}
            >
              <span className="text-lg w-6 flex-shrink-0 text-center">
                {isLocked ? '🔒' : isCompleted ? '✅' : '○'}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isCompleted ? 'text-green-300' : 'text-white'}`}>
                  {idx + 1}. {lesson.title}
                </p>
              </div>
              {isLocked && (
                <span className="text-xs text-amber-500 shrink-0">Sign in</span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

// --- Lesson View ---
interface LessonViewProps {
  path: LearningPath;
  lesson: Lesson;
  completedLessons: Set<string>;
  onMarkComplete: (pathId: string, lessonId: string) => Promise<void>;
}

function LessonView({ path, lesson, completedLessons, onMarkComplete }: LessonViewProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const isCompleted = completedLessons.has(`${path.id}/${lesson.id}`);
  const quizCorrect = selectedOption !== null && lesson.quiz
    ? selectedOption === lesson.quiz.correctIndex
    : false;

  const canMarkComplete = isCompleted || !lesson.quiz || quizCorrect;

  const lessonIndex = path.lessons.findIndex(l => l.id === lesson.id);
  const prevLesson = lessonIndex > 0 ? path.lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < path.lessons.length - 1 ? path.lessons[lessonIndex + 1] : null;

  const handleMarkComplete = useCallback(async () => {
    await onMarkComplete(path.id, lesson.id);
  }, [onMarkComplete, path.id, lesson.id]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <a href="#learn" className="hover:text-white transition-colors">Paths</a>
        <span>/</span>
        <a href={`#learn/${path.id}`} className="hover:text-white transition-colors">{path.title}</a>
        <span>/</span>
        <span className="text-gray-300">{lesson.title}</span>
      </div>

      {/* Lesson Content */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">{lesson.title}</h2>
        <div
          className="prose prose-invert max-w-none text-gray-300"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }}
        />
      </div>

      {/* Task Card */}
      {lesson.task && (
        <div className="bg-indigo-900/40 border border-indigo-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-indigo-400 text-lg">🎯</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-300 mb-1">Try It</p>
              <p className="text-sm text-gray-300">{lesson.task.description}</p>
              <a
                href={lesson.task.link}
                className="inline-block mt-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors"
              >
                Go to Tool →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Section */}
      {lesson.quiz && (
        <div className="bg-gray-800 rounded-lg p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-300">Quiz</p>
          <p className="text-white">{lesson.quiz.question}</p>
          <div className="space-y-2">
            {lesson.quiz.options.map((opt, i) => {
              let btnClass = 'w-full text-left px-4 py-2.5 rounded border text-sm transition-colors ';
              if (!quizSubmitted) {
                btnClass += selectedOption === i
                  ? 'border-indigo-500 bg-indigo-900/40 text-white'
                  : 'border-gray-700 bg-gray-700/40 text-gray-300 hover:border-gray-500 hover:text-white';
              } else {
                if (i === lesson.quiz!.correctIndex) {
                  btnClass += 'border-green-600 bg-green-900/30 text-green-300';
                } else if (i === selectedOption) {
                  btnClass += 'border-red-600 bg-red-900/30 text-red-300';
                } else {
                  btnClass += 'border-gray-700 bg-gray-700/20 text-gray-500';
                }
              }
              return (
                <button
                  key={i}
                  className={btnClass}
                  onClick={() => {
                    if (!quizSubmitted) setSelectedOption(i);
                  }}
                  disabled={quizSubmitted}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {!quizSubmitted && selectedOption !== null && (
            <button
              onClick={() => setQuizSubmitted(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors"
            >
              Submit Answer
            </button>
          )}
          {quizSubmitted && (
            <div className={`rounded-lg p-3 text-sm ${quizCorrect ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-red-900/40 border border-red-700 text-red-300'}`}>
              <p className="font-semibold mb-1">{quizCorrect ? 'Correct!' : 'Not quite.'}</p>
              <p className="text-gray-300">{lesson.quiz!.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Mark Complete */}
      <div className="flex items-center justify-between">
        {isCompleted ? (
          <span className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <span>✅</span> Lesson complete
          </span>
        ) : (
          <button
            onClick={() => void handleMarkComplete()}
            disabled={!canMarkComplete}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              canMarkComplete
                ? 'bg-green-700 text-white hover:bg-green-600'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            title={!canMarkComplete ? 'Answer the quiz correctly first' : undefined}
          >
            Mark Complete
          </button>
        )}
        <span className="text-xs text-gray-500">
          {lessonIndex + 1} of {path.lessons.length}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        {prevLesson ? (
          <a
            href={`#learn/${path.id}/${prevLesson.id}`}
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
          >
            ← {prevLesson.title}
          </a>
        ) : (
          <a
            href={`#learn/${path.id}`}
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
          >
            ← Path Overview
          </a>
        )}
        {nextLesson ? (
          <a
            href={`#learn/${path.id}/${nextLesson.id}`}
            className="px-3 py-2 bg-indigo-700 text-white rounded text-sm hover:bg-indigo-600 transition-colors"
          >
            Next: {nextLesson.title} →
          </a>
        ) : (
          <a
            href={`#learn/${path.id}`}
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
          >
            Back to Path →
          </a>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---
interface LearningPathPageProps {
  pathId?: string;
  lessonId?: string;
}

export default function LearningPathPage({ pathId, lessonId }: LearningPathPageProps) {
  const [userLoggedIn, setUserLoggedIn] = useState<boolean | null>(null);

  // Check login status
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => setUserLoggedIn(r.ok))
      .catch(() => setUserLoggedIn(false));
  }, []);

  const { completedLessons, loading, markComplete } = useLearningProgress(userLoggedIn === true);

  const isLoggedIn = userLoggedIn === true;

  if (loading && userLoggedIn === null) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Lesson view
  if (pathId && lessonId) {
    const path = LEARNING_PATHS.find(p => p.id === pathId);
    if (!path) {
      return (
        <div className="text-center py-12 text-gray-400">
          Path not found. <a href="#learn" className="text-indigo-400 hover:underline">Back to Paths</a>
        </div>
      );
    }
    const lesson = path.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      return (
        <div className="text-center py-12 text-gray-400">
          Lesson not found. <a href={`#learn/${path.id}`} className="text-indigo-400 hover:underline">Back to Path</a>
        </div>
      );
    }
    const lessonIndex = path.lessons.findIndex(l => l.id === lessonId);
    const FREE_LESSON_LIMIT = 2;
    if (!isLoggedIn && lessonIndex >= FREE_LESSON_LIMIT) {
      return (
        <div className="max-w-md mx-auto text-center py-12">
          <div className="bg-gray-800 rounded-lg p-8">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-white mb-2">Sign In to Continue</h2>
            <p className="text-gray-400 text-sm mb-6">
              Free users can access the first {FREE_LESSON_LIMIT} lessons per path. Sign in to unlock all lessons.
            </p>
            <a
              href="#dashboard"
              className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      );
    }
    return (
      <LessonView
        path={path}
        lesson={lesson}
        completedLessons={completedLessons}
        onMarkComplete={markComplete}
      />
    );
  }

  // Path overview
  if (pathId) {
    const path = LEARNING_PATHS.find(p => p.id === pathId);
    if (!path) {
      return (
        <div className="text-center py-12 text-gray-400">
          Path not found. <a href="#learn" className="text-indigo-400 hover:underline">Back to Paths</a>
        </div>
      );
    }
    return (
      <PathOverview
        path={path}
        completedLessons={completedLessons}
        userLoggedIn={isLoggedIn}
      />
    );
  }

  // Path list (default)
  return (
    <PathList
      completedLessons={completedLessons}
      userLoggedIn={isLoggedIn}
    />
  );
}
