/* Tree diagram (SVG) and partition drawing shared by the decision tree and ensemble pages */
(function(){
'use strict';
const ML=window.ML;
const visible = (nd,k) => !nd.parent || (ML.treeVisible(nd.parent,k) && nd.parent.order<k);
ML.treeVisible = visible;
const isLeafAt = (nd,k) => nd.leaf || !(nd.order<k);

/* returns an <svg> element */
ML.treeSVG = function(tree, o={}){
  const k=o.k??Infinity, P=ML.palette(), NS='http://www.w3.org/2000/svg', bw=o.boxW||104, bh=o.boxH||46, gx=o.gapX||12, gy=o.gapY||34;
  // layout: leaves left to right
  let col=0; const pos=new Map();
  (function lay(nd,depth){ if(isLeafAt(nd,k)){ pos.set(nd,{x:col++,d:depth}); return; } lay(nd.left,depth+1); lay(nd.right,depth+1); const a=pos.get(nd.left), b=pos.get(nd.right); pos.set(nd,{x:(a.x+b.x)/2,d:depth}); })(tree.root,0);
  const maxD=Math.max(...[...pos.values()].map(p=>p.d)), W=Math.max(col,1)*(bw+gx)+gx, H=(maxD+1)*(bh+gy)+gy-8;
  const svg=document.createElementNS(NS,'svg'); svg.setAttribute('width',W); svg.setAttribute('height',H); svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  const el=(t,a,parent)=>{ const e=document.createElementNS(NS,t); for(const key in a) e.setAttribute(key,a[key]); (parent||svg).appendChild(e); return e; };
  const cx=p=>gx+p.x*(bw+gx)+bw/2, cy=p=>12+p.d*(bh+gy);
  const k0=ML.rgb(P.k0), k1=ML.rgb(P.k1), bg=ML.rgb(P.card);
  const mix=(p)=>{ const c=p>=0.5?k1:k0, a=0.15+0.55*Math.abs(2*p-1); return `rgb(${bg.map((v,i)=>Math.round(v*(1-a)+c[i]*a)).join(',')})`; };
  pos.forEach((p,nd)=>{ if(!nd.parent || !pos.has(nd.parent)) return; const q=pos.get(nd.parent);
    el('path',{d:`M${cx(q)},${cy(q)+bh} C${cx(q)},${cy(q)+bh+gy/2} ${cx(p)},${cy(p)-gy/2} ${cx(p)},${cy(p)}`,fill:'none',stroke:P.muted,'stroke-width':1.4,opacity:.7});
    el('text',{x:(cx(p)+cx(q))/2+(nd===nd.parent.left?-4:4),y:cy(q)+bh+gy/2+3,'text-anchor':nd===nd.parent.left?'end':'start',class:'sub2'}).textContent=nd===nd.parent.left?'yes':'no'; });
  const feat=o.featNames||['x₁','x₂'];
  pos.forEach((p,nd)=>{ const g=el('g',{transform:`translate(${cx(p)-bw/2},${cy(p)})`,style:o.onClick?'cursor:pointer':''}); const leaf=isLeafAt(nd,k);
    const sel=o.selected===nd, newest=o.newest===nd;
    el('rect',{width:bw,height:bh,rx:9,fill:mix(nd.p),stroke:sel?P.c1:newest?P.c4:P.line,'stroke-width':sel||newest?3:1.2},g);
    const t1=el('text',{x:bw/2,y:17,'text-anchor':'middle'},g); t1.textContent= leaf ? `leaf → class ${nd.p>=0.5?1:0}` : `${feat[nd.f]} ≤ ${nd.thr.toFixed(2)}`;
    const t2=el('text',{x:bw/2,y:33,'text-anchor':'middle',class:'sub2'},g); t2.textContent= o.weighted ? `w=${(nd.w[0]+nd.w[1]).toFixed(2)} [${nd.count[0]}|${nd.count[1]}]` : `n=${nd.n} [${nd.count[0]}|${nd.count[1]}]`;
    if(o.onClick) g.addEventListener('click',()=>o.onClick(nd));
    const title=el('title',{},g); title.textContent=`impurity ${nd.imp.toFixed(3)}, P(class 1) = ${nd.p.toFixed(3)}${leaf?'':`, gain ${nd.gain.toFixed(3)}`}`; });
  return svg;
};

/* draw leaf rectangles of a tree (at growth step k) on a Plot */
ML.drawPartitions = function(plot, tree, k=Infinity, o={}){
  const P=ML.palette(), c=plot.ctx, B=plot.v;
  const clip=b=>({x0:Math.max(b.x0,B.x0),x1:Math.min(b.x1,B.x1),y0:Math.max(b.y0,B.y0),y1:Math.min(b.y1,B.y1)});
  (function walk(nd){ if(isLeafAt(nd,k)){ const b=clip(nd.box); c.save(); c.strokeStyle=P.ink; c.globalAlpha=o.alpha??.55; c.lineWidth=1; c.strokeRect(plot.X(b.x0),plot.Y(b.y1),plot.X(b.x1)-plot.X(b.x0),plot.Y(b.y0)-plot.Y(b.y1)); c.restore(); return; } walk(nd.left); walk(nd.right); })(tree.root);
  if(o.highlight){ const nd=o.highlight; if(!nd.leaf && nd.order<k){ const b=clip(nd.box); c.save(); c.strokeStyle=P.c4; c.lineWidth=3.5; c.beginPath();
      if(nd.f===0){ c.moveTo(plot.X(nd.thr),plot.Y(b.y0)); c.lineTo(plot.X(nd.thr),plot.Y(b.y1)); } else { c.moveTo(plot.X(b.x0),plot.Y(nd.thr)); c.lineTo(plot.X(b.x1),plot.Y(nd.thr)); } c.stroke(); c.restore(); }
    if(o.box){ const b=clip(nd.box); c.save(); c.strokeStyle=P.c1; c.lineWidth=2.5; c.setLineDash([6,4]); c.strokeRect(plot.X(b.x0),plot.Y(b.y1),plot.X(b.x1)-plot.X(b.x0),plot.Y(b.y0)-plot.Y(b.y1)); c.restore(); } }
};
})();
