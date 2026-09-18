import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TypingInput from '../components/TypingInput';
import QuizPanel from '../components/QuizPanel';
import BreakdownPanel from '../components/BreakdownPanel';
import ResultsPanel from '../components/ResultsPanel';
import CodePeekPanel from '../components/CodePeekPanel';
import { EXERCISES, getExerciseById as getBundledExercise } from '../lib/exercises';
import { getAttempts, getHistory, getProgress, recordCompletion } from '../lib/progress';
import type { AttemptSummary } from '../lib/progress';
import { buildReplay, getBestReplay, saveReplay } from '../lib/replays';
import { useSession } from '../context/SessionContext';
import { useSettings } from '../context/SettingsContext';
import { useEntitlement } from '../context/EntitlementContext';
import type { UpgradeReason } from '../context/EntitlementContext';
import type { ReplayEvent } from '../types/replay';
import type { QuizScore, TypingStats } from '../types/exercise';
import { getRecommendedExerciseId } from '../lib/learning';

interface TypingPageProps {
  exerciseId: string;
  onExit: () => void;
  onSelectExercise: (id: string) => void;
  onStartRace?: (exerciseId: string, source: import('../types/replay').GhostSource) => void;
  /** Bubble typing-focus up so the app shell can fade its chrome (zen mode). */
  onFocusChange?: (focused: boolean) => void;
  onUpgradeNeeded?: (reason: UpgradeReason) => void;
}

type Phase = 'typing' | 'results' | 'quiz' | 'breakdown';
type TypingMode = 'guided' | 'challenge';

function buildChallengePrompt(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^(def|class)\s/.test(trimmed)) return `${indent}${trimmed}`;
      if (/^(if|elif|else|for|while|try|except|finally|with)\b/.test(trimmed)) return `${indent}${trimmed}`;
      if (/^(import|from)\s/.test(trimmed)) return `${indent}${trimmed}`;
      if (trimmed.startsWith('@')) return `${indent}${trimmed}`;
      return `${indent}...`;
    })
    .join('\n');
}

/**
 * Drives a single exercise: type → results → quiz → breakdown. Progress is
 * saved (per active profile) once the quiz completes. The parent keys this
 * component on exerciseId, so picking a new exercise remounts it fresh.
 */
export default function TypingPage({
  exerciseId,
  onExit,
  onSelectExercise,
  onStartRace,
  onFocusChange,
  onUpgradeNeeded,
}: TypingPageProps) {
  const { interviewExercises, consumeCompletion } = useEntitlement();
  const getExerciseById = (id: string) =>
    getBundledExercise(id) ?? interviewExercises.find((item) => item.id === id);
  const exercise = getExerciseById(exerciseId);
  const { scopeId, displayName, notifyProgressChange, notifyReplayChange } = useSession();
  const { settings } = useSettings();
  const lastReplayEventsRef = useRef<ReplayEvent[]>([]);
  const [phase, setPhase] = useState<Phase>('typing');
  const [typingStats, setTypingStats] = useState<TypingStats | null>(null);
  // The most recent prior attempt, captured when typing finishes so the
  // results screen can show round-to-round improvement.
  const [previous, setPrevious] = useState<AttemptSummary | null>(null);
  // Bumped to force a fresh TypingInput when the user restarts the snippet.
  const [restartKey, setRestartKey] = useState(0);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [typingMode, setTypingMode] = useState<TypingMode>('guided');
  const [hintOpen, setHintOpen] = useState(false);
  const [savedReplayId, setSavedReplayId] = useState<string | null>(null);

  const challengePrompt = useMemo(
    () => (exercise ? buildChallengePrompt(exercise.code) : ''),
    [exercise],
  );

  const related = useMemo(() => {
    if (!exercise) return [];
    return exercise.explanation.relatedExercises
      .map(getExerciseById)
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
  }, [exercise]);
  const recommendedExerciseId = useMemo(() => {
    if (!exercise) return null;
    return getRecommendedExerciseId(exercise.id, related, [...EXERCISES, ...interviewExercises], getProgress(scopeId), getHistory(scopeId));
  }, [exercise, related, scopeId, phase, interviewExercises]);

  // Whenever we leave the typing phase, make sure the chrome is visible again.
  useEffect(() => {
    if (phase !== 'typing') onFocusChange?.(false);
  }, [phase, onFocusChange]);

  const handleReplayReady = useCallback((events: ReplayEvent[]) => {
    lastReplayEventsRef.current = events;
  }, []);

  const handleTypingComplete = useCallback(
    (stats: TypingStats) => {
      if (!exercise) return;
      if (settings.recordReplays && lastReplayEventsRef.current.length > 0) {
        const replay = buildReplay({
          exerciseId: exercise.id,
          code: exercise.code,
          playerName: displayName,
          events: lastReplayEventsRef.current,
          wpm: stats.wpm,
          accuracy: stats.accuracy,
        });
        saveReplay(scopeId, replay);
        notifyReplayChange();
        setSavedReplayId(replay.id);
      }
      // Snapshot the prior attempt BEFORE the new one is recorded (after the
      // quiz), so the results screen compares against the right baseline.
      const attempts = getAttempts(scopeId, exercise.id);
      setPrevious(attempts.length ? attempts[attempts.length - 1] : null);
      setTypingStats(stats);
      setPhase('results');
    },
    [scopeId, exercise, displayName, settings.recordReplays, notifyReplayChange],
  );

  const handleRaceThisRun = useCallback(() => {
    if (!exercise || !onStartRace) return;
    const replayId = savedReplayId ?? getBestReplay(scopeId, exercise.id)?.id;
    if (!replayId) return;
    onStartRace(exercise.id, { kind: 'self', profileId: scopeId, replayId });
  }, [exercise, onStartRace, savedReplayId, scopeId]);

  const handleRestart = useCallback(() => {
    lastReplayEventsRef.current = [];
    setTypingStats(null);
    setRestartKey((k) => k + 1);
    setPhase('typing');
  }, []);

  const handleQuizComplete = useCallback(
    (score: QuizScore) => {
      if (exercise && typingStats) {
        const { saved } = recordCompletion(scopeId, {
          exerciseId: exercise.id,
          accuracy: typingStats.accuracy,
          wpm: typingStats.wpm,
          errors: typingStats.errors,
          quizCorrect: score.correct,
          quizTotal: score.total,
        });
        if (saved) {
          setSaveWarning(null);
          notifyProgressChange();
        } else {
          setSaveWarning('Your progress could not be saved. Storage may be full or disabled.');
        }
        void consumeCompletion(exercise.id).then((result) => {
          if (!result.allowed) {
            setSaveWarning(result.error ?? 'Daily free limit reached.');
            onUpgradeNeeded?.('cap');
          }
        });
      }
      setPhase('breakdown');
    },
    [scopeId, exercise, notifyProgressChange, typingStats, consumeCompletion, onUpgradeNeeded],
  );

  if (!exercise) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-content-secondary">That exercise could not be found.</p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-primary hover:bg-background-secondary"
        >
          Back to exercises
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto mb-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-medium text-content-primary">{exercise.title}</h1>
          <p className="text-sm text-content-tertiary">
            {exercise.difficulty} · {exercise.sourceLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTypingMode((mode) => (mode === 'guided' ? 'challenge' : 'guided'));
            }}
            aria-pressed={typingMode === 'challenge'}
            aria-label={`Exercise mode: ${typingMode === 'guided' ? 'Guided' : 'Challenge'}. Click to switch.`}
            className="rounded-md border border-border-tertiary px-3 py-1.5 text-sm text-content-secondary hover:bg-background-secondary"
          >
            <span className="sm:hidden">{typingMode === 'guided' ? 'Guided' : 'Challenge'}</span>
            <span className="hidden sm:inline">
              Mode: {typingMode === 'guided' ? 'Guided' : 'Challenge'}
            </span>
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-border-tertiary px-3 py-1.5 text-sm text-content-secondary hover:bg-background-secondary"
          >
            Exit
          </button>
        </div>
      </div>

      {phase === 'typing' && (
        <>
          {typingMode === 'challenge' && (
            <div className="mx-auto mb-4 max-w-3xl">
              <CodePeekPanel
                open={hintOpen}
                onToggle={() => setHintOpen((o) => !o)}
                openLabel="Hide hint"
                closedLabel="Show hint"
              >
                <div className="rounded-lg border border-border-tertiary bg-background-secondary p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-content-secondary">
                    {challengePrompt}
                  </pre>
                </div>
              </CodePeekPanel>
            </div>
          )}
          <TypingInput
            key={`${exercise.id}:${restartKey}`}
            code={exercise.code}
            obscurePending={typingMode === 'challenge'}
            accessibleCodeHint={typingMode === 'challenge' ? challengePrompt : undefined}
            recordReplay={settings.recordReplays}
            onReplayReady={handleReplayReady}
            onComplete={handleTypingComplete}
            onQuit={onExit}
            onRestart={handleRestart}
            onFocusChange={onFocusChange}
          />
        </>
      )}

      {phase === 'results' && typingStats && (
        <ResultsPanel
          stats={typingStats}
          previous={previous}
          onRestart={handleRestart}
          onContinue={() => setPhase('quiz')}
          onRace={onStartRace ? handleRaceThisRun : undefined}
          showRaceButton={settings.recordReplays && Boolean(savedReplayId ?? getBestReplay(scopeId, exercise.id))}
        />
      )}

      {phase === 'quiz' && (
        <QuizPanel
          exerciseId={exercise.id}
          code={exercise.code}
          questions={exercise.quiz}
          onComplete={handleQuizComplete}
        />
      )}

      {phase === 'breakdown' && (
        <>
          {saveWarning && (
            <p className="mx-auto mb-4 max-w-3xl rounded-md border border-error/40 bg-background-secondary px-4 py-3 text-sm text-error">
              {saveWarning}
            </p>
          )}
          <BreakdownPanel
            exercise={exercise}
            related={related}
            onSelectExercise={onSelectExercise}
            onNext={onExit}
            recommendedExerciseId={recommendedExerciseId}
          />
        </>
      )}
    </div>
  );
}
