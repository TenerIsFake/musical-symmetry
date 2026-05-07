export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string; // Markdown
  task?: { description: string; link: string };
  quiz?: QuizQuestion;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  lessons: Lesson[];
}
