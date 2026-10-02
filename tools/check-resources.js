'use strict';
// No dependencies: inspect the actual exported buffers, not just the manifest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../assets/own/resources');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const expected = ['stone_A', 'stone_B', 'stone_C', 'stone_D', 'stone_E', 'coal', 'ironore', 'goldore'];
if (!process.argv.includes('--representative')) assert.deepEqual(manifest.assets.map(a => a.name), expected);
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const readers = { 5121: ['readUInt8', 1], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4], 5126: ['readFloatLE', 4] };
for (const asset of manifest.assets) {
  const file = fs.readFileSync(path.join(dir, asset.file));
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonSize = file.readUInt32LE(12);
  assert.equal(file.readUInt32LE(16), 0x4e4f534a);
  const gltf = JSON.parse(file.subarray(20, 20 + jsonSize).toString());
  const binaryStart = 20 + jsonSize;
  assert.equal(file.readUInt32LE(binaryStart + 4), 0x004e4942);
  const binary = file.subarray(binaryStart + 8);
  assert.equal(gltf.buffers.length, 1);
  assert.equal(gltf.buffers[0].uri, undefined, 'GLB must be self-contained');
  assert.equal(gltf.images, undefined, 'palette must not depend on textures');
  assert.equal(gltf.nodes.length, 1, 'presentation must not enter export');
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.meshes[0].primitives.length, 1, 'one primitive for instancing');
  const node = gltf.nodes[0];
  assert.deepEqual(node.translation || [0, 0, 0], [0, 0, 0]);
  assert.deepEqual(node.scale || [1, 1, 1], [1, 1, 1]);
  assert.deepEqual(node.rotation || [0, 0, 0, 1], [0, 0, 0, 1]);
  const read = id => {
    const a = gltf.accessors[id], view = gltf.bufferViews[a.bufferView];
    assert(!a.sparse);
    const [method, bytes] = readers[a.componentType];
    const width = widths[a.type], stride = view.byteStride || width * bytes;
    const start = (view.byteOffset || 0) + (a.byteOffset || 0);
    assert(start + (a.count - 1) * stride + width * bytes <= binary.length);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: width }, (_, j) => binary[method](start + i * stride + j * bytes)));
  };
  const p = gltf.meshes[0].primitives[0];
  assert.equal(p.mode === undefined ? 4 : p.mode, 4);
  assert('COLOR_0' in p.attributes && 'NORMAL' in p.attributes);
  const positions = read(p.attributes.POSITION), colors = read(p.attributes.COLOR_0), normals = read(p.attributes.NORMAL);
  const indices = read(p.indices).flat();
  assert.equal(indices.length / 3, asset.triangles);
  assert(asset.triangles < 1800);
  assert.equal(colors.length, positions.length);
  assert(positions.flat().every(Number.isFinite));
  assert(colors.flat().every(Number.isFinite));
  assert(new Set(colors.map(c => c.join(','))).size >= 3, 'palette lost');
  if (asset.name === 'coal') {
    const accessor = gltf.accessors[p.attributes.COLOR_0];
    const divisor = accessor.normalized ? (accessor.componentType === 5121 ? 255 : 65535) : 1;
    const luminance = colors.map(c => (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) / divisor);
    assert(luminance.reduce((sum, value) => sum + value, 0) / luminance.length < .03, 'coal became a pale host rock');
    assert(luminance.filter(value => value < .06).length / luminance.length > .95, 'coal must read as a dark mass');
    assert(colors.every(c => (Math.max(...c.slice(0, 3)) - Math.min(...c.slice(0, 3))) / divisor < .025), 'coal palette must remain near neutral');
    const material = gltf.materials[p.material];
    assert(material.pbrMetallicRoughness.roughnessFactor >= .4 && material.pbrMetallicRoughness.roughnessFactor < .65, 'coal should have restrained sheen');
  }
  assert(Math.abs(Math.min(...positions.map(p => p[1]))) < 1e-6, 'Y-up ground pivot');
  assert(Math.max(...positions.map(p => p[1])) > .1);
  for (const n of normals) assert(Math.abs(Math.hypot(...n) - 1) < .0001);
  for (let i = 0; i < indices.length; i += 3) {
    const abc = indices.slice(i, i + 3);
    assert(abc.every(idx => idx >= 0 && idx < positions.length));
    const [a, b, c] = abc.map(idx => positions[idx]);
    const u = b.map((v, j) => v - a[j]), v = c.map((w, j) => w - a[j]);
    assert(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 1e-10, 'degenerate triangle');
  }
  console.log(`${asset.name}: ${asset.triangles} triangles, ${file.length} bytes, palette/normals/pivot OK`);
}
const png = fs.readFileSync(path.join(dir, 'resources-preview.png'));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16), 1600);
assert.equal(png.readUInt32BE(20), 1000);
assert(fs.statSync(path.join(dir, 'resources.blend')).size > 10000);
const coalPreview = fs.readFileSync(path.join(dir, 'coal-preview.png'));
assert.equal(coalPreview.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(coalPreview.readUInt32BE(16), 1600);
assert.equal(coalPreview.readUInt32BE(20), 1000);
const screenshotPath = path.join(dir, 'resources-in-game-close.png');
if (fs.existsSync(screenshotPath)) {
  const screenshot = fs.readFileSync(screenshotPath);
  assert.equal(screenshot.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(screenshot.readUInt32BE(16), 1600);
  assert.equal(screenshot.readUInt32BE(20), 1000);
  console.log('Screenshot PNG: 1600 x 1000 (file structure only; no visual inspection)');
}
console.log('PASS: exports and preview file structure');
