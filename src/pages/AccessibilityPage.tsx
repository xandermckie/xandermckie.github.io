import LegalPage from '../components/LegalPage';
import LegalSection from '../components/LegalSection';
import type { AppView } from '../lib/routes';
import { GITHUB_BUG_REPORT_URL } from '../lib/links';
import { SUPPORT_EMAIL } from '../lib/legal';

interface AccessibilityPageProps {
  onNavigate: (view: AppView) => void;
}

export default function AccessibilityPage({ onNavigate }: AccessibilityPageProps) {
  return (
    <LegalPage title="Accessibility Statement" updated="September 18, 2026" onNavigate={onNavigate}>
      <LegalSection title="Commitment">
        <p>
          PyTyping aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. We treat this as
          the practical bar for a public web product under the Americans with Disabilities Act.
        </p>
      </LegalSection>

      <LegalSection title="What is built in">
        <ul className="list-disc space-y-1 pl-5">
          <li>Skip link to main content, landmarks, and sequential headings.</li>
          <li>Keyboard access for navigation, command palette, quizzes, and dialogs (focus trap + Escape).</li>
          <li>Visible focus rings and labels on form controls.</li>
          <li>Screen-reader announcements for typing feedback; Guided mode exposes full code.</li>
          <li>prefers-reduced-motion disables caret blink and shortens transitions.</li>
          <li>High-contrast theme presets; custom themes warn when text contrast falls below 4.5:1.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Known limits">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Challenge mode hides untyped characters on screen. Use Guided mode with a screen reader, or the structure
            hint.
          </li>
          <li>The highlighted code panel is decorative; the text input carries typing state.</li>
          <li>Checkout and invoices are hosted by Polar. Accessibility of Polar pages is Polar’s responsibility.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Feedback">
        <p>
          If something does not work for you, email{' '}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{' '}
          or{' '}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href={GITHUB_BUG_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            report it on GitHub
          </a>{' '}
          and mention “accessibility”. Include browser, OS, assistive technology (if any), and steps to reproduce. We
          aim to reply within 5 business days.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
