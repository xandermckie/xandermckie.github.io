/**
 * Runtime type guards and validators. Everything that crosses a trust boundary
 * — bundled JSON (could be edited badly), localStorage (could be corrupted or
 * tampered with), and imported backup/theme files (fully user-supplied) — is
 * validated here before the app trusts it. Validators never throw: they return
 * a cleaned value or a safe fallback, so bad data degrades instead of crashing.
 */
import type { Difficulty, Exercise, QuizQuestion } from '../types/exercise';

/* ------------------------------- primitives ------------------------------- */

export function isString(v: unknown): v is string {
  return typeof v === 'string';
}
export function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

/** Strict hex color (#rgb or #rrggbb). The only color shape we ever apply. */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function isValidHexColor(v: unknown): v is string {
  return isString(v) && HEX_RE.test(v);
}
/** Return v if it's a valid hex color, otherwise the fallback. Blocks any
 *  attempt to inject arbitrary CSS through a color field. */
export function sanitizeHexColor(v: unknown, fallback: string): string {
  return isValidHexColor(v) ? v : fallback;
}

/** Allowed avatar palette — must stay in sync with account creation in auth.ts. */
export const AVATAR_COLORS = ['#1d9e75', '#e2b714', '#7aa2f7', '#e24b4a', '#c792ea', '#88b04b', '#e0af68'] as const;

/** Pick a stable palette color from a username (used when sanitizing imported accounts). */
export function pickAvatarColorFromUsername(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Accept only palette colors or valid hex; blocks arbitrary CSS in inline styles. */
export function sanitizeAvatarColor(v: unknown, fallback: string): string {
  if (isString(v) && (AVATAR_COLORS as readonly string[]).includes(v)) return v;
  return sanitizeHexColor(v, fallback);
}

const HEX_STRING_RE = /^[0-9a-fA-F]+$/;

/** Validate a hex-encoded byte string with an exact character length (2 chars per byte). */
export function isValidHexString(v: unknown, byteLength: number): boolean {
  const expected = byteLength * 2;
  return isString(v) && v.length === expected && HEX_STRING_RE.test(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_ID_RE = /^a_[0-9a-f]{16}$/i;

export function isValidAccountId(v: unknown): v is string {
  return isString(v) && (UUID_RE.test(v) || LEGACY_ID_RE.test(v));
}

const WEAK_HASH_RE = /^weak\$[0-9a-f]+$/i;

/** PBKDF2-SHA-256 (64 hex chars) or legacy weak-hash prefix. */
export function isValidAccountHash(v: unknown): boolean {
  if (!isString(v)) return false;
  if (isValidHexString(v, 32)) return true;
  return WEAK_HASH_RE.test(v);
}

export function clampNumber(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const HTTPS_URL_RE = /^https:\/\/[^\s]+$/i;

/** Reject javascript:, data:, and other non-HTTPS schemes. */
export function isHttpsUrl(v: unknown): v is string {
  if (!isString(v) || !HTTPS_URL_RE.test(v)) return false;
  const lower = v.toLowerCase();
  return !lower.includes('javascript:') && !lower.startsWith('data:');
}

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'interview'] as const;
function isDifficulty(v: unknown): v is Difficulty {
  return isString(v) && (DIFFICULTIES as readonly string[]).includes(v);
}

/* ------------------------------- exercises -------------------------------- */

function validateQuestion(raw: unknown): QuizQuestion | null {
  if (!isObject(raw)) return null;
  const { question, options, correctIndex, explanation } = raw;
  if (!isString(question) || !isStringArray(options) || options.length < 2) return null;
  if (!isNumber(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
  if (!isString(explanation)) return null;
  return { question, options, correctIndex, explanation };
}

/** Validate a single exercise; returns null if it's malformed (and gets skipped). */
export function validateExercise(raw: unknown): Exercise | null {
  if (!isObject(raw)) return null;
  const { id, title, description, difficulty, topics, sourceUrl, sourceLabel, estimatedTime, code, explanation, quiz } = raw;

  if (!isString(id) || !isString(title) || !isString(description)) return null;
  if (!isDifficulty(difficulty) || !isStringArray(topics)) return null;
  if (!isHttpsUrl(sourceUrl) || !isString(sourceLabel) || !isNumber(estimatedTime)) return null;
  if (!isString(code) || code.length === 0) return null;
  if (!isObject(explanation)) return null;

  const { overview, keyTerms, howItWorks, designPattern, relatedExercises } = explanation;
  if (!isString(overview) || !isString(howItWorks)) return null;
  if (!Array.isArray(keyTerms)) return null;
  const cleanTerms = keyTerms
    .filter((t): t is { term: string; definition: string } => isObject(t) && isString(t.term) && isString(t.definition))
    .map((t) => ({ term: t.term, definition: t.definition }));

  if (!Array.isArray(quiz)) return null;
  const cleanQuiz = quiz.map(validateQuestion).filter((q): q is QuizQuestion => q !== null);
  if (cleanQuiz.length === 0) return null;

  if (import.meta.env.DEV) {
    for (const q of cleanQuiz) {
      const lens = q.options.map((o) => o.length);
      const max = Math.max(...lens);
      const correctLen = q.options[q.correctIndex].length;
      const longestCount = lens.filter((l) => l === max).length;
      if (correctLen === max && longestCount === 1) {
        console.warn(`[PyTyping] Quiz "${id}": correct answer is uniquely longest`);
      }
    }
  }

  return {
    id,
    title,
    description,
    difficulty,
    topics,
    sourceUrl,
    sourceLabel,
    estimatedTime,
    code,
    explanation: {
      overview,
      keyTerms: cleanTerms,
      howItWorks,
      designPattern: isString(designPattern) ? designPattern : undefined,
      relatedExercises: isStringArray(relatedExercises) ? relatedExercises : [],
    },
    quiz: cleanQuiz,
  };
}

/** Validate the whole catalogue, dropping (and warning about) bad entries. */
export function validateExercises(raw: unknown): Exercise[] {
  if (!Array.isArray(raw)) return [];
  const out: Exercise[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const ex = validateExercise(item);
    if (!ex) {
      if (import.meta.env.DEV) console.warn('[PyTyping] Skipping malformed exercise:', item);
      continue;
    }
    if (seen.has(ex.id)) {
      if (import.meta.env.DEV) console.warn('[PyTyping] Skipping duplicate exercise id:', ex.id);
      continue;
    }
    seen.add(ex.id);
    out.push(ex);
  }
  return out;
}
