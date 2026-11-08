/* Release check for the board maps: node maps/check.cjs
   - every map trial points at an Evidence row, or carries a PMID and is listed for intake
   - every key figure's numbers appear in that trial's Evidence row
   - lists the sheet's Evidence rows that are not on the map, newest first, for review
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
const norm = s => String(s).replace(/·/g, '.').replace(/(\d),(\d{3})/g, '$1$2');
let bad = 0;
for (const dir of fs.readdirSync(__dirname)) {
  const f = path.join(__dirname, dir, 'map.txt');
  if (!fs.existsSync(f)) continue;
  const m = O.parse(fs.readFileSync(f, 'utf8'));
  m.errors.forEach(e => { bad++; console.log(dir + '/map.txt ' + e); });
  const intake = [];
  for (const {line, where} of O.trials(m)) {
    const tag = dir + '/map.txt:' + line.at + ' ' + line.name;
    if (line.pmid && !line.anchor) { intake.push(line.name + '\tPMID ' + line.pmid + '\t' + where); continue; }
    const r = byAnchor.get(line.anchor);
    if (!r) { bad++; console.log(tag + ': no Evidence row ' + line.anchor + ' (give [t-...] or {pmid N})'); continue; }
    const text = norm([r.findings, r.population, r.arms, r.endpoint, r.type].join('\n'));
    for (const n of (norm(line.fig).match(/\d+(?:\.\d+)?/g) || [])) {
      const re = new RegExp('(^|[^\\d.])' + n.replace('.', '\\.') + '(?![\\d])');
      if (!re.test(text)) { bad++; console.log(tag + ': "' + n + '" in "' + line.fig + '" is not in ' + r.anchor); }
    }
  }
  fs.writeFileSync(path.join(__dirname, dir, 'intake.txt'),
    '# Trials on the ' + (m.map || dir) + ' map with no Evidence row yet (name, PMID, where on the map)\n' + intake.join('\n') + '\n');
  const on = new Set(O.trials(m).map(t => t.line.anchor));
  const off = rows.filter(r => r.sheet === m.map && !on.has(r.anchor))
    .sort((a, b) => String(b.pubdate || b.yearnum).localeCompare(String(a.pubdate || a.yearnum)));
  fs.writeFileSync(path.join(__dirname, dir, 'unplaced.txt'),
    '# ' + (m.map || dir) + ' Evidence rows not on the map, newest first (year, study, section, anchor)\n' +
    off.map(r => [r.yearnum, r.study, r.subcat, r.anchor].join('\t')).join('\n') + '\n');
  if (!rows.some(r => r.sheet === m.map)) { bad++; console.log(dir + ': no Evidence sheet named "' + m.map + '"'); }
  console.log(dir + ': ' + O.trials(m).length + ' trials, ' + intake.length + ' for intake, ' + off.length + ' sheet rows not on the map');
}
if (bad) { console.log(bad + ' problem(s)'); process.exit(1); }
console.log('maps check passed');
