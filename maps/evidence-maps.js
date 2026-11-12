/* oncOS board maps inside the Evidence view.

   A sheet listed in MAPS gets a ruled Trials | Map tab pair above its trial
   table. Map draws that sheet's board map in place of the table, with the
   sidebar, masthead and theme unchanged. The location is the view's own
   /evidence/?group=<sheet> with the anchor #map, so back, forward, reload and
   shared links work through the shell's location contract.

   The Evidence view names this file as one it needs, and the shell loads it
   before the view's script runs (2.2.42; before that it sat in the shell head):
   it wraps window.oncosView.navigation as the view sets it, so that the shell's
   first navigation.open() already understands #map. It follows the view through
   the shell's oncos:view-mounted and the view's oncos:evidence-render events.

   A map lives in /maps/<id>/map.txt, an outline drawn by /maps/canvas.js as a
   pan and zoom canvas; its trial cards and live figures are read from the
   Evidence rows in /data/evidence.json, the file the view itself reads, and the
   title block carries that file's publish date. A new map = a new folder with map.txt + one line in MAPS.
   Run node maps/check.cjs and node maps/render-check.cjs before every draft and release. */
(function(){
  var MAPS = {
    'Advanced CRC': 'advanced-colon',
    'Advanced NSCLC': 'nsclc',
    'Advanced Prostate': 'prostate',
    'Early & Locally Adv NSCLC': 'early-nsclc',
    'Early CRC': 'early-colon',
    'Endometrial Cancer': 'endometrial',
    'Head & Neck SCC': 'hnscc',
    'Localized Gastroesophageal': 'gastro-oesophageal',
    'Rectal Cancer': 'rectal',
    'Mesothelioma': 'mesothelioma',
    'Nasopharyngeal Carcinoma': 'npc',
    'SCLC': 'sclc'
  };
  var ANCHOR = 'map';
  var has = function(sheet){ return !!sheet && Object.prototype.hasOwnProperty.call(MAPS, sheet); };

  var view = null;        // the active window.oncosView
  var mapSheet = null;    // sheet whose map is showing, or null for the trial table
  var loaded = {};        // id -> Promise of sheet markup
  var drawn = null;       // id currently drawn in the pane

  // The map styles load with the first map shown, not with every Evidence visit.
  var css = null;
  function styles(){
    if (css) return;
    css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = '/maps/map.css';
    document.head.appendChild(css);
  }

  /* ---- hook the Evidence view's navigation ---- */
  function wrapNav(n){
    return {
      read: function(){
        var t = n.read();
        if (mapSheet && t.group === mapSheet && !t.record) t.anchor = ANCHOR;
        else if (mapSheet) { mapSheet = null; schedule(); }
        return t;
      },
      open: function(target){
        var m = !!target && target.anchor === ANCHOR && has(target.group) && !target.record;
        var t = target;
        if (target && target.anchor === ANCHOR) { t = {}; for (var k in target) if (k !== 'anchor') t[k] = target[k]; }
        mapSheet = m ? target.group : null;
        sync();
        var ok = n.open(t);
        if (!ok && mapSheet) { mapSheet = null; sync(); }
        return ok;
      }
    };
  }
  function hookView(v){
    var nav;
    Object.defineProperty(v, 'navigation', {configurable:true, enumerable:true,
      get: function(){ return nav; },
      set: function(n){ nav = n && n.read && n.open ? wrapNav(n) : n; }});
  }
  var cur = window.oncosView;
  Object.defineProperty(window, 'oncosView', {configurable:true, enumerable:true,
    get: function(){ return cur; },
    set: function(v){
      cur = v;
      // The shell sets the same view object again when it returns to a kept view.
      if (v && v.name === 'evidence' && v !== view) { view = v; mapSheet = null; drawn = null; hookView(v); }
    }});

  // Back and forward: decide from the entry's own URL before the shell restores it.
  window.addEventListener('popstate', function(){
    var u = new URL(location.href), g = u.searchParams.get('group');
    mapSheet = /^\/evidence\/?$/.test(u.pathname) && u.hash === '#' + ANCHOR && has(g) ? g : null;
    sync();
  }, true);

  // A sheet chosen in the sidebar, or All trials, opens its trial table.
  document.addEventListener('click', function(e){
    if (mapSheet && e.target.closest && e.target.closest('.sheets button, #showall')) { mapSheet = null; sync(); }
  }, true);

  /* ---- tabs and pane ---- */
  function activeSheet(){
    var b = document.querySelector('.sheets button.active');
    return b ? (b.dataset.sheet || b.textContent.trim()) : null;
  }
  function inEvidence(){ return document.documentElement.getAttribute('data-view') === 'evidence' && view && window.oncosView === view; }

  function show(on){
    var sheet = activeSheet();
    if (!has(sheet) || !view || !view.navigation) return;
    if (on === (mapSheet === sheet)) return;
    closeCard();
    mapSheet = on ? sheet : null;
    var url = window.oncosLocations.href('evidence', view.navigation.read(), location.origin);
    history.pushState({v:'evidence'}, '', url);
    sync();
    window.scrollTo(0, 0);
    var pane = document.getElementById('map');
    if (on && pane) { pane.tabIndex = -1; pane.focus({preventScroll:true}); }
  }

  function bar(top){
    var el = top.querySelector('.om-bar');
    if (el) return el;
    styles();
    el = document.createElement('div');
    el.className = 'om-bar';
    el.innerHTML = '<div class="wl-tabs" role="tablist" aria-label="Sheet view">' +
      '<button type="button" class="wl-tab" role="tab" data-om="trials">Trials</button>' +
      '<button type="button" class="wl-tab" role="tab" data-om="map">Map</button></div>' +
      '<button type="button" class="om-fit" hidden>Fit</button>' +
      '<button type="button" class="om-fit om-fs-on" hidden>Full screen</button>';
    el.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.om) show(b.dataset.om === 'map');
      else if (b.classList.contains('om-fs-on')) full(true);
      else if (b.classList.contains('om-fit')) { if (ctrl) ctrl.fit(); }
    });
    top.appendChild(el);
    return el;
  }

  function sync(){
    var top = document.querySelector('.viewfrag .topbar');
    var results = document.getElementById('results');
    if (!top || !results || !inEvidence()) return;
    var sheet = activeSheet();
    var mapped = has(sheet);
    var el = top.querySelector('.om-bar');
    if (!mapped) {
      if (el) el.remove();
      setPane(results, null);
      return;
    }
    el = bar(top);
    // mapSheet can name the sheet a back or forward step is about to restore.
    var on = mapSheet === sheet;
    el.classList.toggle('on', on);
    el.querySelectorAll('.om-fit').forEach(function(b){ b.hidden = !on; });
    if (!on) full(false);
    el.querySelectorAll('.wl-tab').forEach(function(b){ b.setAttribute('aria-selected', String((b.dataset.om === 'map') === on)); });
    setPane(results, on ? MAPS[mapSheet] : null);
  }

  function setPane(results, id){
    var pane = document.getElementById('map');
    if (!id) {
      full(false);
      results.style.removeProperty('display');
      if (pane) pane.hidden = true;
      closeCard();
      return;
    }
    if (!pane) {
      pane = document.createElement('section');
      pane.id = 'map';
      pane.setAttribute('aria-label', 'Board map');
      results.parentNode.insertBefore(pane, results.nextSibling);
    }
    styles();
    results.style.setProperty('display', 'none');
    pane.hidden = false;
    if (drawn === id && pane.querySelector('.om-sheet')) { layout(); return; }
    drawn = id;
    pane.innerHTML = ''; ctrl = null;
    load(id).then(function(html){
      if (drawn !== id || !document.body.contains(pane)) return;
      draw(pane, id, html);
    }, function(){
      if (drawn === id) { drawn = null; pane.textContent = 'The map did not load.'; }
    });
  }

  function script(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  var engine = null;
  function load(id){
    if (loaded[id]) return loaded[id];
    engine = engine || Promise.all([window.oncosOutline || script('/maps/outline.js'), window.oncosCanvas || script('/maps/canvas.js')]);
    engine.catch(function(){ engine = null; });
    var txt = fetch('/maps/' + id + '/map.txt', {credentials:'same-origin'}).then(function(r){
      if (!r.ok) throw new Error(r.status); return r.text();
    });
    // The Evidence rows fill live figures; without them the map still draws, figures left blank.
    var ev = evidenceRows().catch(function(){ return null; });
    loaded[id] = Promise.all([txt, engine, ev]).then(function(v){ return {src: v[0], rows: v[2]}; });
    loaded[id].catch(function(){ delete loaded[id]; });
    return loaded[id];
  }

  /* ---- drawing ---- */
  var ctrl = null;
  function draw(pane, id, html){
    var model = window.oncosOutline.parse(html.src);
    window.oncosOutline.figures(model, html.rows);
    ctrl = window.oncosCanvas.render(pane, model, {id: id, figures: html.rows ? 'Evidence' + (rowsDate ? ' ' + rowsDate : ', live') : 'Evidence did not load'});
    var fs = document.createElement('div');
    fs.className = 'om-fs';
    fs.innerHTML = '<button type="button" data-fs="fit">Fit</button><button type="button" data-fs="close">Close</button>';
    fs.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.fs === 'fit') { if (ctrl) ctrl.fit(); } else full(false);
    });
    pane.appendChild(fs);
  }

  /* ---- full screen (Jonan 2026-11-11) ----
     The map pane covers the page. Where the browser allows it (desktop, iPad) the page also goes to the
     browser's own full screen; iPhone Safari allows that for video only, so there the pane covers the page
     with Safari's bars kept. The trial card still opens above the map. */
  var root = document.documentElement;
  function fsEl(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function full(on){
    if (on === root.classList.contains('om-full')) return;
    root.classList.toggle('om-full', on);
    try {
      var p = null;
      if (on && !fsEl()) { var req = root.requestFullscreen || root.webkitRequestFullscreen; if (req) p = req.call(root); }
      else if (!on && fsEl()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) p = ex.call(document); }
      if (p && p.catch) p.catch(function(){});
    } catch(err){}
    layout();
    var v = on && document.querySelector('#map .om-view');
    if (v) v.focus({preventScroll:true});
  }
  function fsChange(){ if (!fsEl() && root.classList.contains('om-full')) full(false); else layout(); }
  document.addEventListener('fullscreenchange', fsChange);
  document.addEventListener('webkitfullscreenchange', fsChange);
  function layout(){ if (ctrl && ctrl.world.offsetParent) ctrl.resize(); }
  window.addEventListener('resize', function(){ if (mapSheet) layout(); });

  /* ---- trial card ---- */
  var card = null, cardKey = null;
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function makeCard(){
    card = document.createElement('aside');
    card.id = 'om-card'; card.setAttribute('aria-live', 'polite');
    card.innerHTML = '<div class="hd"><span class="t"></span><button type="button" aria-label="Close">×</button></div><div class="cb"><table></table></div><a class="ev" hidden>Open the Evidence row</a>';
    card.querySelector('.hd button').addEventListener('click', closeCard);
    document.body.appendChild(card);
  }
  // Evidence rows: the one Evidence data file, shared with the view and the search;
  // its publish date is the date in the map title block.
  var rows = null, rowsDate = null;
  function evidenceRows(){
    if (rows) return rows;
    var load = window.oncosLoad ? window.oncosLoad('/data/evidence.json') :
      fetch('/data/evidence.json', {credentials:'same-origin'}).then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); });
    rows = load.then(function(data){
      rowsDate = /^\d{4}-\d{2}-\d{2}$/.test(data.published || '') ? data.published : null;
      var map = {};
      data.trials.forEach(function(t){ map[t.anchor] = t; });
      return map;
    });
    rows.catch(function(){ rows = null; });
    return rows;
  }
  function multi(s){ return esc(s).replace(/\n/g, '<br>'); }
  function openRowCard(anchor, btn){
    if (!card) makeCard();
    var pane = document.getElementById('map');
    if (pane) pane.querySelectorAll('.trial.on').forEach(function(x){ x.classList.remove('on'); });
    btn.classList.add('on'); cardKey = anchor;
    card.querySelector('.t').textContent = btn.textContent;
    card.querySelector('table').innerHTML = '';
    var ev = card.querySelector('.ev');
    ev.hidden = false; ev.setAttribute('href', '/evidence/#' + anchor);
    card.classList.add('open');
    evidenceRows().then(function(m){
      if (cardKey !== anchor) return;
      var t = m[anchor];
      if (!t) { card.querySelector('table').innerHTML = ''; return; }
      card.querySelector('.t').textContent = t.study + ' \u00b7 ' + t.year;
      var ref = esc(t.ref) + (t.link ? ' \u00b7 <a href="' + esc(t.link) + '" target="_blank" rel="noopener">PubMed</a>' : '');
      var f = [['Design', t.type], ['Population', t.population], ['Arms', t.arms], ['Endpoints', t.endpoint], ['Results', t.findings]];
      card.querySelector('table').innerHTML = f.filter(function(r){ return r[1]; }).map(function(r){
        return '<tr><th>' + r[0] + '</th><td>' + multi(r[1]) + '</td></tr>'; }).join('') +
        '<tr><th>Reference</th><td>' + ref + '</td></tr>';
      card.querySelector('.cb').scrollTop = 0;
    }, function(){ if (cardKey === anchor) card.querySelector('table').innerHTML = ''; });
  }
  function closeCard(){
    if (card) card.classList.remove('open');
    cardKey = null;
    var pane = document.getElementById('map');
    if (pane) pane.querySelectorAll('.trial.on').forEach(function(x){ x.classList.remove('on'); });
  }
  document.addEventListener('click', function(e){
    var tb = e.target.closest && e.target.closest('#map .trial');
    if (tb && tb.tagName !== 'A') {
      var key = tb.dataset.ev;
      if (cardKey === key && card && card.classList.contains('open')) closeCard();
      else if (key) openRowCard(key, tb);
      return;
    }
    if (e.target.closest && e.target.closest('#om-card .ev')) closeCard();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && cardKey) { closeCard(); return; }
    if (e.key === 'Escape' && root.classList.contains('om-full')) { full(false); return; }
    var tb = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('#map .trial');
    if (tb) { e.preventDefault(); tb.click(); }
  });

  /* ---- follow the view as it re-renders ---- */
  var t = null;
  function schedule(){ if (t) return; t = setTimeout(function(){ t = null; sync(); }, 30); }
  // The shell announces each view it shows; the Evidence view announces each table
  // drawn and each change between the Watch list and the trials (no page observer).
  document.addEventListener('oncos:view-mounted', function(e){
    if (e.detail && e.detail.name !== 'evidence') closeCard();
    schedule();
  });
  document.addEventListener('oncos:evidence-render', schedule);
  schedule();
})();
