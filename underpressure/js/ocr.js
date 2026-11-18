// Riconoscimento offline del display LAICA BM2301.
// Lavora su oggetti {data, width, height} (come ImageData), senza dipendenze.

const CW = 360, CH = 500; // dimensione del display "raddrizzato"

function toGray(img, W) {
  const s = img.width / W, H = Math.round(img.height / s);
  const g = new Float32Array(W * H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.floor(x * s), y0 = Math.floor(y * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s)), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s));
    let sum = 0, n = 0;
    for (let yy = y0; yy < y1; yy += 2) for (let xx = x0; xx < x1; xx += 2) {
      const i = (yy * img.width + xx) * 4; sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++;
    }
    g[y * W + x] = sum / n;
  }
  return { g, W, H, s };
}

function blur(g, W, H, r) {
  const t = new Float32Array(g.length), o = new Float32Array(g.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += g[y * W + xx]; n++; } } t[y * W + x] = s / n;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += t[yy * W + x]; n++; } } o[y * W + x] = s / n;
  }
  return o;
}

function median(arr) { const a = Array.from(arr).sort((a, b) => a - b); return a[a.length >> 1]; }

/** Trova i 4 angoli del display LCD (in coordinate dell'immagine originale). */
export function detectLCD(img) {
  const W = 300; const { g: g0, H, s } = toGray(img, W); const g = blur(g0, W, H, 2);
  const cx = W >> 1, cy = H >> 1, rx = Math.round(W / 10), ry = Math.round(H / 10);
  const c = []; for (let y = cy - ry; y < cy + ry; y++) for (let x = cx - rx; x < cx + rx; x++) c.push(g[y * W + x]);
  const seed = median(c);
  let best = null; const all = [];
  for (const T of [10, 13, 7, 16]) {
    const r = grow(g, W, H, cx, cy, seed + T, s);
    if (r.ok) all.push(r);
    if (!best || Math.abs(r.ratio - 0.72) < Math.abs(best.ratio - 0.72)) best = r;
  }
  return all.length ? { ...all[0], candidates: all } : { ...best, candidates: [] };
}

function grow(g, W, H, cx, cy, lim, s) {
  const vis = new Uint8Array(W * H), q = new Int32Array(W * H); let qh = 0, qt = 0;
  q[qt++] = cy * W + cx; vis[cy * W + cx] = 1;
  let a = [Infinity, 0], b = [-Infinity, 0], cc = [-Infinity, 0], dd = [Infinity, 0], n = 0;
  while (qh < qt) {
    const p = q[qh++], x = p % W, y = (p / W) | 0; n++;
    if (x + y < a[0]) a = [x + y, p]; if (x - y > b[0]) b = [x - y, p];
    if (x + y > cc[0]) cc = [x + y, p]; if (x - y < dd[0]) dd = [x - y, p];
    const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
    for (const k of nb) if (k >= 0 && !vis[k] && g[k] < lim) { vis[k] = 1; q[qt++] = k; }
  }
  const frac = n / (W * H);
  const pt = p => ({ x: ((p % W) + 0.5) * s, y: (((p / W) | 0) + 0.5) * s });
  const corners = [pt(a[1]), pt(b[1]), pt(cc[1]), pt(dd[1])];
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const w = (dist(corners[0], corners[1]) + dist(corners[3], corners[2])) / 2;
  const h = (dist(corners[0], corners[3]) + dist(corners[1], corners[2])) / 2;
  const ratio = w / h;
  // il display del BM2301 è circa 0,72 (larghezza/altezza) e occupa una parte ragionevole della foto
  const ok = ratio > 0.6 && ratio < 0.85 && frac > 0.04 && frac < 0.6;
  return { corners, frac, ratio, ok };
}

// Omografia da rettangolo canonico -> quadrilatero (per campionare l'immagine).
function homography(src, dst) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  for (let i = 0; i < 8; i++) { // eliminazione di Gauss
    let m = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [B[i], B[m]] = [B[m], B[i]];
    for (let r = 0; r < 8; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; B[r] -= f * B[i]; }
  }
  return B.map((b, i) => b / A[i][i]).concat(1);
}

/** Raddrizza il display in una griglia di grigi CW x CH. */
export function warp(img, corners) {
  const h = homography([{ x: 0, y: 0 }, { x: CW, y: 0 }, { x: CW, y: CH }, { x: 0, y: CH }], corners);
  const out = new Float32Array(CW * CH), d = img.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const w = h[6] * x + h[7] * y + 1, u = (h[0] * x + h[1] * y + h[2]) / w, v = (h[3] * x + h[4] * y + h[5]) / w;
    const xi = Math.min(img.width - 1, Math.max(0, Math.round(u))), yi = Math.min(img.height - 1, Math.max(0, Math.round(v)));
    const i = (yi * img.width + xi) * 4; out[y * CW + x] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return { g: out, W: CW, H: CH };
}
export const CANVAS = { W: CW, H: CH };

// ---------- lettura delle cifre a 7 segmenti ----------

// Posizione dei segmenti nella cella della cifra (0..1), prima dell'inclinazione.
const SEG = { a: [0.5, 0.07], b: [0.88, 0.29], c: [0.88, 0.71], d: [0.5, 0.93], e: [0.12, 0.71], f: [0.12, 0.29], g: [0.5, 0.5] };
const DIGITS = {
  '0': ['abcdef'], '2': ['abdeg'], '3': ['abcdg'], '4': ['bcfg'], '5': ['acdfg'],
  '6': ['acdefg', 'cdefg'], '7': ['abc', 'abcf'], '8': ['abcdefg'], '9': ['abcdfg', 'abcfg'],
};
const SLANT = 0.12; // le cifre del BM2301 sono leggermente inclinate a destra

function percentile(arr, p) { const a = Float32Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; }

/** Binarizza il display raddrizzato e cancella la cornice scura ai bordi. */
function binarize(w) {
  const bg = percentile(w.g, 0.6), dark = percentile(w.g, 0.02), contrast = bg - dark;
  const thr = bg - Math.max(22, contrast * 0.45);
  const { W, H } = w, m = new Uint8Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = w.g[i] < thr ? 1 : 0;
  const rowDark = y => { let s = 0; for (let x = 0; x < W; x++) s += m[y * W + x]; return s / W; };
  const colDark = x => { let s = 0; for (let y = 0; y < H; y++) s += m[y * W + x]; return s / H; };
  const clrRow = y => m.fill(0, y * W, y * W + W), clrCol = x => { for (let y = 0; y < H; y++) m[y * W + x] = 0; };
  const lim = 0.08;
  for (let y = 0; y < H * lim; y++) { if (rowDark(y) > 0.5) clrRow(y); }
  for (let y = H - 1; y > H * (1 - lim); y--) { if (rowDark(y) > 0.5) clrRow(y); }
  for (let x = 0; x < W * lim; x++) { if (colDark(x) > 0.5) clrCol(x); }
  for (let x = W - 1; x > W * (1 - lim); x--) { if (colDark(x) > 0.5) clrCol(x); }
  // cornice sottile e irregolare: pulisco 2px fissi
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) m[y * W + x] = 0;
  return { m, W, H, contrast };
}

function sub(b, x0, y0, x1, y1) {
  const X0 = Math.round(x0 * b.W), X1 = Math.round(x1 * b.W), Y0 = Math.round(y0 * b.H), Y1 = Math.round(y1 * b.H);
  const W = X1 - X0, H = Y1 - Y0, m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = b.m[(y + Y0) * b.W + x + X0];
  return { m, W, H, X0, Y0 };
}

// Componenti connesse (4-vicinato) con bounding box.
function components(m, W, H, minArea) {
  const lab = new Int32Array(W * H), out = [], st = [];
  let id = 0;
  for (let i = 0; i < m.length; i++) if (m[i] && !lab[i]) {
    id++; st.push(i); lab[i] = id; let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    while (st.length) {
      const p = st.pop(), x = p % W, y = (p / W) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
        if (k >= 0 && m[k] && !lab[k]) { lab[k] = id; st.push(k); }
    }
    if (n >= minArea) out.push({ x0, y0, x1, y1, n });
  }
  return out;
}

function fill(b, cx, cy, rx, ry) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return 0;
  let s = 0, n = 0;
  for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
    if (x < 0 || y < 0 || x >= b.W || y >= b.H) continue; s += b.m[y * b.W + x]; n++;
  }
  return n ? s / n : 0;
}

function classify(on) {
  // distanza "morbida" tra il riempimento misurato e ciascun modello di cifra
  let best = null, second = null;
  for (const [d, pats] of Object.entries(DIGITS)) for (const p of pats) {
    let dist = 0;
    for (const k of Object.keys(SEG)) dist += Math.abs((p.includes(k) ? 1 : 0) - Math.min(1, on[k] / 0.6));
    if (!best || dist < best.dist) { if (best && best.d !== d) second = best; best = { d, dist }; }
    else if ((!second || dist < second.dist) && d !== best.d) second = { d, dist };
  }
  return { ...best, gap: second ? second.dist - best.dist : 9 };
}

/**
 * Legge un numero (fino a 3 cifre) in una fascia del display.
 * expH: altezza attesa delle cifre in pixel del display raddrizzato.
 */
function readNumber(bin, rect, expH, geo = { pitch: 0.65, full: 0.56, slant: SLANT }) {
  const SL = geo.slant ?? SLANT;
  const b = sub(bin, ...rect);
  let comps = components(b.m, b.W, b.H, 12);
  const maxH = Math.max(0, ...comps.map(c => c.y1 - c.y0 + 1));
  if (maxH < expH * 0.45) return { value: null, reason: 'empty' };
  const tall = comps.filter(c => c.y1 - c.y0 + 1 > maxH * 0.6);
  const top = Math.min(...tall.map(c => c.y0));
  const ends = comps.filter(c => c.y0 >= top - 3 && c.y1 <= top + expH * 1.12).map(c => c.y1);
  let digitH = Math.max(...ends) - top + 1;
  if (!(digitH > expH * 0.8 && digitH < expH * 1.15)) digitH = expH;
  const bot = top + digitH - 1;
  comps = comps.filter(c => c.y1 >= top - 3 && c.y0 <= bot + 3 && c.x1 - c.x0 + 1 >= 3);
  if (!comps.length) return { value: null, reason: 'empty' };
  // scarto i residui della cornice sul bordo destro (strisce sottili)
  comps = comps.filter(c => !(c.x1 >= b.W - 3 && c.x1 - c.x0 < digitH * 0.08));
  if (!comps.length) return { value: null, reason: 'empty' };
  const col = new Uint8Array(b.W);
  for (const c of comps) for (let x = c.x0; x <= c.x1; x++) col[x] = 1;
  const extent = (x0, x1) => { let e0 = -1, e1 = -1; for (let x = Math.max(0, Math.round(x0)); x <= Math.min(b.W - 1, Math.round(x1)); x++) if (col[x]) { if (e0 < 0) e0 = x; e1 = x; } return e0 < 0 ? null : [e0, e1]; };
  const R = Math.max(...comps.filter(c => c.y1 - c.y0 + 1 > digitH * 0.3).map(c => c.x1));
  if (!Number.isFinite(R)) return { value: null, reason: 'empty' };
  const pitch = digitH * geo.pitch, fullW = digitH * geo.full, cw = fullW - SL * digitH * 0.8;
  const sample = (mid) => {
    const on = {};
    for (const [sk, [sx, sy]] of Object.entries(SEG)) {
      const px = mid + (sx - 0.5) * cw + SL * (0.5 - sy) * digitH, py = top + sy * digitH;
      on[sk] = fill(b, px, py, Math.max(1, cw * 0.08), Math.max(1, digitH * 0.035));
      if (globalThis.__pts) globalThis.__pts.push([px + b.X0, py + b.Y0, on[sk] > 0.35]);
    }
    return on;
  };
  let text = '', conf = 1;
  const segs = [];
  const readCell = (mid) => {
    const on = sample(mid);
    const lit = Object.keys(SEG).filter(sk => on[sk] > 0.35).join('');
    segs.unshift(lit);
    if (!lit) return '';
    if (lit === 'bc' || lit === 'b' || lit === 'c') return on.b > 0.35 && on.c > 0.35 ? '1' : '?';
    const c = classify(on);
    if (c.dist > 1.3 || c.gap < 0.5) { conf = 0; return '?'; }
    conf = Math.min(conf, Math.max(0, 1 - c.dist / 1.5));
    return c.d;
  };
  // unità: cella che termina sul bordo destro delle cifre
  let uMid = R - fullW / 2;
  const u = readCell(uMid);
  if (!u) return { value: null, reason: 'empty' };
  text = u;
  // decine: una cella più a sinistra, agganciata alla cifra reale se possibile
  let tMid = uMid - pitch;
  const te = extent(tMid - fullW / 2 - digitH * 0.04, tMid + fullW / 2 + digitH * 0.02);
  if (te && te[1] - te[0] > digitH * 0.45 && te[1] - te[0] < digitH * 0.62) tMid = (te[0] + te[1]) / 2;
  const t = readCell(tMid);
  if (t) {
    text = t + text;
    // centinaia: il BM2301 mostra solo un "1" stretto (o un 2 per valori oltre 199)
    const hx1 = tMid - fullW / 2 - digitH * 0.01, hx0 = tMid - fullW / 2 - digitH * 0.4;
    const hc = comps.filter(c => c.x1 >= hx0 && c.x1 <= hx1 + digitH * 0.03 && c.y1 - c.y0 + 1 > digitH * 0.3);
    if (hc.length) {
      const he = extent(hx0 - digitH * 0.3, hx1);
      if (he && he[1] - he[0] < digitH * 0.3) { text = '1' + text; segs.unshift('bc'); }
      else { const h = readCell(tMid - pitch); text = (h || '?') + text; }
    }
  }
  const box = { top: top + b.Y0, bot: bot + b.Y0 };
  if (globalThis.__dbg) console.log('R', R, 'top', top, 'H', digitH, segs);
  if (!text || text.includes('?')) return { value: null, reason: 'unreadable', text, segs, box };
  return { value: parseInt(text, 10), text, conf, box, segs };
}

/** Quale delle 4 icone utente è accesa: 1 alto-sx, 2 alto-dx, 3 basso-sx, 4 basso-dx. */
function readProfile(bin, sysBox) {
  const b = sub(bin, 0, 0, 0.25, 0.32);
  const comps = components(b.m, b.W, b.H, 10).filter(c => c.x1 - c.x0 < b.W * 0.7 && c.y1 - c.y0 < b.H * 0.5);
  if (!comps.length) return { profile: null };
  // icona = gruppo (testa + busto) attorno alla componente più grande
  const big = comps.sort((p, q) => q.n - p.n)[0];
  const grp = comps.filter(c => Math.abs((c.x0 + c.x1) / 2 - (big.x0 + big.x1) / 2) < b.W * 0.15 && Math.abs((c.y0 + c.y1) / 2 - (big.y0 + big.y1) / 2) < b.H * 0.3);
  const x0 = Math.min(...grp.map(c => c.x0)), x1 = Math.max(...grp.map(c => c.x1));
  const y0 = Math.min(...grp.map(c => c.y0)), y1 = Math.max(...grp.map(c => c.y1));
  const cx = (x0 + x1) / 2 / bin.W, cy = (y0 + y1) / 2;
  const left = cx < 0.115;
  let top;
  if (sysBox) top = (cy - sysBox.top) / (sysBox.bot - sysBox.top) < 0.33;
  else top = cy / bin.H < 0.12;
  return { profile: top ? (left ? 1 : 2) : (left ? 3 : 4), debug: { cx: +cx.toFixed(3), rel: sysBox ? +((cy - sysBox.top) / (sysBox.bot - sysBox.top)).toFixed(2) : null } };
}

// Allarga leggermente il quadrilatero: meglio includere un po' di cornice che tagliare le cifre.
function expand(c, f) {
  const mx = c.reduce((s, p) => s + p.x, 0) / 4, my = c.reduce((s, p) => s + p.y, 0) / 4;
  return c.map(p => ({ x: p.x + (p.x - mx) * f * 2, y: p.y + (p.y - my) * f * 2 }));
}

const GEOS = [];
for (const pitch of [0.62, 0.65, 0.68]) for (const slant of [0.09, 0.12, 0.15]) GEOS.push({ pitch, full: 0.56, slant });

// Legge una fascia con più ipotesi geometriche e tiene il valore più votato.
function vote(bins, rect, expH) {
  const votes = new Map(); let any = null, nonEmpty = 0, n = 0;
  for (const bin of bins) for (const geo of GEOS) {
    const r = readNumber(bin, rect, expH, geo); n++;
    if (!any || (r.value != null && any.value == null)) any = r;
    if (r.reason !== 'empty') nonEmpty++;
    if (r.value == null) continue;
    const v = votes.get(r.value) || { score: 0, count: 0, r };
    v.score += 0.5 + r.conf; v.count++; votes.set(r.value, v);
  }
  if (nonEmpty < n / 2) return { value: null, reason: 'empty' };
  const ranked = [...votes.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length) return { ...any, value: null, reason: 'unreadable' };
  const top = ranked[0], second = ranked[1];
  const agreement = top.score / ranked.reduce((s, v) => s + v.score, 0);
  if (second && agreement < 0.5) return { ...top.r, value: null, reason: 'ambiguous', candidates: ranked.map(v => v.r.value) };
  return { ...top.r, conf: agreement * Math.min(1, top.count / (n * 0.3)), votes: top.count, alternatives: ranked.slice(1).map(v => v.r.value) };
}

/** Pipeline completa: immagine -> {sys, dia, pul, profile} oppure errore. */
export function recognize(img, corners) {
  if (globalThis.__pts) globalThis.__bin = null;
  const lcd = corners ? { corners, ok: true, candidates: [{ corners }] } : detectLCD(img);
  if (!lcd.ok) return { ok: false, error: 'display', lcd };
  const bins = lcd.candidates.slice(0, 3).map(c => binarize(warp(img, c.corners))).filter(b => b.contrast >= 35);
  if (!bins.length) return { ok: false, error: 'contrast', lcd };
  if (globalThis.__pts) globalThis.__bin = bins[0];
  const sys = vote(bins, [0.28, 0.0, 1, 0.34], 140);
  const dia = vote(bins, [0.28, 0.42, 1, 0.78], 135);
  const pul = vote(bins, [0.6, 0.78, 1, 1], 92);
  const sysBox = readNumber(bins[0], [0.28, 0.0, 1, 0.34], 140).box;
  const prof = readProfile(bins[0], sysBox);
  const res = { lcd, sys: sys.value, dia: dia.value, pul: pul.value, profile: prof.profile, detail: { sys, dia, pul, prof } };
  if (sys.reason !== 'empty' && dia.reason === 'empty' && pul.reason === 'empty') return { ...res, ok: false, error: 'incomplete' };
  if (sys.value == null || dia.value == null || pul.value == null) return { ...res, ok: false, error: 'unreadable' };
  const plausible = sys.value >= 60 && sys.value <= 280 && dia.value >= 30 && dia.value <= 200 && pul.value >= 30 && pul.value <= 220 && sys.value > dia.value;
  if (!plausible) return { ...res, ok: false, error: 'implausible' };
  res.confidence = Math.min(sys.conf, dia.conf, pul.conf);
  return { ...res, ok: true };
}
