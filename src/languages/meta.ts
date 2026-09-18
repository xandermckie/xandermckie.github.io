import type { LanguageId, LanguageMeta } from './types';

export type { LanguageId, LanguageMeta } from './types';

export const DEFAULT_LANGUAGE: LanguageId = 'python';

export const SHARED_STORAGE_PREFIX = 'pytyping:';

export const PYTHON_META: LanguageMeta = {
  id: 'python',
  slug: '',
  productName: 'PyTyping',
  languageName: 'Python',
  wordmark: { lead: 'py', accent: 'typing' },
  storagePrefix: 'pytyping:',
  friendCodePrefix: 'PYT1:',
  backupApp: 'pytyping',
  friendShareApp: 'pytyping-friend',
  prismLanguage: 'python',
  homeHeadline: 'Learn Python by typing it.',
  homeSubhead:
    'Type real Python snippets one character at a time. When you finish, take a short quiz and read a breakdown of what you typed.',
  guideLabel: 'Python guide',
  aboutBlurb:
    'helps you learn Python by typing real code, with short quizzes and breakdowns after each exercise.',
  exerciseAttribution:
    'Curated free exercises are adapted from the official Python documentation and Real Python, used for educational purposes; all other free exercises are generated originals. Python documentation is © the Python Software Foundation.',
  trademarkBlurb:
    '“Python” and the Python logos are trademarks of the Python Software Foundation. PyTyping is not affiliated with or endorsed by the PSF.',
  typingAriaLabel: 'Type the displayed Python code',
  interviewIdPrefix: 'iv-',
  interviewSourceUrl: 'https://docs.python.org/3/tutorial/index.html',
  interviewSourceLabel: 'PyTyping Interview',
  switcherLabel: 'try pytyping!',
  documentDescription: 'PyTyping: learn Python by typing real code, character by character.',
};

export const RUST_META: LanguageMeta = {
  id: 'rust',
  slug: 'rust',
  productName: 'RustEase',
  languageName: 'Rust',
  wordmark: { lead: 'rust', accent: 'ease' },
  caretColor: '#dea584',
  storagePrefix: 'rustease:',
  friendCodePrefix: 'RSE1:',
  backupApp: 'rustease',
  friendShareApp: 'rustease-friend',
  prismLanguage: 'rust',
  homeHeadline: 'Learn Rust by typing it.',
  homeSubhead:
    'Type real Rust snippets one character at a time. When you finish, take a short quiz and read a breakdown of what you typed.',
  guideLabel: 'Rust guide',
  aboutBlurb:
    'helps you learn Rust by typing real code, with short quizzes and breakdowns after each exercise.',
  exerciseAttribution:
    'Curated free exercises are adapted from The Rust Book and other official Rust docs, used for educational purposes; all other free exercises are generated originals. Rust documentation is © the Rust Project Developers.',
  trademarkBlurb:
    'Rust and the Rust logo are trademarks of the Rust Foundation. RustEase is not affiliated with or endorsed by the Rust Foundation.',
  typingAriaLabel: 'Type the displayed Rust code',
  interviewIdPrefix: 'riv-',
  interviewSourceUrl: 'https://doc.rust-lang.org/book/',
  interviewSourceLabel: 'RustEase Interview',
  switcherLabel: 'try rust ease!',
  documentDescription: 'RustEase: learn Rust by typing real code, character by character.',
};

export const LANGUAGE_METAS: readonly LanguageMeta[] = [PYTHON_META, RUST_META];

export function metaById(id: LanguageId): LanguageMeta {
  return LANGUAGE_METAS.find((meta) => meta.id === id) ?? PYTHON_META;
}

export function metaBySlug(slug: string): LanguageMeta | undefined {
  return LANGUAGE_METAS.find((meta) => meta.slug !== '' && meta.slug === slug);
}

export function isLanguageId(value: string): value is LanguageId {
  return LANGUAGE_METAS.some((meta) => meta.id === value);
}
