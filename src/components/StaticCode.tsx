import { useMemo } from 'react';
import { tokenizeToCells } from '../lib/highlight';
import { useLanguage } from '../context/LanguageContext';

interface StaticCodeProps {
  code: string;
  lineNumbers?: boolean;
}

/** Read-only, syntax-highlighted code block (no typing validation state). */
export default function StaticCode({ code, lineNumbers = true }: StaticCodeProps) {
  const { kit } = useLanguage();
  const lines = useMemo(() => {
    const cells = tokenizeToCells(code, kit.prismLanguage);
    const result: Array<typeof cells> = [];
    let buf: typeof cells = [];
    cells.forEach((cell) => {
      if (cell.char === '\n') {
        result.push(buf);
        buf = [];
      } else {
        buf.push(cell);
      }
    });
    result.push(buf);
    return result;
  }, [code, kit.prismLanguage]);

  return (
    <pre
      className="overflow-x-auto rounded-lg border border-border-tertiary bg-background-secondary p-4 font-mono leading-[1.6]"
      style={{ fontSize: 'var(--font-code-size)' }}
    >
      <code>
        {lines.map((cells, li) => (
          <div key={li} className="flex">
            {lineNumbers && (
              <span className="select-none pr-4 text-right text-content-tertiary" style={{ minWidth: '2.5ch' }}>
                {li + 1}
              </span>
            )}
            <span className="whitespace-pre">
              {cells.length === 0
                ? '​'
                : cells.map((c, ci) => (
                    <span key={ci} className={c.className}>
                      {c.char}
                    </span>
                  ))}
            </span>
          </div>
        ))}
      </code>
    </pre>
  );
}
