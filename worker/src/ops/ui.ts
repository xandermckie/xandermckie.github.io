const OPS_CSP =
  "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function opsHeaders(contentType: string): Headers {
  return new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': OPS_CSP,
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
}

export function opsHtmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: opsHeaders('text/html; charset=utf-8') });
}

export function opsJsResponse(js: string): Response {
  return new Response(js, { headers: opsHeaders('application/javascript; charset=utf-8') });
}

export function gateHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex,nofollow" />
  <title></title>
  <style>
    body { font: 14px/1.4 system-ui, sans-serif; margin: 2rem auto; max-width: 20rem; color: #111; }
    label { display: block; margin: 0.75rem 0 0.25rem; }
    input { width: 100%; box-sizing: border-box; padding: 0.4rem; }
    button { margin-top: 1rem; padding: 0.45rem 0.8rem; }
  </style>
</head>
<body>
  <form method="post" action="./session">
    <label>id <input name="username" autocomplete="username" required /></label>
    <label>key <input name="password" type="password" autocomplete="current-password" required /></label>
    <label>code <input name="totp" inputmode="numeric" pattern="[0-9]{6}" required /></label>
    <button type="submit">Continue</button>
  </form>
</body>
</html>`;
}

export function dashboardHtml(basePath: string): string {
  const src = `${basePath.replace(/\/$/, '')}/app.js`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Console</title>
  <style>
    :root { color-scheme: dark; }
    body { font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; margin: 0; background: #0f1115; color: #e6e6e6; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #2a2f3a; }
    main { padding: 1.25rem; display: grid; gap: 1.25rem; }
    section { background: #171b22; border: 1px solid #2a2f3a; border-radius: 8px; padding: 1rem; }
    h1, h2 { font-size: 1rem; margin: 0 0 0.75rem; }
    dl { display: grid; grid-template-columns: 10rem 1fr; gap: 0.35rem 0.75rem; margin: 0; }
    dt { color: #9aa3b2; }
    dd { margin: 0; font-variant-numeric: tabular-nums; }
    form, .row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; align-items: end; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 12px; color: #9aa3b2; }
    input { background: #0f1115; color: inherit; border: 1px solid #3a4150; border-radius: 4px; padding: 0.35rem 0.5rem; }
    button { background: #2b3342; color: inherit; border: 0; border-radius: 4px; padding: 0.4rem 0.7rem; cursor: pointer; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; }
    .err { color: #f87171; min-height: 1.2em; }
  </style>
</head>
<body>
  <header>
    <h1>Console</h1>
    <form method="post" action="${basePath.replace(/\/$/, '')}/logout">
      <button type="submit">Sign out</button>
    </form>
  </header>
  <main>
    <section id="health">
      <h2>Stability</h2>
      <p>Loading…</p>
    </section>
    <section>
      <h2>Account lookup</h2>
      <div class="row">
        <label>User id <input id="userId" autocomplete="off" /></label>
        <label>Email <input id="email" type="email" autocomplete="off" /></label>
        <button type="button" id="lookup">Lookup</button>
      </div>
      <div class="row">
        <label>Step-up code <input id="totp" inputmode="numeric" autocomplete="one-time-code" /></label>
        <button type="button" data-act="revoke">Revoke sessions</button>
        <button type="button" data-act="reset-cap">Reset daily cap</button>
        <button type="button" data-act="lock">Lock</button>
        <button type="button" data-act="unlock">Unlock</button>
        <button type="button" data-act="resend">Resend sign-in</button>
      </div>
      <p class="err" id="msg"></p>
      <pre id="account"></pre>
    </section>
  </main>
  <script src="${src}"></script>
</body>
</html>`;
}

export function dashboardJs(basePath: string): string {
  const base = basePath.replace(/\/$/, '');
  return `const base = ${JSON.stringify(base)};
const health = document.getElementById('health');
const account = document.getElementById('account');
const msg = document.getElementById('msg');
const userId = document.getElementById('userId');
const email = document.getElementById('email');
const totp = document.getElementById('totp');

function showError(text) { msg.textContent = text || ''; }

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function loadStats() {
  const response = await fetch(base + '/stats', { credentials: 'include' });
  const data = await readJson(response);
  if (!response.ok || !data) {
    health.innerHTML = '<h2>Stability</h2><p>Unavailable.</p>';
    return;
  }
  const h = data.health || {};
  const c = data.counts || {};
  const pressure = (data.ratePressure || []).map(function (row) {
    return '<div>' + row.prefix + ': ' + row.windows + ' windows, max ' + row.maxCount + '</div>';
  }).join('') || '<div>None</div>';
  const errors = (data.httpErrors || []).slice(0, 12).map(function (row) {
    return '<div>' + row.bucket + ' ' + row.statusClass + ' ' + row.routeGroup + ' ×' + row.count + '</div>';
  }).join('') || '<div>None</div>';
  const audit = (data.audit || []).slice(0, 12).map(function (row) {
    return '<div>' + row.createdAt + ' ' + row.action + (row.targetUserId ? ' ' + row.targetUserId : '') + '</div>';
  }).join('') || '<div>None</div>';
  health.innerHTML = '<h2>Stability</h2><dl>' +
    '<dt>Database</dt><dd>' + (h.db ? 'ok' : 'down') + '</dd>' +
    '<dt>Billing</dt><dd>' + (h.billingConfigured ? 'configured' : 'missing') + '</dd>' +
    '<dt>Email</dt><dd>' + (h.emailConfigured ? 'configured' : 'missing') + '</dd>' +
    '<dt>Environment</dt><dd>' + (h.environment || '') + '</dd>' +
    '<dt>Users</dt><dd>' + c.users + '</dd>' +
    '<dt>Pro / Free</dt><dd>' + c.pro + ' / ' + c.free + '</dd>' +
    '<dt>Locked</dt><dd>' + c.locked + '</dd>' +
    '<dt>Sessions</dt><dd>' + c.activeSessions + '</dd>' +
    '<dt>Completions today</dt><dd>' + c.completionsToday + '</dd>' +
    '<dt>Pending links</dt><dd>' + c.pendingMagicLinks + '</dd>' +
    '<dt>Deletions</dt><dd>' + c.deletions + '</dd>' +
    '</dl><h2>Rate pressure</h2>' + pressure +
    '<h2>HTTP errors</h2>' + errors +
    '<h2>Security events</h2>' + audit;
}

async function lookup() {
  showError('');
  const response = await fetch(base + '/support/lookup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: userId.value.trim(), email: email.value.trim() }),
  });
  const data = await readJson(response);
  if (!response.ok || !data) { showError('Lookup failed.'); return; }
  if (!data.found) { account.textContent = 'No account.'; return; }
  if (data.userId) userId.value = data.userId;
  account.textContent = JSON.stringify(data, null, 2);
}

async function act(kind) {
  showError('');
  const id = userId.value.trim();
  if (!id) { showError('User id required.'); return; }
  const needsTotp = kind === 'lock' || kind === 'unlock' || kind === 'resend';
  const response = await fetch(base + '/support/' + kind, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: id, totp: totp.value.trim() }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    showError(needsTotp && response.status === 401 ? 'Step-up code required.' : 'Action failed.');
    return;
  }
  if (data && data.ok) { showError(''); await lookup(); await loadStats(); }
}

document.getElementById('lookup').addEventListener('click', function () { lookup(); });
document.querySelectorAll('[data-act]').forEach(function (button) {
  button.addEventListener('click', function () { act(button.getAttribute('data-act')); });
});
loadStats();
`;
}
