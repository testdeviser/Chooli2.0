"""Stage 1 - Gus-v1.glb (static T-pose sculpt, 5.4M tris) -> decimated, upright, scaled mesh.

Saves .cache/gusv1/prep.blend plus front/side preview renders and a landmark profile.
    python -I scripts/gusv1/prep.py assets/Gus-v1.glb .cache/gusv1
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector

SRC, WORK = sys.argv[-2:]
HEIGHT = 1.786
TARGET_TRIS = 70_000
bpy.ops.wm.read_factory_settings(use_empty=True)
vl = bpy.context.view_layer
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
vl.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
body = vl.objects.active
body.name = 'GusBody'
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

tris0 = sum(len(p.vertices) - 2 for p in body.data.polygons)
# merge duplicate vertices along UV seams only where positions coincide exactly (keeps UVs)
mod = body.modifiers.new('dec', 'DECIMATE')
mod.ratio = TARGET_TRIS / tris0
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
tris1 = sum(len(p.vertices) - 2 for p in body.data.polygons)

V = np.array([v.co[:] for v in body.data.vertices])
lo, hi = V.min(0), V.max(0)
s = HEIGHT / (hi[2] - lo[2])
body.scale = (s, s, s)
body.location = (-(lo[0] + hi[0]) / 2 * s, -(lo[1] + hi[1]) / 2 * s, -lo[2] * s)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
V = np.array([v.co[:] for v in body.data.vertices])

# per-height profile: total x-extent, and x-extent of the central (torso/legs) part
prof = []
for z in np.linspace(0.01, HEIGHT - 0.01, 90):
    sl = V[np.abs(V[:, 2] - z) < 0.012]
    if len(sl) == 0:
        continue
    xs = np.sort(sl[:, 0])
    gaps = np.diff(xs)
    prof.append(dict(z=round(float(z), 3), xmin=round(float(xs[0]), 3), xmax=round(float(xs[-1]), 3),
                     ymin=round(float(sl[:, 1].min()), 3), ymax=round(float(sl[:, 1].max()), 3),
                     biggap=round(float(gaps.max()) if len(gaps) else 0, 3),
                     gapat=round(float(xs[gaps.argmax()]) if len(gaps) else 0, 3), n=int(len(sl))))
json.dump(dict(trisBefore=tris0, trisAfter=tris1, scale=s, profile=prof), open(os.path.join(WORK, 'profile.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(WORK, 'prep.blend')))

# preview renders (workbench, textured)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.render.resolution_x, scene.render.resolution_y = 900, 900
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.1
for name, loc, rot in (('front', (0, -6, 0.9), (math.pi / 2, 0, 0)), ('back', (0, 6, 0.9), (math.pi / 2, 0, math.pi)),
                       ('side', (6, 0, 0.9), (math.pi / 2, 0, math.pi / 2))):
    cam.location, cam.rotation_euler = loc, rot
    scene.render.filepath = os.path.abspath(os.path.join(WORK, f'{name}.png'))
    bpy.ops.render.render(write_still=True)
print('DONE', tris0, tris1, s)
