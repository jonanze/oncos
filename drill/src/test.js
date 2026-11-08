globalThis.window=globalThis; require('./sites.js'); require('./core.js'); const D = globalThis.Drill;
// Staging module data: node test.js <staging_data.json> (or STAGING_DATA=...)
const SRC = process.argv[2] || process.env.STAGING_DATA;
if (!SRC) { console.log('usage: node test.js <staging_data.json>'); process.exit(2); }
const DOC = require(require('path').resolve(SRC));
const C = Object.fromEntries((DOC.cancers || DOC).map(c => [c.id, c]));
let fail = 0; const bad = (m) => { fail++; console.log('FAIL', m); };
// 1. compare with Staging module tables (parse "A–B", "A / B", "Any")
function exp(spec, order, alias) {
  spec = spec.trim(); if (/^any/i.test(spec)) return order.slice();
  const out = [];
  spec.split(/\s*\/\s*|,\s*/).forEach(p => {
    p = alias ? alias(p) : p;
    const sub = x => order.filter(o => o === x || (o.startsWith(x) && /^[a-z0-9]+$/.test(o.slice(x.length)) && o.slice(x.length) !== 'mi' || (o===x+'mi' && x!=='N1')));
    if (p.includes('–')) { const [a, b] = p.split('–'); const A = sub(alias ? alias(a) : a), B = sub(alias ? alias(b) : b); out.push(...order.slice(order.indexOf(A[0]), order.indexOf(B[B.length - 1]) + 1)); }
    else out.push(...sub(p));
  });
  return out;
}
function compare(sysId, staging, filter, mapStage) {
  const S = D.SYS[sysId];
  const groups = staging.stage_groups.filter(filter || (() => true));
  let cells = 0;
  groups.forEach(g => {
    const ts = exp(g.t, S.T), ns = exp(g.n, S.N), ms = exp(g.m, S.M);
    if (!ts.length || !ns.length || !ms.length) bad(sysId + ' unparsed ' + JSON.stringify(g));
    const st = mapStage ? mapStage(g.stage) : g.stage;
    ts.forEach(t => ns.forEach(n => ms.forEach(m => D.qCombos(S).forEach(q => {
      if (S.invalid && S.invalid(t, n, m, q)) return;
      if (g.q && q) { // eso qualifiers
        const gq = g.q;
        if (q.g && !/any G|grade N\/A/.test(gq)) { const gs = (gq.match(/G\d(–G\d)?/) || [''])[0]; const lo = +gs[1], hi = gs.length > 2 ? +gs[4] : lo; const gv = +q.g[1]; if (!(gv >= lo && gv <= hi)) return; }
        if (q.loc && /upper\/middle/.test(gq) && q.loc === 'Lower') return;
        if (q.loc && /· lower/.test(gq) && q.loc !== 'Lower') return;
        if (/GX · any location/.test(gq)) return;
      }
      cells++;
      const mine = D.stageOf(S, t, n, m, q);
      if (mine !== st) bad(sysId + ' ' + t + ' ' + n + ' ' + m + ' ' + JSON.stringify(q) + ' staging=' + st + ' mine=' + mine);
    }))));
  });
  console.log('compare', sysId, 'cells checked', cells);
}
compare('lung', C.lung);
compare('crc', C.colorectal);
compare('oral', C['oral-cavity']);
compare('breast', C.breast);
compare('eso-p-scc', C.esophageal, g => g.stage.startsWith('SCC'), s => s.split(' · ')[1]);
compare('eso-p-ac', C.esophageal, g => g.stage.startsWith('AC'), s => s.split(' · ')[1]);
// oesophagus cTNM and ypTNM: both directions, so the hand grid and the Staging table are the same cells
function both(sysId, table) {
  if (!table) { bad(sysId + ' has no Staging table'); return; }
  compare(sysId, { stage_groups: table.rows });
  const S = D.SYS[sysId]; let miss = 0;
  S.T.forEach(t => S.N.forEach(n => S.M.forEach(m => {
    if (S.invalid && S.invalid(t, n, m, null)) return;
    const hit = table.rows.some(g => exp(g.t, S.T).includes(t) && exp(g.n, S.N).includes(n) && exp(g.m, S.M).includes(m));
    if (!hit) { miss++; bad(sysId + ' cell ' + t + ' ' + n + ' ' + m + ' missing from Staging'); }
  })));
  console.log('cover', sysId, miss ? miss + ' missing' : 'complete');
}
const MORE = Object.fromEntries((C.esophageal.stage_groups_more || []).map(g => [g.id, g]));
both('eso-c-scc', MORE['groups-c-scc']);
both('eso-c-ac', MORE['groups-c-ac']);
both('eso-yp', MORE['groups-yp']);
// 2. generators: 3000 cases per system
for (const id in D.SYS) {
  const S = D.SYS[id];
  for (let i = 0; i < 3000; i++) {
    const tg = D.randomTarget(S);
    const c = D.makeCase(tg);
    const txt = JSON.stringify(c);
    if (!c.stage) bad(id + ' no stage ' + txt);
    if (/undefined|NaN|null cm/.test(c.fields.map(f => f.join(':')).join('|'))) bad(id + ' bad text ' + txt);
    if (c.t !== tg.t || c.n !== tg.n || c.m !== tg.m) bad(id + ' target drift ' + txt);
    if (id === 'lung' && !/Tis|T1mi/.test(c.t) && !/→/.test(c.why.T)) bad('why');
    if (id === 'lung' && /^Size/.test(c.why.T)) {
      const sz = parseFloat(c.why.T.slice(5)); const bins = { T1a: [0, 1], T1b: [1, 2], T1c: [2, 3], T2a: [3, 4], T2b: [4, 5], T3: [5, 7], T4: [7, 10] }[c.t];
      if (!(sz > bins[0] && sz <= bins[1])) bad('lung size ' + sz + ' ' + c.t);
      if (/invades|separate|involves|obstructive/.test(c.fields[1][1]) && !/T2 feature/.test(c.why.T)) bad('lung feature leak ' + c.fields[1][1] + ' ' + c.t);
    }
    if (id === 'oral' && /depth of invasion (\d+)/.test(c.fields[2][1])) {
      const sz = parseFloat(c.fields[2][1]); const doi = +c.fields[2][1].match(/depth of invasion (\d+)/)[1];
      if (D.oralT(sz, doi) !== c.t) bad('oral T ' + c.fields[2][1] + ' ' + c.t);
    }
    if (id === 'crc') { const m = c.fields[3][1].match(/^(\d+)\/\d+ positive · tumour deposits: (\w+)/); const pos = +m[1]; const dep = m[2] !== 'none';
      const exp = pos === 0 ? (dep ? 'N1c' : 'N0') : pos === 1 ? 'N1a' : pos <= 3 ? 'N1b' : pos <= 6 ? 'N2a' : 'N2b'; if (exp !== c.n) bad('crc N ' + c.fields[3][1] + ' ' + c.n); }
    if (id === 'breast') { if (D.BREAST_NMAP[c.nFine] !== c.n) bad('breast nmap'); const mm = c.fields[2][1].match(/^Invasive carcinoma (\d+) mm|Two invasive foci, (\d+) mm/); if (mm) { const sz = +(mm[1] || mm[2]); const b = { T1a: [1, 5], T1b: [5, 10], T1c: [10, 20], T2: [20, 50], T3: [50, 90] }[c.t]; if (!(sz > b[0] && sz <= b[1])) bad('breast size ' + sz + c.t); } }
    if (id.startsWith('eso')) { const m = c.fields.find(f => f[0] === 'Nodes')[1].match(/^(\d+)/); const k = m ? +m[1] : 0; const exp = k === 0 ? 'N0' : k <= 2 ? 'N1' : k <= 6 ? 'N2' : 'N3'; if (exp !== c.n) bad('eso N ' + k + ' ' + c.n); }
  }
}
// 3. FSRS sanity
let st = null, now = Date.now(); const iv = [];
for (let i = 0; i < 6; i++) { st = D.review(st, 3, now); iv.push(Math.round((st.due - now) / 864e5)); now = st.due; }
console.log('Good intervals (days)', iv.join(' '));
st = D.review(st, 1, now); console.log('after lapse S', st.s.toFixed(2), 'due min', Math.round((st.due - now) / 6e4));
console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
D.setRandom(Math.random);
['lung','crc','breast','oral','eso-p-scc','eso-yp'].forEach(id => { const c = D.makeCase(D.randomTarget(D.SYS[id])); console.log('\n#', id, c.t, c.nFine || c.n, c.m, c.q ? JSON.stringify(c.q) : '', '→', c.stage, '|', c.ruleText); c.fields.forEach(f => console.log('  ', f[0], ':', f[1])); console.log('   why', JSON.stringify(c.why)); });
