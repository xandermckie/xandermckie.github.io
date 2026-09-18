import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export default function DeleteAccountModal({ open, onClose, onDelete }: DeleteAccountModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalA11y({
    open,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
  });

  if (!open) return null;

  const canDelete = typed === 'DELETE';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="w-full max-w-md rounded-lg border border-border-secondary bg-background-primary p-5 shadow-[var(--shadow-md)]"
      >
        <h2 id="delete-account-title" className="text-base font-medium text-content-primary">
          Delete account
        </h2>
        <p className="mt-2 text-sm text-content-secondary">
          This removes saved progress on this device. If you are signed in to a cloud account, we also cancel Pro,
          delete Polar billing data we can reach, and erase server copies of your account.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-content-secondary">
            Type DELETE to confirm
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="min-h-11 rounded-md border border-border-tertiary bg-background-secondary px-3 py-2 text-sm text-content-primary"
              autoComplete="off"
              aria-required="true"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-11 rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-secondary hover:bg-background-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canDelete || busy}
              className="min-h-11 rounded-md border border-error px-4 py-2 text-sm text-error hover:bg-background-secondary disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete my data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
