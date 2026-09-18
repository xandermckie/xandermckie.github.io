import { memo } from 'react';
import type { Difficulty, Exercise } from '../types/exercise';

interface ExerciseCardProps {
  exercise: Exercise;
  completed: boolean;
  locked?: boolean;
  onSelect: (id: string) => void;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { color: string; dot: string }> = {
  beginner: {
    color: 'text-success bg-success/8',
    dot: 'bg-success',
  },
  intermediate: {
    color: 'text-warning bg-warning/8',
    dot: 'bg-warning',
  },
  advanced: {
    color: 'text-error bg-error/8',
    dot: 'bg-error',
  },
  interview: {
    color: 'text-accent bg-[var(--color-accent-subtle)]',
    dot: 'bg-accent',
  },
};

function ExerciseCard({ exercise, completed, locked = false, onSelect }: ExerciseCardProps) {
  const diff = DIFFICULTY_CONFIG[exercise.difficulty];

  return (
    <button
      type="button"
      onClick={() => onSelect(exercise.id)}
      aria-label={
        locked
          ? `Pro interview exercise, locked: ${exercise.title}`
          : `Start exercise: ${exercise.title}`
      }
      className="group flex h-full min-h-[11rem] flex-col rounded-lg border border-border-tertiary bg-background-secondary p-5 text-left transition-all duration-150 hover:border-border-secondary hover:bg-background-tertiary hover:shadow-[var(--shadow-sm)]"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-content-primary group-hover:text-accent transition-colors duration-150">
          {exercise.title}
        </h3>
        {completed && !locked && (
          <span
            className="mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-success/15 text-success"
            aria-label="Completed"
            title="Completed"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-2 flex-1 text-sm leading-relaxed text-content-secondary">
        {exercise.description}
      </p>

      {/* Footer: difficulty + topics + time */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium ${diff.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${diff.dot}`} aria-hidden="true" />
          {exercise.difficulty}
        </span>
        {locked && (
          <span className="rounded-md border border-accent/40 px-2 py-0.5 font-medium text-accent">Pro</span>
        )}
        {exercise.topics.slice(0, 3).map((topic) => (
          <span
            key={topic}
            className="rounded-md bg-background-primary border border-border-tertiary px-2 py-0.5 text-content-tertiary"
          >
            {topic}
          </span>
        ))}
        <span className="ml-auto text-content-tertiary">~{exercise.estimatedTime} min</span>
      </div>
    </button>
  );
}

export default memo(ExerciseCard);
