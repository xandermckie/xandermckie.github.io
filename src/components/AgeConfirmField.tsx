import { MINIMUM_AGE } from '../lib/legal';
import type { AppView } from '../lib/routes';

interface AgeConfirmFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onNavigate: (view: AppView) => void;
}

export default function AgeConfirmField({ checked, onChange, onNavigate }: AgeConfirmFieldProps) {
  return (
    <label className="flex min-h-11 items-start gap-2 text-xs text-content-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-2 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        required
      />
      <span>
        I confirm I am at least {MINIMUM_AGE} years old and agree to the{' '}
        <a
          href="/terms"
          className="text-accent underline-offset-2 hover:underline"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onNavigate('terms');
          }}
        >
          Terms
        </a>{' '}
        and{' '}
        <a
          href="/privacy"
          className="text-accent underline-offset-2 hover:underline"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onNavigate('privacy');
          }}
        >
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}
