// Gus, as generated on Meshy -> public/models/gus-new.glb
//
//   node scripts/gus-new/convert.mjs
//
// The model is Meshy's own export, kept as-is (mesh, SmartRig skeleton, baked PBR material):
//   Gus-Crosed-Arms-Pose.glb   mesh + skeleton + material + its loop     -> "CrossArms"
//   Walking/Walking-new.glb    same model, Meshy's in-place walk          -> "Walk" (stride measured)
// Standing pose, retargeted from Mixamo onto that skeleton:
//   Waving/Waving.fbx          first frame only (standing, arms down)    -> "Idle"
//                              (fingers taken from the walk's first frame: Mixamo only has
//                               thumb + index, the other fingers would stay stiff)
// Textures are reduced from 4K PNG to 2K JPEG and the file is meshopt-compressed.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const SRC = 'assets/gus-new';
const MODEL = `${SRC}/Gus-Crosed-Arms-Pose.glb`;
const WALK = `${SRC}/Walking/Walking-new.glb`;
const OUT = 'public/models/gus-new.glb';
const TEX_PX = 2048;
const FPS = 30;

THREE.TextureLoader.prototype.load = () => new THREE.Texture(); // FBX textures are not needed

const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const loadFbx = (p) => new FBXLoader().parse(toArrayBuffer(readFileSync(p)), '');

// --- Mixamo source: standing pose -----------------------------------------------------------
const waveScene = loadFbx(`${SRC}/Waving/Waving.fbx`);
// Idle: the wave's first frame (Gus standing with his arms down)
const idle = new THREE.AnimationClip(
  'Idle',
  1,
  waveScene.animations[0].tracks.map((tr) => {
    const s = tr.getValueSize();
    const first = Array.from(tr.values.slice(0, s));
    return new tr.constructor(tr.name, [0, 1], [...first, ...first]);
  }),
);

// --- target: Meshy's skeleton (images stripped: GLTFLoader cannot decode them in Node) ----
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
async function loadBare(path) {
  const d = await io.read(path);
  d.getRoot().listTextures().forEach((t) => t.dispose());
  const bin = await io.writeBinary(d);
  return new GLTFLoader().parseAsync(toArrayBuffer(bin), '');
}
const target = (await loadBare(MODEL)).scene;

// Meshy SmartRig bone -> Mixamo bone (without the "mixamorig" prefix)
const MAP = {
  Hips: 'Hips', Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', neck: 'Neck', Head: 'Head',
  LeftUpLeg: 'LeftUpLeg', LeftLeg: 'LeftLeg', LeftFoot: 'LeftFoot', LeftToeBase: 'LeftToeBase',
  RightUpLeg: 'RightUpLeg', RightLeg: 'RightLeg', RightFoot: 'RightFoot', RightToeBase: 'RightToeBase',
};
for (const s of ['Left', 'Right']) {
  for (const b of ['Shoulder', 'Arm', 'ForeArm', 'Hand']) MAP[s + b] = s + b;
  for (const f of ['Thumb', 'Index']) for (const i of [1, 2, 3]) MAP[`${s}Hand${f}${i}`] = `${s}Hand${f}${i}`;
}

const wp = (o) => o.getWorldPosition(new THREE.Vector3());

// source units (FBX cm) -> target units (m), from the two bodies' heights
const meshHeight = (scene) => {
  // skinned vertices in the bind pose, in world units
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const saved = o.skeleton.bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
    o.skeleton.pose();
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 5) box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld));
    o.skeleton.bones.forEach((b, i) => { b.position.copy(saved[i][0]); b.quaternion.copy(saved[i][1]); b.scale.copy(saved[i][2]); });
    scene.updateMatrixWorld(true);
  });
  return box.max.y - box.min.y;
};
const targetHeight = meshHeight(target);
const unit = targetHeight / meshHeight(waveScene);
const depth = (o) => { let k = 0; while (o.parent) { o = o.parent; k++; } return k; };

/**
 * Retargets a Mixamo clip (played on `srcScene`) onto the Meshy skeleton. Each source bone's
 * world rotation change from its rest is applied to the matching target bone, after a small
 * correction lining up the two rests' bone directions (both rigs are T-posed on the same body).
 * The hips follow the source's horizontal sway; their height keeps the lower foot on the ground.
 * Returns plain tracks: { node, path, times, values }.
 */
function retarget(srcScene, clip) {
  srcScene.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
  const pairs = [];
  for (const [tn, sn] of Object.entries(MAP)) {
    const t = target.getObjectByName(tn);
    const s = srcScene.getObjectByName('mixamorig' + sn);
    if (s && t) pairs.push({ s, t });
  }
  const srcSet = new Set(pairs.map((p) => p.s));
  const tgtSet = new Set(pairs.map((p) => p.t));
  const mappedTargets = new Map(pairs.map((p) => [p.t, p]));
  for (const p of pairs) {
    p.sRest = p.s.getWorldQuaternion(new THREE.Quaternion());
    p.tRest = p.t.getWorldQuaternion(new THREE.Quaternion());
    p.tLocalRest = p.t.quaternion.clone();
    p.tParentW = p.t.parent.getWorldQuaternion(new THREE.Quaternion());
    p.align = new THREE.Quaternion();
    const sc = p.s.children.find((c) => srcSet.has(c));
    const tc = p.t.children.find((c) => tgtSet.has(c));
    if (sc && tc) p.align.setFromUnitVectors(wp(tc).sub(wp(p.t)).normalize(), wp(sc).sub(wp(p.s)).normalize());
  }
  pairs.sort((a, b) => depth(a.t) - depth(b.t));
  const hips = pairs.find((p) => p.t.name === 'Hips');
  const tHipsRest = hips.t.position.clone();
  const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((nm) => target.getObjectByName(nm));
  const restFootY = Math.min(...feet.map((f) => wp(f).y));

  const mixer = new THREE.AnimationMixer(srcScene);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  srcScene.updateMatrixWorld(true);
  const sHipsRef = wp(hips.s);

  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = [];
  const rot = new Map(pairs.map((p) => [p, []]));
  const pos = [];
  const tW = new Map();
  const D = new THREE.Quaternion(), q = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    const time = Math.min(clip.duration, f / FPS);
    times.push(time);
    mixer.setTime(time);
    srcScene.updateMatrixWorld(true);
    tW.clear();
    for (const p of pairs) {
      p.s.getWorldQuaternion(D).multiply(p.sRest.clone().invert());
      const world = D.clone().multiply(p.align).multiply(p.tRest);
      tW.set(p.t, world);
      const parentW = mappedTargets.has(p.t.parent) ? tW.get(p.t.parent) : p.tParentW;
      q.copy(parentW).invert().multiply(world);
      rot.get(p).push(q.x, q.y, q.z, q.w);
      p.t.quaternion.copy(q); // posed now, for the foot check below
    }
    const off = wp(hips.s).sub(sHipsRef).multiplyScalar(unit);
    hips.t.position.set(tHipsRest.x + off.x, tHipsRest.y, tHipsRest.z + off.z);
    target.updateMatrixWorld(true);
    hips.t.position.y -= Math.min(...feet.map((ft) => wp(ft).y)) - restFootY;
    pos.push(hips.t.position.x, hips.t.position.y, hips.t.position.z);
  }
  // back to rest for the next clip
  for (const p of pairs) p.t.quaternion.copy(p.tLocalRest);
  hips.t.position.copy(tHipsRest);
  target.updateMatrixWorld(true);
  mixer.stopAllAction();

  const tracks = pairs.map((p) => ({ node: p.t.name, path: 'rotation', times, values: rot.get(p) }));
  tracks.push({ node: 'Hips', path: 'translation', times, values: pos });
  return tracks;
}

// --- Walk: Meshy's own clip, copied as-is ---------------------------------------------------
const walkDoc = await io.read(WALK);
const walkAnim = walkDoc.getRoot().listAnimations()[0];
const walkTracks = walkAnim.listChannels().map((c) => ({
  node: c.getTargetNode().getName(),
  path: c.getTargetPath(),
  times: Array.from(c.getSampler().getInput().getArray()),
  values: Array.from(c.getSampler().getOutput().getArray()),
}));

// stride: how far the planted foot slides back per cycle = ground covered per cycle
const walkGltf = await loadBare(WALK);
const ws = walkGltf.scene;
const wclip = walkGltf.animations[0];
const wmixer = new THREE.AnimationMixer(ws);
wmixer.clipAction(wclip).play();
let stride = 0;
for (const foot of ['LeftToeBase', 'RightToeBase']) {
  const bone = ws.getObjectByName(foot);
  const N = 120;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    wmixer.setTime((i / N) * wclip.duration);
    ws.updateMatrixWorld(true);
    samples.push(wp(bone));
  }
  const minY = Math.min(...samples.map((v) => v.y));
  // contact = within 1.5 cm of the lowest point; sum the backward slide while planted
  let slide = 0, planted = 0;
  for (let i = 1; i <= N; i++) {
    if (samples[i].y - minY < 0.015 && samples[i - 1].y - minY < 0.015) {
      slide += samples[i - 1].z - samples[i].z;
      planted++;
    }
  }
  // the foot is planted for part of the cycle; scale its speed to the whole cycle
  stride += planted ? (slide / planted) * N : 0;
}
stride /= 2;

// --- Idle: Mixamo standing pose + relaxed fingers from the walk -----------------------------
const idleTracks = retarget(waveScene, idle);
const isFinger = (nm) => /Hand(Thumb|Index|Middle|Ring|Pinky)\d/.test(nm) && !nm.startsWith('mixamorig');
const fingerRest = walkTracks.filter((t) => t.path === 'rotation' && isFinger(t.node));
const idleOut = idleTracks.filter((t) => !isFinger(t.node));
for (const t of fingerRest) {
  const q0 = t.values.slice(0, 4);
  idleOut.push({ node: t.node, path: 'rotation', times: idleTracks[0].times, values: idleTracks[0].times.flatMap(() => q0) });
}

// --- output: Meshy's file + the new clips ------------------------------------------------
const doc = await io.read(MODEL);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const nodeByName = new Map(root.listNodes().map((nd) => [nd.getName(), nd]));

const meshyClip = root.listAnimations()[0];
meshyClip.setName('CrossArms');

function addClip(name, tracks) {
  const anim = doc.createAnimation(name);
  const inputs = new Map();
  for (const t of tracks) {
    const node = nodeByName.get(t.node);
    if (!node) continue;
    let input = inputs.get(t.times);
    if (!input) {
      input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(t.times)).setBuffer(buffer);
      inputs.set(t.times, input);
    }
    const output = doc
      .createAccessor()
      .setType(t.path === 'rotation' ? 'VEC4' : 'VEC3')
      .setArray(new Float32Array(t.values))
      .setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath(t.path).setSampler(sampler);
    anim.addSampler(sampler).addChannel(channel);
  }
}
addClip('Idle', idleOut);
addClip('Walk', walkTracks);

// 4K PNG -> 2K JPEG (the normal map keeps a higher quality)
for (const tex of root.listTextures()) {
  const isNormal = /normal/i.test(tex.getName());
  const jpg = await sharp(Buffer.from(tex.getImage()))
    .resize(TEX_PX, TEX_PX)
    .jpeg({ quality: isNormal ? 92 : 86, mozjpeg: true })
    .toBuffer();
  tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg').setURI('');
}

await doc.transform(dedup(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(OUT, doc);

const meta = {
  source: MODEL,
  clips: Object.fromEntries(root.listAnimations().map((a) => {
    let d = 0;
    a.listSamplers().forEach((s) => { const arr = s.getInput().getArray(); d = Math.max(d, arr[arr.length - 1] - arr[0]); });
    return [a.getName(), +d.toFixed(4)];
  })),
  stride: +stride.toFixed(4),
  height: +targetHeight.toFixed(3),
  unit: +unit.toFixed(6),
  glbBytes: statSync(OUT).size,
};
writeFileSync(OUT.replace(/\.glb$/, '.meta.json'), JSON.stringify(meta, null, 2));
console.log(meta);
