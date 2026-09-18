import { useMemo, useState } from 'react';
import ExerciseCard from '../components/ExerciseCard';
import Logo from '../components/Logo';
import type { AppView } from '../lib/routes';
import { DIFFICULTIES } from '../lib/exercises';
import { getHistory, getProgress } from '../lib/progress';
import { useSession } from '../context/SessionContext';
import { useEntitlement } from '../context/EntitlementContext';
import { useLanguage } from '../context/LanguageContext';
import type { Difficulty, Exercise } from '../types/exercise';
import { getAchievements, getGoalSummary, getReviewQueue, getStreakSummary } from '../lib/learning';
import { homePitch } from '../lib/marketing-copy';

interface HomeProps {
  onSelectExercise: (id: string) => void;
  onNavigate?: (view: AppView) => void;
}

type DifficultyFilter = Difficulty | 'all';

function allTopicsFrom(list: Exercise[]): string[] {
  const set = new Set<string>();
  for (const ex of list) for (const t of ex.topics) set.add(t);
  return [...set].sort();
}

export default function Home({ onSelectExercise, onNavigate }: HomeProps) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [topic, setTopic] = useState<string>('all');
  const [query, setQuery] = useState('');
  const { scopeId, progressVersion } = useSession();
  const { remainingToday, isPro, interviewExercises, interviewPreviews } = useEntitlement();
  const { kit } = useLanguage();

  const catalog = useMemo<Exercise[]>(() => {
    const matchingPack = interviewExercises.filter((item) => item.id.startsWith(kit.interviewIdPrefix));
    if (matchingPack.length > 0) return [...kit.exercises, ...matchingPack];
    const matchingPreviews = interviewPreviews.filter((preview) => preview.id.startsWith(kit.interviewIdPrefix));
    const previews = matchingPreviews.length > 0 ? matchingPreviews : kit.interviewPreview;
    const stubs: Exercise[] = previews.map((preview) => ({
      id: preview.id,
      title: preview.title,
      description: preview.description,
      difficulty: 'interview',
      topics: preview.topics,
      sourceUrl: kit.interviewSourceUrl,
      sourceLabel: kit.interviewSourceLabel,
      estimatedTime: preview.estimatedTime,
      code: '',
      explanation: { overview: '', keyTerms: [], howItWorks: '', relatedExercises: [] },
      quiz: [{ question: '', options: ['a', 'b'], correctIndex: 0, explanation: '' }],
    }));
    return [...kit.exercises, ...stubs];
  }, [interviewExercises, interviewPreviews, kit]);
  const lockedIds = useMemo(() => {
    const matchingPack = interviewExercises.filter((item) => item.id.startsWith(kit.interviewIdPrefix));
    if (matchingPack.length > 0) return new Set<string>();
    return new Set(kit.interviewPreview.map((preview) => preview.id));
  }, [interviewExercises, kit]);
  const topics = useMemo(() => allTopicsFrom(catalog), [catalog]);
  const progress = useMemo(() => getProgress(scopeId), [scopeId, progressVersion]);
  const history = useMemo(() => getHistory(scopeId), [scopeId, progressVersion]);
  const completedIds = useMemo(() => new Set(Object.keys(progress)), [progress]);
  const reviewQueue = useMemo(() => getReviewQueue(catalog, progress, history), [progress, history, catalog]);
  const streak = useMemo(() => getStreakSummary(progress), [progress]);
  const goal = useMemo(() => getGoalSummary(progress), [progress]);
  const achievements = useMemo(() => getAchievements(progress, history), [progress, history]);
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;
  const pitch = homePitch(kit.languageName);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter(
      (ex) =>
        (difficulty === 'all' || ex.difficulty === difficulty) &&
        (topic === 'all' || ex.topics.includes(topic)) &&
        (!q || ex.title.toLowerCase().includes(q) || ex.description.toLowerCase().includes(q) || ex.topics.some((t) => t.toLowerCase().includes(q))),
    );
  }, [difficulty, topic, query, catalog]);

  const chip = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-100 ${
      active
        ? 'border-accent bg-[var(--color-accent-subtle)] text-accent'
        : 'border-border-tertiary text-content-secondary hover:border-border-secondary hover:bg-background-secondary'
    }`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Hero */}
      <header className="py-12 sm:py-20">
        <Logo size={36} wordmark={false} className="mb-6 text-content-primary" kit={kit} />
        <h1 className="text-3xl font-semibold tracking-tight text-content-primary sm:text-4xl">
          {kit.homeHeadline}
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-content-secondary">
          {kit.homeSubhead}
        </p>

        {/* Meta row */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-tertiary">
          <span>{catalog.length} exercises</span>
          <span aria-hidden="true" className="text-border-secondary">
            ·
          </span>
          <span>{topics.length} topics</span>
          <span aria-hidden="true" className="text-border-secondary">
            ·
          </span>
          <span>
            press{' '}
            <kbd className="rounded border border-border-tertiary bg-background-secondary px-1.5 py-0.5 font-mono text-content-secondary">
              ctrl/⌘ + k
            </kbd>{' '}
            for commands
          </span>
        </div>

        {onNavigate && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-content-tertiary">
              What&apos;s new in v1.0
            </p>
            <div className="flex flex-wrap gap-2">
              <FeatureChip label="Ghost race & ranks" onClick={() => onNavigate('race')} />
              <FeatureChip label="Friends & codes" onClick={() => onNavigate('friends')} />
              <FeatureChip label="Profile photos" onClick={() => onNavigate('settings')} />
              <FeatureChip label="Leaderboard" onClick={() => onNavigate('leaderboard')} />
              <FeatureChip label="Pomodoro timer" onClick={() => onNavigate('getting-started')} />
              <FeatureChip label={`${kit.productName} Pro`} onClick={() => onNavigate('pricing')} />
            </div>
          </div>
        )}

        {/* Stat pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          <StatPill label="Streak" value={`${streak.current}d`} />
          <StatPill label="Today" value={`${goal.completedToday} / ${goal.dailyGoal}`} />
          <StatPill
            label="Free left"
            value={isPro ? 'unlimited' : `${remainingToday}`}
          />
          <StatPill
            label="Achievements"
            value={`${unlockedAchievements} / ${achievements.length}`}
            highlight={unlockedAchievements > 0}
          />
        </div>
      </header>

      <section className="mb-10 max-w-2xl rounded-lg border border-border-tertiary bg-background-secondary p-5">
        <h2 className="text-base font-medium text-content-primary">{pitch.headline}</h2>
        {pitch.paragraphs.map((paragraph) => (
          <p key={paragraph} className="mt-3 text-sm leading-relaxed text-content-secondary">
            {paragraph}
          </p>
        ))}
        {!isPro && onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate('pricing')}
            className="mt-4 min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary"
          >
            See Pro
          </button>
        ) : null}
      </section>

      {/* Review queue */}
      {reviewQueue.length > 0 && (
        <section className="mb-10">
          <SectionLabel>Due for review</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reviewQueue.map((item) => (
              <button
                key={item.exercise.id}
                type="button"
                onClick={() => onSelectExercise(item.exercise.id)}
                className="group rounded-lg border border-border-tertiary bg-background-secondary p-4 text-left transition-all hover:border-accent/40 hover:bg-background-tertiary"
              >
                <div className="text-sm font-semibold text-content-primary group-hover:text-accent transition-colors">
                  {item.exercise.title}
                </div>
                <p className="mt-1 text-xs text-content-tertiary">{item.reason}</p>
                <p className="mt-2 text-xs font-medium text-accent">
                  {item.dueInDays === 0 ? 'Due now' : `Due in ${item.dueInDays}d`}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <label htmlFor="exercise-search" className="sr-only">
          Search exercises
        </label>
        <input
          id="exercise-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="w-full rounded-lg border border-border-tertiary bg-background-secondary px-4 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:border-accent focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-widest text-content-tertiary">
          Difficulty
        </span>
        <button type="button" className={chip(difficulty === 'all')} onClick={() => setDifficulty('all')}>
          All
        </button>
        {DIFFICULTIES.map((d) => (
          <button key={d} type="button" className={chip(difficulty === d)} onClick={() => setDifficulty(d)}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <div className="mb-10 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-widest text-content-tertiary">
          Topic
        </span>
        <button type="button" className={chip(topic === 'all')} onClick={() => setTopic('all')}>
          All
        </button>
        {topics.map((t) => (
          <button key={t} type="button" className={chip(topic === t)} onClick={() => setTopic(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Toolbar above grid */}
      <div className="mb-4 flex items-center gap-2">
        <a
          href="#site-footer"
          className="flex items-center gap-1.5 rounded-md border border-border-tertiary px-3 py-1.5 text-xs text-content-tertiary transition-colors hover:border-border-secondary hover:text-content-secondary"
        >
          <span aria-hidden="true">↓</span> Jump to footer
        </a>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectExercise(filtered[Math.floor(Math.random() * filtered.length)].id)}
            className="flex items-center gap-1.5 rounded-md border border-border-tertiary px-3 py-1.5 text-xs text-content-tertiary transition-colors hover:border-border-secondary hover:text-content-secondary"
          >
            <span aria-hidden="true">⚄</span> Random
          </button>
        )}
      </div>

      {/* Exercise grid */}
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-content-secondary">
          No exercises match{query ? ` "${query}"` : ' those filters'}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              completed={completedIds.has(ex.id)}
              locked={lockedIds.has(ex.id)}
              onSelect={onSelectExercise}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-tertiary">
      {children}
    </h2>
  );
}

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
        highlight
          ? 'bg-[var(--color-accent-subtle)] text-accent'
          : 'bg-background-secondary text-content-secondary'
      }`}
    >
      <span className="text-content-tertiary">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-accent' : 'text-content-primary'}`}>{value}</span>
    </span>
  );
}

function FeatureChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-accent/30 bg-[var(--color-accent-subtle)] px-3 py-1 text-xs font-medium text-accent transition-colors hover:border-accent hover:bg-background-secondary"
    >
      {label}
    </button>
  );
}
