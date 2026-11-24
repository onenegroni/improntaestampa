import * as THREE from '../vendor/three.module.min.js';
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js';
import asset from './tee.im3d';

// Blender-baked cut panels. The fit, gravity folds, turned openings, and seam
// allowances are static. Only the configurator's ink and material maps change.
const segmentNames = ['torso', 'sleeve', 'punos', 'bodyThread', 'sleeveThread'];
const vertexBytes = 14;
let panels;

function decode() {
  const bytes = unzlibSync(asset);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.getUint32(0) !== 0x49543032) throw new Error('Invalid fitted tee asset');
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
    if (name !== 'torso' && name !== 'sleeve') continue;
    const inside = position.map((coordinate, i) => coordinate - normal[i] * .00128);
    const facing = {
      ...panel,
      name: name === 'sleeve' ? 'sleeveFacing' : 'facing',
      attributes: { ...attributes, position: new THREE.BufferAttribute(inside, 3) },
    };
    decoded.push(facing);
  }
  return decoded;
}

export function fittedTeeParts() {
  if (!panels) panels = decode();
  return panels.map(({ name, attributes, index }) => {
    const geometry = new THREE.BufferGeometry();
    for (const [attribute, data] of Object.entries(attributes)) geometry.setAttribute(attribute, data);
    geometry.setIndex(index);
    return { name, geometry };
  });
}
