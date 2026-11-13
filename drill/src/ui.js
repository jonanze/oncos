function plainWhy(w, cat) { w = w || ''; if (cat) { const a = ' → ' + cat; w = w.split(a + ' ').join(' ').split(a + ',').join(',').split(a + ';').join(';'); if (w.endsWith(a)) w = w.slice(0, -a.length); } return w.replace(/ → /g, ', giving ').replace(/→/g, ' to '); }
(function () {
'use strict';
const D = window.Drill;
const $ = (s, r) => (r || document).querySelector(s);
const el = (tag, attrs, kids) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'on') { for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); } else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]); } (kids || []).forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)); return e; };
// Host: inside oncOS the module passes its container and a link builder for the
// Staging table (window.DrillHost); the standalone page uses #app and its own Table.
const HOST = window.DrillHost || null;
const KEY = 'oncos-drill-ui';
let ui = { mode: 'case', section: 'All', site: '', sel: {} };
try { const u = JSON.parse(localStorage.getItem(KEY) || 'null'); if (u) ui = Object.assign(ui, u); } catch (e) {}
if (ui.mode !== 'table' || HOST) ui.mode = 'case';
if (!ui.sel || typeof ui.sel !== 'object' || Array.isArray(ui.sel)) ui.sel = {};
function saveUi() { try { localStorage.setItem(KEY, JSON.stringify(ui)); } catch (e) {} }
// Score: cases done and correct, misses by system, and missed cells that come back
// three cases later until they are answered right, at most every second case. Kept on this device.
const SKEY = 'oncos-drill-score', REPEAT_AFTER = 3;
const blankScore = () => ({ done: 0, right: 0, by: {}, queue: [] });
let score = blankScore();
try { const s = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (s && typeof s === 'object' && s.by && Array.isArray(s.queue)) score = Object.assign(blankScore(), s); } catch (e) {}
function saveScore() { try { localStorage.setItem(SKEY, JSON.stringify(score)); } catch (e) {} }
function record(key, label, site, ok, wrong, again) {
  score.done++; if (ok) score.right++;
  const b = score.by[key] || (score.by[key] = { label, site, done: 0, missed: 0, axes: {} });
  b.label = label; b.done++;
  if (!ok) { b.missed++; wrong.forEach(k => { b.axes[k] = (b.axes[k] || 0) + 1; }); }
  if (again) score.queue = score.queue.filter(q => q.id !== again.id);
  if (!ok) score.queue.push(Object.assign({}, again || {}, { id: again ? again.id : key + '|' + score.done, key, site, due: score.done + REPEAT_AFTER }));
  saveScore();
}
function dueRepeat() {
  const ids = new Set(scopeSites().map(s => s.id));
  return score.queue.find(q => q.due <= score.done && ids.has(q.site)) || null;
}

const SECTIONS = ['All', 'Thoracic', 'GI', 'Breast', 'H&N', 'GU', 'Gynae', 'Skin', 'Sarcoma', 'CNS', 'Lymphoma'];
const SITEBY = Object.fromEntries(D.SITES.map(s => [s.id, s]));
const SHORT = { colorectal: 'Colorectal', cervix: 'Cervix', breast: 'Breast', lung: 'Lung', mesothelioma: 'Mesothelioma', thymoma: 'Thymic', gastric: 'Gastric', esophageal: 'Oesophagus', anal: 'Anal', hcc: 'HCC', rcc: 'Kidney', bladder: 'Bladder', prostate: 'Prostate', melanoma: 'Melanoma', nasopharyngeal: 'Nasopharynx', thyroid: 'Thyroid', ovarian: 'Ovary', lymphoma: 'Lymphoma', pancreas: 'Pancreas', gallbladder: 'Gallbladder', 'cholangio-intrahepatic': 'iCCA', 'cholangio-perihilar': 'Perihilar CCA', 'cholangio-distal': 'Distal CCA', 'small-bowel': 'Small bowel', testis: 'Testis', utuc: 'UTUC', adrenal: 'Adrenal', penile: 'Penis', urethral: 'Urethra', 'oral-cavity': 'Oral cavity', 'oropharynx-p16pos': 'OPC p16+', 'oropharynx-p16neg': 'OPC p16−', larynx: 'Larynx', salivary: 'Salivary', endometrial: 'Endometrium', vulvar: 'Vulva', vaginal: 'Vagina', gtn: 'GTN', merkel: 'Merkel', 'cutaneous-scc': 'cSCC', 'soft-tissue-sarcoma': 'Soft tissue', 'bone-sarcoma': 'Bone', glioma: 'Glioma', 'net-gep': 'NET grade', 'net-pancreas': 'NET pancreas', 'net-gastric': 'NET stomach', 'net-duodenal': 'NET duodenum', 'net-jejunoileal': 'NET small bowel', 'net-appendiceal': 'NET appendix', 'net-rectal': 'NET rectum', 'net-colonic': 'NET colon', hypopharynx: 'Hypopharynx', sinonasal: 'Sinonasal', ampulla: 'Ampulla', appendix: 'Appendix', 'uterine-sarcoma': 'Uterine sarcoma', gist: 'GIST' };
// chips: lung splits into NSCLC and SCLC
function chipsFor(sec) {
  const out = [];
  D.SITES.filter(s => s.section === sec && (s.systems.length || D.VS[s.id])).sort((a, b) => (W[b.id] || 10) - (W[a.id] || 10)).forEach(s => {
    if (s.id === 'lung') { out.push({ key: 'nsclc', label: 'NSCLC', site: 'lung' }, { key: 'sclc', label: 'SCLC', site: 'lung' }); }
    else out.push({ key: s.id, label: SHORT[s.id] || s.label, site: s.id });
  });
  return out;
}
function chosen() { return ui.section === 'All' ? [] : (ui.sel[ui.section] || []); }
function scopeSites() {
  if (ui.mode === 'table' && ui.site && SITEBY[ui.site]) return [SITEBY[ui.site]];
  const inSec = D.SITES.filter(s => ui.section === 'All' || s.section === ui.section);
  const ch = chosen(); if (!ch.length) return inSec;
  const ids = new Set(chipsFor(ui.section).filter(c => ch.includes(c.key)).map(c => c.site));
  return inSec.filter(s => ids.has(s.id));
}
function lungHist() { const ch = chosen(); if (ui.section !== 'Thoracic' || !ch.length) return null; const n = ch.includes('nsclc'), c = ch.includes('sclc'); return n && !c ? 'nsclc' : c && !n ? 'sclc' : null; }
function scopeKey() { return ui.section + '|' + chosen().slice().sort().join(','); }
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M6 21v-6M12 21V10M18 21V5"/></svg>';
const MODES = [['case', 'Case'], ['table', 'Table']];
// approximate relative annual incidence (worldwide, rough); sets how often each site is drawn
const W = { lung: 2480, breast: 2310, colorectal: 1930, prostate: 1470, gastric: 970, hcc: 700, thyroid: 820, cervix: 660, bladder: 580, lymphoma: 630, esophageal: 510, pancreas: 500, rcc: 430, endometrial: 420, 'oral-cavity': 390, melanoma: 330, ovarian: 320, glioma: 200, larynx: 190, gallbladder: 120, nasopharyngeal: 120, 'oropharynx-p16pos': 55, 'oropharynx-p16neg': 50, hypopharynx: 85, salivary: 55, 'cholangio-intrahepatic': 60, 'cholangio-perihilar': 40, 'cholangio-distal': 20, testis: 72, anal: 50, vulvar: 47, 'cutaneous-scc': 60, 'soft-tissue-sarcoma': 50, gist: 40, penile: 37, mesothelioma: 31, utuc: 30, 'bone-sarcoma': 20, gtn: 20, sinonasal: 20, vaginal: 18, 'net-gep': 20, 'net-pancreas': 15, 'net-rectal': 12, 'net-jejunoileal': 10, 'net-gastric': 8, 'net-appendiceal': 8, 'net-duodenal': 5, 'net-colonic': 4, 'small-bowel': 12, ampulla: 15, thymoma: 15, 'uterine-sarcoma': 15, appendix: 10, adrenal: 7, merkel: 3, urethral: 3 };
// incidence weights, with a floor of 0.6% of the list total so that rare sites still come up
function weighted(list) { const raw = list.reduce((a, s) => a + (W[s.id] || 10), 0), wt = s => Math.max(W[s.id] || 10, raw * 0.006), tot = list.reduce((a, s) => a + wt(s), 0); let r = Math.random() * tot; for (const s of list) { r -= wt(s); if (r < 0) return s; } return list[list.length - 1]; }
let body, edEl, tableLink = null, current = null, lastId = null, jumpSys = null;
const HANDSITE = { crc: 'colorectal', oral: 'oral-cavity', eso: 'esophageal' };
function caseSite() {
  if (!current) return null;
  if (current.kind === 'vs') return current.v.site;
  const s = current.sys && current.sys.site; return s ? (HANDSITE[s] || s) : null;
}

// ---------- hosted layout (oncOS Staging › Practice) ----------
// The sidebar's tumour groups set the scope; a scope line above the case opens
// the same list on a phone; the case and answers sit left of the result on wide screens.
const NAV_ORDER = ['Breast', 'Thoracic', 'GI', 'GU', 'Gynae', 'H&N', 'Skin', 'CNS', 'Sarcoma', 'Lymphoma'];
const SECFULL = { GI: 'Gastrointestinal', GU: 'Genitourinary', Gynae: 'Gynaecological', 'H&N': 'Head & Neck', CNS: 'Central Nervous System' };
const secName = sec => SECFULL[sec] || sec;
const chipLabel = c => c.site === 'lung' ? c.label : SITEBY[c.site].label;
function scopeLabel() {
  if (ui.section === 'All') return 'All cancers';
  const ch = chosen(), chips = chipsFor(ui.section).filter(c => ch.includes(c.key));
  return secName(ui.section) + (chips.length ? ' · ' + chips.map(chipLabel).join(', ') : '');
}
function setScope(sec, key) {
  if (sec === 'All') ui.section = 'All';
  else if (key === null) { ui.section = sec; ui.sel[sec] = []; }
  else if (ui.section !== sec) { ui.section = sec; ui.sel[sec] = [key]; }
  else { const cur = (ui.sel[sec] || []).slice(), i = cur.indexOf(key); if (i >= 0) cur.splice(i, 1); else cur.push(key); ui.sel[sec] = cur; }
  saveUi(); shell();
  // phone: the choice closes the Sections sheet so the new case shows
  if (window.matchMedia && window.matchMedia('(max-width:760px)').matches) document.body.classList.remove('nav-open');
}
function navBtn(label, active, fn) { return el('button', { type: 'button', class: active ? 'active' : null, 'aria-pressed': String(!!active), on: { click: fn } }, [el('span', { text: label })]); }
function renderNav() {
  const nav = HOST.nav; if (!nav) return;
  const keep = {};
  nav.querySelectorAll('.navsec').forEach(b => { keep[b.dataset.sec] = !b.classList.contains('collapsed'); });
  nav.innerHTML = '';
  nav.appendChild(el('div', { class: 'items' }, [navBtn('All cancers', ui.section === 'All', () => setScope('All'))]));
  NAV_ORDER.forEach(sec => {
    const chips = chipsFor(sec); if (!chips.length) return;
    const ch = ui.section === sec ? chosen() : null;
    const open = sec in keep ? keep[sec] : ui.section === sec;
    const block = el('div', { class: 'navsec' + (open ? '' : ' collapsed'), 'data-sec': sec });
    const head = el('button', { type: 'button', class: 'secname', 'aria-expanded': String(open), on: { click: () => { const shut = block.classList.toggle('collapsed'); head.setAttribute('aria-expanded', String(!shut)); } } }, [el('span', { text: secName(sec) })]);
    const rows = [navBtn('All ' + secName(sec), !!ch && !ch.length, () => setScope(sec, null))]
      .concat(chips.slice().sort((a, b) => chipLabel(a).localeCompare(chipLabel(b))).map(c => navBtn(chipLabel(c), !!ch && ch.includes(c.key), () => setScope(sec, c.key))));
    block.appendChild(head); block.appendChild(el('div', { class: 'items' }, rows));
    nav.appendChild(block);
  });
}
function hostShell() {
  const root = HOST.root; root.innerHTML = '';
  edEl = el('div', { class: 'ed' });
  const scope = el('button', { type: 'button', class: 'scope', on: { click: () => { const b = document.getElementById('burger'); if (b) b.click(); } } },
    [el('span', { class: 'k', text: 'Scope' }), el('span', { class: 'v', text: scopeLabel() })]);
  body = el('div', { id: 'body', class: 'cols' });
  root.appendChild(edEl); root.appendChild(scope); root.appendChild(body);
  renderNav();
  if (current && current.key === scopeKey()) return current.kind === 'vs' ? drawVs() : drawCase();
  newCase();
}
// left: case and answers; right: result, debrief and Next (one column when standalone)
function cols() {
  body.innerHTML = '';
  if (!HOST) return [body, body];
  const l = el('div', { class: 'col frame' }), r = el('div', { class: 'col frame' });
  body.appendChild(l); body.appendChild(r);
  return [l, r];
}
function caseBand() {
  const b = el('div', { class: 'band first' }, [current && current.again ? 'Repeat' : 'Case']);
  if (HOST) { tableLink = el('a', { class: 'r tablelink', href: HOST.tableHref(caseSite(), caseAnchor()), text: 'Table' }); b.appendChild(tableLink); }
  return b;
}

function shell() {
  if (HOST) return hostShell();
  const root = $('#app'); root.innerHTML = '';
  const bar = el('div', { class: 'bar' }); bar.innerHTML = ICON; bar.appendChild(el('span', { text: 'Staging drill' })); edEl = el('span', { class: 'ed' }); bar.appendChild(edEl);
  const modes = el('div', { class: 'row modes', role: 'group' }, MODES.map(m => el('button', { type: 'button', 'aria-pressed': String(ui.mode === m[0]), text: m[1], on: { click: () => {
    if (m[0] === 'table' && ui.mode === 'case' && current) { const sid = caseSite(); if (sid) { ui.site = sid; jumpSys = current.sys ? current.sys.id : null; } }
    ui.mode = m[0]; saveUi(); shell();
  } } })));
  const secs = el('div', { class: 'row secs', role: 'group' }, SECTIONS.map(s => el('button', { type: 'button', 'aria-pressed': String(ui.section === s), text: s, on: { click: () => { ui.section = s; ui.site = ''; saveUi(); shell(); } } })).concat([el('span', { class: 'fill' })]));
  const inSec = D.SITES.filter(s => ui.section === 'All' || s.section === ui.section).slice().sort((a, b) => a.label.localeCompare(b.label));
  let pickRow = null;
  if (ui.mode === 'case' && ui.section !== 'All') {
    const ch = chosen(), chips = chipsFor(ui.section);
    if (chips.length > 1) {
      pickRow = el('div', { class: 'row sites', role: 'group' }, chips.map(c => el('button', { type: 'button', 'aria-pressed': String(ch.includes(c.key)), text: c.label, on: { click: () => {
        const cur = (ui.sel[ui.section] || []).slice(), i = cur.indexOf(c.key);
        if (i >= 0) cur.splice(i, 1); else cur.push(c.key);
        ui.sel[ui.section] = cur; saveUi(); shell();
      } } })));
      const pad = (3 - chips.length % 3) % 3; for (let i = 0; i < pad; i++) pickRow.appendChild(el('span', { class: 'fill' }));
    }
  }
  const sel = el('select', { id: 'site', 'aria-label': 'Site', on: { change: e => { ui.site = e.target.value; saveUi(); shell(); } } },
    [el('option', { value: '', text: ui.section === 'All' ? 'All sites' : 'All ' + ui.section })].concat(inSec.map(s => el('option', { value: s.id, text: s.label }))));
  sel.value = ui.site && inSec.some(s => s.id === ui.site) ? ui.site : '';
  if (!sel.value) ui.site = '';
  root.appendChild(el('div', { class: 'frame' }, [bar, modes, secs, ui.mode === 'table' ? el('div', { class: 'selrow' }, [sel]) : pickRow]));
  body = el('div', { id: 'body' });
  root.appendChild(el('div', { class: 'frame' }, [body]));
  if (ui.mode === 'table') return showTable();
  if (current && current.key === scopeKey()) return current.kind === 'vs' ? drawVs() : drawCase();
  newCase();
}
// the Staging block for the case's grouping (oesophagus: cTNM, pTNM or ypTNM table)
function caseAnchor() {
  const s = caseSite(), a = s && SITEBY[s] && SITEBY[s].data.anchors;
  return a && current && current.sys ? a[current.sys.id] || null : null;
}
function setEd(text) { edEl.textContent = text || ''; if (tableLink) tableLink.href = HOST.tableHref(caseSite(), caseAnchor()); }
function optGrid(opts, onPick, marks, wide) {
  const cols = wide ? 1 : opts.length <= 3 ? opts.length : 4;
  const g = el('div', { class: 'opts', style: null }, opts.map((o, i) => el('button', { type: 'button', 'data-k': String(i + 1), class: marks ? (marks[o] || null) : null, text: o, disabled: marks ? '' : null, on: { click: () => onPick(o) } })));
  g.style.setProperty('--cols', cols);
  const pad = (cols - opts.length % cols) % cols;
  for (let i = 0; i < pad; i++) g.appendChild(el('span', { class: 'blank' }));
  Array.from(g.children).forEach((c, i) => { if ((i + 1) % cols === 0) c.classList.add('er'); });
  return g;
}
function pickSite() {
  const sites = scopeSites().filter(s => s.systems.length || D.VS[s.id]);
  return sites.length ? weighted(sites) : null;
}
function itemsInScope(filter) {
  const ids = new Set(scopeSites().map(s => s.id));
  return D.ITEMS.filter(it => ids.has(it.site) && (!filter || filter(it)));
}
function nextItem(filter) {
  const pool = itemsInScope(filter);
  if (!pool.length) return null;
  let it, g = 0; do { it = D.pick(pool); g++; } while (pool.length > 1 && it.id === lastId && g < 10);
  lastId = it.id; return it;
}

// ---------- Case ----------
function nextCase() { newCase(); try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }
function newCase() {
  // at most every second case is a repeat, so new cases keep coming
  const rep = current && current.again ? null : dueRepeat();
  if (rep && repeatCase(rep)) return;
  const site = pickSite();
  if (!site) return empty();
  if (!site.systems.length || (D.VS[site.id] && D.VS[site.id].only)) { vsCase(site.id); current.key = scopeKey(); return; }
  const sys = D.SYS[D.pick(site.systems)];
  const lh = site.id === 'lung' ? lungHist() : null;
  D.setLungHist(lh);
  let tg, g = 0; do { tg = D.randomTarget(sys); } while (lh === 'sclc' && (tg.t === 'Tis' || tg.t === 'T1mi') && g++ < 50);
  const c = D.makeCase(tg);
  current = { kind: 'case', key: scopeKey(), c, sys, picks: { T: null, N: null, M: null, S: null }, step: 'T', done: false, lh };
  drawCase();
}
// a missed cell again, with new wording
function repeatCase(rep) {
  if (rep.vs) {
    if (!D.VS[rep.site]) return false;
    current = { kind: 'vs', key: scopeKey(), v: D.makeVsCase(rep.site, rep.cat), pick: null, done: false, again: rep };
    drawVs(); return true;
  }
  const sys = D.SYS[rep.key];
  if (!sys || !rep.tg) return false;
  D.setLungHist(rep.lh || null);
  const c = D.makeCase(Object.assign({}, rep.tg, { q: rep.tg.q ? Object.assign({}, rep.tg.q) : null }));
  current = { kind: 'case', key: scopeKey(), c, sys, picks: { T: null, N: null, M: null, S: null }, step: 'T', done: false, again: rep, lh: rep.lh || null };
  drawCase(); return true;
}
function optionsFor(step) {
  const { sys, c } = current;
  if (step === 'T') return sys.T;
  if (step === 'N') return sys.fineN ? sys.fineN[c.setting] : sys.N;
  if (step === 'M') return sys.M;
  return sys.stages;
}
function drawCase() {
  const { c, sys, picks, step, done } = current;
  setEd(sys.label + ' · ' + sys.edition);
  const [L, R] = cols();
  L.appendChild(caseBand());
  L.appendChild(el('div', { class: 'vig', text: c.text }));
  const truth = { T: c.t, N: c.nFine || c.n, M: c.m, S: c.stage };
  L.appendChild(el('div', { class: 'band' }, [done ? 'Result' : (step === 'S' ? 'Stage' : step)]));
  L.appendChild(el('div', { class: 'strip' }, ['T', 'N', 'M', 'S'].map(k => {
    const v = picks[k], cls = done ? (v === truth[k] ? 'ok' : 'bad') : '';
    return el('button', { type: 'button', class: cls || null, 'aria-current': !done && step === k ? 'step' : null, on: { click: () => { if (!current.done) { current.step = k; drawCase(); } } } },
      [el('b', { text: k === 'S' ? 'Stage' : k }), el('span', { text: v || '—' }), done && v !== truth[k] ? el('small', { text: truth[k] }) : null]);
  })));
  if (!done) {
    L.appendChild(optGrid(optionsFor(step), v => {
      current.picks[step] = v;
      const nextEmpty = ['T', 'N', 'M', 'S'].find(k => !current.picks[k]);
      if (nextEmpty) current.step = nextEmpty;
      else {
        current.done = true;
        const wrong = ['T', 'N', 'M', 'S'].filter(k => current.picks[k] !== truth[k]);
        const hist = (c.fields || []).find(f => f[0] === 'Histology'), sclc = !!(hist && /^Small cell/.test(hist[1]));
        const label = sys.site === 'lung' ? (sclc ? 'SCLC' : 'NSCLC') : sys.label;
        record(sys.id + (sys.site === 'lung' ? (sclc ? '|sclc' : '|nsclc') : ''), label, caseSite(), !wrong.length, wrong,
          current.again || null);
        if (wrong.length) { const q = score.queue[score.queue.length - 1]; q.key = sys.id; q.tg = { sys: sys.id, t: c.t, n: c.n, m: c.m, q: c.q || null }; q.lh = sclc ? 'sclc' : 'nsclc'; saveScore(); }
      }
      drawCase();
    }));
  } else {
    const allOk = ['T', 'N', 'M', 'S'].every(k => picks[k] === truth[k]);
    const rows = [];
    [['T', 'T'], ['N', 'N'], ['M', 'M']].forEach(([k, ax]) => {
      if (picks[k] === truth[k]) { rows.push([truth[k], plainWhy(c.why[k], truth[k]), 'ok']); return; }
      rows.push([picks[k], D.defOf(sys.site, ax, picks[k]) || '—', 'x']);
      const dTrue = D.defOf(sys.site, ax, truth[k]), w = plainWhy(c.why[k], truth[k]);
      rows.push([truth[k], dTrue && w.indexOf(dTrue) < 0 ? dTrue + '. In this case: ' + w : w, 'ok']);
    });
    if (picks.S === truth.S) rows.push([c.stage, c.ruleText, 'ok']);
    else {
      const mine = sys.rules.filter(r => r.stage === picks.S).map(r => D.ruleText(sys, r)).join(' · ');
      rows.push([picks.S, mine || '—', 'x']);
      rows.push([c.stage, c.ruleText, 'ok']);
      const pT = picks.T, pN = picks.N, pM = picks.M;
      if ([pT, pN, pM].some((v, i) => v !== [truth.T, truth.N, truth.M][i])) {
        let own = null; try { own = D.stageOf(sys, pT, sys.fineN ? (D.BREAST_NMAP && D.BREAST_NMAP[pN]) || pN : pN, pM, c.q); } catch (e) {}
        if (own) rows.push(['※', 'Your ' + pT + ' ' + pN + ' ' + pM + ' would give ' + own, 'n']);
      }
    }
    if (c.why.X) rows.push(['※', plainWhy(c.why.X, ''), 'n']);
    R.appendChild(el('div', { class: 'verdict' }, [el('div', { class: 'head', text: (allOk ? '★ ' : '✕ ') + c.stage }), el('div', { class: 'why' }, rows.flatMap(r => [el('div', { text: (r[2] === 'x' ? '✕ ' : r[2] === 'ok' && !allOk ? '★ ' : '') + r[0], class: r[2] === 'x' ? 'x' : null }), el('div', { text: r[1] })]))]));
    const hist = (c.fields || []).find(f => f[0] === 'Histology');
    const db = debrief(sys.site, { s: c.stage, t: c.t, n: c.n, m: c.m, q: c.q, label: sys.label, rectal: !!c.rectal, sclc: !!(hist && /^Small cell/.test(hist[1])) }, ['T', 'N', 'M', 'S'].filter(k => picks[k] !== truth[k]));
    if (db) R.appendChild(db);
    R.appendChild(scoreBlock());
    R.appendChild(el('button', { type: 'button', class: 'next', id: 'next', text: 'Next case', on: { click: nextCase } }));
  }
}
// ---------- Score ----------
const AXN = { T: 'T', N: 'N', M: 'M', S: 'Stage' };
let missOpen = false;
function scoreBlock() {
  const pc = score.done ? Math.round(100 * score.right / score.done) : 0;
  const wrap = el('div', { class: 'score' }, [el('div', { class: 'band' }, ['Score']),
    el('div', { class: 'sum' }, [['Cases', score.done], ['Correct', pc + '%'], ['Repeats', score.queue.length]].map(([k, v]) => el('div', {}, [el('b', { text: String(v) }), k])))]);
  const rows = Object.values(score.by).filter(b => b.missed).sort((a, b) => b.missed / b.done - a.missed / a.done || b.missed - a.missed || a.label.localeCompare(b.label))
    .map(b => [b.label, b.missed + ' of ' + b.done, ['T', 'N', 'M', 'S'].filter(k => b.axes[k]).map(k => AXN[k] + ' ' + b.axes[k]).join(' · ')]);
  const panel = el('div', { hidden: missOpen ? null : 'hidden' }, [rows.length ? tbl(['System', 'Missed', 'Wrong'], rows) : el('div', { class: 'note', text: 'None' }),
    el('button', { type: 'button', class: 'more reset', on: { click: () => { score = blankScore(); saveScore(); const n = scoreBlock(); wrap.replaceWith(n); } } }, ['Reset'])]);
  const btn = el('button', { type: 'button', class: 'more', 'aria-expanded': String(missOpen), on: { click: () => { missOpen = panel.hidden; panel.hidden = !missOpen; btn.setAttribute('aria-expanded', String(missOpen)); } } }, [el('span', { class: 'tri', text: '▼' }), 'Missed']);
  wrap.appendChild(btn); wrap.appendChild(panel);
  return wrap;
}
// ---------- Debrief ----------
const AX = { T: 'T', N: 'N', M: 'M', S: 'Stage' };
function debrief(siteId, x, wrong) {
  const B = window.Debrief, d = B && B.get(siteId);
  if (!d) return null;
  const EV = window.DrillEvidenceLinks || {}, local = /(^|\.)oncos\.vercel\.app$/.test(location.hostname);
  const evHref = id => (HOST || local ? '' : 'https://oncos.vercel.app') + '/evidence/#' + id;
const trials = tr => el('span', { class: 'tr' }, tr.split(/, (?![^()]*\))/).flatMap((name, i) => { const id = EV[name.replace(/ ※$/, '')]; const node = id ? el('a', { href: evHref(id), text: name, 'data-evidence': id }) : document.createTextNode(name); return i ? [', ', node] : [node]; }));
  const cell = (k, v, cls, tr) => [el('div', { class: cls || null, text: k }), el('div', {}, [v, tr ? trials(tr) : null])];
  const top = [], rest = [];
  top.push(...cell('Logic', d.logic));
  ['T', 'N', 'M', 'S'].forEach(k => { if (!d[k]) return; (wrong.includes(k) ? top : rest).push(...cell((wrong.includes(k) ? '✕ ' : '') + AX[k], d[k], wrong.includes(k) ? 'x' : null)); });
  const tx = B.txFor(d, x);
  if (tx) top.push(...cell('★ ' + x.s, tx.text, null, tx.trials));
  const wrap = el('div', { class: 'debrief' }, [el('div', { class: 'band' }, ['Debrief']), el('div', { class: 'why' }, top)]);
  if (rest.length) {
    const more = el('div', { class: 'why', hidden: 'hidden' }, rest);
    const btn = el('button', { type: 'button', class: 'more', 'aria-expanded': 'false', on: { click: () => { const open = more.hidden; more.hidden = !open; btn.setAttribute('aria-expanded', String(open)); } } }, [el('span', { class: 'tri', text: '▼' }), 'Rules']);
    wrap.appendChild(btn); wrap.appendChild(more);
  }
  return wrap;
}
// sites with no TNM system (FIGO, Lugano, Masaoka-Koga, WHO grade): one answer
function vsCase(sid) { current = { kind: 'vs', v: D.makeVsCase(sid), pick: null, done: false }; drawVs(); }
function drawVs() {
  const { v, pick, done } = current, site = SITEBY[v.site];
  setEd(site.label + ' · ' + v.title);
  const [L, R] = cols();
  L.appendChild(caseBand());
  L.appendChild(el('div', { class: 'vig', text: v.text }));
  L.appendChild(el('div', { class: 'band' }, [v.title]));
  const marks = done ? Object.fromEntries(v.opts.map(o => [o, o === v.cat ? 'hit' : (o === pick ? 'wrong' : '')])) : null;
  L.appendChild(optGrid(v.opts, o => {
    current.pick = o; current.done = true;
    const ok = o === v.cat;
    record('vs|' + v.site, site.label + ' · ' + v.title, v.site, ok, ok ? [] : ['S'], current.again || null);
    if (!ok) { const q = score.queue[score.queue.length - 1]; q.vs = true; q.cat = v.cat; saveScore(); }
    drawVs();
  }, marks, v.opts.some(o => o.length > 14)));
  if (done) {
    const ok = pick === v.cat, rows = [];
    if (!ok) rows.push(['✕ ' + pick, D.defOf(v.site, 'S', pick) || '—', 'x']);
    rows.push([(ok ? '' : '★ ') + v.cat, D.defOf(v.site, 'S', v.cat) || '', null]);
    R.appendChild(el('div', { class: 'verdict' }, [el('div', { class: 'head', text: (ok ? '★ ' : '✕ ') + v.cat }), el('div', { class: 'why' }, rows.flatMap(r => [el('div', { text: r[0], class: r[2] }), el('div', { text: r[1] })]))]));
    const db = debrief(v.site, { s: v.cat, t: '', n: '', m: '', q: null, label: v.title }, ok ? [] : ['S']);
    if (db) R.appendChild(db);
    R.appendChild(scoreBlock());
    R.appendChild(el('button', { type: 'button', class: 'next', id: 'next', text: 'Next case', on: { click: nextCase } }));
  }
}
function empty() { body.innerHTML = ''; body.appendChild(el('div', { class: 'band first' }, ['None'])); }

// ---------- Table ----------
function tbl(head, rows, numCols) {
  const t = el('table', {}, [el('tr', {}, head.map(h => el('th', { text: h })))]);
  rows.forEach(r => t.appendChild(el('tr', {}, r.map((c, i) => el('td', { class: i === 0 ? 'k' : null, text: c })))));
  return el('div', { class: 'tw' }, [t]);
}
function showTable() {
  body.innerHTML = '';
  const sites = scopeSites();
  if (sites.length !== 1) {
    setEd('');
    body.appendChild(el('div', { class: 'band first' }, [ui.section === 'All' ? 'All sites' : ui.section]));
    const list = el('div', { class: 'list' });
    let lastSec = null;
    sites.slice().sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.label.localeCompare(b.label)).forEach(s => {
      if (ui.section === 'All' && s.section !== lastSec) { list.appendChild(el('div', { class: 'sub', text: s.section })); lastSec = s.section; }
      list.appendChild(el('button', { type: 'button', on: { click: () => { ui.site = s.id; if (ui.section !== 'All' && s.section !== ui.section) ui.section = s.section; saveUi(); shell(); } } }, [el('span', { text: s.label }), el('span', { class: 'r', text: s.data.system })]));
    });
    body.appendChild(list);
    return;
  }
  const s = sites[0], d = s.data, r = d.raw;
  setEd(s.label);
  body.appendChild(el('div', { class: 'band first' }, [s.label]));
  const src = el('div', {}); src.appendChild(el('a', { href: d.source_url, target: '_blank', rel: 'noopener', text: d.source }));
  body.appendChild(el('div', { class: 'form' }, [el('div', { text: 'System' }), el('div', { text: d.system }), el('div', { text: 'Edition' }), el('div', { text: d.edition }), el('div', { text: 'Source' }), src]));
  if (d.notes) body.appendChild(el('div', { class: 'note', text: d.notes }));
  const vs = D.VS[s.id];
  if (vs && vs.only && vs.D) { body.appendChild(el('div', { class: 'band', 'data-sys': 'vs' }, [vs.title + ' 2022'])); body.appendChild(tbl(['Stage', 'Definition'], Object.keys(vs.D).map(k => [k, vs.D[k]]))); }
  const T = r.drill_t ? r.drill_t.map(x => ({ cat: x[0], desc: x[1] })) : r.t;
  if (T) { body.appendChild(el('div', { class: 'band' }, [r.t_title || 'T · Primary tumour'])); body.appendChild(tbl(['T', 'Definition'], T.map(x => [x.cat, x.desc]))); }
  if (r.n) { body.appendChild(el('div', { class: 'band' }, [r.n_title || 'N · Regional nodes'])); body.appendChild(tbl(['N', 'Definition'], r.n.map(x => [x.cat, x.desc]))); }
  if (r.pn) { body.appendChild(el('div', { class: 'band' }, [r.pn_title || 'pN · Pathological nodes'])); body.appendChild(tbl(['pN', 'Definition'], r.pn.map(x => [x.cat, x.desc]))); }
  if (r.m) { body.appendChild(el('div', { class: 'band' }, ['M · Distant metastasis'])); body.appendChild(tbl(['M', 'Definition'], r.m.map(x => [x.cat, x.desc]))); }
  s.systems.forEach(sid => {
    const sys = D.SYS[sid];
    const hasQ = sys.rules.some(x => x.q);
    body.appendChild(el('div', { class: 'band', 'data-sys': sid }, [s.systems.length > 1 ? sys.label.replace(/^.*?· /, '') : 'Stage groups']));
    body.appendChild(tbl(['Stage', 'T', 'N', 'M'].concat(hasQ ? ['Also'] : []), sys.rules.map(x => {
      const t = D.specText(x.t, sys.T), n = D.specText(x.n, sys.N), m = D.specText(x.m, sys.M);
      const row = [x.stage, t === 'Any' ? 'Any T' : t, n === 'Any' ? 'Any N' : n, m];
      if (hasQ) row.push(x.q ? Object.keys(x.q).map(k => D.qLabel(sys, k, x.q[k])).join(' · ') : '');
      return row;
    })));
    if (sys.note) body.appendChild(el('div', { class: 'note', text: sys.note }));
  });
  if (!s.systems.length && r.stage_groups) { body.appendChild(el('div', { class: 'band' }, [r.stage_groups_title || 'Stage groups'])); body.appendChild(tbl(['Stage', 'T', 'N', 'M'], r.stage_groups.map(g => [g.stage, g.t, g.n, g.m]))); }
  if (r.figo) { body.appendChild(el('div', { class: 'band' }, ['FIGO'])); body.appendChild(tbl(['Stage', 'Definition'], r.figo.map(x => [x.stage, x.desc]))); }
  if (r.stages_other && !(vs && vs.only) && !(s.systems.length && /group/i.test(r.stages_other_title || ''))) { body.appendChild(el('div', { class: 'band' }, [r.stages_other_title || 'Stages'])); body.appendChild(tbl(['Stage', 'Definition'], r.stages_other.map(x => [x.stage, x.desc]))); }
  (r.matrix_tables || []).forEach(m => { body.appendChild(el('div', { class: 'band' }, [m.title])); body.appendChild(tbl(m.cols, m.rows)); });
  if (s.id === 'esophageal') body.appendChild(el('div', { class: 'note', text: 'cTNM and ypTNM per Rice et al., J Thorac Oncol 2017;12:36' }));
  const target = jumpSys && s.systems.length > 1 ? body.querySelector('[data-sys="' + jumpSys + '"]') : null;
  jumpSys = null;
  if (target) target.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
}

// ---------- state (the host keeps the open case across module switches) ----------
window.DrillState = {
  scope(siteId) {
    const s = SITEBY[siteId]; if (!s) return false;
    ui.section = s.section; ui.sel[s.section] = siteId === 'lung' ? ['nsclc', 'sclc'] : [siteId];
    saveUi(); shell();
    return true;
  },
  get() {
    let cur = null;
    if (current && current.kind === 'case') cur = { kind: 'case', key: current.key, c: current.c, sys: current.sys.id, picks: current.picks, step: current.step, done: current.done, again: current.again || null, lh: current.lh || null };
    else if (current && current.kind === 'vs') cur = { kind: 'vs', key: current.key, v: current.v, pick: current.pick, done: current.done, again: current.again || null };
    return JSON.parse(JSON.stringify({ ui, cur }));
  },
  set(v) {
    if (!v || typeof v !== 'object' || !v.ui || typeof v.ui !== 'object') return false;
    const c = v.cur;
    if (c && !(c.kind === 'case' && D.SYS[c.sys] && c.c && c.picks) && !(c.kind === 'vs' && c.v && SITEBY[c.v.site])) return false;
    ui = Object.assign({ mode: 'case', section: 'All', site: '', sel: {} }, v.ui);
    if (HOST) ui.mode = 'case';
    current = !c ? null : c.kind === 'case' ? { kind: 'case', key: c.key, c: c.c, sys: D.SYS[c.sys], picks: c.picks, step: c.step, done: c.done, again: c.again || null, lh: c.lh || null } : { kind: 'vs', key: c.key, v: c.v, pick: c.pick, done: c.done, again: c.again || null };
    saveUi(); shell();
    return true;
  }
};

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if (e.target && /textarea|input|select/i.test(e.target.tagName)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') { const n = $('#next'); if (n) { e.preventDefault(); n.click(); } return; }
  const map = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '0': 10, 'q': 11, 'w': 12, 'e': 13, 'r': 14, 't': 15, 'y': 16, 'u': 17, 'i': 18, 'o': 19, 'p': 20 };
  const k = map[e.key.toLowerCase()];
  if (k) { const b = document.querySelector('.opts button[data-k="' + k + '"]:not([disabled])'); if (b) { e.preventDefault(); b.click(); } }
});
shell();
})();
