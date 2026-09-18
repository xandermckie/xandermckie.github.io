import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Avatar from '../components/Avatar';
import ShareGhostModal from '../components/ShareGhostModal';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import { importFriendPayload } from '../lib/friend-codes';
import { getBestReplay, getFriendGhosts, removeFriendGhost } from '../lib/replays';
import { AVATAR_COLORS } from '../lib/auth';

interface FriendsProps {
  onShowLogin: () => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function Friends({ onShowLogin }: FriendsProps) {
  const { kit } = useLanguage();
  const exercises = kit.exercises;
  const { isGuest, displayName, avatarColor, avatarPhoto, scopeId, replayVersion, notifyReplayChange } =
    useSession();
  const [friendCode, setFriendCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState<string | null>(null);
  const [friendVersion, setFriendVersion] = useState(0);
  const [shareExerciseId, setShareExerciseId] = useState(exercises[0]?.id ?? '');
  const [shareOpen, setShareOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const friends = useMemo(() => getFriendGhosts(), [friendVersion, replayVersion]);

  const shareReplay = useMemo(() => {
    if (!shareExerciseId) return undefined;
    return getBestReplay(scopeId, shareExerciseId);
  }, [scopeId, shareExerciseId, replayVersion]);

  const bumpFriends = useCallback(() => {
    setFriendVersion((v) => v + 1);
    notifyReplayChange();
  }, [notifyReplayChange]);

  const handleAddCode = () => {
    setImportError(null);
    setImportOk(null);
    const result = importFriendPayload(friendCode);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportOk(`Added ${result.friend.displayName} (${result.replays.length} replay${result.replays.length === 1 ? '' : 's'}).`);
    setFriendCode('');
    bumpFriends();
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportOk(null);
    try {
      const result = importFriendPayload(await file.text());
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportOk(`Added ${result.friend.displayName}.`);
      bumpFriends();
    } catch {
      setImportError('Could not read that file.');
    }
  };

  const btnClass =
    'rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-secondary transition-colors hover:bg-background-secondary';

  return (
    <div className="mx-auto w-full max-w-2xl pb-12">
      <h1 className="mb-2 text-lg font-medium text-content-primary">Friends</h1>
      <p className="mb-8 text-sm text-content-secondary">
        Add offline ghost opponents with friend codes or JSON files. Paste a code from a friend
        or import their export. No server involved.
      </p>

      {!isGuest && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-content-secondary">Your share card</h2>
          <div className="rounded-lg border border-border-tertiary bg-background-secondary p-4">
            <div className="flex items-center gap-3">
              <Avatar name={displayName} color={avatarColor} photoUrl={avatarPhoto} size="md" />
              <div>
                <p className="font-medium text-content-primary">{displayName}</p>
                <p className="text-xs text-content-tertiary">Share a ghost for others to race</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-content-secondary">
                Exercise to share (your best replay)
                <select
                  value={shareExerciseId}
                  onChange={(e) => setShareExerciseId(e.target.value)}
                  className="rounded-md border border-border-tertiary bg-background-primary px-3 py-2 text-sm text-content-primary"
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!shareReplay}
                onClick={() => setShareOpen(true)}
                className="rounded-md border border-accent bg-[var(--color-accent-subtle)] px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary disabled:opacity-50"
              >
                Share ghost
              </button>
            </div>
            {!shareReplay && (
              <p className="mt-2 text-xs text-content-tertiary">
                No saved replay for this exercise yet. Complete a race or typing run first.
              </p>
            )}
          </div>
        </section>
      )}

      {isGuest && (
        <div className="mb-8 rounded-lg border border-border-tertiary bg-background-secondary p-4">
          <p className="text-sm text-content-secondary">
            Log in to share your own ghosts with a profile photo. You can still add friends below.
          </p>
          <button type="button" onClick={onShowLogin} className={`mt-3 ${btnClass} border-accent text-accent`}>
            Log in or create account
          </button>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-content-secondary">Add a friend</h2>
        <div className="rounded-lg border border-border-tertiary bg-background-secondary p-4">
          <label className="flex flex-col gap-1 text-xs text-content-secondary">
            Friend code
            <textarea
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              rows={3}
              placeholder="PYT1:…"
              className="resize-none rounded-md border border-border-tertiary bg-background-primary px-3 py-2 font-mono text-xs text-content-primary"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddCode}
              disabled={!friendCode.trim()}
              className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary disabled:opacity-50"
            >
              Add friend
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className={btnClass}>
              Import JSON file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onImportFile}
              className="hidden"
              aria-hidden="true"
            />
          </div>
          {importError && <p className="mt-3 text-sm text-error">{importError}</p>}
          {importOk && <p className="mt-3 text-sm text-success">{importOk}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-content-secondary">
          Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-content-tertiary">No friends yet. Paste a friend code above to get started.</p>
        ) : (
          <ul className="space-y-3">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border-tertiary bg-background-secondary p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={friend.displayName}
                    color={AVATAR_COLORS[0]}
                    photoUrl={friend.avatarPhoto}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-content-primary">{friend.displayName}</p>
                    <p className="text-xs text-content-tertiary">
                      {friend.replays.length} replay{friend.replays.length === 1 ? '' : 's'} · added{' '}
                      {formatWhen(friend.importedAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeFriendGhost(friend.id);
                    bumpFriends();
                  }}
                  className="shrink-0 rounded-md border border-error px-3 py-1.5 text-xs text-error hover:bg-background-tertiary"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shareReplay && (
        <ShareGhostModal
          open={shareOpen}
          displayName={displayName}
          replay={shareReplay}
          avatarPhoto={avatarPhoto}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
