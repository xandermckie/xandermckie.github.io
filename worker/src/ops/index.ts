import type { Env } from '../env';
import { json, readJson } from '../http';
import { userFromRequest } from '../auth';
import { sendOpsAlert, writeAudit } from './audit';
import {
  completeOpsLogin,
  destroyOpsSession,
  ipAllowlisted,
  loginRateAllowed,
  opsClearCookie,
  opsSessionFromRequest,
  opsSetCookie,
  originAllowed,
  verifyOpsLogin,
} from './auth';
import { camouflage } from './camouflage';
import { lockUser } from './lock';
import { normalizeOpsPath, opsRestPath, pathMatchesOpsPrefix } from './path';
import { collectOpsStats } from './stats';
import {
  lookupRedactedAccount,
  supportLock,
  supportResendMagicLink,
  supportResetCap,
  supportRevokeSessions,
  supportUnlock,
} from './support';
import { dashboardHtml, dashboardJs, gateHtml, opsHtmlResponse, opsJsResponse } from './ui';

function isDev(env: Env): boolean {
  return env.ENVIRONMENT === 'development';
}

async function readLoginBody(
  request: Request,
): Promise<{ username: string; password: string; totp: string }> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    return {
      username: params.get('username') ?? '',
      password: params.get('password') ?? '',
      totp: params.get('totp') ?? '',
    };
  }
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return { username: '', password: '', totp: '' };
  const record = body as Record<string, unknown>;
  return {
    username: typeof record.username === 'string' ? record.username : '',
    password: typeof record.password === 'string' ? record.password : '',
    totp: typeof record.totp === 'string' ? record.totp : '',
  };
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  const contentType = request.headers.get('Content-Type') ?? '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

async function tripwire(env: Env, request: Request): Promise<void> {
  const user = await userFromRequest(env, request);
  if (!user) return;
  await lockUser(env, user.id, 'tripwire');
  await writeAudit(env, request, { action: 'tripwire', targetUserId: user.id });
  await sendOpsAlert(
    env,
    'Learner account locked',
    `A learner account was locked by a path tripwire. id=${user.id} reason=tripwire`,
  );
}

async function dispatchAuthenticated(
  request: Request,
  env: Env,
  opsPath: string,
  rest: string,
): Promise<Response> {
  const method = request.method;
  const mutating = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  if (mutating && !originAllowed(request, env)) {
    return json({ error: 'Invalid origin.' }, { status: 403 });
  }

  if (method === 'GET' && (rest === '' || rest === '/')) {
    return opsHtmlResponse(dashboardHtml(opsPath));
  }
  if (method === 'GET' && rest === '/app.js') {
    return opsJsResponse(dashboardJs(opsPath));
  }
  if (method === 'GET' && rest === '/stats') {
    return json(await collectOpsStats(env));
  }
  if (method === 'POST' && rest === '/logout') {
    await destroyOpsSession(env, request);
    const headers = new Headers({
      'Set-Cookie': opsClearCookie(request),
      Location: env.APP_ORIGIN.replace(/\/$/, '') + '/',
    });
    if (wantsJson(request)) {
      return json({ ok: true }, { headers: { 'Set-Cookie': opsClearCookie(request) } });
    }
    return new Response(null, { status: 303, headers });
  }
  if (method === 'POST' && rest === '/support/lookup') {
    const body = await readJson(request);
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    const email = typeof record.email === 'string' ? record.email.trim() : '';
    const result = await lookupRedactedAccount(env, {
      userId: userId || undefined,
      email: email || undefined,
    });
    return json(result);
  }
  if (method === 'POST' && rest === '/support/revoke') {
    const body = await readJson(request);
    const userId =
      body && typeof body === 'object' && typeof (body as { userId?: unknown }).userId === 'string'
        ? (body as { userId: string }).userId.trim()
        : '';
    const ok = userId ? await supportRevokeSessions(env, request, userId) : false;
    return json({ ok }, { status: ok ? 200 : 404 });
  }
  if (method === 'POST' && rest === '/support/reset-cap') {
    const body = await readJson(request);
    const userId =
      body && typeof body === 'object' && typeof (body as { userId?: unknown }).userId === 'string'
        ? (body as { userId: string }).userId.trim()
        : '';
    const ok = userId ? await supportResetCap(env, request, userId) : false;
    return json({ ok }, { status: ok ? 200 : 404 });
  }
  if (method === 'POST' && rest === '/support/lock') {
    const body = await readJson(request);
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    const result = await supportLock(env, request, userId, record.totp);
    if (result.error === 'step-up') return json({ ok: false }, { status: 401 });
    return json({ ok: result.ok }, { status: result.ok ? 200 : 404 });
  }
  if (method === 'POST' && rest === '/support/unlock') {
    const body = await readJson(request);
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    const result = await supportUnlock(env, request, userId, record.totp);
    if (result.error === 'step-up') return json({ ok: false }, { status: 401 });
    return json({ ok: result.ok }, { status: result.ok ? 200 : 404 });
  }
  if (method === 'POST' && rest === '/support/resend') {
    const body = await readJson(request);
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    const result = await supportResendMagicLink(env, request, userId, record.totp);
    if (result.error === 'step-up') return json({ ok: false }, { status: 401 });
    if (result.error === 'locked') return json({ ok: false, error: 'locked' }, { status: 409 });
    return json({ ok: result.ok }, { status: result.ok ? 200 : 404 });
  }
  return camouflage(request, env);
}

export async function handleOps(request: Request, env: Env): Promise<Response | null> {
  const opsPath = normalizeOpsPath(env.OPS_PATH);
  if (!opsPath || !env.SESSION_SECRET) return null;
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  const matches = await pathMatchesOpsPrefix(pathname, opsPath, env.SESSION_SECRET);
  if (!matches) return null;

  if (!ipAllowlisted(request, env)) {
    return camouflage(request, env);
  }

  const rest = opsRestPath(pathname, opsPath);
  const session = await opsSessionFromRequest(env, request);
  if (session) {
    return dispatchAuthenticated(request, env, opsPath, rest);
  }

  const learner = await userFromRequest(env, request);
  if (learner) {
    await tripwire(env, request);
    return camouflage(request, env);
  }

  if (request.method === 'POST' && rest === '/session') {
    if (!originAllowed(request, env)) {
      return camouflage(request, env);
    }
    if (!(await loginRateAllowed(env, request))) {
      return camouflage(request, env);
    }
    const credentials = await readLoginBody(request);
    const ok = await verifyOpsLogin(env, credentials.username, credentials.password, credentials.totp);
    if (!ok) return camouflage(request, env);
    const { signed } = await completeOpsLogin(env, request);
    if (wantsJson(request)) {
      return json(
        { ok: true },
        { headers: { 'Set-Cookie': opsSetCookie(request, signed) } },
      );
    }
    const headers = new Headers({
      'Set-Cookie': opsSetCookie(request, signed),
      Location: opsPath,
    });
    return new Response(null, { status: 303, headers });
  }

  if (isDev(env) && request.method === 'GET' && (rest === '' || rest === '/')) {
    return opsHtmlResponse(gateHtml());
  }

  return camouflage(request, env);
}
