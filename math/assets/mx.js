/* Shared helpers for the Mathematical concepts pages (needs ml/assets/core.js first) */
(function(){
'use strict';
const ML=window.ML, LA=ML.LA, MX=window.MX={};

/* ---------- drawing ---------- */
/* Draggable vector tips on a Plot. vecs: array of {v:[x,y], color, label, fixed}. onChange() after each move. */
MX.dragVecs=function(plot, vecs, onChange, o={}){
  let cur=-1; const snap=o.snap??0.1, lim=o.lim??9;
  const pick=(x,y)=>{ let best=-1, bd=(o.grab||20)**2; vecs.forEach((d,i)=>{ if(d.fixed) return; const dx=plot.X(d.v[0])-plot.X(x), dy=plot.Y(d.v[1])-plot.Y(y), q=dx*dx+dy*dy; if(q<bd){bd=q;best=i;} }); return best; };
  const set=(x,y)=>{ const r=v=>Math.max(-lim,Math.min(lim,snap?Math.round(v/snap)*snap:v)); vecs[cur].v=[r(x),r(y)]; onChange(cur); };
  plot.pointer({ down:(x,y)=>{ cur=pick(x,y); if(cur<0 && o.free!==false){ cur=vecs.findIndex(d=>!d.fixed); } if(cur>=0) set(x,y); },
    move:(x,y)=>{ if(cur>=0) set(x,y); }, up:()=>{ cur=-1; },
    hover:(x,y)=>{ plot.cv.style.cursor=pick(x,y)>=0?'grab':'crosshair'; } });
  /* keyboard: arrow keys move the first draggable vector, Tab-free */
  plot.host.tabIndex=0; plot.host.setAttribute('role','application');
  plot.host.addEventListener('keydown',e=>{ const k={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key]; if(!k) return; e.preventDefault();
    const i=o.keyIndex?o.keyIndex():vecs.findIndex(d=>!d.fixed); if(i<0) return; cur=i; set(vecs[i].v[0]+k[0]*(snap||0.1), vecs[i].v[1]+k[1]*(snap||0.1)); cur=-1; });
};
/* axes with integer grid, labelled */
MX.axes=function(plot, step=1){ plot.clear(); plot.grid(step, true); };
/* a dot at the tip and a label */
MX.vec=function(plot, v, color, label, o={}){ const from=o.from||[0,0]; plot.arrow(from[0],from[1],from[0]+v[0],from[1]+v[1],{color,width:o.width||3,head:o.head||12,alpha:o.alpha});
  if(label) plot.text(label, from[0]+v[0], from[1]+v[1], {color, font:'italic 600 15px Newsreader,Georgia,serif', dx:8, dy:-8, halo:true}); };
MX.poly=function(plot, pts, fill, alpha=.18, stroke){ const c=plot.ctx; c.save(); c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(plot.X(p[0]),plot.Y(p[1])):c.moveTo(plot.X(p[0]),plot.Y(p[1]))); c.closePath();
  c.globalAlpha=alpha; c.fillStyle=fill; c.fill(); c.globalAlpha=1; if(stroke){ c.strokeStyle=stroke; c.lineWidth=1.5; c.stroke(); } c.restore(); };
MX.rightAngle=function(plot, at, u, w, s=0.22, color){ /* little square at point `at` between unit directions u and w */
  const p=[at[0]+u[0]*s, at[1]+u[1]*s], q=[p[0]+w[0]*s, p[1]+w[1]*s], r=[at[0]+w[0]*s, at[1]+w[1]*s];
  const c=plot.ctx; c.save(); c.strokeStyle=color||ML.palette().muted; c.lineWidth=1.5; c.beginPath(); c.moveTo(plot.X(p[0]),plot.Y(p[1])); c.lineTo(plot.X(q[0]),plot.Y(q[1])); c.lineTo(plot.X(r[0]),plot.Y(r[1])); c.stroke(); c.restore(); };

/* ---------- formatting ---------- */
MX.n=(v,d=2)=>{ if(!isFinite(v)) return '\\infty'; const r=+v.toFixed(d); return (Object.is(r,-0)?0:r).toString(); };
MX.vtex=(v,d=2)=>`\\begin{bmatrix}${v.map(x=>MX.n(x,d)).join('\\\\')}\\end{bmatrix}`;
MX.mtex=(A,d=2)=>`\\begin{bmatrix}${A.map(r=>r.map(x=>MX.n(x,d)).join('&')).join('\\\\')}\\end{bmatrix}`;
MX.set=(id,tex,display)=>{ const el=typeof id==='string'?document.getElementById(id):id; if(el) el.innerHTML=ML.tex(tex,display); };

/* ---------- editable matrix ---------- */
/* MX.matInput(el, A, onChange, {step}) renders a grid of number inputs bound to A (mutated in place). */
MX.matInput=function(el, A, onChange, o={}){ el=typeof el==='string'?document.getElementById(el):el;
  const draw=()=>{ el.className='matin'; el.style.gridTemplateColumns=`repeat(${A[0].length},minmax(0,64px))`;
    el.innerHTML=A.map((r,i)=>r.map((x,j)=>`<input type="number" step="${o.step||0.5}" value="${x}" data-i="${i}" data-j="${j}" aria-label="row ${i+1}, column ${j+1}">`).join('')).join(''); };
  el.addEventListener('input',e=>{ const t=e.target; if(t.tagName!=='INPUT') return; const v=parseFloat(t.value); if(!isFinite(v)) return; A[+t.dataset.i][+t.dataset.j]=v; onChange(); });
  draw(); return {redraw:draw}; };

/* ---------- linear algebra ---------- */
/* row reduction to reduced row echelon form, recording each step (for teaching) */
MX.rref=function(A0, tol=1e-9){ const A=A0.map(r=>r.slice()), m=A.length, n=A[0].length, steps=[], pivots=[]; let r=0;
  for(let c=0;c<n && r<m;c++){ let p=r; for(let i=r+1;i<m;i++) if(Math.abs(A[i][c])>Math.abs(A[p][c])) p=i;
    if(Math.abs(A[p][c])<tol){ for(let i=r;i<m;i++) A[i][c]=0; continue; }
    if(p!==r){ [A[p],A[r]]=[A[r],A[p]]; steps.push({op:`R_${r+1}\\leftrightarrow R_${p+1}`,M:A.map(x=>x.slice()),piv:[r,c]}); }
    const d=A[r][c]; if(Math.abs(d-1)>1e-12){ A[r]=A[r].map(x=>x/d); steps.push({op:`R_${r+1}\\leftarrow R_${r+1}/${MX.n(d)}`,M:A.map(x=>x.slice()),piv:[r,c]}); }
    for(let i=0;i<m;i++){ if(i===r) continue; const f=A[i][c]; if(Math.abs(f)<tol){ A[i][c]=0; continue; } A[i]=A[i].map((x,k)=>{ const v=x-f*A[r][k]; return Math.abs(v)<tol?0:v; });
      steps.push({op:`R_${i+1}\\leftarrow R_${i+1}${f>0?'-':'+'}${MX.n(Math.abs(f))}R_${r+1}`,M:A.map(x=>x.slice()),piv:[r,c]}); }
    pivots.push([r,c]); r++; }
  return {R:A, steps, pivots, rank:pivots.length}; };
MX.rank=(A,tol)=>MX.rref(A,tol).rank;
MX.det=function(A){ const n=A.length, M=A.map(r=>r.slice()); let d=1; for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
  if(Math.abs(M[p][c])<1e-12) return 0; if(p!==c){ [M[p],M[c]]=[M[c],M[p]]; d=-d; } d*=M[c][c]; for(let r=c+1;r<n;r++){ const f=M[r][c]/M[c][c]; for(let k=c;k<n;k++) M[r][k]-=f*M[c][k]; } } return d; };
/* thin SVD for small matrices: eigen-decomposition of A^T A (fine for teaching-sized matrices) */
MX.svd=function(A){ const m=A.length, n=A[0].length, AtA=LA.mul(LA.T(A),A), e=LA.eigSym(AtA);
  const S=e.values.map(l=>Math.sqrt(Math.max(0,l))), V=e.vectors; /* V[i] is the i-th right singular vector */
  const U=V.map((v,i)=>{ const u=LA.mv(A,v), s=S[i]; return s>1e-10?u.map(x=>x/s):new Array(m).fill(0); });
  return {U, S, V}; };   /* A = sum_i S[i] * U[i] V[i]^T */
/* 2x2 eigen (general, possibly complex) */
MX.eig2=function(A){ const a=A[0][0],b=A[0][1],c=A[1][0],d=A[1][1], tr=a+d, det=a*d-b*c, disc=tr*tr/4-det;
  if(disc<-1e-12) return {complex:true, re:tr/2, im:Math.sqrt(-disc)};
  const s=Math.sqrt(Math.max(0,disc)), l=[tr/2+s, tr/2-s];
  const vec=lam=>{ let v=Math.abs(b)>1e-12?[b,lam-a]:Math.abs(c)>1e-12?[lam-d,c]:(Math.abs(lam-a)<1e-12?[1,0]:[0,1]); const nn=Math.hypot(...v); return v.map(x=>x/nn); };
  return {complex:false, values:l, vectors:l.map(vec)}; };
/* Gram-Schmidt QR on columns of A (m x n), recording projections */
MX.qr=function(A){ const m=A.length, n=A[0].length, cols=[...Array(n).keys()].map(j=>A.map(r=>r[j])), Q=[], R=LA.zeros(n,n);
  cols.forEach((a,j)=>{ let v=a.slice(); Q.forEach((q,i)=>{ const r=LA.dot(q,a); R[i][j]=r; v=v.map((x,k)=>x-r*q[k]); }); const nn=Math.hypot(...v); R[j][j]=nn; Q.push(nn>1e-12?v.map(x=>x/nn):v.map(()=>0)); });
  return {Q:A.map((_,i)=>Q.map(q=>q[i])), R}; };
MX.lu=function(A){ const n=A.length, U=A.map(r=>r.slice()), L=LA.eye(n), P=[...Array(n).keys()];
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(U[r][c])>Math.abs(U[p][c])) p=r;
    if(p!==c){ [U[p],U[c]]=[U[c],U[p]]; [P[p],P[c]]=[P[c],P[p]]; for(let k=0;k<c;k++){ [L[p][k],L[c][k]]=[L[c][k],L[p][k]]; } }
    if(Math.abs(U[c][c])<1e-12) continue; for(let r=c+1;r<n;r++){ const f=U[r][c]/U[c][c]; L[r][c]=f; for(let k=c;k<n;k++) U[r][k]-=f*U[c][k]; } }
  return {L,U,P}; };
MX.chol=function(A){ const n=A.length, L=LA.zeros(n,n); for(let i=0;i<n;i++) for(let j=0;j<=i;j++){ let s=A[i][j]; for(let k=0;k<j;k++) s-=L[i][k]*L[j][k];
  if(i===j){ if(s<=1e-12) return null; L[i][i]=Math.sqrt(s); } else L[i][j]=s/L[j][j]; } return L; };

/* ---------- probability and statistics ---------- */
MX.erf=function(x){ const t=1/(1+0.3275911*Math.abs(x)), y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x); return x>=0?y:-y; };
MX.phi=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
MX.Phi=x=>0.5*(1+MX.erf(x/Math.SQRT2));
MX.normPdf=(x,m=0,s=1)=>MX.phi((x-m)/s)/s;
MX.zq=function(p){ /* inverse normal CDF (Acklam) */ const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];
  const pl=0.02425; let q,r; if(p<pl){ q=Math.sqrt(-2*Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if(p>1-pl){ q=Math.sqrt(-2*Math.log(1-p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  q=p-0.5; r=q*q; return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); };
MX.lgamma=function(x){ const g=7, C=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61503916999185,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(x<0.5) return Math.log(Math.PI/Math.abs(Math.sin(Math.PI*x)))-MX.lgamma(1-x); x-=1; let a=C[0]; const t=x+g+0.5; for(let i=1;i<9;i++) a+=C[i]/(x+i); return 0.5*Math.log(2*Math.PI)+(x+0.5)*Math.log(t)-t+Math.log(a); };
/* regularised incomplete beta via continued fraction (Numerical Recipes) */
MX.ibeta=function(x,a,b){ if(x<=0) return 0; if(x>=1) return 1; const bt=Math.exp(MX.lgamma(a+b)-MX.lgamma(a)-MX.lgamma(b)+a*Math.log(x)+b*Math.log(1-x));
  const cf=(x,a,b)=>{ let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap; if(Math.abs(d)<1e-30)d=1e-30; d=1/d; let h=d;
    for(let m=1;m<=200;m++){ const m2=2*m; let aa=m*(b-m)*x/((qam+m2)*(a+m2)); d=1+aa*d; if(Math.abs(d)<1e-30)d=1e-30; c=1+aa/c; if(Math.abs(c)<1e-30)c=1e-30; d=1/d; h*=d*c;
      aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2)); d=1+aa*d; if(Math.abs(d)<1e-30)d=1e-30; c=1+aa/c; if(Math.abs(c)<1e-30)c=1e-30; d=1/d; const del=d*c; h*=del; if(Math.abs(del-1)<3e-12) break; } return h; };
  return x<(a+1)/(a+b+2)? bt*cf(x,a,b)/a : 1-bt*cf(1-x,b,a)/b; };
MX.tCdf=(t,df)=>{ const x=df/(df+t*t), p=0.5*MX.ibeta(x,df/2,0.5); return t>0?1-p:p; };
MX.tPdf=(t,df)=>Math.exp(MX.lgamma((df+1)/2)-MX.lgamma(df/2)-0.5*Math.log(df*Math.PI)-(df+1)/2*Math.log(1+t*t/df));
MX.tq=function(p,df){ let lo=-60,hi=60; for(let i=0;i<100;i++){ const m=(lo+hi)/2; if(MX.tCdf(m,df)<p) lo=m; else hi=m; } return (lo+hi)/2; };
MX.betaPdf=(x,a,b)=>x<=0||x>=1?0:Math.exp((a-1)*Math.log(x)+(b-1)*Math.log(1-x)+MX.lgamma(a+b)-MX.lgamma(a)-MX.lgamma(b));
MX.binom=(k,n,p)=>Math.exp(MX.lgamma(n+1)-MX.lgamma(k+1)-MX.lgamma(n-k+1)+k*Math.log(p||1e-300)+(n-k)*Math.log((1-p)||1e-300));
})();
