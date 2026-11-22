// Impronta 3D configurator: scene, products, interaction, renders.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import * as G from './garments.js';
import * as T from './textures.js';

const TEX = { torso: [2048, 1024], sleeve: [1024, 512], hood: [1024, 512], short: [1024, 512], flag: [2048, 1365], cap: [1024, 512] };
const isMobile = matchMedia('(max-width: 760px)').matches || /iPhone|Android/i.test(navigator.userAgent);
// iOS/iPadOS: tighter GPU + canvas memory budget (Safari kills the tab when it is exceeded)
const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Software GL (SwiftShader / llvmpipe) or very weak GPUs get a lighter pipeline.
const lowPower = (() => {
  try {
    if (/[?&]lowgl=1/.test(location.search)) return true;
    if (/[?&]hq=1/.test(location.search)) return false;
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info'); const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context'); lose && lose.loseContext();
    if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(r)) return true;
    // Apple GPUs are always capable; Safari/Brave on iOS report (or randomise) a low hardwareConcurrency, so never trust it there
    if (isIOS || /apple/i.test(r)) return false;
    return (navigator.hardwareConcurrency || 8) <= 2;
  } catch (e) { return false; }
})();
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

export function createConfigurator(canvasHost, state, { onReady, onError, onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  const dprCap = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 1.5), dprMin = lowPower ? 0.6 : isMobile ? 1 : 0.75; // phones: crisp 2x live view
  let dpr = lowPower ? Math.min(0.75, dprCap) : dprCap;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environmentIntensity = 0.8;
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  const key = new THREE.DirectionalLight(0xfff3e6, 1.75); key.position.set(0.8, 3.8, 1.6); key.castShadow = true;
  const LIVE_SM = lowPower ? 512 : 1024; key.shadow.mapSize.set(LIVE_SM, LIVE_SM);
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 8 }); key.shadow.radius = 4; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.01;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe6edff, 1.1); rim.position.set(-2.2, 1.8, -2.4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.32); fill.position.set(-2, 0.5, 1.5); scene.add(fill);

  const spin = new THREE.Group(); scene.add(spin);
  const anim = new THREE.Group(); spin.add(anim);
  const product = new THREE.Group(); anim.add(product);
  const stand = new THREE.Group(); anim.add(stand);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.55, metalness: 0.1 });
  const chromeM = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.25, metalness: 1 });
  const ttM = new THREE.MeshStandardMaterial({ color: 0xe4e1dc, roughness: 0.6 });
  const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.018, 128), ttM); tt.receiveShadow = true; spin.add(tt);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.0025, 8, 160), new THREE.MeshStandardMaterial({ color: 0xc9c5bf, roughness: 0.4 })); ring.rotation.x = Math.PI / 2; spin.add(ring);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.12 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.visible = false; scene.add(floor); // no floor shadow: clean product-photo look

  const knit = T.knitNormal(256, 'jersey'); knit.repeat.set(36, 18);
  const rib = T.knitNormal(128, 'rib'); rib.repeat.set(24, 2);
  const canvases = {}; const texes = {}; 
  const mk = name => { const c = document.createElement('canvas'); [c.width, c.height] = TEX[name].map(v => lowPower && isMobile ? Math.round(v * 0.75) : v); return c; }; // 2048 print textures on phones too
  // two canvases + textures per surface: the visible one (front) and the one being prepared (back)
  const buf = {};
  const mkTex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = lowPower ? 2 : 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  function ensure(name) { if (!buf[name]) { const c = [mk(name), mk(name)]; buf[name] = { c, t: c.map(mkTex), i: 0 }; texes[name] = buf[name].t[0]; canvases[name] = c[0]; } return buf[name]; }
  function canvasFor(name) { const b = ensure(name); return b.c[b.i]; }
  const backFor = name => { const b = ensure(name); return b.c[1 - b.i]; };
  const NEEDS = { remera: ['torso', 'sleeve'], campera: ['torso', 'sleeve', 'hood'], conjunto: ['torso', 'sleeve', 'short'], musculosa: ['torso'], bandera: ['flag'], gorra: ['cap'] };
  const FAB = { deportiva: { roughness: 0.84, sheen: 0.3, sheenRoughness: 0.7, normalScale: 0.32, spec: 0.18 }, modal: { roughness: 0.88, sheen: 0.45, sheenRoughness: 0.75, normalScale: 0.24, spec: 0.14 }, frizado: { roughness: 0.94, sheen: 0.6, sheenRoughness: 0.9, normalScale: 0.4, spec: 0.1 } };
  function fabricMat(map, { ribbed = false, side = THREE.DoubleSide } = {}) {
    const f = FAB[state.tela] || FAB.deportiva;
    const m = lowPower
      ? new THREE.MeshStandardMaterial({ map, side, roughness: f.roughness, normalMap: ribbed ? rib : knit, normalScale: new THREE.Vector2(f.normalScale, f.normalScale) })
      : new THREE.MeshPhysicalMaterial({ map, side, roughness: f.roughness, sheen: f.sheen, sheenRoughness: f.sheenRoughness, sheenColor: new THREE.Color(0xdedede), specularIntensity: f.spec, normalMap: ribbed ? rib : knit, normalScale: new THREE.Vector2(f.normalScale, f.normalScale) });
    if (map) {
      const u = { map2: { value: map }, uMix: { value: 1 }, uWipe: { value: 0 } }; m.userData.blend = u;
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.fragmentShader = 'uniform sampler2D map2;\nuniform float uMix;\nuniform float uWipe;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 tA = texture2D( map, vMapUv ); vec4 tB = texture2D( map2, vMapUv );
  float fb = uWipe > 0.5 ? smoothstep( vMapUv.y - 0.12, vMapUv.y + 0.12, uMix * 1.24 - 0.12 ) : uMix;
  diffuseColor *= mix( tA, tB, fb );
#endif`);
      };
      m.customProgramCacheKey = () => 'imp-blend';
    }
    return m;
  }
  function colorMat(hex, opts) { const m = fabricMat(null, { ribbed: true, ...opts }); m.color.set(hex); return m; }
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

  let parts = {}, flag = null, bbox = new THREE.Box3(), pbox = new THREE.Box3(), fitMode = null, hostH = 1;
  const vOf = y => { const { yHem, yS } = G.TORSO; return G.clamp(0.8 * (y - yHem) / (yS - yHem), 0, 1); };

  function clearGroup(gr) { while (gr.children.length) { const c = gr.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose();  }); } }
  const topOpts = kind => { const musc = kind === 'musculosa'; return { neckK: musc ? 0.42 : kind === 'campera' ? 0.37 : 0.34, neckDrop: musc ? 0.07 : 0.04, neckKB: musc ? 0.66 : 0.6, width: kind === 'campera' ? [[-0.34, 0.222], [-0.2, 0.22], [0.0, 0.224], [0.1, 0.228], [0.2, 0.228]] : undefined, depth: kind === 'campera' ? 0.012 : 0 }; };
  let pocketUV = null; const getPocketUV = () => pocketUV || (pocketUV = G.pocketOutline(G.torsoFn(topOpts('campera'))));
  const tag = (o, zone) => { o.userData.zone = zone; return o; };
  function buildTop(kind, yOff = 0) {
    const grp = new THREE.Group(); grp.position.y = yOff;
    const musc = kind === 'musculosa';
    const skip = musc ? (u, v, f) => G.inArmhole(f(u, v)) : null;
    const tor = G.torso({ ...topOpts(kind), skip, nu: lowPower ? 160 : 240, nv: lowPower ? 110 : 156 });
    const tm = fabricMat(texes.torso); grp.add(mesh(tor.geo, tm)); parts.torso = tm;
    const pun = colorMat(state.colors.punos); parts.punos = pun;
    if (kind !== 'campera') grp.add(mesh(G.collar(tor.fn), pun));
    if (musc) {
      for (const sgn of [1, -1]) {
        const pts = G.armholeLoop(tor.fn, sgn).map(p => { const l = Math.hypot(p.x, p.z) || 1; return new THREE.Vector3(p.x + p.x / l * 0.002, p.y, p.z + p.z / l * 0.002); });
        grp.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 220, 0.0065, 10, true), pun));
      }
    } else {
      const long = kind === 'campera'; const sm = fabricMat(texes.sleeve); parts.sleeve = sm;
      for (const sgn of [1, -1]) {
        const s = G.sleeve(sgn, { long }); grp.add(mesh(s.geo, sm));
        grp.add(mesh(G.cuff(s.end, s.dir, s.r1 * 1.0, long ? 0.06 : 0.017, long ? 0.86 : 0.995, s.ellip), pun));
      }
    }
    if (kind === 'campera') {
      const h = G.hood(tor.fn); const hm = fabricMat(texes.hood, { side: THREE.DoubleSide }); parts.hood = hm;
      const lining = new THREE.MeshStandardMaterial({ color: new THREE.Color(state.colors.capucha).lerp(new THREE.Color('#ffffff'), 0.08), roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1 });
      parts.lining = lining;
      grp.add(mesh(h.outer, hm)); grp.add(mesh(h.inner, lining));
      // hem rib
      const hem = G.surface(160, 4, (u, v) => { const p = tor.fn(u, 0); return [p[0] * (0.985), p[1] - 0.05 + v * 0.052, p[2] * 0.985]; }, { wrapU: true });
      grp.add(mesh(hem, pun));
      const zm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.55, roughness: 0.38 });
      const zp = G.zipperParts(tor.fn); const tapeM = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9, normalMap: rib, normalScale: new THREE.Vector2(0.3, 0.3), side: THREE.DoubleSide });
      grp.add(mesh(zp.tape, tapeM)); grp.add(mesh(zp.teeth, zm));
      // kangaroo pocket: real second fabric layer sharing the body print
      for (const sd of [-1, 1]) grp.add(mesh(G.pocket(tor.fn, sd), tm));
      // hood eyelets (metal grommets where the drawcords exit)
      for (const sgn of [1, -1]) { const ey = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0018, 8, 20), chromeM); ey.position.set(0.035 * sgn, 0.213, 0.112); ey.rotation.x = -0.35; grp.add(ey); }
      const pull = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.004), chromeM); const pz = tor.fn(0.25, 0.97); pull.position.set(pz[0], pz[1] - 0.02, pz[2] + 0.008); grp.add(pull);
      // drawcords
      const cordM = new THREE.MeshStandardMaterial({ color: new THREE.Color(state.colors.punos), roughness: 0.8 }); parts.cord = cordM;
      for (const sgn of [1, -1]) {
        const a = new THREE.Vector3(0.035 * sgn, 0.215, 0.11), b = new THREE.Vector3(0.042 * sgn, 0.1, 0.135), c = new THREE.Vector3(0.05 * sgn, 0.02, 0.145);
        grp.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, b, c]), 24, 0.0035, 6), cordM));
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.022, 10), chromeM); tip.position.copy(c).add(new THREE.Vector3(0, -0.01, 0)); grp.add(tip);
      }
    }
    return grp;
  }
  function buildShort(yOff) {
    const s = G.short(0); const grp = new THREE.Group(); grp.position.y = yOff;
    const m = fabricMat(texes.short); parts.short = m; const pun = parts.punos || colorMat(state.colors.punos); parts.punos = pun;
    grp.add(mesh(s.top, m), mesh(s.legL, m), mesh(s.legR, m), mesh(s.band, pun)); return grp;
  }
  // dress form: linen-covered body and neck, turned-wood cap, chrome pole, weighted round base, soft contact shadow
  const linenM = new THREE.MeshStandardMaterial({ color: 0xb3a691, roughness: 0.95, normalMap: knit, normalScale: new THREE.Vector2(0.35, 0.35) });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6a4527, roughness: 0.45, metalness: 0 });
  const baseM = new THREE.MeshStandardMaterial({ color: 0x1e1d1b, roughness: 0.4, metalness: 0.2 });
  const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.45, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); return t; })();
  const blobM = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false });
  function blob(x, y, r, o = 1) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), blobM); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.0015, 0); m.renderOrder = 1; m.material.opacity = o; stand.add(m); }
  const lathe = (pts, mat, y = 0, sx = 1, sz = 1, seg = 64) => { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); const m = new THREE.Mesh(g, mat); m.scale.set(sx, 1, sz); m.position.y = y; m.castShadow = true; m.receiveShadow = true; stand.add(m); return m; };
  function buildStand(top, bottom, { neck = true, head = false, form = null } = {}) {
    clearGroup(stand);
    if (neck) {
      // linen neck column rising from inside the collar, finished with a wooden cap and finial
      lathe([[0.046, -0.06], [0.045, 0.0], [0.0425, 0.06], [0.042, 0.088]], linenM, top, 1, 0.92);
      lathe([[0.03, 0], [0.047, 0], [0.048, 0.004], [0.047, 0.011], [0.042, 0.015], [0.016, 0.017], [0, 0.0172]], woodM, top + 0.088, 1, 0.92);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.011, 24, 16), woodM); f.position.set(0, top + 0.112, 0); f.scale.y = 0.85; stand.add(f);
      const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.01, 16), woodM); st2.position.set(0, top + 0.103, 0); stand.add(st2);
    }
    let y1 = -0.3;
    if (form) {
      // bottom of the form shows just below the hem (or between shirt and shorts)
      const { y0, y2, a = 0.188, b = 0.104 } = form;
      lathe([[0, y2], [0.9, y2], [0.95, y2 + 0.006], [0.985, (y0 + y2) / 2], [1, y0]].map(p => [p[0] * a, p[1]]), linenM, 0, 1, b / a);
      { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.84 * a, 0.84 * a, 0.007, 64), woodM); pl.scale.z = b / a; pl.position.y = y2 - 0.0035; stand.add(pl); }
      y1 = y2 - 0.006;
    }
    if (head) { const hm = linenM; const h = new THREE.Mesh(new THREE.SphereGeometry(0.095, 64, 48), hm); h.scale.set(0.9, 1.16, 1.0); h.position.y = top - 0.03; h.castShadow = true; stand.add(h); const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.09, 48), hm); nk.position.set(0, top - 0.15, -0.01); nk.castShadow = true; stand.add(nk); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 48), woodM); base.position.set(0, top - 0.197, -0.01); stand.add(base); y1 = top - 0.2; }
    const poleH = y1 - bottom; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, poleH, 24), chromeM); p.position.y = bottom + poleH / 2; p.castShadow = true; stand.add(p);
    const collarP = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 24), chromeM); collarP.position.y = bottom + 0.05; stand.add(collarP);
    lathe([[0, 0], [0.135, 0], [0.138, 0.004], [0.136, 0.012], [0.128, 0.018], [0.03, 0.026], [0, 0.026]], baseM, bottom);
    tt.position.y = bottom - 0.009; ring.position.y = bottom; floor.position.y = bottom - 0.019;
  }
  function build() {
    clearGroup(product); parts = {}; flag = null; tt.visible = ring.visible = false; tt.scale.set(1, 1, 1); ring.scale.set(1, 1, 1);
    const P = state.producto; product.rotation.set(0, 0, 0); product.position.set(0, 0, 0);
    ['torso', 'sleeve', 'hood', 'short', 'flag', 'cap'].forEach(ensure);
    paint(false, null);
    if (P === 'remera' || P === 'musculosa' || P === 'campera') {
      product.add(buildTop(P)); buildStand(0.215, -0.66, { neck: P !== 'campera', form: P === 'campera' ? { y0: -0.36, y2: -0.43, a: 0.19, b: 0.108 } : { y0: -0.31, y2: -0.385 } });
          } else if (P === 'conjunto') {
      product.add(buildTop('remera', 0.18)); product.add(buildShort(-0.24));
      buildStand(0.395, -0.86, { neck: true, form: { y0: -0.13, y2: -0.235, a: 0.186, b: 0.11 } });
    } else if (P === 'bandera') {
      const geo = G.flagGeo(1.2, 0.8); const m = fabricMat(texes.flag); m.normalScale.set(0.06, 0.06); parts.flag = m;
      const f = mesh(geo, m); f.position.set(-0.6, 0.18, 0); product.add(f); flag = geo; tt.visible = ring.visible = false;
      clearGroup(stand);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.5, 24), chromeM); pole.position.set(-0.605, -0.12, 0); pole.castShadow = true; stand.add(pole);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), chromeM); knob.position.set(-0.605, 0.64, 0); stand.add(knob);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.022, 64), darkM); b.position.set(-0.605, -0.86, 0); stand.add(b);
      tt.position.y = -0.879; ring.position.y = -0.87; floor.position.y = -0.889; tt.position.x = ring.position.x = 0;
    } else if (P === 'gorra') {
      const c = G.cap(); const grp = new THREE.Group(); grp.position.set(0, -0.018, 0.003); grp.rotation.x = 0.12;
      const m = fabricMat(texes.cap); parts.cap = m; const vm = colorMat(state.colors.mangas); vm.normalMap = knit; vm.side = THREE.DoubleSide; parts.visor = vm; const pun = colorMat(state.colors.punos); parts.punos = pun;
      grp.add(mesh(c.crown, m), mesh(c.visor, vm), mesh(c.btn, pun), mesh(c.band, pun)); product.add(grp);
      buildStand(0.0, -0.36, { neck: false, head: true }); tt.scale.set(0.6, 1, 0.6); ring.scale.set(0.6, 0.6, 1);
    }
    spin.updateMatrixWorld(true);
    const r0 = spin.rotation.y; spin.rotation.y = 0; anim.scale.setScalar(1); anim.position.y = 0; spin.updateMatrixWorld(true);
    bbox.setFromObject(anim); pbox.setFromObject(product); if (pbox.isEmpty()) pbox.copy(bbox); { const tb = new THREE.Box3(); stand.children.forEach(m => { tb.setFromObject(m); m.userData.below = tb.max.y < pbox.min.y + 0.005; }); } cropStand(); if (tt.visible) bbox.expandByObject(tt); spin.rotation.y = r0; frame(); matTargets().forEach(([c, t]) => c.copy(t)); shadowDirty = true; dirty = true;
  }
  const ease = t => 1 - Math.pow(1 - t, 3), easeBack = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  let animTok = 0, rebuilding = false, dirty = true, tweening = 0;
  function tween(ms, fn) { tweening++; return new Promise(res => { const t0 = performance.now(); const step = () => { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); dirty = true; if (t < 1) requestAnimationFrame(step); else { tweening--; res(); } }; requestAnimationFrame(step); }); }
  async function rebuild(animated) {
    const tok = ++animTok; clearTimeout(paintTimer); paintQ = null; finishTrans(); wake();
    if (!inited) return;
    if (!animated) { rebuilding = false; build(); anim.scale.setScalar(1); anim.position.y = 0; dirty = true; return; }
    rebuilding = true; view.targetYaw += 0.9;
    await tween(lowPower ? 140 : 200, t => { if (tok !== animTok) return; const e = ease(t); anim.scale.setScalar(1 - 0.08 * e); anim.position.y = -0.05 * e; });
    if (tok !== animTok) return;
    build(); rebuilding = false; anim.scale.setScalar(0.92); anim.position.y = -0.05;
    await tween(lowPower ? 420 : 640, t => { if (tok !== animTok) return; const e = easeBack(t); anim.scale.setScalar(0.92 + 0.08 * e); anim.position.y = -0.05 * (1 - ease(t)); });
  }
  function drawInto(get) {
    const st = state, P = st.producto, need = NEEDS[P] || [];
    if (need.includes('torso')) T.torsoCanvas(get('torso'), st, { vOf, product: P, pocket: P === 'campera' ? getPocketUV() : null });
    if (need.includes('sleeve')) T.sleeveCanvas(get('sleeve'), st, { stripe: P !== 'campera' });
    if (need.includes('hood')) T.plainCanvas(get('hood'), st, 'capucha', { pattern: st.printAll, seed: 13 });
    if (need.includes('short')) T.shortCanvas(get('short'), st);
    if (need.includes('flag')) T.flagCanvas(get('flag'), st);
    if (need.includes('cap')) T.capCanvas(get('cap'), st);
    return need;
  }
  function matTargets() {
    const st = state, f = FAB[st.tela] || FAB.deportiva;
    const list = [];
    if (parts.punos) list.push([parts.punos.color, new THREE.Color(st.colors.punos)]);
    if (parts.cord) list.push([parts.cord.color, new THREE.Color(st.colors.punos)]);
    if (parts.visor) list.push([parts.visor.color, new THREE.Color(st.colors.mangas)]);
    if (parts.lining) list.push([parts.lining.color, new THREE.Color(st.colors.capucha).lerp(new THREE.Color('#ffffff'), 0.08)]);
    Object.values(parts).forEach(m => { if (m.isMeshStandardMaterial && m.normalScale && m !== parts.lining) { m.roughness = f.roughness; if (m.isMeshPhysicalMaterial) { m.sheen = f.sheen; m.specularIntensity = f.spec; } m.sheenRoughness = f.sheenRoughness; if (m !== parts.flag) m.normalScale.set(f.normalScale, f.normalScale); } });
    return list;
  }
  // One transition at a time: a new change first completes the running one instantly, then starts from that exact state.
  let trans = null, paintQ = null, paintTimer = 0;
  function finishTrans() {
    if (!trans) return;
    trans.mats.forEach(([m, tex]) => { m.map = tex; m.userData.blend.map2.value = tex; m.userData.blend.uMix.value = 1; m.userData.blend.uWipe.value = 0; });
    trans.cols.forEach(([c, , b]) => c.copy(b)); trans = null; dirty = true; shadowDirty = true;
  }
  function paint(update = true, mode = 'fade') {
    if (!update || !mode) {
      finishTrans(); const need = drawInto(canvasFor);
      need.forEach(n => { texes[n] = buf[n].t[buf[n].i]; texes[n].needsUpdate = true; const m = parts[n]; if (m) { m.map = texes[n]; if (m.userData.blend) m.userData.blend.map2.value = texes[n]; } });
      if (update) matTargets().forEach(([c, t]) => c.copy(t)); dirty = true; return;
    }
    // coalesce bursts of changes (typing, fast swatch clicks) into one texture regeneration
    paintQ = (paintQ === 'wipe' || mode === 'wipe') ? 'wipe' : 'fade'; wake();
    clearTimeout(paintTimer); paintTimer = setTimeout(flushPaint, lowPower ? 90 : 45);
  }
  function flushPaint() {
    const mode = paintQ; paintQ = null; if (!mode || !inited) return;
    if (rebuilding) return; // the pending build() paints the latest state
    finishTrans();
    const need = NEEDS[state.producto] || [];
    drawInto(backFor);
    const mats = [];
    need.forEach(n => {
      const b = buf[n]; b.i = 1 - b.i; canvases[n] = b.c[b.i]; texes[n] = b.t[b.i]; texes[n].needsUpdate = true;
      const m = parts[n]; if (!m) return;
      if (m.userData.blend) { const u = m.userData.blend; u.map2.value = texes[n]; u.uMix.value = 0; u.uWipe.value = mode === 'wipe' ? 1 : 0; mats.push([m, texes[n]]); }
      else m.map = texes[n];
    });
    const cols = matTargets().map(([c, t]) => [c, c.clone(), t]);
    trans = { t0: performance.now(), ms: mode === 'wipe' ? (lowPower ? 520 : 720) : (lowPower ? 260 : 360), mode, mats, cols };
    dirty = true;
  }
  function stepTrans(now) {
    if (!trans) return;
    const t = Math.min(1, (now - trans.t0) / trans.ms);
    const e = trans.mode === 'wipe' ? (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) : ease(t);
    trans.mats.forEach(([m]) => (m.userData.blend.uMix.value = e));
    trans.cols.forEach(([c, a, b]) => c.copy(a).lerp(b, e));
    if (t >= 1) finishTrans();
  }

  // ---------- camera / interaction ----------
  const view = { yaw: -0.5, pitch: 0.1, zoom: 1, targetYaw: -0.5, auto: true, lastInteract: 0, dist: 2.6, center: new THREE.Vector3(), cd: 0, cc: new THREE.Vector3(), snap: true };
  // phone framing: parts of the stand entirely below the garment (base plates) are hidden; the pole fades out at the bottom edge
  function cropStand() { stand.children.forEach(m => { m.visible = !(fitMode && m.userData.below); }); }
  function frame() {
    if (fitMode) {
      // phone mode: the garment alone fills ~fill of the free height between the UI insets; the stand below is simply cropped
      const s = new THREE.Vector3(); pbox.getSize(s); pbox.getCenter(view.center);
      const fov = THREE.MathUtils.degToRad(cam.fov), tan = Math.tan(fov / 2), free = Math.max(0.4, 1 - (fitMode.top + fitMode.bottom) / hostH);
      const fill = state.producto === 'gorra' ? 0.5 : state.producto === 'bandera' ? 0.8 : fitMode.fill; const dH = s.y / (fill * free) / 2 / tan, dW = Math.max(s.x, s.z) * 1.1 / 2 / tan / cam.aspect;
      view.dist = Math.max(dH, dW) + Math.max(s.z, 0.3) / 2;
      const visH = 2 * (view.dist) * tan; view.center.y -= (fitMode.bottom - fitMode.top) / 2 / hostH * visH;
      return;
    }
    const s = new THREE.Vector3(); bbox.getSize(s); bbox.getCenter(view.center);
    const aspect = cam.aspect; const fov = THREE.MathUtils.degToRad(cam.fov);
    const hNeed = s.y * 1.12, wNeed = Math.max(s.x, s.z) * 1.25;
    const dH = hNeed / 2 / Math.tan(fov / 2), dW = wNeed / 2 / Math.tan(fov / 2) / aspect;
    view.dist = Math.max(dH, dW) + Math.max(s.z, 0.3) / 2;
  }
  function placeCam(instant) {
    if (instant || view.snap) { view.cd = view.dist; view.cc.copy(view.center); view.snap = false; }
    else { view.cd += (view.dist - view.cd) * 0.08; view.cc.lerp(view.center, 0.08); }
    view.zc = (view.zc ?? view.zoom) + (view.zoom - (view.zc ?? view.zoom)) * 0.15;
    const d = view.cd / (instant ? view.zoom : view.zc); const c = view.cc.clone();
    cam.position.set(c.x, c.y + Math.sin(view.pitch) * d, c.z + Math.cos(view.pitch) * d); cam.lookAt(c);
  }
  function resize() {
    const r = canvasHost.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height); hostH = h;
    renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
    cam.aspect = w / h; cam.updateProjectionMatrix(); frame(); dirty = true;
    // a resized canvas is cleared by the browser: redraw right away so it never flashes empty
    if (inited && running) { placeCam(); renderer.render(scene, cam); }
  }
  new ResizeObserver(resize).observe(canvasHost);
  const ptrs = new Map(); let pinch0 = 0, zoom0 = 1, vel = 0;
  const el = renderer.domElement; el.style.touchAction = 'pan-y';
  el.addEventListener('webglcontextlost', e => { e.preventDefault(); running = false; console.warn('[impronta] WebGL context lost'); onLost && onLost(); }); el.style.cursor = 'grab';
  el.addEventListener('pointerenter', () => wake());
  // ---- zone picking: tap (movement < 6px) selects a zone; mouse hover highlights it ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let tap = null, zoneCb = null, zonesFn = () => ['cuerpo', 'mangas', 'capucha', 'punos'], hoverZ = null, hoverT = 0, flashZ = null, flashT0 = 0;
  const HL = new THREE.Color(0xd71920);
  function zoneMats(z) { const map = { cuerpo: ['torso', 'short', 'flag', 'cap'], mangas: ['sleeve', 'visor'], capucha: ['hood', 'lining'], punos: ['punos', 'cord'] }; return (map[z] || []).map(k => parts[k]).filter(Boolean); }
  function zoneOf(mat) { for (const z of ['cuerpo', 'mangas', 'capucha', 'punos']) if (zoneMats(z).includes(mat)) return z; return null; }
  function pick(cx, cy) {
    const r = el.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    spin.updateMatrixWorld(true); cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam);
    const ok = zonesFn(); for (const h of ray.intersectObject(product, true)) { const z = zoneOf(h.object.material); if (z && ok.includes(z)) return z; if (!z) continue; }
    return null;
  }
  function applyHL() {
    const t = performance.now(); let fl = 0; if (flashZ) { const k = (t - flashT0) / 900; fl = k < 1 ? Math.sin(Math.min(1, k) * Math.PI) * 0.32 : 0; if (k >= 1) flashZ = null; }
    ['cuerpo', 'mangas', 'capucha', 'punos'].forEach(z => { const a = (z === hoverZ ? 0.14 : 0) + (z === flashZ ? fl : 0); zoneMats(z).forEach(m => { if (m.emissive) m.emissive.copy(HL).multiplyScalar(a); }); });
    return !!flashZ;
  }
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || ptrs.size || lowPower && isMobile) return;
    const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
    const z = inited ? pick(e.clientX, e.clientY) : null; if (z !== hoverZ) { hoverZ = z; el.style.cursor = z ? 'pointer' : 'grab'; applyHL(); dirty = true; }
  });
  el.addEventListener('pointerleave', () => { if (hoverZ) { hoverZ = null; el.style.cursor = 'grab'; applyHL(); dirty = true; } });
  el.addEventListener('pointerdown', e => { tap = ptrs.size === 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: 0 } : null; }, true);
  el.addEventListener('pointermove', e => { if (tap && tap.id === e.pointerId) tap.moved = Math.max(tap.moved, Math.hypot(e.clientX - tap.x, e.clientY - tap.y)); if (tap && ptrs.size > 1) tap = null; }, true);
  el.addEventListener('pointerup', e => {
    const t = tap; tap = null; if (!t || t.id !== e.pointerId || t.moved >= 6 || performance.now() - t.t > 700 || !inited) return;
    const z = pick(e.clientX, e.clientY); if (z && zoneCb) { vel = 0; view.targetYaw = spin.rotation.y; zoneCb(z); }
  }, true);
  el.addEventListener('pointercancel', () => { tap = null; }, true);
  el.addEventListener('pointerdown', e => { wake(); try { el.setPointerCapture(e.pointerId); } catch (err) { } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.auto = false; view.lastInteract = performance.now(); el.style.cursor = 'grabbing'; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.zoom; } });
  el.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    view.lastInteract = performance.now();
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); setZoom(zoom0 * d / pinch0); return; }
    view.targetYaw += dx * 0.009; vel = dx * 0.009; view.pitch = G.clamp(view.pitch + dy * 0.003, -0.15, 0.5);
  });
  const up = e => { ptrs.delete(e.pointerId); el.style.cursor = hoverZ ? 'pointer' : 'grab'; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); setZoom(view.zoom * (e.deltaY > 0 ? 0.92 : 1.08)); view.lastInteract = performance.now(); }, { passive: false });
  function setZoom(z) { view.zoom = G.clamp(z, 0.8, 2.6); dirty = true; emit(); }
  let listeners = [];
  function emit() { listeners.forEach(f => f(view)); }

  const clock = new THREE.Clock(); let running = true, visible = true, inited = false, shadowDirty = true;
  const gl2 = renderer.capabilities.isWebGL2 ? renderer.getContext() : null; let fence = null, fenceT = 0, lastWhy = '';
  let lastRender = 0, frameN = 0, ema = 16, slowFor = 0, fastFor = 0, autoSince = performance.now();
  const IDLE_PARK = lowPower ? 12000 : 25000; // turntable parks after this long without interaction -> zero GPU work when idle
  function wake() { if (view.parked) { view.parked = false; view.auto = true; autoSince = performance.now(); emit(); } dirty = true; }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) dirty = true; }).observe(canvasHost);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) dirty = true; });
  function setDpr(v) { v = Math.round(G.clamp(v, dprMin, dprCap) * 100) / 100; if (v === dpr) return; dpr = v; renderer.setPixelRatio(dpr); resize(); }
  function tick(now) {
    requestAnimationFrame(tick);
    if (!inited || !visible || !running || document.hidden) { lastRender = 0; return; }
    if (lowPower && lastRender && now - lastRender < 31) return; // ~30 fps cap on software GL
    // GPU pacing: never queue a new frame before the GPU finished the previous one (prevents GPU-process
    // backlogs that freeze the whole tab / black compositor frames on software or weak GPUs)
    if (fence) { const st = gl2.getSyncParameter(fence, gl2.SYNC_STATUS); if (st !== gl2.SIGNALED) { if (now - fenceT < 1500) return; } gl2.deleteSync(fence); fence = null; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const idleFor = performance.now() - Math.max(view.lastInteract, autoSince);
    if (!view.auto && !view.parked && ptrs.size === 0) { view.targetYaw += vel; vel *= 0.92; if (Math.abs(vel) < 1e-5) vel = 0; if (performance.now() - view.lastInteract > 5000) { view.auto = true; autoSince = performance.now(); } }
    if ((view.auto || view.parked) && ptrs.size === 0) vel = 0; // inertia never outlives the auto-turntable / parking
    if (view.auto && idleFor > IDLE_PARK && !trans && !tweening) { view.auto = false; view.parked = true; emit(); }
    if (view.auto) view.targetYaw += dt * 0.35;
    const dy = view.targetYaw - spin.rotation.y; spin.rotation.y += Math.abs(dy) < 1e-4 ? dy : dy * 0.18;
    stepTrans(now);
    const flashing = flashZ ? applyHL() || true : false;
    const camMoving = Math.abs(view.dist - view.cd) > 1e-4 || view.cc.distanceToSquared(view.center) > 1e-8 || Math.abs(view.zoom - (view.zc ?? view.zoom)) > 1e-4;
    const moving = view.auto || Math.abs(dy) > 1e-4 || vel !== 0 || ptrs.size > 0 || camMoving || !!trans || tweening > 0 || !!flag || flashing;
    if (!moving && !dirty) { lastRender = 0; return; }
    lastWhy = [view.auto && 'auto', Math.abs(dy) > 1e-4 && 'yaw', vel && 'vel', ptrs.size && 'ptr', camMoving && 'cam', trans && 'trans', tweening && 'tween', flag && 'flag', dirty && 'dirty'].filter(Boolean).join(',');
    if (flag) G.waveFlag(flag, t);
    placeCam();
    frameN++;
    if (shadowDirty || frameN % (lowPower ? 6 : 2) === 0) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, cam);
    if (gl2) { fence = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0); fenceT = now; gl2.flush(); }
    dirty = false;
    // adaptive resolution from the interval between consecutive animated frames
    if (lastRender) {
      const iv = now - lastRender; ema = ema * 0.9 + iv * 0.1;
      const slow = lowPower ? 50 : 45, fast = lowPower ? 36 : 20; // only downgrade when it is really slow (<22 fps), not on paced/skipped frames
      if (ema > slow) { slowFor += iv; fastFor = 0; if (slowFor > 1200) { setDpr(dpr - 0.15); slowFor = 0; ema = (slow + fast) / 2; } }
      else if (ema < fast) { fastFor += iv; slowFor = 0; if (fastFor > 4000 && dpr < (lowPower ? Math.min(1, dprCap) : dprCap)) { setDpr(dpr + 0.1); fastFor = 0; } }
      else { slowFor = fastFor = 0; }
    }
    lastRender = now;
    if (frameN % 8 === 0) emit();
  }
  // staged init: yield between heavy steps so page scrolling / compositing never stalls
  const ready = (async () => {
    resize(); await nextFrame();
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); await nextFrame();
    inited = true; build(); view.snap = true; await nextFrame();
    try { if (renderer.compileAsync) await renderer.compileAsync(scene, cam); } catch (e) { }
    placeCam(true); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); await nextFrame();
    requestAnimationFrame(tick);
    onReady && onReady();
  })();
  ready.catch(e => { console.warn(e); onError && onError(e); });

  // ---------- high-res render ----------
  const bgCv = document.createElement('canvas'); bgCv.width = 512; bgCv.height = 512; { const g = bgCv.getContext('2d'); const gr = g.createRadialGradient(256, 210, 10, 256, 256, 360); gr.addColorStop(0, '#f3f1ed'); gr.addColorStop(0.55, '#e4e0d9'); gr.addColorStop(1, '#cfcac1'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const bgTex = new THREE.CanvasTexture(bgCv); bgTex.colorSpace = THREE.SRGBColorSpace;
  const ANGLES = [['frente', 0], ['espalda', Math.PI], ['perfil', -Math.PI / 2], ['3-4', -0.6]];
  async function renderSet({ w = isMobile ? 1080 : 1600, h = isMobile ? 1260 : 1866, angles = ANGLES, transparent = false, noTT = false, zoom = 1, pitch = 0.08, dist = 0, cy = null } = {}) {
    await ready; clearTimeout(paintTimer); if (paintQ) { paintQ = null; paint(true, null); } finishTrans();
    running = false;
    const ss = lowPower ? 1.5 : 1; // no MSAA on software GL -> supersample instead
    const prev = { yaw: spin.rotation.y, pr: renderer.getPixelRatio(), size: renderer.getSize(new THREE.Vector2()), aspect: cam.aspect, zoom: view.zoom, pitch: view.pitch, map: key.shadow.mapSize.x };
    renderer.setPixelRatio(ss); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    key.shadow.mapSize.set(isMobile || lowPower ? 2048 : 4096, isMobile || lowPower ? 2048 : 4096); key.shadow.map && key.shadow.map.dispose(); key.shadow.map = null;
    const fm = fitMode; fitMode = null; cropStand(); scene.background = transparent ? null : bgTex; view.zoom = zoom; view.pitch = pitch; frame(); if (dist) view.dist = dist; if (cy != null) view.center.set(0, cy, 0); const ttv = tt.visible; if (noTT) tt.visible = ring.visible = false;
    // print textures at 2x for renders (desktop): crisp lettering in the downloaded images
    const hi = [];
    if (!isMobile && !lowPower) {
      const tmp = {}; drawInto(n => { if (!tmp[n]) { const cv = document.createElement('canvas'); cv.width = TEX[n][0] * 2; cv.height = TEX[n][1] * 2; tmp[n] = cv; } return tmp[n]; });
      Object.entries(tmp).forEach(([n, cv]) => { const m = parts[n]; if (!m) return; const t = mkTex(cv); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); hi.push([m, t, m.map]); m.map = t; if (m.userData.blend) m.userData.blend.map2.value = t; });
    }
    const out = [];
    for (const [name, a] of angles) {
      spin.rotation.y = a; if (flag) G.waveFlag(flag, 1.3); placeCam(true); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam);
      let url;
      if (ss !== 1) { const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(renderer.domElement, 0, 0, w, h); url = c2.toDataURL('image/png'); c2.width = c2.height = 0; }
      else url = renderer.domElement.toDataURL('image/png');
      out.push({ name, url });
      await new Promise(r => setTimeout(r, 30));
    }
    hi.forEach(([m, t, old]) => { m.map = old; if (m.userData.blend) m.userData.blend.map2.value = old; t.dispose(); if (t.image) t.image.width = t.image.height = 0; }); // free canvas memory now (iOS caps it)
    scene.background = null; tt.visible = ring.visible = ttv;
    key.shadow.mapSize.set(prev.map, prev.map); key.shadow.map && key.shadow.map.dispose(); key.shadow.map = null;
    fitMode = fm; cropStand(); renderer.setPixelRatio(prev.pr); view.zoom = prev.zoom; view.pitch = prev.pitch; spin.rotation.y = prev.yaw; resize();
    shadowDirty = true; dirty = true; running = true; renderer.shadowMap.needsUpdate = true; placeCam(true); renderer.render(scene, cam); return out;
  }
  return {
    setFit(o) { fitMode = o ? { top: 0, bottom: 0, fill: 0.85, ...o } : null; cropStand(); shadowDirty = true; frame(); view.snap = true; dirty = true; wake(); },
    rebuild, repaint: (mode = 'fade') => paint(true, mode), renderSet, yaw: () => spin.rotation.y, ready, lowPower, stats: () => ({ why: lastWhy, dpr, ema: Math.round(ema), frames: frameN, parked: !!view.parked, auto: view.auto, trans: !!trans }),
    setYaw(a) { wake(); view.auto = false; view.lastInteract = performance.now(); const cur = spin.rotation.y; const d = ((a - cur) % G.TAU + G.TAU * 1.5) % G.TAU - G.TAU / 2; view.targetYaw = cur + d; },
    zoomBy(f) { setZoom(view.zoom * f); }, resetView() { view.zoom = 1; view.pitch = 0.1; view.parked = false; view.auto = true; autoSince = performance.now(); dirty = true; emit(); },
    toggleAuto() { view.parked = false; view.auto = !view.auto; autoSince = performance.now(); dirty = true; view.lastInteract = performance.now() + (view.auto ? 0 : 1e9); emit(); return view.auto; },
    onView(f) { listeners.push(f); }, view, renderer,
    onZonePick(f) { zoneCb = f; }, setZones(f) { zonesFn = f; },
    highlight(z, flash) { if (z && flash) { flashZ = z; flashT0 = performance.now(); wake(); view.auto = false; view.lastInteract = performance.now(); } else if (!z) { flashZ = null; applyHL(); } dirty = true; },
    pickAt: (x, y) => pick(x, y), zoneScreenPoint(z) { const ms = []; product.traverse(o => { if (o.isMesh && zoneMats(z).includes(o.material)) ms.push(o); }); if (!ms.length) return null; const r = el.getBoundingClientRect();
      for (let i = 0; i < 400; i++) { const x = r.left + r.width * (0.06 + 0.88 * ((0.5 + i * 0.7548777) % 1)), y = r.top + r.height * (0.06 + 0.88 * ((0.5 + i * 0.5698403) % 1)); if (pick(x, y) === z) return { x, y }; } return null; },
  };
}
