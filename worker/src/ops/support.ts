import type { Env } from '../env';
import { getEntitlement, getUserByEmail, getUserById, sendMagicLinkEmail } from '../auth';
import { isEmail, utcDayStart } from '../http';
import { randomToken, sha256Hex } from '../crypto';
import { lockUser, revokeUserSessions, unlockUser } from './lock';
import { writeAudit } from './audit';
import { verifyStepUpTotp } from './auth';

const MAGIC_TTL_MS = 15 * 60 * 1000;
const PII_KEYS = [
  'email',
  'display_name',
  'displayName',
  'bio',
  'polar_customer_id',
  'polarCustomerId',
  'settings_json',
  'playlists_json',
  'avatarPhoto',
  'name',
] as const;

export interface RedactedAccount {
  found: true;
  userId: string;
  createdAt: string;
  plan: 'free' | 'pro';
  entitlementStatus: string;
  billingLinked: boolean;
  lockedAt: string | null;
  lockedReason: string | null;
  sessionCount: number;
  lastSessionAt: string | null;
  completionsToday: number;
  completionsAllTime: number;
  pendingMagicLinks: number;
}

export interface LookupMiss {
  found: false;
}

export type LookupResult = RedactedAccount | LookupMiss;

function assertNoPii(payload: Record<string, unknown>): void {
  for (const key of PII_KEYS) {
    if (key in payload) {
      throw new Error(`Refusing to serialize ${key}.`);
    }
  }
}

export async function lookupRedactedAccount(
  env: Env,
  input: { userId?: string; email?: string },
): Promise<LookupResult> {
  const user = input.userId
    ? await getUserById(env, input.userId)
    : input.email && isEmail(input.email)
      ? await getUserByEmail(env, input.email.trim().toLowerCase())
      : null;
  if (!user) return { found: false };

  const entitlement = await getEntitlement(env, user.id);
  const now = new Date().toISOString();
  const sessions = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM sessions WHERE user_id = ? AND expires_at > ?',
  )
    .bind(user.id, now)
    .first<{ n: number }>();
  const lastSession = await env.DB.prepare(
    'SELECT expires_at FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1',
  )
    .bind(user.id)
    .first<{ expires_at: string }>();
  const completionsToday = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM completions WHERE user_id = ? AND completed_at >= ?',
  )
    .bind(user.id, utcDayStart())
    .first<{ n: number }>();
  const completionsAllTime = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM completions WHERE user_id = ?',
  )
    .bind(user.id)
    .first<{ n: number }>();
  const pendingMagicLinks = await env.DB.prepare(
    'SELECT COUNT(*) as n FROM magic_links WHERE email = ? AND expires_at > ?',
  )
    .bind(user.email, now)
    .first<{ n: number }>();

  const payload: RedactedAccount = {
    found: true,
    userId: user.id,
    createdAt: user.created_at,
    plan: entitlement.plan,
    entitlementStatus: entitlement.status,
    billingLinked: Boolean(user.polar_customer_id),
    lockedAt: user.locked_at,
    lockedReason: user.locked_reason,
    sessionCount: sessions?.n ?? 0,
    lastSessionAt: lastSession?.expires_at ?? null,
    completionsToday: completionsToday?.n ?? 0,
    completionsAllTime: completionsAllTime?.n ?? 0,
    pendingMagicLinks: pendingMagicLinks?.n ?? 0,
  };
  assertNoPii(payload as unknown as Record<string, unknown>);
  return payload;
}

export async function requireStepUpTotp(env: Env, totp: unknown): Promise<boolean> {
  if (typeof totp !== 'string') return false;
  return verifyStepUpTotp(env, totp);
}

export async function supportRevokeSessions(
  env: Env,
  request: Request,
  userId: string,
): Promise<boolean> {
  const user = await getUserById(env, userId);
  if (!user) return false;
  await revokeUserSessions(env, userId);
  await writeAudit(env, request, { action: 'revoke_sessions', targetUserId: userId });
  return true;
}

export async function supportResetCap(
  env: Env,
  request: Request,
  userId: string,
): Promise<boolean> {
  const user = await getUserById(env, userId);
  if (!user) return false;
  await env.DB.prepare('DELETE FROM completions WHERE user_id = ? AND completed_at >= ?')
    .bind(userId, utcDayStart())
    .run();
  await writeAudit(env, request, { action: 'reset_cap', targetUserId: userId });
  return true;
}

export async function supportLock(
  env: Env,
  request: Request,
  userId: string,
  totp: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireStepUpTotp(env, totp))) return { ok: false, error: 'step-up' };
  const user = await getUserById(env, userId);
  if (!user) return { ok: false, error: 'not-found' };
  await lockUser(env, userId, 'admin');
  await writeAudit(env, request, { action: 'lock', targetUserId: userId });
  return { ok: true };
}

export async function supportUnlock(
  env: Env,
  request: Request,
  userId: string,
  totp: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireStepUpTotp(env, totp))) return { ok: false, error: 'step-up' };
  const user = await getUserById(env, userId);
  if (!user) return { ok: false, error: 'not-found' };
  await unlockUser(env, userId);
  await writeAudit(env, request, { action: 'unlock', targetUserId: userId });
  return { ok: true };
}

export async function supportResendMagicLink(
  env: Env,
  request: Request,
  userId: string,
  totp: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireStepUpTotp(env, totp))) return { ok: false, error: 'step-up' };
  const user = await getUserById(env, userId);
  if (!user) return { ok: false, error: 'not-found' };
  if (user.locked_at) return { ok: false, error: 'locked' };
  const token = randomToken();
  const hash = await sha256Hex(token);
  const expires = new Date(Date.now() + MAGIC_TTL_MS).toISOString();
  await env.DB.prepare('INSERT INTO magic_links (token_hash, email, expires_at) VALUES (?, ?, ?)')
    .bind(hash, user.email, expires)
    .run();
  const origin = env.APP_ORIGIN.replace(/\/$/, '');
  const link = `${origin}/api/auth/callback?token=${token}`;
  const mailed = await sendMagicLinkEmail(env, user.email, link);
  await writeAudit(env, request, { action: 'resend_magic_link', targetUserId: userId });
  if (!mailed.sent && env.ENVIRONMENT !== 'development') return { ok: false, error: 'email' };
  return { ok: true };
}
