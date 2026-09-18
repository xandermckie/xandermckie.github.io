import { FREE_DAILY_CAP, PRO_PRICE_LABEL, PRO_INTERVAL_LABEL, REFUND_DAYS } from '../lib/legal';
import type { AppView } from '../lib/routes';
import { useEntitlement } from '../context/EntitlementContext';

interface PricingPageProps {
  onNavigate: (view: AppView) => void;
  onUpgrade: () => void;
}

export default function PricingPage({ onNavigate, onUpgrade }: PricingPageProps) {
  const { me, isPro } = useEntitlement();

  return (
    <div className="mx-auto w-full max-w-3xl pb-12">
      <header className="mb-10">
        <h1 className="text-lg font-medium text-content-primary">Pricing</h1>
        <p className="mt-2 text-sm text-content-secondary">
          PyTyping Pro is {PRO_PRICE_LABEL} per {PRO_INTERVAL_LABEL}. It <strong>automatically renews</strong> until you
          cancel in the Polar customer portal. Polar is the merchant of record. One Pro subscription unlocks every
          language edition on this site.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-border-tertiary bg-background-secondary p-5">
          <h2 className="text-sm font-medium text-content-primary">Free</h2>
          <p className="mt-1 text-2xl font-medium text-content-primary">$0</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-content-secondary">
            <li>Full public catalog (beginner, intermediate, advanced)</li>
            <li>{FREE_DAILY_CAP} exercise completions per UTC day</li>
            <li>Guest play or a device-local account</li>
            <li>Themes, Pomodoro, ghost races</li>
          </ul>
        </section>

        <section className="rounded-lg border border-accent bg-background-secondary p-5">
          <h2 className="text-sm font-medium text-accent">Pro</h2>
          <p className="mt-1 text-2xl font-medium text-content-primary">
            {PRO_PRICE_LABEL}
            <span className="text-sm font-normal text-content-tertiary"> / {PRO_INTERVAL_LABEL}</span>
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-content-secondary">
            <li>Unlimited completions on every language edition</li>
            <li>That language’s interview-hard exercise pack</li>
            <li>Cloud sync of progress, settings, and playlists</li>
            <li>Exclusive themes, display name, and bio</li>
            <li>Cancel any time; {REFUND_DAYS}-day refund on the latest charge</li>
          </ul>
          {isPro ? (
            <p className="mt-6 text-sm text-success">You have Pro on this cloud account.</p>
          ) : (
            <button
              type="button"
              onClick={onUpgrade}
              className="mt-6 min-h-11 w-full rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary"
            >
              {me.authenticated ? `Subscribe — ${PRO_PRICE_LABEL}/${PRO_INTERVAL_LABEL}` : 'Sign in to subscribe'}
            </button>
          )}
        </section>
      </div>

      <p className="mt-8 text-sm text-content-secondary">
        Auto-renewal: Polar charges {PRO_PRICE_LABEL} each month until you cancel. Manage payment method, invoices, and
        cancellation in Settings → Billing. Policies:{' '}
        <a
          href="/terms"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('terms');
          }}
          className="text-accent underline-offset-2 hover:underline"
        >
          Terms
        </a>
        ,{' '}
        <a
          href="/refund"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('refund');
          }}
          className="text-accent underline-offset-2 hover:underline"
        >
          Refunds
        </a>
        ,{' '}
        <a
          href="/privacy"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('privacy');
          }}
          className="text-accent underline-offset-2 hover:underline"
        >
          Privacy
        </a>
        .
      </p>
    </div>
  );
}
