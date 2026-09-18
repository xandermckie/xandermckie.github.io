export interface Env {
  DB: D1Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  SESSION_SECRET: string;
  RESEND_API_KEY?: string;
  MAGIC_FROM_EMAIL?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_WEBHOOK_SECRET?: string;
  POLAR_PRODUCT_ID?: string;
  POLAR_API_BASE?: string;
  APP_ORIGIN: string;
  ENVIRONMENT?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  polar_customer_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface EntitlementRow {
  user_id: string;
  plan: 'free' | 'pro';
  status: string;
  polar_subscription_id: string | null;
  current_period_end: string | null;
  updated_at: string;
}
