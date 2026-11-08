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

  function slug(name){
    return 't-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function line(text, level, at){
    var m = TRIAL.exec(text);
    if (m) return {kind:'trial', level:level, cls:CLS[m[1]], name:m[2], anchor:m[3] || (m[4] ? null : slug(m[2])),
                   pmid:m[4] || null, fig:m[5], at:at};
    var c = text.charAt(0);
    if (c === '=') return {kind:'tx', level:level, text:text.replace(/^=\s*/, ''), at:at};
    if (c === '※') return {kind:'cv', level:level, text:text.replace(/^※\s*/, ''), at:at};
    if (c === '°') return {kind:'se', level:level, text:text.replace(/^°\s*/, ''), at:at};
    if (NUM.test(text)) return {kind:'num', level:level, n:text.charAt(0), text:text.slice(1).trim(), at:at};
    return {kind:'text', level:level, text:text, at:at};
  }
  function isContent(text){ return /^[=+~\-*※°]\s/.test(text) || /^[=※°]/.test(text) || NUM.test(text) || TRIAL.test(text); }

  function parse(src){
    var out = {map:null, bands:[], tree:null, panels:[], errors:[]};
    var sec = null, stack = null;
    String(src).split(/\r?\n/).forEach(function(raw, i){
      var at = i + 1;
      if (/^\s*(#|$)/.test(raw)) return;
      var ind = raw.match(/^ */)[0].length, text = raw.trim();
      if (ind === 0) {
        var h = /^(map|band|tree|panel):\s*(.*)$/.exec(text);
        if (!h) { out.errors.push(at + ': expected map:, band:, tree: or panel:'); sec = null; return; }
        if (h[1] === 'map') { out.map = h[2]; sec = null; return; }
        if (h[1] === 'band') { sec = {title:h[2], lines:[]}; out.bands.push(sec); return; }
        if (h[1] === 'panel') {
          var j = h[2].split(/\s+>\s+/);
          sec = {title:j[0], join:j[1] || null, lines:[]}; out.panels.push(sec); return;
        }
        if (out.tree) out.errors.push(at + ': only one tree: per map');
        sec = out.tree = {label:h[2], depth:0, children:[], lines:[], indent:0, at:at};
        stack = [sec];
        return;
      }
      if (!sec) { out.errors.push(at + ': line outside a section'); return; }
      if (ind % 2) out.errors.push(at + ': indent by 2 spaces');
      if (sec !== out.tree) {            // band or panel: every line is content
        sec.lines.push(line(text, ind / 2 - 1, at));
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
    if (!out.tree) out.errors.push('no tree:');
    var names = {};
    walk(out.tree, function(n){ (names[n.label] = names[n.label] || []).push(n); });
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
  return {parse:parse, walk:walk, trials:trials, slug:slug};
});
