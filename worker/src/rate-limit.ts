import type { Env } from './env';

const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 8;

export async function rateLimit(
  env: Env,
  key: string,
  limit = DEFAULT_LIMIT,
): Promise<boolean> {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ window_start: number; count: number }>();

  if (!row || now - row.window_start > WINDOW_MS) {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)',
    )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= limit) return false;
  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}
