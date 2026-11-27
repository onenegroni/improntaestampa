// Impronta 3D configurator: scene, products, interaction, renders.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import * as G from './garments.js';
import * as T from './textures.js';
import { fittedParts } from './models/fitted-garments.js';
import { PRODUCTS, compatiblePrint, optionsFor } from './product-data.js';
// CC0 textile scans by colormass and Rico Cilliers, published by Poly Haven.
import jerseyNormal from './fabric-scans/jersey-normal.webp';
import jerseySurface from './fabric-scans/jersey-surface.webp';
import jerseyGrain from './fabric-scans/jersey-grain.webp';
import fleeceNormal from './fabric-scans/fleece-normal.webp';
import fleeceSurface from './fabric-scans/fleece-surface.webp';
import fleeceGrain from './fabric-scans/fleece-grain.webp';
import sportsNormal from './fabric-scans/sports-normal.webp';
import sportsSurface from './fabric-scans/sports-surface.webp';
import sportsGrain from './fabric-scans/sports-grain.webp';

const PRINT_LAYOUT = { visor: [768, 384], torso: [2048, 1024], sleeve: [1024, 512], hood: [1024, 512], short: [1024, 512], shortPlain: [1024, 512], flag: [2048, 1365], cap: [1024, 512] };
const ZONE_MATERIALS = {
  cuerpo: ['torso', 'flag', 'cap', 'facing'],
  short: ['short', 'shortPlain', 'shortFacing'],
  mangas: ['sleeve', 'sleeveFacing', 'visor'],
  capucha: ['hood', 'lining'],
  punos: ['punos', 'cord'],
  malla: ['capMesh'],
};
const ZONES = Object.keys(ZONE_MATERIALS);
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
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

// Keep the linear swatch response through the midtones. Shape the darkest
// shadows and brightest highlights with one scale for all channels.
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    color *= toneMappingExposure;
    float peak = max(max(color.r, color.g), color.b);
    color *= mix(0.56, 1.0, smoothstep(0.0, 0.075, peak));
    const float knee = 0.68;
    if (peak <= knee) return color;
    float highlight = 1.0 - knee;
    float range = peak - knee;
    return color * ((knee + highlight * range / (range + highlight)) / peak);
  }`
);

export function createConfigurator(canvasHost, state, { onReady, onError, onLost, printFontsReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const dprMin = 1;
  const dprCap = Math.min(Math.max(window.devicePixelRatio || 1, dprMin), 2);
  let dpr = lowPower ? dprMin : dprCap;
  renderer.setPixelRatio(dpr);
  // Product swatches are SDR. Light in linear sRGB, with calibrated light
  // energy and exposure, rather than grading the selected hues filmically.
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  const key = new THREE.DirectionalLight(0xffffff, 2.86);
  key.position.set(-3.05, 3.3, 4.8);
  key.castShadow = true;
  const LIVE_SM = lowPower ? 512 : 1024;
  key.shadow.mapSize.set(LIVE_SM, LIVE_SM);
  Object.assign(key.shadow.camera, { left: -1.15, right: 1.15, top: 1.15, bottom: -1.15, near: 0.5, far: 8 });
  key.shadow.radius = 5;
  key.shadow.bias = -.00021;
  key.shadow.normalBias = .0044;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .66);
  rim.position.set(1.8, 1.55, -2.6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, .43);
  fill.position.set(1.35, .72, 3.4);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x969696, .23));

  const spin = new THREE.Group(); scene.add(spin);
  const anim = new THREE.Group(); spin.add(anim);
  const product = new THREE.Group(); anim.add(product);
  const stand = new THREE.Group(); anim.add(stand);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x262823, roughness: 0.65, metalness: 0.1 });

  const fabrics = {
    deportiva: { kind: 'mesh', sources: [sportsNormal, sportsSurface, sportsGrain], roughness: .92, sheen: .14, sheenRoughness: .76, scale: .69, spec: .10 },
    modal: { kind: 'jersey', sources: [jerseyNormal, jerseySurface, jerseyGrain], roughness: .97, sheen: .21, sheenRoughness: .87, scale: .76, spec: .14 },
    frizado: { kind: 'fleece', sources: [fleeceNormal, fleeceSurface, fleeceGrain], roughness: .99, sheen: .34, sheenRoughness: .92, scale: .66, spec: .078 },
  };
  const panelRepeats = {
    torso: [3.3, 1.9], sleeve: [1.34, .59], longSleeve: [1.36, 1.46],
    hood: [1.24, .91], lining: [1.24, .91], fleeceTorso: [2.48, 1.75], short: [1.45, 1.54], shortPlain: [1.45, 1.54],
    flag: [4.3, 2.8], cap: [1.85, 1.13], visor: [1.4, .68],
  };
  const panelFor = (part, product) => {
    if (product === 'campera' && (part === 'torso' || part === 'facing')) return 'fleeceTorso';
    if (part === 'sleeveFacing') return product === 'campera' ? 'longSleeve' : 'sleeve';
    if (part === 'shortFacing') return 'short';
    if (part === 'sleeve' && product === 'campera') return 'longSleeve';
    return part;
  };
  const maxAnisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
  const textureLoader = new THREE.TextureLoader();
  const swatchesReady = Promise.all(Object.values(fabrics).map(async fabric => {
    const maps = await Promise.allSettled(fabric.sources.map(src => textureLoader.loadAsync(src)));
    if (maps.every(map => map.status === 'fulfilled')) {
      [fabric.normal, fabric.roughMap] = maps.slice(0, 2).map(map => {
        const texture = map.value;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = Math.min(maxAnisotropy, 8);
        texture.colorSpace = THREE.NoColorSpace;
        return texture;
      });
      fabric.grainTexture = maps[2].value;
      fabric.grainTexture.wrapS = fabric.grainTexture.wrapT = THREE.RepeatWrapping;
      fabric.grainTexture.anisotropy = Math.min(maxAnisotropy, 8);
      fabric.grainTexture.colorSpace = THREE.NoColorSpace;
      fabric.panels = new Map();
    } else {
      // Older browsers can still use the procedural textile if image decoding fails.
      for (const map of maps) if (map.status === 'fulfilled') map.value.dispose();
      fabric.normal = T.knitNormal(192, fabric.kind);
      fabric.normal.repeat.set(13, 8);
      fabric.roughMap = T.fabricRoughness(fabric.kind, [12, 8]);
      fabric.grainTexture = T.fabricGrain(fabric.kind);
    }
  }));
  function panelSwatch(fabric, panel) {
    if (!fabric.panels) return { normal: fabric.normal, surface: fabric.roughMap };
    const repeat = panelRepeats[panel] || panelRepeats.torso;
    if (!fabric.panels.has(panel)) {
      const normal = fabric.normal.clone(), surface = fabric.roughMap.clone();
      normal.repeat.set(...repeat);
      surface.repeat.set(...repeat);
      fabric.panels.set(panel, { normal, surface });
    }
    return fabric.panels.get(panel);
  }
  const twillRoughness = T.fabricRoughness('twill', [11, 7]);
  const twillGrain = T.fabricGrain('twill');
  let capNet = null;
  const twill = T.knitNormal(160, 'twill'); twill.repeat.set(21, 11);
  const rib = T.knitNormal(128, 'rib'); rib.repeat.set(13, 2);
  const needsPrint = () => PRODUCTS[state.producto].atlas;
  const currentFabric = () => fabrics[optionsFor(state).material?.swatch] || fabrics.deportiva;
  const texes = {};
  const surfaces = {};
  const maxTextureSize = renderer.capabilities.maxTextureSize;
  const basePrintSize = Math.min(2048, maxTextureSize);
  const canUseCloseupAtlas = !isMobile && !lowPower && maxTextureSize >= 4096;

  function createSurface(name, size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
    const [width, height] = PRINT_LAYOUT[name];
    // Always rasterize the original design at native atlas resolution, using
    // its authored coordinate space so UV placements stay exactly the same.
    context.setTransform(size / width, 0, 0, size / height, 0, 0);
    context.imageSmoothingQuality = 'high';
    const texture = new THREE.CanvasTexture(canvas);
    if (name === 'short' || name === 'shortPlain') texture.wrapS = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(maxAnisotropy, lowPower ? 8 : 16);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { canvas, context, width, height, texture };
  }
  function disposeSurface(surface) {
    surface.texture.dispose();
    surface.canvas.width = surface.canvas.height = 0;
  }
  function primaryPrint() { return needsPrint()[0]; }
  function closeupPrint(zoom) { return canUseCloseupAtlas && zoom >= 1.65; }
  function surfaceFor(name) {
    const size = name === primaryPrint() && closeupPrint(view.zoom) ? 4096 : basePrintSize;
    const previous = surfaces[name];
    if (previous?.canvas.width === size) return previous;
    const surface = createSurface(name, size);
    surfaces[name] = surface;
    texes[name] = surface.texture;
    if (previous) {
      for (const material of Object.values(parts)) {
        if (material.map === previous.texture) material.map = surface.texture;
      }
      disposeSurface(previous);
    }
    return surface;
  }

  const temporaryMaterials = new Set();
  function own(material) { temporaryMaterials.add(material); return material; }
  function fabricMat(map, { ribbed = false, side = THREE.DoubleSide } = {}) {
    const f = currentFabric();
    const grain = f.panels ? f.scale : .34;
    return own(new THREE.MeshPhysicalMaterial({
      map, side, roughness: f.roughness, roughnessMap: f.roughMap,
      envMapIntensity: .32, vertexColors: true, normalMap: ribbed ? rib : f.normal,
      normalScale: new THREE.Vector2(grain, grain),
      sheen: f.sheen, sheenRoughness: f.sheenRoughness,
      sheenColor: new THREE.Color(0xc0c0c0), specularIntensity: f.spec,
    }));
  }
  function colorMat(hex, opts) { const m = fabricMat(null, { ribbed: true, ...opts }); m.color.set(hex); return m; }
  function mesh(geometry, material) {
    if (material.vertexColors && !geometry.hasAttribute('color')) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
    }
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = object.receiveShadow = true;
    return object;
  }

  let parts = {}, flag = null, bbox = new THREE.Box3(), pbox = new THREE.Box3(), fitMode = null, hostH = 1;
  const vOf = y => { const { yHem, yS } = G.TORSO; return G.clamp(0.8 * (y - yHem) / (yS - yHem), 0, 1); };

  function clearGroup(gr) { for (const child of gr.children) child.traverse(object => object.geometry?.dispose()); gr.clear(); }
  const hangs = [];
  const zipTeeth = new THREE.MeshStandardMaterial({ color: 0x2a2928, metalness: .16, roughness: .52 });
  const strapMaterial = new THREE.MeshStandardMaterial({ color: 0x262622, roughness: .83, side: THREE.DoubleSide });
  const roughHardware = new THREE.MeshStandardMaterial({ color: 0xa3a29c, metalness: .69, roughness: .38 });

  function seamMaterial(name) {
    const material = own(new THREE.MeshStandardMaterial({
      color: '#66615d', roughness: .96, envMapIntensity: .28,
    }));
    parts[name] = material;
    return material;
  }

  function addThread(group, paths, material, options) {
    const sewn = new THREE.Mesh(G.thread(paths, options), material);
    // Needlework is too fine to put its own noise into the studio shadow map.
    sewn.receiveShadow = true;
    group.add(sewn);
  }

  function fittedFabric(name, side) {
    const material = fabricMat(texes[name], { side });
    const cloth = { value: null };
    const relief = { value: 0 };
    material.userData.clothGrain = { cloth, relief };
    material.onBeforeCompile = shader => {
      shader.uniforms.improntaCloth = cloth;
      shader.uniforms.improntaRelief = relief;
      shader.uniforms.improntaTile = { value: new THREE.Vector2(...panelRepeats[panelFor(name, state.producto)]) };
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>',
        `#include <map_pars_fragment>
         uniform sampler2D improntaCloth;
         uniform float improntaRelief;
         uniform vec2 improntaTile;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
         float threadValue = texture2D(improntaCloth, vMapUv * improntaTile).r;
         diffuseColor.rgb *= 1.0 + (threadValue - 0.5) * improntaRelief;`);
    };
    return material;
  }

  function buildFittedGarment(kind, y = 0) {
    const group = new THREE.Group();
    group.position.y = y;
    const side = THREE.FrontSide;
    const fabric = name => fittedFabric(name, side);
    const inside = () => fabricMat(null, { side: THREE.BackSide });
    const stitches = map => own(new THREE.MeshStandardMaterial({
      map, side, roughness: .98, vertexColors: true,
    }));
    const makeMaterial = {
      torso: () => fabric('torso'),
      sleeve: () => fabric('sleeve'),
      short: () => fabric('short'),
      shortPlain: () => fabric('shortPlain'),
      hood: () => fabric('hood'),
      facing: inside,
      sleeveFacing: inside,
      shortFacing: inside,
      lining: () => fabricMat(null, { side }),
      punos: () => colorMat(state.colors.punos, { side }),
      cord: () => colorMat(state.colors.punos, { side }),
      bodyThread: () => stitches(texes.torso),
      hoodThread: () => stitches(texes.hood),
      sleeveThread: () => stitches(texes.sleeve),
      shortThread: () => stitches(texes.shortPlain),
      neckTape: () => own(new THREE.MeshStandardMaterial({
        color: 0x242321, roughness: .97, normalMap: rib, normalScale: new THREE.Vector2(.28, .28), side, vertexColors: true,
      })),
      zipMetal: () => zipTeeth,
    };
    for (const { name, geometry } of fittedParts(kind)) {
      const material = parts[name] || (parts[name] = makeMaterial[name]());
      const panel = mesh(geometry, material);
      panel.castShadow = name !== 'lining' && !name.endsWith('Thread') && material.side !== THREE.BackSide;
      if (kind === 'hoodie' && name === 'cord') {
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        const pivot = new THREE.Group();
        pivot.position.set(0, bounds.max.y, (bounds.min.z + bounds.max.z) * .5);
        panel.position.copy(pivot.position).negate();
        pivot.add(panel);
        hangs.push({ node: pivot, rest: 0, strength: .13, phase: .23 });
        group.add(pivot);
      } else {
        group.add(panel);
      }
    }
    return group;
  }

  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = contactCanvas.height = 128;
  const contactContext = contactCanvas.getContext('2d');
  const contactGradient = contactContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  contactGradient.addColorStop(0, 'rgba(33,33,33,.36)');
  contactGradient.addColorStop(.41, 'rgba(38,38,38,.14)');
  contactGradient.addColorStop(1, 'rgba(38,38,38,0)');
  contactContext.fillStyle = contactGradient;
  contactContext.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(contactCanvas);
  contactTexture.colorSpace = THREE.SRGBColorSpace;
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false, toneMapped: false }));
  contact.rotation.x = -Math.PI / 2;
  scene.add(contact);

  function build() {
    clearGroup(product);
    clearGroup(stand);
    temporaryMaterials.forEach(material => material.dispose());
    temporaryMaterials.clear();
    parts = {};
    flag = null;
    hangs.length = 0;
    const P = state.producto;
    const model = PRODUCTS[P].model;
    const fitted = P !== 'bandera' && P !== 'gorra';
    const fleece = P === 'campera';
    key.intensity = fleece ? 2.68 : fitted ? 2.86 : 2.62;
    key.shadow.bias = fitted ? -.00009 : -.00021;
    key.shadow.normalBias = fitted ? .0015 : .0044;
    fill.intensity = fleece ? .61 : fitted ? .48 : .56;
    rim.intensity = fleece ? .56 : fitted ? .66 : .63;
    // Only the current product keeps a resident atlas. In particular, a
    // sports kit's two numbered/plain shorts atlases leave memory on switch.
    for (const name of Object.keys(surfaces)) {
      if (needsPrint().includes(name)) continue;
      disposeSurface(surfaces[name]);
      delete surfaces[name];
      delete texes[name];
    }
    product.rotation.set(0, 0, 0);
    product.position.set(0, 0, 0);
    paintTextures();
    if (model === 'kit') {
      // The jersey tucks into the shorts with the elastic band in front.
      product.add(buildFittedGarment(model, .14), buildFittedGarment('shorts', .14));
    } else if (fitted) {
      product.add(buildFittedGarment(model));
    } else if (P === 'bandera') {
      const [width, height] = state.talle.split('×').map(parseFloat);
      const clothHeight = Math.min(.8, 1.2 * (height / width || .64));
      const geometry = G.flagGeo(1.2, clothHeight);
      const material = parts.flag = fittedFabric('flag', THREE.DoubleSide);
      const cloth = mesh(geometry, material);
      cloth.position.set(-.58, .195, 0);
      product.add(cloth);
      flag = geometry;
      const mast = mesh(new THREE.CylinderGeometry(.007, .0095, 1.087, 24), roughHardware);
      mast.position.set(-.594, .080, -.003);
      const top = mesh(new THREE.CylinderGeometry(.011, .009, .017, 24), roughHardware);
      top.position.set(-.594, .632, -.003);
      const base = mesh(new THREE.CylinderGeometry(.076, .081, .018, 48), darkM);
      base.position.set(-.594, -.47, -.003);
      stand.add(mast, top, base);
      for (const side of [-1, 1]) {
        const buckle = mesh(new THREE.TorusGeometry(.0075, .00125, 10, 26), roughHardware);
        buckle.position.set(-.583, .195 + side * (clothHeight * .5 - .029), .0005);
        product.add(buckle);
      }
    } else if (P === 'gorra') {
      const shape = G.cap();
      const cap = new THREE.Group();
      cap.rotation.x = .08;
      const crown = parts.cap = fittedFabric('cap', THREE.DoubleSide);
      capNet ||= T.truckerMeshMask();
      const net = parts.capMesh = own(new THREE.MeshStandardMaterial({
        color: state.colors.malla, side: THREE.DoubleSide, vertexColors: true,
        alphaMap: capNet, alphaTest: .48, alphaToCoverage: true, roughness: .97,
        normalMap: twill, normalScale: new THREE.Vector2(.16,.16), envMapIntensity: .30,
      }));
      const visor = parts.visor = fittedFabric('visor', THREE.DoubleSide);
      const trim = parts.punos = colorMat(state.colors.punos);
      cap.add(mesh(shape.front, crown), ...shape.rear.map(geo => mesh(geo, net)),
        mesh(shape.inner, strapMaterial), mesh(shape.band, trim), mesh(shape.button, trim));
      cap.add(mesh(shape.visorTop, visor), mesh(shape.visorBottom, visor), mesh(shape.visorEdge, visor));
      cap.add(mesh(shape.snaps, strapMaterial), ...shape.closure.map(geo => mesh(geo, strapMaterial)));
      const seams = seamMaterial('bodyThread');
      addThread(cap, shape.seams, seams, { pitch: .0021, radius: .00031 });
      addThread(cap, shape.brimThread, seamMaterial('sleeveThread'), { pitch: .0024, radius: .00032, normal: [0, 1, 0] });
      if (state.talle === 'Infantil ajustable') cap.scale.setScalar(.91);
      product.add(cap);
    }
    spin.updateMatrixWorld(true);
    const r0 = spin.rotation.y; spin.rotation.y = 0; anim.scale.setScalar(1); anim.position.y = 0; spin.updateMatrixWorld(true);
    bbox.setFromObject(anim);
    pbox.setFromObject(product);
    if (pbox.isEmpty() || P === 'bandera') pbox.copy(bbox);
    contact.position.y = pbox.min.y - (P === 'gorra' || fitted ? .010 : .023);
    contact.visible = P !== 'bandera';
    const width = Math.max(0.23, pbox.max.x - pbox.min.x);
    const depth = Math.max(0.16, pbox.max.z - pbox.min.z);
    contact.scale.set(width * 1.27, depth * 2.42, 1);
    spin.rotation.y = r0;
    frame();
    matTargets().forEach(([color, target]) => color.copy(target));
    shadowDirty = true;
    dirty = true;
  }
  const ease = t => 1 - Math.pow(1 - t, 3);
  let clothVelocity = 0, clothTilt = 0, clothTurn = 0;
  function settleCloth(turnDelta, elapsed) {
    if (reduceMotion || !hangs.length) return false;
    clothTurn += (turnDelta - clothTurn) * .14;
    const impulse = G.clamp(clothTurn * 8, -.88, .88);
    clothVelocity = (clothVelocity + (impulse - clothTilt) * .13) * .81;
    clothTilt += clothVelocity;
    if (Math.abs(clothTilt) + Math.abs(clothVelocity) + Math.abs(clothTurn) < .001) {
      clothVelocity = clothTilt = clothTurn = 0;
    }
    for (const {node, rest, strength, phase} of hangs) {
      node.rotation.z = -strength * clothTilt;
      node.rotation.x = rest + .052 * clothTilt * Math.sin(elapsed * 5 + phase);
    }
    product.rotation.z = -.013 * clothTilt;
    return clothTilt !== 0;
  }
  let animTok = 0, dirty = true, tweening = 0;
  function tween(ms, fn) { tweening++; return new Promise(res => { const t0 = performance.now(); const step = () => { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); dirty = true; if (t < 1) requestAnimationFrame(step); else { tweening--; res(); } }; requestAnimationFrame(step); }); }
  function rebuild(animated) {
    const token = ++animTok;
    clearTimeout(paintTimer);
    paintTimer = 0;
    if (!inited) return;
    build();
    view.snap = true;
    placeCam(true);
    wake();
    if (animated && !reduceMotion) {
      anim.scale.setScalar(.978);
      anim.position.y = -.008;
      tween(lowPower ? 260 : 380, time => {
        if (token !== animTok) return;
        const arrival = ease(time);
        anim.scale.setScalar(.978 + .022 * arrival);
        anim.position.y = -.008 * (1 - arrival);
      });
    }
    if (running) {
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, cam);
    }
  }
  function drawInto(get, names) {
    const st = compatiblePrint(state), product = st.producto;
    if (names.includes('torso')) T.torsoCanvas(get('torso'), st, { vOf, product });
    if (names.includes('sleeve')) T.sleeveCanvas(get('sleeve'), st);
    if (names.includes('hood')) T.hoodCanvas(get('hood'), st);
    if (names.includes('short')) T.shortCanvas(get('short'), st, get('shortPlain'));
    if (names.includes('flag')) T.flagCanvas(get('flag'), st);
    if (names.includes('cap')) T.capCanvas(get('cap'), st);
    if (names.includes('visor')) T.plainCanvas(get('visor'), st, 'mangas');
  }
  function printSignature(name, st) {
    const accents = [st.preset, ...T.pcols(st)];
    const sidePrint = st.printAll ? accents : [];
    const text = [st.nombre,st.numero,st.espalda,st.escuela,st.frase,st.tipografia,st.arte,
      st.nombreLugar,st.numeroLugar,st.espaldaLugar,st.logoLugar,st.arteLugar];
    switch (name) {
      case 'torso': return [st.producto, st.hideAutoMark, st.colors.cuerpo, ...accents, ...text];
      case 'sleeve': {
        const placements = [['nombreLugar','nombre'],['numeroLugar','numero'],['arteLugar','arte']]
          .filter(([position])=>st[position]?.startsWith('manga')).flatMap(([position,value])=>[st[position],st[value]]);
        const type = placements.length || st.mangaIzq || st.mangaDer ? st.tipografia : '';
        return [st.producto,st.colors.mangas,...sidePrint,...placements,st.mangaIzq,st.mangaDer,type];
      }
      case 'hood': return [st.colors.capucha, ...sidePrint];
      case 'short':
      case 'shortPlain': return [st.colors.short, ...accents, st.numero];
      case 'flag': return [st.colors.cuerpo, ...accents, st.espalda, st.escuela];
      case 'cap': return [st.colors.cuerpo, ...accents, st.espalda, st.nombre, st.tipografia];
      default: return [st.colors.mangas];
    }
  }
  function printLogo(name, st) {
    return ['torso', 'flag', 'cap'].includes(name) ? st.logoImg : null;
  }
  function matTargets() {
    const st = compatiblePrint(state), f = currentFabric();
    const list = [];
    if (parts.punos) list.push([parts.punos.color, new THREE.Color(st.colors.punos)]);
    if (parts.capMesh) list.push([parts.capMesh.color, new THREE.Color(st.colors.malla)]);
    if (parts.cord) list.push([parts.cord.color, new THREE.Color(st.colors.punos)]);
    if (parts.lining) list.push([parts.lining.color, new THREE.Color(st.colors.capucha).lerp(new THREE.Color('#847d73'), .07).multiplyScalar(.77)]);
    if (parts.facing) list.push([parts.facing.color, new THREE.Color(st.colors.cuerpo).multiplyScalar(.71)]);
    if (parts.shortFacing) list.push([parts.shortFacing.color, new THREE.Color(st.colors.short).multiplyScalar(.67)]);
    if (parts.sleeveFacing) list.push([parts.sleeveFacing.color, new THREE.Color(st.colors.mangas).multiplyScalar(.71)]);
    const seamZones = { bodyThread: 'cuerpo', shortThread: 'short', sleeveThread: 'mangas', trimThread: 'punos', hoodThread: 'capucha' };
    for (const [key, zone] of Object.entries(seamZones)) {
      if (!parts[key] || parts[key].map) continue;
      const base = st.colors[zone];
      const color = new THREE.Color(base);
      if (T.lum(base) < .15) color.lerp(new THREE.Color('#a9a19b'), .18);
      else color.multiplyScalar(.73);
      list.push([parts[key].color, color]);
    }
    for (const [name, material] of Object.entries(parts)) {
      const accessory = name === 'cap' || name === 'visor' || name === 'flag';
      const grainLayer = material.userData.clothGrain;
      if (grainLayer) {
        grainLayer.cloth.value = accessory ? twillGrain : f.grainTexture;
        grainLayer.relief.value = accessory ? .37 : f.kind === 'fleece' ? .92 : .71;
        material.anisotropy = !accessory && f.kind === 'mesh' ? .12 : 0;
      }
      if (!material.normalMap || name === 'capMesh') continue;
      const ribbed = material.normalMap === rib;
      const swatch = accessory ? { normal: twill, surface: twillRoughness } : panelSwatch(f, panelFor(name, st.producto));
      const contact = !accessory && !ribbed && f.panels ? swatch.surface : null;
      if (Boolean(contact) !== Boolean(material.aoMap)) material.needsUpdate = true;
      material.aoMap = contact;
      material.aoMapIntensity = .36;
      material.roughness = accessory ? .94 : f.roughness;
      material.roughnessMap = swatch.surface;
      material.sheen = accessory ? 0 : f.sheen;
      material.specularIntensity = accessory ? .22 : f.spec;
      material.sheenRoughness = f.sheenRoughness;
      if (!ribbed) material.normalMap = swatch.normal;
      const grain = ribbed ? .43 : name === 'flag' ? .20 : accessory ? .30 : f.panels ? f.scale : .34;
      material.normalScale.set(grain, grain);
    }
    return list;
  }
  let paintTimer = 0;
  function paintTextures() {
    const design = compatiblePrint(state);
    const changed = needsPrint().filter(name => {
      const surface = surfaceFor(name);
      const key = JSON.stringify(printSignature(name, design)), logo = printLogo(name, design);
      if (surface.key === key && surface.logo === logo) return false;
      surface.key = key;
      surface.logo = logo;
      return true;
    });
    drawInto(name => surfaces[name], changed);
    for (const name of changed) texes[name].needsUpdate = true;
    matTargets().forEach(([color, target]) => color.copy(target));
    dirty = true;
  }
  function flushPaint() {
    clearTimeout(paintTimer);
    paintTimer = 0;
    if (!inited) return;
    paintTextures();
    if (running) {
      placeCam();
      renderer.render(scene, cam);
    }
  }
  function repaint() {
    if (!paintTimer) paintTimer = setTimeout(flushPaint, lowPower ? 80 : 36);
  }

  // ---------- camera / interaction ----------
  const view = { pitch: 0.09, zoom: 1, targetYaw: -0.6, auto: false, dist: 2.6, center: new THREE.Vector3(), cd: 0, cc: new THREE.Vector3(), snap: true };
  function frame() {
    if (fitMode) {
      const dimensions = pbox.getSize(new THREE.Vector3());
      pbox.getCenter(view.center);
      const tangent = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const freeHeight = Math.max(0.45, 1 - (fitMode.top + fitMode.bottom) / hostH);
      const fill = state.producto === 'gorra' ? fitMode.fill * .82 : fitMode.fill;
      const heightDistance = dimensions.y / (fill * freeHeight * 2 * tangent);
      const widthDistance = Math.max(dimensions.x, dimensions.z) * 1.22 / (2 * tangent * cam.aspect);
      view.dist = Math.max(heightDistance, widthDistance) + dimensions.z * .32;
      view.center.y += (fitMode.top - fitMode.bottom) / hostH * view.dist * tangent;
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
    renderer.setSize(Math.ceil(w), Math.ceil(h), false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
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
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let tap = null, zoneCb = null, zonesFn = () => ZONES, hoverZ = null, hoverT = 0, flashZ = null, flashT0 = 0;
  const HL = new THREE.Color(0xaab99f);
  function zoneMats(z) { return (ZONE_MATERIALS[z] || []).map(k => parts[k]).filter(Boolean); }
  function zoneOf(mat) {
    return ZONES.find(z => ZONE_MATERIALS[z].some(name => parts[name] === mat)) || null;
  }
  function pick(cx, cy) {
    const r = el.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    spin.updateMatrixWorld(true); cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam);
    const ok = zonesFn(); for (const h of ray.intersectObject(product, true)) { const z = zoneOf(h.object.material); if (z && ok.includes(z)) return z; if (!z) continue; }
    return null;
  }
  function applyHL() {
    const t = performance.now(); let fl = 0; if (flashZ) { const k = (t - flashT0) / 900; fl = k < 1 ? Math.sin(Math.min(1, k) * Math.PI) * 0.11 : 0; if (k >= 1) flashZ = null; }
    ZONES.forEach(z => { const a = (z === hoverZ ? 0.025 : 0) + (z === flashZ ? fl : 0); zoneMats(z).forEach(m => { if (m.emissive) m.emissive.copy(HL).multiplyScalar(a); }); });
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
  el.addEventListener('pointerdown', e => { wake(); try { el.setPointerCapture(e.pointerId); } catch (err) { } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.auto = false; emit(); el.style.cursor = 'grabbing'; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.zoom; } });
  el.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); setZoom(zoom0 * d / pinch0); return; }
    view.targetYaw += dx * 0.009; vel = reduceMotion ? 0 : dx * 0.009; view.pitch = G.clamp(view.pitch + dy * 0.003, -0.15, 0.5);
  });
  const up = e => { ptrs.delete(e.pointerId); el.style.cursor = hoverZ ? 'pointer' : 'grab'; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(view.zoom * (e.deltaY > 0 ? 0.92 : 1.08)); }, { passive: false });
  function setZoom(z) {
    const next = G.clamp(z, .8, 2.6);
    const updatePrint = closeupPrint(view.zoom) !== closeupPrint(next);
    view.zoom = next;
    if (updatePrint) repaint();
    dirty = true;
    emit();
  }
  let listeners = [];
  function emit() { listeners.forEach(f => f(view)); }

  const clock = new THREE.Clock(); let running = true, visible = true, inited = false, shadowDirty = true;
  const gl2 = lowPower && renderer.capabilities.isWebGL2 ? renderer.getContext() : null; let fence = null, fenceT = 0, lastWhy = '';
  let lastFlagFrame = -1;
  let lastRender = 0, frameN = 0, ema = 16, slowFor = 0, fastFor = 0;
  function wake() { dirty = true; }
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
    if (!view.auto && !ptrs.size && vel) {
      view.targetYaw += vel;
      vel *= 0.86;
      if (Math.abs(vel) < 0.0001) vel = 0;
    }
    if (view.auto) view.targetYaw += dt * 0.35;
    const dy = view.targetYaw - spin.rotation.y;
    const turnDelta = Math.abs(dy) < 1e-4 ? dy : dy * .18;
    spin.rotation.y += turnDelta;
    const settling = settleCloth(turnDelta, t);
    const flashing = flashZ ? applyHL() || true : false;
    const camMoving = Math.abs(view.dist - view.cd) > 1e-4 || view.cc.distanceToSquared(view.center) > 1e-8 || Math.abs(view.zoom - (view.zc ?? view.zoom)) > 1e-4;
    const moving = view.auto || Math.abs(dy) > 1e-4 || vel !== 0 || ptrs.size > 0 || camMoving || tweening > 0 || (!!flag && !reduceMotion) || flashing || settling;
    if (!moving && !dirty) { lastRender = 0; return; }
    lastWhy = [view.auto && 'auto', Math.abs(dy) > 1e-4 && 'yaw', vel && 'vel', ptrs.size && 'ptr', camMoving && 'cam', tweening && 'tween', flag && 'flag', dirty && 'dirty'].filter(Boolean).join(',');
    if (flag && !reduceMotion && t - lastFlagFrame > .032) { G.waveFlag(flag, t); lastFlagFrame = t; }
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
    const pm = new THREE.PMREMGenerator(renderer);
    const studioRoom = new RoomEnvironment();
    scene.environment = pm.fromScene(studioRoom, .075).texture;
    studioRoom.dispose();
    pm.dispose();
    await swatchesReady;
    await nextFrame();
    spin.rotation.y = view.targetYaw;
    inited = true; build(); view.snap = true; await nextFrame();
    try { if (renderer.compileAsync) await renderer.compileAsync(scene, cam); } catch (e) { }
    placeCam(true); renderer.shadowMap.needsUpdate = true; renderer.render(scene, cam); await nextFrame();
    requestAnimationFrame(tick);
    onReady && onReady();
  })();
  ready.catch(e => { console.warn(e); onError && onError(e); });

  // ---------- high-res render ----------
  const bgCv = document.createElement('canvas'); bgCv.width = 512; bgCv.height = 512; { const g = bgCv.getContext('2d'); const gr = g.createRadialGradient(235, 205, 10, 256, 256, 360); gr.addColorStop(0, '#fafafa'); gr.addColorStop(.55, '#eeeeee'); gr.addColorStop(1, '#dedede'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const bgTex = new THREE.CanvasTexture(bgCv); bgTex.colorSpace = THREE.SRGBColorSpace;
  const ANGLES = [['frente', 0], ['espalda', Math.PI], ['perfil', -Math.PI / 2], ['3-4', -0.6]];
  async function renderSet({ w = isMobile ? 1080 : 1600, h = isMobile ? 1260 : 1866, angles = ANGLES, transparent = false, zoom = 1, pitch = 0.08, dist = 0, cy = null } = {}) {
    await ready;
    if (printFontsReady) await printFontsReady;
    if (tweening) rebuild(false);
    clearTimeout(paintTimer);
    paintTimer = 0;
    paintTextures();
    const ss = renderer.getContext().getContextAttributes().antialias ? 1 : 1.5;
    const prev = {
      yaw: spin.rotation.y,
      dpr: renderer.getPixelRatio(),
      zoom: view.zoom,
      pitch: view.pitch,
      shadowSize: key.shadow.mapSize.x,
      fit: fitMode,
      hover: hoverZ,
      contact: contact.visible,
    };
    const hi = [];
    const out = [];
    const downsample = ss === 1 ? null : document.createElement('canvas');
    running = false;
    try {
      hoverZ = flashZ = null;
      for (const {node, rest} of hangs) node.rotation.set(rest, 0, 0);
      product.rotation.z = clothVelocity = clothTilt = clothTurn = 0;
      applyHL();
      renderer.setPixelRatio(ss);
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      const shadowSize = isMobile || lowPower ? 2048 : 4096;
      key.shadow.mapSize.set(shadowSize, shadowSize);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      fitMode = null;
      scene.background = transparent ? null : bgTex;
      if (transparent) contact.visible = false;
      view.zoom = zoom;
      view.pitch = pitch;
      frame();
      if (dist) view.dist = dist;
      if (cy != null) view.center.set(0, cy, 0);
      if (downsample) {
        downsample.width = w;
        downsample.height = h;
      }
      const name = primaryPrint();
      const live = surfaces[name];
      if (canUseCloseupAtlas && live.canvas.width < 4096 && (Math.max(w, h) >= 1400 || closeupPrint(zoom))) {
        const detail = createSurface(name, 4096);
        hi.push({ detail, replaced: [], previous: live.texture });
        drawInto(() => detail, [name]);
        for (const material of Object.values(parts)) {
          if (material.map !== live.texture) continue;
          hi[0].replaced.push(material);
          material.map = detail.texture;
        }
      }
      for (const [name, angle] of angles) {
        spin.rotation.y = angle;
        if (flag) G.waveFlag(flag, 1.3);
        placeCam(true);
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, cam);
        if (downsample) {
          const context = downsample.getContext('2d');
          context.clearRect(0, 0, w, h);
          context.imageSmoothingQuality = 'high';
          context.drawImage(renderer.domElement, 0, 0, w, h);
        }
        out.push({ name, url: (downsample || renderer.domElement).toDataURL('image/png') });
        await nextFrame();
      }
    } finally {
      if (downsample) downsample.width = downsample.height = 0;
      for (const { detail, replaced, previous } of hi) {
        for (const material of replaced) {
          if (material.map === detail.texture) material.map = previous;
        }
        disposeSurface(detail);
      }
      scene.background = null;
      key.shadow.mapSize.set(prev.shadowSize, prev.shadowSize);
      key.shadow.map?.dispose();
      key.shadow.map = null;
      fitMode = prev.fit;
      hoverZ = prev.hover;
      contact.visible = prev.contact;
      applyHL();
      view.zoom = prev.zoom;
      view.pitch = prev.pitch;
      spin.rotation.y = prev.yaw;
      renderer.setPixelRatio(prev.dpr);
      resize();
      dirty = shadowDirty = running = true;
      renderer.shadowMap.needsUpdate = true;
      placeCam(true);
      renderer.render(scene, cam);
    }
    return out;
  }
  return {
    setFit(o) {
      fitMode = o;
      el.style.touchAction = o?.touch ? 'none' : 'pan-y';
      frame();
      view.snap = true;
      wake();
    },
    rebuild, repaint, renderSet, yaw: () => spin.rotation.y, ready, lowPower, stats: () => ({
      why: lastWhy, dpr, ema: Math.round(ema), frames: frameN, auto: view.auto,
      printAtlases: Object.fromEntries(Object.entries(surfaces).map(([name, { canvas }]) =>
        [name, [canvas.width, canvas.height]])),
    }),
    refreshPrintFonts() {
      for (const surface of Object.values(surfaces)) surface.key = null;
      repaint();
    },
    setYaw(angle) {
      wake();
      view.auto = false;
      vel = 0;
      const current = spin.rotation.y;
      const delta = Math.atan2(Math.sin(angle - current), Math.cos(angle - current));
      view.targetYaw = current + delta;
      if (reduceMotion) spin.rotation.y = view.targetYaw;
      emit();
    },
    zoomBy(factor) { setZoom(view.zoom * factor); },
    resetView() { setZoom(1); view.pitch = 0.09; this.setYaw(-0.6); },
    toggleAuto() { view.auto = !view.auto; vel = 0; wake(); emit(); return view.auto; },
    onView(listener) { listeners.push(listener); listener(view); }, view, renderer,
    onZonePick(callback) { zoneCb = callback; }, setZones(callback) { zonesFn = callback; },
    highlight(zone, flash) {
      if (zone && flash && !reduceMotion) {
        flashZ = zone;
        flashT0 = performance.now();
      } else {
        flashZ = null;
      }
      if (flash) { vel = 0; view.auto = false; emit(); }
      applyHL();
      wake();
    },
    pickAt: (x, y) => pick(x, y), zoneScreenPoint(z) { const ms = []; product.traverse(o => { if (o.isMesh && zoneMats(z).includes(o.material)) ms.push(o); }); if (!ms.length) return null; const r = el.getBoundingClientRect();
      for (let i = 0; i < 400; i++) { const x = r.left + r.width * (0.06 + 0.88 * ((0.5 + i * 0.7548777) % 1)), y = r.top + r.height * (0.06 + 0.88 * ((0.5 + i * 0.5698403) % 1)); if (pick(x, y) === z) return { x, y }; } return null; },
  };
}
