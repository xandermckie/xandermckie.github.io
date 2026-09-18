import LegalPage from '../components/LegalPage';
import LegalSection from '../components/LegalSection';
import LegalLink from '../components/LegalLink';
import type { AppView } from '../lib/routes';
import {
  POLAR_MERCHANT_NAME,
  PRO_PRICE_LABEL,
  PRO_INTERVAL_LABEL,
  REFUND_DAYS,
  SUPPORT_EMAIL,
} from '../lib/legal';

interface RefundPageProps {
  onNavigate: (view: AppView) => void;
}

export default function RefundPage({ onNavigate }: RefundPageProps) {
  return (
    <LegalPage title="Refund Policy" updated="September 18, 2026" onNavigate={onNavigate}>
      <LegalSection title="How billing works">
        <p>
          PyTyping Pro costs {PRO_PRICE_LABEL} per {PRO_INTERVAL_LABEL} and <strong>auto-renews</strong> until you
          cancel. {POLAR_MERCHANT_NAME} is the merchant of record and issues invoices and refunds.
        </p>
      </LegalSection>

      <LegalSection title={`${REFUND_DAYS}-day refund`}>
        <p>
          If you are not satisfied, request a refund of your <strong>latest charge</strong> within {REFUND_DAYS} days
          of that charge via Settings → Billing → Manage billing (Polar Customer Portal) or by emailing{' '}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . We will instruct Polar to refund that charge and revoke Pro access.
        </p>
      </LegalSection>

      <LegalSection title="After the refund window">
        <p>
          After {REFUND_DAYS} days we do not offer prorated refunds for unused time. You may cancel any time; Pro
          remains available until the end of the paid period.
        </p>
      </LegalSection>

      <LegalSection title="How to cancel">
        <p>
          Open Settings → Billing → Manage billing. Polar’s portal is the one-click cancellation path. Canceling
          stops future renewals. See also <LegalLink href="/terms">Terms of Service</LegalLink> and{' '}
          <LegalLink href="/pricing">Pricing</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="EU / UK consumers">
        <p>
          Digital content supplied immediately may affect statutory withdrawal rights. Polar checkout is configured so
          you acknowledge immediate access where required. This does not limit mandatory consumer protections that
          cannot be waived.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
