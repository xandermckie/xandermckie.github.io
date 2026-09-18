import type { LanguageMeta } from '../languages/types';
import { currentMeta } from '../lib/catalog';

interface LogoProps {
  /** Mark height/width in px. */
  size?: number;
  /** Show the product wordmark next to the mark. */
  wordmark?: boolean;
  className?: string;
  /** Defaults to the active language kit. */
  kit?: LanguageMeta;
}

/** Six teeth, 60° apart. Filled rounded rects keep the silhouette at 20px. */
const RUST_COG_TEETH = [0, 60, 120, 180, 240, 300] as const;

/**
 * Shared mark: a terminal window. PyTyping keeps the `>` prompt and caret;
 * RustEase uses a matching line-weight cog with the rust hub as its caret.
 */
export default function Logo({ size = 28, wordmark = true, className = '', kit }: LogoProps) {
  const meta = kit ?? currentMeta();
  const caretFill = meta.caretColor ?? 'var(--color-accent)';
  const isRust = meta.id === 'rust';

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label={`${meta.productName} logo`}
        className="shrink-0"
      >
        <rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="7"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        {isRust ? (
          <g>
            {RUST_COG_TEETH.map((angle) => (
              <rect
                key={angle}
                x="14.2"
                y="5.35"
                width="3.6"
                height="5.5"
                rx="1.05"
                fill="currentColor"
                transform={`rotate(${angle} 16 16)`}
              />
            ))}
            <circle cx="16" cy="16" r="5.85" fill="none" stroke="currentColor" strokeWidth="2.6" />
            <circle cx="16" cy="16" r="2.35" style={{ fill: caretFill }} />
          </g>
        ) : (
          <g>
            <path
              d="M10 11 L16 16 L10 21"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="17" y="19.5" width="7" height="2.6" rx="1.3" style={{ fill: caretFill }} />
          </g>
        )}
      </svg>
      {wordmark && (
        <span className="font-mono text-base font-medium leading-none text-content-primary">
          {meta.wordmark.lead}
          <span className="text-accent">{meta.wordmark.accent}</span>
        </span>
      )}
    </span>
  );
}
