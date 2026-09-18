import { useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { FREE_DAILY_CAP, PRO_PRICE_LABEL, PRO_INTERVAL_LABEL } from '../lib/legal';

interface UpgradeModalProps {
  open: boolean;
  reason: 'cap' | 'interview' | 'feature';
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onUpgrade: () => void;
  onSignIn?: () => void;
  authenticated: boolean;
}

function reasonText(reason: UpgradeModalProps['reason']): { title: string; body: string } {
  if (reason === 'cap') {
    return {
      title: 'Daily free limit reached',
      body: `Free accounts can complete ${FREE_DAILY_CAP} exercises per UTC day. Pro removes the cap.`,
    };
  }
  if (reason === 'interview') {
    return {
      title: 'Interview pack is a Pro feature',
      body: 'Harder, interview-style problems are included with PyTyping Pro.',
    };
  }
  return {
    title: 'This feature is included with Pro',
    body: 'Cloud sync, exclusive themes, playlists, and profile extras ship with PyTyping Pro.',
  };
}

export default function UpgradeModal({
  open,
  reason,
  busy = false,
  error,
  onClose,
  onUpgrade,
  onSignIn,
  authenticated,
}: UpgradeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: closeRef });
  if (!open) return null;
  const copy = reasonText(reason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        aria-describedby="upgrade-desc"
        className="w-full max-w-md rounded-lg border border-border-secondary bg-background-primary p-5 shadow-[var(--shadow-md)]"
      >
        <h2 id="upgrade-title" className="text-base font-medium text-content-primary">
          {copy.title}
        </h2>
        <p id="upgrade-desc" className="mt-2 text-sm text-content-secondary">
          {copy.body} {PRO_PRICE_LABEL} per {PRO_INTERVAL_LABEL}, auto-renews until you cancel. Polar processes payment.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-secondary hover:bg-background-secondary"
          >
            Not now
          </button>
          {!authenticated && onSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-secondary"
            >
              Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={onUpgrade}
              disabled={busy}
              className="min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-secondary disabled:opacity-60"
            >
              {busy ? 'Redirecting…' : `Upgrade to Pro — ${PRO_PRICE_LABEL}/${PRO_INTERVAL_LABEL}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
