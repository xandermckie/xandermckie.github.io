import LegalPage from '../components/LegalPage';
import LegalSection from '../components/LegalSection';
import type { AppView } from '../lib/routes';
import { GITHUB_URL } from '../lib/links';
import { MAILING_ADDRESS, OPERATOR_LEGAL_NAME, PRIVACY_EMAIL, SUPPORT_EMAIL } from '../lib/legal';

interface ContactPageProps {
  onNavigate: (view: AppView) => void;
}

export default function ContactPage({ onNavigate }: ContactPageProps) {
  return (
    <LegalPage title="Contact" updated="September 18, 2026" onNavigate={onNavigate}>
      <LegalSection title="Support">
        <p>
          Product questions, billing help, and accessibility reports:{' '}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Privacy requests">
        <p>
          Access, export, or deletion requests:{' '}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
          . You can also export or delete from Settings without emailing us.
        </p>
      </LegalSection>

      <LegalSection title="Operator">
        <p>
          {OPERATOR_LEGAL_NAME}
          <br />
          {MAILING_ADDRESS}
          <br />
          GitHub:{' '}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {GITHUB_URL.replace('https://', '')}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
