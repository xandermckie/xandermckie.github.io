import type { Env } from '../env';

export type RouteGroup = 'auth' | 'billing' | 'account' | 'sync' | 'other';

export function routeGroupFor(path: string): RouteGroup {
  if (path.startsWith('/api/auth') || path === '/api/me') return 'auth';
  if (
    path.startsWith('/api/checkout') ||
    path.startsWith('/api/portal') ||
    path.startsWith('/api/webhooks')
  ) {
    return 'billing';
  }
  if (path.startsWith('/api/account')) return 'account';
  if (path.startsWith('/api/sync')) return 'sync';
  return 'other';
}

export function statusClassFor(status: number): string {
  return `${Math.floor(status / 100) * 100}`;
}

export function minuteBucket(at = new Date()): string {
  const ms = Math.floor(at.getTime() / 60_000) * 60_000;
  return new Date(ms).toISOString();
}

export async function recordHttpEvent(env: Env, path: string, status: number): Promise<void> {
  if (status < 400) return;
  try {
    const bucket = minuteBucket();
    const statusClass = statusClassFor(status);
    const group = routeGroupFor(path);
    await env.DB.prepare(
      `INSERT INTO ops_http_events (bucket, status_class, route_group, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(bucket, status_class, route_group) DO UPDATE SET count = count + 1`,
    )
      .bind(bucket, statusClass, group)
      .run();
  } catch {
    // Metrics must never break API responses.
  }
}
