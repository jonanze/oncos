/* oncOS board maps: the outline format (maps/<id>/map.txt).
   Shared by the page (window.oncosOutline) and the release check (require).
   The format is described at the top of each map.txt. */
(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.oncosOutline = api;
})(typeof self !== 'undefined' ? self : this, function(){
  var NUM = /^[①-⑳]/;              // ① to ⑳
  var TRIAL = /^([+~\-*])\s+(.+?)\s*(?:\[(t-[^\]\s]+)\])?\s*(?:\{pmid\s+(\d+)\})?\s*\|\s*(.+)$/;
  var CLS = {'+':'os', '~':'sur', '-':'neg', '*':'none'};
  // 〔ESGO II, A〕 at the end of a statement: it rests on the guideline declared by "source: ESGO [t-...]"
  var TAG = /〔([^\s〕]+)\s+([^〕]+)〕/g;

  function slug(name){
    return 't-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function line(text, level, at){
    var m = TRIAL.exec(text);
    if (m) return {kind:'trial', level:level, cls:CLS[m[1]], name:m[2], anchor:m[3] || (m[4] ? null : slug(m[2])),
                   pmid:m[4] || null, fig:m[5], at:at};
    var c = text.charAt(0);
    if (c === '|') return {kind:'grid', level:level, cells:text.replace(/^\|\s*|\s*\|$/g, '').split(/\s*\|\s*/), at:at};
    if (c === '=') return {kind:'tx', level:level, text:text.replace(/^=\s*/, ''), at:at};
    if (c === '※') return {kind:'cv', level:level, text:text.replace(/^※\s*/, ''), at:at};
    if (c === '°') return {kind:'se', level:level, text:text.replace(/^°\s*/, ''), at:at};
    if (NUM.test(text)) return {kind:'num', level:level, n:text.charAt(0), text:text.slice(1).trim(), at:at};
    return {kind:'text', level:level, text:text, at:at};
  }
  function isContent(text){ return /^[=+~\-*※°]\s/.test(text) || /^[=※°|]/.test(text) || NUM.test(text) || TRIAL.test(text); }

  function parse(src){
    var out = {map:null, bands:[], tree:null, panels:[], off:[], sources:{}, errors:[]};
    var sec = null, stack = null;
    String(src).split(/\r?\n/).forEach(function(raw, i){
      var at = i + 1;
      if (/^\s*(#|$)/.test(raw)) return;
      var ind = raw.match(/^ */)[0].length, text = raw.trim();
      if (ind === 0) {
        var h = /^(map|source|band|tree|course|panel|off):\s*(.*)$/.exec(text);
        if (!h) { out.errors.push(at + ': expected map:, source:, band:, tree:, course:, panel: or off:'); sec = null; return; }
        if (h[1] === 'map') { out.map = h[2]; sec = null; return; }
        if (h[1] === 'source') {
          var sm = /^(\S+)\s+\[(t-[^\]\s]+)\]$/.exec(h[2]);
          if (!sm) out.errors.push(at + ': source: lines are "Name [t-...]"');
          else out.sources[sm[1]] = {name:sm[1], anchor:sm[2], at:at};
          sec = null; return;
        }
        if (h[1] === 'off') { sec = out.off; return; }
        if (h[1] === 'band') { sec = {title:h[2], lines:[]}; out.bands.push(sec); return; }
        if (h[1] === 'panel') {
          var j = h[2].split(/\s+>\s+/);
          sec = {title:j[0], join:j[1] || null, lines:[]}; out.panels.push(sec); return;
        }
        if (out.tree) out.errors.push(at + ': only one tree: or course: per map');
        sec = out.tree = {label:h[2], depth:0, children:[], lines:[], indent:0, at:at, course:h[1] === 'course'};
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
        sec.lines.push(line(text, ind / 2 - 1, at));
        return;
      }
      if (out.tree.course) {             // course: steps at 2 spaces; next: and content under them
        if (ind === 2) {
          if (/^next:/.test(text)) { out.errors.push(at + ': next: belongs under a step'); return; }
          var st = {label:text, depth:1, children:[], lines:[], next:[], indent:2, at:at};
          out.tree.children.push(st); stack = [out.tree, st];
          return;
        }
        var step = stack[1];
        if (!step) { out.errors.push(at + ': content before the first step'); return; }
        var nx = /^next:\s*(.+?)\s*(?:\|\s*(.+))?$/.exec(text);
        if (nx) { step.next.push({to:nx[1], label:nx[2] || '', at:at}); return; }
        step.lines.push(line(text, ind / 2 - 2, at));
        return;
      }
      while (stack.length > 1 && stack[stack.length - 1].indent >= ind) stack.pop();
      var owner = stack[stack.length - 1];
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
      if (p.join && !names[p.join]) out.errors.push('panel "' + p.title + '": no node "' + p.join + '"');
      else if (p.join && names[p.join].length > 1) out.errors.push('panel "' + p.title + '": node "' + p.join + '" is not unique');
    });
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
    function lines(ls){ ls.forEach(function(l){ scan(l.text || l.fig, l.at); (l.cells || []).forEach(function(c){ scan(c, l.at); }); }); }
    model.bands.forEach(function(b){ lines(b.lines); });
    walk(model.tree, function(n){ scan(n.label, n.at); lines(n.lines); });
    model.panels.forEach(function(p){ lines(p.lines); });
    return all;
  }
  /* Live figures. A figure with no digits names what to read from the Evidence row:
       "OS HR"        HR on the row's findings line labelled OS        renders "OS HR 0.80"
       "PFS median"   the ⓐ vs ⓑ medians on the PFS line              renders "PFS 11.4 vs 6.7 months"
       "response"     first percentage on the ORR (or cORR) line       renders "response 72%"
     A label matches the line whose label is that word, or starts with it then a space, comma or bracket.
     A figure with digits is shown as written and checked against the row. */
  var LIVE = /^(?:(.+?)\s+)?(HR|median|response)$/;
  function live(fig){
    if (/\d/.test(fig)) return null;
    var m = LIVE.exec(String(fig).trim());
    return m ? {label:m[1] || '', kind:m[2]} : null;
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
        return {text:'response ' + m[1] + '%', live:true, ok:true};
    }
    return {text:'', live:true, ok:false};
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
  return {parse:parse, walk:walk, trials:trials, tags:tags, TAG:TAG, slug:slug, live:live, figure:figure, figures:figures};
});
