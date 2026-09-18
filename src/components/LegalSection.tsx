import type { ReactNode } from 'react';

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

export default function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-content-primary">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
