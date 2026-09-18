import { describe, expect, it } from 'vitest';
import { homePitch, PRICING_WHY } from '../marketing-copy';

const FORBIDDEN_DASHES = /[—–]/;

describe('homePitch', () => {
  it('interpolates the language name into the first paragraph', () => {
    const python = homePitch('Python');
    const rust = homePitch('Rust');

    expect(python.headline).toBe("So you aren't just pushing AI slop.");
    expect(python.paragraphs[0]).toContain('behind Python');
    expect(rust.paragraphs[0]).toContain('behind Rust');
    expect(python.paragraphs).toHaveLength(2);
  });

  it('avoids em dashes and en dashes', () => {
    const pitch = homePitch('Python');
    const blob = [pitch.headline, ...pitch.paragraphs, PRICING_WHY].join(' ');
    expect(blob).not.toMatch(FORBIDDEN_DASHES);
  });
});
