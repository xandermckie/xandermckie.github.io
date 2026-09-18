import { BUY_ME_A_COFFEE_URL, GITHUB_URL, MONKEYTYPE_URL } from '../lib/links';
import { APP_VERSION, AUTHOR_NAME } from '../lib/links';
import { LEGAL_NAV } from '../lib/routes';
import type { AppView } from '../lib/routes';

interface FooterProps {
  hidden: boolean;
  onNavigate: (view: AppView) => void;
}

const TIPS: Array<{ keys: string; label: string }> = [
  { keys: 'ctrl/⌘ + k', label: 'command line' },
  { keys: 'esc', label: 'menu' },
  { keys: 'tab', label: 'indent' },
];

export default function Footer({ hidden, onNavigate }: FooterProps) {
  return (
    <footer
      id="site-footer"
      className={`px-4 pb-6 pt-4 transition-opacity duration-300 sm:px-6 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 text-xs text-content-tertiary">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {TIPS.map((t) => (
            <span key={t.keys} className="flex items-center gap-1.5">
              <kbd className="rounded-md border border-border-tertiary bg-background-secondary px-1.5 py-0.5 font-mono text-content-secondary">
                {t.keys}
              </kbd>
              {t.label}
            </span>
          ))}
        </div>

        <nav aria-label="Legal" className="flex flex-wrap gap-x-3 gap-y-2 border-t border-border-tertiary pt-3">
          {LEGAL_NAV.map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.view);
              }}
              className="min-h-11 inline-flex items-center text-content-secondary underline-offset-2 hover:text-accent hover:underline"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="font-mono">
            py<span className="text-accent">typing</span> v{APP_VERSION}
          </span>
          <span>
            created by{' '}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-secondary underline-offset-2 hover:text-accent hover:underline"
            >
              {AUTHOR_NAME}
            </a>
          </span>
          <span>
            inspired by{' '}
            <a
              href={MONKEYTYPE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-content-secondary underline-offset-2 hover:text-accent hover:underline"
            >
              Monkeytype
            </a>
          </span>
          <a
            href={BUY_ME_A_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-content-secondary underline-offset-2 hover:text-accent hover:underline"
          >
            Buy me a coffee
          </a>
        </div>
      </div>
    </footer>
  );
}
