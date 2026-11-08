/* oncOS board maps: link each Evidence sheet to its map.
   Loaded by the hub shell. Reads /maps/maps.json (sheet name -> map) and, while
   the Evidence view shows a sheet that has a map, places a ruled MAP | <name>
   cell above the trial table. A map's title bar opens its sheet through the
   view's own /evidence/?group=<sheet> link. The Evidence view is generated and
   re-rendered from state, so this watches the DOM instead of patching it. */
(function(){
  var maps = null, pending = false;
  function load(cb){
    if (maps) return cb(maps);
    if (pending) return;
    pending = true;
    fetch('/maps/maps.json', {credentials:'same-origin'}).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ maps = (j && j.sheets) || {}; cb(maps); })
      .catch(function(){ maps = {}; });
  }
  function activeSheet(){
    var b = document.querySelector('[data-view="evidence"] .sheets button.active, .sheets button.active');
    return b ? (b.dataset.sheet || (b.querySelector('span') || b).textContent.trim()) : null;
  }
  function sync(){
    var top = document.querySelector('.viewfrag .topbar');
    if (!top) return;
    load(function(m){
      var sheet = activeSheet();
      var hit = sheet && m[sheet];
      var el = top.querySelector('.map-cell');
      if (!hit){ if (el) el.remove(); return; }
      if (!el){
        el = document.createElement('a');
        el.className = 'map-cell';
        top.appendChild(el);
      }
      if (el.getAttribute('href') !== hit.url){
        el.setAttribute('href', hit.url);
        el.innerHTML = '<span class="map-k">MAP</span><span class="map-v">' + esc(hit.title || sheet) + '</span>';
      }
    });
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var style = document.createElement('style');
  style.textContent =
    '.viewfrag .topbar .map-cell{display:inline-flex;align-items:stretch;margin:0 0 12px;border:1.2px solid var(--rule, var(--hair));text-decoration:none;color:var(--ink);font-size:var(--t-base, 14px);line-height:1.2}' +
    '.viewfrag .topbar .map-cell .map-k{padding:6px 10px;font-size:var(--t-xs, 11px);font-weight:700;letter-spacing:.08em;background:var(--chip, var(--raised));color:var(--muted);border-right:1.2px solid var(--rule, var(--hair));display:flex;align-items:center}' +
    '.viewfrag .topbar .map-cell .map-v{padding:6px 12px;font-weight:700;display:flex;align-items:center}' +
    '.viewfrag .topbar .map-cell .map-v::after{content:"\\25B8";margin-left:8px;color:var(--muted)}' +
    '@media (hover:hover){.viewfrag .topbar .map-cell:hover .map-v{background:var(--hover, var(--accent-soft))}}';
  document.head.appendChild(style);
  var t = null;
  function schedule(){ if (t) return; t = setTimeout(function(){ t = null; sync(); }, 60); }
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
  schedule();
})();
