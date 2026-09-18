import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('../storage', () => ({
  loadJSON: (_key: string, fallback: unknown) => store.get('playlists') ?? fallback,
  saveJSON: (_key: string, value: unknown) => {
    store.set('playlists', value);
    return true;
  },
}));

describe('playlists', () => {
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('crypto', { randomUUID: () => 'playlist-1' });
  });

  it('creates and toggles exercises', async () => {
    const { createPlaylist, loadPlaylists, togglePlaylistExercise } = await import('../playlists');
    const playlist = createPlaylist('Warmup');
    expect(playlist).not.toBeNull();
    expect(loadPlaylists()).toHaveLength(1);
    expect(togglePlaylistExercise(playlist!.id, 'ex-1')).toBe(true);
    expect(loadPlaylists()[0].exerciseIds).toEqual(['ex-1']);
  });
});
