import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import Avatar from './Avatar';
import ProfilePhotoCropModal from './ProfilePhotoCropModal';
import DeleteAccountModal from './DeleteAccountModal';
import { useSettings } from '../context/SettingsContext';
import { CODE_FONTS, UI_FONTS } from '../lib/settings';
import { useSession } from '../context/SessionContext';
import { useEntitlement } from '../context/EntitlementContext';
import { exportBackup, importBackup, BACKUP_MAX_BYTES, clearAllData } from '../lib/backup';
import { loadImageFileForCrop } from '../lib/profile-photo';
import { THEME_OPTIONS } from '../lib/theme';
import type { BaseColors } from '../lib/theme';
import { contrastRatio, formatContrast, meetsContrastAa } from '../lib/contrast';
import {
  createPlaylist,
  deletePlaylist,
  loadPlaylists,
  savePlaylists,
  validatePlaylists,
  type Playlist,
} from '../lib/playlists';
import {
  deleteCloudAccount,
  exportCloudAccount,
  pullCloudSync,
  pushCloudSync,
  signOutCloud,
  updateCloudProfile,
} from '../lib/api';
import { PRO_PRICE_LABEL, PRO_INTERVAL_LABEL } from '../lib/legal';
import { validateSettings } from '../lib/settings';
import type { AppView } from '../lib/routes';
import type { UpgradeReason } from '../context/EntitlementContext';

interface SettingsProps {
  onShowLogin: () => void;
  onManageFriends?: () => void;
  onNavigate: (view: AppView) => void;
  onRequestUpgrade: (reason: UpgradeReason) => void;
}

const COLOR_FIELDS: Array<{ key: keyof BaseColors; label: string }> = [
  { key: 'background', label: 'Background' },
  { key: 'textPrimary', label: 'Text' },
  { key: 'textSecondary', label: 'Muted text' },
  { key: 'accent', label: 'Accent' },
  { key: 'error', label: 'Error' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'border', label: 'Border' },
];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full border transition-colors ${
        checked ? 'border-accent bg-accent' : 'border-border-secondary bg-background-tertiary'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background-primary transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <div className="text-sm text-content-primary">{label}</div>
        {hint && <div className="text-xs text-content-tertiary">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-content-secondary">{children}</h2>;
}

const selectClass =
  'rounded-md border border-border-tertiary bg-background-secondary px-3 py-1.5 text-sm text-content-primary';
const btnClass =
  'rounded-md border border-border-tertiary px-4 py-2 text-sm text-content-secondary transition-colors hover:bg-background-secondary';

interface CropSession {
  objectUrl: string;
  imgWidth: number;
  imgHeight: number;
}

export default function Settings({ onShowLogin, onManageFriends, onNavigate, onRequestUpgrade }: SettingsProps) {
  const { settings, update, reset, persistError } = useSettings();
  const { isGuest, account, displayName, avatarColor, avatarPhoto, setAvatarPhoto, logout, removeAccount } =
    useSession();
  const { me, isPro, remainingToday, startCheckout, openPortal, checkoutBusy, checkoutError, refresh, apiAvailable } =
    useEntitlement();

  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<CropSession | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());
  const [playlistName, setPlaylistName] = useState('');
  const [cloudName, setCloudName] = useState('');
  const [cloudBio, setCloudBio] = useState('');
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    setCloudName(me.displayName ?? '');
    setCloudBio(me.bio ?? '');
  }, [me.displayName, me.bio]);

  const textContrast = contrastRatio(settings.customColors.textPrimary, settings.customColors.background);
  const contrastOk = meetsContrastAa(settings.customColors.textPrimary, settings.customColors.background);

  const closeCrop = () => {
    if (cropSession) URL.revokeObjectURL(cropSession.objectUrl);
    setCropSession(null);
  };

  const setColor = (key: keyof BaseColors, value: string) => {
    update({ themeId: 'custom', customColors: { ...settings.customColors, [key]: value } });
  };

  const downloadBackup = () => {
    setExportError(null);
    try {
      const blob = new Blob([exportBackup()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pytyping-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[PyTyping] Export failed:', err);
      setExportError('Could not export backup. Please try again.');
    }
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    if (file.size === 0) {
      setImportError('That file is empty.');
      return;
    }
    if (file.size > BACKUP_MAX_BYTES) {
      setImportError('Backup file is too large (max 2 MB).');
      return;
    }
    try {
      const result = importBackup(await file.text());
      if (result.ok) window.location.reload();
      else setImportError(result.error);
    } catch {
      setImportError('Could not read that file.');
    }
  };

  const onPhotoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    closeCrop();
    const result = await loadImageFileForCrop(file);
    if (!result.ok) {
      setPhotoError(result.error);
      return;
    }
    setCropSession({
      objectUrl: result.objectUrl,
      imgWidth: result.img.width,
      imgHeight: result.img.height,
    });
  };

  const onCropSave = (dataUrl: string) => {
    closeCrop();
    if (!setAvatarPhoto(dataUrl)) {
      setPhotoError('Could not save profile photo. Storage may be full.');
    }
  };

  const handleDelete = async () => {
    if (me.authenticated) {
      await deleteCloudAccount();
    }
    if (account) removeAccount(account.id);
    else clearAllData();
    window.location.assign('/');
  };

  const downloadCloudExport = async () => {
    setExportError(null);
    try {
      const payload = await exportCloudAccount();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pytyping-cloud-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export cloud data.');
    }
  };

  const syncUp = async () => {
    setCloudError(null);
    setCloudNotice(null);
    try {
      await pushCloudSync({ settings, playlists, displayName: cloudName, bio: cloudBio });
      setCloudNotice('Saved to the cloud.');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Cloud sync failed.');
    }
  };

  const syncDown = async () => {
    setCloudError(null);
    setCloudNotice(null);
    try {
      const payload = await pullCloudSync();
      if (payload.settings) update(validateSettings(payload.settings));
      if (Array.isArray(payload.playlists)) {
        savePlaylists(validatePlaylists(payload.playlists));
        setPlaylists(loadPlaylists());
      }
      if (payload.displayName) setCloudName(payload.displayName);
      if (payload.bio) setCloudBio(payload.bio);
      setCloudNotice('Restored from the cloud.');
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : 'Cloud restore failed.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-12">
      <h1 className="mb-8 text-lg font-medium text-content-primary">Settings</h1>

      {persistError && <p className="mb-6 text-sm text-error">{persistError}</p>}

      {/* Account */}
      <section className="mb-8">
        <SectionTitle>Account</SectionTitle>
        <div className="rounded-lg border border-border-tertiary bg-background-secondary p-4">
          {me.authenticated ? (
            <p className="text-sm text-content-primary">
              Cloud: <span className="font-medium">{me.email}</span>{' '}
              <span className="text-content-tertiary">({isPro ? 'Pro' : 'Free'})</span>
            </p>
          ) : (
            <p className="text-sm text-content-secondary">
              No cloud account on this browser. Cloud sign-in is required for Pro and the daily completion cap.
            </p>
          )}
          {isGuest ? (
            <p className="mt-2 text-sm text-content-secondary">Device profile: guest (session only).</p>
          ) : (
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={displayName} color={avatarColor} photoUrl={avatarPhoto} size="md" />
              <p className="text-sm text-content-primary">
                Device profile: <span className="font-medium">{displayName}</span>
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!me.authenticated && (
              <button type="button" onClick={onShowLogin} className="min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary">
                Cloud sign-in
              </button>
            )}
            {me.authenticated && (
              <button
                type="button"
                onClick={() => void signOutCloud().then(() => refresh())}
                className={`min-h-11 ${btnClass}`}
              >
                Sign out of cloud
              </button>
            )}
            {isGuest ? (
              <button type="button" onClick={onShowLogin} className={btnClass}>
                Device account
              </button>
            ) : (
              <button type="button" onClick={logout} className={`min-h-11 ${btnClass}`}>
                Log out of device
              </button>
            )}
            {onManageFriends && (
              <button type="button" onClick={onManageFriends} className={`min-h-11 ${btnClass}`}>
                Manage friends
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="min-h-11 rounded-md border border-error px-4 py-2 text-sm text-error transition-colors hover:bg-background-tertiary"
            >
              Delete account data
            </button>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <SectionTitle>Billing</SectionTitle>
        <div className="rounded-lg border border-border-tertiary bg-background-secondary p-4 text-sm text-content-secondary">
          <p>
            PyTyping Pro is {PRO_PRICE_LABEL} per {PRO_INTERVAL_LABEL} and auto-renews until you cancel. Polar is the
            merchant of record.{' '}
            <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => onNavigate('refund')}>
              Refund policy
            </button>
            .
          </p>
          <p className="mt-2 text-content-primary">
            Plan: {isPro ? 'Pro' : 'Free'} · Completions left today: {isPro ? 'unlimited' : remainingToday}
          </p>
          {me.currentPeriodEnd && (
            <p className="mt-1 text-xs text-content-tertiary">Current period ends {me.currentPeriodEnd.slice(0, 10)}.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!isPro && (
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() => (me.authenticated ? void startCheckout() : onShowLogin())}
                className="min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary disabled:opacity-60"
              >
                {me.authenticated ? `Upgrade — ${PRO_PRICE_LABEL}/${PRO_INTERVAL_LABEL}` : 'Sign in to upgrade'}
              </button>
            )}
            {isPro && (
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() => void openPortal()}
                className={`min-h-11 ${btnClass}`}
              >
                Manage billing
              </button>
            )}
          </div>
          {checkoutError && <p role="alert" className="mt-3 text-sm text-error">{checkoutError}</p>}
          {!apiAvailable && (
            <p className="mt-3 text-xs text-content-tertiary">
              Billing API is offline in this environment. Deploy the Cloudflare Worker to take payments.
            </p>
          )}
        </div>
      </section>

      {!isGuest && (
        <section className="mb-8">
          <SectionTitle>Profile photo</SectionTitle>
          <div className="rounded-lg border border-border-tertiary bg-background-secondary p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={displayName} color={avatarColor} photoUrl={avatarPhoto} size="lg" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => photoRef.current?.click()} className={btnClass}>
                  Upload photo
                </button>
                {avatarPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoError(null);
                      if (!setAvatarPhoto(null)) setPhotoError('Could not remove profile photo.');
                    }}
                    className={btnClass}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                onChange={onPhotoFile}
                className="hidden"
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 text-xs text-content-tertiary">
              Any image format your browser can open (JPEG, PNG, GIF, WebP, and more). Drag and crop before
              saving. Stored locally and included in backup exports.
            </p>
            {photoError && <p className="mt-2 text-sm text-error">{photoError}</p>}
          </div>
        </section>
      )}

      {me.authenticated && isPro && (
        <section className="mb-8">
          <SectionTitle>Pro profile</SectionTitle>
          <div className="flex flex-col gap-3 rounded-lg border border-border-tertiary bg-background-secondary p-4">
            <label className="flex flex-col gap-1 text-xs text-content-secondary">
              Display name
              <input
                className="min-h-11 rounded-md border border-border-tertiary bg-background-primary px-3 py-2 text-sm text-content-primary"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                maxLength={40}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-content-secondary">
              Bio
              <textarea
                className="min-h-20 rounded-md border border-border-tertiary bg-background-primary px-3 py-2 text-sm text-content-primary"
                value={cloudBio}
                onChange={(e) => setCloudBio(e.target.value)}
                maxLength={160}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void updateCloudProfile({ displayName: cloudName, bio: cloudBio })
                  .then(() => refresh())
                  .catch((err: unknown) => setCloudError(err instanceof Error ? err.message : 'Could not save profile.'));
              }}
              className={`min-h-11 self-start ${btnClass}`}
            >
              Save profile
            </button>
          </div>
        </section>
      )}

      {isPro && (
        <section className="mb-8">
          <SectionTitle>Practice playlists</SectionTitle>
          <form
            className="mb-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const created = createPlaylist(playlistName);
              if (created) {
                setPlaylists(loadPlaylists());
                setPlaylistName('');
              }
            }}
          >
            <label className="sr-only" htmlFor="playlist-name">
              New playlist name
            </label>
            <input
              id="playlist-name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="New playlist"
              className="min-h-11 rounded-md border border-border-tertiary bg-background-secondary px-3 py-2 text-sm text-content-primary"
            />
            <button type="submit" className={`min-h-11 ${btnClass}`}>
              Add
            </button>
          </form>
          <ul className="flex flex-col gap-2">
            {playlists.map((playlist) => (
              <li key={playlist.id} className="flex items-center justify-between gap-3 rounded-md border border-border-tertiary px-3 py-2 text-sm">
                <span className="text-content-primary">
                  {playlist.name}{' '}
                  <span className="text-content-tertiary">({playlist.exerciseIds.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    deletePlaylist(playlist.id);
                    setPlaylists(loadPlaylists());
                  }}
                  className="min-h-11 text-error"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cropSession && (
        <ProfilePhotoCropModal
          open
          imageUrl={cropSession.objectUrl}
          imgWidth={cropSession.imgWidth}
          imgHeight={cropSession.imgHeight}
          onClose={closeCrop}
          onSave={onCropSave}
        />
      )}

      {/* Theme */}
      <section className="mb-8">
        <SectionTitle>Theme</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={settings.themeId === t.id}
              onClick={() => {
                if (t.pro && !isPro) {
                  onRequestUpgrade('feature');
                  return;
                }
                update({ themeId: t.id });
              }}
              aria-disabled={Boolean(t.pro && !isPro)}
              className={`min-h-11 rounded-md border px-4 py-2 text-sm transition-colors ${
                settings.themeId === t.id
                  ? 'border-accent text-accent'
                  : 'border-border-tertiary text-content-secondary hover:bg-background-secondary'
              } ${t.pro && !isPro ? 'opacity-60' : ''}`}
            >
              {t.label}
              {t.pro ? ' · Pro' : ''}
            </button>
          ))}
        </div>

        {settings.themeId === 'custom' && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-xs text-content-secondary">
                  {f.label}
                  <input
                    type="color"
                    value={settings.customColors[f.key]}
                    onChange={(e) => setColor(f.key, e.target.value)}
                    className="h-9 w-full cursor-pointer rounded-md border border-border-tertiary bg-background-secondary"
                    aria-label={`${f.label} color`}
                  />
                </label>
              ))}
            </div>
            {!contrastOk && (
              <p role="status" className="mt-3 text-sm text-warning">
                Primary text contrast is {formatContrast(textContrast)} (WCAG AA needs 4.5:1). High Contrast Light/Dark
                presets stay free.
              </p>
            )}
          </>
        )}

        <div
          className="mt-4 rounded-lg border border-border-tertiary bg-background-secondary p-4 font-mono text-sm leading-[1.6]"
          aria-hidden="true"
        >
          <div>
            <span className="token keyword">def</span> <span className="token function">greet</span>
            <span className="token punctuation">(</span>name<span className="token punctuation">)</span>
            <span className="token punctuation">:</span>
          </div>
          <div>
            {'    '}
            <span className="token keyword">return</span>{' '}
            <span className="token string">f"Hello, {'{name}'}!"</span>{' '}
            <span className="token comment"># greet by name</span>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="mb-8">
        <SectionTitle>Typography</SectionTitle>
        <div className="divide-y divide-border-tertiary border-y border-border-tertiary">
          <Row label="Code font">
            <select className={selectClass} value={settings.codeFont} onChange={(e) => update({ codeFont: e.target.value })}>
              {CODE_FONTS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="UI font">
            <select className={selectClass} value={settings.uiFont} onChange={(e) => update({ uiFont: e.target.value })}>
              {UI_FONTS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Code size" hint={`${settings.codeFontSize}px`}>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={settings.codeFontSize}
              onChange={(e) => update({ codeFontSize: Number(e.target.value) })}
              className="w-40 accent-[var(--color-accent)]"
              aria-label="Code font size"
            />
          </Row>
        </div>
      </section>

      {/* Behavior */}
      <section className="mb-8">
        <SectionTitle>Behavior</SectionTitle>
        <div className="divide-y divide-border-tertiary border-y border-border-tertiary">
          <Row label="Tab size" hint="Spaces a Tab key inserts">
            <select className={selectClass} value={settings.tabSize} onChange={(e) => update({ tabSize: Number(e.target.value) })}>
              {[2, 4, 8].map((n) => (
                <option key={n} value={n}>
                  {n} spaces
                </option>
              ))}
            </select>
          </Row>
          <Row label="Line numbers">
            <Toggle label="Line numbers" checked={settings.lineNumbers} onChange={(v) => update({ lineNumbers: v })} />
          </Row>
          <Row label="Live WPM" hint="Show typing speed while you type">
            <Toggle label="Live WPM" checked={settings.liveWpm} onChange={(v) => update({ liveWpm: v })} />
          </Row>
          <Row label="Caret blink" hint="Off = steady caret">
            <Toggle label="Caret blink" checked={settings.caretBlink} onChange={(v) => update({ caretBlink: v })} />
          </Row>
          <Row label="Error sound" hint="Soft tone on a wrong keystroke (off by default)">
            <Toggle label="Error sound" checked={settings.soundEnabled} onChange={(v) => update({ soundEnabled: v })} />
          </Row>
          <Row label="Record replays" hint="Save typing replays for ghost racing (race mode always records)">
            <Toggle
              label="Record replays"
              checked={settings.recordReplays}
              onChange={(v) => update({ recordReplays: v })}
            />
          </Row>
        </div>
        <button type="button" onClick={reset} className={`mt-4 ${btnClass}`}>
          Reset settings to defaults
        </button>
      </section>

      <section>
        <SectionTitle>Pomodoro</SectionTitle>
        <div className="space-y-4">
          <Row label="Focus length" hint="Minutes per focus session">
            <input
              type="number"
              min={5}
              max={90}
              value={settings.pomodoroFocusMinutes}
              onChange={(e) => update({ pomodoroFocusMinutes: Number(e.target.value) })}
              className={selectClass}
            />
          </Row>
          <Row label="Break length" hint="Minutes per break">
            <input
              type="number"
              min={1}
              max={30}
              value={settings.pomodoroBreakMinutes}
              onChange={(e) => update({ pomodoroBreakMinutes: Number(e.target.value) })}
              className={selectClass}
            />
          </Row>
          <Row label="Phase notifications" hint="Browser notification when a phase ends">
            <Toggle
              label="Phase notifications"
              checked={settings.pomodoroNotifications}
              onChange={(v) => {
                update({ pomodoroNotifications: v });
                if (v) void import('../lib/notifications').then((m) => m.requestNotificationPermission());
              }}
            />
          </Row>
        </div>
      </section>

      {/* Data */}
      <section className="mt-8">
        <SectionTitle>Data</SectionTitle>
        <p className="mb-4 text-xs text-content-tertiary">
          Export a device backup, or export cloud records (GDPR/CCPA portability). Deleting an account is in the Account
          section.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadBackup} className={`min-h-11 ${btnClass}`}>
            Export device backup
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={`min-h-11 ${btnClass}`}>
            Import backup…
          </button>
          {me.authenticated && (
            <button type="button" onClick={() => void downloadCloudExport()} className={`min-h-11 ${btnClass}`}>
              Export cloud data
            </button>
          )}
          {me.authenticated && !isPro && (
            <button
              type="button"
              onClick={() => onRequestUpgrade('feature')}
              className="min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-background-tertiary"
            >
              Unlock cloud sync with Pro
            </button>
          )}
          {isPro && (
            <>
              <button type="button" onClick={() => void syncUp()} className={`min-h-11 ${btnClass}`}>
                Sync to cloud
              </button>
              <button type="button" onClick={() => void syncDown()} className={`min-h-11 ${btnClass}`}>
                Restore from cloud
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
            aria-hidden="true"
          />
        </div>
        {cloudNotice && <p role="status" className="mt-3 text-sm text-success">{cloudNotice}</p>}
        {cloudError && <p role="alert" className="mt-3 text-sm text-error">{cloudError}</p>}
        {importError && <p className="mt-3 text-sm text-error">{importError}</p>}
        {exportError && <p className="mt-3 text-sm text-error">{exportError}</p>}
      </section>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} onDelete={handleDelete} />
    </div>
  );
}
