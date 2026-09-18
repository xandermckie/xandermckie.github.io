# Launch checklist (legal, Polar, Cloudflare)

Do not take live payments until Polar webhooks work in sandbox and an attorney has reviewed `/terms`, `/privacy`, and `/refund`.

## Accounts to create

1. [Cloudflare](https://dash.cloudflare.com) — Pages/Workers + D1
2. [Polar](https://polar.sh) — organization (KYC), product **PyTyping Pro** at $2.99/month
3. [Resend](https://resend.com) — transactional magic-link email from your domain
4. A custom domain pointed at the Worker (github.io is a poor checkout origin)

Fill in [src/lib/legal.ts](../src/lib/legal.ts): mailing address, support, and privacy emails.

## Cloudflare

```bash
npx wrangler d1 create pytyping
# paste the database_id into wrangler.toml
npx wrangler d1 migrations apply pytyping --remote
cp .dev.vars.example .dev.vars
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAGIC_FROM_EMAIL
npx wrangler secret put POLAR_ACCESS_TOKEN
npx wrangler secret put POLAR_WEBHOOK_SECRET
npx wrangler secret put POLAR_PRODUCT_ID
npx wrangler secret put APP_ORIGIN
npx wrangler secret put OPS_PATH
npx wrangler secret put OPS_USERNAME
npx wrangler secret put OPS_PASSWORD_SALT
npx wrangler secret put OPS_PASSWORD_HASH
npx wrangler secret put OPS_TOTP_SECRET
npx wrangler secret put OPS_ALERT_EMAIL
# optional: npx wrangler secret put OPS_IP_ALLOWLIST

```

Set `APP_ORIGIN` to `https://your-domain` and `POLAR_API_BASE` to `https://api.polar.sh` in production (sandbox: `https://sandbox-api.polar.sh`).

Local API:

```bash
npm run dev:api
npm run dev
```

Deploy:

```bash
npm run deploy:cf
```

Webhook URL: `https://your-domain/api/webhooks/polar`

Success URL used by checkout: `https://your-domain/settings?checkout=success`

## Polar product

- Name: PyTyping Pro
- Price: $2.99 / month, auto-renew
- Enable Customer Portal (one-click cancel)
- Enable refunds (14-day policy is in `/refund`)
- Mark the product as digital content and enable Polar’s immediate-access / 14-day withdrawal acknowledgement for EU/UK checkout
- Subscribe to: `subscription.active`, `subscription.updated`, `subscription.revoked`, `benefit_grant.created`, `benefit_grant.revoked`, `order.paid`, `order.refunded`

Interview snippets live in `worker/data/interview-exercises.json` so they are not in the Vite client bundle. The public catalog only ships titles/descriptions (`src/data/interview-preview.json`). Before a public launch, keep the solution JSON off GitHub Pages (R2 or a private Worker) if you do not want the pack in this repo.

## CSP

Checkout is a full-page redirect to Polar. Cards never touch this origin.

## Operator console

The console is not a learner role and is not in the public app. Access is a dedicated identity plus a high-entropy path stored only in Wrangler secrets.

1. Generate a path of 32+ random bytes, hex-encoded, as a URL prefix (no `admin` / `ops` substring).
2. Hash the operator password: `node scripts/hash-ops-password.mjs 'your-password'`.
3. Create a TOTP secret in an authenticator app (base32) and store the same value as `OPS_TOTP_SECRET`.
4. Sign in from a **separate browser profile** that is not signed into a learner account. A learner session that hits the real path is locked (tripwire). Guessable URLs such as `/admin` do not lock anyone.
5. Production login is POST-only. Use a local bookmarklet on the live origin, or `scripts/ops-login.html` (do not deploy that file). In `ENVIRONMENT=development`, GET on the secret path shows an unlabeled gate.
6. Sessions last 30 minutes, are IP-bound, `SameSite=Strict`, and are separate from `pytyping_session`.
7. Lock / unlock / resend sign-in require a fresh TOTP. Lookup never returns email, name, bio, or billing ids.

Break-glass (from a trusted machine):

```bash
# Unlock a learner after a tripwire (replace USER_ID)
npx wrangler d1 execute pytyping --remote --command "UPDATE users SET locked_at = NULL, locked_reason = NULL WHERE id = 'USER_ID';"

# Rotate console secrets after a suspected leak
npx wrangler secret put OPS_PATH
npx wrangler secret put OPS_PASSWORD_SALT
npx wrangler secret put OPS_PASSWORD_HASH
npx wrangler secret put OPS_TOTP_SECRET
npx wrangler d1 execute pytyping --remote --command "DELETE FROM ops_sessions;"
```

IP binding can fail across carrier-grade NAT; set `OPS_IP_ALLOWLIST` if you always operate from a stable IP.

