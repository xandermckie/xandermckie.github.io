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

export function viewFromPath(pathname: string): AppView {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return PATH_TO_VIEW[trimmed] ?? 'home';
}

export function pathFromView(view: AppView): string | null {
  return VIEW_TO_PATH[view] ?? null;
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
