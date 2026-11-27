/* Rows changed since a map last reviewed them: node maps/watch.cjs [--json | --digest] [map id ...]
   Each map.txt header carries "# Rows reviewed: <oncos commit> (<date>)", the Evidence state its rows were last
   reviewed against (Jonan 2026-11-27). For every row the map cites (trial lines, off: lines and source: rows), the
   row in that commit's data/evidence.json is compared with the row now:
     reference  a reference the row did not cite then (an update, a later analysis); same PMID = same paper
     fields     its population, arms, endpoint, findings, type or name changed (the text before and after)
     filed      the row was filed after the review point (the map cited the trial by PMID before)
   Each change lists the map lines the trial sits under, so the review starts from what the map says.
   A review that changes nothing moves the "Rows reviewed" line to the commit reviewed; it ships with the next
   map release. This lists and never edits.
   --json prints {maps: {id: {reviewed, changes, error}}}. --digest prints the pending list for the map release
   branch (maps/pending.json): this, with node maps/check.cjs --json, the commit and the time. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const O = (function(){ const m = {exports:{}}; new Function('module', fs.readFileSync(path.join(__dirname, 'outline.js'), 'utf8'))(m); return m.exports; })();
const root = path.join(__dirname, '..');
const args = process.argv.slice(2), JSON_OUT = args.includes('--json'), DIGEST = args.includes('--digest');
const only = args.filter(a => !a.startsWith('--'));
const REVIEWED = /^#\s*Rows reviewed:\s*([0-9a-f]{40})\s*\((\d{4}-\d{2}-\d{2})\)\s*$/m;
const FIELDS = ['study', 'type', 'population', 'arms', 'endpoint', 'findings'];
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/evidence.json'), 'utf8')).trials;
const byAnchor = Object.fromEntries(rows.map(r => [r.anchor, r]));

const then = {};
function rowsAt(commit) {
  if (!then[commit]) {
    const text = cp.execFileSync('git', ['show', commit + ':data/evidence.json'], {cwd: root, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe']});
    const old = JSON.parse(text).trials, anchors = {}, papers = {};
    old.forEach(r => { anchors[r.anchor] = r; O.pmids(r).forEach(p => (papers[p] = papers[p] || []).push(r)); });
    then[commit] = {anchors, papers};
  }
  return then[commit];
}
const flat = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// A reference is the same paper when its PMID matches, or when its first author, year and journal match
// (a PMID added later, "online ahead of print" replaced by the issue)
function cite(r) {
  const t = flat(r.text).toLowerCase().replace(/\(online ahead of print\)/g, '');
  const year = /\b(?:19|20)\d{2}\b/.exec(t), author = /^[^\s,.]+/.exec(t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const journal = /\bet al\.?\s+(?:the\s+)?([a-z]+)/.exec(t);
  return 'cite ' + (author ? author[0] : '') + ' ' + (year ? year[0] : '') + ' ' + (journal ? journal[1] : '');
}
const papers = r => [r.pmid ? 'pmid ' + r.pmid : null, cite(r)].filter(Boolean);
// The same row then: its anchor, else the one row that cited one of its PMIDs (rows are renamed)
function before(row, old) {
  if (old.anchors[row.anchor]) return old.anchors[row.anchor];
  for (const p of O.pmids(row)) if ((old.papers[p] || []).length === 1) return old.papers[p][0];
  return null;
}
function compare(row, old) {
  const was = before(row, old);
  if (!was) return {kind: 'filed'};
  const known = new Set([...(was.refs || []).flatMap(papers), ...O.pmids(was).map(p => 'pmid ' + p)]);
  const added = (row.refs || []).filter(r => !papers(r).some(k => known.has(k))).map(r => ({label: r.label || '', text: r.text || '', pmid: r.pmid || ''}));
  const fields = {};
  FIELDS.forEach(k => { if (flat(was[k]) !== flat(row[k])) fields[k] = {before: String(was[k] || ''), after: String(row[k] || '')}; });
  if (added.length) return {kind: 'reference', refs: added, fields};
  if (Object.keys(fields).length) return {kind: 'fields', fields};
  return null;
}
// The lines a trial sits under in its box: each line above it at a smaller indent, nearest last
function tied(lines, line) {
  const out = []; let level = line.level;
  for (let i = lines.indexOf(line) - 1; i >= 0 && level > 0; i--) {
    const l = lines[i];
    if (l.level < level && l.kind !== 'trial') { out.unshift({at: l.at, text: (l.n ? l.n + ' ' : '') + (l.text || '')}); level = l.level; }
  }
  return out;
}
function blocks(m) {
  const out = [];
  m.bands.forEach(b => out.push({where: b.title, lines: b.lines}));
  O.walk(m.tree, n => out.push({where: n.label, lines: n.lines}));
  m.panels.forEach(p => out.push({where: p.title, lines: p.lines}));
  return out;
}
function watch(dir) {
  const src = fs.readFileSync(path.join(__dirname, dir, 'map.txt'), 'utf8');
  const point = REVIEWED.exec(src);
  if (!point) return {reviewed: null, changes: [], error: 'no "# Rows reviewed: <oncos commit> (<date>)" line'};
  let old;
  try { old = rowsAt(point[1]); }
  catch (e) { return {reviewed: {commit: point[1], date: point[2]}, changes: [], error: 'commit ' + point[1].slice(0, 7) + ' not readable here (git fetch --unshallow)'}; }
  const m = O.parse(src); O.link(m, byAnchor);
  const changes = [], seen = new Set();
  const add = (row, at, name, where, lines) => {
    if (!row || seen.has(row.anchor)) return;
    seen.add(row.anchor);
    const c = compare(row, old);
    if (c) changes.push(Object.assign({row: {anchor: row.anchor, study: row.study, sheet: row.sheet}, line: {at, name}, where, tied: lines}, c));
  };
  blocks(m).forEach(b => b.lines.forEach(l => { if (l.kind === 'trial') add(byAnchor[l.anchor], l.at, l.name, b.where, tied(b.lines, l)); }));
  m.off.forEach(o => add(byAnchor[o.anchor], o.at, o.name, 'off:', [{at: o.at, text: o.name + ' | ' + o.reason}]));
  Object.values(m.sources).forEach(s => { if (s.anchor) add(byAnchor[s.anchor], s.at, s.name, 'source:', [{at: s.at, text: 'source: ' + s.name}]); });
  return {reviewed: {commit: point[1], date: point[2]}, changes, error: null};
}

const out = {};
for (const dir of fs.readdirSync(__dirname).sort()) {
  if (only.length && !only.includes(dir)) continue;
  if (fs.existsSync(path.join(__dirname, dir, 'map.txt'))) out[dir] = watch(dir);
}
if (DIGEST) {
  const check = cp.spawnSync(process.execPath, [path.join(__dirname, 'check.cjs'), '--json'], {cwd: root, maxBuffer: 1 << 26});
  const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root}).toString().trim();
  console.log(JSON.stringify({generated: new Date().toISOString(), commit: head,
    check: JSON.parse(check.stdout.toString()), maps: out}, null, 1));
} else if (JSON_OUT) console.log(JSON.stringify({maps: out}));
else {
  let n = 0;
  for (const [dir, w] of Object.entries(out)) {
    if (w.error) { console.log(dir + ': ' + w.error); continue; }
    if (!w.changes.length) { console.log(dir + ': no row changed since ' + w.reviewed.date); continue; }
    n += w.changes.length;
    console.log(dir + ': ' + w.changes.length + ' row(s) changed since ' + w.reviewed.date + ' (' + w.reviewed.commit.slice(0, 7) + ')');
    w.changes.forEach(c => {
      const what = c.kind === 'filed' ? 'filed since' : c.kind === 'reference' ? 'new reference: ' + c.refs.map(r => (r.label ? r.label + ' ' : '') + r.text).join('; ') : '';
      const fields = Object.keys(c.fields || {});
      console.log('  ' + c.row.study + ' [' + c.row.anchor + '] map.txt:' + c.line.at + ' (' + c.where + ') ' + [what, fields.length ? 'changed: ' + fields.join(', ') : ''].filter(Boolean).join(' · '));
      c.tied.forEach(t => console.log('      ' + t.at + ': ' + t.text.slice(0, 110)));
    });
  }
  console.log(n + ' row(s) changed in all');
}
