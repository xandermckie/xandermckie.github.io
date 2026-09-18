import LegalPage from '../components/LegalPage';
import LegalSection from '../components/LegalSection';
import LegalLink from '../components/LegalLink';
import type { AppView } from '../lib/routes';
import {
  MINIMUM_AGE,
  OPERATOR_LEGAL_NAME,
  POLAR_MERCHANT_NAME,
  PRODUCT_NAME,
  PRO_PRICE_LABEL,
  PRO_INTERVAL_LABEL,
  SUPPORT_EMAIL,
} from '../lib/legal';

interface TermsPageProps {
  onNavigate: (view: AppView) => void;
}

export default function TermsPage({ onNavigate }: TermsPageProps) {
  return (
    <LegalPage title="Terms of Service" updated="September 18, 2026" onNavigate={onNavigate}>
      <LegalSection title="Agreement">
        <p>
          These Terms of Service (“Terms”) govern your use of {PRODUCT_NAME}, operated by {OPERATOR_LEGAL_NAME}{' '}
          (“we”, “us”). By creating an account, using the site, or purchasing a subscription, you agree to these
          Terms. If you do not agree, do not use {PRODUCT_NAME}.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility">
        <p>
          You must be at least {MINIMUM_AGE} years old. {PRODUCT_NAME} is not directed to children under {MINIMUM_AGE},
          and we do not knowingly collect personal information from children (COPPA).
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          {PRODUCT_NAME} is an educational typing product. The free catalog of exercises may be used subject to a
          daily completion limit. PyTyping Pro is a paid subscription that removes that limit and unlocks additional
          features described on the{' '}
          <LegalLink href="/pricing">Pricing</LegalLink> page. Exercise content is for learning; snippets are
          simplified and may omit production error handling.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You may use {PRODUCT_NAME} as a guest, with a device-local account, and/or with a cloud account (email magic
          link). You are responsible for activity on your cloud account. We may suspend accounts that abuse the
          service, attempt to circumvent payment, or violate these Terms.
        </p>
      </LegalSection>

      <LegalSection title="Subscriptions and merchant of record">
        <p>
          Paid subscriptions are sold by {POLAR_MERCHANT_NAME} (“Polar”) as merchant of record. Polar processes
          payment, invoices, applicable sales tax/VAT/GST, and refunds. The recurring price is {PRO_PRICE_LABEL} per{' '}
          {PRO_INTERVAL_LABEL} unless a different price is shown at checkout. Subscriptions <strong>automatically
          renew</strong> at the then-current price until you cancel.
        </p>
        <p>
          You can cancel any time in Polar’s Customer Portal (Settings → Billing → Manage billing). Cancellation takes
          effect at the end of the current paid period unless Polar processes an immediate refund/revocation. See the{' '}
          <LegalLink href="/refund">Refund Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          Do not attack, scrape in a way that degrades the service, share account credentials, reverse-engineer paid
          interview content for redistribution, or use {PRODUCT_NAME} for unlawful purposes.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          The client application is offered under the MIT License in the public repository. Interview-pack content and
          Polar-gated Pro features are proprietary to {OPERATOR_LEGAL_NAME} and are licensed to you only while your
          Pro subscription is active. Python and Python logos are trademarks of the Python Software Foundation.
          {PRODUCT_NAME} is not affiliated with or endorsed by the PSF or Monkeytype.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer and limitation of liability">
        <p>
          {PRODUCT_NAME} is provided “as is”, without warranties of any kind, including fitness for a particular
          purpose or uninterrupted availability. To the maximum extent permitted by law, {OPERATOR_LEGAL_NAME} is not
          liable for indirect, incidental, or consequential damages, or for amounts exceeding fees you paid for Pro in
          the three months before the claim.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these Terms. Material changes will be posted on this page with a new “Last updated” date.
          Continued use after that date constitutes acceptance. Questions:{' '}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
