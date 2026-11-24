// Impronta 3D configurator: scene, products, interaction, renders.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import * as G from './garments.js';
import * as T from './textures.js';

const TEX = { visor: [768, 384], torso: [2048, 1024], sleeve: [1024, 512], hood: [1024, 512], short: [1024, 512], shortPlain: [1024, 512], flag: [2048, 1365], cap: [1024, 512] };
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

export function createConfigurator(canvasHost, state, { onReady, onError, onLost } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  const dprCap = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 1.5), dprMin = lowPower ? 0.6 : isMobile ? 1 : 0.75; // phones: crisp 2x live view
  let dpr = lowPower ? Math.min(0.75, dprCap) : dprCap;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  const key = new THREE.DirectionalLight(0xfff7ef, 2.17);
  key.position.set(-2.8, 3.7, 3.9);
  key.castShadow = true;
  const LIVE_SM = lowPower ? 512 : 1024;
  key.shadow.mapSize.set(LIVE_SM, LIVE_SM);
  Object.assign(key.shadow.camera, { left: -1.15, right: 1.15, top: 1.15, bottom: -1.15, near: 0.5, far: 8 });
  key.shadow.radius = 5;
  key.shadow.bias = -.00021;
  key.shadow.normalBias = .0044;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf4f7ff, 1.04);
  rim.position.set(1.8, 1.55, -2.6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfffcf6, .52);
  fill.position.set(2.2, 0.5, 2);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xf8f7f2, 0x8b8374, .40));

  const spin = new THREE.Group(); scene.add(spin);
  const anim = new THREE.Group(); spin.add(anim);
  const product = new THREE.Group(); anim.add(product);
  const stand = new THREE.Group(); anim.add(stand);
  const darkM = new THREE.MeshStandardMaterial({ color: 0x262823, roughness: 0.65, metalness: 0.1 });

  const fabrics = {
    deportiva: { normal: T.knitNormal(192, 'mesh'), repeat: [13, 8], roughness: 0.86, sheen: 0.20, sheenRoughness: 0.77, normalScale: 0.34, spec: 0.19 },
    modal: { normal: T.knitNormal(192, 'jersey'), repeat: [13, 8], roughness: 0.91, sheen: 0.34, sheenRoughness: 0.87, normalScale: 0.34, spec: 0.15 },
    frizado: { normal: T.knitNormal(192, 'fleece'), repeat: [12, 7], roughness: 0.96, sheen: 0.28, sheenRoughness: 0.91, normalScale: 0.41, spec: 0.10 },
  };
  const finishKinds = { deportiva: 'mesh', modal: 'jersey', frizado: 'fleece' };
  for (const [key, fabric] of Object.entries(fabrics)) {
    fabric.kind = finishKinds[key];
    fabric.normal.repeat.set(...fabric.repeat);
    fabric.roughMap = T.fabricRoughness(fabric.kind, [12, 8]);
  }
  const twillRoughness = T.fabricRoughness('twill', [11, 7]);
  let capNet = null;
  const twill = T.knitNormal(160, 'twill'); twill.repeat.set(21, 11);
  const rib = T.knitNormal(128, 'rib'); rib.repeat.set(13, 2);
  const texes = {};
  const canvases = {};
  function mkTex(canvas, name) {
    const texture = new THREE.CanvasTexture(canvas);
    if (name === 'short' || name === 'shortPlain') texture.wrapS = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = lowPower ? 2 : 8;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  }
  function canvasFor(name) {
    if (!canvases[name]) {
      const canvas = document.createElement('canvas');
      [canvas.width, canvas.height] = TEX[name].map(size => lowPower && isMobile ? Math.round(size * .75) : size);
      canvases[name] = canvas;
      texes[name] = mkTex(canvas, name);
    }
    return canvases[name];
  }
  const NEEDS = { remera: ['torso', 'sleeve'], campera: ['torso', 'sleeve', 'hood'], conjunto: ['torso', 'sleeve', 'short', 'shortPlain'], musculosa: ['torso'], bandera: ['flag'], gorra: ['cap', 'visor'] };
  const temporaryMaterials = new Set();
  function own(material) { temporaryMaterials.add(material); return material; }
  function fabricMat(map, { ribbed = false, side = THREE.DoubleSide } = {}) {
    const f = fabrics[state.tela] || fabrics.deportiva;
    const values = { map, side, roughness: f.roughness, roughnessMap: f.roughMap, envMapIntensity: .56, vertexColors: true, normalMap: ribbed ? rib : f.normal, normalScale: new THREE.Vector2(f.normalScale, f.normalScale) };
    const m = own(lowPower
      ? new THREE.MeshStandardMaterial(values)
      : new THREE.MeshPhysicalMaterial({ ...values, sheen: f.sheen, sheenRoughness: f.sheenRoughness, sheenColor: new THREE.Color(0xc2bdb6), specularIntensity: f.spec }));
    return m;
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
  // Fitting marks are in scene units from the hem to the shoulder.
  // Tee cross sections adapt the MakeHuman system tee (CC0), fitted by CharacterCreator:
  // https://github.com/kblood/CharacterCreator/blob/master/LICENSE-NOTES.md
  const cuts = {
    remera: {
      width: [[-.34,.194],[-.236,.188],[-.139,.181],[-.043,.184],[.084,.197],[.205,.205]],
      frontDepth: [[-.34,.112],[-.23,.124],[-.075,.120],[.079,.113],[.205,.080]],
      backDepth: [[-.34,.114],[-.23,.094],[-.075,.084],[.079,.102],[.205,.080]],
      neckK: .35, neckKZ: .74, neckDrop: .056, slope: .23, wrinkle: 1.12,
    },
    conjunto: {
      width: [[-.34,.148],[-.266,.171],[-.196,.176],[-.062,.186],[.094,.205],[.205,.202]],
      frontDepth: [[-.34,.062],[-.256,.080],[-.18,.094],[.023,.111],[.126,.111],[.205,.076]],
      backDepth: [[-.34,.060],[-.263,.069],[-.17,.078],[.023,.093],[.126,.094],[.205,.068]],
      neckK: .35, neckKZ: .73, neckDrop: .062, slope: .26, wrinkle: .92,
    },
    musculosa: {
      width: [[-.34,.177],[-.246,.170],[-.100,.159],[.045,.180],[.144,.191],[.205,.193]],
      frontDepth: [[-.34,.056],[-.169,.067],[.026,.096],[.126,.097],[.205,.074]],
      backDepth: [[-.34,.051],[-.169,.064],[.026,.080],[.126,.082],[.205,.062]],
      neckK: .45, neckKZ: .76, neckDrop: .118, slope: .23, wrinkle: .92, tank: true,
    },
    campera: {
      width: [[-.34,.190],[-.276,.208],[-.172,.210],[-.038,.204],[.105,.217],[.205,.220]],
      frontDepth: [[-.34,.091],[-.25,.112],[-.09,.107],[.103,.116],[.205,.089]],
      backDepth: [[-.34,.103],[-.21,.101],[-.045,.102],[.107,.104],[.205,.085]],
      neckK: .42, neckKZ: .75, neckDrop: .056, slope: .26, wrinkle: .92, heavy: true,
    },
  };
  const tailoring = new Map();
  function getTailoring(kind) {
    if (tailoring.has(kind)) return tailoring.get(kind);
    const fn = G.torsoFn(cuts[kind]);
    const holes = [-1, 1].map(side => G.armhole(fn, side, { long: kind === 'campera', tank: kind === 'musculosa' }));
    const cut = {fn, holes};
    tailoring.set(kind, cut);
    return cut;
  }

  const hangs = [];
  const pullMetal = new THREE.MeshStandardMaterial({ color: 0x555453, metalness: .58, roughness: .31 });
  const zipTeeth = new THREE.MeshStandardMaterial({ color: 0x2a2928, metalness: .16, roughness: .52 });
  const strapMaterial = new THREE.MeshStandardMaterial({ color: 0x262622, roughness: .83, side: THREE.DoubleSide });
  const roughHardware = new THREE.MeshStandardMaterial({ color: 0xa3a29c, metalness: .69, roughness: .38 });
  const zipThread = new THREE.MeshStandardMaterial({ color: 0x44413e, roughness: .96, envMapIntensity: .24 });

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

  function buildTop(kind, yOff = 0) {
    const group = new THREE.Group();
    group.position.y = yOff;
    const tank = kind === 'musculosa', long = kind === 'campera';
    const { fn, holes } = getTailoring(kind);
    const cut = (u, v) => Math.min(holes[0].clip(u, v), holes[1].clip(u, v));
    const body = G.surface(lowPower ? 190 : 264, lowPower ? 132 : 174, fn, {
      wrapU: true,
      clip: cut,
      uvFn: fn.uv,
      shade: (u, v) => {
        const arm = Math.exp(-Math.max(0, cut(u, v)) * 4.6);
        const lowerArm = 1 - THREE.MathUtils.smoothstep(v, .68, .93);
        const lip = 1 - THREE.MathUtils.smoothstep(v, 0, .12);
        return 1 - (.048 + .094 * lowerArm) * arm - lip * .065;
      },
    });
    const bodyMaterial = parts.torso = fabricMat(texes.torso);
    if (tank) {
      bodyMaterial.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.57;');
      };
    }
    const trim = parts.punos = colorMat(state.colors.punos);
    const facing = parts.facing = fabricMat(null);
    group.add(mesh(body, bodyMaterial));
    for (const atNeck of [true, false]) {
      const inside = mesh(G.facing(fn, atNeck), facing);
      inside.castShadow = false;
      group.add(inside);
    }
    if (!long) group.add(mesh(G.collar(fn, { h: tank ? .008 : .017 }), trim));

    const bodySeams = holes.map(hole => hole.threadPath);
    const trimSeams = [];
    if (!long) {
      bodySeams.push(...[.026, .042].map(v => G.edgeSeam(fn, v)));
      bodySeams.push(G.edgeSeam(fn, .976));
    }
    if (tank) {
      for (const hole of holes) group.add(mesh(G.boundArmhole(hole), trim));
    } else {
      const sleeveMaterial = parts.sleeve = fabricMat(texes.sleeve);
      const sleeveSeams = [];
      for (const [i, side] of [-1, 1].entries()) {
        const arm = G.sleeve(side, holes[i], { long, sport: kind === 'conjunto' });
        group.add(mesh(arm.shell, sleeveMaterial), mesh(arm.trim, trim));
        sleeveSeams.push(arm.sleeveThread);
        trimSeams.push(arm.trimThread);
      }
      addThread(group, sleeveSeams, seamMaterial('sleeveThread'), { radius: .00042 });
    }

    if (long) {
      const hood = G.hood(fn);
      const hoodMaterial = parts.hood = fabricMat(texes.hood);
      const lining = parts.lining = fabricMat(null);
      const interior = mesh(hood.inner, lining);
      interior.castShadow = false;
      const seamTape = mesh(hood.insideSeam, lining);
      seamTape.castShadow = false;
      group.add(mesh(hood.outer, hoodMaterial), interior, seamTape, ...hood.edges.map(geo => mesh(geo, lining)));
      addThread(group, hood.crownThread, seamMaterial('hoodThread'), { pitch: .0036, radius: .00046 });
      const waistShape = (u, v) => {
        const point = fn(u, 0);
        const roll = .009 * Math.sin(v * Math.PI);
        const gather = .0040 * Math.cos(u * G.TAU * 30) * Math.sin(v * Math.PI) ** 2;
        const inset = .949 + .054 * v + roll + gather;
        return [point[0] * inset, point[1] - .048 + v * .050, point[2] * inset];
      };
      group.add(mesh(G.surface(160, 16, waistShape, {
        wrapU: true, shade: (u, v) => 1 - .13 * Math.pow(1 - v, 3),
      }), trim));
      trimSeams.push(G.edgeSeam(waistShape, .78));
      const zipper = G.zipperParts(fn);
      const tape = own(new THREE.MeshStandardMaterial({
        color: 0x1c1d1b, roughness: .93, normalMap: rib,
        normalScale: new THREE.Vector2(.25, .25), side: THREE.DoubleSide,
      }));
      group.add(mesh(zipper.tape, tape), mesh(zipper.teeth, zipTeeth));
      addThread(group, zipper.seams, zipThread, { pitch: .0034, radius: .00042 });
      const [x, y, z] = zipper.top;
      const slider = mesh(new THREE.BoxGeometry(.0095, .012, .005), pullMetal);
      slider.position.set(x, y - .005, z + .007);
      group.add(slider);
      const pull = mesh(G.zipperPull(), pullMetal);
      pull.position.set(x, y - .008, z + .011);
      pull.rotation.x = -.18;
      hangs.push({ node: pull, rest: -.18, strength: .12, phase: 0 });
      group.add(pull);
      const stop = mesh(new THREE.BoxGeometry(.008, .004, .004), zipTeeth);
      stop.position.set(zipper.bottom[0], zipper.bottom[1], zipper.bottom[2] + .004);
      group.add(stop);

      for (const side of [-1, 1]) {
        const pocket = G.pocket(fn, side);
        group.add(mesh(pocket.shell, bodyMaterial), mesh(pocket.edge, bodyMaterial));
        bodySeams.push(...pocket.stitches);
        const eyelet = new THREE.Vector3(...hood.eyelet(side));
        const ring = mesh(new THREE.TorusGeometry(.0040, .00092, 10, 24), roughHardware);
        ring.position.copy(eyelet).add(new THREE.Vector3(0, 0, .0016));
        ring.rotation.x = -.24;
        group.add(ring);

        // The grommet is the fixed pivot. The braiding and metal aglet move with the cord.
        const knot = new THREE.Group();
        knot.position.copy(eyelet);
        const length = .133 + side * .009;
        const end = new THREE.Vector3(side * .012, -length, .038);
        const cord = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, .001),
          new THREE.Vector3(side * -.008, -.032, .020),
          new THREE.Vector3(side * .008, -.077, .034),
          end,
        ]);
        const cordMaterial = parts.cord || (parts.cord = colorMat(state.colors.punos));
        const braided = new THREE.TubeGeometry(cord, 46, .00225, 10);
        knot.add(mesh(braided, cordMaterial));
        const tip = mesh(new THREE.CylinderGeometry(.00235, .00215, .013, 14), roughHardware);
        tip.position.copy(end).add(new THREE.Vector3(0, -.005, .0005));
        tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cord.getTangent(1).negate());
        knot.add(tip);
        hangs.push({ node: knot, rest: 0, strength: .16, phase: side * .32 });
        group.add(knot);
      }
    }
    addThread(group, bodySeams, seamMaterial('bodyThread'), { radius: .00043 });
    if (trimSeams.length) addThread(group, trimSeams, seamMaterial('trimThread'), { pitch: .0038 });
    return group;
  }

  function buildShort(yOff) {
    const garment = G.short();
    const group = new THREE.Group();
    group.position.y = yOff;
    const numbered = parts.short = fabricMat(texes.short);
    const plain = parts.shortPlain = fabricMat(texes.shortPlain);
    group.add(mesh(garment.top, plain), ...garment.left.shells.map(geo => mesh(geo, plain)));
    group.add(...garment.right.shells.map(geo => mesh(geo, numbered)), mesh(garment.band, parts.punos));
    addThread(group, [...garment.left.seam, ...garment.right.seam], parts.bodyThread, { radius: .00041 });
    return group;
  }

  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = contactCanvas.height = 128;
  const contactContext = contactCanvas.getContext('2d');
  const contactGradient = contactContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  contactGradient.addColorStop(0, 'rgba(38,31,27,.33)');
  contactGradient.addColorStop(.41, 'rgba(42,36,30,.14)');
  contactGradient.addColorStop(1, 'rgba(42,36,30,0)');
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
    product.rotation.set(0, 0, 0);
    product.position.set(0, 0, 0);
    paintTextures();
    if (P === 'remera' || P === 'musculosa' || P === 'campera') {
      product.add(buildTop(P));
    } else if (P === 'conjunto') {
      // The jersey tucks into the shorts with the elastic band in front.
      product.add(buildTop('conjunto', .20), buildShort(-.153));
    } else if (P === 'bandera') {
      const [width, height] = state.talle.split('×').map(parseFloat);
      const clothHeight = Math.min(.8, 1.2 * (height / width || .64));
      const geometry = G.flagGeo(1.2, clothHeight);
      const material = parts.flag = fabricMat(texes.flag);
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
      const crown = parts.cap = fabricMat(texes.cap);
      if (!lowPower) {
        capNet ||= T.truckerMeshMask();
        crown.alphaMap = capNet;
        crown.alphaTest = .43;
        crown.alphaToCoverage = true;
      }
      const visor = parts.visor = fabricMat(texes.visor);
      const trim = parts.punos = colorMat(state.colors.punos);
      cap.add(mesh(shape.crown, crown), mesh(shape.inner, strapMaterial), mesh(shape.band, trim), mesh(shape.button, trim));
      cap.add(mesh(shape.visorTop, visor), mesh(shape.visorBottom, visor), mesh(shape.visorEdge, visor));
      cap.add(mesh(shape.snaps, strapMaterial), ...shape.closure.map(geo => mesh(geo, strapMaterial)));
      const seams = seamMaterial('bodyThread');
      cap.add(...shape.vents.map(geo => mesh(geo, seams)));
      addThread(cap, shape.seams, seams, { pitch: .0021, radius: .00031 });
      addThread(cap, shape.brimThread, seamMaterial('sleeveThread'), { pitch: .0024, radius: .00032, normal: [0, 1, 0] });
      product.add(cap);
    }
    spin.updateMatrixWorld(true);
    const r0 = spin.rotation.y; spin.rotation.y = 0; anim.scale.setScalar(1); anim.position.y = 0; spin.updateMatrixWorld(true);
    bbox.setFromObject(anim);
    pbox.setFromObject(product);
    if (pbox.isEmpty() || P === 'bandera') pbox.copy(bbox);
    contact.position.y = pbox.min.y - (P === 'gorra' ? .010 : .023);
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
  function drawInto(get) {
    const st = state, P = st.producto, need = NEEDS[P] || [];
    if (need.includes('torso')) {
      T.torsoCanvas(get('torso'), st, { vOf, product: P });
    }
    if (need.includes('sleeve')) T.sleeveCanvas(get('sleeve'), st, { stripe: P !== 'campera' });
    if (need.includes('hood')) T.hoodCanvas(get('hood'), st);
    if (need.includes('short')) T.shortCanvas(get('short'), st, get('shortPlain'));
    if (need.includes('flag')) T.flagCanvas(get('flag'), st);
    if (need.includes('cap')) T.capCanvas(get('cap'), st, G.CAP_SEAMS);
    if (need.includes('visor')) T.plainCanvas(get('visor'), st, 'mangas');
    const fixed = P === 'gorra' || P === 'bandera';
    const weave = fixed ? 'twill' : (fabrics[st.tela] || fabrics.deportiva).kind;
    for (const name of need) {
      const canvas = get(name);
      T.applyWeave(canvas, weave, canvas.width / TEX[name][0]);
    }
    return need;
  }
  function matTargets() {
    const st = state, f = fabrics[st.tela] || fabrics.deportiva;
    const list = [];
    if (parts.punos) list.push([parts.punos.color, new THREE.Color(st.colors.punos)]);
    if (parts.cord) list.push([parts.cord.color, new THREE.Color(st.colors.punos)]);
    if (parts.lining) list.push([parts.lining.color, new THREE.Color(st.colors.capucha).lerp(new THREE.Color('#847d73'), .07).multiplyScalar(.77)]);
    if (parts.facing) list.push([parts.facing.color, new THREE.Color(st.colors.cuerpo).multiplyScalar(.71)]);
    const seamZones = { bodyThread: 'cuerpo', sleeveThread: 'mangas', trimThread: 'punos', hoodThread: 'capucha' };
    for (const [key, zone] of Object.entries(seamZones)) {
      if (!parts[key]) continue;
      const base = st.colors[zone];
      const color = new THREE.Color(base);
      if (T.lum(base) < .15) color.lerp(new THREE.Color('#a9a19b'), .25);
      else color.multiplyScalar(.66);
      list.push([parts[key].color, color]);
    }
    Object.values(parts).forEach(material => {
      if (!material.normalMap) return;
      const accessory = material === parts.cap || material === parts.visor || material === parts.flag;
      material.roughness = accessory ? .91 : f.roughness;
      material.roughnessMap = accessory ? twillRoughness : f.roughMap;
      if (material.isMeshPhysicalMaterial) {
        material.sheen = f.sheen;
        material.specularIntensity = f.spec;
        material.sheenRoughness = f.sheenRoughness;
      }
      if (material.normalMap !== rib) material.normalMap = accessory ? twill : f.normal;
      const grain = material === parts.flag ? .20 : material === parts.cap || material === parts.visor ? .30 : f.normalScale;
      material.normalScale.set(grain, grain);
    });
    return list;
  }
  let paintTimer = 0;
  function paintTextures() {
    for (const name of drawInto(canvasFor)) texes[name].needsUpdate = true;
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
  const HL = new THREE.Color(0xaab99f);
  function zoneMats(z) { const map = { cuerpo: ['torso', 'short', 'shortPlain', 'flag', 'cap', 'facing'], mangas: ['sleeve', 'visor'], capucha: ['hood', 'lining'], punos: ['punos', 'cord'] }; return (map[z] || []).map(k => parts[k]).filter(Boolean); }
  function zoneOf(mat) { for (const z of ['cuerpo', 'mangas', 'capucha', 'punos']) if (zoneMats(z).includes(mat)) return z; return null; }
  function pick(cx, cy) {
    const r = el.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    spin.updateMatrixWorld(true); cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam);
    const ok = zonesFn(); for (const h of ray.intersectObject(product, true)) { const z = zoneOf(h.object.material); if (z && ok.includes(z)) return z; if (!z) continue; }
    return null;
  }
  function applyHL() {
    const t = performance.now(); let fl = 0; if (flashZ) { const k = (t - flashT0) / 900; fl = k < 1 ? Math.sin(Math.min(1, k) * Math.PI) * 0.11 : 0; if (k >= 1) flashZ = null; }
    ['cuerpo', 'mangas', 'capucha', 'punos'].forEach(z => { const a = (z === hoverZ ? 0.025 : 0) + (z === flashZ ? fl : 0); zoneMats(z).forEach(m => { if (m.emissive) m.emissive.copy(HL).multiplyScalar(a); }); });
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
  function setZoom(z) { view.zoom = G.clamp(z, 0.8, 2.6); dirty = true; emit(); }
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
  const bgCv = document.createElement('canvas'); bgCv.width = 512; bgCv.height = 512; { const g = bgCv.getContext('2d'); const gr = g.createRadialGradient(235, 205, 10, 256, 256, 360); gr.addColorStop(0, '#faf8f6'); gr.addColorStop(.55, '#eeece9'); gr.addColorStop(1, '#dcd9d4'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const bgTex = new THREE.CanvasTexture(bgCv); bgTex.colorSpace = THREE.SRGBColorSpace;
  const ANGLES = [['frente', 0], ['espalda', Math.PI], ['perfil', -Math.PI / 2], ['3-4', -0.6]];
  async function renderSet({ w = isMobile ? 1080 : 1600, h = isMobile ? 1260 : 1866, angles = ANGLES, transparent = false, zoom = 1, pitch = 0.08, dist = 0, cy = null } = {}) {
    await ready;
    if (tweening) rebuild(false);
    clearTimeout(paintTimer);
    paintTimer = 0;
    paintTextures();
    const ss = lowPower ? 1.5 : 1;
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
      if (!isMobile && !lowPower) {
        const textures = {};
        drawInto(name => {
          if (!textures[name]) {
            const canvas = document.createElement('canvas');
            [canvas.width, canvas.height] = TEX[name].map(size => size * 2);
            textures[name] = canvas;
          }
          return textures[name];
        });
        Object.entries(textures).forEach(([name, canvas]) => {
          const material = parts[name];
          if (!material) return;
          const texture = mkTex(canvas, name);
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          hi.push([material, texture, material.map]);
          material.map = texture;
        });
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
      hi.forEach(([material, texture, previous]) => {
        material.map = previous;
        texture.dispose();
        texture.image.width = texture.image.height = 0;
      });
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
    rebuild, repaint, renderSet, yaw: () => spin.rotation.y, ready, lowPower, stats: () => ({ why: lastWhy, dpr, ema: Math.round(ema), frames: frameN, auto: view.auto }),
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
