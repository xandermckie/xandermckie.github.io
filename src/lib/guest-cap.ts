import { FREE_DAILY_CAP } from './legal';
import { loadJSON, saveJSON } from './storage';

const GUEST_CAP_KEY = 'guest-completions';

interface GuestCapState {
  day: string;
  count: number;
}

function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function emptyState(now: Date = new Date()): GuestCapState {
  return { day: utcDayKey(now), count: 0 };
}

function readState(now: Date = new Date()): GuestCapState {
  const raw = loadJSON<unknown>(GUEST_CAP_KEY, emptyState(now));
  if (
    raw &&
    typeof raw === 'object' &&
    'day' in raw &&
    'count' in raw &&
    typeof raw.day === 'string' &&
    typeof raw.count === 'number'
  ) {
    if (raw.day !== utcDayKey(now)) return emptyState(now);
    return { day: raw.day, count: Math.max(0, Math.floor(raw.count)) };
  }
  return emptyState(now);
}

export function getGuestCompletionsToday(now: Date = new Date()): number {
  return readState(now).count;
}

export function getGuestRemainingToday(now: Date = new Date()): number {
  return Math.max(0, FREE_DAILY_CAP - getGuestCompletionsToday(now));
}

export function recordGuestCompletion(now: Date = new Date()): { remaining: number; allowed: boolean } {
  const state = readState(now);
  if (state.count >= FREE_DAILY_CAP) {
    return { remaining: 0, allowed: false };
  }
  const next: GuestCapState = { day: utcDayKey(now), count: state.count + 1 };
  saveJSON(GUEST_CAP_KEY, next);
  return { remaining: Math.max(0, FREE_DAILY_CAP - next.count), allowed: true };
}

export function canGuestStartExercise(now: Date = new Date()): boolean {
  return getGuestRemainingToday(now) > 0;
}
