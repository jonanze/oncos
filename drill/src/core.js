/* oncOS staging drill core: data, stage lookup, case generators, scheduler. No DOM. */
(function (G) {
'use strict';

// ---------- random helpers (seedable for tests) ----------
let rnd = Math.random;
function setRandom(f) { rnd = f; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function chance(p) { return rnd() < p; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sampleK(a, k) { return shuffle(a).slice(0, k); }
// value in (lo, hi], one decimal; boundary value hi allowed
function inRange(lo, hi, step) {
  step = step || 0.1;
  const n = Math.round((hi - lo) / step);
  const k = ri(1, n);
  return +(lo + k * step).toFixed(step < 1 ? 1 : 0);
}

// ---------- matrix spec helpers ----------
function expand(spec, order) {
  if (Array.isArray(spec)) return spec.slice();
  if (spec === '*') return order.slice();
  const out = [];
  spec.split(',').forEach(part => {
    part = part.trim();
    if (part.includes('..')) {
      const [a, b] = part.split('..');
      const i = order.indexOf(a), j = order.indexOf(b);
      if (i < 0 || j < 0 || j < i) throw new Error('bad range ' + part);
      out.push(...order.slice(i, j + 1));
    } else {
      if (order.indexOf(part) < 0) throw new Error('bad cat ' + part);
      out.push(part);
    }
  });
  return out;
}

// System: {id, site, label, short, edition, T, N, M, Q (optional {key: [values]}), rules, invalid(t,n,m,q)}
// rule: [stage, tSpec, nSpec, mSpec, qSpec]; qSpec {key: [values]} or undefined
// Cells the tables allow but that do not occur clinically: in situ with nodes or M1, no primary with no nodes,
// resection specimens with unresectable or metastatic disease. Practice never draws these.
function implausible(s, t, n, m, q) {
  const m1 = m !== s.M[0], n0 = n === s.N[0];
  if (/^p?(Tis|Ta)$/.test(t) && s.site !== 'testis' && (!n0 || m1)) return true;
  if (t === 'T1mi' && m1) return true;
  if (t === 'T0' && n0 && s.id !== 'eso-yp') return true;
  if (s.id === 'breast' && t === 'T0' && n === 'N1mi') return true;
  if ((s.setting === 'p' || s.setting === 'yp') && (t === 'T4b' || m1)) return true;
  if (s.site === 'appendix' && q && q.hist === 'Non-mucinous' && m === 'M1a') return true;
  if (s.site === 'merkel' && t === 'T0' && n !== 'N1b' && !(s.id === 'merkel-c' && n === 'N1')) return true;
  return false;
}
function buildSystem(s) {
  const inv0 = s.invalid;
  s.invalid = (t, n, m, q) => !!(inv0 && inv0(t, n, m, q)) || implausible(s, t, n, m, q);
  s.rules = s.rules.map(r => ({
    stage: r[0], t: expand(r[1], s.T), n: expand(r[2], s.N), m: expand(r[3], s.M), q: r[4] || null
  }));
  s.stages = [];
  s.rules.forEach(r => { if (!s.stages.includes(r.stage)) s.stages.push(r.stage); });
  return s;
}
function qMatch(rq, q) {
  if (!rq) return true;
  return Object.keys(rq).every(k => q && rq[k].includes(q[k]));
}
function stageOf(sys, t, n, m, q) {
  const hits = sys.rules.filter(r => r.t.includes(t) && r.n.includes(n) && r.m.includes(m) && qMatch(r.q, q));
  const st = new Set(hits.map(h => h.stage));
  if (st.size !== 1) return null;
  return hits[0].stage;
}
function ruleOf(sys, t, n, m, q) {
  return sys.rules.find(r => r.t.includes(t) && r.n.includes(n) && r.m.includes(m) && qMatch(r.q, q)) || null;
}
function qCombos(sys) {
  if (!sys.Q) return [null];
  let combos = [{}];
  Object.keys(sys.Q).forEach(k => {
    const next = [];
    combos.forEach(c => sys.Q[k].forEach(v => next.push(Object.assign({}, c, { [k]: v }))));
    combos = next;
  });
  return combos;
}
// Totality: every valid cell (and qualifier combo) maps to exactly one rule
function checkTotality(sys) {
  const problems = [];
  let cells = 0;
  sys.T.forEach(t => sys.N.forEach(n => sys.M.forEach(m => qCombos(sys).forEach(q => {
    if (sys.invalid && sys.invalid(t, n, m, q)) return;
    cells++;
    const hits = sys.rules.filter(r => r.t.includes(t) && r.n.includes(n) && r.m.includes(m) && qMatch(r.q, q));
    if (new Set(hits.map(h => h.stage)).size !== 1) problems.push({ t, n, m, q, hits: hits.map(h => h.stage) });
  }))));
  // rules that cover only invalid cells
  return { cells, problems };
}
// Cards: M0 cells (collapsing qualifier combos that do not change stage), one card per M1 category
function cards(sys) {
  const out = [];
  const m0 = sys.M[0];
  sys.T.forEach(t => sys.N.forEach(n => {
    if (sys.invalid && sys.invalid(t, n, m0, null) && !sys.Q) return;
    const combos = qCombos(sys).filter(q => !(sys.invalid && sys.invalid(t, n, m0, q)));
    if (!combos.length) return;
    const stages = new Set(combos.map(q => stageOf(sys, t, n, m0, q)));
    if (stages.size === 1) out.push({ id: sys.id + '|' + t + '|' + n + '|' + m0, sys: sys.id, t, n, m: m0, q: null });
    else combos.forEach(q => out.push({ id: sys.id + '|' + t + '|' + n + '|' + m0 + '|' + Object.keys(q).map(k => q[k]).join('/'), sys: sys.id, t, n, m: m0, q }));
  }));
  sys.M.slice(1).forEach(m => sys.T.some(t => sys.N.some(n => !sys.invalid(t, n, m, null))) && out.push({ id: sys.id + '|*|*|' + m, sys: sys.id, t: '*', n: '*', m, q: null }));
  return out;
}

// ---------- systems ----------
const SYS = {};
function def(s) { SYS[s.id] = buildSystem(s); }

// Lung, IASLC/UICC 9th (2024, in effect Jan 2025)
def({
  id: 'lung', site: 'lung', label: 'Lung', short: 'Lung', edition: 'IASLC/UICC 9th',
  T: ['Tis', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2a', 'T2b', 'T3', 'T4'],
  N: ['N0', 'N1', 'N2a', 'N2b', 'N3'],
  M: ['M0', 'M1a', 'M1b', 'M1c1', 'M1c2'],
  invalid: (t, n) => (t === 'Tis' || t === 'T1mi') && n !== 'N0',
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['IA1', 'T1mi,T1a', 'N0', 'M0'], ['IA2', 'T1b', 'N0', 'M0'], ['IA3', 'T1c', 'N0', 'M0'],
    ['IB', 'T2a', 'N0', 'M0'], ['IIA', 'T2b', 'N0', 'M0'], ['IIA', 'T1a..T1c', 'N1', 'M0'],
    ['IIB', 'T1a..T1c', 'N2a', 'M0'], ['IIB', 'T2a..T2b', 'N1', 'M0'], ['IIB', 'T3', 'N0', 'M0'],
    ['IIIA', 'T1a..T1c', 'N2b', 'M0'], ['IIIA', 'T2a..T2b', 'N2a', 'M0'], ['IIIA', 'T3', 'N1..N2a', 'M0'], ['IIIA', 'T4', 'N0..N1', 'M0'],
    ['IIIB', 'T1a..T1c', 'N3', 'M0'], ['IIIB', 'T2a..T2b', 'N2b..N3', 'M0'], ['IIIB', 'T3', 'N2b', 'M0'], ['IIIB', 'T4', 'N2a..N2b', 'M0'],
    ['IIIC', 'T3..T4', 'N3', 'M0'], ['IVA', '*', '*', 'M1a,M1b'], ['IVB', '*', '*', 'M1c1,M1c2']
  ]
});

// Colorectal, AJCC 8th
def({
  id: 'crc', site: 'crc', label: 'Colorectal', short: 'CRC', edition: 'AJCC 8th',
  T: ['Tis', 'T1', 'T2', 'T3', 'T4a', 'T4b'],
  N: ['N0', 'N1a', 'N1b', 'N1c', 'N2a', 'N2b'],
  M: ['M0', 'M1a', 'M1b', 'M1c'],
  invalid: (t, n) => t === 'Tis' && n !== 'N0',
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['I', 'T1..T2', 'N0', 'M0'], ['IIA', 'T3', 'N0', 'M0'], ['IIB', 'T4a', 'N0', 'M0'], ['IIC', 'T4b', 'N0', 'M0'],
    ['IIIA', 'T1..T2', 'N1a..N1c', 'M0'], ['IIIA', 'T1', 'N2a', 'M0'],
    ['IIIB', 'T3..T4a', 'N1a..N1c', 'M0'], ['IIIB', 'T2..T3', 'N2a', 'M0'], ['IIIB', 'T1..T2', 'N2b', 'M0'],
    ['IIIC', 'T4a', 'N2a', 'M0'], ['IIIC', 'T3..T4a', 'N2b', 'M0'], ['IIIC', 'T4b', 'N1a..N2b', 'M0'],
    ['IVA', '*', '*', 'M1a'], ['IVB', '*', '*', 'M1b'], ['IVC', '*', '*', 'M1c']
  ]
});

// Breast, AJCC 8th anatomic stage groups. Answer categories are fine (cN/pN); stage uses the anatomic N.
const BREAST_T = ['T0', 'Tis', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T3', 'T4a', 'T4b', 'T4c', 'T4d'];
const BREAST_CN = ['cN0', 'cN1', 'cN2a', 'cN2b', 'cN3a', 'cN3b', 'cN3c'];
const BREAST_PN = ['pN0', 'pN1mi', 'pN1a', 'pN1b', 'pN1c', 'pN2a', 'pN2b', 'pN3a', 'pN3b', 'pN3c'];
const BREAST_NMAP = { cN0: 'N0', cN1: 'N1', cN2a: 'N2', cN2b: 'N2', cN3a: 'N3', cN3b: 'N3', cN3c: 'N3',
  pN0: 'N0', pN1mi: 'N1mi', pN1a: 'N1', pN1b: 'N1', pN1c: 'N1', pN2a: 'N2', pN2b: 'N2', pN3a: 'N3', pN3b: 'N3', pN3c: 'N3' };
def({
  id: 'breast', site: 'breast', label: 'Breast · anatomic', short: 'Breast', edition: 'AJCC 8th anatomic',
  T: BREAST_T, N: ['N0', 'N1mi', 'N1', 'N2', 'N3'], M: ['M0', 'M1'],
  invalid: (t, n) => (t === 'T0' && n === 'N0') || (t === 'Tis' && n !== 'N0'),
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['IA', 'T1mi..T1c', 'N0', 'M0'], ['IB', 'T0,T1mi..T1c', 'N1mi', 'M0'],
    ['IIA', 'T0,T1mi..T1c', 'N1', 'M0'], ['IIA', 'T2', 'N0', 'M0'],
    ['IIB', 'T2', 'N1mi..N1', 'M0'], ['IIB', 'T3', 'N0', 'M0'],
    ['IIIA', 'T0,T1mi..T2', 'N2', 'M0'], ['IIIA', 'T3', 'N1mi..N2', 'M0'],
    ['IIIB', 'T4a..T4d', 'N0..N2', 'M0'], ['IIIC', 'T0,T1mi..T4d', 'N3', 'M0'], ['IV', '*', '*', 'M1']
  ],
  fineN: { c: BREAST_CN, p: BREAST_PN }, nmap: BREAST_NMAP
});

// Oral cavity, AJCC 8th (2018 update: T3/T4a by size and DOI)
def({
  id: 'oral', site: 'oral', label: 'Oral cavity', short: 'Oral', edition: 'AJCC 8th',
  T: ['Tis', 'T1', 'T2', 'T3', 'T4a', 'T4b'],
  N: ['N0', 'N1', 'N2a', 'N2b', 'N2c', 'N3a', 'N3b'],
  M: ['M0', 'M1'],
  invalid: (t, n) => t === 'Tis' && n !== 'N0',
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['I', 'T1', 'N0', 'M0'], ['II', 'T2', 'N0', 'M0'], ['III', 'T3', 'N0', 'M0'], ['III', 'T1..T3', 'N1', 'M0'],
    ['IVA', 'T4a', 'N0..N1', 'M0'], ['IVA', 'T1..T4a', 'N2a..N2c', 'M0'],
    ['IVB', 'T4b', '*', 'M0'], ['IVB', 'Tis..T4a', 'N3a..N3b', 'M0'], ['IVC', '*', '*', 'M1']
  ]
});

// Oesophagus and OGJ, AJCC 8th: five tables
const ESO_T = ['Tis', 'T1a', 'T1b', 'T2', 'T3', 'T4a', 'T4b'];
const ESO_N = ['N0', 'N1', 'N2', 'N3'];
const ESO_INV = (t, n) => t === 'Tis' && n !== 'N0';
def({
  id: 'eso-c-scc', site: 'eso', label: 'Oesophagus · cTNM · SCC', short: 'cSCC', edition: 'AJCC 8th', setting: 'c', hist: 'scc',
  T: ESO_T, N: ESO_N, M: ['M0', 'M1'], invalid: ESO_INV,
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['I', 'T1a..T1b', 'N0..N1', 'M0'], ['II', 'T2', 'N0..N1', 'M0'], ['II', 'T3', 'N0', 'M0'],
    ['III', 'T3', 'N1', 'M0'], ['III', 'T1a..T3', 'N2', 'M0'], ['IVA', 'T4a..T4b', 'N0..N2', 'M0'], ['IVA', 'Tis..T4b', 'N3', 'M0'],
    ['IVB', '*', '*', 'M1']
  ]
});
def({
  id: 'eso-c-ac', site: 'eso', label: 'Oesophagus · cTNM · adeno', short: 'cAC', edition: 'AJCC 8th', setting: 'c', hist: 'ac',
  T: ESO_T, N: ESO_N, M: ['M0', 'M1'], invalid: ESO_INV,
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['I', 'T1a..T1b', 'N0', 'M0'], ['IIA', 'T1a..T1b', 'N1', 'M0'], ['IIB', 'T2', 'N0', 'M0'],
    ['III', 'T2', 'N1', 'M0'], ['III', 'T3..T4a', 'N0..N1', 'M0'], ['IVA', 'T1a..T4a', 'N2', 'M0'], ['IVA', 'T4b', 'N0..N2', 'M0'],
    ['IVA', 'Tis..T4b', 'N3', 'M0'], ['IVB', '*', '*', 'M1']
  ]
});
def({
  id: 'eso-p-scc', site: 'eso', label: 'Oesophagus · pTNM · SCC', short: 'pSCC', edition: 'AJCC 8th', setting: 'p', hist: 'scc',
  T: ESO_T, N: ESO_N, M: ['M0', 'M1'], Q: { g: ['G1', 'G2', 'G3'], loc: ['Upper', 'Middle', 'Lower'] }, invalid: ESO_INV,
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['IA', 'T1a', 'N0', 'M0', { g: ['G1'] }], ['IB', 'T1a', 'N0', 'M0', { g: ['G2', 'G3'] }],
    ['IB', 'T1b', 'N0', 'M0'], ['IB', 'T2', 'N0', 'M0', { g: ['G1'] }], ['IIA', 'T2', 'N0', 'M0', { g: ['G2', 'G3'] }],
    ['IIA', 'T3', 'N0', 'M0', { loc: ['Lower'] }], ['IIA', 'T3', 'N0', 'M0', { g: ['G1'], loc: ['Upper', 'Middle'] }],
    ['IIB', 'T3', 'N0', 'M0', { g: ['G2', 'G3'], loc: ['Upper', 'Middle'] }], ['IIB', 'T1a..T1b', 'N1', 'M0'],
    ['IIIA', 'T1a..T1b', 'N2', 'M0'], ['IIIA', 'T2', 'N1', 'M0'],
    ['IIIB', 'T2', 'N2', 'M0'], ['IIIB', 'T3', 'N1..N2', 'M0'], ['IIIB', 'T4a', 'N0..N1', 'M0'],
    ['IVA', 'T4a', 'N2', 'M0'], ['IVA', 'T4b', 'N0..N2', 'M0'], ['IVA', 'Tis..T4b', 'N3', 'M0'], ['IVB', '*', '*', 'M1']
  ]
});
def({
  id: 'eso-p-ac', site: 'eso', label: 'Oesophagus · pTNM · adeno', short: 'pAC', edition: 'AJCC 8th', setting: 'p', hist: 'ac',
  T: ESO_T, N: ESO_N, M: ['M0', 'M1'], Q: { g: ['G1', 'G2', 'G3'] }, invalid: ESO_INV,
  rules: [
    ['0', 'Tis', 'N0', 'M0'], ['IA', 'T1a', 'N0', 'M0', { g: ['G1'] }], ['IB', 'T1a', 'N0', 'M0', { g: ['G2'] }],
    ['IB', 'T1b', 'N0', 'M0', { g: ['G1', 'G2'] }], ['IC', 'T1a..T1b', 'N0', 'M0', { g: ['G3'] }], ['IC', 'T2', 'N0', 'M0', { g: ['G1', 'G2'] }],
    ['IIA', 'T2', 'N0', 'M0', { g: ['G3'] }], ['IIB', 'T1a..T1b', 'N1', 'M0'], ['IIB', 'T3', 'N0', 'M0'],
    ['IIIA', 'T1a..T1b', 'N2', 'M0'], ['IIIA', 'T2', 'N1', 'M0'],
    ['IIIB', 'T2', 'N2', 'M0'], ['IIIB', 'T3', 'N1..N2', 'M0'], ['IIIB', 'T4a', 'N0..N1', 'M0'],
    ['IVA', 'T4a', 'N2', 'M0'], ['IVA', 'T4b', 'N0..N2', 'M0'], ['IVA', 'Tis..T4b', 'N3', 'M0'], ['IVB', '*', '*', 'M1']
  ]
});
def({
  id: 'eso-yp', site: 'eso', label: 'Oesophagus · ypTNM', short: 'ypTNM', edition: 'AJCC 8th', setting: 'yp', hist: 'any',
  T: ['T0', 'Tis', 'T1a', 'T1b', 'T2', 'T3', 'T4a', 'T4b'], N: ESO_N, M: ['M0', 'M1'],
  // Rice 2017 Figure 5: ypT0/Tis N2 is IIIB (the primer's text lists only ypT1-3 N2)
  rules: [
    ['I', 'T0..T2', 'N0', 'M0'], ['II', 'T3', 'N0', 'M0'], ['IIIA', 'T0..T2', 'N1', 'M0'],
    ['IIIB', 'T3', 'N1', 'M0'], ['IIIB', 'T0..T3', 'N2', 'M0'], ['IIIB', 'T4a', 'N0', 'M0'],
    ['IVA', 'T4a', 'N1..N2', 'M0'], ['IVA', 'T4b', 'N0..N2', 'M0'], ['IVA', 'T0..T4b', 'N3', 'M0'], ['IVB', '*', '*', 'M1']
  ]
});

// ---------- descriptor cards (format ②) ----------
const DESC = {
  lung: {
    T: [['Tis', 'Adenocarcinoma in situ: ≤3 cm, pure lepidic, no invasion'], ['T1mi', 'Minimally invasive adenocarcinoma: ≤3 cm, lepidic predominant, invasive focus ≤5 mm'],
      ['T1a', 'Invasive size ≤1 cm'], ['T1a', 'Superficial spreading tumour of any size, invasion limited to the bronchial wall'], ['T1b', 'Invasive size >1 to ≤2 cm'], ['T1c', 'Invasive size >2 to ≤3 cm'],
      ['T2a', 'Size >3 to ≤4 cm'], ['T2a', '≤4 cm with visceral pleural invasion'], ['T2a', '≤4 cm involving the main bronchus, carina spared'], ['T2a', '≤4 cm with atelectasis or obstructive pneumonitis to the hilum'], ['T2a', '≤4 cm invading an adjacent lobe across the fissure'],
      ['T2b', 'Size >4 to ≤5 cm'], ['T3', 'Size >5 to ≤7 cm'], ['T3', 'Invades parietal pleura or chest wall'], ['T3', 'Invades phrenic nerve or parietal pericardium'], ['T3', 'Invades azygos vein'], ['T3', 'Separate tumour nodule in the same lobe'],
      ['T4', 'Size >7 cm'], ['T4', 'Invades diaphragm'], ['T4', 'Invades mediastinum, heart or great vessels'], ['T4', 'Invades trachea, carina or oesophagus'], ['T4', 'Invades recurrent laryngeal nerve'], ['T4', 'Invades vertebral body'], ['T4', 'Separate nodule in a different ipsilateral lobe']],
    N: [['N1', 'Ipsilateral peribronchial, hilar or intrapulmonary nodes'], ['N2a', 'Single ipsilateral mediastinal or subcarinal station'], ['N2b', 'Multiple ipsilateral mediastinal stations'],
      ['N3', 'Contralateral mediastinal or hilar nodes'], ['N3', 'Scalene or supraclavicular nodes, either side']],
    M: [['M1a', 'Separate nodule in a contralateral lobe'], ['M1a', 'Malignant pleural or pericardial effusion, or pleural nodules'], ['M1b', 'Single extrathoracic metastasis in one organ'],
      ['M1b', 'Single distant (non-regional) node'], ['M1c1', 'Multiple extrathoracic metastases in one organ system'], ['M1c2', 'Extrathoracic metastases in more than one organ system']]
  },
  crc: {
    T: [['Tis', 'Intramucosal carcinoma: lamina propria, not through muscularis mucosae'], ['T1', 'Invades submucosa'], ['T2', 'Invades muscularis propria'], ['T3', 'Through muscularis propria into pericolorectal tissue'],
      ['T4a', 'Penetrates the visceral peritoneum'], ['T4a', 'Perforation through the tumour'], ['T4b', 'Directly invades or adheres to adjacent organs, tumour present in the adhesion']],
    N: [['N1a', '1 regional node'], ['N1b', '2–3 regional nodes'], ['N1c', 'Tumour deposits, no positive nodes'], ['N2a', '4–6 regional nodes'], ['N2b', '≥7 regional nodes']],
    M: [['M1a', 'Metastasis to one organ or site, no peritoneum'], ['M1b', 'Metastases to two or more organs or sites, no peritoneum'], ['M1c', 'Peritoneal metastasis, alone or with other sites']]
  },
  breast: {
    T: [['Tis', 'DCIS, no invasion'], ['Tis', 'Paget disease of the nipple without underlying invasive carcinoma or DCIS'], ['T1mi', 'Invasive focus ≤1 mm'], ['T1a', 'Invasive size >1 to ≤5 mm'], ['T1b', 'Invasive size >5 to ≤10 mm'], ['T1c', 'Invasive size >10 to ≤20 mm'],
      ['T2', 'Invasive size >20 to ≤50 mm'], ['T3', 'Invasive size >50 mm'], ['T4a', 'Extension to chest wall: ribs, intercostal muscles, serratus anterior'], ['T4b', 'Skin ulceration, satellite skin nodules, or skin oedema short of inflammatory criteria'],
      ['T4c', 'Both chest wall extension and skin involvement'], ['T4d', 'Inflammatory carcinoma: erythema and oedema of ≥1/3 of the breast skin']],
    N: [['cN1', 'Movable ipsilateral level I/II axillary nodes'], ['cN2a', 'Fixed or matted ipsilateral level I/II axillary nodes'], ['cN2b', 'Ipsilateral internal mammary nodes without axillary nodes'], ['cN3a', 'Ipsilateral infraclavicular (level III) nodes'],
      ['cN3b', 'Ipsilateral internal mammary and axillary nodes'], ['cN3c', 'Ipsilateral supraclavicular nodes'], ['pN0', 'Isolated tumour cells only, ≤0.2 mm'], ['pN1mi', 'Micrometastases >0.2 to ≤2.0 mm'], ['pN1a', '1–3 axillary nodes, at least one >2.0 mm'],
      ['pN2a', '4–9 axillary nodes'], ['pN3a', '≥10 axillary nodes, or level III nodes']],
    M: [['M1', 'Distant metastasis, or non-regional node >0.2 mm']]
  },
  oral: {
    T: [['T1', '≤2 cm and DOI ≤5 mm'], ['T2', '≤2 cm and DOI >5 mm'], ['T2', '>2 to ≤4 cm and DOI ≤10 mm'], ['T3', '>2 to ≤4 cm and DOI >10 mm'], ['T3', '>4 cm and DOI ≤10 mm'],
      ['T4a', '>4 cm and DOI >10 mm'], ['T4a', 'Through cortical bone of mandible or maxilla'], ['T4a', 'Invades maxillary sinus or skin of face'], ['T4b', 'Invades masticator space, pterygoid plates or skull base'], ['T4b', 'Encases the internal carotid artery']],
    N: [['N1', 'Single ipsilateral node ≤3 cm, ENE−'], ['N2a', 'Single ipsilateral node >3 to ≤6 cm, ENE−'], ['N2b', 'Multiple ipsilateral nodes ≤6 cm, ENE−'], ['N2c', 'Bilateral or contralateral nodes ≤6 cm, ENE−'], ['N3a', 'Node >6 cm, ENE−'], ['N3b', 'Clinically overt ENE']],
    M: [['M1', 'Distant metastasis']]
  },
  eso: {
    T: [['Tis', 'High-grade dysplasia'], ['T1a', 'Invades lamina propria or muscularis mucosae'], ['T1b', 'Invades submucosa'], ['T2', 'Invades muscularis propria'], ['T3', 'Invades adventitia'],
      ['T4a', 'Invades pleura, pericardium, azygos vein, diaphragm or peritoneum'], ['T4b', 'Invades aorta, vertebral body or airway']],
    N: [['N1', '1–2 regional nodes'], ['N2', '3–6 regional nodes'], ['N3', '≥7 regional nodes']],
    M: [['M1', 'Distant metastasis']]
  }
};


// ---------- all sites from the Staging module ----------
const HANDDESC = { lung: 'lung', colorectal: 'crc', breast: 'breast', 'oral-cavity': 'oral', esophageal: 'eso' };
const SITES = [];
const ITEMS = []; // category and stage-list items: {id, site, axis, cat, text, opts}
function uniq(a) { return a.filter((x, i) => a.indexOf(x) === i); }
(G.DRILL_SITES || []).forEach(d => {
  const site = { id: d.id, label: d.label, section: d.section, data: d, systems: [] };
  if (d.hand) site.systems = d.hand;
  // auto: the site's own grouping; more: further groupings of the same T/N/M (gastric cTNM,
  // medullary and anaplastic thyroid, p16+ pTNM, melanoma and Merkel clinical groups), each its own system
  [d.auto].concat(d.more || []).forEach((a, i) => {
    if (!a) return;
    const id = i ? a.id : d.id, inv = new Set((a.invalid || []).map(x => x.join('|')));
    def({ id, site: d.id, label: a.label || d.label, short: a.label || d.label, edition: a.edition, T: a.T, N: a.N, M: a.M, Q: a.Q || undefined, w: a.w || 1,
      invalid: (t, n, m) => inv.has(t + '|' + n + '|' + m), rules: a.rules.map(r => r.length > 4 && r[4] ? r : r.slice(0, 4)), generic: true, note: i ? null : d.drill_note || null });
    site.systems.push(id);
  });
  SITES.push(site);
  // category items
  const r = d.raw;
  if (HANDDESC[d.id]) {
    const hd = DESC[HANDDESC[d.id]], sys = SYS[site.systems[0]];
    ['T', 'N', 'M'].forEach(ax => hd[ax].forEach((x, i) => {
      let opts = ax === 'T' ? sys.T : ax === 'N' ? (sys.fineN ? (x[0][0] === 'p' ? sys.fineN.p : sys.fineN.c) : sys.N) : sys.M;
      ITEMS.push({ id: d.id + '|' + ax + '|' + i, site: d.id, axis: ax, cat: x[0], text: x[1], opts });
    }));
  } else {
    const ax3 = [['T', r.drill_t ? r.drill_t.map(x => ({ cat: x[0], desc: x[1] })) : r.t], ['N', r.n], ['pN', r.pn], ['M', r.m]];
    ax3.forEach(([ax, list]) => {
      if (!list) return;
      const opts = list.map(x => x.cat);
      list.forEach((x, i) => { if (/^(No |None)/i.test(x.desc) && /0$/.test(x.cat)) return; ITEMS.push({ id: d.id + '|' + ax + '|' + i, site: d.id, axis: ax === 'pN' ? 'N' : ax, cat: x.cat, text: x.desc, opts }); });
    });
  }
  const lists = [];
  if (r.figo) lists.push(['FIGO', r.figo]);
  if (r.stages_other && d.id !== 'thyroid' && d.id !== 'testis') lists.push([r.stages_other_title || 'Stage', r.stages_other]);
  lists.forEach(([title, list], li) => {
    const opts = uniq(list.map(x => x.stage));
    list.forEach((x, i) => ITEMS.push({ id: d.id + '|S' + li + '|' + i, site: d.id, axis: 'S', title, cat: x.stage, text: x.desc, opts }));
  });
});
// generic findings from definitions
function fmtNum(v, u) { return u === 'mm' ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1); }
function instantiate(desc) {
  if (!desc) return '';
  desc = desc.split(/\.\s+(?=[A-Za-z])/)[0].replace(/\s*\([^)]*\b[pc]?[TNM](?:is|\d)[a-z0-9]*\b[^)]*\)/g, '');
  const alts = desc.split(/;\s*or\s+|,\s*or\s+/i).filter(x => x.trim());
  let s = alts.length > 1 ? pick(alts) : desc;
  s = s.replace(/(?:>\s?)(\d+(?:\.\d+)?)\s?(?:–|-|to ≤|to )\s?(\d+(?:\.\d+)?)\s?(cm|mm)/g, (m0, a, b, u) => { a = +a; b = +b; const v = u === 'mm' ? ri(Math.floor(a) + 1, Math.floor(b)) : inRange(a, b); return fmtNum(v, u) + ' ' + u; });
  s = s.replace(/≤\s?(\d+(?:\.\d+)?)\s?(cm|mm)/g, (m0, b, u) => { b = +b; const v = u === 'mm' ? ri(Math.max(1, Math.ceil(b * 0.3)), Math.floor(b)) : inRange(b * 0.3, b); return fmtNum(v, u) + ' ' + u; });
  s = s.replace(/(^|[\s(])>\s?(\d+(?:\.\d+)?)\s?(cm|mm)/g, (m0, pre, a, u) => { a = +a; const v = u === 'mm' ? ri(Math.floor(a) + 1, Math.floor(a * 1.6) + 1) : inRange(a, a * 1.6); return pre + fmtNum(v, u) + ' ' + u; });
  s = s.replace(/(\d+)\s?[–-]\s?(\d+)(\s+(?:regional\s+)?(?:lymph\s+)?(?:nodes?|lymph))/gi, (m0, a, b, rest) => ri(+a, +b) + rest);
  s = s.replace(/≥\s?(\d+)(\s+(?:regional\s+)?(?:lymph\s+)?(?:nodes?|lymph))/gi, (m0, a, rest) => ri(+a, +a + 6) + rest);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function qField(k, v, siteId) {
  if (k === 'age') return ['Age', String(v === '<55' ? ri(22, 54) : ri(55, 84))];
  if (k === 'psa') return ['PSA', (v === '<10' ? inRange(2, 9.9) : v === '10–<20' ? inRange(10, 19.9) : inRange(20, 80, 1)) + ' ng/mL'];
  if (k === 'gg') return ['Biopsy', 'Gleason ' + ({ GG1: '3+3', GG2: '3+4', GG3: '4+3', GG4: pick(['4+4', '3+5', '5+3']), GG5: pick(['4+5', '5+4', '5+5']) })[v]];
  if (k === 's') {
    const S = {
      S0: 'LDH, hCG and AFP normal',
      S1: pick(['LDH 1.3 × ULN, hCG 800 mIU/mL, AFP 120 ng/mL', 'AFP 650 ng/mL, hCG and LDH normal', 'hCG 2,400 mIU/mL, AFP and LDH normal']),
      S2: pick(['AFP 4,200 ng/mL, hCG 900 mIU/mL, LDH normal', 'hCG 22,000 mIU/mL, AFP normal, LDH 1.2 × ULN', 'LDH 4 × ULN, hCG and AFP normal']),
      S3: pick(['AFP 15,000 ng/mL', 'hCG 85,000 mIU/mL', 'LDH 12 × ULN'])
    }[v];
    return ['Markers after orchiectomy', S];
  }
  if (k === 'g' && /sarcoma/.test(siteId || '')) return ['Grade', 'FNCLCC grade ' + v.slice(1)];
  if (k === 'g') return ['Grade', { G1: pick(['Grade 1', 'Well differentiated (G1)']), G2: pick(['Grade 2', 'Moderately differentiated (G2)']), G3: pick(['Grade 3', 'Poorly differentiated (G3)']) }[v]];
  if (k === 'hist') return ['Histotype', v === 'Mucinous' ? 'Mucinous adenocarcinoma' : 'Non-mucinous adenocarcinoma'];
  return [k, v];
}
function genGeneric(target) {
  const sys = SYS[target.sys], site = SITES.find(x => x.id === sys.site), r = site.data.raw;
  const tlist = r.drill_t ? r.drill_t.map(x => ({ cat: x[0], desc: x[1] })) : r.t;
  const find = (list, cat) => (list || []).find(x => x.cat === cat);
  const td = find(tlist, target.t), nd = find(r.n, target.n), md = find(r.m, target.m);
  const f = [['Site', site.label]];
  if (target.q) Object.keys(target.q).forEach(k => f.push(qField(k, target.q[k], site.id)));
  const tt = td ? instantiate(td.desc) : target.t, nt = nd ? instantiate(nd.desc) : target.n, mt = md ? instantiate(md.desc) : target.m;
  f.push(['Primary', tt], ['Nodes', nt], ['Distant', mt]);
  return { sys: sys.id, fields: f, t: target.t, n: target.n, m: target.m, q: target.q, why: { T: (td ? td.desc : '') + ' → ' + target.t, N: (nd ? nd.desc : defOf(site.id, 'N', target.n)) + ' → ' + target.n, M: (md ? md.desc : '') + ' → ' + target.m, X: sys.note } };
}

// ---------- case generators ----------
// Each returns {sys, setting, fields: [[label, value]], t, n, m, q, nFine?, why: {T, N, M}}
function sexAge() { return pick(['M', 'F']) + ' · ' + ri(42, 81); }
function cm(v) { return v.toFixed(1) + ' cm'; }

// Lung; LUNG_H: null (mixed), 'nsclc' or 'sclc'
let LUNG_H = null;
function setLungHist(h) { LUNG_H = h || null; }
function genLung(target) {
  const sys = SYS.lung;
  const side = pick(['Right', 'Left']), s = side[0];
  const lobes = s === 'R' ? ['right upper lobe', 'right middle lobe', 'right lower lobe'] : ['left upper lobe', 'left lower lobe'];
  const lobe = pick(lobes);
  const t = target.t, n = target.n, m = target.m;
  const f = [['Patient', sexAge()]];
  if (t !== 'Tis' && t !== 'T1mi') { const r = LUNG_H === 'sclc' ? 0.95 : LUNG_H === 'nsclc' ? rnd() * 0.9 : rnd(); f.push(['Histology', r < 0.5 ? 'Adenocarcinoma' : r < 0.78 ? 'Squamous cell carcinoma' : r < 0.86 ? 'Non-small cell carcinoma, NOS' : r < 0.9 ? 'Large cell carcinoma' : 'Small cell carcinoma']); }
  let tumour, why;
  const hist = (f.find(x => x[0] === 'Histology') || [])[1] || '';
  // [short reason, full sentence]
  const T2F = [['Visceral pleural invasion', 'Resection shows visceral pleural invasion'], ['Main bronchus involved, carina spared', 'The tumour involves the main bronchus 1.5 cm from the carina'],
    ['Obstructive pneumonitis to the hilum', 'There is obstructive pneumonitis extending to the hilum'], ['Invades the adjacent lobe across the fissure', 'The tumour invades the adjacent lobe across the fissure']];
  const T3F = [['Parietal pleura', 'The tumour invades the parietal pleura'], ['Chest wall', 'The tumour invades the chest wall at the 5th rib'], ['Phrenic nerve', 'The tumour invades the phrenic nerve'],
    ['Parietal pericardium', 'The tumour invades the parietal pericardium'], ['Azygos vein', 'The tumour invades the azygos vein'], ['Separate nodule in the same lobe', 'There is a separate tumour nodule in the same lobe']];
  const T4F = [['Diaphragm', 'The tumour invades the diaphragm'], ['Mediastinal fat and superior vena cava', 'The tumour invades the mediastinal fat and the superior vena cava'], ['Carina', 'The tumour invades the carina'],
    ['Oesophageal wall', 'The tumour invades the oesophageal wall'], ['Recurrent laryngeal nerve', 'The tumour encases the left recurrent laryngeal nerve, with vocal cord palsy'], ['Vertebral body', 'The tumour invades a vertebral body'],
    ['Separate nodule in another ipsilateral lobe', 'There is a separate nodule of the same histology in a different ipsilateral lobe']];
  // T1a starts at 0.5 cm: a smaller lesion is not called a mass and is rarely staged by size alone
  const sizeBins = { T1a: [0.4, 1], T1b: [1, 2], T1c: [2, 3], T2a: [3, 4], T2b: [4, 5], T3: [5, 7], T4: [7, 10] };
  const lesion = sz => cm(sz) + (sz > 3 ? ' mass' : ' nodule');
  if (t === 'Tis') { const sz = inRange(0.5, 3); tumour = lesion(sz) + ' in the ' + lobe + '; resection: adenocarcinoma in situ, pure lepidic, with no invasion'; why = 'Adenocarcinoma in situ ≤3 cm → Tis'; }
  else if (t === 'T1mi') { const sz = inRange(0.8, 3); const inv = ri(1, 5); tumour = cm(sz) + ' part-solid nodule in the ' + lobe + '; resection: lepidic-predominant adenocarcinoma with an invasive focus of ' + inv + ' mm'; why = 'Lepidic ≤3 cm, invasion ≤5 mm → T1mi'; }
  else {
    const byFeature = (t === 'T2a' && chance(0.5)) || (t === 'T3' && chance(0.55)) || (t === 'T4' && chance(0.6));
    let sz, feat = null;
    if (byFeature) {
      const lowerCap = t === 'T2a' ? 4 : t === 'T3' ? 5 : 7;
      sz = inRange(1, lowerCap);
      if (t === 'T2a') { sz = inRange(1, 4); feat = pick(T2F); }
      else if (t === 'T3') feat = pick(T3F);
      else feat = pick(T4F);
    } else {
      const b = sizeBins[t]; sz = inRange(b[0], b[1]);
    }
    // distractor: lower-class feature that does not raise T
    let extra = null;
    if (!feat && (t === 'T2b' || t === 'T3' || t === 'T4') && chance(0.35)) extra = pick(T2F);
    if (feat && t === 'T4' && chance(0.3)) extra = pick(T3F);
    // part-solid wording only for adenocarcinoma
    const solid = (t === 'T1a' || t === 'T1b' || t === 'T1c') && hist === 'Adenocarcinoma' && chance(0.3);
    tumour = (solid ? 'part-solid ' + cm(sz + inRange(0.3, 1.5)) + ' nodule with a solid (invasive) component of ' + cm(sz) : lesion(sz)) + ' in the ' + lobe;
    if (feat) tumour += '; ' + feat[1];
    if (extra) tumour += '; ' + extra[1];
    if (feat) why = feat[0] + ' → ' + t + (t === 'T2a' ? ' (size ≤4 cm)' : '');
    else why = 'Size ' + cm(sz) + ' → ' + t + ' (' + rangeText(sizeBins[t][0] < 1 ? [0, 1] : sizeBins[t], 'cm') + ')' + (extra ? '; T2 feature does not raise it' : '');
  }
  f.push(['Primary', tumour]);
  // Nodes: EBUS reaches stations 2, 4, 7, 10 and 11; 5 and 6 need mediastinoscopy or VATS; 8 and 9 need EUS
  const ipsiN1 = [s === 'R' ? '10R' : '10L', s === 'R' ? '11R' : '11L', '12' + s];
  const ipsiN2 = s === 'R' ? ['2R', '4R', '7', '8R', '9R'] : ['2L', '4L', '5', '6', '7', '8L', '9L'];
  const ebusN2 = ipsiN2.filter(x => /^(2|4|7)/.test(x));
  const contra = s === 'R' ? ['2L', '4L', '10L'] : ['2R', '4R', '10R'];
  const how = st => /^(5|6)$/.test(st) ? 'VATS biopsy of station ' + st : /^(8|9)/.test(st) ? 'EUS-FNA of station ' + st : 'EBUS-TBNA of station ' + st;
  const list = a => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  let nodes, nwhy;
  if (n === 'N0') { nodes = 'EBUS-TBNA of stations ' + list(sampleK(ebusN2, 2).concat([pick(ipsiN1.slice(0, 2))])) + ' is negative'; nwhy = 'No nodal metastasis → N0'; }
  else if (n === 'N1') { const st = sampleK(ipsiN1.slice(0, 2), ri(1, 2)); nodes = 'EBUS-TBNA is positive at station' + (st.length > 1 ? 's ' : ' ') + list(st) + ', and the mediastinal stations are negative'; nwhy = 'Ipsilateral hilar/intrapulmonary only → N1'; }
  else if (n === 'N2a') { const st = pick(ipsiN2); const n1 = chance(0.4) ? ' Station ' + pick(ipsiN1.slice(0, 2)) + ' is also positive.' : ''; nodes = how(st) + ' is positive, and the other mediastinal stations are negative.' + n1; nwhy = 'Single ipsilateral mediastinal/subcarinal station (' + st + ') → N2a'; }
  else if (n === 'N2b') { const st = sampleK(ebusN2, Math.min(ebusN2.length, ri(2, 3))); nodes = 'EBUS-TBNA is positive at stations ' + list(st); nwhy = 'Multiple ipsilateral mediastinal stations → N2b'; }
  else {
    const o = chance(0.5) ? 'EBUS-TBNA is positive at contralateral station ' + pick(contra) : 'Ultrasound-guided FNA of a ' + pick(['ipsilateral', 'contralateral']) + ' supraclavicular node is positive';
    nodes = o + (chance(0.5) ? ', and station ' + pick(ebusN2) + ' is also positive' : ''); nwhy = 'Contralateral mediastinal/hilar or any supraclavicular → N3';
  }
  f.push(['Nodes', nodes]);
  let mets, mwhy;
  if (m === 'M0') { mets = pick(['PET-CT and brain MRI show no distant disease', 'There is no pleural effusion, and PET-CT and brain MRI show no distant disease']); mwhy = 'No distant metastasis → M0'; }
  else if (m === 'M1a') { mets = pick(['Pleural fluid cytology shows malignant cells', 'Thoracoscopy shows pleural nodules, and biopsy is positive', 'There is a separate nodule of the same histology in the contralateral lung', 'Pericardial fluid cytology shows malignant cells']); mwhy = 'Intrathoracic spread (contralateral lung, pleura, pericardium) → M1a'; }
  else if (m === 'M1b') { mets = pick(['Brain MRI shows a single 1.4 cm metastasis', 'PET-CT shows a solitary left adrenal metastasis', 'PET-CT shows a single liver metastasis', 'PET-CT shows a single lytic lesion in the T10 vertebra']); mwhy = 'Single extrathoracic metastasis → M1b'; }
  else if (m === 'M1c1') { mets = pick(['Brain MRI shows four metastases', 'PET-CT shows multiple liver metastases', 'PET-CT shows bone metastases in the spine, pelvis and ribs', 'PET-CT shows bilateral adrenal metastases']); mwhy = 'Multiple metastases in one organ system → M1c1'; }
  else { mets = pick(['PET-CT shows liver and bone metastases', 'Brain MRI shows a metastasis, and PET-CT shows an adrenal metastasis', 'PET-CT shows bone metastases and a liver metastasis']); mwhy = 'Metastases in more than one organ system → M1c2'; }
  f.push(['Distant', mets]);
  return { sys: 'lung', fields: f, t, n, m, q: null, why: { T: why, N: nwhy, M: mwhy } };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function rangeText(b, u) { return b[0] === 0 ? '≤' + b[1] + ' ' + u : '>' + b[0] + ' to ≤' + b[1] + ' ' + u; }

// Colorectal
function genCrc(target) {
  const { t, n, m } = target;
  const sex = pick(['M', 'F']);
  const colon = ['caecum', 'ascending colon', 'hepatic flexure', 'transverse colon', 'descending colon', 'sigmoid colon'];
  const siteName = t === 'T4a' ? pick(colon) : pick(colon.concat(['rectum, 8 cm from the anal verge', 'upper rectum']));
  const rectal = /rectum/.test(siteName);
  const f = [['Patient', sex + ' · ' + ri(42, 81)], ['Specimen', 'Resection · ' + siteName]];
  let tt, why;
  if (t === 'Tis') { tt = 'The adenocarcinoma invades the lamina propria, and the muscularis mucosae is intact'; why = 'Intramucosal → Tis'; }
  else if (t === 'T1') { tt = 'The tumour invades the submucosa, and the muscularis propria is free'; why = 'Submucosa → T1'; }
  else if (t === 'T2') { tt = 'The tumour invades into, but not through, the muscularis propria'; why = 'Muscularis propria → T2'; }
  else if (t === 'T3') {
    const tissue = rectal ? 'the mesorectal fat' : pick(['the pericolic fat', 'the subserosa']);
    tt = 'The tumour extends ' + ri(1, 12) + ' mm beyond the muscularis propria into ' + tissue + (!rectal && chance(0.25) ? '; The serosal surface is free of tumour' : ''); why = 'Through muscularis propria, peritoneum intact → T3';
  }
  else if (t === 'T4a') { tt = pick(['Tumour cells are present on the serosal surface with a mesothelial reaction', 'There is perforation through the tumour', 'The tumour reaches the visceral peritoneal surface']); why = 'Visceral peritoneum penetrated (incl. perforation through tumour) → T4a'; }
  else {
    const o = ['The tumour invades the urinary bladder wall, confirmed on histology', 'The tumour is adherent to a loop of small bowel, with tumour present in the adhesion', 'The tumour invades the abdominal wall muscle'];
    if (sex === 'F') o.push(rectal ? 'The tumour invades the posterior vaginal wall' : 'The tumour invades the left ovary');
    if (sex === 'M' && rectal) o.push('The tumour invades the prostate');
    tt = pick(o); why = 'Invades or adheres to an adjacent organ (tumour in adhesion) → T4b';
  }
  f.push(['Depth', tt]);
  const total = ri(12, 34);
  let pos, dep = 0, nwhy;
  if (n === 'N0') { pos = 0; nwhy = 'No nodes or deposits → N0'; }
  else if (n === 'N1a') pos = 1;
  else if (n === 'N1b') pos = ri(2, 3);
  else if (n === 'N1c') { pos = 0; dep = ri(1, 4); nwhy = 'Deposits with no positive nodes → N1c'; }
  else if (n === 'N2a') pos = ri(4, 6);
  else pos = ri(7, Math.min(total, 15));
  if (n !== 'N1c' && n !== 'N0' && chance(0.3)) dep = ri(1, 3);
  if (!nwhy) nwhy = pos + ' positive node' + (pos > 1 ? 's' : '') + ' → ' + n + (dep ? '; deposits do not change N when nodes are positive' : '');
  f.push(['Nodes', pos + '/' + total + ' positive' + (dep ? ' · tumour deposits: ' + dep : ' · tumour deposits: none')]);
  let mets, mwhy;
  if (m === 'M0') { mets = 'CT of the chest, abdomen and pelvis shows no distant disease'; mwhy = 'M0'; }
  else if (m === 'M1a') { mets = pick(['CT shows three liver metastases', 'CT shows a single liver metastasis', 'CT shows two lung metastases, one in each lung']); mwhy = 'One organ, no peritoneum → M1a'; }
  else if (m === 'M1b') { mets = pick(['CT shows liver and lung metastases', 'CT shows liver metastases and a bone metastasis']); mwhy = 'Two or more organs, no peritoneum → M1b'; }
  else { mets = pick(['CT shows peritoneal deposits on the omentum', 'CT shows peritoneal nodules and liver metastases'].concat(sex === 'F' ? ['CT shows a Krukenberg-type ovarian deposit and peritoneal disease'] : [])); mwhy = 'Peritoneal metastasis → M1c'; }
  f.push(['Distant', mets]);
  return { sys: 'crc', fields: f, t, n, m, q: null, rectal, why: { T: why, N: nwhy, M: mwhy } };
}

// Breast
function genBreast(target) {
  const sys = SYS.breast;
  const { t, m } = target;
  const anat = target.n; // anatomic N
  // setting: T0, T4, inflammatory are clinical; otherwise mostly pathological
  let setting = (t === 'T0' || /^T4/.test(t)) ? 'c' : (chance(0.7) ? 'p' : 'c');
  if (anat === 'N1mi') setting = 'p';
  if (t === 'T1mi' || t === 'Tis') setting = 'p';
  const f = [['Patient', 'F · ' + ri(34, 79)], ['Setting', setting === 'p' ? 'Surgical specimen' : 'Clinical and imaging']];
  const sizes = { T1a: [1, 5], T1b: [5, 10], T1c: [10, 20], T2: [20, 50], T3: [50, 90] };
  let tt, why;
  if (t === 'T0') { tt = 'Mammography, ultrasound and MRI show no primary tumour in the breast'; why = 'No primary identified → T0'; }
  else if (t === 'Tis') { tt = 'DCIS of ' + ri(8, 60) + ' mm, grade ' + ri(1, 3) + ', with no invasion'; why = 'DCIS without invasion → Tis'; }
  else if (t === 'T1mi') { tt = 'DCIS of ' + ri(15, 50) + ' mm with an invasive focus of 0.' + ri(3, 9) + ' mm'; why = 'Invasion ≤1 mm → T1mi'; }
  else if (sizes[t]) {
    const b = sizes[t]; const sz = inRange(b[0], b[1], 1);
    if (chance(0.25) && sz > 6) { const other = ri(2, Math.max(3, sz - 2)); tt = 'Two invasive foci, ' + sz + ' mm and ' + other + ' mm'; why = 'Largest focus ' + sz + ' mm, not the sum → ' + t + ' (' + rangeText(b, 'mm') + ')'; }
    else { tt = 'Invasive carcinoma ' + sz + ' mm' + (setting === 'p' && chance(0.25) ? ' with surrounding DCIS to ' + (sz + ri(10, 30)) + ' mm' : ''); why = 'Invasive size ' + sz + ' mm → ' + t + ' (' + rangeText(b, 'mm') + ')' + (/DCIS to/.test(tt) ? '; DCIS extent not counted' : ''); }
    if (sz >= 15 && chance(0.15)) { tt += '; The tumour invades the pectoralis major, and the ribs and intercostal muscles are free'; why += '; pectoralis invasion alone is not T4a'; }
  }
  else if (t === 'T4a') { tt = ri(25, 70) + ' mm mass fixed to the ' + pick(['ribs', 'intercostal muscles', 'serratus anterior']) + ', with intact skin'; why = 'Chest wall extension → T4a'; }
  else if (t === 'T4b') { tt = ri(25, 70) + ' mm mass with ' + pick(['skin ulceration', 'ipsilateral satellite skin nodules', 'localised peau d’orange over the mass and no erythema']); why = 'Skin involvement short of inflammatory → T4b'; }
  else if (t === 'T4c') { tt = ri(35, 80) + ' mm mass fixed to the ribs with skin ulceration'; why = 'Chest wall plus skin → T4c'; }
  else { tt = 'Diffuse erythema and oedema over ' + pick(['half', 'two-thirds', 'most']) + ' of the breast, which developed over ' + ri(3, 8) + ' weeks'; why = 'Erythema and oedema ≥1/3 of breast skin, rapid onset → T4d'; }
  f.push(['Primary', tt]);
  // Fine N consistent with anatomic N
  const cOpts = { N0: ['cN0'], N1: ['cN1'], N2: ['cN2a', 'cN2b'], N3: ['cN3a', 'cN3b', 'cN3c'] };
  const pOpts = { N0: ['pN0'], N1mi: ['pN1mi'], N1: ['pN1a', 'pN1b', 'pN1c'], N2: ['pN2a', 'pN2b'], N3: ['pN3a', 'pN3b', 'pN3c'] };
  const fineN = setting === 'p' ? pick(pOpts[anat]) : pick(cOpts[anat]);
  const k = ri(1, 4), sn = k === 1 ? 'The single sentinel node is negative' : 'All ' + k + ' sentinel nodes are negative';
  const ax = (a, b) => { const p = ri(a[0], a[1]), tot = ri(b[0], b[1]); return p + ' of ' + tot + ' axillary nodes ' + (p === 1 ? 'is' : 'are') + ' positive'; };
  const NTXT = {
    cN0: ['No axillary nodes are palpable, and axillary ultrasound is normal', 'Axillary ultrasound is normal'],
    cN1: ['A mobile level I axillary node is palpable, and core biopsy is positive', 'Ultrasound shows two mobile level II nodes, and FNA is positive'],
    cN2a: ['Level I and II axillary nodes are matted together, and biopsy is positive'],
    cN2b: ['MRI shows an internal mammary node, and biopsy is positive. Axillary ultrasound is normal'],
    cN3a: ['An infraclavicular (level III) node is biopsy positive'],
    cN3b: ['An internal mammary node and level I axillary nodes are biopsy positive'],
    cN3c: ['An ipsilateral supraclavicular node is biopsy positive'],
    pN0: [sn, 'The sentinel node contains isolated tumour cells measuring 0.1' + ri(0, 9) + ' mm'],
    pN1mi: ['1 of ' + ri(2, 4) + ' sentinel nodes contains a ' + (0.3 + ri(0, 16) / 10).toFixed(1) + ' mm metastasis'],
    pN1a: [ax([1, 3], [8, 16]) + ', and the largest deposit is ' + ri(3, 12) + ' mm'],
    pN1b: ['An internal mammary sentinel node contains a 4 mm metastasis, and all 3 axillary sentinel nodes are negative'],
    pN1c: ['2 of 14 axillary nodes are positive, with deposits up to 6 mm, and an internal mammary sentinel node is also positive'],
    pN2a: [ax([4, 9], [14, 22]) + ', and the largest deposit is ' + ri(4, 15) + ' mm'],
    pN2b: ['A clinically detected internal mammary node is biopsy positive, and all 12 axillary nodes are negative'],
    pN3a: [ax([10, 18], [19, 26]), 'An infraclavicular (level III) node is positive, and 2 of 14 level I and II nodes are positive'],
    pN3b: ['5 of 16 axillary nodes are positive, and a clinically detected internal mammary node is also positive'],
    pN3c: ['An ipsilateral supraclavicular node is positive, and 3 of 15 axillary nodes are positive']
  };
  const ntxt = pick(NTXT[fineN]);
  f.push(['Nodes', ntxt]);
  const nwhy = (/isolated tumour cells/.test(ntxt) ? 'Isolated tumour cells ≤0.2 mm are pN0(i+) → ' : '') + fineN + ' → anatomic ' + anat;
  let mets, mwhy;
  if (m === 'M0') { mets = pick(['Staging CT and bone scan are negative', 'PET-CT shows no distant disease']); mwhy = 'M0'; }
  else { mets = pick(['CT shows liver metastases, and biopsy confirms them', 'PET-CT shows multiple bone metastases', 'CT shows lung nodules, and biopsy confirms metastasis', 'A contralateral axillary node is biopsy positive']); mwhy = 'Distant metastasis' + (/contralateral axillary/.test(mets) ? ' (contralateral axilla is non-regional)' : '') + ' → M1'; }
  f.push(['Distant', mets]);
  return { sys: 'breast', fields: f, t, n: anat, nFine: fineN, setting, m, q: null, why: { T: why, N: nwhy, M: mwhy } };
}

// Oral cavity (2018 update T rules)
function oralT(sizeCm, doi) {
  if (sizeCm > 4 && doi > 10) return 'T4a';
  if ((sizeCm > 2 && sizeCm <= 4 && doi > 10) || (sizeCm > 4 && doi <= 10)) return 'T3';
  if ((sizeCm <= 2 && doi > 5) || (sizeCm > 2 && sizeCm <= 4 && doi <= 10)) return 'T2';
  return 'T1';
}
function genOral(target) {
  const { t, n, m } = target;
  const sub = pick(['lateral oral tongue', 'floor of mouth', 'buccal mucosa', 'lower gingiva', 'retromolar trigone', 'hard palate']);
  const side = pick(['Left', 'Right']);
  const f = [['Patient', sexAge()], ['Primary site', side + ' ' + sub]];
  let tt, why;
  if (t === 'Tis') { tt = 'Biopsy: carcinoma in situ with no invasion'; why = 'In situ → Tis'; }
  else if (t === 'T4b') { tt = cm(inRange(2, 6)) + ' tumour ' + pick(['invading the masticator space', 'invading the pterygoid plates', 'extending to the skull base', 'encasing the internal carotid artery']); why = 'Masticator space, pterygoid plates, skull base or ICA encasement → T4b'; }
  else if (t === 'T4a' && chance(0.5)) {
    const feat = sub === 'buccal mucosa' ? 'invades the skin of the cheek' : sub === 'hard palate' ? 'invades the maxillary sinus' : 'erodes through the mandibular cortex into medullary bone';
    tt = cm(inRange(1, 4)) + ' tumour with an MRI depth of invasion of ' + ri(4, 10) + ' mm, which ' + feat; why = 'Through cortical bone, maxillary sinus or facial skin → T4a';
  } else {
    // size/DOI pair consistent with target
    let sz, doi, guard = 0;
    do {
      sz = inRange(0.4, 6); doi = ri(1, 18); guard++;
    } while (oralT(sz, doi) !== t && guard < 500);
    tt = cm(sz) + ' tumour, depth of invasion ' + doi + ' mm on MRI';
    let note = '';
    if ((sub === 'lower gingiva' || sub === 'retromolar trigone') && chance(0.3)) { tt += '; There is superficial erosion of the tooth socket only'; note = '; superficial bone erosion by a gingival primary is not T4'; }
    why = cm(sz) + ' with DOI ' + doi + ' mm → ' + t + note;
  }
  f.push(['Tumour', tt]);
  const contra = side === 'Left' ? 'right' : 'left', ipsi = side.toLowerCase();
  const lv = () => pick(['IB', 'IIA', 'III', 'IV']);
  let nodes, nwhy;
  const NW = ['two', 'three', 'four'];
  if (n === 'N0') { nodes = 'CT and ultrasound show no suspicious neck nodes'; nwhy = 'N0'; }
  else if (n === 'N1') { const s = inRange(1, 3); nodes = 'a single mobile ' + cm(s) + ' ' + ipsi + ' level ' + lv() + ' node with no clinical ENE'; nwhy = 'Single ipsilateral ≤3 cm, ENE− → N1'; }
  else if (n === 'N2a') { const s = inRange(3, 6); nodes = 'a single mobile ' + cm(s) + ' ' + ipsi + ' level ' + lv() + ' node with no clinical ENE'; nwhy = 'Single ipsilateral >3 to ≤6 cm, ENE− → N2a'; }
  else if (n === 'N2b') { nodes = pick(NW) + ' ' + ipsi + ' level II–III nodes, the largest ' + cm(inRange(1, 6)) + ', with no clinical ENE'; nwhy = 'Multiple ipsilateral ≤6 cm, ENE− → N2b'; }
  else if (n === 'N2c') { nodes = pick(['a ' + cm(inRange(1, 6)) + ' ' + contra + ' level II node', 'bilateral level II nodes, the largest ' + cm(inRange(1, 6)) + ',']) + ' with no clinical ENE'; nwhy = 'Contralateral or bilateral ≤6 cm, ENE− → N2c'; }
  else if (n === 'N3a') { nodes = 'a mobile ' + cm(inRange(6, 8.5)) + ' ' + ipsi + ' level II nodal mass, with the overlying skin free'; nwhy = 'Node >6 cm, ENE− → N3a'; }
  else { nodes = 'a ' + cm(inRange(1.5, 4)) + ' ' + ipsi + ' level II node ' + pick(['fixed to the overlying skin, with skin involvement', 'with marginal mandibular nerve palsy', 'fixed to the sternocleidomastoid and deep muscle']); nwhy = 'Clinically overt ENE → N3b, whatever the size'; }
  f.push(['Neck', nodes]);
  const mets = m === 'M0' ? 'CT of the chest shows no metastases' : pick(['CT of the chest shows multiple lung metastases', 'MRI shows a bone metastasis in the T8 vertebra']);
  f.push(['Distant', mets]);
  return { sys: 'oral', fields: f, t, n, m, q: null, why: { T: why, N: nwhy, M: m === 'M0' ? 'M0' : 'Distant metastasis → M1' } };
}

// Oesophagus
function genEso(target) {
  const sys = SYS[target.sys];
  const { t, n, m } = target;
  const hist = sys.hist === 'any' ? pick(['scc', 'ac']) : sys.hist;
  const setting = sys.setting;
  let loc;
  if (hist === 'scc') loc = target.q && target.q.loc ? target.q.loc : pick(['Upper', 'Middle', 'Lower']);
  const LOCTXT = {
    Upper: pick(['epicentre 22 cm from the incisors, above the lower border of the azygos vein', 'upper thoracic oesophagus, epicentre 23 cm from the incisors']),
    Middle: pick(['epicentre 28 cm from the incisors, between the azygos vein and the inferior pulmonary vein', 'mid-thoracic oesophagus, epicentre 29 cm from the incisors']),
    Lower: pick(['epicentre 36 cm from the incisors, below the inferior pulmonary vein', 'distal oesophagus, epicentre 37 cm from the incisors'])
  };
  const ACTXT = pick(['distal oesophagus on a background of Barrett mucosa', 'oesophagogastric junction, epicentre 1 cm below the junction', 'oesophagogastric junction, epicentre 1.5 cm into the cardia']);
  const f = [['Patient', sexAge()], ['Histology', hist === 'scc' ? 'Squamous cell carcinoma' : 'Adenocarcinoma'],
    ['Location', hist === 'scc' ? cap(LOCTXT[loc]) : cap(ACTXT)],
    ['Setting', setting === 'c' ? 'Clinical: EUS, CT, PET' : setting === 'p' ? 'Oesophagectomy, no neoadjuvant therapy' : 'Oesophagectomy after neoadjuvant chemoradiotherapy']];
  const g = target.q && target.q.g ? target.q.g : pick(['G1', 'G2', 'G3']);
  if (setting === 'p') f.push(['Grade', { G1: 'Well differentiated (G1)', G2: 'Moderately differentiated (G2)', G3: 'Poorly differentiated (G3)' }[g]]);
  const layer = {
    T0: 'No residual tumour in the oesophageal wall', Tis: 'High-grade dysplasia only, with no invasion',
    T1a: pick(['Invades the lamina propria', 'Invades the muscularis mucosae']), T1b: 'Invades the submucosa',
    T2: 'Invades the muscularis propria', T3: 'Invades the adventitia',
    T4a: pick(['Invades the pleura', 'Invades the pericardium', 'Invades the azygos vein', 'Invades the diaphragm']),
    T4b: pick(['Invades the aorta', 'Invades a vertebral body', 'Invades the left main bronchus'])
  }[t];
  f.push(['Depth', (setting === 'c' ? 'EUS/CT: ' : '') + layer]);
  const k = { N0: 0, N1: ri(1, 2), N2: ri(3, 6), N3: ri(7, 11) }[n];
  const nodes = setting === 'c' ? (k === 0 ? 'EUS and PET show no suspicious regional nodes' : k + ' suspicious regional node' + (k > 1 ? 's' : '') + ' on EUS and PET' + (chance(0.3) ? ', including a coeliac node' : '')) : k + '/' + ri(Math.max(15, k + 5), 38) + ' regional nodes positive';
  f.push(['Nodes', nodes]);
  const mets = m === 'M0' ? 'PET-CT shows no distant disease' : pick(['PET-CT shows liver metastases', 'PET-CT shows lung metastases', 'PET-CT shows bone metastases']);
  f.push(['Distant', mets]);
  const q = sys.Q ? (sys.Q.loc ? { g, loc } : { g }) : null;
  const tw = { T0: 'No residual tumour → ypT0', Tis: 'High-grade dysplasia → Tis', T1a: 'Lamina propria/muscularis mucosae → T1a', T1b: 'Submucosa → T1b', T2: 'Muscularis propria → T2', T3: 'Adventitia → T3', T4a: 'Pleura, pericardium, azygos, diaphragm or peritoneum → T4a', T4b: 'Aorta, vertebral body or airway → T4b' }[t];
  const nw = k + ' regional node' + (k === 1 ? '' : 's') + ' → ' + n + (/coeliac/.test(nodes) ? '; coeliac nodes are regional' : '');
  const extra = hist === 'ac' && /cardia|below the junction/.test(f[2][1]) ? 'Epicentre ≤2 cm into the stomach is staged as oesophagus' : null;
  return { sys: sys.id, fields: f, t, n, m, q, why: { T: tw, N: nw, M: m === 'M0' ? 'M0' : 'Distant metastasis → M1', X: extra } };
}


// ---------- vignette paragraphs ----------
const VBK = (G.DrillVB || {});
const VB = VBK.VB || {}, VS = VBK.VS || {};
const AGE = { testis: [18, 45], gtn: [20, 42], cervix: [28, 72], 'bone-sarcoma': [14, 40], nasopharyngeal: [30, 70] };
function cap(s) { s = String(s).trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
function lc(s) { return /^[A-Z][a-z]/.test(s) && !/^(EUS|CT|PET|MRI|DCIS|EBUS|IDH|Ki|TURP)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
// article before a noun phrase that starts with a size or a singular modifier; none before plurals or counts
function art(s) {
  if (/^\d/.test(s)) return /^\d+(\.\d+)? ?(cm|mm)\b/.test(s) ? (/^(8|11 |11\.|18 |18\.)/.test(s) ? 'an ' : 'a ') + s : s;
  return /^(single|small|part|large|left|right|mobile|fixed)\b/i.test(s) ? 'a ' + s : s;
}
function sent(s) {
  s = cap(s).replace(/\b1 of (\d+) ([a-z -]+?) are\b/g, '1 of $1 $2 is').replace(/\b1 of (\d+) ([a-z -]+?) contain\b/g, '1 of $1 $2 contains')
    .replace(/(^|\.\s)1 ([a-z][a-z -]*?)nodes are\b/g, (m, p, w) => p + 'One ' + w + 'node is')
    .replace(/(^|\.\s)1 ([a-z][a-z -]*?)nodes\b/g, (m, p, w) => p + 'One ' + w + 'node').replace(/\bOne ([a-z][a-z -]*?)nodes are\b/g, 'One $1node is').replace(/\bA (8\d|11|18)\b/g, 'An $1');
  return /[.!?]$/.test(s) ? s : s + '.';
}
function alts(str, sex) {
  const all = String(str).split(' | ');
  const ok = all.filter(a => !(a[0] === '♂' && sex === 'F') && !(a[0] === '♀' && sex === 'M'));
  return ok.length ? ok : all;
}
function fillText(s, ctx) {
  s = s.replace(/^[♂♀]\s*/, '');
  s = s.replace(/\[\[([^\]]+)\]\]/g, (m, x) => pick(x.split(';')));
  s = s.replace(/\{#(\d+)~(\d+)\}/g, (m, a, b) => String(ri(+a, +b)));
  s = s.replace(/\{(\d+(?:\.\d+)?)~(\d+(?:\.\d+)?)\}/g, (m, a, b) => { const lo = +a, hi = +b; return (lo + 0.1 * ri(0, Math.round((hi - lo) * 10))).toFixed(1); });
  return s.replace(/\{side\}/g, ctx.side).replace(/\{contra\}/g, ctx.side === 'left' ? 'right' : 'left');
}
function person(age, sex) { return (/^(8|11|18)$/.test(String(age)) || /^8\d$/.test(String(age)) ? 'An ' : 'A ') + age + '-year-old ' + (age < 18 ? (sex === 'M' ? 'boy' : 'girl') : (sex === 'M' ? 'man' : 'woman')); }
function qSentence(k, v, siteId) {
  if (k === 'age') return null;
  if (k === 'psa') return 'PSA is ' + (v === '<10' ? inRange(2, 9.9) : v === '10–<20' ? inRange(10, 19.9) : inRange(20, 80, 1)) + ' ng/mL';
  if (k === 'gg') return 'Biopsy shows Gleason ' + ({ GG1: '3+3', GG2: '3+4', GG3: '4+3', GG4: pick(['4+4', '3+5', '5+3']), GG5: pick(['4+5', '5+4', '5+5']) })[v];
  if (k === 's') return 'Post-orchiectomy markers: ' + qField('s', v, siteId)[1];
  if (k === 'g' && siteId === 'soft-tissue-sarcoma') return 'The tumour is FNCLCC grade ' + v.slice(1);
  if (k === 'g' && siteId === 'bone-sarcoma') return 'The tumour is ' + ({ G1: 'well differentiated and low grade', G2: 'moderately differentiated and high grade', G3: 'poorly differentiated and high grade' })[v];
  if (k === 'g') return 'The tumour is ' + ({ G1: 'well', G2: 'moderately', G3: 'poorly' })[v] + ' differentiated';
  if (k === 'hist') return 'Histology shows ' + (v === 'Mucinous' ? 'a mucinous' : 'a non-mucinous') + ' adenocarcinoma';
  return null;
}
// sex implied by the organs named in the findings
function sexOf(texts) {
  for (const x of texts) { if (!x) continue; if (x[0] === '♂') return 'M'; if (x[0] === '♀') return 'F'; }
  const all = texts.filter(Boolean).join(' ');
  if (/prostat|penil|penis|seminal|scrot|testi(s|cular)/i.test(all)) return 'M';
  if (/ovar|vagin(?!alis)|uter(us|ine)|vulv|fallopian/i.test(all)) return 'F';
  return null;
}
function genVignette(target) {
  const sys = SYS[target.sys], site = SITES.find(x => x.id === sys.site), b = VB[site.id];
  const base = genGeneric(target);
  if (!b) return base;
  const ctx = { side: pick(['left', 'right']) };
  // an override replaces the intro, nodes or distant text for some cells (unresectable or metastatic disease, in situ)
  const ov = (b.over || []).find(o => o.when(target)) || {};
  const nb = Object.assign({}, b.N || {}, ov.N || {}), mb = Object.assign({}, b.M || {}, ov.M || {}), tb = Object.assign({}, b.T || {}, ov.T || {});
  const tS = tb[target.t] || null;
  const nS = nb[target.n] || (target.n === 'N0' ? VBK.N0 : null), mS = mb[target.m] || (target.m === 'M0' ? VBK.M0 : /^M1/.test(target.m) ? VBK.M1 : null);
  // choose findings first, then fix sex from them, then the intro
  let tAlt = tS ? pick(alts(tS, b.sex || null)) : null;
  let nAlt = nS ? pick(alts(nS, b.sex || null)) : null, mAlt = mS ? pick(alts(mS, b.sex || null)) : null;
  let sex = b.sex || sexOf([tAlt, nAlt, mAlt]);
  if (!sex) sex = pick(['M', 'F']);
  if (tS && sexOf([tAlt]) && sexOf([tAlt]) !== sex) tAlt = pick(alts(tS, sex));
  let intros = alts(ov.intro || b.intro, sex);
  // the opening line must not promise a node that the findings deny, and no primary needs a node
  if (target.n === 'N0') intros = intros.filter(x => !/neck lump|enlarged node|node biopsy/i.test(x)).concat([]);
  if (target.t === 'T0') intros = intros.filter(x => /neck lump|node/i.test(x));
  if (!intros.length) intros = alts(ov.intro || b.intro, sex);
  const intro = fillText(pick(intros), ctx);
  const ar = ov.age || AGE[site.id] || [38, 82];
  let age = target.q && target.q.age ? (target.q.age === '<55' ? ri(22, 54) : ri(55, 84)) : ri(ar[0], ar[1]);
  if (/chondrosarcoma/i.test(intro)) age = ri(35, 75);
  const parts = [person(age, sex) + ' ' + intro];
  if (target.q) ['hist', 'g', 'psa', 'gg', 's'].forEach(k => { if (target.q[k] !== undefined) { const q = qSentence(k, target.q[k], site.id); if (q) parts.push(q); } });
  parts.push(tAlt ? fillText(tAlt, ctx) : base.fields.find(f => f[0] === 'Primary')[1]);
  parts.push(nAlt ? fillText(nAlt, ctx) : base.fields.find(f => f[0] === 'Nodes')[1]);
  parts.push(mAlt ? fillText(mAlt, ctx) : base.fields.find(f => f[0] === 'Distant')[1]);
  base.text = parts.map(sent).join(' ');
  return base;
}
// hand-generator fields to one paragraph
function verbLead(s) { return /^(invades|involves|encases|extends|reaches|penetrates|perforates)\b/i.test(s) ? 'The tumour ' + lc(s) : s; }
function nodeFrac(s) { return s.replace(/^(\d+)\/(\d+) /, (m, a, b) => a + ' of ' + b + ' '); }
function composeHand(sysId, c) {
  const F = Object.fromEntries(c.fields), out = [];
  const [sx, ag] = F.Patient.split(' · '); const who = person(+ag, sx);
  if (sysId === 'lung') {
    const pr = F.Primary.split(/;\s*/);
    out.push(who + ' has ' + art(lc(pr[0])));
    if (F.Histology) out.push('Biopsy shows ' + lc(F.Histology));
    pr.slice(1).forEach(x => out.push(/^resection: /.test(x) ? 'Resection shows ' + x.slice(11) : verbLead(x)));
    out.push(F.Nodes); out.push(F.Distant);
  } else if (sysId === 'crc') {
    out.push(who + ' undergoes resection of an adenocarcinoma of the ' + F.Specimen.replace(/^Resection · /, ''));
    F.Depth.split(/;\s*/).forEach(x => out.push(verbLead(x)));
    const m = F.Nodes.match(/^(\d+)\/(\d+) positive · tumour deposits: (.*)$/);
    if (m) {
      const dep = m[3] === 'none' ? 0 : +m[3], depS = dep === 1 ? 'there is 1 tumour deposit' : 'there are ' + dep + ' tumour deposits';
      if (m[1] === '0') out.push('All ' + m[2] + ' nodes are negative, ' + (dep ? 'but ' + depS : 'and there are no tumour deposits'));
      else out.push(m[1] + ' of ' + m[2] + ' nodes ' + (m[1] === '1' ? 'is' : 'are') + ' positive, ' + (dep ? 'and ' + depS : 'and there are no tumour deposits'));
    } else out.push(F.Nodes);
    out.push(F.Distant);
  } else if (sysId === 'breast') {
    const surg = /Surgical/.test(F.Setting), pr = F.Primary.split(/;\s*/);
    if (c.t === 'T0') {
      out.push(who + ' presents with a biopsy-proven regional node metastasis of breast origin');
      out.push(pr[0]);
    } else if (surg) {
      out.push(who + ' undergoes surgery for breast cancer');
      out.push('Pathology shows ' + pr[0].replace(/^Invasive carcinoma (\d+) mm/, 'an invasive carcinoma of $1 mm').replace(/^Two invasive foci, /, 'two invasive foci of ').replace(/ with surrounding DCIS to /, ' with surrounding DCIS extending to '));
    } else {
      out.push(who + ' presents with breast cancer');
      const p0 = pr[0];
      let mm;
      if ((mm = p0.match(/^Invasive carcinoma (\d+) mm/))) out.push('Ultrasound shows a ' + mm[1] + ' mm mass, and core biopsy shows invasive carcinoma');
      else if ((mm = p0.match(/^Two invasive foci, (\d+) mm and (\d+) mm/))) out.push('Ultrasound shows two masses of ' + mm[1] + ' mm and ' + mm[2] + ' mm, and core biopsy of both shows invasive carcinoma');
      else out.push('Examination shows ' + art(lc(p0)));
    }
    pr.slice(1).forEach(x => out.push(x));
    out.push(F.Nodes); out.push(F.Distant);
  } else if (sysId === 'oral') {
    out.push(who + ' has squamous cell carcinoma of the ' + lc(F['Primary site']));
    const tp = F.Tumour.split(/;\s*/), t = tp[0];
    out.push(/^Biopsy: /.test(t) ? 'Biopsy shows ' + t.slice(8) : 'Examination and imaging show ' + art(t.replace(/^(\S+ cm) tumour, depth of invasion (\d+) mm on MRI/, '$1 tumour with a depth of invasion of $2 mm on MRI')));
    tp.slice(1).forEach(x => out.push(x));
    out.push(/^CT /.test(F.Neck) ? F.Neck : 'Examination and neck imaging show ' + F.Neck);
    out.push(F.Distant);
  } else {
    out.push(who + ' has ' + lc(F.Histology) + ' of the oesophagus');
    const L = F.Location; out.push(/^Epicentre/.test(L) ? 'The epicentre is' + L.slice(9) : 'The tumour is in the ' + lc(L));
    const st = F.Setting, clin = /^Clinical/.test(st);
    out.push(clin ? 'Staging is by EUS, CT and PET' : /no neoadjuvant/.test(st) ? 'Oesophagectomy is done without neoadjuvant therapy' : 'Oesophagectomy is done after neoadjuvant chemoradiotherapy');
    if (F.Grade) out.push('The tumour is ' + lc(F.Grade));
    const d = F.Depth.replace(/^EUS\/CT: /, '');
    if (/dysplasia/.test(d)) out.push(clin ? 'Biopsy and EUS show high-grade dysplasia with no invasion' : 'Pathology shows high-grade dysplasia only, with no invasion');
    else if (/^No residual/.test(d)) out.push('There is no residual tumour in the oesophageal wall');
    else out.push(clin ? 'EUS and CT show the tumour ' + lc(d).replace(/^invades/, 'invading') : verbLead(d));
    out.push(/^0\/\d+/.test(F.Nodes) ? 'All ' + F.Nodes.match(/^0\/(\d+)/)[1] + ' regional nodes are negative' : /^\d+\/\d+/.test(F.Nodes) ? nodeFrac(F.Nodes).replace(/ positive$/, ' are positive') : /^EUS /.test(F.Nodes) ? F.Nodes : 'There ' + (/^1 /.test(F.Nodes) ? 'is ' : 'are ') + F.Nodes);
    out.push(F.Distant);
  }
  return out.map(sent).join(' ');
}
// whole-case vignettes for non-TNM systems
function vsSites() { return Object.keys(VS); }
function makeVsCase(siteId, fixAns) {
  const v = VS[siteId], keys = Object.keys(v.S), ans = fixAns && v.S[fixAns] ? fixAns : pick(keys), ctx = { side: pick(['left', 'right']) };
  const sex = v.sex || pick(['M', 'F']), ar = AGE[siteId] || [35, 80];
  const txt = [person(ri(ar[0], ar[1]), sex) + ' ' + fillText(pick(alts(v.intro, sex)), ctx), fillText(pick(alts(v.S[ans], sex)), ctx)].map(sent).join(' ');
  return { site: siteId, title: v.title, text: txt, cat: ans, opts: keys };
}
// ---------- GTN: modified WHO prognostic score (FIGO 2000) ----------
// Each case draws the eight factors and asks the risk group. 6 or less is low risk, 7 or more high risk,
// 13 or more ultra-high risk.
const GTN_GROUPS = ['Low risk', 'High risk', 'Ultra-high risk'];
const GTN_DEFS = { 'Low risk': 'WHO score 0–6', 'High risk': 'WHO score 7–12', 'Ultra-high risk': 'WHO score 13 or more' };
function gtnGroup(s) { return s >= 13 ? GTN_GROUPS[2] : s >= 7 ? GTN_GROUPS[1] : GTN_GROUPS[0]; }
function fmtInt(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function gtnDraw() {
  const age = chance(0.7) ? ri(19, 39) : ri(40, 52);
  const ante = pick([['mole', 0, 'evacuation of a complete molar pregnancy'], ['mole', 0, 'evacuation of a partial molar pregnancy'], ['abortion', 1, 'a miscarriage'], ['term', 2, 'a term delivery']]);
  const months = ante[1] === 0 ? pick([ri(1, 3), ri(1, 3), ri(4, 6), ri(7, 12)]) : pick([ri(2, 3), ri(4, 6), ri(7, 12), ri(13, 30)]);
  const hcg = pick([ri(2, 9) * 100 + ri(1, 9) * 10, ri(1, 9) * 1000 + ri(1, 9) * 100, ri(10, 99) * 1000 + ri(1, 9) * 100, ri(100, 600) * 1000 + ri(1, 9) * 100]);
  const size = pick([0, inRange(1, 2.9), inRange(3, 4.9), inRange(5, 8)]);
  const metSites = pick([[], ['lung'], ['lung'], ['lung'], ['spleen'], ['kidney'], ['lung', 'bowel'], ['liver'], ['lung', 'brain'], ['lung', 'liver']]);
  // many deposits are counted in the lungs; other organs carry one or a few
  const nMets = !metSites.length ? 0 : metSites.includes('lung') ? Math.max(metSites.length, pick([ri(1, 4), ri(1, 4), ri(5, 8), ri(9, 15)])) : metSites.length + ri(0, 2);
  const prior = ante[1] === 0 && months <= 6 ? pick([0, 0, 0, 1, 2]) : pick([0, 0, 0, 0, 1, 2]);
  const pts = {
    age: age >= 40 ? 1 : 0, ante: ante[1], months: months >= 13 ? 4 : months >= 7 ? 2 : months >= 4 ? 1 : 0,
    hcg: hcg >= 100000 ? 4 : hcg >= 10000 ? 2 : hcg >= 1000 ? 1 : 0, size: size >= 5 ? 2 : size >= 3 ? 1 : 0,
    site: Math.max(0, ...metSites.map(s => ({ lung: 0, spleen: 1, kidney: 1, bowel: 2, liver: 4, brain: 4 })[s])),
    n: nMets > 8 ? 4 : nMets >= 5 ? 2 : nMets >= 1 ? 1 : 0, prior: prior === 2 ? 4 : prior === 1 ? 2 : 0
  };
  const total = Object.values(pts).reduce((a, b) => a + b, 0);
  return { age, ante, months, hcg, size, metSites, nMets, prior, pts, total };
}
const MET_TEXT = { lung: 'the lungs', spleen: 'the spleen', kidney: 'a kidney', bowel: 'the small bowel', liver: 'the liver', brain: 'the brain' };
function makeGtnScore(want) {
  let d = gtnDraw();
  for (let g = 0; g < 2000 && want && gtnGroup(d.total) !== want; g++) d = gtnDraw();
  const parts = [person(d.age, 'F') + ' has a rising hCG ' + d.months + ' month' + (d.months > 1 ? 's' : '') + ' after ' + d.ante[2],
    'Pre-treatment serum hCG is ' + fmtInt(d.hcg) + ' IU/L',
    d.size ? 'Pelvic ultrasound shows a ' + d.size.toFixed(1) + ' cm uterine mass' : 'Pelvic ultrasound shows no uterine mass'];
  if (!d.metSites.length) parts.push('CT of the chest, abdomen and pelvis and brain MRI show no metastases');
  else {
    const where = d.metSites.map(s => MET_TEXT[s]).join(' and ');
    parts.push('Staging shows ' + (d.nMets === 1 ? 'one metastasis, in ' : d.nMets + ' metastases, in ') + where);
  }
  parts.push(d.prior === 2 ? 'Disease progressed on methotrexate and then on actinomycin D' : d.prior === 1 ? 'Disease progressed on single-agent methotrexate' : 'She has had no chemotherapy');
  const rows = [
    ['Age', d.age + ' years · ' + d.pts.age], ['Antecedent', d.ante[0] + ' · ' + d.pts.ante], ['Interval', d.months + ' months · ' + d.pts.months],
    ['hCG', fmtInt(d.hcg) + ' IU/L · ' + d.pts.hcg], ['Largest tumour', (d.size ? d.size.toFixed(1) + ' cm' : 'none') + ' · ' + d.pts.size],
    ['Metastatic site', (d.metSites.length ? d.metSites.join(', ') : 'none') + ' · ' + d.pts.site], ['Number of metastases', d.nMets + ' · ' + d.pts.n],
    ['Failed chemotherapy', (d.prior === 2 ? '2 or more drugs' : d.prior === 1 ? 'single drug' : 'none') + ' · ' + d.pts.prior], ['Total', String(d.total)]
  ];
  return { site: 'gtn', gen: 'score', dkey: 'gtn-score', title: 'WHO score', text: parts.map(sent).join(' '), cat: gtnGroup(d.total), opts: GTN_GROUPS, defs: GTN_DEFS, rows, score: d.total };
}
const VSGEN = { gtn: makeGtnScore };
// definition of a category, for wrong-answer contrast
function defOf(siteId, axis, cat) {
  siteId = ({ crc: 'colorectal', oral: 'oral-cavity', eso: 'esophageal' })[siteId] || siteId;
  const EXTRA = {
    'breast|T|T0': 'No evidence of primary tumour',
    'breast|N|pN1b': 'Ipsilateral internal mammary sentinel node(s) positive, axillary nodes negative',
    'breast|N|pN1c': '1–3 axillary nodes and internal mammary sentinel node(s) positive',
    'breast|N|pN2b': 'Clinically detected internal mammary nodes, axillary nodes negative',
    'breast|N|pN3b': 'Clinically detected internal mammary nodes with ≥1 axillary node; or >3 axillary nodes with internal mammary sentinel node(s) positive',
    'breast|N|pN3c': 'Ipsilateral supraclavicular node(s)',
    'esophageal|T|T0': 'No residual tumour at the primary site after neoadjuvant therapy',
    'nasopharyngeal|T|T0': 'No primary identified, EBV-positive cervical node(s)',
    'oral-cavity|T|Tis': 'Carcinoma in situ',
    'oropharynx-p16pos|T|T0': 'No primary identified, p16-positive node',
    'merkel|T|T0': 'No evidence of primary tumour',
    'melanoma|N|N1a': 'One clinically occult node, found by sentinel node biopsy',
    'melanoma|N|N1b': 'One clinically detected node',
    'melanoma|N|N1c': 'In-transit, satellite or microsatellite metastasis, with no nodes',
    'melanoma|N|N2a': '2–3 clinically occult nodes, found by sentinel node biopsy',
    'melanoma|N|N2b': '2–3 nodes, at least one clinically detected',
    'melanoma|N|N2c': 'One node, occult or detected, with in-transit, satellite or microsatellite metastasis',
    'melanoma|N|N3a': '4 or more clinically occult nodes',
    'melanoma|N|N3b': '4 or more nodes with at least one clinically detected, or matted nodes',
    'melanoma|N|N3c': '2 or more nodes, or matted nodes, with in-transit, satellite or microsatellite metastasis',
    'merkel|N|N1a(sn)': 'Clinically occult node metastasis, found by sentinel node biopsy',
    'merkel|N|N1a': 'Clinically occult node metastasis, found by node dissection',
    'merkel|N|N1b': 'Clinically or radiologically detected node metastasis, confirmed on pathology',
    'merkel|N|N2': 'In-transit metastasis without node metastasis',
    'merkel|N|N3': 'In-transit metastasis with node metastasis'
  };
  if (EXTRA[siteId + '|' + axis + '|' + cat]) return EXTRA[siteId + '|' + axis + '|' + cat];
  if (axis === 'S' && VS[siteId] && VS[siteId].D && VS[siteId].D[cat]) return VS[siteId].D[cat];
  const find = c => ITEMS.filter(i => i.site === siteId && i.cat === c && (axis === 'S' ? i.axis === 'S' : i.axis === axis)).map(i => i.text);
  let hits = find(cat);
  if (!hits.length && axis !== 'S') hits = find('c' + cat).concat(find('p' + cat));
  if (!hits.length && axis !== 'S') { const re = new RegExp('^[cp]?' + cat + '[a-z]$'); hits = ITEMS.filter(i => i.site === siteId && i.axis === axis && re.test(i.cat)).map(i => i.cat + ': ' + i.text); }
  if (hits.length) return uniq(hits).join('; or ');
  if (axis === 'T' && cat === 'T0') return 'No evidence of primary tumour';
  if (axis === 'T' && cat === 'Tis') return 'Carcinoma in situ';
  if (/^p?[NM]0/.test(cat) || /^c?N0/.test(cat)) return axis === 'N' ? 'No regional node metastasis' : 'No distant metastasis';
  return '';
}
const GEN = { generic: genGeneric, lung: genLung, crc: genCrc, breast: genBreast, oral: genOral, 'eso-c-scc': genEso, 'eso-c-ac': genEso, 'eso-p-scc': genEso, 'eso-p-ac': genEso, 'eso-yp': genEso };

// Pick a valid target cell for a system. M1 in 20% of cases. M0 cases are spread evenly over the
// main stage groups (I, II, III and an M0 stage IV), with stage 0 in about 5%, so that the common
// boundaries are asked as often as the advanced cells, whatever the number of T and N categories.
function randQ(sys) { return sys.Q ? Object.fromEntries(Object.keys(sys.Q).map(k => [k, pick(sys.Q[k])])) : null; }
function drawCell(sys, m, fixT, fixN, fixQ) {
  for (let g = 0; g < 400; g++) {
    const t = fixT || pick(sys.T), n = fixN || pick(sys.N), q = fixQ || randQ(sys);
    if (!(sys.invalid && sys.invalid(t, n, m, q))) return { sys: sys.id, t, n, m, q };
  }
  return null;
}
function mainGroup(stage) { const g = String(stage).match(/^(0|IV|III|II|I)/); return g ? g[1] : String(stage); }
const M0_GROUPS = {};
function m0Groups(sys) {
  if (M0_GROUPS[sys.id]) return M0_GROUPS[sys.id];
  const by = {}, m = sys.M[0];
  sys.T.forEach(t => sys.N.forEach(n => qCombos(sys).forEach(q => {
    if (sys.invalid && sys.invalid(t, n, m, q)) return;
    const st = stageOf(sys, t, n, m, q);
    if (st == null) return;
    const g = mainGroup(st);
    (by[g] = by[g] || []).push({ sys: sys.id, t, n, m, q });
  })));
  return (M0_GROUPS[sys.id] = by);
}
function randomTarget(sys) {
  const m1 = sys.M.slice(1).filter(m => sys.T.some(t => sys.N.some(n => !sys.invalid(t, n, m, null) || sys.Q)));
  if (m1.length && chance(0.2)) { const c = drawCell(sys, pick(m1)); if (c) return c; }
  const by = m0Groups(sys), rest = Object.keys(by).filter(g => g !== '0');
  const g = by['0'] && (!rest.length || chance(0.05)) ? '0' : pick(rest);
  if (!g) return drawCell(sys, sys.M[0]);
  const c = pick(by[g]);
  return { sys: c.sys, t: c.t, n: c.n, m: c.m, q: c.q ? Object.assign({}, c.q) : null };
}
function targetFromCard(sys, card) {
  if (card.t === '*') return drawCell(sys, card.m) || randomTarget(sys);
  const c = card.q ? null : drawCell(sys, card.m, card.t, card.n);
  const q = card.q || (c ? c.q : randQ(sys));
  return { sys: sys.id, t: card.t, n: card.n, m: card.m, q };
}
function makeCase(target) {
  const sys = SYS[target.sys];
  const c = GEN[sys.id] ? GEN[sys.id](target) : genVignette(target);
  if (!c.text) c.text = GEN[sys.id] ? composeHand(sys.id.startsWith('eso') ? 'eso' : sys.id, c) : c.fields.map(f => f[0] + ': ' + f[1]).join('. ');
  c.stage = stageOf(sys, c.t, c.n, c.m, c.q);
  const r = ruleOf(sys, c.t, c.n, c.m, c.q);
  c.ruleText = r ? ruleText(sys, r) : '';
  return c;
}
function specText(list, order) {
  if (list.length === order.length) return 'Any';
  // compress contiguous runs
  const idx = list.map(x => order.indexOf(x)).sort((a, b) => a - b);
  const runs = []; let s = idx[0], p = idx[0];
  for (let i = 1; i <= idx.length; i++) { if (idx[i] === p + 1) { p = idx[i]; continue; } runs.push(s === p ? order[s] : order[s] + '–' + order[p]); s = p = idx[i]; }
  return runs.join(', ');
}
function qLabel(sys, k, vals) {
  if (k === 'psa') { const j = vals.join('|'); return j === '<10|10–<20' ? 'PSA <20' : 'PSA ' + vals.join(', '); }
  if (k === 'age') return 'Age ' + vals.join(', ');
  if (k === 'loc') return vals.join('/') + ' thoracic';
  const order = sys.Q && sys.Q[k];
  if (order && vals.length > 1) return specText(vals, order);
  return vals.join('/');
}
function ruleText(sys, r) {
  const t = specText(r.t, sys.T), n = specText(r.n, sys.N), m = specText(r.m, sys.M);
  const q = r.q ? ' · ' + Object.keys(r.q).map(k => qLabel(sys, k, r.q[k])).join(' · ') : '';
  return (t === 'Any' ? 'Any T' : t) + ' ' + (n === 'Any' ? 'any N' : n) + ' ' + m + q + ' = ' + r.stage;
}

// ---------- FSRS-4.5 scheduler ----------
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RETAIN = 0.9, DAY = 86400000;
function clampD(d) { return Math.min(10, Math.max(1, d)); }
function initD(g) { return clampD(W[4] - (g - 3) * W[5]); }
function retrievability(elapsedDays, S) { return Math.pow(1 + FACTOR * elapsedDays / S, DECAY); }
function intervalDays(S) { return Math.max(1, Math.round(S / FACTOR * (Math.pow(RETAIN, 1 / DECAY) - 1))); }
// state: {s, d, due, reps, lapses, last}; g: 1 Again, 2 Hard, 3 Good, 4 Easy
function review(state, g, now) {
  now = now || Date.now();
  const st = state ? Object.assign({}, state) : null;
  if (!st || !st.reps) {
    const s = W[g - 1], d = initD(g);
    const due = g === 1 ? now + 60000 : now + intervalDays(s) * DAY;
    return { s, d, due, reps: 1, lapses: g === 1 ? 1 : 0, last: now };
  }
  const el = Math.max(0, (now - st.last) / DAY);
  const R = retrievability(el, st.s);
  const d = clampD(W[7] * initD(3) + (1 - W[7]) * (st.d - W[6] * (g - 3)));
  let s;
  if (g === 1) s = Math.min(st.s, W[11] * Math.pow(st.d, -W[12]) * (Math.pow(st.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
  else s = st.s * (Math.exp(W[8]) * (11 - st.d) * Math.pow(st.s, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
  const due = g === 1 ? now + 60000 : now + intervalDays(s) * DAY;
  return { s, d, due, reps: st.reps + 1, lapses: st.lapses + (g === 1 ? 1 : 0), last: now };
}
// grade from correctness and latency against target seconds
function gradeOf(correct, ms, targetS) {
  if (!correct) return 1;
  const s = ms / 1000;
  if (s <= targetS / 2) return 4;
  if (s <= targetS) return 3;
  return 2;
}

G.Drill = { setLungHist, VS, VSGEN, makeGtnScore, makeVsCase, vsSites, defOf, fillText, qLabel, SYS, SITES, ITEMS, DESC, GEN, instantiate, specText, stageOf, ruleOf, ruleText, checkTotality, cards, qCombos, makeCase, randomTarget, mainGroup, targetFromCard,
  review, gradeOf, intervalDays, retrievability, setRandom, oralT, BREAST_NMAP, pick, shuffle, chance };
})(typeof window !== 'undefined' ? window : globalThis);
