/* Rows changed since a map last reviewed them: node maps/watch.cjs [--json | --digest] [--against <evidence.json>] [--snapshot] [map id ...]
   Each map.txt header carries "# Rows reviewed: <oncos commit> (<date>)", the Evidence state its rows were last
   reviewed against (Jonan 2026-11-27). For every row the map cites (trial lines, off: lines and source: rows), the
   row in that commit's data/evidence.json (or --against <file>, or maps/<id>/reviewed.json fallback on shallow clones)
   is compared with the row now:
     reference  a reference the row did not cite then (an update, a later analysis); same PMID = same paper (tier: action)
     fields     its population, arms, endpoint, findings, type or name changed after folding cosmetic formatting
                (tier: action when ★ conclusion / endpoints / numbers changed; tier: check for wording edits)
     filed      the row was filed after the review point (the map cited the trial by PMID before; tier: linked unless
                the filed row already carries additional newer papers beyond that PMID, in which case kind: reference)
   Each change lists the map lines the trial sits under, so the review starts from what the map says.
   When data/evidence.json carries watch.{guidelines, literature, congress}, each map also reports:
     guidelines_behind  sources whose edition ({ver ...} or header citation) trails watch.guidelines, with tagged_lines
     excluded_hits      excluded.txt trials (inclusion.txt ⑨) matched in trials or watch.literature/congress
   --json prints {maps: {id: {sheet, reviewed, changes, guidelines_behind, excluded_count, excluded_hits, error}}}.
   --digest prints the pending list for the map release branch (maps/pending.json, read by the editor's Maps list):
   this, with node maps/check.cjs --json, the commit, the time and the branch's commits not yet on main (waiting). */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const O = (function(){ const m = {exports:{}}; new Function('module', fs.readFileSync(path.join(__dirname, 'outline.js'), 'utf8'))(m); return m.exports; })();
const root = path.join(__dirname, '..');
const rawArgs = process.argv.slice(2);
const JSON_OUT = rawArgs.includes('--json'), DIGEST = rawArgs.includes('--digest'), SNAPSHOT = rawArgs.includes('--snapshot');
let AGAINST = null;
const only = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--against' && rawArgs[i + 1]) { AGAINST = rawArgs[++i]; continue; }
  if (rawArgs[i].startsWith('--')) continue;
  only.push(rawArgs[i]);
}
const REVIEWED = /^#\s*Rows reviewed:\s*([0-9a-f]{40})\s*\((\d{4}-\d{2}-\d{2})\)\s*$/m;
const FIELDS = ['study', 'type', 'population', 'arms', 'endpoint', 'findings'];
const evData = JSON.parse(fs.readFileSync(path.join(root, 'data/evidence.json'), 'utf8'));
const rows = evData.trials || [];
const byAnchor = Object.fromEntries(rows.map(r => [r.anchor, r]));
const watchData = evData.watch || {};

const then = {};
function indexTrials(list) {
  const anchors = {}, papers = {};
  (list || []).forEach(r => { anchors[r.anchor] = r; O.pmids(r).forEach(p => (papers[p] = papers[p] || []).push(r)); });
  return {anchors, papers};
}
function rowsAt(commit) {
  if (!then[commit]) {
    const text = cp.execFileSync('git', ['show', commit + ':data/evidence.json'], {cwd: root, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe']});
    then[commit] = indexTrials(JSON.parse(text).trials);
  }
  return then[commit];
}
const againstIndex = AGAINST ? indexTrials(JSON.parse(fs.readFileSync(AGAINST, 'utf8')).trials) : null;

const flat = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// Fold purely cosmetic housekeeping edits (lower_arm_letters Ⓐ->ⓐ, rename_results ・Limits->・Limitations, whitespace/middot)
// so sheet-wide formatting passes do not generate false-positive clinical alerts.
function normDiff(s) {
  return flat(s)
    .replace(/[\u24B6-\u24CF]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 26))
    .replace(/・Limits\b/g, '・Limitations')
    .replace(/\s*·\s*/g, ' · ');
}
function sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16); }
function rowSignature(row) {
  const hashes = {};
  FIELDS.forEach(k => { hashes[k] = sha(normDiff(row[k])); });
  const refs = [...new Set([...(row.refs || []).flatMap(papers), ...O.pmids(row).map(p => 'pmid ' + p)])].sort();
  return {refs, hashes};
}
// Extract ★ conclusion line and numeric clinical figures from findings to classify action vs check edits.
function findingsSignal(s) {
  const lines = String(s || '').split(/\r?\n/);
  const star = lines.find(l => /^\s*★/.test(l)) || '';
  const nums = normDiff(s).match(/\b(?:HR|OR|RR|OS|PFS|DFS|EFS|RFS|iDFS|ORR|cORR|pCR|CR|PR|mOS|mPFS)\b[^;\n]{0,40}|\b\d+(?:\.\d+)?\s*(?:%|mo(?:nths?)?|yr|years?)\b/gi) || [];
  return normDiff(star) + '||' + nums.map(x => x.toLowerCase()).join('|');
}
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
function compare(row, old, linePmid, savedSig) {
  // If a per-row reviewed snapshot matches the row's current signature, it is already reviewed.
  const curSig = rowSignature(row);
  if (savedSig && savedSig.hashes && savedSig.refs) {
    const known = new Set(savedSig.refs);
    const added = (row.refs || []).filter(r => !papers(r).some(k => known.has(k))).map(r => ({label: r.label || '', text: r.text || '', pmid: r.pmid || ''}));
    const changedKeys = FIELDS.filter(k => savedSig.hashes[k] !== curSig.hashes[k]);
    if (!added.length && !changedKeys.length) return null;
    if (!old) {
      const fields = {};
      changedKeys.forEach(k => { fields[k] = {before: '', after: String(row[k] || '')}; });
      if (added.length) return {kind: 'reference', tier: 'action', refs: added, fields};
      const tier = changedKeys.some(k => k === 'findings' || k === 'endpoint') ? 'action' : 'check';
      return {kind: 'fields', tier, fields};
    }
  }
  if (!old) return null;
  const was = before(row, old);
  if (!was) {
    // A trial already on the map via {pmid N} that was simply filed with that same paper is auto-linked (tier: linked).
    // If the newly filed row already carries additional newer papers beyond {pmid N}, flag those as reference updates.
    if (linePmid) {
      const extra = (row.refs || []).filter(r => r.pmid && String(r.pmid) !== String(linePmid))
        .map(r => ({label: r.label || '', text: r.text || '', pmid: r.pmid || ''}));
      if (extra.length) return {kind: 'reference', tier: 'action', refs: extra, fields: {}};
    }
    return {kind: 'filed', tier: 'linked'};
  }
  const known = new Set([...(was.refs || []).flatMap(papers), ...O.pmids(was).map(p => 'pmid ' + p)]);
  const added = (row.refs || []).filter(r => !papers(r).some(k => known.has(k))).map(r => ({label: r.label || '', text: r.text || '', pmid: r.pmid || ''}));
  const fields = {};
  FIELDS.forEach(k => { if (normDiff(was[k]) !== normDiff(row[k])) fields[k] = {before: String(was[k] || ''), after: String(row[k] || '')}; });
  if (added.length) return {kind: 'reference', tier: 'action', refs: added, fields};
  if (Object.keys(fields).length) {
    const major = Boolean(fields.endpoint) || (fields.findings && findingsSignal(was.findings) !== findingsSignal(row.findings));
    return {kind: 'fields', tier: major ? 'action' : 'check', fields};
  }
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
// Compare map source: lines (preferring structured {ver ...}, falling back to header 〔NAME …〕 lines) against watch.guidelines.
function doiOf(url) {
  const m = /^https?:\/\/(?:dx\.)?doi\.org\/(10\.\S+)$/i.exec(String(url || '').trim());
  return m ? m[1].toLowerCase().replace(/\.$/, '') : null;
}
function esmoSlug(url) {
  const m = /^https:\/\/(?:www\.)?esmo\.org\/guidelines\/living-guidelines\/([a-z0-9-]+)\/?$/i.exec(String(url || '').trim());
  return m ? m[1].toLowerCase() : null;
}
function parseVer(v, track) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{1,2}\.20\d{2}$/.test(s)) {
    const [n, y] = s.split('.');
    return {scheme: 'nccn', parts: [parseInt(y, 10), parseInt(n, 10)]};
  }
  if (/^20\d{2}\.\d+(?:\.\d+)*$/.test(s)) {
    return {scheme: 'asco', parts: s.split('.').map(x => parseInt(x, 10))};
  }
  if (/^v\d+(?:\.\d+)+$/i.test(s) || (track === 'esmo-living' && /^\d+(?:\.\d+)+$/.test(s))) {
    return {scheme: 'esmo-living', parts: s.replace(/^v/i, '').split('.').map(x => parseInt(x, 10))};
  }
  if (/^(?:19|20)\d{2}$/.test(s)) {
    return {scheme: 'year', parts: [parseInt(s, 10)]};
  }
  return null;
}
function verLess(a, b, track) {
  const pa = parseVer(a, track), pb = parseVer(b, track);
  if (!pa || !pb || pa.scheme !== pb.scheme) return false;
  for (let i = 0; i < Math.max(pa.parts.length, pb.parts.length); i++) {
    const x = pa.parts[i] || 0, y = pb.parts[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}
function sourceEditionFromHeader(src, name) {
  const head = src.split('\n').map(t => /^\s*#/.test(t) ? t.replace(/^\s*#\s?/, '').trim() : null);
  const tag = new RegExp('〔' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s〕]');
  const parts = [];
  for (let k = 0; k < head.length; k++) {
    if (head[k] === null || !tag.test(head[k])) continue;
    const idx = head[k].search(tag);
    parts.push(head[k].slice(idx));
    for (let j = k + 1; j < head.length; j++) {
      if (head[j] === null || head[j].slice(0, 3).includes('〔')) break;
      parts.push(head[j]);
    }
  }
  const joined = parts.join(' ');
  const nccn = /\b(\d{1,2}\.20\d{2})\b/.exec(joined);
  const esmo = /\bv(\d+(?:\.\d+)+)\b/.exec(joined);
  const asco = /\b(20\d{2}\.\d+(?:\.\d+)?)\b/.exec(joined);
  const years = (joined.match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);
  const year = years.length ? String(Math.max(...years)) : null;
  return {joined, nccn: nccn ? nccn[1] : null, esmo: esmo ? 'v' + esmo[1] : null, asco: asco ? asco[1] : null, year,
          version: (esmo && 'v' + esmo[1]) || (asco && asco[1]) || (nccn && nccn[1]) || year || null};
}
function checkGuidelines(m, src) {
  const gItems = (watchData.guidelines && watchData.guidelines.items) || [];
  if (!gItems.length) return [];
  const allTags = O.tags(m);
  const behind = [];
  for (const sr of Object.values(m.sources)) {
    const srDoi = doiOf(sr.url), srSlug = esmoSlug(sr.url);
    const hdr = sourceEditionFromHeader(src, sr.name);
    const candidates = gItems.filter(g => {
      if (srDoi && doiOf(g.url) === srDoi) return true;
      if (srSlug && esmoSlug(g.url) === srSlug) return true;
      if (sr.url && g.url && sr.url.replace(/\/+$/, '').toLowerCase() === g.url.replace(/\/+$/, '').toLowerCase()) return true;
      const gSheets = g.sheets || (g.sheet ? [g.sheet] : []);
      if (m.map && gSheets.includes(m.map) && g.society && sr.name.toUpperCase() === g.society.toUpperCase()) return true;
      return false;
    });
    for (const match of candidates) {
      if (!match.latest) continue;
      const track = match.track || '';
      const mapVer = sr.ver || (track === 'nccn' ? hdr.nccn : track === 'esmo-living' ? hdr.esmo : track === 'asco-living' ? hdr.asco : hdr.year);
      if (!mapVer || !verLess(mapVer, match.latest, track)) continue;
      const seenLine = new Set();
      const tagged = allTags.filter(t => t.source === sr.name).filter(t => {
        const k = t.at + ':' + t.text;
        if (seenLine.has(k)) return false;
        seenLine.add(k); return true;
      }).map(t => ({at: t.at, where: t.where, text: t.text}));
      behind.push({source: sr.name, title: match.title || match.study || sr.name, society: match.society || '',
                   track, map_version: mapVer, latest: match.latest, url: match.url || sr.url || '', tagged_lines: tagged});
      break;
    }
  }
  return behind;
}
function checkExcluded(dir) {
  const exFile = path.join(__dirname, dir, 'excluded.txt');
  if (!fs.existsSync(exFile)) return {count: 0, hits: []};
  const entries = O.parseExcluded(fs.readFileSync(exFile, 'utf8'));
  if (!entries.length) return {count: 0, hits: []};
  const trialByPmid = {};
  rows.forEach(r => O.pmids(r).forEach(p => { trialByPmid[p] = r; }));
  const litByPmid = Object.fromEntries(((watchData.literature && watchData.literature.items) || []).filter(i => i.pmid).map(i => [String(i.pmid), i]));
  const congByDoi = Object.fromEntries(((watchData.congress && watchData.congress.items) || []).filter(i => i.doi).map(i => [String(i.doi).toLowerCase(), i]));
  const hits = [];
  for (const ex of entries) {
    const matched = [];
    for (const p of ex.pmids) {
      if (trialByPmid[p]) matched.push({where: 'evidence', study: trialByPmid[p].study, sheet: trialByPmid[p].sheet, pmid: p});
      if (litByPmid[p]) matched.push({where: 'literature', title: litByPmid[p].title, date: litByPmid[p].date || '', pmid: p});
    }
    for (const d of ex.dois) {
      if (congByDoi[d]) matched.push({where: 'congress', title: congByDoi[d].title, meeting: congByDoi[d].meeting || '', doi: d});
    }
    if (matched.length) hits.push({trial: ex.trial, screened: ex.screened, reason: ex.reason, matches: matched});
  }
  return {count: entries.length, hits};
}

function readSavedReview(dir) {
  const f = path.join(__dirname, dir, 'reviewed.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function watch(dir) {
  const src = fs.readFileSync(path.join(__dirname, dir, 'map.txt'), 'utf8');
  const point = REVIEWED.exec(src);
  const sheet = (/^map:\s*(.+)$/m.exec(src) || [])[1] || dir;
  const saved = readSavedReview(dir);
  let old = againstIndex, err = null;
  if (!old) {
    if (!point && !saved) return {sheet, reviewed: null, changes: [], guidelines_behind: [], excluded_count: 0, excluded_hits: [], error: 'no "# Rows reviewed: <oncos commit> (<date>)" line'};
    if (point) {
      try { old = rowsAt(point[1]); }
      catch (e) {
        if (!saved) err = 'commit ' + point[1].slice(0, 7) + ' not readable here (git fetch --unshallow)';
      }
    }
  }
  const m = O.parse(src); O.link(m, byAnchor);
  const guidelinesBehind = checkGuidelines(m, src);
  const excluded = checkExcluded(dir);
  if (err) {
    return {sheet, reviewed: point ? {commit: point[1], date: point[2]} : null, changes: [],
            guidelines_behind: guidelinesBehind, excluded_count: excluded.count, excluded_hits: excluded.hits, error: err};
  }
  const changes = [], seen = new Set();
  const snapRows = {};
  const add = (row, at, name, where, lines, linePmid) => {
    if (!row || seen.has(row.anchor)) return;
    seen.add(row.anchor);
    if (SNAPSHOT) snapRows[row.anchor] = rowSignature(row);
    const savedSig = saved && saved.rows ? saved.rows[row.anchor] : null;
    const c = compare(row, old, linePmid, savedSig);
    if (c) changes.push(Object.assign({row: {anchor: row.anchor, study: row.study, sheet: row.sheet}, line: {at, name, pmid: linePmid || null}, where, tied: lines}, c));
  };
  blocks(m).forEach(b => b.lines.forEach(l => { if (l.kind === 'trial') add(byAnchor[l.anchor], l.at, l.name, b.where, tied(b.lines, l), l.pmid); }));
  m.off.forEach(o => add(byAnchor[o.anchor], o.at, o.name, 'off:', [{at: o.at, text: o.name + ' | ' + o.reason}], o.pmid));
  Object.values(m.sources).forEach(s => { if (s.anchor) add(byAnchor[s.anchor], s.at, s.name, 'source:', [{at: s.at, text: 'source: ' + s.name}], null); });
  if (SNAPSHOT) {
    const snap = {reviewed_at: new Date().toISOString().slice(0, 10), commit: point ? point[1] : null,
                  sources: Object.fromEntries(Object.values(m.sources).map(s => [s.name, s.ver || sourceEditionFromHeader(src, s.name).version])),
                  rows: snapRows};
    fs.writeFileSync(path.join(__dirname, dir, 'reviewed.json'), JSON.stringify(snap, null, 1) + '\n');
  }
  return {sheet, reviewed: point ? {commit: point[1], date: point[2]} : (saved ? {commit: saved.commit || null, date: saved.reviewed_at || null} : null),
          changes, guidelines_behind: guidelinesBehind, excluded_count: excluded.count, excluded_hits: excluded.hits, error: null};
}

const out = {};
for (const dir of fs.readdirSync(__dirname).sort()) {
  if (only.length && !only.includes(dir)) continue;
  if (fs.existsSync(path.join(__dirname, dir, 'map.txt'))) out[dir] = watch(dir);
}
if (DIGEST) {
  const check = cp.spawnSync(process.execPath, [path.join(__dirname, 'check.cjs'), '--json'], {cwd: root, maxBuffer: 1 << 26});
  const git = a => cp.execFileSync('git', a, {cwd: root, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
  const head = git(['rev-parse', 'HEAD']);
  // the map release's commits not yet on main, newest first: its own line only (--first-parent), so the merged
  // history a restarted branch joins with `merge -s ours` is not listed, and not the daily list commits
  let waiting = [];
  try { waiting = git(['log', '--no-merges', '--first-parent', '--format=%H%x09%cs%x09%s', 'origin/main..HEAD']).split('\n').filter(Boolean)
    .map(t => { const [commit, date, subject] = t.split('\t'); return {commit, date, subject}; })
    .filter(c => !/^Map list /.test(c.subject)); } catch (e) { waiting = null; }
  console.log(JSON.stringify({generated: new Date().toISOString(), commit: head, waiting,
    check: JSON.parse(check.stdout.toString()), maps: out}, null, 1));
} else if (JSON_OUT) console.log(JSON.stringify({maps: out}));
else {
  let n = 0, linked = 0;
  for (const [dir, w] of Object.entries(out)) {
    if (w.error) { console.log(dir + ': ' + w.error); continue; }
    const actionable = w.changes.filter(c => c.tier !== 'linked');
    const autoLinked = w.changes.filter(c => c.tier === 'linked');
    linked += autoLinked.length;
    if (!actionable.length && !w.guidelines_behind.length && !w.excluded_hits.length) {
      console.log(dir + ': no clinical change since ' + (w.reviewed ? w.reviewed.date : '?') + (autoLinked.length ? ' (' + autoLinked.length + ' auto-linked)' : ''));
      continue;
    }
    n += actionable.length;
    console.log(dir + ': ' + actionable.length + ' clinical change(s)' + (autoLinked.length ? ', ' + autoLinked.length + ' auto-linked' : '')
      + (w.guidelines_behind.length ? ', ' + w.guidelines_behind.length + ' guideline(s) behind' : '')
      + (w.excluded_hits.length ? ', ' + w.excluded_hits.length + ' excluded hit(s)' : '')
      + ' since ' + (w.reviewed ? w.reviewed.date + (w.reviewed.commit ? ' (' + w.reviewed.commit.slice(0, 7) + ')' : '') : '?'));
    w.guidelines_behind.forEach(g => console.log('  [guideline] ' + g.source + ' ' + g.map_version + ' -> ' + g.latest + ' (' + g.tagged_lines.length + ' tagged lines)'));
    actionable.forEach(c => {
      const what = c.kind === 'reference' ? 'new reference: ' + c.refs.map(r => (r.label ? r.label + ' ' : '') + r.text).join('; ') : '';
      const fields = Object.keys(c.fields || {});
      console.log('  [' + c.tier + '] ' + c.row.study + ' [' + c.row.anchor + '] map.txt:' + c.line.at + ' (' + c.where + ') ' + [what, fields.length ? 'changed: ' + fields.join(', ') : ''].filter(Boolean).join(' · '));
      c.tied.forEach(t => console.log('      ' + t.at + ': ' + t.text.slice(0, 110)));
    });
    w.excluded_hits.forEach(ex => console.log('  [excluded] ' + ex.trial + ' (' + ex.matches.map(m => m.where).join(', ') + ')'));
  }
  console.log(n + ' clinical change(s), ' + linked + ' auto-linked in all');
}
