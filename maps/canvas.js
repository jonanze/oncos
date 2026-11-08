/* oncOS board maps: draws an outline (maps/outline.js) as a pan and zoom canvas.
   Layout is computed, never placed by hand:
   - one column per tree level, every label in a column one width
   - siblings at even centre spacing, each parent centred on its first and last child
   - leaf text in one column to the right of the deepest labels
   - bands above the tree; panels beside the tree, joined by a brace to their node
   A course: map is drawn in time order instead:
   - each step one column right of the latest step that leads to it; a step nothing leads to
     sits one column before the step it leads to
   - a step sits level with the steps that lead to it, pushed down to clear the step above
   - next: lines are drawn as ruled elbows, their label above the line
   - a panel sits below its step's column
   window.oncosCanvas.render(host, model, opts) returns {fit, resize, destroy}. */
(function(){
  var GX = 56, GY = 22, LEAF_W = 500, PANEL_W = 460, BAND_W = 560, M = 28;
  var STEP_W = 440, CGX = 150, CGY = 36;
  var CLS_NAME = {os:'OS benefit', sur:'Surrogate only', neg:'No benefit or harm'};

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  // Hyphenated terms and ranges stay on one line: "PD-L1", "5-year", "1–49%".
  function keep(s){ return esc(s).replace(/(\S*\S[-–]\S+)/g, '<span class="nw">$1</span>'); }

  function lineHtml(l){
    var pad = l.level ? ' style="padding-left:' + (1.15 * l.level) + 'em"' : '';
    if (l.kind === 'trial') {
      var name = esc(l.name), cls = 'trial c-' + l.cls;
      var a = l.anchor
        ? '<span class="' + cls + '" role="button" tabindex="0" data-ev="' + esc(l.anchor) + '">' + name + '</span>'
        : '<a class="' + cls + '" href="https://pubmed.ncbi.nlm.nih.gov/' + esc(l.pmid) + '/" target="_blank" rel="noopener">' + name + '</a>';
      return '<div class="ln tr"' + pad + '>' + a + (l.fig ? '<span class="fig"> · ' + keep(l.fig) + '</span>' : '') + '</div>';
    }
    if (l.kind === 'tx') return '<div class="ln tx"' + pad + '>' + keep(l.text) + '</div>';
    if (l.kind === 'cv') return '<div class="ln cv"' + pad + '>※ ' + keep(l.text) + '</div>';
    if (l.kind === 'se') return '<div class="ln se"' + pad + '>' + keep(l.text) + '</div>';
    if (l.kind === 'num') return '<div class="ln num"' + pad + '><span class="n">' + esc(l.n) + '</span>' + keep(l.text) + '</div>';
    return '<div class="ln text"' + pad + '>' + keep(l.text) + '</div>';
  }
  function linesHtml(ls){ return ls.map(lineHtml).join(''); }

  function bracePath(x, y1, y2, d){
    var m = (y1 + y2) / 2, k = Math.min(6, (y2 - y1) / 4);
    return 'M'+x+' '+y1+' Q'+(x+d)+' '+y1+' '+(x+d)+' '+(y1+k)+' L'+(x+d)+' '+(m-k)+' Q'+(x+d)+' '+m+' '+(x+2*d)+' '+m+
           ' Q'+(x+d)+' '+m+' '+(x+d)+' '+(m+k)+' L'+(x+d)+' '+(y2-k)+' Q'+(x+d)+' '+y2+' '+x+' '+y2;
  }

  function render(host, model, opts){
    opts = opts || {};
    var O = window.oncosOutline;
    host.innerHTML = '<div class="om-view" tabindex="0" aria-label="Board map"><div class="om-world om-sheet"><svg class="om-wires" aria-hidden="true"></svg></div></div>';
    var view = host.firstChild, world = view.firstChild, wires = world.firstChild;
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
        n.el = add('step', '<div class="box lbl hd">' + keep(n.label) + '</div>' + linesHtml(n.lines), STEP_W);
        n.hd = n.el.firstChild;
      });
      steps.forEach(function(n){ n.next.forEach(function(e){ if (e.label) e.el = add('elab', keep(e.label), CGX - 36); }); });
    } else nodes.forEach(function(n){
      n.el = add('box lbl' + (n.depth ? '' : ' root'), keep(n.label));
      if (n.lines.length) { n.leaf = add('leaf', linesHtml(n.lines), LEAF_W); leaves.push(n); }
    });
    var bands = model.bands.map(function(b){ return add('band', '<h2>' + esc(b.title) + '</h2>' + linesHtml(b.lines), BAND_W); });
    var key = add('key', '<h2>Trial result</h2>' + ['os', 'sur', 'neg'].map(function(c){
      return '<div class="ln"><span class="sw c-' + c + '"></span>' + CLS_NAME[c] + '</div>'; }).join(''));
    var panels = model.panels.map(function(p){ p.el = add('panel', '<h2>' + esc(p.title) + '</h2>' + linesHtml(p.lines), PANEL_W); return p; });

    var W = 0, H = 0;
    function layout(){ if (course) layoutCourse(); else layoutTree(); finish(); }
    var svg = '';

    function bandsRow(){
      var bx = M, bandH = 0;
      bands.forEach(function(el){ el.style.left = bx + 'px'; el.style.top = M + 'px'; bx += BAND_W + 40; bandH = Math.max(bandH, el.offsetHeight); });
      return {x:bx, top:M + (bands.length ? bandH + 48 : 0)};
    }

    function layoutCourse(){
      svg = '';
      var by = {}, i;
      steps.forEach(function(n, k){ by[n.label] = n; n.k = k; n.preds = []; n.col = null; });
      steps.forEach(function(n){ n.next.forEach(function(e){ e.node = by[e.to]; e.node.preds.push(n); }); });
      function col(n){ if (n.col === null) { n.col = 0; n.preds.forEach(function(p){ n.col = Math.max(n.col, col(p) + 1); }); } return n.col; }
      steps.forEach(col);
      steps.forEach(function(n){
        if (n.preds.length || !n.next.length) return;
        n.col = Math.max(n.col, Math.min.apply(null, n.next.map(function(e){ return e.node.col; })) - 1);
      });
      var b = bandsRow(), cols = [];
      steps.forEach(function(n){ (cols[n.col] = cols[n.col] || []).push(n); });
      var panelTop = [];
      cols.forEach(function(list, c){
        var x = M + c * (STEP_W + CGX), cursor = b.top;
        list.forEach(function(n){
          n.hh = n.hd.offsetHeight;
          n.want = n.preds.length ? n.preds.reduce(function(s, p){ return s + p.cy; }, 0) / n.preds.length : Infinity;
        });
        list.sort(function(a, z){ return a.want === z.want ? a.k - z.k : a.want - z.want; });
        list.forEach(function(n){
          var top = n.want === Infinity ? cursor : Math.max(cursor, n.want - n.hh / 2);
          n.x = x; n.y = top; n.cy = top + n.hh / 2;
          n.el.style.left = x + 'px'; n.el.style.top = top + 'px';
          cursor = top + n.el.offsetHeight + CGY;
        });
        panelTop[c] = cursor + 12;
      });
      steps.forEach(function(n){
        n.next.forEach(function(e){
          var t = e.node, x1 = n.x + STEP_W, xm = x1 + 24, x2 = t.x;
          if (t.col - n.col > 1) xm = x2 - CGX + 24;
          svg += '<path d="M' + x1 + ' ' + n.cy + ' H' + xm + ' V' + t.cy + ' H' + x2 + '"/>';
          if (e.el) { e.el.style.left = (xm + 8) + 'px'; e.el.style.top = (t.cy - e.el.offsetHeight - 3) + 'px'; }
        });
      });
      var right = M + cols.length * (STEP_W + CGX) - CGX, loose = b.top;
      panels.forEach(function(p){
        p.el.style.width = STEP_W + 'px';
        var n = p.join && by[p.join];
        if (n) { p.el.style.left = n.x + 'px'; p.el.style.top = panelTop[n.col] + 'px'; panelTop[n.col] += p.el.offsetHeight + CGY; }
        else { p.el.style.left = (right + CGX) + 'px'; p.el.style.top = loose + 'px'; loose += p.el.offsetHeight + CGY; }
      });
      key.style.left = Math.max(b.x, right - key.offsetWidth) + 'px'; key.style.top = M + 'px';
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

      // bands, then the key, in one row above the tree
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
        n.children.forEach(function(c){ svg += '<line x1="' + (n.x + colW[n.depth]) + '" y1="' + n.cy + '" x2="' + c.x + '" y2="' + c.cy + '"/>'; });
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

      // the key sits top right, above the panels
      key.style.left = Math.max(bx, right - key.offsetWidth) + 'px'; key.style.top = M + 'px';
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

    function start(){
      layout(); size();
      if (saved && saved.s) { st = saved; saved = null; apply(); } else fit();
    }
    start();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ var s = JSON.stringify(st); layout(); size(); st = JSON.parse(s); apply(); });
    return {
      fit: fit,
      resize: function(){ size(); apply(); },
      world: world,
      destroy: function(){ host.innerHTML = ''; }
    };
  }
  window.oncosCanvas = {render: render};
})();
