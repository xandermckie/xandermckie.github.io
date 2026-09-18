/**
 * Syntax-highlighting bridge to Prism. Instead of letting Prism render HTML
 * (which would fight with our per-character validation overlay), we ask Prism
 * only to *tokenize* the code, then flatten the token tree into one cell per
 * character. Each cell carries the Prism token class so we can color it, while
 * the typing component independently layers correct / incorrect / pending /
 * caret state on top — full control, one render pass.
 */
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import { currentMeta } from './catalog';

export interface CharCell {
  char: string;
  /** Space-separated Prism token classes, e.g. "token keyword" ('' = plain). */
  className: string;
}

function walk(token: string | Prism.Token, inherited: string, out: CharCell[]): void {
  if (typeof token === 'string') {
    for (const char of token) out.push({ char, className: inherited });
    return;
  }
  // Nest the type onto whatever class we inherited from parent tokens.
  const className = token.type ? `${inherited} token ${token.type}`.trim() : inherited;
  const content = token.content;
  if (typeof content === 'string') {
    for (const char of content) out.push({ char, className });
  } else if (Array.isArray(content)) {
    for (const child of content) walk(child, className, out);
  } else {
    walk(content, className, out);
  }
}

/** Tokenize source into a flat, per-character cell array. */
export function tokenizeToCells(code: string, language: string = currentMeta().prismLanguage): CharCell[] {
  try {
    const grammar = Prism.languages[language] ?? Prism.languages.python;
    const tokens = Prism.tokenize(code, grammar);
    const cells: CharCell[] = [];
    for (const token of tokens) walk(token, '', cells);
    return cells;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[PyTyping] Highlight failed, using plain text:', err);
    return [...code].map((char) => ({ char, className: '' }));
  }
}
