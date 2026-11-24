// Procedural garment geometry for Impronta configurator (all original, no external models).
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = t => t * t * (3 - 2 * t);
// spline-ish profile lookup: pts = [[y, val], ...] ascending y
function prof(pts, y) {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) { const t = (y - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return lerp(pts[i - 1][1], pts[i][1], smooth(t)); }
  }
  return pts[pts.length - 1][1];
}
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

/** Build a parametric surface. fn(u,v) -> [x,y,z]. skip(u,v) -> true to drop a quad. wrapU averages seam normals. */
export function surface(nu, nv, fn, { skip = null, wrapU = false, uvFn = null } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv; const p = fn(u, v); pos.push(p[0], p[1], p[2]);
    if (uvFn) { const q = uvFn(u, v); uv.push(q[0], q[1]); } else uv.push(u, v);
  }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (skip && skip((i + 0.5) / nu, (j + 0.5) / nv)) continue;
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (wrapU) {
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) {
      const a = j * W, b = j * W + nu;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b); const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
}

function tube(points, radiusFn, nu = 48, { ellip = 1, up = new THREE.Vector3(0, 0, 1) } = {}) {
  // points: array of Vector3 along path; radiusFn(t)
  const curve = new THREE.CatmullRomCurve3(points);
  const nv = points.length * 8;
  return surface(nu, nv, (u, v) => {
    const p = curve.getPointAt(v); const T = curve.getTangentAt(v);
    let N = up.clone().sub(T.clone().multiplyScalar(up.dot(T))).normalize(); const B = new THREE.Vector3().crossVectors(T, N);
    const a = u * TAU, r = radiusFn(v);
    return [p.x + (N.x * Math.cos(a) * ellip + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) * ellip + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) * ellip + B.z * Math.sin(a)) * r];
  }, { wrapU: true });
}

/* ---------------- TORSO ----------------
   A shirt hanging on a dress form: straight drop from chest to hem, defined shoulders that slope ~18deg
   to the neck, flat front panel, slightly fuller back, and a few believable folds (armpit, waist, hem). */
export const TORSO = { yHem: -0.34, yS: 0.165, H: 0.072, yNeck: 0.248 };
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function torsoFn(o) {
  const { yHem, yNeck } = TORSO;
  const widthP = o.width || [[-0.34, 0.212], [-0.2, 0.205], [-0.05, 0.207], [0.1, 0.214], [0.2, 0.216]];
  const dz = o.depth || 0;
  const bfP = [[-0.34, 0.112 + dz], [-0.15, 0.108 + dz], [0.02, 0.118 + dz], [0.12, 0.122 + dz], [0.2, 0.116 + dz]];
  const bbP = [[-0.34, 0.108 + dz], [-0.1, 0.1 + dz], [0.1, 0.104 + dz], [0.2, 0.1 + dz]];
  const kx = o.neckK || 0.35, kz = o.neckKZ || 0.56;
  const drop = o.neckDrop ?? 0.045, slope = o.slope ?? 0.31, yA = 0.04, q0 = o.q0 ?? 0.66;
  const wr = o.wrinkle ?? 1, nx = 2.6;
  const yN = th => yNeck - drop * Math.pow(Math.max(0, Math.cos(th)), 2.2);
  const fn = (u, v) => {
    const th = (u - 0.25) * TAU, c = Math.cos(th), s = Math.sin(th);
    const yTopN = yN(th), yl = lerp(yHem, yTopN, v);
    const q = clamp((yl - yA) / (yTopN - yA), 0, 1);
    const sa = 1 - (1 - kx) * sstep(q0, 1, q);
    const sb = 1 - (1 - kz) * Math.pow(sstep(0.35, 1, q), 1.4);
    const yy = Math.min(yl, 0.2);
    const a = prof(widthP, yy), b = c > 0 ? prof(bfP, yy) : prof(bbP, yy);
    let x = a * sa * Math.sign(s) * Math.pow(Math.abs(s), 2 / nx);
    let z = b * sb * Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.2);
    // shoulder line caps the height, so the top reads as a sloped plane, not a dome
    const ax = Math.abs(x), yTop = yNeck - slope * Math.max(0, ax - 0.072);
    let y = smin(yl, yTop, 0.012);
    // Broad gravity folds start near the side seams and deepen at the loose hem.
    // Smaller, asymmetric compression ridges pull away from each armpit.
    const side = Math.pow(Math.abs(s), 2.4);
    const hemWeight = sstep(0.05, -0.34, yl);
    const chest = Math.pow(Math.max(0, c), 5);
    const drape = (Math.sin(th * 5.0 + yl * 2.7) * 0.65 + Math.sin(th * 8.0 - yl * 3.5 + 1.7) * 0.35)
      * (0.0014 + 0.0073 * hemWeight) * (1 - 0.64 * chest * (1 - hemWeight));
    const pull = (ax - 0.15) * 0.8 + (yl - (s > 0 ? 0.066 : 0.080));
    const armpit = (Math.exp(-Math.pow(pull / 0.026, 2)) - 0.64 * Math.exp(-Math.pow((pull + 0.022) / 0.022, 2)))
      * sstep(0.08, 0.20, ax) * 0.0055;
    const waist = Math.exp(-Math.pow((yl + 0.20 - 0.12 * s) / 0.073, 2)) * side
      * Math.sin(yl * 55 + th * 1.7) * 0.0028;
    const grain = vnoise(th * 6, yl * 15) * 0.00055;
    const edge = sstep(0.016, 0.003, v) * 0.0014;
    const off = (drape + armpit + waist + grain) * wr + edge;
    const length = Math.hypot(x, z) || 1;
    x += x / length * off + 0.0031 * hemWeight * wr;
    z += z / length * off;
    y += (Math.sin(th * 4 + 1.15) * 0.003 + Math.sin(th * 7 - 0.5) * 0.0012) * sstep(0.12, 0, v) * wr;
    return [x, y, z];
  };
  // arc-length U: the cross-section is a superellipse, so equal angle steps are NOT equal fabric widths.
  // Re-map U per quadrant by arc length at chest height so prints and lettering are never stretched.
  const NS = 1024, cum = new Float64Array(NS + 1);
  { const a0 = prof(widthP, 0.05), bf = prof(bfP, 0.05), bb = prof(bbP, 0.05); let px = 0, pz = 0;
    for (let i = 0; i <= NS; i++) { const th = (i / NS - 0.25) * TAU, s = Math.sin(th), c = Math.cos(th); const x = a0 * Math.sign(s) * Math.pow(Math.abs(s), 2 / nx), z = (c > 0 ? bf : bb) * Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.2);
      cum[i] = i ? cum[i - 1] + Math.hypot(x - px, z - pz) : 0; px = x; pz = z; } }
  const L = u => { const f = clamp(u, 0, 1) * NS, i = Math.min(NS - 1, Math.floor(f)); return lerp(cum[i], cum[i + 1], f - i); };
  const Q = [0, 0.25, 0.5, 0.75, 1].map(L);
  const arcU = u => { const q = Math.min(3, Math.floor(clamp(u, 0, 0.99999) * 4)); return (q + (L(u) - Q[q]) / (Q[q + 1] - Q[q])) / 4; };
  fn.uv = (u, v) => { const th = (u - 0.25) * TAU; const yl = lerp(yHem, yN(th), v); return [arcU(u), 0.8 * (yl - yHem) / (TORSO.yS - yHem)]; };
  fn.arcU = arcU;
  return fn;
}
export function torso(o = {}) {
  const fn = torsoFn(o);
  return { geo: surface(o.nu || 200, o.nv || 130, fn, { wrapU: true, skip: o.skip ? (u, v) => o.skip(u, v, fn) : null, uvFn: fn.uv }), fn };
}
// knitted rib collar: a short band standing on the neckline, rolled slightly outward, with thickness
export function collar(fn, { h = 0.016 } = {}) {
  return surface(160, 10, (u, v) => {
    const p = fn(u, 1); const l = Math.hypot(p[0], p[2]) || 1;
    const a = v * Math.PI; // fold: outer face up, then inner face back down
    const out = Math.sin(a) * 0.0035 + 0.001, up = (1 - Math.cos(a)) * 0.5 * h;
    const inward = v > 0.5 ? (v - 0.5) * 0.006 : 0;
    return [p[0] + p[0] / l * (out - inward), p[1] + up - 0.002, p[2] + p[2] / l * (out - inward)];
  }, { wrapU: true });
}

// Turned fabric facing inside a neckline or hem. A rolled edge catches light
// and the inset surface gives the empty garment visible wall thickness.
export function facing(fn, neck) {
  return surface(160, 10, (u, v) => {
    const [x, y, z] = fn(u, neck ? 1 : 0);
    const inset = (neck ? 0.08 : 0.026) * Math.sin(v * Math.PI / 2);
    return [x * (1 - inset), y + (neck ? -0.029 : 0.019) * v, z * (1 - inset)];
  }, { wrapU: true });
}

/* ---------------- SLEEVES ----------------
   Empty sleeves: flattened front-to-back, falling from the shoulder under their own weight. */
function tubeE(points, radiusFn, ellipFn, nu = 96) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const nv = points.length * 10, up = new THREE.Vector3(0, 0, 1);
  return surface(nu, nv, (u, v) => {
    const p = curve.getPointAt(v), T = curve.getTangentAt(v);
    const N = up.clone().sub(T.clone().multiplyScalar(up.dot(T))).normalize(), B = new THREE.Vector3().crossVectors(T, N);
    const a = u * TAU, r = radiusFn(v, a), e = ellipFn(v);
    const cn = Math.cos(a) * e * r, sn = Math.sin(a) * r;
    return [p.x + N.x * cn + B.x * sn, p.y + N.y * cn + B.y * sn, p.z + N.z * cn + B.z * sn];
  }, { wrapU: true });
}
export function sleeve(side, { long = false } = {}) {
  const sx = side;
  const pts = long
    ? [new THREE.Vector3(0.15 * sx, 0.112, -0.004), new THREE.Vector3(0.212 * sx, 0.092, 0), new THREE.Vector3(0.243 * sx, -0.02, 0.006), new THREE.Vector3(0.256 * sx, -0.15, 0.024), new THREE.Vector3(0.258 * sx, -0.255, 0.05), new THREE.Vector3(0.262 * sx, -0.34, 0.062)]
    : [new THREE.Vector3(0.14 * sx, 0.122, -0.004), new THREE.Vector3(0.205 * sx, 0.106, 0), new THREE.Vector3(0.258 * sx, 0.035, 0.004), new THREE.Vector3(0.283 * sx, -0.028, 0.006)];
  const r0 = long ? 0.08 : 0.084, r1 = long ? 0.05 : 0.066;
  const rad = (t, a) => {
    const base = lerp(r0, r1, Math.pow(t, long ? 0.75 : 0.9));
    const belly = Math.pow(Math.max(0, -Math.sin(a)), 2);
    const elbow = Math.exp(-Math.pow((t - 0.57) / 0.21, 2));
    const gathers = Math.sin(t * 44 + 2 * Math.cos(a)) * (long ? 0.060 * elbow + 0.050 * sstep(.67, .93, t) : 0.038 * belly);
    const falloff = sstep(0.02, 0.16, t) * (1 - sstep(0.83, 1, t));
    return base * (1 - 0.07 * belly * (1 - t) + falloff * (gathers + vnoise(t * 7 + sx, a * 1.22) * 0.030));
  };
  const geo = tubeE(pts, rad, t => long ? lerp(0.74, 0.58, t) : lerp(0.86, 0.60, t));
  const end = pts[pts.length - 1], prev = pts[pts.length - 2];
  return { geo, end, dir: end.clone().sub(prev).normalize(), r1, ellip: long ? 0.58 : 0.6 };
}
export function cuff(end, dir, r, len, rScale = 0.97, ellip = 0.6) {
  const a = end.clone().addScaledVector(dir, -0.006), b = end.clone().addScaledVector(dir, len);
  return tubeE([a, a.clone().lerp(b, 0.5), b], t => r * lerp(1.01, rScale, t), () => ellip, 56);
}


/* ---------------- TANK TOP ARMHOLES ---------------- */
// Armhole = region of the torso surface outside an ellipse in the (|x|, y) plane: clean straps over the shoulder.
export const ARM = { cx: 0.238, cy: 0.222, rx: 0.106, ry: 0.192 };
export const inArmhole = p => { const dx = (Math.abs(p[0]) - ARM.cx) / ARM.rx, dy = (p[1] - ARM.cy) / ARM.ry; return dx * dx + dy * dy < 1; };
// closed binding loop: for each angle around the body find where the upward walk enters / leaves the armhole
export function armholeLoop(fn, side) {
  const ent = [], ex = [], N = 260, V = 160;
  for (let i = 0; i <= N; i++) {
    const th = side * Math.PI / 2 + (i / N - 0.5) * Math.PI * 0.98; const u = ((th / TAU + 0.25) % 1 + 1) % 1;
    let prev = inArmhole(fn(u, 0)), vin = null, vout = null;
    for (let j = 1; j <= V; j++) {
      const v = j / V, cur = inArmhole(fn(u, v));
      if (cur !== prev) {
        let lo = (j - 1) / V, hi = v; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (inArmhole(fn(u, m)) === prev) lo = m; else hi = m; }
        if (cur && vin === null) vin = hi; else if (!cur && vin !== null && vout === null) vout = hi;
      }
      prev = cur;
    }
    if (vin !== null) ent.push(fn(u, vin));
    if (vin !== null && vout !== null) ex.push(fn(u, vout));
  }
  const pts = ent.concat(ex.reverse()).map(p => new THREE.Vector3(p[0], p[1], p[2]));
  // light smoothing, keep closed
  const out = pts.map((p, i) => p.clone().add(pts[(i + 1) % pts.length]).add(pts[(i - 1 + pts.length) % pts.length]).multiplyScalar(1 / 3));
  return out.filter((p, i) => i % 2 === 0);
}

/* ---------------- HOOD (lying down on the back) ---------------- */
export function hood(fn) {
  const prof2 = [[0, 0], [0.004, 0.045], [0.03, 0.082], [0.07, 0.072], [0.094, 0.025], [0.1, -0.04], [0.098, -0.085]];
  const curve = new THREE.CatmullRomCurve3(prof2.map(p => new THREE.Vector3(p[0], p[1], 0)));
  const A = 0.8 * Math.PI;
  const f = (u, v, off = 0) => {
    const th = Math.PI + (u * 2 - 1) * A; // around the back
    const uu = (th / TAU + 0.25) % 1;
    const p = fn(uu, 1);
    const back = Math.pow(Math.max(0, -Math.cos(th)), 0.7), side = 0.35 + 0.65 * back;
    const c = curve.getPoint(Math.min(1, v * (0.55 + 0.45 * back)));
    const rx = p[0], rz = p[2], l = Math.hypot(rx, rz) || 1;
    const out = c.x * side * 0.95 + off, up = c.y * (0.5 + 0.25 * side);
    const w = 1 + vnoise(u * 10, v * 4) * 0.03;
    // ends taper toward the front neckline
    const end = smooth(Math.min(1, (1 - Math.abs(u * 2 - 1)) * 4));
    return [rx * 1.02 + rx / l * out * end * w, p[1] + up * end * w - 0.004, rz * 1.02 + rz / l * out * end * w];
  };
  const outer = surface(120, 36, (u, v) => f(u, v, 0));
  const inner = surface(120, 36, (u, v) => f(u, v, -0.004));
  return { outer, inner };
}

/* ---------------- SHORT ---------------- */
export function short(y0 = 0) {
  const top = surface(160, 24, (u, v) => {
    const th = (u - 0.25) * TAU, y = y0 - 0.11 * v;
    const a = lerp(0.178, 0.196, Math.sqrt(v)), b = lerp(0.116, 0.126, Math.sqrt(v));
    const s = Math.sin(th), c = Math.cos(th);
    const f = vnoise(th * 4, v * 5) * 0.0015 + Math.sin(th * 9) * 0.0012 * (1 - v);
    return [(a + f) * Math.sign(s) * Math.pow(Math.abs(s), 0.8), y, (b + f) * Math.sign(c) * Math.pow(Math.abs(c), 0.8)];
  }, { wrapU: true });
  const leg = sx => surface(110, 44, (u, v) => {
    const th = (u - 0.25) * TAU, y = y0 - 0.085 - 0.215 * v;
    const cx = sx * lerp(0.094, 0.108, v), r = lerp(0.1, 0.104, v), zr = lerp(1.2, 1.05, v);
    const f = 1 + (Math.sin(th * 4 + sx * 1.7) * 0.025 + vnoise(th * 3 + sx * 5, v * 4) * 0.03) * sstep(0.25, 1, v);
    return [cx + Math.sin(th) * r * f, y, Math.cos(th) * r * zr * f];
  }, { wrapU: true });
  const band = surface(160, 6, (u, v) => {
    const th = (u - 0.25) * TAU, y = y0 + 0.03 * v; const a = 0.18, b = 0.118; const s = Math.sin(th), c = Math.cos(th);
    const k = 1.006 + Math.sin(v * Math.PI) * 0.004;
    return [a * k * Math.sign(s) * Math.pow(Math.abs(s), 0.8), y, b * k * Math.sign(c) * Math.pow(Math.abs(c), 0.8)];
  }, { wrapU: true });
  return { top, legL: leg(-1), legR: leg(1), band };
}

/* ---------------- FLAG ---------------- */
export function flagGeo(w = 1.2, h = 0.8) { const g = new THREE.PlaneGeometry(w, h, 60, 40); g.translate(w / 2, 0, 0); return g; }
export function waveFlag(geo, t, w = 1.2) {
  const p = geo.attributes.position; if (!geo.userData.base) geo.userData.base = p.array.slice();
  const b = geo.userData.base;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3], y = b[i * 3 + 1]; const k = x / w;
    const z = Math.sin(x * 5.2 - t * 2.6 + y * 1.3) * 0.055 * k + Math.sin(x * 9 - t * 3.7) * 0.012 * k;
    p.setXYZ(i, x - k * k * 0.03, y - k * 0.04 * Math.abs(Math.sin(t * 0.7)) * 0.4 + Math.sin(x * 4 - t * 2) * 0.01 * k, z);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

/* ---------------- CAP ---------------- */
export function cap() {
  // 6-panel crown: base ellipse (rx, rz), rounded dome profile; front (+z) slightly taller
  const RX = 0.107, RZ = 0.12, RY = 0.112;
  const crown = surface(128, 40, (u, v) => {
    const g = u * TAU, b = v * Math.PI / 2;
    const c = Math.pow(Math.cos(b), 0.82), s = Math.sin(b);
    const fr = 1 + Math.max(0, Math.sin(g)) * 0.07 * Math.sin(v * Math.PI);
    return [RX * c * Math.cos(g) * fr, RY * s * (1 + Math.max(0, Math.sin(g)) * 0.04), RZ * c * Math.sin(g) * fr];
  }, { wrapU: true, uvFn: (u, v) => [1 - u, v] });
  // visor: attached to the front ~150deg of the crown base, protrudes forward, curved down at the sides
  const visor = surface(72, 14, (u, v) => {
    const g = lerp(0.32, Math.PI - 0.32, u);
    const sg = Math.sin(g), L = 0.088 * Math.pow(sg, 0.9);
    const bx = RX * 1.03 * Math.cos(g), bz = RZ * 1.03 * sg;
    const x = bx * (1 - v * 0.12), z = bz + v * L;
    const y = 0.004 - v * 0.016 - Math.pow(Math.cos(g), 2) * 0.022 * (0.25 + v);
    return [x, y, z];
  });
  const btn = new THREE.SphereGeometry(0.0095, 16, 8, 0, TAU, 0, Math.PI / 2); btn.scale(1, 0.7, 1); btn.translate(0, RY * 1.035, 0);
  const band = surface(128, 2, (u, v) => { const g = u * TAU; return [RX * 1.012 * Math.cos(g), v * 0.012, RZ * 1.012 * Math.sin(g)]; }, { wrapU: true });
  return { crown, visor, btn, band };
}

/* zipper path along torso front center */
export function zipper(fn) {
  const pts = []; for (let i = 0; i <= 40; i++) { const v = i / 40 * 0.995; const p = fn(0.25, v); pts.push(new THREE.Vector3(p[0], p[1], p[2] + 0.0035)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0042, 8, false);
}
/* zipper tape (two flat strips) + interlocking teeth as one merged geometry */
export function zipperParts(fn) {
  const tape = surface(4, 80, (u, v) => { const p = fn(0.25, v * 0.995); const x = (u - 0.5) * 0.02; return [p[0] + x, p[1], p[2] + 0.0062 - Math.abs(u - 0.5) * 0.003]; });
  const N = 150, pos = [], idx = [];
  const box = new THREE.BoxGeometry(0.0052, 0.0019, 0.0026);
  const bp = box.attributes.position.array, bi = box.index.array, bn = box.attributes.normal.array, nrm = [];
  for (let i = 0; i < N; i++) {
    const v = 0.01 + i / N * 0.975, p = fn(0.25, v), s = i % 2 ? 1 : -1, base = pos.length / 3;
    for (let k = 0; k < bp.length; k += 3) { pos.push(bp[k] + s * 0.0016 + p[0], bp[k + 1] + p[1], bp[k + 2] + p[2] + 0.0078); nrm.push(bn[k], bn[k + 1], bn[k + 2]); }
    for (let k = 0; k < bi.length; k++) idx.push(bi[k] + base);
  }
  const teeth = new THREE.BufferGeometry(); teeth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); teeth.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); teeth.setIndex(idx);
  return { tape, teeth };
}
/* kangaroo pocket: a second fabric layer following the torso surface, with rounded side openings */
// kangaroo pocket of a zip hoodie: two halves either side of the zipper, curved slit openings at the outer sides
const PK = { vB: 0.075, vT: 0.36 };
function pocketUV(side) { // side -1 = left half (u < .25), +1 = right half
  const uo = side < 0 ? 0.155 : 0.345, ui = side < 0 ? 0.2405 : 0.2595;
  return (s, t) => { const inset = 0.055 * smooth(t) * (1 - Math.sin(t * Math.PI * 0.5) * 0.25); const a = uo - side * inset; return [lerp(a, ui, s), lerp(PK.vB, PK.vT, t)]; };
}
export function pocketOutline(fn) {
  return [-1, 1].map(side => { const UV = pocketUV(side), out = [];
    for (let i = 0; i <= 24; i++) out.push(fn.uv(...UV(0, i / 24)));
    for (let i = 0; i <= 12; i++) out.push(fn.uv(...UV(i / 12, 1)));
    return out; });
}
export function pocket(fn, side) {
  const UV = pocketUV(side);
  return surface(40, 26, (s, t) => {
    const [u, v] = UV(s, t), p = fn(u, v), l = Math.hypot(p[0], p[2]) || 1;
    const puff = 0.0028 + Math.sin(Math.min(1, s * 1.1) * Math.PI * 0.5) * Math.sin(t * Math.PI) * 0.003;
    return [p[0] + p[0] / l * puff, p[1], p[2] + p[2] / l * puff];
  }, { uvFn: (s, t) => { const [u, v] = UV(s, t); return fn.uv(u, v); } });
}
export { vnoise, TAU, lerp, clamp };
