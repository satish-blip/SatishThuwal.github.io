/* Tiny recurrent-network engine: vanilla RNN, LSTM and GRU cells with full backpropagation through time.
   Needs ml/assets/core.js (ML.rng) and dl/assets/nn.js (NN.applyOpt). Exposes window.SEQ. */
(function(){
'use strict';
const SEQ = window.SEQ = {};
const sig = x => 1/(1+Math.exp(-x));
const mat = (r,c,rng,s) => { const a=new Float64Array(r*c); for(let i=0;i<a.length;i++) a[i]=rng.gauss()*s; return a; };
/* y += M x  (M rows x cols, row-major) */
function mv(M, x, rows, cols, y){ for(let i=0;i<rows;i++){ let s=0; const o=i*cols; for(let k=0;k<cols;k++) s+=M[o+k]*x[k]; y[i]+=s; } return y; }
/* y += M^T d */
function mtv(M, d, rows, cols, y){ for(let i=0;i<rows;i++){ const g=d[i]; if(!g) continue; const o=i*cols; for(let k=0;k<cols;k++) y[k]+=M[o+k]*g; } return y; }
/* G += d x^T */
function outer(G, d, x, rows, cols){ for(let i=0;i<rows;i++){ const g=d[i]; if(!g) continue; const o=i*cols; for(let k=0;k<cols;k++) G[o+k]+=g*x[k]; } }

/* type: 'rnn' | 'lstm' | 'gru' */
SEQ.make = function(type, o){
  const nin=o.nin, nh=o.nh, nout=o.nout, rng=ML.rng(o.seed||1), G = type==='lstm'?4:type==='gru'?3:1;
  const m = { type, nin, nh, nout, G,
    Wx: mat(G*nh, nin, rng, Math.sqrt(1/nin)), Wh: mat(G*nh, nh, rng, Math.sqrt(1/nh)*(o.hScale??1)), b: new Float64Array(G*nh),
    bh: new Float64Array(G*nh), Wy: mat(nout, nh, rng, Math.sqrt(1/nh)), by: new Float64Array(nout), step:0 };
  if(type==='lstm') for(let j=nh;j<2*nh;j++) m.b[j]=1;           /* forget-gate bias 1: remember by default */
  const names=['Wx','Wh','b','bh','Wy','by']; names.forEach(n=>m['g'+n]=new Float64Array(m[n].length));
  m.params = () => names.filter(n=>type==='gru'||n!=='bh').map(n=>[m[n], m['g'+n], n[0]==='W'?1:0]);
  m.count = () => m.params().reduce((s,p)=>s+p[0].length,0);
  m.zero = () => names.forEach(n=>m['g'+n].fill(0));

  /* forward over a sequence of input vectors; returns per-step hidden states, logits and cache */
  m.run = function(xs){ let h=new Float64Array(nh), c=new Float64Array(nh); const steps=[];
    for(const x of xs){ const s={x, hp:h, cp:c};
      if(type==='rnn'){ const a=mv(m.Wx,x,nh,nin,Float64Array.from(m.b)); mv(m.Wh,h,nh,nh,a); h=a.map(Math.tanh); }
      else if(type==='lstm'){ const z=mv(m.Wx,x,4*nh,nin,Float64Array.from(m.b)); mv(m.Wh,h,4*nh,nh,z);
        const i=new Float64Array(nh), f=new Float64Array(nh), g=new Float64Array(nh), oo=new Float64Array(nh), cn=new Float64Array(nh), tc=new Float64Array(nh), hn=new Float64Array(nh);
        for(let j=0;j<nh;j++){ i[j]=sig(z[j]); f[j]=sig(z[nh+j]); g[j]=Math.tanh(z[2*nh+j]); oo[j]=sig(z[3*nh+j]); cn[j]=f[j]*c[j]+i[j]*g[j]; tc[j]=Math.tanh(cn[j]); hn[j]=oo[j]*tc[j]; }
        Object.assign(s,{i,f,g,o:oo,tc}); c=cn; h=hn; }
      else { const ax=mv(m.Wx,x,3*nh,nin,Float64Array.from(m.b)), ah=mv(m.Wh,h,3*nh,nh,Float64Array.from(m.bh));
        const r=new Float64Array(nh), zz=new Float64Array(nh), n=new Float64Array(nh), hn=new Float64Array(nh);
        for(let j=0;j<nh;j++){ r[j]=sig(ax[j]+ah[j]); zz[j]=sig(ax[nh+j]+ah[nh+j]); n[j]=Math.tanh(ax[2*nh+j]+r[j]*ah[2*nh+j]); hn[j]=(1-zz[j])*n[j]+zz[j]*h[j]; }
        Object.assign(s,{r,z:zz,n,ahn:ah.slice(2*nh)}); h=hn; }
      s.h=h; s.c=c; s.y=mv(m.Wy,h,nout,nh,Float64Array.from(m.by)); steps.push(s); }
    return steps; };

  /* backward: dys[t] = dLoss/dlogits at step t (or null). Accumulates gradients; returns ||dL/dh_t|| per step */
  m.back = function(steps, dys){ const T=steps.length; let dhn=new Float64Array(nh), dcn=new Float64Array(nh); const norms=new Array(T).fill(0);
    for(let t=T-1;t>=0;t--){ const s=steps[t], dh=Float64Array.from(dhn);
      if(dys[t]){ outer(m.gWy,dys[t],s.h,nout,nh); for(let k=0;k<nout;k++) m.gby[k]+=dys[t][k]; mtv(m.Wy,dys[t],nout,nh,dh); }
      norms[t]=Math.hypot(...dh);
      if(type==='rnn'){ const da=dh.map((v,j)=>v*(1-s.h[j]*s.h[j])); outer(m.gWx,da,s.x,nh,nin); outer(m.gWh,da,s.hp,nh,nh); for(let j=0;j<nh;j++) m.gb[j]+=da[j]; dhn=mtv(m.Wh,da,nh,nh,new Float64Array(nh)); }
      else if(type==='lstm'){ const dz=new Float64Array(4*nh), dc=new Float64Array(nh);
        for(let j=0;j<nh;j++){ const doo=dh[j]*s.tc[j]; dc[j]=dcn[j]+dh[j]*s.o[j]*(1-s.tc[j]*s.tc[j]);
          dz[j]=dc[j]*s.g[j]*s.i[j]*(1-s.i[j]); dz[nh+j]=dc[j]*s.cp[j]*s.f[j]*(1-s.f[j]); dz[2*nh+j]=dc[j]*s.i[j]*(1-s.g[j]*s.g[j]); dz[3*nh+j]=doo*s.o[j]*(1-s.o[j]); }
        outer(m.gWx,dz,s.x,4*nh,nin); outer(m.gWh,dz,s.hp,4*nh,nh); for(let j=0;j<4*nh;j++) m.gb[j]+=dz[j];
        dhn=mtv(m.Wh,dz,4*nh,nh,new Float64Array(nh)); dcn=dc.map((v,j)=>v*s.f[j]); }
      else { const dax=new Float64Array(3*nh), dah=new Float64Array(3*nh), dhp=new Float64Array(nh);
        for(let j=0;j<nh;j++){ const dn=dh[j]*(1-s.z[j]), dzz=dh[j]*(s.hp[j]-s.n[j]); dhp[j]=dh[j]*s.z[j];
          const dan=dn*(1-s.n[j]*s.n[j]); dax[2*nh+j]=dan; dah[2*nh+j]=dan*s.r[j]; const dr=dan*s.ahn[j];
          const dar=dr*s.r[j]*(1-s.r[j]), daz=dzz*s.z[j]*(1-s.z[j]); dax[j]=dar; dah[j]=dar; dax[nh+j]=daz; dah[nh+j]=daz; }
        outer(m.gWx,dax,s.x,3*nh,nin); outer(m.gWh,dah,s.hp,3*nh,nh); for(let j=0;j<3*nh;j++){ m.gb[j]+=dax[j]; m.gbh[j]+=dah[j]; }
        dhn=mtv(m.Wh,dah,3*nh,nh,dhp); } }
    return norms; };

  /* one optimiser step with global-norm gradient clipping */
  m.update = function(opt, clip){ const P=m.params(); if(!m.state) m.state=P.map(p=>({m:new Float64Array(p[0].length),v:new Float64Array(p[0].length)})); m.step++;
    if(clip){ let n2=0; P.forEach(p=>{ for(const v of p[1]) n2+=v*v; }); const n=Math.sqrt(n2); m.lastGradNorm=n; if(n>clip) P.forEach(p=>{ for(let i=0;i<p[1].length;i++) p[1][i]*=clip/n; }); }
    P.forEach(([w,g],k)=>NN.applyOpt(opt,w,g,m.state[k],m.step)); };
  return m;
};

/* binary classification from the last hidden state; returns mean loss and accuracy over the batch */
SEQ.trainLast = function(m, batch, opt, clip){ m.zero(); let L=0, ok=0; const n=batch.length, norms=new Array(batch[0].xs.length).fill(0);
  batch.forEach(({xs,y})=>{ const st=m.run(xs), z=st[st.length-1].y[0], p=sig(z); L+= y? -Math.log(Math.max(p,1e-12)) : -Math.log(Math.max(1-p,1e-12)); if((p>0.5)===(y===1)) ok++;
    const dys=new Array(xs.length).fill(null); dys[xs.length-1]=Float64Array.of((p-y)/n); m.back(st,dys).forEach((v,t)=>norms[t]+=v/n); });
  if(opt) m.update(opt, clip); return {loss:L/n, acc:ok/n, norms}; };
SEQ.predictLast = (m, xs) => sig(m.run(xs).at(-1).y[0]);

/* softmax cross-entropy at every step (language modelling): targets[t] is a class index */
SEQ.trainLM = function(m, xs, targets, opt, clip){ m.zero(); const st=m.run(xs); let L=0; const T=xs.length;
  const dys=st.map((s,t)=>{ const mx=Math.max(...s.y), e=s.y.map(v=>Math.exp(v-mx)), Z=e.reduce((a,b)=>a+b,0); L-=Math.log(e[targets[t]]/Z); const d=e.map(v=>v/Z/T); d[targets[t]]-=1/T; return d; });
  m.back(st,dys); if(opt) m.update(opt, clip); return L/T; };
})();
