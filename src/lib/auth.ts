/**
 * Local accounts + session. There is NO backend: accounts live in localStorage
 * on this device. We still never store a plaintext password — each account
 * keeps a random salt and a PBKDF2-SHA-256 hash (with a weaker non-crypto
 * fallback only if Web Crypto is unavailable). This is device-local security,
 * not a cloud account; cross-device sync would require a server (use the backup
 * export/import to move data manually).
 */
import { loadJSON, loadValidated, removeKey, saveJSON } from './storage';
import { clearProgress } from './progress';
import { validateAvatarPhotoDataUrl } from './profile-photo';
import {
  AVATAR_COLORS,
  isObject,
  isString,
  isValidAccountHash,
  isValidAccountId,
  isValidHexString,
  pickAvatarColorFromUsername,
  sanitizeAvatarColor,
} from './validation';

export { AVATAR_COLORS };

export interface Account {
  id: string;
  username: string;
  /** Hex salt. */
  salt: string;
  /** Hex PBKDF2 hash of the password. */
  hash: string;
  createdAt: string;
  avatarColor: string;
  /** Optional JPEG/PNG/WebP data URL stored locally. */
  avatarPhoto?: string;
}

export type Session = { kind: 'guest' } | { kind: 'account'; accountId: string };

const ACCOUNTS_KEY = 'accounts';
const SESSION_KEY = 'session';
const PBKDF2_ITERATIONS = 100_000;

export const USERNAME_RULES = '3–20 chars: letters, numbers, and . _ -';
export const PASSWORD_MIN = 4;

/* -------------------------------- helpers --------------------------------- */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytesToHex(bytes);
}

/** Degraded fallback hash for environments without Web Crypto (still salted). */
function weakHash(password: string, saltHex: string): string {
  let h = 0x811c9dc5;
  const data = saltHex + password;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Stretch a little so it isn't a single pass.
  let acc = (h >>> 0).toString(16);
  for (let r = 0; r < 1000; r++) {
    let g = 0x811c9dc5;
    const s = acc + saltHex;
    for (let i = 0; i < s.length; i++) {
      g ^= s.charCodeAt(i);
      g = Math.imul(g, 0x01000193);
    }
    acc = (g >>> 0).toString(16);
  }
  return `weak$${acc}`;
}

async function deriveHash(password: string, saltHex: string): Promise<string> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) return weakHash(password, saltHex);
  try {
    const enc = new TextEncoder();
    // Casts to BufferSource keep us compatible with the stricter typed-array
    // generics introduced in recent TypeScript lib versions.
    const passwordBytes = enc.encode(password) as BufferSource;
    const salt = hexToBytes(saltHex) as BufferSource;
    const keyMaterial = await subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256,
    );
    return bytesToHex(new Uint8Array(bits));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[PyTyping] Web Crypto failed, using fallback hash:', err);
    return weakHash(password, saltHex);
  }
}

/** Constant-time-ish string compare to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ----------------------------- username/account --------------------------- */

export function sanitizeUsername(raw: string): string {
  let cleaned = '';
  for (const ch of raw) {
    if (/[A-Za-z0-9_.-]/.test(ch)) cleaned += ch;
  }
  return cleaned.slice(0, 20);
}

function validateAccount(raw: unknown): Account | null {
  if (!isObject(raw)) return null;
  const { id, username, salt, hash, createdAt, avatarColor } = raw;
  if (!isString(username) || !isString(salt) || !isString(hash)) return null;
  if (!isValidAccountId(id)) return null;
  if (!isValidHexString(salt, 16)) return null;
  if (!isValidAccountHash(hash)) return null;

  const cleanedUsername = sanitizeUsername(username);
  if (cleanedUsername.length < 3) return null;

  const fallbackColor = pickAvatarColorFromUsername(cleanedUsername);
  const photo = validateAvatarPhotoDataUrl(raw.avatarPhoto) ?? undefined;
  return {
    id,
    username: cleanedUsername,
    salt,
    hash,
    createdAt: isString(createdAt) ? createdAt : new Date().toISOString(),
    avatarColor: sanitizeAvatarColor(avatarColor, fallbackColor),
    ...(photo ? { avatarPhoto: photo } : {}),
  };
}

export function validateAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Account[] = [];
  for (const item of raw) {
    const acc = validateAccount(item);
    if (acc && !seen.has(acc.id)) {
      seen.add(acc.id);
      out.push(acc);
    }
  }
  return out;
}

export function loadAccounts(): Account[] {
  return loadValidated(ACCOUNTS_KEY, validateAccounts, undefined, 'shared');
}

export function saveAccounts(accounts: Account[]): boolean {
  return saveJSON(ACCOUNTS_KEY, accounts, undefined, 'shared');
}

const STORAGE_SAVE_ERROR =
  'Could not save to browser storage. It may be full, disabled, or in private mode.';

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `a_${randomHex(8)}`;
}

export type AuthResult = { ok: true; account: Account } | { ok: false; error: string };

export async function createAccount(rawUsername: string, password: string): Promise<AuthResult> {
  const username = sanitizeUsername(rawUsername);
  if (username.length < 3) return { ok: false, error: `Username must be ${USERNAME_RULES}.` };
  if (password.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters.` };
  const accounts = loadAccounts();
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: 'That username is already taken on this device.' };
  }
  const salt = randomHex(16);
  const hash = await deriveHash(password, salt);
  const account: Account = {
    id: uid(),
    username,
    salt,
    hash,
    createdAt: new Date().toISOString(),
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  };
  if (!saveAccounts([...accounts, account])) {
    return { ok: false, error: STORAGE_SAVE_ERROR };
  }
  return { ok: true, account };
}

export async function verifyLogin(rawUsername: string, password: string): Promise<AuthResult> {
  const username = sanitizeUsername(rawUsername);
  const account = loadAccounts().find((a) => a.username.toLowerCase() === username.toLowerCase());
  if (!account) return { ok: false, error: 'No account with that username on this device.' };
  const hash = await deriveHash(password, account.salt);
  if (!safeEqual(hash, account.hash)) return { ok: false, error: 'Incorrect password.' };
  return { ok: true, account };
}

export function setAccountAvatarPhoto(accountId: string, photo: string | null): boolean {
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) return false;
  const validated = photo ? validateAvatarPhotoDataUrl(photo) : null;
  if (photo && !validated) return false;
  const next = { ...accounts[idx] };
  if (validated) next.avatarPhoto = validated;
  else delete next.avatarPhoto;
  const updated = [...accounts];
  updated[idx] = next;
  return saveAccounts(updated);
}

export function deleteAccount(id: string): Account[] {
  clearProgress(id);
  const accounts = loadAccounts().filter((a) => a.id !== id);
  saveAccounts(accounts);
  if (getSession().kind === 'account' && (getSession() as { accountId: string }).accountId === id) {
    setSession({ kind: 'guest' });
  }
  return accounts;
}

/* --------------------------------- session -------------------------------- */

export function getSession(): Session {
  const raw = loadJSON<unknown>(SESSION_KEY, { kind: 'guest' }, undefined, 'shared');
  if (isObject(raw) && raw.kind === 'account' && isString(raw.accountId)) {
    return { kind: 'account', accountId: raw.accountId };
  }
  return { kind: 'guest' };
}

export function setSession(session: Session): boolean {
  return saveJSON(SESSION_KEY, session, undefined, 'shared');
}

export function clearAccountsAndSession(): void {
  for (const a of loadAccounts()) clearProgress(a.id);
  removeKey(ACCOUNTS_KEY, undefined, 'shared');
  removeKey(SESSION_KEY, undefined, 'shared');
}
