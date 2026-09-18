import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Logo from './Logo';
import { useSession } from '../context/SessionContext';
import { getProgress } from '../lib/progress';
import { PASSWORD_MIN, USERNAME_RULES } from '../lib/auth';
import { requestMagicLink } from '../lib/api';
import { MINIMUM_AGE } from '../lib/legal';
import AgeConfirmField from './AgeConfirmField';
import type { AppView } from '../lib/routes';

interface LoginScreenProps {
  onDone: () => void;
  onGuest: () => void;
  onNavigate: (view: AppView) => void;
}

type Mode = 'login' | 'signup';
type Tab = 'cloud' | 'local';

export default function LoginScreen({ onDone, onGuest, onNavigate }: LoginScreenProps) {
  const { login, signup } = useSession();
  const [tab, setTab] = useState<Tab>('cloud');
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [carryGuest, setCarryGuest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const guestHasProgress = useMemo(() => Object.keys(getProgress('guest')).length > 0, []);

  const submitLocal = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (mode === 'signup' && !ageConfirmed) {
      setError(`Confirm you are at least ${MINIMUM_AGE} years old.`);
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === 'login' ? await login(username, password) : await signup(username, password, carryGuest && guestHasProgress);
      if (result.ok) onDone();
      else setError(result.error);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PyTyping] Auth submit failed:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitCloud = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setDevLink(null);
    if (!ageConfirmed) {
      setError(`Confirm you are at least ${MINIMUM_AGE} years old.`);
      return;
    }
    setBusy(true);
    try {
      const result = await requestMagicLink(email, ageConfirmed);
      setNotice('If that address is valid, a sign-in link is on its way. It expires in 15 minutes.');
      if (result.devLink) setDevLink(result.devLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a sign-in link.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full min-h-11 rounded-md border border-border-tertiary bg-background-secondary px-3 py-2 text-sm text-content-primary outline-none focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={44} wordmark={false} className="mb-4 text-content-primary" />
          <h1 className="text-lg font-medium text-content-primary">
            {tab === 'cloud' ? 'Cloud account' : mode === 'login' ? 'Welcome back' : 'Create a device account'}
          </h1>
          <p className="mt-1 text-sm text-content-secondary">
            {tab === 'cloud'
              ? 'Email a magic link. Required for Pro billing and the daily limit.'
              : 'Save progress on this device only.'}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-border-tertiary p-1">
          {(['cloud', 'local'] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTab(item);
                setError(null);
                setNotice(null);
              }}
              className={`min-h-11 rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === item ? 'bg-background-secondary text-content-primary' : 'text-content-secondary'
              }`}
            >
              {item === 'cloud' ? 'Email' : 'This device'}
            </button>
          ))}
        </div>

        {tab === 'cloud' ? (
          <form onSubmit={submitCloud} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-content-secondary">
              Email
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <AgeConfirmField checked={ageConfirmed} onChange={setAgeConfirmed} onNavigate={onNavigate} />
            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-content-secondary">
                {notice}
              </p>
            )}
            {devLink && (
              <p className="break-all text-xs text-content-tertiary">
                Dev link:{' '}
                <a href={devLink} className="text-accent underline-offset-2 hover:underline">
                  {devLink}
                </a>
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 min-h-11 rounded-md border border-accent bg-background-secondary px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-background-tertiary disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-md border border-border-tertiary p-1">
              {(['login', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`min-h-11 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    mode === m ? 'bg-background-secondary text-content-primary' : 'text-content-secondary'
                  }`}
                >
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
            <form onSubmit={submitLocal} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-content-secondary">
                Username
                <input
                  className={inputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="username"
                  spellCheck={false}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-content-secondary">
                Password
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </label>
              {mode === 'signup' && (
                <>
                  <label className="flex flex-col gap-1 text-xs text-content-secondary">
                    Confirm password
                    <input
                      type="password"
                      className={inputClass}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <p className="text-xs text-content-tertiary">
                    Username: {USERNAME_RULES}. Password: at least {PASSWORD_MIN} characters.
                  </p>
                  {guestHasProgress && (
                    <label className="flex min-h-11 items-center gap-2 text-xs text-content-secondary">
                      <input
                        type="checkbox"
                        checked={carryGuest}
                        onChange={(e) => setCarryGuest(e.target.checked)}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      Bring my guest progress into this account
                    </label>
                  )}
                  <AgeConfirmField checked={ageConfirmed} onChange={setAgeConfirmed} onNavigate={onNavigate} />
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-2 min-h-11 rounded-md border border-accent bg-background-secondary px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-background-tertiary disabled:opacity-60"
              >
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <button type="button" onClick={onGuest} className="min-h-11 text-sm text-content-secondary underline-offset-2 hover:underline">
            Continue as guest
          </button>
          <p className="mt-3">
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="text-xs text-content-tertiary underline-offset-2 hover:text-content-secondary hover:underline"
            >
              About & legal
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
