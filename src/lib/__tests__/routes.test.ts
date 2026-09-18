import { describe, expect, it } from 'vitest';
import { pathFromView, viewFromPath } from '../routes';

describe('routes', () => {
  it('maps legal paths', () => {
    expect(viewFromPath('/privacy')).toBe('privacy');
    expect(viewFromPath('/terms/')).toBe('terms');
    expect(pathFromView('refund')).toBe('/refund');
  });

  it('falls back to home', () => {
    expect(viewFromPath('/nope')).toBe('home');
  });
});
