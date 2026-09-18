import { pythonKit } from './python';
import { rustKit } from './rust';
import type { LanguageId, LanguageKit } from './types';

export type { LanguageId, LanguageKit, LanguageMeta } from './types';
export { LANGUAGE_METAS, DEFAULT_LANGUAGE, PYTHON_META, RUST_META, metaById, isLanguageId } from './meta';

const KITS: Record<LanguageId, LanguageKit> = {
  python: pythonKit,
  rust: rustKit,
};

/** Closed registry. Adding a language is one kit file plus one line here. */
export function getKit(id: LanguageId): LanguageKit {
  return KITS[id];
}

export function allKits(): LanguageKit[] {
  return [pythonKit, rustKit];
}
