import type { MouseEvent } from 'react';
import Logo from './Logo';
import LegalSection from './LegalSection';
import {
  APP_VERSION,
  AUTHOR_NAME,
  GITHUB_BUG_REPORT_URL,
  GITHUB_URL,
  MONKEYTYPE_URL,
  PYTHON_DOCS_URL,
  REAL_PYTHON_URL,
} from '../lib/links';
import { PRODUCT_NAME, SUPPORT_EMAIL } from '../lib/legal';
import type { AppView } from '../lib/routes';

interface AboutLegalProps {
  onNavigate: (view: AppView) => void;
}

function DocLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export default function AboutLegal({ onNavigate }: AboutLegalProps) {
  const go = (view: AppView) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate(view);
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-12">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={32} wordmark={false} className="text-content-primary" />
        <div>
          <h1 className="text-lg font-medium text-content-primary">About {PRODUCT_NAME}</h1>
          <p className="text-xs text-content-tertiary">Version {APP_VERSION}</p>
        </div>
      </div>

      <p className="mb-8 text-sm leading-relaxed text-content-primary">
        {PRODUCT_NAME} helps you learn Python by typing real code, with short quizzes and breakdowns after each
        exercise. Created by{' '}
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
          {AUTHOR_NAME}
        </a>
        .
      </p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-content-secondary">
        <LegalSection title="Credits & inspiration">
          <p>
            {PRODUCT_NAME}&apos;s interface is inspired by{' '}
            <DocLink href={MONKEYTYPE_URL}>Monkeytype</DocLink>, an open-source typing test. {PRODUCT_NAME} is an
            independent project and is not affiliated with, endorsed by, or sponsored by Monkeytype.
          </p>
        </LegalSection>

        <LegalSection title="License">
          <p>
            © {new Date().getFullYear()} {AUTHOR_NAME}. The client application is released under the MIT License. You
            may use, copy, modify, and distribute it with attribution and without warranty. Interview-pack exercises and
            other Pro-only content are not covered by that MIT grant.
          </p>
        </LegalSection>

        <LegalSection title="Exercise attribution">
          <p>
            Curated free exercises are adapted from the official <DocLink href={PYTHON_DOCS_URL}>Python documentation</DocLink>{' '}
            and <DocLink href={REAL_PYTHON_URL}>Real Python</DocLink>, used for educational purposes; all other free
            exercises are generated originals. Python documentation is © the Python Software Foundation.
          </p>
        </LegalSection>

        <LegalSection title="Trademarks">
          <p>
            “Python” and the Python logos are trademarks of the Python Software Foundation. {PRODUCT_NAME} is not
            affiliated with or endorsed by the PSF.
          </p>
        </LegalSection>

        <LegalSection title="Plans">
          <p>
            Guest play and device-local accounts work in the browser. A cloud account (email magic link) talks to our
            Cloudflare Worker, stores an essential session cookie, and is required for the paid Pro plan. Polar is the
            merchant of record for checkout. See{' '}
            <a href="/pricing" onClick={go('pricing')} className="text-accent underline-offset-2 hover:underline">
              Pricing
            </a>
            .
          </p>
          <p>
            A free tier includes the public exercise catalog with a daily completion limit. PyTyping Pro removes that
            cap, unlocks the interview pack, and adds cloud sync. The client app remains MIT-licensed; Pro interview
            content is not.
          </p>
        </LegalSection>

        <LegalSection title="Legal">
          <p>
            Policies:{' '}
            <a href="/terms" onClick={go('terms')} className="text-accent underline-offset-2 hover:underline">
              Terms
            </a>
            ,{' '}
            <a href="/privacy" onClick={go('privacy')} className="text-accent underline-offset-2 hover:underline">
              Privacy
            </a>
            ,{' '}
            <a href="/refund" onClick={go('refund')} className="text-accent underline-offset-2 hover:underline">
              Refunds
            </a>
            ,{' '}
            <a href="/cookies" onClick={go('cookies')} className="text-accent underline-offset-2 hover:underline">
              Cookies
            </a>
            ,{' '}
            <a href="/accessibility" onClick={go('accessibility')} className="text-accent underline-offset-2 hover:underline">
              Accessibility
            </a>
            ,{' '}
            <a href="/contact" onClick={go('contact')} className="text-accent underline-offset-2 hover:underline">
              Contact
            </a>
            . Accessibility issues:{' '}
            <a href={GITHUB_BUG_REPORT_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
              GitHub
            </a>{' '}
            or {SUPPORT_EMAIL}.
          </p>
        </LegalSection>

        <LegalSection title="Disclaimer">
          <p>
            {PRODUCT_NAME} is provided “as is”, for educational use, without warranty of any kind. Code snippets are
            simplified for learning and may omit error handling appropriate for production use.
          </p>
        </LegalSection>
      </div>
    </div>
  );
}
