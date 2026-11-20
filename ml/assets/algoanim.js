/* algoanim.js — looping animations beside pseudocode blocks.
   Each .algo block gets a canvas that replays the algorithm on fresh data,
   highlighting the pseudocode line that is running. */
(function(){
'use strict';
const DEFS = {};
const AA = window.AlgoAnim = { def(k, f){ DEFS[k] = f; }, defs: DEFS };

/* ---------- small maths + data toolkit ---------- */
const T = AA.T = {
  r: Math.random,
  u: (a,b) => a + (b-a)*Math.random(),
  g(){ let u=0,v=0; while(!u) u=Math.random(); while(!v) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); },
  ri: n => Math.floor(Math.random()*n),
  clamp: (x,a,b) => Math.max(a, Math.min(b, x)),
  lerp: (a,b,p) => a + (b-a)*p,
  ease: p => p<0?0:p>1?1:p*p*(3-2*p),
  sig: z => 1/(1+Math.exp(-z)),
  sum: a => a.reduce((s,x)=>s+x,0),
  mean: a => a.reduce((s,x)=>s+x,0)/a.length,
  shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; },
  range: n => Array.from({length:n},(_,i)=>i),
  /* two Gaussian blobs, labels 0/1 */
  blobs(n, sep=1.6, sd=0.9, tilt=0){
    const out=[]; const a=T.u(-0.6,0.6)+tilt;
    for(let i=0;i<n;i++){ const c=i%2, s=c?1:-1; const u=T.g()*sd*1.25, v=T.g()*sd*0.6;
      out.push({x: s*sep*Math.cos(a) + u*Math.cos(a+1.2) - v*Math.sin(a+1.2), y: s*sep*Math.sin(a) + u*Math.sin(a+1.2) + v*Math.cos(a+1.2), c}); }
    return out;
  },
  /* 2x2 symmetric eigen: returns [[l1,v1],[l2,v2]] with l1>=l2 */
  eig2(a,b,d){ const tr=a+d, det=a*d-b*b, s=Math.sqrt(Math.max(0,tr*tr/4-det));
    const l1=tr/2+s, l2=tr/2-s; let v1 = Math.abs(b)>1e-12 ? [l1-d,b] : (a>=d?[1,0]:[0,1]);
    const n=Math.hypot(v1[0],v1[1]); v1=[v1[0]/n,v1[1]/n]; return [[l1,v1],[l2,[-v1[1],v1[0]]]]; },
  solve(A,b){ const n=b.length, M=A.map((r,i)=>[...r,b[i]]);
    for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r; [M[c],M[p]]=[M[p],M[c]];
      const d=M[c][c]||1e-12; for(let r=0;r<n;r++) if(r!==c){ const f=M[r][c]/d; for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } }
    return M.map((r,i)=>r[n]/(r[i]||1e-12)); },
  f: (x,d=2) => (Math.abs(x)<5e-13?0:x).toFixed(d).replace(/^-0\.(0+)$/,'0.$1'),
};

/* ---------- drawing helper ---------- */
function Draw(cv){
  const ctx = cv.getContext('2d'); const g = { ctx, W:0, H:0, C:{} };
  let vx=0, vy=0, vw=1, vh=1, x0=0, x1=1, y0=0, y1=1;
  g.size = (W,H) => { g.W=W; g.H=H; g.fs = Math.max(10.5, Math.min(14, W/36)); g.view(0,0,1,1,0,1,0,1); };
  g.colors = () => { const cs=getComputedStyle(cv); ['c1','c2','c3','c4','c5','c6','k0','k1','k0s','k1s','ink','muted','line','card','soft','bg'].forEach(k=>g.C[k]=cs.getPropertyValue('--'+k).trim()||'#888'); };
  /* viewport as fractions of the canvas, then world box */
  g.view = (fx,fy,fw,fh,a,b,c,d) => { vx=fx*g.W; vy=fy*g.H; vw=fw*g.W; vh=fh*g.H; x0=a; x1=b; y0=c; y1=d; return g; };
  g.vp = () => ({x:vx,y:vy,w:vw,h:vh});
  g.X = x => vx + (x-x0)/(x1-x0)*vw;
  g.Y = y => vy + vh - (y-y0)/(y1-y0)*vh;
  g.S = s => s/(x1-x0)*vw;                      /* world length → px (x scale) */
  g.clear = () => { ctx.clearRect(0,0,g.W,g.H); };
  g.alpha = a => { ctx.globalAlpha = a; };
  g.frame = (col) => { ctx.strokeStyle = col||g.C.line; ctx.lineWidth=1; ctx.strokeRect(vx+.5,vy+.5,vw-1,vh-1); };
  g.axes = (col) => { ctx.strokeStyle=col||g.C.line; ctx.lineWidth=1; ctx.beginPath();
    if(x0<0&&x1>0){ ctx.moveTo(g.X(0),vy); ctx.lineTo(g.X(0),vy+vh); } if(y0<0&&y1>0){ ctx.moveTo(vx,g.Y(0)); ctx.lineTo(vx+vw,g.Y(0)); } ctx.stroke(); };
  g.clip = (on) => { if(on){ ctx.save(); ctx.beginPath(); ctx.rect(vx,vy,vw,vh); ctx.clip(); } else ctx.restore(); };
  g.dot = (x,y,r,col,o={}) => { ctx.save(); if(o.a!=null) ctx.globalAlpha*=o.a; ctx.beginPath(); ctx.arc(g.X(x),g.Y(y),r,0,7);
    if(o.hollow){ ctx.fillStyle=g.C.card; ctx.fill(); ctx.strokeStyle=col; ctx.lineWidth=o.lw||2; ctx.stroke(); }
    else { ctx.fillStyle=col; ctx.fill(); if(o.ring){ ctx.strokeStyle=o.ring; ctx.lineWidth=o.lw||2; ctx.stroke(); } else { ctx.strokeStyle=g.C.card; ctx.lineWidth=1; ctx.stroke(); } }
    ctx.restore(); };
  g.pdot = (px,py,r,col) => { ctx.beginPath(); ctx.arc(px,py,r,0,7); ctx.fillStyle=col; ctx.fill(); };
  g.seg = (a,b,c,d,col,w=2,dash,al) => { ctx.save(); if(al!=null) ctx.globalAlpha*=al; ctx.strokeStyle=col; ctx.lineWidth=w; if(dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(g.X(a),g.Y(b)); ctx.lineTo(g.X(c),g.Y(d)); ctx.stroke(); ctx.restore(); };
  g.pseg = (a,b,c,d,col,w=2,dash) => { ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=w; if(dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(a,b); ctx.lineTo(c,d); ctx.stroke(); ctx.restore(); };
  g.arrow = (a,b,c,d,col,w=2.5) => { const X1=g.X(a),Y1=g.Y(b),X2=g.X(c),Y2=g.Y(d); g.parrow(X1,Y1,X2,Y2,col,w); };
  g.parrow = (X1,Y1,X2,Y2,col,w=2.5) => { const L=Math.hypot(X2-X1,Y2-Y1); if(L<1) return; const ux=(X2-X1)/L, uy=(Y2-Y1)/L, h=Math.min(10,L*.4)+w;
    ctx.save(); ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(X1,Y1); ctx.lineTo(X2-ux*h*.7,Y2-uy*h*.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X2,Y2); ctx.lineTo(X2-ux*h-uy*h*.5,Y2-uy*h+ux*h*.5); ctx.lineTo(X2-ux*h+uy*h*.5,Y2-uy*h-ux*h*.5); ctx.closePath(); ctx.fill(); ctx.restore(); };
  g.font = (o={}) => `${o.bold?'700 ':o.semi?'600 ':''}${(o.size||1)*g.fs}px ${o.mono?'"JetBrains Mono",ui-monospace,monospace':'Inter,system-ui,sans-serif'}`;
  g.ptxt = (s,px,py,col,o={}) => { ctx.save(); if(o.a!=null) ctx.globalAlpha*=o.a; ctx.font=g.font(o); ctx.fillStyle=col||g.C.ink; ctx.textAlign=o.align||'left'; ctx.textBaseline=o.base||'middle'; ctx.fillText(s,px,py); ctx.restore(); };
  g.txt = (s,x,y,col,o) => g.ptxt(s,g.X(x),g.Y(y),col,o);
  g.prect = (px,py,w,h,fill,stroke,o={}) => { ctx.save(); if(o.a!=null) ctx.globalAlpha*=o.a; ctx.beginPath(); if(ctx.roundRect && o.r) ctx.roundRect(px,py,w,h,o.r); else ctx.rect(px,py,w,h);
    if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=o.lw||1.5; ctx.stroke(); } ctx.restore(); };
  g.rect = (a,b,c,d,fill,stroke,o) => { const X1=g.X(Math.min(a,c)),X2=g.X(Math.max(a,c)),Y1=g.Y(Math.max(b,d)),Y2=g.Y(Math.min(b,d)); g.prect(X1,Y1,X2-X1,Y2-Y1,fill,stroke,o); };
  g.poly = (pts,col,w=2,fill,o={}) => { if(pts.length<2) return; ctx.save(); if(o.a!=null) ctx.globalAlpha*=o.a; ctx.beginPath(); pts.forEach((p,i)=> i?ctx.lineTo(g.X(p[0]),g.Y(p[1])):ctx.moveTo(g.X(p[0]),g.Y(p[1])));
    if(fill){ ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); } if(col){ ctx.strokeStyle=col; ctx.lineWidth=w; if(o.dash) ctx.setLineDash(o.dash); ctx.stroke(); } ctx.restore(); };
  g.fn = (f,a,b,col,w=2,o={}) => { const pts=[]; for(let i=0;i<=120;i++){ const x=a+(b-a)*i/120; pts.push([x,f(x)]); } g.poly(pts,col,w,null,o); };
  /* ellipse for covariance S (2x2 [a,b,d]) at k standard deviations */
  g.ell = (mx,my,a,b,d,k,col,w=2,fill,o={}) => { const [[l1,v1],[l2]]=T.eig2(a,b,d); const r1=Math.sqrt(Math.max(l1,1e-9))*k, r2=Math.sqrt(Math.max(l2,1e-9))*k; const pts=[];
    for(let i=0;i<=60;i++){ const t=i/60*2*Math.PI, u=r1*Math.cos(t), v=r2*Math.sin(t); pts.push([mx+u*v1[0]-v*v1[1], my+u*v1[1]+v*v1[0]]); } g.poly(pts,col,w,fill,o); };
  /* number grid: M array of rows, top-left px, cell size; hl(i,j) → colour or null */
  g.mat = (M,px,py,cw,ch,o={}) => { const fmt=o.fmt||(v=>typeof v==='number'?T.f(v,o.dp==null?1:o.dp):String(v));
    M.forEach((row,i)=>row.forEach((v,j)=>{ const c=o.hl&&o.hl(i,j); g.prect(px+j*cw+1,py+i*ch+1,cw-2,ch-2,c||g.C.soft,null,{r:3});
      if(v!==null&&v!==undefined&&v!=='') g.ptxt(fmt(v),px+j*cw+cw/2,py+i*ch+ch/2,o.col?o.col(i,j):g.C.ink,{align:'center',mono:true,size:o.size||.85}); }));
    if(o.label) g.ptxt(o.label,px+M[0].length*cw/2,py-g.fs*.8,g.C.muted,{align:'center',size:.85,semi:true}); };
  /* probability shading of a 2D function over current view */
  const off=document.createElement('canvas'), octx=off.getContext('2d');
  const rgb=(c)=>{ const m=/^#([0-9a-f]{6})$/i.exec(c||''); if(!m){ const s=/^#([0-9a-f]{3})$/i.exec(c||''); return s?[...s[1]].map(h=>parseInt(h+h,16)):[128,128,128]; } return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)); };
  g.shade = (f,n=26,a=.28) => { const m=Math.max(2,Math.round(n*vh/vw)); off.width=n; off.height=m; const im=octx.createImageData(n,m); const c1=rgb(g.C.k1), c0=rgb(g.C.k0);
    for(let j=0;j<m;j++) for(let i=0;i<n;i++){ const x=x0+(i+.5)/n*(x1-x0), y=y1-(j+.5)/m*(y1-y0), p=f(x,y), c=p>.5?c1:c0, k=4*(j*n+i);
      im.data[k]=c[0]; im.data[k+1]=c[1]; im.data[k+2]=c[2]; im.data[k+3]=Math.round(255*a*Math.min(1,Math.abs(p-.5)*2)); }
    octx.putImageData(im,0,0); ctx.save(); ctx.imageSmoothingEnabled=true; ctx.drawImage(off,vx,vy,vw,vh); ctx.restore(); };
  /* line w0 + w1 x + w2 y = 0 clipped to view */
  g.wline = (w0,w1,w2,col,w=2.5,dash) => { const pts=[]; const ex=[[x0,null],[x1,null],[null,y0],[null,y1]];
    for(const [x,y] of ex){ if(x!==null && Math.abs(w2)>1e-9){ const yy=-(w0+w1*x)/w2; if(yy>=y0-1e-9&&yy<=y1+1e-9) pts.push([x,yy]); } if(y!==null && Math.abs(w1)>1e-9){ const xx=-(w0+w2*y)/w1; if(xx>=x0-1e-9&&xx<=x1+1e-9) pts.push([xx,y]); } }
    if(pts.length>=2) g.seg(pts[0][0],pts[0][1],pts[1][0],pts[1][1],col,w,dash); };
  g.bars = (vals,lo,hi,colf,o={}) => { const n=vals.length, bw=vw/n; const zero=g.Y(0);
    vals.forEach((v,i)=>{ const yv=g.Y(T.clamp(v,lo,hi)); g.prect(vx+i*bw+bw*.15, Math.min(zero,yv), bw*.7, Math.abs(yv-zero), colf(i,v), null, {a:o.a}); if(o.lab) g.ptxt(o.lab(i), vx+i*bw+bw/2, vy+vh+g.fs*.8, g.C.muted, {align:'center',size:.8,mono:true}); }); };
  return g;
}
AA.Draw = Draw;

/* ---------- player ---------- */
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const players = [];
function mount(el, key){
  const lis = [...el.querySelectorAll(':scope > ol > li')];
  const wrap = document.createElement('div'); wrap.className='aa-wrap';
  el.parentNode.insertBefore(wrap, el);
  const inner = document.createElement('div'); inner.className='aa-in'; wrap.appendChild(inner); inner.appendChild(el);
  const pan = document.createElement('div'); pan.className='aa-panel';
  pan.innerHTML = '<div class="aa-head"><span class="aa-live">▶ watch it run</span><span class="aa-ln"></span></div><canvas class="aa-cv" role="img"></canvas><p class="aa-cap" aria-live="off"></p>'+
    '<div class="aa-ctl"><button class="aa-b aa-pp" type="button">Pause</button><button class="aa-b aa-st" type="button">Step</button><button class="aa-b aa-nw" type="button">New data</button><button class="aa-b aa-sp" type="button">1×</button></div>';
  inner.appendChild(pan);
  const cv = pan.querySelector('canvas'), cap = pan.querySelector('.aa-cap'), lnEl = pan.querySelector('.aa-ln');
  cv.setAttribute('aria-label', 'Animation of: ' + (el.querySelector('.algo-h')||{}).textContent);
  const g = Draw(cv);
  const P = { frames:[], fi:0, t:0, last:0, playing:!reduce, vis:false, speed:1, hold:0, raf:0 };
  const build = () => { try { P.frames = DEFS[key](T) || []; } catch(e){ console.error('algoanim', key, e); P.frames=[]; } P.fi=0; P.t=0; P.hold=0; };
  const sizeIt = () => { const w = cv.clientWidth || pan.clientWidth || 320; const h = Math.round(w*(w<460?0.8:0.66)); const dpr = Math.min(2, window.devicePixelRatio||1);
    cv.style.height = h+'px'; cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); g.ctx.setTransform(dpr,0,0,dpr,0,0); g.size(w,h); };
  const setLine = (l) => { const ls = l==null?[]:(Array.isArray(l)?l:[l]); lis.forEach((li,i)=>li.classList.toggle('aa-on', ls.includes(i+1)));
    lnEl.textContent = ls.length ? 'line ' + ls.join(', ') : ''; };
  let lastFi = -1;
  const draw = () => { const fr = P.frames[P.fi]; if(!fr) return; if(P.fi!==lastFi){ g.colors(); setLine(fr.l); cap.textContent = fr.cap||''; lastFi=P.fi; }
    const p = Math.min(1, P.t/(fr.ms||900)); g.clear(); g.ctx.globalAlpha=1; try { fr.d(g, T.ease(p), p); } catch(e){ console.error('algoanim draw', key, e); } };
  const tick = (now) => { P.raf=0; if(!P.playing || !P.vis) return; const dt = Math.min(80, now-(P.last||now)); P.last=now;
    const fr = P.frames[P.fi]; if(!fr){ build(); lastFi=-1; }
    else if(P.t >= (fr.ms||900)){ if(P.fi < P.frames.length-1){ P.fi++; P.t=0; } else { P.hold += dt*P.speed; if(P.hold > 1600){ build(); lastFi=-1; } } }
    else P.t += dt*P.speed;
    draw(); P.raf = requestAnimationFrame(tick); };
  const go = () => { if(!P.raf && P.playing && P.vis){ P.last=0; P.raf=requestAnimationFrame(tick); } };
  const pp = pan.querySelector('.aa-pp');
  const setPlay = (on) => { P.playing=on; pp.textContent = on?'Pause':'Play'; wrap.classList.toggle('aa-paused',!on); go(); };
  pp.onclick = () => setPlay(!P.playing);
  pan.querySelector('.aa-st').onclick = () => { setPlay(false); const fr=P.frames[P.fi]; if(fr && P.t < (fr.ms||900)) P.t = fr.ms||900; else if(P.fi < P.frames.length-1){ P.fi++; P.t = P.frames[P.fi].ms||900; } else { build(); lastFi=-1; P.t=(P.frames[0]||{}).ms||900; } draw(); };
  pan.querySelector('.aa-nw').onclick = () => { build(); lastFi=-1; draw(); go(); };
  const sp = pan.querySelector('.aa-sp'); sp.onclick = () => { P.speed = P.speed===1?2:P.speed===2?0.5:1; sp.textContent = P.speed+'×'; };
  build(); sizeIt(); if(reduce){ const fr=P.frames[0]; if(fr) P.t=fr.ms||900; setPlay(false); } draw();
  if('ResizeObserver' in window){ let rw=0; new ResizeObserver(()=>{ const w=cv.clientWidth; if(Math.abs(w-rw)>2){ rw=w; sizeIt(); draw(); } }).observe(pan); }
  if('IntersectionObserver' in window){ new IntersectionObserver(es=>{ es.forEach(e=>{ P.vis = e.isIntersecting; if(!P.vis) setLine(null); else { lastFi=-1; draw(); } go(); }); },{threshold:0.2}).observe(pan); }
  else { P.vis = true; go(); }
  if(window.ML && ML.onTheme) ML.onTheme(()=>{ lastFi=-1; draw(); });
  players.push(P);
}

/* map pseudocode titles to animations when no data-anim is given */
const BY_TITLE = [];
AA.title = (re, key) => BY_TITLE.push([re,key]);
AA.init = () => {
  document.querySelectorAll('.algo').forEach(el => {
    if(el.dataset.aaDone) return; let key = el.dataset.anim;
    if(!key){ const h=(el.querySelector('.algo-h')||{}).textContent||''; const m=BY_TITLE.find(([re])=>re.test(h)); if(m) key=m[1]; }
    if(key && DEFS[key]){ el.dataset.aaDone='1'; mount(el, key); }
  });
};
/* ---------- shared bits for the ML animations ---------- */
const F = (S) => (l,cap,ms,d) => S.push({l,cap,ms,d});
const kc = (g,c) => c ? g.C.k1 : g.C.k0;
const drawPts = (g,pts,o={}) => pts.forEach((q,i)=>{ if(o.upto!=null && i>=o.upto) return; g.dot(q.x,q.y,o.r?o.r(q,i):4.2,kc(g,q.c),{a:o.a?o.a(q,i):1,ring:o.ring?o.ring(q,i):null,hollow:o.hollow?o.hollow(q,i):false}); });
AA.drawPts = drawPts; AA.F = F;

/* tiny weighted CART on 2-D points {x,y,c}; returns a tree */
function grow(pts, w, idx, depth, o){
  const W=idx.reduce((s,i)=>s+w[i],0), W1=idx.reduce((s,i)=>s+(pts[i].c?w[i]:0),0), p=W?W1/W:.5;
  const leaf={leaf:true,p,n:idx.length};
  if(depth>=o.max || idx.length<2*(o.minLeaf||1) || p===0 || p===1) return leaf;
  const gini=(a,b)=>{ const t=a+b; return t?2*(a/t)*(b/t)*t:0; };
  let best=null; const feats = o.m===1 ? [T.ri(2)] : [0,1];
  for(const f of feats){ const key=f?'y':'x'; const s=[...idx].sort((a,b)=>pts[a][key]-pts[b][key]); let l0=0,l1=0, r0=W-W1, r1=W1;
    for(let k=0;k<s.length-1;k++){ const i=s[k]; if(pts[i].c){ l1+=w[i]; r1-=w[i]; } else { l0+=w[i]; r0-=w[i]; }
      const v=pts[i][key], v2=pts[s[k+1]][key]; if(v2-v<1e-9 || k+1<(o.minLeaf||1) || s.length-k-1<(o.minLeaf||1)) continue;
      const gain=gini(W-W1,W1)-gini(l0,l1)-gini(r0,r1); if(!best||gain>best.gain) best={f,t:(v+v2)/2,gain}; } }
  if(!best || best.gain<=1e-12) return leaf;
  const key=best.f?'y':'x'; const L=idx.filter(i=>pts[i][key]<=best.t), R=idx.filter(i=>pts[i][key]>best.t);
  return {f:best.f,t:best.t,p,n:idx.length,L:grow(pts,w,L,depth+1,o),R:grow(pts,w,R,depth+1,o)};
}
const tPred = (t,x,y) => { while(!t.leaf) t = ((t.f?y:x)<=t.t)?t.L:t.R; return t.p; };
const tLeaves = (t,b,out=[]) => { if(t.leaf){ out.push({...b,p:t.p}); return out; } if(t.f===0){ tLeaves(t.L,{...b,x1:t.t},out); tLeaves(t.R,{...b,x0:t.t},out); } else { tLeaves(t.L,{...b,y1:t.t},out); tLeaves(t.R,{...b,y0:t.t},out); } return out; };
const tSplits = (t,b,out=[]) => { if(t.leaf) return out; if(t.f===0){ out.push([t.t,b.y0,t.t,b.y1]); tSplits(t.L,{...b,x1:t.t},out); tSplits(t.R,{...b,x0:t.t},out); } else { out.push([b.x0,t.t,b.x1,t.t]); tSplits(t.L,{...b,y1:t.t},out); tSplits(t.R,{...b,y0:t.t},out); } return out; };
AA.tree = {grow,tPred,tLeaves,tSplits};
const drawLeaves = (g,tree,box,a=.22) => tLeaves(tree,box).forEach(r=>g.rect(r.x0,r.y0,r.x1,r.y1,r.p>.5?g.C.k1:g.C.k0,null,{a:a*Math.abs(r.p-.5)*2}));
const drawSplits = (g,tree,box,col,w=1.5) => tSplits(tree,box).forEach(s=>g.seg(s[0],s[1],s[2],s[3],col||g.C.ink,w,null,.6));

/* ========== linear regression: OLS ========== */
AA.def('ols', T => {
  const S=[], add=F(S); const n=7;
  const xs=T.range(n).map(i=>1+i*1.25+T.u(-.3,.3)), b0=T.u(1,3), b1=T.u(.55,.95), ys=xs.map(x=>b0+b1*x+T.g()*.9);
  const sx=T.sum(xs), sxx=T.sum(xs.map(x=>x*x)), sy=T.sum(ys), sxy=T.sum(xs.map((x,i)=>x*ys[i]));
  const G=[[n,sx],[sx,sxx]], gv=[sy,sxy], be=T.solve(G,gv), yh=xs.map(x=>be[0]+be[1]*x), e=ys.map((y,i)=>y-yh[i]);
  const plot=(g,o={})=>{ g.view(.03,.06,.5,.86,0,10,0,13); g.frame(); g.txt('size x',9.6,.5,g.C.muted,{align:'right',size:.8}); g.txt('price y',.3,12.3,g.C.muted,{size:.8});
    if(o.line!=null) g.seg(0,be[0],10*o.line,be[0]+be[1]*10*o.line,g.C.c1,2.5);
    if(o.res!=null) xs.forEach((x,i)=>{ if(i<o.res*n) g.seg(x,ys[i],x,yh[i],g.C.c2,2); });
    xs.forEach((x,i)=>{ if(o.upto==null||i<o.upto) g.dot(x,ys[i],4.5,g.C.c3,{ring:o.hl===i?g.C.c4:null,lw:3}); }); };
  const cw=()=>0, M=(g)=>({px:g.W*.58, cw:Math.min(g.W*.075,44), ch:Math.min(g.H*.075,26)});
  const Xmat=(g,rows,a=1)=>{ const m=M(g); g.alpha(a); g.mat(xs.slice(0,rows).map(x=>[1,x]),m.px,g.H*.12,m.cw,m.ch,{label:'X',hl:(i,j)=>j===0?g.C.k0s:null});
    g.mat(ys.slice(0,rows).map(y=>[y]),m.px+m.cw*2.4,g.H*.12,m.cw,m.ch,{label:'y'}); g.alpha(1); };
  add(1,'Seven houses: size x and price y. We want the best straight line through them.',1100,(g,p)=>plot(g,{upto:Math.ceil(p*n)}));
  add(2,'Build X one row per house: (1, xᵢ). The constant 1 gives the line its intercept.',1800,(g,p)=>{ const r=Math.min(n,Math.floor(p*n)+1); plot(g,{hl:r-1}); Xmat(g,r); });
  add(3,'Summarise: G = XᵀX is 2×2 and g = Xᵀy has 2 numbers, however many houses there are.',1500,(g,p)=>{ plot(g); Xmat(g,n,1-.75*p); const m=M(g);
    g.alpha(p); g.mat(G,m.px,g.H*.73,m.cw*1.25,m.ch*1.1,{label:'G = XᵀX',dp:1,size:.8}); g.mat(gv.map(v=>[v]),m.px+m.cw*3,g.H*.73,m.cw*1.25,m.ch*1.1,{label:'g = Xᵀy',dp:1,size:.8}); g.alpha(1); });
  add(4,'Solve Gβ = g. Two equations, two unknowns: the intercept and the slope.',1500,(g,p)=>{ plot(g,{line:p}); const m=M(g); g.alpha(.25); Xmat(g,n); g.alpha(1);
    g.mat(G,m.px,g.H*.73,m.cw*1.25,m.ch*1.1,{label:'G',dp:1,size:.8}); g.mat([[be[0]],[be[1]]],m.px+m.cw*3,g.H*.73,m.cw*1.25,m.ch*1.1,{label:'β',dp:2,size:.8,hl:()=>p>.5?g.C.k0s:null}); });
  add(5,'Predict ŷ = Xβ and measure the misses e = y − ŷ (red). Least squares made Σe² as small as possible.',1700,(g,p)=>{ plot(g,{line:1,res:p}); const m=M(g);
    g.mat(e.slice(0,Math.ceil(p*n)).map(v=>[v]),m.px+m.cw*.6,g.H*.12,m.cw*1.3,m.ch,{label:'e',dp:2,col:()=>g.C.c2}); });
  add(6,'Return β, ŷ and e. With an intercept the residuals always sum to zero: Σe = '+T.f(T.sum(e),3)+'.',1500,(g)=>{ plot(g,{line:1,res:1}); const m=M(g);
    g.ptxt('β₀ = '+T.f(be[0])+'   β₁ = '+T.f(be[1]),m.px,g.H*.3,g.C.c1,{mono:true,bold:true}); g.ptxt('Σe = '+T.f(T.sum(e),3),m.px,g.H*.42,g.C.c2,{mono:true}); g.ptxt('Σe² = '+T.f(T.sum(e.map(v=>v*v))),m.px,g.H*.52,g.C.muted,{mono:true}); });
  return S;
});

/* ========== linear regression: batch GD then SGD ========== */
AA.def('gd', T => {
  const S=[], add=F(S); const n=14; const xs=T.range(n).map(()=>T.u(-.6,2.6)), B=[T.u(1.6,2.6),T.u(1,1.8)], ys=xs.map(x=>B[0]+B[1]*x+T.g()*.45);
  const mx=T.mean(xs), mxx=T.mean(xs.map(x=>x*x)); const H=[[1,mx],[mx,mxx]]; const bh=T.solve([[n,n*mx],[n*mx,n*mxx]],[T.sum(ys),T.sum(xs.map((x,i)=>x*ys[i]))]);
  const J=b=>T.mean(xs.map((x,i)=>(ys[i]-b[0]-b[1]*x)**2))/2; const Jmin=J(bh);
  const lmax=T.eig2(1,mx,mxx)[0][0], eta=1.15/lmax;
  const det=H[0][0]*H[1][1]-H[0][1]**2, Hi=[H[1][1]/det,-H[0][1]/det,H[0][0]/det];
  const batch=[[0,0]]; for(let t=0;t<8;t++){ const b=batch[batch.length-1]; const gr=[0,0]; xs.forEach((x,i)=>{ const r=ys[i]-b[0]-b[1]*x; gr[0]+=r/n; gr[1]+=r*x/n; }); batch.push([b[0]+eta*gr[0],b[1]+eta*gr[1]]); }
  const sgd=[[0,0]], who=[]; const ord=T.shuffle(T.range(n)); const es=.32; for(let t=0;t<14;t++){ const i=ord[t%n], b=sgd[sgd.length-1], r=ys[i]-b[0]-b[1]*xs[i]; who.push(i); sgd.push([b[0]+es*r,b[1]+es*r*xs[i]]); }
  const left=(g,b,o={})=>{ g.view(.03,.06,.46,.86,-1,3,-1,8.5); g.frame(); g.axes();
    if(b) g.seg(-1,b[0]-b[1],3,b[0]+3*b[1],g.C.c1,2.5); if(o.i!=null && b) g.seg(xs[o.i],ys[o.i],xs[o.i],b[0]+b[1]*xs[o.i],g.C.c2,2.5);
    xs.forEach((x,i)=>g.dot(x,ys[i],o.i===i?6:4,o.i===i?g.C.c4:g.C.c3)); g.txt('data and current line',-0.9,8.1,g.C.muted,{size:.8}); };
  const right=(g,path,k,p,col)=>{ g.view(.53,.06,.45,.86,bh[0]-3.2,bh[0]+3.2,bh[1]-2.6,bh[1]+2.6); g.frame(); g.clip(true);
    [.05,.2,.5,1,2,3.5,5.5].forEach(lv=>g.ell(bh[0],bh[1],Hi[0],Hi[1],Hi[2],Math.sqrt(2*lv),g.C.line,1.2));
    g.dot(bh[0],bh[1],5,g.C.c5); const pts=path.slice(0,k+1).map(q=>[...q]); if(k+1<path.length && p!=null){ const a=path[k], b=path[k+1]; pts.push([T.lerp(a[0],b[0],p),T.lerp(a[1],b[1],p)]); }
    g.poly(pts,col,2); pts.forEach((q,i)=>g.dot(q[0],q[1],i===pts.length-1?5:2.5,col)); g.clip(false); g.txt('β₀',bh[0]+3,bh[1]-2.4,g.C.muted,{align:'right',size:.8}); g.txt('β₁',bh[0]-3.1,bh[1]+2.35,g.C.muted,{size:.8});
    g.txt('J(β) contours; green = least squares',bh[0]-3.1,bh[1]-2.35,g.C.muted,{size:.75}); return pts[pts.length-1]; };
  add(2,'Start at β = 0: a flat line at height 0. The right panel is the bowl J(β), seen from above.',1200,(g)=>{ left(g,[0,0]); right(g,batch,0,null,g.C.c1); });
  for(let t=0;t<8;t++) add([3,4],`Batch step ${t+1}: average the error × input over all ${n} points, then move downhill by η times that.`,t<3?900:600,(g,p)=>{ const b=right(g,batch,t,p,g.C.c1); left(g,b); });
  add(5,'Now the stochastic (LMS) version: restart at 0 and update after every single example.',1100,(g)=>{ left(g,[0,0]); right(g,sgd,0,null,g.C.c4); });
  for(let t=0;t<14;t++) add([7,8],`Example ${who[t]+1}: its error (red) times its input nudges β. Cheaper steps, but they zig-zag.`,t<4?900:450,(g,p)=>{ const b=right(g,sgd,t,p,g.C.c4); left(g,b,{i:who[t]}); });
  add(9,`Return β. Batch reached J = ${T.f(J(batch[8]),3)}, SGD J = ${T.f(J(sgd[14]),3)}; the minimum is ${T.f(Jmin,3)}.`,1600,(g)=>{ right(g,batch,8,null,g.C.c1); const b=right(g,sgd,14,null,g.C.c4); left(g,b); right(g,batch,8,null,g.C.c1); right(g,sgd,14,null,g.C.c4); });
  return S;
});

/* ========== lasso coordinate descent (also used for ISTA-style bars) ========== */
function sparseProblem(d=6, n=40){
  const truth=T.range(d).map(j=>[1.7,0,-1.2,0,.6,0,0,.3][j%8]*(T.r()<.85?1:0));
  const X=T.range(n).map(()=>{ const z=T.g(); return T.range(d).map(j=>T.g()*.8+z*(j<2?.6:0)); });
  for(let j=0;j<d;j++){ const c=X.map(r=>r[j]), m=T.mean(c), s=Math.sqrt(T.mean(c.map(v=>(v-m)**2))); X.forEach(r=>r[j]=(r[j]-m)/s); }
  let y=X.map(r=>T.sum(r.map((v,j)=>v*truth[j]))+T.g()*.5); const my=T.mean(y); y=y.map(v=>v-my);
  return {X,y,d,n,truth};
}
const soft=(z,l)=>Math.sign(z)*Math.max(Math.abs(z)-l,0);
AA.def('lassocd', T => {
  const S=[], add=F(S); const P=sparseProblem(6), lam=.3; const {X,y,d,n}=P; let b=Array(d).fill(0), r=[...y]; const hist=[];
  for(let s=0;s<3;s++) for(let j=0;j<d;j++){ const z=T.sum(X.map((row,i)=>row[j]*r[i]))/n+b[j]; const nb=soft(z,lam); const old=[...b]; X.forEach((row,i)=>r[i]-=row[j]*(nb-b[j])); b[j]=nb; hist.push({s,j,z,old,nw:[...b]}); }
  const bars=(g,vals,o={})=>{ g.view(.04,.08,.56,.78,-.5,d-.5,-2.4,2.4); g.frame(); g.rect(-.5,-lam,d-.5,lam,g.C.soft,null);
    g.seg(-.5,0,d-.5,0,g.C.muted,1); g.txt('±λ',d-.55,lam+.2,g.C.muted,{align:'right',size:.8});
    vals.forEach((v,j)=>{ const hl=o.j===j; g.rect(j-.3,0,j+.3,v,hl?g.C.c1:g.C.c3,null,{a:hl?1:.75}); if(v===0) g.seg(j-.3,0,j+.3,0,g.C.c3,3); g.txt('β'+(j+1),j,-2.15,hl?g.C.c1:g.C.muted,{align:'center',size:.85,mono:true}); });
    if(o.z!=null) g.rect(o.j-.36,0,o.j+.36,o.z,null,g.C.c4,{lw:2}); };
  const fnp=(g,z,out)=>{ g.view(.66,.12,.31,.6,-2.4,2.4,-2.4,2.4); g.frame(); g.axes(); g.fn(x=>x,-2.4,2.4,g.C.line,1,{dash:[4,4]}); g.fn(x=>soft(x,lam),-2.4,2.4,g.C.c1,2.5);
    g.txt('soft-threshold',-2.3,2.15,g.C.muted,{size:.75}); if(z!=null){ g.seg(z,0,z,soft(z,lam)*out,g.C.c4,2,[3,3]); g.dot(z,0,4,g.C.c4); if(out>0) g.dot(z,soft(z,lam)*out,5,g.C.c1); } };
  add(2,'Start with every coefficient at 0; the residual r is all of y. The grey band is ±λ.',1100,(g)=>{ bars(g,b.map(()=>0)); fnp(g); });
  hist.forEach((h,k)=>{ const fast=h.s>0;
    add([4,5],`Sweep ${h.s+1}, coefficient ${h.j+1}: z = its correlation with what is still unexplained (orange outline).`,fast?380:750,(g)=>{ bars(g,h.old,{j:h.j,z:h.z}); fnp(g,h.z,0); });
    add([6,7],Math.abs(h.z)<=lam?`|z| = ${T.f(Math.abs(h.z))} is inside the band, so β${h.j+1} is set to exactly 0.`:`Shrink z towards 0 by λ: β${h.j+1} = ${T.f(h.nw[h.j])}. Update the residual.`,fast?420:850,(g,p)=>{ bars(g,h.old.map((v,j)=>j===h.j?T.lerp(v,h.nw[j],p):v),{j:h.j,z:h.z}); fnp(g,h.z,p); }); });
  add(8,'Coefficients have stopped moving: converged. Zeros mark features the model switched off.',1300,(g)=>{ bars(g,b); fnp(g); });
  add(9,'Return β = ('+b.map(v=>T.f(v,1)).join(', ')+').',1300,(g)=>{ bars(g,b); fnp(g); });
  return S;
});
/* ========== logistic regression: gradient descent ========== */
function logData(n=40){ const pts=T.blobs(n,1.1,.85); return pts; }
function lgStep(pts,w,eta,lam){ const n=pts.length, g=[0,0,0]; let L=0; pts.forEach(q=>{ const p=T.sig(w[0]+w[1]*q.x+w[2]*q.y); g[0]+=(p-q.c)/n; g[1]+=(p-q.c)*q.x/n; g[2]+=(p-q.c)*q.y/n; L-= (q.c?Math.log(p+1e-12):Math.log(1-p+1e-12))/n; });
  g[1]+=lam*w[1]; g[2]+=lam*w[2]; L+=lam/2*(w[1]**2+w[2]**2); return {g,L,w:[w[0]-eta*g[0],w[1]-eta*g[1],w[2]-eta*g[2]]}; }
const lgLoss=(pts,w,lam=0)=>lgStep(pts,w,0,lam).L;
const curve=(g,vals,k,col,lab)=>{ const mx=Math.max(...vals,1e-9); g.view(.64,.14,.33,.62,0,vals.length-1||1,0,mx*1.08); g.frame();
  g.poly(vals.slice(0,k+1).map((v,i)=>[i,v]),col,2.2); vals.slice(0,k+1).forEach((v,i)=>g.dot(i,v,i===k?4.5:2.2,col)); g.ptxt(lab,g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); };
AA.def('logreg', T => {
  const S=[], add=F(S); const pts=logData(44), lam=.02, eta=1.2; const raw=pts.map(q=>({x:q.x*1.6+2.2,y:q.y*.45-1.4}));
  const show=[1,2,4,8,16,40,120]; let w=[0,0,0]; const ws=[[0,0,0]], Ls=[lgLoss(pts,w,lam)], gs=[];
  for(let t=1;t<=120;t++){ const r=lgStep(pts,w,eta,lam); if(show.includes(t)){ gs.push(r.g); } w=r.w; if(show.includes(t)){ ws.push(w); Ls.push(lgLoss(pts,w,lam)); } }
  const plot=(g,wv,o={})=>{ g.view(.03,.06,.56,.88,-3.6,3.6,-3.6,3.6); g.frame(); if(wv) g.shade((x,y)=>T.sig(wv[0]+wv[1]*x+wv[2]*y),24,.32);
    if(wv && Math.hypot(wv[1],wv[2])>1e-6) g.wline(wv[0],wv[1],wv[2],g.C.ink,2.5);
    pts.forEach((q,i)=>{ const P=o.move!=null?{x:T.lerp(raw[i].x,q.x,o.move),y:T.lerp(raw[i].y,q.y,o.move)}:q; g.dot(P.x,P.y,4,kc(g,q.c)); });
    if(o.grad){ const L=Math.hypot(o.grad[1],o.grad[2])||1; g.arrow(0,0,-o.grad[1]/L*1.6,-o.grad[2]/L*1.6,g.C.c4,3); g.txt('−g',-o.grad[1]/L*1.9,-o.grad[2]/L*1.9,g.C.c4,{bold:true,align:'center'}); } };
  add(1,'Two classes of points (blue = 0, red = 1), with features on very different scales.',1000,(g)=>{ plot(g,null,{move:0}); });
  add(2,'Standardise: shift and stretch each feature to mean 0 and spread 1, so one step size suits both weights.',1400,(g,p)=>{ plot(g,null,{move:p}); });
  add(3,'w = 0: every point gets probability σ(0) = 0.5. No boundary yet.',1000,(g)=>{ plot(g,[0,0,0]); curve(g,Ls,0,g.C.c1,'training loss'); });
  show.forEach((t,k)=>{ const a=ws[k], b=ws[k+1];
    add(5,`Iteration ${t}: compute every point's probability p = σ(w·x) (shading).`,k<3?800:450,(g)=>{ plot(g,a); curve(g,Ls,k,g.C.c1,'training loss'); });
    add([6,7],`Gradient g = average of (p − y)·x. Step against it: the boundary turns towards the misclassified points.`,k<3?1100:600,(g,p)=>{ const m=[0,1,2].map(i=>T.lerp(a[i],b[i],p)); plot(g,m,{grad:p<.6?gs[k]:null}); curve(g,Ls,k+p>k+.99?k+1:k,g.C.c1,'training loss'); }); });
  add(8,`The loss has flattened at ${T.f(Ls[Ls.length-1],3)}: stop.`,1100,(g)=>{ plot(g,w); curve(g,Ls,Ls.length-1,g.C.c1,'training loss'); });
  add(9,`Return w = (${w.map(v=>T.f(v)).join(', ')}).`,1200,(g)=>{ plot(g,w); curve(g,Ls,Ls.length-1,g.C.c1,'training loss'); });
  return S;
});

/* ========== logistic regression: Newton / IRLS ========== */
AA.def('newton', T => {
  const S=[], add=F(S); const pts=logData(40), lam=.05; let w=[0,0,0]; const ws=[w], Ls=[lgLoss(pts,w,lam)];
  for(let t=0;t<6;t++){ const n=pts.length, g=lgStep(pts,w,0,lam).g, H=[[0,0,0],[0,0,0],[0,0,0]];
    pts.forEach(q=>{ const x=[1,q.x,q.y], p=T.sig(w[0]+w[1]*q.x+w[2]*q.y), s=p*(1-p); for(let i=0;i<3;i++) for(let j=0;j<3;j++) H[i][j]+=s*x[i]*x[j]/n; });
    H[1][1]+=lam; H[2][2]+=lam; H[0][0]+=1e-6; const D=T.solve(H,g); w=w.map((v,i)=>v-D[i]); ws.push(w); Ls.push(lgLoss(pts,w,lam)); }
  const plot=(g,wv,sz)=>{ g.view(.03,.06,.56,.88,-3.6,3.6,-3.6,3.6); g.frame(); g.shade((x,y)=>T.sig(wv[0]+wv[1]*x+wv[2]*y),24,.32);
    if(Math.hypot(wv[1],wv[2])>1e-6) g.wline(wv[0],wv[1],wv[2],g.C.ink,2.5);
    pts.forEach(q=>{ const p=T.sig(wv[0]+wv[1]*q.x+wv[2]*q.y); g.dot(q.x,q.y,sz?2+14*p*(1-p):4,kc(g,q.c),{a:sz?.85:1}); }); };
  add(2,'Start at w = 0. All points are equally uncertain (p = 0.5).',900,(g)=>{ plot(g,ws[0]); curve(g,Ls,0,g.C.c5,'loss per Newton step'); });
  for(let t=0;t<5;t++){
    add(4,`Step ${t+1}: weight each point by p(1 − p) (dot size). Points near the boundary count most.`,t<2?1200:650,(g)=>{ plot(g,ws[t],true); curve(g,Ls,t,g.C.c5,'loss per Newton step'); });
    add([5,6],'Gradient g (which way is downhill) and Hessian H = XᵀSX (how curved the bowl is).',t<2?900:450,(g)=>{ plot(g,ws[t],true); curve(g,Ls,t,g.C.c5,'loss per Newton step'); });
    add(7,'Solve HΔ = g and jump straight to the bottom of the fitted bowl.',t<2?1100:650,(g,p)=>{ plot(g,ws[t].map((v,i)=>T.lerp(v,ws[t+1][i],p))); curve(g,Ls,p>.95?t+1:t,g.C.c5,'loss per Newton step'); }); }
  add(8,`Δ is tiny after ${5} steps (gradient descent needs hundreds). Converged.`,1200,(g)=>{ plot(g,ws[5]); curve(g,Ls,5,g.C.c5,'loss per Newton step'); });
  add(9,`Return w = (${ws[5].map(v=>T.f(v)).join(', ')}).`,1100,(g)=>{ plot(g,ws[5]); curve(g,Ls,5,g.C.c5,'loss per Newton step'); });
  return S;
});

/* ========== proximal gradient (L1) bars: shared by logistic L1 and ISTA ========== */
function proxAnim(lines, logistic){
  return T => {
    const S=[], add=F(S); const d=8, n=60, truth=[1.4,0,-1.1,0,0,.7,0,0];
    const X=T.range(n).map(()=>T.range(d).map(()=>T.g())); const y=X.map(r=>{ const z=T.sum(r.map((v,j)=>v*truth[j]))+T.g()*.4; return logistic?(T.r()<T.sig(2*z)?1:0):z; });
    const grad=w=>{ const g=Array(d).fill(0); X.forEach((r,i)=>{ const s=T.sum(r.map((v,j)=>v*w[j])); const e=(logistic?T.sig(s):s)-y[i]; r.forEach((v,j)=>g[j]+=e*v/n); }); return g; };
    const eta=logistic?1.6:.45, lam=logistic?.05:.12, tl=eta*lam; let w=Array(d).fill(0); const shown=[1,2,3,5,9,20,60], rec=[];
    for(let t=1;t<=60;t++){ const g=grad(w), u=w.map((v,j)=>v-eta*g[j]), nw=u.map(v=>soft(v,tl)); if(shown.includes(t)) rec.push({t,w0:[...w],u,w1:nw}); w=nw; }
    const top=Math.max(1.6,...rec.flatMap(r=>r.u.map(Math.abs)))*1.1;
    const bars=(g,vals,o={})=>{ g.view(.04,.08,.92,.74,-.5,d-.5,-top,top); g.frame(); g.rect(-.5,-tl,d-.5,tl,g.C.c4,null,{a:.16}); g.seg(-.5,0,d-.5,0,g.C.muted,1);
      g.txt('±ηλ',d-.55,tl+top*.07,g.C.c4,{align:'right',size:.8});
      vals.forEach((v,j)=>{ g.rect(j-.3,0,j+.3,v,v===0?g.C.muted:g.C.c1,null,{a:.85}); if(v===0) g.seg(j-.3,0,j+.3,0,g.C.muted,3);
        if(o.ghost) g.rect(j-.34,0,j+.34,o.ghost[j],null,g.C.c3,{lw:1.5}); g.txt('w'+(j+1),j,-top*.9,g.C.muted,{align:'center',size:.8,mono:true}); });
      const nz=vals.filter(v=>v!==0).length; g.ptxt(`non-zero: ${nz} of ${d}`+(o.t?`   ·   iteration ${o.t}`:''),g.W*.05,g.H*.93,g.C.ink,{mono:true,size:.85}); };
    add(lines.init,'All weights start at 0. The orange band is ±ηλ: anything that lands inside it will be set to exactly 0.',1100,(g)=>bars(g,Array(d).fill(0)));
    rec.forEach((r,k)=>{ const fast=k>2;
      add(lines.step,`Iteration ${r.t}: ordinary gradient step on the ${logistic?'log-loss':'data loss'} only (outlines = u).`,fast?550:1100,(g,p)=>bars(g,r.w0.map((v,j)=>T.lerp(v,r.u[j],p)),{t:r.t}));
      add(lines.thr,'Soft-threshold: pull every weight towards 0 by ηλ; small ones snap to exactly 0.',fast?600:1200,(g,p)=>bars(g,r.u.map((v,j)=>{ const tgt=r.w1[j]; const m=T.lerp(v,tgt,p); return tgt===0&&p>.98?0:m; }),{ghost:r.u,t:r.t})); });
    add(lines.until,'The weights no longer change: done. Only the useful features kept a non-zero weight.',1100,(g)=>bars(g,w));
    add(lines.ret,'Return w: a sparse model ('+w.filter(v=>v!==0).length+' of '+d+' features used; truly used: 3).',1200,(g)=>bars(g,w));
    return S; };
}
AA.def('proxlog', proxAnim({init:1,step:[2,3],thr:4,until:5,ret:6},true));
AA.def('ista', proxAnim({init:2,step:[3,4],thr:5,until:6,ret:7},false));

/* ========== ROC curve ========== */
AA.def('roc', T => {
  const S=[], add=F(S); const n=12; const ex=T.range(n).map(i=>{ const c=i<6?1:0; return {c,s:T.clamp(c?T.u(.3,.98):T.u(.03,.75),.02,.98)}; });
  const jit=ex.map(()=>T.u(.25,.95)); const ord=T.range(n).sort((a,b)=>ex[b].s-ex[a].s); const P=6,N=6; const rc=[[0,0]]; let tp=0,fp=0;
  ord.forEach(i=>{ if(ex[i].c) tp++; else fp++; rc.push([fp/N,tp/P]); }); let auc=0; for(let k=1;k<rc.length;k++) auc+=(rc[k][0]-rc[k-1][0])*(rc[k][1]+rc[k-1][1])/2;
  const strip=(g,sorted,k,thr)=>{ g.view(.04,.1,.5,.34,0,1,0,1); g.frame(); g.txt('score p →',.01,1.1,g.C.muted,{size:.8});
    for(let t=0;t<=4;t++) g.txt(T.f(t/4,2),t/4,-.15,g.C.muted,{align:'center',size:.7,mono:true});
    ex.forEach((e,i)=>{ const pos=ord.indexOf(i); const yy=T.lerp(jit[i],.5,sorted); const passed=k!=null&&pos<k; g.dot(e.s,yy,6,kc(g,e.c),{ring:passed?g.C.ink:null,lw:2.5}); });
    if(thr!=null){ g.seg(thr,0,thr,1,g.C.c1,2.5); g.txt('t',thr,1.08,g.C.c1,{align:'center',bold:true}); } };
  const roc=(g,k,p=1,fill)=>{ g.view(.62,.08,.34,.78,0,1,0,1); g.frame(); g.seg(0,0,1,1,g.C.line,1,[4,4]); const pts=rc.slice(0,k+1);
    if(k+1<rc.length&&p<1) pts.push([T.lerp(rc[k][0],rc[k+1][0],p),T.lerp(rc[k][1],rc[k+1][1],p)]);
    if(fill) g.poly([...pts,[1,0]],null,0,g.C.c1,{a:.18*fill}); g.poly(pts,g.C.c1,2.5); const L=pts[pts.length-1]; g.dot(L[0],L[1],5,g.C.c1);
    g.txt('FPR',.98,-.07,g.C.muted,{align:'right',size:.75}); g.txt('TPR',.02,1.05,g.C.muted,{size:.75}); };
  const counts=(g,k)=>{ let a=0,b=0; for(let i=0;i<k;i++){ if(ex[ord[i]].c) a++; else b++; } g.ptxt(`TP = ${a} of ${P}    FP = ${b} of ${N}`,g.W*.05,g.H*.6,g.C.ink,{mono:true}); g.ptxt('ringed = predicted positive at this t',g.W*.05,g.H*.69,g.C.muted,{size:.8}); };
  add(1,`${n} test examples with their predicted scores. Blue = truly 0, red = truly 1.`,1100,(g)=>{ strip(g,0); roc(g,0); });
  add(2,'Sort them by score, highest first.',1000,(g,p)=>{ strip(g,p); roc(g,0); });
  add(3,'Start the threshold above every score: nothing predicted positive, the curve starts at (0, 0).',900,(g)=>{ strip(g,1,0,1); roc(g,0); counts(g,0); });
  ord.forEach((i,k)=>{ const e=ex[i], prev=k?ex[ord[k-1]].s:1;
    add([4,5,6],e.c?`Lower t past a red point: one more true positive, the curve steps up.`:`Lower t past a blue point: one more false positive, the curve steps right.`,k<4?850:420,(g,p)=>{ strip(g,1,p>.5?k+1:k,T.lerp(prev,e.s-.005,p)); roc(g,k,p); counts(g,p>.5?k+1:k); }); });
  add(7,'Add up the area under the staircase (trapezoid rule).',1200,(g,p)=>{ strip(g,1,n,0); roc(g,n,1,p); counts(g,n); });
  add(8,`AUC = ${T.f(auc,3)}: the chance a random red point scores higher than a random blue one.`,1500,(g)=>{ strip(g,1,n,0); roc(g,n,1,1); g.ptxt('AUC = '+T.f(auc,3),g.W*.05,g.H*.8,g.C.c1,{bold:true,mono:true,size:1.1}); });
  return S;
});

/* ========== PCA ========== */
AA.def('pca', T => {
  const S=[], add=F(S); const n=34, a=T.u(.2,1.2), s1=T.u(1.2,1.6), s2=T.u(.3,.5), off=[T.u(1,2),T.u(.6,1.4)];
  const raw=T.range(n).map(()=>{ const u=T.g()*s1, v=T.g()*s2; return [off[0]+u*Math.cos(a)-v*Math.sin(a), off[1]+u*Math.sin(a)+v*Math.cos(a)]; });
  const m=[T.mean(raw.map(q=>q[0])),T.mean(raw.map(q=>q[1]))]; const c=raw.map(q=>[q[0]-m[0],q[1]-m[1]]);
  const Sxx=T.mean(c.map(q=>q[0]*q[0])), Sxy=T.mean(c.map(q=>q[0]*q[1])), Syy=T.mean(c.map(q=>q[1]*q[1])); const [[l1,v1],[l2,v2]]=T.eig2(Sxx,Sxy,Syy);
  const z=c.map(q=>q[0]*v1[0]+q[1]*v1[1]);
  const plot=(g,o={})=>{ g.view(.03,.06,.6,.88,-3.4,3.4,-2.6,2.6); g.frame(); g.axes();
    const sh=o.centre==null?0:1-o.centre;
    if(o.pc){ const k=o.pc; g.arrow(0,0,v1[0]*Math.sqrt(l1)*2*k,v1[1]*Math.sqrt(l1)*2*k,g.C.c1,3); g.arrow(0,0,v2[0]*Math.sqrt(l2)*2*k,v2[1]*Math.sqrt(l2)*2*k,g.C.c3,3); }
    if(o.line) g.seg(-v1[0]*4,-v1[1]*4,v1[0]*4,v1[1]*4,g.C.c1,1.5,[5,4]);
    c.forEach((q,i)=>{ let x=q[0]+m[0]*sh, y=q[1]+m[1]*sh; const pr=[z[i]*v1[0],z[i]*v1[1]];
      if(o.proj!=null){ x=T.lerp(q[0],pr[0],o.proj); y=T.lerp(q[1],pr[1],o.proj); }
      if(o.err){ g.seg(q[0],q[1],pr[0],pr[1],g.C.c2,1.6); g.dot(q[0],q[1],3,g.C.muted,{a:.5}); g.dot(pr[0],pr[1],3.6,g.C.c1); return; }
      g.dot(x,y,3.6,g.C.c3); });
    if(o.mean!=null) g.dot(m[0]*(o.centre==null?1:1-o.centre),m[1]*(o.centre==null?1:1-o.centre),6,g.C.c4,{ring:g.C.ink}); };
  const side=(g,o={})=>{ const x=g.W*.67, y=g.H*.14; if(o.var){ g.view(.68,.18,.28,.5,-.5,1.5,0,l1*1.15); g.frame(); g.bars([l1,l2],0,l1*1.2,(i)=>i?g.C.c3:g.C.c1,{lab:i=>'λ'+(i+1)}); g.ptxt('variance per direction',x,y,g.C.muted,{size:.8}); }
    if(o.txt) o.txt.forEach((t,i)=>g.ptxt(t,x,g.H*(.78+i*.08),i?g.C.muted:g.C.ink,{mono:!i,size:i?.8:.9})); };
  add(1,`${n} points with 2 correlated features. We want 1 number per point that keeps as much as possible.`,1000,(g)=>{ plot(g,{centre:0}); });
  add(2,'Centre: subtract the mean (orange) so the cloud sits on the origin.',1300,(g,p)=>{ plot(g,{centre:p,mean:1}); });
  add(3,'(Same units here, so no rescaling is needed.)',700,(g)=>{ plot(g,{centre:1}); });
  add(4,'SVD / eigen-decomposition finds the two directions of the cloud: the long axis and the short one.',1400,(g,p)=>{ plot(g,{centre:1,pc:p}); });
  add([5,6],'Keep k = 1 direction (purple). Its eigenvalue is the variance along it.',1300,(g)=>{ plot(g,{centre:1,pc:1,line:1}); side(g,{var:1}); });
  add(7,'Scores Z = X̃W: slide every point onto the purple line. One number per point now.',1500,(g,p)=>{ plot(g,{proj:p,line:1}); side(g,{var:1}); });
  add(8,'Reconstruct: the purple dots are the best 1-D rebuild; red segments are what was lost.',1400,(g)=>{ plot(g,{err:1,line:1}); side(g,{var:1}); });
  add(9,`Return W and Z. Explained variance: ${T.f(100*l1/(l1+l2),1)}% kept with 1 of 2 numbers.`,1600,(g)=>{ plot(g,{err:1,line:1}); side(g,{var:1,txt:[`kept ${T.f(100*l1/(l1+l2),1)}%`,'λ₁ / (λ₁ + λ₂)']}); });
  return S;
});
/* ========== GDA fit + predict ========== */
const inv2=(a,b,d)=>{ const D=a*d-b*b; return [d/D,-b/D,a/D,D]; };
const lerpS=(A,B,p)=>A.map((v,i)=>T.lerp(v,B[i],p));
AA.def('gda', T => {
  const S=[], add=F(S); const pts=[]; const mu=[[-1.2+T.u(-.3,.3),-.5+T.u(-.3,.3)],[1.2+T.u(-.3,.3),.6+T.u(-.3,.3)]];
  const shp=[[1.1,.5*T.u(-1,1),.35],[.4,-.2*T.u(-1,1),.9]];
  for(let k=0;k<2;k++){ const [a,b,d]=shp[k], l11=Math.sqrt(a), l21=b/l11, l22=Math.sqrt(Math.max(.05,d-l21*l21)); const nk=k?14:22;
    for(let i=0;i<nk;i++){ const z1=T.g(), z2=T.g(); pts.push({x:mu[k][0]+l11*z1, y:mu[k][1]+l21*z1+l22*z2, c:k}); } }
  const st=[0,1].map(k=>{ const P=pts.filter(q=>q.c===k), m=[T.mean(P.map(q=>q.x)),T.mean(P.map(q=>q.y))];
    return {n:P.length, m, S:[T.mean(P.map(q=>(q.x-m[0])**2)),T.mean(P.map(q=>(q.x-m[0])*(q.y-m[1]))),T.mean(P.map(q=>(q.y-m[1])**2))]}; });
  const N=pts.length, pi=st.map(s=>s.n/N), pool=[0,1,2].map(i=>pi[0]*st[0].S[i]+pi[1]*st[1].S[i]);
  const al=.3, tr=(pool[0]+pool[2])/2, shr=[(1-al)*pool[0]+al*tr,(1-al)*pool[1],(1-al)*pool[2]+al*tr];
  const [ia,ib,id,D]=inv2(...shr); const dl=(x,y,k)=>{ const dx=x-st[k].m[0], dy=y-st[k].m[1]; return Math.log(pi[k])-.5*Math.log(D)-.5*(ia*dx*dx+2*ib*dx*dy+id*dy*dy); };
  const post=(x,y)=>T.sig(dl(x,y,1)-dl(x,y,0)); const q=[T.u(-.6,.8),T.u(-1.6,1.6)]; const d0=dl(q[0],q[1],0), d1=dl(q[0],q[1],1), pq=T.sig(d1-d0);
  const plot=(g,o={})=>{ g.view(.03,.06,.6,.88,-3.6,3.6,-2.7,2.7); g.frame(); if(o.shade) g.shade(post,26,.3*o.shade);
    pts.forEach(p=>g.dot(p.x,p.y,o.pulse===p.c?5.5:3.8,kc(g,p.c),{a:o.dim?.45:1}));
    [0,1].forEach(k=>{ if(o.mean==null||o.mean<k) return; const m=st[k].m, sz=.22; g.seg(m[0]-sz,m[1],m[0]+sz,m[1],g.C.ink,3); g.seg(m[0],m[1]-sz,m[0],m[1]+sz,g.C.ink,3);
      if(o.S){ const s=o.S[k]; g.ell(m[0],m[1],s[0],s[1],s[2],o.k||2,kc(g,k),2.2); if(o.ghost) g.ell(m[0],m[1],o.ghost[k][0],o.ghost[k][1],o.ghost[k][2],2,g.C.muted,1.4,null,{dash:[4,4]}); } });
    if(o.q){ if(o.lines){ [0,1].forEach(k=>{ g.seg(q[0],q[1],st[k].m[0],st[k].m[1],kc(g,k),2,[5,4]); }); }
      g.dot(q[0],q[1],8,o.qc!=null?kc(g,o.qc):g.C.c4,{ring:g.C.ink,lw:2}); }
    if(o.bd){ const w1=ia*(st[1].m[0]-st[0].m[0])+ib*(st[1].m[1]-st[0].m[1]), w2=ib*(st[1].m[0]-st[0].m[0])+id*(st[1].m[1]-st[0].m[1]); const w0=dl(0,0,1)-dl(0,0,0); g.wline(w0,w1,w2,g.C.ink,2.5); } };
  const info=(g,lines)=>lines.forEach((t,i)=>g.ptxt(t[0],g.W*.66,g.H*(.14+i*.085),t[1]||g.C.ink,{mono:true,size:.85,bold:t[2]}));
  add(1,'Two classes. We will describe each one as a Gaussian cloud: a centre and a shape.',1000,(g)=>plot(g));
  [0,1].forEach(k=>add([2,3],`Class ${k}: its prior π${k} = ${st[k].n}/${N} and its mean (the cross) = the average of its points.`,1100,(g)=>{ plot(g,{pulse:k,mean:k}); info(g,[[`π0 = ${T.f(pi[0])}`,g.C.k0],k?[`π1 = ${T.f(pi[1])}`,g.C.k1]:['']]); }));
  add(4,'Covariance: how spread out and tilted each cloud is. The ellipses are 2-standard-deviation contours.',1300,(g,p)=>plot(g,{mean:1,S:st.map(s=>s.S),k:2*p+.01}));
  add(5,'LDA: replace both shapes by one shared, pooled shape. (QDA would keep them separate.)',1400,(g,p)=>plot(g,{mean:1,S:st.map(s=>lerpS(s.S,pool,p))}));
  add(6,'Naive Bayes would instead drop the tilt (dashed). We stay with LDA here.',1100,(g)=>plot(g,{mean:1,S:[pool,pool],ghost:[[pool[0],0,pool[2]],[pool[0],0,pool[2]]]}));
  add(7,`Shrinkage α = ${al}: nudge the shape towards a circle, which makes Σ⁻¹ more stable.`,1200,(g,p)=>plot(g,{mean:1,S:[0,1].map(()=>lerpS(pool,shr,p))}));
  add(8,'A new point arrives (orange). Which cloud did it come from?',900,(g)=>plot(g,{mean:1,S:[shr,shr],q:1,dim:1}));
  add(9,`Score each class: log prior minus half the shape-aware (Mahalanobis) distance². δ0 = ${T.f(d0)}, δ1 = ${T.f(d1)}.`,1600,(g)=>{ plot(g,{mean:1,S:[shr,shr],q:1,lines:1,dim:1}); info(g,[[`δ0 = ${T.f(d0)}`,g.C.k0],[`δ1 = ${T.f(d1)}`,g.C.k1]]); });
  add(10,`Softmax turns scores into probabilities: P(class 1 | x) = ${T.f(pq)}.`,1300,(g,p)=>{ plot(g,{mean:1,S:[shr,shr],q:1,lines:1,dim:1}); info(g,[[`δ0 = ${T.f(d0)}`,g.C.k0],[`δ1 = ${T.f(d1)}`,g.C.k1]]);
    const x=g.W*.66, w=g.W*.3, y=g.H*.42; g.prect(x,y,w,g.H*.06,g.C.k0,null,{a:.8}); g.prect(x,y,w*pq*p,g.H*.06,g.C.k1,null); g.ptxt('P(1|x) = '+T.f(pq*p),x,y+g.H*.11,g.C.ink,{mono:true,size:.85}); });
  add(11,`Predict class ${pq>.5?1:0}. Doing this everywhere gives the straight LDA boundary and the shading.`,1600,(g,p)=>plot(g,{mean:1,S:[shr,shr],q:1,qc:pq>.5?1:0,shade:p,bd:1}));
  return S;
});

/* ========== sampling from GDA ========== */
AA.def('gdasample', T => {
  const S=[], add=F(S); const mu=[[-1.3,-.4],[1.3,.5]], sh=[[1,.55,.6],[.45,-.25,.8]], pi1=T.u(.35,.6);
  const L=sh.map(([a,b,d])=>{ const l11=Math.sqrt(a), l21=b/l11; return [l11,l21,Math.sqrt(d-l21*l21)]; });
  const smp=T.range(60).map(()=>{ const k=T.r()<pi1?1:0, z=[T.g(),T.g()], l=L[k]; return {k,z,u:T.r(),x:[mu[k][0]+l[0]*z[0], mu[k][1]+l[1]*z[0]+l[2]*z[1]]}; });
  const main=(g,upto,cur,p)=>{ g.view(.03,.06,.6,.88,-4,4,-3,3); g.frame(); [0,1].forEach(k=>{ g.ell(mu[k][0],mu[k][1],...sh[k],2,kc(g,k),1.5,null,{a:.6}); });
    smp.slice(0,upto).forEach(s=>g.dot(s.x[0],s.x[1],3.6,kc(g,s.k)));
    if(cur){ const s=cur, from=[mu[s.k][0]+s.z[0]*.5,mu[s.k][1]+s.z[1]*.5]; const pos=[T.lerp(from[0],s.x[0],p),T.lerp(from[1],s.x[1],p)]; g.seg(mu[s.k][0],mu[s.k][1],pos[0],pos[1],g.C.c4,1.5,[4,3]); g.dot(pos[0],pos[1],6,kc(g,s.k),{ring:g.C.c4,lw:2.5}); } };
  const zbox=(g,s)=>{ g.view(.68,.1,.28,.42,-3,3,-3,3); g.frame(); g.ell(0,0,1,0,1,1,g.C.line,1); g.ell(0,0,1,0,1,2,g.C.line,1); g.ptxt('z ~ N(0, I)',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8});
    if(s) g.dot(s.z[0],s.z[1],5,g.C.c4); };
  const coin=(g,s,p)=>{ const x=g.W*.68, w=g.W*.28, y=g.H*.66; g.prect(x,y,w*(1-pi1),g.H*.06,g.C.k0,null); g.prect(x+w*(1-pi1),y,w*pi1,g.H*.06,g.C.k1,null);
    g.ptxt('π0 | π1',x,y-g.fs*.8,g.C.muted,{size:.8}); if(s){ const px=x+w*(s.k?(1-pi1)+s.u*pi1:s.u*(1-pi1)); g.pseg(px,y-6,px,y+g.H*.06+6,g.C.ink,2.5); g.ptxt('class '+s.k,x,y+g.H*.13,kc(g,s.k),{bold:true,size:.9}); } };
  for(let i=0;i<8;i++){ const s=smp[i], f=i>2;
    add(2,`Sample ${i+1}: flip the biased coin to pick a class.`,f?300:800,(g)=>{ main(g,i); zbox(g); coin(g,s); });
    add(3,'Draw z: two independent standard normals (a point in a round cloud).',f?300:800,(g)=>{ main(g,i); zbox(g,s); coin(g,s); });
    add(4,'x = μ + Lz: L stretches and tilts the round draw into the class shape, then we shift it to the class centre.',f?500:1200,(g,p)=>{ main(g,i,s,p); zbox(g,s); coin(g,s); });
    add(5,'Emit (x, k) and repeat.',f?200:500,(g)=>{ main(g,i+1); zbox(g,s); coin(g,s); }); }
  add(1,'After many repeats the fake data has the same clouds as the real data: this is what "generative" means.',1800,(g,p)=>{ main(g,8+Math.round(p*52)); zbox(g); coin(g); });
  return S;
});

/* ========== SVM by SMO ========== */
AA.def('smo', T => {
  const S=[], add=F(S); const pts=T.blobs(16,1.25,.75); const X=pts.map(q=>[q.x,q.y]), y=pts.map(q=>q.c?1:-1), n=pts.length, C=1.5;
  const K=X.map(a=>X.map(b=>a[0]*b[0]+a[1]*b[1])); let al=Array(n).fill(0), G=Array(n).fill(-1); const its=[];
  const wb=(a)=>{ const w=[0,0]; a.forEach((v,i)=>{ w[0]+=v*y[i]*X[i][0]; w[1]+=v*y[i]*X[i][1]; }); return w; };
  for(let it=0;it<40;it++){ let i=-1,j=-1,m=-1e9,M=1e9;
    for(let k=0;k<n;k++){ const v=-y[k]*G[k]; const up=(y[k]>0&&al[k]<C-1e-9)||(y[k]<0&&al[k]>1e-9), lo=(y[k]>0&&al[k]>1e-9)||(y[k]<0&&al[k]<C-1e-9);
      if(up&&v>m){ m=v; i=k; } if(lo&&v<M){ M=v; j=k; } }
    if(m-M<1e-3||i<0||j<0) break; const eta=Math.max(1e-9,K[i][i]+K[j][j]-2*K[i][j]); let t=(m-M)/eta;
    t=Math.min(t, y[i]>0?C-al[i]:al[i], y[j]>0?al[j]:C-al[j]); const old=[...al]; al[i]+=y[i]*t; al[j]-=y[j]*t;
    for(let k=0;k<n;k++) G[k]+=y[k]*y[i]*K[k][i]*(al[i]-old[i])+y[k]*y[j]*K[k][j]*(al[j]-old[j]);
    let b=(m+M)/2; its.push({i,j,old,nw:[...al],b,gap:m-M}); }
  const plot=(g,a,b,o={})=>{ g.view(.03,.06,.58,.88,-3.6,3.6,-3,3); g.frame(); const w=wb(a);
    if(Math.hypot(w[0],w[1])>1e-6){ g.wline(b,w[0],w[1],g.C.ink,2.5); g.wline(b-1,w[0],w[1],g.C.muted,1.4,[5,4]); g.wline(b+1,w[0],w[1],g.C.muted,1.4,[5,4]); }
    pts.forEach((q,k)=>{ const sv=a[k]>1e-6; g.dot(q.x,q.y,sv?5.5:4,kc(g,q.c),{ring:k===o.i?g.C.c4:k===o.j?g.C.c1:sv?g.C.ink:null,lw:k===o.i||k===o.j?3.5:2}); }); };
  const bars=(g,a,o={})=>{ g.view(.66,.18,.31,.55,-.5,n-.5,0,C*1.15); g.frame(); g.seg(-.5,C,n-.5,C,g.C.c2,1.2,[4,3]); g.txt('C',n-.6,C*1.07,g.C.c2,{align:'right',size:.8});
    a.forEach((v,k)=>g.rect(k-.35,0,k+.35,v,k===o.i?g.C.c4:k===o.j?g.C.c1:kc(g,pts[k].c),null,{a:.85})); g.ptxt('α per point',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); };
  add(2,'Start with every α = 0: no point influences the boundary yet.',1000,(g)=>{ plot(g,al.map(()=>0),0); bars(g,al.map(()=>0)); });
  its.forEach((r,k)=>{ const f=k>4;
    add([4,5],`Pick the pair that most violates the optimality (KKT) conditions: i (orange) and j (purple).`,f?350:900,(g)=>{ plot(g,r.old,k?its[k-1].b:0,{i:r.i,j:r.j}); bars(g,r.old,{i:r.i,j:r.j}); });
    add([7,8,9],`Solve for the best change of just these two α's, keeping Σαy = 0, clipped to [0, C]. The boundary moves.`,f?400:1100,(g,p)=>{ const a=r.old.map((v,q)=>T.lerp(v,r.nw[q],p)); plot(g,a,T.lerp(k?its[k-1].b:0,r.b,p),{i:r.i,j:r.j}); bars(g,a,{i:r.i,j:r.j}); }); });
  const last=its[its.length-1]||{nw:al,b:0};
  add(6,`KKT gap below tolerance after ${its.length} pair updates: optimal.`,1000,(g)=>{ plot(g,last.nw,last.b); bars(g,last.nw); });
  add([10,11],`Only the ringed points have α > 0: they are the support vectors (${last.nw.filter(v=>v>1e-6).length} of ${n}).`,1600,(g)=>{ plot(g,last.nw,last.b); bars(g,last.nw); });
  return S;
});

/* ========== CART ========== */
AA.def('cart', T => {
  const S=[], add=F(S); const a=T.u(-.8,.6), b=T.u(-.6,.8); const pts=T.range(44).map(()=>{ const x=T.u(-3,3), y=T.u(-3,3); let c=(x>a&&y>b)||(x<-1.6&&y<-1)?1:0; if(T.r()<.06) c=1-c; return {x,y,c}; });
  const w=pts.map(()=>1), idx=T.range(pts.length); const tree=grow(pts,w,idx,0,{max:3,minLeaf:2}); const box={x0:-3,x1:3,y0:-3,y1:3};
  const gini=(n0,n1)=>{ const t=n0+n1; return t?2*n0*n1/t:0; };
  const scan=f=>{ const key=f?'y':'x'; const s=[...pts].sort((p,q)=>p[key]-q[key]); const N1=pts.filter(p=>p.c).length, N0=pts.length-N1; let l0=0,l1=0; const out=[];
    for(let k=0;k<s.length-1;k++){ if(s[k].c) l1++; else l0++; const t=(s[k][key]+s[k+1][key])/2; out.push([t,(gini(N0,N1)-gini(l0,l1)-gini(N0-l0,N1-l1))/pts.length]); } return out; };
  const sc=[scan(0),scan(1)]; const gmax=Math.max(...sc[0].map(v=>v[1]),...sc[1].map(v=>v[1]))*1.15||1;
  const best=f=>sc[f].reduce((m,v)=>v[1]>m[1]?v:m,[0,-1]);
  const plot=(g,o={})=>{ g.view(.03,.06,.56,.88,-3,3,-3,3); g.frame(); if(o.leaves) drawLeaves(g,tree,box,.3*o.leaves); if(o.splits) tSplits(tree,box).slice(0,o.splits).forEach(s=>g.seg(s[0],s[1],s[2],s[3],g.C.ink,2));
    if(o.t!=null){ if(o.f) g.seg(-3,o.t,3,o.t,g.C.c4,2.5); else g.seg(o.t,-3,o.t,3,g.C.c4,2.5); }
    pts.forEach(p=>g.dot(p.x,p.y,4,kc(g,p.c))); };
  const gain=(g,f,k)=>{ g.view(.65,.16,.32,.6,-3,3,0,gmax); g.frame(); const s=sc[f].slice(0,k); g.poly(s,f?g.C.c3:g.C.c1,2);
    g.ptxt('impurity drop Δ for split on '+(f?'x₂':'x₁'),g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); if(k>=sc[f].length){ const bb=best(f); g.dot(bb[0],bb[1],6,g.C.c4,{ring:g.C.ink}); }
    if(o2.prev!=null && f===1){ } };
  const o2={};
  add(1,'Grow(all points, depth 0). Mixed node, so we look for the best yes/no question.',1000,(g)=>plot(g));
  [0,1].forEach(f=>{ const L=sc[f].length;
    add([5,6],`Feature ${f?'x₂':'x₁'}: sort the points by it and start with every point on one side.`,700,(g)=>{ plot(g); gain(g,f,0); });
    add([7,8,9],`Slide the threshold along ${f?'x₂':'x₁'}; at each gap, score how much purer the two sides become.`,2600,(g,p)=>{ const k=Math.max(1,Math.round(p*L)); plot(g,{f,t:sc[f][k-1][0]}); gain(g,f,k); }); });
  const r=tree.leaf?null:tree; const bf=r?r.f:0, bt=r?r.t:0;
  add(9,`Best question overall: is ${bf?'x₂':'x₁'} ≤ ${T.f(bt)}? (Δ = ${T.f(best(bf)[1],3)})`,1100,(g)=>{ plot(g,{f:bf,t:bt}); gain(g,bf,sc[bf].length); });
  add(11,'Split: points that answer yes go left, the rest go right.',900,(g)=>plot(g,{splits:1}));
  const ns=tSplits(tree,box).length; for(let k=2;k<=ns;k++) add(12,`Recurse: run exactly the same search inside each child (split ${k} of ${ns}).`,750,(g)=>plot(g,{splits:k}));
  add([2,3],'Stop when a node is pure or at max depth: it becomes a leaf that predicts its majority class.',1500,(g,p)=>plot(g,{splits:ns,leaves:p}));
  return S;
});

/* ========== random forest ========== */
AA.def('rf', T => {
  const S=[], add=F(S); const pts=T.range(46).map(()=>{ const x=T.u(-3,3), y=T.u(-3,3); let c=x*x+y*y<3.2?1:0; if(T.r()<.08) c=1-c; return {x,y,c}; });
  const n=pts.length, box={x0:-3,x1:3,y0:-3,y1:3}, B=30; const trees=[];
  for(let b=0;b<B;b++){ const cnt=Array(n).fill(0); for(let i=0;i<n;i++) cnt[T.ri(n)]++; const idx=T.range(n).filter(i=>cnt[i]); trees.push({cnt,tree:grow(pts,cnt,idx,0,{max:5,m:1,minLeaf:1})}); }
  const avg=(k)=>(x,y)=>{ let s=0; for(let b=0;b<k;b++) s+=tPred(trees[b].tree,x,y); return s/k; };
  let oe=0, on=0; pts.forEach((p,i)=>{ let s=0,c=0; trees.forEach(t=>{ if(!t.cnt[i]){ s+=tPred(t.tree,p.x,p.y); c++; } }); if(c){ on++; if((s/c>.5?1:0)!==p.c) oe++; } });
  const left=(g,b,o={})=>{ g.view(.02,.1,.47,.8,-3,3,-3,3); g.frame(); const t=trees[b]; if(o.tree) { drawLeaves(g,t.tree,box,.35*o.tree); drawSplits(g,t.tree,box,g.C.ink,1.2); }
    pts.forEach((p,i)=>{ const c=t.cnt[i]; if(o.boot==null) g.dot(p.x,p.y,3.6,kc(g,p.c)); else if(c) g.dot(p.x,p.y,3+o.boot*2.2*c,kc(g,p.c)); else g.dot(p.x,p.y,3.6,kc(g,p.c),{hollow:true,a:o.oob?1:.35,lw:o.oob?2.5:1.5}); });
    g.ptxt(`tree ${b+1}`,g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); };
  const right=(g,k)=>{ g.view(.51,.1,.47,.8,-3,3,-3,3); g.frame(); if(k>0) g.shade(avg(k),24,.42); pts.forEach(p=>g.dot(p.x,p.y,3,kc(g,p.c),{a:.7}));
    g.ptxt(k?`forest vote of ${k} tree${k>1?'s':''}`:'forest (empty)',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); };
  for(let b=0;b<5;b++){ const f=b>1;
    add([2,3],`Tree ${b+1}: draw ${n} points with replacement. Bigger dots were drawn more than once.`,f?500:1000,(g,p)=>{ left(g,b,{boot:p}); right(g,b); });
    add([4,5],'Grow a deep tree on that sample, but each split may only look at one randomly chosen feature.',f?500:1100,(g,p)=>{ left(g,b,{boot:1,tree:p}); right(g,b); });
    add(6,`Hollow points were never drawn: they are this tree's out-of-bag set (${trees[b].cnt.filter(c=>!c).length} points).`,f?400:900,(g)=>{ left(g,b,{boot:1,tree:1,oob:1}); right(g,b); });
    add(7,'Add the tree to the forest: the shading is the average vote. Jagged single trees smooth out.',f?500:1000,(g)=>{ left(g,b,{boot:1,tree:1}); right(g,b+1); }); }
  add(2,`…and so on, up to B = ${B} trees.`,1600,(g,p)=>{ const k=Math.max(5,Math.round(5+p*(B-5))); left(g,k-1,{boot:1,tree:1}); right(g,k); });
  add(8,`Out-of-bag error: each point judged only by trees that never saw it = ${T.f(100*oe/Math.max(1,on),1)}%.`,1800,(g)=>{ left(g,B-1,{boot:1,tree:1,oob:1}); right(g,B); });
  return S;
});

/* ========== AdaBoost ========== */
AA.def('ada', T => {
  const S=[], add=F(S); const pts=T.range(40).map(()=>{ const x=T.u(-3,3), y=T.u(-3,3); let c=(x+.6*Math.sin(1.4*y)>T.u(-.2,.2)+.3*y)?1:0; if(T.r()<.05) c=1-c; return {x,y,c}; });
  const n=pts.length, Y=pts.map(p=>p.c?1:-1), box={x0:-3,x1:3,y0:-3,y1:3}; let D=Array(n).fill(1/n); const R=[];
  for(let t=0;t<30;t++){ const st=grow(pts,D,T.range(n),0,{max:1}); const h=pts.map(p=>tPred(st,p.x,p.y)>.5?1:-1); let e=0; h.forEach((v,i)=>{ if(v!==Y[i]) e+=D[i]; }); e=T.clamp(e,1e-6,.4999);
    const a=.5*Math.log((1-e)/e); const D1=D.map((d,i)=>d*Math.exp(-a*Y[i]*h[i])); const Z=T.sum(D1); R.push({st,h,e,a,D0:D,D1:D1.map(v=>v/Z)}); D=D1.map(v=>v/Z); }
  const F_=(k)=>(x,y)=>{ let s=0; for(let t=0;t<k;t++) s+=R[t].a*(tPred(R[t].st,x,y)>.5?1:-1); return T.sig(2*s); };
  const left=(g,t,o={})=>{ const r=R[t]; g.view(.02,.08,.47,.72,-3,3,-3,3); g.frame(); if(o.stump){ drawLeaves(g,r.st,box,.3*o.stump); drawSplits(g,r.st,box,g.C.c4,2.5); }
    const W=o.w||r.D0; pts.forEach((p,i)=>{ const rr=2+Math.sqrt(W[i]*n)*3.4; g.dot(p.x,p.y,rr,kc(g,p.c),{a:.85}); if(o.miss && r.h[i]!==Y[i]){ const X=g.X(p.x),Yp=g.Y(p.y),s=rr+3; g.pseg(X-s,Yp-s,X+s,Yp+s,g.C.ink,2); g.pseg(X-s,Yp+s,X+s,Yp-s,g.C.ink,2); } });
    g.ptxt(`round ${t+1}: weak learner on weighted points`,g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); };
  const right=(g,k)=>{ g.view(.51,.08,.47,.72,-3,3,-3,3); g.frame(); if(k) g.shade(F_(k),24,.42); pts.forEach(p=>g.dot(p.x,p.y,3,kc(g,p.c),{a:.7}));
    g.ptxt(`ensemble of ${k} stumps`,g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8});
    const m=Math.min(k,12); g.view(.51,.84,.47,.13,-.5,11.5,0,Math.max(...R.slice(0,12).map(r=>r.a))*1.1); g.bars(R.slice(0,m).map(r=>r.a).concat(Array(12-m).fill(0)),0,9,()=>g.C.c1); g.ptxt('votes α',g.W*.51,g.H*.83,g.C.muted,{size:.75}); };
  add(2,'Every point starts with the same weight 1/n (dot size).',900,(g)=>{ left(g,0); right(g,0); });
  for(let t=0;t<7;t++){ const r=R[t], f=t>2;
    add([3,4],`Round ${t+1}: fit a one-question stump to the weighted points.`,f?500:1000,(g,p)=>{ left(g,t,{stump:p}); right(g,t); });
    add(5,`Weighted error ε = ${T.f(r.e,3)} (crossed points are its mistakes).`,f?450:900,(g)=>{ left(g,t,{stump:1,miss:1}); right(g,t); });
    add(7,`Its vote α = ½ ln((1 − ε)/ε) = ${T.f(r.a)}. Better stumps get louder votes.`,f?400:900,(g)=>{ left(g,t,{stump:1,miss:1}); right(g,t+1); });
    add([8,9],'Reweight: mistakes grow by e^α, correct points shrink by e^−α, then renormalise.',f?600:1200,(g,p)=>{ left(g,t,{stump:1,miss:1,w:r.D0.map((v,i)=>T.lerp(v,r.D1[i],p))}); right(g,t+1); }); }
  add(10,'Final classifier: the sign of the α-weighted vote. After 30 rounds the stumps build a curved staircase.',1800,(g,p)=>{ const k=Math.round(7+p*23); left(g,Math.max(0,k-1),{stump:1}); right(g,k); });
  return S;
});

/* ========== K-fold CV for lambda ========== */
AA.def('cv', T => {
  const S=[], add=F(S); const K=5, lams=[-4,-3,-2,-1,0,1], c=T.u(-2.2,-1); const errs=lams.map(l=>T.range(K).map(()=>.22+.035*(l-c)**2+T.g()*.025));
  const cv=errs.map(e=>T.mean(e)), se=errs.map(e=>Math.sqrt(T.mean(e.map(v=>(v-T.mean(e))**2))/K)); const bi=cv.indexOf(Math.min(...cv)); let one=bi; for(let i=lams.length-1;i>bi;i--) if(cv[i]<=cv[bi]+se[bi]){ one=i; break; }
  const top=Math.max(...errs.flat())*1.1;
  const strip=(g,k)=>{ const x=g.W*.05, w=g.W*.9, y=g.H*.08, h=g.H*.1; for(let f=0;f<K;f++){ const v=f===k; g.prect(x+f*w/K+2,y,w/K-4,h,v?g.C.c4:g.C.c3,null,{r:4,a:v?.9:.5}); g.ptxt(v?'validate':'train',x+f*w/K+w/K/2,y+h/2,'#fff',{align:'center',size:.8,bold:true}); } };
  const plot=(g,upto,fk,o={})=>{ g.view(.1,.3,.86,.58,-4.5,1.5,0,top); g.frame(); for(let i=0;i<lams.length;i++) g.txt('10^'+lams[i],lams[i],-top*.07,g.C.muted,{align:'center',size:.75,mono:true});
    g.txt('validation error',-4.45,top*.95,g.C.muted,{size:.8});
    for(let i=0;i<=upto&&i<lams.length;i++){ const kk=i<upto?K:fk; for(let f=0;f<kk;f++) g.dot(lams[i]+(f-2)*.06,errs[i][f],3,g.C.c3,{a:.7});
      if(i<upto||o.mean===i){ g.seg(lams[i],cv[i]-se[i],lams[i],cv[i]+se[i],g.C.c1,2); g.dot(lams[i],cv[i],5,g.C.c1); } }
    if(o.pick){ g.seg(-4.5,cv[bi]+se[bi],1.5,cv[bi]+se[bi],g.C.muted,1,[4,4]); g.dot(lams[bi],cv[bi],8,g.C.c5,{hollow:true,lw:3}); g.dot(lams[one],cv[one],8,g.C.c4,{hollow:true,lw:3}); } };
  add(2,`Split the training data into ${K} folds.`,900,(g)=>{ strip(g,-1); plot(g,0,0); });
  lams.forEach((l,i)=>{ for(let f=0;f<K;f++) add([4,5,6],`λ = 10^${l}: train on 4 folds, measure error on fold ${f+1}.`,i?260:650,(g)=>{ strip(g,f); plot(g,i,f+1); });
    add(7,`Average the ${K} fold errors: CV(λ) with a standard-error bar.`,i?350:800,(g)=>{ strip(g,-1); plot(g,i,K,{mean:i}); }); });
  add(8,`Lowest CV error at λ = 10^${lams[bi]} (green). The 1-SE rule picks the simplest λ within one SE: 10^${lams[one]} (orange).`,2000,(g)=>{ strip(g,-1); plot(g,lams.length,0,{pick:1}); });
  add(9,'Refit once on all the data with the chosen λ.',1200,(g)=>{ const x=g.W*.05, w=g.W*.9; g.prect(x,g.H*.08,w,g.H*.1,g.C.c5,null,{r:4,a:.8}); g.ptxt('train on everything',x+w/2,g.H*.13,'#fff',{align:'center',bold:true,size:.85}); plot(g,lams.length,0,{pick:1}); });
  return S;
});

/* ========== fair comparison ========== */
AA.def('compare', T => {
  const S=[], add=F(S); const M=[['linear',T.u(.74,.8),.97],['tree',T.u(.8,.86),1],['RBF SVM',T.u(.86,.91),.95]];
  const reps=M.map(m=>T.range(6).map(()=>m[1]+T.g()*.025)); const q=.3;
  const strip=(g,split)=>{ const x=g.W*.05,w=g.W*.9,y=g.H*.07,h=g.H*.07; g.prect(x,y,w*(1-q*split),h,g.C.c3,null,{r:4,a:.7}); if(split) g.prect(x+w*(1-q),y,w*q,h,g.C.c4,null,{r:4,a:.85*split});
    g.ptxt('train',x+8,y+h/2,'#fff',{bold:true,size:.8}); if(split>.5) g.ptxt('test (locked away)',x+w-8,y+h/2,'#fff',{bold:true,size:.8,align:'right'}); };
  const chart=(g,o)=>{ g.view(.1,.26,.86,.6,-.5,2.5,.6,1.02); g.frame(); [.7,.8,.9,1].forEach(v=>{ g.seg(-.5,v,2.5,v,g.C.line,1); g.txt(T.f(v,1),-.5,v,g.C.muted,{align:'right',size:.75,mono:true}); });
    M.forEach((m,i)=>{ g.txt(m[0],i,.58,g.C.ink,{align:'center',size:.85,semi:true}); const pr=o.bars?o.bars[i]:0;
      if(pr){ g.rect(i-.32,.6,i-.02,.6+(m[2]-.6)*pr,g.C.c3,null,{a:.6}); g.rect(i+.02,.6,i+.32,.6+(m[1]-.6)*pr,g.C.c4,null,{a:.85}); }
      if(o.rep){ const k=Math.round(o.rep*6); reps[i].slice(0,k).forEach((v,j)=>g.dot(i+.17+(j-2.5)*.03,v,3,g.C.c1)); if(o.rep>=1){ const mu=T.mean(reps[i]), sd=Math.sqrt(T.mean(reps[i].map(v=>(v-mu)**2))); g.seg(i+.17,mu-2*sd,i+.17,mu+2*sd,g.C.c1,2.5); g.dot(i+.17,mu,5,g.C.c1); } } });
    g.ptxt('■ train  ■ test accuracy',g.W*.1,g.H*.95,g.C.muted,{size:.8}); };
  add(1,'One dataset, three candidate models.',800,(g)=>{ strip(g,0); chart(g,{}); });
  add(2,`Shuffle, then lock away ${q*100}% as the test set. Every model gets the same split.`,1100,(g,p)=>{ strip(g,p); chart(g,{}); });
  const bars=[0,0,0]; M.forEach((m,i)=>{ const snap=[...bars]; add([3,4],`${m[0]}: tune its settings with cross-validation inside the training part only.`,800,(g)=>{ strip(g,1); chart(g,{bars:snap}); });
    add([5,6],`Fit ${m[0]} on all training data; record train and test accuracy.`,1000,(g,p)=>{ strip(g,1); const b=[...snap]; b[i]=p; chart(g,{bars:b}); }); bars[i]=1; });
  add(7,'One split can mislead. Repeat with 6 different random splits (purple dots) and summarise with mean ± 2 SD.',2000,(g,p)=>{ strip(g,1); chart(g,{bars:[1,1,1],rep:p}); });
  const mu=reps.map(r=>T.mean(r)); const best=mu.indexOf(Math.max(...mu));
  add(8,`Is ${M[best][0]} really best? Only if its interval clears the others; overlapping bars mean "not shown yet".`,2000,(g)=>{ strip(g,1); chart(g,{bars:[1,1,1],rep:1}); });
  return S;
});
/* ================= MATHS ANIMATIONS ================= */
const lgam=(x)=>{ const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.1208650973866179e-2,-.5395239384953e-5]; let y=x, t=x+5.5; t-=(x+.5)*Math.log(t); let s=1.000000000190015; for(const k of c) s+=k/++y; return -t+Math.log(2.5066282746310005*s/x); };
const betaPdf=(x,a,b)=>Math.exp((a-1)*Math.log(x)+(b-1)*Math.log(1-x)-(lgam(a)+lgam(b)-lgam(a+b)));
const tPdf=(t,v)=>Math.exp(lgam((v+1)/2)-lgam(v/2)-.5*Math.log(v*Math.PI)-(v+1)/2*Math.log(1+t*t/v));
const tTwoSided=(t,v)=>{ const a=Math.abs(t), N=400, B=a+40; let s=0; for(let i=0;i<=N;i++){ const x=a+(B-a)*i/N, w=(i===0||i===N)?1:(i%2?4:2); s+=w*tPdf(x,v); } return Math.min(1,2*s*(B-a)/N/3); };
const ints=(r,c,lo=-4,hi=6)=>T.range(r).map(()=>T.range(c).map(()=>lo+T.ri(hi-lo+1)));
/* matrix-step drawing: prev → cur with optional row swap and number morphing */
function matFrame(g,prev,cur,p,px,py,cw,ch,o={}){ const R=cur.length; const ord=T.range(R);
  const ypos=i=>{ if(o.swap && (i===o.swap[0]||i===o.swap[1])){ const j=i===o.swap[0]?o.swap[1]:o.swap[0]; return T.lerp(j,i,p); } return i; };
  cur.forEach((row,i)=>row.forEach((v,j)=>{ const pv=o.swap?prev[i===o.swap[0]?o.swap[1]:i===o.swap[1]?o.swap[0]:i][j]:prev[i][j]; const val=o.swap?v:T.lerp(pv,v,p); const y=py+ypos(i)*ch;
    const c=o.hl&&o.hl(i,j); g.prect(px+j*cw+1,y+1,cw-2,ch-2,c||g.C.soft,null,{r:3}); g.ptxt(T.f(val,o.dp==null?1:o.dp),px+j*cw+cw/2,y+ch/2,g.C.ink,{align:'center',mono:true,size:.82}); }));
  if(o.label) g.ptxt(o.label,px+cur[0].length*cw/2,py-g.fs*.8,g.C.muted,{align:'center',size:.85,semi:true}); }
const cellSz=(g,cols,frac=.42)=>Math.min(g.W*frac/cols,g.H*.11,52);

/* ---- dot product ---- */
AA.def('dot', T => {
  const S=[], add=F(S); const d=4, a=T.range(d).map(()=>T.ri(9)-3), b=T.range(d).map(()=>T.ri(9)-3); if(a.every(v=>!v)) a[0]=2; if(b.every(v=>!v)) b[1]=3;
  const pre=[]; let s=0,na=0,nb=0; for(let j=0;j<d;j++){ s+=a[j]*b[j]; na+=a[j]**2; nb+=b[j]**2; pre.push({s,na,nb}); }
  const NA=Math.sqrt(na), NB=Math.sqrt(nb), cs=s/(NA*NB), th=Math.acos(T.clamp(cs,-1,1));
  const draw=(g,j,o={})=>{ const cw=cellSz(g,d+1,.55), x=g.W*.06, y=g.H*.12;
    g.ptxt('a',x-14,y+cw/2,g.C.c1,{bold:true,mono:true}); g.ptxt('b',x-14,y+cw*1.25+cw/2,g.C.c3,{bold:true,mono:true}); g.ptxt('aⱼbⱼ',x-22,y+cw*2.6+cw/2,g.C.c4,{bold:true,mono:true,size:.8});
    for(let k=0;k<d;k++){ const on=k===j; g.prect(x+k*cw+2,y,cw-4,cw,on?g.C.c1:g.C.soft,null,{r:4,a:on?.3:1}); g.ptxt(String(a[k]),x+k*cw+cw/2,y+cw/2,g.C.ink,{align:'center',mono:true,bold:on});
      g.prect(x+k*cw+2,y+cw*1.25,cw-4,cw,on?g.C.c3:g.C.soft,null,{r:4,a:on?.3:1}); g.ptxt(String(b[k]),x+k*cw+cw/2,y+cw*1.75,g.C.ink,{align:'center',mono:true,bold:on});
      if(j!=null&&k<=j) g.ptxt(String(a[k]*b[k]),x+k*cw+cw/2,y+cw*3.1,g.C.c4,{align:'center',mono:true,bold:on}); }
    const st=j==null?{s:0,na:0,nb:0}:pre[j]; const rx=g.W*.62;
    g.ptxt('s  = '+st.s,rx,g.H*.16,g.C.c4,{mono:true,bold:true}); g.ptxt('na = '+st.na,rx,g.H*.26,g.C.c1,{mono:true}); g.ptxt('nb = '+st.nb,rx,g.H*.36,g.C.c3,{mono:true});
    if(o.norm){ g.ptxt('‖a‖ = '+T.f(NA),rx,g.H*.5,g.C.c1,{mono:true}); g.ptxt('‖b‖ = '+T.f(NB),rx,g.H*.59,g.C.c3,{mono:true}); }
    if(o.cos) g.ptxt('cos θ = '+T.f(cs,3),rx,g.H*.7,g.C.ink,{mono:true,bold:true});
    if(o.ang!=null){ const cx=g.W*.3, cy=g.H*.9, R=g.H*.28; g.ctx.save(); g.ctx.strokeStyle=g.C.line; g.ctx.lineWidth=2; g.ctx.beginPath(); g.ctx.arc(cx,cy,R,Math.PI,2*Math.PI); g.ctx.stroke();
      g.parrow(cx,cy,cx+R,cy,g.C.c1,3); const t=th*o.ang; g.parrow(cx,cy,cx+R*Math.cos(t),cy-R*Math.sin(t),g.C.c3,3); g.ctx.strokeStyle=g.C.c4; g.ctx.beginPath(); g.ctx.arc(cx,cy,R*.3,-t,0); g.ctx.stroke(); g.ctx.restore();
      g.ptxt('θ = '+T.f(th*180/Math.PI*o.ang,1)+'°',rx,g.H*.82,g.C.c4,{mono:true,bold:true}); } };
  add(1,`Two vectors with ${d} entries each.`,900,(g)=>draw(g,null));
  add(2,'Three running totals start at 0.',700,(g)=>draw(g,null));
  for(let j=0;j<d;j++) add([3,4,5],`j = ${j+1}: multiply the matching entries (${a[j]} × ${b[j]} = ${a[j]*b[j]}) and add to s; add the squares to na and nb.`,j?700:1100,(g)=>draw(g,j));
  add(6,'Lengths are square roots of the sums of squares.',1000,(g)=>draw(g,d-1,{norm:1}));
  add(7,'Divide the dot product by both lengths to get the cosine of the angle.',1000,(g)=>draw(g,d-1,{norm:1,cos:1}));
  add(8,`θ = arccos(${T.f(cs,3)}) = ${T.f(th*180/Math.PI,1)}°. ${cs>0.05?'Positive: they point roughly the same way.':cs<-0.05?'Negative: roughly opposite.':'Near zero: almost perpendicular.'}`,1700,(g,p)=>draw(g,d-1,{norm:1,cos:1,ang:p}));
  return S;
});

/* ---- power iteration ---- */
AA.def('power', T => {
  const S=[], add=F(S); const a=T.u(1.2,2.4), d=T.u(.3,1.1), b=T.u(-.9,.9); const [[l1,v1]]=T.eig2(a,b,d);
  const a0=T.u(0,6.28); let x=[Math.cos(a0),Math.sin(a0)]; const its=[];
  for(let k=0;k<7;k++){ const y=[a*x[0]+b*x[1],b*x[0]+d*x[1]], lam=x[0]*y[0]+x[1]*y[1], ny=Math.hypot(...y), xn=[y[0]/ny,y[1]/ny]; its.push({x,y,lam,xn}); x=xn; }
  const L=Math.max(a,d)+1;
  const plot=(g,o={})=>{ g.view(.03,.06,.6,.88,-L*1.2,L*1.2,-L*.9,L*.9); g.frame(); g.clip(true); g.axes(); g.ell(0,0,1,0,1,1,g.C.line,1.4); g.ell(0,0,a*a+b*b,a*b+b*d,b*b+d*d,1,g.C.muted,1,null,{dash:[4,4]});
    g.seg(-v1[0]*L*2,-v1[1]*L*2,v1[0]*L*2,v1[1]*L*2,g.C.c5,1.5,[6,4]);
    if(o.x) g.arrow(0,0,o.x[0],o.x[1],g.C.c1,3); if(o.y) g.arrow(0,0,o.y[0],o.y[1],g.C.c4,3); (o.trail||[]).forEach(t=>g.dot(t[0],t[1],3,g.C.c1,{a:.5})); g.clip(false); };
  const side=(g,lam,k)=>{ const cw=cellSz(g,2,.2); g.mat([[a,b],[b,d]],g.W*.68,g.H*.12,cw,cw*.8,{label:'A',dp:2,size:.8});
    if(lam!=null) g.ptxt('λ ≈ '+T.f(lam,4),g.W*.68,g.H*.48,g.C.c4,{mono:true,bold:true}); g.ptxt('true λ₁ = '+T.f(l1,4),g.W*.68,g.H*.57,g.C.c5,{mono:true,size:.85}); if(k!=null) g.ptxt('iteration '+k,g.W*.68,g.H*.66,g.C.muted,{mono:true,size:.85}); };
  add(2,'Start from a random unit vector x (purple). Green dashed: the eigenvector we hope to find.',1100,(g)=>{ plot(g,{x:its[0].x}); side(g); });
  its.forEach((it,k)=>{ const f=k>2, tr=its.slice(0,k).map(r=>r.x);
    add(4,`Iteration ${k+1}: multiply, y = Ax (orange). A stretches most along its top eigenvector, so y leans towards it.`,f?500:1100,(g,p)=>{ plot(g,{x:it.x,y:[T.lerp(it.x[0],it.y[0],p),T.lerp(it.x[1],it.y[1],p)],trail:tr}); side(g,k?its[k-1].lam:null,k+1); });
    add(5,`Rayleigh quotient xᵀy = ${T.f(it.lam,4)}: the current eigenvalue estimate.`,f?350:800,(g)=>{ plot(g,{x:it.x,y:it.y,trail:tr}); side(g,it.lam,k+1); });
    add(6,'Normalise: shrink y back to length 1. That is the new x.',f?400:900,(g,p)=>{ const nx=[T.lerp(it.y[0],it.xn[0],p),T.lerp(it.y[1],it.xn[1],p)]; plot(g,{x:nx,trail:tr}); side(g,it.lam,k+1); }); });
  add([7,8],`x has stopped turning: it lies on the eigenvector, and λ ≈ ${T.f(its[6].lam,4)}.`,1600,(g)=>{ plot(g,{x:its[6].xn,trail:its.map(r=>r.x)}); side(g,its[6].lam,7); });
  return S;
});

/* ---- LU with pivoting + solve ---- */
AA.def('lu', T => {
  const S=[], add=F(S); let A; do { A=ints(3,3,-3,5); } while(Math.abs(A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]))<3);
  const bv=T.range(3).map(()=>T.ri(9)-4); let U=A.map(r=>[...r]), L=[[1,0,0],[0,1,0],[0,0,1]], P=[0,1,2]; const st=[];
  const snap=()=>({U:U.map(r=>[...r]),L:L.map(r=>[...r]),P:[...P]});
  for(let c=0;c<2;c++){ let p=c; for(let r=c+1;r<3;r++) if(Math.abs(U[r][c])>Math.abs(U[p][c])) p=r; const before=snap();
    if(p!==c){ [U[c],U[p]]=[U[p],U[c]]; [P[c],P[p]]=[P[p],P[c]]; for(let k=0;k<c;k++) [L[c][k],L[p][k]]=[L[p][k],L[c][k]]; }
    st.push({type:'swap',c,p,before,after:snap()});
    for(let r=c+1;r<3;r++){ const b4=snap(); const m=U[r][c]/U[c][c]; L[r][c]=m; for(let k=c;k<3;k++) U[r][k]-=m*U[c][k]; st.push({type:'elim',c,r,m,before:b4,after:snap()}); } }
  const Pb=P.map(i=>bv[i]), y=[0,0,0], x=[0,0,0]; for(let i=0;i<3;i++){ y[i]=Pb[i]; for(let k=0;k<i;k++) y[i]-=L[i][k]*y[k]; } for(let i=2;i>=0;i--){ x[i]=y[i]; for(let k=i+1;k<3;k++) x[i]-=U[i][k]*x[k]; x[i]/=U[i][i]; }
  const show=(g,s,p,o={})=>{ const cw=cellSz(g,3,.3), ch=cw*.72; const st0=s.before, st1=s.after;
    matFrame(g,st0.U,st1.U,p,g.W*.04,g.H*.14,cw,ch,{label:'U',swap:s.type==='swap'&&s.p!==s.c?[s.c,s.p]:null,hl:(i,j)=>o.hlU?o.hlU(i,j):null});
    matFrame(g,st0.L,st1.L,p,g.W*.53,g.H*.14,cw,ch,{label:'L',dp:2,hl:(i,j)=>o.hlL?o.hlL(i,j):(i===j?g.C.k0s:null)}); };
  const solveV=(g,ky,kx)=>{ const cw=cellSz(g,3,.3), ch=cw*.72, yy=g.H*.66; const col=(v,k,lab,px,c)=>{ g.ptxt(lab,px+cw/2,yy-g.fs*.8,g.C.muted,{align:'center',size:.85,semi:true});
      v.forEach((val,i)=>{ const on=i<k||(k<0); g.prect(px+1,yy+i*ch+1,cw-2,ch-2,on?c:g.C.soft,null,{r:3,a:on?.35:1}); if(on) g.ptxt(T.f(val,2),px+cw/2,yy+i*ch+ch/2,g.C.ink,{align:'center',mono:true,size:.8}); }); };
    col(Pb,-1,'Pb',g.W*.1,g.C.c3); col(y,ky,'y',g.W*.4,g.C.c1); col(x,kx,'x',g.W*.7,g.C.c4); };
  const init={before:{U:A,L:[[1,0,0],[0,1,0],[0,0,1]]},after:{U:A,L:[[1,0,0],[0,1,0],[0,0,1]]}};
  add(1,'U starts as A, L as the identity.',900,(g)=>show(g,init,1));
  st.forEach(s=>{ if(s.type==='swap') add(3,s.p!==s.c?`Column ${s.c+1}: the largest entry is in row ${s.p+1}, so swap it up to be the pivot (more stable).`:`Column ${s.c+1}: the pivot is already the largest entry; no swap.`,1100,(g,p)=>show(g,s,p,{hlU:(i,j)=>j===s.c&&i>=s.c?g.C.c4s||'#fed7aa':null}));
    else add([4,5],`Row ${s.r+1} −= ${T.f(s.m,2)} × row ${s.c+1} to make a zero below the pivot; store the multiplier in L.`,1100,(g,p)=>show(g,s,p,{hlU:(i,j)=>i===s.c?g.C.k0s:i===s.r?'rgba(234,88,12,.25)':null,hlL:(i,j)=>i===s.r&&j===s.c?'rgba(234,88,12,.35)':(i===j?g.C.k0s:null)})); });
  const fin={before:st[st.length-1].after,after:st[st.length-1].after};
  add(6,'Factorisation done: PA = LU, with L lower- and U upper-triangular. Now solve for a right-hand side b.',1000,(g)=>{ show(g,fin,1); solveV(g,0,0); });
  for(let i=0;i<3;i++) add(7,`Forward substitution: y${i+1} uses only the y's already found.`,700,(g)=>{ show(g,fin,1,{hlL:(r,c)=>r===i&&c<=i?'rgba(124,58,237,.3)':null}); solveV(g,i+1,0); });
  for(let i=2;i>=0;i--) add(8,`Back substitution: x${i+1} uses only the x's below it.`,700,(g)=>{ show(g,fin,1,{hlU:(r,c)=>r===i&&c>=i?'rgba(124,58,237,.3)':null}); const xs=[0,0,0]; solveV(g,3,0); const cw=cellSz(g,3,.3), ch=cw*.72; for(let k=2;k>=i;k--){ g.prect(g.W*.7+1,g.H*.66+k*ch+1,cw-2,ch-2,g.C.c4,null,{r:3,a:.35}); g.ptxt(T.f(x[k],2),g.W*.7+cw/2,g.H*.66+k*ch+ch/2,g.C.ink,{align:'center',mono:true,size:.8}); } });
  add(9,'Return x. Reusing L and U, each new b costs only these two quick sweeps.',1300,(g)=>{ show(g,fin,1); solveV(g,3,3); });
  return S;
});

/* ---- Gram–Schmidt QR (2-D) ---- */
AA.def('qr', T => {
  const S=[], add=F(S); const t1=T.u(-.4,.6), a1=[2.4*Math.cos(t1),2.4*Math.sin(t1)], t2=t1+T.u(.5,1.2), r2=T.u(1.6,2.4), a2=[r2*Math.cos(t2),r2*Math.sin(t2)];
  const R11=Math.hypot(...a1), q1=[a1[0]/R11,a1[1]/R11], R12=q1[0]*a2[0]+q1[1]*a2[1], pr=[R12*q1[0],R12*q1[1]], u2=[a2[0]-pr[0],a2[1]-pr[1]], R22=Math.hypot(...u2), q2=[u2[0]/R22,u2[1]/R22];
  const plot=(g,o={})=>{ g.view(.03,.06,.6,.88,-1.6,3.2,-1.2,2.8); g.frame(); g.axes(); g.seg(-q1[0]*3,-q1[1]*3,q1[0]*4,q1[1]*4,g.C.line,1,[4,4]);
    g.arrow(0,0,a1[0],a1[1],g.C.c1,o.dimA?1.5:3); g.txt('a₁',a1[0]+.12,a1[1],g.C.c1,{bold:true}); g.arrow(0,0,a2[0],a2[1],g.C.c3,o.dimA?1.5:3); g.txt('a₂',a2[0]+.12,a2[1]+.1,g.C.c3,{bold:true});
    if(o.proj!=null){ const pp=o.proj; g.seg(a2[0],a2[1],T.lerp(a2[0],pr[0],pp),T.lerp(a2[1],pr[1],pp),g.C.muted,1.5,[4,3]); if(pp>.5) g.arrow(0,0,pr[0],pr[1],g.C.c4,3); }
    if(o.u) g.arrow(0,0,o.u[0],o.u[1],g.C.c2,3.5);
    if(o.q1!=null){ const s=T.lerp(R11,1,o.q1); g.arrow(0,0,q1[0]*s,q1[1]*s,g.C.c5,4); g.txt('q₁',q1[0]*s*.6-.15,q1[1]*s*.6+.18,g.C.c5,{bold:true}); }
    if(o.q2!=null){ const s=T.lerp(R22,1,o.q2); g.arrow(0,0,q2[0]*s,q2[1]*s,g.C.c5,4); g.txt('q₂',q2[0]*s+.1,q2[1]*s+.1,g.C.c5,{bold:true}); } };
  const Rg=(g,k)=>{ const cw=cellSz(g,2,.22); g.mat([[k>=1?R11:'',k>=2?R12:''],[0,k>=3?R22:'']],g.W*.68,g.H*.16,cw,cw*.75,{label:'R',dp:2,size:.8}); };
  add(1,'Two columns a₁, a₂. We want perpendicular unit vectors q₁, q₂ spanning the same plane.',1000,(g)=>{ plot(g); Rg(g,0); });
  add(3,'j = 1: u = a₁. Nothing earlier to remove.',800,(g)=>{ plot(g,{u:a1}); Rg(g,0); });
  add(6,`R₁₁ = ‖u‖ = ${T.f(R11)}; divide to get the unit vector q₁.`,1200,(g,p)=>{ plot(g,{q1:p,dimA:1}); Rg(g,1); });
  add(3,'j = 2: start with u = a₂.',800,(g)=>{ plot(g,{q1:1,u:a2}); Rg(g,1); });
  add(5,`R₁₂ = q₁·u = ${T.f(R12)}: the length of u's shadow on q₁ (orange).`,1300,(g,p)=>{ plot(g,{q1:1,u:a2,proj:p}); Rg(g,2); });
  add(5,'Subtract the shadow: what is left of u is perpendicular to q₁.',1300,(g,p)=>{ plot(g,{q1:1,proj:1,u:[T.lerp(a2[0],u2[0],p),T.lerp(a2[1],u2[1],p)]}); Rg(g,2); });
  add(6,`R₂₂ = ‖u‖ = ${T.f(R22)}; normalise to get q₂.`,1200,(g,p)=>{ plot(g,{q1:1,q2:p,dimA:1}); Rg(g,3); });
  add(7,'Return Q = [q₁ q₂] (orthonormal) and the upper-triangular R, with A = QR.',1500,(g)=>{ plot(g,{q1:1,q2:1,dimA:1}); Rg(g,3); });
  return S;
});

/* ---- Cholesky ---- */
AA.def('chol', T => {
  const S=[], add=F(S); const M=ints(3,3,-2,3), A=[0,1,2].map(i=>[0,1,2].map(j=>T.sum([0,1,2].map(k=>M[i][k]*M[j][k]))+(i===j?2:0)));
  const L=[[0,0,0],[0,0,0],[0,0,0]], order=[]; for(let i=0;i<3;i++) for(let j=0;j<=i;j++){ let s=A[i][j]; for(let k=0;k<j;k++) s-=L[i][k]*L[j][k]; L[i][j]=i===j?Math.sqrt(s):s/L[j][j]; order.push({i,j,s,v:L[i][j]}); }
  const draw=(g,k,o={})=>{ const cw=cellSz(g,3,.3), ch=cw*.75; const cur=order[k]||{};
    g.mat(A,g.W*.04,g.H*.16,cw,ch,{label:'A',dp:0,size:.82,hl:(i,j)=>k!=null&&i===cur.i&&j===cur.j?'rgba(234,88,12,.3)':null});
    const Ls=L.map((r,i)=>r.map((v,j)=>{ const idx=order.findIndex(q=>q.i===i&&q.j===j); return j>i?0:(k!=null&&idx<=k&&idx>=0?v:''); }));
    g.mat(Ls,g.W*.53,g.H*.16,cw,ch,{label:'L',dp:2,size:.82,hl:(i,j)=>{ if(k==null) return null; if(i===cur.i&&j===cur.j) return o.p>.5?'rgba(22,163,74,.35)':null; if(j<cur.j&&(i===cur.i||i===cur.j)) return 'rgba(124,58,237,.25)'; return null; }});
    if(k!=null){ g.ptxt(`s = A${cur.i+1}${cur.j+1} − Σ L${cur.i+1}k·L${cur.j+1}k = ${T.f(cur.s,2)}`,g.W*.04,g.H*.68,g.C.ink,{mono:true,size:.85});
      if(o.p>.5) g.ptxt(cur.i===cur.j?`L${cur.i+1}${cur.j+1} = √s = ${T.f(cur.v,2)}`:`L${cur.i+1}${cur.j+1} = s / L${cur.j+1}${cur.j+1} = ${T.f(cur.v,2)}`,g.W*.04,g.H*.78,g.C.c5,{mono:true,bold:true,size:.9}); } };
  add(1,'A symmetric positive-definite matrix. We want a lower-triangular L with A = LLᵀ.',1000,(g)=>draw(g,null));
  order.forEach((q,k)=>add(q.i===q.j?[4,5]:[4,6],q.i===q.j?`Diagonal (${q.i+1},${q.j+1}): subtract what earlier columns already explain, then take the square root.`:`Below the diagonal (${q.i+1},${q.j+1}): subtract the overlap of rows ${q.i+1} and ${q.j+1} (purple), then divide by L${q.j+1}${q.j+1}.`,k<3?1500:1000,(g,p,raw)=>draw(g,k,{p:raw})));
  add(7,'Return L. It costs about half of LU, and x = μ + Lz turns round noise into correlated samples.',1400,(g)=>draw(g,order.length-1,{p:1}));
  return S;
});

/* ---- Bayesian coin ---- */
AA.def('coin', T => {
  const S=[], add=F(S); const pt=T.u(.15,.85), flips=T.range(24).map(()=>T.r()<pt?1:0); let a=1,b=1; const hist=[[1,1]]; flips.forEach(f=>{ if(f) a++; else b++; hist.push([a,b]); });
  const curve=(g,A,B,k)=>{ g.view(.05,.26,.9,.62,0,1,0,1); g.frame(); const ys=T.range(121).map(i=>{ const x=Math.min(.995,Math.max(.005,i/120)); return betaPdf(x,A,B); }); const mx=Math.max(4,...ys)*1.05;
    g.view(.05,.26,.9,.62,0,1,0,mx); g.poly(ys.map((y,i)=>[i/120,y]).concat([[1,0],[0,0]]),null,0,g.C.c1,{a:.18}); g.poly(ys.map((y,i)=>[i/120,y]),g.C.c1,2.5);
    const mean=A/(A+B); g.seg(mean,0,mean,mx*.95,g.C.c4,2); g.seg(pt,0,pt,mx*.95,g.C.c5,1.5,[5,4]); g.txt('true p',pt,mx*.98,g.C.c5,{align:'center',size:.75});
    for(let t=0;t<=4;t++) g.txt(T.f(t/4,2),t/4,-mx*.06,g.C.muted,{align:'center',size:.72,mono:true}); g.txt('P(heads)',1,-mx*.13,g.C.muted,{align:'right',size:.75});
    const sd=Math.sqrt(A*B/((A+B)**2*(A+B+1))); g.ptxt(`a = ${T.f(A,0)}  b = ${T.f(B,0)}   mean = ${T.f(mean,3)}   ± ${T.f(sd,3)}`,g.W*.05,g.H*.95,g.C.ink,{mono:true,size:.82}); };
  const tokens=(g,k)=>{ const n=flips.length, w=Math.min(g.W*.9/n,26); for(let i=0;i<n;i++){ const x=g.W*.05+i*w+w/2, y=g.H*.12; if(i<k){ g.pdot(x,y,w*.42,flips[i]?g.C.c4:g.C.c3); g.ptxt(flips[i]?'H':'T',x,y,'#fff',{align:'center',bold:true,size:.7}); } else { g.ctx.strokeStyle=g.C.line; g.ctx.beginPath(); g.ctx.arc(x,y,w*.42,0,7); g.ctx.stroke(); } } };
  add(1,'Prior Beta(1, 1): flat. Every bias from 0 to 1 is equally plausible before any flips.',1200,(g)=>{ tokens(g,0); curve(g,1,1); });
  flips.forEach((f,k)=>{ const [A0,B0]=hist[k], [A1,B1]=hist[k+1], fast=k>4;
    add([2,3],`Flip ${k+1}: ${f?'heads, so a goes up by 1':'tails, so b goes up by 1'}. The posterior becomes the prior for the next flip.`,fast?380:1000,(g,p)=>{ tokens(g,k+1); curve(g,T.lerp(A0,A1,p),T.lerp(B0,B1,p)); });
    if(!fast) add([4,5],'Read off the mean (orange) and the uncertainty: the curve narrows as evidence piles up.',700,(g)=>{ tokens(g,k+1); curve(g,A1,B1); }); });
  add(6,`After ${flips.length} flips: Beta(${a}, ${b}). The width shrinks like 1/√n.`,1800,(g)=>{ tokens(g,flips.length); curve(g,a,b); });
  return S;
});
/* ---- matrix multiplication ---- */
AA.def('matmul', T => {
  const S=[], add=F(S); const A=ints(2,3,-2,4), B=ints(3,2,-2,4); const C=[[0,0],[0,0]].map((r,i)=>r.map((_,j)=>T.sum([0,1,2].map(t=>A[i][t]*B[t][j]))));
  const draw=(g,i,j,t,partial)=>{ const cw=cellSz(g,7,.85), ch=cw*.8, y=g.H*.22;
    g.mat(A,g.W*.04,y+ch*.5,cw,ch,{label:'A (2×3)',dp:0,hl:(r,c)=>r===i?(c===t?'rgba(234,88,12,.45)':'rgba(124,58,237,.2)'):null});
    g.ptxt('×',g.W*.04+cw*3.25,y+ch*1.5,g.C.muted,{align:'center',size:1.3});
    g.mat(B,g.W*.04+cw*3.6,y,cw,ch,{label:'B (3×2)',dp:0,hl:(r,c)=>c===j?(r===t?'rgba(234,88,12,.45)':'rgba(8,145,178,.22)'):null});
    g.ptxt('=',g.W*.04+cw*5.85,y+ch*1.5,g.C.muted,{align:'center',size:1.3});
    const Cs=C.map((r,a)=>r.map((v,b)=>(a<i||(a===i&&b<j))?v:(a===i&&b===j?partial:'')));
    g.mat(Cs,g.W*.04+cw*6.2,y+ch*.5,cw,ch,{label:'C',dp:0,hl:(r,c)=>r===i&&c===j?'rgba(22,163,74,.3)':null});
    if(t!=null&&t>=0) g.ptxt(`C${i+1}${j+1} += A${i+1}${t+1} × B${t+1}${j+1} = ${A[i][t]} × ${B[t][j]}`,g.W*.04,g.H*.8,g.C.ink,{mono:true,size:.9}); };
  add(1,'A is 2×3 and B is 3×2: the inner sizes (3) match, so C will be 2×2.',1000,(g)=>draw(g,-1,-1,null,''));
  for(let i=0;i<2;i++) for(let j=0;j<2;j++){ let acc=0; const first=i===0&&j===0;
    add([2,3,4],`Entry (${i+1}, ${j+1}): pair row ${i+1} of A with column ${j+1} of B. Start the sum at 0.`,first?900:500,(g)=>draw(g,i,j,null,0));
    for(let t=0;t<3;t++){ const before=acc; acc+=A[i][t]*B[t][j]; const now=acc; add(5,`Multiply the matching pair and add: running total ${now}.`,first?800:380,(g)=>draw(g,i,j,t,now)); } }
  add(6,'Done: every entry of C is a dot product of a row of A with a column of B (2·2·3 = 12 multiplications).',1500,(g)=>draw(g,2,0,null,''));
  return S;
});

/* ---- row reduction ---- */
AA.def('rref', T => {
  const S=[], add=F(S); let A=ints(3,4,-3,4); const dep=T.r()<.5; if(dep) A[2]=A[0].map((v,j)=>v+A[1][j]);
  const M=A.map(r=>[...r]); const st=[]; let r=0; const piv=[];
  for(let c=0;c<4&&r<3;c++){ let p=r; for(let i=r+1;i<3;i++) if(Math.abs(M[i][c])>Math.abs(M[p][c])) p=i;
    if(Math.abs(M[p][c])<1e-9){ st.push({k:'skip',c,r,b:M.map(x=>[...x]),a:M.map(x=>[...x])}); continue; }
    let b=M.map(x=>[...x]); [M[r],M[p]]=[M[p],M[r]]; st.push({k:'swap',c,r,p,b,a:M.map(x=>[...x])});
    b=M.map(x=>[...x]); const d=M[r][c]; M[r]=M[r].map(v=>v/d); st.push({k:'scale',c,r,d,b,a:M.map(x=>[...x])});
    for(let i=0;i<3;i++) if(i!==r && Math.abs(M[i][c])>1e-12){ b=M.map(x=>[...x]); const f=M[i][c]; M[i]=M[i].map((v,j)=>v-f*M[r][j]); st.push({k:'elim',c,r,i,f,b,a:M.map(x=>[...x])}); }
    piv.push([r,c]); r++; }
  const draw=(g,s,p,hl)=>{ const cw=cellSz(g,4,.7), ch=cw*.62; matFrame(g,s.b,s.a,p,g.W*.08,g.H*.16,cw,ch,{dp:2,swap:s.k==='swap'&&s.p!==s.r?[s.r,s.p]:null,hl,label:'A'});
    const done=piv.filter((q,k)=>st.indexOf(s)>=0&&k<(s.rank||0)); g.ptxt('pivots so far: '+(s.npiv||0),g.W*.08,g.H*.86,g.C.c1,{mono:true,bold:true}); };
  let np=0; st.forEach(s=>{ if(s.k==='scale') np++; s.npiv=s.k==='swap'?np:np; });
  add(1,`A 3×4 matrix${dep?' (secretly, row 3 = row 1 + row 2)':''}. Row operations will reveal how many independent rows it has.`,1100,(g)=>draw(g,{b:A,a:A,npiv:0},1));
  st.forEach(s=>{ const pc=(i,j)=>j===s.c&&i===s.r?'rgba(124,58,237,.35)':null;
    if(s.k==='skip') add(5,`Column ${s.c+1}: nothing usable below row ${s.r+1} (all ≈ 0). No pivot here; move on.`,1100,(g,p)=>draw(g,s,p,(i,j)=>j===s.c&&i>=s.r?'rgba(225,29,72,.2)':null));
    if(s.k==='swap') add([3,4,6],s.p!==s.r?`Column ${s.c+1}: the largest entry is in row ${s.p+1}; swap it into row ${s.r+1}.`:`Column ${s.c+1}: row ${s.r+1} already holds the largest entry.`,900,(g,p)=>draw(g,s,p,(i,j)=>j===s.c&&i>=s.r?'rgba(234,88,12,.25)':null));
    if(s.k==='scale') add(6,`Divide row ${s.r+1} by ${T.f(s.d,2)} so the pivot becomes 1.`,800,(g,p)=>draw(g,s,p,pc));
    if(s.k==='elim') add(7,`Row ${s.i+1} −= ${T.f(s.f,2)} × row ${s.r+1}: clear the rest of column ${s.c+1}.`,800,(g,p)=>draw(g,s,p,(i,j)=>i===s.i?'rgba(8,145,178,.22)':pc(i,j))); });
  const last=st[st.length-1]||{a:A}; const fin={b:last.a,a:last.a,npiv:np};
  add(9,`Reduced row echelon form. ${np} pivots, so rank = ${np}${np<3?': one row was a combination of the others.':'.'}`,1800,(g)=>draw(g,fin,1,(i,j)=>piv.some(q=>q[0]===i&&q[1]===j)?'rgba(124,58,237,.35)':(i>=np?'rgba(225,29,72,.15)':null)));
  return S;
});

/* ---- 2x2 solve ---- */
AA.def('solve2', T => {
  const S=[], add=F(S); const sing=T.r()<.3; const a1=[T.u(.8,2.2),T.u(-.6,.8)]; const k=T.u(-.8,-.3); let a2=sing?[a1[0]*k*1.6,a1[1]*k*1.6]:[T.u(-1.2,.4),T.u(1,2)];
  const D=a1[0]*a2[1]-a2[0]*a1[1]; const on=sing&&T.r()<.5; const bb=sing?(on?[a1[0]*1.3,a1[1]*1.3]:[T.u(-.5,1.5),T.u(1.2,2.2)]):[T.u(-1,2.2),T.u(.5,2.6)];
  const x1=sing?0:(a2[1]*bb[0]-a2[0]*bb[1])/D, x2=sing?0:(-a1[1]*bb[0]+a1[0]*bb[1])/D;
  const plot=(g,o={})=>{ g.view(.03,.06,.6,.88,-2.6,3.4,-1.5,3); g.frame(); g.axes();
    if(o.par){ const s=o.par; g.poly([[0,0],[a1[0]*s,a1[1]*s],[a1[0]*s+a2[0]*s,a1[1]*s+a2[1]*s],[a2[0]*s,a2[1]*s]],g.C.c1,1,g.C.c1,{a:.18}); }
    if(sing) g.seg(-a1[0]*3,-a1[1]*3,a1[0]*3,a1[1]*3,g.C.line,1,[4,4]);
    g.arrow(0,0,a1[0],a1[1],g.C.c1,3); g.txt('col 1',a1[0]+.1,a1[1]-.15,g.C.c1,{size:.8,bold:true}); g.arrow(0,0,a2[0],a2[1],g.C.c3,3); g.txt('col 2',a2[0]-.1,a2[1]+.18,g.C.c3,{size:.8,bold:true,align:'right'});
    g.dot(bb[0],bb[1],6,g.C.c4,{ring:g.C.ink}); g.txt('b',bb[0]+.15,bb[1]+.15,g.C.c4,{bold:true});
    if(o.path!=null){ const p=o.path, m1=[a1[0]*x1*Math.min(1,p*2),a1[1]*x1*Math.min(1,p*2)]; g.arrow(0,0,m1[0],m1[1],g.C.c5,3.5); if(p>.5){ const q=(p-.5)*2; g.arrow(m1[0],m1[1],m1[0]+a2[0]*x2*q,m1[1]+a2[1]*x2*q,g.C.c5,3.5); } } };
  const side=(g,lines)=>lines.forEach((t,i)=>g.ptxt(t[0],g.W*.67,g.H*(.18+i*.1),t[1]||g.C.ink,{mono:true,size:.85,bold:t[2]}));
  add(1,`D = ad − bc is the signed area of the parallelogram the two columns span: D = ${T.f(D,2)}.`,1400,(g,p)=>{ plot(g,{par:p}); side(g,[['D = '+T.f(D*p,2),g.C.c1,1]]); });
  if(sing){ add(2,'|D| ≈ 0: the columns lie on one line, so the parallelogram is flat and A cannot be inverted.',1300,(g)=>{ plot(g,{par:1}); side(g,[['D ≈ 0',g.C.c2,1]]); });
    add(3,on?'b lies on that line: infinitely many combinations reach it.':'b is off that line: no combination of the columns can reach it. No solution.',1700,(g)=>{ plot(g,{par:1}); side(g,[['D ≈ 0',g.C.c2,1],[on?'infinitely many':'no solution',g.C.c2,1]]); }); }
  else { add(2,'|D| is clearly non-zero, so there is exactly one answer.',800,(g)=>{ plot(g,{par:1}); side(g,[['D = '+T.f(D,2),g.C.c1,1]]); });
    add(4,`x₁ = ${T.f(x1,2)}, x₂ = ${T.f(x2,2)}: walk x₁ × column 1, then x₂ × column 2, and you land exactly on b.`,2000,(g,p)=>{ plot(g,{par:.35,path:p}); side(g,[['D = '+T.f(D,2),g.C.c1],['x₁ = '+T.f(x1,2),g.C.c5,1],['x₂ = '+T.f(x2,2),g.C.c5,1]]); });
    add(5,'Return x = A⁻¹b.',1100,(g)=>{ plot(g,{par:.35,path:1}); side(g,[['D = '+T.f(D,2),g.C.c1],['x₁ = '+T.f(x1,2),g.C.c5,1],['x₂ = '+T.f(x2,2),g.C.c5,1]]); }); }
  return S;
});

/* ---- least squares two ways ---- */
AA.def('lsq2', T => {
  const S=[], add=F(S); const n=8, xs=T.range(n).map(i=>i+T.u(-.3,.3)), b0=T.u(.5,2), b1=T.u(.3,.8), ys=xs.map(x=>b0+b1*x+T.g()*.7);
  const sx=T.sum(xs), sxx=T.sum(xs.map(x=>x*x)), G=[[n,sx],[sx,sxx]], gv=[T.sum(ys),T.sum(xs.map((x,i)=>x*ys[i]))], th=T.solve(G,gv);
  const c1=xs.map(()=>1/Math.sqrt(n)), R12=T.sum(xs)/Math.sqrt(n), u=xs.map(x=>x-R12/Math.sqrt(n)), R22=Math.hypot(...u), c2=u.map(v=>v/R22), R=[[Math.sqrt(n),R12],[0,R22]];
  const Qty=[T.sum(c1.map((q,i)=>q*ys[i])),T.sum(c2.map((q,i)=>q*ys[i]))]; const e=xs.map((x,i)=>ys[i]-th[0]-th[1]*x), Xe=[T.sum(e),T.sum(e.map((v,i)=>v*xs[i]))];
  const plot=(g,o={})=>{ g.view(.03,.06,.55,.88,-.5,7.8,-1,Math.max(...ys)+1.5); g.frame(); if(o.A!=null) g.seg(-.5,th[0]-.5*th[1],-.5+8.3*o.A,th[0]+th[1]*(-.5+8.3*o.A),g.C.c1,3);
    if(o.B!=null) g.seg(-.5,th[0]-.5*th[1],-.5+8.3*o.B,th[0]+th[1]*(-.5+8.3*o.B),g.C.c3,2.5,[7,5]); if(o.e) xs.forEach((x,i)=>g.seg(x,ys[i],x,th[0]+th[1]*x,g.C.c2,2));
    xs.forEach((x,i)=>g.dot(x,ys[i],4.2,g.C.ink,{a:.8})); };
  const cw=g=>Math.min(g.W*.085,46);
  add(1,`${n} points; X has a column of ones and a column of x.`,900,(g)=>plot(g));
  add([2,3],'Route A: squeeze the problem into 2×2: G = XᵀX and g = Xᵀy.',1200,(g,p)=>{ plot(g); g.alpha(p); g.mat(G,g.W*.62,g.H*.14,cw(g)*1.2,cw(g)*.7,{label:'G',dp:1,size:.78}); g.mat(gv.map(v=>[v]),g.W*.62+cw(g)*2.7,g.H*.14,cw(g)*1.2,cw(g)*.7,{label:'g',dp:1,size:.78}); g.alpha(1); });
  add(4,'Solve Gθ = g: the purple line.',1100,(g,p)=>{ plot(g,{A:p}); g.mat(G,g.W*.62,g.H*.14,cw(g)*1.2,cw(g)*.7,{label:'G',dp:1,size:.78}); g.mat([[th[0]],[th[1]]],g.W*.62+cw(g)*2.7,g.H*.14,cw(g)*1.2,cw(g)*.7,{label:'θ',dp:2,size:.78}); });
  add([5,6],'Route B: QR. Q has orthonormal columns, R is upper-triangular; solve Rθ = Qᵀy from the bottom up.',1600,(g,p)=>{ plot(g,{A:1,B:p}); g.mat(R,g.W*.62,g.H*.42,cw(g)*1.2,cw(g)*.7,{label:'R',dp:2,size:.78,hl:(i,j)=>i>j?g.C.bg:null}); g.mat(Qty.map(v=>[v]),g.W*.62+cw(g)*2.7,g.H*.42,cw(g)*1.2,cw(g)*.7,{label:'Qᵀy',dp:2,size:.78}); });
  add(7,`Both routes give the same line. Residuals (red) are orthogonal to the columns: Xᵀe = (${T.f(Xe[0],3)}, ${T.f(Xe[1],3)}).`,1800,(g)=>{ plot(g,{A:1,B:1,e:1}); g.ptxt('Xᵀe ≈ 0 ✓',g.W*.62,g.H*.72,g.C.c5,{bold:true,mono:true}); });
  add(8,'Return θ, ŷ and e. Libraries take route B because it never squares the condition number.',1300,(g)=>plot(g,{A:1,B:1,e:1}));
  return S;
});

/* ---- maximum likelihood by gradient ascent ---- */
AA.def('mle', T => {
  const S=[], add=F(S); const mu=T.u(-1,1.5), sg=T.u(.6,1.2), n=50, x=T.range(n).map(()=>mu+sg*T.g()); const ll=(m,s)=>T.mean(x.map(v=>-.5*Math.log(2*Math.PI)-Math.log(s)-(v-m)**2/(2*s*s)));
  let m=T.u(-3,-2), ls=Math.log(2.6); const its=[[m,Math.exp(ls),ll(m,Math.exp(ls))]];
  for(let t=0;t<14;t++){ const s=Math.exp(ls), gm=T.mean(x.map(v=>(v-m)/(s*s))), gs=T.mean(x.map(v=>(v-m)**2/(s*s)-1)); m+=.55*s*s*gm; ls+=.3*gs; its.push([m,Math.exp(ls),ll(m,Math.exp(ls))]); }
  const hist=(g,k,p)=>{ const a=its[Math.max(0,k-1)], b=its[k]; const M=T.lerp(a[0],b[0],p), Sd=T.lerp(a[1],b[1],p); g.view(.03,.08,.56,.84,-4.5,4.5,0,.75); g.frame();
    const bins=T.range(18).map(i=>-4.5+i*.5); bins.forEach(b0=>{ const c=x.filter(v=>v>=b0&&v<b0+.5).length/n/.5; g.rect(b0+.03,0,b0+.47,c,g.C.c3,null,{a:.45}); });
    g.fn(v=>Math.exp(-((v-M)**2)/(2*Sd*Sd))/(Sd*Math.sqrt(2*Math.PI)),-4.5,4.5,g.C.c1,3); g.seg(M,0,M,.72,g.C.c1,1.2,[4,3]);
    g.ptxt(`μ = ${T.f(M)}  σ = ${T.f(Sd)}`,g.vp().x+6,g.vp().y+g.fs,g.C.c1,{mono:true,size:.82}); };
  const llc=(g,k)=>{ const v=its.map(r=>r[2]); const lo=Math.min(...v), hi=Math.max(...v); g.view(.65,.16,.32,.62,0,its.length-1,lo-(hi-lo)*.05,hi+(hi-lo)*.08); g.frame(); g.poly(v.slice(0,k+1).map((y,i)=>[i,y]),g.C.c4,2.2); g.dot(k,v[k],4.5,g.C.c4);
    g.ptxt('average log-likelihood ℓ',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.8}); };
  add(2,`${n} data points (bars) and a deliberately bad first guess for a Normal model (purple).`,1100,(g)=>{ hist(g,0,1); llc(g,0); });
  for(let t=1;t<its.length;t++) add([4,5],`Step ${t}: the gradient of ℓ says "move μ towards the data, ${its[t][1]>its[t-1][1]?'widen':'narrow'} σ". Take a step uphill.`,t<4?1000:420,(g,p)=>{ hist(g,t,p); llc(g,p>.5?t:t-1); });
  add(6,'ℓ has stopped rising: we are at the top of the likelihood hill.',1100,(g)=>{ hist(g,its.length-1,1); llc(g,its.length-1); });
  add(7,`Return θ̂: μ̂ = ${T.f(m)} (sample mean ${T.f(T.mean(x))}), σ̂ = ${T.f(Math.exp(ls))}. Standard error of μ̂ ≈ σ̂/√n = ${T.f(Math.exp(ls)/Math.sqrt(n),3)}.`,1800,(g)=>{ hist(g,its.length-1,1); llc(g,its.length-1); });
  return S;
});

/* ---- bootstrap CI ---- */
AA.def('boot', T => {
  const S=[], add=F(S); const n=15, x=T.range(n).map(()=>-Math.log(T.r())*T.u(1.5,2.5)).map(v=>Math.min(v,9.5)); const mean=T.mean(x);
  const res=T.range(800).map(()=>{ const idx=T.range(n).map(()=>T.ri(n)); return {idx,m:T.mean(idx.map(i=>x[i]))}; }); const ms=res.map(r=>r.m).sort((a,b)=>a-b); const lo=ms[Math.floor(.025*ms.length)], hi=ms[Math.floor(.975*ms.length)];
  const top=(g,r)=>{ g.view(.05,.08,.9,.2,0,10,0,1); g.seg(0,.2,10,.2,g.C.line,1); x.forEach((v,i)=>{ const c=r?r.idx.filter(j=>j===i).length:0; g.dot(v,.45,5,g.C.c3,{a:r&&!c?.25:1}); if(c>1) g.txt('×'+c,v,.95,g.C.c4,{align:'center',size:.75,bold:true}); });
    g.seg(mean,0,mean,.9,g.C.ink,2); g.ptxt('original sample (n = '+n+'), line = its mean',g.W*.05,g.H*.05,g.C.muted,{size:.8}); };
  const hist=(g,k,o={})=>{ g.view(.05,.42,.9,.46,0,10,0,1); g.frame(); const bins=T.range(50).map(i=>i*.2); const cnt=bins.map(b=>0); for(let i=0;i<k;i++){ const j=Math.min(49,Math.floor(res[i].m/.2)); cnt[j]++; }
    const mx=Math.max(4,...cnt); bins.forEach((b,i)=>{ if(cnt[i]) g.rect(b+.02,0,b+.18,cnt[i]/mx*.92,g.C.c1,null,{a:.75}); });
    if(o.cur!=null) g.dot(res[o.cur].m,.05,6,g.C.c4,{ring:g.C.ink}); if(o.ci){ g.seg(lo,0,lo,1,g.C.c4,2.5); g.seg(hi,0,hi,1,g.C.c4,2.5); g.rect(lo,0,hi,1,g.C.c4,null,{a:.1}); }
    g.ptxt(`means of ${k} resamples`,g.W*.05,g.H*.39,g.C.muted,{size:.8}); for(let t=0;t<=10;t+=2) g.txt(String(t),t,-.06,g.C.muted,{align:'center',size:.72,mono:true}); };
  add(1,'One sample of 15 values (skewed). How uncertain is its mean? We have no formula we trust.',1200,(g)=>{ top(g); hist(g,0); });
  for(let b=0;b<5;b++) add([3,4],`Resample ${b+1}: draw 15 values from the sample with replacement (faded = not drawn, ×k = drawn k times), then take the mean.`,b<2?1300:700,(g)=>{ top(g,res[b]); hist(g,b+1,{cur:b}); });
  add(2,'Repeat B times. The spread of these means is how much the mean would wobble with a fresh sample.',2200,(g,p)=>{ const k=5+Math.round(p*795); top(g,res[k-1]); hist(g,k); });
  add(5,`Read off the 2.5th and 97.5th percentiles: a 95% interval ≈ [${T.f(lo)}, ${T.f(hi)}].`,1900,(g)=>{ top(g); hist(g,800,{ci:1}); });
  return S;
});

/* ---- hypothesis test (paired t) ---- */
AA.def('htest', T => {
  const S=[], add=F(S); const n=12, eff=T.r()<.6?T.u(.25,.6):T.u(-.05,.1), d=T.range(n).map(()=>eff+T.g()*.55); const db=T.mean(d), sd=Math.sqrt(T.sum(d.map(v=>(v-db)**2))/(n-1)), se=sd/Math.sqrt(n), t=db/se, p=tTwoSided(t,n-1);
  const line=(g,o={})=>{ g.view(.05,.1,.9,.26,-1.6,1.6,0,1); g.seg(-1.6,.3,1.6,.3,g.C.line,1); g.seg(0,0,0,1,g.C.ink,1.5,[4,3]); g.txt('0 = "no difference"',0,1.05,g.C.muted,{align:'center',size:.75});
    d.forEach((v,i)=>g.dot(v,.3+((i%3)-1)*.18,4.5,g.C.c3)); if(o.mean){ g.seg(db,0,db,.9,g.C.c4,3); g.rect(db-se,.08,db+se,.52,g.C.c4,null,{a:.15}); g.txt('mean d̄ ± SE',db,-.1,g.C.c4,{align:'center',size:.75}); }
    g.ptxt('accuracy difference per run (B − A)',g.W*.05,g.H*.05,g.C.muted,{size:.8}); };
  const dist=(g,o={})=>{ const L=Math.max(4.5,Math.abs(t)+1); g.view(.05,.5,.9,.4,-L,L,0,.45); g.frame(); g.fn(v=>tPdf(v,n-1),-L,L,g.C.ink,2);
    if(o.tail){ const a=Math.abs(t); const pts=[[a,0]]; for(let i=0;i<=40;i++){ const v=a+(L-a)*i/40; pts.push([v,tPdf(v,n-1)]); } pts.push([L,0]); g.poly(pts,null,0,g.C.c2,{a:.45*o.tail}); g.poly(pts.map(q=>[-q[0],q[1]]),null,0,g.C.c2,{a:.45*o.tail}); }
    if(o.t!=null){ g.seg(t*o.t,0,t*o.t,.42,g.C.c4,3); g.txt('t = '+T.f(t*o.t),t*o.t,.43,g.C.c4,{align:t>0?'right':'left',bold:true,size:.85}); } g.ptxt(`Student-t with ${n-1} degrees of freedom (what t looks like if H₀ is true)`,g.W*.05,g.H*.47,g.C.muted,{size:.75}); };
  add(1,'H₀: the true average difference is 0. The dashed line is what H₀ claims.',1100,(g)=>{ line(g); });
  add(2,'Fix α = 0.05 now, before looking at the result.',800,(g)=>{ line(g); g.ptxt('α = 0.05',g.W*.05,g.H*.6,g.C.c1,{mono:true,bold:true}); });
  add(3,`Signal ÷ noise: t = d̄ / (s/√n) = ${T.f(db,3)} / ${T.f(se,3)} = ${T.f(t)}.`,1400,(g,pp)=>{ line(g,{mean:1}); });
  add(4,'If H₀ were true, t would follow this curve.',1200,(g,pp)=>{ line(g,{mean:1}); dist(g); });
  add(5,`p-value = the red area: chance of a t at least this extreme under H₀ = ${T.f(p,4)}.`,1700,(g,pp)=>{ line(g,{mean:1}); dist(g,{t:1,tail:pp}); });
  add(6,p<=.05?`p ≤ 0.05: reject H₀. The improvement is unlikely to be luck.`:`p > 0.05: not enough evidence. (Not proof that there is no difference.)`,1900,(g)=>{ line(g,{mean:1}); dist(g,{t:1,tail:1}); g.ptxt(p<=.05?'reject H₀':'keep H₀ (for now)',g.W*.62,g.H*.6,p<=.05?g.C.c5:g.C.c2,{bold:true,size:1.1}); });
  return S;
});

/* ---- permutation test ---- */
AA.def('perm', T => {
  const S=[], add=F(S); const n=10, gap=T.r()<.6?T.u(.04,.1):T.u(-.01,.02); const a=T.range(n).map(()=>T.u(.55,.85)), b=a.map(v=>T.clamp(v+gap+T.g()*.06,0,1));
  const Tobs=T.mean(b.map((v,i)=>v-a[i])); const R=400; const perms=T.range(R).map(()=>{ const sw=T.range(n).map(()=>T.r()<.5); return {sw,t:T.mean(b.map((v,i)=>(sw[i]?-1:1)*(v-a[i])))}; });
  const pv=(1+perms.filter(r=>Math.abs(r.t)>=Math.abs(Tobs)-1e-12).length)/(R+1); const L=Math.max(.12,Math.abs(Tobs)*1.6);
  const cols=(g,sw,p)=>{ g.view(.05,.1,.9,.34,-.5,n-.5,.4,1); for(let i=0;i<n;i++){ const s=sw&&sw[i]?p:0; const ya=T.lerp(a[i],b[i],s), yb=T.lerp(b[i],a[i],s); g.seg(i,ya,i,yb,g.C.line,2);
      g.dot(i-.12,ya,5,g.C.c3); g.dot(i+.12,yb,5,g.C.c1); } g.ptxt('per-example score:  ● model A   ● model B',g.W*.05,g.H*.05,g.C.muted,{size:.8}); };
  const hist=(g,k,o={})=>{ g.view(.05,.55,.9,.36,-L,L,0,1); g.frame(); const nb=30, cnt=Array(nb).fill(0); for(let i=0;i<k;i++){ const j=Math.floor((perms[i].t+L)/(2*L)*nb); if(j>=0&&j<nb) cnt[j]++; } const mx=Math.max(3,...cnt);
    cnt.forEach((c,j)=>{ const x0=-L+j*2*L/nb; const ext=Math.abs(x0+L/nb)>=Math.abs(Tobs); if(c) g.rect(x0+.002,0,x0+2*L/nb-.002,c/mx*.9,ext&&o.ext?g.C.c2:g.C.c1,null,{a:.7}); });
    g.seg(Tobs,0,Tobs,1,g.C.c4,3); g.seg(-Tobs,0,-Tobs,1,g.C.c4,1.5,[4,3]); g.txt('T_obs',Tobs,1.05,g.C.c4,{align:'center',bold:true,size:.8}); if(o.cur!=null) g.dot(perms[o.cur].t,.04,6,g.C.c1,{ring:g.C.ink});
    g.ptxt(`${k} shuffles`,g.W*.05,g.H*.52,g.C.muted,{size:.8}); };
  add(2,`Observed average gain of B over A: T_obs = ${T.f(Tobs,3)}. Could that just be luck?`,1300,(g)=>{ cols(g); hist(g,0); });
  for(let r=0;r<4;r++) add([4,5],`Shuffle ${r+1}: if A and B were really the same, swapping their labels on any example changes nothing. Swap each with probability ½ and recompute.`,1300,(g,p)=>{ cols(g,perms[r].sw,p); hist(g,p>.9?r+1:r,{cur:p>.9?r:null}); });
  add(3,`Repeat ${R} times to see how big a "gain" pure chance produces.`,2200,(g,p)=>{ const k=4+Math.round(p*(R-4)); cols(g,perms[k-1].sw,1); hist(g,k); });
  add(6,`p-value = share of shuffles at least as extreme as T_obs (red) = ${T.f(pv,3)}.`,1700,(g)=>{ cols(g); hist(g,R,{ext:1}); });
  add(7,pv<=.05?'Small p: the gain is unlikely to be chance.':'Large p: chance alone produces gains this big. No evidence B is better.',1500,(g)=>{ cols(g); hist(g,R,{ext:1}); });
  return S;
});

/* ---- SVD via eigenvectors of AᵀA ---- */
AA.def('svdeig', T => {
  const S=[], add=F(S); const A=[[T.u(.8,1.8),T.u(-.8,.8)],[T.u(-.6,.6),T.u(.3,1.2)]]; const G=[A[0][0]**2+A[1][0]**2,A[0][0]*A[0][1]+A[1][0]*A[1][1],A[0][1]**2+A[1][1]**2];
  const [[l1,v1],[l2,v2]]=T.eig2(...G); const s1=Math.sqrt(Math.max(l1,0)), s2=Math.sqrt(Math.max(l2,0)); const mv=v=>[A[0][0]*v[0]+A[0][1]*v[1],A[1][0]*v[0]+A[1][1]*v[1]]; const Av1=mv(v1), Av2=mv(v2), u1=Av1.map(v=>v/s1), u2=Av2.map(v=>v/s2);
  const circ=(g,o={})=>{ g.view(.02,.08,.47,.66,-2.2,2.2,-1.6,1.6); g.frame(); g.axes(); g.ell(0,0,1,0,1,1,g.C.muted,1.6); if(o.v){ g.arrow(0,0,v1[0]*o.v,v1[1]*o.v,g.C.c1,3); g.arrow(0,0,v2[0]*o.v,v2[1]*o.v,g.C.c3,3); g.txt('v₁',v1[0]*1.15,v1[1]*1.15,g.C.c1,{bold:true,align:'center'}); g.txt('v₂',v2[0]*1.18,v2[1]*1.18,g.C.c3,{bold:true,align:'center'}); }
    g.ptxt('unit circle (inputs)',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.8}); };
  const img=(g,o={})=>{ g.view(.51,.08,.47,.66,-2.6,2.6,-1.9,1.9); g.frame(); g.axes(); const E=[A[0][0]**2+A[0][1]**2,A[0][0]*A[1][0]+A[0][1]*A[1][1],A[1][0]**2+A[1][1]**2]; g.ell(0,0,...E,1,g.C.muted,1.6);
    if(o.av!=null){ g.arrow(0,0,Av1[0]*o.av,Av1[1]*o.av,g.C.c1,3); g.arrow(0,0,Av2[0]*o.av,Av2[1]*o.av,g.C.c3,3); } if(o.u){ g.arrow(0,0,u1[0],u1[1],g.C.c5,2.5); g.arrow(0,0,u2[0],u2[1],g.C.c5,2.5); g.txt('u₁',u1[0]*1.2,u1[1]*1.2,g.C.c5,{bold:true,align:'center'}); g.txt('u₂',u2[0]*1.25,u2[1]*1.25,g.C.c5,{bold:true,align:'center'}); }
    g.ptxt('A × circle = ellipse (outputs)',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.8}); };
  const bot=(g,items)=>{ const cw=Math.min(g.W*.07,40), y=g.H*.8; let x=g.W*.04; items.forEach(([lab,M,dp])=>{ g.mat(M,x,y,cw,cw*.55,{label:lab,dp:dp||2,size:.72}); x+=cw*(M[0].length)+cw*.6; }); };
  add(1,'A maps the unit circle to an ellipse. The SVD finds the axes of both.',1100,(g)=>{ circ(g); img(g); bot(g,[['A',A]]); });
  add(2,'Form G = AᵀA: a symmetric matrix that measures how much A stretches each input direction.',1100,(g)=>{ circ(g); img(g); bot(g,[['A',A],['G = AᵀA',[[G[0],G[1]],[G[1],G[2]]]]]); });
  add(3,'Its eigenvectors v₁, v₂ are the input directions that come out perpendicular: the most and least stretched.',1400,(g,p)=>{ circ(g,{v:p}); img(g); bot(g,[['A',A],['G',[[G[0],G[1]],[G[1],G[2]]]],['λ',[[l1],[l2]]]]); });
  add([4,5],`Singular values are the square roots of the eigenvalues: σ₁ = ${T.f(s1)}, σ₂ = ${T.f(s2)}. They are the ellipse's semi-axes.`,1300,(g)=>{ circ(g,{v:1}); img(g); bot(g,[['A',A],['λ',[[l1],[l2]]],['σ',[[s1],[s2]]]]); });
  add(6,'Push each vᵢ through A: Avᵢ lands exactly on an axis of the ellipse, with length σᵢ.',1500,(g,p)=>{ circ(g,{v:1}); img(g,{av:p}); bot(g,[['σ',[[s1],[s2]]]]); });
  add(6,'Divide by σᵢ to get the unit output directions uᵢ (green).',1200,(g)=>{ circ(g,{v:1}); img(g,{av:1,u:1}); bot(g,[['σ',[[s1],[s2]]]]); });
  add(7,'Return U, Σ, V with A = UΣVᵀ: rotate (Vᵀ), stretch (Σ), rotate (U).',1700,(g)=>{ circ(g,{v:1}); img(g,{av:1,u:1}); bot(g,[['U',[[u1[0],u2[0]],[u1[1],u2[1]]]],['Σ',[[s1,0],[0,s2]]],['Vᵀ',[v1,v2]]]); });
  return S;
});
/* ---------- MLE and Bayesian estimation ---------- */
const poisS=l=>{ let k=0,p=Math.exp(-l),s=p; const u=Math.random(); while(u>s&&k<60){ k++; p*=l/k; s+=p; } return k; };
const poisP=(k,l)=>Math.exp(k*Math.log(l)-l-lgam(k+1));
AA.def('mlerecipe', T => {
  const S=[], add=F(S), lt=T.u(1.5,5), n=30, x=T.range(n).map(()=>poisS(lt)), sx=T.sum(x), lh=sx/n, kmax=Math.max(10,...x)+1;
  const ll=l=>sx*Math.log(l)-n*l, L0=.4, L1=Math.max(9,lh*2), top=ll(lh), lo=ll(L1)-(top-ll(L1))*.1;
  const hist=(g,fit)=>{ g.view(.04,.14,.42,.66,-.5,kmax+.5,0,.42); g.frame(); for(let k=0;k<=kmax;k++){ const c=x.filter(v=>v===k).length/n; if(c) g.rect(k-.38,0,k+.38,c,g.C.c3,null,{a:.55}); if(fit) g.dot(k,poisP(k,lh),4,g.C.c1); }
    g.ptxt(`${n} counts, e.g. emails per hour`,g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.72}); for(let k=0;k<=kmax;k+=Math.ceil(kmax/6)) g.txt(String(k),k,-.03,g.C.muted,{align:'center',size:.65,mono:true}); };
  const llv=(g,o)=>{ g.view(.54,.14,.42,.66,L0,L1,lo,top+(top-lo)*.12); g.frame(); g.ptxt('ℓ(λ) = Σxᵢ log λ − nλ',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.72,mono:true});
    const e=o.draw==null?L1:L0+(L1-L0)*o.draw; g.fn(ll,L0,e,g.C.c2,2.6);
    if(o.tan!=null){ const l=o.tan, s=sx/l-n, w=Math.min((L1-L0)*.18,(top-lo)*.22/Math.max(1e-9,Math.abs(s))); g.seg(l-w,ll(l)-s*w,l+w,ll(l)+s*w,g.C.c4,2); g.dot(l,ll(l),5,g.C.c4); g.ptxt(`slope ℓ′(λ) = ${T.f(s,1)}`,g.vp().x+g.vp().w,g.vp().y+g.vp().h+g.fs*1.1,g.C.c4,{align:'right',size:.72,mono:true}); }
    if(o.curv){ const c2=-sx/(lh*lh); g.fn(l=>top+.5*c2*(l-lh)**2,Math.max(L0,lh-(L1-L0)*.25),Math.min(L1,lh+(L1-L0)*.25),g.C.c1,1.8,{dash:[5,4]}); g.ptxt(`ℓ″(λ̂) = −Σx/λ̂² = ${T.f(c2,1)} < 0`,g.vp().x+g.vp().w,g.vp().y+g.vp().h+g.fs*1.1,g.C.c1,{align:'right',size:.72,mono:true}); }
    if(o.peak){ g.seg(lh,lo,lh,top,g.C.c1,1.5,[4,3]); g.dot(lh,top,5.5,g.C.c1); } };
  add(1,`Data: ${n} counts. Model: Poisson with unknown rate λ.`,1300,g=>{ hist(g); llv(g,{draw:0}); });
  add(2,'Add up log P(xᵢ; λ) over the data: the log-likelihood, as a function of λ.',1500,(g,p)=>{ hist(g); llv(g,{draw:p}); });
  [.25,.45,.7].forEach((f,i)=>add(3,'Look for the point where the slope is zero.',i?650:1000,(g,p)=>{ hist(g); const l=T.lerp(L0+(L1-L0)*f,L0+(L1-L0)*(f+.2),p); llv(g,{tan:Math.min(L1,l)}); }));
  add(3,`Σx/λ − n = 0 gives λ̂ = x̄ = ${T.f(lh,2)}: the slope is flat there.`,1400,(g,p)=>{ hist(g); llv(g,{tan:lh,peak:true}); });
  add(4,'Second derivative negative: the curve bends down, so this is a maximum.',1400,g=>{ hist(g); llv(g,{peak:true,curv:true}); });
  add(5,`Return λ̂ = ${T.f(lh,2)} (true ${T.f(lt,2)}), SE = √(λ̂/n) = ${T.f(Math.sqrt(lh/n),3)}. Purple dots: the fitted Poisson.`,2200,g=>{ hist(g,true); llv(g,{peak:true}); });
  return S;
});
AA.title(/the maximum-likelihood recipe/i,'mlerecipe');

AA.def('mlenewton', T => {
  const S=[], add=F(S), wt=T.u(1,2.2), X=T.range(40).map(()=>T.u(-3,3)), Y=X.map(x=>T.r()<T.sig(wt*x)?1:0);
  const ll=w=>T.sum(X.map((x,i)=>{ const p=T.sig(w*x); return Y[i]?Math.log(p+1e-300):Math.log(1-p+1e-300); })), d1=w=>T.sum(X.map((x,i)=>(Y[i]-T.sig(w*x))*x)), d2=w=>-T.sum(X.map(x=>{ const p=T.sig(w*x); return p*(1-p)*x*x; }));
  const W0=-2.5, W1=5; let top=-1e9; for(let i=0;i<=100;i++) top=Math.max(top,ll(W0+(W1-W0)*i/100)); const lo=ll(W0)-2;
  const its=[T.u(-.4,.3)]; for(let t=0;t<5;t++){ const w=its[its.length-1]; its.push(Math.max(W0,Math.min(W1,w-d1(w)/d2(w)))); }
  const draw=(g,w,o={})=>{ g.view(.05,.12,.9,.68,W0,W1,lo,top+(top-lo)*.1); g.frame(); g.fn(ll,W0,W1,g.C.c1,2.6); g.ptxt('ℓ(w) for a one-weight logistic model',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.72});
    if(o.tan){ const s=d1(w), h=Math.min((W1-W0)*.15,(top-lo)*.25/Math.max(1e-9,Math.abs(s))); g.seg(w-h,ll(w)-s*h,w+h,ll(w)+s*h,g.C.c4,2); }
    if(o.par){ const a=ll(w), b=d1(w), c=d2(w); g.fn(v=>{ const y=a+b*(v-w)+.5*c*(v-w)**2; return y<lo?NaN:y; },W0,W1,g.C.c4,1.8,{dash:[5,4]}); }
    if(o.trail) o.trail.forEach(v=>g.dot(v,ll(v),3,g.C.muted)); g.dot(w,ll(w),6,g.C.c2);
    g.ptxt(`w = ${T.f(w,4)}   ℓ′(w) = ${T.f(d1(w),4)}   ℓ″(w) = ${T.f(d2(w),2)}`,g.W*.05,g.H*.92,g.C.ink,{mono:true,size:.74}); };
  add(1,'Start from a poor guess for w.',1100,g=>draw(g,its[0]));
  for(let t=0;t<4;t++){ const a=its[t], b=its[t+1], tr=its.slice(0,t), sl=t<2;
    add(3,`Iteration ${t+1}: the slope g = ℓ′(w) says which way is uphill.`,sl?900:450,g=>draw(g,a,{tan:true,trail:tr}));
    add(4,'The curvature H = ℓ″(w) fixes the parabola that touches ℓ here.',sl?1000:450,g=>draw(g,a,{par:true,trail:tr}));
    add(5,`Jump to the top of the parabola: w − g/H = ${T.f(b,4)}.`,sl?1100:550,(g,p)=>draw(g,T.lerp(a,b,p),{par:p<.5,trail:tr.concat([a])})); }
  add(6,`The slope is now ${T.f(d1(its[4]),6)}: essentially zero. Stop.`,1200,g=>draw(g,its[4],{trail:its.slice(0,4)}));
  add(7,`Return ŵ = ${T.f(its[4],3)} (true ${T.f(wt,2)}), standard error 1/√(−H) = ${T.f(1/Math.sqrt(-d2(its[4])),3)}.`,2200,g=>draw(g,its[4],{trail:its.slice(0,4)}));
  return S;
});
AA.title(/maximum likelihood by Newton/i,'mlenewton');

AA.def('bayesmean', T => {
  const S=[], add=F(S), sig=2, m0=T.u(-3,-1), s0=T.u(.8,1.4), mt=T.u(1,3), xs=T.range(8).map(()=>mt+sig*T.g());
  const st=[[m0,s0]]; xs.forEach(x=>{ const [m,s]=st[st.length-1], tau=1/(s*s)+1/(sig*sig); st.push([(m/(s*s)+x/(sig*sig))/tau,1/Math.sqrt(tau)]); });
  const N=(x,m,s)=>Math.exp(-((x-m)**2)/(2*s*s))/(s*Math.sqrt(2*Math.PI));
  const draw=(g,m,s,k,o={})=>{ g.view(.05,.12,.9,.62,-7,7,0,.75); g.frame(); g.fn(x=>N(x,m0,s0),-7,7,g.C.muted,1.6,{dash:[6,4]}); if(o.ci){ g.poly(T.range(81).map(i=>{ const x=m-1.96*s+3.92*s*i/80; return [x,Math.min(.75,N(x,m,s))]; }).concat([[m+1.96*s,0],[m-1.96*s,0]]),null,0,g.C.c1,{a:.25}); }
    g.fn(x=>Math.min(.75,N(x,m,s)),-7,7,g.C.c1,2.8); g.seg(mt,0,mt,.72,g.C.ink,1.2,[3,4]); g.txt('true μ',mt,.73,g.C.ink,{align:'center',size:.65});
    xs.slice(0,k).forEach((x,i)=>g.dot(Math.max(-7,Math.min(7,x)),.03,i===k-1&&o.hl?6:4,g.C.c4));
    const tau=1/(s*s); g.ptxt(`mean ${T.f(m,2)}   spread ${T.f(s,2)}   precision ${T.f(tau,2)}`,g.W*.05,g.H*.86,g.C.ink,{mono:true,size:.76});
    for(let i=0;i<=4;i++) g.txt(String(-6+3*i),-6+3*i,-.04,g.C.muted,{align:'center',size:.65,mono:true}); };
  add(1,`Prior: μ is probably near ${T.f(m0,1)} (dashed). Noise σ = ${sig}.`,1300,g=>draw(g,m0,s0,0));
  xs.forEach((x,i)=>{ const [ma,sa]=st[i], [mb,sb]=st[i+1], sl=i<3;
    add(2,`Measurement ${i+1}: x = ${T.f(x,2)}.`,sl?800:300,g=>draw(g,ma,sa,i+1,{hl:true}));
    add(3,`Precision rises from ${T.f(1/(sa*sa),2)} to ${T.f(1/(sb*sb),2)}.`,sl?800:250,g=>draw(g,ma,sa,i+1,{hl:true}));
    add([4,5],`The mean moves towards x by its share of the precision, ${T.f((1/(sig*sig))/(1/(sb*sb))*100,0)}%; the curve narrows.`,sl?1100:450,(g,p)=>draw(g,T.lerp(ma,mb,p),T.lerp(sa,sb,p),i+1)); });
  const [mf,sf]=st[st.length-1];
  add(6,`Return N(${T.f(mf,2)}, ${T.f(sf,2)}²); 95% credible interval ${T.f(mf-1.96*sf,2)} to ${T.f(mf+1.96*sf,2)}.`,2200,g=>draw(g,mf,sf,xs.length,{ci:true}));
  return S;
});
AA.title(/Bayesian estimate of a mean/i,'bayesmean');

AA.def('blr', T => {
  const S=[], add=F(S), n=6+T.ri(3), d=4, alpha=.5, beta=1/(.2*.2), f=x=>Math.sin(2*Math.PI*x), X=T.range(n).map(()=>T.u(.05,.6)), Y=X.map(x=>f(x)+.2*T.g());
  const phi=x=>{ const z=2*x-1; return [1,z,z*z,z*z*z]; }, F_=X.map(phi);
  const A=T.range(d).map(i=>T.range(d).map(j=>beta*T.sum(F_.map(r=>r[i]*r[j]))+(i===j?alpha:0))), b=T.range(d).map(i=>beta*T.sum(F_.map((r,k)=>r[i]*Y[k])));
  const sol=(M,v)=>{ const m=M.map((r,i)=>[...r,v[i]]); for(let c=0;c<d;c++){ let p=c; for(let r=c+1;r<d;r++) if(Math.abs(m[r][c])>Math.abs(m[p][c])) p=r; [m[c],m[p]]=[m[p],m[c]]; for(let r=0;r<d;r++){ if(r===c) continue; const q=m[r][c]/m[c][c]; for(let k=c;k<=d;k++) m[r][k]-=q*m[c][k]; } } return m.map((r,i)=>r[d]/r[i]); };
  const mN=sol(A,b), Sc=T.range(d).map(j=>sol(A,T.range(d).map(i=>i===j?1:0))), mean=x=>T.sum(phi(x).map((v,i)=>v*mN[i])), wv=x=>{ const p=phi(x); let s=0; for(let i=0;i<d;i++) for(let j=0;j<d;j++) s+=p[i]*Sc[j][i]*p[j]; return s; }, vr=x=>1/beta+wv(x);
  const draw=(g,o={})=>{ g.view(.05,.1,.9,.7,0,1,-2.2,2.2); g.frame(); g.seg(.6,-2.2,.6,2.2,g.C.line,1,[3,4]); g.txt('no data beyond here',.62,2,g.C.muted,{size:.65});
    if(o.band){ const e=o.band===true?1:o.band, V=o.wonly?wv:vr; g.poly(T.range(101).map(i=>{ const x=i/100*e; return [x,Math.min(2.2,mean(x)+1.96*Math.sqrt(V(x)))]; }).concat(T.range(101).map(i=>{ const x=(100-i)/100*e; return [x,Math.max(-2.2,mean(x)-1.96*Math.sqrt(V(x)))]; })),null,0,g.C.c1,{a:.2}); }
    if(o.mean) g.fn(x=>Math.max(-2.2,Math.min(2.2,mean(x))),0,1,g.C.c1,2.8); X.forEach((x,i)=>g.dot(x,Y[i],4.5,g.C.c4));
    if(o.xs!=null){ const x=o.xs, m=mean(x), h=1.96*Math.sqrt(vr(x)); g.seg(x,Math.max(-2.2,m-h),x,Math.min(2.2,m+h),g.C.c2,3); g.dot(x,m,5,g.C.c2); g.ptxt(`x* = ${T.f(x,2)}: ${T.f(m,2)} ± ${T.f(h,2)}`,g.W*.05,g.H*.9,g.C.c2,{mono:true,size:.76}); } };
  add(1,`${n} noisy points, all on the left; cubic features; prior w ~ N(0, I/α).`,1300,g=>draw(g));
  add(2,'S_N: how unsure we still are about the weights (band from weight uncertainty only).',1500,(g,p)=>draw(g,{band:Math.max(.02,p),wonly:true}));
  add(3,'m_N: the posterior mean, which is the ridge solution with λ = α/β.',1300,g=>draw(g,{band:true,wonly:true,mean:true}));
  [.2,.45,.75,.95].forEach((x,i)=>add([4,5],'For a new input, predict the mean and add noise variance to weight uncertainty.',i?750:1100,(g,p)=>draw(g,{mean:true,xs:i?T.lerp([.2,.45,.75,.95][i-1],x,p):x})));
  add(6,'Return predictions with error bars: narrow near the data, wide where there is none.',2200,g=>draw(g,{band:true,mean:true}));
  return S;
});
AA.title(/Bayesian linear regression/i,'blr');

AA.def('metro', T => {
  const S=[], add=F(S), m1=T.u(.25,.4), m2=T.u(.6,.75), tgt=x=>x<=0||x>=1?0:.6*Math.exp(-((x-m1)**2)/(2*.06*.06))+.4*Math.exp(-((x-m2)**2)/(2*.05*.05)), s=.12;
  let th=m1+.04; const rec=[], ev=[]; for(let t=0;t<260;t++){ const pr=th+s*T.g(), r=tgt(pr)/tgt(th), u=T.r(), ok=u<r; ev.push({th,pr,r,ok}); if(ok) th=pr; rec.push(th); }
  const nb=25;
  const draw=(g,k,o={})=>{ g.view(.05,.1,.9,.6,0,1,0,1.15); g.frame(); g.fn(tgt,0,1,g.C.c4,2.4);
    const cnt=new Array(nb).fill(0); rec.slice(0,k).forEach(v=>cnt[Math.min(nb-1,Math.max(0,Math.floor(v*nb)))]++); const mx=Math.max(1,...cnt); if(k) cnt.forEach((c,i)=>{ if(c) g.rect(i/nb+.004,0,(i+1)/nb-.004,c/mx*.95,g.C.c1,null,{a:.4}); });
    const e=o.e; if(e){ g.seg(e.th,0,e.th,tgt(e.th),g.C.c2,2); g.dot(e.th,tgt(e.th),5.5,g.C.c2);
      if(o.prop){ g.seg(e.pr,0,e.pr,Math.max(0,tgt(e.pr)),o.dec?(e.ok?g.C.c5:g.C.c4):g.C.muted,2,[4,3]); g.dot(Math.max(0,Math.min(1,e.pr)),Math.max(0,tgt(e.pr)),5,o.dec?(e.ok?g.C.c5:g.C.c4):g.C.muted); }
      if(o.ratio) g.ptxt(`r = p̃(θ′)/p̃(θ) = ${T.f(Math.min(e.r,99),2)}`,g.W*.05,g.H*.82,g.C.ink,{mono:true,size:.78});
      if(o.dec) g.ptxt(e.ok?'accept: move':'reject: stay',g.W*.95,g.H*.82,e.ok?g.C.c5:g.C.c4,{align:'right',bold:true,size:.8}); }
    g.ptxt(`${k} samples recorded`,g.W*.05,g.H*.92,g.C.muted,{size:.72}); };
  add(1,'The orange curve is the unnormalised posterior. Start the walker anywhere.',1200,g=>draw(g,0,{e:ev[0]}));
  for(let t=0;t<5;t++){ const e=ev[t];
    add(3,`Step ${t+1}: propose θ′ = θ + s·N(0,1).`,800,g=>draw(g,t,{e,prop:true}));
    add(4,'Compare heights: the unknown constant cancels in the ratio.',800,g=>draw(g,t,{e,prop:true,ratio:true}));
    add(5,e.r>=1?'Higher: always accept.':`Lower: accept with probability ${T.f(e.r,2)}.`,900,g=>draw(g,t,{e,prop:true,ratio:true,dec:true}));
    add(6,'Record the current value (the old one again if rejected).',600,g=>draw(g,t+1,{e:ev[t+1]})); }
  for(let k=5;k<=260;k+=15) add([2,3,4,5,6],'Keep walking: the histogram builds up the shape of the posterior.',160,g=>draw(g,k,{e:ev[Math.min(259,k)]}));
  add(7,'Return the samples (after burn-in): their histogram matches the posterior, with no normalising constant needed.',2200,g=>draw(g,260));
  return S;
});
AA.title(/Metropolis.Hastings sampling/i,'metro');
/* ---------- evaluation, datasets and compression ---------- */
const smT=(z,t=1)=>{ const m=Math.max(...z.map(v=>v/t)), e=z.map(v=>Math.exp(v/t-m)), s=e.reduce((a,b)=>a+b,0); return e.map(v=>v/s); };

/* precision–recall curve and average precision */
AA.def('prcurve', T => {
  const S=[], add=F(S), n=12, P=5;
  const ex=T.shuffle(T.range(n).map(i=>{ const c=i<P?1:0; return {c,s:T.clamp(c?T.u(.35,.97):T.u(.05,.8),.02,.98)}; }));
  const ord=T.range(n).sort((a,b)=>ex[b].s-ex[a].s), pos=ord.map(i=>ex[i]);
  const pts=[[0,1]], apAt=[0]; let tp=0,fp=0,ap=0;
  pos.forEach(e=>{ if(e.c){ tp++; ap+=(1/P)*tp/(tp+fp); } else fp++; pts.push([tp/P,tp/(tp+fp)]); apAt.push(ap); });
  const strip=(g,sorted,k)=>{ g.view(.04,.16,.5,.5,-.5,n-.5,0,1); g.frame();
    g.ptxt(sorted?'sorted by score, highest first →':'test examples (dot height = score)',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.75});
    ex.forEach((e,i)=>{ const x=T.lerp(i,ord.indexOf(i),sorted); const done=k!=null&&ord.indexOf(i)<k; g.dot(x,e.s,6,kc(g,e.c),{ring:done?g.C.ink:null,lw:2.5}); });
    if(k!=null&&k>0){ const tx=k-.5; g.seg(tx,0,tx,1,g.C.c1,2); g.txt('threshold',tx+.15,.04,g.C.c1,{size:.68}); } };
  const pr=(g,k,fill)=>{ g.view(.64,.1,.32,.72,0,1,0,1.05); g.frame(); const q=pts.slice(1,k+1);
    if(fill){ let x=0; pos.forEach((e,i)=>{ if(e.c){ const p=pts[i+1]; g.rect(x,0,p[0],p[1],g.C.c1,null,{a:.18*fill}); x=p[0]; } }); }
    if(q.length) g.poly(q,g.C.c2,2.2); q.forEach((p,i)=>g.dot(p[0],p[1],pos[i].c?5:3.5,pos[i].c?g.C.c1:g.C.muted));
    g.txt('recall',.98,-.07,g.C.muted,{align:'right',size:.72}); g.txt('precision',.02,1.1,g.C.muted,{size:.72});
    g.ptxt(`TP = ${k?pos.slice(0,k).filter(e=>e.c).length:0}   FP = ${k?pos.slice(0,k).filter(e=>!e.c).length:0}   AP = ${T.f(apAt[k]||0,3)}`,g.W*.04,g.H*.85,g.C.ink,{mono:true,size:.85}); };
  add(1,`${n} test examples with scores. Red = positive (${P} of them), blue = negative.`,1200,g=>{ strip(g,0); pr(g,0); });
  add(2,'Sort by score, highest first.',1100,(g,p)=>{ strip(g,T.ease(p)); pr(g,0); });
  add(3,'Start with nothing predicted positive: TP = FP = AP = 0.',800,g=>{ strip(g,1,0); pr(g,0); });
  for(let k=1;k<=n;k++){ const e=pos[k-1];
    add([4,5,6],e.c?`A positive: precision here is ${T.f(pts[k][1],2)}, so AP grows by ${T.f(pts[k][1]/P,3)}.`:'A negative: FP goes up and precision drops; AP is unchanged.',e.c?850:600,g=>{ strip(g,1,k); pr(g,k); }); }
  add(7,`AP = ${T.f(ap,3)}: the shaded staircase, precision averaged at each positive.`,2000,(g,p)=>{ strip(g,1,n); pr(g,n,T.ease(p)); });
  return S;
});

/* nDCG@k */
AA.def('ndcg', T => {
  const S=[], add=F(S), n=6, K=5, rel=T.shuffle([3,2,2,1,0,0]); if(rel[0]===3) [rel[0],rel[2]]=[rel[2],rel[0]];
  const ideal=[...rel].sort((a,b)=>b-a), gain=r=>2**r-1, disc=i=>1/Math.log2(i+2);
  const dcg=a=>a.slice(0,K).reduce((s,r,i)=>s+gain(r)*disc(i),0), D=dcg(rel), I=dcg(ideal);
  const idx=T.range(n).map(i=>i), target=[]; { const used=new Set(); ideal.forEach((r,j)=>{ const i=rel.findIndex((v,t)=>v===r&&!used.has(t)); used.add(i); target[i]=j; }); }
  const panel=(g,mv,upto,which)=>{ g.view(.05,.14,.6,.6,-.5,n-.5,0,9); g.frame();
    g.ptxt('rank position →   bar = gain 2^rel − 1, dark part = after the log discount',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.7});
    for(let k=0;k<n;k++) g.txt(String(k+1),k,-.55,g.C.muted,{align:'center',size:.72,mono:true});
    g.seg(K-.5,0,K-.5,9,g.C.line,1.5,[4,4]); g.txt('k = '+K,K-.5,8.6,g.C.muted,{align:'center',size:.7});
    rel.forEach((r,i)=>{ const x=T.lerp(i,target[i],mv), pos=Math.round(x); const col=[g.C.muted,g.C.c3,g.C.c2,g.C.c1][r];
      g.rect(x-.35,0,x+.35,gain(r),col,null,{a:.3}); if(upto!=null&&pos<upto&&pos<K) g.rect(x-.35,0,x+.35,gain(r)*disc(pos),col);
      g.txt('rel '+r,x,gain(r)+.45,g.C.ink,{align:'center',size:.7,mono:true}); }); };
  const sums=(g,a,b,c)=>{ const x=g.W*.7, y=g.H*.25, L=g.fs*1.6;
    g.ptxt('DCG@'+K+' = '+(a==null?'…':T.f(a,2)),x,y,g.C.c2,{mono:true});
    g.ptxt('IDCG@'+K+' = '+(b==null?'…':T.f(b,2)),x,y+L,g.C.c4,{mono:true});
    g.ptxt('nDCG = '+(c==null?'…':T.f(c,3)),x,y+2*L,g.C.c1,{mono:true,bold:true});
    g.ptxt('discount 1/log₂(i+1): 1, .63, .5, .43, .39',x,y+3.6*L,g.C.muted,{size:.68}); };
  add(1,'The system returned 6 items; graders marked each 0 (useless) to 3 (perfect).',1300,g=>{ panel(g,0); sums(g); });
  for(let k=1;k<=K;k++) add(2,`Position ${k}: add gain × 1/log₂(${k+1}). Lower positions count for less.`,650,g=>{ panel(g,0,k); sums(g,dcg(rel.slice(0,k).concat(Array(n).fill(0)))); });
  add(3,'Sort the same grades best-first: the ideal ranking.',1400,(g,p)=>{ panel(g,T.ease(p)); sums(g,D); });
  add(4,'Score the ideal ranking the same way.',1100,g=>{ panel(g,1,K); sums(g,D,I); });
  add(5,`nDCG = DCG / IDCG = ${T.f(D/I,3)}. 1 would mean nothing could be reordered for the better.`,2000,g=>{ panel(g,1,K); sums(g,D,I,D/I); });
  return S;
});

/* BLEU score */
AA.def('bleu', T => {
  const S=[], add=F(S);
  const pairs=[['the cat sat on a mat','the cat sat on the mat'],['a cat was sitting on the mat','the cat sat on the mat'],['the cat sat on the red mat','the cat sat on the mat']];
  const [cs,rs]=pairs[T.ri(pairs.length)], c=cs.split(' '), r=rs.split(' ');
  const grams=(a,n)=>T.range(Math.max(0,a.length-n+1)).map(i=>a.slice(i,i+n).join(' '));
  const match=n=>{ const rc={}; grams(r,n).forEach(x=>rc[x]=(rc[x]||0)+1); const used={}; return grams(c,n).map(x=>{ used[x]=(used[x]||0)+1; return used[x]<=(rc[x]||0); }); };
  const pn=[1,2,3,4].map(n=>{ const m=match(n); return m.length?m.filter(Boolean).length/m.length:0; });
  const BP=c.length>r.length?1:Math.exp(1-r.length/c.length), sm=pn.map(v=>Math.max(v,.01)), bleu=BP*Math.exp(T.mean(sm.map(Math.log)));
  const words=(g,a,y,lab,hl)=>{ const w=g.W*.86/Math.max(c.length,r.length); g.ptxt(lab,g.W*.04,y-g.fs*1.4,g.C.muted,{size:.75});
    a.forEach((t,i)=>{ const on=hl&&hl(i); g.prect(g.W*.04+i*w+2,y-g.fs,w-4,g.fs*2,on?g.C.c2:g.C.soft,null,{r:4,a:on?.85:1}); g.ptxt(t,g.W*.04+i*w+w/2,y,on?'#fff':g.C.ink,{align:'center',size:.85,mono:true}); }); };
  const cov=(n,k)=>{ const m=match(n); return i=>m.some((ok,s)=>ok&&(k==null||s<=k)&&i>=s&&i<s+n); };
  const bars=(g,upto,anim=1)=>{ g.view(.06,.62,.5,.3,.5,4.5,0,1); g.frame(); for(let n=1;n<=4;n++){ g.txt(n+'-gram',n,-.12,g.C.muted,{align:'center',size:.68});
      if(n<=upto){ const v=pn[n-1]*(n===upto?anim:1); g.rect(n-.3,0,n+.3,v,g.C.c2); g.txt(T.f(pn[n-1],2),n,v+.1,g.C.ink,{align:'center',size:.7,mono:true}); } } };
  const res=(g,o={})=>{ const x=g.W*.64,y=g.H*.7,L=g.fs*1.6; g.ptxt(`|c| = ${c.length}, |r| = ${r.length}`,x,y,g.C.muted,{mono:true,size:.8});
    if(o.bp) g.ptxt(`BP = ${T.f(BP,3)}`,x,y+L,g.C.c4,{mono:true}); if(o.b) g.ptxt(`BLEU = ${T.f(bleu,3)}`,x,y+2*L,g.C.c1,{mono:true,bold:true}); };
  const base=(g,hl)=>{ words(g,c,g.H*.16,'candidate c',hl); words(g,r,g.H*.4,'reference r'); };
  add(1,`Candidate “${cs}” against reference “${rs}”.`,1300,g=>{ base(g); bars(g,0); res(g); });
  for(let n=1;n<=4;n++){ const m=match(n);
    add(2,`n = ${n}: slide a window of ${n} word${n>1?'s':''} over the candidate.`,700,g=>{ base(g); bars(g,n-1); res(g); });
    add(3,`${m.filter(Boolean).length} of ${m.length} ${n}-grams also appear in the reference (each counted at most as often as there): p${n} = ${T.f(pn[n-1],2)}.`,1300,(g,p)=>{ base(g,cov(n,Math.floor(p*m.length))); bars(g,n,T.ease(p)); res(g); }); }
  add(4,BP<1?'The candidate is shorter than the reference, so a brevity penalty applies.':'The candidate is not shorter than the reference, so BP = 1.',1200,g=>{ base(g); bars(g,4); res(g,{bp:1}); });
  add(5,`BLEU = BP × geometric mean of p1..p4 = ${T.f(bleu,3)}${pn.some(v=>!v)?' (a zero p is floored at 0.01 here; real BLEU would give 0)':''}.`,2200,g=>{ base(g); bars(g,4); res(g,{bp:1,b:1}); });
  return S;
});

/* stratified train/validation/test split */
AA.def('strat', T => {
  const S=[], add=F(S), N0=16, N1=4, ST=[.7,2.8], G=T.range(N0+N1).map(i=>({c:i<N0?0:1}));
  const rnd=T.shuffle(T.range(G.length)); G.forEach((q,i)=>{ const s=rnd[i]; q.a=[(s%7)*1.6+.7,4.3-Math.floor(s/7)*1.1]; });
  const per=[0,1].map(c=>G.filter(q=>q.c===c)); per.forEach((L,c)=>{ const sh=T.shuffle(T.range(L.length)); L.forEach((q,j)=>q.s=[sh[j]*ST[c]+.6,c?1.2:2.6]); });
  const cut=n=>{ const a=Math.round(n*.5), b=Math.round(n*.75); return k=>k<a?0:k<b?1:2; };
  const boxes=[[.2,5.7],[6,8.8],[9.1,11.5]], cnt=[[0,0],[0,0],[0,0]];
  per.forEach((L,c)=>{ const f=cut(L.length); [...L].sort((p,q)=>p.s[0]-q.s[0]).forEach((q,k)=>{ q.sp=f(k); cnt[q.sp][c]++; const [x0,x1]=boxes[q.sp], pr=Math.max(1,Math.floor((x1-x0-.2)/.7));
    const idx=cnt[q.sp][0]+cnt[q.sp][1]-1; q.d=[x0+.45+(idx%pr)*.7,2.6-Math.floor(idx/pr)*.75]; }); });
  const draw=(g,key,from,p,o={})=>{ g.view(.03,.08,.94,.8,0,11.6,0,5);
    G.forEach(q=>{ const A=q[from]||q[key], B=q[key], x=T.lerp(A[0],B[0],p), y=T.lerp(A[1],B[1],p), col=kc(g,q.c);
      g.seg(x-.14,y,x+.14,y,col,3); g.dot(x-.14,y,4,col); g.dot(x+.14,y,4,col); });
    if(o.rows){ g.txt('class 0',.2,3.2,g.C.muted,{size:.75}); g.txt('class 1',.2,1.8,g.C.muted,{size:.75}); }
    if(o.cuts) [[N0,2.6],[N1,1.2]].forEach(([n,y],c)=>[.5,.75].forEach(f=>{ const x=.6+(Math.round(n*f)-.5)*ST[c]; g.seg(x,y-.45,x,y+.45,g.C.c1,2.2); }));
    if(o.boxes) ['train','validation','test'].forEach((t,i)=>{ const [a,b]=boxes[i]; g.rect(a,.9,b,3.1,null,g.C.line,{r:8}); const n0=cnt[i][0],n1=cnt[i][1];
      g.txt(t,(a+b)/2,3.45,g.C.ink,{align:'center',size:.8,semi:true}); g.txt(`${n0+n1} groups, ${Math.round(100*n1/(n0+n1))}% red`,(a+b)/2,.45,g.C.muted,{align:'center',size:.7,mono:true}); }); };
  add(1,`${N0+N1} groups of two examples (say two scans per patient), 20% of them class 1. Split 50 / 25 / 25.`,1400,g=>draw(g,'a',null,1));
  add(2,'Each pair stays together, so one patient never lands on both sides.',1000,g=>draw(g,'a',null,1));
  add([3,4],'Split by class, and shuffle each class with the seed.',1500,(g,p)=>draw(g,'s','a',T.ease(p),{rows:1}));
  add(5,'Cut each class at 50% and 75%.',1200,g=>draw(g,'s',null,1,{rows:1,cuts:1}));
  add(6,'Combine the pieces: every split now has the same 20% class 1.',1700,(g,p)=>draw(g,'d','s',T.ease(p),{boxes:1}));
  add(7,'Return the sets, and do not look at test until the very end.',1600,g=>draw(g,'d',null,1,{boxes:1}));
  return S;
});

/* checking for train–test overlap */
AA.def('leak', T => {
  const S=[], add=F(S), hx=()=>T.ri(4096).toString(16).padStart(3,'0');
  const train=T.range(3).map(()=>T.range(6).map(hx)), H=[], pool=train.flat();
  const test=T.range(4).map(i=>T.range(6).map(j=>(i===1&&j<5)||(i===3&&j%2===0)?pool[T.ri(pool.length)]:hx()));
  const ov=test.map(d=>d.filter(h=>pool.includes(h)).length/d.length), thr=.4;
  const docs=(g,list,x,y,lab,hit,upto)=>{ const bw=g.W*.052, bh=g.fs*1.7; g.ptxt(lab,x,y-bh*.9,g.C.muted,{size:.72});
    list.forEach((d,i)=>{ if(upto!=null&&i>=upto) return; d.forEach((h,j)=>{ const on=hit&&hit(i,j); g.prect(x+j*bw,y+i*bh*1.2,bw-3,bh,on?g.C.c1:g.C.soft,null,{r:3,a:on?.85:1}); g.ptxt(h,x+j*bw+bw/2-1.5,y+i*bh*1.2+bh/2,on?'#fff':g.C.ink,{align:'center',size:.62,mono:true}); }); }); };
  const hset=(g,k)=>{ const x=g.W*.36,y=g.H*.12; g.ptxt(`hash set H (${k} entries)`,x,y,g.C.muted,{size:.72}); for(let i=0;i<k;i++){ g.ptxt(pool[i],x+(i%6)*g.W*.045,y+g.fs*1.4+Math.floor(i/6)*g.fs*1.3,g.C.c3,{size:.62,mono:true}); } };
  const ovl=(g,upto)=>{ test.forEach((d,i)=>{ if(i>=upto) return; const y=g.H*.58+i*g.fs*2.04+g.fs*.85, x=g.W*.6, w=g.W*.2; g.prect(x,y-g.fs*.45,w,g.fs*.9,g.C.soft,null,{r:3}); g.prect(x,y-g.fs*.45,w*ov[i],g.fs*.9,ov[i]>thr?g.C.c1:g.C.c3,null,{r:3});
      g.ptxt(`${Math.round(ov[i]*100)}%${ov[i]>thr?'  flagged':''}`,x+w+6,y,ov[i]>thr?g.C.c1:g.C.muted,{size:.7,mono:true}); }); const x=g.W*.6+g.W*.2*thr; if(upto) g.pseg(x,g.H*.55,x,g.H*.58+test.length*g.fs*2.04,g.C.ink,1.5,[3,3]); };
  const base=(g,k,hit,up,ovu)=>{ docs(g,train,g.W*.03,g.H*.14,'training docs: hashes of 13-word n-grams'); hset(g,k); docs(g,test,g.W*.03,g.H*.6,'test docs',hit,up); ovl(g,ovu||0); };
  add(1,'Three training documents and four test documents, each cut into n-grams.',1300,g=>base(g,0,null,0));
  for(let i=1;i<=3;i++) add(2,`Training doc ${i}: put the hash of each n-gram into the set H.`,700,(g,p)=>base(g,Math.round(T.lerp((i-1)*6,i*6,p)),null,0));
  test.forEach((d,i)=>add([3,4,5],`Test doc ${i+1}: ${Math.round(ov[i]*100)}% of its n-grams are in H${ov[i]>thr?' → flagged as contaminated':''}.`,1000,g=>base(g,18,(a,j)=>a<=i&&pool.includes(test[a][j]),i+1,i+1)));
  const clean=T.u(.66,.74), dirty=T.u(.9,.97);
  add(6,'Report accuracy on clean and flagged test docs separately. A large gap means the model memorised.',2200,(g,p)=>{ base(g,18,(a,j)=>pool.includes(test[a][j]),4,4);
    g.view(.36,.4,.24,.12,0,1,0,1); g.prect(g.vp().x,g.vp().y,g.vp().w*clean*p,g.fs*.9,g.C.c3,null,{r:3}); g.prect(g.vp().x,g.vp().y+g.fs*1.4,g.vp().w*dirty*p,g.fs*.9,g.C.c1,null,{r:3});
    g.ptxt(`clean ${Math.round(clean*100)}%`,g.vp().x,g.vp().y-g.fs*.6,g.C.ink,{size:.7,mono:true}); g.ptxt(`flagged ${Math.round(dirty*100)}%`,g.vp().x+g.vp().w*.55,g.vp().y-g.fs*.6,g.C.c1,{size:.7,mono:true}); });
  return S;
});

/* symmetric k-bit quantisation */
AA.def('quant', T => {
  const S=[], add=F(S), n=16, g8=8, b=3, Q=2**(b-1)-1;
  const w=T.range(n).map(()=>T.g()*.35); w[T.ri(8)]=T.u(1.2,1.5)*(T.r()<.5?-1:1);
  const grp=[0,1].map(k=>w.slice(k*g8,k*g8+g8)), s=grp.map(a=>Math.max(...a.map(Math.abs))/Q);
  const q=w.map((v,i)=>T.clamp(Math.round(v/s[Math.floor(i/g8)]),-Q,Q)), wh=q.map((v,i)=>v*s[Math.floor(i/g8)]);
  const err=wh.map((v,i)=>Math.abs(v-w[i]));
  const plot=(g,o={})=>{ g.view(.05,.1,.9,.58,-.5,n-.5,-1.6,1.6); g.frame(); g.seg(-.5,0,n-.5,0,g.C.line,1);
    g.seg(g8-.5,-1.6,g8-.5,1.6,g.C.ink,1.5,[4,3]); ['group 1','group 2'].forEach((t,k)=>g.txt(t,k*g8+g8/2-.5,1.48,g.C.muted,{align:'center',size:.72}));
    if(o.grid) [0,1].forEach(k=>{ if(o.grid<k+1) return; for(let j=-Q;j<=Q;j++) g.seg(k*g8-.45,j*s[k],k*g8+g8-.55,j*s[k],g.C.c4,1,[2,3],.7); g.txt(`s = ${T.f(s[k],3)}`,k*g8+g8-.6,-1.45,g.C.c4,{align:'right',size:.7,mono:true}); });
    w.forEach((v,i)=>{ const k=Math.floor(i/g8); const sn=(o.sn||[0,0])[k], y=T.lerp(v,wh[i],sn);
      if(o.ghost&&sn) g.dot(i,v,3,g.C.muted,{a:.5}); g.seg(i,0,i,y,g.C.c2,4); g.dot(i,y,4.5,sn?g.C.c1:g.C.c2);
      if(o.ints&&sn>.9) g.txt(String(q[i]),i,y+(y>=0?.18:-.18),g.C.ink,{align:'center',size:.66,mono:true}); }); };
  const foot=(g,t,c)=>g.ptxt(t,g.W*.05,g.H*.82,c||g.C.ink,{mono:true,size:.82});
  add(1,`${n} weights, ${b}-bit integers (−${Q}…${Q}), groups of ${g8}. One weight is an outlier.`,1400,g=>{ plot(g); foot(g,`32-bit floats: ${n*32} bits`); });
  add([2,3],`Group 1: its largest |w| sets the scale, s = ${T.f(s[0],3)}.`,1300,g=>{ plot(g,{grid:1}); foot(g,'scale = max|w| / (2^(b−1) − 1)'); });
  add(4,'Round each weight to the nearest level and clip.',1300,(g,p)=>{ plot(g,{grid:1,sn:[T.ease(p),0],ghost:1,ints:1}); foot(g,'q = clip(round(w / s))'); });
  add([2,3],`Group 2 has no outlier, so its scale is finer: s = ${T.f(s[1],3)}.`,1300,g=>{ plot(g,{grid:2,sn:[1,0],ghost:1,ints:1}); foot(g,'smaller groups = finer grids'); });
  add(4,'Round group 2.',1200,(g,p)=>{ plot(g,{grid:2,sn:[1,T.ease(p)],ghost:1,ints:1}); foot(g,'q = clip(round(w / s))'); });
  add(5,`Store ${n} small integers and 2 scales.`,1300,g=>{ plot(g,{grid:2,sn:[1,1],ints:1}); foot(g,`${n}×${b} + 2×16 = ${n*b+32} bits instead of ${n*32}`,g.C.c1); });
  add(6,'At inference ŵ = s·q. Grey dots are the originals: the error is at most s/2.',1600,g=>{ plot(g,{grid:2,sn:[1,1],ghost:1}); foot(g,`mean |error|  group 1: ${T.f(T.mean(err.slice(0,8)),3)}   group 2: ${T.f(T.mean(err.slice(8)),3)}`); });
  add(7,'Return q and s. The outlier stretched group 1’s grid, so its small weights lost more.',1800,g=>{ plot(g,{grid:2,sn:[1,1],ints:1}); foot(g,`memory ≈ ${T.f((n*b+32)/(n*32)*100,0)}% of the float version`,g.C.c1); });
  return S;
});

/* iterative magnitude pruning */
AA.def('prune', T => {
  const S=[], add=F(S), L=[3,5,5,2], E=[]; for(let l=0;l<3;l++) for(let i=0;i<L[l];i++) for(let j=0;j<L[l+1];j++) E.push({l,i,j,w:T.g()*(T.r()<.2?1.6:.6)});
  const steps=3, Sp=.75, acc=[.95];
  const states=[E.map(e=>({w:e.w,m:1}))];
  for(let t=1;t<=steps;t++){ const prev=states[states.length-1], target=Math.round(E.length*Sp*t/steps);
    const tau=prev.map(e=>e.m?Math.abs(e.w):0).sort((a,b)=>a-b)[target-1];
    const pr=prev.map(e=>({w:e.w,m:e.m&&Math.abs(e.w)>tau?1:0,tau})); states.push(pr);
    const ft=pr.map(e=>({w:e.m?e.w*(1+T.u(-.15,.25)):0,m:e.m})); states.push(ft);
    acc.push(.95-.04*t-.03*t*t*.5, .95-.006*t*t); }
  const net=(g,st,o={})=>{ const X=l=>g.W*(.08+l*.16), Y=(l,i)=>g.H*(.5+(i-(L[l]-1)/2)*.15);
    E.forEach((e,k)=>{ const s=st[k]; if(!s.m&&!o.fade) return; const a=s.m?1:(1-o.fade); if(a<=0) return; const w=Math.min(5,.5+Math.abs(s.w)*2.4);
      g.ctx.save(); g.ctx.globalAlpha=a*(s.m?.9:.35); g.pseg(X(e.l),Y(e.l,e.i),X(e.l+1),Y(e.l+1,e.j),s.m?(s.w>0?g.C.c1:g.C.c3):g.C.muted,w); g.ctx.restore(); });
    L.forEach((m,l)=>{ for(let i=0;i<m;i++){ g.ctx.beginPath(); g.ctx.arc(X(l),Y(l,i),g.fs*.55,0,7); g.ctx.fillStyle=g.C.card; g.ctx.fill(); g.ctx.strokeStyle=g.C.ink; g.ctx.lineWidth=1.5; g.ctx.stroke(); } });
    const live=st.filter(e=>e.m).length; g.ptxt(`${live} of ${E.length} weights kept (${Math.round(100*(1-live/E.length))}% sparse)`,g.W*.05,g.H*.1,g.C.ink,{mono:true,size:.8});
    if(o.tau!=null) g.ptxt(`τ = ${T.f(o.tau,2)}: remove every |w| below it`,g.W*.05,g.H*.1+g.fs*1.5,g.C.c4,{mono:true,size:.75}); };
  const chart=(g,k)=>{ g.view(.64,.16,.32,.62,0,acc.length-1,.6,1); g.frame(); g.ptxt('accuracy',g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.72});
    const pts=acc.slice(0,k+1).map((a,i)=>[i,a]); g.poly(pts,g.C.c2,2.2); pts.forEach((p,i)=>g.dot(p[0],p[1],4,i%2?g.C.c4:g.C.c2));
    for(let t=1;t<=steps;t++) g.txt('step '+t,2*t-.5,.62,g.C.muted,{align:'center',size:.62}); };
  add(1,`A trained network: ${E.length} weights. Line width = |w|.`,1300,g=>{ net(g,states[0]); chart(g,0); });
  add(2,'Start with every weight unmasked.',800,g=>{ net(g,states[0]); chart(g,0); });
  for(let t=1;t<=steps;t++){ const pr=states[2*t-1], ft=states[2*t], tau=pr[0].tau;
    add([3,4],`Step ${t}: target ${Math.round(Sp*t/steps*100)}% sparsity, so τ is that quantile of |w|.`,900,g=>{ net(g,states[2*t-2],{tau}); chart(g,2*t-2); });
    add(5,'Mask out the small weights: accuracy dips.',1200,(g,p)=>{ net(g,pr,{fade:T.ease(p),tau}); chart(g,2*t-1); });
    add(6,'Fine-tune the survivors; the pruned ones stay at zero. Accuracy recovers.',1200,g=>{ net(g,ft); chart(g,2*t); }); }
  add(7,`Return a network with ${Math.round(Sp*100)}% of weights removed and almost the same accuracy.`,1800,g=>{ net(g,states[2*steps]); chart(g,acc.length-1); });
  return S;
});

/* knowledge distillation training step */
AA.def('distil', T => {
  const S=[], add=F(S), cls=['cat','dog','fox','car','bus'], Tm=4, alpha=.3, y=0;
  const zt=[6,4.2,3.4,-1,-1.6], zs0=T.range(5).map(()=>T.g()*.8);
  const lr=1.2, traj=[zs0.slice()]; for(let k=0;k<5;k++){ const z=traj[traj.length-1], ps=smT(z,Tm), pt=smT(zt,Tm), ph=smT(z);
    traj.push(z.map((v,i)=>v-lr*((1-alpha)*Tm*(ps[i]-pt[i])+alpha*(ph[i]-(i===y?1:0))))); }
  const kl=(p,q)=>p.reduce((s,v,i)=>s+v*Math.log(v/Math.max(q[i],1e-9)),0);
  const bars=(g,fx,lab,pr,col,o={})=>{ g.view(fx,.18,.27,.5,-.5,4.5,0,1); g.frame(); g.ptxt(lab,g.vp().x,g.vp().y-g.fs*.8,g.C.muted,{size:.72});
    pr.forEach((v,i)=>{ g.rect(i-.32,0,i+.32,v,col,null,{a:.85}); if(o.ref) g.seg(i-.38,o.ref[i],i+.38,o.ref[i],g.C.c1,2); g.txt(cls[i],i,-.08,g.C.muted,{align:'center',size:.66}); }); };
  const loss=(g,z,o={})=>{ const ps=smT(z,Tm), pt=smT(zt,Tm), soft=Tm*Tm*kl(pt,ps), hard=-Math.log(smT(z)[y]); const x=g.W*.05,yy=g.H*.83;
    let t=''; if(o.s) t+=`L_soft = T²·KL = ${T.f(soft,3)}    `; if(o.h) t+=`L_hard = CE = ${T.f(hard,3)}    `; if(o.tot) t+=`total = ${T.f(alpha*hard+(1-alpha)*soft,3)}`; g.ptxt(t,x,yy,g.C.ink,{mono:true,size:.78}); };
  const pt1=smT(zt), ptT=smT(zt,Tm);
  add(1,`An image of a cat. The label says only “cat”. Temperature T = ${Tm}, α = ${alpha}.`,1300,g=>{ g.ptxt('hard label y = cat',g.W*.05,g.H*.3,g.C.ink,{size:.95}); bars(g,.36,'one-hot label',[1,0,0,0,0],g.C.muted); });
  add(2,'The teacher at T = 1 is nearly certain…',1100,g=>bars(g,.05,'teacher, T = 1',pt1,g.C.c2));
  add(2,`…but at T = ${Tm} its softer probabilities show that a cat looks more like a dog or fox than a bus.`,1600,(g,p)=>{ bars(g,.05,'teacher, T = 1',pt1,g.C.c2); bars(g,.38,`teacher, T = ${Tm}`,pt1.map((v,i)=>T.lerp(v,ptT[i],T.ease(p))),g.C.c4); });
  add(3,'The untrained student’s logits give a different, flat-ish guess.',1200,g=>{ bars(g,.05,`teacher, T = ${Tm}`,ptT,g.C.c4); bars(g,.38,`student, T = ${Tm}`,smT(traj[0],Tm),g.C.c3,{ref:ptT}); });
  add(4,'Soft loss: how far the student’s softened distribution is from the teacher’s (red ticks).',1300,g=>{ bars(g,.05,`teacher, T = ${Tm}`,ptT,g.C.c4); bars(g,.38,`student, T = ${Tm}`,smT(traj[0],Tm),g.C.c3,{ref:ptT}); loss(g,traj[0],{s:1}); });
  add(5,'Hard loss: ordinary cross-entropy with the true label, at T = 1.',1200,g=>{ bars(g,.05,`teacher, T = ${Tm}`,ptT,g.C.c4); bars(g,.38,`student, T = ${Tm}`,smT(traj[0],Tm),g.C.c3,{ref:ptT}); bars(g,.7,'student, T = 1',smT(traj[0]),g.C.c3); loss(g,traj[0],{s:1,h:1}); });
  for(let k=1;k<traj.length;k++) add(6,`Update ${k}: a gradient step on α·L_hard + (1−α)·L_soft pulls the student toward the teacher.`,800,(g,p)=>{ const z=traj[k-1].map((v,i)=>T.lerp(v,traj[k][i],T.ease(p)));
    bars(g,.05,`teacher, T = ${Tm}`,ptT,g.C.c4); bars(g,.38,`student, T = ${Tm}`,smT(z,Tm),g.C.c3,{ref:ptT}); bars(g,.7,'student, T = 1',smT(z),g.C.c3); loss(g,z,{s:1,h:1,tot:1}); });
  return S;
});

[[/precision.recall curve and average precision/i,'prcurve'],[/nDCG@k/i,'ndcg'],[/BLEU score/i,'bleu'],[/stratified train\/validation\/test split/i,'strat'],
 [/checking for train.test overlap/i,'leak'],[/symmetric k-bit quantisation/i,'quant'],[/iterative magnitude pruning/i,'prune'],[/knowledge distillation training step/i,'distil']
].forEach(([re,k])=>AA.title(re,k));
/* ---------- foundations: special matrices, bases, covariance, calculus ---------- */
const sq2v=(g)=>{ const side=Math.min(.58*g.W,.88*g.H); return [.02,.07,side/g.W,side/g.H]; };

/* recognising a special matrix */
AA.def('special', T => {
  const S=[], add=F(S), r1=v=>Math.round(v*100)/100;
  const kinds=['diag','tri','sym','rot','gen'], kind=kinds[T.ri(kinds.length)];
  let A; const th=T.u(.4,1.1), c=r1(Math.cos(th)), s=r1(Math.sin(th));
  if(kind==='diag') A=[[r1(T.u(.5,3)),0,0],[0,r1(T.u(.5,3)),0],[0,0,r1(T.u(.5,3))]];
  else if(kind==='tri') A=[[r1(T.u(1,3)),0,0],[r1(T.u(-2,2)),r1(T.u(1,3)),0],[r1(T.u(-2,2)),r1(T.u(-2,2)),r1(T.u(1,3))]];
  else if(kind==='sym'){ const a=r1(T.u(-.9,.9)), b=r1(T.u(-.9,.9)), d=r1(T.u(-.9,.9)); A=[[r1(T.u(2,3)),a,b],[a,r1(T.u(2,3)),d],[b,d,r1(T.u(2,3))]]; }
  else if(kind==='rot') A=[[c,-s,0],[s,c,0],[0,0,1]];
  else A=[[r1(T.u(-2,2)),r1(T.u(-2,2)),r1(T.u(-2,2))],[r1(T.u(-2,2)),r1(T.u(-2,2)),r1(T.u(-2,2))],[r1(T.u(-2,2)),r1(T.u(-2,2)),r1(T.u(-2,2))]];
  const eps=.02, n=3, R=T.range(n);
  const AtA=R.map(i=>R.map(j=>r1(R.reduce((t,k)=>t+A[k][i]*A[k][j],0))));
  const offZero=R.every(i=>R.every(j=>i===j||Math.abs(A[i][j])<eps));
  const upZero=R.every(i=>R.every(j=>j<=i||Math.abs(A[i][j])<eps)), loZero=R.every(i=>R.every(j=>j>=i||Math.abs(A[i][j])<eps));
  const sym=R.every(i=>R.every(j=>Math.abs(A[i][j]-A[j][i])<eps));
  const orth=R.every(i=>R.every(j=>Math.abs(AtA[i][j]-(i===j?1:0))<.03));
  let chol=null; if(sym){ const L=R.map(()=>[0,0,0]); chol={ok:true,piv:[]}; for(let i=0;i<n&&chol.ok;i++) for(let j=0;j<=i;j++){ let t=A[i][j]; for(let k=0;k<j;k++) t-=L[i][k]*L[j][k]; if(i===j){ chol.piv.push(t); if(t<=0){ chol.ok=false; break; } L[i][i]=Math.sqrt(t); } else L[i][j]=t/L[j][j]; } }
  const tags=[]; if(offZero) tags.push(R.every(i=>Math.abs(A[i][i]-1)<eps)?'identity':'diagonal'); else if(upZero||loZero) tags.push(upZero?'lower triangular':'upper triangular');
  if(sym) tags.push('symmetric'); if(orth) tags.push('orthogonal'); if(chol&&chol.ok) tags.push('positive definite'); if(!tags.length) tags.push('none: a general matrix');
  const G=g=>({cw:Math.min(g.W*.12,52),ch:Math.min(g.H*.12,34)});
  const showA=(g,hl,o={})=>{ const {cw,ch}=G(g); g.mat(A,g.W*.05,g.H*.2,cw,ch,{hl,label:'A',dp:2}); if(o.ata) g.mat(AtA,g.W*.52,g.H*.2,cw,ch,{hl:o.ata,label:'AᵀA',dp:2}); };
  const tagline=(g,t,col)=>g.ptxt(t,g.W*.05,g.H*.78,col||g.C.ink,{size:.9,semi:true});
  const ok=(b)=>b?g=>g.C.c3:g=>g.C.c2;
  add(1,`A 3×3 matrix. Which special shapes does it have?`,1300,g=>showA(g));
  add(2,'Check every entry off the diagonal.',1400,g=>{ showA(g,(i,j)=>i===j?null:(Math.abs(A[i][j])<eps?g.C.c3+'55':g.C.c2+'55')); tagline(g,offZero?'All zero: diagonal.':'Some are non-zero: not diagonal.',offZero?g.C.c3:g.C.c2); });
  if(!offZero) add(3,'Is everything above (or below) the diagonal zero?',1400,g=>{ showA(g,(i,j)=>j>i?(Math.abs(A[i][j])<eps?g.C.c3+'55':g.C.c2+'55'):j<i?(Math.abs(A[i][j])<eps?g.C.c3+'33':g.C.c4+'33'):null); tagline(g,upZero||loZero?'Yes: triangular, solvable one row at a time.':'No: not triangular.',upZero||loZero?g.C.c3:g.C.c2); });
  [[0,1],[0,2],[1,2]].forEach(([i,j],k)=>add(4,`Compare A${i+1}${j+1} with A${j+1}${i+1}: mirror images across the diagonal?`,700,g=>{ showA(g,(a,b)=>(a===i&&b===j)||(a===j&&b===i)?(Math.abs(A[i][j]-A[j][i])<eps?g.C.c3+'66':g.C.c2+'66'):null); if(k===2) tagline(g,sym?'All pairs match: symmetric.':'Not symmetric.',sym?g.C.c3:g.C.c2); }));
  add(5,`Compute AᵀA: dot products of the columns. Is it the identity?`,1700,(g,p)=>{ showA(g,null,{ata:(i,j)=>Math.abs(AtA[i][j]-(i===j?1:0))<.03?g.C.c3+'55':g.C.c2+'55'}); tagline(g,orth?(A[2][2]>0?'Yes: orthogonal, lengths are kept (a rotation).':'Yes: orthogonal.'):'No: columns are not perpendicular unit vectors.',orth?g.C.c3:g.C.c2); });
  add(6,sym?'Symmetric, so try Cholesky: every pivot must be positive.':'Not symmetric, so positive definiteness does not apply.',1600,g=>{ showA(g); if(chol){ chol.piv.forEach((v,i)=>g.ptxt(`pivot ${i+1}: ${T.f(v,2)} ${v>0?'✓':'✗'}`,g.W*.55,g.H*(.28+i*.1),v>0?g.C.c3:g.C.c2,{mono:true,size:.85})); tagline(g,chol.ok?'All positive: positive definite.':'A pivot ≤ 0: not positive definite.',chol.ok?g.C.c3:g.C.c2); } });
  add(7,`Properties found: ${tags.join(', ')}.`,2000,g=>{ showA(g); tags.forEach((t,i)=>{ g.prect(g.W*.55,g.H*(.22+i*.12),g.W*.38,g.H*.09,g.C.soft,null,{r:6}); g.ptxt(t,g.W*.57,g.H*(.265+i*.12),g.C.c1,{semi:true,size:.9}); }); });
  return S;
});

/* coordinates in a new basis */
AA.def('basiscoord', T => {
  const S=[], add=F(S), orth=T.r()<.5;
  let b1,b2; if(orth){ const t=T.u(.2,1.2); b1=[Math.cos(t),Math.sin(t)]; b2=[-Math.sin(t),Math.cos(t)]; } else { b1=[T.u(1,1.8),T.u(-.4,.6)]; b2=[T.u(-.3,.7),T.u(1,1.7)]; }
  const x=[T.u(1.2,2.6),T.u(.8,2.6)], det=b1[0]*b2[1]-b1[1]*b2[0], c=[(x[0]*b2[1]-x[1]*b2[0])/det,(b1[0]*x[1]-b1[1]*x[0])/det];
  const btb=[[b1[0]*b1[0]+b1[1]*b1[1],b1[0]*b2[0]+b1[1]*b2[1]],[b1[0]*b2[0]+b1[1]*b2[1],b2[0]*b2[0]+b2[1]*b2[1]]];
  const pl=(g,o={})=>{ const v=sq2v(g); g.view(...v,-1,4,-1,4); g.frame(); g.seg(-1,0,4,0,g.C.line,1); g.seg(0,-1,0,4,g.C.line,1);
    for(let k=-3;k<=5;k++){ g.seg(k*b1[0]-3*b2[0],k*b1[1]-3*b2[1],k*b1[0]+5*b2[0],k*b1[1]+5*b2[1],g.C.c1,1,null,.18); g.seg(k*b2[0]-3*b1[0],k*b2[1]-3*b1[1],k*b2[0]+5*b1[0],k*b2[1]+5*b1[1],g.C.c3,1,null,.18); }
    g.arrow(0,0,b1[0],b1[1],g.C.c1,3); g.arrow(0,0,b2[0],b2[1],g.C.c3,3); g.txt('b₁',b1[0],b1[1]-.25,g.C.c1,{bold:true}); g.txt('b₂',b2[0]-.25,b2[1],g.C.c3,{bold:true});
    g.dot(x[0],x[1],6,g.C.c4); g.txt('x',x[0]+.15,x[1]+.2,g.C.c4,{bold:true});
    if(o.walk!=null){ const p1=Math.min(1,o.walk*2), p2=Math.max(0,o.walk*2-1), s1=[c[0]*b1[0]*p1,c[0]*b1[1]*p1]; g.seg(0,0,s1[0],s1[1],g.C.c1,3.5,[6,4]); if(p2>0) g.seg(s1[0],s1[1],s1[0]+c[1]*b2[0]*p2,s1[1]+c[1]*b2[1]*p2,g.C.c3,3.5,[6,4]); }
    if(o.proj) [b1,b2].forEach((b,i)=>{ const t=c[i]*o.proj; g.seg(x[0],x[1],t*b[0],t*b[1],i?g.C.c3:g.C.c1,1.5,[3,3]); g.dot(t*b[0],t*b[1],4,i?g.C.c3:g.C.c1); }); };
  const side=(g,lines)=>lines.forEach(([t,col],i)=>g.ptxt(t,g.W*.64,g.H*(.18+i*.11),col||g.C.ink,{mono:true,size:.82}));
  add(1,`A basis b₁, b₂ (${orth?'perpendicular unit vectors':'not perpendicular'}) and a point x. What are x's coordinates in this basis?`,1500,g=>{ pl(g); side(g,[[`x = (${T.f(x[0],2)}, ${T.f(x[1],2)})`,g.C.c4],['in the standard basis']]); });
  add(2,'Is BᵀB the identity? Its entries are dot products of the basis vectors.',1500,g=>{ pl(g); side(g,[[`BᵀB = [${T.f(btb[0][0],2)} ${T.f(btb[0][1],2)}]`],[`      [${T.f(btb[1][0],2)} ${T.f(btb[1][1],2)}]`],[orth?'= I: orthonormal':'≠ I',orth?g.C.c3:g.C.c2]]); });
  if(orth) add(2,'Orthonormal: each coordinate is a dot product, cᵢ = bᵢ · x (drop a perpendicular).',1800,(g,p)=>{ pl(g,{proj:T.ease(p)}); side(g,[[`c₁ = b₁·x = ${T.f(c[0],2)}`,g.C.c1],[`c₂ = b₂·x = ${T.f(c[1],2)}`,g.C.c3]]); });
  else add(3,'Not orthonormal: solve Bc = x by elimination.',1500,g=>{ pl(g); side(g,[[`c₁ = ${T.f(c[0],2)}`,g.C.c1],[`c₂ = ${T.f(c[1],2)}`,g.C.c3]]); });
  add(4,`Check: walk ${T.f(c[0],2)} steps along b₁, then ${T.f(c[1],2)} along b₂. You land on x.`,2000,(g,p)=>{ pl(g,{walk:T.ease(p)}); side(g,[[`c₁ = ${T.f(c[0],2)}`,g.C.c1],[`c₂ = ${T.f(c[1],2)}`,g.C.c3],['c₁b₁ + c₂b₂ = x ✓',g.C.c4]]); });
  add(5,`Return c = (${T.f(c[0],2)}, ${T.f(c[1],2)}): the same point, new coordinates.`,1600,g=>{ pl(g,{walk:1}); side(g,[[`c = (${T.f(c[0],2)}, ${T.f(c[1],2)})`,g.C.c1]]); });
  return S;
});

/* sample covariance and correlation */
AA.def('covmat', T => {
  const S=[], add=F(S), n=8, rho=T.u(-.8,.85);
  const X=T.range(n).map(()=>{ const a=T.g(), b=rho*a+Math.sqrt(1-rho*rho)*T.g(); return [Math.round((3+1.2*a)*10)/10, Math.round((2+0.8*b)*10)/10]; });
  const m=[0,1].map(j=>T.mean(X.map(r=>r[j]))), C=X.map(r=>[r[0]-m[0],r[1]-m[1]]);
  const Sig=k=>{ const Sm=[[0,0],[0,0]]; for(let i=0;i<k;i++) for(let a=0;a<2;a++) for(let b=0;b<2;b++) Sm[a][b]+=C[i][a]*C[i][b]/(n-1); return Sm; };
  const SF=Sig(n), Rr=[[1,SF[0][1]/Math.sqrt(SF[0][0]*SF[1][1])],[SF[0][1]/Math.sqrt(SF[0][0]*SF[1][1]),1]];
  const tbl=(g,M,hl,lab)=>{ const ch=Math.min(g.H*.075,24), cw=Math.min(g.W*.09,54); g.mat(M,g.W*.04,g.H*.12,cw,ch,{hl,label:lab,dp:1,size:.75}); };
  const sc=(g,cent,hi)=>{ g.view(.36,.1,.3,.46,-3,3,-3,3); g.frame(); g.seg(-3,0,3,0,g.C.line,1); g.seg(0,-3,0,3,g.C.line,1);
    X.forEach((r,i)=>{ const x=r[0]-m[0]*cent, y=r[1]-m[1]*cent; const px=T.clamp(cent?x:x-3,-2.9,2.9), py=T.clamp(cent?y:y-2,-2.9,2.9); g.dot(px,py,hi===i?6:4.2,hi===i?g.C.c4:g.C.c3); });
    g.ptxt(cent?'centred data':'raw data (shifted to fit)',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.7}); };
  const mat2=(g,M,lab,col)=>{ const cw=Math.min(g.W*.1,62), ch=Math.min(g.H*.1,30); g.mat(M,g.W*.72,g.H*.2,cw,ch,{label:lab,dp:2,col:()=>col||g.C.ink}); };
  add(1,`${n} examples, 2 features. Rows are examples, columns are features.`,1400,g=>{ tbl(g,X,null,'X'); sc(g,0); });
  add(2,`Feature means: x̄ = (${T.f(m[0],2)}, ${T.f(m[1],2)}).`,1300,g=>{ tbl(g,X,null,'X'); sc(g,0); g.ptxt(`x̄ = (${T.f(m[0],2)}, ${T.f(m[1],2)})`,g.W*.36,g.H*.66,g.C.c1,{mono:true,size:.85}); });
  add(3,'Centre: subtract each column’s mean. The cloud moves to the origin.',1600,(g,p)=>{ const q=T.ease(p); tbl(g,X.map((r,i)=>[r[0]-m[0]*q,r[1]-m[1]*q].map(v=>Math.round(v*10)/10)),null,'X̃'); sc(g,q); });
  for(let k=1;k<=n;k++) add(4,`Row ${k}: add its outer product (deviation × deviation) to Σ̂, divided by n − 1.`,k<3?900:450,g=>{ tbl(g,C.map(r=>r.map(v=>Math.round(v*10)/10)),(i)=>i===k-1?g.C.c4+'44':null,'X̃'); sc(g,1,k-1); mat2(g,Sig(k),'Σ̂ so far'); });
  add(5,`Divide by both standard deviations: correlation ρ = ${T.f(Rr[0][1],2)}.`,1700,g=>{ tbl(g,C.map(r=>r.map(v=>Math.round(v*10)/10)),null,'X̃'); sc(g,1); mat2(g,SF,'Σ̂'); const cw=Math.min(g.W*.1,62), ch=Math.min(g.H*.1,30); g.mat(Rr,g.W*.72,g.H*.55,cw,ch,{label:'R',dp:2,col:()=>g.C.c1}); });
  add(6,'Return Σ̂ (variances on the diagonal) and R (ones on the diagonal).',1600,g=>{ tbl(g,C.map(r=>r.map(v=>Math.round(v*10)/10)),null,'X̃'); sc(g,1); mat2(g,SF,'Σ̂'); const cw=Math.min(g.W*.1,62), ch=Math.min(g.H*.1,30); g.mat(Rr,g.W*.72,g.H*.55,cw,ch,{label:'R',dp:2,col:()=>g.C.c1}); });
  return S;
});

/* gradient check */
AA.def('gradcheck', T => {
  const S=[], add=F(S), a=T.u(.3,.8), b=T.u(.8,1.6), th=[T.u(-1.6,1.6),T.u(-1.2,1.2)], h=.25, bug=T.r()<.4;
  const f=(x,y)=>a*x*x+b*y*y, gt=[2*a*th[0],2*b*th[1]], gc=bug?[2*a*th[0],b*th[1]]:gt.slice();
  const num=[(f(th[0]+h,th[1])-f(th[0]-h,th[1]))/(2*h),(f(th[0],th[1]+h)-f(th[0],th[1]-h))/(2*h)];
  const err=Math.hypot(gc[0]-num[0],gc[1]-num[1])/(Math.hypot(...gc)+Math.hypot(...num));
  const pl=(g,o={})=>{ const v=sq2v(g); g.view(...v,-2.5,2.5,-2.5,2.5); g.frame(); g.clip(true);
    for(let k=1;k<=6;k++){ const L=.25*k*k, pts=T.range(61).map(i=>{ const t=i/60*2*Math.PI; return [Math.sqrt(L/a)*Math.cos(t),Math.sqrt(L/b)*Math.sin(t)]; }); g.poly(pts,g.C.c3,1.2,null,{a:.5}); }
    g.clip(false); g.dot(th[0],th[1],6,g.C.c4);
    if(o.j!=null){ const e=o.j?[0,h]:[h,0]; g.dot(th[0]+e[0],th[1]+e[1],4.5,g.C.c1); g.dot(th[0]-e[0],th[1]-e[1],4.5,g.C.c1); g.seg(th[0]-e[0],th[1]-e[1],th[0]+e[0],th[1]+e[1],g.C.c1,2,[3,3]); } };
  const side=(g,lines)=>{ const v=sq2v(g), x0=(v[0]+v[2])*g.W+10; lines.forEach(([t,col],i)=>g.ptxt(t,x0,g.H*(.16+i*.1),col||g.C.ink,{mono:true,size:.74})); };
  const base=[[`f = ${T.f(a,2)}θ₁² + ${T.f(b,2)}θ₂²`],[`code ∇f: (${T.f(gc[0],2)}, ${T.f(gc[1],2)})`]];
  add(1,`A point θ and the gradient your code returned${bug?' (it may have a bug)':''}.`,1500,g=>{ pl(g); side(g,[[base[0][0]],[base[1][0],g.C.c2]]); });
  add(2,'For each coordinate, nudge just that input both ways.',800,g=>{ pl(g); side(g,[[base[0][0]],[base[1][0],g.C.c2]]); });
  [0,1].forEach(j=>add(3,`θ${j?'₂':'₁'} ± h: (f(θ+he) − f(θ−he)) / 2h = ${T.f(num[j],3)}.`,1600,g=>{ pl(g,{j}); side(g,[[base[0][0]],[base[1][0],g.C.c2],...[0,1].filter(k=>k<=j).map(k=>[`numeric ∂f/∂θ${k?'₂':'₁'}: ${T.f(num[k],2)}`,g.C.c1])]); }));
  add(4,`Relative error = ${err<1e-6?'< 1e-6':T.f(err,3)}.`,1500,g=>{ pl(g); side(g,[[base[1][0],g.C.c2],[`numeric: (${T.f(num[0],2)}, ${T.f(num[1],2)})`,g.C.c1],[`relative error ${err<1e-6?'≈ 0':T.f(err,3)}`,err<1e-6?g.C.c3:g.C.c2]]); });
  add(5,bug?'Too large: the code’s ∂f/∂θ₂ is wrong (a missing factor of 2). Fix and re-check.':'Tiny: the analytic gradient is correct.',2000,g=>{ pl(g); side(g,[[bug?'✗ bug found':'✓ gradient OK',bug?g.C.c2:g.C.c3]]); });
  return S;
});

/* backpropagation on a graph */
AA.def('graphbp', T => {
  const S=[], add=F(S), w=Math.round(T.u(-1.5,1.5)*10)/10, b=Math.round(T.u(-1,1)*10)/10, x=Math.round(T.u(.5,2)*10)/10, y=T.r()<.5?1:0;
  const z=w*x+b, a=1/(1+Math.exp(-z)), L=(a-y)**2, dLa=2*(a-y), dz=a*(1-a), dLz=dLa*dz;
  const N=[{k:'x',p:[.08,.2],v:x,gr:dLz*w},{k:'w',p:[.08,.5],v:w,gr:dLz*x},{k:'b',p:[.08,.8],v:b,gr:dLz},{k:'z',p:[.4,.5],v:z,gr:dLz},{k:'a',p:[.66,.5],v:a,gr:dLa},{k:'L',p:[.9,.5],v:L,gr:1}];
  const E=[[0,3,'w'],[1,3,'x'],[2,3,'1'],[3,4,T.f(dz,2)],[4,5,T.f(dLa,2)]];
  const draw=(g,fw,bw,hlE)=>{ E.forEach(([i,j,l],k)=>{ const A=N[i].p,B=N[j].p; g.parrow(A[0]*g.W+22,A[1]*g.H,B[0]*g.W-24,B[1]*g.H,hlE===k?g.C.c2:g.C.line,hlE===k?2.5:1.5); if(bw!=null) g.ptxt('×'+l,(A[0]+B[0])/2*g.W,(A[1]+B[1])/2*g.H-9,g.C.c4,{align:'center',size:.7,mono:true}); });
    N.forEach((n,i)=>{ const X=n.p[0]*g.W, Y=n.p[1]*g.H; g.prect(X-21,Y-15,42,30,g.C.card,i<3?g.C.c1:i===5?g.C.c2:g.C.c3,{r:7,lw:2}); g.ptxt(n.k,X,Y,g.C.ink,{align:'center',bold:true});
      if(fw>i||(i<3&&fw>0)) g.ptxt(T.f(n.v,3),X,Y-25,g.C.ink,{align:'center',mono:true,size:.72});
      if(bw!=null&&bw.includes(i)) g.ptxt(T.f(n.gr,3),X,Y+26,g.C.c2,{align:'center',mono:true,size:.75,bold:true}); }); };
  add(1,`A graph: z = wx + b, a = σ(z), L = (a − y)² with y = ${y}.`,1400,g=>draw(g,0));
  add(2,'Forward: inputs are known.',700,g=>draw(g,3));
  add(2,`z = ${T.f(w,1)}·${T.f(x,1)} + ${T.f(b,1)} = ${T.f(z,3)}.`,800,g=>draw(g,4));
  add(2,`a = σ(z) = ${T.f(a,3)}.`,800,g=>draw(g,5));
  add(2,`L = (a − y)² = ${T.f(L,3)}. Every value is stored.`,1000,g=>draw(g,6));
  add(3,'Backward starts at the loss: ∂L/∂L = 1.',900,g=>draw(g,6,[5]));
  add([4,5],`Node a: ∂L/∂a = 1 × 2(a − y) = ${T.f(dLa,3)}.`,1100,g=>draw(g,6,[5,4],4));
  add([4,5],`Node z: ∂L/∂z = ${T.f(dLa,3)} × σ′(z) = ${T.f(dLz,3)}.`,1100,g=>draw(g,6,[5,4,3],3));
  add([4,5],`Inputs of z: ∂L/∂w = ∂L/∂z × x, ∂L/∂b = ∂L/∂z × 1, ∂L/∂x = ∂L/∂z × w.`,1500,g=>draw(g,6,[5,4,3,2,1,0]));
  add(6,`Return ∂L/∂w = ${T.f(dLz*x,3)} and ∂L/∂b = ${T.f(dLz,3)}: one forward and one backward pass.`,1900,g=>draw(g,6,[5,4,3,2,1,0]));
  return S;
});

/* Lagrange multipliers */
AA.def('lagrange', T => {
  const S=[], add=F(S), r=T.u(1.1,1.6), ct=[T.u(1.6,2.3)*(T.r()<.5?1:-1),T.u(.8,1.8)*(T.r()<.5?1:-1)];
  const f=(x,y)=>(x-ct[0])**2+(y-ct[1])**2, phMin=Math.atan2(ct[1],ct[0]), phMax=phMin+Math.PI, pt=ph=>[r*Math.cos(ph),r*Math.sin(ph)];
  const pl=(g,ph,o={})=>{ const v=sq2v(g); g.view(...v,-3,3,-3,3); g.frame(); g.clip(true);
    for(let k=1;k<=9;k++){ const R=.5*k, pts=T.range(61).map(i=>{ const t=i/60*2*Math.PI; return [ct[0]+R*Math.cos(t),ct[1]+R*Math.sin(t)]; }); g.poly(pts,g.C.c3,1,null,{a:.4}); }
    g.clip(false); g.poly(T.range(81).map(i=>pt(i/80*2*Math.PI)),g.C.c1,3); g.dot(ct[0],ct[1],6,g.C.c4);
    (o.cands||[]).forEach(q=>{ const p=pt(q); g.dot(p[0],p[1],7,g.C.c3,{ring:g.C.ink}); });
    if(ph!=null){ const p=pt(ph), gf=[2*(p[0]-ct[0]),2*(p[1]-ct[1])], gg=[2*p[0],2*p[1]], nf=Math.hypot(...gf)||1, ng=Math.hypot(...gg)||1;
      g.arrow(p[0],p[1],p[0]+gf[0]/nf*1.1,p[1]+gf[1]/nf*1.1,g.C.c2,2.6); g.arrow(p[0],p[1],p[0]+gg[0]/ng*.8,p[1]+gg[1]/ng*.8,g.C.c1,2.6); g.dot(p[0],p[1],5.5,g.C.ink); } };
  const side=(g,lines)=>{ const v=sq2v(g), x0=(v[0]+v[2])*g.W+10; lines.forEach(([t,col],i)=>g.ptxt(t,x0,g.H*(.16+i*.1),col||g.C.ink,{mono:true,size:.74})); };
  const ang=ph=>{ const p=pt(ph), gf=[2*(p[0]-ct[0]),2*(p[1]-ct[1])], gg=[2*p[0],2*p[1]]; return Math.atan2(Math.abs(gf[0]*gg[1]-gf[1]*gg[0]),gf[0]*gg[0]+gf[1]*gg[1])*180/Math.PI; };
  add(1,'Minimise the distance² to the orange target f, staying on the purple circle g = x² + y² − r² = 0.',1500,g=>{ pl(g); side(g,[['f = (x−a)² + (y−b)²'],['g = x² + y² − r²',g.C.c1]]); });
  add(2,'Form the Lagrangian 𝓛 = f − λg.',1000,g=>{ pl(g); side(g,[['𝓛 = f − λ g'],['∇𝓛 = 0  ⇔  ∇f = λ∇g, g = 0']]); });
  const ph0=phMin+2.2; add(3,'Slide along the circle and compare the directions of ∇f (red) and ∇g (purple).',2600,(g,p)=>{ const ph=ph0+p*(phMin+2*Math.PI-ph0-0.0)%(2*Math.PI); const q=ph0+(phMin+2*Math.PI-ph0)*T.ease(p); pl(g,q); side(g,[[`angle between them: ${T.f(ang(q),0)}°`]]); });
  add(3,'Parallel here (same direction): candidate 1.',1100,g=>{ pl(g,phMin,{cands:[phMin]}); side(g,[['angle 0°: ∇f = λ∇g',g.C.c3]]); });
  add(3,'…and parallel again on the far side (opposite direction): candidate 2.',1300,g=>{ pl(g,phMax,{cands:[phMin,phMax]}); side(g,[['angle 180°: ∇f = λ∇g, λ < 0',g.C.c3]]); });
  add(4,`Evaluate f: ${T.f(f(...pt(phMin)),2)} at candidate 1, ${T.f(f(...pt(phMax)),2)} at candidate 2.`,1600,g=>{ pl(g,null,{cands:[phMin,phMax]}); side(g,[[`f₁ = ${T.f(f(...pt(phMin)),2)}`,g.C.c3],[`f₂ = ${T.f(f(...pt(phMax)),2)}`]]); });
  add(5,'Return candidate 1: the constrained minimum (candidate 2 is the maximum).',1800,g=>{ pl(g,phMin,{cands:[phMin]}); side(g,[['minimum on the circle ✓',g.C.c3]]); });
  return S;
});

[[/recognising a special matrix/i,'special'],[/coordinates of a vector in a new basis/i,'basiscoord'],[/sample covariance and correlation/i,'covmat'],[/gradient check by finite differences/i,'gradcheck'],
 [/reverse-mode differentiation/i,'graphbp'],[/Lagrange multipliers for an equality/i,'lagrange']].forEach(([re,k])=>AA.title(re,k));
/* ================= DEEP LEARNING ANIMATIONS ================= */
/* draw a small fully connected net. L = sizes, W[l] = matrix (L[l+1] x L[l]); o.act[l][i] values in [-1,1]; o.pulse = {l, p, back} */
function drawNet(g, L, W, o={}){
  const vp=g.vp(), nl=L.length, X=l=>vp.x+vp.w*(.1+.8*l/(nl-1)), Y=(l,i)=>vp.y+vp.h*((i+1)/(L[l]+1)), R=Math.min(vp.h/ (Math.max(...L)+1)*.32, 20);
  for(let l=0;l<nl-1;l++) for(let i=0;i<L[l+1];i++) for(let j=0;j<L[l];j++){ const w=W[l][i][j]; g.ctx.save(); g.ctx.globalAlpha=.25+.6*Math.min(1,Math.abs(w)/4); g.pseg(X(l),Y(l,j),X(l+1),Y(l+1,i),w>=0?g.C.c1:g.C.c4,.8+Math.min(5,Math.abs(w)*1.1)); g.ctx.restore();
    if(o.pulse && o.pulse.l===l){ const p=o.pulse.back?1-o.pulse.p:o.pulse.p; g.pdot(T.lerp(X(l),X(l+1),p),T.lerp(Y(l,j),Y(l+1,i),p),3.2,o.pulse.back?g.C.c2:g.C.c5); } }
  for(let l=0;l<nl;l++) for(let i=0;i<L[l];i++){ const v=o.act&&o.act[l]?o.act[l][i]:null; const cx=X(l), cy=Y(l,i);
    g.ctx.beginPath(); g.ctx.arc(cx,cy,R,0,7); g.ctx.fillStyle=g.C.card; g.ctx.fill(); if(v!=null){ g.ctx.save(); g.ctx.globalAlpha=Math.min(1,Math.abs(v)); g.ctx.fillStyle=v>=0?g.C.c1:g.C.c4; g.ctx.fill(); g.ctx.restore(); }
    g.ctx.lineWidth=2; g.ctx.strokeStyle=o.ring&&o.ring[l]&&o.ring[l][i]!=null?g.C.c2:g.C.ink; g.ctx.stroke();
    if(v!=null && o.vals!==false) g.ptxt(T.f(o.txt&&o.txt[l]?o.txt[l][i]:v,2),cx,cy+R+g.fs*.75,g.C.ink,{align:'center',mono:true,size:.72});
    if(o.ring&&o.ring[l]&&o.ring[l][i]!=null) g.ptxt('δ '+T.f(o.ring[l][i],2),cx,cy-R-g.fs*.7,g.C.c2,{align:'center',mono:true,size:.72,bold:true}); }
  if(o.labels) o.labels.forEach((s,l)=>g.ptxt(s,X(l),vp.y+vp.h-g.fs*.2,g.C.muted,{align:'center',size:.75}));
}
AA.drawNet = drawNet;
const tanh=Math.tanh;
function xorNet(){
  const D=[[0,0,0],[0,1,1],[1,0,1],[1,1,0]]; let best=null;
  for(let tr=0;tr<6;tr++){ let W1=T.range(3).map(()=>[T.g()*1.2,T.g()*1.2]), b1=T.range(3).map(()=>T.g()*.5), W2=[T.range(3).map(()=>T.g()*1.2)], b2=[0]; const snaps=[], losses=[];
    const fwd=(x)=>{ const z1=W1.map((r,i)=>r[0]*x[0]+r[1]*x[1]+b1[i]), a1=z1.map(tanh), z2=W2[0].reduce((s,w,i)=>s+w*a1[i],b2[0]), p=T.sig(z2); return {a1,p}; };
    for(let e=0;e<=1200;e++){ const gW1=W1.map(()=>[0,0]), gb1=[0,0,0], gW2=[0,0,0]; let gb2=0, L=0;
      D.forEach(([x1,x2,y])=>{ const {a1,p}=fwd([x1,x2]); L-=(y?Math.log(p):Math.log(1-p))/4; const d2=(p-y)/4; gb2+=d2; a1.forEach((a,i)=>{ gW2[i]+=d2*a; const d1=d2*W2[0][i]*(1-a*a); gb1[i]+=d1; gW1[i][0]+=d1*x1; gW1[i][1]+=d1*x2; }); });
      if(e%40===0){ snaps.push({W1:W1.map(r=>[...r]),b1:[...b1],W2:[[...W2[0]]],b2:[...b2]}); losses.push(L); }
      const lr=1.2; W1=W1.map((r,i)=>[r[0]-lr*gW1[i][0],r[1]-lr*gW1[i][1]]); b1=b1.map((v,i)=>v-lr*gb1[i]); W2=[W2[0].map((v,i)=>v-lr*gW2[i])]; b2=[b2[0]-lr*gb2]; }
    const r={snaps,losses,D}; if(!best||losses[losses.length-1]<best.losses[best.losses.length-1]) best=r; if(losses[losses.length-1]<.08) break; }
  return best;
}
const netFwd=(s,x)=>{ const z1=s.W1.map((r,i)=>r[0]*x[0]+r[1]*x[1]+s.b1[i]), a1=z1.map(tanh), z2=s.W2[0].reduce((q,w,i)=>q+w*a1[i],s.b2[0]); return {a1,p:T.sig(z2)}; };
AA.def('backprop', T => {
  const S=[], add=F(S); const R=xorNet(), sn=R.snaps, D=R.D; const Ls=R.losses;
  const net=(g,s,o={})=>{ g.view(.02,.08,.6,.84,0,1,0,1); drawNet(g,[2,3,1],[s.W1,s.W2],{...o,labels:['input x','hidden (tanh)','output p̂']}); };
  const side=(g,s,k,hl)=>{ g.view(.66,.08,.32,.42,-.3,1.3,-.3,1.3); g.frame(); g.shade((x,y)=>netFwd(s,[x,y]).p,22,.45); D.forEach(([a,b,c],i)=>g.dot(a,b,i===hl?7:5,kc(g,c),{ring:i===hl?g.C.ink:null}));
    g.ptxt('XOR: network output',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.75}); g.view(.66,.6,.32,.3,0,Ls.length-1,0,Math.max(...Ls)*1.05); g.frame(); g.poly(Ls.slice(0,k+1).map((v,i)=>[i,v]),g.C.c4,2); g.ptxt('loss',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.75}); };
  const show=[0,3,8]; show.forEach((si,c)=>{ const s=sn[si], s2=sn[Math.min(sn.length-1,si+3)], ex=[1,2,3][c], [x1,x2,y]=D[ex], f=netFwd(s,[x1,x2]); const d2=f.p-y, d1=f.a1.map((a,i)=>d2*s.W2[0][i]*(1-a*a)); const slow=c===0;
    const act0=[[x1,x2]], act1=[[x1,x2],f.a1], act2=[[x1,x2],f.a1,[f.p*2-1]]; const TX={2:[f.p]};
    add(4,`Forward: feed input (${x1}, ${x2}) through. Each hidden neuron takes a weighted sum and bends it with tanh.`,slow?1600:900,(g,p)=>{ net(g,s,{act:p<.5?act0:act1,pulse:{l:p<.5?0:1,p:(p%.5)*2}}); side(g,s,si,ex); });
    add(5,`Output p̂ = ${T.f(f.p,3)} for target y = ${y}. Loss = ${T.f(-(y?Math.log(f.p):Math.log(1-f.p)),3)}.`,slow?1100:600,(g)=>{ net(g,s,{act:act2,txt:TX}); side(g,s,si,ex); });
    add(6,`Backward starts at the output: δ = p̂ − y = ${T.f(d2,3)}.`,slow?1000:600,(g)=>{ net(g,s,{act:act2,txt:TX,ring:[null,null,[d2]]}); side(g,s,si,ex); });
    add([7,8,9],'Send δ back through the same weights, scaled by tanh′. Each weight\'s gradient = δ at its output end × activity at its input end.',slow?1700:900,(g,p)=>{ net(g,s,{act:act2,txt:TX,ring:[null,p>.5?d1:null,[d2]],pulse:{l:p<.5?1:0,p:(p%.5)*2,back:true}}); side(g,s,si,ex); });
    add(10,'Update every weight a little against its gradient (shown sped up). Edge thickness = weight size; purple +, orange −.',slow?1400:900,(g,p)=>{ const m={W1:s.W1.map((r,i)=>r.map((v,j)=>T.lerp(v,s2.W1[i][j],p))),W2:[s.W2[0].map((v,i)=>T.lerp(v,s2.W2[0][i],p))],b1:s.b1.map((v,i)=>T.lerp(v,s2.b1[i],p)),b2:[T.lerp(s.b2[0],s2.b2[0],p)]};
      net(g,m,{act:act2}); side(g,m,si+3*p,ex); }); });
  add(11,'Repeat over and over: the hidden neurons become OR-like and NAND-like detectors, and the output solves XOR.',2600,(g,p)=>{ const k=Math.round(p*(sn.length-1)); net(g,sn[k]); side(g,sn[k],k); });
  return S;
});
AA.title(/training a network with backpropagation/i,'backprop');
/* ---- NN pages: vanishing gradients, Adam, normalisation, residual ---- */
const mv=(W,x)=>W.map(r=>r.reduce((s,w,j)=>s+w*x[j],0));
const mtv=(W,g)=>W[0].map((_,j)=>W.reduce((s,r,i)=>s+r[j]*g[i],0));
const nrm=v=>Math.sqrt(v.reduce((s,x)=>s+x*x,0));
const randM=(n,m,sd)=>T.range(n).map(()=>T.range(m).map(()=>T.g()*sd));

AA.def('vanish', T => {
  const S=[], add=F(S), L=8, n=12;
  const run=(kind)=>{ const sd=kind==='sig'?Math.sqrt(1/n):Math.sqrt(2/n), Ws=T.range(L).map(()=>randM(n,n,sd)); const phi=kind==='sig'?T.sig:(z=>Math.max(0,z)), dphi=kind==='sig'?(z=>{const s=T.sig(z);return s*(1-s);}):(z=>z>0?1:0);
    const norms=T.range(L).map(()=>0), acts=T.range(L+1).map(()=>T.range(4).map(()=>0)); const K=6;
    for(let k=0;k<K;k++){ const a=[T.range(n).map(()=>T.g())], z=[null]; for(let l=1;l<=L;l++){ z[l]=mv(Ws[l-1],a[l-1]); a[l]=z[l].map(phi); }
      for(let l=0;l<=L;l++) for(let i=0;i<4;i++) acts[l][i]+=a[l][i]/K;
      let g=T.range(n).map(()=>T.g()); for(let l=L;l>=1;l--){ g=g.map((v,i)=>v*dphi(z[l][i])); norms[l-1]+=nrm(g)*nrm(a[l-1])/K; g=mtv(Ws[l-1],g); } }
    return {norms,acts}; };
  const A=run('sig'), B=run('relu'); const rows=[{k:'sigmoid',r:A,c:'c4'},{k:'ReLU',r:B,c:'c1'}];
  const lg=v=>Math.log10(Math.max(v,1e-12)); const ref=r=>r.norms[L-1];
  const draw=(g,o)=>{ const W=g.W,H=g.H, x0=.2*W, x1=.95*W, cx=l=>x0+(x1-x0)*l/L;
    rows.forEach((R,ri)=>{ const top=(.05+ri*.46)*H, bh=.37*H, col=g.C[R.c]; g.ptxt(R.k,.02*W,top+bh*.18,col,{bold:true,size:.9}); 
      const base=top+bh, barH=bh*.52;
      g.pseg(x0-6,base,x1+6,base,g.C.line,1);
      for(let l=0;l<=L;l++){ const x=cx(l); for(let i=0;i<4;i++){ const y=top+bh*.06+i*bh*.085; g.ctx.beginPath(); g.ctx.arc(x,y,Math.min(7,W*.012),0,7); g.ctx.fillStyle=g.C.card; g.ctx.fill();
          if(o.fw!=null && l<=o.fw){ g.ctx.save(); g.ctx.globalAlpha=Math.min(1,.25+Math.abs(R.r.acts[l][i])*.8); g.ctx.fillStyle=col; g.ctx.fill(); g.ctx.restore(); }
          g.ctx.lineWidth=1.2; g.ctx.strokeStyle=(o.top&&l===L)?g.C.c2:g.C.ink; g.ctx.stroke(); }
        if(l>0 && o.bw!=null && l>=o.bw){ const v=lg(R.r.norms[l-1]/ref(R.r)); const h=barH*T.clamp((v+6)/6.5,0.02,1)*(l===o.bw?o.grow:1);
          g.prect(x-W*.022,base-h,W*.044,h,col,null,{a:.85,r:2}); if(l===o.bw||l===1&&o.fin) g.ptxt('10'+sup(Math.round(v)),x,base-h-g.fs*.6,col,{align:'center',size:.7,mono:true,bold:true}); }
        g.ptxt(l?'L'+l:'x',x,base+g.fs*.65,g.C.muted,{align:'center',size:.65,mono:true}); }
      if(o.fw!=null && o.pulse!=null){ const px=x0+(x1-x0)*o.pulse; g.pdot(px,top+bh*.19,4,g.C.c5); }
      if(o.back!=null){ const px=cx(o.back); g.pdot(px,top+bh*.19,4.5,g.C.c2); }
    });
    g.ptxt('bars: gradient size at each layer (log scale, top layer = 1)',.5*W,.985*H,g.C.muted,{align:'center',size:.68}); };
  const sup=k=>String(k).split('').map(ch=>({'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'})[ch]).join('');
  add(1,'Two identical 8-layer networks: the top one uses sigmoid, the bottom one ReLU (each with its matching initial weight scale).',1300,g=>draw(g,{}));
  add(2,'Forward pass: a batch flows left to right, every layer storing its z and a.',1900,(g,p)=>draw(g,{fw:Math.floor(p*L+.001),pulse:p}));
  add(3,'At the top we get the error signal g = ∂L/∂a. Now walk it back down.',900,g=>draw(g,{fw:L,top:true}));
  const fmtx=v=>{ const x=Math.pow(10,v); return x>=.1?T.f(x,2):x.toExponential(0).replace('e-','×10⁻').replace(/⁻(\d)/,(m,d)=>'⁻'+'⁰¹²³⁴⁵⁶⁷⁸⁹'[d]); };
  for(let l=L;l>=1;l--){ const a=lg(A.norms[l-1]/ref(A)), b=lg(B.norms[l-1]/ref(B));
    add([5,6,7],`Layer ${l}: multiply by φ′, record the weight gradient, pass gᵀW down. Gradient size compared with the top layer: sigmoid ${fmtx(a)}, ReLU ${fmtx(b)}.`,l===L?1100:650,(g,p)=>draw(g,{fw:L,bw:l,grow:p,back:l-1+(1-p)})); }
  const fa=Math.pow(10,lg(A.norms[0]/ref(A))/(L-1)), fb=Math.pow(10,lg(B.norms[0]/ref(B))/(L-1));
  add(8,`Done. Sigmoid's signal shrank by about ×${T.f(fa,2)} per layer, so the first layers barely learn. ReLU keeps it near ×${T.f(fb,2)}.`,2600,g=>draw(g,{fw:L,bw:1,grow:1,fin:true}));
  return S;
});
AA.title(/measuring gradient flow through depth/i,'vanish');

AA.def('adam', T => {
  const S=[], add=F(S); const a=.5, b=20; const fx=(x,y)=>.5*(a*x*x+b*y*y), gr=(x,y)=>[a*x+T.g()*.15,b*y+T.g()*.6];
  const st=[T.u(-4.6,-3.8),(T.r()<.5?-1:1)*T.u(.9,1.3)];
  const N=45; const P={gd:[st],mo:[st],ad:[st]}; const info=[];
  let p=st, q=st, vel=[0,0], r=st, m=[0,0], v=[0,0]; const b1=.9,b2=.999,eta=.14;
  for(let t=1;t<=N;t++){ let g=gr(...p); p=[p[0]-.09*g[0],p[1]-.09*g[1]]; P.gd.push(p);
    g=gr(...q); vel=[.9*vel[0]+g[0],.9*vel[1]+g[1]]; q=[q[0]-.012*vel[0],q[1]-.012*vel[1]]; P.mo.push(q);
    g=gr(...r); m=m.map((x,i)=>b1*x+(1-b1)*g[i]); v=v.map((x,i)=>b2*x+(1-b2)*g[i]*g[i]); const mh=m.map(x=>x/(1-b1**t)), vh=v.map(x=>x/(1-b2**t)); const step=mh.map((x,i)=>eta*x/(Math.sqrt(vh[i])+1e-8));
    info.push({g,m:[...m],v:[...v],mh,vh,step,from:r}); r=[r[0]-step[0],r[1]-step[1]]; P.ad.push(r); }
  const cols={gd:'c4',mo:'c3',ad:'c1'}, names={gd:'gradient descent',mo:'momentum',ad:'Adam'};
  const scene=(g,k,o={})=>{ g.view(.02,.06,.62,.86,-5,1,-1.8,1.8); g.frame(); g.clip(true);
    [.2,1,3,6,10,15].forEach(c=>g.ell(0,0,1/a,0,1/b,Math.sqrt(2*c),g.C.line,1));
    g.dot(0,0,4,g.C.ink);
    Object.keys(P).forEach(key=>{ const kk=Math.floor(k), pts=P[key].slice(0,kk+1); const fr=k-kk; if(fr>0&&kk<N){ const A=P[key][kk],B=P[key][kk+1]; pts.push([T.lerp(A[0],B[0],fr),T.lerp(A[1],B[1],fr)]); }
      g.poly(pts,g.C[cols[key]],key==='ad'?2.6:1.8); const e=pts[pts.length-1]; g.dot(e[0],e[1],key==='ad'?5:4,g.C[cols[key]]); });
    if(o.arrow){ const [x,y,dx,dy,c]=o.arrow; g.arrow(x,y,x+dx,y+dy,c,2.2); }
    g.clip(false);
    let ly=g.vp().y+g.fs*.9; Object.keys(names).forEach(key=>{ g.ptxt('● '+names[key],g.vp().x+g.fs*.6,ly,g.C[cols[key]],{size:.75,bold:key==='ad'}); ly+=g.fs*1.15; });
    if(o.read){ const R=o.read, W=g.W, H=g.H, px=.68*W, cw=.14*W, ch=.075*H; g.ptxt('Adam, step t = '+o.t,px,.1*H,g.C.ink,{size:.82,bold:true});
      g.ptxt('x',px+cw*.5+.05*W,.17*H,g.C.muted,{align:'center',size:.75}); g.ptxt('y',px+cw*1.5+.05*W,.17*H,g.C.muted,{align:'center',size:.75});
      const rows=[['g',R.g],['m',R.m],['v',R.v],['m̂',R.mh],['v̂',R.vh],['step',R.step]];
      rows.forEach(([lab,val],i)=>{ const y=.21*H+i*ch; g.ptxt(lab,px,y+ch/2,g.C.muted,{size:.8,mono:true});
        val.forEach((x,j)=>{ const on=o.hl&&o.hl.includes(lab); g.prect(px+.05*W+j*cw+1,y+1,cw-2,ch-2,on?g.C.c2:g.C.soft,null,{r:3,a:on?.35:1}); g.ptxt(o.show&&o.show.includes(lab)?T.f(x,Math.abs(x)<.1?3:2):'·',px+.05*W+j*cw+cw/2,y+ch/2,g.C.ink,{align:'center',mono:true,size:.72}); }); });
      g.ptxt('loss '+T.f(fx(...P.ad[Math.min(N,Math.floor(o.t))]),3),px,.21*H+6.6*ch,g.C.c1,{size:.75,mono:true}); } };
  const zero={g:[0,0],m:[0,0],v:[0,0],mh:[0,0],vh:[0,0],step:[0,0]};
  add(1,'A long, narrow valley: steep across (y), almost flat along (x). The minimum is the black dot. All three optimisers start at the same point.',1500,g=>scene(g,0));
  add(2,'Adam starts with m = 0, v = 0 for every weight.',800,g=>scene(g,0,{read:zero,t:0,show:['m','v']}));
  const sh=['g','m','v','m̂','v̂','step'];
  for(let t=1;t<=3;t++){ const R=info[t-1], k=t-1, fr=R.from;
    add(4,`t = ${t}: backprop gives the gradient g = (${T.f(R.g[0],2)}, ${T.f(R.g[1],2)}). It points mostly across the valley.`,t===1?1100:700,g=>scene(g,k,{read:R,t,show:sh.slice(0,1),hl:['g'],arrow:[fr[0],fr[1],-R.g[0]*.08,-R.g[1]*.08,g.C.c4]}));
    add(5,'m: a smoothed direction (10% new gradient, 90% memory).',t===1?900:600,g=>scene(g,k,{read:R,t,show:sh.slice(0,2),hl:['m']}));
    add(6,'v: a smoothed squared size, one per weight. The y-gradient is huge, so v_y is huge.',t===1?900:600,g=>scene(g,k,{read:R,t,show:sh.slice(0,3),hl:['v']}));
    add(7,`Bias correction: divide by 1−β^t so early averages are not stuck near 0.`,t===1?900:550,g=>scene(g,k,{read:R,t,show:sh.slice(0,5),hl:['m̂','v̂']}));
    add(8,'Step = η·m̂/√v̂: about η in each direction, however steep. Everyone takes one step.',t===1?1100:700,(g,p)=>scene(g,k+p,{read:R,t,show:sh,hl:['step']})); }
  add([3,4,5,6,7,8],'Repeat for every mini-batch (sped up).',3600,(g,p)=>{ const k=3+p*(N-3), t=Math.max(1,Math.floor(k)); scene(g,k,{read:info[t-1],t,show:sh}); });
  add(9,`Gradient descent zig-zags across the valley and crawls along it. Momentum smooths the zig-zag. Adam rescales each direction and heads for the minimum.`,2800,g=>scene(g,N,{read:info[N-1],t:N,show:sh}));
  return S;
});
AA.title(/^\s*Algorithm: Adam\s*$/,'adam');

AA.def('norm', T => {
  const S=[], add=F(S); const B=6, D=5; const mu=T.range(D).map(()=>T.u(-3,6)), sd=T.range(D).map(j=>[.3,1,2.5,.6,4][j]*T.u(.7,1.3));
  const Z=T.range(B).map(()=>T.range(D).map(j=>mu[j]+T.g()*sd[j]));
  const st=a=>{ const m=T.mean(a), v=T.mean(a.map(x=>(x-m)**2)); return [m,Math.sqrt(v+1e-5)]; };
  const cs=T.range(D).map(j=>st(Z.map(r=>r[j]))), rs=Z.map(r=>st(r));
  const BN=Z.map(r=>r.map((x,j)=>(x-cs[j][0])/cs[j][1])), LN=Z.map((r,i)=>r.map(x=>(x-rs[i][0])/rs[i][1]));
  const draw=(g,o)=>{ const W=g.W,H=g.H, cw=Math.min(.075*W,.1*H*1.3), ch=.085*H, ox=.07*W, oy=.15*H, px=.53*W;
    const cell=(x,y,v,sc,on,show=true)=>{ const c=v>=0?g.C.c1:g.C.c4; g.prect(x+1,y+1,cw-2,ch-2,g.C.soft,null,{r:3}); if(show){ g.prect(x+1,y+1,cw-2,ch-2,c,null,{r:3,a:Math.min(.85,.12+Math.abs(v)/sc*.7)}); g.ptxt(T.f(v,1),x+cw/2,y+ch/2,g.C.ink,{align:'center',mono:true,size:.66}); }
      if(on) g.prect(x+1,y+1,cw-2,ch-2,null,g.C.c2,{r:3,lw:2}); };
    const amax=Math.max(...Z.flat().map(Math.abs));
    g.ptxt('Z (B=6 examples × D=5 features)',ox,oy-g.fs*1.4,g.C.muted,{size:.75,semi:true});
    Z.forEach((r,i)=>r.forEach((v,j)=>cell(ox+j*cw,oy+i*ch,v,amax,(o.col===j)||(o.row===i))));
    T.range(D).forEach(j=>g.ptxt('f'+(j+1),ox+j*cw+cw/2,oy-g.fs*.45,g.C.muted,{align:'center',size:.62,mono:true}));
    if(o.mode==='bn'){ T.range(D).forEach(j=>{ if(j<=o.statUpTo){ const y=oy+B*ch+3; g.ptxt('μ '+T.f(cs[j][0],1),ox+j*cw+cw/2,y+g.fs*.6,g.C.c2,{align:'center',size:.58,mono:true}); g.ptxt('σ '+T.f(cs[j][1],1),ox+j*cw+cw/2,y+g.fs*1.55,g.C.c2,{align:'center',size:.58,mono:true}); } }); }
    if(o.mode==='ln'){ Z.forEach((r,i)=>{ if(i<=o.statUpTo) g.ptxt('μ '+T.f(rs[i][0],1)+'  σ '+T.f(rs[i][1],1),ox+D*cw+4,oy+i*ch+ch/2,g.C.c2,{size:.56,mono:true}); }); }
    if(o.mode){ const M=o.mode==='bn'?BN:LN; g.ptxt((o.mode==='bn'?'BatchNorm':'LayerNorm')+' output Ẑ',px,oy-g.fs*1.4,o.mode==='bn'?g.C.c1:g.C.c3,{size:.75,bold:true});
      M.forEach((r,i)=>r.forEach((v,j)=>{ const done=o.mode==='bn'?j<o.done:i<o.done; cell(px+j*cw,oy+i*ch,v,2.2,false,done); }));
      const ar=(o.mode==='bn'?'↓ pool down each column':'→ pool along each row'); g.ptxt(ar,px,oy+B*ch+g.fs*1.1,g.C.muted,{size:.7});
      if(o.check){ const ok=o.mode==='bn'?'every column: mean 0, sd 1':'every row: mean 0, sd 1'; g.ptxt('✓ '+ok,px,oy+B*ch+g.fs*2.3,g.C.c5,{size:.72,bold:true}); } }
    if(o.run) g.ptxt('running μ̄ ← 0.9 μ̄ + 0.1 μ_batch (saved for test time)',ox,.95*H,g.C.muted,{size:.7}); };
  add(1,'Z holds one row per example and one column per feature. The features live on very different scales.',1500,g=>draw(g,{}));
  for(let j=0;j<D;j++){ add([2,3],`BatchNorm, feature ${j+1}: pool its 6 values down the column. μ = ${T.f(cs[j][0],2)}, σ = ${T.f(cs[j][1],2)}.`,j?650:1100,g=>draw(g,{mode:'bn',col:j,statUpTo:j,done:j}));
    add(4,`Subtract μ and divide by σ, so this column now has mean 0 and spread 1.`,j?450:800,(g,p)=>draw(g,{mode:'bn',col:j,statUpTo:j,done:j+(p>.3?1:0)})); }
  add(5,'Keep running averages of μ and σ: at test time BatchNorm uses those instead of the batch.',1300,g=>draw(g,{mode:'bn',statUpTo:D,done:D,run:true}));
  add(9,'Finally Y = γ⊙Ẑ + β. γ starts at 1 and β at 0, and the network learns better values.',1500,g=>draw(g,{mode:'bn',statUpTo:D,done:D,check:true}));
  for(let i=0;i<B;i++){ add([6,7],`LayerNorm, example ${i+1}: pool its 5 features along the row. μ = ${T.f(rs[i][0],2)}, σ = ${T.f(rs[i][1],2)}.`,i?550:1100,g=>draw(g,{mode:'ln',row:i,statUpTo:i,done:i}));
    add(8,'Standardise the row. No other example is involved.',i?400:700,(g,p)=>draw(g,{mode:'ln',row:i,statUpTo:i,done:i+(p>.3?1:0)})); }
  add(9,'Same last step, Y = γ⊙Ẑ + β. Each example is normalised on its own, so batch size does not matter.',2400,g=>draw(g,{mode:'ln',statUpTo:B,done:B,check:true}));
  return S;
});
AA.title(/BatchNorm and LayerNorm forward pass/i,'norm');

AA.def('resid', T => {
  const S=[], add=F(S); const L=8, n=10;
  const relu=z=>Math.max(0,z);
  const plainW=T.range(L).map(()=>randM(n,n,Math.sqrt(1/n))), F1=T.range(L).map(()=>randM(n,n,Math.sqrt(2/n))), F2=T.range(L).map(()=>randM(n,n,.35*Math.sqrt(1/n)));
  const K=5, gp=T.range(L+1).map(()=>0), grs=T.range(L+1).map(()=>0);
  for(let k=0;k<K;k++){ const x0=T.range(n).map(()=>T.g());
    let a=[x0], z=[null]; for(let l=1;l<=L;l++){ z[l]=mv(plainW[l-1],a[l-1]); a[l]=z[l].map(relu); }
    let g=T.range(n).map(()=>T.g()); gp[L]+=nrm(g)/K; for(let l=L;l>=1;l--){ g=g.map((v,i)=>z[l][i]>0?v:0); g=mtv(plainW[l-1],g); gp[l-1]+=nrm(g)/K; }
    const xs=[x0], hs=[null]; for(let l=1;l<=L;l++){ const h=mv(F1[l-1],xs[l-1]); hs[l]=h; const f=mv(F2[l-1],h.map(relu)); xs[l]=xs[l-1].map((v,i)=>v+f[i]); }
    g=T.range(n).map(()=>T.g()); grs[L]+=nrm(g)/K; for(let l=L;l>=1;l--){ let gh=mtv(F2[l-1],g); gh=gh.map((v,i)=>hs[l][i]>0?v:0); const gF=mtv(F1[l-1],gh); g=g.map((v,i)=>v+gF[i]); grs[l-1]+=nrm(g)/K; } }
  const relP=gp.map(v=>v/gp[L]), relR=grs.map(v=>v/grs[L]);
  const draw=(g,o)=>{ const W=g.W,H=g.H, bw=.2*W, bh=.062*H, y=l=>.86*H-(l-1)*.093*H, cols=[{x:.08*W,res:false,rel:relP,c:g.C.c4,name:'plain stack'},{x:.56*W,res:true,rel:relR,c:g.C.c1,name:'residual stack'}];
    cols.forEach(C=>{ g.ptxt(C.name,C.x+bw/2,.04*H,C.c,{align:'center',bold:true,size:.85}); g.ptxt('x₀',C.x+bw/2,.965*H,g.C.muted,{align:'center',size:.7,mono:true});
      for(let l=1;l<=L;l++){ const yy=y(l), lit=o.fw!=null&&o.fw>=l, act=o.back===l;
        g.pseg(C.x+bw/2,yy+bh/2,C.x+bw/2,yy+bh/2+.031*H,g.C.line,1.5);
        g.prect(C.x,yy-bh/2,bw,bh,lit?C.c:g.C.soft,act?g.C.c2:g.C.line,{r:5,a:lit?.35:1,lw:act?2.5:1});
        g.ptxt(C.res?'F'+l:'layer '+l,C.x+bw/2,yy,g.C.ink,{align:'center',size:.68,mono:true});
        if(C.res){ const sx=C.x-.035*W; g.ctx.save(); g.ctx.strokeStyle=act?g.C.c2:C.c; g.ctx.globalAlpha=act?1:.55; g.ctx.lineWidth=act?2.6:1.6; g.ctx.beginPath(); g.ctx.moveTo(C.x+bw/2,yy+bh/2+.03*H); g.ctx.quadraticCurveTo(sx,yy+bh*.2,C.x+bw/2-bw*.3,yy-bh/2-.008*H); g.ctx.stroke(); g.ctx.restore();
          g.ptxt('+',C.x+bw/2-bw*.36,yy-bh/2-.012*H,C.c,{align:'center',size:.8,bold:true}); }
        }
      if(o.bw!=null){ for(let l=L;l>=o.bw;l--){ const v=C.rel[l], gx=C.x+bw+.02*W, yb=l===L?y(L)-bh*.95:(y(l+1)+y(l))/2, len=T.clamp(v,0,1.6)*.13*W*(l===o.bw?o.grow:1);
          g.prect(gx,yb-bh*.2,Math.max(1,len),bh*.4,C.c,null,{r:2,a:.85}); if(l===o.bw) g.ptxt(T.f(v,2),gx+len+4,yb,C.c,{size:.62,mono:true,bold:true}); } }
      if(o.pulse!=null){ const yy=T.lerp(.93*H,y(L)-bh,o.pulse); g.pdot(C.x+bw/2,yy,4.5,o.dir<0?g.C.c2:g.C.c5); } });
    if(o.bw!=null) g.ptxt('bars: gradient size ‖g‖ between blocks (top = 1)',.5*W,.995*H-g.fs*.2,g.C.muted,{align:'center',size:.62}); };
  add(1,'Two 8-block networks. Left: plain layers. Right: each block F adds its output to a copy of its input (the curved skip).',1500,g=>draw(g,{}));
  add(2,'Forward: x_l = x_{l−1} + F_l(x_{l−1}). The input travels up untouched along the skip, and each block adds a correction.',2000,(g,p)=>draw(g,{fw:Math.floor(p*L+.001),pulse:p}));
  add(3,'Loss at the top, and its gradient g starts back down. Bars show ‖g‖ relative to the top.',900,g=>draw(g,{fw:L,bw:L,grow:1}));
  for(let l=L;l>=1;l--){ add([5,6],`Block ${l}: backprop through F, then add the skip's copy: g ← g + g_F. Plain stack keeps ${Math.round(relP[l-1]*100)}%, residual ${Math.round(relR[l-1]*100)}%.`,l===L?1100:650,(g,p)=>draw(g,{fw:L,back:l,bw:l-1,grow:p,pulse:1-(L-l+p)/L,dir:-1})); }
  add(7,`At the bottom the plain stack's gradient is ${T.f(relP[0],2)}× its top value; the residual one's is ${T.f(relR[0],2)}×. The identity path never shrinks the signal.`,2800,g=>draw(g,{fw:L,bw:0,grow:1}));
  return S;
});
AA.title(/forward and backward through residual blocks/i,'resid');
/* ================= NLP ANIMATIONS ================= */
const softmax=a=>{ const m=Math.max(...a), e=a.map(x=>Math.exp(x-m)), s=T.sum(e); return e.map(x=>x/s); };
const pick=a=>a[Math.floor(Math.random()*a.length)];
/* token chip in px; returns width */
const chip=(g,s,x,y,o={})=>{ g.ctx.save(); g.ctx.font=g.font({mono:true,size:o.size||.78}); const w=Math.max(o.minw||0,g.ctx.measureText(s).width+g.fs*.8); g.ctx.restore(); const h=o.h||g.fs*1.7;
  g.prect(x,y-h/2,w,h,o.fill||g.C.soft,o.stroke||null,{r:5,a:o.a,lw:o.lw||2}); if(o.tint) g.prect(x,y-h/2,w,h,o.tint,null,{r:5,a:o.ta==null?.3:o.ta});
  g.ptxt(s,x+w/2,y,o.col||g.C.ink,{align:'center',mono:true,size:o.size||.78,bold:o.bold,a:o.ta2}); return w; };
const chipW=(g,s,o={})=>{ g.ctx.save(); g.ctx.font=g.font({mono:true,size:o.size||.78}); const w=Math.max(o.minw||0,g.ctx.measureText(s).width+g.fs*.8); g.ctx.restore(); return w; };
/* row of chips centred on cx; returns centres */
const chipRow=(g,toks,cx,y,of=()=>({}),gap=6)=>{ const ws=toks.map((s,i)=>chipW(g,s,of(i))); const tot=T.sum(ws)+gap*(toks.length-1); let x=cx-tot/2; const cs=[];
  toks.forEach((s,i)=>{ chip(g,s,x,y,of(i)); cs.push(x+ws[i]/2); x+=ws[i]+gap; }); return cs; };
/* heatmap of values in [0,1] */
const heat=(g,M,px,py,cw,ch,col,o={})=>{ M.forEach((r,i)=>r.forEach((v,j)=>{ const hid=o.hide&&o.hide(i,j); g.prect(px+j*cw+1,py+i*ch+1,cw-2,ch-2,o.masked&&o.masked(i,j)?g.C.line:g.C.soft,null,{r:2});
  if(!hid && v!=null && !(o.masked&&o.masked(i,j))){ g.prect(px+j*cw+1,py+i*ch+1,cw-2,ch-2,col,null,{r:2,a:Math.min(.95,.08+v*.9)}); if(o.num) g.ptxt(T.f(v,o.dp==null?2:o.dp),px+j*cw+cw/2,py+i*ch+ch/2,g.C.ink,{align:'center',mono:true,size:o.size||.6}); }
  if(o.hl&&o.hl(i,j)) g.prect(px+j*cw+1,py+i*ch+1,cw-2,ch-2,null,g.C.c2,{r:2,lw:2}); })); };
/* small vector of squares (values ~[-1,1]) */
const vecSq=(g,v,x,y,s,o={})=>{ v.forEach((a,k)=>{ const xx=o.vert?x:x+k*s, yy=o.vert?y+k*s:y; g.prect(xx+1,yy+1,s-2,s-2,g.C.soft,null,{r:2});
  const c=o.gate?g.C.c3:(a>=0?g.C.c1:g.C.c4); g.prect(xx+1,yy+1,s-2,s-2,c,null,{r:2,a:Math.min(.95,o.gate?a:Math.abs(a)*.9+.05)}); }); if(o.label) g.ptxt(o.label,o.vert?x+s/2:x+v.length*s/2,(o.vert?y:y)-g.fs*.6,o.lc||g.C.muted,{align:'center',size:.68,mono:true,bold:o.bold}); };
const arcC=(g,x1,y1,x2,y2,h,col,w,a)=>{ g.ctx.save(); g.ctx.globalAlpha*=a==null?1:a; g.ctx.strokeStyle=col; g.ctx.lineWidth=w; g.ctx.beginPath(); g.ctx.moveTo(x1,y1); g.ctx.quadraticCurveTo((x1+x2)/2,Math.min(y1,y2)-h,x2,y2); g.ctx.stroke(); g.ctx.restore(); };

/* ---------- BPE ---------- */
AA.def('bpe', T => {
  const S=[], add=F(S); const C=pick([[['low',5],['lower',2],['newest',6],['widest',3]],[['hug',10],['pug',5],['pun',12],['bun',4],['hugs',5]],[['play',6],['played',3],['playing',4],['saying',3]],[['tall',4],['taller',3],['tallest',2],['smallest',5]]]);
  const test={low:'lowest',hug:'bugs',play:'saying',tall:'smaller'}[C[0][0]]||'lowest';
  let words=C.map(([w,c])=>({s:[...w,'_'],c})); const steps=[];
  for(let m=0;m<6;m++){ const cnt=new Map(); words.forEach(W=>{ for(let k=0;k<W.s.length-1;k++){ const key=W.s[k]+'\u0001'+W.s[k+1]; cnt.set(key,(cnt.get(key)||0)+W.c); } });
    const top=[...cnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5); if(!top.length) break; const [a,b]=top[0][0].split('\u0001');
    const before=words.map(W=>({s:[...W.s],c:W.c}));
    words=words.map(W=>{ const o=[]; for(let k=0;k<W.s.length;k++){ if(k<W.s.length-1&&W.s[k]===a&&W.s[k+1]===b){ o.push(a+b); k++; } else o.push(W.s[k]); } return {s:o,c:W.c}; });
    steps.push({before,after:words.map(W=>({s:[...W.s],c:W.c})),top,a,b}); }
  const tok=w=>{ let s=[...w,'_']; steps.forEach(st=>{ const o=[]; for(let k=0;k<s.length;k++){ if(k<s.length-1&&s[k]===st.a&&s[k+1]===st.b){ o.push(st.a+st.b); k++; } else o.push(s[k]); } s=o; }); return s; };
  const draw=(g,o)=>{ const W=g.W,H=g.H; const ws=o.words; const rh=Math.min(.13*H,(.66*H)/ws.length);
    g.ptxt('corpus (word × count)',.03*W,.07*H,g.C.muted,{size:.72,semi:true});
    ws.forEach((wd,i)=>{ const y=.16*H+i*rh; g.ptxt('×'+wd.c,.03*W,y,g.C.muted,{size:.72,mono:true});
      if(o.whole){ chip(g,wd.s.join('').replace(/_$/,''),.1*W,y,{}); return; }
      let x=.1*W; wd.s.forEach((s,k)=>{ const isP=o.pair&&k<wd.s.length-1&&s===o.pair[0]&&wd.s[k+1]===o.pair[1]; const isP2=o.pair&&k>0&&wd.s[k-1]===o.pair[0]&&s===o.pair[1];
        const w=chip(g,s,x,y,{stroke:(isP||isP2)?g.C.c2:null,tint:s.length>1?g.C.c1:null,ta:Math.min(.45,.1*s.length),size:.72}); x+=w+3; }); });
    const rx=.63*W; if(o.top){ g.ptxt('most frequent pairs',rx,.07*H,g.C.muted,{size:.72,semi:true}); const mx=o.top[0][1];
      o.top.forEach(([k,c],i)=>{ const [a,b]=k.split('\u0001'), y=.14*H+i*.075*H; g.ptxt(a+' + '+b,rx,y,g.C.ink,{size:.7,mono:true}); const bw=.17*W*c/mx*(o.grow==null?1:o.grow); g.prect(rx+.14*W,y-.022*H,bw,.044*H,i===0&&o.best?g.C.c2:g.C.c1,null,{r:2,a:.7}); g.ptxt(String(c),rx+.14*W+bw+4,y,g.C.muted,{size:.65,mono:true}); }); }
    g.ptxt('merge rules',rx,.56*H,g.C.muted,{size:.72,semi:true}); (o.merges||[]).forEach((st,i)=>g.ptxt((i+1)+'. '+st.a+' + '+st.b+' → '+st.a+st.b,rx,.62*H+i*.055*H,i===o.merges.length-1&&o.newm?g.C.c2:g.C.ink,{size:.66,mono:true,bold:i===o.merges.length-1&&o.newm}));
    if(o.test){ const s=tok(test); g.ptxt('new word "'+test+'" →',.03*W,.9*H,g.C.ink,{size:.75,semi:true}); let x=.03*W+g.fs*(test.length*.55+5.5); s.forEach(t=>{ x+=chip(g,t,x,.9*H,{tint:t.length>1?g.C.c1:null,ta:.3,size:.72})+3; }); } };
  add(1,'Start with a small corpus: each word and how often it appears.',1300,g=>draw(g,{words:steps[0].before,whole:true}));
  add(2,'Split every word into characters, with _ marking the end of the word. The vocabulary is just these characters.',1300,g=>draw(g,{words:steps[0].before}));
  steps.forEach((st,m)=>{ const fast=m>1, M=steps.slice(0,m+1);
    add(3,`Vocabulary still too small: merge ${m+1}.`,fast?300:600,g=>draw(g,{words:st.before,merges:steps.slice(0,m)}));
    add(4,`Count every neighbouring pair, weighted by the word counts.`,fast?600:1100,(g,p)=>draw(g,{words:st.before,top:st.top,grow:p,merges:steps.slice(0,m)}));
    add(5,`The winner is "${st.a}" + "${st.b}" (${st.top[0][1]} times).`,fast?450:900,g=>draw(g,{words:st.before,top:st.top,best:true,pair:[st.a,st.b],merges:steps.slice(0,m)}));
    add(6,`Glue every "${st.a} ${st.b}" into one symbol "${st.a+st.b}".`,fast?500:900,(g,p)=>draw(g,{words:p<.5?st.before:st.after,top:st.top,best:true,pair:p<.5?[st.a,st.b]:null,merges:steps.slice(0,m)}));
    add(7,`Add "${st.a+st.b}" to the vocabulary and record the rule.`,fast?400:800,g=>draw(g,{words:st.after,top:st.top,merges:M,newm:true})); });
  add(8,`Done. To tokenise new text, replay the merge rules in order: "${test}" becomes ${tok(test).length} tokens.`,2600,g=>draw(g,{words:steps[steps.length-1].after,merges:steps,test:true}));
  return S;
});
AA.title(/byte-pair encoding \(training\)/i,'bpe');

/* ---------- word2vec SGNS ---------- */
AA.def('sgns', T => {
  const S=[], add=F(S); const topics=pick([[['cat','dog','kitten','puppy','pet'],['car','bus','truck','road','drive']],[['apple','banana','mango','juice','sweet'],['goal','match','team','score','kick']],[['rain','cloud','storm','wind','cold'],['code','bug','python','compile','debug']]]);
  const vocab=[...topics[0],...topics[1]], tp=w=>topics[0].includes(w)?0:1, idx=w=>vocab.indexOf(w);
  const sent=()=>{ const t=T.ri(2); return T.range(6).map(()=>pick(topics[t])); };
  let v=vocab.map(()=>[T.g()*.5,T.g()*.5]), u=vocab.map(()=>[T.g()*.5,T.g()*.5]); const lr=.08, c=2, k=2;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
  const sentences=T.range(70).map(sent); const snaps=[{v:v.map(x=>[...x]),s:0,t:0}], det=[];
  sentences.forEach((s,si)=>s.forEach((w,t)=>{ for(let o=Math.max(0,t-c);o<=Math.min(s.length-1,t+c);o++){ if(o===t) continue; const wi=idx(w), oi=idx(s[o]); let negs=T.range(k).map(()=>T.ri(vocab.length)).filter(n=>n!==oi&&n!==wi); if(!negs.length) negs=[(oi+1)%vocab.length];
      const vw=[...v[wi]]; const sp=T.sig(dot(u[oi],vw)); let L=-Math.log(sp); const gv=[-(1-sp)*u[oi][0],-(1-sp)*u[oi][1]]; const gu=[-(1-sp)*vw[0],-(1-sp)*vw[1]];
      negs.forEach(n=>{ const sn=T.sig(dot(u[n],vw)); L-=Math.log(1-sn); gv[0]+=sn*u[n][0]; gv[1]+=sn*u[n][1]; u[n]=[u[n][0]-lr*sn*vw[0],u[n][1]-lr*sn*vw[1]]; });
      u[oi]=[u[oi][0]-lr*gu[0],u[oi][1]-lr*gu[1]]; v[wi]=[v[wi][0]-lr*gv[0],v[wi][1]-lr*gv[1]];
      if(det.length<2 && si===0 && (det.length===0||t===2)) det.push({s,t,o,wi,oi,negs,L,from:vw,to:[...v[wi]],uo:[...u[oi]]}); }
    if(t===s.length-1 && si%4===3) snaps.push({v:v.map(x=>[...x]),s:si,t}); }));
  const R=Math.max(1.2,...snaps[snaps.length-1].v.map(p=>Math.max(Math.abs(p[0]),Math.abs(p[1]))))*1.15;
  const draw=(g,o)=>{ const W=g.W,H=g.H; const s=o.s; if(s){ chipRow(g,s,.5*W,.08*H,i=>({stroke:i===o.t?g.C.c2:(o.ctx&&Math.abs(i-o.t)<=c&&i!==o.t?g.C.c5:null),tint:i===o.o?g.C.c5:null,ta:.35,size:.72})); }
    g.view(.03,.17,.58,.8,-R,R,-R,R); g.frame(); g.axes();
    const V=o.v; vocab.forEach((w,i)=>{ const p=V[i]; g.dot(p[0],p[1],5,tp(w)?g.C.c4:g.C.c1); g.txt(w,p[0],p[1]+R*.07,tp(w)?g.C.c4:g.C.c1,{align:'center',size:.66,bold:o.d&&i===o.d.wi}); });
    if(o.d){ const d=o.d; g.dot(d.uo[0],d.uo[1],6,g.C.c5,{hollow:true}); g.txt('u('+vocab[d.oi]+')',d.uo[0],d.uo[1]-R*.08,g.C.c5,{align:'center',size:.6});
      if(o.neg) d.negs.forEach(n=>g.txt('✕ '+vocab[n],R*.95,R*(.9-.1*d.negs.indexOf(n)),g.C.c4,{align:'right',size:.65}));
      if(o.mv!=null){ const p=[T.lerp(d.from[0],d.to[0],o.mv),T.lerp(d.from[1],d.to[1],o.mv)]; g.arrow(d.from[0],d.from[1],d.from[0]+(d.to[0]-d.from[0])*4,d.from[1]+(d.to[1]-d.from[1])*4,g.C.c5,2); g.dot(p[0],p[1],6,g.C.c2); } }
    const rx=.65*W; g.ptxt('word vectors v (2-D here)',rx,.24*H,g.C.muted,{size:.7,semi:true}); g.ptxt('● '+topics[0][0]+', '+topics[0][1]+', …',rx,.31*H,g.C.c1,{size:.68}); g.ptxt('● '+topics[1][0]+', '+topics[1][1]+', …',rx,.37*H,g.C.c4,{size:.68});
    if(o.L!=null) g.ptxt('loss '+T.f(o.L,3),rx,.47*H,g.C.ink,{size:.75,mono:true,bold:true}); if(o.prog!=null) g.ptxt('sentences read: '+o.prog,rx,.47*H,g.C.ink,{size:.72,mono:true}); };
  const v0=snaps[0].v; const d0=det[0], d1=det[1]||det[0];
  add(1,'Text where some words share contexts. Each sentence talks about one topic.',1300,g=>draw(g,{s:d0.s,v:v0}));
  add(2,'Every word starts with random vectors, so the points are scattered with no pattern.',1100,g=>draw(g,{s:d0.s,v:v0}));
  [d0,d1].forEach((d,n)=>{ const f=n>0; const vb=v0.map((p,i)=>i===d.wi?d.from:p);
    add(3,`Centre word: "${vocab[d.wi]}".`,f?500:900,g=>draw(g,{s:d.s,t:d.t,v:vb}));
    add(4,`Context word within ${c} positions: "${vocab[d.oi]}". This is a real pair.`,f?500:900,g=>draw(g,{s:d.s,t:d.t,o:d.o,ctx:true,v:vb,d}));
    add(5,`Draw ${d.negs.length} random words as fake pairs: ${d.negs.map(n=>'"'+vocab[n]+'"').join(', ')}.`,f?500:900,g=>draw(g,{s:d.s,t:d.t,o:d.o,v:vb,d,neg:true}));
    add(6,`Loss: is the real pair scored high and the fake ones low? Here L = ${T.f(d.L,3)}.`,f?500:900,g=>draw(g,{s:d.s,t:d.t,o:d.o,v:vb,d,neg:true,L:d.L}));
    add(7,`One SGD step: v("${vocab[d.wi]}") moves toward u("${vocab[d.oi]}") and away from the fakes (arrow exaggerated ×4).`,f?700:1200,(g,p)=>draw(g,{s:d.s,t:d.t,o:d.o,v:vb,d,neg:true,mv:p})); });
  add([3,4,5,6,7],'Slide the window over the whole text, repeating the step millions of times (here 70 sentences, sped up).',4200,(g,p)=>{ const k=Math.min(snaps.length-1,Math.floor(p*(snaps.length-1))); const sn=snaps[k]; draw(g,{s:sentences[sn.s],v:sn.v,prog:sn.s+1}); });
  add(8,`The vectors are the embeddings. Words used in the same contexts ended up close together: two clusters, one per topic.`,2800,g=>draw(g,{v:snaps[snaps.length-1].v,prog:70}));
  return S;
});
AA.title(/skip-gram with negative sampling/i,'sgns');

/* ---------- RNN + BPTT ---------- */
AA.def('rnn', T => {
  const S=[], add=F(S); const word=pick(['hello','sweet','paper','river','lemon']); const xs=[...word.slice(0,-1)], ys=[...word.slice(1)]; const n=xs.length, H_=6;
  const chars=[...new Set(word)]; const V=chars.length; const oh=ch=>chars.map(c=>c===ch?1:0);
  const Wxh=randM(H_,V,.8), Whh=randM(H_,H_,.9/Math.sqrt(H_)), Why=randM(V,H_,.8);
  const h=[T.range(H_).map(()=>0)], P=[], Ls=[];
  for(let t=1;t<=n;t++){ const z=mv(Wxh,oh(xs[t-1])).map((a,i)=>a+mv(Whh,h[t-1])[i]); h[t]=z.map(Math.tanh); const p=softmax(mv(Why,h[t])); P[t]=p; Ls[t]=-Math.log(p[chars.indexOf(ys[t-1])]); }
  const gn=[]; let gh=T.range(H_).map(()=>0); for(let t=n;t>=1;t--){ const dy=P[t].map((p,i)=>p-(chars[i]===ys[t-1]?1:0)); gh=gh.map((a,i)=>a+mtv(Why,dy)[i]); const d=gh.map((a,i)=>a*(1-h[t][i]**2)); gn[t]=nrm(d); gh=mtv(Whh,d); }
  let gl=mtv(Why,P[n].map((p,i)=>p-(chars[i]===ys[n-1]?1:0))); const last=[]; for(let t=n;t>=1;t--){ const d=gl.map((a,i)=>a*(1-h[t][i]**2)); last[t]=nrm(d); gl=mtv(Whh,d); }
  const gmax=Math.max(...gn.slice(1));
  const draw=(g,o)=>{ const W=g.W,H=g.H, x=t=>.12*W+(t-.5)*(.82*W/n), cy=.5*H, bw=.09*W, bh=.12*H;
    for(let t=1;t<=n;t++){ const X=x(t), on=o.cur===t; g.prect(X-bw/2,cy-bh/2,bw,bh,on?g.C.c1:g.C.soft,on?g.C.c2:g.C.line,{r:6,a:on?.3:1,lw:on?2.5:1}); g.ptxt('tanh',X,cy-bh*.2,g.C.muted,{align:'center',size:.6,mono:true});
      if(o.fw>=t) vecSq(g,h[t].slice(0,4),X-bw*.4,cy+bh*.02,bw*.2);
      chip(g,xs[t-1],X-chipW(g,xs[t-1])/2,.86*H,{stroke:on?g.C.c2:null}); g.parrow(X,.86*H-g.fs*.9,X,cy+bh/2+2,g.C.line,1.5);
      if(o.out>=t){ const p=P[t][chars.indexOf(ys[t-1])]; g.parrow(X,cy-bh/2-2,X,.27*H,g.C.line,1.5); g.ptxt('next: '+ys[t-1],X,.22*H,g.C.ink,{align:'center',size:.66,mono:true}); g.ptxt('p='+T.f(p,2),X,.16*H,p>.4?g.C.c5:g.C.c4,{align:'center',size:.62,mono:true}); }
      if(t<n||true){ const X0=t===1?.05*W:x(t-1)+bw/2; g.parrow(X0,cy,X-bw/2-2,cy,o.bk!=null&&o.bk===t?g.C.c2:g.C.ink,1.8); }
      if(o.bk!=null && t>=o.bk){ const v=gn[t]/gmax, bh2=.1*H*v; g.prect(X-bw*.25,.7*H-bh2,bw*.22,bh2,g.C.c2,null,{a:.8,r:2}); const v2=last[t]/gmax, bh3=.1*H*v2; g.prect(X+bw*.03,.7*H-bh3,bw*.22,bh3,g.C.c4,null,{a:.8,r:2}); } }
    g.ptxt('h₀',.035*W,cy,g.C.muted,{size:.7,mono:true});
    if(o.pulse!=null){ g.pdot(T.lerp(.05*W,x(n)+bw/2,o.pulse),cy,5,o.back?g.C.c2:g.C.c5); }
    if(o.loss) g.ptxt('total loss '+T.f(T.sum(Ls.slice(1)),2),.97*W,.07*H,g.C.ink,{align:'right',size:.72,mono:true,bold:true});
    if(o.bk!=null){ g.prect(.03*W,.955*H-g.fs*.4,g.fs*.8,g.fs*.8,g.C.c2,null,{a:.8}); g.ptxt('‖δₜ‖ total',.03*W+g.fs,.955*H,g.C.muted,{size:.62}); g.prect(.3*W,.955*H-g.fs*.4,g.fs*.8,g.fs*.8,g.C.c4,null,{a:.8}); g.ptxt('only the last step’s error',.3*W+g.fs,.955*H,g.C.muted,{size:.62}); } };
  add(1,`Teach the network to spell "${word}": at each step, read one letter and predict the next. Its weights are still random, so the first guesses are poor.`,1400,g=>draw(g,{}));
  add(2,'The hidden state starts at zero: no memory yet.',700,g=>draw(g,{}));
  for(let t=1;t<=n;t++){ add([3,4],`t = ${t}: mix "${xs[t-1]}" with the previous memory h${t-1}, same weights as every other step.`,t===1?1000:550,(g,p)=>draw(g,{fw:t-(p<.6?1:0),out:t-1,cur:t,pulse:(t-1+p)/n}));
    add(5,`Predict the next letter. p("${ys[t-1]}") = ${T.f(P[t][chars.indexOf(ys[t-1])],2)}, loss += ${T.f(Ls[t],2)}.`,t===1?900:450,g=>draw(g,{fw:t,out:t,cur:t})); }
  add(6,'Forward done. Now carry the error back, right to left.',800,g=>draw(g,{fw:n,out:n,loss:true}));
  for(let t=n;t>=1;t--){ add([7,8],`t = ${t}: add this step's own output error to what arrived from the future.`,t===n?900:450,(g,p)=>draw(g,{fw:n,out:n,loss:true,cur:t,bk:t+1,pulse:(t-.5*p)/n,back:true}));
    add([9,10],`Collect the weight gradients for step ${t} and pass the error one step back through W_hh.`,t===n?900:450,(g,p)=>draw(g,{fw:n,out:n,loss:true,cur:t,bk:t,pulse:(t-.5-.5*p)/n,back:true})); }
  add(11,`Sum the gradients over all steps and update. The orange bars show the last letter's error fading as it travels back: ×${T.f(Math.pow(last[1]/last[n],1/Math.max(1,n-1)),2)} per step.`,2800,g=>draw(g,{fw:n,out:n,loss:true,bk:1}));
  return S;
});
AA.title(/RNN forward pass and backpropagation through time/i,'rnn');

/* ---------- LSTM step ---------- */
AA.def('lstm', T => {
  const S=[], add=F(S); const d=4, nx=3, Tn=4; const W={}; ['f','i','c','o'].forEach(k=>W[k]=randM(d,d+nx,.9));
  const bf=T.range(d).map(()=>1); const xs=T.range(Tn).map(()=>T.range(nx).map(()=>T.g()));
  let h=T.range(d).map(()=>0), c=T.range(d).map(()=>0); const st=[];
  for(let t=0;t<Tn;t++){ const u=[...h,...xs[t]]; const f=mv(W.f,u).map((z,i)=>T.sig(z+bf[i])), ii=mv(W.i,u).map(T.sig), ct=mv(W.c,u).map(Math.tanh), o=mv(W.o,u).map(T.sig);
    const cn=c.map((v,k)=>f[k]*v+ii[k]*ct[k]), hn=cn.map((v,k)=>o[k]*Math.tanh(v)); st.push({u,h,c,f,i:ii,ct,o,cn,hn,x:xs[t]}); h=hn; c=cn; }
  const draw=(g,s,o,tt)=>{ const W=g.W,H=g.H, q=Math.min(.035*W,.055*H), cy=.17*H, gy=.5*H, uy=.78*H;
    const node=(x,y,sym,on)=>{ g.ctx.beginPath(); g.ctx.arc(x,y,q*.6,0,7); g.ctx.fillStyle=on?g.C.c2:g.C.card; g.ctx.fill(); g.ctx.strokeStyle=g.C.ink; g.ctx.lineWidth=1.5; g.ctx.stroke(); g.ptxt(sym,x,y,on?g.C.card:g.C.ink,{align:'center',size:.8,bold:true}); };
    const L=o.lv||0;
    g.pseg(.14*W,cy,.86*W,cy,L>=5?g.C.c5:g.C.ink,L===5?4:2.5); g.ptxt('cell state c (the conveyor belt)',.5*W,cy-q*1.4,g.C.muted,{align:'center',size:.66});
    vecSq(g,s.c,.02*W,cy-q/2,q,{label:'c_{t−1}'.replace('_{t−1}','ₜ₋₁')}); if(L>=5) vecSq(g,s.cn,.86*W,cy-q/2,q*.9,{label:'cₜ',bold:true,lc:g.C.c5});
    const fx=.3*W, ax=.48*W, ox=.76*W; node(fx,cy,'×',L===3); node(ax,cy,'+',L===5);
    const gates=[['f',.2*W,s.f,3,true],['i',.39*W,s.i,4,true],['c̃',.57*W,s.ct,4,false],['o',ox,s.o,6,true]]; const gq=q*.78;
    gates.forEach(([nm,x,v,lv,gt])=>{ const on=L>=lv; g.pseg(x,uy,x,gy+q*.9,g.C.line,1.2); g.prect(x-gq*2.3,gy-q*.9,gq*4.6,q*1.8,on?g.C.card:g.C.soft,L===lv?g.C.c2:g.C.line,{r:5,lw:L===lv?2.5:1});
      if(on) vecSq(g,v,x-gq*2,gy-gq/2,gq,{gate:gt}); else g.ptxt(nm,x,gy,g.C.muted,{align:'center',size:.8,mono:true});
      if(on) g.ptxt(nm+(gt?' = σ(·)':' = tanh(·)'),x,gy-q*1.5,L===lv?g.C.c2:g.C.muted,{align:'center',size:.6,mono:true}); });
    g.pseg(.2*W,gy-q*.9,fx,cy+q*.6,L>=3?g.C.c3:g.C.line,1.5); g.pseg(.39*W,gy-q*.9,ax,cy+q*.6,L>=4?g.C.c3:g.C.line,1.5); g.pseg(.57*W,gy-q*.9,ax,cy+q*.6,L>=4?g.C.c3:g.C.line,1.5);
    const hy=.35*H; node(ox,hy,'×',L===7); g.pseg(ox,gy-q*.9,ox,hy+q*.6,L>=6?g.C.c3:g.C.line,1.5); g.pseg(ox,cy,ox,hy-q*.6,L>=7?g.C.c5:g.C.line,1.5); g.ptxt('tanh',ox+q*.9,(cy+hy)/2,g.C.muted,{size:.58,mono:true});
    g.pseg(ox+q*.6,hy,.86*W,hy,L>=7?g.C.c1:g.C.line,1.5); if(L>=7) vecSq(g,s.hn,.86*W,hy-q/2,q*.9,{label:'hₜ',bold:true,lc:g.C.c1});
    vecSq(g,s.h,.12*W,uy-q/2,q*.8,{label:'hₜ₋₁'}); vecSq(g,s.x,.12*W+q*4,uy-q/2,q*.8,{label:'xₜ'}); if(L===2) g.prect(.12*W-3,uy-q*.7,q*7.2+6,q*1.4,null,g.C.c2,{r:4,lw:2});
    g.pseg(.12*W+q*7.4,uy,ox,uy,L>=2?g.C.ink:g.C.line,1.5);
    if(o.p!=null && L===5){ g.pdot(T.lerp(.14*W,.86*W,o.p),cy,5,g.C.c5); }
    T.range(Tn).forEach(k=>chip(g,'t='+(k+1),.12*W+k*.11*W,.94*H,{stroke:k===tt?g.C.c2:null,size:.62,tint:k<tt?g.C.c1:null,ta:.25})); };
  for(let t=0;t<Tn;t++){ const s=st[t], f=t>0, ms=f?380:900; const ff=T.mean(s.f);
    if(!f) add(1,'One LSTM step needs the new input xₜ, the previous output hₜ₋₁ and the previous cell state cₜ₋₁ (squares: purple +, orange −).',1500,g=>draw(g,s,{lv:0},t));
    add(2,`Step ${t+1}: stack hₜ₋₁ and xₜ into one vector u that every gate reads.`,ms,g=>draw(g,s,{lv:2},t));
    add(3,`Forget gate f (yellow = open). Average ${T.f(ff,2)}: keep most of each memory slot.`,ms,g=>draw(g,s,{lv:3},t));
    add(4,'Input gate i decides how much to write; c̃ is the candidate content.',ms,g=>draw(g,s,{lv:4},t));
    add(5,'cₜ = f⊙cₜ₋₁ + i⊙c̃: the old memory rides along the belt, only scaled and added to.',f?500:1100,(g,p)=>draw(g,s,{lv:5,p},t));
    add(6,'Output gate o decides which slots to reveal.',ms,g=>draw(g,s,{lv:6},t));
    add(7,'hₜ = o⊙tanh(cₜ): the output the next layer (and next step) sees.',ms,g=>draw(g,s,{lv:7},t));
    add(8,t<Tn-1?'Pass hₜ and cₜ on to the next step.':'Done for this sequence. Notice how slowly c changes from step to step compared with h: that is the long-term memory.',t<Tn-1?(f?300:700):2600,g=>draw(g,s,{lv:7},t)); }
  return S;
});
AA.title(/one LSTM step/i,'lstm');

/* ---------- scaled dot-product attention ---------- */
AA.def('attn', T => {
  const S=[], add=F(S); const m=4; const ang=T.shuffle([.3,1.5,2.6,4.2,5.3]).slice(0,m).map(a=>a+T.u(-.2,.2));
  const K=ang.map(a=>{ const r=T.u(1,1.6); return [r*Math.cos(a),r*Math.sin(a)]; }); const Vv=T.range(m).map(j=>[Math.cos(j*Math.PI/2+.6)*1.2,Math.sin(j*Math.PI/2+.6)*1.2]);
  const cols=['c1','c3','c4','c5']; const Q=T.range(3).map(i=>{ const a=ang[i]+T.u(-.4,.4), r=T.u(1.6,2.4); return [r*Math.cos(a),r*Math.sin(a)]; });
  const sc=Q.map(q=>K.map(k=>(q[0]*k[0]+q[1]*k[1])/Math.SQRT2)), A=sc.map(softmax), O=A.map(a=>[T.sum(a.map((w,j)=>w*Vv[j][0])),T.sum(a.map((w,j)=>w*Vv[j][1]))]);
  const draw=(g,o)=>{ const W=g.W,H=g.H, i=o.i;
    g.view(.02,.1,.36,.62,-2.6,2.6,-2.6,2.6); g.frame(); g.axes(); g.ptxt('keys k and query q',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.7});
    K.forEach((k,j)=>{ g.arrow(0,0,k[0],k[1],g.C[cols[j]],o.kj===j?3.5:2); g.txt('k'+(j+1),k[0]*1.18,k[1]*1.18,g.C[cols[j]],{align:'center',size:.65,bold:true}); });
    if(i!=null){ const q=Q[i]; g.arrow(0,0,q[0],q[1],g.C.ink,2.6); g.txt('q'+(i+1),q[0]*1.12,q[1]*1.12,g.C.ink,{align:'center',size:.7,bold:true}); }
    const bx=.43*W, bwid=.2*W; if(i!=null && o.nk!=null){ g.ptxt(o.soft==null?'score q·k/√d':'weight (softmax)',bx,.1*H,g.C.muted,{size:.7});
      const s=sc[i], a=A[i]; for(let j=0;j<m;j++){ if(j>=o.nk) break; const y=.17*H+j*.11*H; const val=o.soft==null?s[j]:T.lerp(s[j]/4+.0,a[j],o.soft); const w=Math.abs(val)*bwid*(o.soft==null?.25:1)/(o.soft==null?1:1);
        const wpx=o.soft==null?Math.min(bwid,Math.abs(s[j])/3*bwid):T.lerp(Math.min(bwid,Math.abs(s[j])/3*bwid),a[j]*bwid,o.soft);
        g.prect(bx+g.fs*1.6,y-.03*H,Math.max(1,wpx),.06*H,g.C[cols[j]],null,{r:2,a:(o.soft==null&&s[j]<0)?.35:.8}); g.ptxt('k'+(j+1),bx,y,g.C[cols[j]],{size:.65,bold:true});
        g.ptxt(o.soft==null||o.soft<.5?T.f(s[j],2):T.f(a[j],2),bx+g.fs*1.6+wpx+4,y,g.C.ink,{size:.62,mono:true}); } }
    g.view(.64,.1,.34,.62,-1.8,1.8,-1.8,1.8); g.frame(); g.axes(); g.ptxt('values v and output o',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.7});
    Vv.forEach((v,j)=>{ g.dot(v[0],v[1],6,g.C[cols[j]]); g.txt('v'+(j+1),v[0],v[1]+.28,g.C[cols[j]],{align:'center',size:.62,bold:true}); });
    if(i!=null && o.out!=null){ const a=A[i]; Vv.forEach((v,j)=>g.seg(O[i][0],O[i][1],v[0],v[1],g.C[cols[j]],1+a[j]*6,null,.35+a[j]*.6)); const p=[O[i][0]*o.out,O[i][1]*o.out]; g.dot(p[0],p[1],7,g.C.ink); g.txt('o'+(i+1),p[0]+.25,p[1]-.2,g.C.ink,{size:.68,bold:true}); }
    (o.done||[]).forEach(k=>{ g.dot(O[k][0],O[k][1],5,g.C.ink,{a:.5}); g.txt('o'+(k+1),O[k][0]+.22,O[k][1]-.2,g.C.muted,{size:.6}); });
    if(o.mat){ const px=.06*W, py=.8*H, cw=.075*W, ch=.05*H; g.ptxt('A = softmax(QKᵀ/√d)',px,py-g.fs*.7,g.C.muted,{size:.68}); heat(g,A,px,py,cw,ch,g.C.c1,{num:true,size:.55}); g.ptxt('× V  →  O, all queries at once',px+m*cw+g.fs,py+ch*1.5,g.C.ink,{size:.7}); } };
  add(1,'Four items, each with a key k (what it offers) and a value v (what it hands over).',1400,g=>draw(g,{}));
  for(let i=0;i<3;i++){ const f=i>0, done=T.range(i);
    add(2,`Query ${i+1} arrives: what am I looking for?`,f?500:900,g=>draw(g,{i,done}));
    for(let j=0;j<m;j++) add(3,`Score against key ${j+1}: q·k/√d = ${T.f(sc[i][j],2)}. Big when the arrows point the same way.`,f?260:650,g=>draw(g,{i,kj:j,nk:j+1,done}));
    add(4,'Softmax turns scores into weights: all positive and they add to 1. The best match dominates.',f?600:1100,(g,p)=>draw(g,{i,nk:m,soft:p,done}));
    add(5,`Output = weighted average of the values: o${i+1} is pulled toward v${A[i].indexOf(Math.max(...A[i]))+1}.`,f?700:1200,(g,p)=>draw(g,{i,nk:m,soft:1,out:p,done})); }
  add(6,'Every query does the same thing, so in matrix form it is one line: softmax(QKᵀ/√d)V.',2600,g=>draw(g,{done:[0,1,2],mat:true}));
  return S;
});
AA.title(/scaled dot-product attention/i,'attn');

/* ---------- causal multi-head self-attention ---------- */
AA.def('selfattn', T => {
  const S=[], add=F(S); const toks=pick([['the','cat','sat','on','it'],['she','gave','him','a','book'],['rain','fell','and','it','stopped'],['I','like','green','tea','now']]); const n=toks.length, d=4;
  const X=T.range(n).map(()=>T.range(d).map(()=>T.g()));
  const head=()=>{ const Wq=randM(d,d,.8),Wk=randM(d,d,.8); const Q=X.map(x=>mv(Wq,x)), K=X.map(x=>mv(Wk,x)); const Sc=Q.map(q=>K.map(k=>T.sum(q.map((a,i)=>a*k[i]))/2)); const A=Sc.map((r,i)=>softmax(r.map((v,j)=>j>i?-1e9:v))); return {Sc,A}; };
  const hd=[head(),head()]; const hc=['c1','c3'];
  const draw=(g,o)=>{ const W=g.W,H=g.H, h=o.h||0, Hd=hd[h], col=g.C[hc[h]];
    const cs=chipRow(g,toks,.3*W,.62*H,i=>({stroke:o.row===i?g.C.c2:null,size:.72}));
    if(o.qkv){ cs.forEach((x,i)=>{ ['q','k','v'].forEach((l,k)=>g.ptxt(l,x-g.fs*.9+k*g.fs*.9,.62*H+g.fs*1.6,[g.C.c2,g.C.c3,g.C.c5][k],{align:'center',size:.62,mono:true,bold:true})); }); }
    if(o.arcs!=null){ const rows=o.arcs; rows.forEach(i=>Hd.A[i].forEach((a,j)=>{ if(j<=i && a>.04){ if(i===j){ g.ctx.save(); g.ctx.globalAlpha=.3+a*.7; g.ctx.strokeStyle=col; g.ctx.lineWidth=1+a*6; g.ctx.beginPath(); g.ctx.arc(cs[i],.62*H-g.fs*1.4,g.fs*.55,0,7); g.ctx.stroke(); g.ctx.restore(); }
      else arcC(g,cs[i],.62*H-g.fs*.9,cs[j],.62*H-g.fs*.9,.12*H+Math.abs(i-j)*.05*H,col,1+a*7,.3+a*.7); } })); }
    const px=.6*W, py=.18*H, cw=Math.min(.075*W,.11*H), ch=cw*.85;
    g.ptxt('head '+(h+1)+(o.soft?': weights A':': scores S'),px,py-g.fs*1.9,col,{size:.72,bold:true}); toks.forEach((t,j)=>g.ptxt(t.slice(0,4),px+j*cw+cw/2,py-g.fs*.6,g.C.muted,{align:'center',size:.55,mono:true})); toks.forEach((t,i)=>g.ptxt(t.slice(0,4),px-4,py+i*ch+ch/2,g.C.muted,{align:'right',size:.55,mono:true}));
    if(o.sc!=null){ const M=o.soft?Hd.A:Hd.Sc.map(r=>r.map(v=>T.clamp((v+3)/6,0,1))); heat(g,M,px,py,cw,ch,col,{hide:(i,j)=>i>=o.sc,masked:o.mask?((i,j)=>j>i&&o.mask>(j-i)/n):null,num:o.soft,size:.5,hl:(i,j)=>o.row===i}); }
    if(o.cat){ g.ptxt('Y = [Z₁ Z₂] W_O',.5*W,.9*H,g.C.ink,{align:'center',size:.8,bold:true,mono:true}); cs.forEach((x,i)=>{ vecSq(g,[.6,-.3],x-g.fs,.78*H,g.fs*.9,{}); vecSq(g,[-.5,.8],x,.78*H,g.fs*.9,{}); g.prect(x-g.fs,.78*H,g.fs*.9,g.fs*.9,g.C.c1,null,{a:.5}); g.prect(x,.78*H,g.fs*.9,g.fs*.9,g.C.c3,null,{a:.5}); }); } };
  add(1,`A sentence of ${n} tokens, each already a vector.`,1200,g=>draw(g,{}));
  [0,1].forEach(h=>{ const f=h>0;
    add([2,3],`Head ${h+1}: every token makes its own query, key and value with this head's weights.`,f?600:1100,g=>draw(g,{h,qkv:true}));
    add(4,'Every token scores every token: an n × n table.',f?700:1300,(g,p)=>draw(g,{h,qkv:true,sc:Math.ceil(p*n)}));
    add(5,'Causal mask: a token may not look at tokens after it, so the upper triangle is blocked.',f?600:1100,(g,p)=>draw(g,{h,qkv:true,sc:n,mask:p+.01}));
    for(let i=0;i<n;i++) add(6,`Softmax each row, then mix values. "${toks[i]}" reads from ${i?'itself and the '+i+' token'+(i>1?'s':'')+' before it':'only itself'}.`,f?300:650,g=>draw(g,{h,sc:n,mask:1,soft:true,row:i,arcs:[i]}));
  });
  add(7,'Concatenate the two heads’ outputs and mix them with W_O. Each head was free to look for something different.',1300,g=>draw(g,{h:1,sc:n,mask:1,soft:true,arcs:T.range(n),cat:true}));
  add(8,'One new vector per token, same shape as the input, now carrying context from earlier tokens.',2400,g=>draw(g,{h:0,sc:n,mask:1,soft:true,arcs:T.range(n),cat:true}));
  return S;
});
AA.title(/causal multi-head self-attention/i,'selfattn');

/* ---------- cross-attention ---------- */
AA.def('xattn', T => {
  const S=[], add=F(S); const P=pick([[['the','black','cat'],['le','chat','noir'],[0,2,1]],[['I','love','green','tea'],["j'",'aime','le','thé','vert'],[0,1,3,3,2]],[['the','red','car'],['la','voiture','rouge'],[0,2,1]],[['a','big','house'],['une','grande','maison'],[0,1,2]]]);
  const [src,tgt,al]=P, m=src.length, n=tgt.length; const A=tgt.map((_,i)=>softmax(src.map((_,j)=>(j===al[i]?3.2:0)+T.g()*.5)));
  const draw=(g,o)=>{ const W=g.W,H=g.H; g.ptxt('source (encoder)',.03*W,.08*H,g.C.muted,{size:.68}); g.ptxt('target (decoder)',.03*W,.72*H,g.C.muted,{size:.68});
    const sx=chipRow(g,src,.36*W,.16*H,j=>({tint:o.enc?g.C.c3:null,ta:.3,stroke:o.kv?g.C.c3:null,size:.72}));
    const tx=chipRow(g,tgt.slice(0,o.nt||0).concat(o.nt<n?['…']:[]),.36*W,.8*H,i=>({tint:i<o.nt?g.C.c1:null,ta:.25,stroke:o.q===i?g.C.c2:null,size:.72}));
    if(o.enc) g.ptxt('K, V = E·W',.36*W,.16*H+g.fs*1.7,g.C.c3,{align:'center',size:.6,mono:true});
    if(o.q!=null){ const i=o.q; if(o.lines) A[i].forEach((a,j)=>g.pseg(tx[i],.8*H-g.fs*.9,sx[j],.16*H+g.fs*.9,g.C.c1,1+a*8*o.lines)); if(o.flow!=null){ const j=A[i].indexOf(Math.max(...A[i])); g.pdot(T.lerp(sx[j],tx[i],o.flow),T.lerp(.2*H,.77*H,o.flow),5,g.C.c5); } else if(o.qa) g.parrow(tx[i],.8*H-g.fs*1,tx[i],.6*H,g.C.c2,2.2); }
    const px=.72*W, py=.2*H, cw=Math.min(.065*W,.09*H), ch=cw*.8; g.ptxt('A (target × source)',px,py-g.fs*2,g.C.muted,{size:.66}); src.forEach((s,j)=>g.ptxt(s.slice(0,4),px+j*cw+cw/2,py-g.fs*.6,g.C.muted,{align:'center',size:.52,mono:true})); tgt.forEach((t,i)=>g.ptxt(t.slice(0,5),px-4,py+i*ch+ch/2,g.C.muted,{align:'right',size:.52,mono:true}));
    heat(g,A,px,py,cw,ch,g.C.c1,{hide:(i,j)=>i>=(o.rows||0),num:true,dp:1,size:.48,hl:(i,j)=>o.q===i}); };
  add(1,`Translate "${src.join(' ')}" → "${tgt.join(' ')}".`,1400,g=>draw(g,{nt:0}));
  add(2,'Encode the source once: each source word becomes a vector, ready to be consulted.',1000,g=>draw(g,{nt:0,enc:true}));
  for(let i=0;i<n;i++){ const f=i>0;
    add(3,`The decoder reads what it has written so far${i?': "'+tgt.slice(0,i).join(' ')+'"':''}.`,f?350:800,g=>draw(g,{nt:i,enc:true,rows:i}));
    add(4,`The position writing "${tgt[i]}" forms a query: what source information do I need?`,f?400:800,g=>draw(g,{nt:i+1,enc:true,q:i,qa:true,rows:i}));
    add(5,'Keys and values come from the encoded source.',f?300:700,g=>draw(g,{nt:i+1,enc:true,kv:true,q:i,qa:true,rows:i}));
    add(6,`Attention weights: "${tgt[i]}" looks mostly at "${src[A[i].indexOf(Math.max(...A[i]))]}".`,f?600:1000,(g,p)=>draw(g,{nt:i+1,enc:true,q:i,lines:p,rows:i+(p>.5?1:0)}));
    add(7,'Add the weighted mix of source values to the decoder state (residual).',f?450:800,(g,p)=>draw(g,{nt:i+1,enc:true,q:i,lines:1,flow:p,rows:i+1})); }
  add(8,'The matrix is an alignment: which source word was used to write each target word. Note the reordering.',2600,g=>draw(g,{nt:n,enc:true,rows:n}));
  return S;
});
AA.title(/cross-attention in an encoder.decoder/i,'xattn');

/* ---------- autoregressive generation ---------- */
AA.def('gen', T => {
  const S=[], add=F(S); const tb={the:{mat:2.2,sofa:1.9,floor:1.5,dog:.8,roof:.6},cat:{sat:2.4,slept:1.9,purred:1.5,ran:1.2},sat:{on:3,down:1.8,quietly:1.2},on:{the:3,a:2,my:1.3},a:{mat:2,rug:1.8,chair:1.2},my:{lap:2.3,bed:1.8,chair:1.4},slept:{on:2,'.':1.5,all:1},ran:{away:2,to:1.5,'.':1},purred:{'.':2,softly:1.5},down:{'.':2,on:1.5},quietly:{'.':2,on:1},dog:{barked:2,sat:1.5,'.':1}};
  const gen=(w)=>tb[w]||{'.':2.2,and:1,then:.7};
  const tau=.8; let toks=[pick(['the','a','my']),'cat']; const steps=[];
  while(steps.length<5){ const last=toks[toks.length-1], d=gen(last), ks=Object.keys(d), p=softmax(ks.map(k=>d[k]/tau)); let r=Math.random(), c=0; for(;c<ks.length-1;c++){ r-=p[c]; if(r<=0) break; }
    const att=softmax(toks.map((_,j)=>T.g()+(j===toks.length-1?1:0))); steps.push({toks:[...toks],ks,p,c,att}); toks.push(ks[c]); if(ks[c]==='.') break; }
  const draw=(g,s,o)=>{ const W=g.W,H=g.H; const tk=o.app?[...s.toks,s.ks[s.c]]:s.toks; const L=tk.length;
    const cs=chipRow(g,tk,.33*W,.88*H,i=>({tint:i>=2?g.C.c3:null,ta:.3,stroke:(o.app&&i===L-1)?g.C.c2:null,size:.7}));
    const lx=cs[s.toks.length-1], bw=.24*W, bh=.075*H;
    if(o.lv>=3) cs.slice(0,s.toks.length).forEach((x,i)=>vecSq(g,[.6,-.4,.3],x-g.fs*1.2,.78*H,g.fs*.8,{}));
    for(let l=0;l<3;l++){ const y=.62*H-l*.14*H, on=o.blk===l; g.prect(.33*W-bw/2,y-bh,bw,bh*.9,on&&o.part==='a'?g.C.c1:g.C.soft,on?g.C.c2:g.C.line,{r:5,a:on&&o.part==='a'?.3:1,lw:on?2:1}); g.ptxt('attention',.33*W,y-bh*.55,g.C.ink,{align:'center',size:.6});
      g.prect(.33*W-bw/2,y-bh*1.9+bh*.05,bw,bh*.8,on&&o.part==='m'?g.C.c5:g.C.soft,on?g.C.c2:g.C.line,{r:5,a:on&&o.part==='m'?.3:1,lw:on?2:1}); g.ptxt('MLP',.33*W,y-bh*1.5,g.C.ink,{align:'center',size:.6}); }
    g.ptxt('×3 blocks',.33*W-bw/2-4,.45*H,g.C.muted,{align:'right',size:.6});
    if(o.part==='a') s.att.forEach((a,j)=>{ if(j!==s.toks.length-1) arcC(g,lx,.88*H-g.fs*.9,cs[j],.88*H-g.fs*.9,.06*H+.03*H*(s.toks.length-1-j),g.C.c1,1+a*6,.3+a*.7); });
    if(o.lv>=7){ const rx=.68*W; g.ptxt(o.lv>=8?'p = softmax(z/τ), τ='+tau:'next-token logits z',rx,.1*H,g.C.muted,{size:.66}); const mx=Math.max(...s.p);
      s.ks.forEach((k,j)=>{ const y=.17*H+j*.075*H; const v=o.lv>=8?s.p[j]:s.p[j]; const w=.13*W*v/mx; g.ptxt(k,rx,y,g.C.ink,{size:.66,mono:true}); g.prect(rx+.08*W,y-.025*H,w,.05*H,o.lv>=8&&j===s.c?g.C.c2:g.C.c3,null,{r:2,a:.75}); if(o.lv>=8) g.ptxt(T.f(s.p[j],2),rx+.08*W+w+4,y,g.C.muted,{size:.6,mono:true}); }); }
    if(o.cache) g.ptxt('KV cache: earlier tokens are not recomputed',.03*W,.06*H,g.C.muted,{size:.62}); };
  steps.forEach((s,k)=>{ const f=k>0, c=f;
    if(!f) add(1,`Prompt: "${s.toks.join(' ')}". The model will write one token at a time.`,1200,g=>draw(g,s,{lv:0}));
    add([2,3],f?'Next round: embed the newest token.':'Embed each token and add its position.',f?350:900,g=>draw(g,s,{lv:3,cache:c}));
    for(let l=0;l<3;l++){ add(5,l?`Block ${l+1}: attention again.`:'Attention: the newest position looks back at all earlier tokens.',f?220:(l?380:900),g=>draw(g,s,{lv:3,blk:l,part:'a',cache:c})); add(6,'MLP: each position is processed on its own.',f?180:(l?300:600),g=>draw(g,s,{lv:3,blk:l,part:'m',cache:c})); }
    add(7,'Project the last position onto the vocabulary: one score per possible next token.',f?400:900,g=>draw(g,s,{lv:7,cache:c}));
    add(8,`Softmax with temperature, then sample: "${s.ks[s.c]}" (p = ${T.f(s.p[s.c],2)}).`,f?500:1000,g=>draw(g,s,{lv:8,cache:c}));
    add(9,'Append it. The output becomes part of the next input.',f?450:800,g=>draw(g,s,{lv:8,app:true,cache:c})); });
  const s=steps[steps.length-1]; add(10,`Generated: "${[...s.toks,s.ks[s.c]].join(' ')}". Run it again and the sample may differ.`,2600,g=>draw(g,s,{lv:0,app:true}));
  return S;
});
AA.title(/generating text with a decoder-only transformer/i,'gen');

/* ---------- RAG ---------- */
AA.def('rag', T => {
  const S=[], add=F(S); const sets=[
    {q:'When did the Eiffel Tower open?',a:'It opened in 1889, for the World’s Fair [1].',rel:['Eiffel Tower opened in 1889','Built for the 1889 World’s Fair','The tower is 330 m tall'],oth:['Louvre: largest art museum','Paris metro has 16 lines','The Seine flows through Paris','Croissants: a 19th-c. fashion']},
    {q:'How tall is Mount Everest?',a:'About 8,849 m above sea level [1].',rel:['Everest: 8,849 m (2020 survey)','Highest peak above sea level','First summited in 1953'],oth:['K2 is in the Karakoram','Yaks live at high altitude','Nepal’s capital is Kathmandu','Monsoon season: June–Sept']},
    {q:'What does a mitochondrion do?',a:'It makes most of the cell’s ATP, its energy supply [1].',rel:['Mitochondria produce ATP','Called the cell’s powerhouse','Has its own small DNA'],oth:['Ribosomes build proteins','Chlorophyll is green','DNA is a double helix','Neurons send signals']} ];
  const D=pick(sets); const qa=T.u(0,2*Math.PI); const chunks=T.shuffle([...D.rel.map((t,i)=>({t,a:qa+[.15,-.3,.55][i]*(T.r()<.5?-1:1),rel:1})),...D.oth.map((t,i)=>({t,a:qa+Math.PI*(.45+.3*i)+T.u(-.15,.15),rel:0}))]);
  chunks.forEach(c=>{ c.r=T.u(.85,1); c.p=[c.r*Math.cos(c.a),c.r*Math.sin(c.a)]; c.s=c.r*Math.cos(c.a-qa); }); const top=[...chunks].sort((a,b)=>b.s-a.s).slice(0,3);
  const draw=(g,o)=>{ const W=g.W,H=g.H; const L=o.lv;
    g.ptxt('document chunks',.03*W,.06*H,g.C.muted,{size:.66,semi:true}); chunks.forEach((c,i)=>{ const y=.12*H+i*.062*H, ti=top.indexOf(c), on=L>=5&&ti>=0; g.prect(.03*W,y-.026*H,.34*W,.052*H,g.C.soft,on?g.C.c2:null,{r:4,lw:2}); g.ptxt(c.t,.03*W+5,y,g.C.ink,{size:.56}); if(L>=4 && (o.sc==null||i<o.sc)) g.ptxt(T.f(c.s,2),.38*W,y,c.s>.6?g.C.c5:g.C.muted,{size:.56,mono:true}); });
    g.view(.45,.08,.26,.42,-1.25,1.25,-1.25,1.25); g.frame(); if(L>=1){ g.ptxt('embedding space',g.vp().x,g.vp().y-g.fs*.6,g.C.muted,{size:.6});
      chunks.forEach((c,i)=>{ const p=o.fly!=null?Math.min(1,Math.max(0,o.fly*chunks.length-i)):1; if(p<=0) return; const on=L>=5&&top.includes(c); g.dot(c.p[0]*p,c.p[1]*p,on?6:4,on?g.C.c2:g.C.c1,{a:.4+.6*p}); }); }
    if(L>=3){ const e=[Math.cos(qa),Math.sin(qa)]; g.arrow(0,0,e[0]*(o.qg==null?1:o.qg),e[1]*(o.qg==null?1:o.qg),g.C.c4,2.5); g.txt('e_q',e[0]*1.15,e[1]*1.15,g.C.c4,{align:'center',size:.62,bold:true});
      if(L===4) chunks.slice(0,o.sc||chunks.length).forEach(c=>g.seg(0,0,c.p[0],c.p[1],g.C.c1,1,[3,3],.6)); }
    if(L>=2) { g.prect(.45*W,.57*H-g.fs*1.1,.52*W,g.fs*2.2,g.C.soft,g.C.c4,{r:5,lw:1.5}); g.ptxt('Q: '+D.q,.45*W+6,.57*H,g.C.ink,{size:.62,bold:true}); }
    const y0=.645*H, bh=g.fs*4.9; if(L>=6){ g.prect(.45*W,y0,.52*W,bh,g.C.card,g.C.line,{r:5}); g.ptxt('prompt: answer from the sources',.45*W+6,y0+g.fs*.8,g.C.muted,{size:.55});
      top.forEach((c,i)=>{ const p=o.pp==null?1:T.clamp(o.pp*3-i,0,1); if(p>0) g.ptxt('['+(i+1)+'] '+c.t,.45*W+6,y0+g.fs*(1.85+i*.95),g.C.ink,{size:.54,a:p}); }); }
    if(L>=7){ const s=D.a, k=Math.round((o.type==null?1:o.type)*s.length); g.prect(.45*W,y0+bh+4,.52*W,g.fs*2,g.C.c5,null,{r:5,a:.15}); g.ptxt('LLM: '+s.slice(0,k)+(k<s.length?'▌':''),.45*W+6,y0+bh+4+g.fs,g.C.ink,{size:.6,bold:true}); }
    if(L>=8) g.ptxt('sources: '+top.map((c,i)=>'['+(i+1)+']').join(' '),.97*W,.06*H,g.C.c5,{align:'right',size:.62,bold:true}); };
  add(1,'Offline, once: cut the documents into chunks and embed each one as a vector (a point in space).',1800,(g,p)=>draw(g,{lv:1,fly:p}));
  add(2,'A question arrives.',800,g=>draw(g,{lv:2}));
  add(3,'Embed the question with the query encoder, into the same space.',900,(g,p)=>draw(g,{lv:3,qg:p}));
  add(4,'Score every chunk by its dot product with the question vector.',1500,(g,p)=>draw(g,{lv:4,sc:Math.ceil(p*chunks.length)}));
  add(5,'Keep the top 3. Chunks about the same topic as the question point the same way.',1100,g=>draw(g,{lv:5}));
  add(6,'Build the prompt: instructions, the retrieved chunks, then the question.',1300,(g,p)=>draw(g,{lv:6,pp:p}));
  add(7,'The language model writes the answer from the retrieved text.',1800,(g,p)=>draw(g,{lv:7,type:p}));
  add(8,'Return the answer with its sources, so it can be checked.',2400,g=>draw(g,{lv:8}));
  return S;
});
AA.title(/^\s*Algorithm: retrieval-augmented generation/i,'rag');
/* ================= MULTIMODAL ANIMATIONS (pages load dl/assets/vis.js) ================= */
const sceneKey=()=>pick(['park','kitchen','street']);
const imgOf=(k,n)=>window.VIS?VIS.canvas(k,n):null;
const drawScene=(g,k,x,y,s,a)=>{ const c=imgOf(k,192); if(!c){ g.prect(x,y,s,s,g.C.soft); return; } g.ctx.save(); if(a!=null) g.ctx.globalAlpha*=a; g.ctx.imageSmoothingEnabled=false; g.ctx.drawImage(c,x,y,s,s); g.ctx.restore(); };
const drawPatchTile=(g,k,P,r,c,x,y,s,a)=>{ const im=imgOf(k,192); if(!im) return; g.ctx.save(); if(a!=null) g.ctx.globalAlpha*=a; g.ctx.imageSmoothingEnabled=false; g.ctx.drawImage(im,c*P,r*P,P,P,x,y,s,s); g.ctx.restore(); };
const patchFeat=(k,P)=>window.VIS?VIS.patches(k,192,P):[];

/* ---------- ViT patch tokenisation ---------- */
AA.def('patchify', T => {
  const S=[], add=F(S); const k=sceneKey(), P=48, g4=192/P, Np=g4*g4; const ps=patchFeat(k,P), E=ps.map(p=>window.VIS?VIS.embed(p).slice(0,6):T.range(6).map(()=>T.g()*.3)), POS=T.range(Np).map(i=>window.VIS?VIS.pos2d(Math.floor(i/g4),i%g4,g4,8).slice(0,6):T.range(6).map(()=>0));
  const draw=(g,o)=>{ const W=g.W,H=g.H, s=Math.min(.42*W,.62*H), ix=.03*W, iy=.1*H, cs=s/g4;
    drawScene(g,k,ix,iy,s,o.dim?.35:1); g.ptxt('image '+192+' × 192, P = '+P,ix,iy-g.fs*.7,g.C.muted,{size:.66});
    if(o.grid){ g.ctx.save(); g.ctx.strokeStyle='rgba(255,255,255,.9)'; g.ctx.lineWidth=1.5; g.ctx.beginPath(); for(let q=1;q<g4;q++){ g.ctx.moveTo(ix+q*cs,iy); g.ctx.lineTo(ix+q*cs,iy+s); g.ctx.moveTo(ix,iy+q*cs); g.ctx.lineTo(ix+s,iy+q*cs); } g.ctx.stroke(); g.ctx.restore(); }
    /* sequence row */
    const n=Np+1, tw=Math.min((.94*W)/n,.06*H*1.6), sx=.03*W, sy=.84*H;
    for(let i=0;i<(o.seq||0)+(o.cls?1:0);i++){ const isC=o.cls&&i===0, j=o.cls?i-1:i, x=sx+i*tw*1.05;
      if(isC){ g.prect(x,sy,tw,tw,g.C.c3,null,{r:3}); g.ptxt('CLS',x+tw/2,sy+tw/2,g.C.card,{align:'center',size:.5,bold:true}); continue; }
      const r=Math.floor(j/g4), c=j%g4; if(o.tok&&j<o.tok){ vecSq(g,E[j].map((v,q)=>v+POS[j][q]),x,sy,tw/6,{vert:false}); g.prect(x,sy+tw/6+2,tw,tw*.5,g.C.c1,null,{r:2,a:.25}); } else drawPatchTile(g,k,P,r,c,x,sy,tw);
      if(o.cur===j) g.prect(x-1,sy-1,tw+2,tw+2,null,g.C.c2,{lw:2.5}); }
    if(o.seq) g.ptxt(o.tok?'tokens to the transformer':'patches in raster order',sx,sy-g.fs*.7,g.C.muted,{size:.66});
    if(o.cur!=null){ const j=o.cur, r=Math.floor(j/g4), c=j%g4; g.prect(ix+c*cs,iy+r*cs,cs,cs,null,g.C.c2,{lw:3});
      const bx=.5*W, by=.12*H; drawPatchTile(g,k,P,r,c,bx,by,.09*W); g.ptxt('patch '+(j+1),bx+.045*W,by-g.fs*.6,g.C.ink,{align:'center',size:.66,bold:true});
      if(o.st>=1){ const px=window.VIS?VIS.pixels(k,192):null, L=24, w=(.44*W)/L; for(let q=0;q<L;q++){ const yy=r*P+Math.floor(q/4)*8+4, xx=c*P+(q%4)*12+6; let col=g.C.soft; if(px){ const i=(yy*192+xx)*3; col='rgb('+[0,1,2].map(t=>Math.round(px[i+t]*255)).join(',')+')'; } g.prect(bx+q*w,.33*H,w-1,.05*H,col); }
        g.ptxt('x_p: '+(P*P*3)+' numbers (24 shown)',bx,.31*H-g.fs*.4,g.C.muted,{size:.6,mono:true}); }
      if(o.st>=2){ g.ptxt('E x_p',bx,.47*H,g.C.c1,{size:.66,mono:true,bold:true}); vecSq(g,E[j],bx+.1*W,.45*H,.035*W); }
      if(o.st>=3){ g.ptxt('+ pos',bx,.56*H,g.C.c3,{size:.66,mono:true,bold:true}); vecSq(g,POS[j],bx+.1*W,.54*H,.035*W);
        g.ptxt('= token',bx,.65*H,g.C.ink,{size:.66,mono:true,bold:true}); vecSq(g,E[j].map((v,q)=>v+POS[j][q]),bx+.1*W,.63*H,.035*W); } }
    if(o.tf){ g.prect(.55*W,.22*H,.38*W,.4*H,g.C.c1,g.C.c1,{r:8,a:.15}); g.ptxt('transformer × L',.74*W,.42*H,g.C.ink,{align:'center',size:.85,bold:true}); g.parrow(.74*W,.8*H,.74*W,.64*H,g.C.c1,2.5); } };
  add(1,`An image, a patch size P = ${P} and a learned projection E.`,1300,g=>draw(g,{}));
  add(2,`Cut it into ${g4} × ${g4} = ${Np} patches and read them row by row.`,1600,(g,p)=>draw(g,{grid:true,seq:Math.round(p*Np)}));
  for(let j=0;j<Np;j++){ const f=j>1, cap=j===0;
    if(j<2){ add(3,`Patch ${j+1}.`,cap?600:350,g=>draw(g,{grid:true,seq:Np,tok:j,cur:j,st:0}));
      add(4,'Flatten its pixels into one long vector.',cap?900:450,g=>draw(g,{grid:true,seq:Np,tok:j,cur:j,st:1}));
      add(5,'Multiply by the shared matrix E: the patch embedding.',cap?900:450,g=>draw(g,{grid:true,seq:Np,tok:j,cur:j,st:2}));
      add(6,'Add the position embedding for this grid cell.',cap?900:450,g=>draw(g,{grid:true,seq:Np,tok:j+1,cur:j,st:3})); }
    else add([3,4,5,6],`Patch ${j+1}: same steps, same E (sped up).`,170,g=>draw(g,{grid:true,seq:Np,tok:j+1,cur:j,st:3})); }
  add(7,'Put the learned [CLS] token at the front.',1000,g=>draw(g,{grid:true,seq:Np,tok:Np,cls:true}));
  add(8,`${Np+1} tokens go into an ordinary transformer, exactly like words.`,2400,g=>draw(g,{grid:true,seq:Np,tok:Np,cls:true,tf:true}));
  return S;
});
AA.title(/ViT patch tokenisation/i,'patchify');

/* ---------- vector quantisation ---------- */
AA.def('vq', T => {
  const S=[], add=F(S); const k=sceneKey(), P=24, gN=192/P, ps=patchFeat(k,P); const X=ps.map(p=>p.mean); const K=4;
  const xy=m=>[m[0]-m[2], m[1]-(m[0]+m[2])/2];
  let C=T.shuffle(T.range(X.length)).slice(0,K).map(i=>[...X[i]]); const hist=[];
  for(let it=0;it<4;it++){ const A=X.map(x=>{ let b=0,bd=1e9; C.forEach((c,q)=>{ const d=x.reduce((s,v,t)=>s+(v-c[t])**2,0); if(d<bd){bd=d;b=q;} }); return b; });
    const Cn=C.map((c,q)=>{ const m=X.filter((_,i)=>A[i]===q); return m.length?c.map((_,t)=>m.reduce((s,x)=>s+x[t],0)/m.length):c; }); hist.push({C:C.map(c=>[...c]),A,Cn}); C=Cn; }
  const fin=hist[hist.length-1]; const hex=m=>'rgb('+m.map(v=>Math.round(T.clamp(v,0,1)*255)).join(',')+')';
  const draw=(g,o)=>{ const W=g.W,H=g.H, s=Math.min(.36*W,.6*H), ix=.03*W, iy=.12*H, cs=s/gN;
    drawScene(g,k,ix,iy,s); g.ptxt('image → '+(gN*gN)+' patches',ix,iy-g.fs*.7,g.C.muted,{size:.66});
    if(o.paint) o.paint.forEach((col,i)=>g.prect(ix+(i%gN)*cs,iy+Math.floor(i/gN)*cs,cs+.5,cs+.5,col));
    if(o.ids) o.ids.forEach((id,i)=>g.ptxt(String(id),ix+(i%gN)*cs+cs/2,iy+Math.floor(i/gN)*cs+cs/2,'rgba(0,0,0,.6)',{align:'center',size:.62,mono:true,bold:true}));
    g.view(.45,.12,.52,.6,-.7,.7,-.5,.6); g.frame(); g.ptxt('patch colours (2-D view)',g.vp().x,g.vp().y-g.fs*.7,g.C.muted,{size:.66});
    const h=o.h; X.forEach((x,i)=>{ const p=xy(x); if(h&&o.lines){ const c=xy(h.C[h.A[i]]); g.seg(p[0],p[1],c[0],c[1],g.C.line,1); } g.dot(p[0],p[1],3.5,hex(x)); });
    if(h){ const Cs=o.upd?h.C.map((c,q)=>c.map((v,t)=>T.lerp(v,h.Cn[q][t],o.upd))):h.C; Cs.forEach((c,q)=>{ const p=xy(c); g.dot(p[0],p[1],9,hex(c),{ring:g.C.ink,lw:2.5}); g.txt(String(q),p[0],p[1]+.09,g.C.ink,{align:'center',size:.7,bold:true}); }); }
    if(o.book){ const bx=.45*W, by=.82*H; g.ptxt('codebook',bx,by-g.fs*.9,g.C.muted,{size:.66}); fin.Cn.forEach((c,q)=>{ g.prect(bx+q*.07*W,by,.06*W,.07*H,hex(c),null,{r:4}); g.ptxt(String(q),bx+q*.07*W+.03*W,by+.035*H,g.C.ink,{align:'center',size:.7,bold:true,mono:true}); }); } };
  add(1,`${gN*gN} patch vectors (here, each patch's average colour) and a codebook of K = ${K}.`,1400,g=>draw(g,{}));
  add(2,`Start from ${K} random patches as the codes.`,1000,g=>draw(g,{h:{...hist[0],A:hist[0].A}}));
  hist.forEach((h,it)=>{ const f=it>0;
    add(4,`Round ${it+1}: every patch joins its nearest code.`,f?700:1300,g=>draw(g,{h,lines:true}));
    add(5,'Each code moves to the mean of its patches.',f?600:1100,(g,p)=>draw(g,{h,lines:true,upd:p})); });
  add(6,'The assignments have stopped changing: the codebook is learned.',900,g=>draw(g,{h:{...fin,C:fin.Cn},book:true}));
  add(7,`Tokenise: replace each patch by its code id. The image is now ${gN*gN} integers.`,1500,g=>draw(g,{h:{...fin,C:fin.Cn},book:true,ids:fin.A}));
  add(8,'Decode: paint each patch with its code. Detail is lost, the layout survives.',2600,(g,p)=>draw(g,{h:{...fin,C:fin.Cn},book:true,paint:fin.A.map(a=>hex(fin.Cn[a])),ids:p<.4?fin.A:null}));
  return S;
});
AA.title(/vector-quantising image patches/i,'vq');

/* ---------- VisualBERT pre-training step ---------- */
AA.def('vbert', T => {
  const S=[], add=F(S); if(!window.VIS) return S; const keys=['park','kitchen','street'], k=pick(keys), truth=T.r()<.5, capK=truth?k:pick(keys.filter(x=>x!==k));
  const SC=VIS.SCENES[k], W=VIS.SCENES[capK].caption.split(' '); const FUNC=new Set(['a','the','with','under','on','next','to','behind','waits','sits','plays']);
  const COLW=new Set(['red','blue','yellow','green']); const nouns=W.map((w,i)=>i).filter(i=>!FUNC.has(W[i])&&!COLW.has(W[i])&&i>1); const mi=pick(nouns), mw=W[mi];
  const objs=SC.objects, present=new Set(objs.flatMap(o=>o.tags.concat([o.label])));
  const hitObj=objs.findIndex(o=>o.label===mw||o.tags.includes(mw)); const okWords=W.filter(w=>!FUNC.has(w)), hits=okWords.filter(w=>present.has(w)).length, pm=T.sig(6*hits/okWords.length-2.5);
  const cands=[mw,...pick([['ball','car','cup'],['apple','bus','tree'],['dog','cat','table']]).filter(x=>x!==mw)].slice(0,3); const pTxt=[.36,.34,.3], pImg=present.has(mw)?[.82,.1,.08]:[.4,.32,.28];
  const draw=(g,o)=>{ const Wd=g.W,H=g.H, s=Math.min(.3*Wd,.42*H), ix=.02*Wd, iy=.06*H; drawScene(g,k,ix,iy,s);
    objs.forEach((ob,j)=>{ const b=ob.box; const on=o.att&&j===hitObj; g.prect(ix+b[0]*s,iy+b[1]*s,b[2]*s,b[3]*s,null,on?g.C.c2:g.C.c4,{lw:on?3:1.5}); });
    const toks=['CLS',...W.map((w,i)=>o.mask&&i===mi?'[MASK]':w),'SEP',...objs.map((ob,j)=>'r'+(j+1))];
    let ty=.62*H; let x=.02*Wd; const cx=[], cyy=[]; toks.forEach((t,i)=>{ const isR=i>=W.length+2; const w=chipW(g,t,{size:.6}); if(x+w>.98*Wd){ x=.02*Wd; ty+=g.fs*2.1; } const vis=o.lv>=(isR?3:2)||i<1;
      chip(g,t,x,ty,{size:.6,tint:isR?g.C.c4:(i===mi+1&&o.mask?g.C.c2:g.C.c1),ta:vis?.3:.06,ta2:vis?1:.35,stroke:(o.att&&(i===mi+1||(hitObj>=0&&i===W.length+2+hitObj)))?g.C.c2:null}); cx.push(x+w/2); cyy.push(ty); x+=w+3; }); const ty0=.62*H;
    if(o.lv>=2) g.ptxt('segment A (text)',.02*Wd,ty+g.fs*1.5,g.C.c1,{size:.58}); if(o.lv>=3) g.ptxt('segment B (image regions)',.98*Wd,ty+g.fs*1.5,g.C.c4,{size:.58,align:'right'});
    g.ptxt('caption: "'+VIS.SCENES[capK].caption+'"',.36*Wd,.08*H,g.C.ink,{size:.68,bold:true}); g.ptxt(truth?'(the true caption)':'(a caption from another image)',.36*Wd,.08*H+g.fs*1.2,truth?g.C.c5:g.C.c4,{size:.62});
    if(o.lv>=5){ g.prect(.36*Wd,.22*H,.3*Wd,.22*H,g.C.c1,g.C.c1,{r:8,a:.12}); g.ptxt('BERT: all tokens',.51*Wd,.3*H,g.C.ink,{align:'center',size:.72,bold:true}); g.ptxt('attend to all',.51*Wd,.3*H+g.fs*1.1,g.C.ink,{align:'center',size:.72,bold:true});
      if(o.att&&cx[mi+1]!=null){ g.ctx.save(); g.ctx.strokeStyle=g.C.c2; g.ctx.lineWidth=2.5; g.ctx.beginPath(); const a=mi+1, b2=hitObj>=0?W.length+2+hitObj:0, x1=cx[a], x2=cx[b2], y1=cyy[a]-g.fs, y2=cyy[b2]-g.fs; g.ctx.moveTo(x1,y1); g.ctx.quadraticCurveTo((x1+x2)/2,Math.min(y1,y2)-.18*H,x2,y2); g.ctx.stroke(); g.ctx.restore(); } }
    if(o.lv>=6){ const bx=.7*Wd; g.ptxt('predict [MASK]',bx,.2*H,g.C.muted,{size:.62}); cands.forEach((c,q)=>{ const y=.26*H+q*.065*H, p=T.lerp(pTxt[q],pImg[q],o.img||0); g.ptxt(c,bx,y,g.C.ink,{size:.6,mono:true}); g.prect(bx+.08*Wd,y-.02*H,.17*Wd*p,.04*H,q===0?g.C.c5:g.C.c3,null,{r:2,a:.8}); g.ptxt(Math.round(p*100)+'%',bx+.08*Wd+.17*Wd*p+3,y,g.C.muted,{size:.55,mono:true}); }); }
    if(o.lv>=7){ const bx=.7*Wd, y=.5*H; g.ptxt('[CLS] → caption matches?',bx,y-g.fs*.9,g.C.muted,{size:.62}); g.prect(bx,y,.25*Wd*pm,.04*H,g.C.c5,null,{r:2,a:.8}); g.ptxt(Math.round(pm*100)+'% yes'+(truth?' (label: yes)':' (label: no)'),bx,y+.07*H,g.C.ink,{size:.6,mono:true}); }
    if(o.lv>=8) g.ptxt('update all weights with L_MLM + L_SIP',.36*Wd,.5*H,g.C.c1,{size:.66,bold:true}); };
  add(1,`Input: an image's regions and a caption${truth?' (here, its own caption).':' (here, swapped for another image\'s caption).'}`,1500,g=>draw(g,{lv:1}));
  add(2,'Words become BERT tokens: token + segment A + position.',1000,g=>draw(g,{lv:2}));
  add(3,'Each detected box becomes a visual token: W_v·feature + segment B.',1100,g=>draw(g,{lv:3}));
  add(4,`Mask a word: "${mw}". The regions stay visible.`,1000,g=>draw(g,{lv:3,mask:true}));
  add(5,hitObj>=0?`One BERT reads everything; the masked position can attend to region r${hitObj+1}, the ${objs[hitObj].label}.`:'One BERT reads everything; nothing in this image matches the hidden word.',1500,g=>draw(g,{lv:5,mask:true,att:true}));
  add(6,present.has(mw)?`Predict the word: the image makes "${mw}" far more likely.`:'Predict the word: the image cannot help here, so the guess stays uncertain.',1600,(g,p)=>draw(g,{lv:6,mask:true,att:true,img:p}));
  add(7,`The [CLS] output predicts whether the caption matches: ${Math.round(pm*100)}% yes.`,1300,g=>draw(g,{lv:7,mask:true,img:1}));
  add(8,'Both losses update every weight, including W_v. Repeat on the next image.',2400,g=>draw(g,{lv:8,mask:true,img:1}));
  return S;
});
AA.title(/VisualBERT pre-training step/i,'vbert');
/* ---------- ViLBERT: Co-TRM layer and pre-training ---------- */
const vilFUNC=new Set(['a','the','with','under','on','next','to','behind','waits','sits','plays']);
const vilMaps=(k)=>{ const S=VIS.SCENES[k], W=S.caption.split(' '), nm=o=>o.tags.concat([o.label]);
  const wt=['CLS',...W,'SEP'], vt=['IMG',...S.objects.map((o,j)=>'r'+(j+1))], isW=i=>i>=1&&i<=W.length, wd=i=>W[i-1];
  const TW=wt.map((t,i)=>softmax(vt.map((v,j)=>{ let s=0; if(j===0) s+=(i===0||i===wt.length-1)?2.5:(isW(i)&&vilFUNC.has(wd(i))?2.2:.6); if(j>0&&isW(i)&&nm(S.objects[j-1]).includes(wd(i))) s+=4; return s; })));
  const VW=vt.map((v,j)=>softmax(wt.map((t,i)=>{ let s=0; if(j===0) s+=i===0?2.5:(isW(i)&&!vilFUNC.has(wd(i))?.8:0); if(j>0&&isW(i)&&nm(S.objects[j-1]).includes(wd(i))) s+=4; if(j>0&&(i===0||i===wt.length-1)) s+=1.4; return s; })));
  return {S,W,wt,vt,TW,VW}; };
AA.def('cotrm', T => {
  const S=[], add=F(S); if(!window.VIS) return S; const k=pick(['park','kitchen','street']); const M=vilMaps(k);
  const hw=M.wt.map(()=>T.range(4).map(()=>T.g()*.6)), hv=M.vt.map(()=>T.range(4).map(()=>T.g()*.6));
  const hw2=hw.map((v,i)=>v.map((a,q)=>a*.6+T.sum(M.TW[i].map((w,j)=>w*hv[j][q]))*.8)), hv2=hv.map((v,j)=>v.map((a,q)=>a*.6+T.sum(M.VW[j].map((w,i)=>w*hw[i][q]))*.8));
  const content=M.W.map((w,i)=>i+1).filter(i=>!vilFUNC.has(M.W[i-1])), qW=[content[0],content[content.length-1],1].filter((v,i,a)=>a.indexOf(v)===i).slice(0,3);
  const qV=M.vt.map((_,j)=>j).filter(j=>j>0&&M.VW[j].some((w,i)=>i>0&&w>.4)).slice(0,2); if(!qV.length) qV.push(1);
  const draw=(g,o)=>{ const W=g.W,H=g.H, ty=.2*H, vy=.72*H;
    g.ptxt('text stream H_W',.02*W,ty-g.fs*2.2,g.C.c1,{size:.68,bold:true}); g.ptxt('image stream H_V',.02*W,vy+g.fs*3.4,g.C.c4,{size:.68,bold:true});
    const cw=chipRow(g,M.wt,.5*W,ty,i=>({size:.6,tint:g.C.c1,ta:.25,stroke:o.qw===i?g.C.c2:null}),4), cvv=chipRow(g,M.vt.map((t,j)=>j?t+' '+M.S.objects[j-1].label.split(' ')[0]:t),.5*W,vy,j=>({size:.6,tint:g.C.c4,ta:.25,stroke:o.qv===j?g.C.c2:null}),4);
    const HW=o.upd?hw.map((v,i)=>v.map((a,q)=>T.lerp(a,hw2[i][q],o.upd))):hw, HV=o.upd?hv.map((v,i)=>v.map((a,q)=>T.lerp(a,hv2[i][q],o.upd))):hv, s=Math.min(g.fs*.55,.012*W);
    cw.forEach((x,i)=>vecSq(g,HW[i],x-2*s,ty+g.fs*1.1,s)); cvv.forEach((x,j)=>vecSq(g,HV[j],x-2*s,vy+g.fs*1.1,s));
    if(o.qkvW) g.ptxt('Q_W  K_W  V_W from text weights',.98*W,ty-g.fs*2.2,g.C.c1,{align:'right',size:.6,mono:true});
    if(o.qkvV) g.ptxt('Q_V  K_V  V_V from image weights',.98*W,vy+g.fs*3.4,g.C.c4,{align:'right',size:.6,mono:true});
    if(o.qw!=null){ M.TW[o.qw].forEach((a,j)=>{ if(a>.03) g.pseg(cw[o.qw],ty+g.fs*1.9,cvv[j],vy-g.fs*1,g.C.c1,1+a*8*(o.p==null?1:o.p)); }); }
    if(o.qv!=null){ M.VW[o.qv].forEach((a,i)=>{ if(a>.03) g.pseg(cvv[o.qv],vy-g.fs*1,cw[i],ty+g.fs*1.9,g.C.c4,1+a*8*(o.p==null?1:o.p)); }); }
    if(o.ffn){ g.prect(.3*W,.36*H,.4*W,.09*H,g.C.c1,null,{r:6,a:.18}); g.ptxt('FFN_W (text weights)',.5*W,.405*H,g.C.ink,{align:'center',size:.66}); g.prect(.3*W,.5*H,.4*W,.09*H,g.C.c4,null,{r:6,a:.18}); g.ptxt('FFN_V (image weights)',.5*W,.545*H,g.C.ink,{align:'center',size:.66}); }
    if(o.res) g.ptxt('H ← LN(H + what it found)',.5*W,.46*H,g.C.c5,{align:'center',size:.75,bold:true}); };
  add(1,`Two streams: ${M.wt.length} text tokens and ${M.vt.length} image tokens ([IMG] + regions), each with its own vector.`,1500,g=>draw(g,{}));
  add(2,'The text stream makes queries, keys and values with its own weights.',900,g=>draw(g,{qkvW:true}));
  add(3,'The image stream does the same with its own weights.',900,g=>draw(g,{qkvW:true,qkvV:true}));
  qW.forEach((i,n)=>add(4,`Text asks, image answers: "${M.wt[i]}" scores every image key and takes a weighted mix of image values.`,n?800:1300,(g,p)=>draw(g,{qkvW:true,qkvV:true,qw:i,p})));
  qV.forEach((j,n)=>add(5,`Image asks, text answers: region ${M.vt[j]} (${M.S.objects[j-1].label}) looks for the words about it.`,n?800:1300,(g,p)=>draw(g,{qkvW:true,qkvV:true,qv:j,p})));
  add(6,'Each stream adds what it found to its own vectors (residual), then normalises.',1300,(g,p)=>draw(g,{upd:p,res:true}));
  add(7,'Each stream then runs its own feed-forward network.',1100,g=>draw(g,{upd:1,ffn:true}));
  add(8,'Return both streams. Next, a TRM layer mixes information within each stream.',2200,g=>draw(g,{upd:1}));
  return S;
});
AA.title(/co-attentional transformer \(Co-TRM\) layer/i,'cotrm');

AA.def('vilpt', T => {
  const S=[], add=F(S); if(!window.VIS) return S; const keys=['park','kitchen','street'], k=pick(keys), truth=T.r()<.6, capK=truth?k:pick(keys.filter(x=>x!==k));
  const SC=VIS.SCENES[k], W=VIS.SCENES[capK].caption.split(' '), COLW=new Set(['red','blue','yellow','green']);
  const nounI=W.map((w,i)=>i).filter(i=>!vilFUNC.has(W[i])&&!COLW.has(W[i])); const mw=pick(nounI);
  const rj=Math.max(0,SC.objects.findIndex(o=>W.includes(o.label)&&o.label!==W[mw])); const rob=SC.objects[rj];
  const present=new Set(SC.objects.flatMap(o=>o.tags.concat([o.label]))), content=W.filter(w=>!vilFUNC.has(w)), pa=T.sig(6*content.filter(w=>present.has(w)).length/content.length-2.5);
  const draw=(g,o)=>{ const Wd=g.W,H=g.H, s=Math.min(.28*Wd,.4*H), ix=.02*Wd, iy=.08*H; drawScene(g,k,ix,iy,s);
    SC.objects.forEach((ob,j)=>{ const b=ob.box; if(o.mask&&j===rj){ g.prect(ix+b[0]*s,iy+b[1]*s,b[2]*s,b[3]*s,'rgba(30,30,30,.85)'); } g.prect(ix+b[0]*s,iy+b[1]*s,b[2]*s,b[3]*s,null,o.mask&&j===rj?g.C.c2:g.C.c4,{lw:o.mask&&j===rj?3:1.5}); });
    g.ptxt('"'+W.map((w,i)=>o.mask&&i===mw?'[MASK]':w).join(' ')+'"',.33*Wd,.08*H,g.C.ink,{size:.64,bold:true}); g.ptxt(truth?'true caption':'caption of another image',.33*Wd,.08*H+g.fs*1.2,truth?g.C.c5:g.C.c4,{size:.6});
    if(o.lv>=2){ const ry=.6*H; const vt=['IMG',...SC.objects.map((ob,j)=>o.mask&&j===rj?'[0]':'r'+(j+1))]; chipRow(g,vt,.18*Wd,ry,j=>({size:.58,tint:g.C.c4,ta:.3,stroke:o.mask&&j===rj+1?g.C.c2:null}),3); g.ptxt('image tokens = W_f·f + W_b·box',.02*Wd,ry+g.fs*1.6,g.C.c4,{size:.56}); }
    if(o.lv>=3){ g.ptxt('text tokens: [CLS] … [SEP]',.33*Wd,.2*H,g.C.c1,{size:.6}); }
    if(o.lv>=5){ g.prect(.36*Wd,.27*H,.17*Wd,.3*H,g.C.c1,null,{r:6,a:.15}); g.prect(.56*Wd,.27*H,.17*Wd,.3*H,g.C.c4,null,{r:6,a:.15}); g.ptxt('text',.445*Wd,.31*H,g.C.ink,{align:'center',size:.62,bold:true}); g.ptxt('image',.645*Wd,.31*H,g.C.ink,{align:'center',size:.62,bold:true});
      for(let q=0;q<3;q++){ const y=.37*H+q*.06*H, on=o.lv===5&&(Math.floor((o.p||0)*3)===q); g.pseg(.53*Wd,y,.56*Wd,y+.02*H,on?g.C.c2:g.C.line,on?3:1.5); g.pseg(.56*Wd,y,.53*Wd,y+.02*H,on?g.C.c2:g.C.line,on?3:1.5); } g.ptxt('Co-TRM',.545*Wd,.6*H,g.C.c2,{align:'center',size:.56}); }
    const bx=.76*Wd; if(o.lv>=6){ g.ptxt('masked word → '+W[mw],bx,.2*H,g.C.ink,{size:.58,bold:true}); g.prect(bx,.23*H,.2*Wd*(truth?.8:.3),.035*H,g.C.c5,null,{r:2,a:.8}); g.ptxt(truth?'80%':'30%',bx+.2*Wd*(truth?.8:.3)+3,.25*H,g.C.muted,{size:.52,mono:true}); }
    if(o.lv>=7){ g.ptxt('masked region → class',bx,.33*H,g.C.ink,{size:.58,bold:true}); g.ptxt('target: '+rob.label,bx,.37*H,g.C.c4,{size:.55,mono:true}); g.prect(bx,.39*H,.2*Wd*(W.includes(rob.label)?.7:.25),.035*H,g.C.c3,null,{r:2,a:.8}); g.ptxt('KL loss',bx,.46*H,g.C.muted,{size:.52}); }
    if(o.lv>=8){ g.ptxt('h_IMG ⊙ h_CLS → aligned?',bx,.54*H,g.C.ink,{size:.58,bold:true}); g.prect(bx,.57*H,.2*Wd*pa,.035*H,g.C.c5,null,{r:2,a:.8}); g.ptxt(Math.round(pa*100)+'% (label: '+(truth?'yes':'no')+')',bx,.64*H,g.C.muted,{size:.55,mono:true}); }
    if(o.lv>=9) g.ptxt(truth?'loss = word + region + alignment':'random pair: only the alignment loss counts',.33*Wd,.82*H,g.C.c1,{size:.66,bold:true}); };
  add(1,`An image's regions and ${truth?'its caption':'a caption from a different image'}.`,1300,g=>draw(g,{lv:1}));
  add(2,'Image tokens: [IMG] summary, then each region with its 5-number box.',1000,g=>draw(g,{lv:2}));
  add(3,'Text tokens, exactly as in BERT.',800,g=>draw(g,{lv:3}));
  add(4,`Mask the word "${W[mw]}" and region r${rj+1} (its features become zeros).`,1100,g=>draw(g,{lv:3,mask:true}));
  add(5,'Both streams run; at each Co-TRM layer they swap keys and values.',1600,(g,p)=>draw(g,{lv:5,mask:true,p}));
  add(6,'Predict the masked word from its text state.',900,g=>draw(g,{lv:6,mask:true}));
  add(7,`Predict what was in r${rj+1}: match the detector's class distribution (${rob.label}).`,1100,g=>draw(g,{lv:7,mask:true}));
  add(8,`Alignment: combine the two summaries. ${Math.round(pa*100)}% "aligned".`,1100,g=>draw(g,{lv:8,mask:true}));
  add(9,truth?'Add the three losses and update every weight in both streams.':'Random pair: only the alignment loss updates the weights.',2300,g=>draw(g,{lv:9,mask:true}));
  return S;
});
AA.title(/ViLBERT pre-training step/i,'vilpt');
/* ---------- CLIP: contrastive training step and zero-shot ---------- */
const clipCOL={red:'#e0524c',green:'#3fa65b',blue:'#3f7fdc',yellow:'#e6b422'};
const clipShp=(g,kind,x,y,r,col,hollow)=>{ const c=g.ctx; c.save(); c.beginPath();
  if(kind==='circle') c.arc(x,y,r,0,7); else if(kind==='square') c.rect(x-r*.85,y-r*.85,r*1.7,r*1.7); else { c.moveTo(x,y-r); c.lineTo(x+r*.95,y+r*.75); c.lineTo(x-r*.95,y+r*.75); c.closePath(); }
  if(hollow){ c.lineWidth=Math.max(2,r*.28); c.strokeStyle=col; c.stroke(); } else { c.fillStyle=col; c.fill(); } c.restore(); };
const clipItems=n=>{ const all=[]; Object.keys(clipCOL).forEach(c=>['circle','square','triangle'].forEach(s=>all.push([c,s]))); const out=[]; while(out.length<n){ const it=pick(all); if(!out.some(o=>o[0]===it[0]&&o[1]===it[1])&&!out.some(o=>o[0]===it[0])) out.push(it); } return out; };
const wrapA=a=>{ while(a>Math.PI) a-=2*Math.PI; while(a<-Math.PI) a+=2*Math.PI; return a; };
AA.def('clip', T => {
  const S=[], add=F(S), B=4, tau=.25, it=clipItems(B), off=T.r()*6.28;
  const tgt=it.map((_,i)=>off+i*Math.PI/2), a0=it.map((_,i)=>tgt[i]+T.g()*1.1), b0=it.map((_,i)=>tgt[i]+T.g()*1.1+(T.r()<.5?1:-1)*.9);
  const ang=(p)=>({a:a0.map((v,i)=>v+wrapA(tgt[i]-.2-v)*p),b:b0.map((v,i)=>v+wrapA(tgt[i]+.2-v)*p)});
  const Sm=(A)=>A.a.map(x=>A.b.map(y=>Math.cos(x-y)/tau));
  const loss=(M)=>{ let l=0; M.forEach((r,i)=>{ l-=Math.log(softmax(r)[i]); }); M[0].forEach((_,j)=>{ l-=Math.log(softmax(M.map(r=>r[j]))[j]); }); return l/(2*B); };
  const L0=loss(Sm(ang(0))), L1=loss(Sm(ang(1)));
  const draw=(g,o)=>{ const W=g.W,H=g.H, R=Math.min(.19*W,.27*H), cx=.04*W+R*1.35, cy=.54*H, ir=Math.max(5,R*.11), A=ang(o.upd||0);
    g.ptxt('shared space (unit circle)',cx,cy-R-g.fs*1.6,g.C.muted,{align:'center',size:.6});
    g.ctx.save(); g.ctx.strokeStyle=g.C.line; g.ctx.lineWidth=1.5; g.ctx.beginPath(); g.ctx.arc(cx,cy,R,0,7); g.ctx.stroke(); g.ctx.restore();
    const P=(t,rr)=>[cx+Math.cos(t)*R*rr,cy-Math.sin(t)*R*rr];
    if(o.lv>=3&&o.lv<7||o.upd) it.forEach((m,i)=>{ const p1=P(A.a[i],1),p2=P(A.b[i],1); g.pseg(p1[0],p1[1],p2[0],p2[1],clipCOL[m[0]],1.5,[4,4]); });
    if(o.lv>=2){ const rr=o.lv===2?1.2-.2*(o.p||0):1; it.forEach((m,i)=>{ const p=P(A.a[i],rr); clipShp(g,m[1],p[0],p[1],ir,clipCOL[m[0]]); }); }
    if(o.lv>=3){ const rr=o.lv===3?1.2-.2*(o.p||0):1; it.forEach((m,i)=>{ const p=P(A.b[i],rr); clipShp(g,m[1],p[0],p[1],ir*.9,clipCOL[m[0]],true); }); }
    g.ptxt('filled = image u_i,  outline = caption t_j',cx,cy+R+g.fs*2.2,g.C.muted,{align:'center',size:.56});
    const hx=Math.max(cx+R*1.5,.52*W), cs=Math.min((W-hx-.03*W)/(B+1.2),.13*H), hy=.2*H+cs;
    if(o.lv<4){ it.forEach((m,i)=>{ const y=.22*H+i*Math.min(.15*H,g.fs*2.6); clipShp(g,m[1],hx+ir,y,ir,clipCOL[m[0]]); g.ptxt('"a '+m[0]+' '+m[1]+'"',hx+ir*2.6,y,g.C.ink,{size:.62,mono:true}); }); g.ptxt(B+' matching (image, caption) pairs',hx,.22*H-g.fs*1.8,g.C.ink,{size:.64,bold:true}); }
    if(o.lv>=4){ const M=Sm(A), sh=o.lv===4&&!o.mode?Math.min(B*B,Math.floor((o.p||0)*B*B+1)):B*B;
      let V; if(o.mode==='row') V=M.map(r=>softmax(r)); else if(o.mode==='col'){ const C=M[0].map((_,j)=>softmax(M.map(r=>r[j]))); V=M.map((r,i)=>r.map((_,j)=>C[j][i])); } else V=M.map(r=>r.map(v=>(v*tau+1)/2));
      it.forEach((m,i)=>{ clipShp(g,m[1],hx+cs*.5,hy+i*cs+cs/2,Math.min(ir,cs*.3),clipCOL[m[0]]); clipShp(g,m[1],hx+cs*1.2+i*cs+cs/2,hy-cs*.5,Math.min(ir,cs*.3)*.9,clipCOL[m[0]],true); });
      heat(g,V,hx+cs*1.2,hy,cs,cs,o.mode==='col'?g.C.c4:g.C.c1,{num:true,dp:o.mode?2:1,size:.5,hide:(i,j)=>i*B+j>=sh,hl:(i,j)=>i===j&&(o.mode||o.upd)});
      if(o.mode==='row'&&o.focus!=null) g.prect(hx+cs*1.2,hy+o.focus*cs,cs*B,cs,null,g.C.c2,{r:3,lw:3});
      if(o.mode==='col'&&o.focus!=null) g.prect(hx+cs*1.2+o.focus*cs,hy,cs,cs*B,null,g.C.c2,{r:3,lw:3});
      const lab=o.mode==='row'?'softmax of each row: image → caption':o.mode==='col'?'softmax of each column: caption → image':'S = cos(u_i, t_j)/τ  (cells show cos)';
      g.ptxt(lab,hx,hy+B*cs+g.fs*1.2,g.C.ink,{size:.6,bold:true});
      if(o.upd!=null) g.ptxt('loss '+T.f(loss(M),2)+'  (was '+T.f(L0,2)+')',hx,hy+B*cs+g.fs*2.6,g.C.c5,{size:.6,mono:true}); }
  };
  add(1,`A batch of ${B} matching (image, caption) pairs.`,1300,g=>draw(g,{lv:1}));
  add(2,'Encode each image and normalise: every vector lands on the unit circle.',1100,(g,p)=>draw(g,{lv:2,p}));
  add(3,'Encode each caption and normalise. Dashed lines join the true pairs: before training they point different ways.',1500,(g,p)=>draw(g,{lv:3,p}));
  add(4,`Score every image against every caption: a ${B}×${B} table, true pairs on the diagonal.`,1600,(g,p)=>draw(g,{lv:4,p}));
  for(let i=0;i<B;i++) add(5,`Row ${i+1}: softmax over the captions. The loss wants the diagonal cell near 1.`,i?650:1100,g=>draw(g,{lv:4,mode:'row',focus:i}));
  for(let j=0;j<B;j++) add(6,`Column ${j+1}: softmax over the images. The same goal, the other way round.`,j?650:1100,g=>draw(g,{lv:4,mode:'col',focus:j}));
  add(7,`Average the two losses and step: true pairs rotate together, wrong pairs apart (loss ${T.f(L0,2)} → ${T.f(L1,2)}).`,2200,(g,p)=>draw(g,{lv:4,mode:'row',upd:p}));
  add(7,'After many such steps, matching pictures and captions share one direction.',1800,g=>draw(g,{lv:4,mode:'row',upd:1}));
  return S;
});
AA.title(/CLIP training step/i,'clip');

AA.def('zeroshot', T => {
  const S=[], add=F(S), K=5, tau=.15, it=clipItems(1)[0];
  const cls=[it]; const all=[]; Object.keys(clipCOL).forEach(c=>['circle','square','triangle'].forEach(s=>all.push([c,s])));
  while(cls.length<K){ const c=pick(all); if(!cls.some(o=>o[0]===c[0]&&o[1]===c[1])) cls.push(c); }
  const th0=T.r()*6.28; let sgn=1, used=[th0];
  const ang=cls.map((c,i)=>{ if(!i) return th0; const sh=(c[0]===it[0])+(c[1]===it[1]); let a, tries=0; do{ a=th0+sgn*(sh?.55+T.r()*.5:1.4+T.r()*1.5); tries++; }while(used.some(u=>Math.abs(wrapA(u-a))<.42)&&tries<20); sgn=-sgn; used.push(a); return a; });
  const perm=T.shuffle(cls.map((_,i)=>i)); const cls2=perm.map(i=>cls[i]), ang2=perm.map(i=>ang[i]); cls.splice(0,K,...cls2); ang.splice(0,K,...ang2);
  const ua=th0+(T.r()-.5)*.35, sc=ang.map(a=>Math.cos(a-ua)), pr=softmax(sc.map(v=>v/tau)), best=pr.indexOf(Math.max(...pr));
  const draw=(g,o)=>{ const W=g.W,H=g.H, R=Math.min(.19*W,.3*H), cx=.04*W+R*1.3, cy=.55*H, ir=Math.max(5,R*.1), P=(t,rr)=>[cx+Math.cos(t)*R*rr,cy-Math.sin(t)*R*rr];
    g.ctx.save(); g.ctx.strokeStyle=g.C.line; g.ctx.lineWidth=1.5; g.ctx.beginPath(); g.ctx.arc(cx,cy,R,0,7); g.ctx.stroke(); g.ctx.restore();
    const isz=Math.min(.09*H,R*.35); const ix=.02*W; g.prect(ix,.04*H,isz*2,isz*2,g.C.soft,g.C.line,{r:6}); clipShp(g,it[1],ix+isz,.04*H+isz,isz*.6,clipCOL[it[0]]); g.ptxt('new image x',ix+isz*2.3,.04*H+isz,g.C.muted,{size:.58});
    const nshow=o.lv>=2?(o.lv===2?Math.min(K,Math.floor((o.p||0)*K+1)):K):0;
    for(let k=0;k<nshow;k++){ const p=P(ang[k],1), q=P(ang[k],1.22); clipShp(g,cls[k][1],p[0],p[1],ir*.9,clipCOL[cls[k][0]],true); g.ptxt(String(k+1),q[0],q[1],g.C.ink,{align:'center',size:.6,bold:true,mono:true}); }
    if(o.lv>=3){ const p=P(ua,o.lv===3?(o.p||0):1); g.parrow(cx,cy,p[0],p[1],g.C.c2,2.5); if(o.lv===3) g.ptxt('u',p[0]+6,p[1]-8,g.C.c2,{size:.7,bold:true}); }
    if(o.lv>=4&&o.lv<6){ for(let k=0;k<K;k++){ const p=P(ang[k],1),q=P(ua,1); g.pseg(q[0],q[1],p[0],p[1],g.C.c2,1,[3,4]); } }
    const bx=Math.max(cx+R*1.55,.5*W), bw=W-bx-.03*W, rowH=Math.min(.14*H,g.fs*2.7), by=.18*H;
    g.ptxt('"a photo of a {colour} {shape}"',bx,by-g.fs*1.4,g.C.muted,{size:.56,mono:true});
    for(let k=0;k<nshow;k++){ const y=by+k*rowH; g.ptxt((k+1)+' '+cls[k].join(' '),bx,y,k===best&&o.lv>=6?g.C.c5:g.C.ink,{size:.6,bold:k===best&&o.lv>=6,mono:true});
      if(o.lv>=4){ const v=o.lv===4?Math.max(0,sc[k])*Math.min(1,(o.p||0)*1.5):(o.lv===5?T.lerp(Math.max(0,sc[k]),pr[k],o.p||0):pr[k]); g.prect(bx,y+g.fs*.55,bw*.75*v,g.fs*.7,o.lv>=5?g.C.c5:g.C.c2,null,{r:2,a:k===best&&o.lv>=6?1:.7});
        g.ptxt(o.lv===4?'cos '+T.f(sc[k],2):(o.lv===5&&(o.p||0)<.5?'':T.f(pr[k]*100,0)+'%'),bx+bw*.75*v+4,y+g.fs*.9,g.C.muted,{size:.5,mono:true}); } }
    if(o.lv>=6) g.ptxt('answer: '+cls[best].join(' ')+(cls[best][0]===it[0]&&cls[best][1]===it[1]?' ✓':''),bx,by+K*rowH+g.fs*.6,g.C.c5,{size:.66,bold:true});
  };
  add(1,`A new image, and ${K} class names, each wrapped in a template sentence.`,1300,g=>draw(g,{lv:1}));
  add(2,'Encode each prompt with the text encoder and normalise: one point per class. Done once, then reused.',1500,(g,p)=>draw(g,{lv:2,p}));
  add(3,'Encode the image with the image encoder and normalise: the arrow u.',1100,(g,p)=>draw(g,{lv:3,p}));
  add(4,'Score: cosine between u and every class point (closer angle, bigger score).',1500,(g,p)=>draw(g,{lv:4,p}));
  add(5,'Divide by τ and softmax: probabilities over the classes.',1300,(g,p)=>draw(g,{lv:5,p}));
  add(6,'Return the most likely class. No classifier was trained for these labels.',2200,g=>draw(g,{lv:6}));
  return S;
});
AA.title(/zero-shot classification with CLIP/i,'zeroshot');
/* ---------- which animation goes with which pseudocode title ---------- */
[[/ordinary least squares/i,'ols'],[/gradient descent for least squares/i,'gd'],[/lasso by coordinate descent/i,'lassocd'],
 [/logistic regression by gradient descent/i,'logreg'],[/Newton's method \(IRLS\)/i,'newton'],[/proximal gradient descent for L1/i,'proxlog'],[/ROC curve/i,'roc'],
 [/fitting and predicting with GDA/i,'gda'],[/sampling from the fitted model/i,'gdasample'],[/SMO for the SVM/i,'smo'],[/classification tree \(CART\)/i,'cart'],
 [/random forest/i,'rf'],[/AdaBoost/i,'ada'],[/^\s*Algorithm: PCA/i,'pca'],[/K-fold cross-validation/i,'cv'],[/ISTA/i,'ista'],[/fair model comparison/i,'compare'],
 [/dot product, length and angle/i,'dot'],[/power iteration/i,'power'],[/LU with partial pivoting/i,'lu'],[/Gram.Schmidt QR/i,'qr'],[/Cholesky factorisation/i,'chol'],
 [/Bayesian updating of a coin/i,'coin'],[/matrix multiplication/i,'matmul'],[/row reduction/i,'rref'],[/solve .*2.*2/i,'solve2'],[/least squares, two ways/i,'lsq2'],
 [/maximum likelihood when there is no closed form/i,'mle'],[/bootstrap confidence interval/i,'boot'],[/a hypothesis test/i,'htest'],[/permutation test/i,'perm'],[/SVD via the eigenvectors/i,'svdeig']
].forEach(([re,k])=>AA.title(re,k));
})();
