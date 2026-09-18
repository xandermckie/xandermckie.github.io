import { useLanguage } from '../context/LanguageContext';

export default function GettingStarted() {
  const { kit } = useLanguage();
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-content-primary">Getting Started</h1>
        <p className="mt-2 text-sm text-content-secondary">
          {kit.productName} is built around real {kit.languageName} code. Type a snippet, answer a short quiz, then read the
          breakdown.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">How a session works</h2>
        <ol className="space-y-2 text-sm text-content-secondary list-decimal list-inside">
          <li>Pick an exercise from the Exercises page (filter by difficulty or topic).</li>
          <li>Type the code exactly as shown, one character at a time.</li>
          <li>See your WPM, accuracy, and error count when you finish.</li>
          <li>Answer the multiple-choice quiz about what you just typed.</li>
          <li>Read the breakdown: key terms, how it works, design patterns.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">Keyboard shortcuts</h2>
        <div className="rounded-lg border border-border-tertiary bg-background-secondary overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border-tertiary">
              {[
                ['Tab', 'Insert 4 spaces (matches expected indentation)'],
                ['Enter', 'Insert newline + auto-indent to the next line\'s level'],
                ['Backspace', 'Clear the current error, or undo the last correct character'],
                ['Escape', 'Open the pause menu (restart or exit)'],
                ['Ctrl / ⌘ + L', 'Re-focus the typing field'],
                ['Ctrl / ⌘ + K', 'Open the command palette (themes, navigation, settings)'],
              ].map(([key, desc]) => (
                <tr key={key}>
                  <td className="px-4 py-2.5 font-mono text-xs text-content-primary whitespace-nowrap w-36">{key}</td>
                  <td className="px-4 py-2.5 text-content-secondary">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">Exercise modes</h2>
        <div className="space-y-2 text-sm text-content-secondary">
          <p>
            <span className="font-medium text-content-primary">Guided:</span> The full code is visible while you type. Use this when you are learning new syntax.
          </p>
          <p>
            <span className="font-medium text-content-primary">Challenge:</span> Untyped characters are hidden (shown as bullets). You have to remember what comes next.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">IDE-style typing tips</h2>
        <ul className="space-y-2 text-sm text-content-secondary list-disc list-inside">
          <li>Press <span className="font-mono text-xs text-content-primary">Tab</span> at the start of an indented line instead of typing each space individually.</li>
          <li>After pressing <span className="font-mono text-xs text-content-primary">Enter</span>, indentation is added for the next line. You can start typing the first non-space character.</li>
          <li>
            Typing <span className="font-mono text-xs text-content-primary">(</span>,{' '}
            <span className="font-mono text-xs text-content-primary">[</span>,{' '}
            <span className="font-mono text-xs text-content-primary">{'{'}</span>, or quotes before an empty pair
            places the caret between them (like VS Code). Type the closing character to continue; backspace between an
            empty pair removes the opener.
          </li>
          <li>A wrong character turns red and blocks the caret. Fix it with <span className="font-mono text-xs text-content-primary">Backspace</span> before moving on.</li>
          <li>While you type, the header and footer fade out so you can focus on the code.</li>
          <li>Create a free local account to persist your progress and streak across sessions.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">Ghost race</h2>
        <div className="space-y-2 text-sm text-content-secondary">
          <p>
            Open <span className="font-medium text-content-primary">Race</span> from the nav to sprint against
            built-in opponents (Easy through Extreme, plus <span className="font-medium text-content-primary">The Creator</span> at
            102 wpm), your saved replays, or ghosts imported from friends.
          </p>
          <p>
            Complete an exercise with replay recording on to save a ghost, or use{' '}
            <span className="font-medium text-content-primary">Race this run</span> on the results screen.
            Your best race WPM sets your rank from Bronze to Diamond.
          </p>
          <p>
            Share ghosts via friend codes or JSON from the{' '}
            <span className="font-medium text-content-primary">Friends</span> page or race results. Paste a
            friend&apos;s code to add them offline. No server required.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">Profile photos &amp; friends</h2>
        <div className="space-y-2 text-sm text-content-secondary">
          <p>
            Logged-in users can upload a profile photo in{' '}
            <span className="font-medium text-content-primary">Settings → Profile photo</span>. Photos are stored
            locally and included when you share a friend code (optional).
          </p>
          <p>
            Open <span className="font-medium text-content-primary">Friends</span> (mobile menu or Settings) to
            manage imported friends, paste friend codes, or import JSON bundles.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">Pomodoro timer</h2>
        <p className="text-sm text-content-secondary">
          A focus/break timer lives in the bottom-right corner on every page. Adjust focus and break lengths in{' '}
          <span className="font-medium text-content-primary">Settings → Pomodoro</span>. It auto-minimizes while you type.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium text-content-primary">Progress &amp; accounts</h2>
        <div className="space-y-2 text-sm text-content-secondary">
          <p>
            Guest progress lives only for the current browser session. Create a local account (no email required)
            to save your best attempts, streaks, and achievements permanently on this device.
          </p>
          <p>
            Use <span className="font-medium text-content-primary">Settings → Export / Import</span> to back up or move your data between devices.
          </p>
        </div>
      </section>
    </div>
  );
}
