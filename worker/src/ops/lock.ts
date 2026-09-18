import type { Env } from '../env';

export async function lockUser(
  env: Env,
  userId: string,
  reason: 'tripwire' | 'admin',
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE users SET locked_at = ?, locked_reason = ? WHERE id = ?')
    .bind(now, reason, userId)
    .run();
  await revokeUserSessions(env, userId);
}

export async function unlockUser(env: Env, userId: string): Promise<void> {
  await env.DB.prepare('UPDATE users SET locked_at = NULL, locked_reason = NULL WHERE id = ?')
    .bind(userId)
    .run();
}

export async function revokeUserSessions(env: Env, userId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}
