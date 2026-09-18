import { describe, expect, it } from 'vitest';
import previews from '../../data/interview-preview.json';

describe('interview preview catalog', () => {
  it('ships 15–20 locked cards without solution code', () => {
    expect(previews.length).toBeGreaterThanOrEqual(15);
    expect(previews.length).toBeLessThanOrEqual(20);
    for (const preview of previews) {
      expect(preview.id.startsWith('iv-')).toBe(true);
      expect(preview.locked).toBe(true);
      expect(preview.title.length).toBeGreaterThan(0);
      expect('code' in preview).toBe(false);
    }
  });
});
