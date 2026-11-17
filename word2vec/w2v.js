/* word2vec playground: static, runs fully in the browser.
   Data: 100k Google News word2vec vectors, 4-bit quantised (one float scale per word). */
(() => {
'use strict';
const DIM = 300, HALF = DIM / 2, MAXN = 100000;
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const fmt = x => (x >= 0 ? '' : '−') + Math.abs(x).toFixed(2);
const fmtS = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const TERM_VARS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
const termColor = i => css(TERM_VARS[i % TERM_VARS.length]);

/* ---------------- state ---------------- */
let N = 0;                                 // words loaded so far
const Q = new Int8Array(MAXN * DIM);        // quantised components, -8..7
const INV = new Float32Array(MAXN);         // scale / ||dequantised vector||  -> unit vectors
const words = [], lower = [];
const index = new Map();                   // lowercase -> id
let method = 'add', K = 10, exclude = true;
let last = null;                           // last computation result

/* ---------------- loading ---------------- */
async function fetchBytes(url, onProg) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !total) { const b = new Uint8Array(await r.arrayBuffer()); onProg(1); return b; }
  const out = new Uint8Array(total); let got = 0; const rd = r.body.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break;
    if (got + value.length > out.length) { // content-length was compressed size
      const bigger = new Uint8Array(Math.max(out.length * 2, got + value.length)); bigger.set(out.subarray(0, got));
      return finishGrow(bigger, got, value, rd, onProg); }
    out.set(value, got); got += value.length; onProg(got / total); }
  return out.subarray(0, got);
}
async function finishGrow(buf, got, value, rd, onProg) {
  buf.set(value, got); got += value.length;
  for (;;) { const { done, value: v } = await rd.read(); if (done) break;
    if (got + v.length > buf.length) { const b = new Uint8Array(buf.length * 2); b.set(buf.subarray(0, got)); buf = b; }
    buf.set(v, got); got += v.length; }
  onProg(1); return buf.subarray(0, got);
}
function addShard(bytes, list) {
  const n = list.length;
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const scales = new Float32Array(ab, 0, n), packed = new Uint8Array(ab, n * 4, n * HALF);
  for (let i = 0; i < n; i++) {
    const id = N + i, base = id * DIM, pb = i * HALF; let ss = 0;
    for (let j = 0; j < HALF; j++) {
      const b = packed[pb + j], hi = (b >> 4) - 8, lo = (b & 15) - 8;
      Q[base + 2 * j] = hi; Q[base + 2 * j + 1] = lo; ss += hi * hi + lo * lo;
    }
    INV[id] = ss > 0 ? 1 / Math.sqrt(ss) : 0;      // scale cancels after normalising
    const w = list[i]; words.push(w); const lw = w.toLowerCase(); lower.push(lw);
    if (!index.has(lw)) index.set(lw, id);
  }
  N += n;
}
function setStatus(text, ready) { $('#statusText').textContent = text; $('#status').classList.toggle('ready', !!ready); }
async function load() {
  const bar = $('#loadbar');
  const core = { bin: 3850000, w: 25000 }, total = 3850000 + 11550000;
  try {
    const [cb, ct] = await Promise.all([
      fetchBytes('data/w2v_core.bin', p => bar.style.width = (p * core.bin / total * 100) + '%'),
      fetch('data/w2v_core.txt').then(r => r.text())]);
    addShard(cb, ct.split('\n'));
    setStatus(`${N.toLocaleString()} words ready · loading 75,000 more…`);
    onReady();
    const [eb, et] = await Promise.all([
      fetchBytes('data/w2v_ext.bin', p => bar.style.width = ((core.bin + p * 11550000) / total * 100) + '%'),
      fetch('data/w2v_ext.txt').then(r => r.text())]);
    addShard(eb, et.split('\n'));
    setStatus(`${N.toLocaleString()} words ready`, true);
    bar.style.width = '100%'; setTimeout(() => bar.parentElement.style.visibility = 'hidden', 600);
    compute(); galaxyNeighbourCache.clear();
  } catch (e) {
    console.error(e);
    setStatus(N ? `${N.toLocaleString()} words ready (the rest failed to load)` : 'Could not load vectors. Please refresh.', !!N);
  }
}

/* ---------------- vector maths ---------------- */
function unit(id) { const v = new Float32Array(DIM), b = id * DIM, s = INV[id]; for (let j = 0; j < DIM; j++) v[j] = Q[b + j] * s; return v; }
function dotId(id, t) { const b = id * DIM; let d = 0; for (let j = 0; j < DIM; j++) d += Q[b + j] * t[j]; return d * INV[id]; }
function norm(v) { let s = 0; for (let j = 0; j < v.length; j++) s += v[j] * v[j]; return Math.sqrt(s); }

// returns top list [{id,score}] of length k, skipping ids in skip set
function search(terms, target, k, skip) {
  const tn = norm(target) || 1, n = N, keep = k + skip.size + 1;
  const ids = new Int32Array(keep).fill(-1), sc = new Float64Array(keep).fill(-Infinity);
  let minPos = 0;
  const push = (id, s) => {
    if (s <= sc[minPos]) return;
    ids[minPos] = id; sc[minPos] = s;
    let m = 0; for (let i = 1; i < keep; i++) if (sc[i] < sc[m]) m = i; minPos = m;
  };
  if (method === 'add' || terms.length < 2) {
    const t = target;
    for (let id = 0; id < n; id++) {
      const b = id * DIM; let d = 0;
      for (let j = 0; j < DIM; j++) d += Q[b + j] * t[j];
      push(id, d * INV[id] / tn);
    }
  } else {
    const tv = terms.map(t => t.vec), sg = terms.map(t => t.sign), m = terms.length;
    const flat = new Float32Array(m * DIM); tv.forEach((v, i) => flat.set(v, i * DIM));
    const dots = new Float64Array(m);
    for (let id = 0; id < n; id++) {
      const b = id * DIM;
      for (let i = 0; i < m; i++) { const o = i * DIM; let d = 0; for (let j = 0; j < DIM; j++) d += Q[b + j] * flat[o + j]; dots[i] = d; }
      let num = 1, den = 1; const inv = INV[id];
      for (let i = 0; i < m; i++) { const s = (dots[i] * inv + 1) / 2; if (sg[i] > 0) num *= s; else den *= s; }
      push(id, num / (den + 1e-3));
    }
  }
  const all = [];
  for (let i = 0; i < keep; i++) if (ids[i] >= 0) all.push({ id: ids[i], score: sc[i] });
  all.sort((a, b) => b.score - a.score);
  return all;
}

/* ---------------- parsing ---------------- */
function parse(str) {
  const terms = []; let sign = 1; const re = /([+\-−–])|([^\s+\-−–]+)/g; let m;
  while ((m = re.exec(str))) {
    if (m[1]) { sign = m[1] === '+' ? 1 : -1; continue; }
    const raw = m[2]; const id = index.get(raw.toLowerCase());
    terms.push({ raw, id: id === undefined ? -1 : id, sign, start: m.index, end: m.index + raw.length });
    sign = 1;
  }
  return terms;
}
function suggestFix(raw) {
  const w = raw.toLowerCase(), out = [];
  for (let i = 0; i < Math.min(N, 40000) && out.length < 3; i++) {
    const c = lower[i]; if (Math.abs(c.length - w.length) > 2) continue;
    if (lev(w, c, 2) <= (w.length > 5 ? 2 : 1)) out.push(words[i]);
  }
  return out;
}
function lev(a, b, max) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1; prev = cur;
  }
  return prev[b.length];
}

/* ---------------- compute + render ---------------- */
let timer = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(compute, 90); }
function compute() {
  if (!N) return;
  const str = $('#expr').value;
  const parsed = parse(str);
  renderChips(parsed);
  const terms = parsed.filter(t => t.id >= 0);
  // merge duplicates is unnecessary: maths is the same, but colours stay per term
  if (!terms.length) { last = null; renderEmpty(parsed); return; }
  terms.forEach((t, i) => { t.vec = unit(t.id); t.color = termColor(i); t.ci = i; });
  const target = new Float32Array(DIM);
  for (const t of terms) for (let j = 0; j < DIM; j++) target[j] += t.sign * t.vec[j];
  const tn = norm(target);
  if (tn < 1e-6) { last = null; renderEmpty(parsed, 'The words cancel out to the zero vector. Try a different combination.'); return; }
  const inputIds = new Set(terms.map(t => t.id));
  const t0 = performance.now();
  const raw = search(terms, target, K, inputIds);
  const ms = performance.now() - t0;
  const ranked = raw.map((r, i) => ({ ...r, rawRank: i + 1 }));
  const shown = (exclude ? ranked.filter(r => !inputIds.has(r.id)) : ranked).slice(0, K);
  const hidden = exclude ? ranked.filter(r => inputIds.has(r.id)) : [];
  // per-candidate contributions: sign * cos(cand, term) / ||t||  (they sum to cos(cand, t))
  for (const r of shown) {
    r.cos = terms.map(t => dotId(r.id, t.vec));
    r.contrib = terms.map((t, i) => t.sign * r.cos[i] / tn);
    r.cosT = r.contrib.reduce((a, b) => a + b, 0);
  }
  last = { str, parsed, terms, target, tn, shown, hidden, ms };
  renderAnswer(); renderList(); renderMap(); renderBarcodes(); markGalaxy();
  try { history.replaceState(null, '', '#q=' + encodeURIComponent(str.trim())); } catch (e) {}
}

function opSym(s) { return s > 0 ? '+' : '−'; }
function eqText(terms) { return terms.map((t, i) => (i === 0 ? (t.sign < 0 ? '−' : '') : ' ' + opSym(t.sign) + ' ') + words[t.id]).join(''); }

function renderChips(parsed) {
  const box = $('#chips'); box.textContent = '';
  let ci = 0;
  parsed.forEach((t, i) => {
    if (t.id < 0) {
      const fix = N ? suggestFix(t.raw) : [];
      const c = el('span', { class: 'chip bad' }, `“${t.raw}” not in the ${N.toLocaleString()} words`);
      if (fix.length) {
        c.append(el('small', {}, ' · try '));
        fix.forEach((f, k) => c.append(el('a', { href: '#', onclick: e => { e.preventDefault(); replaceToken(t, f); } }, f), k < fix.length - 1 ? ', ' : ''));
      }
      box.append(c); return;
    }
    const col = termColor(ci++);
    box.append(el('span', { class: 'chip', style: `background:${col}` }, el('span', { class: 'op' }, i === 0 && t.sign > 0 ? '' : opSym(t.sign)), words[t.id]));
  });
}
function replaceToken(t, w) { const inp = $('#expr'); inp.value = inp.value.slice(0, t.start) + w + inp.value.slice(t.end); compute(); }

function renderEmpty(parsed, msg) {
  const a = $('#answer'); a.className = 'answer empty';
  a.textContent = msg || (parsed.length ? 'None of these words are in the vocabulary yet.' : 'Type a word, or an expression like  king - man + woman');
  $('#nb').textContent = ''; $('#excluded').textContent = ''; $('#nbCount').textContent = '';
  $('#map').textContent = ''; $('#mapLegend').textContent = ''; $('#barcodes').textContent = ''; markGalaxy();
}

function analogyParts(terms) {
  const pos = terms.filter(t => t.sign > 0), neg = terms.filter(t => t.sign < 0);
  return (terms.length === 3 && pos.length === 2 && neg.length === 1) ? { a: neg[0], b: pos[0], c: pos[1] } : null;
}

function renderAnswer() {
  const { terms, shown, ms } = last, a = $('#answer'); a.className = 'answer'; a.textContent = '';
  if (!shown.length) { a.className = 'answer empty'; a.textContent = 'No results.'; return; }
  const top = shown[0], second = shown[1];
  const single = terms.length === 1;
  a.append(el('span', { class: 'eqn' }, single ? `nearest to ${words[terms[0].id]}:` : eqText(terms) + ' ≈'));
  a.append(el('span', { class: 'res' }, words[top.id]));
  const ap = analogyParts(terms);
  const meta = el('span', { class: 'meta' });
  if (ap) meta.append(el('b', {}, `${words[ap.a.id]} is to ${words[ap.b.id]} as ${words[ap.c.id]} is to ${words[top.id]}. `));
  meta.append(`cosine ${top.cosT.toFixed(3)}`);
  if (second) meta.append(` · runner-up ${words[second.id]} (${second.cosT.toFixed(3)})`);
  meta.append(` · searched ${N.toLocaleString()} words in ${Math.max(1, Math.round(ms))} ms`);
  a.append(meta);
}

function renderList() {
  const { terms, shown, hidden, tn } = last, ol = $('#nb'); ol.textContent = '';
  $('#nbCount').textContent = method === 'mul' && terms.length > 1 ? 'score: 3CosMul' : 'score: cosine';
  let L = 0.0001, R = 0.0001;
  for (const r of shown) { let l = 0, rr = 0; r.contrib.forEach(c => c < 0 ? l -= c : rr += c); L = Math.max(L, l); R = Math.max(R, rr); }
  const span = L + R, z = L / span * 100;
  shown.forEach((r, i) => {
    const li = el('li');
    const bar = el('div', { class: 'contrib', 'aria-hidden': 'true' });
    let posAt = z, negAt = z;
    r.contrib.forEach((c, k) => {
      const w = Math.abs(c) / span * 100, t = terms[k];
      const seg = el('i', { class: t.sign < 0 ? 'minus' : '', style: `background-color:${t.color};width:${w}%;left:${c >= 0 ? posAt : negAt - w}%`, title: `${opSym(t.sign)} ${words[t.id]}: ${fmtS(c)}` });
      if (c >= 0) posAt += w; else negAt -= w;
      bar.append(seg);
    });
    bar.append(el('span', { class: 'zero', style: `left:calc(${z}% - 1px)` }));
    const score = method === 'mul' && terms.length > 1 ? r.score.toFixed(2) : r.cosT.toFixed(3);
    const btn = el('button', { class: 'nbrow', type: 'button', 'aria-expanded': 'false' },
      el('span', { class: 'rank' }, String(i + 1)), el('span', { class: 'word' }, words[r.id]), el('span', { class: 'score' }, score), bar);
    li.append(btn);
    btn.addEventListener('click', () => {
      const open = li.classList.toggle('open'); btn.setAttribute('aria-expanded', open);
      const old = li.querySelector('.why'); if (old) old.remove();
      if (open) li.append(whyPanel(r, i));
    });
    if (i === 0) { li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); li.append(whyPanel(r, 0)); }
    ol.append(li);
  });
  const ex = $('#excluded'); ex.textContent = '';
  if (hidden.length) {
    ex.append('Hidden because you typed them: ');
    hidden.forEach((h, k) => ex.append(el('b', {}, words[h.id]), ` would be #${h.rawRank} (${(method === 'mul' && terms.length > 1 ? h.score : h.score).toFixed(3)})${k < hidden.length - 1 ? ', ' : '. '}`));
    ex.append('Inputs sit closest to their own sum, so they are left out by convention.');
  }
}

function whyPanel(r, i) {
  const { terms, tn, shown } = last, w = words[r.id], box = el('div', { class: 'why' });
  if (terms.length === 1) {
    box.append(el('p', {}, `cos(${w}, ${words[terms[0].id]}) = ${r.cos[0].toFixed(3)}. `, angleNote(r.cos[0]), ' Words that appear in similar contexts in the news end up pointing in similar directions.'));
    return box;
  }
  const tbl = el('table', {}, el('tr', {}, el('th', {}, 'word typed'), el('th', {}, `cos with ${w}`), el('th', {}, 'adds')));
  terms.forEach((t, k) => tbl.append(el('tr', {}, el('td', {}, el('span', { class: 'sw', style: `background:${t.color}` }), `${opSym(t.sign)} ${words[t.id]}`), el('td', { class: 'n' }, r.cos[k].toFixed(3)), el('td', { class: 'n' }, fmtS(t.sign * r.cos[k])))));
  const sum = r.cos.reduce((a, c, k) => a + terms[k].sign * c, 0);
  tbl.append(el('tr', {}, el('th', {}, 'sum'), el('td'), el('td', { class: 'n' }, fmtS(sum))));
  tbl.append(el('tr', {}, el('th', {}, `÷ ‖result‖ ${tn.toFixed(3)}`), el('td'), el('td', { class: 'n' }, '= ' + r.cosT.toFixed(3))));
  box.append(tbl);
  const plus = terms.map((t, k) => ({ t, c: r.cos[k] })).filter(x => x.t.sign > 0).sort((a, b) => b.c - a.c);
  const minus = terms.map((t, k) => ({ t, c: r.cos[k] })).filter(x => x.t.sign < 0);
  let s = `${w} is ` + plus.map(x => `${simWord(x.c)} ${words[x.t.id]} (${x.c.toFixed(2)})`).join(' and ');
  if (minus.length) s += minus.map(x => x.c > 0.35 ? `, but it is still quite like ${words[x.t.id]} (${x.c.toFixed(2)}), which costs it points` : `, and not very like ${words[x.t.id]} (${x.c.toFixed(2)}), so subtracting it costs little`).join('');
  box.append(el('p', {}, s + '.'));
  if (i === 0) {
    if (shown[1]) {
      const d = shown[1], gap = r.cosT - d.cosT, k = argmax(r.contrib.map((c, j) => c - d.contrib[j]));
      box.append(el('p', {}, `It beats ${words[d.id]} by ${gap.toFixed(3)}, mostly on ${words[terms[k].id]}: ${w} scores ${r.cos[k].toFixed(2)} there against ${d.cos[k].toFixed(2)}.`));
    }
  } else {
    const top = shown[0], k = argmax(top.contrib.map((c, j) => c - r.contrib[j]));
    const better = terms.map((t, j) => ({ t, d: r.contrib[j] - top.contrib[j], j })).filter(x => x.d > 0.005).sort((a, b) => b.d - a.d)[0];
    let p = `It trails ${words[top.id]} by ${(top.cosT - r.cosT).toFixed(3)}. The biggest gap is ${opSym(terms[k].sign)} ${words[terms[k].id]}: cos ${r.cos[k].toFixed(2)} for ${w} against ${top.cos[k].toFixed(2)} for ${words[top.id]}.`;
    if (better) p += ` It does better on ${words[better.t.id]} (${r.cos[better.j].toFixed(2)} vs ${top.cos[better.j].toFixed(2)}), but not by enough.`;
    box.append(el('p', {}, p));
  }
  if (method === 'mul') box.append(el('p', { class: 'small' }, '3CosMul ranks by ∏ sim(added) / ∏ sim(subtracted) with sim = (cos+1)/2. The bars still show the cosine parts.'));
  return box;
}
const argmax = a => a.reduce((m, v, i) => v > a[m] ? i : m, 0);
function simWord(c) { return c > 0.6 ? 'very like' : c > 0.4 ? 'like' : c > 0.2 ? 'somewhat like' : 'only a little like'; }
function angleNote(c) { const deg = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; return `That is an angle of ${deg.toFixed(0)}° between the two vectors (0° = same direction, 90° = unrelated).`; }

/* ---------------- local PCA map ---------------- */
function pca2(rows) {
  const n = rows.length, mu = new Float64Array(DIM);
  rows.forEach(r => { for (let j = 0; j < DIM; j++) mu[j] += r[j] / n; });
  const X = rows.map(r => Float64Array.from(r, (v, j) => v - mu[j]));
  const G = X.map(a => X.map(b => { let s = 0; for (let j = 0; j < DIM; j++) s += a[j] * b[j]; return s; }));
  const trace = G.reduce((s, r, i) => s + r[i], 0);
  const comps = [], lams = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7 + c + 1));
    let lam = 0;
    for (let it = 0; it < 200; it++) {
      let w = G.map(r => r.reduce((s, g, j) => s + g * v[j], 0));
      for (const [pc, pl] of comps.map((p, k) => [p, lams[k]])) { const d = pc.reduce((s, x, j) => s + x * v[j], 0); w = w.map((x, j) => x - pl * d * pc[j]); }
      const nv = Math.hypot(...w) || 1; lam = nv; v = w.map(x => x / nv);
    }
    comps.push(v); lams.push(lam);
  }
  // direction vectors u = X^T v / sqrt(lam)
  const U = comps.map((v, c) => { const u = new Float64Array(DIM); X.forEach((x, i) => { for (let j = 0; j < DIM; j++) u[j] += x[j] * v[i]; }); const nu = norm(u) || 1; return u.map(x => x / nu); });
  const proj = r => U.map(u => { let s = 0; for (let j = 0; j < DIM; j++) s += (r[j] - mu[j]) * u[j]; return s; });
  return { proj, explained: (lams[0] + lams[1]) / (trace || 1) };
}

function renderMap() {
  const svg = $('#map'), { terms, target, shown } = last;
  svg.textContent = '';
  const narrow = svg.clientWidth && svg.clientWidth < 480, W = narrow ? 400 : 600, H = narrow ? 360 : 510, pad = narrow ? 30 : 46; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const cands = shown.slice(0, Math.min(shown.length, 12));
  const uniqTerms = []; const seen = new Set(); terms.forEach(t => { if (!seen.has(t.id)) { seen.add(t.id); uniqTerms.push(t); } });
  const rows = [...uniqTerms.map(t => t.vec), ...cands.map(c => unit(c.id)), target];
  const { proj, explained } = pca2(rows);
  const pts = [];
  uniqTerms.forEach(t => pts.push({ kind: 'term', id: t.id, p: proj(t.vec), color: t.color, t }));
  const ap = analogyParts(terms), single = terms.length === 1;
  cands.forEach((c, i) => pts.push({ kind: i === 0 ? 'win' : 'cand', id: c.id, p: proj(unit(c.id)), r: c, rank: i + 1 }));
  const tp = proj(target);
  if (!single) pts.push({ kind: 'target', p: tp });
  // walk points for generic expressions
  const walk = [];
  if (!single && !ap) { const acc = new Float32Array(DIM); terms.forEach(t => { for (let j = 0; j < DIM; j++) acc[j] += t.sign * t.vec[j]; walk.push({ p: proj(acc), t }); }); }
  const all = [...pts.map(p => p.p), ...walk.map(w => w.p)];
  let x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
  const s = Math.min((W - 2 * pad - 60) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const X = p => ox + (p[0] - x0) * s, Y = p => H - (oy + (p[1] - y0) * s);
  // defs: arrow markers
  const defs = sv('defs'); svg.append(defs);
  const marker = (id, color) => { const m = sv('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }); m.append(sv('path', { d: 'M0,0 L10,5 L0,10 z', fill: color })); defs.append(m); return `url(#${id})`; };
  const gGrid = sv('g'); svg.append(gGrid);
  for (let i = 1; i < 6; i++) { gGrid.append(sv('line', { x1: W * i / 6, x2: W * i / 6, y1: 0, y2: H, stroke: css('--line'), 'stroke-width': 1 })); gGrid.append(sv('line', { y1: H * i / 6, y2: H * i / 6, x1: 0, x2: W, stroke: css('--line'), 'stroke-width': 1 })); }
  const line = (a, b, color, opts = {}) => {
    const dx = X(b) - X(a), dy = Y(b) - Y(a), L = Math.hypot(dx, dy) || 1, sh = opts.shorten ?? 9;
    const l = sv('line', { x1: X(a) + dx / L * (opts.start ?? 7), y1: Y(a) + dy / L * (opts.start ?? 7), x2: X(b) - dx / L * sh, y2: Y(b) - dy / L * sh, stroke: color, 'stroke-width': opts.w || 3, 'stroke-linecap': 'round', opacity: opts.o ?? 1 });
    if (opts.dash) l.setAttribute('stroke-dasharray', opts.dash);
    if (opts.arrow) l.setAttribute('marker-end', marker('m' + Math.random().toString(36).slice(2), color));
    svg.append(l); return l;
  };
  const legend = $('#mapLegend'); legend.textContent = '';
  const star = css('--star');
  if (single) {
    const c0 = pts[0];
    cands.forEach((c, i) => line(c0.p, proj(unit(c.id)), css('--muted'), { w: 1.5, o: 0.25 + 0.5 * Math.max(0, c.cosT), shorten: 5 }));
    $('#mapSub').textContent = `The word and its ${cands.length} nearest neighbours, flattened with PCA. These 2 directions keep ${(explained * 100).toFixed(0)}% of the spread between these points; closeness on screen is only a rough guide to cosine.`;
  } else if (ap) {
    // parallelogram: a -> b  and  c -> target are the same offset vector
    line(proj(ap.a.vec), proj(ap.c.vec), css('--muted'), { w: 1.5, dash: '4 5', o: .6, shorten: 7 });
    line(proj(ap.b.vec), tp, css('--muted'), { w: 1.5, dash: '4 5', o: .6, shorten: 7 });
    line(proj(ap.a.vec), proj(ap.b.vec), ap.b.color, { arrow: true, w: 3.5 });
    line(proj(ap.c.vec), tp, ap.b.color, { arrow: true, w: 3.5 });
    line(tp, proj(unit(cands[0].id)), star, { w: 2.5, dash: '2 5', shorten: 8, start: 9 });
    const off = `${words[ap.b.id]} − ${words[ap.a.id]}`;
    legend.append(el('span', {}, el('i', { style: `background:${ap.b.color};border-radius:2px;height:4px;width:18px` }), `the offset “${off}”, drawn twice`));
    $('#mapSub').textContent = `PCA keeps straight lines straight, so the offset ${off} (from ${words[ap.a.id]} to ${words[ap.b.id]}) and the same offset added to ${words[ap.c.id]} are exactly parallel and equal. The ★ is where the arithmetic lands; the dotted line goes to the nearest real word. These 2 directions keep ${(explained * 100).toFixed(0)}% of the spread of these points.`;
  } else {
    let prev = walk[0].p;
    walk.slice(1).forEach(w => { line(prev, w.p, w.t.color, { arrow: true, w: 3, start: 2, shorten: 4 }); prev = w.p; });
    line(tp, proj(unit(cands[0].id)), star, { w: 2.5, dash: '2 5', shorten: 8, start: 9 });
    legend.append(el('span', {}, el('i', { style: `background:${css('--muted')};border-radius:2px;height:4px;width:18px` }), 'each arrow adds or subtracts one word'));
    $('#mapSub').textContent = `The arrows walk through the sum one word at a time, starting from ${words[terms[0].id]}, and end at the ★. The dotted line goes to the nearest real word. PCA view; these 2 directions keep ${(explained * 100).toFixed(0)}% of the spread.`;
  }
  // points + labels, with simple collision avoidance
  const placed = [], tip = $('#mapTip');
  const fits = b => !placed.some(q => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
  const order = { term: 0, target: 1, win: 2, cand: 3 };
  pts.sort((a, b) => order[a.kind] - order[b.kind] || (a.rank || 0) - (b.rank || 0));
  const gLabels = sv('g'), gPts = sv('g'); svg.append(gPts, gLabels);
  for (const p of pts) placed.push({ x: X(p.p) - 7, y: Y(p.p) - 7, w: 14, h: 14 });
  for (const p of pts) {
    const x = X(p.p), y = Y(p.p); let node;
    if (p.kind === 'target') {
      node = sv('path', { d: starPath(x, y, 11, 5), fill: star, stroke: css('--card'), 'stroke-width': 1.5 });
    } else if (p.kind === 'term') node = sv('circle', { cx: x, cy: y, r: 8, fill: p.color, stroke: css('--card'), 'stroke-width': 2 });
    else node = sv('circle', { cx: x, cy: y, r: p.kind === 'win' ? 7.5 : 4.5, fill: p.kind === 'win' ? star : css('--muted'), opacity: p.kind === 'win' ? 1 : .75, stroke: css('--card'), 'stroke-width': 1.5 });
    gPts.append(node);
    const label = p.kind === 'target' ? 'result' : words[p.id];
    const fs = p.kind === 'cand' ? 12 : 14, tw = label.length * fs * 0.58 + 4, th = fs + 2;
    const cands8 = [[11, 5], [-11 - tw, 5], [-tw / 2, -12], [-tw / 2, th + 9], [11, -8], [-11 - tw, -8], [11, 17], [-11 - tw, 17]];
    let chosen = null, fallback = null;
    for (const [dx, dy] of cands8) {
      const b = { x: x + dx, y: y + dy - fs + 2, w: tw, h: th, dx, dy };
      if (b.x < 2 || b.x + b.w > W - 2 || b.y < 2 || b.y + b.h > H - 2) continue;
      if (!fallback) fallback = b;
      if (fits(b)) { chosen = b; break; }
    }
    if (!chosen && p.kind !== 'cand') chosen = fallback;
    if (chosen) {
      placed.push(chosen);
      const t = sv('text', { x: x + chosen.dx, y: y + chosen.dy, 'font-size': fs, 'font-weight': p.kind === 'cand' ? 500 : 700, fill: p.kind === 'term' ? p.color : p.kind === 'cand' ? css('--muted') : css('--ink') });
      t.textContent = label; gLabels.append(t);
    }
    const info = p.kind === 'target' ? `<b>result vector</b><br><small>${eqText(terms)}<br>length ${last.tn.toFixed(2)} (not a real word)</small>`
      : p.kind === 'term' ? `<b>${words[p.id]}</b><br><small>you typed ${opSym(p.t.sign)}${words[p.id]}</small>`
      : `<b>#${p.rank} ${words[p.id]}</b><br><small>cosine to result ${p.r.cosT.toFixed(3)}</small>`;
    hoverTip(node, tip, info, svg);
  }
  legend.append(
    el('span', {}, el('i', { style: `background:${css('--c1')}` }), 'words you typed'),
    ...(single ? [] : [el('span', {}, el('i', { class: 'sq', style: `background:${star}` }), 'result ★')]), el('span', {}, el('i', { style: `background:${star}` }), 'best answer'),
    el('span', {}, el('i', { style: `background:${css('--muted')}` }), 'other nearby words'));
}
function starPath(cx, cy, R, r) { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1); } return d + 'Z'; }
function hoverTip(node, tip, html, svg) {
  const show = e => {
    tip.innerHTML = html; tip.hidden = false;
    const box = svg.getBoundingClientRect(), host = svg.parentElement.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    let x = r.left - host.left + r.width / 2 + 12, y = r.top - host.top - 10;
    const tw = tip.offsetWidth; if (x + tw > host.width) x = r.left - host.left - tw - 8; if (x < 0) x = 4;
    tip.style.left = x + 'px'; tip.style.top = Math.max(0, y) + 'px';
  };
  node.style.cursor = 'pointer';
  node.addEventListener('mouseenter', show); node.addEventListener('focus', show);
  node.addEventListener('mouseleave', () => tip.hidden = true); node.addEventListener('click', show);
}

/* ---------------- barcodes ---------------- */
function renderBarcodes() {
  const box = $('#barcodes'), { terms, target, shown, tn } = last; box.textContent = '';
  if (!shown.length) return;
  const row = (op, label, vec, color, scale = 1) => {
    const c = el('canvas', { width: DIM, height: 1, 'aria-label': `vector for ${label}` });
    paint(c, vec, scale);
    box.append(el('span', { class: 'op' }, op), el('span', { class: 'lbl', style: color ? `color:${color}` : '' }, label), c);
  };
  terms.forEach((t, i) => row(i === 0 && t.sign > 0 ? '' : opSym(t.sign), words[t.id], t.vec, t.color));
  box.append(el('div', { class: 'sep' }));
  row('=', 'result', target, css('--star'), 1 / tn);
  row('≈', words[shown[0].id], unit(shown[0].id), css('--ink'));
  box.append(el('div', { class: 'simnote' }, terms.length > 1 ? `The result was rescaled to unit length so its colours compare fairly. cos(result, ${words[shown[0].id]}) = ${shown[0].cosT.toFixed(3)}: the strips agree in most places but not all, because no real word sits exactly on the result.` : `Its nearest neighbour ${words[shown[0].id]} has cosine ${shown[0].cosT.toFixed(3)}, so the two strips share many of the same light and dark bands.`));
}
function paint(canvas, v, scale) {
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(DIM, 1);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
  const mid = dark ? [28, 32, 54] : [244, 245, 250], neg = [225, 29, 72], pos = [8, 145, 178];
  for (let j = 0; j < DIM; j++) {
    const x = Math.max(-1, Math.min(1, v[j] * scale / 0.16)), c = x < 0 ? neg : pos, a = Math.abs(x);
    for (let k = 0; k < 3; k++) img.data[j * 4 + k] = mid[k] + (c[k] - mid[k]) * a;
    img.data[j * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------- galaxy ---------------- */
const CAT_COLORS = ['#7c3aed', '#0891b2', '#2563eb', '#ea580c', '#16a34a', '#a16207', '#e11d48', '#db2777', '#0d9488', '#9333ea', '#ca8a04'];
let G = null, proj = 'tsne', clickMode = 'add';
const hiddenCats = new Set(), galaxyNeighbourCache = new Map();
async function initGalaxy() {
  G = await fetch('data/galaxy.json').then(r => r.json());
  const leg = $('#catLegend');
  G.categories.forEach((c, i) => {
    const b = el('button', { type: 'button', class: 'cat', style: `--cc:${CAT_COLORS[i]}`, 'aria-pressed': 'true' }, c);
    b.addEventListener('click', () => { hiddenCats.has(i) ? hiddenCats.delete(i) : hiddenCats.add(i); b.classList.toggle('off'); b.setAttribute('aria-pressed', !hiddenCats.has(i)); drawGalaxy(); });
    leg.append(b);
  });
  drawGalaxy(true);
}
function drawGalaxy(first) {
  const svg = $('#galaxy'), W = 1000, H = 625, pad = 40;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (first || svg.dataset.h != H) {
    svg.dataset.h = H; svg.textContent = '';
    const tip = $('#galTip');
    G.words.forEach((w, i) => {
      const g = sv('g', { class: 'gw', tabindex: 0, role: 'button', 'aria-label': w, 'data-i': i });
      const col = CAT_COLORS[G.cat[i]];
      g.append(sv('circle', { r: 6, fill: col, stroke: css('--card'), 'stroke-width': 1.5 }));
      const t = sv('text', { x: 9, y: 4, 'font-size': 13, fill: col, 'font-weight': 600 }); t.textContent = w; g.append(t);
      g.addEventListener('mouseenter', () => galTip(g, i));
      g.addEventListener('focus', () => galTip(g, i));
      g.addEventListener('mouseleave', () => tip.hidden = true);
      g.addEventListener('click', () => galClick(w));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); galClick(w); } });
      svg.append(g);
    });
  }
  const P = G[proj];
  svg.querySelectorAll('.gw').forEach(g => {
    const i = +g.dataset.i, x = pad + P[i][0] * (W - 2 * pad - 90), y = pad + (1 - P[i][1]) * (H - 2 * pad);
    g.style.transform = `translate(${x}px,${y}px)`; g.style.transition = first ? 'none' : 'transform .9s cubic-bezier(.2,.8,.2,1), opacity .3s';
    g.style.opacity = hiddenCats.has(G.cat[i]) ? 0.06 : 1; g.style.pointerEvents = hiddenCats.has(G.cat[i]) ? 'none' : '';
    g._x = x; g._y = y;
  });
  markGalaxy();
}
function galTip(g, i) {
  const tip = $('#galTip'), w = G.words[i], id = index.get(w.toLowerCase());
  let nb = '';
  if (id !== undefined && N) {
    if (!galaxyNeighbourCache.has(w)) { const v = unit(id); galaxyNeighbourCache.set(w, search([{ vec: v, sign: 1 }], v, 6, new Set([id])).filter(r => r.id !== id).slice(0, 5)); }
    nb = '<br><small>nearest: ' + galaxyNeighbourCache.get(w).map(r => `${words[r.id]} ${r.score.toFixed(2)}`).join(', ') + '</small>';
  }
  tip.innerHTML = `<b style="color:${CAT_COLORS[G.cat[i]]}">${w}</b> <small>${G.categories[G.cat[i]]}</small>${nb}<br><small>click to ${clickMode === 'add' ? 'add (+)' : clickMode === 'sub' ? 'subtract (−)' : 'use'}</small>`;
  tip.hidden = false;
  const host = $('#galaxy').parentElement.getBoundingClientRect(), r = g.querySelector('circle').getBoundingClientRect();
  let x = r.left - host.left + 14, y = r.top - host.top + 14; const tw = tip.offsetWidth;
  if (x + tw > host.width) x = r.left - host.left - tw - 6; tip.style.left = (Math.max(2, x) + $('#galaxy').parentElement.scrollLeft) + 'px'; tip.style.top = y + 'px';
}
function galClick(w) {
  const inp = $('#expr'), cur = inp.value.trim();
  if (clickMode === 'set' || !cur) inp.value = clickMode === 'sub' && cur ? `${cur} - ${w}` : (clickMode === 'sub' ? `- ${w}` : w);
  else inp.value = `${cur} ${clickMode === 'add' ? '+' : '-'} ${w}`;
  compute();
  let now = $('#galNow');
  if (!now) { now = el('p', { id: 'galNow', class: 'note', 'aria-live': 'polite' }); $('#galaxy').parentElement.before(now); }
  now.innerHTML = '';
  if (last && last.shown.length) now.append('Calculator now: ', el('b', {}, inp.value), ' ≈ ', el('b', { style: `color:${css('--c1')}` }, words[last.shown[0].id]), ' · ', el('a', { href: '#calcH', onclick: e => { e.preventDefault(); $('.calc').scrollIntoView({ behavior: 'smooth' }); } }, 'see the details'));
}
function markGalaxy() {
  if (!G) return;
  const typed = new Map(), winner = last && last.shown[0] ? lower[last.shown[0].id] : null;
  if (last) last.terms.forEach(t => typed.set(lower[t.id], t.color));
  $('#galaxy').querySelectorAll('.gw').forEach(g => {
    const w = G.words[+g.dataset.i].toLowerCase(), c = g.querySelector('circle');
    if (typed.has(w)) { c.setAttribute('r', 10); c.setAttribute('stroke', typed.get(w)); c.setAttribute('stroke-width', 4); }
    else if (w === winner) { c.setAttribute('r', 10); c.setAttribute('stroke', css('--star')); c.setAttribute('stroke-width', 4); }
    else { c.setAttribute('r', 6); c.setAttribute('stroke', css('--card')); c.setAttribute('stroke-width', 1.5); }
  });
  galaxyLabels();
}

// hide labels that would overlap (hover still shows the word); typed words and the answer win
function galaxyLabels() {
  if (!G) return;
  const typed = new Set(last ? last.terms.map(t => lower[t.id]) : []), win = last && last.shown[0] ? lower[last.shown[0].id] : '';
  const gs = [...$('#galaxy').querySelectorAll('.gw')].filter(g => !hiddenCats.has(G.cat[+g.dataset.i]));
  const pri = g => { const w = G.words[+g.dataset.i].toLowerCase(); return typed.has(w) || w === win ? 0 : 1; };
  gs.sort((a, b) => pri(a) - pri(b));
  const placed = gs.map(g => ({ x: g._x - 6, y: g._y - 6, w: 12, h: 12 }));
  $('#galaxy').querySelectorAll('.gw text').forEach(t => t.style.display = 'none');
  for (const g of gs) {
    const w = G.words[+g.dataset.i], tw = w.length * 7.2 + 2, t = g.querySelector('text');
    const opts = [[8, -9, 9, 'start'], [-8 - tw, -9, -9, 'end'], [-tw / 2, -22, 0, 'middle'], [-tw / 2, 7, 0, 'middle']];
    const ok = opts.find(([dx, dy]) => { const b = { x: g._x + dx, y: g._y + dy, w: tw, h: 14 };
      if (b.x < 2 || b.x + b.w > 998 || b.y < 2 || b.y + b.h > 623) return false;
      return !placed.some(q => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y && !(q.x === g._x - 6 && q.y === g._y - 6)); }) || (pri(g) === 0 ? opts[0] : null);
    if (ok) {
      const [dx, dy, tx, anchor] = ok; placed.push({ x: g._x + dx, y: g._y + dy, w: tw, h: 14 });
      t.setAttribute('x', anchor === 'middle' ? 0 : tx); t.setAttribute('y', anchor === 'middle' ? dy + 11 : 4); t.setAttribute('text-anchor', anchor); t.style.display = '';
    }
  }
}

/* ---------------- autocomplete ---------------- */
let sugIdx = -1;
function currentToken() {
  const inp = $('#expr'), pos = inp.selectionStart ?? inp.value.length, v = inp.value;
  let a = pos; while (a > 0 && !/[\s+\-−–]/.test(v[a - 1])) a--;
  let b = pos; while (b < v.length && !/[\s+\-−–]/.test(v[b])) b++;
  return { a, b, text: v.slice(a, b) };
}
function updateSuggest() {
  const ul = $('#suggest'), tok = currentToken(), p = tok.text.toLowerCase(); ul.textContent = ''; sugIdx = -1;
  if (!p || !N) return closeSuggest();
  const out = [];
  for (let i = 0; i < N && out.length < 8; i++) if (lower[i].startsWith(p) && lower[i] !== p) out.push(i);
  if (!out.length) return closeSuggest();
  out.forEach((id, k) => {
    const li = el('li', { role: 'option', id: 'sg' + k, 'aria-selected': 'false' }, el('span', {}, words[id]), el('small', {}, `#${(id + 1).toLocaleString()} most common`));
    li.addEventListener('mousedown', e => { e.preventDefault(); pick(id); });
    ul.append(li);
  });
  ul.hidden = false; $('#expr').setAttribute('aria-expanded', 'true');
}
function closeSuggest() { $('#suggest').hidden = true; $('#expr').setAttribute('aria-expanded', 'false'); $('#expr').removeAttribute('aria-activedescendant'); }
function pick(id) {
  const inp = $('#expr'), tok = currentToken();
  inp.value = inp.value.slice(0, tok.a) + words[id] + inp.value.slice(tok.b);
  const caret = tok.a + words[id].length; inp.setSelectionRange(caret, caret);
  closeSuggest(); compute();
}

/* ---------------- wiring ---------------- */
const PRESETS = [
  ['king - man + woman', 'royalty'], ['Paris - France + Italy', 'capitals'], ['Berlin - Germany + Japan', 'capitals'],
  ['walking - walk + swim', 'verb form'], ['went - go + see', 'past tense'], ['bigger - big + small', 'comparative'],
  ['best - good + bad', 'superlative'], ['actor - man + woman', 'gender'], ['uncle - man + woman', 'family'],
  ['cars - car + apple', 'plural'], ['sushi - Japan + Germany', 'food'], ['Einstein - scientist + painter', 'people'],
  ['Messi - football + tennis', 'sport'], ['doctor - man + woman', 'bias'], ['coffee', 'neighbours'],
];
function onReady() {
  const box = $('#presets');
  PRESETS.forEach(([e, tag]) => box.append(el('button', { class: 'preset', type: 'button', onclick: () => { $('#expr').value = e; closeSuggest(); compute(); } }, el('b', {}, e.replace(/ - /g, ' − ')), ` · ${tag}`)));
  compute();
}
function wire() {
  const inp = $('#expr');
  try { const m = location.hash.match(/q=([^&]+)/); if (m) inp.value = decodeURIComponent(m[1]); } catch (e) {}
  inp.addEventListener('input', () => { updateSuggest(); schedule(); });
  inp.addEventListener('click', updateSuggest);
  inp.addEventListener('blur', () => setTimeout(closeSuggest, 120));
  inp.addEventListener('keydown', e => {
    const ul = $('#suggest'); if (ul.hidden) return;
    const items = [...ul.children];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, k) => li.setAttribute('aria-selected', k === sugIdx)); inp.setAttribute('aria-activedescendant', 'sg' + sugIdx);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && sugIdx >= 0) {
      e.preventDefault(); items[sugIdx].dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') closeSuggest();
  });
  $('#clearBtn').addEventListener('click', () => { inp.value = ''; inp.focus(); compute(); });
  $('#exclude').addEventListener('change', e => { exclude = e.target.checked; compute(); });
  $('#k').addEventListener('input', e => { K = +e.target.value; $('#kOut').textContent = K; schedule(); });
  const seg = (sel, attr, fn) => document.querySelectorAll(`${sel} [data-${attr}]`).forEach(b => b.addEventListener('click', () => {
    b.parentElement.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    fn(b.dataset[attr]);
  }));
  seg('.calc', 'm', v => { method = v; compute(); });
  seg('.galctl', 'p', v => { proj = v; drawGalaxy(); });
  seg('.galctl', 'c', v => { clickMode = v; });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { compute(); G && drawGalaxy(true); });
}
wire(); initGalaxy(); load();
})();
