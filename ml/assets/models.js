/* ML lab models: every algorithm implemented from scratch in plain JavaScript.
   Classifiers share one interface: model.proba(x) -> P(y = 1 | x) (or a squashed score), model.score(x) -> raw score. */
(function(){
'use strict';
const ML = window.ML, LA = ML.LA;
const M = ML.models = {};

/* ---------- feature standardiser (fit on training data) ---------- */
function Standardizer(F){ const d=F[0].length, mu=new Array(d).fill(0), sd=new Array(d).fill(0);
  for(const f of F) for(let j=0;j<d;j++) mu[j]+=f[j]; for(let j=0;j<d;j++) mu[j]/=F.length;
  for(const f of F) for(let j=0;j<d;j++) sd[j]+=(f[j]-mu[j])**2; for(let j=0;j<d;j++) sd[j]=Math.sqrt(sd[j]/F.length)||1;
  return { mu, sd, t: f => f.map((v,j)=>(v-mu[j])/sd[j]) }; }
M.Standardizer = Standardizer;

/* =====================================================================
   1-D regression: polynomial OLS, ridge and lasso (regression page)
   ===================================================================== */
M.polyReg = function(x, y, o={}){
  const deg=o.degree||1, lam=o.lambda||0, pen=o.penalty||'none';
  const mx=x.reduce((a,b)=>a+b,0)/x.length, sx=Math.sqrt(x.reduce((a,b)=>a+(b-mx)**2,0)/x.length)||1;
  const phi = v => { const z=(v-mx)/sx, r=[]; for(let d=1;d<=deg;d++) r.push(Math.pow(z,d)); return r; };
  const F = x.map(phi), st = Standardizer(F), Z = F.map(st.t), n=x.length, p=deg, ym=y.reduce((a,b)=>a+b,0)/n;
  let w;
  if(pen==='lasso' && lam>0){ // cyclic coordinate descent on (1/2n)||y - Zw||^2 + lam*||w||_1  (columns standardised)
    w=new Array(p).fill(0); const r=y.map(v=>v-ym);
    for(let it=0;it<5000;it++){ let maxd=0; for(let j=0;j<p;j++){ let rho=0; for(let i=0;i<n;i++) rho+=Z[i][j]*(r[i]+Z[i][j]*w[j]); rho/=n;
        const nw = Math.sign(rho)*Math.max(0,Math.abs(rho)-lam); const d=nw-w[j]; if(d){ for(let i=0;i<n;i++) r[i]-=Z[i][j]*d; w[j]=nw; maxd=Math.max(maxd,Math.abs(d)); } }
      if(maxd<1e-9) break; }
  } else { // (Z^T Z + n*lam I) w = Z^T (y - ybar)
    const A=LA.zeros(p,p), b=new Array(p).fill(0); for(let i=0;i<n;i++){ for(let j=0;j<p;j++){ b[j]+=Z[i][j]*(y[i]-ym); for(let k=0;k<p;k++) A[j][k]+=Z[i][j]*Z[i][k]; } }
    const l = pen==='ridge' ? lam*n : 1e-10*n; for(let j=0;j<p;j++) A[j][j]+=l; w = LA.solve(A,b) || new Array(p).fill(0); }
  const f = v => ym + LA.dot(st.t(phi(v)), w);
  return { f, w, b0:ym, degree:deg, phi, st, terms:p };
};
/* OLS with intercept in raw units for the simple (degree 1) case, with inference stats (Tutorial 3) */
M.olsStats = function(x, y){
  const n=x.length, X=x.map(v=>[1,v]), XtX=LA.mul(LA.T(X),X), XtY=LA.mv(LA.T(X),y), beta=LA.solve(XtX,XtY);
  const yh=x.map(v=>beta[0]+beta[1]*v), e=y.map((v,i)=>v-yh[i]), yb=y.reduce((a,b)=>a+b,0)/n;
  const RSS=e.reduce((a,b)=>a+b*b,0), TSS=y.reduce((a,b)=>a+(b-yb)**2,0), MSS=yh.reduce((a,b)=>a+(b-yb)**2,0);
  const s2=RSS/(n-2), C=LA.inv(XtX), se=[Math.sqrt(s2*C[0][0]), Math.sqrt(s2*C[1][1])];
  return {beta, yh, e, RSS, TSS, MSS, R2:1-RSS/TSS, s2, se, t:[beta[0]/se[0], beta[1]/se[1]], XtX, XtY, n, ybar:yb};
};

/* =====================================================================
   Least-squares classifier (linear regression on y in {-1,+1})
   ===================================================================== */
M.LeastSquares = function(X, y, o={}){
  const phi = ML.poly2(o.degree||1), F=X.map(phi), st=Standardizer(F), Z=F.map(f=>[1,...st.t(f)]), d=Z[0].length, t=y.map(v=>v?1:-1);
  const A=LA.zeros(d,d), b=new Array(d).fill(0); for(let i=0;i<Z.length;i++) for(let j=0;j<d;j++){ b[j]+=Z[i][j]*t[i]; for(let k=0;k<d;k++) A[j][k]+=Z[i][j]*Z[i][k]; }
  for(let j=1;j<d;j++) A[j][j]+=(o.lambda||1e-6)*Z.length; const w=LA.solve(A,b)||new Array(d).fill(0);
  const score = x => LA.dot([1,...st.t(phi(x))], w);
  return { name:'Least squares', score, proba: x => Math.min(1,Math.max(0,(score(x)+1)/2)), w };
};

/* =====================================================================
   Logistic regression (gradient descent for the animation, Newton/IRLS for speed)
   ===================================================================== */
M.Logistic = function(X, y, o={}){
  const deg=o.degree||1, lam=o.lambda??1e-4, pen=o.penalty||'l2', phi=ML.poly2(deg), F=X.map(phi), st=Standardizer(F), Z=F.map(f=>[1,...st.t(f)]), n=Z.length, d=Z[0].length;
  const w = new Array(d).fill(0); const l2 = pen==='l2' ? lam : 0, l1 = pen==='l1' ? lam : 0;
  const model = { name:'Logistic regression', w, degree:deg, lambda:lam, penalty:pen, phi, st, feat: x=>[1,...st.t(phi(x))] };
  model.score = x => LA.dot(model.feat(x), w);
  model.proba = x => ML.sigmoid(model.score(x));
  model.loss = () => { let L=0; for(let i=0;i<n;i++){ const z=LA.dot(Z[i],w); L += (y[i]? Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z))); if(!isFinite(L)) L=1e9; } let r=0,a=0; for(let j=1;j<d;j++){ r+=w[j]*w[j]; a+=Math.abs(w[j]); } return L/n + l2*r/2 + l1*a; };
  /* gradient of the smooth part (cross-entropy + L2). With L1 the optimality measure is the prox-gradient, see model.optGap */
  model.grad = () => { const g=new Array(d).fill(0); for(let i=0;i<n;i++){ const e=ML.sigmoid(LA.dot(Z[i],w))-y[i]; for(let j=0;j<d;j++) g[j]+=e*Z[i][j]; } for(let j=0;j<d;j++) g[j]=g[j]/n+(j?l2*w[j]:0); return g; };
  const soft=(v,t)=>Math.sign(v)*Math.max(0,Math.abs(v)-t);
  model.gdStep = (lr) => { const g=model.grad(); for(let j=0;j<d;j++){ w[j]-=lr*g[j]; if(j&&l1) w[j]=soft(w[j],lr*l1); } return g; };
  model.optGap = () => { const g=model.grad(); if(!l1) return Math.sqrt(g.reduce((s,v)=>s+v*v,0)); let s2=0; for(let j=0;j<d;j++){ const nw=j?soft(w[j]-g[j],l1):w[j]-g[j]; s2+=(w[j]-nw)**2; } return Math.sqrt(s2); };
  let lip=null; const lipschitz=()=>{ if(lip) return lip; let v=new Array(d).fill(1), ev=1; for(let it=0;it<60;it++){ const u=new Array(d).fill(0); for(let i=0;i<n;i++){ const t=LA.dot(Z[i],v); for(let j=0;j<d;j++) u[j]+=t*Z[i][j]/n; } ev=Math.sqrt(u.reduce((s,x)=>s+x*x,0)); v=u.map(x=>x/ev); } return lip=0.25*ev+l2+1e-9; };
  model.newton = (iters=30) => { if(l1){ const lr=1/lipschitz(); for(let k=0;k<iters*120;k++) model.gdStep(lr); return model; }
    for(let it=0;it<iters;it++){ const H=LA.zeros(d,d), g=model.grad();
      for(let i=0;i<n;i++){ const p=ML.sigmoid(LA.dot(Z[i],w)), s=p*(1-p)+1e-9; for(let j=0;j<d;j++){ const zj=Z[i][j]*s; for(let k=j;k<d;k++) H[j][k]+=zj*Z[i][k]; } }
      for(let j=0;j<d;j++){ for(let k=j;k<d;k++){ H[j][k]/=n; H[k][j]=H[j][k]; } H[j][j]+= (j?l2:0)+1e-8; }
      const step=LA.solve(H,g); if(!step) break; let mx=0; for(let j=0;j<d;j++){ w[j]-=step[j]; mx=Math.max(mx,Math.abs(step[j])); } if(mx<1e-7) break; } return model; };
  model.Z = Z; return model;
};

/* =====================================================================
   Gaussian discriminant analysis: LDA (shared covariance), QDA (per class), Gaussian naive Bayes (diagonal)
   ===================================================================== */
M.GDA = function(X, y, o={}){
  const type=o.type||'lda', X0=X.filter((_,i)=>!y[i]), X1=X.filter((_,i)=>y[i]);
  const pi1=X1.length/X.length, pi0=1-pi1, mu0=LA.mean(X0), mu1=LA.mean(X1);
  const S0=LA.cov(X0,mu0,X0.length), S1=LA.cov(X1,mu1,X1.length), reg=o.reg??1e-6;
  const Sw=[[ (X0.length*S0[0][0]+X1.length*S1[0][0])/X.length, (X0.length*S0[0][1]+X1.length*S1[0][1])/X.length ],
            [ (X0.length*S0[1][0]+X1.length*S1[1][0])/X.length, (X0.length*S0[1][1]+X1.length*S1[1][1])/X.length ]];
  const sh=o.shrink||0; /* Ledoit-Wolf style shrinkage towards a scaled identity: the L2 / ridge analogue for covariance estimates */
  const addI = S => { const t=(S[0][0]+S[1][1])/2; return [[(1-sh)*S[0][0]+sh*t+reg,(1-sh)*S[0][1]],[(1-sh)*S[1][0],(1-sh)*S[1][1]+sh*t+reg]]; };
  let C0, C1; if(type==='lda'){ C0=C1=addI(Sw); } else if(type==='nb'){ const d0=addI([[S0[0][0],0],[0,S0[1][1]]]), d1=addI([[S1[0][0],0],[0,S1[1][1]]]); C0=d0; C1=d1; } else { C0=addI(S0); C1=addI(S1); }
  const P0=LA.inv2(C0), P1=LA.inv2(C1), ld0=Math.log(LA.det2(C0)), ld1=Math.log(LA.det2(C1));
  const qf=(P,m,x)=>{ const a=x[0]-m[0], b=x[1]-m[1]; return a*(P[0][0]*a+P[0][1]*b)+b*(P[1][0]*a+P[1][1]*b); };
  const delta = (x,k) => k ? -0.5*ld1-0.5*qf(P1,mu1,x)+Math.log(pi1) : -0.5*ld0-0.5*qf(P0,mu0,x)+Math.log(pi0);
  const score = x => delta(x,1)-delta(x,0);
  const m = { name: type==='lda'?'LDA':type==='qda'?'QDA':'Gaussian NB', type, pi0, pi1, mu0, mu1, S0, S1, Sw, C0, C1, delta, score, proba: x=>ML.sigmoid(score(x)) };
  if(type==='lda'){ // linear form w^T x + c
    const P=P0, dm=[mu1[0]-mu0[0],mu1[1]-mu0[1]]; m.w=[P[0][0]*dm[0]+P[0][1]*dm[1], P[1][0]*dm[0]+P[1][1]*dm[1]];
    m.c = -0.5*qf(P,mu1,[0,0]) + 0.5*qf(P,mu0,[0,0]) + Math.log(pi1/pi0); }
  return m;
};

/* =====================================================================
   SVM: dual solved by SMO with LIBSVM's second-order working-set selection
   ===================================================================== */
M.kernel = function(type, o={}){
  const g=o.gamma??1, d=o.degree??3, c0=o.coef0??1;
  if(type==='linear') return (a,b)=>a[0]*b[0]+a[1]*b[1];
  if(type==='poly') return (a,b)=>Math.pow(g*(a[0]*b[0]+a[1]*b[1])+c0, d);
  if(type==='sigmoid') return (a,b)=>Math.tanh(g*(a[0]*b[0]+a[1]*b[1])+c0);
  return (a,b)=>{ const dx=a[0]-b[0], dy=a[1]-b[1]; return Math.exp(-g*(dx*dx+dy*dy)); };
};
M.SVM = function(X, yb, o={}){
  const n=X.length, C=o.C??1, K=M.kernel(o.kernel||'rbf', o), y=yb.map(v=>v?1:-1), eps=o.eps??1e-3, maxIt=o.maxIter??200000;
  const Km=new Float64Array(n*n); for(let i=0;i<n;i++) for(let j=i;j<n;j++){ const k=K(X[i],X[j]); Km[i*n+j]=k; Km[j*n+i]=k; }
  const a=new Float64Array(n), G=new Float64Array(n).fill(-1), TAU=1e-12; let it=0;
  const Q=(i,j)=>y[i]*y[j]*Km[i*n+j];
  const up=t=>(y[t]===1&&a[t]<C)||(y[t]===-1&&a[t]>0), low=t=>(y[t]===1&&a[t]>0)||(y[t]===-1&&a[t]<C);
  for(;it<maxIt;it++){
    let i=-1, Gmax=-Infinity; for(let t=0;t<n;t++) if(up(t)){ const v=-y[t]*G[t]; if(v>=Gmax){Gmax=v;i=t;} }
    let j=-1, Gmin=Infinity, obmin=Infinity;
    for(let t=0;t<n;t++) if(low(t)){ const v=-y[t]*G[t]; if(v<Gmin) Gmin=v; const b=Gmax-v; if(b>0){ let aq=Km[i*n+i]+Km[t*n+t]-2*Km[i*n+t]; if(aq<=0) aq=TAU; const ob=-(b*b)/aq; if(ob<=obmin){obmin=ob;j=t;} } }
    if(i<0||j<0||Gmax-Gmin<eps) break;
    const ai=a[i], aj=a[j];
    if(y[i]!==y[j]){ let qc=Km[i*n+i]+Km[j*n+j]-2*Km[i*n+j]; if(qc<=0) qc=TAU; const delta=(-G[i]-G[j])/qc, diff=a[i]-a[j]; a[i]+=delta; a[j]+=delta;
      if(diff>0){ if(a[j]<0){a[j]=0;a[i]=diff;} } else { if(a[i]<0){a[i]=0;a[j]=-diff;} }
      if(diff>0){ if(a[i]>C){a[i]=C;a[j]=C-diff;} } else { if(a[j]>C){a[j]=C;a[i]=C+diff;} } }
    else { let qc=Km[i*n+i]+Km[j*n+j]-2*Km[i*n+j]; if(qc<=0) qc=TAU; const delta=(G[i]-G[j])/qc, sum=a[i]+a[j]; a[i]-=delta; a[j]+=delta;
      if(sum>C){ if(a[i]>C){a[i]=C;a[j]=sum-C;} } else { if(a[j]<0){a[j]=0;a[i]=sum;} }
      if(sum>C){ if(a[j]>C){a[j]=C;a[i]=sum-C;} } else { if(a[i]<0){a[i]=0;a[j]=sum;} } }
    const dai=a[i]-ai, daj=a[j]-aj; for(let t=0;t<n;t++) G[t]+=Q(t,i)*dai+Q(t,j)*daj;
  }
  // bias (rho) as in LIBSVM
  let ub=Infinity, lb=-Infinity, sf=0, nf=0; for(let t=0;t<n;t++){ const yG=y[t]*G[t];
    if(a[t]>=C){ if(y[t]===-1) ub=Math.min(ub,yG); else lb=Math.max(lb,yG); } else if(a[t]<=0){ if(y[t]===1) ub=Math.min(ub,yG); else lb=Math.max(lb,yG); } else { nf++; sf+=yG; } }
  const rho = nf>0 ? sf/nf : (ub+lb)/2, b=-rho;
  const sv=[]; for(let t=0;t<n;t++) if(a[t]>1e-8) sv.push(t);
  const svX=sv.map(t=>X[t]), svC=sv.map(t=>a[t]*y[t]);
  const score = x => { let s=b; for(let k=0;k<svX.length;k++) s+=svC[k]*K(svX[k],x); return s; };
  const m = { name:'SVM', alpha:Array.from(a), b, sv, C, kernel:o.kernel||'rbf', iters:it, K, score, proba:x=>ML.sigmoid(2.5*score(x)), y };
  if((o.kernel||'rbf')==='linear'){ m.w=[0,0]; sv.forEach(t=>{ m.w[0]+=a[t]*y[t]*X[t][0]; m.w[1]+=a[t]*y[t]*X[t][1]; }); }
  // dual objective and margins
  let dual=0; for(let t=0;t<n;t++) dual+=a[t]; let qq=0; for(const s of sv) for(const u of sv) qq+=a[s]*a[u]*Q(s,u); m.dual=dual-0.5*qq; m.wnorm=Math.sqrt(Math.max(0,qq));
  m.margins = X.map((x,t)=>y[t]*score(x));
  return m;
};

/* =====================================================================
   Decision tree (CART) with sample weights; nodes keep their split order for step-by-step growth
   ===================================================================== */
const imp = {
  gini: (w0,w1) => { const t=w0+w1; if(t<=0) return 0; const p=w1/t; return 2*p*(1-p); },
  entropy: (w0,w1) => { const t=w0+w1; if(t<=0) return 0; const p=w1/t; let h=0; if(p>0) h-=p*Math.log2(p); if(p<1) h-=(1-p)*Math.log2(1-p); return h; },
  error: (w0,w1) => { const t=w0+w1; if(t<=0) return 0; return Math.min(w0,w1)/t; } };
M.impurity = imp;
/* scan every threshold of one feature inside a node; returns sorted candidate list */
M.scanFeature = function(X, y, w, idx, f, crit='gini'){
  const I=idx.slice().sort((a,b)=>X[a][f]-X[b][f]); let L0=0,L1=0,T0=0,T1=0; for(const i of I){ if(y[i]) T1+=w[i]; else T0+=w[i]; }
  const T=T0+T1, parent=imp[crit](T0,T1), out=[];
  for(let k=0;k<I.length-1;k++){ const i=I[k]; if(y[i]) L1+=w[i]; else L0+=w[i]; const a=X[I[k]][f], b=X[I[k+1]][f]; if(b-a<1e-12) continue;
    const R0=T0-L0, R1=T1-L1, wl=(L0+L1)/T, wr=(R0+R1)/T, ch=wl*imp[crit](L0,L1)+wr*imp[crit](R0,R1);
    out.push({thr:(a+b)/2, child:ch, gain:parent-ch, nl:k+1, nr:I.length-k-1, L:[L0,L1], R:[R0,R1]}); }
  return {parent, cands:out};
};
M.Tree = function(X, y, o={}){
  const n=X.length, w=o.weights||new Array(n).fill(1), crit=o.criterion||'gini', maxDepth=o.maxDepth??6, minLeaf=o.minLeaf??1, minGain=o.minGain??1e-9;
  const rng=o.rng||Math.random, maxF=o.maxFeatures||2, idx0=o.idx||[...Array(n).keys()];
  let order=0, nodes=[]; const root={idx:idx0, depth:0, box:{x0:-Infinity,x1:Infinity,y0:-Infinity,y1:Infinity}};
  const queue=[root];
  const summarize = nd => { let w0=0,w1=0,c0=0,c1=0; for(const i of nd.idx){ if(y[i]){w1+=w[i];c1++;} else {w0+=w[i];c0++;} } nd.w=[w0,w1]; nd.count=[c0,c1]; nd.n=nd.idx.length; nd.p=(w0+w1)>0?w1/(w0+w1):0.5; nd.imp=imp[crit](w0,w1); nd.id=nodes.length; nodes.push(nd); };
  summarize(root);
  while(queue.length){ const nd=queue.shift(); nd.leaf=true; if(nd.depth>=maxDepth || nd.n<2*minLeaf || nd.imp<=1e-12) continue;
    let feats=[0,1]; if(maxF<2){ feats=[rng()<0.5?0:1]; }
    let best=null; for(const f of feats){ const s=M.scanFeature(X,y,w,nd.idx,f,crit); for(const c of s.cands){ if(c.nl<minLeaf||c.nr<minLeaf) continue; if(!best||c.gain>best.gain+1e-12) best={...c,f}; } }
    if(!best || best.gain<minGain) continue;
    nd.leaf=false; nd.f=best.f; nd.thr=best.thr; nd.gain=best.gain; nd.order=order++;
    const li=[], ri=[]; for(const i of nd.idx) (X[i][nd.f]<=nd.thr?li:ri).push(i);
    const lb=Object.assign({},nd.box), rb=Object.assign({},nd.box); if(nd.f===0){ lb.x1=nd.thr; rb.x0=nd.thr; } else { lb.y1=nd.thr; rb.y0=nd.thr; }
    nd.left={idx:li, depth:nd.depth+1, box:lb, parent:nd}; nd.right={idx:ri, depth:nd.depth+1, box:rb, parent:nd}; summarize(nd.left); summarize(nd.right); queue.push(nd.left, nd.right); }
  const leafOf = (x, k=Infinity) => { let nd=root; while(!nd.leaf && nd.order<k) nd = x[nd.f]<=nd.thr ? nd.left : nd.right; return nd; };
  const t = { name:'Decision tree', root, nodes, splits:order, leafOf, criterion:crit,
    proba: x => leafOf(x).p, score: x => leafOf(x).p-0.5, probaK: (x,k) => leafOf(x,k).p };
  t.depth = Math.max(...nodes.map(nd=>nd.depth)); t.leaves = nodes.filter(nd=>nd.leaf).length; return t;
};

/* =====================================================================
   Random forest: bootstrap + random feature at each split, soft voting
   ===================================================================== */
M.RandomForest = function(X, y, o={}){
  const n=X.length, T=o.nTrees||25, rng=ML.rng(o.seed||5), trees=[], boots=[];
  for(let t=0;t<T;t++){ const idx=[], cnt=new Array(n).fill(0); for(let i=0;i<n;i++){ const k=rng.int(n); idx.push(k); cnt[k]++; }
    trees.push(M.Tree(X,y,{idx, maxDepth:o.maxDepth??8, minLeaf:o.minLeaf??1, maxFeatures:o.maxFeatures??1, rng, criterion:o.criterion||'gini'})); boots.push(cnt); }
  const probaK = (x,k) => { let s=0; for(let t=0;t<k;t++) s+=trees[t].proba(x); return s/k; };
  const m = { name:'Random forest', trees, boots, probaK, proba: x=>probaK(x,T), score: x=>probaK(x,T)-0.5 };
  m.oob = k => { let c=0, tot=0; for(let i=0;i<n;i++){ let s=0, m2=0; for(let t=0;t<k;t++) if(!boots[t][i]){ s+=trees[t].proba(X[i]); m2++; } if(m2){ tot++; if((s/m2>=0.5?1:0)===y[i]) c++; } } return tot?1-c/tot:NaN; };
  return m;
};

/* =====================================================================
   AdaBoost (discrete, binary) with weighted trees as weak learners
   ===================================================================== */
M.AdaBoost = function(X, y, o={}){
  const n=X.length, T=o.rounds||50, depth=o.depth??1, lr=o.learningRate??1; let w=new Array(n).fill(1/n); const rounds=[], ys=y.map(v=>v?1:-1);
  for(let t=0;t<T;t++){ const tree=M.Tree(X,y,{weights:w, maxDepth:depth, minLeaf:1}); const h=x=>tree.proba(x)>=0.5?1:-1;
    const pred=X.map(h); let err=0; for(let i=0;i<n;i++) if(pred[i]!==ys[i]) err+=w[i];
    err=Math.min(Math.max(err,1e-10),1-1e-10); const alpha=lr*0.5*Math.log((1-err)/err);
    const before=w.slice(); let Z=0; const nw=w.map((wi,i)=>{ const v=wi*Math.exp(-alpha*ys[i]*pred[i]); Z+=v; return v; }); w=nw.map(v=>v/Z);
    rounds.push({tree, h, pred, err, alpha, before, after:w.slice(), Z}); if(err>=0.5-1e-9 && t>0) break; }
  const scoreK = (x,k) => { let s=0; for(let t=0;t<Math.min(k,rounds.length);t++) s+=rounds[t].alpha*rounds[t].h(x); return s; };
  const m = { name:'AdaBoost', rounds, scoreK, probaK:(x,k)=>ML.sigmoid(2*scoreK(x,k)), score:x=>scoreK(x,rounds.length), proba:x=>ML.sigmoid(2*scoreK(x,rounds.length)) };
  return m;
};

/* =====================================================================
   PCA
   ===================================================================== */
M.PCA = function(X, o={}){
  const d=X[0].length, mu=LA.mean(X); let sd=new Array(d).fill(1);
  if(o.standardize){ sd=mu.map((m,j)=>Math.sqrt(X.reduce((s,x)=>s+(x[j]-m)**2,0)/(X.length-1))||1); }
  const Z=X.map(x=>x.map((v,j)=>(v-mu[j])/sd[j])), S=LA.cov(Z,new Array(d).fill(0)), e=LA.eigSym(S), tot=e.values.reduce((a,b)=>a+b,0);
  return { mu, sd, S, values:e.values, vectors:e.vectors, total:tot, ratio:e.values.map(v=>v/tot),
    project:(x,k)=>e.vectors.slice(0,k).map(v=>LA.dot(v,x.map((xi,j)=>(xi-mu[j])/sd[j]))), Z };
};

/* =====================================================================
   Registry used by the comparison page
   ===================================================================== */
ML.ALGOS = [
  {id:'ls', name:'Linear regression (as classifier)', short:'Least squares', page:'linear-regression', fit:(X,y,h)=>M.LeastSquares(X,y,{degree:1})},
  {id:'logreg', name:'Logistic regression (linear)', short:'Logistic', page:'logistic-regression', fit:(X,y,h)=>M.Logistic(X,y,{degree:1,lambda:1e-3}).newton(40)},
  {id:'logpoly', name:'Logistic + polynomial features', short:'Logistic (poly)', page:'logistic-regression', fit:(X,y,h)=>M.Logistic(X,y,{degree:h.polyDeg,lambda:h.logLam}).newton(40)},
  {id:'lda', name:'Linear discriminant analysis', short:'LDA', page:'lda-gda', fit:(X,y)=>M.GDA(X,y,{type:'lda'})},
  {id:'qda', name:'Quadratic discriminant analysis (GDA)', short:'QDA', page:'lda-gda', fit:(X,y)=>M.GDA(X,y,{type:'qda'})},
  {id:'svmlin', name:'SVM, linear kernel', short:'SVM linear', page:'svm', fit:(X,y,h)=>M.SVM(X,y,{kernel:'linear',C:h.C})},
  {id:'svmpoly', name:'SVM, polynomial kernel', short:'SVM poly', page:'svm', fit:(X,y,h)=>M.SVM(X,y,{kernel:'poly',C:h.C,degree:3,gamma:0.5,coef0:1})},
  {id:'svmrbf', name:'SVM, RBF kernel', short:'SVM RBF', page:'svm', fit:(X,y,h)=>M.SVM(X,y,{kernel:'rbf',C:h.C,gamma:h.gamma})},
  {id:'tree', name:'Decision tree (CART)', short:'Tree', page:'decision-trees', fit:(X,y,h)=>M.Tree(X,y,{maxDepth:h.depth})},
  {id:'rf', name:'Random forest', short:'Random forest', page:'ensembles', fit:(X,y,h)=>M.RandomForest(X,y,{nTrees:h.trees,maxDepth:h.depth+2})},
  {id:'ada', name:'AdaBoost (stumps)', short:'AdaBoost', page:'ensembles', fit:(X,y,h)=>M.AdaBoost(X,y,{rounds:h.rounds,depth:1})},
];
})();
