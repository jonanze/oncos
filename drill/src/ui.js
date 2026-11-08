(function () {
'use strict';
const D = window.Drill;
const $ = (s, r) => (r || document).querySelector(s);
const el = (tag, attrs, kids) => { const e = document.createElement(tag); if (attrs) for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'on') { for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); } else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]); } (kids || []).forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)); return e; };
const KEY = 'oncos-drill-ui';
let ui = { mode: 'case', section: 'All', site: '', sel: {} };
try { const u = JSON.parse(localStorage.getItem(KEY) || 'null'); if (u) ui = Object.assign(ui, u); } catch (e) {}
if (ui.mode !== 'table') ui.mode = 'case';
if (!ui.sel || typeof ui.sel !== 'object' || Array.isArray(ui.sel)) ui.sel = {};
function saveUi() { try { localStorage.setItem(KEY, JSON.stringify(ui)); } catch (e) {} }

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
function weighted(list) { const tot = list.reduce((a, s) => a + (W[s.id] || 10), 0); let r = Math.random() * tot; for (const s of list) { r -= W[s.id] || 10; if (r < 0) return s; } return list[list.length - 1]; }
let body, edEl, current = null, lastId = null, jumpSys = null;
const HANDSITE = { crc: 'colorectal', oral: 'oral-cavity', eso: 'esophageal' };
function caseSite() {
  if (!current) return null;
  if (current.kind === 'vs') return current.v.site;
  const s = current.sys && current.sys.site; return s ? (HANDSITE[s] || s) : null;
}

function shell() {
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
function setEd(text) { edEl.textContent = text || ''; }
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
  const site = pickSite();
  if (!site) return empty();
  if (!site.systems.length || (D.VS[site.id] && D.VS[site.id].only)) { vsCase(site.id); current.key = scopeKey(); return; }
  const sys = D.SYS[D.pick(site.systems)];
  const lh = site.id === 'lung' ? lungHist() : null;
  D.setLungHist(lh);
  let tg, g = 0; do { tg = D.randomTarget(sys); } while (lh === 'sclc' && (tg.t === 'Tis' || tg.t === 'T1mi') && g++ < 50);
  const c = D.makeCase(tg);
  current = { kind: 'case', key: scopeKey(), c, sys, picks: { T: null, N: null, M: null, S: null }, step: 'T', done: false };
  drawCase();
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
  body.innerHTML = '';
  body.appendChild(el('div', { class: 'band first' }, ['Case']));
  body.appendChild(el('div', { class: 'vig', text: c.text }));
  const truth = { T: c.t, N: c.nFine || c.n, M: c.m, S: c.stage };
  body.appendChild(el('div', { class: 'band' }, [done ? 'Result' : (step === 'S' ? 'Stage' : step)]));
  body.appendChild(el('div', { class: 'strip' }, ['T', 'N', 'M', 'S'].map(k => {
    const v = picks[k], cls = done ? (v === truth[k] ? 'ok' : 'bad') : '';
    return el('button', { type: 'button', class: cls || null, 'aria-current': !done && step === k ? 'step' : null, on: { click: () => { if (!current.done) { current.step = k; drawCase(); } } } },
      [el('b', { text: k === 'S' ? 'Stage' : k }), el('span', { text: v || '—' }), done && v !== truth[k] ? el('small', { text: truth[k] }) : null]);
  })));
  if (!done) {
    body.appendChild(optGrid(optionsFor(step), v => {
      current.picks[step] = v;
      const nextEmpty = ['T', 'N', 'M', 'S'].find(k => !current.picks[k]);
      if (nextEmpty) current.step = nextEmpty; else current.done = true;
      drawCase();
    }));
  } else {
    const allOk = ['T', 'N', 'M', 'S'].every(k => picks[k] === truth[k]);
    const rows = [];
    [['T', 'T'], ['N', 'N'], ['M', 'M']].forEach(([k, ax]) => {
      if (picks[k] === truth[k]) { rows.push([truth[k], c.why[k], 'ok']); return; }
      rows.push([picks[k], D.defOf(sys.site, ax, picks[k]) || '—', 'x']);
      const dTrue = D.defOf(sys.site, ax, truth[k]), w = c.why[k] || '';
      rows.push([truth[k], dTrue && w.indexOf(dTrue) < 0 ? dTrue + ' ← ' + w : w, 'ok']);
    });
    if (picks.S === truth.S) rows.push([c.stage, c.ruleText, 'ok']);
    else {
      const mine = sys.rules.filter(r => r.stage === picks.S).slice(0, 3).map(r => D.ruleText(sys, r)).join(' · ');
      rows.push([picks.S, mine || '—', 'x']);
      rows.push([c.stage, c.ruleText, 'ok']);
      const pT = picks.T, pN = picks.N, pM = picks.M;
      if ([pT, pN, pM].some((v, i) => v !== [truth.T, truth.N, truth.M][i])) {
        let own = null; try { own = D.stageOf(sys, pT, sys.fineN ? (D.BREAST_NMAP && D.BREAST_NMAP[pN]) || pN : pN, pM, c.q); } catch (e) {}
        if (own) rows.push(['※', 'Your ' + pT + ' ' + pN + ' ' + pM + ' would give ' + own, 'n']);
      }
    }
    if (c.why.X) rows.push(['※', c.why.X, 'n']);
    body.appendChild(el('div', { class: 'verdict' }, [el('div', { class: 'head', text: (allOk ? '★ ' : '✕ ') + c.stage }), el('div', { class: 'why' }, rows.flatMap(r => [el('div', { text: (r[2] === 'x' ? '✕ ' : r[2] === 'ok' && !allOk ? '★ ' : '') + r[0], class: r[2] === 'x' ? 'x' : null }), el('div', { text: r[1] })]))]));
    const hist = (c.fields || []).find(f => f[0] === 'Histology');
    const db = debrief(sys.site, { s: c.stage, t: c.t, n: c.n, m: c.m, q: c.q, label: sys.label, rectal: /\brect(um|al)\b/i.test(c.text) && !/rectosigmoid/i.test(c.text), sclc: !!(hist && /^Small cell/.test(hist[1])) }, ['T', 'N', 'M', 'S'].filter(k => picks[k] !== truth[k]));
    if (db) body.appendChild(db);
    body.appendChild(el('button', { type: 'button', class: 'next', id: 'next', text: 'Next case', on: { click: nextCase } }));
  }
}
// ---------- Debrief ----------
const AX = { T: 'T', N: 'N', M: 'M', S: 'Stage' };
function debrief(siteId, x, wrong) {
  const B = window.Debrief, d = B && B.get(siteId);
  if (!d) return null;
  const EV = window.DrillEvidenceLinks || {}, local = /(^|\.)oncos\.vercel\.app$/.test(location.hostname);
  const evHref = id => (local ? '' : 'https://oncos.vercel.app') + '/evidence/#' + id;
  const trials = tr => el('span', { class: 'tr' }, tr.split(', ').flatMap((name, i) => { const id = EV[name.replace(/ ※$/, '')]; const node = id ? el('a', { href: evHref(id), text: name, 'data-evidence': id }) : document.createTextNode(name); return i ? [', ', node] : [node]; }));
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
  body.innerHTML = '';
  body.appendChild(el('div', { class: 'band first' }, ['Case']));
  body.appendChild(el('div', { class: 'vig', text: v.text }));
  body.appendChild(el('div', { class: 'band' }, [v.title]));
  const marks = done ? Object.fromEntries(v.opts.map(o => [o, o === v.cat ? 'hit' : (o === pick ? 'wrong' : '')])) : null;
  body.appendChild(optGrid(v.opts, o => { current.pick = o; current.done = true; drawVs(); }, marks, v.opts.some(o => o.length > 14)));
  if (done) {
    const ok = pick === v.cat, rows = [];
    if (!ok) rows.push(['✕ ' + pick, D.defOf(v.site, 'S', pick) || '—', 'x']);
    rows.push([(ok ? '' : '★ ') + v.cat, D.defOf(v.site, 'S', v.cat) || '', null]);
    body.appendChild(el('div', { class: 'verdict' }, [el('div', { class: 'head', text: (ok ? '★ ' : '✕ ') + v.cat }), el('div', { class: 'why' }, rows.flatMap(r => [el('div', { text: r[0], class: r[2] }), el('div', { text: r[1] })]))]));
    const db = debrief(v.site, { s: v.cat, t: '', n: '', m: '', q: null, label: v.title }, ok ? [] : ['S']);
    if (db) body.appendChild(db);
    body.appendChild(el('button', { type: 'button', class: 'next', id: 'next', text: 'Next case', on: { click: nextCase } }));
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
  if (s.id === 'esophageal') body.appendChild(el('div', { class: 'note', text: 'cTNM and ypTNM per Rice et al., J Thorac Oncol 2017;12:36; ypT0/Tis N2 not stated there and left out' }));
  const target = jumpSys && s.systems.length > 1 ? body.querySelector('[data-sys="' + jumpSys + '"]') : null;
  jumpSys = null;
  if (target) target.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
}

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if (e.target && /textarea|input|select/i.test(e.target.tagName)) return;
  if (e.key === 'Enter') { const n = $('#next'); if (n) { e.preventDefault(); n.click(); } return; }
  const map = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '0': 10, 'q': 11, 'w': 12, 'e': 13, 'r': 14, 't': 15, 'y': 16 };
  const k = map[e.key.toLowerCase()];
  if (k) { const b = document.querySelector('.opts button[data-k="' + k + '"]:not([disabled])'); if (b) { e.preventDefault(); b.click(); } }
});
shell();
})();
