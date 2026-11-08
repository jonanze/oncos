/* oncOS board maps: shared sheet logic.
   A map page defines, before this script runs:
     T    trial cards  {KEY:{n,ctl,pts,ep,res,os,ref:[[label,url,text],...]}}
     MAP  {w, h, links:[{from,to,fromSide?,toSide?,dx1?,dy1?,dx2?,dy2?}], braces:[{id,x,top,bottom,note?}]}
   <t k="KEY">label</t> in the body becomes a button that opens the card. */
(function(){
  var PMURL = function(id){ return 'https://pubmed.ncbi.nlm.nih.gov/' + id + '/'; };
  window.PM = window.PM || PMURL;
  var T = window.T || {}, MAP = window.MAP || {};
  var W = MAP.w || 1600, H = MAP.h || 1550;

  var sheet = document.getElementById('sheet'), wrap = document.getElementById('wrap');
  var card = document.getElementById('card'), cardT = document.getElementById('card-t'), cardB = document.getElementById('card-b');
  var current = null;
  sheet.style.width = W + 'px'; sheet.style.height = H + 'px';

  document.querySelectorAll('t').forEach(function(el){
    var b = document.createElement('button');
    b.className = 'trial'; b.type = 'button'; b.dataset.k = el.getAttribute('k'); b.textContent = el.textContent;
    el.replaceWith(b);
  });
  function esc(s){ return String(s).replace(/[&<>"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }); }
  function openCard(k, btn){
    var d = T[k]; if(!d) return;
    document.querySelectorAll('button.trial.on').forEach(function(x){ x.classList.remove('on'); });
    btn.classList.add('on'); current = k; cardT.textContent = d.n;
    var rows = [['Control arm',d.ctl],['Patients',d.pts],['Primary endpoint',d.ep],['Result',d.res],['OS',d.os]];
    var h = rows.map(function(r){ return '<tr><th>'+r[0]+'</th><td>'+esc(r[1])+'</td></tr>'; }).join('');
    h += '<tr><th>Reference</th><td>'+d.ref.map(function(r){ return esc(r[0])+' · <a href="'+r[1]+'" target="_blank" rel="noopener">'+esc(r[2])+'</a>'; }).join('<br>')+'</td></tr>';
    cardB.innerHTML = h; card.classList.add('open');
  }
  function closeCard(){ card.classList.remove('open'); current = null; document.querySelectorAll('button.trial.on').forEach(function(x){ x.classList.remove('on'); }); }
  document.getElementById('card-x').addEventListener('click', closeCard);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeCard(); });
  document.addEventListener('click', function(e){
    var tb = e.target.closest('button.trial');
    if(tb){
      if(current === tb.dataset.k && card.classList.contains('open')){ closeCard(); return; }
      openCard(tb.dataset.k, tb);
    }
  });

  /* theme: shared with the oncOS hub */
  var root = document.documentElement;
  function sysDark(){ return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }
  var themeBtn = document.getElementById('theme');
  if(themeBtn) themeBtn.addEventListener('click', function(){
    var cur = root.dataset.theme || (sysDark() ? 'dark' : 'light'); var nx = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nx; try { localStorage.setItem('oncos-theme', nx); } catch(e){}
  });

  /* fit to width, or actual size */
  var actual = false;
  var zb = document.getElementById('zoom');
  function fit(){
    var avail = wrap.clientWidth;
    var s = actual ? 1 : Math.min(1, avail / W);
    sheet.style.transform = 'scale(' + s + ')';
    wrap.style.height = actual ? 'auto' : (H * s) + 'px';
    wrap.classList.toggle('actual', actual);
  }
  if(zb) zb.addEventListener('click', function(){ actual = !actual; zb.setAttribute('aria-pressed', actual ? 'true' : 'false'); fit(); });

  /* positions relative to the sheet, unaffected by the scale transform */
  function pos(el){
    var x = 0, y = 0, e = el;
    while(e && e !== sheet){ x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
    return {x:x, y:y, w:el.offsetWidth, h:el.offsetHeight, r:x + el.offsetWidth, b:y + el.offsetHeight, cx:x + el.offsetWidth/2, cy:y + el.offsetHeight/2};
  }
  var $ = function(id){ return document.getElementById(id); };
  function side(p, s){
    switch(s){
      case 'l': return [p.x, p.cy];
      case 't': return [p.cx, p.y];
      case 'b': return [p.cx, p.b];
      default:  return [p.r, p.cy];
    }
  }
  function bracePath(x, y1, y2, depth){
    var m = (y1 + y2) / 2, d = depth, k = 6;
    return 'M'+x+' '+y1+' Q'+(x+d)+' '+y1+' '+(x+d)+' '+(y1+k)+' L'+(x+d)+' '+(m-k)+' Q'+(x+d)+' '+m+' '+(x+2*d)+' '+m+' Q'+(x+d)+' '+m+' '+(x+d)+' '+(m+k)+' L'+(x+d)+' '+(y2-k)+' Q'+(x+d)+' '+y2+' '+x+' '+y2;
  }
  function drawBrace(id, x, y1, y2){
    var el = $(id); if(!el) return; el.style.left = x + 'px'; el.style.top = (y1 - 2) + 'px';
    var h = y2 - y1 + 4;
    el.innerHTML = '<svg width="26" height="'+h+'" viewBox="0 0 26 '+h+'"><path d="'+bracePath(2, 2, h-2, 9)+'"/></svg>';
  }
  function draw(){
    var wires = $('wires'); var out = '';
    (MAP.links || []).forEach(function(L){
      var a = $(L.from), b = $(L.to); if(!a || !b) return;
      var p1 = side(pos(a), L.fromSide || 'r'), p2 = side(pos(b), L.toSide || 'l');
      out += '<line x1="'+(p1[0]+(L.dx1||0))+'" y1="'+(p1[1]+(L.dy1||0))+'" x2="'+(p2[0]+(L.dx2||0))+'" y2="'+(p2[1]+(L.dy2||0))+'"/>';
    });
    wires.innerHTML = out;
    (MAP.braces || []).forEach(function(B){
      var t = $(B.top), b = $(B.bottom); if(!t || !b) return;
      var y1 = pos(t).y, y2 = pos(b).b;
      drawBrace(B.id, B.x, y1, y2);
      if(B.note){ var n = $(B.note); if(n) n.style.top = ((y1 + y2)/2 - n.offsetHeight/2) + 'px'; }
    });
  }
  function all(){ fit(); draw(); }
  window.addEventListener('resize', all);
  window.addEventListener('load', all);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  all();
})();
