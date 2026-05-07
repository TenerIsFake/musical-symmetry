import { useEffect } from 'react';
import { useExercises, type Exercise } from '../hooks/useExercises';

const DIFFICULTY_STYLES: Record<Exercise['difficulty'], string> = {
  beginner: 'bg-green-900/50 text-green-300 border-green-700',
  intermediate: 'bg-amber-900/50 text-amber-300 border-amber-700',
  advanced: 'bg-red-900/50 text-red-300 border-red-700',
};

const TOOL_LABELS: Record<string, string> = {
  compose: 'Compose',
  'harmonic-path': 'Harmonic Path',
  euclidean: 'Euclidean Rhythm',
  transform: 'Transform',
  sketchpad: 'Sketchpad',
};

interface ExerciseSuggestionsProps {
  maxVisible?: number;
}

export default function ExerciseSuggestions({ maxVisible = 3 }: ExerciseSuggestionsProps) {
  const { suggestions, completed, loading, loadSuggestions, completeExercise } = useExercises();

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  function buildToolUrl(exercise: Exercise): string {
    const params = exercise.prefilledParams
      ? '?' + new URLSearchParams(exercise.prefilledParams).toString()
      : '';
    return `#${exercise.tool}${params}`;
  }

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-500">Loading exercises…</p>
      </div>
    );
  }

  if (suggestions.length === 0 && completed.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">Practice Exercises</h3>
        <p className="text-sm text-gray-500">
          Start a learning path to get personalized exercises.{' '}
          <a href="#learn" className="text-indigo-400 hover:underline">
            Go to Learn
          </a>
        </p>
      </div>
    );
  }

  const visible = suggestions.slice(0, maxVisible);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Practice Exercises</h3>
        {completed.length > 0 && (
          <span className="text-xs text-gray-500">{completed.length} completed</span>
        )}
      </div>

      {visible.length === 0 && completed.length > 0 && (
        <p className="text-sm text-gray-500">All suggested exercises complete. Keep learning to unlock more!</p>
      )}

      {visible.map(exercise => {
        const isDone = completed.includes(exercise.key);
        return (
          <div
            key={exercise.key}
            className={`rounded-lg border p-3 space-y-2 transition-colors ${
              isDone
                ? 'border-green-800 bg-green-950/30'
                : 'border-gray-700 bg-gray-750 hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{exercise.title}</span>
                  {isDone && (
                    <span className="text-green-400 text-sm" title="Completed">
                      ✓
                    </span>
                  )}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_STYLES[exercise.difficulty]}`}
                  >
                    {exercise.difficulty}
                  </span>
                  <span className="text-xs text-gray-500">
                    {TOOL_LABELS[exercise.tool] ?? exercise.tool}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{exercise.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={buildToolUrl(exercise)}
                className="px-3 py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded text-white transition-colors"
              >
                Start
              </a>
              {!isDone && (
                <button
                  onClick={() => void completeExercise(exercise.key)}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-green-900 rounded text-gray-300 hover:text-green-300 transition-colors"
                >
                  Mark done
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
