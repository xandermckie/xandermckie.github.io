export function decodeBase32(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(secret: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(mac);
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let remaining = counter;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}

function truncateHotp(hmac: Uint8Array): string {
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const bin =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

export async function generateTotp(
  secret: Uint8Array | string,
  atMs = Date.now(),
  stepSeconds = 30,
): Promise<string> {
  const key = typeof secret === 'string' ? decodeBase32(secret) : secret;
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const hmac = await hmacSha1(key, counterBytes(counter));
  return truncateHotp(hmac);
}

export async function verifyTotp(
  secret: Uint8Array | string,
  code: string,
  atMs = Date.now(),
  stepSeconds = 30,
  window = 1,
): Promise<boolean> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = await generateTotp(secret, atMs + offset * stepSeconds * 1000, stepSeconds);
    if (candidate === trimmed) return true;
  }
  return false;
}
