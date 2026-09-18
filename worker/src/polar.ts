import type { Env } from './env';

interface PolarCheckout {
  url?: string;
  id?: string;
}

interface PolarCustomer {
  id: string;
  email?: string;
  metadata?: Record<string, string>;
}

interface PolarCustomerSession {
  customer_portal_url?: string;
}

function polarBase(env: Env): string {
  return (env.POLAR_API_BASE ?? 'https://api.polar.sh').replace(/\/$/, '');
}

export function billingConfigured(env: Env): boolean {
  return Boolean(env.POLAR_ACCESS_TOKEN && env.POLAR_PRODUCT_ID);
}

async function polarFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${env.POLAR_ACCESS_TOKEN ?? ''}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${polarBase(env)}${path}`, { ...init, headers });
}

export async function createPolarCheckout(
  env: Env,
  input: { email: string; userId: string; successUrl: string },
): Promise<string> {
  const response = await polarFetch(env, '/v1/checkouts/', {
    method: 'POST',
    body: JSON.stringify({
      products: [env.POLAR_PRODUCT_ID],
      success_url: input.successUrl,
      customer_email: input.email,
      metadata: { user_id: input.userId },
      allow_discount_codes: false,
      require_billing_address: true,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Polar checkout failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as PolarCheckout;
  if (!body.url) throw new Error('Polar checkout did not include a URL.');
  return body.url;
}

export async function createCustomerPortal(env: Env, polarCustomerId: string): Promise<string> {
  const response = await polarFetch(env, '/v1/customer-sessions/', {
    method: 'POST',
    body: JSON.stringify({ customer_id: polarCustomerId }),
  });
  if (!response.ok) {
    throw new Error(`Polar portal failed (${response.status})`);
  }
  const body = (await response.json()) as PolarCustomerSession;
  if (!body.customer_portal_url) throw new Error('Polar portal did not include a URL.');
  return body.customer_portal_url;
}

export async function findOrCreatePolarCustomer(
  env: Env,
  email: string,
  userId: string,
): Promise<string | null> {
  if (!env.POLAR_ACCESS_TOKEN) return null;
  const search = await polarFetch(env, `/v1/customers/?email=${encodeURIComponent(email)}`);
  if (search.ok) {
    const payload = (await search.json()) as { items?: PolarCustomer[] };
    const existing = payload.items?.[0];
    if (existing?.id) return existing.id;
  }
  const created = await polarFetch(env, '/v1/customers/', {
    method: 'POST',
    body: JSON.stringify({ email, metadata: { user_id: userId } }),
  });
  if (!created.ok) return null;
  const body = (await created.json()) as PolarCustomer;
  return body.id ?? null;
}

export async function revokePolarSubscription(env: Env, subscriptionId: string): Promise<void> {
  await polarFetch(env, `/v1/subscriptions/${subscriptionId}/revoke`, { method: 'POST' });
}

export async function deletePolarCustomer(env: Env, polarCustomerId: string): Promise<void> {
  await polarFetch(env, `/v1/customers/${polarCustomerId}`, { method: 'DELETE' });
}

export function metadataUserId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).user_id;
  return typeof value === 'string' ? value : null;
}
