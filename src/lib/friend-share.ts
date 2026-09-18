import { currentMeta } from './catalog';
import { validateAvatarPhotoDataUrl } from './profile-photo';
import {
  getFriendGhosts,
  importFriendGhostBundle,
  REPLAY_MAX_BYTES,
  saveFriendGhosts,
  validateTypingReplay,
} from './replays';
import { isObject, isString } from './validation';
import type { FriendGhost, FriendShareBundle, TypingReplay } from '../types/replay';

export const FRIEND_SHARE_MAX_BYTES = REPLAY_MAX_BYTES;

function newFriendId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `friend-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeFriendName(name: string): string {
  return name.trim().toLowerCase();
}

function mergeFriendReplays(existing: TypingReplay[], incoming: TypingReplay[]): TypingReplay[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const replay of incoming) byId.set(replay.id, replay);
  return [...byId.values()];
}

export function buildFriendShareBundle(
  displayName: string,
  replays: TypingReplay[],
  avatarPhoto?: string | null,
): FriendShareBundle | null {
  const cleanReplays = replays.map(validateTypingReplay).filter((r): r is TypingReplay => r !== null);
  if (cleanReplays.length === 0) return null;
  const name = displayName.trim() || cleanReplays[0].playerName;
  const photo = avatarPhoto ? validateAvatarPhotoDataUrl(avatarPhoto) : null;
  return {
    app: currentMeta().friendShareApp,
    version: 1,
    displayName: name,
    ...(photo ? { avatarPhoto: photo } : {}),
    replays: cleanReplays,
  };
}

export function validateFriendShareBundle(raw: unknown): FriendShareBundle | null {
  if (!isObject(raw)) return null;
  if (raw.app !== currentMeta().friendShareApp || raw.version !== 1) return null;
  if (!isString(raw.displayName) || !Array.isArray(raw.replays)) return null;
  const replays = raw.replays.map(validateTypingReplay).filter((r): r is TypingReplay => r !== null);
  if (replays.length === 0) return null;
  const photo = validateAvatarPhotoDataUrl(raw.avatarPhoto) ?? undefined;
  return {
    app: currentMeta().friendShareApp,
    version: 1,
    displayName: raw.displayName.trim() || replays[0].playerName,
    ...(photo ? { avatarPhoto: photo } : {}),
    replays,
  };
}

export function exportFriendShareJson(bundle: FriendShareBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export type ImportFriendShareResult =
  | { ok: true; friend: FriendGhost; replays: TypingReplay[] }
  | { ok: false; error: string };

export function importFriendShareBundle(bundle: FriendShareBundle): ImportFriendShareResult {
  const name = bundle.displayName.trim() || bundle.replays[0].playerName;
  const normalized = normalizeFriendName(name);
  const friends = getFriendGhosts();
  const existing = friends.find((f) => normalizeFriendName(f.displayName) === normalized);
  const photo = bundle.avatarPhoto;

  let friend: FriendGhost;
  if (existing) {
    friend = {
      ...existing,
      replays: mergeFriendReplays(existing.replays, bundle.replays),
      ...(photo ? { avatarPhoto: photo } : {}),
    };
    if (!saveFriendGhosts(friends.map((f) => (f.id === existing.id ? friend : f)))) {
      return { ok: false, error: 'Could not save imported friend.' };
    }
  } else {
    friend = {
      id: newFriendId(),
      displayName: name,
      importedAt: new Date().toISOString(),
      replays: bundle.replays,
      ...(photo ? { avatarPhoto: photo } : {}),
    };
    if (!saveFriendGhosts([...friends, friend])) {
      return { ok: false, error: 'Could not save imported friend.' };
    }
  }
  return { ok: true, friend, replays: bundle.replays };
}

export function importFriendShareJson(text: string): ImportFriendShareResult {
  if (text.length > FRIEND_SHARE_MAX_BYTES) {
    return { ok: false, error: 'Friend file is too large (max 100 KB).' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  const bundle = validateFriendShareBundle(parsed);
  if (bundle) return importFriendShareBundle(bundle);

  // Legacy single-replay ghost format
  const legacy = importFriendGhostBundle(text, '');
  if (!legacy.ok) return { ok: false, error: legacy.error };
  if (!legacy.friend) return { ok: false, error: 'Could not import friend ghost.' };
  return { ok: true, friend: legacy.friend, replays: [legacy.replay] };
}

export function downloadFriendShareJson(bundle: FriendShareBundle): void {
  const blob = new Blob([exportFriendShareJson(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = bundle.displayName.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'friend';
  a.href = url;
  a.download = `pytyping-friend-${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
