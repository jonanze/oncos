/* oncOS board maps: draws an outline (maps/outline.js) as a pan and zoom canvas.
   Layout is computed, never placed by hand:
   - one column per tree level, every label in a column one width
   - siblings at even centre spacing, each parent centred on its first and last child
   - leaf text in one column to the right of the deepest labels
   - bands above the tree; panels beside the tree, joined by a brace to their node
   A course: map is drawn in time order instead:
   - each step one column right of the latest step that leads to it; a step nothing leads to
     sits one column before the step it leads to
   - a step sits level with the steps that lead to it, pushed down to clear the step above;
     a step a few pixels above the one step it leads to moves down to meet it, so the line runs straight
   - steps joined by lines form a branch; separate branches are drawn one below the other with a wider gap
   - next: lines are drawn as ruled elbows; a straight one is the spine, drawn heavier; its label sits in a ruled cell
     centred along its run of the line
   - join: lines to one step with one label share an upright and carry the label once, on it;
     join: lines from steps that lead to several steps share one upright beside those steps
   - a line that passes a column runs clear of the steps in it: its step moves down below them and
     below the lines into them, so no line runs under a step or crosses another (Jonan 2026-11-11)
   - a join: line that would run under a step on its way in takes a lane past that step
   - after layout every line label is centred on the line as drawn, between the nearest box edges
     or junctions, on both axes; node maps/render-check.cjs fails on any label off its line
   - a panel sits below its step's column
   - a step, band or panel holding a grid ("| a | b |" lines) widens to fit the grid's columns
   window.oncosCanvas.render(host, model, opts) returns {fit, resize, destroy}. */
(function(){
  var GX = 44, GY = 16, LEAF_W = 506, PANEL_W = 440, BAND_W = 520, M = 28;
  var STEP_W = 380, CGX = 170, CGY = 36, BGY = 96, STUB = 28, GRID_COL = 176;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  // Hyphenated terms and ranges stay on one line: "PD-L1", "5-year", "1–49%".
  // A 〔ESGO II, A〕 tag opens the guideline's Evidence card, like a trial name; a source held only as a link opens the link.
  var SRC = {}, SCALE = [];
  // ⑨ colour: the risk group of an adjuvant or local-treatment decision, from the map's scale: line; nothing else is coloured
  function tierExact(x){ return SCALE.indexOf(String(x).trim()) + 1; }
  function tierLead(x){
    var t = String(x), best = 0, len = 0;
    SCALE.forEach(function(n, i){
      if (n.length > len && t.indexOf(n) === 0 && !/[A-Za-z-]/.test(t.charAt(n.length))) { best = i + 1; len = n.length; }
    });
    return best;
  }
  // outside the block that holds the risk grid, only a line that opens with "<group> risk" takes the tier rule
  function tierRisk(x){ var k = tierLead(x); return k && /^\s+risk\b/.test(String(x).slice(SCALE[k - 1].length)) ? k : 0; }
  // one indent step: the text edge of a numbered line, so everything under an option starts on its text
  var LV = 22;
  function keep(s){
    var t = String(s == null ? '' : s), out = '', k = 0, m, re = new RegExp(window.oncosOutline.TAG.source, 'g');
    function plain(x){ return esc(x).replace(/(\S*\S[-–]\S+)/g, '<span class="nw">$1</span>'); }
    while ((m = re.exec(t))) {
      var src = SRC[m[1]], label = esc(m[1] + ' ' + m[2]);
      // the statement wraps as plain text and a tag wraps as a whole; no word is carried down with a tag,
      // which left a single word alone on its line (Jonan 2026-11-11)
      out += plain(t.slice(k, m.index)) + '<span class="tag">〔' + (src && src.anchor
        ? '<span class="trial src" role="button" tabindex="0" data-ev="' + esc(src.anchor) + '">' + label + '</span>'
        : src && src.url ? '<a class="trial src" href="' + esc(src.url) + '" target="_blank" rel="noopener">' + label + '</a>'
        : label) + '〕</span>';
      k = re.lastIndex;
    }
    return out + plain(t.slice(k));
  }

  function trialLink(l){
    var name = esc(l.name);
    return l.anchor
      ? '<span class="trial" role="button" tabindex="0" data-ev="' + esc(l.anchor) + '">' + name + '</span>'
      : '<a class="trial" href="' + (l.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + esc(l.pmid) + '/' : esc(l.url)) + '" target="_blank" rel="noopener">' + name + '</a>';
  }
  // trial lines in a row make one row of ruled name cells; a tap opens the trial's card with its results
  // (Jonan 2026-11-11: no figures on the map). A trial with no Evidence row yet has a dashed cell.
  function trialsHtml(ts){
    // a chip row starts where the words of its parent line start, after the ① or ※ (Jonan 2026-11-11, "standardise the indent")
    var lv = Math.max(0, (ts[0].level || 0) - 1), pad = (lv || ts[0].off) ? ' style="--p:' + (LV * lv + (ts[0].off || 0)) + 'px"' : '';
    return '<div class="trials"' + pad + '>' + ts.map(function(l){
      return '<span class="tch' + (l.anchor ? '' : ' ni') + '">' + trialLink(l) + '</span>';
    }).join('') + '</div>';
  }
  function lineHtml(l, tiered){
    var pad = l.level ? ' style="--p:' + (LV * l.level + (l.off || 0)) + 'px"' : '';
    if (l.kind === 'trial') return trialsHtml([l]);
    var k = (l.kind === 'num' || l.kind === 'cv') ? (tiered ? tierLead(l.text) : tierRisk(l.text)) : 0;
    if (l.kind === 'tx') return '<div class="ln tx"' + pad + '>' + keep(l.text) + '</div>';
    if (l.kind === 'cv') return '<div class="ln cv' + (k ? ' t' + k + 'b' : '') + '"' + pad + '>※ ' + keep(l.text) + '</div>';
    if (l.kind === 'se') return '<div class="ln se"' + pad + '>' + keep(l.text) + '</div>';
    // a ・ line sits under the text of its parent line, one size smaller than the parent
    if (l.kind === 'sub') {
      var up = l.parent || {kind: 'text', level: 0}, upad = up.level ? ' style="--p:' + (LV * up.level + (up.off || 0)) + 'px"' : '';
      var uk = (up.kind === 'num' || up.kind === 'cv') && (tiered ? tierLead(up.text) : tierRisk(up.text)) ? ' tierb' : '';
      return '<div class="ln subl of-' + up.kind + uk + '"' + upad + '><div class="sb">' + keep(l.text) + '</div></div>';
    }
    if (l.kind === 'num') return '<div class="ln num' + (k ? ' t' + k + 'b' : '') + '"' + pad + '><span class="n">' + esc(l.n) + '</span>' + keep(l.text) + '</div>';
    return '<div class="ln text"' + pad + '>' + keep(l.text) + '</div>';
  }
  // "| a | b |" lines in a row make one ruled table; the first row is the header, "-" leaves a cell empty
  function gridHtml(rows){
    return '<table class="grid">' + rows.map(function(r, i){
      var k = i ? tierExact(r.cells[0]) : 0, last = r.cells.length - 1;
      return '<tr' + (k ? ' class="t' + k + 'r"' : '') + '>' + r.cells.map(function(c, j){
        var tag = j && i ? 'td' : 'th', cls = k && (j === 0 || j === last) ? ' class="tc"' : '';
        return '<' + tag + cls + '>' + (c === '-' ? '' : keep(c)) + '</' + tag + '>';
      }).join('') + '</tr>';
    }).join('') + '</table>';
  }
  function linesHtml(ls){
    var out = '', run = [], trs = [];
    // a block whose grid has risk-group rows also marks its ①②③ and ※ lines that open with a risk group
    var tiered = SCALE.length && ls.some(function(l){ return l.kind === 'grid' && tierExact(l.cells[0]); });
    function grids(){ if (run.length) { out += gridHtml(run); run = []; } }
    function trials(){ if (trs.length) { out += trialsHtml(trs); trs = []; } }
    var parent = null, off = 0;
    ls.forEach(function(l){
      // lines under a tier-ruled option start on its text, past the 3px rule and its 6px gap
      if (!l.level && l.kind !== 'sub') off = (l.kind === 'num' || l.kind === 'cv') && (tiered ? tierLead(l.text) : tierRisk(l.text)) ? 9 : 0;
      else if (l.level) l.off = off;
      if (l.kind === 'sub') l.parent = parent;
      else if (l.kind !== 'trial' && l.kind !== 'grid') parent = l;
      if (l.kind === 'grid') { trials(); run.push(l); return; }
      if (l.kind === 'trial') { grids(); if (trs.length && trs[0].level !== l.level) trials(); trs.push(l); return; }
      grids(); trials();
      out += lineHtml(l, tiered);
    });
    grids(); trials();
    return out;
  }
  // a block holding a grid is as wide as the grid's columns need
  function widthFor(ls, w){
    var n = 0;
    ls.forEach(function(l){ if (l.kind === 'grid') n = Math.max(n, l.cells.length); });
    return n ? Math.max(w, n * GRID_COL) : w;
  }

  function bracePath(x, y1, y2, d){
    var m = (y1 + y2) / 2, k = Math.min(6, (y2 - y1) / 4);
    return 'M'+x+' '+y1+' Q'+(x+d)+' '+y1+' '+(x+d)+' '+(y1+k)+' L'+(x+d)+' '+(m-k)+' Q'+(x+d)+' '+m+' '+(x+2*d)+' '+m+
           ' Q'+(x+d)+' '+m+' '+(x+d)+' '+(m+k)+' L'+(x+d)+' '+(y2-k)+' Q'+(x+d)+' '+y2+' '+x+' '+y2;
  }

  function render(host, model, opts){
    opts = opts || {};
    var O = window.oncosOutline;
    SRC = model.sources || {}; SCALE = model.scale || [];
    host.innerHTML = '<div class="om-idx"></div><div class="om-view" tabindex="0" aria-label="Board map"><div class="om-world om-sheet"><svg class="om-wires" aria-hidden="true"></svg></div></div>';
    var idx = host.firstChild, view = idx.nextSibling, world = view.firstChild, wires = world.firstChild;
    var nodes = [], leaves = [], maxDepth = 0;
    O.walk(model.tree, function(n){ nodes.push(n); if (n.depth > maxDepth) maxDepth = n.depth; });

    function add(cls, html, w){
      var el = document.createElement('div');
      el.className = 'blk ' + cls; el.innerHTML = html;
      if (w) el.style.width = w + 'px';
      world.appendChild(el); return el;
    }
    var course = !!model.tree.course, steps = course ? model.tree.children : null, elabs = [];
    var plabs = {};   // labels on panel next: lines, made once and moved on each layout
    if (course) {
      nodes = steps;
      steps.forEach(function(n){
        n.w = widthFor(n.lines, STEP_W);
        n.el = add('step' + (n.br ? ' br' + n.br : ''), '<div class="box lbl hd"><span>' + keep(n.label) + '</span></div>' + linesHtml(n.lines), n.w);
        n.hd = n.el.firstChild;
      });
      // join: lines to one step with one label carry that label once, on their shared line
      var joinLab = {};
      steps.forEach(function(n){ n.next.forEach(function(e){
        if (!e.label) return;
        if (e.join) { var key = e.to + '|' + e.label; if (joinLab[key]) { joinLab[key].push(e); return; } joinLab[key] = [e]; e.joins = joinLab[key]; }
        e.el = add('elab', keep(e.label));
      }); });
    } else nodes.forEach(function(n){
      n.el = add('box lbl' + (n.depth ? '' : ' root') + (n.br ? ' br' + n.br : ''), keep(n.label));
      if (n.lines.length) { n.leaf = add('leaf' + (n.br ? ' br' + n.br : ''), linesHtml(n.lines), LEAF_W); leaves.push(n); }
    });
    // no title block: the map opens on the flowsheet itself (Jonan 2026-11-11, "remove the title altogether").
    // A map with a risk scale keeps its colour key in that place
    var keys = SCALE.map(function(n, i){ return '<span class="key t' + (i + 1) + 'k">' + esc(n) + '</span>'; });
    var tblk = keys.length ? add('tblk', '<div class="keys">' + keys.join('') + '</div>') : null;
    // a band's items sit side by side when the band runs the width of the map (board layout)
    function bandItems(ls){
      var groups = [], cur = null;
      ls.forEach(function(l){ if (!cur || (!l.level && l.kind !== 'sub' && l.kind !== 'trial')) { cur = []; groups.push(cur); } cur.push(l); });
      return '<div class="bitems">' + groups.map(function(g){ return '<div class="bi">' + linesHtml(g) + '</div>'; }).join('') + '</div>';
    }
    var bands = model.bands.map(function(b){ var el = add('band', '<h2>' + esc(b.title) + '</h2>' + bandItems(b.lines), widthFor(b.lines, BAND_W)); el.w = widthFor(b.lines, BAND_W); return el; });
    var panels = model.panels.map(function(p){ p.w = widthFor(p.lines, PANEL_W); p.el = add('panel' + (p.lines.some(function(l){ return l.kind === 'grid'; }) ? ' open' : ''), '<h2>' + esc(p.title) + '</h2>' + linesHtml(p.lines), p.w); return p; });

    var W = 0, H = 0;
    // a course that runs as one line of columns, each step leading only to the next column, is laid out
    // as the whiteboard drew the early colon plan (Jonan 2026-11-11: "EXACTLY as in whiteboard")
    function boardShape(){
      if (!course) return false;
      var by = {}; steps.forEach(function(n){ by[n.label] = n; n.preds = []; n.col = null; });
      var ok = true;
      steps.forEach(function(n){ n.next.forEach(function(e){ if (e.join) ok = false; e.node = by[e.to]; e.node.preds.push(n); }); });
      if (!ok) return false;
      function col(n){ if (n.col === null) { n.col = 0; n.preds.forEach(function(p){ n.col = Math.max(n.col, col(p) + 1); }); } return n.col; }
      steps.forEach(col);
      return steps.every(function(n){ return n.next.every(function(e){ return e.node.col === n.col + 1; }); });
    }
    var board = boardShape();
    function layout(){
      if (board) { layoutBoard(); finish(); return; }
      if (course) layoutCourse(); else layoutTree(); finish();
    }
    var svg = '';

    function bandsRow(){
      if (tblk) { tblk.style.left = M + 'px'; tblk.style.top = M + 'px'; }
      var bx = M, bandH = 0, top = M + (tblk ? tblk.offsetHeight + 28 : 0);
      bands.forEach(function(el){ el.style.left = bx + 'px'; el.style.top = top + 'px'; bx += el.w + 40; bandH = Math.max(bandH, el.offsetHeight); });
      return {x:bx, top:top + (bands.length ? bandH + 28 : 0)};
    }


    /* board layout: columns left to right, 80 apart (wider where a line label needs room); the steps of a
       column stacked 32 apart; every column centred on one level, so a step sits beside the middle of the
       steps it leads to and comes from. Each line leaves the right side of its step at the middle and enters
       the left side of the next at the middle, turning at the middle of the gap. Bands run the width of the
       map above; panels sit in a row below. */
    function layoutBoard(){
      svg = '';
      var BG = 72, SG = 36, cols = [];
      steps.forEach(function(n){ (cols[n.col] = cols[n.col] || []).push(n); n.el.style.width = n.w + 'px'; n.hd.style.minHeight = ''; });
      // a step widens until no unbreakable run (a long tag, a chip) spills past its edge
      steps.forEach(function(n){ var over = n.el.scrollWidth - n.el.clientWidth; if (over > 0) { n.w += over + 4; n.el.style.width = n.w + 'px'; } });
      var gapW = cols.map(function(){ return BG; });
      steps.forEach(function(n){ n.next.forEach(function(e){ if (e.el) gapW[n.col] = Math.max(gapW[n.col], 2 * (e.el.offsetWidth + 24)); }); });
      var colX = [M], colW = cols.map(function(list){ return Math.max.apply(null, list.map(function(n){ return n.w; })); });
      cols.forEach(function(list, c){ colX[c + 1] = colX[c] + colW[c] + gapW[c]; });
      var width = colX[cols.length] - gapW[cols.length - 1] - M;
      bands.forEach(function(el){ el.style.width = Math.max(el.w, width) + 'px'; el.w = Math.max(el.w, width); });
      // bands run the full width, one under another
      if (tblk) { tblk.style.left = M + 'px'; tblk.style.top = M + 'px'; }
      var btop = M + (tblk ? tblk.offsetHeight + 28 : 0);
      bands.forEach(function(el){ el.style.left = M + 'px'; el.style.top = btop + 'px'; btop += el.offsetHeight + 28; });
      var b = {top: btop};
      var colH = cols.map(function(list){ return list.reduce(function(h, n){ return h + n.el.offsetHeight; }, 0) + SG * (list.length - 1); });
      var axis = b.top + Math.max.apply(null, colH) / 2;
      cols.forEach(function(list, c){
        var y = axis - colH[c] / 2;
        list.forEach(function(n){
          n.x = colX[c] + (colW[c] - n.w) / 2; n.y = y; n.cy = y + n.el.offsetHeight / 2;
          n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px';
          y += n.el.offsetHeight + SG;
        });
      });
      // as on the whiteboard, lines that fan out from one step or into one step share its middle and one upright,
      // so they read as one trunk with rounded turns (Jonan 2026-11-11, "why are these lines broken").
      // Fans of different steps in one gap keep their own uprights, 12 apart.
      var SP = 0, LG = 12;
      function spread(list, key){ list.sort(function(a, z){ return key(a) - key(z); }); return function(e){ return (list.indexOf(e) - (list.length - 1) / 2) * SP; }; }
      var outs = [], ins = [];
      steps.forEach(function(n){
        var o = spread(n.next.slice(), function(e){ return e.node.cy; });
        n.next.forEach(function(e){ e.ya = n.cy + o(e); });
      });
      steps.forEach(function(t){
        var inn = []; steps.forEach(function(n){ n.next.forEach(function(e){ if (e.node === t) inn.push(e); }); });
        var o = spread(inn.slice(), function(e){ return e.ya; });
        inn.forEach(function(e){ e.yb = t.cy + o(e); e.src = e.src || null; });
      });
      // a line between two steps whose middles differ by a few pixels runs straight, not with a small kink
      steps.forEach(function(n){ n.next.forEach(function(e){
        var t = e.node; if (Math.abs(e.yb - e.ya) >= 14) return;
        var y = t.preds.length < 2 ? e.ya : n.next.length < 2 ? e.yb : null;
        if (y === null) return;
        if (y < Math.max(n.y, t.y) + 20 || y > Math.min(n.y + n.el.offsetHeight, t.y + t.el.offsetHeight) - 20) return;
        e.ya = e.yb = y;
      }); });
      cols.forEach(function(list, c){
        var es = []; list.forEach(function(n){ n.next.forEach(function(e){ e.from = n; es.push(e); }); });
        var mid = colX[c] + colW[c] + gapW[c] / 2;
        // a line that runs further up or down turns nearer the side where its lines fan out, so none cross
        // one upright per fan: a step's lines out, or the lines into a step
        var fans = [];
        es.forEach(function(e){
          var key = e.from.next.length > 1 ? e.from : e.node;
          if (fans.indexOf(key) < 0) fans.push(key);
          e.fan = key;
        });
        es.forEach(function(e){ e.xm = mid + (fans.indexOf(e.fan) - (fans.length - 1) / 2) * LG; });
      });
      function elbow(x1, y1, xm, y2, x2){
        if (Math.abs(y2 - y1) < 0.5) return '<path d="M' + x1 + ' ' + y1 + ' H' + x2 + '"/>';
        var r = Math.min(10, Math.abs(y2 - y1) / 2, xm - x1, x2 - xm), sy = y2 > y1 ? 1 : -1;
        return '<path d="M' + x1 + ' ' + y1 + ' H' + (xm - r) + '"/>' +
          '<path d="M' + (xm - r) + ' ' + y1 + ' Q' + xm + ' ' + y1 + ' ' + xm + ' ' + (y1 + sy * r) + '"/>' +
          '<path d="M' + xm + ' ' + (y1 + sy * r) + ' V' + (y2 - sy * r) + '"/>' +
          '<path d="M' + xm + ' ' + (y2 - sy * r) + ' Q' + xm + ' ' + y2 + ' ' + (xm + r) + ' ' + y2 + '"/>' +
          '<path d="M' + (xm + r) + ' ' + y2 + ' H' + x2 + '"/>';
      }
      steps.forEach(function(n){ n.next.forEach(function(e){
        var t = e.node, x1 = n.x + n.w, x2 = t.x;
        svg += elbow(x1, e.ya, e.xm, e.yb, x2);
        if (e.el) {
          var w = e.el.offsetWidth, h = e.el.offsetHeight, into = t.preds.length < 2;
          e.el.style.left = ((into ? e.xm + x2 : x1 + e.xm) / 2 - w / 2) + 'px';
          e.el.style.top = ((into ? e.yb : e.ya) - h / 2) + 'px';
        }
      }); });
      var bottom = Math.max.apply(null, steps.map(function(n){ return n.y + n.el.offsetHeight; })), px = M;
      panels.forEach(function(p){
        p.el.style.width = p.w + 'px';
        p.el.style.left = px + 'px'; p.el.style.top = (bottom + 64) + 'px';
        px += p.w + 32;
      });
    }

    // a label cell centred on an upright, kept clear of the steps on either side of the gap
    function inGap(left, w, x1, x2){ return Math.max(x1 + 4, Math.min(left, x2 - 4 - w)); }

    function layoutCourse(){
      svg = '';
      var by = {}, i;
      steps.forEach(function(n, k){ by[n.label] = n; n.k = k; n.preds = []; n.col = null; });
      steps.forEach(function(n){ n.next.forEach(function(e){ e.node = by[e.to]; e.node.preds.push(n); }); });
      function col(n){ if (n.col === null) { n.col = 0; n.preds.forEach(function(p){ n.col = Math.max(n.col, col(p) + 1); }); } return n.col; }
      steps.forEach(col);
      // steps joined by next: lines, in either direction, form one branch; separate branches are drawn
      // one below the other, set apart by a wider gap, so that no branch runs beside another.
      // A join: line keeps its two steps in separate branches; it runs from the branch above down to its step.
      var g = 0;
      steps.forEach(function(n){ n.group = null; });
      steps.forEach(function(n){
        if (n.group !== null) return;
        (function mark(m){
          if (m.group !== null) return; m.group = g;
          m.next.forEach(function(e){ if (!e.join) mark(e.node); });
          m.preds.forEach(function(p){ if (!p.next.some(function(e){ return e.node === m && e.join; })) mark(p); });
        })(n);
        g++;
      });
      // every step heading the same height, so headings side by side share their top and middle
      var hh = 0;
      steps.forEach(function(n){ n.hd.style.minHeight = ''; hh = Math.max(hh, n.hd.offsetHeight); });
      steps.forEach(function(n){ n.hd.style.minHeight = hh + 'px'; });
      var b = bandsRow(), cols = [];
      steps.forEach(function(n){ (cols[n.col] = cols[n.col] || []).push(n); });
      var panelTop = [];
      var colX = [M];
      var top0 = b.top, colEnd = [];
      steps.forEach(function(n){ n.minTop = 0; });
      for (var gi = 0; gi < g; gi++) {
        var bottom = top0;
        for (var pass = 0; pass < 6; pass++) {
        cols.forEach(function(list, c){
          var x = colX[c] || 0, cursor = top0;
          var mine = list.filter(function(n){ return n.group === gi; });
          mine.forEach(function(n){
            // level with the middle of the steps that lead here, so its main line runs straight
            var own = n.preds.filter(function(p){ return p.group === n.group; });
            var ys = (own.length ? own : n.preds).map(function(p){ return p.cy; }).sort(function(a, z){ return a - z; }), h = ys.length >> 1;
            n.hh = n.hd.offsetHeight;
            n.want = !ys.length ? Infinity : ys.length % 2 ? ys[h] : (ys[h - 1] + ys[h]) / 2;
          });
          mine.sort(function(a, z){ return a.want === z.want ? a.k - z.k : a.want - z.want; });
          mine.forEach(function(n){
            var top = Math.max(n.minTop, n.want === Infinity ? cursor : Math.max(cursor, n.want - n.hh / 2));
            n.x = x; n.y = top; n.cy = top + n.hh / 2;
            n.el.style.left = x + 'px'; n.el.style.top = top + 'px';
            cursor = top + n.el.offsetHeight + CGY;
          });
        });
        // a step with one line to one step that was pushed lower (by a step above it in its column):
        // move it down level with that step so the line runs straight, when the line into it bends
        // already or there is none, and no step below it is in the way; right to left, so a move can carry on
        for (var c = cols.length - 1; c >= 0; c--) {
          var mine = cols[c].filter(function(n){ return n.group === gi; }).sort(function(a, z){ return a.y - z.y; });
          mine.forEach(function(n, k){
            if (n.next.length !== 1 || n.next[0].join || n.next[0].node.preds.length !== 1) return;
            var dy = n.next[0].node.cy - n.cy, below = mine[k + 1];
            if (dy <= 0) return;
            if (n.preds.some(function(p){ return p.next.length === 1 && Math.abs(p.cy - n.cy) < 1; })) return;
            if (below && n.y + dy + n.el.offsetHeight + CGY > below.y) return;
            n.y += dy; n.cy += dy; n.el.style.top = n.y + 'px';
          });
        }
        // a line that passes a column runs straight at its step's middle; when a step in that column
        // stands in its way, its step moves down below that step and the group is placed again
        var moved = false;
        steps.forEach(function(n){
          if (n.group !== gi) return;
          n.next.forEach(function(e){
            if (e.join || e.node.col <= n.col + 1) return;
            steps.forEach(function(m){
              if (m.group !== gi || m.col <= n.col || m.col >= e.node.col) return;
              var mb = m.y + m.el.offsetHeight;
              if (!(n.cy > m.y - 12 && n.cy < mb + 24)) return;
              // a step this one also leads to moves below the passing line instead, so the source keeps its place
              // and its own steps hang below the line (Jonan 2026-11-11, early colon: resectable cancer straight to colectomy)
              if (m.preds.indexOf(n) >= 0) { var u = n.cy + 24 + (e.el ? e.el.offsetHeight : 0); if (u > m.minTop + 0.5) { m.minTop = u; moved = true; } return; }
              var t = mb + 24 - n.hh / 2; if (t > n.minTop + 0.5) { n.minTop = t; moved = true; }
            });
            // nor may it cross a line from a step beside it to the next column
            steps.forEach(function(p){
              if (p === n || p.group !== gi || p.col !== n.col) return;
              p.next.forEach(function(f){
                var lo = Math.min(p.cy, f.node.cy), hi = Math.max(p.cy, f.node.cy);
                if (f.node.col > n.col && f.node.col < e.node.col && n.cy > lo - 12 && n.cy < hi + 12) { var t = hi + 24 - n.hh / 2; if (t > n.minTop + 0.5) { n.minTop = t; moved = true; } }
              });
            });
          });
        });
        if (!moved) break;
        }
        cols.forEach(function(list, c){
          list.forEach(function(n){
            if (n.group !== gi) return;
            bottom = Math.max(bottom, n.y + n.el.offsetHeight);
            colEnd[c] = Math.max(colEnd[c] || 0, n.y + n.el.offsetHeight + CGY);
          });
        });
        top0 = bottom + BGY;
      }
      cols.forEach(function(list, c){
        list.sort(function(a, z){ return a.y - z.y; });
        panelTop[c] = (colEnd[c] || b.top) + 12;
      });
      // a line label is centred on its own run: on the straight run beyond the divide, on the upright of a
      // line that divides or joins (the upright moves out from the step far enough to carry it), or on the
      // run from a source to the turn. The gap after a column is made wide enough for the labels in it.
      var gapW = cols.map(function(){ return CGX; });
      steps.forEach(function(n){ n.stub = STUB; n.jstub = STUB; });
      steps.forEach(function(n){ n.next.forEach(function(e){
        var t = e.node;
        e.split = n.next.length > 1 || t.preds.length < 2; e.level = Math.abs(t.cy - n.cy) < 1;
        if (!e.el) return;
        var w = e.el.offsetWidth;
        if (e.split && !e.level && !e.join) n.stub = Math.max(n.stub, w / 2 + 12);
        if (e.joins) t.jstub = Math.max(t.jstub, w / 2 + 12);
      }); });
      steps.forEach(function(n){ n.next.forEach(function(e){
        var t = e.node, c = t.col - 1;
        if (!e.el || (!e.joins && e.join) || c < 0) return;
        var w = e.el.offsetWidth, need;
        if (e.joins && e.split) { if (n.col !== c) return; need = n.stub + w + 32; }
        else if (e.joins) need = t.jstub + w / 2 + 12;
        else if (n.col !== c) return;
        else if (e.split) need = e.level ? n.stub + w + 32 : n.stub + w / 2 + 12;
        else need = t.jstub + w + 32;
        gapW[c] = Math.max(gapW[c], need);
      }); });
      colX = [M];
      cols.forEach(function(list, c){ colX[c + 1] = colX[c] + Math.max.apply(null, list.map(function(n){ return n.w; })) + gapW[c]; });
      steps.forEach(function(n){ n.x = colX[n.col]; n.el.style.left = n.x + 'px'; });
      var shareX = {};
      steps.forEach(function(n){ n.next.forEach(function(e){
        if (!e.join || !e.split) return;
        var key = e.to + '|' + (e.label || ''); shareX[key] = Math.max(shareX[key] || 0, n.x + n.w + n.stub);
      }); });
      // a step's box, for keeping lines out from under it
      function under(y, xa, xz, not){
        return steps.filter(function(m){ return not.indexOf(m) < 0 && m.x < xz && m.x + m.w > xa && y > m.y && y < m.y + m.el.offsetHeight; });
      }
      steps.forEach(function(n){
        n.next.forEach(function(e){
          // one source to several steps: the line divides next to the source, the label sits on the branch;
          // several sources to one step: the lines join next to the step, the label sits on the source's own line
          var t = e.node, x1 = n.x + n.w, x2 = t.x, split = e.split, level = e.level;
          var xm = split ? (e.join ? shareX[e.to + '|' + (e.label || '')] : x1 + n.stub) : x2 - t.jstub;
          // a line that would run under a step on its way in takes a lane past that step, then turns into its own
          var block = split ? under(t.cy, xm, x2, [n, t]) : [], lane = null, xb = null;
          if (block.length) {
            lane = t.cy > n.cy ? Math.min.apply(null, block.map(function(m){ return m.y; })) - 24
                               : Math.max.apply(null, block.map(function(m){ return m.y + m.el.offsetHeight; })) + 24;
            xb = x2 - t.jstub;
            svg += '<path d="M' + x1 + ' ' + n.cy + ' H' + xm + ' V' + lane + ' H' + xb + ' V' + t.cy + ' H' + x2 + '"/>';
          } else {
            // the course spine (a straight next: line) is drawn heavier than the lines that branch off it
            svg += '<path d="M' + x1 + ' ' + n.cy + ' H' + xm + ' V' + t.cy + ' H' + x2 + '"/>';
          }
          e.xm = xm; e.cy = n.cy; e.lane = lane; e.xb = xb;
          if (e.el && !e.join) {
            // a label sits in a ruled cell on its own run of the line: the straight run, or the upright
            // between the previous turn and its step, so it never stands beside another step's line
            var h = e.el.offsetHeight, w = e.el.offsetWidth;
            // centred along its own run: from the divide to the step on a line that divides, and from the
            // source to the turn where it meets the other lines into its step
            if (lane !== null) {
              // a line routed along a lane carries its label on the lane, between the divide and the last turn
              e.el.style.left = ((xm + xb - w) / 2) + 'px'; e.el.style.top = (lane - h / 2) + 'px';
            } else if (level) {
              var a = split ? xm : x1, z = split ? x2 : xm;
              e.el.style.left = inGap((a + z - w) / 2, w, a, z) + 'px'; e.el.style.top = (t.cy - h / 2) + 'px';
            } else if (!split) {
              e.el.style.left = inGap((x1 + xm - w) / 2, w, x1, xm) + 'px'; e.el.style.top = (n.cy - h / 2) + 'px';
            } else {
              var prev = n.cy;
              n.next.forEach(function(o){ var y = o.node.cy; if ((y - n.cy) * (t.cy - n.cy) > 0 && Math.abs(y - n.cy) < Math.abs(t.cy - n.cy) && Math.abs(y - n.cy) > Math.abs(prev - n.cy)) prev = y; });
              e.el.style.left = inGap(xm - w / 2, w, x1, x2) + 'px'; e.el.style.top = ((prev + t.cy) / 2 - h / 2) + 'px';
            }
          }
        });
      });
      // the label of join: lines sits beside their shared upright, halfway between the nearest source and the step
      steps.forEach(function(n){
        n.next.forEach(function(e){
          if (!e.joins || !e.el) return;
          var ty = e.node.cy, ys = e.joins.map(function(j){ return j.cy; });
          var near = ty >= Math.max.apply(null, ys) ? Math.max.apply(null, ys) : Math.min.apply(null, ys);
          var w = e.el.offsetWidth, x1 = Math.max.apply(null, e.node.preds.map(function(p){ return p.x + p.w; }));
          if (e.lane !== null) { e.el.style.left = ((e.xm + e.xb - w) / 2) + 'px'; e.el.style.top = (e.lane - e.el.offsetHeight / 2) + 'px'; return; }
          if (e.split) { e.el.style.left = ((e.xm + e.node.x - w) / 2) + 'px'; e.el.style.top = (ty - e.el.offsetHeight / 2) + 'px'; return; }
          e.el.style.left = inGap(e.xm - w / 2, w, x1, e.node.x) + 'px'; e.el.style.top = ((near + ty) / 2 - e.el.offsetHeight / 2) + 'px';
        });
      });
      var right = colX[cols.length] - CGX, loose = b.top;
      panels.forEach(function(p){
        p.el.style.width = (p.w > PANEL_W ? p.w : STEP_W) + 'px';
        var n = p.join && by[p.join];
        if (n) { p.el.style.left = n.x + 'px'; p.el.style.top = panelTop[n.col] + 'px'; panelTop[n.col] += p.el.offsetHeight + CGY; }
        else { p.el.style.left = (right + CGX) + 'px'; p.el.style.top = loose + 'px'; loose += p.el.offsetHeight + CGY; }
      });
    }

    function finish(){
      W = 0; H = 0;
      Array.prototype.forEach.call(world.querySelectorAll('.blk'), function(el){
        W = Math.max(W, el.offsetLeft + el.offsetWidth); H = Math.max(H, el.offsetTop + el.offsetHeight);
      });
      W += M; H += M;
      world.style.width = W + 'px'; world.style.height = H + 'px';
      wires.setAttribute('width', W); wires.setAttribute('height', H);
      wires.innerHTML = svg;
      centreLabels();
    }

    // straight runs of the lines as drawn: M, H and V commands of paths, and lines
    function wireSegs(){
      var segs = [], re = /<path[^>]* d="([^"]*)"|<line x1="([^"]*)" y1="([^"]*)" x2="([^"]*)" y2="([^"]*)"/g, m;
      function put(x1, y1, x2, y2){
        if (Math.abs(y1 - y2) < 0.5 && Math.abs(x1 - x2) > 0.5) segs.push({h:true, k:y1, a:Math.min(x1, x2), b:Math.max(x1, x2)});
        else if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) > 0.5) segs.push({h:false, k:x1, a:Math.min(y1, y2), b:Math.max(y1, y2)});
      }
      while ((m = re.exec(svg))) {
        if (m[2] !== undefined) { put(+m[2], +m[3], +m[4], +m[5]); continue; }
        if (/[QCLA]/.test(m[1])) continue;
        var x = 0, y = 0, c, cre = /([MHV])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g;
        while ((c = cre.exec(m[1]))) {
          var v = +c[2];
          if (c[1] === 'M') { x = v; y = +c[3]; }
          else if (c[1] === 'H') { put(x, y, v, y); x = v; }
          else { put(x, y, x, v); y = v; }
        }
      }
      return segs;
    }

    // the visible run through a point on a line: collinear runs joined, cut at box edges and at
    // other lines meeting or crossing it
    function visibleRun(segs, boxes, h, k, pos){
      var on = segs.filter(function(s){ return s.h === h && Math.abs(s.k - k) < 0.5 && s.a - 0.5 <= pos && pos <= s.b + 0.5; });
      if (!on.length) return null;
      var a = Math.min.apply(null, on.map(function(s){ return s.a; })), z = Math.max.apply(null, on.map(function(s){ return s.b; })), grew = true;
      while (grew) { grew = false; segs.forEach(function(s){
        if (s.h === h && Math.abs(s.k - k) < 0.5 && s.a <= z + 0.5 && s.b >= a - 0.5 && (s.a < a - 0.5 || s.b > z + 0.5)) { a = Math.min(a, s.a); z = Math.max(z, s.b); grew = true; }
      }); }
      var lo = a, hi = z;
      function stop(v){ if (v < pos - 1 && v > lo) lo = v; if (v > pos + 1 && v < hi) hi = v; }
      boxes.forEach(function(r){ if (h ? (k >= r.t && k <= r.b) : (k >= r.l && k <= r.r)) { stop(h ? r.l : r.t); stop(h ? r.r : r.b); } });
      segs.forEach(function(s){ if (s.h !== h && s.a <= k + 0.5 && s.b >= k - 0.5) stop(s.k); });
      return {a:lo, z:hi};
    }

    // every line label centred on the line as drawn, on both axes; a label set beside an upright
    // (a panel lane) is centred on the upright's run
    function centreLabels(){
      var segs = wireSegs(), labs = [], boxes = [];
      Array.prototype.forEach.call(world.querySelectorAll('.blk'), function(el){
        var r = {el:el, l:el.offsetLeft, t:el.offsetTop, r:el.offsetLeft + el.offsetWidth, b:el.offsetTop + el.offsetHeight};
        (/\belab\b/.test(el.className) ? labs : boxes).push(r);
      });
      labs.forEach(function(c){
        var w = c.r - c.l, hgt = c.b - c.t, cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2, run;
        var H = segs.filter(function(s){ return s.h && Math.abs(s.k - cy) <= 3 && s.a < cx && cx < s.b; });
        var V = segs.filter(function(s){ return !s.h && Math.abs(s.k - cx) <= 3 && s.a < cy && cy < s.b; });
        if (H.length) {
          run = visibleRun(segs, boxes, true, H[0].k, cx);
          c.el.style.left = ((run.a + run.z - w) / 2) + 'px'; c.el.style.top = (H[0].k - hgt / 2) + 'px';
        } else if (V.length) {
          run = visibleRun(segs, boxes, false, V[0].k, cy);
          c.el.style.left = (V[0].k - w / 2) + 'px'; c.el.style.top = ((run.a + run.z - hgt) / 2) + 'px';
        } else {
          var B = segs.filter(function(s){ return !s.h && s.k <= c.l && c.l - s.k <= 14 && s.a < cy && cy < s.b; });
          if (!B.length) return;
          run = visibleRun(segs, boxes, false, B[0].k, cy);
          c.el.style.top = ((run.a + run.z - hgt) / 2) + 'px';
        }
      });
    }

    function layoutTree(){
      // columns
      var colW = [], colX = [];
      nodes.forEach(function(n){ n.el.style.width = ''; n.w = n.el.offsetWidth; colW[n.depth] = Math.max(colW[n.depth] || 0, n.w); });
      colX[0] = M;
      for (var d = 1; d <= maxDepth; d++) colX[d] = colX[d - 1] + colW[d - 1] + GX;
      var textX = colX[maxDepth] + colW[maxDepth] + 20;
      nodes.forEach(function(n){ n.el.style.width = colW[n.depth] + 'px'; n.h = n.el.offsetHeight; n.x = colX[n.depth]; });

      // bands in one row above the tree
      var b0 = bandsRow(), bx = b0.x, treeTop = b0.top;

      // vertical extents, bottom up: up/down from the node's own centre
      (function ext(n){
        if (!n.children.length) {
          var lh = n.leaf ? n.leaf.offsetHeight : 0;
          n.up = n.h / 2; n.down = Math.max(n.h / 2, lh - n.h / 2); return;
        }
        n.children.forEach(ext);
        // each branch sits just below the one above it, so a tall branch leaves no gap between short ones
        var k = n.children, at = 0, top = Infinity, bot = -Infinity;
        k.forEach(function(c, i){ if (i) at += k[i - 1].down + c.up + GY; c.off = at; });
        // the node sits level with its middle branch, or halfway between the two middle ones
        var mi = (k.length - 1) / 2, pc = (k[Math.floor(mi)].off + k[Math.ceil(mi)].off) / 2;
        k.forEach(function(c){ c.off -= pc; top = Math.min(top, c.off - c.up); bot = Math.max(bot, c.off + c.down); });
        n.up = Math.max(n.h / 2, -top); n.down = Math.max(n.h / 2, bot);
      })(model.tree);
      // the root sits level with its first branch (Jonan 2026-11-10), so the two open together;
      // the other branches hang below on the same square lines
      var root = model.tree, k0 = root.children[0], lift = k0 ? k0.off : 0;
      (function place(n, cy){
        n.cy = cy; n.y = cy - n.h / 2;
        n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px';
        if (n.leaf) { n.leaf.style.left = textX + 'px'; n.leaf.style.top = n.y + 'px'; }
        n.children.forEach(function(c){ place(c, cy + c.off - (n === root ? lift : 0)); });
      })(root, treeTop + (k0 ? Math.max(root.h / 2, k0.up) : root.up));

      // wires: parent right edge to child left edge; a shallow leaf runs on to the text column
      svg = '';
      nodes.forEach(function(n){
        // square lines: across from the parent, down the gap, across to each child
        var px = n.x + colW[n.depth], gx = px + GX / 2;
        n.children.forEach(function(c){ svg += '<path d="M' + px + ' ' + n.cy + ' H' + gx + ' V' + c.cy + ' H' + c.x + '"/>'; });
        if (n.leaf) svg += '<line x1="' + (n.x + colW[n.depth]) + '" y1="' + n.cy + '" x2="' + textX + '" y2="' + n.cy + '"/>';
      });

      // panels: a brace over their node's span, the panels stacked beside it
      var braceX = textX + LEAF_W + 24, panelX = braceX + 40, lastBottom = treeTop - 24, right = panelX + PANEL_W;
      var groups = [];
      nodes.forEach(function(n){
        var ps = panels.filter(function(p){ return p.join === n.label; });
        if (ps.length) groups.push({n:n, ps:ps});
      });
      var loose = panels.filter(function(p){ return !p.join; });
      groups.forEach(function(g){
        var y1 = g.n.cy - g.n.up, y2 = g.n.cy + g.n.down, mid = (y1 + y2) / 2;
        var gh = g.ps.reduce(function(s, p){ return s + p.el.offsetHeight; }, 0) + 24 * (g.ps.length - 1);
        var y = Math.max(lastBottom + 24, mid - gh / 2);
        g.ps.forEach(function(p){ p.el.style.left = panelX + 'px'; p.el.style.top = y + 'px'; y += p.el.offsetHeight + 24; });
        var top0 = y - 24 - gh;
        lastBottom = y - 24;
        svg += '<path d="' + bracePath(braceX, y1, y2, 9) + '"/>';
        var ty = Math.min(Math.max(mid, top0 + 10), lastBottom - 10);
        // a rule down the panel group's left side; the brace tip runs to it
        var rx = panelX - 14;
        svg += '<line x1="' + rx + '" y1="' + (top0 + 4) + '" x2="' + rx + '" y2="' + (lastBottom - 4) + '"/>';
        svg += '<path d="M' + (braceX + 22) + ' ' + mid + ' H' + (rx - 10) + (ty === mid ? '' : ' V' + ty) + ' H' + rx + '"/>';
      });
      loose.forEach(function(p){ p.el.style.left = panelX + 'px'; p.el.style.top = (lastBottom + 24) + 'px'; lastBottom += 24 + p.el.offsetHeight; });

      // a panel's next: line leaves its header to the right, runs down beside the panel column and enters the
      // named panel's header; lines to one panel with one label share an upright and one label
      var colR = panels.reduce(function(m, p){ return Math.max(m, p.el.offsetLeft + p.el.offsetWidth); }, 0), lanes = [];
      panels.forEach(function(p){ (p.next || []).forEach(function(e){
        var t = panels.filter(function(q){ return q.title === e.to; })[0];
        if (!t) return;
        var L = lanes.filter(function(l){ return l.t === t && l.label === e.label; })[0];
        if (!L) { L = {t:t, label:e.label, src:[], x:colR + 28 + 20 * lanes.length}; lanes.push(L); }
        L.src.push(p);
      }); });
      lanes.forEach(function(L){
        var hy = function(p){ return p.el.offsetTop + p.el.firstChild.offsetHeight / 2; };
        var ty = hy(L.t), ys = L.src.map(hy), lo = Math.min.apply(null, ys.concat(ty)), hi = Math.max.apply(null, ys.concat(ty));
        L.src.forEach(function(p, i){ svg += '<path d="M' + (p.el.offsetLeft + p.el.offsetWidth) + ' ' + ys[i] + ' H' + L.x + '"/>'; });
        svg += '<path d="M' + L.x + ' ' + lo + ' V' + hi + '"/>';
        svg += '<path d="M' + L.x + ' ' + ty + ' H' + (L.t.el.offsetLeft + L.t.el.offsetWidth) + '"/>';
        if (L.label) {
          var key = L.t.title + '|' + L.label, el = plabs[key] || (plabs[key] = add('elab', keep(L.label)));
          el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none';
          el.style.left = (L.x + 10) + 'px';
          el.style.top = ((Math.max.apply(null, ys) + ty) / 2 - el.offsetHeight / 2) + 'px';
        }
      });

    }

    /* ---- pan and zoom ---- */
    var st = {s:1, x:0, y:0}, fitS = 1, saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('oncos-map-view-' + opts.id) || 'null'); } catch(e){}
    function size(){
      var r = view.getBoundingClientRect();
      var h = Math.max(360, window.innerHeight - Math.max(0, r.top) - 12);
      view.style.height = h + 'px';
      fitS = Math.min(view.clientWidth / W, view.clientHeight / H, 1);
    }
    function clamp(){
      st.s = Math.min(Math.max(st.s, fitS * 0.6), 2.5);
      var vw = view.clientWidth, vh = view.clientHeight, w = W * st.s, h = H * st.s, pad = 80;
      st.x = Math.min(Math.max(st.x, Math.min(0, vw - w) - pad), Math.max(0, vw - w) + pad);
      st.y = Math.min(Math.max(st.y, Math.min(0, vh - h) - pad), Math.max(0, vh - h) + pad);
    }
    var saveT = null;
    function apply(){
      clamp();
      world.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.s + ')';
      clearTimeout(saveT);
      saveT = setTimeout(function(){ try { sessionStorage.setItem('oncos-map-view-' + opts.id, JSON.stringify(st)); } catch(e){} }, 200);
    }
    function fit(){
      size();
      st.s = fitS; st.x = (view.clientWidth - W * fitS) / 2; st.y = Math.max(0, (view.clientHeight - H * fitS) / 2);
      apply();
    }
    function zoomAt(f, cx, cy){
      var s0 = st.s; st.s = s0 * f; clamp();
      var k = st.s / s0; st.x = cx - (cx - st.x) * k; st.y = cy - (cy - st.y) * k; apply();
    }
    function local(e){ var r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    view.addEventListener('wheel', function(e){
      e.preventDefault();
      var p = local(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var mouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && e.deltaY % 1 === 0);
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-dy * 0.01), p[0], p[1]);
      else if (mouse) zoomAt(Math.exp(-dy * 0.0015), p[0], p[1]);
      else { st.x -= e.deltaX; st.y -= e.deltaY; apply(); }
    }, {passive:false});

    var pts = new Map(), moved = false, last = null;
    view.addEventListener('pointerdown', function(e){
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) moved = false;
      last = null;
    });
    view.addEventListener('pointermove', function(e){
      if (!pts.has(e.pointerId)) return;
      var prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) {
        var dx = e.clientX - prev[0], dy = e.clientY - prev[1];
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) { pts.set(e.pointerId, prev); return; }
        if (!moved) { moved = true; try { view.setPointerCapture(e.pointerId); } catch(err){} view.classList.add('drag'); }
        st.x += dx; st.y += dy; apply();
      } else if (pts.size === 2) {
        moved = true;
        var v = Array.from(pts.values()), r = view.getBoundingClientRect();
        var d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]), cx = (v[0][0] + v[1][0]) / 2 - r.left, cy = (v[0][1] + v[1][1]) / 2 - r.top;
        if (last) { st.x += cx - last.cx; st.y += cy - last.cy; zoomAt(d / last.d, cx, cy); }
        last = {d:d, cx:cx, cy:cy};
      }
    });
    function up(e){ pts.delete(e.pointerId); last = null; if (!pts.size) view.classList.remove('drag'); }
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    view.addEventListener('click', function(e){ if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    view.addEventListener('keydown', function(e){
      if (e.target !== view) return;
      var c = [view.clientWidth / 2, view.clientHeight / 2], k = e.key;
      if (k === '+' || k === '=') zoomAt(1.25, c[0], c[1]);
      else if (k === '-') zoomAt(0.8, c[0], c[1]);
      else if (k === '0') fit();
      else if (k === 'ArrowLeft') { st.x += 60; apply(); }
      else if (k === 'ArrowRight') { st.x -= 60; apply(); }
      else if (k === 'ArrowUp') { st.y += 60; apply(); }
      else if (k === 'ArrowDown') { st.y -= 60; apply(); }
      else return;
      e.preventDefault();
    });

    // reading size: a course opens on its first step, a tree on its root and first branch; Fit shows the whole map
    var heads = course ? steps : [model.tree].concat(model.tree.children);
    function read(n){
      size();
      st.s = 1;
      st.x = 16 - n.x;
      st.y = course ? 16 - n.y : view.clientHeight / 2 - (n.y + n.el.offsetHeight / 2);
      apply();
    }
    // phone: a row of the main headings above the canvas; a tap moves the map to that heading
    idx.innerHTML = heads.map(function(n, k){ return '<button type="button" data-k="' + k + '">' + esc(n.label) + '</button>'; }).join('');
    idx.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      Array.prototype.forEach.call(idx.children, function(x){ x.classList.toggle('on', x === b); });
      read(heads[+b.dataset.k]);
    });
    // opening view of a tree: the root and its first branch together, at reading size (Jonan 2026-11-10);
    // on a phone the scale drops just enough for both to fit across, never below 0.75
    function open(){
      var r = model.tree, c = !course && r.children && r.children[0];
      if (!c) { read(heads[0]); return; }
      size();
      var vw = view.clientWidth;
      var x0 = Math.min(r.x, c.x), x1 = Math.max(r.x + r.el.offsetWidth, c.x + c.el.offsetWidth);
      var y0 = Math.min(r.y, c.y), y1 = Math.max(r.y + r.el.offsetHeight, c.y + c.el.offsetHeight);
      st.s = Math.max(0.75, Math.min(1, (vw - 32) / (x1 - x0)));
      st.x = 16 - x0 * st.s;
      st.y = 16 - y0 * st.s;
      apply();
    }
    function start(){
      layout(); size();
      if (saved && saved.s) { st = saved; saved = null; apply(); } else { open(); opened = JSON.stringify(st); }
    }
    var opened = null;
    start();
    // once the web font is in, steps change height: an untouched opening view is taken again from the new layout
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){
      var s = JSON.stringify(st); layout(); size();
      if (s === opened) { open(); opened = JSON.stringify(st); } else { st = JSON.parse(s); apply(); }
    });
    return {
      fit: fit,
      resize: function(){ size(); apply(); },
      world: world,
      destroy: function(){ host.innerHTML = ''; }
    };
  }
  window.oncosCanvas = {render: render};
})();
