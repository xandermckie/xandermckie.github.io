import { DEFAULT_LANGUAGE, metaById, metaBySlug, type LanguageId } from '../languages/meta';
import { currentMeta, getLanguageId, homePathFor } from './catalog';

export const APP_VIEWS = [
  'home',
  'typing',
  'race',
  'race-run',
  'settings',
  'progress',
  'login',
  'about',
  'guide',
  'contribute',
  'getting-started',
  'leaderboard',
  'friends',
  'pricing',
  'terms',
  'privacy',
  'refund',
  'cookies',
  'accessibility',
  'contact',
] as const;

export type AppView = (typeof APP_VIEWS)[number];

const PATH_TO_VIEW: Record<string, AppView> = {
  '/': 'home',
  '/login': 'login',
  '/settings': 'settings',
  '/progress': 'progress',
  '/guide': 'guide',
  '/contribute': 'contribute',
  '/getting-started': 'getting-started',
  '/leaderboard': 'leaderboard',
  '/race': 'race',
  '/friends': 'friends',
  '/about': 'about',
  '/pricing': 'pricing',
  '/terms': 'terms',
  '/privacy': 'privacy',
  '/refund': 'refund',
  '/cookies': 'cookies',
  '/accessibility': 'accessibility',
  '/contact': 'contact',
};

const VIEW_TO_PATH: Partial<Record<AppView, string>> = Object.fromEntries(
  Object.entries(PATH_TO_VIEW).map(([path, view]) => [view, path]),
);

/** Account, billing, and legal: one URL, current edition's chrome. */
const SHARED_VIEWS = new Set<AppView>([
  'login',
  'settings',
  'contribute',
  'about',
  'pricing',
  'terms',
  'privacy',
  'refund',
  'cookies',
  'accessibility',
  'contact',
]);

export function isSharedView(view: AppView): boolean {
  return SHARED_VIEWS.has(view);
}

export interface ParsedPath {
  view: AppView;
  languageId: LanguageId;
  languageExplicit: boolean;
}

export function parsePath(pathname: string): ParsedPath {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  const parts = trimmed.split('/').filter(Boolean);
  const slugMeta = parts[0] ? metaBySlug(parts[0]) : undefined;
  if (slugMeta) {
    const rest = parts.length === 1 ? '/' : `/${parts.slice(1).join('/')}`;
    return {
      view: PATH_TO_VIEW[rest] ?? 'home',
      languageId: slugMeta.id,
      languageExplicit: true,
    };
  }
  return {
    view: PATH_TO_VIEW[trimmed] ?? 'home',
    languageId: DEFAULT_LANGUAGE,
    languageExplicit: false,
  };
}

export function viewFromPath(pathname: string): AppView {
  return parsePath(pathname).view;
}

export function pathFromView(view: AppView, languageId: LanguageId = getLanguageId()): string | null {
  const base = VIEW_TO_PATH[view];
  if (!base) return null;
  if (isSharedView(view)) return base;
  const meta = metaById(languageId);
  if (!meta.slug) return base;
  return base === '/' ? `/${meta.slug}` : `/${meta.slug}${base}`;
}

export function languageHomePath(languageId: LanguageId = getLanguageId()): string {
  return homePathFor(metaById(languageId));
}

export function currentHomePath(): string {
  return homePathFor(currentMeta());
}

export interface LegalNavItem {
  view: AppView;
  path: string;
  label: string;
}

export const LEGAL_NAV: LegalNavItem[] = [
  { view: 'about', path: '/about', label: 'About' },
  { view: 'pricing', path: '/pricing', label: 'Pricing' },
  { view: 'terms', path: '/terms', label: 'Terms' },
  { view: 'privacy', path: '/privacy', label: 'Privacy' },
  { view: 'refund', path: '/refund', label: 'Refunds' },
  { view: 'cookies', path: '/cookies', label: 'Cookies' },
  { view: 'accessibility', path: '/accessibility', label: 'Accessibility' },
  { view: 'contact', path: '/contact', label: 'Contact' },
];
