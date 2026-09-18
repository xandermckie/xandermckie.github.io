import { hmacSha256Hex, timingSafeEqualUtf8 } from '../crypto';

export function normalizeOpsPath(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withSlash.replace(/\/+$/, '');
  return collapsed.length > 0 ? collapsed : null;
}

export async function pathMatchesOpsPrefix(
  pathname: string,
  opsPath: string,
  secret: string,
): Promise<boolean> {
  const prefix = pathname.slice(0, opsPath.length);
  const expected = await hmacSha256Hex(secret, opsPath);
  const given = await hmacSha256Hex(secret, prefix.padEnd(opsPath.length, '\0'));
  const hmacOk = timingSafeEqualUtf8(expected, given) && prefix === opsPath;
  if (!hmacOk) return false;
  return pathname.length === opsPath.length || pathname.charAt(opsPath.length) === '/';
}

export function opsRestPath(pathname: string, opsPath: string): string {
  if (pathname === opsPath) return '';
  return pathname.slice(opsPath.length);
}
