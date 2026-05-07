import { getDb } from '../auth/db.js';
import { getCompletedExercises } from './db.js';

export interface Exercise {
  key: string;
  title: string;
  description: string;
  tool: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prefilledParams?: Record<string, string>;
}

interface ExerciseTemplate {
  key: string;
  title: string;
  description: string;
  tool: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prefilledParams?: Record<string, string>;
  condition: (ctx: UserContext) => boolean;
}

interface UserContext {
  completedLessons: Set<string>;
  analysisCount: number;
  achievementIds: Set<string>;
}

const TEMPLATES: ExerciseTemplate[] = [
  {
    key: 'melody-intro-set-theory-1-diatonic',
    title: 'Compose a Diatonic Melody',
    description: 'Write a melody using only the pitch classes {0,2,4,5,7,9,11} (C major scale). Focus on stepwise motion.',
    tool: 'compose',
    difficulty: 'beginner',
    prefilledParams: { pcs: '0,2,4,5,7,9,11' },
    condition: ctx => ctx.completedLessons.has('intro-set-theory/1'),
  },
  {
    key: 'transform-intro-set-theory-3-plr',
    title: 'Build a PLR Transformation Chain',
    description: 'Starting from C major, apply Parallel, Leading-tone, and Relative transforms. Create a chain of at least 4 chords.',
    tool: 'transform',
    difficulty: 'intermediate',
    condition: ctx => ctx.completedLessons.has('intro-set-theory/3'),
  },
  {
    key: 'euclidean-symmetry-1-rhythm',
    title: 'Euclidean Rhythm with Tetrachord Symmetry',
    description: 'Find a Euclidean rhythm that shares the same rotational symmetry as the fully-diminished tetrachord {0,3,6,9}.',
    tool: 'euclidean',
    difficulty: 'intermediate',
    prefilledParams: { steps: '12', pulses: '4' },
    condition: ctx => ctx.completedLessons.has('symmetry-groups/1'),
  },
  {
    key: 'harmonic-path-symmetry-4-tonnetz',
    title: 'Closed Tonnetz Journey',
    description: 'Walk a path on the Tonnetz starting and ending at C major in 8 steps or fewer. Explore chromatic mediant relationships.',
    tool: 'harmonic-path',
    difficulty: 'advanced',
    condition: ctx => ctx.completedLessons.has('symmetry-groups/4'),
  },
  {
    key: 'sketchpad-analyzed-set',
    title: 'Sketch with Your Most-Analyzed Set Class',
    description: 'You\'ve analyzed many set classes. Create a sketchpad composition that uses your most-visited set class as the harmonic foundation.',
    tool: 'sketchpad',
    difficulty: 'intermediate',
    condition: ctx => ctx.analysisCount >= 10,
  },
  {
    key: 'compose-zpair-contour',
    title: 'Z-Related Pair Comparison',
    description: 'Compose two short melodies using a Z-related pair of set classes. Notice how they share the same interval vector despite different structures.',
    tool: 'compose',
    difficulty: 'advanced',
    condition: ctx => ctx.achievementIds.has('z-pair'),
  },
];

export function getSuggestedExercises(userId: string, maxResults = 5): Exercise[] {
  const db = getDb();

  // Load lesson progress
  const lessonRows = db.prepare(
    'SELECT path_id, lesson_id FROM lesson_progress WHERE user_id = ?'
  ).all(userId) as Array<{ path_id: string; lesson_id: string }>;
  const completedLessons = new Set(lessonRows.map(r => `${r.path_id}/${r.lesson_id}`));

  // Count distinct analyzed set classes
  const countRow = db.prepare(
    'SELECT COUNT(*) as cnt FROM analysis_history WHERE user_id = ?'
  ).get(userId) as { cnt: number } | undefined;
  const analysisCount = countRow?.cnt ?? 0;

  // Load achievement IDs
  let achievementIds = new Set<string>();
  try {
    const achRows = db.prepare(
      'SELECT achievement_id FROM achievements WHERE user_id = ?'
    ).all(userId) as Array<{ achievement_id: string }>;
    achievementIds = new Set(achRows.map(r => r.achievement_id));
  } catch {
    // achievements table may not be available in all environments
  }

  const ctx: UserContext = { completedLessons, analysisCount, achievementIds };

  // Filter out already-completed exercises
  const completed = new Set(getCompletedExercises(userId));

  const results: Exercise[] = [];
  for (const template of TEMPLATES) {
    if (results.length >= maxResults) break;
    if (completed.has(template.key)) continue;
    if (!template.condition(ctx)) continue;

    results.push({
      key: template.key,
      title: template.title,
      description: template.description,
      tool: template.tool,
      difficulty: template.difficulty,
      ...(template.prefilledParams ? { prefilledParams: template.prefilledParams } : {}),
    });
  }

  return results;
}
