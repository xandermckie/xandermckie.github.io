/**
 * Loads the embedded exercise catalogue. exercises.json is imported (not
 * fetched) so it is bundled at build time — the core loop is fully offline.
 */
import data from '../data/exercises.json';
import type { Difficulty, Exercise } from '../types/exercise';
import { validateExercises } from './validation';

// Validate at module load. Even though this JSON is bundled (trusted), a single
// malformed entry from a future edit can't take the whole app down — bad
// entries are dropped, not rendered.
export const EXERCISES: Exercise[] = validateExercises(data);

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/** Unique topic tags across the catalogue, alphabetized. */
export function allTopics(): string[] {
  const set = new Set<string>();
  for (const ex of EXERCISES) for (const t of ex.topics) set.add(t);
  return [...set].sort();
}

export const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'interview'];
