import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../env';
import { handleRequest } from '../../index';
import { sha256Hex } from '../../crypto';
import { hashOpsPassword } from '../auth';
import { generateTotp } from '../totp';
import { MemoryD1 } from './memory-d1';

const OPS_PATH = '/x7f3c9e1a2b4d6e8f0a1b2c3d4e5f6789';
const ORIGIN = 'http://localhost:8787';
const USERNAME = 'operator';
const PASSWORD = 'correct-horse-battery';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const SALT = 'ab'.repeat(16);

const SPA_BODY = '<!doctype html><div id="root"></div>';

function spaAssets(): Env['ASSETS'] {
  return {
    fetch: async () =>
      new Response(SPA_BODY, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
  };
}

function makeEnv(db: MemoryD1, extra: Partial<Env> = {}): Env {
  return {
    DB: db,
    ASSETS: spaAssets(),
    SESSION_SECRET: 'test-session-secret',
    APP_ORIGIN: ORIGIN,
    ENVIRONMENT: 'production',
    OPS_PATH,
    OPS_USERNAME: USERNAME,
    OPS_PASSWORD_SALT: SALT,
    OPS_PASSWORD_HASH: extra.OPS_PASSWORD_HASH ?? '',
    OPS_TOTP_SECRET: TOTP_SECRET,
    OPS_ALERT_EMAIL: 'alerts@example.com',
    RESEND_API_KEY: 're_test',
    MAGIC_FROM_EMAIL: 'PyTyping <signin@example.com>',
    ...extra,
  };
}

function req(
  path: string,
  init: RequestInit & { origin?: string } = {},
): Request {
  const headers = new Headers(init.headers);
  if (init.origin) headers.set('Origin', init.origin);
  if (init.body && !headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
}

function cookieFrom(response: Response): string {
  const header = response.headers.get('Set-Cookie') ?? '';
  const match = header.match(/^(?:__Host-)?pt_at=[^;]+/);
  return match?.[0] ?? '';
}

async function seedLearner(
  db: MemoryD1,
  input: { id: string; email: string; sessionToken: string; locked?: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO users (id, email, display_name, bio, polar_customer_id, created_at, deleted_at, locked_at, locked_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      input.id,
      input.email,
      'Alice',
      'secret bio',
      'polar_abc',
      now,
      null,
      input.locked ? now : null,
      input.locked ? 'admin' : null,
    )
    .run();
  await db
    .prepare('INSERT INTO entitlements (user_id, plan, status, updated_at) VALUES (?, ?, ?, ?)')
    .bind(input.id, 'free', 'none', now)
    .run();
  const hash = await sha256Hex(input.sessionToken);
  const expires = new Date(Date.now() + 60_000).toISOString();
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(hash, input.id, expires)
    .run();
}

describe('hidden ops panel', () => {
  let passwordHash = '';

  beforeAll(async () => {
    passwordHash = await hashOpsPassword(PASSWORD, SALT);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    );
  });

  it('camouflages the secret path like an unknown URL', async () => {
    const env = makeEnv(new MemoryD1(), { OPS_PASSWORD_HASH: passwordHash });
    const secret = await handleRequest(req(OPS_PATH), env);
    const decoy = await handleRequest(req('/not-a-page'), env);
    expect(secret.status).toBe(decoy.status);
    const secretText = await secret.text();
    const decoyText = await decoy.text();
    expect(secretText).toBe(decoyText);
    expect(secret.headers.get('Set-Cookie')).toBeNull();
  });

  it('does not lock a learner who visits /admin', async () => {
    const db = new MemoryD1();
    const env = makeEnv(db, { OPS_PASSWORD_HASH: passwordHash });
    await seedLearner(db, { id: 'user-1', email: 'alice@example.com', sessionToken: 'sess-admin' });
    const response = await handleRequest(
      req('/admin', { headers: { Cookie: 'pytyping_session=sess-admin' } }),
      env,
    );
    expect(await response.text()).toBe(SPA_BODY);
    const user = await db.prepare('SELECT locked_at FROM users WHERE id = ?').bind('user-1').first<{ locked_at: string | null }>();
    expect(user?.locked_at).toBeNull();
    const sessions = await db.prepare('SELECT COUNT(*) as n FROM sessions').first<{ n: number }>();
    expect(sessions?.n).toBe(1);
  });

  it('locks a learner who hits the secret path and still camouflages', async () => {
    const db = new MemoryD1();
    const env = makeEnv(db, { OPS_PASSWORD_HASH: passwordHash });
    await seedLearner(db, { id: 'user-2', email: 'bob@example.com', sessionToken: 'sess-secret' });
    const decoy = await handleRequest(req('/not-a-page'), env);
    const response = await handleRequest(
      req(OPS_PATH, { headers: { Cookie: 'pytyping_session=sess-secret' } }),
      env,
    );
    expect(response.status).toBe(decoy.status);
    const body = await response.text();
    expect(body).toBe(await decoy.text());
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(body.includes('Console')).toBe(false);
    const user = await db.prepare('SELECT locked_at, locked_reason FROM users WHERE id = ?').bind('user-2').first<{
      locked_at: string | null;
      locked_reason: string | null;
    }>();
    expect(user?.locked_at).toBeTruthy();
    expect(user?.locked_reason).toBe('tripwire');
    const sessions = await db.prepare('SELECT COUNT(*) as n FROM sessions').first<{ n: number }>();
    expect(sessions?.n).toBe(0);
  });

  it('treats a locked learner as signed out on /api/me and magic-link callback', async () => {
    const db = new MemoryD1();
    const env = makeEnv(db, { OPS_PASSWORD_HASH: passwordHash });
    await seedLearner(db, {
      id: 'user-3',
      email: 'locked@example.com',
      sessionToken: 'sess-locked',
      locked: true,
    });
    const me = await handleRequest(
      req('/api/me', { headers: { Cookie: 'pytyping_session=sess-locked' } }),
      env,
    );
    const body = (await me.json()) as { authenticated: boolean };
    expect(body.authenticated).toBe(false);

    const token = 'magic-token';
    const hash = await sha256Hex(token);
    await db
      .prepare('INSERT INTO magic_links (token_hash, email, expires_at) VALUES (?, ?, ?)')
      .bind(hash, 'locked@example.com', new Date(Date.now() + 60_000).toISOString())
      .run();
    const callback = await handleRequest(req(`/api/auth/callback?token=${token}`), env);
    expect(callback.status).toBe(302);
    expect(callback.headers.get('Location')).toContain('/login?error=expired');
    expect(callback.headers.get('Set-Cookie')).toBeNull();
  });

  it('signs in with username, password, and TOTP then serves the dashboard', async () => {
    const env = makeEnv(new MemoryD1(), { OPS_PASSWORD_HASH: passwordHash });
    const totp = await generateTotp(TOTP_SECRET);
    const login = await handleRequest(
      req(`${OPS_PATH}/session`, {
        method: 'POST',
        origin: ORIGIN,
        body: JSON.stringify({ username: USERNAME, password: PASSWORD, totp }),
      }),
      env,
    );
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);
    expect(cookie.startsWith('pt_at=')).toBe(true);
    const dash = await handleRequest(req(OPS_PATH, { headers: { Cookie: cookie } }), env);
    const html = await dash.text();
    expect(html).toContain('Console');
    expect(html).toContain('/app.js');
    const stats = await handleRequest(
      req(`${OPS_PATH}/stats`, { headers: { Cookie: cookie } }),
      env,
    );
    expect(stats.status).toBe(200);
    const payload = (await stats.json()) as { health: { db: boolean }; counts: { users: number } };
    expect(payload.health.db).toBe(true);
    expect(payload.counts.users).toBeGreaterThanOrEqual(0);
  });

  it('camouflages a wrong password or TOTP and sets no cookie', async () => {
    const env = makeEnv(new MemoryD1(), { OPS_PASSWORD_HASH: passwordHash });
    const totp = await generateTotp(TOTP_SECRET);
    const badPassword = await handleRequest(
      req(`${OPS_PATH}/session`, {
        method: 'POST',
        origin: ORIGIN,
        body: JSON.stringify({ username: USERNAME, password: 'wrong', totp }),
      }),
      env,
    );
    const decoy = await handleRequest(
      req('/not-a-page', { method: 'POST', origin: ORIGIN, body: '{}' }),
      env,
    );
    expect(badPassword.status).toBe(decoy.status);
    expect(await badPassword.text()).toBe(await decoy.text());
    expect(badPassword.headers.get('Set-Cookie')).toBeNull();

    const badTotp = await handleRequest(
      req(`${OPS_PATH}/session`, {
        method: 'POST',
        origin: ORIGIN,
        body: JSON.stringify({ username: USERNAME, password: PASSWORD, totp: '000000' }),
      }),
      env,
    );
    expect(badTotp.headers.get('Set-Cookie')).toBeNull();
  });

  it('returns a redacted lookup and never serializes personal fields', async () => {
    const db = new MemoryD1();
    const env = makeEnv(db, { OPS_PASSWORD_HASH: passwordHash });
    await seedLearner(db, { id: 'user-4', email: 'pii@example.com', sessionToken: 'sess-4' });
    const totp = await generateTotp(TOTP_SECRET);
    const login = await handleRequest(
      req(`${OPS_PATH}/session`, {
        method: 'POST',
        origin: ORIGIN,
        body: JSON.stringify({ username: USERNAME, password: PASSWORD, totp }),
      }),
      env,
    );
    const cookie = cookieFrom(login);
    const lookup = await handleRequest(
      req(`${OPS_PATH}/support/lookup`, {
        method: 'POST',
        origin: ORIGIN,
        headers: { Cookie: cookie },
        body: JSON.stringify({ email: 'pii@example.com' }),
      }),
      env,
    );
    const text = await lookup.text();
    expect(text).not.toContain('pii@example.com');
    expect(text).not.toContain('Alice');
    expect(text).not.toContain('secret bio');
    expect(text).not.toContain('polar_abc');
    const data = JSON.parse(text) as { found: boolean; userId?: string; billingLinked?: boolean };
    expect(data.found).toBe(true);
    expect(data.userId).toBe('user-4');
    expect(data.billingLinked).toBe(true);
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('display_name');
    expect(data).not.toHaveProperty('bio');
    expect(data).not.toHaveProperty('polar_customer_id');
  });

  it('rejects mutating support calls without Origin', async () => {
    const env = makeEnv(new MemoryD1(), { OPS_PASSWORD_HASH: passwordHash });
    const totp = await generateTotp(TOTP_SECRET);
    const login = await handleRequest(
      req(`${OPS_PATH}/session`, {
        method: 'POST',
        origin: ORIGIN,
        body: JSON.stringify({ username: USERNAME, password: PASSWORD, totp }),
      }),
      env,
    );
    const cookie = cookieFrom(login);
    const lookup = await handleRequest(
      req(`${OPS_PATH}/support/lookup`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-4' }),
      }),
      env,
    );
    expect(lookup.status).toBe(403);
  });

  it('rejects lock, unlock, and resend without a step-up TOTP', async () => {
    const db = new MemoryD1();
    const env = makeEnv(db, { OPS_PASSWORD_HASH: passwordHash });
    await seedLearner(db, { id: 'user-5', email: 'step@example.com', sessionToken: 'sess-5' });
    const totp = await generateTotp(TOTP_SECRET);
    const login = await handleRequest(
      req(`${OPS_PATH}/session`, {
        method: 'POST',
        origin: ORIGIN,
        body: JSON.stringify({ username: USERNAME, password: PASSWORD, totp }),
      }),
      env,
    );
    const cookie = cookieFrom(login);
    for (const path of ['lock', 'unlock', 'resend'] as const) {
      const response = await handleRequest(
        req(`${OPS_PATH}/support/${path}`, {
          method: 'POST',
          origin: ORIGIN,
          headers: { Cookie: cookie },
          body: JSON.stringify({ userId: 'user-5' }),
        }),
        env,
      );
      expect(response.status).toBe(401);
    }
    const stepUp = await generateTotp(TOTP_SECRET);
    const locked = await handleRequest(
      req(`${OPS_PATH}/support/lock`, {
        method: 'POST',
        origin: ORIGIN,
        headers: { Cookie: cookie },
        body: JSON.stringify({ userId: 'user-5', totp: stepUp }),
      }),
      env,
    );
    expect(locked.status).toBe(200);
    const row = await db.prepare('SELECT locked_reason FROM users WHERE id = ?').bind('user-5').first<{
      locked_reason: string | null;
    }>();
    expect(row?.locked_reason).toBe('admin');
  });
});
