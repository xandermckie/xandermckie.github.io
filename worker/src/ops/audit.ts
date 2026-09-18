import type { Env } from '../env';
import { sha256Hex } from '../crypto';

export interface AuditInput {
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function hashRequestIp(env: Env, request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  return sha256Hex(`${env.SESSION_SECRET}:ip:${ip}`);
}

export async function hashUserAgent(env: Env, request: Request): Promise<string> {
  const ua = request.headers.get('User-Agent') ?? '';
  return sha256Hex(`${env.SESSION_SECRET}:ua:${ua}`);
}

export async function writeAudit(env: Env, request: Request, input: AuditInput): Promise<void> {
  const ipHash = await hashRequestIp(env, request);
  const uaHash = await hashUserAgent(env, request);
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  await env.DB.prepare(
    `INSERT INTO ops_audit (id, action, target_user_id, ip_hash, ua_hash, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      input.action,
      input.targetUserId ?? null,
      ipHash,
      uaHash,
      metadata,
      new Date().toISOString(),
    )
    .run();
}

export async function sendOpsAlert(env: Env, subject: string, text: string): Promise<void> {
  const to = env.OPS_ALERT_EMAIL?.trim();
  if (!to || !env.RESEND_API_KEY || !env.MAGIC_FROM_EMAIL) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAGIC_FROM_EMAIL,
        to: [to],
        subject,
        text,
      }),
    });
  } catch {
    // Alert delivery is best-effort; never fail the request.
  }
}
