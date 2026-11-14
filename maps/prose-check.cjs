/* Prose check for the board maps: node maps/prose-check.cjs [map-id ...]
   Checks map text (not # comments, trial lines or off: reasons) against the written rules in the
   header of maps/early-nsclc/map.txt. It runs on every draft before it is shown, with check.cjs and render-check.cjs.
   Fails (exit 1) on:
   - an omission line: a statement that a guideline does not list, cover or mention something (Jonan 2026-11-13)
   - a meta line: a comment on our own reading, or a guideline as the subject of the sentence ("NCCN recommends")
   - a semicolon in map text (Jonan 2026-11-10)
   - second person (Jonan 2026-11-13, register)
   - a split option: two numbered lines in one step, band or panel that open with the same population or condition
     before the colon ("Good risk: BEP" and "Good risk: EP"). Options for one population are one numbered line,
     each regimen with its own tags (Jonan 2026-11-14, germ cell map)
   Lists for review (no failure): a ・ line that shares most of its words with a sibling or with its parent line,
   the usual sign of one point restated per guideline (Jonan 2026-11-11, 2026-11-13). */
'use strict';
const fs = require('fs'), path = require('path');
const G = '(?:ESMO|NCCN|EHA|ASCO|JSH|JLCS|BSH|PAGA|EBMT|ACCP|ASTRO|JGCA|JSCO|JSMO|CSCO|KSH|ESGO|EAU|AUA|NICE|ASTCT|LYSA|JSGO)';
const FAIL = [
  [new RegExp('\\bnot in (?:' + G + '|any guideline)', 'i'), 'omission line'],
  [/\b(?:is|are) not (?:listed|mentioned|addressed)\b|\b(?:is|are) not covered\b(?! by \w+ insurance)|\bnot addressed\b/i, 'omission line'],
  [new RegExp('\\b(?:neither|none)(?: of \\w+)? (?:is|are) (?:in|listed in) ' + G, 'i'), 'omission line'],
  [/\b(?:does|do) not (?:list|mention|cover|address)\b/i, 'omission line'],
  [new RegExp('\\bnot (?:addressed|listed|mentioned|covered|included|graded) (?:in|by) (?:the )?' + G, 'i'), 'omission line'],
  [new RegExp('\\bnot in (?:the )?' + G + ' (?:list|guideline)', 'i'), 'omission line'],
  [/\bin no guideline\b|\bno guideline (?:read )?(?:cites|lists|mentions|covers)\b|\bguidelines? read\b/i, 'meta line'],
  [new RegExp('\\b' + G + ' (?:recommends|suggests|lists|uses|prefers|states|says|notes|favours)\\b'), 'guideline as subject'],
  [/;/, 'semicolon'],
  [/\byou(?:r|rs)?\b/i, 'second person'],
];
const STOP = new Set('a an the and or of in on at to for with without by after before is are be as from than then it its this that when where only also which over under no not'.split(' '));
const words = s => new Set(s.replace(/〔[^〕]*〕/g, ' ').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').split(' ').filter(w => w && !STOP.has(w)));
const overlap = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return n / Math.min(a.size, b.size); };
const want = process.argv.slice(2);
let bad = 0, review = 0;
for (const dir of fs.readdirSync(__dirname).sort()) {
  const f = path.join(__dirname, dir, 'map.txt');
  if (!fs.existsSync(f) || (want.length && !want.includes(dir))) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  let inOff = false, block = '', conds = {}; const stack = [];
  lines.forEach((t, k) => {
    if (/^\S/.test(t)) inOff = /^off:/.test(t);
    if (inOff || /^\s*#/.test(t) || !t.trim() || /^\s*[+~*-]\s/.test(t) || /^\s*(?:next|join|branch|source|scale):/.test(t)) return;
    const at = dir + '/map.txt:' + (k + 1) + ' ';
    if (!/^\s*[・①-⑳※°|]/.test(t)) { block = t.trim(); conds = {}; }
    const num = t.trim().match(/^[①-⑳]\s*([^:〔]{2,60}):/);
    if (num) {
      const c = num[1].trim().toLowerCase();
      if (conds[c] !== undefined) { bad++; console.log(at + 'split option, same population as line ' + (conds[c] + 1) + ' ("' + num[1].trim() + '"): merge into one numbered line'); }
      else conds[c] = k;
    }
    for (const [re, why] of FAIL) if (re.test(t)) { bad++; console.log(at + why + ': "' + t.trim().slice(0, 90) + '"'); }
    const ind = t.search(/\S/), text = t.trim();
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    const node = { ind, text, k, w: words(text.replace(/^[・①-⑳※°]\s*/, '')), kids: [] };
    if (/^・/.test(text) && stack.length) {
      const parent = stack[stack.length - 1];
      if (overlap(node.w, parent.w) >= 0.8 && node.w.size >= 4) { review++; console.log(at + 'review, restates its parent line ' + (parent.k + 1) + ': "' + text.slice(0, 80) + '"'); }
      for (const sib of parent.kids) if (overlap(node.w, sib.w) >= 0.8 && Math.min(node.w.size, sib.w.size) >= 4) { review++; console.log(at + 'review, restates line ' + (sib.k + 1) + ': "' + text.slice(0, 80) + '"'); }
      parent.kids.push(node);
    }
    stack.push(node);
  });
}
console.log(bad ? bad + ' prose failure(s), ' + review + ' line(s) to review' : 'prose check passed, ' + review + ' line(s) to review');
process.exit(bad ? 1 : 0);
