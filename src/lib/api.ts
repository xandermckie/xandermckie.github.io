import { FREE_DAILY_CAP } from './legal';
import type { Exercise } from '../types/exercise';
import type { Settings } from './settings';
import type { Playlist } from './playlists';
import { isObject, isString } from './validation';
import { validateExercises } from './validation';

export type PlanId = 'free' | 'pro';

export interface MeResponse {
  authenticated: boolean;
  email: string | null;
  displayName: string | null;
  bio: string | null;
  plan: PlanId;
  remainingToday: number;
  dailyCap: number;
  currentPeriodEnd: string | null;
  billingConfigured: boolean;
}

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export interface SyncPayload {
  settings?: Settings;
  playlists?: Playlist[];
  displayName?: string;
  bio?: string;
}

export interface SyncResponse {
  settings: unknown;
  playlists: unknown;
  displayName: string | null;
  bio: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isMeResponse(raw: unknown): raw is MeResponse {
  if (!isObject(raw)) return false;
  return (
    typeof raw.authenticated === 'boolean' &&
    (raw.plan === 'free' || raw.plan === 'pro') &&
    typeof raw.remainingToday === 'number' &&
    typeof raw.dailyCap === 'number' &&
    typeof raw.billingConfigured === 'boolean'
  );
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Could not reach the PyTyping service.', 0);
  }
  const body = await parseJson(response);
  if (!response.ok) {
    const message =
      isObject(body) && isString(body.error) ? body.error : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return body;
}

export function fallbackMe(): MeResponse {
  return {
    authenticated: false,
    email: null,
    displayName: null,
    bio: null,
    plan: 'free',
    remainingToday: FREE_DAILY_CAP,
    dailyCap: FREE_DAILY_CAP,
    currentPeriodEnd: null,
    billingConfigured: false,
  };
}

export async function fetchMe(): Promise<MeResponse> {
  const body = await request('/api/me');
  if (!isMeResponse(body)) throw new ApiError('Unexpected /api/me payload.', 500);
  return {
    ...body,
    email: isString(body.email) ? body.email : null,
    displayName: isString(body.displayName) ? body.displayName : null,
    bio: isString(body.bio) ? body.bio : null,
    currentPeriodEnd: isString(body.currentPeriodEnd) ? body.currentPeriodEnd : null,
  };
}

export async function requestMagicLink(email: string, ageConfirmed: boolean): Promise<{ ok: true; devLink?: string }> {
  const body = await request('/api/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email, ageConfirmed }),
  });
  if (!isObject(body) || body.ok !== true) throw new ApiError('Could not send a sign-in link.', 500);
  return {
    ok: true,
    devLink: isString(body.devLink) ? body.devLink : undefined,
  };
}

export async function signOutCloud(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function createCheckout(): Promise<CheckoutResponse> {
  const body = await request('/api/checkout', { method: 'POST' });
  if (!isObject(body) || !isString(body.url)) throw new ApiError('Checkout did not return a URL.', 500);
  return { url: body.url };
}

export async function createPortal(): Promise<PortalResponse> {
  const body = await request('/api/portal', { method: 'GET' });
  if (!isObject(body) || !isString(body.url)) throw new ApiError('Billing portal did not return a URL.', 500);
  return { url: body.url };
}

export async function recordCloudCompletion(exerciseId: string): Promise<{ remainingToday: number; plan: PlanId }> {
  const body = await request('/api/completions', {
    method: 'POST',
    body: JSON.stringify({ exerciseId }),
  });
  if (!isObject(body) || typeof body.remainingToday !== 'number') {
    throw new ApiError('Could not record completion.', 500);
  }
  const plan: PlanId = body.plan === 'pro' ? 'pro' : 'free';
  return { remainingToday: body.remainingToday, plan };
}

export async function fetchInterviewExercises(): Promise<Exercise[]> {
  const body = await request('/api/exercises/interview');
  return validateExercises(body);
}

export interface InterviewPreview {
  id: string;
  title: string;
  description: string;
  topics: string[];
  estimatedTime: number;
  locked: boolean;
}

export async function fetchInterviewPreviews(): Promise<InterviewPreview[]> {
  const body = await request('/api/exercises/interview?preview=1');
  if (!Array.isArray(body)) return [];
  return body.filter((item): item is InterviewPreview => {
    return (
      isObject(item) &&
      isString(item.id) &&
      isString(item.title) &&
      isString(item.description) &&
      Array.isArray(item.topics) &&
      typeof item.estimatedTime === 'number' &&
      typeof item.locked === 'boolean'
    );
  });
}

export async function exportCloudAccount(): Promise<unknown> {
  return request('/api/account/export');
}

export async function deleteCloudAccount(): Promise<void> {
  await request('/api/account', { method: 'DELETE' });
}

export async function updateCloudProfile(patch: { displayName?: string; bio?: string }): Promise<void> {
  await request('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function pushCloudSync(payload: SyncPayload): Promise<void> {
  await request('/api/sync', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function pullCloudSync(): Promise<SyncResponse> {
  const body = await request('/api/sync');
  if (!isObject(body)) throw new ApiError('Sync payload was empty.', 500);
  return {
    settings: body.settings,
    playlists: body.playlists,
    displayName: isString(body.displayName) ? body.displayName : null,
    bio: isString(body.bio) ? body.bio : null,
  };
}
