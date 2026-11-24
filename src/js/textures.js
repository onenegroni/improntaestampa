// Canvas textures: print presets, text, logo, knit normal map.
import * as THREE from './vendor/three.module.min.js';

export function lum(hex) { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
export const ink = hex => (lum(hex) > 0.45 ? '#141414' : '#f4f1ec');
function rng(seed) { let s = seed % 2147483647 || 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function mix(a, b, t) { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, t).getHexString(); }

/** draw a print preset over a canvas region (x,y,w,h). k = px per metre scale factor (roughly) */
export const pcols = st => [st.colors.acento, st.colors.acento2 || '#f4f1ec', st.colors.acento3 || st.colors.acento];
// smooth organic blob (camouflage)
function blobPath(g, R, x, y, r, n = 9) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (0.55 + R() * 0.75); pts.push([x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr * 0.8]); }
  g.beginPath(); for (let i = 0; i <= n; i++) { const p0 = pts[i % n], p1 = pts[(i + 1) % n]; const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; i ? g.quadraticCurveTo(p0[0], p0[1], mx, my) : g.moveTo(mx, my); } g.closePath(); }

function hueShift(hex, deg) { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(((hsl.h + deg / 360) % 1 + 1) % 1, hsl.s, hsl.l); return '#' + c.getHexString(); }
function rgbOf(hex) { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; }
// one reusable scratch canvas (creating a canvas per repaint exhausts Safari's canvas memory budget on iPhone)
let _scr = null; function scratch(w, h) { if (!_scr) _scr = document.createElement('canvas'); if (_scr.width !== w || _scr.height !== h) { _scr.width = w; _scr.height = h; } else _scr.getContext('2d').clearRect(0, 0, w, h); return _scr; }
// tie-dye spiral, computed per pixel at 1/4 resolution then smoothly upscaled (soft by nature, cheap to draw)
function tieDye(g, w, h, cols, centres, R) {
  const lw = Math.max(16, Math.ceil(w / 4)), lh = Math.max(16, Math.ceil(h / 4));
  const cv = scratch(lw, lh); const cx = cv.getContext('2d'); const img = cx.createImageData(lw, lh), d = img.data;
  const C = cols.map(rgbOf), N = C.length, ph = R() * 10, sc = Math.min(lw, lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    let best = 1e9, bx = 0, by = 0; for (const [ux, uy] of centres) { let dx = x - ux * lw; if (dx > lw / 2) dx -= lw; if (dx < -lw / 2) dx += lw; const dy = (y - uy * lh) * 1.15, dd = dx * dx + dy * dy; if (dd < best) { best = dd; bx = dx; by = dy; } }
    const r = Math.sqrt(best) / sc, th = Math.atan2(by, bx);
    const n = Math.sin(x * 0.045 + ph) * Math.cos(y * 0.052 - ph) * 0.6 + Math.sin((x - y) * 0.021 + ph * 2) * 0.4;
    let t = th / (Math.PI * 2) + r * 2.1 + n * 0.05; t = ((t % 1) + 1) % 1 * N;
    const i = Math.floor(t), f = t - i, a = C[i % N], b = C[(i + 1) % N], m = f < 0.72 ? 0 : (f - 0.72) / 0.28, s = m * m * (3 - 2 * m);
    // crinkle: pale streaks radiating along the folds, strongest near band edges
    const edge = Math.max(0, 1 - Math.abs(f - 0.86) * 5), cr = Math.pow(Math.max(0, Math.sin(th * 34 + Math.sin(r * 12 + ph) * 1.6)), 26) * (0.15 + 0.85 * edge) * 0.6 + edge * 0.06;
    const k = (y * lw + x) * 4;
    for (let c = 0; c < 3; c++) { const v = a[c] + (b[c] - a[c]) * s; d[k + c] = v + (255 - v) * cr; }
    d[k + 3] = 255;
  }
  cx.putImageData(img, 0, 0); g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, w, h); g.restore();
}
function smiley(g, x, y, r, col) {
  g.save(); g.translate(x, y);
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.lineWidth = r * 0.09; g.strokeStyle = 'rgba(20,20,20,.85)'; g.stroke();
  g.fillStyle = 'rgba(20,20,20,.9)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * r * 0.33, -r * 0.22, r * 0.1, r * 0.2, 0, 0, 7); g.fill(); });
  g.lineWidth = r * 0.1; g.lineCap = 'round'; g.beginPath(); g.arc(0, r * 0.02, r * 0.55, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
  g.restore();
}
// a child's painted handprint: palm + fingers, with paint-stamp texture
function hand(g, R, x, y, s, rot, col) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col;
  g.beginPath(); g.ellipse(0, s * 0.18, s * 0.4, s * 0.46, 0, 0, 7); g.fill();
  const finger = (a, len, wd, ox) => { g.save(); g.translate(ox, -s * 0.12); g.rotate(a); g.beginPath(); g.ellipse(0, -len / 2, wd / 2, len / 2, 0, 0, 7); g.fill(); g.restore(); };
  finger(-0.32, s * 0.62, s * 0.19, -s * 0.24); finger(-0.1, s * 0.74, s * 0.2, -s * 0.08); finger(0.08, s * 0.72, s * 0.2, s * 0.09); finger(0.3, s * 0.58, s * 0.18, s * 0.24);
  g.save(); g.translate(-s * 0.32, s * 0.24); g.rotate(-1.05); g.beginPath(); g.ellipse(0, -s * 0.26, s * 0.1, s * 0.27, 0, 0, 7); g.fill(); g.restore();
  // stamp texture: tiny unpainted pores
  g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((R() - 0.5) * s * 0.8, (R() - 0.3) * s * 0.9, (0.6 + R() * 1.6) * s / 60, 0, 7); g.fill(); }
  g.restore();
}
export function drawPattern(g, preset, base, accentIn, w, h, { seed = 3, k = 1, region = 'body' } = {}) {
  const R = rng(seed);
  const [accent, ac2, ac3] = Array.isArray(accentIn) ? accentIn : [accentIn, '#f4f1ec', accentIn];
  g.save();
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  if (preset === 'galactico') {
    g.fillStyle = mix('#070b22', base, 0.15); g.fillRect(0, 0, w, h);
    const cols = [ac3, mix(ac3, '#ffffff', 0.18), ac2, mix(ac2, '#ff4fd8', 0.15), accent];
    for (let i = 0; i < 70; i++) {
      const x = R() * w, y = R() * h, r = (60 + R() * 260) * k;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); const c = cols[(R() * cols.length) | 0];
      gr.addColorStop(0, c + 'aa'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 1400 * k * (w * h) / (2048 * 1024); i++) {
      const x = R() * w, y = R() * h, r = R() * R() * 2.6 * k + 0.4;
      g.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.65})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 18; i++) { const x = R() * w, y = R() * h, r = 8 * k + R() * 10 * k; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffffee'); gr.addColorStop(1, '#ffffff00'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  } else if (preset === 'splash') {
    const band = region === 'body' ? 0.36 : 0.0;
    // hem band
    if (region === 'body') { g.fillStyle = accent; g.fillRect(0, h * 0.885, w, h * 0.115); g.fillStyle = ac3; g.fillRect(0, h * 0.885, w, h * 0.012); }
    const y0 = h * (1 - band - 0.12);
    for (let i = 0; i < 46 * (w / 2048); i++) {
      const y = y0 + R() * (h - y0), len = (80 + R() * 420) * k, x = R() * w;
      g.save(); g.translate(x, y); g.rotate(-0.33); g.fillStyle = i % 7 === 0 ? ac2 : i % 5 === 0 ? ac3 : accent; g.globalAlpha = 0.92;
      g.beginPath(); g.ellipse(0, 0, len / 2, (3 + R() * 9) * k, 0, 0, 7); g.fill(); g.restore();
    }
    for (let i = 0; i < 300 * (w / 2048); i++) {
      const x = R() * w, y = y0 - 80 * k + R() * (h - y0 + 80 * k); { const q = R(); g.fillStyle = q < 0.22 ? ac2 : q < 0.34 ? ac3 : accent; }
      g.beginPath(); g.arc(x, y, (1.5 + R() * R() * 14) * k, 0, 7); g.fill();
    }
    if (region !== 'body') { for (let i = 0; i < 60; i++) { const x = R() * w, y = R() * h; g.fillStyle = accent; g.beginPath(); g.arc(x, y, (1 + R() * 6) * k, 0, 7); g.fill(); } }
  } else if (preset === 'degrade') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base); gr.addColorStop(0.38, base); gr.addColorStop(0.86, accent); gr.addColorStop(1, ac3);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // halftone transition
    for (let y = h * 0.3; y < h * 0.75; y += 14 * k) for (let x = 0; x < w; x += 14 * k) {
      const t = (y - h * 0.3) / (h * 0.45); g.fillStyle = ac2; g.globalAlpha = 0.9; g.beginPath(); g.arc(x + ((y / (14 * k)) % 2) * 7 * k, y, t * 5.5 * k, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  } else if (preset === 'rayas') {
    const sw = 64 * k, gap = 150 * k;
    for (let x = -sw; x < w + gap; x += sw + gap) {
      g.fillStyle = accent; g.fillRect(x, 0, sw, h);
      g.fillStyle = ac2; g.fillRect(x + sw * 0.42, 0, sw * 0.16, h);
      g.fillStyle = ac3; g.fillRect(x + sw + gap * 0.5 - sw * 0.06, 0, sw * 0.12, h);
    }
  } else if (preset === 'camuflaje') {
    // organic camouflage, three ink layers over the garment colour
    [[ac3, 30, 140], [ac2, 26, 115], [accent, 22, 92]].forEach(([c, n, r]) => { g.fillStyle = c; const cnt = Math.round(n * (w * h) / (2048 * 1024) / Math.max(0.3, k * k)) + 6;
      for (let i = 0; i < cnt; i++) { blobPath(g, R, R() * w, R() * h, (r * (0.6 + R() * 0.8)) * k); g.fill(); } });
  } else if (preset === 'tiedye') {
    const centres = region === 'body' ? [[0.25, 0.5], [0.75, 0.5]] : [[0.3 + R() * 0.4, 0.5]];
    tieDye(g, w, h, [accent, ac2, base, ac3], centres, R);
    if (region === 'body') { // a few happy faces near the hem, away from the lettering
      const sm = [[0.1, 0.62, 46], [0.33, 0.8, 58], [0.17, 0.87, 34], [0.4, 0.58, 30], [0.62, 0.88, 40], [0.9, 0.84, 50], [0.56, 0.6, 28]];
      sm.forEach(([u, v, r], i) => smiley(g, u * w, v * h, r * k * 1.6, [ac2, ac3, accent, mix(ac2, '#ffffff', 0.2)][i % 4]));
    }
  } else if (preset === 'manitos') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, base); gr.addColorStop(0.55, mix(base, ac3, 0.35)); gr.addColorStop(1, ac3); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const pal = [accent, ac2, hueShift(accent, 120), hueShift(accent, 28), hueShift(accent, 220), hueShift(accent, -28), hueShift(accent, 270)];
    const n = Math.round(58 * (w * h) / (2048 * 1024) / Math.max(0.25, k * k)) + 8;
    for (let i = 0; i < n; i++) hand(g, R, R() * w, R() * h, (74 + R() * 26) * k, (R() - 0.5) * 2.2, pal[i % pal.length]);
  } else if (preset === 'geometrico') {
    // low-poly mosaic: triangles that shift from the garment colour (top) into the print colours (bottom)
    const s = 120 * k, cols = [accent, ac2, ac3]; const rows = Math.ceil(h / s) + 1, colsN = Math.ceil(w / s) + 2;
    const jit = []; for (let j = 0; j <= rows; j++) { jit.push([]); for (let i = 0; i <= colsN; i++) jit[j].push([(i - 0.5 + (j % 2) * 0.5) * s + (R() - 0.5) * s * 0.5, j * s + (R() - 0.5) * s * 0.4]); }
    const tri = (a, b, c, y) => { const t = y / h; const q = R(); let col = base; if (q < t * 1.15 - 0.12) col = cols[(R() * 3) | 0]; else if (q < t * 1.3) col = mix(base, cols[(R() * 3) | 0], 0.35);
      g.fillStyle = mix(col, R() < 0.5 ? '#000000' : '#ffffff', R() * 0.08); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 1; g.stroke(); };
    for (let j = 0; j < rows; j++) for (let i = 0; i < colsN; i++) { const a = jit[j][i], b = jit[j][i + 1], c = jit[j + 1][i], d = jit[j + 1][i + 1]; tri(a, b, c, (a[1] + c[1]) / 2); tri(b, d, c, (b[1] + d[1]) / 2); }
  }
  // subtle print grain
  g.globalAlpha = 0.05; for (let i = 0; i < 1200; i++) { g.fillStyle = R() < 0.5 ? '#000' : '#fff'; g.fillRect(R() * w, R() * h, 2, 2); } g.globalAlpha = 1;
  g.restore();
}

export function shade(g, W, H) {
  // fake ambient occlusion: darker toward side seams and the hem
  const gr = g.createLinearGradient(0, 0, W, 0);
  [[0, .16], [.09, 0], [.41, 0], [.5, .16], [.59, 0], [.91, 0], [1, .16]].forEach(([p, a]) => gr.addColorStop(p, `rgba(0,0,0,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const gv = g.createLinearGradient(0, 0, 0, H); gv.addColorStop(0, 'rgba(0,0,0,.08)'); gv.addColorStop(.12, 'rgba(0,0,0,0)'); gv.addColorStop(.93, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,.12)');
  g.fillStyle = gv; g.fillRect(0, 0, W, H);
}
function fitText(g, txt, font, maxW, size) { let s = size; g.font = font(s); while (g.measureText(txt).width > maxW && s > 8) { s -= 2; g.font = font(s); } return s; }
export function imMark(g, x, y, r) {
  g.fillStyle = '#f4f1ec'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#c8161d'; g.beginPath(); g.arc(x, y, r * 0.86, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.font = `italic ${r * 1.25}px "DM Serif Display"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('im', x - r * 0.04, y - r * 0.08);
}
export function drawLogo(g, img, x, y, size) {
  if (!img) return;
  const s = Math.min(size / img.width, size / img.height); const w = img.width * s, h = img.height * s;
  g.drawImage(img, x - w / 2, y - h / 2, w, h);
}

/* Torso canvas 2048x1024: front = left half (center x=512), back = right half (center x=1536). */
function stitch(g, sx, base, path) {
  g.save(); g.setLineDash([9 * sx, 6 * sx]); g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3.4 * sx; g.translate(0, 1.4 * sx); path(); g.translate(0, -1.4 * sx);
  g.strokeStyle = lum(base) > 0.6 ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.2)'; g.lineWidth = 2.2 * sx; path(); g.restore();
}
export function torsoCanvas(cv, st, { vOf, product, pocket = null }) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  drawPattern(g, st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 11, k: W / 2048, region: 'body' });
  const Y = y => (1 - vOf(y)) * H;
  shade(g, W, H);
  const base = st.preset === 'galactico' ? '#0a0f2a' : (st.preset === 'tiedye' || st.preset === 'manitos') ? '#1b1f3b' : st.colors.cuerpo;
  const t = ink(base), sx = W / 2048;
  g.textBaseline = 'alphabetic';
  // front chest
  const nm = (st.nombre || '').toUpperCase();
  if (product !== 'campera') {
    g.textAlign = 'left'; g.fillStyle = t;
    fitText(g, nm, s => `${s}px Anton`, 200 * sx, 78 * sx); if (st.preset !== 'liso' && st.preset !== 'degrade' && st.preset !== 'galactico') { g.save(); g.lineJoin = 'round'; g.strokeStyle = base; g.lineWidth = 9 * sx; g.strokeText(nm, 285 * sx, Y(0.085)); g.restore(); } g.fillText(nm, 285 * sx, Y(0.085));
    g.font = `600 ${21 * sx}px "Barlow Condensed"`; g.fillStyle = mix(t, base, 0.35);
    const sub = [st.espalda, st.escuela].filter(Boolean).join(' · ').toUpperCase();
    fitText(g, sub, s => `600 ${s}px "Barlow Condensed"`, 250 * sx, 25 * sx); g.fillText(sub, 287 * sx, Y(0.085) + 34 * sx);
    if (st.logoImg) drawLogo(g, st.logoImg, 680 * sx, Y(0.1), 110 * sx); else imMark(g, 680 * sx, Y(0.1), 42 * sx);
  } else {
    // campera: name on left chest (viewer's right side of zipper), logo on the other
    g.textAlign = 'center'; g.fillStyle = t;
    fitText(g, nm, s => `${s}px Anton`, 150 * sx, 54 * sx); g.fillText(nm, 338 * sx, Y(0.08));
    if (st.logoImg) drawLogo(g, st.logoImg, 650 * sx, Y(0.095), 100 * sx); else imMark(g, 650 * sx, Y(0.095), 38 * sx);
    // kangaroo pocket: topstitching along its edge (the pocket layer shares this texture)
    if (pocket) pocket.forEach((half, hi) => { const pts = half.map(([u, v]) => [u * W, (1 - v) * H]); const dir = hi ? -1 : 1;
      stitch(g, sx, base, () => { g.beginPath(); pts.forEach(([x, y], i) => { const xx = x + (i <= 24 ? dir * 7 : 0) * sx, yy = y + (i > 24 ? 7 : 0) * sx; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.stroke(); }); });
  }
  // double-needle hem + side seams (subtle, like real cut-and-sewn garments)
  if (product !== 'campera') stitch(g, sx, base, () => { [0.021, 0.03].forEach(d => { g.beginPath(); g.moveTo(0, Y(-0.34 + d)); g.lineTo(W, Y(-0.34 + d)); g.stroke(); }); });
  g.save(); g.globalAlpha = 0.22; g.strokeStyle = mix(base, '#000000', 0.55); g.lineWidth = 2.5 * sx; [0, W / 2, W].forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }); g.restore();
  const Yb = y => Y(y + (product === 'campera' ? -0.04 : 0));
  // back
  g.textAlign = 'center'; g.fillStyle = t;
  const busy = st.preset !== 'liso' && st.preset !== 'degrade';
  const outl = (txt, x, y, w) => { if (busy) { g.save(); g.lineJoin = 'round'; g.strokeStyle = base; g.lineWidth = w * sx; g.strokeText(txt, x, y); g.restore(); } g.fillText(txt, x, y); };
  fitText(g, nm, s => `${s}px Anton`, 420 * sx, 76 * sx); outl(nm, 1536 * sx, Yb(0.122), 10);
  if (st.numero) {
    const num = String(st.numero).slice(0, 3);
    fitText(g, num, s => `${s}px Anton`, 460 * sx, 300 * sx); g.lineWidth = 9 * sx;
    const ac = lum(st.colors.acento) - lum(base); g.strokeStyle = Math.abs(ac) < 0.08 ? t : st.colors.acento;
    if (st.preset === 'rayas') { g.lineJoin = 'round'; g.strokeStyle = base; g.lineWidth = 16 * sx; g.strokeText(num, 1536 * sx, Yb(-0.065)); g.fillStyle = t; g.fillText(num, 1536 * sx, Yb(-0.065)); }
    else { g.fillStyle = base === '#0a0f2a' ? 'rgba(10,15,42,.6)' : base; g.fillText(num, 1536 * sx, Yb(-0.065)); g.strokeText(num, 1536 * sx, Yb(-0.065)); }
  }
  if (st.espalda) { g.fillStyle = t; fitText(g, st.espalda.toUpperCase(), s => `${s}px Anton`, 520 * sx, 124 * sx); outl(st.espalda.toUpperCase(), 1536 * sx, Yb(-0.156), 12); }
  const frase = (st.frase || '').toUpperCase();
  if (frase) { g.fillStyle = mix(t, base, 0.18); fitText(g, frase, s => `600 ${s}px "Barlow Condensed"`, 640 * sx, 34 * sx); g.fillText(frase, 1536 * sx, Yb(-0.19)); }
  if (product === 'campera' && st.escuela) {
    g.fillStyle = t;
    fitText(g, st.escuela.toUpperCase(), size => `600 ${size}px "Barlow Condensed"`, 530 * sx, 29 * sx);
    g.fillText(st.escuela.toUpperCase(), 1536 * sx, Yb(0.068));
  }
  // brand tag below back collar
  imMark(g, 1536 * sx, Y(0.195), 13 * sx);
}

export function plainCanvas(cv, st, zone, { pattern = false, seed = 5 } = {}) {
  const g = cv.getContext('2d');
  if (pattern && st.preset !== 'liso') drawPattern(g, st.preset, st.colors[zone], pcols(st), cv.width, cv.height, { seed, k: cv.width / 2048, region: 'side' });
  else { g.fillStyle = st.colors[zone]; g.fillRect(0, 0, cv.width, cv.height); }
}
export function sleeveCanvas(cv, st, { stripe = true } = {}) {
  plainCanvas(cv, st, 'mangas', { pattern: st.printAll, seed: 9 });
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  if (stripe) { g.fillStyle = st.colors.punos; g.fillRect(0, H * 0.04, W, H * 0.035); }
  // hem topstitch near the sleeve opening
  const sx = W / 1024; stitch(g, sx, st.colors.mangas, () => { [0.1, 0.118].forEach(f => { g.beginPath(); g.moveTo(0, H * f); g.lineTo(W, H * f); g.stroke(); }); });
}
export function shortCanvas(cv, st) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  drawPattern(g, st.preset === 'splash' ? 'liso' : st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 21, k: W / 2048 });
  // side stripes at u=0 and u=0.5 (sides)
  g.fillStyle = st.colors.acento; [0, 0.5, 1].forEach(u => g.fillRect(u * W - 18, 0, 36, H));
  g.fillStyle = ink(st.colors.cuerpo); if (st.numero) { g.font = `${110}px Anton`; g.textAlign = 'center'; g.fillText(String(st.numero).slice(0, 3), W * 0.32, H * 0.75); }
}
export function flagCanvas(cv, st) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  drawPattern(g, st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 31, k: W / 2048 });
  const t = ink(st.preset === 'galactico' ? '#0a0f2a' : st.colors.cuerpo);
  g.textAlign = 'center'; g.fillStyle = t;
  const big = (st.espalda || '').toUpperCase();
  fitText(g, big, s => `${s}px Anton`, W * 0.8, 380); g.fillText(big, W / 2, H * 0.58);
  if (st.escuela) { g.font = `600 64px "Barlow Condensed"`; fitText(g, st.escuela.toUpperCase(), s => `600 ${s}px "Barlow Condensed"`, W * 0.7, 64); g.fillText(st.escuela.toUpperCase(), W / 2, H * 0.72); }
  if (st.logoImg) drawLogo(g, st.logoImg, W / 2, H * 0.2, 220); else imMark(g, W / 2, H * 0.2, 80);
}
export function capCanvas(cv, st) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  drawPattern(g, st.preset, st.colors.cuerpo, pcols(st), W, H, { seed: 41, k: W / 2048 * 0.7 });
  // panel seams
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i / 6 * W, 0); g.lineTo(i / 6 * W, H); g.stroke(); }
  // front logo/text at u=0.25 (front = +z => g=PI/2 => u=0.25)
  const t = ink(st.preset === 'galactico' ? '#0a0f2a' : st.colors.cuerpo);
  if (st.logoImg) drawLogo(g, st.logoImg, W * 0.75, H * 0.58, H * 0.34);
  if (st.espalda) {
    g.fillStyle = t;
    g.textAlign = 'center';
    const caption = st.espalda.toUpperCase();
    fitText(g, caption, size => `${size}px Anton`, W * 0.17, H * (st.logoImg ? 0.10 : 0.22));
    g.fillText(caption, W * 0.75, H * (st.logoImg ? 0.37 : 0.60));
  }
}
export function knitNormal(size = 256, kind = 'jersey') {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'); const img = g.createImageData(size, size);
  const height = (x, y) => {
    const u = x / size, v = y / size;
    const cycle = Math.PI * 2;
    if (kind === 'rib') {
      return Math.cos(u * cycle * 14) * .85 + Math.sin(v * cycle * 29 + Math.sin(u * cycle * 14)) * .14;
    }
    if (kind === 'mesh') {
      const row = Math.floor(v * 28), fx = ((u * 24 + row * .5) % 1) - .5, fy = (v * 28 % 1) - .5;
      return -.8 * Math.exp(-(fx * fx * 20 + fy * fy * 13)) + .18 * Math.sin((u + v) * cycle * 37);
    }
    if (kind === 'fleece') {
      return Math.sin(u * cycle * 23 + Math.sin(v * cycle * 27)) * .45
        + Math.sin(v * cycle * 19 + Math.cos(u * cycle * 17)) * .38;
    }
    const cx = u * 30, cy = v * 26, fx = cx % 1, fy = cy % 1;
    return Math.sin(fx * Math.PI) * .62 + Math.cos((fy + Math.abs(fx - .5) * .64) * cycle) * .38;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = height((x + 1) % size, y) - height((x - 1 + size) % size, y), dy = height(x, (y + 1) % size) - height(x, (y - 1 + size) % size);
    const n = [-dx * 0.5, -dy * 0.5, 1], l = Math.hypot(...n); const i = (y * size + x) * 4;
    img.data[i] = (n[0] / l * 0.5 + 0.5) * 255; img.data[i + 1] = (n[1] / l * 0.5 + 0.5) * 255; img.data[i + 2] = (n[2] / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
