/* Release check for the board maps: node maps/check.cjs
   - every map trial points at an Evidence row, or carries a PMID (or, before PubMed lists it, a {url}) and is listed for intake;
     a PMID already filed in any sheet fails, naming the row to link
   - a live figure ("OS HR", "PFS median", "response") resolves from its Evidence row
   - every written key figure's numbers appear in that trial's Evidence row
   - every row of the sheet is on the map or under off: with a reason; the rest are listed in unplaced.txt and fail
   - a trial line's Evidence row is a clinical trial, a pooled analysis of trials or a meta-analysis
     (no cohort, retrospective, observational or genomic studies; the statement can stay as plain text)
   - map text uses plain wording: no arrows and none of the words in BANNED
   - a label on a connecting line starts with a capital
   - a source: line names an Evidence row (a guideline) that the map's 〔Name level, grade〕 tags rest on; it counts as placed.
     A guideline with no Evidence row is given as a link instead: source: ESMO {url https://...}
   Writes maps/<id>/intake.txt and maps/<id>/unplaced.txt. Exits 1 on any failure. */
'use strict';
const fs = require('fs'), path = require('path');
const O = (function(){ const m = {exports:{}}; new Function('module', fs.readFileSync(path.join(__dirname, 'outline.js'), 'utf8'))(m); return m.exports; })();
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'views/evidence.html'), 'utf8');
const i = src.indexOf('const TRIALS = ');
if (i < 0) { console.error('views/evidence.html: no TRIALS'); process.exit(1); }
const rows = (function(){ let d = 0, j = i + 15, q = false, e = false;
  for (; j < src.length; j++) { const c = src[j];
    if (q) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === '[' || c === '{') d++; else if (c === ']' || c === '}') { d--; if (!d) break; } }
  return JSON.parse(src.slice(i + 15, j + 1)); })();
const byAnchor = new Map(rows.map(r => [r.anchor, r]));
const TRIAL_TYPE = /randomi|meta-analys|pooled analysis|joint analysis|clinical trial/i;
const NOT_TRIAL = /cohort study|retrospective|observational|registry|case series|review|consensus|genomic/i;
const BANNED = [/→|->|=>|⇒/, /\bbackbone\b/i, /\bhook\b/i, /\bparadigm\b/i, /\bgame[- ]chang/i, /\blandscape\b/i];
const norm = s => String(s).replace(/·/g, '.').replace(/(\d),(\d{3})/g, '$1$2');
let bad = 0, live = 0;
for (const dir of fs.readdirSync(__dirname)) {
  const f = path.join(__dirname, dir, 'map.txt');
  if (!fs.existsSync(f)) continue;
  const m = O.parse(fs.readFileSync(f, 'utf8'));
  m.errors.forEach(e => { bad++; console.log(dir + '/map.txt ' + e); });
  const intake = []; live = 0;
  fs.readFileSync(f, 'utf8').split('\n').forEach((t, k) => {
    if (/^\s*#/.test(t)) return;
    const lab = /^\s+(?:next|join):.*\|\s*(.)/.exec(t);
    if (lab && /[a-z]/.test(lab[1])) { bad++; console.log(dir + '/map.txt:' + (k + 1) + ' line label starts in lower case: "' + t.trim() + '"'); }
    const hit = BANNED.find(b => b.test(t));
    if (hit) { bad++; console.log(dir + '/map.txt:' + (k + 1) + ' wording: "' + t.trim().slice(0, 70) + '" matches ' + hit); }
  });
  for (const {line, where} of O.trials(m)) {
    const tag = dir + '/map.txt:' + line.at + ' ' + line.name;
    if (line.pmid && !line.anchor) {
      const pm = new RegExp('(^|\\D)' + line.pmid + '(\\D|$)'), filed = rows.find(r => pm.test(JSON.stringify(r)));
      if (filed) { bad++; console.log(tag + ': PMID ' + line.pmid + ' is already filed as ' + filed.study + ' [' + filed.anchor + '] in ' + filed.sheet + '; give that anchor'); continue; }
      intake.push(line.name + '\tPMID ' + line.pmid + '\t' + where); continue; }
    if (line.url && !line.anchor) { intake.push(line.name + '\tno PMID yet ' + line.url + '\t' + where); continue; }
    const r = byAnchor.get(line.anchor);
    if (!r) { bad++; console.log(tag + ': no Evidence row ' + line.anchor + ' (give [t-...] or {pmid N})'); continue; }
    if (!TRIAL_TYPE.test(r.type) || (NOT_TRIAL.test(r.type) && !/clinical trial|randomi/i.test(r.type))) {
      bad++; console.log(tag + ': ' + r.anchor + ' is "' + r.type.slice(0, 60) + '"; maps cite trials and meta-analyses only (move it under off:)'); }
    if (O.live(line.fig)) {
      const f = O.figure(line.fig, r);
      if (!f.ok) { bad++; console.log(tag + ': live figure "' + line.fig + '" not found in ' + r.anchor); }
      else live++;
      continue;
    }
    const text = norm([r.findings, r.population, r.arms, r.endpoint, r.type].join('\n'));
    for (const n of (norm(line.fig).match(/\d+(?:\.\d+)?/g) || [])) {
      const re = new RegExp('(^|[^\\d.])' + n.replace('.', '\\.') + '(?![\\d])');
      if (!re.test(text)) { bad++; console.log(tag + ': "' + n + '" in "' + line.fig + '" is not in ' + r.anchor); }
    }
  }
  fs.writeFileSync(path.join(__dirname, dir, 'intake.txt'),
    '# Trials on the ' + (m.map || dir) + ' map with no Evidence row yet (name, PMID, where on the map)\n' + intake.join('\n') + '\n');
  const on = new Set(O.trials(m).map(t => t.line.anchor));
  const used = new Set(O.tags(m).map(t => t.source));
  Object.values(m.sources).forEach(sr => {
    if (sr.url && !sr.anchor) { if (!used.has(sr.name)) { bad++; console.log(dir + '/map.txt:' + sr.at + ' source ' + sr.name + ' has no 〔' + sr.name + ' …〕 tag on the map'); } return; }
    if (!byAnchor.has(sr.anchor)) { bad++; console.log(dir + '/map.txt:' + sr.at + ' source: no Evidence row ' + sr.anchor); }
    else if (!used.has(sr.name)) { bad++; console.log(dir + '/map.txt:' + sr.at + ' source ' + sr.name + ' has no 〔' + sr.name + ' …〕 tag on the map'); }
    on.add(sr.anchor);
  });
  m.off.forEach(o => { if (!byAnchor.has(o.anchor)) { bad++; console.log(dir + '/map.txt:' + o.at + ' off: no Evidence row ' + o.anchor); } else if (on.has(o.anchor)) { bad++; console.log(dir + '/map.txt:' + o.at + ' ' + o.name + ' is both on the map and under off:'); } on.add(o.anchor); });
  const off = rows.filter(r => r.sheet === m.map && !on.has(r.anchor))
    .sort((a, b) => String(b.pubdate || b.yearnum).localeCompare(String(a.pubdate || a.yearnum)));
  fs.writeFileSync(path.join(__dirname, dir, 'unplaced.txt'),
    '# ' + (m.map || dir) + ' Evidence rows neither on the map nor under off:, newest first (year, study, section, anchor)\n' +
    off.map(r => [r.yearnum, r.study, r.subcat, r.anchor].join('\t')).join('\n') + '\n');
  off.forEach(r => { bad++; console.log(dir + ': sheet row ' + r.study + ' [' + r.anchor + '] is neither on the map nor under off:'); });
  if (!rows.some(r => r.sheet === m.map)) { bad++; console.log(dir + ': no Evidence sheet named "' + m.map + '"'); }
  console.log(dir + ': ' + O.trials(m).length + ' trials (' + live + ' live figures), ' + intake.length + ' for intake, ' + off.length + ' new sheet rows to place');
}
if (bad) { console.log(bad + ' problem(s)'); process.exit(1); }
console.log('maps check passed');
