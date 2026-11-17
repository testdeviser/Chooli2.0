// New Gus (Meshy "Forest Guardian", rigged on Mixamo) -> public/models/gus-new.glb
//
//   node scripts/gus-new/convert.mjs
//
// Inputs (assets/gus-new/):
//   Walking/Walking.fbx  skinned mesh + Mixamo walk   -> "Walk" (made in-place, stride measured)
//   Waving/Waving.fbx    same rig + wave              -> "Wave" (the "It's me, Gus." gesture)
//   Walking/Walking.glb  static mesh with the 4K texture (the FBX only references it by path)
// "Idle" is the first frame of the wave (Gus standing, arms down).
// The result is scaled to metres, textured with a 2K JPEG and meshopt-compressed.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const SRC = 'assets/gus-new';
const OUT = 'public/models/gus-new.glb';
const TEX_PX = 2048;

// --- minimal browser shims for the three.js loader / exporter ------------------------
// textures are attached afterwards with gltf-transform, so the FBX's (missing) image is skipped
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,` + Buffer.from(b).toString('base64');
      this.onloadend?.();
    });
  }
};

const loadFbx = (p) => {
  const buf = readFileSync(p);
  return new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
};

const walkScene = loadFbx(`${SRC}/Walking/Walking.fbx`);
const waveScene = loadFbx(`${SRC}/Waving/Waving.fbx`);
const walkSrc = walkScene.animations[0];
const waveSrc = waveScene.animations[0];
if (!walkSrc || !waveSrc) throw new Error('missing animation in an FBX');

const HIPS = 'mixamorigHips';
const hipsPos = (clip) => clip.tracks.find((t) => t.name === `${HIPS}.position`);

// --- Walk: remove forward travel so the site can scrub it in place --------------------
const walk = walkSrc.clone();
walk.name = 'Walk';
const wp = hipsPos(walk);
if (!wp) throw new Error('walk has no hips position track');
const n = wp.times.length;
const v = wp.values;
const dx = v[(n - 1) * 3] - v[0];
const dz = v[(n - 1) * 3 + 2] - v[2];
// travel per clip (FBX units = cm); one Mixamo walk clip = one full cycle (two steps)
const travel = Math.hypot(dx, dz);
for (let i = 0; i < n; i++) {
  const t = i / (n - 1);
  v[i * 3] -= dx * t;
  v[i * 3 + 2] -= dz * t;
}
// the last frame repeats the first: drop it so the cycle loops without a hitch
walk.tracks.forEach((tr) => {
  if (tr.times.length < 3) return; // constant tracks (one or two keys) stay as they are
  const size = tr.getValueSize();
  tr.times = tr.times.slice(0, -1);
  tr.values = tr.values.slice(0, tr.values.length - size);
});
walk.resetDuration();

// --- Wave + Idle ---------------------------------------------------------------------
const wave = waveSrc.clone();
wave.name = 'Wave';
// keep him on the spot during the wave too (only small sways, but no drift)
const vp = hipsPos(wave);
if (vp) {
  const x0 = vp.values[0], z0 = vp.values[2];
  for (let i = 0; i < vp.times.length; i++) {
    vp.values[i * 3] = x0;
    vp.values[i * 3 + 2] = z0;
  }
}
const idle = new THREE.AnimationClip(
  'Idle',
  1,
  wave.tracks.map((tr) => {
    const s = tr.getValueSize();
    const first = Array.from(tr.values.slice(0, s));
    const Track = tr.constructor;
    return new Track(tr.name, [0, 1], [...first, ...first]);
  }),
);

// --- model: the walking scene's skinned mesh, in metres ------------------------------
const root = new THREE.Group();
root.name = 'GusNew';
walkScene.scale.setScalar(0.01);
walkScene.name = 'GusRig';
root.add(walkScene);
root.updateMatrixWorld(true);
walkScene.traverse((o) => {
  if (o.isMesh) {
    o.material = new THREE.MeshStandardMaterial({ name: 'GusSkin', roughness: 0.9, metalness: 0 });
  }
});

// height from the skinned mesh in its rest pose
const box = new THREE.Box3();
walkScene.traverse((o) => {
  if (o.isSkinnedMesh) {
    o.skeleton.pose();
    const pos = o.geometry.attributes.position;
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 7) {
      o.getVertexPosition(i, p);
      p.applyMatrix4(o.matrixWorld);
      box.expandByPoint(p);
    }
  }
});
const height = box.max.y - box.min.y;
const stride = travel * 0.01;

const exported = await new GLTFExporter().parseAsync(root, {
  binary: true,
  animations: [idle, walk, wave],
  onlyVisible: false,
});

// --- texture + compression ------------------------------------------------------------
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const texDoc = await io.read(`${SRC}/Walking/Walking.glb`);
const srcImage = texDoc.getRoot().listTextures()[0].getImage();
const jpeg = await sharp(Buffer.from(srcImage)).resize(TEX_PX, TEX_PX).jpeg({ quality: 86, mozjpeg: true }).toBuffer();

const doc = await io.readBinary(new Uint8Array(exported));
const tex = doc.createTexture('GusSkin').setImage(new Uint8Array(jpeg)).setMimeType('image/jpeg');
doc.getRoot().listMaterials().forEach((m) => m.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]));
await doc.transform(
  dedup(),
  prune({ keepAttributes: true }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(OUT, doc);

const meta = {
  clips: { Idle: idle.duration, Walk: +walk.duration.toFixed(4), Wave: +wave.duration.toFixed(4) },
  stride: +stride.toFixed(4),
  height: +height.toFixed(3),
  minY: +box.min.y.toFixed(3),
  bones: walkScene.getObjectByProperty('type', 'SkinnedMesh')?.skeleton.bones.length,
  glbBytes: statSync(OUT).size,
};
writeFileSync(OUT.replace(/\.glb$/, '.meta.json'), JSON.stringify(meta, null, 2));
console.log(meta);
