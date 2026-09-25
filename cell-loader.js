'use strict';
// Warp the approved raster artwork itself. No SVG or new logo geometry.
globalThis.OncosCellLoader = (() => {
  // The host page may name its own copy of the artwork (oncOS site: data-texture).
  const script = typeof document !== 'undefined' ? document.currentScript : null;
  const texture = (script && script.dataset && script.dataset.texture) || '/assets/cell-logo.png';
  const escape = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mark = '<span class="cell-loader" aria-hidden="true"><canvas></canvas></span>';
  function status(message) {
    return `<span class="cell-wait" role="status">${mark}<span class="cell-wait-label">${escape(message)}</span></span>`;
  }
  function show(container, message) {
    if (!container) return;
    const label = container.querySelector('.cell-wait-label');
    if (label) label.textContent = message;
    else container.innerHTML = `<div class="empty-queue">${status(message)}</div>`;
  }
  function attach(container) {
    if (!container) return () => {};
    const node = document.createElement('span');
    node.className = 'cell-loader'; node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<canvas></canvas>'; container.prepend(node);
    return () => node.remove();
  }

  // One shared texture and animation clock for every visible loader.
  const textureSize = 256, instances = new Map();
  let alpha = null, frame = 0, lastPaint = -Infinity, dirty = true;
  let reduced;
  function sample(x, y) {
    x *= textureSize - 1; y *= textureSize - 1;
    if (x < 0 || y < 0 || x >= textureSize-1 || y >= textureSize-1) return 0;
    const ix=x|0, iy=y|0, fx=x-ix, fy=y-iy, i=iy*textureSize+ix;
    return (alpha[i]*(1-fx)+alpha[i+1]*fx)*(1-fy)
      +(alpha[i+textureSize]*(1-fx)+alpha[i+textureSize+1]*fx)*fy;
  }
  function geometry(n) {
    const result=new Float32Array(n*n*5);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const dx=(x+.5)/n-.5,dy=(y+.5)/n-.49,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx),i=(y*n+x)*5;
      const t=Math.max(0,Math.min(1,(r-.23)/.14));
      result[i]=dx;result[i+1]=dy;result[i+2]=r ? t*t*(3-2*t)/r : 0;
      result[i+3]=a;result[i+4]=r;
    }
    return result;
  }
  function paint(item, phase, moving) {
    const {ctx,pixels,n,mesh,color}=item, out=pixels.data;
    const wave=moving?1:0;
    const nx=.607+wave*.022*Math.sin(phase+.6),ny=.612+wave*.018*Math.sin(phase*1.3);
    const rotation=wave*.10*Math.sin(phase),co=Math.cos(rotation),si=Math.sin(rotation);
    const stretch=1+wave*.035*Math.sin(phase*2);
    for(let p=0;p<n*n;p++){
      const i=p*5,dx=mesh[i],dy=mesh[i+1],a=mesh[i+3];
      // Travelling membrane ripples change the contour locally, not its
      // position as a rigid object. The centre and average radius stay put.
      const radial=1-wave*(.026*Math.sin(3*a+phase)+.012*Math.sin(2*a-phase*1.5))*mesh[i+2];
      const sx=.5+dx*radial,sy=.49+dy*radial;
      let membrane=(sx>.49&&sx<.72&&sy>.49&&sy<.72)?0:sample(sx,sy);
      const ux=dx+.5-nx,uy=dy+.49-ny;
      const cx=.607+(ux*co+uy*si)/stretch,cy=.612+(-ux*si+uy*co)*stretch;
      const nucleus=(cx>.49&&cx<.72&&cy>.49&&cy<.72)?sample(cx,cy):0;
      const j=p*4;out[j]=color[0];out[j+1]=color[1];out[j+2]=color[2];out[j+3]=Math.max(membrane,nucleus);
    }
    ctx.putImageData(pixels,0,0);
    item.element.classList.add('cell-loader-ready');
  }
  function schedule() {
    if(!frame&&alpha&&!document.hidden) frame=requestAnimationFrame(tick);
  }
  function discover() {
    document.querySelectorAll('.cell-loader').forEach(element=>{
      if(instances.has(element))return;
      let canvas=element.querySelector('canvas');
      if(!canvas){canvas=document.createElement('canvas');element.append(canvas);}
      const ctx=canvas.getContext('2d');
      if(ctx)instances.set(element,{element,canvas,ctx,n:0});
    });
    dirty=true;schedule();
  }
  function tick(time) {
    frame=0;
    if(document.hidden)return;
    const moving=!reduced.matches;
    if(moving&&time-lastPaint<1000/30){schedule();return;}
    lastPaint=time;
    let visible=0;
    for(const [element,item] of instances){
      if(!element.isConnected){instances.delete(element);continue;}
      const box=element.getBoundingClientRect();
      if(!box.width||!box.height||box.bottom<0||box.top>innerHeight||box.right<0||box.left>innerWidth)continue;
      visible++;
      const n=Math.min(192,Math.max(24,Math.ceil(box.width*Math.min(devicePixelRatio||1,2))));
      if(item.n!==n){item.n=n;item.canvas.width=item.canvas.height=n;item.mesh=geometry(n);item.pixels=item.ctx.createImageData(n,n);dirty=true;}
      if(dirty||!item.color){
        const rgb=getComputedStyle(element).color.match(/[\d.]+/g)||[243,243,243];
        item.color=rgb.slice(0,3).map(Number);
      }
      paint(item,moving?time/1000*1.65:0,moving);
    }
    dirty=false;
    if(visible&&moving)schedule();
  }
  function start() {
    reduced=matchMedia('(prefers-reduced-motion: reduce)');
    reduced.addEventListener('change',()=>{dirty=true;schedule();});
    const image=new Image();
    image.onload=()=>{
      const texture=document.createElement('canvas');texture.width=texture.height=textureSize;
      const ctx=texture.getContext('2d');if(!ctx)return;
      ctx.drawImage(image,0,0,textureSize,textureSize);
      const rgba=ctx.getImageData(0,0,textureSize,textureSize).data;
      alpha=new Float32Array(textureSize*textureSize);
      // Remove only the flat charcoal backing at render time. Silhouette and
      // antialiasing are sampled from the approved image, never recreated.
      for(let i=0;i<alpha.length;i++)alpha[i]=Math.max(0,Math.min(255,(rgba[i*4]-24)/212*255));
      discover();
    };
    image.src=texture;
    new MutationObserver(records=>{
      // Our paint-only class update does not require another DOM scan.
      if(records.every(r=>r.type==='attributes'&&r.target.classList?.contains('cell-loader')))return;
      discover();
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-theme','open','hidden','style']});
    new MutationObserver(()=>{dirty=true;schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else discover();});
    window.addEventListener('resize',discover);
    window.addEventListener('scroll',schedule,true);
  }
  if(typeof window!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
  }
  return {status,show,attach};
})();
