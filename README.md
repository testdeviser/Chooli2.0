# Chooli 3D introduction prototype

One continuous, scroll-controlled 3D sequence for the Chooli Digital Marketing homepage:

**Wide mountain → camera moves in → character walks toward the viewer → "It's me, Gus." →
three-quarter camera orbit → About Chooli → static page.**

Stack: Next.js (App Router) · React · TypeScript · Three.js · React Three Fiber · Drei ·
GSAP ScrollTrigger · Tailwind CSS. Assets are prepared with Blender Python.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and scroll. For the optimised build:

```bash
npm run build
npm run start
```

## Source assets (read-only)

| File | Used for |
| --- | --- |
| `assets/mountain-new-latest.glb` | the mountain (textured; current) |
| `assets/Sand_mount.fbx` | the first mountain scan (no longer used by the page) |
| `assets/Main Character.fbx` | temporary character + standing (idle) clip |
| `assets/Walking.fbx` | walk cycle |

These are copies of the supplied files and are never modified. Everything in `public/models`
is generated from them.

## Rebuilding the 3D assets

Needs Blender 4.4+ (or the `bpy` Python module, which is what was used here):

```bash
blender -b -P scripts/convert_mountain_glb.py -- assets/mountain-new-latest.glb public
blender -b -P scripts/build_character.py -- assets public/models
npm run assets:optimize
```

* `convert_mountain_glb.py` keeps the GLB's own material (colour, normal, roughness/occlusion),
  downsizes its 8K textures to WebP (4096/2048 desktop, 2048/1024 lite), welds the mesh, writes
  an "edge" vertex colour used to fade the border into the ground, and exports a full and a
  40k-triangle LOD. Placement is set in `MOUNTAIN` (`scale`, `anchor`) in `config.ts`: the
  ground plane sits at the height of the mountain's southern cut, so only the peak rises out
  of the plain and the low, holed northern half stays hidden.
* `convert_mountain.py` (older, for vertex-coloured scans such as Sand_mount) bakes the scan's vertex colours to a colour texture, bakes the
  full-resolution surface detail to an object-space normal map, decimates the original mesh
  (5.18M triangles → 320k desktop / 70k mobile) and adds planar UVs.
* `build_character.py` checks that both FBX skeletons match, removes the root motion from
  the walk so it loops in place, measures the stride, and exports one GLB with `Idle` and
  `Walk` clips.
* `optimize-glb.mjs` applies meshopt compression (94 MB source GLB → 3.4 MB desktop / 1.3 MB lite).

Node lives in `~/.local/node/bin` on this machine; prefix commands with
`PATH=$HOME/.local/node/bin:$PATH` if `npm` is not found.

## Where to tune things

Everything is in `src/lib/animation/config.ts`:

* `TIMELINE` – scroll length, walk window, scrub smoothing
* `SHOTS` – the camera compositions (A wide, C Gus, D About; B is the move between A and C)
* `ROUTE` – where the character walks
* `TEXT` – when each line of copy appears and leaves
* `MOUNTAIN`, `ENVIRONMENT` – scale, colour grade, fog, sky and lights
* `CHARACTER` – model URL, clip names, stride

`src/lib/animation/timeline.ts` turns a scroll position into a character pose and a camera
composition. Both are pure functions, so a scroll position always gives the same frame.

### Route

The scan's flat apron is small and bumpy once scaled up. In `npm run dev`, the browser
console exposes `__chooliTerrain.heightAt(x, z)` to inspect ground heights before moving
the route. The scan's surface ends about 3 m past the current end point.

## Replacing the character with Gus

1. Export Gus as a GLB facing +Z, with an idle clip and an **in-place** walk clip.
2. Put it in `public/models/` and update `CHARACTER` in `config.ts`: `url`, `clips`,
   `stride` (metres travelled per walk cycle), `scale`, and clear `materials`.

No other code changes are needed; cameras frame the character by position, not by model.

## Structure

```
assets/                  original FBX files
references/              frames extracted from the reference screen recording
scripts/                 Blender + GLB optimisation scripts
public/models|textures   generated, optimised assets
src/lib/animation/       config, timeline maths, progress store, text reveals
src/components/3d/       Experience (canvas), IntroScene, Mountain, Character, Atmosphere
src/components/sections/ IntroSequence (pinned intro), WhyChooseChooli (first static section)
src/components/ui/       Header, ScrollHint
```

## Behaviour notes

* Pinning uses `position: sticky`; native scrolling is never hijacked.
* Reduced motion, or no WebGL: the intro becomes a single still frame with all copy visible.
* Phones / low-power devices: lighter mountain, no shadows, lower pixel ratio, portrait framing.
* All copy is real HTML, readable without the 3D scene.
