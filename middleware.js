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
<meta name="theme-color" content="#f6f7f9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0d13" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Schibsted+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono&display=swap" rel="stylesheet">
<style>
  /* Meridian tokens — mirrored from _oncos-kit/oncos_theme.py so the gate reads
     as one system with the suite. Light "porcelain" base; dark "ink" via
     prefers-color-scheme (the gate has no toggle — it follows the OS, which is
     the suite's default). Fonts load from Google's CDN, not /fonts/, because the
     gate serves unauthenticated users and the middleware matcher gates /fonts/. */
  :root{
    --ink:#131926; --muted:#647184; --hair:#e3e7ee; --rule:#d7dde6;
    --paper:#ffffff; --ground:#f6f7f9;
    --m:#4e51d8; --btn-ink:#ffffff;
    --accent-soft:color-mix(in oklab,var(--m) 8%,#ffffff);
    --danger:#c23f38; --danger-soft:#faeae9;
    --wm-grad:linear-gradient(100deg,#4e51d8,#0977b0 45%,#0b8a66);
    --shadow:0 1px 2px rgba(19,25,38,.05), 0 10px 28px -12px rgba(19,25,38,.14);
    --font-sans:'Schibsted Grotesk',-apple-system,'Helvetica Neue',system-ui,sans-serif;
    --font-mono:'Spline Sans Mono',ui-monospace,'SF Mono',Menlo,monospace;
    color-scheme:light;
  }
  @media (prefers-color-scheme:dark){:root{
    --ink:#e8ecf3; --muted:#8391a3; --hair:#222937; --rule:#2a3242;
    --paper:#10141c; --ground:#0a0d13;
    --m:#8a8cff; --btn-ink:#0a0d13;
    --accent-soft:color-mix(in oklab,var(--m) 13%,#10141c);
    --danger:#f0716b; --danger-soft:#391b19;
    --wm-grad:linear-gradient(100deg,#8a8cff,#3fbbef 45%,#3fd6a6);
    --shadow:none;
    color-scheme:dark;
  }}
  *{box-sizing:border-box}html,body{height:100%}
  body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--font-sans);
    font-size:14px;line-height:1.5;display:flex;align-items:center;justify-content:center;
    padding:24px;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
  .card{width:100%;max-width:372px;background:var(--paper);border:1px solid var(--hair);
    border-radius:14px;padding:38px 34px 30px;box-shadow:var(--shadow)}
  .wm{font-family:'Montserrat',var(--font-sans);font-size:32px;font-weight:700;
    letter-spacing:-.03em;line-height:1;margin:0 0 7px;color:var(--ink)}
  .wm .os{background-image:var(--wm-grad);-webkit-background-clip:text;
    background-clip:text;color:transparent}
  .kicker{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
    color:var(--muted);margin:0 0 26px}
  label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 7px;
    letter-spacing:.02em}
  input[type=password]{width:100%;padding:12px 13px;font-size:16px;color:var(--ink);
    font-family:var(--font-sans);background:var(--ground);border:1px solid var(--rule);
    border-radius:9px;outline:none;transition:border-color .15s,box-shadow .15s}
  input[type=password]:focus{border-color:var(--m);
    box-shadow:0 0 0 3px color-mix(in oklab,var(--m) 22%,transparent)}
  button{width:100%;margin-top:18px;padding:12px 14px;font-size:14px;font-weight:700;
    font-family:var(--font-sans);letter-spacing:.02em;color:var(--btn-ink);background:var(--m);
    border:0;border-radius:9px;cursor:pointer;transition:filter .15s}
  button:hover{filter:brightness(1.06)}
  .err{display:${error ? 'block' : 'none'};margin:14px 0 0;padding:10px 12px;font-size:13px;
    color:var(--danger);background:var(--danger-soft);
    border:1px solid color-mix(in oklab,var(--danger) 34%,transparent);border-radius:9px}
  .foot{margin:24px 0 0;padding-top:18px;border-top:1px solid var(--hair);
    font-family:var(--font-mono);font-size:11.5px;line-height:1.6;letter-spacing:.2px;
    color:var(--muted)}
</style>
</head>
<body>
  <main class="card">
    <h1 class="wm" aria-label="oncOS">onc<span class="os">OS</span></h1>
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
