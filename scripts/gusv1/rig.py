"""Stage 2 - rig Gus-v1 to the Mixamo skeleton and attach Idle / Walk / Stretch -> gus-character.glb

Gus-v1 is a static T-pose sculpt. The stand-in's Mixamo skeleton (Main Character.fbx) is
refitted to his proportions (bone positions moved, T-pose kept), the body is bound with
automatic (bone heat) weights, and the stand-in's clips play on it directly:
Idle (Main Character.fbx), Walk (Walking.fbx, made in-place), Stretch (Arm-Stretching.fbx).

    python -I scripts/gusv1/rig.py assets .cache/gusv1 public/models
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Matrix, Vector, kdtree
from bpy_extras import anim_utils

SRC, WORK, OUT = sys.argv[-3:]
P = 'mixamorig:'
HIPS = P + 'Hips'
BASE_PX, AUX_PX = 2048, 1024

bpy.ops.wm.open_mainfile(filepath=os.path.abspath(os.path.join(WORK, 'prep.blend')))
scene = bpy.context.scene
scene.render.fps = 30
vl = bpy.context.view_layer
body = bpy.data.objects['GusBody']


def activate(ob, mode='OBJECT'):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    vl.objects.active = ob
    if mode != 'OBJECT':
        bpy.ops.object.mode_set(mode=mode)


def set_action(arm, act):
    arm.animation_data_create()
    arm.animation_data.action = act
    if act is not None:
        try:
            arm.animation_data.action_slot = act.slots[0]
        except Exception:
            pass


def fcurves(act):
    return anim_utils.action_get_channelbag_for_slot(act, act.slots[0]).fcurves


def hips_fcurves(act):
    return [fc for fc in fcurves(act) if fc.data_path == f'pose.bones["{HIPS}"].location']


def bone_world(arm, name):
    return (arm.matrix_world @ arm.pose.bones[P + name].matrix).translation.copy()


def measure_stride(arm, act):
    """metres the planted foot travels backwards over one cycle = metres walked per cycle"""
    set_action(arm, act)
    f0, f1 = (int(v) for v in act.frame_range)
    rows = []
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        rows.append([bone_world(arm, 'LeftToeBase'), bone_world(arm, 'RightToeBase')])
    return sum(max(b[0].y - a[0].y, b[1].y - a[1].y, 0.0) for a, b in zip(rows, rows[1:]))


# ------------------------------------------------------------ the clips
main, actions, meta, rests = None, {}, {}, {}
for name, fname, in_place in (('Idle', 'Main Character.fbx', False), ('Walk', 'Walking.fbx', True),
                              ('Stretch', 'Arm-Stretching.fbx', False)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fname), use_anim=True)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    rests[name] = {b.name: (arm.matrix_world @ b.head_local).copy() for b in arm.data.bones}
    act = arm.animation_data.action
    act.name = name
    act.use_fake_user = True
    actions[name] = act
    f0, f1 = (int(v) for v in act.frame_range)
    if in_place:                                     # remove the forward drift of the hips
        for fc in hips_fcurves(act):
            v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
            k = (v1 - v0) / (f1 - f0)
            for kp in fc.keyframe_points:
                kp.handle_left.y -= k * (kp.handle_left.x - f0)
                kp.handle_right.y -= k * (kp.handle_right.x - f0)
                kp.co.y -= k * (kp.co.x - f0)
            fc.update()
    for o in new:
        if o is arm and main is None:
            continue
        bpy.data.objects.remove(o, do_unlink=True)
    if main is None:
        main = arm
main.name = 'CharacterRig'
# the three files must share one skeleton for the clips to play unchanged
for name in ('Walk', 'Stretch'):
    common = set(rests[name]) & set(rests['Idle'])
    meta[f'restDiff{name}'] = round(max((rests[name][b] - rests['Idle'][b]).length for b in common), 4)
    meta[f'bones{name}'] = f'{len(common)}/{len(rests["Idle"])}'
meta['strideOriginal'] = round(measure_stride(main, actions['Walk']), 4)
set_action(main, None)
for pb in main.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
scene.frame_set(1)

# ------------------------------------------- refit the rest pose to Gus-v1
Mw = main.matrix_world.copy()
Mi = Mw.inverted()
rest = {b.name[len(P):]: Mw @ b.head_local for b in main.data.bones}
tips = max((Mw @ b.tail_local).x for b in main.data.bones)
orig_hips_z = rest['Hips'].z


def pw(pairs):
    xs, ys = zip(*sorted(pairs))
    xs, ys = list(xs), list(ys)
    for i in range(1, len(xs)):
        if xs[i] <= xs[i - 1]:
            xs[i] = xs[i - 1] + 1e-4

    def f(v):
        if v < xs[0]:
            return ys[0] + (v - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0])
        if v > xs[-1]:
            return ys[-1] + (v - xs[-1]) * (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
        return float(np.interp(v, xs, ys))
    return f


# landmarks measured on the scaled sculpt (height 1.786, front = -Y; see prep.py profile.json)
zmap = pw([(0, 0), (rest['LeftFoot'].z, 0.12), (rest['LeftLeg'].z, 0.42), (rest['LeftUpLeg'].z, 0.74),
           (rest['Hips'].z, 0.81), (rest['LeftArm'].z, 1.335), (rest['Neck'].z, 1.475), (rest['Head'].z, 1.565),
           (rest['HeadTop_End'].z, 1.786)])
xabs = pw([(0, 0), (rest['LeftUpLeg'].x, 0.12), (rest['LeftArm'].x, 0.25), (rest['LeftForeArm'].x, 0.55),
           (rest['LeftHand'].x, 0.84), (tips, 1.02)])
ymap = pw([(rest['LeftToe_End'].y, -0.25), (rest['LeftToeBase'].y, -0.15), (0, -0.01), (0.2, 0.19)])
fit_point = lambda v: Vector((math.copysign(xabs(abs(v.x)), v.x), ymap(v.y), zmap(v.z)))

activate(main, 'EDIT')
plan = {eb.name: (fit_point(Mw @ eb.head), fit_point(Mw @ eb.tail), eb.z_axis.copy()) for eb in main.data.edit_bones}
for eb in main.data.edit_bones:
    eb.use_connect = False
for eb in main.data.edit_bones:
    h, t, zax = plan[eb.name]
    eb.head, eb.tail = Mi @ h, Mi @ t
    eb.align_roll(zax)
bpy.ops.object.mode_set(mode='OBJECT')
for b in main.data.bones:                            # fingers / ends: the sculpt has mitten hands
    n = b.name
    if n.endswith('_End') or any(f in n for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')) or n.endswith('4'):
        b.use_deform = False
leg_scale = (Mw @ main.data.bones[HIPS].head_local).z / orig_hips_z
meta['legScale'] = round(leg_scale, 4)
for act in actions.values():                         # hip bob / crouch scale with the legs
    for fc in hips_fcurves(act):
        for kp in fc.keyframe_points:
            kp.co.y *= leg_scale
            kp.handle_left.y *= leg_scale
            kp.handle_right.y *= leg_scale
        fc.update()

# ---------------------------------------------------------- skin weights
# Bone heat cannot solve on this sculpt (open fur surface), so weights come from distance to
# each deform bone's segment, blended with a soft-min so joints bend smoothly. Two rules keep
# limbs apart: below the hips a vertex only follows its own leg, and arm bones only pull
# vertices on their own side.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
main.select_set(True)
vl.objects.active = main
bpy.ops.object.parent_set(type='ARMATURE_NAME')
deform = [b for b in main.data.bones if b.use_deform]
segs = np.array([[(Mw @ b.head_local)[:], (Mw @ b.tail_local)[:]] for b in deform])
bn = [b.name[len(P):] for b in deform]
V = np.array([v.co[:] for v in body.data.vertices])          # body is at the origin, unscaled
A, B = segs[:, 0], segs[:, 1]
AB = B - A
t = np.clip(((V[:, None, :] - A[None]) * AB[None]).sum(-1) / np.maximum((AB * AB).sum(-1), 1e-9)[None], 0, 1)
D = np.linalg.norm(V[:, None, :] - (A[None] + t[..., None] * AB[None]), axis=-1)
x, z = V[:, 0:1], V[:, 2:3]
is_leg = np.array([('Leg' in n or 'Foot' in n or 'Toe' in n) for n in bn])[None]
is_arm = np.array([('Arm' in n or 'Hand' in n or 'Shoulder' in n) for n in bn])[None]
left = np.array([n.startswith('Left') for n in bn])[None]
right = np.array([n.startswith('Right') for n in bn])[None]
BIG = 9.0
D = np.where(is_leg & (z < 0.78) & (((x > 0.01) & right) | ((x < -0.01) & left)), BIG, D)
D = np.where(is_arm & (np.abs(x) > 0.04) & (((x > 0) & right) | ((x < 0) & left)), BIG, D)
# below the crotch, vertices belong to the legs only (no spine / hips pull on the shins)
D = np.where((~is_leg) & (z < 0.62), BIG, D)
SOFT = 0.035
W = np.exp(-(D - D.min(1, keepdims=True)) / SOFT)
top = np.argsort(-W, 1)[:, :4]
groups = {n: body.vertex_groups.get(P + n) or body.vertex_groups.new(name=P + n) for n in bn}
rows = np.arange(len(V))[:, None]
Wt = W[rows, top]
Wt /= Wt.sum(1, keepdims=True)
for k in range(4):
    for j, n in enumerate(bn):
        sel = np.where((top[:, k] == j) & (Wt[:, k] > 0.01))[0]
        for i in sel:
            groups[n].add([int(i)], float(Wt[i, k]), 'ADD')
meta['weighting'] = 'distance-softmin'
names = {g.index: g.name[len(P):] for g in body.vertex_groups}

activate(body, 'EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.object.mode_set(mode='OBJECT')
activate(body, 'WEIGHT_PAINT')
try:
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=2, expand=0.0)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
except Exception as e:
    meta['weightsPost'] = str(e)[:80]
bpy.ops.object.mode_set(mode='OBJECT')
meta['unweightedVerts'] = sum(1 for v in body.data.vertices if not v.groups)


# ------------------------------------------------- checks + preview renders
def body_z():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    c = np.empty(len(ev.data.vertices) * 3, np.float32)
    ev.data.vertices.foreach_get('co', c)
    c = c.reshape(-1, 3)
    return float(c[:, 2].min()), float(c[:, 2].max())


meta['stride'] = round(measure_stride(main, actions['Walk']), 4)
ground = {}
for name, frames in (('Idle', (1, 30, 60)), ('Walk', (1, 5, 9, 13, 17, 21, 25, 29))):
    set_action(main, actions[name])
    zs = []
    for f in frames:
        scene.frame_set(f)
        zs.append(round(body_z()[0], 3))
    ground[name] = zs
meta['minZ'] = ground
lift = -float(np.median(ground['Idle']))
main.location.z += lift
meta['lift'] = round(lift, 4)
vl.update()
set_action(main, actions['Idle'])
scene.frame_set(30)
meta['height'] = round(body_z()[1], 3)

scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
scene.render.resolution_x, scene.render.resolution_y = 560, 820


def shot(path, deg):
    a = math.radians(deg)
    cam.location = (math.sin(a) * 6.2, -math.cos(a) * 6.2, 1.0)
    cam.rotation_euler = (math.radians(90), 0, a)
    scene.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)


shot(os.path.join(WORK, 'rig-idle-front.png'), 0)
set_action(main, actions['Walk'])
for f in (1, 9, 17):
    scene.frame_set(f)
    shot(os.path.join(WORK, f'rig-walk-{f:02d}.png'), -50)
set_action(main, actions['Stretch'])
sf0, sf1 = (int(v) for v in actions['Stretch'].frame_range)
for k, f in enumerate((sf0 + (sf1 - sf0) // 3, sf0 + (sf1 - sf0) // 2)):
    scene.frame_set(f)
    shot(os.path.join(WORK, f'rig-stretch-{k}.png'), -25)

# ------------------------------------------------------------------ textures: web sizes
for img in bpy.data.images:
    if img.size[0] == 0:
        continue
    users = [n for m in bpy.data.materials if m.node_tree for n in m.node_tree.nodes
             if n.type == 'TEX_IMAGE' and n.image == img]
    is_base = any(l.to_socket.name == 'Base Color' for n in users for l in n.outputs[0].links)
    px = BASE_PX if is_base else AUX_PX
    if img.size[0] > px:
        img.scale(px, px)

# ------------------------------------------------------------------ export
set_action(main, None)
ad = main.animation_data
for name in ('Idle', 'Walk', 'Stretch'):
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, int(actions[name].frame_range[0]), actions[name])
    st.name = name
    try:
        st.action_slot = actions[name].slots[0]
    except Exception:
        pass
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
main.select_set(True)
body.select_set(True)
vl.objects.active = main
os.makedirs(OUT, exist_ok=True)
out = os.path.join(OUT, 'gus-character.glb')
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_optimize_animation_size=False,
    export_skins=True, export_yup=True, export_apply=False, export_materials='EXPORT',
    export_image_format='JPEG', export_jpeg_quality=86, export_tangents=False,
)
meta['tris'] = sum(len(p.vertices) - 2 for p in body.data.polygons)
meta['glbBytes'] = os.path.getsize(out)
json.dump(meta, open(os.path.join(OUT, 'gus-character.meta.json'), 'w'), indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(WORK, 'rigged.blend')))
print('META ' + json.dumps(meta))
