import type { ReactNode } from 'react';
import { LEGAL_DRAFT_NOTICE, OPERATOR_LEGAL_NAME } from '../lib/legal';
import { LEGAL_NAV } from '../lib/routes';
import type { AppView } from '../lib/routes';

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
  onNavigate: (view: AppView) => void;
}

export default function LegalPage({ title, updated, children, onNavigate }: LegalPageProps) {
  return (
    <article className="mx-auto w-full max-w-2xl pb-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-content-tertiary">Legal</p>
        <h1 className="mt-1 text-lg font-medium text-content-primary">{title}</h1>
        <p className="mt-2 text-xs text-content-tertiary">Last updated {updated}. Operator: {OPERATOR_LEGAL_NAME}.</p>
      </header>

      <p role="note" className="mb-8 rounded-md border border-warning/40 bg-background-secondary px-4 py-3 text-sm text-content-secondary">
        {LEGAL_DRAFT_NOTICE}
      </p>

      <nav aria-label="Legal documents" className="mb-8 flex flex-wrap gap-2">
        {LEGAL_NAV.map((item) => {
          const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
          const isCurrent = item.path === currentPath;
          return (
            <a
              key={item.path}
              href={item.path}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.view);
              }}
              className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-xs ${
                isCurrent
                  ? 'border-accent text-accent'
                  : 'border-border-tertiary text-content-secondary hover:border-accent hover:text-accent'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-content-secondary">{children}</div>
    </article>
  );
}
