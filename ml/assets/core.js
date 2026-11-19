/* ML lab core: random numbers, datasets, linear algebra, canvas plotting, UI helpers.
   Everything runs in the browser; no build step. Exposes window.ML. */
(function(){
'use strict';
const ML = window.ML = window.ML || {};

/* ---------------- random ---------------- */
ML.rng = function(seed){
  let a = (seed>>>0) || 1;
  const r = function(){ a = (a + 0x6D2B79F5)>>>0; let t = a; t = Math.imul(t ^ (t>>>15), t | 1); t ^= t + Math.imul(t ^ (t>>>7), t | 61); return ((t ^ (t>>>14))>>>0) / 4294967296; };
  let spare = null;
  r.gauss = function(){ if(spare!==null){const s=spare;spare=null;return s;} let u=0,v=0; while(u===0)u=r(); v=r(); const m=Math.sqrt(-2*Math.log(u)); spare=m*Math.sin(2*Math.PI*v); return m*Math.cos(2*Math.PI*v); };
  r.int = n => Math.floor(r()*n);
  r.shuffle = arr => { for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };
  return r;
};

/* ---------------- classification datasets (labels 0 / 1) ---------------- */
function mvn(r, mu, L){ const z1=r.gauss(), z2=r.gauss(); return [mu[0]+L[0][0]*z1, mu[1]+L[1][0]*z1+L[1][1]*z2]; }
function chol2(S){ const a=Math.sqrt(S[0][0]); const b=S[1][0]/a; const c=Math.sqrt(Math.max(1e-12,S[1][1]-b*b)); return [[a,0],[b,c]]; }

ML.DATASETS = [
  {id:'linear', name:'Linear blobs', level:'simple', desc:'Two well separated Gaussian blobs. A straight line separates them.',
   gen(n,noise,r){ const X=[],y=[], s=0.45+0.55*noise; for(let i=0;i<n;i++){const k=i%2; X.push([(k?1.1:-1.1)+s*r.gauss(), (k?0.9:-0.9)+s*r.gauss()]); y.push(k);} return {X,y}; }},
  {id:'overlap', name:'Overlapping', level:'simple', desc:'Two Gaussian blobs that overlap. No boundary can be perfect, so this tests how models handle unavoidable error.',
   gen(n,noise,r){ const X=[],y=[], s=0.75+0.6*noise; for(let i=0;i<n;i++){const k=i%2; X.push([(k?0.7:-0.7)+s*r.gauss(), (k?0.5:-0.5)+s*r.gauss()]); y.push(k);} return {X,y}; }},
  {id:'aniso', name:'Unequal covariance', level:'medium', desc:'Two Gaussians with different shapes (covariances). The Bayes-optimal boundary is a curve, which is exactly the LDA vs QDA story.',
   gen(n,noise,r){ const X=[],y=[], f=1+0.8*noise; const L0=chol2([[1.3*f,1.0*f],[1.0*f,1.1*f]]), L1=chol2([[0.18*f,-0.05*f],[-0.05*f,0.16*f]]);
     for(let i=0;i<n;i++){const k=i%2; X.push(k?mvn(r,[0.9,-0.6],L1):mvn(r,[-0.5,0.4],L0)); y.push(k);} return {X,y}; }},
  {id:'moons', name:'Moons', level:'medium', desc:'Two interleaving half circles. Needs a curved boundary.',
   gen(n,noise,r){ const X=[],y=[], s=0.12+0.35*noise; for(let i=0;i<n;i++){const k=i%2, t=Math.PI*r();
     let a = k ? 1-Math.cos(t) : Math.cos(t), b = k ? 0.5-Math.sin(t) : Math.sin(t);
     X.push([1.7*(a-0.5)+s*r.gauss(), 1.7*(b-0.25)+s*r.gauss()]); y.push(k);} return {X,y}; }},
  {id:'circles', name:'Circles', level:'medium', desc:'One class inside a ring of the other. No line works; a kernel or a tree can.',
   gen(n,noise,r){ const X=[],y=[], s=0.12+0.35*noise; for(let i=0;i<n;i++){const k=i%2, t=2*Math.PI*r(), rad=k?0.85:2.0;
     X.push([rad*Math.cos(t)+s*r.gauss(), rad*Math.sin(t)+s*r.gauss()]); y.push(k);} return {X,y}; }},
  {id:'xor', name:'XOR', level:'complex', desc:'Opposite quadrants share a class. Linear models fail completely; trees and kernels shine.',
   gen(n,noise,r){ const X=[],y=[], s=0.05+0.35*noise; for(let i=0;i<n;i++){ let a=(r()*2-1)*2.4, b=(r()*2-1)*2.4; if(Math.abs(a)<0.15)a+=a<0?-0.15:0.15; if(Math.abs(b)<0.15)b+=b<0?-0.15:0.15;
     y.push(a*b>0?1:0); X.push([a+s*r.gauss(), b+s*r.gauss()]);} return {X,y}; }},
  {id:'spirals', name:'Spirals', level:'complex', desc:'Two interleaved spirals: the hardest pattern here. Needs a very flexible model.',
   gen(n,noise,r){ const X=[],y=[], s=0.05+0.25*noise; for(let i=0;i<n;i++){const k=i%2, t=0.6+3*Math.PI*Math.sqrt(r()), rad=0.12+t*0.225, ph=k?Math.PI:0;
     X.push([rad*Math.cos(t+ph)+s*r.gauss(), rad*Math.sin(t+ph)+s*r.gauss()]); y.push(k);} return {X,y}; }},
  {id:'noisy', name:'Noisy labels', level:'complex', desc:'Separable blobs, but 15% of labels are flipped at random. Shows which models overfit noise.',
   gen(n,noise,r){ const X=[],y=[], s=0.55+0.4*noise; for(let i=0;i<n;i++){let k=i%2; X.push([(k?1:-1)+s*r.gauss(), (k?0.8:-0.8)+s*r.gauss()]); if(r()<0.15+0.1*noise)k=1-k; y.push(k);} return {X,y}; }},
];
ML.dataset = function(id, n=200, noise=0.3, seed=7){
  const d = ML.DATASETS.find(d=>d.id===id) || ML.DATASETS[0];
  const out = d.gen(n, noise, ML.rng(seed*7919 + id.length*131));
  out.id = d.id; out.name = d.name; out.desc = d.desc; return out;
};
ML.BOUNDS = {x0:-3.2,x1:3.2,y0:-3.2,y1:3.2};

/* train / test split (stratification not needed for balanced sets) */
ML.split = function(data, testFrac, seed){
  const n=data.X.length, idx=ML.rng(seed||11).shuffle([...Array(n).keys()]);
  const nt=Math.round(n*testFrac), te=idx.slice(0,nt), tr=idx.slice(nt);
  return {Xtr:tr.map(i=>data.X[i]), ytr:tr.map(i=>data.y[i]), Xte:te.map(i=>data.X[i]), yte:te.map(i=>data.y[i]), trIdx:tr, teIdx:te};
};
ML.accuracy = function(model, X, y){ if(!X.length) return NaN; let c=0; for(let i=0;i<X.length;i++) if((model.proba(X[i])>=0.5?1:0)===y[i]) c++; return c/X.length; };

/* ---------------- regression datasets (1-D) ---------------- */
const ADV_TV=[44.5,17.2,151.5,180.8,8.7,57.5,120.2,214.7,23.8,97.5,240.1,66.1,199.8,28.6,144.4,88.0,265.6,109.8,39.6,175.1];
const ADV_SALES=[10.4,5.9,18.5,17.9,4.8,11.8,13.2,17.4,7.2,11.7,20.1,8.6,18.2,7.0,14.6,12.1,21.5,13.0,9.2,18.1];
ML.REG_DATASETS = [
  {id:'line', name:'Straight line', desc:'y = 0.8x + 0.5 + noise', f:x=>0.8*x+0.5},
  {id:'quad', name:'Curve (quadratic)', desc:'y = 0.45x² − 0.6x − 1 + noise', f:x=>0.45*x*x-0.6*x-1},
  {id:'sine', name:'Sine wave', desc:'y = 1.6 sin(1.3x) + noise: the classic bias–variance example', f:x=>1.6*Math.sin(1.3*x)},
  {id:'outlier', name:'With outliers', desc:'A straight line plus a few large outliers that pull least squares', f:x=>0.8*x+0.5},
  {id:'hetero', name:'Fanning noise', desc:'Noise grows with |x| (heteroscedastic), which breaks the constant-variance assumption', f:x=>0.6*x},
  {id:'adv', name:'Advertising (TV → Sales)', desc:'A 20-row sample of the classic Advertising data: TV spend ($1000s) vs Sales (1000 units)', real:true},
];
ML.regDataset = function(id, n=30, noise=0.5, seed=3){
  const d = ML.REG_DATASETS.find(d=>d.id===id) || ML.REG_DATASETS[0];
  if(d.real) return {id, name:d.name, desc:d.desc, x:ADV_TV.slice(), y:ADV_SALES.slice(), xl:'TV spend ($1000s)', yl:'Sales (1000 units)', f:null};
  const r = ML.rng(seed*31+id.length), x=[], y=[], s=0.15+1.1*noise;
  for(let i=0;i<n;i++){ const xi=-2.8+5.6*r(); let e=s*r.gauss(); if(id==='hetero') e*= (0.15+0.55*Math.abs(xi)); x.push(xi); y.push(d.f(xi)+e); }
  if(id==='outlier'){ x.push(2.2,2.6,-2.4); y.push(-2.8,-2.2,3.2); }
  return {id, name:d.name, desc:d.desc, x, y, xl:'x', yl:'y', f:d.f};
};

/* ---------------- linear algebra ---------------- */
const LA = ML.LA = {};
LA.zeros = (r,c) => Array.from({length:r},()=>new Array(c).fill(0));
LA.eye = n => { const I=LA.zeros(n,n); for(let i=0;i<n;i++) I[i][i]=1; return I; };
LA.T = A => A[0].map((_,j)=>A.map(r=>r[j]));
LA.mul = (A,B) => { const n=A.length,m=B[0].length,k=B.length,C=LA.zeros(n,m); for(let i=0;i<n;i++) for(let t=0;t<k;t++){const a=A[i][t]; if(a) for(let j=0;j<m;j++) C[i][j]+=a*B[t][j];} return C; };
LA.mv = (A,v) => A.map(r=>r.reduce((s,a,i)=>s+a*v[i],0));
LA.dot = (a,b) => { let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
LA.solve = function(A,b){ // Gaussian elimination with partial pivoting; returns null if singular
  const n=A.length, M=A.map((r,i)=>[...r, b[i]]);
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    if(Math.abs(M[p][c])<1e-12) return null; [M[c],M[p]]=[M[p],M[c]];
    for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]/M[c][c]; if(f) for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } }
  return M.map((r,i)=>r[n]/r[i]);
};
LA.inv = function(A){ const n=A.length, M=A.map((r,i)=>[...r, ...LA.eye(n)[i]]);
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    if(Math.abs(M[p][c])<1e-14) return null; [M[c],M[p]]=[M[p],M[c]]; const d=M[c][c]; for(let k=0;k<2*n;k++) M[c][k]/=d;
    for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]; if(f) for(let k=0;k<2*n;k++) M[r][k]-=f*M[c][k]; } }
  return M.map(r=>r.slice(n)); };
LA.det2 = S => S[0][0]*S[1][1]-S[0][1]*S[1][0];
LA.inv2 = S => { const d=LA.det2(S); return [[S[1][1]/d,-S[0][1]/d],[-S[1][0]/d,S[0][0]/d]]; };
LA.mean = X => { const d=X[0].length, m=new Array(d).fill(0); for(const x of X) for(let j=0;j<d;j++) m[j]+=x[j]; return m.map(v=>v/X.length); };
LA.cov = (X, mu, denom) => { const d=X[0].length, S=LA.zeros(d,d); mu=mu||LA.mean(X); for(const x of X) for(let i=0;i<d;i++) for(let j=0;j<d;j++) S[i][j]+=(x[i]-mu[i])*(x[j]-mu[j]); const k=denom||(X.length-1); return S.map(r=>r.map(v=>v/k)); };
LA.eigSym = function(A){ // Jacobi eigenvalue algorithm; returns {values (desc), vectors (columns as arrays)}
  const n=A.length, a=A.map(r=>r.slice()), V=LA.eye(n);
  for(let sweep=0;sweep<100;sweep++){
    let off=0; for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) off+=a[i][j]*a[i][j]; if(off<1e-20) break;
    for(let p=0;p<n;p++) for(let q=p+1;q<n;q++){ if(Math.abs(a[p][q])<1e-300) continue;
      const th=(a[q][q]-a[p][p])/(2*a[p][q]), t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)), c=1/Math.sqrt(t*t+1), s=t*c;
      for(let k=0;k<n;k++){ const akp=a[k][p], akq=a[k][q]; a[k][p]=c*akp-s*akq; a[k][q]=s*akp+c*akq; }
      for(let k=0;k<n;k++){ const apk=a[p][k], aqk=a[q][k]; a[p][k]=c*apk-s*aqk; a[q][k]=s*apk+c*aqk; }
      for(let k=0;k<n;k++){ const vkp=V[k][p], vkq=V[k][q]; V[k][p]=c*vkp-s*vkq; V[k][q]=s*vkp+c*vkq; } } }
  const idx=[...Array(n).keys()].sort((i,j)=>a[j][j]-a[i][i]);
  return {values: idx.map(i=>a[i][i]), vectors: idx.map(i=>{ const v=V.map(r=>r[i]); const k=v.reduce((m,x)=>Math.abs(x)>Math.abs(m)?x:m,0); return k<0?v.map(x=>-x):v; })};
};
/* polynomial feature map for 2-D input: all monomials x1^a x2^b with 1 <= a+b <= deg */
ML.poly2 = function(deg){ const terms=[]; for(let d=1;d<=deg;d++) for(let a=d;a>=0;a--) terms.push([a,d-a]);
  const f = x => terms.map(([a,b])=>Math.pow(x[0],a)*Math.pow(x[1],b)); f.terms=terms; f.dim=terms.length; return f; };
ML.sigmoid = z => z>=0 ? 1/(1+Math.exp(-z)) : Math.exp(z)/(1+Math.exp(z));

/* ---------------- formatting ---------------- */
ML.fmt = (v,d=3) => (v===undefined||v===null||Number.isNaN(v)) ? '–' : (Math.abs(v)>=1e4||(Math.abs(v)<1e-3&&v!==0) ? v.toExponential(2) : v.toFixed(d));
ML.pct = v => Number.isNaN(v) ? '–' : (100*v).toFixed(1)+'%';
ML.$ = (s, el=document) => el.querySelector(s);
ML.$$ = (s, el=document) => [...el.querySelectorAll(s)];

/* ---------------- colours ---------------- */
ML.css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
ML.rgb = function(c){ c=c.trim(); if(c[0]==='#'){ if(c.length===4) c='#'+[...c.slice(1)].map(h=>h+h).join(''); const n=parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  const m=c.match(/[\d.]+/g); return m?m.slice(0,3).map(Number):[0,0,0]; };
ML.palette = function(){ return { k0:ML.css('--k0'), k1:ML.css('--k1'), ink:ML.css('--ink'), muted:ML.css('--muted'), line:ML.css('--line'), bg:ML.css('--plotbg'), card:ML.css('--card'),
  c1:ML.css('--c1'), c2:ML.css('--c2'), c3:ML.css('--c3'), c4:ML.css('--c4'), c5:ML.css('--c5'), c6:ML.css('--c6'), star:ML.css('--star'),
  dark: matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme!=='light' || document.documentElement.dataset.theme==='dark' }; };
ML.SERIES = ['#7c3aed','#0891b2','#e11d48','#ea580c','#16a34a','#db2777','#ca8a04','#2563eb','#9333ea','#0d9488'];
const themeCbs=[]; ML.onTheme = cb => themeCbs.push(cb);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>themeCbs.forEach(f=>f()));

/* ---------------- canvas plot ---------------- */
class Plot{
  constructor(host, opts={}){
    this.host = typeof host==='string' ? document.querySelector(host) : host;
    this.cv = document.createElement('canvas'); this.host.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d'); this.b = Object.assign({}, opts.bounds || ML.BOUNDS); this.pad = opts.pad ?? 0;
    this.equal = opts.equal !== false; this.onResize = null; this.w=0; this.h=0;
    this._ro = new ResizeObserver(()=>{ if(this.resize()) this.onResize && this.onResize(); }); this._ro.observe(this.host); this.resize();
  }
  resize(){ const r=this.host.getBoundingClientRect(), dpr=Math.min(2, window.devicePixelRatio||1);
    if(Math.abs(Math.max(10,r.width)-this.w)<0.5 && Math.abs(Math.max(10,r.height)-this.h)<0.5 && dpr===this.dpr) return false;
    this.w=Math.max(10,r.width); this.h=Math.max(10,r.height); this.cv.width=Math.round(this.w*dpr); this.cv.height=Math.round(this.h*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0); this.dpr=dpr; this.fit(); return true; }
  setBounds(b){ this.b=Object.assign({}, b); this.fit(); }
  fit(){ // effective view: keep aspect equal if requested
    let {x0,x1,y0,y1}=this.b; if(this.equal){ const sx=(x1-x0)/this.w, sy=(y1-y0)/this.h;
      if(sx>sy){ const c=(y0+y1)/2, hh=sx*this.h/2; y0=c-hh; y1=c+hh; } else { const c=(x0+x1)/2, hw=sy*this.w/2; x0=c-hw; x1=c+hw; } }
    this.v={x0,x1,y0,y1}; }
  X(x){ return (x-this.v.x0)/(this.v.x1-this.v.x0)*this.w; }
  Y(y){ return this.h-(y-this.v.y0)/(this.v.y1-this.v.y0)*this.h; }
  ix(px){ return this.v.x0+px/this.w*(this.v.x1-this.v.x0); }
  iy(py){ return this.v.y0+(this.h-py)/this.h*(this.v.y1-this.v.y0); }
  clear(){ const c=this.ctx, P=ML.palette(); c.clearRect(0,0,this.w,this.h); c.fillStyle=P.bg; c.fillRect(0,0,this.w,this.h); }
  grid(step=1, labels=false, stepY){ const sy=stepY||step; const c=this.ctx, P=ML.palette(); c.save(); c.strokeStyle=P.line; c.lineWidth=1; c.globalAlpha=.7;
    for(let x=Math.ceil(this.v.x0/step)*step;x<=this.v.x1;x+=step){ c.beginPath(); c.moveTo(this.X(x)+.5,0); c.lineTo(this.X(x)+.5,this.h); c.stroke(); }
    for(let y=Math.ceil(this.v.y0/sy)*sy;y<=this.v.y1;y+=sy){ c.beginPath(); c.moveTo(0,this.Y(y)+.5); c.lineTo(this.w,this.Y(y)+.5); c.stroke(); }
    c.globalAlpha=1; c.strokeStyle=P.muted; c.globalAlpha=.35; c.beginPath(); c.moveTo(this.X(0),0); c.lineTo(this.X(0),this.h); c.moveTo(0,this.Y(0)); c.lineTo(this.w,this.Y(0)); c.stroke(); c.restore();
    if(labels){ c.save(); c.fillStyle=P.muted; c.font='11px Inter,system-ui'; c.globalAlpha=.9;
      for(let x=Math.ceil(this.v.x0/step)*step;x<=this.v.x1;x+=step) if(Math.abs(x)>1e-9) c.fillText(+x.toFixed(6), this.X(x)+3, this.h-4);
      for(let y=Math.ceil(this.v.y0/sy)*sy;y<=this.v.y1;y+=sy) if(Math.abs(y)>1e-9) c.fillText(+y.toFixed(6), 3, this.Y(y)-3); c.restore(); } }
  /* fn(x,y) -> probability of class 1 in [0,1]. res = css px per cell */
  regions(fn, res=5, strength=1){ const P=ML.palette(), k0=ML.rgb(P.k0), k1=ML.rgb(P.k1), bg=ML.rgb(P.bg);
    const gw=Math.ceil(this.w/res)+1, gh=Math.ceil(this.h/res)+1, off=document.createElement('canvas'); off.width=gw; off.height=gh;
    const oc=off.getContext('2d'), img=oc.createImageData(gw,gh), d=img.data; const base=P.dark?0.20:0.16, span=P.dark?0.32:0.30;
    for(let j=0;j<gh;j++){ const y=this.iy(j*res); for(let i=0;i<gw;i++){ const x=this.ix(i*res); let p=fn(x,y); if(!(p>=0)) p=0.5; if(p>1)p=1;
      const col=p>=0.5?k1:k0, a=strength*(base+span*Math.abs(2*p-1)), o=4*(j*gw+i);
      d[o]=bg[0]*(1-a)+col[0]*a; d[o+1]=bg[1]*(1-a)+col[1]*a; d[o+2]=bg[2]*(1-a)+col[2]*a; d[o+3]=255; } }
    oc.putImageData(img,0,0); const c=this.ctx; c.save(); c.imageSmoothingEnabled=true; c.drawImage(off,0,0,gw,gh,0,0,(gw-1)*res+res,(gh-1)*res+res); c.restore(); }
  /* marching squares on fn at a given level */
  contour(fn, level=0, style={}){ const res=style.res||5, gw=Math.ceil(this.w/res)+1, gh=Math.ceil(this.h/res)+1, V=new Float64Array(gw*gh);
    for(let j=0;j<gh;j++) for(let i=0;i<gw;i++) V[j*gw+i]=fn(this.ix(i*res),this.iy(j*res))-level;
    const c=this.ctx; c.save(); c.strokeStyle=style.color||ML.palette().ink; c.lineWidth=style.width||2; if(style.dash) c.setLineDash(style.dash); c.globalAlpha=style.alpha??1; c.lineCap='round'; c.beginPath();
    const lerp=(a,b)=>a/(a-b);
    for(let j=0;j<gh-1;j++) for(let i=0;i<gw-1;i++){ const a=V[j*gw+i], b=V[j*gw+i+1], cc=V[(j+1)*gw+i+1], dd=V[(j+1)*gw+i];
      const pts=[]; const x=i*res, y=j*res;
      if((a>0)!==(b>0)) pts.push([x+res*lerp(a,b), y]); if((b>0)!==(cc>0)) pts.push([x+res, y+res*lerp(b,cc)]);
      if((dd>0)!==(cc>0)) pts.push([x+res*lerp(dd,cc), y+res]); if((a>0)!==(dd>0)) pts.push([x, y+res*lerp(a,dd)]);
      if(pts.length>=2){ c.moveTo(pts[0][0],pts[0][1]); c.lineTo(pts[1][0],pts[1][1]); } if(pts.length===4){ c.moveTo(pts[2][0],pts[2][1]); c.lineTo(pts[3][0],pts[3][1]); } }
    c.stroke(); c.restore(); }
  points(X, y, o={}){ const c=this.ctx, P=ML.palette(); const r0=o.r||4.5; c.save();
    for(let i=0;i<X.length;i++){ if(o.skip && o.skip(i)) continue; const px=this.X(X[i][0]), py=this.Y(X[i][1]); const r = o.size ? o.size(i) : r0;
      c.beginPath(); c.arc(px,py,r,0,7); c.fillStyle = o.color ? o.color(i) : (y[i]?P.k1:P.k0); c.globalAlpha = o.alpha ? o.alpha(i) : 1; c.fill();
      c.lineWidth = o.test && o.test(i) ? 2 : 1.4; c.strokeStyle = o.test && o.test(i) ? P.ink : (P.dark?'#0b0d19':'#fff'); c.stroke();
      if(o.test && o.test(i)){ c.fillStyle=P.dark?'#0b0d19':'#fff'; c.beginPath(); c.arc(px,py,r*0.4,0,7); c.fill(); }
      if(o.ring && o.ring(i)){ c.globalAlpha=1; c.beginPath(); c.arc(px,py,r+4,0,7); c.lineWidth=2.2; c.strokeStyle=typeof o.ring(i)==='string'?o.ring(i):P.ink; c.stroke(); }
      if(o.cross && o.cross(i)){ c.globalAlpha=1; c.strokeStyle=P.ink; c.lineWidth=2; const s=r+2; c.beginPath(); c.moveTo(px-s,py-s); c.lineTo(px+s,py+s); c.moveTo(px+s,py-s); c.lineTo(px-s,py+s); c.stroke(); } }
    c.restore(); }
  line(x0,y0,x1,y1, style={}){ const c=this.ctx; c.save(); c.strokeStyle=style.color||ML.palette().ink; c.lineWidth=style.width||2; c.globalAlpha=style.alpha??1; if(style.dash) c.setLineDash(style.dash);
    c.beginPath(); c.moveTo(this.X(x0),this.Y(y0)); c.lineTo(this.X(x1),this.Y(y1)); c.stroke(); c.restore(); }
  /* infinite line a*x + b*y + c = 0 */
  hline(a,b,cc,style){ const {x0,x1,y0,y1}=this.v; if(Math.abs(b)>Math.abs(a)){ this.line(x0,-(a*x0+cc)/b,x1,-(a*x1+cc)/b,style); } else if(Math.abs(a)>1e-12){ this.line(-(b*y0+cc)/a,y0,-(b*y1+cc)/a,y1,style); } }
  arrow(x0,y0,x1,y1,style={}){ const c=this.ctx, X0=this.X(x0),Y0=this.Y(y0),X1=this.X(x1),Y1=this.Y(y1), a=Math.atan2(Y1-Y0,X1-X0), h=style.head||10;
    c.save(); c.strokeStyle=c.fillStyle=style.color||ML.palette().ink; c.lineWidth=style.width||2.5; c.lineCap='round';
    c.beginPath(); c.moveTo(X0,Y0); c.lineTo(X1-Math.cos(a)*h*.6,Y1-Math.sin(a)*h*.6); c.stroke();
    c.beginPath(); c.moveTo(X1,Y1); c.lineTo(X1-h*Math.cos(a-.4),Y1-h*Math.sin(a-.4)); c.lineTo(X1-h*Math.cos(a+.4),Y1-h*Math.sin(a+.4)); c.closePath(); c.fill(); c.restore(); }
  text(s,x,y,style={}){ const c=this.ctx; c.save(); c.font=style.font||'600 12px Inter,system-ui'; c.fillStyle=style.color||ML.palette().ink; c.textAlign=style.align||'left'; c.textBaseline=style.base||'alphabetic';
    if(style.halo){ c.lineWidth=4; c.strokeStyle=ML.palette().bg; c.strokeText(s,this.X(x)+(style.dx||0),this.Y(y)+(style.dy||0)); }
    c.fillText(s,this.X(x)+(style.dx||0),this.Y(y)+(style.dy||0)); c.restore(); }
  /* covariance ellipse: k standard deviations */
  ellipse(mu, S, k, style={}){ const e=LA.eigSym(S), c=this.ctx; const ang=Math.atan2(e.vectors[0][1],e.vectors[0][0]);
    c.save(); c.beginPath(); for(let t=0;t<=64;t++){ const th=t/64*2*Math.PI, a=k*Math.sqrt(Math.max(0,e.values[0]))*Math.cos(th), b=k*Math.sqrt(Math.max(0,e.values[1]))*Math.sin(th);
      const x=mu[0]+a*Math.cos(ang)-b*Math.sin(ang), y=mu[1]+a*Math.sin(ang)+b*Math.cos(ang); t?c.lineTo(this.X(x),this.Y(y)):c.moveTo(this.X(x),this.Y(y)); }
    c.closePath(); if(style.fill){ c.fillStyle=style.fill; c.globalAlpha=style.fillAlpha??.12; c.fill(); c.globalAlpha=1; }
    c.strokeStyle=style.color||ML.palette().ink; c.lineWidth=style.width||2; if(style.dash) c.setLineDash(style.dash); c.stroke(); c.restore(); }
  /* pointer helpers: handlers receive world coordinates */
  pointer(h){ const el=this.cv; let down=false; /* only plots you can drag block page scrolling on touch screens */ this.host.style.touchAction = h.move ? 'none' : 'manipulation'; const pos=e=>{ const r=el.getBoundingClientRect(); return [this.ix(e.clientX-r.left), this.iy(e.clientY-r.top), e.clientX-r.left, e.clientY-r.top]; };
    el.addEventListener('pointerdown',e=>{ down=true; el.setPointerCapture(e.pointerId); h.down&&h.down(...pos(e),e); });
    el.addEventListener('pointermove',e=>{ if(down) h.move&&h.move(...pos(e),e); else h.hover&&h.hover(...pos(e),e); });
    el.addEventListener('pointerup',e=>{ if(down){down=false; h.up&&h.up(...pos(e),e);} });
    el.addEventListener('pointerleave',()=>{ h.leave&&h.leave(); });
    el.addEventListener('contextmenu',e=>{ if(h.context){ e.preventDefault(); h.context(...pos(e),e);} }); }
  nearest(X, px, py, maxPx=12){ let best=-1, bd=maxPx*maxPx; for(let i=0;i<X.length;i++){ const dx=this.X(X[i][0])-px, dy=this.Y(X[i][1])-py, d=dx*dx+dy*dy; if(d<bd){bd=d;best=i;} } return best; }
}
ML.Plot = Plot;

/* simple line chart for curves (loss, accuracy, paths) */
ML.chart = function(plot, series, o={}){
  const P=ML.palette(), c=plot.ctx; plot.clear();
  let xs=[], ys=[]; series.forEach(s=>{ s.pts.forEach(p=>{ if(isFinite(p[0])&&isFinite(p[1])){xs.push(p[0]); ys.push(p[1]);} }); });
  if(!xs.length) return; let x0=o.x0??Math.min(...xs), x1=o.x1??Math.max(...xs), y0=o.y0??Math.min(...ys), y1=o.y1??Math.max(...ys);
  if(o.logx){ x0=Math.log10(x0); x1=Math.log10(x1); } if(y1-y0<1e-9){ y0-=1; y1+=1; } if(x1-x0<1e-9){x0-=1;x1+=1;}
  const L=44,R=10,T=12,B=28, W=plot.w-L-R, H=plot.h-T-B; const fx=x=>L+((o.logx?Math.log10(x):x)-x0)/(x1-x0)*W, fy=y=>T+H-(y-y0)/(y1-y0)*H;
  c.save(); c.font='11px Inter,system-ui'; c.fillStyle=P.muted; c.strokeStyle=P.line; c.lineWidth=1;
  const ticks=(a,b,n)=>{ const st=Math.pow(10,Math.floor(Math.log10((b-a)/n))), m=[1,2,5,10].find(k=>(b-a)/(k*st)<=n)*st; const t=[]; for(let v=Math.ceil(a/m)*m; v<=b+1e-9; v+=m) t.push(+v.toFixed(10)); return t; };
  ticks(y0,y1,5).forEach(v=>{ const Y=fy(v); c.beginPath(); c.moveTo(L,Y+.5); c.lineTo(L+W,Y+.5); c.stroke(); c.textAlign='right'; c.fillText(o.yfmt?o.yfmt(v):+v.toPrecision(3), L-5, Y+4); });
  (o.logx ? (()=>{ const t=[]; for(let e=Math.ceil(x0);e<=x1;e++) t.push(Math.pow(10,e)); return t; })() : ticks(x0,x1,6)).forEach(v=>{ const X=fx(v); c.textAlign='center'; c.fillText(o.logx?('1e'+Math.round(Math.log10(v))):+v.toPrecision(4), X, T+H+16); });
  if(o.xl){ c.textAlign='right'; c.fillText(o.xl, L+W, T+H+26-1); }
  if(o.vline!==undefined){ c.strokeStyle=P.ink; c.setLineDash([4,4]); c.beginPath(); c.moveTo(fx(o.vline),T); c.lineTo(fx(o.vline),T+H); c.stroke(); c.setLineDash([]); }
  series.forEach(s=>{ c.strokeStyle=s.color; c.fillStyle=s.color; c.lineWidth=s.width||2; if(s.dash) c.setLineDash(s.dash); else c.setLineDash([]);
    if(s.dots){ s.pts.forEach(p=>{ c.beginPath(); c.arc(fx(p[0]),fy(p[1]),s.r||3,0,7); c.fill(); }); }
    if(!s.noline){ c.beginPath(); let st=false; s.pts.forEach(p=>{ if(!isFinite(p[1])) return; const X=fx(p[0]),Y=fy(Math.max(y0,Math.min(y1,p[1]))); st?c.lineTo(X,Y):c.moveTo(X,Y); st=true; }); c.stroke(); } });
  c.restore(); return {fx,fy};
};

/* ---------------- UI helpers ---------------- */
ML.bindRange = function(id, cb, fmt){ const el=document.getElementById(id), out=document.getElementById(id+'Out'); const f=fmt||(v=>v);
  const upd=()=>{ if(out) out.textContent=f(+el.value); }; el.addEventListener('input',()=>{ upd(); cb(+el.value); }); upd(); return el; };
ML.bindSeg = function(el, cb){ el=typeof el==='string'?document.getElementById(el):el; el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||!el.contains(b)) return;
  el.querySelectorAll('button').forEach(x=>{x.classList.toggle('on',x===b); x.setAttribute('aria-checked', x===b);}); cb(b.dataset.v); }); return el; };
ML.setSeg = function(el, v){ el=typeof el==='string'?document.getElementById(el):el; el.querySelectorAll('button').forEach(x=>{x.classList.toggle('on',x.dataset.v===v); x.setAttribute('aria-checked', x.dataset.v===v);}); };
/* dataset picker with tiny previews */
ML.datasetPicker = function(el, current, cb, list){ el=typeof el==='string'?document.getElementById(el):el; list=list||ML.DATASETS.map(d=>d.id); el.innerHTML='';
  list.forEach(id=>{ const d=ML.DATASETS.find(x=>x.id===id); const b=document.createElement('button'); b.type='button'; b.className='dsbtn'+(id===current?' on':''); b.title=d.desc; b.dataset.v=id;
    const cv=document.createElement('canvas'); cv.width=108; cv.height=108; b.appendChild(cv); b.appendChild(document.createTextNode(d.name)); el.appendChild(b);
    const draw=()=>{ const P=ML.palette(), c=cv.getContext('2d'), data=ML.dataset(id,160,0.25,3); c.fillStyle=P.bg; c.fillRect(0,0,108,108);
      data.X.forEach((x,i)=>{ c.fillStyle=data.y[i]?P.k1:P.k0; c.beginPath(); c.arc(54+x[0]*16,54-x[1]*16,2.6,0,7); c.fill(); }); };
    draw(); ML.onTheme(draw); b.addEventListener('click',()=>{ el.querySelectorAll('.dsbtn').forEach(x=>x.classList.toggle('on',x===b)); cb(id); }); });
};

/* ---------------- maths (KaTeX) ---------------- */
ML.tex = function(s, display){ try { return katex.renderToString(s, {displayMode:!!display, throwOnError:false}); } catch(e){ return s; } };
ML.renderMath = function(root){ if(!window.renderMathInElement) return; renderMathInElement(root||document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}], throwOnError:false}); };

/* ---------------- site nav ---------------- */
ML.PAGES = [
  ['linear-regression','Linear Regression'],['logistic-regression','Logistic'],['lda-gda','LDA / GDA'],['svm','SVM'],
  ['decision-trees','Decision Trees'],['ensembles','Bagging & Boosting'],['pca','PCA'],['regularisation','L1 / L2'],['compare','Compare all'] ];
ML.nav = function(cur){ const n=document.getElementById('algnav'); if(!n) return; const base = cur==='hub' ? '' : '../';
  n.innerHTML = `<a href="${base}"${cur==='hub'?' class="on"':''}>All</a>` + ML.PAGES.map(([id,t])=>`<a href="${base}${id}/"${id===cur?' class="on" aria-current="page"':''}>${t}</a>`).join('');
  const on=n.querySelector('.on'); if(on) requestAnimationFrame(()=>{ n.scrollLeft = on.offsetLeft - n.clientWidth/2 + on.offsetWidth/2; }); };

/* run fn after fonts/katex are ready */
ML.ready = function(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn); else fn(); };
})();

/* load the pseudocode animations when a page has pseudocode */
(function(){ var me=document.currentScript; if(!me) return; var src=me.src.replace(/core\.js(\?.*)?$/,'algoanim.js');
  ML.ready(function(){ if(!document.querySelector('.algo')) return; var s=document.createElement('script'); s.src=src; s.onload=function(){ window.AlgoAnim && AlgoAnim.init(); }; document.body.appendChild(s); }); })();
