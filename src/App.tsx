import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { SessionProvider, useSession } from './context/SessionContext';
import { PomodoroProvider } from './context/PomodoroContext';
import { EntitlementProvider, useEntitlement } from './context/EntitlementContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppHeader from './components/AppHeader';
import Home from './pages/Home';
import LoginScreen from './components/LoginScreen';
import Footer from './components/Footer';
import CommandPalette from './components/CommandPalette';
import PomodoroWidget from './components/PomodoroWidget';
import UpgradeModal from './components/UpgradeModal';
import type { Command } from './components/CommandPalette';
import { EXERCISES } from './lib/exercises';
import { PRO_THEME_IDS, THEME_OPTIONS } from './lib/theme';
import { registerGlobalErrorHandlers } from './lib/global-errors';
import { pathFromView, viewFromPath, type AppView } from './lib/routes';
import type { GhostSource } from './types/replay';
import type { UpgradeReason } from './context/EntitlementContext';

const TypingPage = lazy(() => import('./pages/TypingPage'));
const PythonGuide = lazy(() => import('./pages/PythonGuide'));
const Contribute = lazy(() => import('./pages/Contribute'));
const GettingStarted = lazy(() => import('./pages/GettingStarted'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const RaceLobby = lazy(() => import('./pages/RaceLobby'));
const RacePage = lazy(() => import('./pages/RacePage'));
const Settings = lazy(() => import('./components/Settings'));
const ProgressTracker = lazy(() => import('./components/ProgressTracker'));
const Friends = lazy(() => import('./pages/Friends'));
const AboutLegal = lazy(() => import('./components/AboutLegal'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const RefundPage = lazy(() => import('./pages/RefundPage'));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'));
const AccessibilityPage = lazy(() => import('./pages/AccessibilityPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));

function PageFallback() {
  return <div className="py-16 text-center text-sm text-content-tertiary">Loading…</div>;
}

const PAGE_TITLES: Record<AppView, string> = {
  home: 'Exercises',
  typing: 'Typing',
  settings: 'Settings',
  progress: 'Progress',
  login: 'Log in',
  about: 'About',
  guide: 'Python guide',
  contribute: 'Contribute',
  'getting-started': 'Getting Started',
  leaderboard: 'Leaderboard',
  race: 'Ghost race',
  'race-run': 'Ghost race',
  friends: 'Friends',
  pricing: 'Pricing',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  refund: 'Refund Policy',
  cookies: 'Cookie Policy',
  accessibility: 'Accessibility',
  contact: 'Contact',
};

function AppShell() {
  const { settings, update } = useSettings();
  const { isGuest, logout } = useSession();
  const { canStartExercise, startCheckout, me, checkoutBusy, checkoutError, isPro } = useEntitlement();
  const [view, setViewState] = useState<AppView>(() => {
    try {
      const stored = sessionStorage.getItem('pytyping:spa-path');
      if (stored) {
        sessionStorage.removeItem('pytyping:spa-path');
        const url = new URL(stored, window.location.origin);
        window.history.replaceState({ view: viewFromPath(url.pathname) }, '', stored);
        return viewFromPath(url.pathname);
      }
    } catch {
      /* private mode */
    }
    return viewFromPath(window.location.pathname);
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [raceGhost, setRaceGhost] = useState<{ exerciseId: string; source: GhostSource } | null>(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const skipFocusOnMount = useRef(true);

  const setView = useCallback((next: AppView) => {
    setViewState(next);
    const path = pathFromView(next);
    if (path && window.location.pathname !== path) {
      window.history.pushState({ view: next }, '', path);
    }
  }, []);

  useEffect(() => {
    const onPop = () => setViewState(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (skipFocusOnMount.current) {
      skipFocusOnMount.current = false;
      return;
    }
    document.getElementById('main-content')?.focus();
  }, [view]);

  const startExercise = useCallback(
    (id: string) => {
      const gate = canStartExercise(id);
      if (!gate.allowed) {
        setUpgradeReason(gate.reason ?? 'feature');
        return;
      }
      setActiveId(id);
      setViewState('typing');
    },
    [canStartExercise],
  );
  const startRace = useCallback((exerciseId: string, source: GhostSource) => {
    setActiveId(exerciseId);
    setRaceGhost({ exerciseId, source });
    setViewState('race-run');
  }, []);
  const goHome = useCallback(() => setView('home'), [setView]);

  useEffect(() => {
    if (view !== 'typing' && view !== 'race-run') setChromeHidden(false);
  }, [view]);

  useEffect(() => {
    document.title = `${PAGE_TITLES[view]} | PyTyping`;
  }, [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const themeCommands: Command[] = THEME_OPTIONS.filter((option) => option.id !== 'custom').map((option) => ({
      id: `theme-${option.id}`,
      label: `Theme: ${option.label}${option.pro ? ' (Pro)' : ''}`,
      hint: 'theme',
      run: () => {
        if (option.pro && !isPro) {
          setUpgradeReason('feature');
          return;
        }
        update({ themeId: option.id });
      },
    }));
    const cmds: Command[] = [
      { id: 'nav-getting-started', label: 'Getting Started', hint: 'navigate', run: () => setView('getting-started') },
      { id: 'nav-home', label: 'Go to Exercises', hint: 'navigate', run: () => setView('home') },
      { id: 'nav-guide', label: 'Go to Python guide', hint: 'navigate', run: () => setView('guide') },
      { id: 'nav-leaderboard', label: 'Go to Leaderboard', hint: 'navigate', run: () => setView('leaderboard') },
      { id: 'nav-race', label: 'Go to Race', hint: 'navigate', run: () => setView('race') },
      { id: 'nav-friends', label: 'Go to Friends', hint: 'navigate', run: () => setView('friends') },
      { id: 'nav-contribute', label: 'Contribute / request a language', hint: 'navigate', run: () => setView('contribute') },
      { id: 'nav-progress', label: 'Go to Progress', hint: 'navigate', run: () => setView('progress') },
      { id: 'nav-pricing', label: 'Go to Pricing', hint: 'navigate', run: () => setView('pricing') },
      { id: 'nav-settings', label: 'Go to Settings', hint: 'navigate', run: () => setView('settings') },
      { id: 'nav-about', label: 'About', hint: 'navigate', run: () => setView('about') },
      { id: 'nav-terms', label: 'Terms of Service', hint: 'legal', run: () => setView('terms') },
      { id: 'nav-privacy', label: 'Privacy Policy', hint: 'legal', run: () => setView('privacy') },
      { id: 'theme-custom', label: 'Theme: Custom', hint: 'theme', run: () => update({ themeId: 'custom' }) },
      {
        id: 'toggle-line',
        label: `${settings.lineNumbers ? 'Hide' : 'Show'} line numbers`,
        hint: 'setting',
        run: () => update({ lineNumbers: !settings.lineNumbers }),
      },
      {
        id: 'toggle-wpm',
        label: `${settings.liveWpm ? 'Hide' : 'Show'} live WPM`,
        hint: 'setting',
        run: () => update({ liveWpm: !settings.liveWpm }),
      },
      ...themeCommands,
    ];
    if (isGuest && !me.authenticated) {
      cmds.push({ id: 'login', label: 'Log in / Sign up', hint: 'account', run: () => setView('login') });
    } else if (!isGuest) {
      cmds.push({ id: 'logout', label: 'Log out (device)', hint: 'account', run: logout });
    }
    return cmds;
  }, [isGuest, logout, me.authenticated, isPro, settings.lineNumbers, settings.liveWpm, update, setView]);

  const handleUpgrade = useCallback(async () => {
    if (!me.authenticated) {
      setUpgradeReason(null);
      setView('login');
      return;
    }
    await startCheckout();
  }, [me.authenticated, setView, startCheckout]);

  useEffect(() => {
    if (PRO_THEME_IDS.includes(settings.themeId) && !isPro) {
      update({ themeId: 'monokia' });
    }
  }, [isPro, settings.themeId, update]);

  if (view === 'login') {
    return (
      <LoginScreen
        onDone={() => setView('home')}
        onGuest={() => setView('home')}
        onNavigate={setView}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <AppHeader
        view={view}
        chromeHidden={chromeHidden}
        onNavigate={setView}
        onGoHome={goHome}
        onShowLogin={() => setView('login')}
      />

      <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-8 outline-none sm:px-6">
        {view === 'home' && <Home onSelectExercise={startExercise} onNavigate={setView} />}
        <Suspense fallback={<PageFallback />}>
          {view === 'guide' && <PythonGuide />}
          {view === 'contribute' && <Contribute />}
          {view === 'typing' && activeId && (
            <TypingPage
              key={activeId}
              exerciseId={activeId}
              onExit={goHome}
              onSelectExercise={startExercise}
              onStartRace={startRace}
              onFocusChange={setChromeHidden}
              onUpgradeNeeded={(reason) => setUpgradeReason(reason)}
            />
          )}
          {view === 'settings' && (
            <Settings
              onShowLogin={() => setView('login')}
              onManageFriends={() => setView('friends')}
              onNavigate={setView}
              onRequestUpgrade={setUpgradeReason}
            />
          )}
          {view === 'friends' && <Friends onShowLogin={() => setView('login')} />}
          {view === 'progress' && <ProgressTracker exercises={EXERCISES} />}
          {view === 'about' && <AboutLegal onNavigate={setView} />}
          {view === 'terms' && <TermsPage onNavigate={setView} />}
          {view === 'privacy' && <PrivacyPage onNavigate={setView} />}
          {view === 'refund' && <RefundPage onNavigate={setView} />}
          {view === 'cookies' && <CookiePolicyPage onNavigate={setView} />}
          {view === 'accessibility' && <AccessibilityPage onNavigate={setView} />}
          {view === 'contact' && <ContactPage onNavigate={setView} />}
          {view === 'pricing' && (
            <PricingPage
              onNavigate={setView}
              onUpgrade={() => {
                if (!me.authenticated) setView('login');
                else void startCheckout();
              }}
            />
          )}
          {view === 'getting-started' && <GettingStarted />}
          {view === 'leaderboard' && <Leaderboard />}
          {view === 'race' && (
            <RaceLobby onStartRace={startRace} onManageFriends={() => setView('friends')} />
          )}
          {view === 'race-run' && activeId && raceGhost && (
            <RacePage
              key={`${activeId}-${JSON.stringify(raceGhost.source)}`}
              exerciseId={activeId}
              ghostSource={raceGhost.source}
              onExit={() => setView('race')}
              onFocusChange={setChromeHidden}
            />
          )}
        </Suspense>
      </main>

      <Footer hidden={chromeHidden} onNavigate={setView} />

      <PomodoroWidget chromeHidden={chromeHidden} />

      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />

      <UpgradeModal
        open={upgradeReason !== null}
        reason={upgradeReason ?? 'feature'}
        busy={checkoutBusy}
        error={checkoutError}
        authenticated={me.authenticated}
        onClose={() => setUpgradeReason(null)}
        onUpgrade={() => void handleUpgrade()}
        onSignIn={() => {
          setUpgradeReason(null);
          setView('login');
        }}
      />
    </div>
  );
}

export default function App() {
  useEffect(() => registerGlobalErrorHandlers(), []);

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <SessionProvider>
          <EntitlementProvider>
            <PomodoroProvider>
              <AppShell />
            </PomodoroProvider>
          </EntitlementProvider>
        </SessionProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
