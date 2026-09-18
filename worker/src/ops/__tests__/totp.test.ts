import { describe, expect, it } from 'vitest';
import { generateTotp, verifyTotp } from '../totp';

describe('TOTP', () => {
  it('matches the RFC 6232 SHA-1 6-digit vector at t=59', async () => {
    const secret = new TextEncoder().encode('12345678901234567890');
    await expect(generateTotp(secret, 59_000)).resolves.toBe('287082');
  });

  it('accepts the previous and next time step', async () => {
    const secret = new TextEncoder().encode('12345678901234567890');
    const code = await generateTotp(secret, 59_000);
    await expect(verifyTotp(secret, code, 59_000 + 30_000)).resolves.toBe(true);
    await expect(verifyTotp(secret, '000000', 59_000)).resolves.toBe(false);
  });
});
