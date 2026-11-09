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
   - next: lines are drawn as ruled elbows; a straight one is the spine, drawn heavier; its label sits in a ruled cell on the line
   - join: lines to one step with one label share an upright and carry the label once, on it
   - a panel sits below its step's column
   - a step, band or panel holding a grid ("| a | b |" lines) widens to fit the grid's columns
   window.oncosCanvas.render(host, model, opts) returns {fit, resize, destroy}. */
(function(){
  var GX = 44, GY = 16, LEAF_W = 480, PANEL_W = 440, BAND_W = 520, M = 28;
  var STEP_W = 440, CGX = 170, CGY = 36, BGY = 96, STUB = 28, GRID_COL = 176;

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
  function keep(s){
    var t = String(s == null ? '' : s), out = '', k = 0, m, re = new RegExp(window.oncosOutline.TAG.source, 'g');
    function plain(x){ return esc(x).replace(/(\S*\S[-–]\S+)/g, '<span class="nw">$1</span>'); }
    while ((m = re.exec(t))) {
      var src = SRC[m[1]], label = esc(m[1] + ' ' + m[2]);
      // the word before a tag stays on the tag's line, so a tag never wraps alone
      var before = t.slice(k, m.index), w = /(\S+\s*)$/.exec(before), lead = w ? before.slice(0, w.index) : before;
      out += plain(lead) + '<span class="nw">' + (w ? plain(w[1]) : '') + '<span class="tag">〔' + (src && src.anchor
        ? '<span class="trial src" role="button" tabindex="0" data-ev="' + esc(src.anchor) + '">' + label + '</span>'
        : src && src.url ? '<a class="trial src" href="' + esc(src.url) + '" target="_blank" rel="noopener">' + label + '</a>'
        : label) + '〕</span></span>';
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
  // trial lines in a row make one two-column ruled grid: trial name | key figure
  function trialsHtml(ts){
    var pad = ts[0].level ? ' style="margin-left:' + (1.15 * ts[0].level) + 'em"' : '';
    return '<div class="trials"' + pad + '>' + ts.map(function(l){
      return '<div class="tn">' + trialLink(l) + '</div><div class="fg">' + (l.fig ? keep(l.fig) : '') + '</div>';
    }).join('') + '</div>';
  }
  function lineHtml(l, tiered){
    var pad = l.level ? ' style="padding-left:' + (1.15 * l.level) + 'em"' : '';
    if (l.kind === 'trial') return trialsHtml([l]);
    var k = tiered && (l.kind === 'num' || l.kind === 'cv') ? tierLead(l.text) : 0;
    if (l.kind === 'tx') return '<div class="ln tx"' + pad + '>' + keep(l.text) + '</div>';
    if (l.kind === 'cv') return '<div class="ln cv' + (k ? ' t' + k + 'b' : '') + '"' + pad + '>※ ' + keep(l.text) + '</div>';
    if (l.kind === 'se') return '<div class="ln se"' + pad + '>' + keep(l.text) + '</div>';
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
    ls.forEach(function(l){
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
    if (course) {
      nodes = steps;
      steps.forEach(function(n){
        n.w = widthFor(n.lines, STEP_W);
        n.el = add('step', '<div class="box lbl hd"><span>' + keep(n.label) + '</span></div>' + linesHtml(n.lines), n.w);
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
      n.el = add('box lbl' + (n.depth ? '' : ' root'), keep(n.label));
      if (n.lines.length) { n.leaf = add('leaf', linesHtml(n.lines), LEAF_W); leaves.push(n); }
    });
    // title block: map name, its guideline source and where the figures come from
    var srcs = Object.keys(model.sources || {}).map(function(k){
      var x = model.sources[k];
      return x.anchor ? '<span class="trial" role="button" tabindex="0" data-ev="' + esc(x.anchor) + '">' + esc(x.name) + '</span>'
        : x.url ? '<a class="trial" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a>' : esc(x.name);
    });
    var tblk = add('tblk', '<div class="k">Map</div><div class="v">' + esc(model.map || '') + '</div>' +
      (srcs.length ? '<div class="k">Source</div><div>' + srcs.join(' · ') + '</div>' : '') +
      '<div class="k">Figures</div><div>' + esc(opts.figures || 'Evidence rows') + '</div>' +
      (SCALE.length ? '<div class="k">Risk</div><div class="keys">' + SCALE.map(function(n, i){ return '<span class="key t' + (i + 1) + 'k">' + esc(n) + '</span>'; }).join('') + '</div>' : ''));
    var bands = model.bands.map(function(b){ var el = add('band', '<h2>' + esc(b.title) + '</h2>' + linesHtml(b.lines), widthFor(b.lines, BAND_W)); el.w = widthFor(b.lines, BAND_W); return el; });
    var panels = model.panels.map(function(p){ p.w = widthFor(p.lines, PANEL_W); p.el = add('panel', '<h2>' + esc(p.title) + '</h2>' + linesHtml(p.lines), p.w); return p; });

    var W = 0, H = 0;
    function layout(){ if (course) layoutCourse(); else layoutTree(); finish(); }
    var svg = '';

    function bandsRow(){
      tblk.style.left = M + 'px'; tblk.style.top = M + 'px';
      var bx = M, bandH = 0, top = M + tblk.offsetHeight + 28;
      bands.forEach(function(el){ el.style.left = bx + 'px'; el.style.top = top + 'px'; bx += el.w + 40; bandH = Math.max(bandH, el.offsetHeight); });
      return {x:bx, top:top + (bands.length ? bandH + 28 : 0)};
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
      cols.forEach(function(list, c){ colX[c + 1] = colX[c] + Math.max.apply(null, list.map(function(n){ return n.w; })) + CGX; });
      var top0 = b.top, colEnd = [];
      for (var gi = 0; gi < g; gi++) {
        var bottom = top0;
        cols.forEach(function(list, c){
          var x = colX[c], cursor = top0;
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
            var top = n.want === Infinity ? cursor : Math.max(cursor, n.want - n.hh / 2);
            n.x = x; n.y = top; n.cy = top + n.hh / 2;
            n.el.style.left = x + 'px'; n.el.style.top = top + 'px';
            cursor = top + n.el.offsetHeight + CGY;
            bottom = Math.max(bottom, top + n.el.offsetHeight);
          });
          if (mine.length) colEnd[c] = cursor;
        });
        top0 = bottom + BGY;
      }
      cols.forEach(function(list, c){
        list.sort(function(a, z){ return a.y - z.y; });
        panelTop[c] = (colEnd[c] || b.top) + 12;
      });
      // a step with one line to one step, a few pixels above it: move it down so the line runs straight
      cols.forEach(function(list){
        list.forEach(function(n, k){
          if (n.next.length !== 1 || n.next[0].node.preds.length !== 1) return;
          var dy = n.next[0].node.cy - n.cy, below = list[k + 1];
          if (dy <= 0 || dy >= CGY) return;
          if (below && n.y + dy + n.el.offsetHeight + CGY / 2 > below.y) return;
          n.y += dy; n.cy += dy; n.el.style.top = n.y + 'px';
        });
      });
      steps.forEach(function(n){
        n.next.forEach(function(e){
          // one source to several steps: the line divides next to the source, the label sits on the branch;
          // several sources to one step: the lines join next to the step, the label sits on the source's own line
          var t = e.node, x1 = n.x + n.w, x2 = t.x, split = n.next.length > 1 || t.preds.length < 2;
          var xm = split ? x1 + STUB : x2 - STUB, level = Math.abs(t.cy - n.cy) < 1;
          // the course spine (a straight next: line) is drawn heavier than the lines that branch off it
          svg += '<path' + (level && !e.join ? ' class="main"' : '') + ' d="M' + x1 + ' ' + n.cy + ' H' + xm + ' V' + t.cy + ' H' + x2 + '"/>';
          e.xm = xm; e.cy = n.cy;
          if (e.el && !e.join) {
            // a label sits in a ruled cell on its own run of the line: the straight run, or the upright
            // between the previous turn and its step, so it never stands beside another step's line
            var h = e.el.offsetHeight, w = e.el.offsetWidth;
            if (level || !split) {
              e.el.style.left = inGap((split ? xm : x1) + 8, w, x1, x2) + 'px'; e.el.style.top = ((split ? t.cy : n.cy) - h / 2) + 'px';
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
        var k = n.children, S = 0;
        for (var i = 0; i + 1 < k.length; i++) S = Math.max(S, k[i].down + k[i + 1].up + GY);
        var pc = (k.length - 1) * S / 2, top = Infinity, bot = -Infinity;
        k.forEach(function(c, i){ c.off = i * S - pc; top = Math.min(top, c.off - c.up); bot = Math.max(bot, c.off + c.down); });
        n.up = Math.max(n.h / 2, -top); n.down = Math.max(n.h / 2, bot);
      })(model.tree);
      (function place(n, cy){
        n.cy = cy; n.y = cy - n.h / 2;
        n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px';
        if (n.leaf) { n.leaf.style.left = textX + 'px'; n.leaf.style.top = n.y + 'px'; }
        n.children.forEach(function(c){ place(c, cy + c.off); });
      })(model.tree, treeTop + model.tree.up);

      // wires: parent right edge to child left edge; a shallow leaf runs on to the text column
      svg = '';
      nodes.forEach(function(n){
        // square lines: across from the parent, down the gap, across to each child
        var px = n.x + colW[n.depth], gx = px + GX / 2;
        n.children.forEach(function(c){ svg += '<path d="M' + px + ' ' + n.cy + ' H' + gx + ' V' + c.cy + ' H' + c.x + '"/>'; });
        if (n.leaf && n.depth < maxDepth) svg += '<line x1="' + (n.x + colW[n.depth]) + '" y1="' + n.cy + '" x2="' + (textX - 8) + '" y2="' + n.cy + '"/>';
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

    // the map opens at reading size: a course on its first step, a tree on its root; Fit shows the whole map
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
    function start(){
      layout(); size();
      if (saved && saved.s) { st = saved; saved = null; apply(); } else { read(heads[0]); opened = JSON.stringify(st); }
    }
    var opened = null;
    start();
    // once the web font is in, steps change height: an untouched opening view is taken again from the new layout
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){
      var s = JSON.stringify(st); layout(); size();
      if (s === opened) read(heads[0]); else { st = JSON.parse(s); apply(); }
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
