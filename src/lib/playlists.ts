import { loadJSON, saveJSON } from './storage';
import { isObject, isString } from './validation';

export interface Playlist {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: string;
}

const PLAYLISTS_KEY = 'playlists';
const MAX_PLAYLISTS = 20;
const MAX_NAME = 40;
const MAX_ITEMS = 50;

function isPlaylist(raw: unknown): raw is Playlist {
  if (!isObject(raw)) return false;
  if (!isString(raw.id) || !isString(raw.name) || !isString(raw.createdAt)) return false;
  if (!Array.isArray(raw.exerciseIds) || raw.exerciseIds.length > MAX_ITEMS) return false;
  return raw.exerciseIds.every((id) => isString(id));
}

export function validatePlaylists(raw: unknown): Playlist[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPlaylist).slice(0, MAX_PLAYLISTS);
}

export function loadPlaylists(): Playlist[] {
  return validatePlaylists(loadJSON<unknown>(PLAYLISTS_KEY, []));
}

export function savePlaylists(playlists: Playlist[]): boolean {
  return saveJSON(PLAYLISTS_KEY, validatePlaylists(playlists));
}

export function createPlaylist(name: string, exerciseIds: string[] = []): Playlist | null {
  const trimmed = name.trim().slice(0, MAX_NAME);
  if (trimmed.length < 1) return null;
  const current = loadPlaylists();
  if (current.length >= MAX_PLAYLISTS) return null;
  const playlist: Playlist = {
    id: crypto.randomUUID(),
    name: trimmed,
    exerciseIds: exerciseIds.slice(0, MAX_ITEMS),
    createdAt: new Date().toISOString(),
  };
  if (!savePlaylists([...current, playlist])) return null;
  return playlist;
}

export function updatePlaylist(id: string, patch: Partial<Pick<Playlist, 'name' | 'exerciseIds'>>): boolean {
  const current = loadPlaylists();
  const idx = current.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  const next = { ...current[idx] };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim().slice(0, MAX_NAME);
    if (trimmed.length < 1) return false;
    next.name = trimmed;
  }
  if (patch.exerciseIds) next.exerciseIds = patch.exerciseIds.slice(0, MAX_ITEMS);
  const updated = [...current];
  updated[idx] = next;
  return savePlaylists(updated);
}

export function deletePlaylist(id: string): boolean {
  return savePlaylists(loadPlaylists().filter((p) => p.id !== id));
}

export function togglePlaylistExercise(playlistId: string, exerciseId: string): boolean {
  const current = loadPlaylists();
  const playlist = current.find((p) => p.id === playlistId);
  if (!playlist) return false;
  const has = playlist.exerciseIds.includes(exerciseId);
  const exerciseIds = has
    ? playlist.exerciseIds.filter((id) => id !== exerciseId)
    : [...playlist.exerciseIds, exerciseId].slice(0, MAX_ITEMS);
  return updatePlaylist(playlistId, { exerciseIds });
}
