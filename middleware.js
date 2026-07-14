import { next } from '@vercel/functions';

// Shared-password gate for the whole oncOS suite. No valid session cookie ->
// serve a styled login page; correct password -> set a signed, HttpOnly cookie
// and let the request through. Secrets live in Vercel env vars, never in code:
//   SITE_PASSWORD   the shared access password
//   SESSION_SECRET  random string used to HMAC-sign the session cookie
// Reversible: delete this file (and package.json) and redeploy to remove the gate.

export const config = {
  // Run on everything except Vercel internals.
  matcher: '/((?!_vercel/).*)',
};

const COOKIE = 'oncos_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const te = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(message));
  return b64url(new Uint8Array(sig));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hasValidSession(request, secret) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)oncos_session=([^;]+)/);
  if (!m) return false;
  const raw = decodeURIComponent(m[1]);
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  return timingSafeEqual(sig, await sign(exp, secret));
}

async function sessionCookie(secret) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const value = `${exp}.${await sign(exp, secret)}`;
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; ` +
    `SameSite=Lax; Max-Age=${MAX_AGE}`;
}

function loginPage(error) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>oncOS — Sign in</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&display=swap" rel="stylesheet">
<style>
  :root{--outer:#081521;--paper:#0e2233;--ink:#e8eef4;--muted:#8497a7;--teal:#4aa6e2;
    --hair:#25405a;--btn-ink:#062036;--danger:#f0716e;--field:#0a1c2c;--field-hair:#2c4964;}
  @media (prefers-color-scheme:light){:root{--outer:#eef2f6;--paper:#fff;--ink:#0f2a43;
    --muted:#5b6b78;--teal:#1668a3;--hair:#e2e8f0;--btn-ink:#fff;--danger:#c0392b;
    --field:#f7f9fb;--field-hair:#d4dde6;}}
  *{box-sizing:border-box}html,body{height:100%}
  body{margin:0;background:var(--outer);color:var(--ink);font-family:-apple-system,
    BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;
    align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
  .card{width:100%;max-width:372px;background:var(--paper);border:1px solid var(--hair);
    border-radius:14px;padding:38px 34px 30px;box-shadow:0 18px 50px rgba(0,0,0,.28)}
  .wm{font-family:'Montserrat',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    font-size:31px;font-weight:800;letter-spacing:-.3px;line-height:1;margin:0 0 6px}
  .wm .os{color:var(--teal)}
  .kicker{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;
    color:var(--muted);margin:0 0 26px}
  label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 7px;
    letter-spacing:.02em}
  input[type=password]{width:100%;padding:12px 13px;font-size:16px;color:var(--ink);
    background:var(--field);border:1px solid var(--field-hair);border-radius:8px;
    outline:none;transition:border-color .15s,box-shadow .15s}
  input[type=password]:focus{border-color:var(--teal);
    box-shadow:0 0 0 3px color-mix(in srgb,var(--teal) 22%,transparent)}
  button{width:100%;margin-top:18px;padding:12px 14px;font-size:14px;font-weight:700;
    letter-spacing:.02em;color:var(--btn-ink);background:var(--teal);border:0;
    border-radius:8px;cursor:pointer;transition:filter .15s}
  button:hover{filter:brightness(1.06)}
  .err{display:${error ? 'block' : 'none'};margin:14px 0 0;padding:10px 12px;font-size:13px;
    color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent);
    border:1px solid color-mix(in srgb,var(--danger) 30%,transparent);border-radius:8px}
  .foot{margin:24px 0 0;padding-top:18px;border-top:1px solid var(--hair);
    font-size:11.5px;line-height:1.5;color:var(--muted)}
</style>
</head>
<body>
  <main class="card">
    <h1 class="wm">onc<span class="os">OS</span></h1>
    <p class="kicker">Authorised access</p>
    <form method="POST" action="/__login">
      <label for="password">Access password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
      <div class="err" role="alert">Incorrect password. Please try again.</div>
      <button type="submit">Sign in</button>
    </form>
    <p class="foot">Restricted clinical evidence workspace for authorised colleagues.
      Content is for professional reference and is not medical advice.</p>
  </main>
</body>
</html>`;
}

const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

export default async function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  // Fail closed if misconfigured — never serve content without a working gate.
  if (!password || !secret) {
    return new Response('Service temporarily unavailable.', { status: 503 });
  }

  if (await hasValidSession(request, secret)) {
    return next();
  }

  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/__login') {
    let submitted = '';
    try {
      const form = await request.formData();
      submitted = String(form.get('password') || '');
    } catch (_) { /* malformed body -> treat as wrong password */ }
    if (timingSafeEqual(submitted, password)) {
      return new Response(null, {
        status: 303,
        headers: { 'Set-Cookie': await sessionCookie(secret), Location: '/' },
      });
    }
    return new Response(loginPage(true), { status: 401, headers: HTML });
  }

  return new Response(loginPage(false), { status: 401, headers: HTML });
}
