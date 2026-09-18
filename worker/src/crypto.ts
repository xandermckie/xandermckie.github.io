export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export function timingSafeEqualUtf8(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  return timingSafeEqualBytes(encoder.encode(left), encoder.encode(right));
}

export async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeSecret(secret: string): Uint8Array {
  const stripped = secret.replace(/^(whsec_|polar_whs_)/, '');
  try {
    const bin = atob(stripped);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return new TextEncoder().encode(secret);
  }
}

export async function verifyStandardWebhook(
  secret: string,
  headers: Headers,
  body: string,
): Promise<boolean> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatureHeader = headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const signed = `${id}.${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    decodeSecret(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
  const expected = new Uint8Array(mac);

  const candidates = signatureHeader.split(' ').map((part) => {
    const [, value] = part.split(',', 2);
    return value ?? part;
  });

  for (const candidate of candidates) {
    try {
      const given = Uint8Array.from(atob(candidate), (c) => c.charCodeAt(0));
      if (timingSafeEqualBytes(expected, given)) return true;
    } catch {
      continue;
    }
  }
  return false;
}
