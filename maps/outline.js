/* oncOS board maps: the outline format (maps/<id>/map.txt).
   Shared by the page (window.oncosOutline) and the release check (require).
   The format is described at the top of each map.txt. */
(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.oncosOutline = api;
})(typeof self !== 'undefined' ? self : this, function(){
  var NUM = /^[①-⑳]/;              // ① to ⑳
  // Trial [t-...] {pmid N} {url https://...} : a trial with no PubMed record yet (a congress abstract) gives a link.
  // Maps show trial names only; results are on the trial's card (Jonan 2026-11-11). An old "| fig" is read and not drawn.
  var TRIAL = /^([+~\-*])\s+(.+?)\s*(?:\[(t-[^\]\s]+)\])?\s*(?:\{pmid\s+(\d+)\})?\s*(?:\{url\s+(https:\/\/[^\s}]+)\})?\s*(?:\|\s*(.+))?$/;
  var CLS = {'+':'os', '~':'sur', '-':'neg', '*':'none'};
  // branch hues, in the order a map without named hues takes them; map.css holds a fill and a pale tint for each
  var HUES = ['blue', 'violet', 'sage', 'rose', 'sand', 'teal', 'apricot', 'olive'];
  // 〔ESGO II, A〕 at the end of a statement: it rests on the guideline declared by "source: ESGO [t-...]".
  // A bare 〔ESGO〕 names the guideline on a sub-line where its grade sits on the line above (Jonan 2026-11-13)
  var TAG = /〔([^\s〕]+)(?:\s+([^〕]+))?〕/g;
  // "band: Title | flow" draws its flow lines as a flowchart, top down (Jonan 2026-11-20, WHO diagnosis of glioma):
  //   ? Question or step        a box; the lines indented under it are its branches, left to right
  //   ‹Branch› ? Question        a branch: the label on the line into the box
  //   ‹Branch› ■ Diagnosis | KEY a final box, filled with the hue of branch: KEY when one is named
  //   ‹Branch› see: Diagnosis    a second line into a final box drawn elsewhere in the same chart
  // Other lines of the band (※, ・) sit under the chart as usual
  var FLOW = /^(?:‹([^›]+)›\s*)?(\?|■|see:)\s*(.+)$/;
  function bare(t){ return String(t).replace(TAG, '').replace(/\s+/g, ' ').trim(); }

  function slug(name){
    return 't-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function line(text, level, at){
    var m = TRIAL.exec(text);
    if (m) return {kind:'trial', level:level, cls:CLS[m[1]], name:m[2], anchor:m[3] || (m[4] || m[5] ? null : slug(m[2])),
                   pmid:m[4] || null, url:m[5] || null, fig:m[6] || '', at:at};
    var c = text.charAt(0);
    if (c === '|') return {kind:'grid', level:level, cells:text.replace(/^\|\s*|\s*\|$/g, '').split(/\s*\|\s*/), at:at};
    if (c === '=') return {kind:'tx', level:level, text:text.replace(/^=\s*/, ''), at:at};
    if (c === '※') return {kind:'cv', level:level, text:text.replace(/^※\s*/, ''), at:at};
    if (c === '°') return {kind:'se', level:level, text:text.replace(/^°\s*/, ''), at:at};
    // ・ one statement under the line above it, e.g. one guideline's position on an option
    if (c === '・') return {kind:'sub', level:level, text:text.replace(/^・\s*/, ''), at:at};
    if (NUM.test(text)) return {kind:'num', level:level, n:text.charAt(0), text:text.slice(1).trim(), at:at};
    return {kind:'text', level:level, text:text, at:at};
  }
  function isContent(text){ return /^[=+~\-*※°]\s/.test(text) || /^[=※°|・]/.test(text) || NUM.test(text) || TRIAL.test(text); }

  function parse(src){
    var out = {map:null, bands:[], tree:null, panels:[], off:[], sources:{}, branches:[], errors:[]};
    var BR = /^branch:\s*(.+)$/;
    var setBranch = function(o, v, at){ var m = /^(.+?)(\s+pale)?$/.exec(v.trim()); o.branch = m[1]; o.pale = !!m[2]; o.branchAt = at; };
    var sec = null, stack = null;
    String(src).split(/\r?\n/).forEach(function(raw, i){
      var at = i + 1;
      if (/^\s*(#|$)/.test(raw)) return;
      var ind = raw.match(/^ */)[0].length, text = raw.trim();
      if (ind === 0) {
        var h = /^(map|source|scale|branch|band|tree|course|panel|off):\s*(.*)$/.exec(text);
        if (!h) { out.errors.push(at + ': expected map:, source:, scale:, branch:, band:, tree:, course:, panel: or off:'); sec = null; return; }
        if (h[1] === 'map') { out.map = h[2]; sec = null; return; }
        // branch: Key | legend | hue  one colour for a branch of the map, such as one MMR status (Jonan 2026-11-11);
        // the hue is one of HUES, and without one the branch takes the next unused hue. A step or node takes it
        // with "branch: Key" under it, or its paler tint with "branch: Key pale"; a node's children inherit it
        if (h[1] === 'branch') {
          var bm = /^(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(\w+))?$/.exec(h[2]);
          if (!bm) { out.errors.push(at + ': branch: lines are "Key | legend" or "Key | legend | hue"'); sec = null; return; }
          var hn = bm[3] ? HUES.indexOf(bm[3]) + 1 : 0;
          if (bm[3] && !hn) out.errors.push(at + ': branch: hue "' + bm[3] + '" is not one of ' + HUES.join(', '));
          out.branches.push({key:bm[1], label:bm[2], hue:hn, at:at});
          sec = null; return;
        }
        // scale: the four risk groups of an adjuvant or local-treatment decision, lowest first
        if (h[1] === 'scale') { out.scale = h[2].split('|').map(function(x){ return x.trim(); }).filter(Boolean); out.scaleAt = at; sec = null; return; }
        if (h[1] === 'source') {
          // a guideline with an Evidence row: "ESGO [t-...]"; one held only as a link: "ESMO {url https://...}"
          var sm = /^(\S+)\s+(?:\[(t-[^\]\s]+)\]|\{url\s+(https:\/\/[^\s}]+)\})$/.exec(h[2]);
          if (!sm) out.errors.push(at + ': source: lines are "Name [t-...]" or "Name {url https://...}"');
          else out.sources[sm[1]] = {name:sm[1], anchor:sm[2] || null, url:sm[3] || null, at:at};
          sec = null; return;
        }
        if (h[1] === 'off') { sec = out.off; return; }
        if (h[1] === 'band') {
          var fl = /\s*\|\s*flow\s*$/.test(h[2]);
          sec = {title:h[2].replace(/\s*\|\s*flow\s*$/, ''), lines:[], flow:fl, at:at}; out.bands.push(sec); return;
        }
        if (h[1] === 'panel') {
          var j = h[2].split(/\s+>\s+/);
          sec = {title:j[0], join:j[1] || null, lines:[]}; out.panels.push(sec); return;
        }
        if (out.tree) out.errors.push(at + ': only one tree: or course: per map');
        // "course: Title | parallel": the first steps are parallel presentations; canvas.js then sets every later step
        // level with the steps that lead to it (opt-in, so maps laid out before 2026-11-14 keep their layout)
        var par = h[1] === 'course' && /\s*\|\s*parallel\s*$/.test(h[2]); if (par) h[2] = h[2].replace(/\s*\|\s*parallel\s*$/, '');
        sec = out.tree = {label:h[2], depth:0, children:[], lines:[], indent:0, at:at, course:h[1] === 'course', parallel:par};
        stack = [sec];
        return;
      }
      if (!sec) { out.errors.push(at + ': line outside a section'); return; }
      if (ind % 2) out.errors.push(at + ': indent by 2 spaces');
      if (sec === out.off) {             // off: Evidence rows left off the map on purpose, with the reason
        var o = /^(.+?)\s*(?:\[(t-[^\]\s]+)\])?\s*\|\s*(.+)$/.exec(text);
        if (!o) { out.errors.push(at + ': off: lines are "Trial | reason"'); return; }
        out.off.push({name:o[1], anchor:o[2] || slug(o[1]), reason:o[3], at:at});
        return;
      }
      if (sec !== out.tree) {            // band or panel: every line is content
        // a panel's "next: Panel | label" draws a line from it to another panel
        var pn = sec.join !== undefined && /^next:\s*(.+?)\s*(?:\|\s*(.+))?$/.exec(text);
        if (pn) { (sec.next = sec.next || []).push({to:pn[1], label:pn[2] || '', at:at}); return; }
        var fm = sec.flow && FLOW.exec(text);
        if (fm) {
          var fk = null, ft = fm[3], km = fm[2] === '■' && /^(.*?)\s*\|\s*([A-Za-z0-9_-]+)$/.exec(ft);
          if (km) { ft = km[1]; fk = km[2]; }
          sec.lines.push({kind:'flow', level:ind / 2 - 1, edge:fm[1] ? fm[1].trim() : '', mark:fm[2] === '?' ? 'q' : fm[2] === '■' ? 'dx' : 'ref', text:ft, key:fk, at:at});
          return;
        }
        sec.lines.push(line(text, ind / 2 - 1, at));
        return;
      }
      if (out.tree.course) {             // course: steps at 2 spaces; next: and content under them
        if (ind === 2) {
          if (/^(next|join):/.test(text)) { out.errors.push(at + ': next: and join: belong under a step'); return; }
          var st = {label:text, depth:1, children:[], lines:[], next:[], indent:2, at:at};
          out.tree.children.push(st); stack = [out.tree, st];
          return;
        }
        var step = stack[1];
        if (!step) { out.errors.push(at + ': content before the first step'); return; }
        // join: draws the same line as next:, but the two steps stay in separate branches
        var sb = BR.exec(text);
        if (sb && ind === 4) { setBranch(step, sb[1], at); return; }
        var nx = /^(next|join):\s*(.+?)\s*(?:\|\s*(.+))?$/.exec(text);
        if (nx) { step.next.push({to:nx[2], label:nx[3] || '', join:nx[1] === 'join', at:at}); return; }
        step.lines.push(line(text, ind / 2 - 2, at));
        return;
      }
      while (stack.length > 1 && stack[stack.length - 1].indent >= ind) stack.pop();
      var owner = stack[stack.length - 1];
      var nb = BR.exec(text);
      if (nb) { setBranch(owner, nb[1], at); return; }
      if (isContent(text)) {
        owner.lines.push(line(text, Math.max(0, (ind - owner.indent) / 2 - 1), at));
        return;
      }
      if (owner.lines.length) out.errors.push(at + ': node "' + text + '" follows content of "' + owner.label + '"');
      var node = {label:text, depth:owner.depth + 1, children:[], lines:[], indent:ind, at:at};
      owner.children.push(node); stack.push(node);
    });
    if (!out.tree) out.errors.push('no tree: or course:');
    var names = {};
    walk(out.tree, function(n){ (names[n.label] = names[n.label] || []).push(n); });
    if (out.tree && out.tree.course) {
      var seen = {}, busy = {};
      out.tree.children.forEach(function(st){ st.next.forEach(function(e){
        if (!names[e.to]) out.errors.push(e.at + ': next: no step "' + e.to + '"');
        else if (names[e.to].length > 1) out.errors.push(e.at + ': next: step "' + e.to + '" is not unique');
      }); });
      (function loop(){
        function visit(st){
          if (busy[st.label]) { out.errors.push(st.at + ': next: steps loop back to "' + st.label + '"'); return; }
          if (seen[st.label]) return;
          seen[st.label] = busy[st.label] = true;
          st.next.forEach(function(e){ var t = names[e.to]; if (t && t.length === 1) visit(t[0]); });
          busy[st.label] = false;
        }
        out.tree.children.forEach(visit);
      })();
    }
    tags(out).forEach(function(t){
      if (!out.sources[t.source]) out.errors.push(t.at + ': 〔' + t.source + ' …〕 has no source: line');
    });
    out.panels.forEach(function(p){
      (p.next || []).forEach(function(e){
        if (!out.panels.some(function(q){ return q.title === e.to; })) out.errors.push(e.at + ': next: no panel "' + e.to + '"');
      });
      if (p.join && !names[p.join]) out.errors.push('panel "' + p.title + '": no node "' + p.join + '"');
      else if (p.join && names[p.join].length > 1) out.errors.push('panel "' + p.title + '": node "' + p.join + '" is not unique');
    });
    var bkeys = {}, used = {};
    out.branches.forEach(function(b){ if (b.hue) { if (used[b.hue]) out.errors.push(b.at + ': hue "' + HUES[b.hue - 1] + '" is used twice'); used[b.hue] = true; } });
    out.branches.forEach(function(b){
      if (!b.hue) { for (var i = 1; i <= HUES.length; i++) if (!used[i]) { b.hue = i; used[i] = true; break; } }
      b.n = b.hue; bkeys[b.key] = b.hue;
    });
    if (out.branches.length > HUES.length) out.errors.push(out.branches[HUES.length].at + ': at most ' + HUES.length + ' branch: colours');
    out.bands.forEach(function(b){
      if (!b.flow) return;
      var fl = b.lines.filter(function(l){ return l.kind === 'flow'; }), dx = {}, prev = null;
      if (!fl.length) { out.errors.push(b.at + ': a flow band has no ? or ■ lines'); return; }
      fl.forEach(function(l, i){
        if (l.mark === 'dx') { var k = bare(l.text); if (dx[k]) out.errors.push(l.at + ': final box "' + k + '" is drawn twice'); dx[k] = l; }
        if (l.key) { if (!bkeys[l.key]) out.errors.push(l.at + ': branch: no "' + l.key + '" declared'); else l.br = bkeys[l.key]; }
        if (i === 0) { if (l.level !== 0 || l.edge || l.mark !== 'q') out.errors.push(l.at + ': a flowchart opens with one "? " box at the first indent'); }
        else {
          if (l.level === 0) out.errors.push(l.at + ': a flowchart has one first box');
          if (!l.edge) out.errors.push(l.at + ': a branch needs its label, as ‹Label›');
          if (l.level > prev.level + 1) out.errors.push(l.at + ': indent by one step under the box above');
          if (l.level > prev.level && prev.mark !== 'q') out.errors.push(l.at + ': only a "? " box has branches');
        }
        var nx = fl[i + 1];
        if (l.mark === 'q' && !(nx && nx.level > l.level)) out.errors.push(l.at + ': a "? " box needs branches under it');
        prev = l;
      });
      fl.forEach(function(l){ if (l.mark === 'ref' && !dx[bare(l.text)]) out.errors.push(l.at + ': see: no final box "' + bare(l.text) + '"'); });
    });
    (function inherit(n, k, pale){
      if (!n) return;
      if (n.branch && !bkeys[n.branch]) out.errors.push(n.branchAt + ': branch: no "' + n.branch + '" declared');
      var own = !!n.branch, course = out.tree && out.tree.course;
      n.br = own ? bkeys[n.branch] || 0 : (course ? 0 : k);
      n.pale = own ? !!n.pale : (course ? false : pale);
      n.children.forEach(function(c){ inherit(c, n.br, n.pale); });
    })(out.tree, 0, false);
    // colour means one thing on a box: a step, node or band that carries the risk ramp (a grid, or a line
    // that opens with a risk group) stays plain grey; branch colours go on the other boxes (Jonan 2026-11-11)
    if (out.scale && out.branches.length) {
      var risky = function(ls){ return ls.some(function(l){
        if (l.kind === 'grid') return true;
        var t = String(l.text || '');
        return (l.kind === 'num' || l.kind === 'cv') && out.scale.some(function(x){ return t.indexOf(x + ' risk') === 0; });
      }); };
      walk(out.tree, function(n){ if (n.br && risky(n.lines || [])) out.errors.push((n.branchAt || n.at) + ': "' + n.label + '" carries the risk colours and stays grey, no branch:'); });
    }
    // a panel takes the pale tint of the step or node it is joined to
    out.panels.forEach(function(p){
      p.br = 0; p.pale = true;
      if (p.join) walk(out.tree, function(n){ if (n.label === p.join && n.br) p.br = n.br; });
    });
    if (out.scale) {
      if (out.scale.length !== 4) out.errors.push(out.scaleAt + ': scale: names four risk groups, lowest first');
      var rowNames = {};
      var grid = function(l){ if (l.kind === 'grid') rowNames[l.cells[0]] = true; };
      out.bands.forEach(function(b){ b.lines.forEach(grid); });
      walk(out.tree, function(n){ n.lines.forEach(grid); });
      out.panels.forEach(function(p){ p.lines.forEach(grid); });
      out.scale.forEach(function(x){ if (!rowNames[x]) out.errors.push(out.scaleAt + ': risk group "' + x + '" names no grid row'); });
    }
    return out;
  }
  function walk(n, f){ if (!n) return; f(n); n.children.forEach(function(c){ walk(c, f); }); }
  function trials(model){
    var all = [];
    var add = function(where){ return function(l){ if (l.kind === 'trial') all.push({line:l, where:where}); }; };
    model.bands.forEach(function(b){ b.lines.forEach(add(b.title)); });
    walk(model.tree, function(n){ n.lines.forEach(add(n.label)); });
    model.panels.forEach(function(p){ p.lines.forEach(add(p.title)); });
    return all;
  }
  // every 〔Source level, grade〕 tag on the map, with the line it sits on
  function tags(model){
    var all = [];
    function scan(text, at){ String(text || '').replace(TAG, function(m, src, grade){ all.push({source:src, grade:grade, at:at}); return m; }); }
    function lines(ls){ ls.forEach(function(l){ scan(l.text || l.fig, l.at); scan(l.edge, l.at); (l.cells || []).forEach(function(c){ scan(c, l.at); }); }); }
    model.bands.forEach(function(b){ lines(b.lines); });
    walk(model.tree, function(n){ scan(n.label, n.at); lines(n.lines); });
    model.panels.forEach(function(p){ lines(p.lines); });
    return all;
  }
  /* Live figures. A figure with no digits names what to read from the Evidence row:
       "OS HR"        HR on the row's findings line labelled OS        renders "OS HR 0.80"
       "PFS median"   the ⓐ vs ⓑ medians on the PFS line              renders "PFS 11.4 vs 6.7 months"
       "Response"     first percentage on the ORR (or cORR) line       renders "Response 72%"
     A label matches the line whose label is that word, or starts with it then a space, comma or bracket.
     A figure with digits is shown as written and checked against the row. */
  var LIVE = /^(?:(.+?)\s+)?(HR|median|[Rr]esponse)$/;
  function live(fig){
    if (/\d/.test(fig)) return null;
    var m = LIVE.exec(String(fig).trim());
    return m ? {label:m[1] || '', kind:m[2].toLowerCase() === 'response' ? 'response' : m[2]} : null;
  }
  function findingsLine(row, label){
    var lines = String(row && row.findings || '').replace(/·/g, '.').split('\n'), L = label.toLowerCase();
    for (var i = 0; i < lines.length; i++) {
      var m = /^・([^:]+):\s*(.*)$/.exec(lines[i]);
      if (!m) continue;
      var lab = m[1].trim().toLowerCase();
      if (L ? (lab === L || /^[ ,(]/.test(lab.slice(L.length)) && lab.indexOf(L) === 0) : /^c?orr\b/.test(lab)) return m[2];
    }
    return null;
  }
  function figure(fig, row){
    var spec = live(fig);
    if (!spec) return {text:fig, live:false, ok:true};
    var t = findingsLine(row, spec.label), m;
    if (t !== null) {
      if (spec.kind === 'HR' && (m = /\bHR\b[^\d;]{0,20}?(\d+(?:\.\d+)?)/.exec(t)))
        return {text:spec.label + ' HR ' + m[1], live:true, ok:true};
      if (spec.kind === 'median' && (m = /(?:ⓐ\s*)?(?:median\s+)?(\d+(?:\.\d+)?|NR|NE|not reached)\s+vs\s+(?:ⓑ\s*)?(\d+(?:\.\d+)?|NR|NE|not reached)\s*mo/i.exec(t)))
        return {text:spec.label + ' ' + m[1] + ' vs ' + m[2] + ' months', live:true, ok:true};
      if (spec.kind === 'response' && (m = /(\d+(?:\.\d+)?)%/.exec(t)))
        return {text:'Response ' + m[1] + '%', live:true, ok:true};
    }
    return {text:'', live:true, ok:false};
  }
  // A trial given by {pmid N} links itself to the one Evidence row that cites that PMID (a reference's
  // pmid or the row's PubMed link), so filing and publishing the paper links the map with no map edit
  // (Jonan 2026-11-15). rows: anchor -> row. A paper filed on two sheets links to the row on the map's own sheet.
  // Returns {pmid: [anchors]} for every PMID still on more than one row;
  // a trial with such a PMID keeps its PubMed link until it is given its [t-...] anchor.
  function pmids(row){
    var out = [];
    (row.refs || []).forEach(function(r){ if (r && r.pmid) out.push(String(r.pmid)); });
    var m = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/.exec(row.link || '');
    if (m) out.push(m[1]);
    return out;
  }
  function link(model, rows){
    var by = {}, many = {};
    Object.keys(rows || {}).forEach(function(a){
      pmids(rows[a]).forEach(function(p){ (by[p] = by[p] || []).indexOf(a) < 0 && by[p].push(a); });
    });
    trials(model).forEach(function(t){
      var l = t.line;
      if (!l.pmid || l.anchor) return;
      var hit = by[l.pmid] || [];
      // one paper filed on two sheets: the row on this map's own sheet
      if (hit.length > 1) {
        var own = hit.filter(function(a){ return rows[a].sheet === model.map; });
        if (own.length === 1) hit = own;
      }
      if (hit.length === 1) l.anchor = hit[0];
      else if (hit.length > 1) many[l.pmid] = hit;
    });
    return many;
  }
  // Fill live figures from the Evidence rows (anchor -> row). Returns the lines that did not resolve.
  function figures(model, rows){
    var miss = [];
    trials(model).forEach(function(t){
      var l = t.line;
      if (l.src === undefined) l.src = l.fig;
      if (!live(l.src)) return;
      var f = figure(l.src, rows && rows[l.anchor]);
      l.fig = f.text;
      if (!f.ok) miss.push(t);
    });
    return miss;
  }
  return {FLOW:FLOW, bare:bare, parse:parse, walk:walk, trials:trials, tags:tags, TAG:TAG, slug:slug, live:live, figure:figure, figures:figures, link:link, pmids:pmids};
});
