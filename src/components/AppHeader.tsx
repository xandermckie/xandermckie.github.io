import { useRef, useState } from 'react';
import AccountMenu from './AccountMenu';
import DisclosurePanel from './DisclosurePanel';
import Logo from './Logo';
import { useLanguage } from '../context/LanguageContext';
import { homePathFor } from '../lib/catalog';
import type { AppView } from '../lib/routes';
import type { LanguageId } from '../languages/types';

export type { AppView };

interface NavItem {
  id: AppView;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'home', label: 'Exercises' },
  { id: 'guide', label: 'Guide' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'race', label: 'Race' },
  { id: 'progress', label: 'Progress' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'settings', label: 'Settings' },
  { id: 'contribute', label: 'Contribute' },
];

const MOBILE_EXTRA_NAV: NavItem[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'about', label: 'About & legal' },
];

interface AppHeaderProps {
  view: AppView;
  chromeHidden: boolean;
  onNavigate: (view: AppView) => void;
  onGoHome: () => void;
  onShowLogin: () => void;
  onSwitchLanguage: (id: LanguageId) => void;
}

function navButtonClass(active: boolean): string {
  return `w-full rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${
    active
      ? 'bg-[var(--color-accent-subtle)] text-accent'
      : 'text-content-secondary hover:bg-background-secondary hover:text-content-primary'
  }`;
}

function desktopNavClass(active: boolean): string {
  return `shrink-0 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
    active
      ? 'text-accent'
      : 'text-content-secondary hover:bg-background-secondary hover:text-content-primary'
  }`;
}

export default function AppHeader({
  view,
  chromeHidden,
  onNavigate,
  onGoHome,
  onShowLogin,
  onSwitchLanguage,
}: AppHeaderProps) {
  const { kit, otherKits } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  const navigate = (target: AppView) => {
    onNavigate(target);
    setMenuOpen(false);
  };

  const mobileNavItems = [...PRIMARY_NAV, ...MOBILE_EXTRA_NAV];

  return (
    <header
      className={`sticky top-0 z-30 border-b border-border-tertiary bg-background-primary/95 backdrop-blur-md transition-opacity duration-300 ${
        chromeHidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onGoHome}
            className="shrink-0 rounded-md"
            aria-label={`${kit.productName} home`}
          >
            <Logo size={24} kit={kit} />
          </button>
          <nav aria-label="Language editions" className="flex flex-wrap items-center gap-1">
            {otherKits.map((other) => (
              <a
                key={other.id}
                href={homePathFor(other)}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  onSwitchLanguage(other.id);
                  setMenuOpen(false);
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-content-secondary hover:bg-background-secondary hover:text-content-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm"
              >
                <Logo size={20} wordmark={false} kit={other} />
                <span>{other.switcherLabel}</span>
              </a>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {/* Desktop nav */}
          <nav className="hidden gap-0.5 md:flex" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const active = view === item.id || (item.id === 'race' && view === 'race-run');
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item.id)}
                  className={desktopNavClass(active)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Mobile menu toggle */}
          <button
            ref={menuToggleRef}
            type="button"
            className="rounded-md border border-border-tertiary px-2.5 py-1.5 text-sm text-content-secondary hover:bg-background-secondary md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M2 5H16M2 9H16M2 13H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <div className="border-l border-border-tertiary pl-1 sm:pl-2">
            <AccountMenu onShowLogin={onShowLogin} onManage={() => navigate('settings')} />
          </div>
        </div>
      </div>

      <DisclosurePanel
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        returnFocusRef={menuToggleRef}
        initialFocusRef={firstMenuItemRef}
        ariaLabel="Site navigation"
        panelClassName="absolute left-0 right-0 top-full z-50 border-b border-border-tertiary bg-background-primary shadow-[var(--shadow-md)] md:hidden"
      >
        <nav id="mobile-nav-panel" className="mx-auto max-w-5xl px-4 py-2 sm:px-6" aria-label="Primary">
          <ul className="flex flex-col gap-0.5 py-1">
            {mobileNavItems.map((item, index) => {
              const active = view === item.id || (item.id === 'race' && view === 'race-run');
              return (
                <li key={item.id}>
                  <button
                    ref={index === 0 ? firstMenuItemRef : undefined}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                    className={navButtonClass(active)}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </DisclosurePanel>
      </div>
    </header>
  );
}
