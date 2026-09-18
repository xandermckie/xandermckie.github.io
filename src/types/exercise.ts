/**
 * Core data model. Mirrors the structure documented in CONTEXT.md and is the
 * shape every entry in data/exercises.json must satisfy.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'interview';

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface QuizQuestion {
  question: string;
  /** Multiple-choice options (typically 4). */
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
  /** Shown after the user answers — explains why the answer is right. */
  explanation: string;
}

export interface ExerciseExplanation {
  overview: string;
  keyTerms: KeyTerm[];
  howItWorks: string;
  designPattern?: string;
  /** IDs of follow-up exercises that build on this concept. */
  relatedExercises: string[];
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  topics: string[];
  sourceUrl: string;
  sourceLabel: string;
  /** Rough completion time in minutes. */
  estimatedTime: number;
  /** The full Python source the user types, character by character. */
  code: string;
  explanation: ExerciseExplanation;
  quiz: QuizQuestion[];
}

/** Result of a single quiz attempt. */
export interface QuizScore {
  correct: number;
  total: number;
}

/** Live + final statistics emitted by the typing loop. */
export interface TypingStats {
  /** Words per minute (correct chars / 5 over elapsed minutes). */
  wpm: number;
  /** Correct keystrokes / total keystrokes, as a percentage 0–100. */
  accuracy: number;
  /** Count of incorrect keystrokes. */
  errors: number;
  /** Fraction of the snippet completed, 0–1. */
  progress: number;
  /** Elapsed seconds of active typing. */
  seconds: number;
  /** Correct characters typed. */
  chars: number;
}
