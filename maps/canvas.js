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
  // tree spacing widened (Jonan 2026-11-11, "cramped up narrowly with no breathing room")
  var GX = 160, GY = 48, LEAF_GAP = 120, M = 28;
  var COL_W = 460, COL_GAP = 32, PAD = 32, COL_MAX = 4, SCREEN_W = 1600, SCREEN_H = 850, STEP_W = COL_W + PAD, CGX = 170, CGY = 56, BGY = 96, STUB = 28, GRID_COL = 220;

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
  // a block's branch fill: brN, with pale for the tint (outline.js HUES)
  function brc(o){ return o.br ? ' br' + o.br + (o.pale ? ' pale' : '') : ''; }
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
    // every chip row in a box starts at one indent, the words of a ① or ※ line, whatever the depth of the line
    // it follows (Jonan 2026-11-11, "the chip indents are inconsistent in this box")
    var pad = ts[0].off ? ' style="--p:' + ts[0].off + 'px"' : '';
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

  // a square line through the points with each corner rounded (radius up to 10), as on the whiteboard
  function rpath(pts){
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], b = pts[i], c = pts[i + 1];
      var l1 = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]), l2 = Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]);
      var r = Math.min(10, l1 / 2, l2 / 2);
      if (r < 0.5) { d += ' L' + b[0] + ' ' + b[1]; continue; }
      var ux = Math.sign(b[0] - a[0]), uy = Math.sign(b[1] - a[1]), vx = Math.sign(c[0] - b[0]), vy = Math.sign(c[1] - b[1]);
      d += ' L' + (b[0] - ux * r) + ' ' + (b[1] - uy * r) + ' Q' + b[0] + ' ' + b[1] + ' ' + (b[0] + vx * r) + ' ' + (b[1] + vy * r);
    }
    var e = pts[pts.length - 1];
    return '<path d="' + d + ' L' + e[0] + ' ' + e[1] + '"/>';
  }
  // a block's text runs in columns of one reading width (COL_W), side by side under its title, so a long block
  // grows wide rather than tall without making its lines longer; the browser balances the columns. Each option
  // keeps its ・ lines and trials with it, and a plain heading line keeps with the option below it.
  // How many columns each block takes is chosen so the whole map comes out the shape of a PC screen (fitTo)
  // (Jonan 2026-11-11, "the optimal box height/width ratio to allow as much of the map to fit on a typical pc screen")
  function hasGrid(ls){ return ls.some(function(l){ return l.kind === 'grid'; }); }
  function colsHtml(ls){
    if (hasGrid(ls)) return linesHtml(ls);
    var groups = [], cur = null, head = false;
    ls.forEach(function(l){
      var top = !l.level && l.kind !== 'sub' && l.kind !== 'trial' && l.kind !== 'grid';
      if (!cur || (top && !(head && l.kind !== 'text'))) { cur = []; groups.push(cur); head = top && l.kind === 'text'; }
      else if (top) head = false;
      cur.push(l);
    });
    return '<div class="cols">' + groups.map(function(g){ return '<div class="grp">' + linesHtml(g) + '</div>'; }).join('') + '</div>';
  }
  function colsWidth(n){ return n * COL_W + (n - 1) * COL_GAP + PAD + 1; }
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
    // every text block, with the width it takes at n columns; a block with a grid keeps one column
    var blocks = [];
    function sized(el, ls, set){
      var b = {el: el, grid: hasGrid(ls), set: set, n: 1, h1: 0};
      b.width = function(n){ return b.grid ? widthFor(ls, STEP_W) + (n - 1) * (COL_W + COL_GAP) : colsWidth(n); };
      var box = el.querySelector('.cols');
      function put(n){ b.n = n; var w = b.width(n); el.style.width = w + 'px'; set(w); }
      // a block takes n columns only when every column gets text and the columns come out near even (the tallest
      // within a quarter of an even share), otherwise one column fewer: a block is never wider than its text
      // (Jonan 2026-11-11, "boxes are widened but without any text filling the space")
      b.cols = function(n){
        el.classList.remove('one');
        // a block with a grid widens as a whole while each step makes it at least a seventh shorter
        if (b.grid) {
          put(1); var k = 1, h = el.offsetHeight;
          while (k < n) { put(k + 1); var h2 = el.offsetHeight; if (h2 > 0.85 * h) break; k++; h = h2; }
          put(k); return;
        }
        if (!box) { put(1); return; }
        for (n = Math.max(1, n); n > 1; n--) {
          put(n);
          var xs = {}; Array.prototype.forEach.call(box.children, function(g){ xs[g.offsetLeft] = 1; });
          if (Object.keys(xs).length === n && box.offsetHeight <= 1.25 * b.c1 / n) return;
        }
        put(1);
      };
      // a band can instead give each numbered option or ※ group a column of its own, tops aligned
      // (Jonan 2026-11-11: no option spilling under another, no lone ※ column)
      b.groups = box ? box.children.length : 0;
      b.split = function(){ b.cols(1); el.classList.add('one'); put(b.groups); };
      put(1); b.c1 = box ? box.offsetHeight : 0; blocks.push(b); return b;
    }
    var course = !!model.tree.course, steps = course ? model.tree.children : null, elabs = [];
    var plabs = {};   // labels on panel next: lines, made once and moved on each layout
    if (course) {
      nodes = steps;
      steps.forEach(function(n){
        n.el = add('step' + brc(n), '<div class="box lbl hd"><span>' + keep(n.label) + '</span></div>' + colsHtml(n.lines));
        n.hd = n.el.firstChild;
        sized(n.el, n.lines, function(w){ n.w = w; });
      });
      // join: lines to one step with one label carry that label once, on their shared line
      var joinLab = {};
      steps.forEach(function(n){ n.next.forEach(function(e){
        if (!e.label) return;
        // a step whose lines out all carry one label shows it once, on the stem before the lines divide
        if (!e.join && n.next.some(function(o){ return o !== e && !o.join && o.label === e.label; })) {
          e.shared = true;
          if (n.next.filter(function(o){ return !o.join && o.label === e.label; })[0] !== e) return;
        }
        if (e.join) { var key = e.to + '|' + e.label; if (joinLab[key]) { joinLab[key].push(e); return; } joinLab[key] = [e]; e.joins = joinLab[key]; }
        e.el = add('elab', keep(e.label));
      }); });
    } else nodes.forEach(function(n){
      n.el = add('box lbl' + (n.depth ? '' : ' root') + brc(n), keep(n.label));
      if (n.lines.length) { n.leaf = add('leaf' + brc(n), colsHtml(n.lines)); sized(n.leaf, n.lines, function(w){ n.leafW = w; }); leaves.push(n); }
    });
    // no title block: the map opens on the flowsheet itself (Jonan 2026-11-11, "remove the title altogether"),
    // and no colour key either: the risk grid names its rows (Jonan 2026-11-11, "I also don't need this")
    var tblk = null;
    var bands = model.bands.map(function(b){
      var el = add('band', '<h2>' + esc(b.title) + '</h2>' + colsHtml(b.lines));
      sized(el, b.lines, function(w){ el.w = w; }).band = true; return el;
    });
    var panels = model.panels.map(function(p){
      p.el = add('panel' + (hasGrid(p.lines) ? ' open' : '') + brc(p), '<h2>' + esc(p.title) + '</h2>' + colsHtml(p.lines));
      sized(p.el, p.lines, function(w){ p.w = w; });
      return p;
    });

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
      // a line may pass a column (a step that also leads to later steps, as second line to the biomarker steps
      // and to the standard refractory step); it runs through a gap left for it in that column
      // only through a column of two or more steps, so the line has a gap between them
      var size = []; steps.forEach(function(n){ size[n.col] = (size[n.col] || 0) + 1; });
      return steps.every(function(n){ return n.next.every(function(e){
        if (e.node.col <= n.col) return false;
        for (var c = n.col + 1; c < e.node.col; c++) if (size[c] < 2) return false;
        return true;
      }); });
    }
    var board = boardShape();
    function layoutOnce(){
      if (board) layoutBoard(); else if (course) layoutCourse(); else layoutTree();
      finish();
    }
    // the map is laid out to show as large as it can on a PC screen: a 1920 x 1080 screen leaves a map area of
    // about SCREEN_W x SCREEN_H beside the site's sidebar (16:9 in full screen). Each block takes the number of
    // columns that makes it about r times as tall as it is wide; of a range of r, the layout whose whole map
    // fits that area at the largest scale is kept, which brings most maps near 0.55 height to width
    function layout(){
      blocks.forEach(function(b){ b.cols(1); b.h1 = b.el.offsetHeight; b.c1 = b.el.querySelector('.cols') ? b.el.querySelector('.cols').offsetHeight : 0; });
      function shape(r){
        // the bands start at one column and widen in bandsRow to the width of the map below them
        blocks.forEach(function(b){ b.cols(b.band ? 1 : Math.max(1, Math.min(COL_MAX, Math.round(Math.sqrt(b.h1 / (r * b.width(1))))))); });
        layoutOnce();
      }
      var best = null;
      for (var r = 0.08; r < 4; r *= 1.5) {
        shape(r);
        var fit = Math.min(SCREEN_W / W, SCREEN_H / H);
        if (!best || fit > best.fit + 1e-4) best = {r: r, fit: fit};
      }
      shape(best.r);
    }
    var svg = '';

    function bandsRow(span, split){
      if (tblk) { tblk.style.left = M + 'px'; tblk.style.top = M + 'px'; }
      var bx = M, bandH = 0, top = M + (tblk ? tblk.offsetHeight + 28 : 0);
      // the bands share one row; while the row is narrower than the map below it, the tallest band takes
      // another column, so the bands come out about the same depth and fill the width
      if (span && bands.length) {
        var bb = blocks.filter(function(b){ return bands.indexOf(b.el) >= 0; });
        var rowW = function(){ return bb.reduce(function(t, b){ return t + b.width(b.n); }, 0) + 40 * (bb.length - 1); };
        bb.forEach(function(b){ b.full = false; });
        // on a board, first every band with two to four groups takes one column per group, tallest first, while the row fits
        if (split) bb.filter(function(b){ return !b.grid && b.groups > 1 && b.groups <= COL_MAX; })
          .sort(function(x, y){ return y.el.offsetHeight - x.el.offsetHeight; })
          .forEach(function(b){ if (rowW() + (b.groups - b.n) * (COL_W + COL_GAP) <= span) { b.split(); b.full = true; } });
        for (var guard = 0; guard < 24; guard++) {
          var tall = bb.filter(function(b){ return !b.grid && !b.full && b.n < COL_MAX; }).sort(function(x, y){ return y.el.offsetHeight - x.el.offsetHeight; })[0];
          if (!tall || rowW() + COL_W + COL_GAP > span) break;
          var was = tall.n; tall.cols(was + 1);
          if (tall.n === was) tall.full = true;
        }
      }
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
      steps.forEach(function(n){ (cols[n.col] = cols[n.col] || []).push(n); n.el.style.width = n.w + 'px'; n.hd.style.minHeight = ''; n.el.style.minHeight = ''; });
      // a step widens until no unbreakable run (a long tag, a chip) spills past its edge
      steps.forEach(function(n){ var over = n.el.scrollWidth - n.el.clientWidth; if (over > 0) { n.w += over + 4; n.el.style.width = n.w + 'px'; } });
      // each gap has a stub before the upright and a stub after it. A label widens only its own side, so a step
      // sits on its line with stubs of equal length either side (Jonan 2026-11-11, restaging box on rectal)
      var gapL = cols.map(function(){ return BG / 2; }), gapR = cols.map(function(){ return BG / 2; });
      steps.forEach(function(n){ n.next.forEach(function(e){
        if (!e.el) return;
        var t = e.node, need = e.el.offsetWidth + 24;
        if (t.preds.length < 2 && !e.shared) gapR[n.col] = Math.max(gapR[n.col], need); else gapL[n.col] = Math.max(gapL[n.col], need);
      }); });
      var gapW = cols.map(function(x, c){ return gapL[c] + gapR[c]; });
      var colX = [M], colW = cols.map(function(list){ return Math.max.apply(null, list.map(function(n){ return n.w; })); });
      cols.forEach(function(list, c){ colX[c + 1] = colX[c] + colW[c] + gapW[c]; });
      var width = colX[cols.length] - gapW[cols.length - 1] - M;
      // bands share one row above the columns, as on a course
      var b = bandsRow(width, true);
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
      // each later column is centred on the middles of the steps that lead into it, so a trunk runs evenly
      // above and below the box it leaves or enters (Jonan 2026-11-11, "asymmetric line branch placement").
      // A column that a line passes through is split about that line: the steps above and below come out
      // near even, and their outer middles sit at the same distance from it
      function hgt(n){ return n.el.offsetHeight; }
      // where lines join: with an odd number of lines the middle one runs straight on, otherwise the middle of the span
      function centreOf(ys){ ys = ys.slice().sort(function(a, z){ return a - z; }); return ys.length % 2 ? ys[ys.length >> 1] : (ys[0] + ys[ys.length - 1]) / 2; }
      function stack(list, y){ list.forEach(function(n){ n.y = y; n.cy = y + hgt(n) / 2; y += hgt(n) + SG; }); }
      function move(list, d){ list.forEach(function(n){ n.y += d; n.cy += d; }); }
      for (var c = 1; c < cols.length; c++) {
        var list = cols[c]; if (!list) continue;
        var ins = []; list.forEach(function(t){ t.preds.forEach(function(p){ ins.push(p.cy); }); });
        var pass = []; steps.forEach(function(n){ if (n.col < c) n.next.forEach(function(e){ if (e.node.col > c) pass.push(n.cy); }); });
        if (pass.length) {
          var ys = pass[0], GAP = 80, best = list.length > 1 ? 1 : 0, bd = Infinity;
          for (var k = 1; k < list.length; k++) {
            var up = list.slice(0, k).reduce(function(t, n){ return t + hgt(n); }, 0), dn = list.slice(k).reduce(function(t, n){ return t + hgt(n); }, 0);
            if (Math.abs(up - dn) < bd) { bd = Math.abs(up - dn); best = k; }
          }
          var U = list.slice(0, best), L = list.slice(best);
          if (U.length) { stack(U, 0); var ub = U[U.length - 1]; move(U, ys - GAP / 2 - (ub.y + hgt(ub))); }
          if (L.length) stack(L, ys + GAP / 2);
          if (U.length && L.length) {
            var dU = ys - U[0].cy, dL = L[L.length - 1].cy - ys;
            if (dU < dL) move(U, dU - dL); else move(L, dU - dL);
          }
        } else if (ins.length) {
          var one = list.every(function(t){ return t.preds.length === 1 && t.preds[0] === list[0].preds[0]; });
          var mid = list.length === 1 || one ? centreOf(ins) : (Math.min.apply(null, ins) + Math.max.apply(null, ins)) / 2;
          if (one && list.length > 1) {
            // the whole column is one step's fan: the middle step (or the middle gap) sits on the stem and each
            // pair above and below it at the same distance, so the stem runs straight through and the fan is even
            // The gaps between the boxes are all equal and each box keeps its own height, so an outer line may
            // run further on one side (Jonan 2026-11-11, rectal: "I just need the spacing between boxes to be symmetric")
            var m = list.length >> 1, odd = list.length % 2, hi = mid - SG / 2, lo = mid + SG / 2;
            if (odd) { var c0 = list[m]; c0.y = mid - hgt(c0) / 2; c0.cy = mid; hi = c0.y; lo = c0.y + hgt(c0); }
            for (var k = 1; k <= m; k++) {
              var u = list[m - k], l = list[odd ? m + k : m + k - 1];
              u.y = hi - SG - hgt(u); u.cy = u.y + hgt(u) / 2; l.y = lo + SG; l.cy = l.y + hgt(l) / 2;
              hi = u.y; lo = l.y + hgt(l);
            }
          } else move(list, mid - (list[0].cy + list[list.length - 1].cy) / 2);
        }
        // a step at the end of a single line moves level with its source, as far as the steps beside it in
        // the column allow, so the line runs straight and its label fits (Jonan 2026-11-11, early NSCLC:
        // "Why not just move the entire box down?")
        list.forEach(function(t, k){
          if (t.preds.length !== 1 || t.preds[0].next.length !== 1) return;
          var dy = t.preds[0].cy - t.cy, up = list[k - 1], dn = list[k + 1];
          if (dy > 0 && dn) dy = Math.min(dy, dn.y - SG - (t.y + hgt(t)));
          if (dy < 0 && up) dy = Math.max(dy, up.y + hgt(up) + SG - t.y);
          if (Math.abs(dy) > 0.5) move([t], dy);
        });
      }
      // a first step centres on the steps it leads to, as far as the steps beside it allow
      (cols[0] || []).forEach(function(n, k, list){
        if (!n.next.length) return;
        var dy = centreOf(n.next.map(function(e){ return e.node.cy; })) - n.cy, up = list[k - 1], dn = list[k + 1];
        if (dy > 0 && dn) dy = Math.min(dy, dn.y - SG - (n.y + hgt(n)));
        if (dy < 0 && up) dy = Math.max(dy, up.y + hgt(up) + SG - n.y);
        if (Math.abs(dy) > 0.5) move([n], dy);
      });
      var lift = b.top - Math.min.apply(null, steps.map(function(n){ return n.y; }));
      steps.forEach(function(n){ n.y += lift; n.cy += lift; n.el.style.top = n.y + 'px'; });
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
        var mid = colX[c] + colW[c] + gapL[c];
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
          var w = e.el.offsetWidth, h = e.el.offsetHeight, into = t.preds.length < 2 && !e.shared;
          // a label on a shared stem stays between the step and the upright where its lines divide
          if (e.shared) e.el.dataset.stop = e.xm; else delete e.el.dataset.stop;
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
      steps.forEach(function(n){ n.hd.style.minHeight = ''; });
      var cols = [];
      steps.forEach(function(n){ (cols[n.col] = cols[n.col] || []).push(n); });
      // the bands share the width of the step columns above them
      var span = cols.reduce(function(s, list){ return s + Math.max.apply(null, list.map(function(n){ return n.w; })); }, 0) + CGX * (cols.length - 1);
      var b = bandsRow(span);
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
            // lines leave and enter a step at the middle of the whole box, so boxes centre on each other
            // (Jonan 2026-11-11, "centre the lines with the boxes for a more symmetrical feel")
            n.hh = n.el.offsetHeight;
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
        // a step whose line runs to a step that was pushed lower (a taller step, or one below another in its
        // column) moves down level with it, so boxes centre on each other and the line runs straight: a step
        // with one line, or the top branch of a step that divides. When a step below is in the way, the step
        // keeps that floor and the group is placed again, pushing the steps below down. Right to left, so a
        // move can carry on to the left
        var pushed = false;
        for (var c = cols.length - 1; c >= 0; c--) {
          var mine = cols[c].filter(function(n){ return n.group === gi; }).sort(function(a, z){ return a.y - z.y; });
          mine.forEach(function(n, k){
            var own = n.next.filter(function(e){ return !e.join; });
            if (!own.length) return;
            // the step it centres on: the middle of three or more branches, else the top one
            var srt = own.slice().sort(function(a, z){ return a.node.cy - z.node.cy; });
            var t = (srt.length >= 3 && srt.length % 2 ? srt[(srt.length - 1) >> 1] : srt[0]).node;
            if (t.preds.length !== 1) return;
            var dy = t.cy - n.cy, below = mine[k + 1];
            if (dy <= 0.5) return;
            if (n.preds.some(function(p){ return p.next.length === 1 && Math.abs(p.cy - n.cy) < 1; })) return;
            if (below && n.y + dy + n.el.offsetHeight + CGY > below.y) {
              if (n.y + dy > n.minTop + 0.5) { n.minTop = n.y + dy; pushed = true; }
              return;
            }
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
        if (!moved && !pushed) break;
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
            svg += rpath([[x1, n.cy], [xm, n.cy], [xm, lane], [xb, lane], [xb, t.cy], [x2, t.cy]]);
          } else {
            // the course spine (a straight next: line) is drawn heavier than the lines that branch off it
            svg += rpath([[x1, n.cy], [xm, n.cy], [xm, t.cy], [x2, t.cy]]);
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

    // straight runs of the lines as drawn: M, H, V and L commands of paths, and lines; a Q (a rounded corner)
    // only moves the pen, so a run ends where its corner starts to turn
    function wireSegs(){
      var segs = [], re = /<path[^>]* d="([^"]*)"|<line x1="([^"]*)" y1="([^"]*)" x2="([^"]*)" y2="([^"]*)"/g, m;
      function put(x1, y1, x2, y2){
        if (Math.abs(y1 - y2) < 0.5 && Math.abs(x1 - x2) > 0.5) segs.push({h:true, k:y1, a:Math.min(x1, x2), b:Math.max(x1, x2)});
        else if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) > 0.5) segs.push({h:false, k:x1, a:Math.min(y1, y2), b:Math.max(y1, y2)});
      }
      while ((m = re.exec(svg))) {
        if (m[2] !== undefined) { put(+m[2], +m[3], +m[4], +m[5]); continue; }
        if (/[CA]/.test(m[1])) continue;
        var x = 0, y = 0, c, cre = /([MHVLQ])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s+(-?[\d.]+)\s+(-?[\d.]+))?/g;
        while ((c = cre.exec(m[1]))) {
          var v = +c[2];
          if (c[1] === 'M') { x = v; y = +c[3]; }
          else if (c[1] === 'H') { put(x, y, v, y); x = v; }
          else if (c[1] === 'V') { put(x, y, x, v); y = v; }
          else if (c[1] === 'L') { put(x, y, v, +c[3]); x = v; y = +c[3]; }
          else { x = +c[4]; y = +c[5]; }
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
      // an upright that crosses the run, or turns off it on a rounded corner (a T where lines divide), ends it
      segs.forEach(function(s){ if (s.h !== h && s.a <= k + 12 && s.b >= k - 12) stop(s.k); });
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
      var textX = colX[maxDepth] + colW[maxDepth] + LEAF_GAP;
      nodes.forEach(function(n){ n.el.style.width = colW[n.depth] + 'px'; n.h = n.el.offsetHeight; n.x = colX[n.depth]; });

      // panels a little wider than on a course map, and the bands in one row above the tree, sharing its width
      var leafR = leaves.reduce(function(m, n){ return Math.max(m, n.leafW); }, 0);
      var spanR = textX + leafR + 240 + panels.reduce(function(m, p){ return Math.max(m, p.w); }, 0);
      var b0 = bandsRow(spanR - M), bx = b0.x, treeTop = b0.top;

      // vertical extents, bottom up: up/down from the node's own centre
      (function ext(n){
        if (!n.children.length) {
          var lh = n.leaf ? n.leaf.offsetHeight : 0;
          // the text box is centred on its label, so the line enters it at its middle
          n.up = n.down = Math.max(n.h / 2, lh / 2); return;
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
        if (n.leaf) { n.leaf.style.left = textX + 'px'; n.leaf.style.top = (cy - n.leaf.offsetHeight / 2) + 'px'; }
        n.children.forEach(function(c){ place(c, cy + c.off - (n === root ? lift : 0)); });
      })(root, treeTop + (k0 ? Math.max(root.h / 2, k0.up) : root.up));

      // wires: parent right edge to child left edge; a shallow leaf runs on to the text column
      svg = '';
      nodes.forEach(function(n){
        // square lines: across from the parent, down the gap, across to each child
        var px = n.x + colW[n.depth], gx = px + GX / 2;
        n.children.forEach(function(c){ svg += rpath([[px, n.cy], [gx, n.cy], [gx, c.cy], [c.x, c.cy]]); });
        if (n.leaf) svg += '<line x1="' + (n.x + colW[n.depth]) + '" y1="' + n.cy + '" x2="' + textX + '" y2="' + n.cy + '"/>';
      });

      // panels: a brace over their node's span, the panels stacked beside it
      // panels: a brace over their node's span, and from its tip one line that forks into each panel of the group.
      // A group whose node holds another group's node sits one brace further right, so nested braces never overlap
      // (Jonan 2026-11-11, "why are there so many lines")
      var groups = [];
      nodes.forEach(function(n){
        var ps = panels.filter(function(p){ return p.join === n.label; });
        if (ps.length) groups.push({n:n, ps:ps});
      });
      var holds = function(a, b){ var f = false; (function w(x){ if (x === b) f = true; x.children.forEach(w); })(a); return a !== b && f; };
      groups.forEach(function(g){ g.lvl = 0; });
      groups.forEach(function(g){ groups.forEach(function(h){ if (holds(g.n, h.n)) g.lvl = Math.max(g.lvl, h.lvl + 1); }); });
      var maxLvl = groups.reduce(function(m, g){ return Math.max(m, g.lvl); }, 0);
      var braceX = textX + leafR + 56, BSTEP = 36, panelX = braceX + maxLvl * BSTEP + 120, lastBottom = treeTop - 32, right = panelX + panels.reduce(function(m, p){ return Math.max(m, p.w); }, 0);
      var loose = panels.filter(function(p){ return !p.join; });
      groups.forEach(function(g){
        var y1 = g.n.cy - g.n.up, y2 = g.n.cy + g.n.down, mid = (y1 + y2) / 2, bx = braceX + g.lvl * BSTEP;
        var gh = g.ps.reduce(function(s, p){ return s + p.el.offsetHeight; }, 0) + 32 * (g.ps.length - 1);
        var y = Math.max(lastBottom + 32, mid - gh / 2);
        var hys = g.ps.map(function(p){ p.el.style.left = panelX + 'px'; p.el.style.top = y + 'px'; var hy = y + p.el.offsetHeight / 2; y += p.el.offsetHeight + 32; return hy; });
        lastBottom = y - 32;
        svg += '<path d="' + bracePath(bx, y1, y2, 9) + '"/>';
        // tip to a fork in the gap before the panels, then across to each panel's title
        var fx = panelX - 40, lo = Math.min.apply(null, hys.concat(mid)), hi = Math.max.apply(null, hys.concat(mid));
        hys.forEach(function(hy){ svg += rpath([[bx + 18, mid], [fx, mid], [fx, hy], [panelX, hy]]); });
      });
      loose.forEach(function(p){ p.el.style.left = panelX + 'px'; p.el.style.top = (lastBottom + 32) + 'px'; lastBottom += 32 + p.el.offsetHeight; });

      // a panel's next: line leaves its header to the right, runs down beside the panel column and enters the
      // named panel's header; lines to one panel with one label share an upright and one label
      var colR = panels.reduce(function(m, p){ return Math.max(m, p.el.offsetLeft + p.el.offsetWidth); }, 0), lanes = [];
      panels.forEach(function(p){ (p.next || []).forEach(function(e){
        var t = panels.filter(function(q){ return q.title === e.to; })[0];
        if (!t) return;
        var L = lanes.filter(function(l){ return l.t === t && l.label === e.label; })[0];
        if (!L) { L = {t:t, label:e.label, src:[], x:colR + 60 + 40 * lanes.length}; lanes.push(L); }
        L.src.push(p);
      }); });
      lanes.forEach(function(L){
        var hy = function(p){ return p.el.offsetTop + p.el.offsetHeight / 2; };
        var ty = hy(L.t), ys = L.src.map(hy), lo = Math.min.apply(null, ys.concat(ty)), hi = Math.max.apply(null, ys.concat(ty));
        var tx = L.t.el.offsetLeft + L.t.el.offsetWidth;
        L.src.forEach(function(p, i){ svg += rpath([[p.el.offsetLeft + p.el.offsetWidth, ys[i]], [L.x, ys[i]], [L.x, ty], [tx, ty]]); });
        if (L.label) {
          var key = L.t.title + '|' + L.label, el = plabs[key] || (plabs[key] = add('elab', keep(L.label)));
          el.style.whiteSpace = 'nowrap'; el.style.maxWidth = 'none';
          // the label sits on the upright, centred on its whole run
          el.style.left = (L.x - el.offsetWidth / 2) + 'px';
          el.style.top = ((lo + hi) / 2 - el.offsetHeight / 2) + 'px';
        }
      });

    }

    /* ---- pan and zoom ---- */
    var st = {s:1, x:0, y:0}, fitS = 1, saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('oncos-map-view-' + opts.id) || 'null'); } catch(e){}
    function size(){
      var r = view.getBoundingClientRect();
      // full screen: the canvas runs to the foot of the window
      var h = document.documentElement.classList.contains('om-full') ? window.innerHeight - Math.max(0, r.top) :
        Math.max(360, window.innerHeight - Math.max(0, r.top) - 12);
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
