import type { Env } from '../env';
import { utcDayStart } from '../http';
import { billingConfigured } from '../polar';

export interface RatePressure {
  prefix: string;
  windows: number;
  maxCount: number;
}

export interface HttpEventRow {
  bucket: string;
  statusClass: string;
  routeGroup: string;
  count: number;
}

export interface AuditEventRow {
  id: string;
  action: string;
  targetUserId: string | null;
  createdAt: string;
}

export interface OpsStats {
  health: {
    db: boolean;
    billingConfigured: boolean;
    emailConfigured: boolean;
    environment: string;
  };
  counts: {
    users: number;
    pro: number;
    free: number;
    locked: number;
    activeSessions: number;
    completionsToday: number;
    pendingMagicLinks: number;
    deletions: number;
  };
  ratePressure: RatePressure[];
  httpErrors: HttpEventRow[];
  audit: AuditEventRow[];
}

async function countWhere(env: Env, sql: string, bind: unknown[] = []): Promise<number> {
  const stmt = env.DB.prepare(sql);
  const row = (bind.length > 0 ? stmt.bind(...bind) : stmt).first<{ n: number }>();
  return (await row)?.n ?? 0;
}

function ratePrefix(key: string): string | null {
  if (key.startsWith('magic-email:')) return 'magic-email';
  if (key.startsWith('magic:')) return 'magic';
  if (key.startsWith('checkout:')) return 'checkout';
  if (key.startsWith('ops-login:')) return 'login';
  return null;
}

export async function collectOpsStats(env: Env): Promise<OpsStats> {
  let dbOk = false;
  try {
    const ping = await env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();
    dbOk = ping?.ok === 1;
  } catch {
    dbOk = false;
  }

  const now = new Date().toISOString();
  const dayStart = utcDayStart();
  const users = await countWhere(env, 'SELECT COUNT(*) as n FROM users WHERE deleted_at IS NULL');
  const locked = await countWhere(
    env,
    'SELECT COUNT(*) as n FROM users WHERE deleted_at IS NULL AND locked_at IS NOT NULL',
  );
  const pro = await countWhere(env, "SELECT COUNT(*) as n FROM entitlements WHERE plan = 'pro'");
  const free = await countWhere(env, "SELECT COUNT(*) as n FROM entitlements WHERE plan = 'free'");
  const activeSessions = await countWhere(
    env,
    'SELECT COUNT(*) as n FROM sessions WHERE expires_at > ?',
    [now],
  );
  const completionsToday = await countWhere(
    env,
    'SELECT COUNT(*) as n FROM completions WHERE completed_at >= ?',
    [dayStart],
  );
  const pendingMagicLinks = await countWhere(
    env,
    'SELECT COUNT(*) as n FROM magic_links WHERE expires_at > ?',
    [now],
  );
  const deletions = await countWhere(env, 'SELECT COUNT(*) as n FROM deletion_log');

  const rateRows = await env.DB.prepare('SELECT key, count FROM rate_limits').all<{
    key: string;
    count: number;
  }>();
  const pressureMap = new Map<string, RatePressure>();
  for (const row of rateRows.results ?? []) {
    const prefix = ratePrefix(row.key);
    if (!prefix) continue;
    const current = pressureMap.get(prefix) ?? { prefix, windows: 0, maxCount: 0 };
    current.windows += 1;
    current.maxCount = Math.max(current.maxCount, row.count);
    pressureMap.set(prefix, current);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const events = await env.DB.prepare(
    'SELECT bucket, status_class, route_group, count FROM ops_http_events WHERE bucket >= ? ORDER BY bucket DESC LIMIT 200',
  )
    .bind(since)
    .all<{ bucket: string; status_class: string; route_group: string; count: number }>();

  const audit = await env.DB.prepare(
    'SELECT id, action, target_user_id, created_at FROM ops_audit ORDER BY created_at DESC LIMIT 50',
  ).all<{ id: string; action: string; target_user_id: string | null; created_at: string }>();

  return {
    health: {
      db: dbOk,
      billingConfigured: billingConfigured(env),
      emailConfigured: Boolean(env.RESEND_API_KEY && env.MAGIC_FROM_EMAIL),
      environment: env.ENVIRONMENT ?? 'unknown',
    },
    counts: {
      users,
      pro,
      free,
      locked,
      activeSessions,
      completionsToday,
      pendingMagicLinks,
      deletions,
    },
    ratePressure: [...pressureMap.values()],
    httpErrors: (events.results ?? []).map((row) => ({
      bucket: row.bucket,
      statusClass: row.status_class,
      routeGroup: row.route_group,
      count: row.count,
    })),
    audit: (audit.results ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      targetUserId: row.target_user_id,
      createdAt: row.created_at,
    })),
  };
}
