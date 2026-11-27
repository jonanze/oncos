/* Release check for the board maps: node maps/check.cjs
   - every map trial points at an Evidence row, or carries a PMID (or, before PubMed lists it, a {url}) and is listed for intake;
     a {pmid N} trial links itself to the one row whose reference cites that PMID (filing and publishing link it, no map edit);
     a PMID cited by several rows, or found only in a row's text, fails, naming the rows
   - a trial line gives the trial's name only, with no figure; results are on the trial card (Jonan 2026-11-11)
   - outline errors, including more than eight branch: lines or a branch: on a box carrying the risk ramp (outline.js)
   - every row of the sheet is on the map or under off: with a reason; the rest are listed in unplaced.txt and fail
   - a trial line's Evidence row is a clinical trial, a pooled analysis of trials or a meta-analysis
     (no cohort, retrospective, observational or genomic studies; the statement can stay as plain text)
   - map text uses plain wording: no arrows and none of the words in BANNED
   - a label on a connecting line starts with a capital
   - a source: line names an Evidence row (a guideline) that the map's 〔Name level, grade〕 tags rest on; it counts as placed.
     A guideline with no Evidence row is given as a link instead: source: ESMO {url https://...}
   - every source: has a definition line in the header (〔Name …〕 with the year or version of the edition read)
   - the header carries "# Rows reviewed: <oncos commit> (<date>)", the Evidence state the map's rows were last
     reviewed against; node maps/watch.cjs lists the rows changed since (Jonan 2026-11-27)
   Writes maps/<id>/intake.txt and maps/<id>/unplaced.txt. Exits 1 on any failure.
   --json: writes nothing and prints {ok, problems: [{map, at, kind, text}], maps: {id: {trials, intake, unplaced}}},
   the form Evidence Publish compares before and after a publish (oncos_core.publish). */
'use strict';
const fs = require('fs'), path = require('path');
const O = (function(){ const m = {exports:{}}; new Function('module', fs.readFileSync(path.join(__dirname, 'outline.js'), 'utf8'))(m); return m.exports; })();
const root = path.join(__dirname, '..');
// The Evidence rows: data/evidence.json, the file the view, search and maps read.
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/evidence.json'), 'utf8')).trials;
const byAnchor = new Map(rows.map(r => [r.anchor, r]));
const TRIAL_TYPE = /randomi|meta-analys|pooled analysis|joint analysis|clinical trial/i;
const NOT_TRIAL = /cohort study|retrospective|observational|registry|case series|review|consensus|genomic/i;
const BANNED = [/→|->|=>|⇒/, /\bbackbone\b/i, /\bhook\b/i, /\bparadigm\b/i, /\bgame[- ]chang/i, /\blandscape\b/i];
const norm = s => String(s).replace(/·/g, '.').replace(/(\d),(\d{3})/g, '$1$2');
const JSON_OUT = process.argv.includes('--json');
const REVIEWED = /^#\s*Rows reviewed:\s*([0-9a-f]{40})\s*\((\d{4}-\d{2}-\d{2})\)\s*$/m;
let bad = 0;
const problems = [], summary = {};
// kind names what failed, so a publish can tell a broken link from a new row to place
function fail(map, at, kind, text) { bad++; problems.push({map, at: at || null, kind, text}); if (!JSON_OUT) console.log(text); }
function write(file, text) { if (!JSON_OUT) fs.writeFileSync(file, text); }
for (const dir of fs.readdirSync(__dirname).sort()) {
  const f = path.join(__dirname, dir, 'map.txt');
  if (!fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const m = O.parse(src);
  m.errors.forEach(e => fail(dir, parseInt(e, 10), 'outline', dir + '/map.txt ' + e));
  const intake = [], intakeItems = [];
  src.split('\n').forEach((t, k) => {
    if (/^\s*#/.test(t)) return;
    const lab = /^\s+(?:next|join):.*\|\s*(..)/.exec(t);
    if (lab && /^[a-z][a-z]/.test(lab[1])) fail(dir, k + 1, 'wording', dir + '/map.txt:' + (k + 1) + ' line label starts in lower case: "' + t.trim() + '"');
    if (/^\s*=\s/.test(t)) fail(dir, k + 1, 'wording', dir + '/map.txt:' + (k + 1) + ' option marked with =: number every option ①② in order of preference (Jonan 2026-11-11)');
    // a trial line is the trial's own name (PARADIGM), so only the arrow rule applies to it
    const hit = (/^\s*[+~-]\s/.test(t) ? BANNED.slice(0, 1) : BANNED).find(b => b.test(t));
    if (hit) fail(dir, k + 1, 'wording', dir + '/map.txt:' + (k + 1) + ' wording: "' + t.trim().slice(0, 70) + '" matches ' + hit);
  });
  // The header: one definition line per guideline, naming the edition read, and the rows' review point
  const head = src.split('\n').map(t => /^\s*#/.test(t) ? t.replace(/^\s*#\s?/, '').trim() : null);
  Object.values(m.sources).forEach(sr => {
    if (sr.ver && (/\b(19|20)\d{2}\b/.test(sr.ver) || /^v?\d+\.\d+/i.test(sr.ver))) return;
    const tag = new RegExp('〔' + sr.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s〕]');
    const dated = head.some((t, k) => t !== null && tag.test(t) && /\b(19|20)\d{2}\b/.test(t + ' ' + (head[k + 1] || '')));
    if (!dated) fail(dir, sr.at, 'header', dir + '/map.txt:' + sr.at + ' source ' + sr.name + ' has no header line 〔' + sr.name + ' …〕 naming the edition read (its year or version)');
  });
  if (!REVIEWED.test(src)) fail(dir, null, 'header', dir + '/map.txt: no "# Rows reviewed: <oncos commit> (<date>)" line in the header');
  // A {pmid N} trial links itself to the one row citing that PMID, as on the page (outline.js link).
  const many = O.link(m, Object.fromEntries(byAnchor));
  for (const {line, where} of O.trials(m)) {
    const tag = dir + '/map.txt:' + line.at + ' ' + line.name;
    if (line.pmid && many[line.pmid]) {
      fail(dir, line.at, 'link', tag + ': PMID ' + line.pmid + ' is cited by ' + many[line.pmid].length + ' rows (' + many[line.pmid].join(', ') + '); give the [t-...] anchor'); continue; }
    if (line.pmid && !line.anchor) {
      const pm = new RegExp('(^|\\D)' + line.pmid + '(\\D|$)'), filed = rows.find(r => pm.test(JSON.stringify(r)));
      if (filed) { fail(dir, line.at, 'link', tag + ': PMID ' + line.pmid + ' appears only in the text of ' + filed.study + ' [' + filed.anchor + '] in ' + filed.sheet + ', not as its reference PMID; give that anchor'); continue; }
      intake.push(line.name + '\tPMID ' + line.pmid + '\t' + where);
      intakeItems.push({name: line.name, pmid: line.pmid, url: null, where, at: line.at}); continue; }
    if (line.url && !line.anchor) {
      intake.push(line.name + '\tno PMID yet ' + line.url + '\t' + where);
      intakeItems.push({name: line.name, pmid: null, url: line.url, where, at: line.at}); continue; }
    const r = byAnchor.get(line.anchor);
    if (!r) { fail(dir, line.at, 'link', tag + ': no Evidence row ' + line.anchor + ' (give [t-...] or {pmid N})'); continue; }
    if (!TRIAL_TYPE.test(r.type) || (NOT_TRIAL.test(r.type) && !/clinical trial|randomi/i.test(r.type) && !/^systematic review and meta-analys/i.test(r.type)))
      fail(dir, line.at, 'study-type', tag + ': ' + r.anchor + ' is "' + r.type.slice(0, 60) + '"; maps cite trials and meta-analyses only (move it under off:)');
    if (line.fig) fail(dir, line.at, 'wording', tag + ': figure "' + line.fig + '" on a trial line; maps give trial names only (results are on the card)');
  }
  write(path.join(__dirname, dir, 'intake.txt'),
    '# Trials on the ' + (m.map || dir) + ' map with no Evidence row yet (name, PMID, where on the map)\n' + intake.join('\n') + '\n');
  const on = new Set(O.trials(m).map(t => t.line.anchor));
  const used = new Set(O.tags(m).map(t => t.source));
  Object.values(m.sources).forEach(sr => {
    if (sr.url && !sr.anchor) { if (!used.has(sr.name)) fail(dir, sr.at, 'source', dir + '/map.txt:' + sr.at + ' source ' + sr.name + ' has no 〔' + sr.name + ' …〕 tag on the map'); return; }
    if (!byAnchor.has(sr.anchor)) fail(dir, sr.at, 'link', dir + '/map.txt:' + sr.at + ' source: no Evidence row ' + sr.anchor);
    else if (!used.has(sr.name)) fail(dir, sr.at, 'source', dir + '/map.txt:' + sr.at + ' source ' + sr.name + ' has no 〔' + sr.name + ' …〕 tag on the map');
    on.add(sr.anchor);
  });
  m.off.forEach(o => {
    if (o.pmid && many[o.pmid]) fail(dir, o.at, 'link', dir + '/map.txt:' + o.at + ' off: PMID ' + o.pmid + ' is cited by ' + many[o.pmid].length + ' rows (' + many[o.pmid].join(', ') + '); give the [t-...] anchor');
    else if (o.pmid && !o.anchor) fail(dir, o.at, 'link', dir + '/map.txt:' + o.at + ' off: no Evidence row cites PMID ' + o.pmid);
    else if (!byAnchor.has(o.anchor)) fail(dir, o.at, 'link', dir + '/map.txt:' + o.at + ' off: no Evidence row ' + o.anchor);
    else if (on.has(o.anchor)) fail(dir, o.at, 'outline', dir + '/map.txt:' + o.at + ' ' + o.name + ' is both on the map and under off:');
    on.add(o.anchor); });
  const off = rows.filter(r => r.sheet === m.map && !on.has(r.anchor))
    .sort((a, b) => String(b.pubdate || b.yearnum).localeCompare(String(a.pubdate || a.yearnum)));
  write(path.join(__dirname, dir, 'unplaced.txt'),
    '# ' + (m.map || dir) + ' Evidence rows neither on the map nor under off:, newest first (year, study, section, anchor)\n' +
    off.map(r => [r.yearnum, r.study, r.subcat, r.anchor].join('\t')).join('\n') + '\n');
  off.forEach(r => fail(dir, null, 'unplaced', dir + ': sheet row ' + r.study + ' [' + r.anchor + '] is neither on the map nor under off:'));
  if (!rows.some(r => r.sheet === m.map)) fail(dir, null, 'link', dir + ': no Evidence sheet named "' + m.map + '"');
  summary[dir] = {
    trials: O.trials(m).length,
    intake: intake.length,
    unplaced: off.length,
    intake_items: intakeItems,
    unplaced_items: off.map(r => ({study: r.study, anchor: r.anchor, sheet: r.sheet, subcat: r.subcat || '', yearnum: r.yearnum || '', pmids: O.pmids(r)})),
    sources: Object.values(m.sources).map(sr => ({name: sr.name, url: sr.url, anchor: sr.anchor, ver: sr.ver || null}))
  };
  if (!JSON_OUT) console.log(dir + ': ' + O.trials(m).length + ' trials, ' + intake.length + ' for intake, ' + off.length + ' new sheet rows to place');
}
if (JSON_OUT) { console.log(JSON.stringify({ok: !bad, problems, maps: summary})); process.exit(bad ? 1 : 0); }
if (bad) { console.log(bad + ' problem(s)'); process.exit(1); }
console.log('maps check passed');
