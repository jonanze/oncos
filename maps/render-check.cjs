/* oncOS board maps: render check of the lines (Jonan 2026-11-11: no arrows, fix the geometry).

   node maps/render-check.cjs [map-id ...]

   Serves this checkout, opens each map in the Evidence view (/evidence/?group=<sheet>#map) in
   headless Chromium at light and dark themes, and fails when
   - a line label is not on a line (a label set just right of an upright, a panel lane, counts as on it)
   - a line label is off centre by more than 2 px on its visible run, the stretch of line between the
     nearest box edges or junctions, along the line or across it
   - a line runs under a box
   - two lines cross (a run passing through the middle of another run, not a junction)
   - the last word of a statement goes to the next line although it fitted on the line above (Jonan 2026-11-11)
   - a single word is alone on the last line, or a wrapped line starts left of the text (under ★ or ①)
   Needs Playwright (require('playwright')). Run it with node maps/check.cjs before every draft and release. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.txt':'text/plain',
  '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.webmanifest':'application/manifest+json', '.ico':'image/x-icon'};

function maps(){
  const src = fs.readFileSync(path.join(__dirname, 'evidence-maps.js'), 'utf8');
  const block = src.match(/var MAPS = \{([\s\S]*?)\};/)[1], out = [];
  block.replace(/'([^']+)':\s*'([^']+)'/g, (m, sheet, id) => out.push({sheet, id}));
  return out;
}

function serve(){
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rew = {}; (vercel.rewrites || []).forEach(r => { rew[r.source] = r.destination; });
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/+$/, '') || '/';
    if (rew[p]) p = rew[p];
    let f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

// runs in the page: the geometry of the drawn map
function measure(){
  const T = 2, segs = [], res = [];
  const world = document.querySelector('.om-world');
  if (!world) return {n:0, res:['the map did not draw']};
  world.querySelectorAll('.om-wires path, .om-wires line').forEach(x => {
    if (x.tagName === 'line') {
      const a = +x.getAttribute('x1'), b = +x.getAttribute('y1'), c = +x.getAttribute('x2'), d = +x.getAttribute('y2');
      if (Math.abs(b - d) < .5 && Math.abs(a - c) > .5) segs.push({h:1, k:b, a:Math.min(a, c), b:Math.max(a, c)});
      else if (Math.abs(a - c) < .5 && Math.abs(b - d) > .5) segs.push({h:0, k:a, a:Math.min(b, d), b:Math.max(b, d)});
      return;
    }
    const d = x.getAttribute('d'); if (/[QCLA]/.test(d)) return;
    let cx = 0, cy = 0, m; const re = /([MHV])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g;
    while ((m = re.exec(d))) { const v = +m[2];
      if (m[1] === 'M') { cx = v; cy = +m[3]; }
      else if (m[1] === 'H') { if (Math.abs(v - cx) > .5) segs.push({h:1, k:cy, a:Math.min(cx, v), b:Math.max(cx, v)}); cx = v; }
      else { if (Math.abs(v - cy) > .5) segs.push({h:0, k:cx, a:Math.min(cy, v), b:Math.max(cy, v)}); cy = v; } }
  });
  const R = e => ({l:e.offsetLeft, t:e.offsetTop, r:e.offsetLeft + e.offsetWidth, b:e.offsetTop + e.offsetHeight});
  const boxes = [...world.querySelectorAll('.blk:not(.elab)')].map(R), chips = [...world.querySelectorAll('.elab')];
  const seen = new Set();
  segs.forEach(s => boxes.forEach(bx => {
    const hit = s.h ? (s.k > bx.t + T && s.k < bx.b - T && Math.min(s.b, bx.r) - Math.max(s.a, bx.l) > T)
                    : (s.k > bx.l + T && s.k < bx.r - T && Math.min(s.b, bx.b) - Math.max(s.a, bx.t) > T);
    const key = 'u' + s.h + s.k + bx.l + bx.t;
    if (hit && !seen.has(key)) { seen.add(key); res.push('a line runs under a box at ' + (s.h ? 'y ' + Math.round(s.k) : 'x ' + Math.round(s.k))); }
  }));
  segs.filter(s => s.h).forEach(hs => segs.filter(s => !s.h).forEach(vs => {
    if (vs.k > hs.a + T && vs.k < hs.b - T && hs.k > vs.a + T && hs.k < vs.b - T) {
      const key = 'x' + vs.k + ',' + hs.k; if (!seen.has(key)) { seen.add(key); res.push('lines cross at x ' + Math.round(vs.k) + ', y ' + Math.round(hs.k)); } }
  }));
  chips.forEach(e => {
    const c = R(e), cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2, name = e.textContent.trim().slice(0, 40);
    const H = segs.filter(s => s.h && Math.abs(s.k - cy) <= T && s.a < cx && cx < s.b);
    const V = segs.filter(s => !s.h && Math.abs(s.k - cx) <= T && s.a < cy && cy < s.b);
    let B = [];
    if (!H.length && !V.length) {
      B = segs.filter(s => !s.h && s.k <= c.l && c.l - s.k <= 14 && s.a < cy && cy < s.b);
      if (!B.length) { res.push('"' + name + '" is not on a line'); return; }
    }
    const h = H.length > 0, k = h ? H[0].k : (V.length ? V[0] : B[0]).k, pos = h ? cx : cy;
    const same = segs.filter(s => s.h === (h ? 1 : 0) && Math.abs(s.k - k) <= .5);
    let a = Math.min(...(h ? H : V.length ? V : B).map(s => s.a)), z = Math.max(...(h ? H : V.length ? V : B).map(s => s.b)), grew = true;
    while (grew) { grew = false; same.forEach(s => { if (s.a <= z + .5 && s.b >= a - .5 && (s.a < a - .5 || s.b > z + .5)) { a = Math.min(a, s.a); z = Math.max(z, s.b); grew = true; } }); }
    const stops = [a, z];
    boxes.forEach(bx => { if (h ? (k >= bx.t && k <= bx.b) : (k >= bx.l && k <= bx.r)) stops.push(h ? bx.l : bx.t, h ? bx.r : bx.b); });
    segs.filter(s => s.h !== (h ? 1 : 0)).forEach(s => { if (s.a <= k + .5 && s.b >= k - .5 && s.k > a + .5 && s.k < z - .5) stops.push(s.k); });
    const lo = Math.max(...stops.filter(v => v <= pos - 1)), hi = Math.min(...stops.filter(v => v >= pos + 1));
    const off = pos - (lo + hi) / 2, cross = B.length ? 0 : (h ? cy - k : cx - k);
    if (Math.abs(off) > T || Math.abs(cross) > T)
      res.push('"' + name + '" is ' + Math.round(Math.abs(Math.abs(off) > T ? off : cross)) + ' px off centre ' + (Math.abs(off) > T ? 'along' : 'across') + ' its line');
  });
  // a single word left alone on the last line of a statement, before its tags
  world.querySelectorAll('.ln, .sb, li, .sub, .trials>div>*, .box.lbl').forEach(el => {
    if (el.querySelector('.sb')) return;
    const words = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {acceptNode: n => n.parentElement.closest('.tag') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    let tn;
    while ((tn = walk.nextNode())) {
      const re = /\S+/g; let m;
      while ((m = re.exec(tn.data))) { const r = document.createRange(); r.setStart(tn, m.index); r.setEnd(tn, m.index + m[0].length); const b = r.getClientRects()[0]; if (b) words.push({w:m[0], top:b.top, left:b.left, right:b.right}); }
    }
    if (words.length < 3) return;
    // the last word went down a line although it fitted at the end of the line above
    const last = words[words.length - 1], prev = words[words.length - 2], cs = getComputedStyle(el), box = el.getBoundingClientRect();
    const edge = box.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth), s = (getComputedStyle(world).transform === 'none' ? 1 : 1);
    const tagged = !!el.querySelector('.tag'), tags = [...el.querySelectorAll('.tag')].map(t => t.getClientRects()).flatMap(r => [...r]);
    if (tagged && last.top - prev.top > 4 && prev.right + 6 + (last.right - last.left) < edge - 2) res.push('"' + last.w + '" went to the next line although it fitted, in "' + el.textContent.trim().slice(0, 50) + '"');
    // a single word alone on the last line, with no tag beside it
    if (last.top - prev.top > 4 && !tags.some(r => Math.abs(r.top - last.top) < 6)) res.push('"' + last.w + '" is alone on the last line of "' + el.textContent.trim().slice(0, 50) + '"');
    // a wrapped line starts left of the first line's text (under a mark such as ★)
    if (words.length > 1) { const first = words.find(w => !/^[①-⑳※・★]$/.test(w.w)); const lefts = words.filter(w => w.top - words[0].top > 4).map(w => w.left).concat(tags.filter(r => r.top - words[0].top > 4).map(r => r.left));
      if (first && lefts.length && Math.min(...lefts) < first.left - 3 && !el.matches('.ln.cv, .sb, .sub')) res.push('a wrapped line starts left of the text in "' + el.textContent.trim().slice(0, 50) + '"'); }
  });
  return {n:chips.length, res};
}

(async () => {
  const want = process.argv.slice(2), list = maps().filter(m => !want.length || want.includes(m.id));
  const srv = await serve(), port = srv.address().port, b = await chromium.launch();
  let bad = 0;
  for (const m of list) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({viewport:{width:1440, height:900}, colorScheme:theme, serviceWorkers:'block'}), p = await ctx.newPage();
    await p.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    await p.goto('http://127.0.0.1:' + port + '/evidence/?group=' + encodeURIComponent(m.sheet) + '#map', {waitUntil:'domcontentloaded'});
    try { await p.waitForSelector('.om-world .om-wires path', {timeout:15000, state:'attached'}); } catch (e) {}
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
    const out = await p.evaluate(measure);
    bad += out.res.length;
    console.log(m.id + ' (' + theme + '): ' + out.n + ' line labels, ' + (out.res.length ? out.res.length + ' fault(s)' : '0 faults'));
    out.res.forEach(r => console.log('  ' + r));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(bad ? bad + ' fault(s)' : 'render check passed');
  process.exit(bad ? 1 : 0);
})();
