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
