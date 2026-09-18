import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

describe('public source stealth', () => {
  it('does not mention the operator console in src/', () => {
    const root = join(process.cwd(), 'src');
    const files = walk(root).filter((file) => /\.(ts|tsx|js|css|html)$/.test(file));
    const needles = ['OPS' + '_PATH', 'ops_' + 'sessions', 'admin' + ' panel', 'admin' + 'Panel'];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const needle of needles) {
        if (text.includes(needle)) hits.push(`${file}: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
