import * as THREE from '../vendor/three.module.min.js';
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js';
import tee from './tee.im3d';
import kit from './kit.im3d';
import tank from './tank.im3d';
import hoodie from './hoodie.im3d';
import shorts from './shorts.im3d';

// Blender-baked cut panels. The fit, gravity folds, turned openings, and seam
// allowances are static. Only the configurator's ink and material maps change.
const top = ['torso', 'sleeve', 'punos', 'bodyThread', 'sleeveThread'];
const assets = {
  tee: [tee, top],
  kit: [kit, top],
  tank: [tank, top],
  hoodie: [hoodie, ['torso', 'sleeve', 'punos', 'hood', 'neckTape', 'zipMetal', 'cord', 'bodyThread']],
  shorts: [shorts, ['short', 'shortPlain', 'punos', 'cord', 'shortThread']],
};
const insideNames = {
  torso: 'facing', sleeve: 'sleeveFacing', hood: 'lining',
  short: 'shortFacing', shortPlain: 'shortFacing',
};
const vertexBytes = 14;
const cache = new Map();

function decode(kind) {
  const [asset, segmentNames] = assets[kind];
  const bytes = unzlibSync(asset);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.getUint32(0) !== 0x49543032) throw new Error('Invalid fitted garment asset');
  let offset = 4;
  const decoded = [];
  for (const name of segmentNames) {
    const vertices = data.getUint32(offset, true);
    const indexCount = data.getUint32(offset + 4, true);
    offset += 8;
    const position = new Float32Array(vertices * 3);
    const normal = new Float32Array(vertices * 3);
    const color = new Float32Array(vertices * 3);
    const uv = new Float32Array(vertices * 2);
    for (let i = 0; i < vertices; i++, offset += vertexBytes) {
      const xyz = i * 3;
      const ambient = data.getUint8(offset + 9) / 255;
      for (let axis = 0; axis < 3; axis++) {
        position[xyz + axis] = data.getInt16(offset + axis * 2, true) / 16000;
        normal[xyz + axis] = data.getInt8(offset + 6 + axis) / 127;
        color[xyz + axis] = ambient;
      }
      uv[i * 2] = data.getUint16(offset + 10, true) / 65535;
      uv[i * 2 + 1] = data.getUint16(offset + 12, true) / 65535;
    }
    if (!indexCount) continue;
    const index = new Uint16Array(indexCount);
    for (let i = 0; i < index.length; i++, offset += 2) index[i] = data.getUint16(offset, true);
    const attributes = {
      position: new THREE.BufferAttribute(position, 3),
      normal: new THREE.BufferAttribute(normal, 3),
      color: new THREE.BufferAttribute(color, 3),
      uv: new THREE.BufferAttribute(uv, 2),
    };
    const panel = { name, attributes, index: new THREE.BufferAttribute(index, 1) };
    decoded.push(panel);
    const insideName = insideNames[name];
    if (!insideName) continue;
    const thickness = kind === 'hoodie' ? .00225 : .00135;
    const inside = position.map((coordinate, i) => coordinate - normal[i] * thickness);
    const facing = {
      ...panel,
      name: insideName,
      attributes: { ...attributes, position: new THREE.BufferAttribute(inside, 3) },
    };
    decoded.push(facing);
  }
  return decoded;
}

export function fittedParts(kind) {
  if (!cache.has(kind)) cache.set(kind, decode(kind));
  return cache.get(kind).map(({ name, attributes, index }) => {
    const geometry = new THREE.BufferGeometry();
    for (const [attribute, data] of Object.entries(attributes)) geometry.setAttribute(attribute, data);
    geometry.setIndex(index);
    return { name, geometry };
  });
}
