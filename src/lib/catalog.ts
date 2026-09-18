/**
 * Active language kit id. Booted from the URL before React reads storage so
 * progress keys use the right prefix on first paint.
 */
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_METAS,
  metaById,
  metaBySlug,
  type LanguageId,
  type LanguageMeta,
} from '../languages/meta';

let currentId: LanguageId = DEFAULT_LANGUAGE;

export function languageIdFromPath(pathname: string): LanguageId {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  const first = trimmed.split('/').filter(Boolean)[0] ?? '';
  const matched = metaBySlug(first);
  return matched?.id ?? DEFAULT_LANGUAGE;
}

export function bootCatalogFromPath(pathname: string): LanguageId {
  currentId = languageIdFromPath(pathname);
  return currentId;
}

export function getLanguageId(): LanguageId {
  return currentId;
}

export function setLanguageId(id: LanguageId): void {
  currentId = id;
}

export function currentMeta(): LanguageMeta {
  return metaById(currentId);
}

export function otherMetas(): LanguageMeta[] {
  return LANGUAGE_METAS.filter((meta) => meta.id !== currentId);
}

export function homePathFor(meta: LanguageMeta): string {
  return meta.slug ? `/${meta.slug}` : '/';
}
