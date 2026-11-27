/* Self-contained tests for outline.js ({ver}, tags, parseExcluded), check.cjs (--json items) and watch.cjs
   (cosmetic folding, severity tiers, --against, reviewed.json fallback, guidelines_behind, excluded_hits).
   Run: node maps/watch-test.cjs */
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const O = (function(){ const m = {exports:{}}; new Function('module', fs.readFileSync(path.join(__dirname, 'outline.js'), 'utf8'))(m); return m.exports; })();

// 1. outline.js: {ver ...}, tags() with where/text, parseExcluded()
{
  const src = [
    '# Header',
    'map: Test Sheet',
    'source: NCCN {url https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419} {ver 2.2026}',
    'source: ESMO {url https://doi.org/10.1016/j.annonc.2025.01.001}',
    'tree: Root',
    '  Step A',
    '    ① Option one 〔NCCN 2A〕 〔ESMO I, A〕',
    '      + TRIAL-A {pmid 11111111}',
  ].join('\n');
  const m = O.parse(src);
  assert.strictEqual(m.errors.length, 0, m.errors.join('; '));
  assert.strictEqual(m.sources.NCCN.ver, '2.2026');
  assert.strictEqual(m.sources.ESMO.ver, null);
  const tags = O.tags(m);
  assert.strictEqual(tags.length, 2);
  assert.strictEqual(tags[0].where, 'Step A');
  assert(tags[0].text.includes('Option one'));
  const ex = O.parseExcluded('# comment\nOLD-TRIAL | PMID 99999999, doi 10.1000/xyz | 2026-11-01 | class C, negative | No benefit\n');
  assert.strictEqual(ex.length, 1);
  assert.deepStrictEqual(ex[0].pmids, ['99999999']);
  assert.deepStrictEqual(ex[0].dois, ['10.1000/xyz']);
}

// 2. End-to-end check.cjs & watch.cjs in an isolated temp workspace
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oncos-map-watch-'));
try {
  const mapsDir = path.join(tmp, 'maps'), dataDir = path.join(tmp, 'data'), mDir = path.join(mapsDir, 'demo');
  fs.mkdirSync(mDir, {recursive: true});
  fs.mkdirSync(dataDir, {recursive: true});
  for (const f of ['outline.js', 'check.cjs', 'watch.cjs']) {
    fs.copyFileSync(path.join(__dirname, f), path.join(mapsDir, f));
  }
  const mapTxt = [
    '# Demo map',
    '# Rows reviewed: ' + 'a'.repeat(40) + ' (2026-11-20)',
    'map: Demo',
    'source: NCCN {url https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419} {ver 2.2026}',
    'source: ESMO {url https://www.esmo.org/guidelines/living-guidelines/demo} {ver v1.2}',
    'tree: Demo disease',
    '  First line',
    '    ① Standard regimen 〔NCCN 1〕 〔ESMO I, A〕',
    '      + ALPHA {pmid 10000001}',
    '      ~ BETA {pmid 10000002}',
    '      + GAMMA {pmid 10000003}',
    '      + DELTA {pmid 10000004}',
    '      ~ EPSILON {pmid 10000005}',
    '      + WAITING {pmid 10000099}',
    'off:',
    '  OLD {pmid 10000006} | Superseded',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(mDir, 'map.txt'), mapTxt);
  fs.writeFileSync(path.join(mDir, 'excluded.txt'),
    '# Excluded\nEX-TRIAL | PMID 88888888 | 2026-11-01 | class C, negative | Negative trial\n');

  const beforeEv = {
    trials: [
      {anchor: 't-alpha', study: 'ALPHA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'Ⓐ Drug A vs Ⓑ Drug B', endpoint: 'OS', findings: '★ Improved OS.\n・OS: HR 0.75\n・Limits: Open-label.', refs: [{label: 'primary', text: 'Smith et al. NEJM 2024', pmid: '10000001'}]},
      {anchor: 't-beta', study: 'BETA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ Drug A vs ⓑ Drug B', endpoint: 'PFS', findings: '★ Improved PFS.\n・PFS: HR 0.60', refs: [{label: 'primary', text: 'Lee et al. Lancet 2024', pmid: '10000002'}]},
      {anchor: 't-gamma', study: 'GAMMA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Stage IV patients', arms: 'ⓐ A vs ⓑ B', endpoint: 'OS', findings: '★ Positive.\n・OS: HR 0.70', refs: [{label: 'primary', text: 'Kim et al. JCO 2024', pmid: '10000003'}]},
      {anchor: 't-old', study: 'OLD', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ X vs ⓑ Y', endpoint: 'OS', findings: '★ Old.', refs: [{label: 'primary', text: 'Old et al. JCO 2010', pmid: '10000006'}]},
    ]
  };
  const afterEv = {
    trials: [
      // ALPHA: purely cosmetic (Ⓐ->ⓐ, ・Limits->・Limitations) -> should be ignored!
      {anchor: 't-alpha', study: 'ALPHA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ Drug A vs ⓑ Drug B', endpoint: 'OS', findings: '★ Improved OS.\n・OS: HR 0.75\n・Limitations: Open-label.', refs: [{label: 'primary', text: 'Smith et al. NEJM 2024', pmid: '10000001'}]},
      // BETA: new OS update reference -> kind: reference, tier: action
      {anchor: 't-beta', study: 'BETA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ Drug A vs ⓑ Drug B', endpoint: 'PFS', findings: '★ Improved PFS and OS.\n・OS: HR 0.72', refs: [{label: 'primary', text: 'Lee et al. Lancet 2024', pmid: '10000002'}, {label: 'update', text: 'Lee et al. Ann Oncol 2026', pmid: '20000002'}]},
      // GAMMA: minor population wording edit only -> kind: fields, tier: check
      {anchor: 't-gamma', study: 'GAMMA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Stage IV untreated patients', arms: 'ⓐ A vs ⓑ B', endpoint: 'OS', findings: '★ Positive.\n・OS: HR 0.70', refs: [{label: 'primary', text: 'Kim et al. JCO 2024', pmid: '10000003'}]},
      // DELTA: filed since with ONLY the same PMID on the map -> kind: filed, tier: linked
      {anchor: 't-delta', study: 'DELTA', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ A vs ⓑ B', endpoint: 'OS', findings: '★ Positive.', refs: [{label: 'primary', text: 'Chen et al. NEJM 2025', pmid: '10000004'}]},
      // EPSILON: filed since AND already carries an extra newer PMID -> promoted to kind: reference, tier: action!
      {anchor: 't-epsilon', study: 'EPSILON', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ A vs ⓑ B', endpoint: 'PFS', findings: '★ Positive.', refs: [{label: 'primary', text: 'Park et al. Lancet 2025', pmid: '10000005'}, {label: 'update', text: 'Park et al. Ann Oncol 2026', pmid: '20000005'}]},
      {anchor: 't-old', study: 'OLD', sheet: 'Demo', type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ X vs ⓑ Y', endpoint: 'OS', findings: '★ Old.', refs: [{label: 'primary', text: 'Old et al. JCO 2010', pmid: '10000006'}]},
      // NEW-UNPLACED: unplaced row on sheet
      {anchor: 't-new', study: 'NEW-UNPLACED', sheet: 'Demo', subcat: 'First line', yearnum: 2026, type: 'Randomised phase III trial', population: 'Pop', arms: 'ⓐ A vs ⓑ B', endpoint: 'OS', findings: '★ New.', refs: [{label: 'primary', text: 'Ng et al. NEJM 2026', pmid: '30000001'}]},
    ],
    watch: {
      guidelines: {items: [
        {society: 'NCCN', track: 'nccn', title: 'NCCN Demo', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419', latest: '3.2026', sheets: ['Demo']},
        {society: 'ESMO', track: 'lead', title: 'ESMO Demo CPG', url: 'https://doi.org/10.1016/j.annonc.2026.99.999', latest: '2026', sheets: ['Demo']},
      ]},
      literature: {items: [{pmid: '88888888', title: 'EX-TRIAL final OS update', date: '2026-11-26'}]},
      congress: {items: []},
    }
  };
  const beforePath = path.join(tmp, 'before.json');
  fs.writeFileSync(beforePath, JSON.stringify(beforeEv));
  fs.writeFileSync(path.join(dataDir, 'evidence.json'), JSON.stringify(afterEv));

  // check.cjs --json
  const chk = cp.spawnSync(process.execPath, [path.join(mapsDir, 'check.cjs'), '--json'], {cwd: tmp, encoding: 'utf8'});
  const chkJson = JSON.parse(chk.stdout);
  assert.strictEqual(chkJson.ok, false); // 1 unplaced row, 0 header errors ({ver} accepted!)
  assert.strictEqual(chkJson.problems.length, 1);
  assert.strictEqual(chkJson.problems[0].kind, 'unplaced');
  assert.strictEqual(chkJson.maps.demo.intake_items.length, 1);
  assert.strictEqual(chkJson.maps.demo.intake_items[0].name, 'WAITING');
  assert.strictEqual(chkJson.maps.demo.unplaced_items.length, 1);
  assert.strictEqual(chkJson.maps.demo.unplaced_items[0].anchor, 't-new');
  assert.strictEqual(chkJson.maps.demo.sources[0].ver, '2.2026');

  // watch.cjs --json --against
  const wt = cp.spawnSync(process.execPath, [path.join(mapsDir, 'watch.cjs'), '--json', '--against', beforePath], {cwd: tmp, encoding: 'utf8'});
  assert.strictEqual(wt.status, 0, wt.stderr);
  const demo = JSON.parse(wt.stdout).maps.demo;
  assert.strictEqual(demo.error, null);
  const byAnchor = Object.fromEntries(demo.changes.map(c => [c.row.anchor, c]));
  assert(!byAnchor['t-alpha'], 'cosmetic-only change should be suppressed');
  assert.strictEqual(byAnchor['t-beta'].kind, 'reference');
  assert.strictEqual(byAnchor['t-beta'].tier, 'action');
  assert.strictEqual(byAnchor['t-gamma'].kind, 'fields');
  assert.strictEqual(byAnchor['t-gamma'].tier, 'check');
  assert.strictEqual(byAnchor['t-delta'].kind, 'filed');
  assert.strictEqual(byAnchor['t-delta'].tier, 'linked');
  assert.strictEqual(byAnchor['t-epsilon'].kind, 'reference');
  assert.strictEqual(byAnchor['t-epsilon'].tier, 'action');
  // Guidelines behind: NCCN 2.2026 -> 3.2026 matched; ESMO v1.2 NOT compared against year 2026!
  assert.strictEqual(demo.guidelines_behind.length, 1);
  assert.strictEqual(demo.guidelines_behind[0].source, 'NCCN');
  assert.strictEqual(demo.guidelines_behind[0].tagged_lines.length, 1);
  // Excluded Rule 9 hit
  assert.strictEqual(demo.excluded_count, 1);
  assert.strictEqual(demo.excluded_hits.length, 1);
  assert.strictEqual(demo.excluded_hits[0].trial, 'EX-TRIAL');

  // --snapshot creates reviewed.json so shallow runs (without --against and without git commit) work cleanly with 0 changes
  const snap = cp.spawnSync(process.execPath, [path.join(mapsDir, 'watch.cjs'), '--json', '--against', beforePath, '--snapshot'], {cwd: tmp, encoding: 'utf8'});
  assert.strictEqual(snap.status, 0, snap.stderr);
  assert(fs.existsSync(path.join(mDir, 'reviewed.json')));
  const wt2 = cp.spawnSync(process.execPath, [path.join(mapsDir, 'watch.cjs'), '--json'], {cwd: tmp, encoding: 'utf8'});
  assert.strictEqual(wt2.status, 0, wt2.stderr);
  const demo2 = JSON.parse(wt2.stdout).maps.demo;
  assert.strictEqual(demo2.error, null);
  assert.strictEqual(demo2.changes.length, 0);
  console.log('watch-test ok');
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}
