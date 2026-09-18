import interviewData from '../data/interview-exercises.json';
import type { Env, UserRow } from './env';
import {
  addCompletion,
  completionsToday,
  createSession,
  destroySession,
  getEntitlement,
  getUserById,
  sendMagicLinkEmail,
  sessionCookie,
  clearSessionCookie,
  setFree,
  setPro,
  upsertUser,
  userFromRequest,
} from './auth';
import { randomToken, sha256Hex, verifyStandardWebhook } from './crypto';
import { errorJson, isEmail, isNonEmptyString, json, readJson } from './http';
import {
  billingConfigured,
  createCustomerPortal,
  createPolarCheckout,
  deletePolarCustomer,
  findOrCreatePolarCustomer,
  metadataUserId,
  revokePolarSubscription,
} from './polar';
import { rateLimit } from './rate-limit';

const FREE_DAILY_CAP = 5;
const MAGIC_TTL_MS = 15 * 60 * 1000;

interface InterviewExercise {
  id: string;
  title: string;
  description: string;
  topics: string[];
  estimatedTime: number;
}

const INTERVIEW = interviewData as InterviewExercise[];

function isDev(env: Env): boolean {
  return env.ENVIRONMENT === 'development';
}

async function requireUser(env: Env, request: Request): Promise<UserRow | Response> {
  const user = await userFromRequest(env, request);
  if (!user) return errorJson('Sign in required.', 401);
  return user;
}

async function remainingFor(env: Env, user: UserRow): Promise<{ plan: 'free' | 'pro'; remaining: number }> {
  const entitlement = await getEntitlement(env, user.id);
  if (entitlement.plan === 'pro') return { plan: 'pro', remaining: 9999 };
  const used = await completionsToday(env, user.id);
  return { plan: 'free', remaining: Math.max(0, FREE_DAILY_CAP - used) };
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    if (method === 'GET' && path === '/api/health') {
      return json({ ok: true, billing: billingConfigured(env) });
    }

    if (method === 'GET' && path === '/api/me') {
      const user = await userFromRequest(env, request);
      if (!user) {
        return json({
          authenticated: false,
          email: null,
          displayName: null,
          bio: null,
          plan: 'free',
          remainingToday: FREE_DAILY_CAP,
          dailyCap: FREE_DAILY_CAP,
          currentPeriodEnd: null,
          billingConfigured: billingConfigured(env),
        });
      }
      const { plan, remaining } = await remainingFor(env, user);
      const entitlement = await getEntitlement(env, user.id);
      return json({
        authenticated: true,
        email: user.email,
        displayName: user.display_name,
        bio: user.bio,
        plan,
        remainingToday: remaining,
        dailyCap: FREE_DAILY_CAP,
        currentPeriodEnd: entitlement.current_period_end,
        billingConfigured: billingConfigured(env),
      });
    }

    if (method === 'POST' && path === '/api/auth/magic-link') {
      const body = await readJson(request);
      if (!body || typeof body !== 'object') return errorJson('Invalid JSON.', 400);
      const record = body as Record<string, unknown>;
      const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
      if (!isEmail(email)) return errorJson('Enter a valid email address.', 400);
      if (record.ageConfirmed !== true) {
        return errorJson('You must confirm you are at least 13 years old.', 400);
      }
      const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
      if (!(await rateLimit(env, `magic:${ip}`)) || !(await rateLimit(env, `magic-email:${email}`))) {
        return errorJson('Too many sign-in emails. Try again in a few minutes.', 429);
      }
      const token = randomToken();
      const hash = await sha256Hex(token);
      const expires = new Date(Date.now() + MAGIC_TTL_MS).toISOString();
      await env.DB.prepare('INSERT INTO magic_links (token_hash, email, expires_at) VALUES (?, ?, ?)')
        .bind(hash, email, expires)
        .run();
      const origin = env.APP_ORIGIN.replace(/\/$/, '');
      const link = `${origin}/api/auth/callback?token=${token}`;
      const mailed = await sendMagicLinkEmail(env, email, link);
      const payload: { ok: true; devLink?: string } = { ok: true };
      if (!mailed.sent && isDev(env)) payload.devLink = link;
      if (!mailed.sent && !isDev(env)) {
        return errorJson('Email is not configured. Set RESEND_API_KEY and MAGIC_FROM_EMAIL.', 503);
      }
      return json(payload);
    }

    if (method === 'GET' && path === '/api/auth/callback') {
      const token = url.searchParams.get('token') ?? '';
      if (!token) return errorJson('Missing token.', 400);
      const hash = await sha256Hex(token);
      const row = await env.DB.prepare(
        'SELECT email, expires_at FROM magic_links WHERE token_hash = ?',
      )
        .bind(hash)
        .first<{ email: string; expires_at: string }>();
      await env.DB.prepare('DELETE FROM magic_links WHERE token_hash = ?').bind(hash).run();
      if (!row || row.expires_at < new Date().toISOString()) {
        return Response.redirect(`${env.APP_ORIGIN}/login?error=expired`, 302);
      }
      const user = await upsertUser(env, row.email);
      const session = await createSession(env, user.id);
      const headers = new Headers({
        Location: `${env.APP_ORIGIN}/settings?signed_in=1`,
        'Set-Cookie': sessionCookie(session, request),
      });
      return new Response(null, { status: 302, headers });
    }

    if (method === 'POST' && path === '/api/auth/logout') {
      await destroySession(env, request);
      return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } });
    }

    if (method === 'POST' && path === '/api/checkout') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      if (!billingConfigured(env)) {
        return errorJson('Billing is not configured yet. Add Polar keys in Wrangler secrets.', 503);
      }
      if (!(await rateLimit(env, `checkout:${user.id}`, 5))) {
        return errorJson('Too many checkout attempts.', 429);
      }
      let polarId = user.polar_customer_id;
      if (!polarId) {
        polarId = await findOrCreatePolarCustomer(env, user.email, user.id);
        if (polarId) {
          await env.DB.prepare('UPDATE users SET polar_customer_id = ? WHERE id = ?')
            .bind(polarId, user.id)
            .run();
        }
      }
      const successUrl = `${env.APP_ORIGIN.replace(/\/$/, '')}/settings?checkout=success`;
      const checkoutUrl = await createPolarCheckout(env, {
        email: user.email,
        userId: user.id,
        successUrl,
      });
      return json({ url: checkoutUrl });
    }

    if (method === 'GET' && path === '/api/portal') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      if (!user.polar_customer_id || !billingConfigured(env)) {
        return errorJson('No Polar customer is linked to this account yet.', 400);
      }
      const portalUrl = await createCustomerPortal(env, user.polar_customer_id);
      return json({ url: portalUrl });
    }

    if (method === 'POST' && path === '/api/webhooks/polar') {
      const raw = await request.text();
      const secret = env.POLAR_WEBHOOK_SECRET ?? '';
      if (!secret || !(await verifyStandardWebhook(secret, request.headers, raw))) {
        return errorJson('Invalid webhook signature.', 401);
      }
      const event = JSON.parse(raw) as {
        type?: string;
        data?: Record<string, unknown>;
      };
      const data = event.data ?? {};
      const type = event.type ?? '';
      const userId =
        metadataUserId(data.metadata) ??
        (typeof data.user_id === 'string' ? data.user_id : null);
      const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
      let user: UserRow | null = null;
      if (userId) user = await getUserById(env, userId);
      if (!user && customerId) {
        user = await env.DB.prepare('SELECT * FROM users WHERE polar_customer_id = ?')
          .bind(customerId)
          .first<UserRow>();
      }
      if (user && customerId && !user.polar_customer_id) {
        await env.DB.prepare('UPDATE users SET polar_customer_id = ? WHERE id = ?')
          .bind(customerId, user.id)
          .run();
      }
      if (user) {
        const subscriptionId = typeof data.id === 'string' ? data.id : null;
        const periodEnd =
          typeof data.current_period_end === 'string' ? data.current_period_end : null;
        if (
          type === 'subscription.active' ||
          type === 'subscription.updated' ||
          type === 'benefit_grant.created' ||
          type === 'order.paid'
        ) {
          const status = typeof data.status === 'string' ? data.status : 'active';
          if (status === 'active' || type === 'benefit_grant.created' || type === 'order.paid') {
            await setPro(env, user.id, { subscriptionId, periodEnd, status: 'active' });
          }
          if (status === 'canceled' && data.cancel_at_period_end === true) {
            // Keep Pro until period end; webhook revoked will drop it.
          }
        }
        if (type === 'subscription.revoked' || type === 'benefit_grant.revoked' || type === 'order.refunded') {
          await setFree(env, user.id, type);
        }
      }
      return json({ received: true });
    }

    if (method === 'POST' && path === '/api/completions') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      const body = await readJson(request);
      const exerciseId =
        body && typeof body === 'object' && typeof (body as { exerciseId?: unknown }).exerciseId === 'string'
          ? (body as { exerciseId: string }).exerciseId
          : '';
      if (!exerciseId) return errorJson('exerciseId is required.', 400);
      const { plan, remaining } = await remainingFor(env, user);
      if (plan !== 'pro' && remaining <= 0) {
        return errorJson('Daily free limit reached. Upgrade to Pro for unlimited completions.', 402);
      }
      await addCompletion(env, user.id, exerciseId);
      const next = await remainingFor(env, user);
      return json({ remainingToday: next.remaining, plan: next.plan });
    }

    if (method === 'GET' && path === '/api/exercises/interview') {
      const preview = url.searchParams.get('preview') === '1';
      const user = await userFromRequest(env, request);
      const plan = user ? (await getEntitlement(env, user.id)).plan : 'free';
      if (preview || plan !== 'pro') {
        return json(
          INTERVIEW.map((ex) => ({
            id: ex.id,
            title: ex.title,
            description: ex.description,
            topics: ex.topics,
            estimatedTime: ex.estimatedTime,
            locked: plan !== 'pro',
          })),
        );
      }
      return json(interviewData);
    }

    if (method === 'GET' && path === '/api/account/export') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      const entitlement = await getEntitlement(env, user.id);
      const completions = await env.DB.prepare(
        'SELECT exercise_id, completed_at FROM completions WHERE user_id = ? ORDER BY completed_at',
      )
        .bind(user.id)
        .all<{ exercise_id: string; completed_at: string }>();
      const sync = await env.DB.prepare('SELECT settings_json, playlists_json FROM sync_blobs WHERE user_id = ?')
        .bind(user.id)
        .first<{ settings_json: string | null; playlists_json: string | null }>();
      return json({
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          bio: user.bio,
          createdAt: user.created_at,
        },
        entitlement,
        completions: completions.results,
        settings: sync?.settings_json ? JSON.parse(sync.settings_json) : null,
        playlists: sync?.playlists_json ? JSON.parse(sync.playlists_json) : null,
      });
    }

    if (method === 'DELETE' && path === '/api/account') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      const entitlement = await getEntitlement(env, user.id);
      if (entitlement.polar_subscription_id && billingConfigured(env)) {
        try {
          await revokePolarSubscription(env, entitlement.polar_subscription_id);
        } catch {
          // Continue deletion even if Polar revoke fails; log via response note.
        }
      }
      if (user.polar_customer_id && billingConfigured(env)) {
        try {
          await deletePolarCustomer(env, user.polar_customer_id);
        } catch {
          // Polar customer delete is best-effort.
        }
      }
      const emailHash = await sha256Hex(user.email);
      await env.DB.prepare('INSERT INTO deletion_log (email_hash, deleted_at) VALUES (?, ?)')
        .bind(emailHash, new Date().toISOString())
        .run();
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
      return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } });
    }

    if (method === 'PATCH' && path === '/api/account/profile') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      const entitlement = await getEntitlement(env, user.id);
      if (entitlement.plan !== 'pro') return errorJson('Profile extras require Pro.', 402);
      const body = await readJson(request);
      if (!body || typeof body !== 'object') return errorJson('Invalid JSON.', 400);
      const record = body as Record<string, unknown>;
      const displayName = isNonEmptyString(record.displayName) ? record.displayName.trim().slice(0, 40) : user.display_name;
      const bio = typeof record.bio === 'string' ? record.bio.trim().slice(0, 160) : user.bio;
      await env.DB.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?')
        .bind(displayName, bio, user.id)
        .run();
      return json({ ok: true, displayName, bio });
    }

    if (method === 'PUT' && path === '/api/sync') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      const entitlement = await getEntitlement(env, user.id);
      if (entitlement.plan !== 'pro') return errorJson('Cloud sync requires Pro.', 402);
      const body = await readJson(request);
      if (!body || typeof body !== 'object') return errorJson('Invalid JSON.', 400);
      const record = body as Record<string, unknown>;
      const settingsJson = record.settings ? JSON.stringify(record.settings).slice(0, 50_000) : null;
      const playlistsJson = record.playlists ? JSON.stringify(record.playlists).slice(0, 50_000) : null;
      await env.DB.prepare(
        `INSERT INTO sync_blobs (user_id, settings_json, playlists_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           settings_json = excluded.settings_json,
           playlists_json = excluded.playlists_json,
           updated_at = excluded.updated_at`,
      )
        .bind(user.id, settingsJson, playlistsJson, new Date().toISOString())
        .run();
      if (isNonEmptyString(record.displayName) || typeof record.bio === 'string') {
        const displayName = isNonEmptyString(record.displayName)
          ? record.displayName.trim().slice(0, 40)
          : user.display_name;
        const bio = typeof record.bio === 'string' ? record.bio.trim().slice(0, 160) : user.bio;
        await env.DB.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?')
          .bind(displayName, bio, user.id)
          .run();
      }
      return json({ ok: true });
    }

    if (method === 'GET' && path === '/api/sync') {
      const user = await requireUser(env, request);
      if (user instanceof Response) return user;
      const entitlement = await getEntitlement(env, user.id);
      if (entitlement.plan !== 'pro') return errorJson('Cloud sync requires Pro.', 402);
      const sync = await env.DB.prepare('SELECT settings_json, playlists_json FROM sync_blobs WHERE user_id = ?')
        .bind(user.id)
        .first<{ settings_json: string | null; playlists_json: string | null }>();
      return json({
        settings: sync?.settings_json ? JSON.parse(sync.settings_json) : null,
        playlists: sync?.playlists_json ? JSON.parse(sync.playlists_json) : null,
        displayName: user.display_name,
        bio: user.bio,
      });
    }

    return errorJson('Not found.', 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error.';
    return errorJson(isDev(env) ? message : 'Server error.', 500);
  }
}
