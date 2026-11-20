/* Tiny synthetic scenes + patch/region/codebook helpers for the multimodal pages (needs ml/assets/core.js) */
(function(){
'use strict';
const VIS = window.VIS = {};
/* shapes in unit coordinates (0..1, y down). types: rect, circle, ellipse, tri, grad */
const S = {
  park: { name:'Park', caption:'a dog plays with a red ball under a tree',
    shapes:[['grad',0,0,1,.62,'#8ecdf2','#cfeafb'],['rect',0,.62,1,.38,'#6cbf5a'],['circle',.83,.15,.08,'#ffd23f'],
      ['rect',.15,.34,.06,.32,'#7a4b2a'],['circle',.18,.3,.15,'#2f8f46'],['circle',.1,.38,.08,'#3aa154'],['circle',.27,.38,.08,'#3aa154'],
      ['ellipse',.55,.75,.13,.07,'#a8652f'],['circle',.69,.66,.06,'#a8652f'],['tri',.66,.58,.69,.62,.65,.63,'#6e3d18'],['rect',.46,.79,.03,.09,'#8a5226'],['rect',.6,.79,.03,.09,'#8a5226'],
      ['circle',.83,.84,.05,'#e53935']],
    objects:[{label:'tree',box:[.03,.15,.33,.53],tags:['tree']},{label:'dog',box:[.41,.56,.34,.33],tags:['dog','animal']},{label:'ball',box:[.77,.78,.12,.12],tags:['ball','red']},{label:'sun',box:[.74,.06,.18,.18],tags:['sun','yellow']},{label:'grass',box:[0,.62,1,.38],tags:['grass','green']}] },
  kitchen: { name:'Kitchen', caption:'a cat sits next to a blue cup on the table',
    shapes:[['grad',0,0,1,.6,'#f3e3c3','#e9d2a8'],['rect',0,.6,1,.4,'#c98d52'],['rect',.08,.55,.84,.06,'#9c6534'],
      ['ellipse',.32,.45,.12,.1,'#5f5f6b'],['circle',.24,.33,.07,'#5f5f6b'],['tri',.19,.28,.21,.22,.24,.27,'#4a4a55'],['tri',.25,.27,.28,.21,.3,.28,'#4a4a55'],['rect',.42,.42,.08,.03,'#5f5f6b'],
      ['rect',.58,.4,.09,.15,'#2f6fd6'],['rect',.66,.43,.03,.06,'#2f6fd6'],
      ['circle',.79,.49,.055,'#e53935'],['rect',.785,.42,.01,.03,'#6b3e1c']],
    objects:[{label:'cat',box:[.17,.2,.35,.36],tags:['cat','animal']},{label:'cup',box:[.57,.39,.13,.17],tags:['cup','blue']},{label:'apple',box:[.73,.41,.12,.14],tags:['apple','red']},{label:'table',box:[.08,.55,.84,.45],tags:['table']}] },
  street: { name:'Street', caption:'a red car waits behind a yellow bus',
    shapes:[['grad',0,0,1,.55,'#9fc9ef','#dcecfa'],['rect',0,.55,1,.45,'#7b7f86'],['rect',0,.74,1,.02,'#f1f1f1'],
      ['rect',.42,.3,.5,.3,'#f2b707'],['rect',.46,.35,.08,.08,'#bfe3ff'],['rect',.58,.35,.08,.08,'#bfe3ff'],['rect',.7,.35,.08,.08,'#bfe3ff'],['rect',.82,.35,.08,.08,'#bfe3ff'],['circle',.52,.61,.04,'#222'],['circle',.83,.61,.04,'#222'],
      ['rect',.06,.5,.28,.1,'#d62828'],['rect',.11,.43,.16,.08,'#d62828'],['rect',.14,.45,.1,.05,'#bfe3ff'],['circle',.12,.61,.035,'#222'],['circle',.28,.61,.035,'#222'],
      ['rect',.36,.12,.03,.45,'#333'],['circle',.375,.15,.02,'#e53935'],['circle',.375,.21,.02,'#3aa154']],
    objects:[{label:'bus',box:[.42,.3,.5,.35],tags:['bus','yellow','vehicle']},{label:'car',box:[.06,.43,.28,.22],tags:['car','red','vehicle']},{label:'traffic light',box:[.34,.11,.07,.46],tags:['light']},{label:'road',box:[0,.55,1,.45],tags:['road']}] },
};
VIS.SCENES = S;
const cache = {};
VIS.canvas = (key, n) => { const k=key+':'+n; if(cache[k]) return cache[k]; const c=document.createElement('canvas'); c.width=c.height=n; const x=c.getContext('2d');
  S[key].shapes.forEach(s=>{ const t=s[0]; x.beginPath();
    if(t==='grad'){ const g=x.createLinearGradient(0,s[2]*n,0,(s[2]+s[4])*n); g.addColorStop(0,s[5]); g.addColorStop(1,s[6]); x.fillStyle=g; x.fillRect(s[1]*n,s[2]*n,s[3]*n,s[4]*n); return; }
    if(t==='rect'){ x.fillStyle=s[5]; x.fillRect(s[1]*n,s[2]*n,s[3]*n,s[4]*n); return; }
    if(t==='circle'){ x.arc(s[1]*n,s[2]*n,s[3]*n,0,7); x.fillStyle=s[4]; x.fill(); return; }
    if(t==='ellipse'){ x.ellipse(s[1]*n,s[2]*n,s[3]*n,s[4]*n,0,0,7); x.fillStyle=s[5]; x.fill(); return; }
    if(t==='tri'){ x.moveTo(s[1]*n,s[2]*n); x.lineTo(s[3]*n,s[4]*n); x.lineTo(s[5]*n,s[6]*n); x.closePath(); x.fillStyle=s[7]; x.fill(); } });
  return cache[k]=c; };
/* pixel array [n*n*3] in 0..1 */
VIS.pixels = (key, n) => { const d=VIS.canvas(key,n).getContext('2d').getImageData(0,0,n,n).data, o=new Float32Array(n*n*3); for(let i=0;i<n*n;i++){ o[3*i]=d[4*i]/255; o[3*i+1]=d[4*i+1]/255; o[3*i+2]=d[4*i+2]/255; } return o; };
/* patch features: for each patch (raster order) mean rgb, brightness spread, horizontal and vertical edge energy */
VIS.patches = (key, n, P) => { const px=VIS.pixels(key,n), g=n/P, out=[];
  for(let r=0;r<g;r++) for(let c=0;c<g;c++){ let m=[0,0,0], s2=0, ex=0, ey=0; const N=P*P;
    for(let y=0;y<P;y++) for(let x=0;x<P;x++){ const i=((r*P+y)*n+(c*P+x))*3; for(let k=0;k<3;k++) m[k]+=px[i+k]; const L=(px[i]+px[i+1]+px[i+2])/3; s2+=L*L;
      if(x<P-1){ const j=i+3; ex+=Math.abs(L-(px[j]+px[j+1]+px[j+2])/3); } if(y<P-1){ const j=i+3*n; ey+=Math.abs(L-(px[j]+px[j+1]+px[j+2])/3); } }
    m=m.map(v=>v/N); const L=(m[0]+m[1]+m[2])/3; out.push({r,c,mean:m,sd:Math.sqrt(Math.max(0,s2/N-L*L)),ex:ex/N*4,ey:ey/N*4}); }
  return out; };
/* a fixed, readable "projection": 8 numbers per patch */
VIS.FEAT = ['red','green','blue','bright','contrast','vert. edges','horiz. edges','warm−cool'];
VIS.embed = p => { const [R,G,B]=p.mean, L=(R+G+B)/3; return [R-L, G-L, B-L, L-.5, p.sd*2, p.ex, p.ey, (R-B)/2].map(v=>+v.toFixed(4)); };
VIS.pos2d = (r,c,g,d=8) => { const out=[]; for(let k=0;k<d/4;k++){ const f=Math.pow(10,-k)*Math.PI/Math.max(1,g/2); out.push(Math.sin(r*f)*.25,Math.cos(r*f)*.25,Math.sin(c*f)*.25,Math.cos(c*f)*.25); } return out; };
VIS.kmeans = (X, K, seed=3, it=25) => { const r=ML.rng(seed); let C=[X[Math.floor(r()*X.length)]];
  while(C.length<K){ const d=X.map(x=>Math.min(...C.map(c=>VIS.d2(x,c)))), s=d.reduce((a,b)=>a+b,0); let u=r()*s, i=0; for(;i<X.length-1;i++){ u-=d[i]; if(u<=0) break; } C.push(X[i]); }
  C=C.map(c=>[...c]); let A=[];
  for(let t=0;t<it;t++){ A=X.map(x=>{ let b=0,bd=1e9; C.forEach((c,k)=>{ const d=VIS.d2(x,c); if(d<bd){bd=d;b=k;} }); return b; });
    C=C.map((c,k)=>{ const m=X.filter((_,i)=>A[i]===k); return m.length?c.map((_,j)=>m.reduce((s,x)=>s+x[j],0)/m.length):c; }); }
  return {C,A}; };
VIS.d2 = (a,b) => a.reduce((s,v,i)=>s+(v-b[i])**2,0);
VIS.hex = m => '#'+m.map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
/* region token: pooled colour + box geometry */
VIS.region = (key, n, o) => { const px=VIS.pixels(key,n); const [x,y,w,h]=o.box; let m=[0,0,0], N=0;
  for(let yy=Math.floor(y*n);yy<Math.min(n,Math.ceil((y+h)*n));yy++) for(let xx=Math.floor(x*n);xx<Math.min(n,Math.ceil((x+w)*n));xx++){ const i=(yy*n+xx)*3; for(let k=0;k<3;k++) m[k]+=px[i+k]; N++; }
  m=m.map(v=>v/Math.max(1,N)); return {mean:m, geo:[x,y,x+w,y+h,w*h].map(v=>+v.toFixed(2))}; };
})();
