/* Homepage behaviour: scroll progress, current section in the nav, section reveal,
   the interactive exceedance-curve exhibit in the hero, and copy-email. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scroll progress + current section ---------- */
  var bar = document.querySelector('.progress span');
  function onScroll() {
    if (!bar) return;
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  var links = {};
  document.querySelectorAll('.topbar nav a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var seen = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var cur = null;
      document.querySelectorAll('main > section[id]').forEach(function (s) { if (!cur && seen[s.id]) cur = s.id; });
      Object.keys(links).forEach(function (k) {
        if (k === cur) links[k].setAttribute('aria-current', 'location'); else links[k].removeAttribute('aria-current');
      });
      var a = links[cur];
      if (a && a.parentNode.scrollWidth > a.parentNode.clientWidth) {
        var n = a.parentNode; n.scrollTo({ left: a.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (s) { io.observe(s); });

    /* reveal sections once, only those still below the fold */
    if (!reduce) {
      var rv = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px' });
      document.querySelectorAll('main > .section').forEach(function (s) {
        if (s.getBoundingClientRect().top > window.innerHeight) { s.classList.add('rv'); rv.observe(s); }
      });
    }
  }

  /* ---------- copy email ---------- */
  var cp = document.querySelector('.copy');
  if (cp) {
    cp.hidden = false;
    var st = document.getElementById('copy-status'), t;
    function flash(msg, ok) {
      cp.textContent = msg; cp.classList.toggle('ok', ok); if (st) st.textContent = ok ? 'Email address copied' : 'Copy failed, the address is selected';
      clearTimeout(t); t = setTimeout(function () { cp.textContent = 'Copy'; cp.classList.remove('ok'); if (st) st.textContent = ''; }, 1600);
    }
    function legacy(txt) { // older browsers, or when the clipboard permission is refused
      var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
      if (!ok) { var r = document.createRange(), s = window.getSelection(); r.selectNodeContents(document.querySelector('.mail-link')); s.removeAllRanges(); s.addRange(r); }
      flash(ok ? 'Copied' : 'Press Ctrl+C', ok);
    }
    cp.addEventListener('click', function () {
      var txt = cp.getAttribute('data-copy');
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { flash('Copied', true); }, function () { legacy(txt); });
      else legacy(txt);
    });
  }

  /* ---------- Exhibit 1: exceedance curve with a draggable layer ---------- */
  var svg = document.getElementById('ep');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';
  // severity in millions: lognormal(mu=0, sigma=0.8) body, Pareto(alpha=1.5) tail above u=4, densities matched at u
  var MU = 0, SG = 0.8, U = 4, AL = 1.5;
  function Phi(z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2),
    p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
  var FU = Phi((Math.log(U) - MU) / SG), fU = Math.exp(-Math.pow(Math.log(U) - MU, 2) / (2 * SG * SG)) / (U * SG * Math.sqrt(2 * Math.PI));
  var P = (fU / FU) / (AL / U + fU / FU);
  function S(x) { if (x <= 0) return 1; if (x < U) return 1 - (1 - P) * Phi((Math.log(x) - MU) / SG) / FU; return P * Math.pow(x / U, -AL); }
  function EL(a, e) { var n = 300, h = (e - a) / n, s = S(a) + S(e); for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * S(a + i * h); return s * h / 3; }

  var W = 560, H = 346, L = 50, R = 14, T = 60, B = 40, PW = W - L - R, PH = H - T - B, XMAX = 30, DEC = 3;
  function X(v) { return L + v / XMAX * PW; }
  function Y(s) { return T + Math.min(DEC, -Math.log10(Math.max(s, Math.pow(10, -DEC)))) / DEC * PH; }
  function el(tag, at, parent) { var n = document.createElementNS(NS, tag); for (var k in at) n.setAttribute(k, at[k]); (parent || svg).appendChild(n); return n; }
  function curve(a, b, n) { var d = '', i, x; for (i = 0; i <= n; i++) { x = a + (b - a) * i / n; d += (i ? 'L' : 'M') + X(x).toFixed(1) + ',' + Y(S(x)).toFixed(1); } return d; }

  svg.textContent = '';
  var g = el('g', { 'class': 'ep-grid' });
  [1, 0.1, 0.01, 0.001].forEach(function (s, i) {
    el('line', { x1: L, x2: W - R, y1: Y(s), y2: Y(s) }, g);
    el('text', { x: L - 8, y: Y(s) + 4, 'text-anchor': 'end' }, g).textContent = ['100%', '10%', '1%', '0.1%'][i];
  });
  for (var v = 0; v <= XMAX; v += 5) {
    el('line', { x1: X(v), x2: X(v), y1: T + PH, y2: T + PH + 5, 'class': 'tick' }, g);
    el('text', { x: X(v), y: T + PH + 20, 'text-anchor': 'middle' }, g).textContent = v ? v + 'm' : '0';
  }
  el('text', { x: L - 40, y: 12, 'class': 'ax' }, g).textContent = 'P(single loss > x), log scale';
  el('text', { x: W - R, y: H - 4, 'text-anchor': 'end', 'class': 'ax' }, g).textContent = 'loss size x →';
  el('line', { x1: X(U), x2: X(U), y1: T, y2: T + PH, 'class': 'ep-u' });
  el('text', { x: X(U) - 5, y: T + 4, 'class': 'ep-ut', 'text-anchor': 'end', transform: 'rotate(-90 ' + (X(U) - 5) + ' ' + (T + 4) + ')' }).textContent = 'Pareto tail from 4m';

  var band = el('path', { 'class': 'ep-band' });
  var full = el('path', { 'class': 'ep-curve' + (reduce ? '' : ' draw'), d: curve(0.02, XMAX, 240), pathLength: 1 });
  var seg = el('path', { 'class': 'ep-seg' });
  var brk = el('path', { 'class': 'ep-brk' });
  var brt = el('text', { 'class': 'ep-brt', 'text-anchor': 'middle' });

  var st = { a: 5, e: 15 };
  function handle(key, label) {
    var h = el('g', { 'class': 'ep-h', tabindex: 0, role: 'slider', 'aria-label': label, 'aria-valuemin': 0.5, 'aria-valuemax': XMAX });
    h.hit = el('rect', { y: T - 6, width: 44, height: PH + 6, 'class': 'hit' }, h);
    h.ln = el('line', { y1: T - 4, y2: T + PH }, h);
    h.dot = el('circle', { r: 4.5 }, h);
    h.pill = el('rect', { y: T + PH - 26, height: 20, rx: 3, 'class': 'pill' }, h);
    h.txt = el('text', { y: T + PH - 12, 'text-anchor': 'middle' }, h);
    h.key = key; return h;
  }
  var ha = handle('a', 'Layer attachment, in millions'), he = handle('e', 'Layer exhaustion point, in millions');

  var R_ = { layer: document.getElementById('r-layer'), pa: document.getElementById('r-pa'), pe: document.getElementById('r-pe'), el: document.getElementById('r-el') };
  function pct(p) { return p >= 0.1 ? (p * 100).toFixed(0) + '%' : p >= 0.01 ? (p * 100).toFixed(1) + '%' : (p * 100).toFixed(2) + '%'; }
  function m(v) { return v.toFixed(1) + 'm'; }
  function place(h, v) {
    var x = X(v), y = Y(S(v));
    h.hit.setAttribute('x', x - 22); h.ln.setAttribute('x1', x); h.ln.setAttribute('x2', x);
    h.dot.setAttribute('cx', x); h.dot.setAttribute('cy', y);
    var t = (h.key === 'a' ? 'a ' : 'a+L ') + m(v), w = t.length * 7 + 12;
    h.txt.textContent = t; h.txt.setAttribute('x', x);
    h.pill.setAttribute('x', x - w / 2); h.pill.setAttribute('width', w);
    h.setAttribute('aria-valuenow', v.toFixed(1));
    h.setAttribute('aria-valuetext', m(v) + ', probability a loss exceeds it ' + pct(S(v)));
  }
  function draw() {
    var a = st.a, e = st.e;
    band.setAttribute('d', curve(a, e, 80) + 'L' + X(e).toFixed(1) + ',' + (T + PH) + 'L' + X(a).toFixed(1) + ',' + (T + PH) + 'Z');
    seg.setAttribute('d', curve(a, e, 80));
    var by = T - 18;
    brk.setAttribute('d', 'M' + X(a) + ',' + (by + 6) + 'V' + by + 'H' + X(e) + 'V' + (by + 6));
    brt.setAttribute('x', (X(a) + X(e)) / 2); brt.setAttribute('y', by - 6);
    brt.textContent = m(e - a) + ' xs ' + m(a);
    place(ha, a); place(he, e);
    // keep pills apart when the handles are close
    var close = X(e) - X(a) < 84;
    he.pill.setAttribute('y', close ? T + PH - 50 : T + PH - 26); he.txt.setAttribute('y', close ? T + PH - 36 : T + PH - 12);
    R_.layer.textContent = m(e - a) + ' xs ' + m(a);
    R_.pa.textContent = pct(S(a)); R_.pe.textContent = pct(S(e));
    R_.el.textContent = EL(a, e).toFixed(2) + 'm';
  }
  function set(key, v) {
    v = Math.round(v * 10) / 10;
    if (key === 'a') st.a = Math.max(0.5, Math.min(v, st.e - 0.5)); else st.e = Math.min(XMAX, Math.max(v, st.a + 0.5));
    draw();
  }
  draw();

  function toVal(evt) { var r = svg.getBoundingClientRect(); return ((evt.clientX - r.left) * W / r.width - L) / PW * XMAX; }
  var drag = null;
  svg.addEventListener('pointerdown', function (evt) {
    var v = toVal(evt); if (v < -1 || v > XMAX + 1) return;
    drag = Math.abs(v - st.a) <= Math.abs(v - st.e) ? 'a' : 'e';
    svg.setPointerCapture(evt.pointerId); svg.classList.add('dragging'); set(drag, v); evt.preventDefault();
    (drag === 'a' ? ha : he).focus({ preventScroll: true });
  });
  svg.addEventListener('pointermove', function (evt) { if (drag) set(drag, toVal(evt)); });
  function end() { drag = null; svg.classList.remove('dragging'); }
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  [ha, he].forEach(function (h) {
    h.addEventListener('keydown', function (evt) {
      var step = evt.shiftKey ? 2.5 : 0.5, v = st[h.key], k = evt.key;
      if (k === 'ArrowRight' || k === 'ArrowUp') v += step; else if (k === 'ArrowLeft' || k === 'ArrowDown') v -= step;
      else if (k === 'Home') v = 0; else if (k === 'End') v = XMAX; else return;
      evt.preventDefault(); set(h.key, v);
    });
  });
  document.getElementById('exhibit').classList.add('live');
})();
