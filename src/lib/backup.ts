/**
 * Validated backup export/import + full data wipe. The backup is the portable,
 * durable form of a user's data (since there's no server): export it to a file,
 * import it on another device. Everything is re-validated on import — never
 * trusted — before being written to storage.
 */
import {
  clearAccountsAndSession,
  getSession,
  loadAccounts,
  saveAccounts,
  setSession,
  validateAccounts,
} from './auth';
import type { Account, Session } from './auth';
import {
  clearProgress,
  getHistory,
  getProgress,
  setHistory,
  setProgress,
  validateHistoryMap,
  validateProgressMap,
} from './progress';
import type { HistoryMap, ProgressMap } from './progress';
import {
  clearAllReplays,
  exportReplayStore,
  getFriendGhosts,
  importReplayStore,
  saveFriendGhosts,
  validateTypingReplay,
} from './replays';
import type { ReplayStore } from './replays';
import {
  clearRaceRank,
  getRaceRankState,
  importRaceRankState,
  validateRaceRankState,
} from './race-rank';
import type { RaceRankState } from './race-rank';
import { SETTINGS_KEY, validateSettings } from './settings';
import type { Settings } from './settings';
import { loadValidated, removeKey, saveJSON } from './storage';
import { isObject, isString } from './validation';
import { validateAvatarPhotoDataUrl } from './profile-photo';
import type { FriendGhost } from '../types/replay';
import { LANGUAGE_METAS } from '../languages/meta';
import { currentMeta, getLanguageId, setLanguageId } from './catalog';
import { POMODORO_KEY } from './pomodoro';

/** Maximum backup file size accepted on import (2 MB). */
export const BACKUP_MAX_BYTES = 2 * 1024 * 1024;

const SUPPORTED_BACKUP_VERSION = 3;
const LEGACY_BACKUP_VERSIONS = [2, 3] as const;

interface BackupV3 {
  app: string;
  version: 3;
  exportedAt: string;
  accounts: Account[];
  session: Session;
  progress: Record<string, ProgressMap>;
  history: Record<string, HistoryMap>;
  settings: Settings;
  replays: Record<string, ReplayStore>;
  friendGhosts: FriendGhost[];
  raceRanks: Record<string, RaceRankState>;
}

function validateReplayStoreMap(raw: unknown): Record<string, ReplayStore> {
  if (!isObject(raw)) return {};
  const out: Record<string, ReplayStore> = {};
  for (const [profileId, store] of Object.entries(raw)) {
    if (!isObject(store)) continue;
    const validated: ReplayStore = {};
    for (const [exerciseId, list] of Object.entries(store)) {
      if (!Array.isArray(list)) continue;
      const replays = list.map(validateTypingReplay).filter((r) => r !== null);
      if (replays.length) validated[exerciseId] = replays;
    }
    if (Object.keys(validated).length) out[profileId] = validated;
  }
  return out;
}

function validateFriendGhostsList(raw: unknown): FriendGhost[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!isObject(item) || !isString(item.id) || !isString(item.displayName)) return null;
      if (!Array.isArray(item.replays)) return null;
      const replays = item.replays.map(validateTypingReplay).filter((r) => r !== null);
      if (replays.length === 0) return null;
      const photo = validateAvatarPhotoDataUrl(item.avatarPhoto) ?? undefined;
      return {
        id: item.id,
        displayName: item.displayName,
        importedAt: isString(item.importedAt) ? item.importedAt : new Date().toISOString(),
        ...(photo ? { avatarPhoto: photo } : {}),
        replays,
      } satisfies FriendGhost;
    })
    .filter((f): f is FriendGhost => f !== null);
}

function validateRaceRankMap(raw: unknown): Record<string, RaceRankState> {
  if (!isObject(raw)) return {};
  const out: Record<string, RaceRankState> = {};
  for (const [profileId, state] of Object.entries(raw)) {
    out[profileId] = validateRaceRankState(state);
  }
  return out;
}

export function exportBackup(): string {
  const accounts = loadAccounts();
  const progress: Record<string, ProgressMap> = {};
  const history: Record<string, HistoryMap> = {};
  const replays: Record<string, ReplayStore> = {};
  const raceRanks: Record<string, RaceRankState> = {};
  for (const a of accounts) {
    progress[a.id] = getProgress(a.id);
    history[a.id] = getHistory(a.id);
    replays[a.id] = exportReplayStore(a.id);
    raceRanks[a.id] = getRaceRankState(a.id);
  }
  const backup: BackupV3 = {
    app: currentMeta().backupApp,
    version: 3,
    exportedAt: new Date().toISOString(),
    accounts,
    session: getSession(),
    progress,
    history,
    settings: loadValidated(SETTINGS_KEY, validateSettings, undefined, 'shared'),
    replays,
    friendGhosts: getFriendGhosts(),
    raceRanks,
  };
  return JSON.stringify(backup, null, 2);
}

export type ImportResult = { ok: true } | { ok: false; error: string };

export function importBackup(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!isObject(parsed) || parsed.app !== currentMeta().backupApp) {
    return { ok: false, error: `This does not look like a ${currentMeta().productName} backup.` };
  }
  const version = parsed.version;
  if (version !== undefined && !LEGACY_BACKUP_VERSIONS.includes(version as 2 | 3)) {
    return { ok: false, error: `Unsupported backup version (expected ${SUPPORTED_BACKUP_VERSION}).` };
  }

  const accounts = validateAccounts(parsed.accounts);
  const ids = new Set(accounts.map((a) => a.id));
  const rawProgress = isObject(parsed.progress) ? parsed.progress : {};
  const rawHistory = isObject(parsed.history) ? parsed.history : {};
  const settings = validateSettings(parsed.settings);
  const rawReplays = version === 3 ? validateReplayStoreMap(parsed.replays) : {};
  const friendGhosts = version === 3 ? validateFriendGhostsList(parsed.friendGhosts) : [];
  const rawRaceRanks = version === 3 ? validateRaceRankMap(parsed.raceRanks) : {};

  for (const existing of loadAccounts()) {
    if (!ids.has(existing.id)) {
      clearProgress(existing.id);
      clearRaceRank(existing.id);
    }
  }

  if (!saveAccounts(accounts)) {
    return { ok: false, error: 'Could not save imported accounts. Storage may be full or disabled.' };
  }
  if (!saveJSON(SETTINGS_KEY, settings, undefined, 'shared')) {
    return { ok: false, error: 'Could not save imported settings. Storage may be full or disabled.' };
  }
  for (const a of accounts) {
    if (!setProgress(a.id, validateProgressMap((rawProgress as Record<string, unknown>)[a.id]))) {
      return { ok: false, error: 'Could not save imported progress. Storage may be full or disabled.' };
    }
    if (!setHistory(a.id, validateHistoryMap((rawHistory as Record<string, unknown>)[a.id]))) {
      return { ok: false, error: 'Could not save imported history. Storage may be full or disabled.' };
    }
    if (rawReplays[a.id] && !importReplayStore(a.id, rawReplays[a.id])) {
      return { ok: false, error: 'Could not save imported replays. Storage may be full or disabled.' };
    }
    if (rawRaceRanks[a.id]) {
      if (!importRaceRankState(a.id, rawRaceRanks[a.id])) {
        return { ok: false, error: 'Could not save imported race ranks. Storage may be full or disabled.' };
      }
    }
  }

  if (version === 3 && !saveFriendGhosts(friendGhosts)) {
    return { ok: false, error: 'Could not save imported friend ghosts. Storage may be full or disabled.' };
  }

  const session = parsed.session;
  if (isObject(session) && session.kind === 'account' && isString(session.accountId) && ids.has(session.accountId)) {
    if (!setSession({ kind: 'account', accountId: session.accountId })) {
      return { ok: false, error: 'Import succeeded but session could not be saved. Reload and log in again.' };
    }
  } else if (!setSession({ kind: 'guest' })) {
    return { ok: false, error: 'Import succeeded but session could not be saved. Reload the page.' };
  }
  return { ok: true };
}

/** Wipe shared account data plus every language edition's local progress. */
export function clearAllData(): void {
  const accounts = loadAccounts();
  const previous = getLanguageId();
  try {
    for (const meta of LANGUAGE_METAS) {
      setLanguageId(meta.id);
      clearProgress('guest');
      clearAllReplays(accounts.map((a) => a.id));
      clearRaceRank('guest');
      for (const a of accounts) clearRaceRank(a.id);
      removeKey('friend-ghosts');
      removeKey('playlists');
    }
  } finally {
    setLanguageId(previous);
  }
  clearAccountsAndSession();
  removeKey(SETTINGS_KEY, undefined, 'shared');
  removeKey(POMODORO_KEY, undefined, 'shared');
  removeKey('guest-completions', undefined, 'shared');
}
