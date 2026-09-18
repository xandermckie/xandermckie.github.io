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

/**
 * Shared mark: a terminal prompt `>` with a caret bar — the core motif of the
 * typing loop. The chevron uses currentColor; the caret uses the kit color
 * (RustEase orange) or the theme accent.
 */
export default function Logo({ size = 28, wordmark = true, className = '', kit }: LogoProps) {
  const meta = kit ?? currentMeta();
  const caretFill = meta.caretColor ?? 'var(--color-accent)';
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
        <path
          d="M10 11 L16 16 L10 21"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="17" y="19.5" width="7" height="2.6" rx="1.3" style={{ fill: caretFill }} />
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
