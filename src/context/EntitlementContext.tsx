/**
 * Cloud entitlement (plan, remaining completions) plus checkout helpers.
 * Degrades to a local free guest cap when the API is unreachable.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ApiError,
  createCheckout,
  createPortal,
  fallbackMe,
  fetchInterviewExercises,
  fetchInterviewPreviews,
  fetchMe,
  recordCloudCompletion,
  type InterviewPreview,
  type MeResponse,
} from '../lib/api';
import { getGuestRemainingToday, recordGuestCompletion } from '../lib/guest-cap';
import { FREE_DAILY_CAP } from '../lib/legal';
import type { Exercise } from '../types/exercise';
import { useLanguage } from './LanguageContext';

export type UpgradeReason = 'cap' | 'interview' | 'feature';

interface EntitlementContextValue {
  me: MeResponse;
  apiAvailable: boolean;
  loading: boolean;
  isPro: boolean;
  remainingToday: number;
  interviewExercises: Exercise[];
  interviewPreviews: InterviewPreview[];
  refresh: () => Promise<void>;
  startCheckout: () => Promise<void>;
  openPortal: () => Promise<void>;
  consumeCompletion: (exerciseId: string) => Promise<{ allowed: boolean; error?: string }>;
  canStartExercise: (exerciseId: string) => { allowed: boolean; reason?: UpgradeReason };
  checkoutBusy: boolean;
  checkoutError: string | null;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { kit, languageId } = useLanguage();
  const staticPreviews = useMemo(
    () => kit.interviewPreview.map((item) => ({ ...item, locked: true as const })),
    [kit],
  );
  const [me, setMe] = useState<MeResponse>(fallbackMe);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interviewExercises, setInterviewExercises] = useState<Exercise[]>([]);
  const [interviewPreviews, setInterviewPreviews] = useState<InterviewPreview[]>(staticPreviews);
  const [guestRemaining, setGuestRemaining] = useState(() => getGuestRemainingToday());
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    const prefix = kit.interviewIdPrefix;
    const fallback = staticPreviews;
    const isCurrent = (): boolean => generation === refreshGeneration.current;
    try {
      const next = await fetchMe();
      if (!isCurrent()) return;
      setMe(next);
      setApiAvailable(true);
      if (next.plan === 'pro') {
        const pack = await fetchInterviewExercises(languageId);
        if (!isCurrent()) return;
        const matching = pack.filter((item) => item.id.startsWith(prefix));
        setInterviewExercises(matching);
        setInterviewPreviews([]);
      } else {
        setInterviewExercises([]);
        try {
          const previews = await fetchInterviewPreviews(languageId);
          if (!isCurrent()) return;
          const matching = previews.filter((item) => item.id.startsWith(prefix));
          setInterviewPreviews(matching.length > 0 ? matching : fallback);
        } catch {
          if (!isCurrent()) return;
          setInterviewPreviews(fallback);
        }
      }
    } catch {
      if (!isCurrent()) return;
      setApiAvailable(false);
      setMe(fallbackMe());
      setInterviewExercises([]);
      setInterviewPreviews(fallback);
      setGuestRemaining(getGuestRemainingToday());
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [kit.interviewIdPrefix, languageId, staticPreviews]);

  useEffect(() => {
    setInterviewExercises([]);
    setInterviewPreviews(staticPreviews);
    void refresh();
  }, [refresh, staticPreviews]);

  const remainingToday = me.authenticated ? me.remainingToday : guestRemaining;

  const canStartExercise = useCallback(
    (exerciseId: string): { allowed: boolean; reason?: UpgradeReason } => {
      const isInterview =
        interviewPreviews.some((item) => item.id === exerciseId) ||
        exerciseId.startsWith(kit.interviewIdPrefix);
      if (isInterview && me.plan !== 'pro') return { allowed: false, reason: 'interview' };
      if (me.plan === 'pro') return { allowed: true };
      if (remainingToday <= 0) return { allowed: false, reason: 'cap' };
      return { allowed: true };
    },
    [interviewPreviews, kit.interviewIdPrefix, me.plan, remainingToday],
  );

  const consumeCompletion = useCallback(
    async (exerciseId: string): Promise<{ allowed: boolean; error?: string }> => {
      if (me.authenticated && apiAvailable) {
        try {
          const result = await recordCloudCompletion(exerciseId);
          setMe((prev) => ({ ...prev, remainingToday: result.remainingToday, plan: result.plan }));
          return { allowed: true };
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 402) {
            setMe((prev) => ({ ...prev, remainingToday: 0 }));
            return { allowed: false, error: err instanceof Error ? err.message : 'Daily limit reached.' };
          }
          return { allowed: false, error: err instanceof Error ? err.message : 'Could not record completion.' };
        }
      }
      const result = recordGuestCompletion();
      setGuestRemaining(result.remaining);
      if (!result.allowed) return { allowed: false, error: `Free limit is ${FREE_DAILY_CAP} completions per day.` };
      return { allowed: true };
    },
    [apiAvailable, me.authenticated],
  );

  const startCheckout = useCallback(async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const { url } = await createCheckout();
      window.location.assign(url);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not start checkout.');
      setCheckoutBusy(false);
    }
  }, []);

  const openPortal = useCallback(async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const { url } = await createPortal();
      window.location.assign(url);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setCheckoutBusy(false);
    }
  }, []);

  const value = useMemo<EntitlementContextValue>(
    () => ({
      me,
      apiAvailable,
      loading,
      isPro: me.plan === 'pro',
      remainingToday,
      interviewExercises,
      interviewPreviews,
      refresh,
      startCheckout,
      openPortal,
      consumeCompletion,
      canStartExercise,
      checkoutBusy,
      checkoutError,
    }),
    [
      me,
      apiAvailable,
      loading,
      remainingToday,
      interviewExercises,
      interviewPreviews,
      refresh,
      startCheckout,
      openPortal,
      consumeCompletion,
      canStartExercise,
      checkoutBusy,
      checkoutError,
    ],
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error('useEntitlement must be used within <EntitlementProvider>');
  return ctx;
}
