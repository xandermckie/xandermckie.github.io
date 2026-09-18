/**
 * Operator and product constants for legal copy, pricing, and entitlements.
 * Replace placeholder contact fields before taking live payments.
 */
export const OPERATOR_LEGAL_NAME = 'Xander McKie';
export const PRODUCT_NAME = 'PyTyping';
export const SUPPORT_EMAIL = 'support@pytyping.app';
export const PRIVACY_EMAIL = 'privacy@pytyping.app';
export const MAILING_ADDRESS = '[Add a mailing address before launch]';
export const POLAR_MERCHANT_NAME = 'Polar Software Inc.';

export const PRO_PRICE_USD = 2.99;
export const PRO_PRICE_LABEL = '$2.99';
export const PRO_INTERVAL_LABEL = 'month';
export const FREE_DAILY_CAP = 5;
export const REFUND_DAYS = 14;
export const MINIMUM_AGE = 13;

export const LEGAL_DRAFT_NOTICE =
  'This page is a product draft, not legal advice. Have an attorney licensed in your state review it before you take payments.';

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
