/**
 * Loads the embedded exercise catalogue for the active language kit.
 */
import { getKit } from '../languages';
import type { Difficulty, Exercise } from '../types/exercise';
import { getLanguageId } from './catalog';

export function getExercises(): Exercise[] {
  return getKit(getLanguageId()).exercises;
}

export function getExerciseById(id: string): Exercise | undefined {
  return getExercises().find((e) => e.id === id);
}

/** Unique topic tags across the catalogue, alphabetized. */
export function allTopics(): string[] {
  const set = new Set<string>();
  for (const ex of getExercises()) for (const t of ex.topics) set.add(t);
  return [...set].sort();
}

export const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'interview'];
