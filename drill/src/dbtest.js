global.window=global; global.document={};
require('./sites.js'); require('./vignettes.js'); require('./core.js'); require('./debrief.js');
const D=window.Drill, B=window.Debrief; const miss={}, nosite=new Set();
for (const [k,s] of Object.entries(D.SYS)) { const d=B.get(s.site); if(!d){nosite.add(s.site);continue;}
  for (let i=0;i<400;i++){ const c=D.makeCase(D.randomTarget(s)); const h=(c.fields||[]).find(f=>f[0]==='Histology');
    const x={s:c.stage,t:c.t,n:c.n,m:c.m,q:c.q,label:s.label,sclc:!!(h&&/^Small cell/.test(h[1]))};
    if(!B.txFor(d,x)) (miss[k]=miss[k]||new Set()).add(c.stage+' '+c.t+c.n+c.m); } }
for (const s of window.DRILL_SITES) if(!s.systems||!s.systems.length){ let v; try{v=D.makeVsCase(s.id)}catch(e){continue}
  const d=B.get(s.id); if(!d){nosite.add(s.id);continue}
  for(const o of v.opts) if(!B.txFor(d,{s:o,t:'',n:'',m:''})) (miss[s.id]=miss[s.id]||new Set()).add(o); }
console.log('no entry:',[...nosite]); for(const k in miss) console.log(k,[...miss[k]].slice(0,8));
// sample
const lung=D.SYS.lung; let sc=0; for(let i=0;i<300;i++){const c=D.makeCase(D.randomTarget(lung));const h=(c.fields||[]).find(f=>f[0]==='Histology'); if(h&&/^Small cell/.test(h[1])){sc++; if(sc<3) console.log(c.stage,c.t,c.n,c.m,B.txFor(B.get('lung'),{s:c.stage,t:c.t,n:c.n,m:c.m,sclc:true}).text)}} console.log('sclc',sc);
