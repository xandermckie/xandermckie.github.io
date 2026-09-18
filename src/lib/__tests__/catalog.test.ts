import { afterEach, describe, expect, it } from 'vitest';
import { setLanguageId } from '../catalog';
import { loadJSON, saveJSON } from '../storage';
import { tokenizeToCells } from '../highlight';
import { getExercises } from '../exercises';
import rustPreviews from '../../data/rust/interview-preview.json';
import pythonPreviews from '../../data/interview-preview.json';

describe('language kits', () => {
  afterEach(() => {
    setLanguageId('python');
  });

  it('isolates rust progress keys from python', () => {
    const mem = new Map<string, string>();
    const store = {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    } as Storage;

    setLanguageId('python');
    saveJSON('progress:guest', { python: true }, store);
    setLanguageId('rust');
    saveJSON('progress:guest', { rust: true }, store);

    setLanguageId('python');
    expect(loadJSON('progress:guest', {}, store)).toEqual({ python: true });
    setLanguageId('rust');
    expect(loadJSON('progress:guest', {}, store)).toEqual({ rust: true });
    expect(mem.has('pytyping:progress:guest')).toBe(true);
    expect(mem.has('rustease:progress:guest')).toBe(true);
  });

  it('loads rust exercises when the rust kit is active', () => {
    setLanguageId('rust');
    const exercises = getExercises();
    expect(exercises.length).toBeGreaterThan(50);
    expect(exercises[0]?.id.startsWith('rs-')).toBe(true);
  });

  it('tokenizes rust keywords', () => {
    const cells = tokenizeToCells('fn main() {}', 'rust');
    const joined = cells.map((cell) => cell.char).join('');
    expect(joined).toBe('fn main() {}');
    expect(cells.some((cell) => cell.className.includes('keyword'))).toBe(true);
  });
});

describe('interview previews', () => {
  it('ships python titles without solution code', () => {
    expect(pythonPreviews.length).toBeGreaterThanOrEqual(15);
    expect(pythonPreviews.length).toBeLessThanOrEqual(20);
    for (const preview of pythonPreviews) {
      expect(preview.id.startsWith('iv-')).toBe(true);
      expect(preview.locked).toBe(true);
      expect('code' in preview).toBe(false);
    }
  });

  it('ships rust titles with riv- ids and no solution code', () => {
    expect(rustPreviews.length).toBeGreaterThanOrEqual(15);
    expect(rustPreviews.length).toBeLessThanOrEqual(20);
    for (const preview of rustPreviews) {
      expect(preview.id.startsWith('riv-')).toBe(true);
      expect(preview.locked).toBe(true);
      expect('code' in preview).toBe(false);
    }
  });
});
