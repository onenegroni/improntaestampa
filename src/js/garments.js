// Parametric garment geometry for the Impronta configurator.
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = t => t * t * (3 - 2 * t);
// Interpolate the cut of the fabric with a continuous tangent at each fitting mark.
function prof(points, y) {
  if (y <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [rightY, rightWidth] = points[i];
    if (y > rightY) continue;
    const [leftY, leftWidth] = points[i - 1];
    const [beforeY, beforeWidth] = points[Math.max(0, i - 2)];
    const [afterY, afterWidth] = points[Math.min(points.length - 1, i + 1)];
    const span = rightY - leftY;
    const t = (y - leftY) / span;
    const leftTangent = (rightWidth - beforeWidth) / (rightY - beforeY);
    const rightTangent = (afterWidth - leftWidth) / (afterY - leftY);
    return lerp(leftWidth, rightWidth, smooth(t))
      + span * t * (1 - t) * ((1 - t) * leftTangent - t * rightTangent);
  }
  return points[points.length - 1][1];
}
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

/** Build a parametric surface, optionally clipping the patch along a signed UV boundary. */
export function surface(nu, nv, fn, { clip = null, wrapU = false, uvFn = null, shade = null } = {}) {
  const pos = [], uv = [], idx = [], colors = [];
  const addVertex = (u, v) => {
    const id = pos.length / 3;
    pos.push(...fn(u, v));
    uv.push(...(uvFn ? uvFn(u, v) : [u, v]));
    if (shade) { const value = shade(u, v); colors.push(value, value, value); }
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
  if (shade) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
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

// Sample a sewn path once, then assemble its stitches into a single mesh.
export function trace(segments, sample) {
  return Array.from({ length: segments + 1 }, (_, index) => sample(index / segments));
}

export function thread(paths, { pitch = .0043, radius = .00039, normal = null } = {}) {
  const positions = [], normals = [], indices = [];
  const sides = 6, rows = 5;
  for (const points of paths) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    curve.arcLengthDivisions = Math.max(72, points.length * 2);
    const count = Math.max(1, Math.round(curve.getLength() / pitch));
    for (let stitch = 0; stitch < count; stitch++) {
      const start = curve.getPointAt((stitch + .14) / count);
      const end = curve.getPointAt((stitch + .73) / count);
      const middle = start.clone().lerp(end, .5);
      const tangent = end.clone().sub(start).normalize();
      const lift = new THREE.Vector3(...(normal || [middle.x, .16 * middle.y, middle.z]));
      lift.addScaledVector(tangent, -lift.dot(tangent)).normalize();
      if (lift.lengthSq() < .5) {
        lift.set(0, 1, 0).addScaledVector(tangent, -tangent.y).normalize();
      }
      const across = new THREE.Vector3().crossVectors(tangent, lift).normalize();
      const first = positions.length / 3;
      for (let row = 0; row < rows; row++) {
        const t = row / (rows - 1);
        const arch = Math.sin(t * Math.PI);
        const center = start.clone().lerp(end, t).addScaledVector(lift, arch * radius * 1.15);
        const r = radius * (.28 + .72 * arch);
        for (let side = 0; side < sides; side++) {
          const angle = side * TAU / sides;
          const axis = lift.clone().multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle));
          positions.push(center.x + axis.x * r, center.y + axis.y * r, center.z + axis.z * r);
          normals.push(axis.x, axis.y, axis.z);
          if (row < rows - 1) {
            const a = first + row * sides + side, b = first + row * sides + (side + 1) % sides;
            indices.push(a, b, b + sides, a, b + sides, a + sides);
          }
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function liftFromAxis(point, distance) {
  const length = Math.hypot(point[0], point[2]) || 1;
  return [point[0] + point[0] / length * distance, point[1], point[2] + point[2] / length * distance];
}

export function edgeSeam(sample, v) {
  return trace(128, u => liftFromAxis(sample(u, v), .00070));
}

const crease = (distance, width) => Math.exp(-Math.pow(distance / width, 2));

/* Torso sections follow the rib cage, shoulder blades, waist and pelvis.
   The visible surface adds fabric ease and tension folds around that form. */
export const TORSO = { yHem: -0.34, yS: 0.165, H: 0.072, yNeck: 0.248 };
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function torsoFn(o) {
  const { yHem, yNeck } = TORSO;
  const { width: widthP, frontDepth: bfP, backDepth: bbP } = o;
  const kx = o.neckK, kz = o.neckKZ;
  const drop = o.neckDrop, slope = o.slope, yA = 0.03;
  const wr = o.wrinkle, nx = 2.76;
  const heavy = o.heavy === true;
  const yN = th => {
    const front = Math.cos(th);
    return yNeck - drop * Math.pow(Math.max(0, front), o.tank ? 1.09 : 1.44)
      - (o.tank ? .027 : .017) * Math.max(0, -front) ** 1.5
      - (o.tank ? .021 : .0075) * (1 - front * front) ** 2;
  };
  const section = (u, y) => {
    const angle = (u - .25) * TAU;
    const across = Math.sin(angle), depth = Math.cos(angle);
    const width = prof(widthP, y);
    const volume = prof(depth > 0 ? bfP : bbP, y);
    const depthCurve = lerp(1.07, .89, sstep(-.18, .13, y));
    return [
      width * Math.sign(across) * Math.abs(across) ** (2 / nx),
      volume * Math.sign(depth) * Math.abs(depth) ** depthCurve,
      across,
      depth,
    ];
  };
  const fn = (u, v) => {
    const angle = (u - .25) * TAU;
    const yTopN = yN(angle), yl = lerp(yHem, yTopN, v);
    const q = clamp((yl - yA) / (yTopN - yA), 0, 1);
    const [sectionX, sectionZ, s, c] = section(u, Math.min(yl, .205));
    // The section stays wide through the armhole and turns over the deltoids
    // before joining the neckline. Front and rear retain separate depths.
    const shoulderTravel = .781 + .130 * Math.abs(s) ** 1.38;
    let x = sectionX * lerp(1, kx, sstep(shoulderTravel, 1, v));
    let z = sectionZ * lerp(1, kz, sstep(.43, 1, q));
    const ax = Math.abs(x);
    const shoulder = Math.max(0, ax - .073);
    const yTop = yNeck - slope * shoulder - .015 * sstep(.145, .205, ax)
      - .009 * Math.abs(c) * sstep(.089, .17, ax);
    let y = smin(yl, yTop, .013);

    const front = Math.max(0, c), back = Math.max(0, -c);
    const pectoral = .0057 * crease(ax - .087, .056) * crease(yl - .088, .114) * front ** 2;
    const shoulderBlade = .0078 * crease(ax - .098, .058) * crease(yl - .092, .110) * back ** 2;
    const posture = .012 * sstep(-.15, .149, yl) - .008 * sstep(-.075, -.32, yl);
    z += pectoral - shoulderBlade + posture;

    const side = Math.abs(s) ** 1.45;
    const ease = 1 - sstep(-.10, .12, yl);
    const hemWeight = sstep(-.083, -.34, yl);
    const drape = (.0021 + .0040 * hemWeight)
      * (Math.sin(angle * 5 + yl * 6.1) * .75 + Math.sin(angle * 9 - yl * 2.7) * .25);
    const armpitPath = yl - .035 + (ax - .143) * (s < 0 ? .64 : .84);
    const armpit = side * .0057 * (crease(armpitPath, .020) - .53 * crease(armpitPath + .020, .024));
    // Diagonal folds travel inwards from the seams as the fabric hangs loose
    // over the waist, leaving the upper chest clear for personalized artwork.
    const firstFold = yl + .242 + .020 * s + .043 * c + (ax - .086) * (s < 0 ? .69 : .45);
    const secondFold = yl + .171 - .018 * s - .027 * c + (ax - .070) * (s < 0 ? .29 : .77);
    const sideFold = side * ease * (
      (.010 + .002 * s) * (crease(firstFold, .022) - .57 * crease(firstFold + .024, .026))
      + (.006 - .002 * s) * (crease(secondFold, .027) - .58 * crease(secondFold + .029, .030))
    );
    const lengthwise = ease * (.0068 * crease(ax - .084 - .037 * hemWeight, .025)
      - .0039 * crease(ax - .057 - .028 * hemWeight, .029)) * (front + back * .62);
    const tuckPath = yl + .273 + .16 * x;
    const tuck = o.tucked ? .013 * (crease(tuckPath, .014) - .76 * crease(tuckPath + .018, .019))
      + .0084 * side * crease(tuckPath - .043, .019) : 0;
    const hemRoll = .0015 * crease(v - .028, .015);
    const off = (drape + armpit + (sideFold + lengthwise) * (heavy ? .72 : 1) + tuck) * wr + hemRoll;
    const length = Math.hypot(x, z) || 1;
    x += x / length * off + .006 * hemWeight * wr;
    z += z / length * off + .0048 * hemWeight * s;
    y += (Math.sin(angle * 2 + 1.15) * .0047 + Math.sin(angle * 5 - .5) * .0018 + .0033 * s)
      * sstep(.145, 0, v) * wr;
    return [x, y, z];
  };
  // arc-length U: the cross-section is a superellipse, so equal angle steps are NOT equal fabric widths.
  // Re-map U per quadrant by arc length at chest height so prints and lettering are never stretched.
  const NS = 1024, cum = new Float64Array(NS + 1);
  let previousX = 0, previousZ = 0;
  for (let i = 0; i <= NS; i++) {
    const [x, z] = section(i / NS, .05);
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(x - previousX, z - previousZ);
    previousX = x;
    previousZ = z;
  }
  const L = u => { const f = clamp(u, 0, 1) * NS, i = Math.min(NS - 1, Math.floor(f)); return lerp(cum[i], cum[i + 1], f - i); };
  const Q = [0, 0.25, 0.5, 0.75, 1].map(L);
  const arcU = u => { const q = Math.min(3, Math.floor(clamp(u, 0, 0.99999) * 4)); return (q + (L(u) - Q[q]) / (Q[q + 1] - Q[q])) / 4; };
  fn.uv = (u, v) => { const th = (u - 0.25) * TAU; const yl = lerp(yHem, yN(th), v); return [arcU(u), 0.8 * (yl - yHem) / (TORSO.yS - yHem)]; };
  fn.arcU = arcU;
  return fn;
}
// The rib knit lies on the opening and turns into the inside of the garment.
export function collar(fn, { h = .016 } = {}) {
  return surface(160, 14, (u, v) => {
    const [x, y, z] = fn(u, 1);
    const length = Math.hypot(x, z) || 1;
    const width = h * sstep(0, .82, v);
    const roll = .0019 * Math.sin(Math.PI * v) - .0011;
    const inset = width * .77;
    const rise = width * (.49 + .33 * Math.abs(z) / length)
      - .0035 * sstep(.77, 1, v);
    return [
      x + x / length * (roll - inset),
      y + rise,
      z + z / length * (roll - inset),
    ];
  }, { wrapU: true, shade: (u, v) => 1 - .23 * sstep(.80, 1, v) });
}

// Turned fabric facing inside a neckline or hem. A rolled edge catches light
// and the inset surface gives the empty garment visible wall thickness.
export function facing(fn, neck) {
  return surface(160, 10, (u, v) => {
    const [x, y, z] = fn(u, neck ? 1 : 0);
    const inset = (neck ? .105 : .032) * Math.sin(v * Math.PI / 2);
    return [x * (1 - inset), y + (neck ? -.047 : .023) * v, z * (1 - inset)];
  }, { wrapU: true, shade: (u, v) => lerp(.95, neck ? .43 : .68, sstep(.14, 1, v)) });
}

// A set-in sleeve starts on the same UV boundary that is cut out of the body.
// Its volume then eases into a flattened tube, with gravity folds at the elbow.
export function armhole(fn, side, { long = false, tank = false } = {}) {
  const centerU = side < 0 ? 0 : .5;
  const centerV = tank ? .766 : long ? .769 : .780;
  const radiusU = tank ? .119 : long ? .110 : .093;
  const radiusV = tank ? .166 : long ? .172 : .166;
  const frontTilt = tank ? .15 : .12;
  const widthAt = height => radiusU * (1 + .22 * height);
  const wrap = u => (u + 1) % 1;
  const param = (angle, scale = 1) => {
    const front = Math.cos(angle) * scale, height = Math.sin(angle) * scale;
    return [wrap(centerU - side * widthAt(height) * front), centerV + radiusV * (height - frontTilt * front)];
  };
  const clip = (u, v) => {
    const du = ((u - centerU + 1.5) % 1 - .5) * -side / radiusU;
    const dv = (v - centerV) / radiusV;
    // Invert the tilted armhole so the sleeve and the cut use the same sewn edge.
    const a = 1 + .22 * dv;
    const front = 2 * du / (a + Math.sqrt(Math.max(.01, a * a + .88 * frontTilt * du)));
    const height = dv + frontTilt * front;
    return front * front + height * height - 1;
  };
  const at = (a, scale) => fn(...param(a, scale));
  const threadPath = trace(70, t => liftFromAxis(at(t * TAU, 1.065), .00085));
  return { clip, at, threadPath };
}
export function sleeve(side, hole, { long = false, sport = false } = {}) {
  const rootCenter = new THREE.Vector3();
  for (let i = 0; i < 32; i++) rootCenter.add(new THREE.Vector3(...hole.at(i * TAU / 32)));
  rootCenter.multiplyScalar(1 / 32);
  const cut = long
    ? [[.023, -.031, .004], [.039, -.103, .009], [.044, -.205, .021], [.041, -.310, .040], [.036, -.395, .053]]
    : sport
      ? [[.023, -.024, .007], [.043, -.059, .009], [.062, -.100, .010], [.074, -.128, .012]]
      : [[.021, -.024, .007], [.037, -.052, .009], [.053, -.087, .011], [.064, -.119, .014]];
  const points = cut.map(([x, y, z]) => rootCenter.clone().add(new THREE.Vector3(x * side, y, z)));
  const curve = new THREE.CatmullRomCurve3([rootCenter, ...points], false, 'centripetal');
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
  function sleeveFrame(v) {
    const row = Math.min(63, Math.floor(v * 64));
    const fraction = v * 64 - row;
    const a = frames[row], b = frames[row + 1];
    if (fraction === 0) return a;
    if (fraction === 1) return b;
    return { center: a.center.clone().lerp(b.center, fraction), front: a.front.clone().lerp(b.front, fraction), upper: a.upper.clone().lerp(b.upper, fraction) };
  }
  const rootWidth = long ? .079 : .069, rootDepth = long ? .071 : .066;
  const endWidth = long ? .041 : sport ? .052 : .049;
  const endDepth = long ? .039 : sport ? .046 : .043;
  const shell = (u, v) => {
    const angle = u * TAU;
    const frame = sleeveFrame(v);
    const folds = sstep(.27, .44, v) * (1 - sstep(.89, 1, v));
    const sideWeight = .25 + .75 * Math.pow(Math.abs(Math.cos(angle)), 1.8);
    const pinch = (
      Math.sin(v * (long ? 14 : 17) + 2.8 * Math.cos(angle) + side * .7) * .61
      + Math.sin(v * 12 - 2.4 * Math.sin(angle)) * .25
      + vnoise(v * 11, angle * 1.6) * .11
    ) * folds * sideWeight;
    const amplitude = long ? .0046 : .003;
    const bend = Math.cos(angle + side * .45);
    const elbow = long ? .0086 * (.62 + .38 * bend) * (
      crease(v - .55 - .12 * bend + side * .031, .049)
      - .71 * crease(v - .614 - .096 * bend + side * .021, .054)
      + .44 * crease(v - .72 - .10 * bend - side * .013, .041)
    ) : .0042 * (.3 + .7 * Math.max(0, bend)) * (
      crease(v - .67 + .15 * bend, .086) - .54 * crease(v - .765 + .13 * bend, .088)
    );
    const gathers = (long ? .0018 : .0008) * crease(v - .89, .11) * (1 - sstep(.94, 1, v)) * Math.cos(angle * 5 + v * 10);
    const finish = Math.pow(v, long ? 1.15 : .82);
    const muscle = (long ? .0061 : .005) * (crease(v - .32, .19) - crease(.32, .19) * (1 - v))
      * (1 - sstep(.83, 1, v));
    const width = lerp(rootWidth, endWidth, finish) + muscle + amplitude * pinch + elbow + gathers;
    const depth = lerp(rootDepth, endDepth, finish) + muscle * 1.16 + amplitude * 1.4 * pinch + elbow * .56 + gathers;
    const root = hole.at(angle, 1.001);
    const sourceRing = outer(frames[0], angle, rootDepth, rootWidth);
    const currentRing = outer(frame, angle, depth, width);
    const seamFit = 1 - sstep(0, long ? .34 : .65, v);
    return currentRing.map((value, axis) => value + (root[axis] - sourceRing[axis]) * seamFit);
  };
  const finish = frames[64];
  const trimWidth = long ? .045 : .009;
  const edge = (u, v) => {
    const angle = u * TAU;
    const x = v <= .72 ? v / .72 : 1 - (v - .72) * 2;
    const roll = .0016 * Math.sin(v * Math.PI);
    const radius = 1 - (long ? .12 : .015) * x - (v > .72 ? .16 * (v - .72) : 0);
    const center = finish.center.clone().addScaledVector(finish.tangent, trimWidth * x - .0015);
    return outer({ ...finish, center }, angle, endDepth * radius + roll, endWidth * radius + roll);
  };
  const orientation = u => side < 0 ? 1 - u : u;
  const ring = (sample, v, lift) => trace(76, u => {
    const point = sample(u, v);
    const axis = new THREE.Vector3(...point).sub(finish.center);
    axis.addScaledVector(finish.tangent, -axis.dot(finish.tangent)).normalize();
    return [point[0] + axis.x * lift, point[1] + axis.y * lift, point[2] + axis.z * lift];
  });
  return {
    shell: surface(96, 64, shell, {
      wrapU: true, uvFn: (u, v) => [orientation(u), 1 - v],
      shade: (u, v) => 1 - (.055 + .10 * Math.max(0, -Math.sin(TAU * u))) * (1 - sstep(.06, .30, v)),
    }),
    trim: surface(96, 18, edge, {
      wrapU: true, uvFn: (u, v) => [orientation(u), v],
      shade: (u, v) => 1 - .36 * sstep(.68, 1, v),
    }),
    sleeveThread: ring(shell, .972, .00062),
    trimThread: ring(edge, .22, .00068),
  };
}

export function boundArmhole(hole) {
  return surface(136, 12, (u, v) => {
    const p = hole.at(u * TAU, lerp(1.059, .977, v));
    const roll = .0019 * Math.sin(Math.PI * v) - .0015 * sstep(.76, 1, v);
    const length = Math.hypot(p[0], p[2]) || 1;
    return [p[0] + p[0] / length * roll, p[1], p[2] + p[2] / length * roll];
  }, { wrapU: true, shade: (u, v) => 1 - .19 * sstep(.76, 1, v) });
}

/* The hood joins at the neckline and folds back under its own weight. */
export function hood(fn) {
  const shell = (u, v) => {
    const theta = Math.PI + (u * 2 - 1) * .947 * Math.PI;
    const neck = fn((theta / TAU + .25) % 1, 1);
    const arch = Math.sin(Math.PI * u), side = Math.cos(Math.PI * u);
    const load = arch ** 1.45;
    const edge = [
      side * (.021 + .169 * arch),
      .202 - .086 * load + .006 * side,
      .091 - .192 * arch,
    ];
    const upper = [
      neck[0] + side * .062 * arch,
      neck[1] + .020 * arch - .014,
      neck[2] - .122 * arch + .004,
    ];
    const fold = [
      side * (.033 + .207 * arch),
      .215 - .279 * load - .009 * side,
      .094 - .246 * arch,
    ];
    const weight = 1 - v;
    const point = neck.map((value, axis) => value * weight ** 3 + 3 * upper[axis] * weight ** 2 * v
      + 3 * fold[axis] * weight * v ** 2 + edge[axis] * v ** 3);
    const gathers = (.008 * crease(u - .34 + .09 * v, .074) - .006 * crease(u - .53 - .12 * v, .061))
      * arch * Math.sin(Math.PI * v);
    const rim = .0024 * crease(v - .968, .038);
    point[0] += side * rim * .45;
    point[1] += rim * .62 + gathers * .37;
    point[2] -= (gathers + arch * rim) * .80;
    return point;
  };
  const lining = (u, v) => {
    const [x, y, z] = shell(u, v);
    const thickness = .0023 + .0011 * Math.sin(Math.PI * v);
    return [x * (1 - .018 * Math.sin(Math.PI * v)), y - thickness * .54, z + thickness];
  };
  const join = (u, v, depth) => {
    const outside = shell(u, v);
    const inside = lining(u, v);
    return outside.map((value, i) => lerp(value, inside[i], depth));
  };
  return {
    outer: surface(112, 55, shell, { shade: (u, v) => 1 - .20 * (1 - sstep(.02, .27, v)) }),
    inner: surface(112, 55, lining, { shade: (u, v) => lerp(.29, .76, sstep(.25, .97, v)) }),
    crownThread: [.481, .519].map(u => trace(48, t => {
      const p = shell(u, .13 + t * .82), inside = lining(u, .13 + t * .82);
      return p.map((value, axis) => value + (value - inside[axis]) * .18);
    })),
    insideSeam: surface(8, 62, (u, v) => {
      const s = .484 + u * .032, t = .12 + v * .837;
      const base = lining(s, t);
      const outer = shell(s, t);
      const rise = .13 + .22 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      return base.map((value, axis) => value + (value - outer[axis]) * rise);
    }, { shade: (u, v) => lerp(.23, .63, sstep(.11, .96, v)) }),
    edges: [
      surface(112, 5, (u, depth) => join(u, 1, depth)),
      surface(60, 4, (v, depth) => join(0, v, depth)),
      surface(60, 4, (v, depth) => join(1, v, depth)),
    ],
    eyelet: side => shell(side < 0 ? .982 : .018, .90),
  };
}

/* A fuller, knee-length athletic short with the catalog's flared leg. */
export function short() {
  const hip = (th, v) => {
    const sx = Math.sin(th), sz = Math.cos(th);
    const gather = Math.sin(th * 28) * .0018 * Math.pow(1 - v, 3);
    const fold = Math.sin(th * 9 + v * 4) * .0026 * Math.sin(Math.PI * v);
    const depth = sz >= 0 ? lerp(.105, .121, v) : lerp(.111, .119, v);
    return [(lerp(.166, .204, v) + gather + fold) * sx, -.127 * v + .007 * v * sz, (depth + gather + fold) * sz];
  };
  const top = surface(140, 34, (u, v) => hip((u - .25) * TAU, v), {
    wrapU: true, uvFn: (u, v) => [u, 1 - .31 * v],
  });
  const leg = side => {
    const run = (u, v, inside = 0) => {
      const a = u * TAU, sine = Math.sin(a), cosine = Math.cos(a);
      const inner = Math.max(0, -sine);
      const outerJoin = hip(side * a, 1);
      const join = inner > 0 ? [0, outerJoin[1] - inner * .077, outerJoin[2]] : outerJoin;
      const drape = (Math.sin(a * 5 + side * 1.2 + .8 * v) * .0035 + vnoise(a * 2.3, v * 4) * .002) * v;
      const edge = [
        side * (.126 + sine * (.104 + drape - inside)),
        -.383 + .0053 * Math.sin(a * 2 + side) + sine * -.008,
        cosine * (.089 + drape - inside) + .025 - .006 * side,
      ];
      const fall = v * (.64 + .36 * v);
      const pull = v - .33 - .16 * sine - .058 * side;
      const folds = Math.sin(Math.PI * v) * (
        .0091 * crease(pull, .071) - .0066 * crease(pull - .081, .079)
        + .005 * crease(pull - .214, .083)
      ) * (.42 + .58 * Math.max(0, cosine));
      return [
        lerp(join[0], edge[0], fall) + side * sine * folds * .41,
        lerp(join[1], edge[1], v),
        lerp(join[2], edge[2], fall) + folds * cosine,
      ];
    };
    const uv = (u, v) => [.25 + side * u, .69 * (1 - v)];
    const seam = [.932, .958].map(v => trace(68, u => {
      const base = run(u, v), angle = u * TAU;
      return [base[0] + side * Math.sin(angle) * .00064, base[1], base[2] + Math.cos(angle) * .00064];
    }));
    const shells = [
      surface(96, 50, run, {wrapU: true, uvFn: uv, shade: (u, v) => 1 - .18 * Math.max(0, -Math.sin(TAU * u)) * (1 - sstep(.1, .68, v))}),
      surface(96, 6, (u, v) => { const p = run(u, 1, .0035 * v); p[1] += .010 * v; return p; }, {wrapU: true, uvFn: (u, v) => uv(u, 1 - v * .02)}),
    ];
    return {shells, seam};
  };
  const band = surface(136, 16, (u, v) => {
    const th = (u - .25) * TAU;
    const gather = (.6 + .4 * Math.sin(v * Math.PI)) * (.0013 * Math.sin(th * 35) + .0007 * Math.cos(th * 49));
    const roll = .0011 * Math.sin(v * Math.PI) + .00065 * Math.cos(v * TAU * 2);
    const depth = Math.cos(th) >= 0 ? .105 : .111;
    const shoulder = hip(th, .025);
    const top = .0008 + .032 * v;
    const foldedEdge = sstep(.79, 1, v);
    const inset = 1 + .018 - .048 * foldedEdge;
    return [
      (shoulder[0] + (roll + gather) * Math.sin(th)) * inset,
      top - .004 * foldedEdge * foldedEdge,
      (depth + roll + gather) * Math.cos(th) * inset,
    ];
  }, {wrapU: true});
  const cords = [-1, 1].flatMap(side => [
    [[0,.017,.108],[side * .020,.028,.111],[side * .032,.017,.116],[side * .018,.008,.116],[0,.017,.108]],
    [[0,.016,.111],[side * .009,-.010,.119],[side * .012,-.046,.127],[side * .015,-.071 - .005 * side,.130]],
  ]);
  return { top, left: leg(-1), right: leg(1), band, cords };
}

export function flagGeo(w = 1.2, h = .8) {
  const geo = new THREE.PlaneGeometry(w, h, 78, 40);
  geo.translate(w / 2, 0, 0);
  geo.userData.width = w;
  const uv = geo.attributes.uv, shade = [];
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const folded = Math.min(v, 1 - v);
    const value = 1 - .16 * crease(u, .015) - .065 * crease(folded, .012);
    shade.push(value, value, value);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  waveFlag(geo, 0);
  return geo;
}
export function waveFlag(geo, t) {
  const positions = geo.attributes.position;
  const b = geo.userData.base || (geo.userData.base = positions.array.slice());
  const w = geo.userData.width;
  for (let i = 0; i < positions.count; i++) {
    const x = b[i * 3], y = b[i * 3 + 1], k = clamp(x / w, 0, 1);
    const free = sstep(0, .25, k);
    const fold = Math.sin(k * 8.1 - t * 1.28 + y * 3.1);
    const billow = .083 * fold + .019 * Math.sin(k * 17.3 - t * 1.73 + y * 6.7);
    const sag = .098 * Math.sin(Math.PI * k) * (.85 + .15 * Math.cos(y * 3));
    const tail = Math.sin(k * 8.2 - t * 1.18 + y * 1.4);
    positions.setXYZ(i, x - w * .026 * k * k, y - w * sag + w * free * .025 * tail, w * free * billow);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
}

/* Low-profile six-panel trucker cap with a curved sandwich visor and rear closure. */
export const CAP_SEAMS = Array.from({ length: 6 }, (_, i) => .75 - 1 / 12 + i / 6);
export function cap() {
  // The CC0 Grab3D cap provides a dimensional check for the crown and visor.
  // https://grab3d.com/models/props/baseball-cap/
  const RX = .100, RZ = .113, RY = .119;
  const crownAt = (u, v) => {
    const a = u * TAU, b = v * Math.PI / 2;
    const z = Math.sin(a);
    const front = Math.max(0, z);
    const rear = Math.max(0, -z);
    const taper = Math.pow(Math.max(0, Math.cos(b)), .83 - .30 * front);
    const panel = Math.pow(.5 + .5 * Math.cos((u - .25) * 6 * TAU), 2.5) * .0027 * Math.sin(Math.PI * v);
    const pinch = Math.sin(a * 11 + 2 * v) * .0012 * Math.exp(-Math.pow((v - .2) / .18, 2));
    const shape = taper * (1 + .14 * front * Math.sin(v * Math.PI) - .05 * rear * Math.sin(v * Math.PI));
    const baseY = -.006 + .016 * Math.pow(Math.cos(a), 2) + .006 * z;
    return [(RX * shape - panel + pinch) * Math.cos(a),
      baseY * (1 - v) + RY * Math.sin(b) * (1 + .23 * front * (1 - v) - .12 * rear * (1 - v)),
      (RZ * shape - panel + pinch) * z - .024 * Math.pow(v, 1.25)];
  };
  const cut = u => Math.sqrt(Math.max(0, 1 - Math.pow((u - .75) / .088, 2))) * .245;
  const crownSurface = (u, v, inner = false) => {
    const point = crownAt(u, lerp(cut(u), 1, v));
    if (inner) { point[0] *= .978; point[2] *= .977; point[1] -= .002; }
    return point;
  };
  const crown = surface(156, 58, crownSurface, {
    wrapU: true, uvFn: (u, v) => [1 - u, lerp(cut(u), 1, v)],
    shade: (u, v) => 1 - .15 * (1 - sstep(.02, .21, v)),
  });
  const inner = surface(130, 14, (u, v) => crownSurface(u, v * .28, true), {wrapU: true});
  const band = surface(156, 8, (u, v) => {
    const outer = crownSurface(u, .065 * v);
    outer[0] *= 1.009 + .009 * Math.sin(v * Math.PI);
    outer[2] *= 1.009 + .009 * Math.sin(v * Math.PI);
    return outer;
  }, {wrapU: true});
  const visorFn = (u, v, layer = 0) => {
    const a = lerp(.25, Math.PI - .25, u);
    const base = crownAt(a / TAU, 0.025);
    const curve = Math.pow(Math.sin(u * Math.PI), .61);
    const cosine = Math.cos(a);
    return [
      base[0] * (1 - .095 * curve * v * Math.abs(cosine)),
      base[1] - (.011 + .075 * cosine * cosine) * v * curve - layer,
      base[2] + .095 * curve * v * (1 - .23 * cosine * cosine),
    ];
  };
  const visorTop = surface(98, 26, visorFn);
  const visorBottom = surface(98, 16, (u, v) => visorFn(u, v, .0042), {
    shade: (u, v) => lerp(.47, .80, sstep(.03, .95, v)),
  });
  const visorEdge = surface(98, 6, (u, v) => {
    const point = visorFn(u, 1, .0042 * v);
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
  const seams = CAP_SEAMS.map(seam => trace(32, t => {
    const point = crownAt((2 - seam) % 1, .09 + .85 * t);
    return liftFromAxis(point, .00068);
  }));
  const brimThread = [.58, .69, .80, .91].map(v => trace(40, t => {
    const point = visorFn(.08 + t * .84, v);
    point[1] += .00066;
    return point;
  }));
  const vents = [.34, .53, .70, .92].map(u => {
    const p = crownAt(u, .53);
    const ring = new THREE.TorusGeometry(.00185, .00047, 6, 14);
    const axis = new THREE.Vector3(p[0], p[1] * .54, p[2]).normalize();
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis));
    ring.translate(...p.map((coordinate, index) => coordinate + axis.getComponent(index) * .00070));
    return ring;
  });
  return { crown, inner, visorTop, visorBottom, visorEdge, button, band, snaps, closure, seams, brimThread, vents };
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
  const seams = [-1, 1].map(side => trace(76, t => {
    const [x, y, z] = track(.035 + t * .95);
    return [x + side * .0083, y, z + .0045];
  }));
  return {tape, teeth, top: track(.995), bottom: track(.012), seams};
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
export function pocket(fn, side) {
  const uv = pocketUV(side);
  const panel = (s, t, offset = 0) => {
    const [u, v] = uv(s, t);
    const raised = .0009 + .0034 * Math.pow(1 - s, 4) * Math.sin(Math.PI * t)
      + .0028 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t)
      + .0015 * crease(s - .044, .032);
    return liftFromAxis(fn(u, v), raised + offset);
  };
  const shell = surface(54, 36, panel, {
    uvFn: (s, t) => fn.uv(...uv(s, t)),
    shade: (s, t) => 1 - .13 * crease(s - .021, .048) * Math.sin(Math.PI * t),
  });
  const edge = surface(60, 6, (t, v) => {
    const outside = panel(0, t), inside = fn(...uv(0, t));
    return outside.map((value, i) => lerp(value, inside[i], v));
  }, { uvFn: t => fn.uv(...uv(0, t)), shade: (t, v) => lerp(.92, .44, v) });
  const stitches = [
    trace(45, t => panel(.064, .045 + .90 * t, .00070)),
    trace(32, s => panel(s, .93, .00066)),
    trace(32, s => panel(s, .068, .00066)),
  ];
  return { shell, edge, stitches };
}
export { vnoise, TAU, lerp, clamp };
