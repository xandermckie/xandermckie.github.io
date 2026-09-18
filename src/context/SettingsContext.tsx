/**
 * App-wide settings (theme, fonts, tab size, sound, caret, etc). State lives
 * here, is validated on load, persisted (debounced) to localStorage, and
 * reflected onto the document root as CSS variables/attributes whenever it
 * changes — so components only ever read design-system variables.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { loadValidated, saveJSON } from '../lib/storage';
import { applySettingsToDocument } from '../lib/apply-document-settings';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  validateSettings,
} from '../lib/settings';
import type { Settings } from '../lib/settings';

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  /** Set when debounced settings persistence fails (quota, private mode, etc.). */
  persistError: string | null;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    loadValidated(SETTINGS_KEY, validateSettings, undefined, 'shared'),
  );
  const [persistError, setPersistError] = useState<string | null>(null);

  // Apply palette + typography + caret behavior to <html> on every change.
  useEffect(() => {
    applySettingsToDocument(settings);
  }, [
    settings.themeId,
    settings.customColors,
    settings.codeFont,
    settings.uiFont,
    settings.codeFontSize,
    settings.caretBlink,
  ]);

  // Debounce persistence so dragging sliders/colors doesn't thrash storage.
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (saveJSON(SETTINGS_KEY, settings, undefined, 'shared')) {
        setPersistError(null);
      } else {
        setPersistError('Settings could not be saved. Storage may be full or disabled.');
      }
    }, 150);
    return () => window.clearTimeout(saveTimer.current);
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);
  const reset = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), []);

  const value = useMemo(
    () => ({ settings, update, reset, persistError }),
    [settings, update, reset, persistError],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
