/* Tiny synthetic scanned documents for the LayoutLMv2 page (needs ml/assets/core.js).
   Every word has a box on a 0-1000 grid (x and y normalised separately, as in LayoutLM),
   a line number and a BIO entity tag. DOCS.draw renders a page on a canvas. */
(function(){
'use strict';
const DOCS = window.DOCS = {};
DOCS.TYPES = ['COMPANY','DATE','ITEM','PRICE','TOTAL','NAME','PHONE'];
DOCS.TYPE_COL = {COMPANY:'c1',DATE:'c3',ITEM:'c6',PRICE:'c4',TOTAL:'c2',NAME:'c5',PHONE:'c3'};
/* line spec: [x, y, size, style, align, [[word, tag], ...]]  style: b bold, h handwriting, n normal; align l | r (x is the right edge) | c */
const SPEC = {
  receipt: { name:'Receipt', W:360, H:520, rules:[[24,118,336],[24,286,336]], lines:[
    [180,46,22,'b','c',[['CORNER','B-COMPANY'],['CAFE','I-COMPANY']]],
    [180,74,12,'n','c',[['12','O'],['Park','O'],['Road,','O'],['Pune','O']]],
    [24,100,12,'n','l',[['Date:','O'],['14/03/2024','B-DATE']]],
    [336,100,12,'n','r',[['09:41','O']]],
    [24,146,13,'n','l',[['Latte','B-ITEM']]],            [336,146,13,'n','r',[['3.50','B-PRICE']]],
    [24,176,13,'n','l',[['Butter','B-ITEM'],['croissant','I-ITEM']]], [336,176,13,'n','r',[['2.80','B-PRICE']]],
    [24,206,13,'n','l',[['Orange','B-ITEM'],['juice','I-ITEM']]],     [336,206,13,'n','r',[['4.20','B-PRICE']]],
    [24,236,13,'n','l',[['Muffin','B-ITEM']]],           [336,236,13,'n','r',[['2.40','B-PRICE']]],
    [24,314,13,'n','l',[['Subtotal','O']]],               [336,314,13,'n','r',[['12.90','O']]],
    [24,342,13,'n','l',[['Tax','O'],['5%','O']]],        [336,342,13,'n','r',[['0.65','O']]],
    [24,382,17,'b','l',[['TOTAL','O']]],                  [336,382,17,'b','r',[['13.55','B-TOTAL']]],
    [24,420,12,'n','l',[['Paid','O'],['by','O'],['card','O']]],
    [180,474,13,'n','c',[['Thank','O'],['you!','O']]] ]},
  invoice: { name:'Invoice', W:600, H:440, rules:[[30,196,570],[30,228,570],[30,330,570]], lines:[
    [30,50,26,'b','l',[['INVOICE','O']]],                 [570,40,13,'n','r',[['No.','O'],['2041','O']]],
    [570,64,13,'n','r',[['Date:','O'],['02/05/2024','B-DATE']]],
    [30,96,12,'n','l',[['Brightline','B-COMPANY'],['Studio','I-COMPANY']]],
    [30,140,12,'n','l',[['Bill','O'],['to:','O']]],
    [30,164,14,'n','l',[['Asha','B-NAME'],['Rao','I-NAME']]],
    [30,215,12,'b','l',[['Description','O']]],             [400,215,12,'b','r',[['Qty','O']]], [570,215,12,'b','r',[['Amount','O']]],
    [30,256,13,'n','l',[['Website','B-ITEM'],['design','I-ITEM']]], [400,256,13,'n','r',[['1','O']]], [570,256,13,'n','r',[['800.00','B-PRICE']]],
    [30,290,13,'n','l',[['Hosting','B-ITEM'],['(1','I-ITEM'],['year)','I-ITEM']]], [400,290,13,'n','r',[['1','O']]], [570,290,13,'n','r',[['120.00','B-PRICE']]],
    [330,366,16,'b','l',[['Total','O'],['due','O']]],      [570,366,16,'b','r',[['920.00','B-TOTAL']]],
    [30,412,11,'n','l',[['Pay','O'],['within','O'],['30','O'],['days','O']]] ]},
  form: { name:'Form', W:480, H:560, rules:[], lines:[
    [240,52,20,'b','c',[['MEMBERSHIP','O'],['FORM','O']]],
    [240,80,12,'n','c',[['Riverside','B-COMPANY'],['Swim','I-COMPANY'],['Club','I-COMPANY']]],
    [34,140,13,'n','l',[['Name:','O']]],          [150,140,16,'h','l',[['Ravi','B-NAME'],['Kumar','I-NAME']]],
    [34,196,13,'n','l',[['Phone:','O']]],         [150,196,16,'h','l',[['98200','B-PHONE'],['14421','I-PHONE']]],
    [34,252,13,'n','l',[['Date','O'],['of','O'],['birth:','O']]], [150,252,16,'h','l',[['12/08/1990','B-DATE']]],
    [34,308,13,'n','l',[['Plan:','O']]],          [150,308,16,'h','l',[['Annual','B-ITEM']]],
    [34,364,13,'n','l',[['Fee','O'],['paid:','O']]], [150,364,16,'h','l',[['1,200.00','B-TOTAL']]],
    [34,440,13,'n','l',[['Signature:','O']]],
    [34,512,10,'n','l',[['Office','O'],['use','O'],['only','O']]] ]}
};
/* measure words with a canvas so boxes match the rendering */
const mc = document.createElement('canvas').getContext('2d');
const fontOf = (size, st) => (st==='b'?'700 ':st==='h'?'italic 500 ':'500 ')+size+'px '+(st==='h'?'"Segoe Print","Comic Sans MS",cursive':'"JetBrains Mono",ui-monospace,monospace');
function build(key){ const D=SPEC[key], words=[];
  D.lines.forEach((L,li)=>{ const [x,y,size,st,al,ws]=L; mc.font=fontOf(size,st); const sp=mc.measureText(' ').width;
    const wd=ws.map(w=>mc.measureText(w[0]).width), tot=wd.reduce((a,b)=>a+b,0)+sp*(ws.length-1);
    let cx = al==='l'?x: al==='r'?x-tot : x-tot/2;
    ws.forEach((w,k)=>{ const b=[cx, y-size*.78, cx+wd[k], y+size*.26];
      words.push({text:w[0], tag:w[1], type:w[1]==='O'?null:w[1].slice(2), line:li, size, st, px:b,
        box:[Math.round(b[0]/D.W*1000),Math.round(b[1]/D.H*1000),Math.round(b[2]/D.W*1000),Math.round(b[3]/D.H*1000)]});
      cx += wd[k]+sp; }); });
  /* reading order = top to bottom, then left to right (what a good OCR engine returns) */
  words.sort((a,b)=> (Math.abs(a.px[3]-b.px[3])<6 ? a.px[0]-b.px[0] : a.px[3]-b.px[3]));
  words.forEach((w,i)=>{ w.i=i; w.box.push(w.box[2]-w.box[0], w.box[3]-w.box[1]); });
  return {key, name:D.name, W:D.W, H:D.H, rules:D.rules, words}; }
const cache={};
DOCS.get = key => cache[key] || (cache[key]=build(key));
DOCS.keys = Object.keys(SPEC);
/* "column-wise" OCR order: everything in the left half first, then the right half (a common OCR failure on receipts and tables) */
DOCS.columnOrder = d => { const L=d.words.filter(w=>w.px[0] < d.W*.45), R=d.words.filter(w=>w.px[0] >= d.W*.45); return L.concat(R); };
DOCS.isNum = s => /^[\d,]+\.\d\d$/.test(s);
DOCS.isDate = s => /^\d\d\/\d\d\/\d{4}$/.test(s);
/* draw a page into canvas context x at (ox,oy) with scale k (px per page unit). o: {fill(i)->[color,alpha], outline(i)->color, cover:Set(line), mask:Set(word), grid:n, gridHi:[r,c], dim} */
DOCS.draw = (x, d, ox, oy, k, o={}) => { const css=getComputedStyle(document.documentElement), cv=n=>css.getPropertyValue('--'+n).trim()||'#888';
  x.save(); x.translate(ox,oy); x.fillStyle='#fffdf8'; x.fillRect(0,0,d.W*k,d.H*k); x.strokeStyle='#d9d3c7'; x.lineWidth=1; x.strokeRect(.5,.5,d.W*k-1,d.H*k-1);
  x.strokeStyle='#9a9384'; x.lineWidth=Math.max(.6,k*.8); d.rules.forEach(r=>{ x.setLineDash(d.key==='receipt'?[3*k,3*k]:[]); x.beginPath(); x.moveTo(r[0]*k,r[1]*k); x.lineTo(r[2]*k,r[1]*k); x.stroke(); }); x.setLineDash([]);
  if(d.key==='form'){ x.strokeStyle='#b9b2a3'; [140,196,252,308,364].forEach(y=>{ x.beginPath(); x.moveTo(146*k,(y+5)*k); x.lineTo(446*k,(y+5)*k); x.stroke(); });
    x.strokeStyle='#1f4fbf'; x.lineWidth=1.6*k; x.beginPath(); x.moveTo(160*k,442*k); for(let t=0;t<=40;t++){ const xx=160+t*5, yy=438+Math.sin(t*.9)*9*Math.exp(-t/30)-t*.2; x.lineTo(xx*k,yy*k); } x.stroke();
    x.strokeStyle='#b9b2a3'; x.lineWidth=1; x.strokeRect(28*k,488*k,420*k,40*k); }
  if(d.key==='receipt'){ x.fillStyle='#c2410c22'; x.beginPath(); x.arc(180*k,20*k,6*k,0,7); x.fill(); }
  d.words.forEach((w,i)=>{ const b=w.px; const f=o.fill&&o.fill(i); if(f&&f[1]>0){ x.globalAlpha=f[1]; x.fillStyle=cv(f[0])||f[0]; x.fillRect(b[0]*k-2,b[1]*k-2,(b[2]-b[0])*k+4,(b[3]-b[1])*k+4); x.globalAlpha=1; }
    x.font=fontOf(w.size*k,w.st).replace(/^(.*?)(\d+(\.\d+)?)px/, (m,a,n)=>a+n+'px'); x.fillStyle=w.st==='h'?'#1f4fbf':'#1d1b18'; x.textBaseline='alphabetic';
    x.globalAlpha=o.dim&&o.dim(i)?.25:1; x.fillText(w.text,b[0]*k,(b[3]-w.size*.26)*k); x.globalAlpha=1;
    if(o.mask&&o.mask.has(i)){ x.fillStyle='#3a3a3a'; x.fillRect(b[0]*k-1,b[1]*k-1,(b[2]-b[0])*k+2,(b[3]-b[1])*k+2); }
    const oc=o.outline&&o.outline(i); if(oc){ x.strokeStyle=cv(oc)||oc; x.lineWidth=2; x.strokeRect(b[0]*k-3,b[1]*k-3,(b[2]-b[0])*k+6,(b[3]-b[1])*k+6); } });
  if(o.cover){ x.fillStyle='#262626'; d.words.forEach(w=>{ if(o.cover.has(w.line)){ const b=w.px; x.fillRect(b[0]*k-3,b[1]*k-3,(b[2]-b[0])*k+6,(b[3]-b[1])*k+6); } }); }
  if(o.grid){ const n=o.grid, gw=d.W*k/n, gh=d.H*k/n; x.strokeStyle=cv('c4'); x.globalAlpha=.55; x.lineWidth=1;
    for(let r=1;r<n;r++){ x.beginPath(); x.moveTo(0,r*gh); x.lineTo(d.W*k,r*gh); x.stroke(); x.beginPath(); x.moveTo(r*gw,0); x.lineTo(r*gw,d.H*k); x.stroke(); } x.globalAlpha=1;
    if(o.gridHi){ x.fillStyle=cv('c4'); x.globalAlpha=.22; x.fillRect(o.gridHi[1]*gw,o.gridHi[0]*gh,gw,gh); x.globalAlpha=1; x.strokeStyle=cv('c4'); x.lineWidth=2.5; x.strokeRect(o.gridHi[1]*gw,o.gridHi[0]*gh,gw,gh); } }
  x.restore(); };
/* fit a page into a host element; returns {canvas, k, hit(px,py)->word index|-1, cell(px,py)->[r,c]} */
DOCS.mount = (host, d, o={}, maxH) => { host = typeof host==='string'?document.querySelector(host):host; let c=host.querySelector('canvas');
  if(!c){ c=document.createElement('canvas'); c.style.display='block'; c.style.width='100%'; host.appendChild(c); }
  const wpx=host.clientWidth||300, k0=wpx/d.W, k=maxH?Math.min(k0,maxH/d.H):k0, hpx=d.H*k, dpr=Math.min(2,window.devicePixelRatio||1);
  host.style.height=hpx+'px'; c.style.height=hpx+'px'; c.width=Math.round(wpx*dpr); c.height=Math.round(hpx*dpr);
  const x=c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,wpx,hpx); const ox=(wpx-d.W*k)/2; DOCS.draw(x,d,ox,0,k,o);
  const rel=e=>{ const r=c.getBoundingClientRect(); return [(e.clientX-r.left-ox)/k,(e.clientY-r.top)/k]; };
  return { c, k, rel,
    hit:(e)=>{ const [px,py]=rel(e); let best=-1,bd=1e9; d.words.forEach((w,i)=>{ const b=w.px, dx=Math.max(b[0]-px,0,px-b[2]), dy=Math.max(b[1]-py,0,py-b[3]), dd=dx*dx+dy*dy; if(dd<bd){bd=dd;best=i;} }); return bd<400?best:-1; },
    cell:(e,n)=>{ const [px,py]=rel(e); return [Math.max(0,Math.min(n-1,Math.floor(py/d.H*n))),Math.max(0,Math.min(n-1,Math.floor(px/d.W*n)))]; } }; };
})();
