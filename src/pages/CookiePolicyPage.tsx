import LegalPage from '../components/LegalPage';
import LegalSection from '../components/LegalSection';
import type { AppView } from '../lib/routes';
import { POLAR_MERCHANT_NAME, PRODUCT_NAME } from '../lib/legal';

interface CookiePolicyPageProps {
  onNavigate: (view: AppView) => void;
}

export default function CookiePolicyPage({ onNavigate }: CookiePolicyPageProps) {
  return (
    <LegalPage title="Cookie Policy" updated="September 18, 2026" onNavigate={onNavigate}>
      <LegalSection title="Essential cookies">
        <p>
          {PRODUCT_NAME} sets one first-party cookie, <code className="font-mono text-xs">pytyping_session</code>, when
          you sign in with email. It is HttpOnly, SameSite=Lax, and used only to keep you signed in. It is strictly
          necessary for cloud accounts. Guests and local-only accounts do not need it.
        </p>
      </LegalSection>

      <LegalSection title="Local storage">
        <p>
          Device-local accounts, settings, progress, and guest daily-limit counters use localStorage or sessionStorage,
          not cookies. You can export or delete this data in Settings.
        </p>
      </LegalSection>

      <LegalSection title="Third parties">
        <p>
          {POLAR_MERCHANT_NAME} may set cookies on polar.sh (and sandbox) during checkout and the customer portal so
          Polar can process payment securely. Those cookies are Polar’s, not ours. Google Fonts may be requested if you
          choose a non-system font; that is a network request, not a first-party cookie we set.
        </p>
      </LegalSection>

      <LegalSection title="Consent">
        <p>
          We do not use advertising, social, or analytics cookies. Because the only first-party cookie is essential for
          signed-in cloud accounts, we do not show a marketing-consent banner. You can avoid that cookie by using guest
          or local accounts only.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
