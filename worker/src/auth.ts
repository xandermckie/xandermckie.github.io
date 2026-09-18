import type { Env, EntitlementRow, UserRow } from './env';
import { randomToken, sha256Hex } from './crypto';
import { utcDayStart } from './http';

const SESSION_COOKIE = 'pytyping_session';
const THIRTY_DAYS_S = 60 * 60 * 24 * 30;

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${THIRTY_DAYS_S}${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)pytyping_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .bind(email.toLowerCase())
    .first<UserRow>();
}

export async function getUserById(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').bind(id).first<UserRow>();
}

export async function upsertUser(env: Env, email: string): Promise<UserRow> {
  const existing = await getUserByEmail(env, email);
  if (existing) return existing;
  const user: UserRow = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    display_name: email.split('@')[0] ?? 'Learner',
    bio: null,
    polar_customer_id: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
    locked_at: null,
    locked_reason: null,
  };
  await env.DB.prepare(
    'INSERT INTO users (id, email, display_name, bio, polar_customer_id, created_at) VALUES (?, ?, ?, NULL, NULL, ?)',
  )
    .bind(user.id, user.email, user.display_name, user.created_at)
    .run();
  await env.DB.prepare(
    'INSERT INTO entitlements (user_id, plan, status, updated_at) VALUES (?, ?, ?, ?)',
  )
    .bind(user.id, 'free', 'none', user.created_at)
    .run();
  return user;
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  const expires = new Date(Date.now() + THIRTY_DAYS_S * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(hash, userId, expires)
    .run();
  return token;
}

export async function userFromRequest(env: Env, request: Request): Promise<UserRow | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL AND u.locked_at IS NULL`,
  )
    .bind(hash, new Date().toISOString())
    .first<UserRow>();
  return row ?? null;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  const hash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
}

export async function getEntitlement(env: Env, userId: string): Promise<EntitlementRow> {
  const row = await env.DB.prepare('SELECT * FROM entitlements WHERE user_id = ?')
    .bind(userId)
    .first<EntitlementRow>();
  if (row) return row;
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO entitlements (user_id, plan, status, updated_at) VALUES (?, ?, ?, ?)',
  )
    .bind(userId, 'free', 'none', now)
    .run();
  return {
    user_id: userId,
    plan: 'free',
    status: 'none',
    polar_subscription_id: null,
    current_period_end: null,
    updated_at: now,
  };
}

export async function setPro(
  env: Env,
  userId: string,
  input: { subscriptionId?: string | null; periodEnd?: string | null; status: string },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO entitlements (user_id, plan, status, polar_subscription_id, current_period_end, updated_at)
     VALUES (?, 'pro', ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       plan = 'pro', status = excluded.status,
       polar_subscription_id = excluded.polar_subscription_id,
       current_period_end = excluded.current_period_end,
       updated_at = excluded.updated_at`,
  )
    .bind(userId, input.status, input.subscriptionId ?? null, input.periodEnd ?? null, new Date().toISOString())
    .run();
}

export async function setFree(env: Env, userId: string, status = 'revoked'): Promise<void> {
  await env.DB.prepare(
    `UPDATE entitlements SET plan = 'free', status = ?, updated_at = ? WHERE user_id = ?`,
  )
    .bind(status, new Date().toISOString(), userId)
    .run();
}

export async function completionsToday(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM completions WHERE user_id = ? AND completed_at >= ?',
  )
    .bind(userId, utcDayStart())
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function addCompletion(env: Env, userId: string, exerciseId: string): Promise<void> {
  await env.DB.prepare('INSERT INTO completions (user_id, exercise_id, completed_at) VALUES (?, ?, ?)')
    .bind(userId, exerciseId, new Date().toISOString())
    .run();
}

export async function sendMagicLinkEmail(
  env: Env,
  to: string,
  link: string,
): Promise<{ sent: boolean }> {
  if (!env.RESEND_API_KEY || !env.MAGIC_FROM_EMAIL) return { sent: false };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAGIC_FROM_EMAIL,
      to: [to],
      subject: 'Your PyTyping sign-in link',
      text: `Sign in to PyTyping (valid 15 minutes):\n\n${link}\n\nIf you did not request this, ignore the email.`,
    }),
  });
  return { sent: response.ok };
}
