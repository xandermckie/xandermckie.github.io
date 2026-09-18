import LegalPage from '../components/LegalPage';
import LegalSection from '../components/LegalSection';
import LegalLink from '../components/LegalLink';
import type { AppView } from '../lib/routes';
import {
  MAILING_ADDRESS,
  OPERATOR_LEGAL_NAME,
  POLAR_MERCHANT_NAME,
  PRIVACY_EMAIL,
  PRODUCT_NAME,
  SUPPORT_EMAIL,
} from '../lib/legal';

interface PrivacyPageProps {
  onNavigate: (view: AppView) => void;
}

export default function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  return (
    <LegalPage title="Privacy Policy" updated="September 18, 2026" onNavigate={onNavigate}>
      <LegalSection title="Who we are">
        <p>
          {OPERATOR_LEGAL_NAME} operates {PRODUCT_NAME}. Contact:{' '}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          . Mailing address: {MAILING_ADDRESS}.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>Depending on how you use {PRODUCT_NAME}, we may process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Guest play: progress in sessionStorage on your device only (until the tab session ends).</li>
          <li>Local accounts: username, password hash (PBKDF2), avatar, and progress in localStorage on your device.</li>
          <li>
            Cloud accounts: email address, display name, bio, settings/playlists you sync, exercise completion counts
            used to enforce the free daily limit, and a Polar customer id.
          </li>
          <li>
            Payments: Polar collects payment card data on Polar’s checkout. We never receive your full card number or
            CVC.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Cloud sign-in uses one essential HttpOnly session cookie. Polar sets cookies on Polar’s own origin during
          checkout. See the <LegalLink href="/cookies">Cookie Policy</LegalLink>. We do not use advertising or
          analytics cookies.
        </p>
      </LegalSection>

      <LegalSection title="Processors">
        <ul className="list-disc space-y-1 pl-5">
          <li>Cloudflare — hosting, Worker API, D1 database.</li>
          <li>{POLAR_MERCHANT_NAME} — merchant of record, subscriptions, invoices, tax, refunds.</li>
          <li>Resend — transactional magic-link email.</li>
          <li>
            Google Fonts — if you pick a non-system font, your browser may send your IP address to Google. System fonts
            work offline.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we process data">
        <p>
          We process cloud account and payment-related data to provide the service (contract), to enforce free-tier
          limits and Pro entitlements, to send sign-in links, and to comply with law. Guest and local data stays on
          your device unless you export a backup or upgrade to cloud sync.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You may access, export, or delete your data from Settings. Cloud deletion cancels an active Polar
          subscription, removes server records, and clears this device’s PyTyping storage. California residents may
          also request access or deletion at {PRIVACY_EMAIL}. We do not sell personal information. EU/UK users may
          have additional GDPR rights (access, erasure, portability, objection); contact {PRIVACY_EMAIL}.
        </p>
      </LegalSection>

      <LegalSection title="Retention">
        <p>
          Cloud account data is kept while your account exists. After deletion we keep a minimal record (email hash and
          timestamp) only as needed to prevent abuse and meet legal/accounting duties. Polar retains payment records
          under Polar’s policy.
        </p>
      </LegalSection>

      <LegalSection title="Sharing">
        <p>
          Ghost codes, friend files, and backups leave your device only when you export or paste them. We do not sell
          your data. Support email {SUPPORT_EMAIL} is monitored by {OPERATOR_LEGAL_NAME}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
