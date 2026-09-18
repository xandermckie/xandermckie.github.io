/**
 * Tiny typed wrapper around Web Storage. All persistence goes through here so
 * reads/writes fail soft (private mode / quota / SSR). A `store` can be passed
 * to target sessionStorage (ephemeral, used for guest progress) instead of the
 * default localStorage (durable, used for accounts + settings).
 *
 * `shared` keys (accounts, settings, guest cap) always use `pytyping:` so a
 * language switch never wipes login or billing state. `lang` keys use the
 * active kit prefix (`pytyping:` / `rustease:`).
 */
import { SHARED_STORAGE_PREFIX } from '../languages/meta';
import { currentMeta } from './catalog';

export type StorageScope = 'lang' | 'shared';

function resolve(store?: Storage): Storage | null {
  try {
    return store ?? window.localStorage;
  } catch {
    return null;
  }
}

function prefixFor(scope: StorageScope): string {
  return scope === 'shared' ? SHARED_STORAGE_PREFIX : currentMeta().storagePrefix;
}

export function loadJSON<T>(key: string, fallback: T, store?: Storage, scope: StorageScope = 'lang'): T {
  return loadJSONAt(prefixFor(scope), key, fallback, store);
}

export function loadJSONAt<T>(prefix: string, key: string, fallback: T, store?: Storage): T {
  const s = resolve(store);
  if (!s) return fallback;
  try {
    const raw = s.getItem(prefix + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Like loadJSON, but runs the parsed value through a validator. Anything the
 * validator rejects (corrupted or tampered storage) collapses to the fallback.
 */
export function loadValidated<T>(
  key: string,
  validate: (raw: unknown) => T,
  store?: Storage,
  scope: StorageScope = 'lang',
): T {
  return loadValidatedAt(prefixFor(scope), key, validate, store);
}

export function loadValidatedAt<T>(
  prefix: string,
  key: string,
  validate: (raw: unknown) => T,
  store?: Storage,
): T {
  const s = resolve(store);
  try {
    const raw = s ? s.getItem(prefix + key) : null;
    if (raw == null) return validate(undefined);
    return validate(JSON.parse(raw));
  } catch {
    return validate(undefined);
  }
}

/** `false` when storage is unavailable, quota is exceeded, or serialization fails. */
export function saveJSON<T>(key: string, value: T, store?: Storage, scope: StorageScope = 'lang'): boolean {
  return saveJSONAt(prefixFor(scope), key, value, store);
}

export function saveJSONAt<T>(prefix: string, key: string, value: T, store?: Storage): boolean {
  const s = resolve(store);
  if (!s) return false;
  try {
    s.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[PyTyping] saveJSON failed:', key, err);
    return false;
  }
}

export function removeKey(key: string, store?: Storage, scope: StorageScope = 'lang'): void {
  removeKeyAt(prefixFor(scope), key, store);
}

export function removeKeyAt(prefix: string, key: string, store?: Storage): void {
  const s = resolve(store);
  if (!s) return;
  try {
    s.removeItem(prefix + key);
  } catch {
    /* no-op */
  }
}
