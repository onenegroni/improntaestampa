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

/** Build a parametric surface, optionally clipping the patch along a signed UV boundary. */
export function surface(nu, nv, fn, { clip = null, wrapU = false, uvFn = null } = {}) {
  const pos = [], uv = [], idx = [];
  const addVertex = (u, v) => {
    const id = pos.length / 3;
    pos.push(...fn(u, v));
    uv.push(...(uvFn ? uvFn(u, v) : [u, v]));
    return id;
  };
  const rowWidth = nu + 1;
  const n = rowWidth * (nv + 1);
  const signed = clip && new Float32Array(n);
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      const id = addVertex(u, v);
      if (signed) signed[id] = clip(u, v);
    }
  }

  const intersections = new Map();
  function cutEdge(a, b) {
    const id = Math.min(a, b) * n + Math.max(a, b);
    const known = intersections.get(id);
    if (known !== undefined) return known;
    const u0 = a % rowWidth / nu, v0 = Math.floor(a / rowWidth) / nv;
    const u1 = b % rowWidth / nu, v1 = Math.floor(b / rowWidth) / nv;
    let lo = 0, hi = 1;
    const side = signed[a] >= 0;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) * .5;
      if ((clip(lerp(u0, u1, mid), lerp(v0, v1, mid)) >= 0) === side) lo = mid;
      else hi = mid;
    }
    const vertex = addVertex(lerp(u0, u1, (lo + hi) * .5), lerp(v0, v1, (lo + hi) * .5));
    intersections.set(id, vertex);
    return vertex;
  }
  function triangle(a, b, c) {
    const polygon = [];
    const face = [a, b, c];
    let last = c;
    for (const point of face) {
      const inside = signed[point] >= 0;
      if (inside !== (signed[last] >= 0)) polygon.push(cutEdge(last, point));
      if (inside) polygon.push(point);
      last = point;
    }
    for (let k = 2; k < polygon.length; k++) idx.push(polygon[0], polygon[k - 1], polygon[k]);
  }
  for (let row = 0; row < nv; row++) {
    for (let col = 0; col < nu; col++) {
      const a = row * rowWidth + col, b = a + 1, c = a + rowWidth, d = c + 1;
      if (!signed || (signed[a] >= 0 && signed[b] >= 0 && signed[c] >= 0 && signed[d] >= 0)) idx.push(a, b, d, a, d, c);
      else if (signed[a] >= 0 || signed[b] >= 0 || signed[c] >= 0 || signed[d] >= 0) {
        triangle(a, b, d);
        triangle(a, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (wrapU) {
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) {
      const a = j * rowWidth, b = j * rowWidth + nu;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b); const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
  }
  return g;
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
// knitted rib collar: a short band standing on the neckline, rolled slightly outward, with thickness
export function collar(fn, { h = 0.016 } = {}) {
  return surface(160, 10, (u, v) => {
    const p = fn(u, 1); const l = Math.hypot(p[0], p[2]) || 1;
    const out = Math.sin(v * Math.PI) * .0025 + .001;
    const up = h * Math.sin(v * Math.PI * .83);
    const inward = v > .46 ? (v - .46) * .012 : 0;
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

// A set-in sleeve starts on the same UV boundary that is cut out of the body.
// Its volume then eases into a flattened tube, with gravity folds at the elbow.
export function armhole(fn, side, { long = false, tank = false } = {}) {
  const centerU = side < 0 ? 0 : 0.5;
  const centerV = long ? 0.797 : 0.787;
  const radiusU = tank ? .128 : long ? .122 : .105;
  const radiusV = tank ? .202 : long ? .183 : .164;
  const wrap = u => (u + 1) % 1;
  const param = (a, scale = 1) => [
    wrap(centerU - side * radiusU * Math.cos(a) * scale),
    centerV + radiusV * (Math.sin(a) - .08 * Math.cos(a)) * scale,
  ];
  const clip = (u, v) => {
    const du = ((u - centerU + 1.5) % 1 - .5) / radiusU;
    const dv = (v - centerV) / radiusV - side * .08 * du;
    return du * du + dv * dv - 1;
  };
  const at = (a, scale) => fn(...param(a, scale));
  const uv = Array.from({length: 97}, (_, i) => fn.uv(...param(i / 96 * TAU, 1.075)));
  return { clip, at, uv };
}
export function sleeve(side, hole, { long = false } = {}) {
  const pts = long
    ? [[.151, .126, -.004], [.192, .098, -.005], [.221, -.012, .005], [.236, -.126, .021], [.239, -.236, .028], [.241, -.325, .039]]
    : [[.153, .122, -.002], [.191, .102, 0], [.227, .054, .010], [.261, -.005, .015]];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x * side, y, z)), false, 'centripetal');
  const frames = Array.from({length: 65}, (_, i) => {
    const v = i / 64;
    const center = curve.getPointAt(v);
    const tangent = curve.getTangentAt(v);
    const front = new THREE.Vector3(0, 0, 1).addScaledVector(tangent, -tangent.z).normalize();
    const upper = new THREE.Vector3().crossVectors(front, tangent).multiplyScalar(side);
    return { center, tangent, front, upper };
  });
  const outer = ({center, front, upper}, angle, rz, ry) => [
    center.x + front.x * Math.cos(angle) * rz + upper.x * Math.sin(angle) * ry,
    center.y + front.y * Math.cos(angle) * rz + upper.y * Math.sin(angle) * ry,
    center.z + front.z * Math.cos(angle) * rz + upper.z * Math.sin(angle) * ry,
  ];
  const endWidth = long ? .045 : .060;
  const endDepth = long ? .035 : .043;
  const shell = (u, v) => {
    const angle = u * TAU;
    const row = frames[Math.round(v * 64)];
    const folds = sstep(.27, .44, v) * (1 - sstep(.89, 1, v));
    const sideWeight = .25 + .75 * Math.pow(Math.abs(Math.cos(angle)), 1.8);
    const pinch = (
      Math.sin(v * (long ? 24 : 19) + 2.8 * Math.cos(angle) + side * .7) * .62
      + Math.sin(v * 17 - 2.4 * Math.sin(angle)) * .38
      + vnoise(v * 11, angle * 1.6) * .19
    ) * folds * sideWeight;
    const amplitude = long ? .0052 : .0024;
    const width = lerp(long ? .092 : .087, endWidth, v) + amplitude * pinch;
    const depth = lerp(long ? .070 : .073, endDepth, v) + amplitude * 1.6 * pinch;
    const root = hole.at(angle, 1.005);
    const end = outer(row, angle, depth, width);
    const fade = sstep(0, long ? .34 : .62, v);
    return root.map((value, i) => lerp(value, end[i], fade));
  };
  const finish = frames[64];
  const trimWidth = long ? .048 : .011;
  const edge = (u, v) => {
    const angle = u * TAU;
    const x = v <= .72 ? v / .72 : 1 - (v - .72) * 2;
    const roll = .0016 * Math.sin(v * Math.PI);
    const radius = 1 - (long ? .12 : .015) * x - (v > .72 ? .16 * (v - .72) : 0);
    const center = finish.center.clone().addScaledVector(finish.tangent, trimWidth * x - .0015);
    return outer({ ...finish, center }, angle, endDepth * radius + roll, endWidth * radius + roll);
  };
  const orientation = u => side < 0 ? 1 - u : u;
  return {
    shell: surface(96, 64, shell, { wrapU: true, uvFn: (u, v) => [orientation(u), 1 - v] }),
    trim: surface(96, 14, edge, { wrapU: true, uvFn: (u, v) => [orientation(u), v] }),
  };
}

export function boundArmhole(hole) {
  return surface(136, 12, (u, v) => {
    const p = hole.at(u * TAU, 1.078 - .12 * v);
    const roll = .0028 * Math.sin(Math.PI * v);
    const length = Math.hypot(p[0], p[2]) || 1;
    return [p[0] + p[0] / length * roll, p[1], p[2] + p[2] / length * roll];
  }, { wrapU: true });
}

/* Two hood panels form a structured opening and a rounded crown, with a sewn lining. */
export function hood(fn) {
  const shell = (u, v) => {
    const th = Math.PI + (u * 2 - 1) * .84 * Math.PI;
    const neck = fn((th / TAU + .25) % 1, 1);
    const spread = -Math.cos(Math.PI * u);
    const arc = Math.pow(Math.sin(Math.PI * u), .86);
    const rise = Math.pow(v, .78);
    const crownRise = 1 - Math.pow(1 - v, 2.6);
    const behind = Math.sin(v * Math.PI) * Math.pow(arc, .69);
    const edgeX = -spread * (.065 + .078 * arc);
    const edgeY = .193 + .166 * arc + .012 * spread + .005 * Math.sin(u * Math.PI * 2.6);
    const edgeZ = .098 - .061 * arc + .016 * spread * arc;
    const wrinkle = Math.sin(u * Math.PI * 9 + v * 14) * .007 * behind * (1 - v);
    const fold = (Math.sin(u * Math.PI * 3 + v * 4) * .005 - .006) * arc * (1 - sstep(.05, .46, v));
    return [
      lerp(neck[0] * 1.015, edgeX, rise) - spread * .059 * behind,
      lerp(neck[1] - .002, edgeY, crownRise) + .007 * behind + wrinkle + fold,
      lerp(neck[2], edgeZ, v) - .126 * behind + wrinkle,
    ];
  };
  const lining = (u, v) => {
    const point = shell(u, v);
    const x0 = shell(Math.max(0, u - .001), v);
    const x1 = shell(Math.min(1, u + .001), v);
    const y0 = shell(u, Math.max(0, v - .001));
    const y1 = shell(u, Math.min(1, v + .001));
    const ua = new THREE.Vector3(x1[0] - x0[0], x1[1] - x0[1], x1[2] - x0[2]);
    const va = new THREE.Vector3(y1[0] - y0[0], y1[1] - y0[1], y1[2] - y0[2]);
    const inward = ua.cross(va).normalize().multiplyScalar(-(.0015 + .0020 * sstep(.12, .76, v)));
    return [point[0] + inward.x, point[1] + inward.y, point[2] + inward.z];
  };
  const join = (u, v, depth) => {
    const outside = shell(u, v);
    const inside = lining(u, v);
    return outside.map((value, i) => lerp(value, inside[i], depth));
  };
  return {
    outer: surface(112, 55, shell),
    inner: surface(112, 55, lining),
    edges: [
      surface(112, 5, (u, depth) => join(u, 1, depth)),
      surface(60, 4, (v, depth) => join(0, v, depth)),
      surface(60, 4, (v, depth) => join(1, v, depth)),
    ],
    eyelet: side => shell(side < 0 ? .92 : .08, .86),
  };
}

/* The short shares one hip edge with both legs, joined along a curved crotch seam. */
export function short() {
  const hip = (th, v) => {
    const sx = Math.sin(th), sz = Math.cos(th);
    const gather = Math.sin(th * 28) * .0018 * Math.pow(1 - v, 3);
    const fold = Math.sin(th * 9 + v * 4) * .0026 * Math.sin(Math.PI * v);
    return [(lerp(.172, .186, v) + gather + fold) * sx, -.104 * v, (lerp(.107, .119, v) + gather + fold) * sz];
  };
  const top = surface(140, 34, (u, v) => hip((u - .25) * TAU, v), {
    wrapU: true, uvFn: (u, v) => [u, 1 - .31 * v],
  });
  const leg = side => {
    const run = (u, v, inside = 0) => {
      const a = u * TAU, sine = Math.sin(a), cosine = Math.cos(a);
      const inner = Math.max(0, -sine);
      const join = inner > 0 ? [0, -.104 - inner * .051, .119 * cosine] : hip(side * a, 1);
      const drape = (Math.sin(a * 5 + side * 1.2 + .8 * v) * .0035 + vnoise(a * 2.3, v * 4) * .002) * v;
      const edge = [
        side * (.095 + sine * (.090 + drape - inside)),
        -.306 + .004 * Math.sin(a * 3 + side) + sine * -.004,
        cosine * (.089 + drape - inside) - .008,
      ];
      const blend = sstep(0, 1, v);
      // Blend the curved cut into the leg while retaining the exact sewn edge at v=0.
      return [lerp(join[0], edge[0], blend), lerp(join[1], edge[1], v), lerp(join[2], edge[2], blend)];
    };
    const uv = (u, v) => [.25 + side * u, .69 * (1 - v)];
    return [
      surface(96, 50, run, {wrapU: true, uvFn: uv}),
      surface(96, 6, (u, v) => { const p = run(u, 1, .0035 * v); p[1] += .010 * v; return p; }, {wrapU: true, uvFn: (u, v) => uv(u, 1 - v * .02)}),
    ];
  };
  const band = surface(136, 12, (u, v) => {
    const th = (u - .25) * TAU;
    const gather = (.6 + .4 * Math.sin(v * Math.PI)) * (.0013 * Math.sin(th * 35) + .0007 * Math.cos(th * 49));
    const roll = .0011 * Math.sin(v * Math.PI);
    return [(0.173 + roll + gather) * Math.sin(th), -.001 + .035 * v, (0.108 + roll + gather) * Math.cos(th)];
  }, {wrapU: true});
  return { top, left: leg(-1), right: leg(1), band };
}

export function flagGeo(w = 1.2, h = .8) {
  const geo = new THREE.PlaneGeometry(w, h, 78, 40);
  geo.translate(w / 2, 0, 0);
  geo.userData.width = w;
  waveFlag(geo, 0);
  return geo;
}
export function waveFlag(geo, t) {
  const positions = geo.attributes.position;
  const b = geo.userData.base || (geo.userData.base = positions.array.slice());
  const w = geo.userData.width;
  for (let i = 0; i < positions.count; i++) {
    const x = b[i * 3], y = b[i * 3 + 1], k = clamp(x / w, 0, 1);
    const softness = Math.pow(k, .83);
    const z = softness * (.062 * Math.sin(k * 9 - t * 1.52 + y * 2.3) + .016 * Math.sin(k * 17 - t * 2.12 + y * 6.7));
    const fall = k * k * (.054 + .016 * Math.sin(t * .62 - k * 2));
    positions.setXYZ(i, x - .040 * k * k, y - fall + softness * .018 * Math.sin(k * 7.3 - t * 1.21), z);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
}

/* Low-profile six-panel trucker cap with a curved sandwich visor and rear closure. */
export const CAP_SEAMS = Array.from({ length: 6 }, (_, i) => .75 - 1 / 12 + i / 6);
export function cap() {
  const RX = .105, RZ = .118, RY = .104;
  const crownAt = (u, v) => {
    const a = u * TAU, b = v * Math.PI / 2;
    const z = Math.sin(a);
    const front = Math.max(0, z);
    const taper = Math.pow(Math.max(0, Math.cos(b)), .73);
    const panel = Math.pow(.5 + .5 * Math.cos((u - .25) * 6 * TAU), 2.5) * .0027 * Math.sin(Math.PI * v);
    const pinch = Math.sin(a * 11 + 2 * v) * .0012 * Math.exp(-Math.pow((v - .2) / .18, 2));
    const shape = taper * (1 + .12 * front * Math.sin(v * Math.PI));
    const baseY = -.006 + .013 * Math.pow(Math.cos(a), 2) + .004 * z;
    return [(RX * shape - panel + pinch) * Math.cos(a),
      baseY * (1 - v) + RY * Math.sin(b) * (1 + .06 * front * (1 - v)),
      (RZ * shape - panel + pinch) * z - .024 * Math.pow(v, 1.25)];
  };
  const cut = u => Math.sqrt(Math.max(0, 1 - Math.pow((u - .75) / .088, 2))) * .245;
  const crownSurface = (u, v, inner = false) => {
    const point = crownAt(u, lerp(cut(u), 1, v));
    if (inner) { point[0] *= .978; point[2] *= .977; point[1] -= .002; }
    return point;
  };
  const crown = surface(156, 58, crownSurface, {wrapU: true, uvFn: (u, v) => [1 - u, lerp(cut(u), 1, v)]});
  const inner = surface(130, 14, (u, v) => crownSurface(u, v * .28, true), {wrapU: true});
  const band = surface(156, 8, (u, v) => {
    const outer = crownSurface(u, .065 * v);
    outer[0] *= 1.009 + .009 * Math.sin(v * Math.PI);
    outer[2] *= 1.009 + .009 * Math.sin(v * Math.PI);
    return outer;
  }, {wrapU: true});
  const visorFn = (u, v, layer = 0) => {
    const a = lerp(.33, Math.PI - .33, u);
    const base = crownAt(a / TAU, 0.025);
    const curve = Math.pow(Math.sin(u * Math.PI), .61);
    const cosine = Math.cos(a);
    return [
      base[0] * (1 - .15 * curve * v * Math.abs(cosine)),
      base[1] - (.018 + .037 * cosine * cosine) * v * curve - layer,
      base[2] + .087 * curve * v,
    ];
  };
  const visorTop = surface(98, 26, visorFn);
  const visorBottom = surface(98, 16, (u, v) => visorFn(u, v, .0035));
  const visorEdge = surface(98, 6, (u, v) => {
    const point = visorFn(u, 1, .0035 * v);
    point[2] += .0013 * Math.sin(v * Math.PI);
    return point;
  });
  const button = new THREE.SphereGeometry(.007, 24, 12, 0, TAU, 0, Math.PI / 2);
  button.scale(1, .57, 1); button.translate(0, RY, -.024);
  const snaps = surface(48, 8, (u, v) => {
    const x = (u - .5) * .113;
    return [x, -.005 + .014 * v + .004 * Math.sin(u * Math.PI), -RZ + .11 * x * x + Math.abs(x) * .29];
  });
  const closure = Array.from({length: 6}, (_, i) => {
    const x = -.025 + .009 * i;
    const button = new THREE.SphereGeometry(.00165, 10, 7);
    button.translate(x, .006, -RZ + Math.abs(x) * .29 - .0006);
    return button;
  });
  return { crown, inner, visorTop, visorBottom, visorEdge, button, band, snaps, closure };
}

export function zipperParts(fn) {
  const track = v => {
    if (v >= .07) return fn(.25, (v - .07) / .93 * .995);
    const hem = fn(.25, 0);
    return [hem[0], hem[1] + (v / .07 - 1) * .048, hem[2] * lerp(.95, 1, v / .07)];
  };
  const tape = surface(8, 116, (u, v) => {
    const [x, y, z] = track(v);
    const cross = (u - .5) * 2;
    return [x + cross * .010, y, z + .0035 + (1 - cross * cross) * .0016];
  });
  const tooth = new THREE.BoxGeometry(.0038, .00138, .0022);
  const unit = tooth.attributes.position;
  const normals = tooth.attributes.normal;
  const indices = tooth.index.array;
  const pos = [], nrm = [], index = [];
  const count = 188;
  for (let i = 0; i < count; i++) {
    const [x, y, z] = track(.017 + .967 * i / (count - 1));
    const side = i % 2 ? 1 : -1;
    const first = pos.length / 3;
    for (let k = 0; k < unit.count; k++) {
      pos.push(x + side * .0013 + unit.getX(k) * (unit.getZ(k) > 0 ? .86 : 1), y + unit.getY(k), z + .0055 + unit.getZ(k));
      nrm.push(normals.getX(k), normals.getY(k), normals.getZ(k));
    }
    indices.forEach(value => index.push(value + first));
  }
  tooth.dispose();
  const teeth = new THREE.BufferGeometry();
  teeth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  teeth.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  teeth.setIndex(index);
  return {tape, teeth, top: track(.995), bottom: track(.012)};
}
export function zipperPull() {
  const shape = new THREE.Shape();
  shape.moveTo(-.0038, 0); shape.lineTo(.0038, 0);
  shape.quadraticCurveTo(.0053, -.002, .0047, -.006);
  shape.lineTo(.0037, -.020);
  shape.quadraticCurveTo(.0034, -.023, 0, -.023);
  shape.quadraticCurveTo(-.0034, -.023, -.0037, -.020);
  shape.lineTo(-.0047, -.006);
  shape.quadraticCurveTo(-.0053, -.002, -.0038, 0);
  const opening = new THREE.Path();
  opening.absellipse(0, -.006, .0025, .0031, 0, TAU, true);
  shape.holes.push(opening);
  return new THREE.ExtrudeGeometry(shape, { depth: .0014, bevelEnabled: true, bevelSize: .00055, bevelThickness: .00045, bevelSegments: 2, steps: 1, curveSegments: 8 });
}
/* Two lined halves of a kangaroo pocket, shaped around the hand openings. */
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
    const lip = .0037 * Math.pow(1 - s, 5) * Math.sin(Math.PI * t);
    const volume = .0045 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t);
    const puff = .0008 + lip + volume;
    return [p[0] + p[0] / l * puff, p[1], p[2] + p[2] / l * puff];
  }, { uvFn: (s, t) => { const [u, v] = UV(s, t); return fn.uv(u, v); } });
}
export { vnoise, TAU, lerp, clamp };
