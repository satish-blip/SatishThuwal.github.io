/* Shared helpers for the NLP pages (needs ml/assets/core.js first) */
(function(){
'use strict';
const ML=window.ML, NLP=window.NLP={};
NLP.GROUPS={
  nn:{name:'Neural nets',pages:[['neural-networks','Neural nets & XOR'],['activations','Activations'],['optimisers','GD → Adam'],['residual','Residual connections'],['normalisation','Normalisation']]},
  nlp:{name:'NLP',pages:[['tokenisation','Tokenisation'],['embeddings','Embeddings'],['rnn','RNNs'],['memory','LSTM & GRU'],['attention','Attention'],['cross-attention','Cross-attention'],['self-attention','Self-attention'],['transformers','Transformers']]} };
NLP.nav=function(group,cur){ const n=document.getElementById('algnav'); if(!n) return; const G=NLP.GROUPS[group], other=group==='nn'?'nlp':'nn', base=cur==='hub'?'':'../';
  n.innerHTML=`<a href="${base}"${cur==='hub'?' class="on"':''}>${G.name}</a>`+G.pages.map(([id,t])=>`<a href="${base}${id}/"${id===cur?' class="on" aria-current="page"':''}>${t}</a>`).join('')+`<a href="${base}../${other}/">${NLP.GROUPS[other].name} →</a>`;
  const on=n.querySelector('.on'); if(on) requestAnimationFrame(()=>{ n.scrollLeft=on.offsetLeft-n.clientWidth/2+on.offsetWidth/2; }); };
NLP.softmax=(v,T=1)=>{ const m=Math.max(...v.map(x=>x/T)); const e=v.map(x=>Math.exp(x/T-m)); const s=e.reduce((a,b)=>a+b,0); return e.map(x=>x/s); };
NLP.dot=(a,b)=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
NLP.norm=a=>Math.sqrt(NLP.dot(a,a));
NLP.cos=(a,b)=>NLP.dot(a,b)/((NLP.norm(a)*NLP.norm(b))||1);
NLP.mv=(M,v)=>M.map(r=>NLP.dot(r,v));          // M (out x in) times v
NLP.vm=(v,M)=>M[0].map((_,j)=>v.reduce((s,x,i)=>s+x*M[i][j],0)); // row vector v times M (in x out)
NLP.randM=(r,c,rng,s=1)=>Array.from({length:r},()=>Array.from({length:c},()=>rng.gauss()*s));
NLP.esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* colour helpers: sequential (0..1) and diverging (-1..1) */
NLP.seq=(t,col)=>{ const P=ML.palette(), a=ML.rgb(P.card), b=ML.rgb(col||P.c1); t=Math.max(0,Math.min(1,t)); return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`; };
NLP.div=(t)=>{ const P=ML.palette(); return t>=0?NLP.seq(t,P.c1):NLP.seq(-t,P.c4); };
NLP.ink=t=>t>0.55?'#fff':'var(--ink)';
/* heatmap: M rows x cols; opts {fmt, max, diverging, sel:[i,j], selRow, onCell(i,j), onRow(i), mask(i,j)} */
NLP.heat=function(el, M, rows, cols, o={}){ el=typeof el==='string'?document.querySelector(el):el;
  const mx=o.max??Math.max(1e-9,...M.flat().map(Math.abs)), cw=o.cellW||'minmax(0,1fr)';
  let h=`<div class="heat" style="grid-template-columns:${o.rowW||'auto'} repeat(${cols.length},${cw})"><div></div>`+cols.map((c,j)=>`<div class="h${o.selCol===j?' sel':''}" title="${NLP.esc(c)}">${NLP.esc(c)}</div>`).join('');
  M.forEach((r,i)=>{ h+=`<div class="r${o.selRow===i?' sel':''}" data-r="${i}" style="${o.onRow?'cursor:pointer':''}">${NLP.esc(rows[i])}</div>`;
    r.forEach((v,j)=>{ const masked=o.mask&&o.mask(i,j); const t=v/mx; const bg=masked?'var(--soft)':o.diverging?NLP.div(t):NLP.seq(Math.abs(t),o.color); const sel=(o.sel&&o.sel[0]===i&&o.sel[1]===j);
      h+=`<div class="c${sel?' sel':''}" data-i="${i}" data-j="${j}" style="background:${bg};color:${masked?'var(--muted)':NLP.ink(Math.abs(t))};${o.onCell?'cursor:pointer':''}" title="${NLP.esc(rows[i])} → ${NLP.esc(cols[j])}: ${masked?'masked':(+v).toFixed(4)}">${masked?'·':(o.fmt?o.fmt(v):(+v).toFixed(2))}</div>`; }); });
  el.innerHTML=h+'</div>';
  if(o.onCell) el.querySelectorAll('.c').forEach(c=>c.addEventListener('click',()=>o.onCell(+c.dataset.i,+c.dataset.j)));
  if(o.onRow) el.querySelectorAll('.r').forEach(c=>c.addEventListener('click',()=>o.onRow(+c.dataset.r)));
};
/* small vector strip */
NLP.vec=(v,mx)=>{ mx=mx||Math.max(1e-9,...v.map(Math.abs)); return `<span class="vec" title="[${v.map(x=>x.toFixed(2)).join(', ')}]">${v.map(x=>`<span style="background:${NLP.div(x/mx)}"></span>`).join('')}</span>`; };
/* bar list: items [{label,value}] */
NLP.bars=(items,o={})=>{ const mx=o.max??Math.max(1e-9,...items.map(i=>Math.abs(i.value))); return `<div style="display:grid;grid-template-columns:${o.lw||'90px'} 1fr 54px;gap:4px 8px;align-items:center;font-size:13px">`+items.map(it=>`<span class="mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${NLP.esc(it.label)}</span><div style="height:14px;background:var(--soft);border-radius:7px;overflow:hidden"><span style="display:block;height:100%;width:${100*Math.abs(it.value)/mx}%;background:${it.color||'var(--c1)'};border-radius:7px"></span></div><span class="mono" style="text-align:right">${o.fmt?o.fmt(it.value):it.value.toFixed(3)}</span>`).join('')+'</div>'; };
NLP.TOKCOL=['#ddd6fe','#bae6fd','#fecdd3','#fde68a','#bbf7d0','#fbcfe8','#c7d2fe','#fed7aa'];
NLP.TOKCOLD=['#4c1d95','#0c4a6e','#881337','#78350f','#14532d','#831843','#312e81','#7c2d12'];
NLP.tokColor=i=>{ const P=ML.palette(); return (P.dark?NLP.TOKCOLD:NLP.TOKCOL)[i%8]; };
NLP.chips=(toks,o={})=>`<div class="chips2">`+toks.map((t,i)=>`<span class="tok" style="background:${NLP.tokColor(o.colorBy?o.colorBy(t,i):i)}">${NLP.esc(o.show?o.show(t):t).replace(/ /g,'·')}${o.ids?`<small>${o.ids[i]}</small>`:''}</span>`).join('')+'</div>';
})();
