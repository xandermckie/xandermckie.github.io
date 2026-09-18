import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FREE_DAILY_CAP } from '../legal';

const store = new Map<string, unknown>();

vi.mock('../storage', () => ({
  loadJSON: (_key: string, fallback: unknown) => store.get('guest-completions') ?? fallback,
  saveJSON: (_key: string, value: unknown) => {
    store.set('guest-completions', value);
    return true;
  },
}));

describe('guest daily cap', () => {
  beforeEach(() => {
    store.clear();
  });

  it('starts full and decrements', async () => {
    const { getGuestRemainingToday, recordGuestCompletion } = await import('../guest-cap');
    expect(getGuestRemainingToday()).toBe(FREE_DAILY_CAP);
    expect(recordGuestCompletion().allowed).toBe(true);
    expect(getGuestRemainingToday()).toBe(FREE_DAILY_CAP - 1);
  });

  it('blocks after the cap', async () => {
    const { canGuestStartExercise, recordGuestCompletion } = await import('../guest-cap');
    for (let i = 0; i < FREE_DAILY_CAP; i++) recordGuestCompletion();
    expect(canGuestStartExercise()).toBe(false);
    expect(recordGuestCompletion().allowed).toBe(false);
  });
});
