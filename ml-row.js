/* turns each homepage card grid into a swipeable row with arrows and a card count */
(function(){
  document.querySelectorAll('.ml-grid3').forEach(function(g){
    var wrap=document.createElement('div'); wrap.className='ml-row'; g.parentNode.insertBefore(wrap,g); wrap.appendChild(g);
    var n=g.children.length, c=document.createElement('p'); c.className='ml-count'; c.textContent=n+' pages · swipe or scroll sideways →'; wrap.parentNode.insertBefore(c,wrap);
    function mk(cls,txt,dir){ var b=document.createElement('button'); b.className='ml-arrow '+cls; b.type='button'; b.setAttribute('aria-label',dir>0?'Next cards':'Previous cards'); b.textContent=txt;
      b.addEventListener('click',function(){ g.scrollBy({left:dir*Math.max(280,g.clientWidth*0.85),behavior:'smooth'}); }); wrap.appendChild(b); }
    mk('prev','‹',-1); mk('next','›',1);
    function upd(){ wrap.classList.toggle('can-prev',g.scrollLeft>4); wrap.classList.toggle('can-next',g.scrollLeft+g.clientWidth<g.scrollWidth-4); c.style.visibility=g.scrollWidth>g.clientWidth+4?'visible':'hidden'; }
    g.addEventListener('scroll',upd,{passive:true}); window.addEventListener('resize',upd); upd();
  });
})();
