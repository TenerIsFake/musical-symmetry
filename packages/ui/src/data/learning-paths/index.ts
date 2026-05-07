import type { LearningPath } from './types.js';
import introSetTheory from './intro-set-theory.json';
import symmetryGroups from './symmetry-groups.json';

export const LEARNING_PATHS: LearningPath[] = [
  introSetTheory as LearningPath,
  symmetryGroups as LearningPath,
];
