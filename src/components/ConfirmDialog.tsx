import { useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: cancelRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md rounded-lg border border-border-secondary bg-background-primary p-5 shadow-[var(--shadow-md)]"
      >
        <h2 id="confirm-dialog-title" className="text-base font-medium text-content-primary">
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mt-2 text-sm text-content-secondary">
          {description}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-secondary hover:bg-background-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-11 rounded-md border px-4 py-2 text-sm ${
              destructive
                ? 'border-error text-error hover:bg-background-secondary'
                : 'border-accent text-accent hover:bg-background-secondary'
            } disabled:opacity-60`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
