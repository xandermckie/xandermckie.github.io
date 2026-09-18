import { afterEach, describe, expect, it } from 'vitest';
import { parsePath, pathFromView, viewFromPath } from '../routes';
import { setLanguageId } from '../catalog';

describe('routes', () => {
  afterEach(() => {
    setLanguageId('python');
  });

  it('maps legal paths', () => {
    expect(viewFromPath('/privacy')).toBe('privacy');
    expect(viewFromPath('/terms/')).toBe('terms');
    expect(pathFromView('refund')).toBe('/refund');
  });

  it('falls back to home', () => {
    expect(viewFromPath('/nope')).toBe('home');
  });

  it('keeps Python URLs at the site root', () => {
    expect(parsePath('/').languageId).toBe('python');
    expect(parsePath('/guide')).toEqual({
      view: 'guide',
      languageId: 'python',
      languageExplicit: false,
    });
    expect(pathFromView('home', 'python')).toBe('/');
    expect(pathFromView('guide', 'python')).toBe('/guide');
  });

  it('prefixes catalog routes for RustEase', () => {
    expect(parsePath('/rust')).toEqual({
      view: 'home',
      languageId: 'rust',
      languageExplicit: true,
    });
    expect(parsePath('/rust/guide')).toEqual({
      view: 'guide',
      languageId: 'rust',
      languageExplicit: true,
    });
    expect(pathFromView('home', 'rust')).toBe('/rust');
    expect(pathFromView('guide', 'rust')).toBe('/rust/guide');
    expect(pathFromView('leaderboard', 'rust')).toBe('/rust/leaderboard');
  });

  it('leaves shared billing and legal paths unprefixed', () => {
    expect(pathFromView('settings', 'rust')).toBe('/settings');
    expect(pathFromView('pricing', 'rust')).toBe('/pricing');
    expect(parsePath('/settings')).toEqual({
      view: 'settings',
      languageId: 'python',
      languageExplicit: false,
    });
  });
});
