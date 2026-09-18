import type { Env } from '../env';
import {
  hmacSha256Hex,
  randomToken,
  sha256Hex,
  timingSafeEqualUtf8,
} from '../crypto';
import { rateLimit } from '../rate-limit';
import { hashRequestIp, sendOpsAlert, writeAudit } from './audit';
import { verifyTotp } from './totp';

export const OPS_COOKIE_BARE = 'pt_at';
export const OPS_COOKIE_HOST = '__Host-pt_at';
export const OPS_SESSION_TTL_S = 30 * 60;
export const OPS_PBKDF2_ITERATIONS = 210_000;
export const MAX_OPS_SESSIONS = 2;

export interface OpsSessionRow {
  token_hash: string;
  ip_hash: string;
  expires_at: string;
  created_at: string;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashOpsPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex),
      iterations: OPS_PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export function requestIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'local';
}

export function ipAllowlisted(request: Request, env: Env): boolean {
  const raw = env.OPS_IP_ALLOWLIST?.trim();
  if (!raw) return true;
  const allowed = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(requestIp(request));
}

export function originAllowed(request: Request, env: Env): boolean {
  const expected = env.APP_ORIGIN.replace(/\/$/, '');
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([expected, requestOrigin]);
  const origin = request.headers.get('Origin');
  if (origin) return allowed.has(origin);
  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try {
    const url = new URL(referer);
    return allowed.has(`${url.protocol}//${url.host}`);
  } catch {
    return false;
  }
}

export function isHttpsRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}

export function opsCookieName(request: Request): string {
  return isHttpsRequest(request) ? OPS_COOKIE_HOST : OPS_COOKIE_BARE;
}

export async function signOpsToken(env: Env, token: string): Promise<string> {
  const hmac = await hmacSha256Hex(env.SESSION_SECRET, `ops-token:${token}`);
  return `${token}.${hmac}`;
}

export async function parseOpsCookie(env: Env, request: Request): Promise<string | null> {
  const header = request.headers.get('Cookie') ?? '';
  const match = header.match(/(?:^|;\s*)(?:__Host-)?pt_at=([^;]+)/);
  if (!match?.[1]) return null;
  const raw = decodeURIComponent(match[1]);
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const token = raw.slice(0, dot);
  const hmac = raw.slice(dot + 1);
  const expected = await hmacSha256Hex(env.SESSION_SECRET, `ops-token:${token}`);
  if (!timingSafeEqualUtf8(expected, hmac)) return null;
  return token;
}

export function opsSetCookie(request: Request, signed: string): string {
  const secure = isHttpsRequest(request);
  const name = opsCookieName(request);
  const flags = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${OPS_SESSION_TTL_S}${secure ? '; Secure' : ''}`;
  return `${name}=${encodeURIComponent(signed)}; ${flags}`;
}

export function opsClearCookie(request: Request): string {
  const secure = isHttpsRequest(request);
  const name = opsCookieName(request);
  return `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

export async function createOpsSession(env: Env, request: Request): Promise<string> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  const ipHash = await hashRequestIp(env, request);
  const now = new Date();
  const expires = new Date(now.getTime() + OPS_SESSION_TTL_S * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO ops_sessions (token_hash, ip_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(hash, ipHash, expires, now.toISOString())
    .run();
  const rows = await env.DB.prepare(
    'SELECT token_hash FROM ops_sessions ORDER BY created_at ASC',
  ).all<{ token_hash: string }>();
  const extra = (rows.results?.length ?? 0) - MAX_OPS_SESSIONS;
  if (extra > 0) {
    const oldest = rows.results.slice(0, extra);
    for (const row of oldest) {
      await env.DB.prepare('DELETE FROM ops_sessions WHERE token_hash = ?').bind(row.token_hash).run();
    }
  }
  return token;
}

export async function opsSessionFromRequest(env: Env, request: Request): Promise<OpsSessionRow | null> {
  if (!ipAllowlisted(request, env)) return null;
  const token = await parseOpsCookie(env, request);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT token_hash, ip_hash, expires_at, created_at FROM ops_sessions WHERE token_hash = ? AND expires_at > ?',
  )
    .bind(hash, new Date().toISOString())
    .first<OpsSessionRow>();
  if (!row) return null;
  const ipHash = await hashRequestIp(env, request);
  if (!timingSafeEqualUtf8(row.ip_hash, ipHash)) return null;
  return row;
}

export async function destroyOpsSession(env: Env, request: Request): Promise<void> {
  const token = await parseOpsCookie(env, request);
  if (!token) return;
  const hash = await sha256Hex(token);
  await env.DB.prepare('DELETE FROM ops_sessions WHERE token_hash = ?').bind(hash).run();
}

const DUMMY_SALT = '00'.repeat(16);
const DUMMY_PASSWORD = 'not-the-operator-password';

export async function verifyOpsLogin(
  env: Env,
  username: string,
  password: string,
  totp: string,
): Promise<boolean> {
  const expectedUser = env.OPS_USERNAME ?? '';
  const salt = env.OPS_PASSWORD_SALT && env.OPS_PASSWORD_SALT.length > 0 ? env.OPS_PASSWORD_SALT : DUMMY_SALT;
  const expectedHash =
    env.OPS_PASSWORD_HASH && env.OPS_PASSWORD_HASH.length > 0
      ? env.OPS_PASSWORD_HASH
      : await hashOpsPassword(DUMMY_PASSWORD, DUMMY_SALT);
  const userOk = expectedUser.length > 0 && timingSafeEqualUtf8(username, expectedUser);
  const derived = await hashOpsPassword(password, salt);
  const passOk = timingSafeEqualUtf8(derived, expectedHash);
  const totpSecret = env.OPS_TOTP_SECRET ?? 'MFRGGZDFMZTWQ2LK';
  const totpOk = await verifyTotp(totpSecret, totp);
  return userOk && passOk && totpOk;
}

export async function verifyStepUpTotp(env: Env, totp: string): Promise<boolean> {
  const secret = env.OPS_TOTP_SECRET;
  if (!secret) return false;
  return verifyTotp(secret, totp);
}

export async function loginRateAllowed(env: Env, request: Request): Promise<boolean> {
  return rateLimit(env, `ops-login:${requestIp(request)}`, 5);
}

export async function completeOpsLogin(env: Env, request: Request): Promise<{ signed: string }> {
  const token = await createOpsSession(env, request);
  const signed = await signOpsToken(env, token);
  await writeAudit(env, request, { action: 'login' });
  await sendOpsAlert(
    env,
    'Console sign-in',
    'A console sign-in succeeded. If this was not you, rotate the console secrets immediately.',
  );
  return { signed };
}
