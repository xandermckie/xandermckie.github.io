import { useLanguage } from '../context/LanguageContext';

export default function PythonGuide() {
  const { kit } = useLanguage();

  return (
    <div className="mx-auto w-full max-w-5xl pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-medium text-content-primary">{kit.guideLabel}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">
          Quick reference for newcomers. Read what you need, then practice on the Exercises tab. Nothing
          here is required before you start typing.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {kit.guide.map((section) => (
          <details
            key={section.id}
            className="group rounded-lg border border-border-tertiary bg-background-secondary"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-content-primary marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                {section.title}
                <span className="text-content-tertiary transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="border-t border-border-tertiary px-4 py-4">
              <p className="text-sm leading-relaxed text-content-secondary">{section.summary}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-content-secondary">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              {section.examples.length > 0 && (
                <pre
                  className="mt-4 overflow-x-auto rounded-md border border-border-tertiary bg-background-primary p-3 font-mono text-xs leading-relaxed text-content-primary"
                  aria-label={`Example: ${section.title}`}
                >
                  {section.examples.join('\n\n')}
                </pre>
              )}
            </div>
          </details>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-base font-medium text-content-primary">External resources</h2>
        <div className="flex flex-col gap-8">
          {kit.resources.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-content-tertiary">
                {group.heading}
              </h3>
              <ul className="flex flex-col gap-3">
                {group.items.map((item) => (
                  <li
                    key={item.url}
                    className="rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {item.label}
                      </a>
                      <span className="text-xs text-content-tertiary">{item.tag}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
