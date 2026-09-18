import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../components/Avatar';
import RankBadge from '../components/RankBadge';
import ShareGhostModal from '../components/ShareGhostModal';
import { DIFFICULTIES, allTopics, getExerciseById } from '../lib/exercises';
import { importFriendPayload } from '../lib/friend-codes';
import { getNextRank, getRaceRankState } from '../lib/race-rank';
import {
  BUILTIN_TIERS,
  buildSyntheticReplay,
  tierLabel,
  tierWpmForExercise,
} from '../lib/synthetic-ghosts';
import {
  deleteReplay,
  exportGhostReplay,
  getBestReplay,
  getFriendGhosts,
  getReplays,
  removeFriendGhost,
} from '../lib/replays';
import { AVATAR_COLORS } from '../lib/auth';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import type { Difficulty } from '../types/exercise';
import type { FriendGhost, GhostSource, SyntheticGhostTier, TypingReplay } from '../types/replay';

interface RaceLobbyProps {
  onStartRace: (exerciseId: string, source: GhostSource) => void;
  onManageFriends?: () => void;
}

type DifficultyFilter = Difficulty | 'all';

interface GhostOption {
  key: string;
  label: string;
  group: string;
  replay: TypingReplay;
  source: GhostSource;
  wpm: number;
  friend?: FriendGhost;
}

function builtinKey(tier: SyntheticGhostTier, exerciseId: string): string {
  return `builtin:${tier}:${exerciseId}`;
}

function defaultGhostKey(scopeId: string, exerciseId: string): string {
  const best = getBestReplay(scopeId, exerciseId);
  if (best) return `self:${best.id}`;
  return builtinKey('easy', exerciseId);
}

export default function RaceLobby({ onStartRace, onManageFriends }: RaceLobbyProps) {
  const { kit } = useLanguage();
  const exercises = kit.exercises;
  const { scopeId, displayName, avatarColor, avatarPhoto, accounts, replayVersion, notifyReplayChange } =
    useSession();
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [topic, setTopic] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '');
  const [ghostKey, setGhostKey] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [friendVersion, setFriendVersion] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rankState = useMemo(() => getRaceRankState(scopeId), [scopeId, replayVersion]);
  const nextRank = useMemo(() => getNextRank(rankState.peakRaceWpm), [rankState.peakRaceWpm]);

  const topics = useMemo(() => allTopics(), [kit.id]);
  const friends = useMemo(() => getFriendGhosts(), [friendVersion, replayVersion]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (ex) =>
        (difficulty === 'all' || ex.difficulty === difficulty) &&
        (topic === 'all' || ex.topics.includes(topic)) &&
        (!q ||
          ex.title.toLowerCase().includes(q) ||
          ex.description.toLowerCase().includes(q) ||
          ex.topics.some((t) => t.toLowerCase().includes(q))),
    );
  }, [difficulty, topic, query, exercises]);

  const ghostOptions = useMemo((): GhostOption[] => {
    if (!exerciseId) return [];
    const exercise = getExerciseById(exerciseId);
    const len = exercise?.code.length ?? 0;
    const options: GhostOption[] = [];

    for (const tier of BUILTIN_TIERS) {
      const replay = buildSyntheticReplay(exerciseId, len, tier);
      const wpmLabel = tier === 'creator' ? '102' : String(tierWpmForExercise(exerciseId, tier));
      const accLabel = tier === 'creator' ? '97%' : `${replay.accuracy}%`;
      options.push({
        key: builtinKey(tier, exerciseId),
        group: 'Built-in opponents',
        label: `${tierLabel(tier)}, ${wpmLabel} wpm · ${accLabel} acc`,
        replay,
        source: { kind: 'builtin', tier, exerciseId },
        wpm: replay.wpm,
      });
    }

    for (const replay of getReplays(scopeId, exerciseId)) {
      options.push({
        key: `self:${replay.id}`,
        group: 'My ghosts',
        label: `${displayName}, ${replay.wpm} wpm (${formatWhen(replay.recordedAt)})`,
        replay,
        source: { kind: 'self', profileId: scopeId, replayId: replay.id },
        wpm: replay.wpm,
      });
    }

    for (const account of accounts) {
      if (account.id === scopeId) continue;
      for (const replay of getReplays(account.id, exerciseId)) {
        options.push({
          key: `account:${account.id}:${replay.id}`,
          group: 'Local accounts',
          label: `${account.username}, ${replay.wpm} wpm`,
          replay,
          source: { kind: 'account', profileId: account.id, replayId: replay.id },
          wpm: replay.wpm,
        });
      }
    }

    for (const friend of friends) {
      for (const replay of friend.replays.filter((r) => r.exerciseId === exerciseId)) {
        options.push({
          key: `friend:${friend.id}:${replay.id}`,
          group: 'Friends',
          label: `${friend.displayName}, ${replay.wpm} wpm`,
          replay,
          source: { kind: 'friend', friendId: friend.id, replayId: replay.id },
          wpm: replay.wpm,
          friend,
        });
      }
    }

    return options;
  }, [exerciseId, scopeId, displayName, accounts, friends, replayVersion]);

  const groups = useMemo(() => {
    const order = ['Built-in opponents', 'My ghosts', 'Local accounts', 'Friends'];
    const map = new Map<string, GhostOption[]>();
    for (const g of order) map.set(g, []);
    for (const opt of ghostOptions) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return order
      .map((name) => ({ name, options: map.get(name) ?? [] }))
      .filter((g) => g.options.length > 0);
  }, [ghostOptions]);

  useEffect(() => {
    if (!exerciseId) return;
    const key = defaultGhostKey(scopeId, exerciseId);
    const exists = ghostOptions.some((g) => g.key === key);
    setGhostKey(exists ? key : ghostOptions[0]?.key ?? '');
  }, [exerciseId, scopeId, replayVersion, ghostOptions]);

  const selectedGhost = ghostOptions.find((g) => g.key === ghostKey) ?? ghostOptions[0];

  const handleQuickImport = useCallback(
    async (file: File) => {
      setImportError(null);
      try {
        const result = importFriendPayload(await file.text());
        if (!result.ok) {
          setImportError(result.error);
          return;
        }
        const replay = result.replays[0];
        if (replay && replay.exerciseId === exerciseId) {
          setGhostKey(`friend:${result.friend.id}:${replay.id}`);
        }
        setFriendVersion((v) => v + 1);
        notifyReplayChange();
      } catch {
        setImportError('Could not read that file.');
      }
    },
    [exerciseId, notifyReplayChange],
  );

  const handleExport = useCallback(() => {
    if (!selectedGhost || selectedGhost.source.kind === 'builtin') return;
    const blob = new Blob([exportGhostReplay(selectedGhost.replay)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pytyping-ghost-${selectedGhost.replay.exerciseId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedGhost]);

  const handleDeleteReplay = useCallback(() => {
    if (!selectedGhost || selectedGhost.source.kind !== 'self') return;
    deleteReplay(scopeId, exerciseId, selectedGhost.source.replayId);
    notifyReplayChange();
    setGhostKey(defaultGhostKey(scopeId, exerciseId));
  }, [selectedGhost, scopeId, exerciseId, notifyReplayChange]);

  const chip = (active: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-100 ${
      active
        ? 'border-accent bg-[var(--color-accent-subtle)] text-accent'
        : 'border-border-tertiary text-content-secondary hover:border-border-secondary hover:bg-background-secondary'
    }`;

  const exercise = getExerciseById(exerciseId);

  const selectedFriend = selectedGhost?.friend;
  let selectedAccountForAvatar: { name: string; color: string; photo?: string } | null = null;
  if (selectedGhost?.source.kind === 'self') {
    selectedAccountForAvatar = { name: displayName, color: avatarColor, photo: avatarPhoto };
  } else if (selectedGhost?.source.kind === 'account') {
    const source = selectedGhost.source;
    const acc = accounts.find((a) => a.id === source.profileId);
    if (acc) selectedAccountForAvatar = { name: acc.username, color: acc.avatarColor, photo: acc.avatarPhoto };
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-content-primary">Ghost race</h1>
          <RankBadge wpm={rankState.peakRaceWpm} showWpm />
        </div>
        {nextRank && (
          <p className="mt-2 text-sm text-content-tertiary">
            {nextRank.wpmNeeded} more wpm to reach {nextRank.label}
          </p>
        )}
        <p className="mt-3 max-w-2xl text-base text-content-secondary">
          Race built-in opponents, your past runs, or imported friend ghosts. Complete the snippet before
          the ghost caret reaches the end.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-content-tertiary">
          Pick exercise
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {(['all', ...DIFFICULTIES] as DifficultyFilter[]).map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)} className={chip(difficulty === d)}>
              {d === 'all' ? 'All levels' : d}
            </button>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setTopic('all')} className={chip(topic === 'all')}>
            All topics
          </button>
          {topics.map((t) => (
            <button key={t} type="button" onClick={() => setTopic(t)} className={chip(topic === t)}>
              {t}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="mb-4 w-full rounded-md border border-border-tertiary bg-background-secondary px-3 py-2 text-sm text-content-primary"
        />
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="w-full rounded-md border border-border-tertiary bg-background-secondary px-3 py-2 text-sm text-content-primary"
        >
          {filtered.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title} ({ex.difficulty})
            </option>
          ))}
        </select>
        {exercise && <p className="mt-2 text-sm text-content-tertiary">{exercise.description}</p>}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-content-tertiary">
          Pick opponent ghost
        </h2>
        <select
          value={selectedGhost?.key ?? ''}
          onChange={(e) => setGhostKey(e.target.value)}
          className="w-full rounded-md border border-border-tertiary bg-background-secondary px-3 py-2 text-sm text-content-primary"
        >
          {groups.map((group) => (
            <optgroup key={group.name} label={group.name}>
              {group.options.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selectedGhost && (selectedFriend || selectedAccountForAvatar) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-content-secondary">
            {selectedFriend ? (
              <>
                <Avatar
                  name={selectedFriend.displayName}
                  color={AVATAR_COLORS[0]}
                  photoUrl={selectedFriend.avatarPhoto}
                />
                <span>{selectedFriend.displayName}</span>
              </>
            ) : selectedAccountForAvatar ? (
              <>
                <Avatar
                  name={selectedAccountForAvatar.name}
                  color={selectedAccountForAvatar.color}
                  photoUrl={selectedAccountForAvatar.photo}
                />
                <span>{selectedAccountForAvatar.name}</span>
              </>
            ) : null}
          </div>
        )}
        {selectedGhost && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedGhost.source.kind === 'self' && (
              <>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="rounded-md border border-accent bg-[var(--color-accent-subtle)] px-3 py-1.5 text-xs font-medium text-accent hover:bg-background-secondary"
                >
                  Share ghost
                </button>
                <button
                  type="button"
                  onClick={handleDeleteReplay}
                  className="rounded-md border border-error px-3 py-1.5 text-xs text-error hover:bg-background-secondary"
                >
                  Delete replay
                </button>
              </>
            )}
            {selectedGhost.source.kind !== 'builtin' && selectedGhost.source.kind !== 'self' && (
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md border border-border-tertiary px-3 py-1.5 text-xs text-content-secondary hover:bg-background-secondary"
              >
                Export JSON
              </button>
            )}
            {selectedGhost.source.kind === 'friend' && (
              <button
                type="button"
                onClick={() => {
                  const friendId =
                    selectedGhost.source.kind === 'friend' ? selectedGhost.source.friendId : '';
                  if (friendId) removeFriendGhost(friendId);
                  setGhostKey(defaultGhostKey(scopeId, exerciseId));
                  setFriendVersion((v) => v + 1);
                  notifyReplayChange();
                }}
                className="rounded-md border border-error px-3 py-1.5 text-xs text-error hover:bg-background-secondary"
              >
                Remove friend
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mb-10 rounded-lg border border-border-tertiary bg-background-secondary p-5">
        <h2 className="text-sm font-medium text-content-primary">Friends</h2>
        <p className="mt-1 text-sm text-content-tertiary">
          Add friends with a friend code or JSON file on the{' '}
          {onManageFriends ? (
            <button type="button" onClick={onManageFriends} className="text-accent hover:underline">
              Friends page
            </button>
          ) : (
            'Friends page'
          )}
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {onManageFriends && (
            <button
              type="button"
              onClick={onManageFriends}
              className="rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-primary hover:bg-background-tertiary"
            >
              Manage friends
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleQuickImport(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-secondary hover:bg-background-tertiary"
          >
            Quick import file…
          </button>
        </div>
        {importError && <p className="mt-2 text-sm text-error">{importError}</p>}
      </section>

      <button
        type="button"
        disabled={!selectedGhost || !exercise}
        onClick={() => {
          if (selectedGhost) onStartRace(exerciseId, selectedGhost.source);
        }}
        className="rounded-md border border-accent bg-[var(--color-accent-subtle)] px-6 py-3 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Start race
      </button>

      {selectedGhost?.source.kind === 'self' && (
        <ShareGhostModal
          open={shareOpen}
          displayName={displayName}
          replay={selectedGhost.replay}
          avatarPhoto={avatarPhoto}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return 'saved run';
  }
}
