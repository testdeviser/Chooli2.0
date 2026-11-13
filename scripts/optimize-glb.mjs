// Compresses the GLBs written by the Blender scripts (meshopt + quantisation).
//   node scripts/optimize-glb.mjs
// .cache/mountain.raw.glb / .cache/mountain-lite.raw.glb  ->  mountain.glb / mountain-lite.glb
// character.glb is left untouched (skinned + animated, already small).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { statSync, existsSync } from 'node:fs';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

for (const name of ['mountain', 'mountain-lite']) {
  const src = `.cache/${name}.raw.glb`;
  const out = `public/models/${name}.glb`;
  if (!existsSync(src)) { console.warn('skip (missing)', src); continue; }
  const doc = await io.read(src);
  await doc.transform(
    dedup(),
    weld(),
    prune({ keepAttributes: true }), // UVs are used by the textures applied at runtime
    // 14-bit positions keep sub-millimetre accuracy on an 11.5 m scan
    meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
  );
  await io.write(out, doc);
  const mb = (p) => (statSync(p).size / 1e6).toFixed(2) + ' MB';
  console.log(`${name}: ${mb(src)} -> ${mb(out)}`);
}
