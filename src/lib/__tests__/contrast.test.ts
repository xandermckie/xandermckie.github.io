import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsContrastAa } from '../contrast';

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).not.toBeNull();
    expect(ratio ?? 0).toBeGreaterThan(20);
    expect(meetsContrastAa('#000000', '#ffffff')).toBe(true);
  });

  it('fails AA for gray on white', () => {
    expect(meetsContrastAa('#bbbbbb', '#ffffff')).toBe(false);
  });
});
