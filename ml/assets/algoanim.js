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
  g.size = (W,H) => { g.W=W; g.H=H; g.fs = Math.max(10, Math.min(14, W/40)); g.view(0,0,1,1,0,1,0,1); };
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
  const sizeIt = () => { const w = cv.clientWidth || pan.clientWidth || 320; const h = Math.round(w*0.66); const dpr = Math.min(2, window.devicePixelRatio||1);
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
