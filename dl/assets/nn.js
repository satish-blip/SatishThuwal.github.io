/* Tiny neural-network engine for the browser: dense layers, activations, optional residual
   connections and Batch/Layer normalisation, full backprop, and the classic optimisers.
   Needs ml/assets/core.js (ML.rng). Exposes window.NN. */
(function(){
'use strict';
const NN = window.NN = {};
const SQ = Math.sqrt(2/Math.PI);
NN.ACT = {
  linear:{f:x=>x, d:(x,y)=>1},
  sigmoid:{f:x=>1/(1+Math.exp(-x)), d:(x,y)=>y*(1-y)},
  tanh:{f:x=>Math.tanh(x), d:(x,y)=>1-y*y},
  relu:{f:x=>x>0?x:0, d:(x,y)=>x>0?1:0},
  leaky:{f:x=>x>0?x:0.1*x, d:(x,y)=>x>0?1:0.1},
  elu:{f:x=>x>0?x:Math.exp(x)-1, d:(x,y)=>x>0?1:y+1},
  gelu:{f:x=>0.5*x*(1+Math.tanh(SQ*(x+0.044715*x*x*x))), d:(x,y)=>{ const u=SQ*(x+0.044715*x*x*x), t=Math.tanh(u); return 0.5*(1+t)+0.5*x*(1-t*t)*SQ*(1+3*0.044715*x*x); }},
  swish:{f:x=>x/(1+Math.exp(-x)), d:(x,y)=>{ const s=1/(1+Math.exp(-x)); return s+x*s*(1-s); }},
  step:{f:x=>x>0?1:0, d:()=>0},
};

/* sizes: [in, h1, ..., out]; opts {act, residual, norm:'none'|'layer'|'batch', seed, init} */
NN.MLP = function(sizes, o={}){
  const rng = ML.rng(o.seed||1), act=NN.ACT[o.act||'tanh'], L=sizes.length-1, layers=[];
  for(let l=0;l<L;l++){ const nin=sizes[l], nout=sizes[l+1], hidden=l<L-1;
    const sc = o.initScale ?? ((o.act==='relu'||o.act==='leaky'||o.act==='gelu'||o.act==='swish'||o.act==='elu') ? Math.sqrt(2/nin) : Math.sqrt(1/nin));
    const W=new Float64Array(nout*nin).map(()=>rng.gauss()*sc*(o.initMul??1)), b=new Float64Array(nout);
    const ly={nin,nout,W,b,gW:new Float64Array(nout*nin),gb:new Float64Array(nout),hidden,res:!!(o.residual&&hidden&&nin===nout&&l>0)};
    if(hidden && o.norm && o.norm!=='none'){ ly.norm=o.norm; ly.g=new Float64Array(nout).fill(1); ly.be=new Float64Array(nout); ly.gg=new Float64Array(nout); ly.gbe=new Float64Array(nout); ly.rm=new Float64Array(nout); ly.rv=new Float64Array(nout).fill(1); }
    layers.push(ly); }
  const net={sizes,layers,act,actName:o.act||'tanh',step:0,opt:null};
  /* forward on batch X (array of arrays). train=true stores caches and batch stats */
  net.forward=function(X, train){ let A=X.map(r=>Float64Array.from(r)); const cache=[];
    for(const ly of layers){ const n=A.length, Z=new Array(n);
      for(let i=0;i<n;i++){ const z=new Float64Array(ly.nout), a=A[i]; for(let j=0;j<ly.nout;j++){ let s=ly.b[j]; const off=j*ly.nin; for(let k=0;k<ly.nin;k++) s+=ly.W[off+k]*a[k]; z[j]=s; } Z[i]=z; }
      if(!ly.hidden){ cache.push({A,Z,ly}); A=Z; break; }
      let Zh=Z, mu, sd;
      if(ly.norm==='layer'){ Zh=Z.map(z=>{ let m=0; for(const v of z) m+=v; m/=z.length; let v2=0; for(const v of z) v2+=(v-m)**2; v2/=z.length; const s=Math.sqrt(v2+1e-5); return z.map(v=>(v-m)/s); }); sd=Z.map(z=>{ let m=0; for(const v of z) m+=v; m/=z.length; let v2=0; for(const v of z) v2+=(v-m)**2; return Math.sqrt(v2/z.length+1e-5); }); }
      else if(ly.norm==='batch'){ mu=new Float64Array(ly.nout); sd=new Float64Array(ly.nout);
        if(train && n>1){ for(const z of Z) for(let j=0;j<ly.nout;j++) mu[j]+=z[j]/n; for(const z of Z) for(let j=0;j<ly.nout;j++) sd[j]+=(z[j]-mu[j])**2/n; for(let j=0;j<ly.nout;j++){ ly.rm[j]=0.9*ly.rm[j]+0.1*mu[j]; ly.rv[j]=0.9*ly.rv[j]+0.1*sd[j]; sd[j]=Math.sqrt(sd[j]+1e-5); } }
        else { for(let j=0;j<ly.nout;j++){ mu[j]=ly.rm[j]; sd[j]=Math.sqrt(ly.rv[j]+1e-5); } }
        Zh=Z.map(z=>z.map((v,j)=>(v-mu[j])/sd[j])); }
      const Zs = ly.norm ? Zh.map(z=>z.map((v,j)=>ly.g[j]*v+ly.be[j])) : Z;
      const H = Zs.map(z=>z.map(act.f));
      const Aout = ly.res ? H.map((h,i)=>h.map((v,j)=>v+A[i][j])) : H;
      cache.push({A,Z,Zh,Zs,H,sd,ly}); A=Aout; }
    if(train) net._cache=cache; return A; };
  net.predict = x => { const z=net.forward([x],false)[0][0]; return 1/(1+Math.exp(-z)); };
  /* per-layer post-activation outputs for a batch (inference mode) */
  net.layerOutputs = (X) => { const saved=net._cache; net.forward(X,true); const c=net._cache; net._cache=saved; return c.map((ci,l)=>l<c.length-1? (c[l+1].A) : ci.Z); };
  /* binary cross-entropy loss + gradients; returns loss */
  net.backward = function(X, y){ const out=net.forward(X,true), n=X.length, cache=net._cache; let loss=0;
    let dA = out.map((z,i)=>{ const p=1/(1+Math.exp(-z[0])); loss+= y[i]? -Math.log(Math.max(p,1e-12)) : -Math.log(Math.max(1-p,1e-12)); return Float64Array.of((p-y[i])/n); });
    net.gradNorms=[];
    for(let l=cache.length-1;l>=0;l--){ const c=cache[l], ly=c.ly; ly.gW.fill(0); ly.gb.fill(0); let dZ;
      if(!ly.hidden){ dZ=dA; }
      else { const dH=dA, dZs=dH.map((d,i)=>d.map((v,j)=>v*act.d(c.Zs[i][j],c.H[i][j])));
        if(ly.norm){ ly.gg.fill(0); ly.gbe.fill(0); for(let i=0;i<n;i++) for(let j=0;j<ly.nout;j++){ ly.gg[j]+=dZs[i][j]*c.Zh[i][j]; ly.gbe[j]+=dZs[i][j]; }
          const dZh=dZs.map(d=>d.map((v,j)=>v*ly.g[j]));
          if(ly.norm==='layer'){ dZ=dZh.map((d,i)=>{ const zh=c.Zh[i], D=d.length; let m1=0,m2=0; for(let j=0;j<D;j++){ m1+=d[j]; m2+=d[j]*zh[j]; } m1/=D; m2/=D; return d.map((v,j)=>(v-m1-zh[j]*m2)/c.sd[i]); }); }
          else { const D=ly.nout, m1=new Float64Array(D), m2=new Float64Array(D); for(let i=0;i<n;i++) for(let j=0;j<D;j++){ m1[j]+=dZh[i][j]/n; m2[j]+=dZh[i][j]*c.Zh[i][j]/n; }
            dZ=dZh.map((d,i)=>d.map((v,j)=>(v-m1[j]-c.Zh[i][j]*m2[j])/c.sd[j])); } }
        else dZ=dZs; }
      for(let i=0;i<n;i++){ const a=c.A[i], dz=dZ[i]; for(let j=0;j<ly.nout;j++){ const g=dz[j]; if(!g) continue; ly.gb[j]+=g; const off=j*ly.nin; for(let k=0;k<ly.nin;k++) ly.gW[off+k]+=g*a[k]; } }
      let gn=0; for(const v of ly.gW) gn+=v*v; net.gradNorms[l]=Math.sqrt(gn);
      if(l>0){ const nd=dZ.map(dz=>{ const da=new Float64Array(ly.nin); for(let j=0;j<ly.nout;j++){ const g=dz[j]; if(!g) continue; const off=j*ly.nin; for(let k=0;k<ly.nin;k++) da[k]+=g*ly.W[off+k]; } return da; });
        dA = ly.res ? nd.map((d,i)=>d.map((v,k)=>v+dA[i][k])) : nd; } }
    net.lastLoss=loss/n; return net.lastLoss; };
  net.params = () => { const P=[]; layers.forEach(ly=>{ P.push([ly.W,ly.gW,1],[ly.b,ly.gb,0]); if(ly.norm) P.push([ly.g,ly.gg,0],[ly.be,ly.gbe,0]); }); return P; };
  net.count = () => net.params().reduce((s,p)=>s+p[0].length,0);
  /* one optimiser step */
  net.update = function(opt){ const P=net.params(); if(!net.state) net.state=P.map(p=>({m:new Float64Array(p[0].length),v:new Float64Array(p[0].length)})); net.step++;
    P.forEach(([w,g,reg],k)=>NN.applyOpt(reg?opt:Object.assign({},opt,{noReg:true}), w, g, net.state[k], net.step)); };
  net.train = function(X,y,opt,iters=1){ let L; for(let i=0;i<iters;i++){ L=net.backward(X,y); net.update(opt); } return L; };
  return net;
};
/* optimiser update on flat arrays (also used for 2-D demos with length-2 arrays) */
NN.applyOpt = function(o, w, g, s, t){ const lr=o.lr, b1=o.beta1??0.9, b2=o.beta2??0.999, eps=1e-8, mu=o.momentum??0.9, wd=o.noReg?0:(o.wd??0), l1=o.noReg?0:(o.l1??0);
  for(let i=0;i<w.length;i++){ let gi=g[i]+wd*w[i]+l1*Math.sign(w[i]);
    switch(o.name){
      case 'sgd': w[i]-=lr*gi; break;
      case 'momentum': s.m[i]=mu*s.m[i]+gi; w[i]-=lr*s.m[i]; break;
      case 'nesterov': { const prev=s.m[i]; s.m[i]=mu*s.m[i]+gi; w[i]-=lr*(gi+mu*s.m[i]); break; }
      case 'adagrad': s.v[i]+=gi*gi; w[i]-=lr*gi/(Math.sqrt(s.v[i])+eps); break;
      case 'rmsprop': s.v[i]=0.9*s.v[i]+0.1*gi*gi; w[i]-=lr*gi/(Math.sqrt(s.v[i])+eps); break;
      case 'adam': default: s.m[i]=b1*s.m[i]+(1-b1)*gi; s.v[i]=b2*s.v[i]+(1-b2)*gi*gi; { const mh=s.m[i]/(1-Math.pow(b1,t)), vh=s.v[i]/(1-Math.pow(b2,t)); w[i]-=lr*mh/(Math.sqrt(vh)+eps); } break;
    } } };
NN.OPTS = [
  {name:'sgd', label:'Gradient descent', color:'#64748b', lr:0.05},
  {name:'momentum', label:'Momentum', color:'#0891b2', lr:0.02},
  {name:'nesterov', label:'Nesterov', color:'#16a34a', lr:0.02},
  {name:'adagrad', label:'AdaGrad', color:'#ca8a04', lr:0.3},
  {name:'rmsprop', label:'RMSProp', color:'#db2777', lr:0.03},
  {name:'adam', label:'Adam', color:'#7c3aed', lr:0.05},
];
})();
