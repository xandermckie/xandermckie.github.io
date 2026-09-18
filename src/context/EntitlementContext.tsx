/**
 * Cloud entitlement (plan, remaining completions) plus checkout helpers.
 * Degrades to a local free guest cap when the API is unreachable.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import interviewPreviewData from '../data/interview-preview.json';

const STATIC_INTERVIEW_PREVIEWS: InterviewPreview[] = interviewPreviewData.map((item) => ({
  ...item,
  locked: true,
}));

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
  const [me, setMe] = useState<MeResponse>(fallbackMe);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interviewExercises, setInterviewExercises] = useState<Exercise[]>([]);
  const [interviewPreviews, setInterviewPreviews] = useState<InterviewPreview[]>(STATIC_INTERVIEW_PREVIEWS);
  const [guestRemaining, setGuestRemaining] = useState(() => getGuestRemainingToday());
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMe();
      setMe(next);
      setApiAvailable(true);
      if (next.plan === 'pro') {
        setInterviewExercises(await fetchInterviewExercises());
        setInterviewPreviews([]);
      } else {
        setInterviewExercises([]);
        try {
          const previews = await fetchInterviewPreviews();
          setInterviewPreviews(previews.length > 0 ? previews : STATIC_INTERVIEW_PREVIEWS);
        } catch {
          setInterviewPreviews(STATIC_INTERVIEW_PREVIEWS);
        }
      }
    } catch {
      setApiAvailable(false);
      setMe(fallbackMe());
      setInterviewExercises([]);
      setInterviewPreviews(STATIC_INTERVIEW_PREVIEWS);
      setGuestRemaining(getGuestRemainingToday());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remainingToday = me.authenticated ? me.remainingToday : guestRemaining;

  const canStartExercise = useCallback(
    (exerciseId: string): { allowed: boolean; reason?: UpgradeReason } => {
      const isInterview = interviewPreviews.some((item) => item.id === exerciseId) || exerciseId.startsWith('iv-');
      if (isInterview && me.plan !== 'pro') return { allowed: false, reason: 'interview' };
      if (me.plan === 'pro') return { allowed: true };
      if (remainingToday <= 0) return { allowed: false, reason: 'cap' };
      return { allowed: true };
    },
    [interviewPreviews, me.plan, remainingToday],
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
