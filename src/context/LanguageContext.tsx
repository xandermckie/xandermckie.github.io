import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getKit } from '../languages';
import type { LanguageId, LanguageKit, LanguageMeta } from '../languages';
import { LANGUAGE_METAS, metaById } from '../languages/meta';
import { homePathFor, getLanguageId, setLanguageId } from '../lib/catalog';
import { pathFromView, type AppView } from '../lib/routes';

interface LanguageContextValue {
  kit: LanguageKit;
  languageId: LanguageId;
  otherKits: LanguageMeta[];
  setLanguage: (id: LanguageId) => void;
  switchTo: (id: LanguageId, view?: AppView) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [languageId, setId] = useState<LanguageId>(() => getLanguageId());

  const setLanguage = useCallback((id: LanguageId) => {
    setLanguageId(id);
    setId(id);
  }, []);

  const switchTo = useCallback(
    (id: LanguageId, view: AppView = 'home') => {
      setLanguageId(id);
      setId(id);
      const path = pathFromView(view, id) ?? homePathFor(metaById(id));
      if (window.location.pathname !== path) {
        window.history.pushState({ view, languageId: id }, '', path);
      }
    },
    [],
  );

  const kit = useMemo(() => getKit(languageId), [languageId]);
  const otherKits = useMemo(
    () => LANGUAGE_METAS.filter((meta) => meta.id !== languageId),
    [languageId],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ kit, languageId, otherKits, setLanguage, switchTo }),
    [kit, languageId, otherKits, setLanguage, switchTo],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within <LanguageProvider>');
  return ctx;
}
