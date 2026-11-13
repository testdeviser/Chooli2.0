"""Stage 3 - rig Gus to the Mixamo skeleton, attach the Idle and in-place Walk clips, export GLB.

The skeleton keeps its T-pose bone orientations (so the existing clips play unchanged) but its
proportions are refitted to Gus. The body was modelled in the pose of the reference art, so it
is bound to a copy of the rig posed that way and then carried back to the T-pose rest.

    python -I scripts/gus/rig.py assets .cache/gus public/models assets/gus
"""
import bpy, numpy as np, sys, os, json, math
from mathutils import Matrix, Vector
from bpy_extras import anim_utils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SRC, WORK, OUT, KEEP = sys.argv[-4:]
P = 'mixamorig:'
HIPS = P + 'Hips'
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(os.path.join(WORK, 'textured.blend')))
scene = bpy.context.scene
scene.render.fps = 30
vl = bpy.context.view_layer
body = bpy.data.objects['GusBody']

def activate(ob, mode='OBJECT'):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); vl.objects.active = ob
    if mode != 'OBJECT':
        bpy.ops.object.mode_set(mode=mode)

def set_action(arm, act):
    arm.animation_data.action = act
    if act is not None:
        try:
            arm.animation_data.action_slot = act.slots[0]
        except Exception:
            pass

def hips_fcurves(act):
    return [fc for fc in anim_utils.action_get_channelbag_for_slot(act, act.slots[0]).fcurves
            if fc.data_path == f'pose.bones["{HIPS}"].location']

def bone_world(arm, name):
    return (arm.matrix_world @ arm.pose.bones[P + name].matrix).translation.copy()

def measure_stride(arm, act):
    """Distance the planted foot travels backwards over one cycle = metres walked per cycle."""
    set_action(arm, act)
    f0, f1 = (int(v) for v in act.frame_range)
    rows = []
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        rows.append([bone_world(arm, 'LeftToeBase'), bone_world(arm, 'RightToeBase')])
    # the planted foot is the one moving backwards (+Y); summing that motion gives metres per cycle
    return sum(max(b[0].y - a[0].y, b[1].y - a[1].y, 0.0) for a, b in zip(rows, rows[1:]))

# ------------------------------------------------------------ import clips
main, actions, meta = None, {}, {'clips': {}}
for name, fname, in_place in (('Idle', 'Main Character.fbx', False), ('Walk', 'Walking.fbx', True)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fname), use_anim=True)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    act = arm.animation_data.action
    act.name = name; act.use_fake_user = True
    actions[name] = act
    f0, f1 = (int(v) for v in act.frame_range)
    if in_place:
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
meta['strideOriginal'] = round(measure_stride(main, actions['Walk']), 4)
set_action(main, None)
for pb in main.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
scene.frame_set(1)

# ------------------------------------------- refit the rest pose to Gus
Mw = main.matrix_world.copy(); Mi = Mw.inverted()
rest = {b.name[len(P):]: Mw @ b.head_local for b in main.data.bones}
tips = max((Mw @ b.tail_local).x for b in main.data.bones)
orig_hips_z = rest['Hips'].z

def pw(pairs):
    xs, ys = zip(*sorted(pairs))
    xs, ys = list(xs), list(ys)
    for i in range(1, len(xs)):                      # keep strictly increasing
        if xs[i] <= xs[i - 1]:
            xs[i] = xs[i - 1] + 1e-4
    return lambda v: float(np.interp(v, xs, ys)) if xs[0] <= v <= xs[-1] else (
        ys[-1] + (v - xs[-1]) * (ys[-1] - ys[-2]) / (xs[-1] - xs[-2]) if v > xs[-1] else ys[0] + (v - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0]))

SHOULDER = Vector((0.41, 0.02, 1.66))
zmap = pw([(0, 0), (rest['LeftFoot'].z, 0.16), (rest['LeftLeg'].z, 0.58), (rest['LeftUpLeg'].z, 1.02), (rest['Hips'].z, 1.08),
           (rest['LeftArm'].z, SHOULDER.z), (rest['Neck'].z, 1.73), (rest['Head'].z, 1.84), (rest['HeadTop_End'].z, 2.2)])
xabs = pw([(0, 0), (rest['LeftUpLeg'].x, 0.19), (rest['LeftArm'].x, SHOULDER.x), (rest['LeftForeArm'].x, 0.76),
           (rest['LeftHand'].x, 1.10), (tips, 1.38)])
ymap = pw([(rest['LeftToe_End'].y, -0.36), (rest['LeftToeBase'].y, -0.22), (0, 0.02), (0.2, 0.26)])
fit_point = lambda v: Vector((math.copysign(xabs(abs(v.x)), v.x), ymap(v.y), zmap(v.z)))

activate(main, 'EDIT')
plan = {eb.name: (fit_point(Mw @ eb.head), fit_point(Mw @ eb.tail), eb.z_axis.copy()) for eb in main.data.edit_bones}
for eb in main.data.edit_bones:                      # moving a parent drags connected children: detach first
    eb.use_connect = False
for eb in main.data.edit_bones:
    h, t, zax = plan[eb.name]
    eb.head, eb.tail = Mi @ h, Mi @ t
    eb.align_roll(zax)                               # roll is unstable for straight-down bones: keep the axis
bpy.ops.object.mode_set(mode='OBJECT')
for b in main.data.bones:
    n = b.name
    if n.endswith('_End') or any(f in n for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')) or n.endswith('4'):
        b.use_deform = False
leg_scale = (Mw @ main.data.bones[HIPS].head_local).z / orig_hips_z
for act in actions.values():                         # hip bob / crouch scale with the legs
    for fc in hips_fcurves(act):
        for kp in fc.keyframe_points:
            kp.co.y *= leg_scale; kp.handle_left.y *= leg_scale; kp.handle_right.y *= leg_scale
        fc.update()

# ----------------------------- copy of the rig, posed like the reference art
fit = main.copy(); fit.data = main.data.copy(); fit.name = 'FitRig'
fit.animation_data_clear()
scene.collection.objects.link(fit)
vl.update()

def aim(pb, target):
    M = pb.matrix.copy()
    head = Mw @ M.translation
    d0 = ((Mw @ pb.tail) - head).normalized()
    q = d0.rotation_difference((target - head).normalized())
    R = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head)
    pb.matrix = Mi @ R @ Mw @ M
    vl.update()

for side, sx in (('Left', 1), ('Right', -1)):
    aim(fit.pose.bones[P + side + 'Arm'], Vector((sx * 0.475, -0.09, 0.93)))
    aim(fit.pose.bones[P + side + 'UpLeg'], Vector((sx * 0.235, 0.04, 0.16)))
activate(fit, 'POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------- skin weights
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); fit.select_set(True); vl.objects.active = fit
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# bone heat leaks between parts that touch in the art pose (hand <-> thigh, arm <-> flank): separate them
names = {g.index: g.name[len(P):] for g in body.vertex_groups}
gi = {g.name[len(P):]: g for g in body.vertex_groups}
L = np.load(os.path.join(WORK, 'labels.npz'))
def grow(m, n):
    for _ in range(n):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1) | np.roll(m, 1, 2) | np.roll(m, -1, 2)
    return m
lab_arm, lab_body = grow(L['arm'], 3), grow(L['body'], 3)
org, vox = L['origin'], float(L['voxel'])
fixed = 0
for v in body.data.vertices:
    x, y, z = v.co
    ax, side = abs(x), ('Left' if x > 0 else 'Right')
    i, j, k = (int(np.clip((c - o) / vox, 0, n - 1)) for c, o, n in zip((x, y, z), org, lab_arm.shape))
    in_arm, in_body = bool(lab_arm[i, j, k]), bool(lab_body[i, j, k])
    is_arm = z < 1.3 and in_arm and not in_body
    is_body = z < 1.3 and in_body and not in_arm
    drop = []
    for g in v.groups:
        n = names[g.group]
        arm_bone = ('Arm' in n or 'Hand' in n)
        if is_arm and not (arm_bone and n.startswith(side)):
            drop.append(g.group)
        elif is_body and arm_bone:
            drop.append(g.group)
        elif arm_bone and not n.startswith(side) and ax > 0.05:
            drop.append(g.group)
    for g in drop:
        body.vertex_groups[g].remove([v.index])
    fixed += bool(drop)
    if not v.groups:
        gi[side + 'ForeArm' if is_arm else 'Hips'].add([v.index], 1.0, 'REPLACE')
    tot = sum(g.weight for g in v.groups)
    for g in v.groups:
        g.weight /= tot
meta['weightsSeparated'] = fixed
activate(body, 'EDIT')
bpy.ops.mesh.select_all(action='SELECT')
try:
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=3, expand=0.0)
    meta['weightsSmoothed'] = True
except Exception as e:
    meta['weightsSmoothed'] = str(e)[:80]
bpy.ops.object.mode_set(mode='OBJECT')
unweighted = sum(1 for v in body.data.vertices if not v.groups)
meta['unweightedVerts'] = unweighted
meta['vertexGroups'] = len(body.vertex_groups)

# carry the bound body back to the T-pose rest of the real rig
order = sorted(fit.pose.bones, key=lambda pb: len(pb.bone.parent_recursive))
for pb in order:
    pb.matrix = main.data.bones[pb.name].matrix_local
    vl.update()
activate(body)
mod = next(m for m in body.modifiers if m.type == 'ARMATURE')
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.data.objects.remove(fit, do_unlink=True)
body.parent = main
body.matrix_parent_inverse = main.matrix_world.inverted()
m = body.modifiers.new('Armature', 'ARMATURE'); m.object = main
vl.update()

# ------------------------------------------------- checks + preview renders
def body_min_z():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    co = np.empty(len(ev.data.vertices) * 3, np.float32); ev.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    return float(co[:, 2].min()), float(co[:, 2].max())

def shot(path, deg, res=(520, 860)):
    sc = scene
    cam = preview_setup(res, 16)
    a = math.radians(deg)
    cam.location = (math.sin(a) * 8, -math.cos(a) * 8, 1.12)
    cam.rotation_euler = (math.radians(90), 0, a)
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

meta['stride'] = round(measure_stride(main, actions['Walk']), 4)
ground = {}
for name, frames in (('Idle', (1, 60)), ('Walk', (1, 5, 9, 13, 17, 21, 25, 29))):
    set_action(main, actions[name])
    zs = []
    for f in frames:
        scene.frame_set(f)
        zs.append(round(body_min_z()[0], 3))
    ground[name] = zs
meta['minZ'] = ground
lift = 0.02                                          # big toes dip a little at push-off; keep the idle stance grounded
main.location.z += lift                              # planted foot on the ground plane
meta['lift'] = round(lift, 4)
vl.update()

set_action(main, actions['Idle']); scene.frame_set(30)
meta['height'] = round(body_min_z()[1], 3)
shot(os.path.join(WORK, 'rig-idle-front.jpg'), 0); shot(os.path.join(WORK, 'rig-idle-tq.jpg'), -40)
set_action(main, actions['Walk'])
for f in (1, 9, 17, 25):
    scene.frame_set(f)
    shot(os.path.join(WORK, f'rig-walk-{f:02d}-side.jpg'), -90)
scene.frame_set(9); shot(os.path.join(WORK, 'rig-walk-09-tq.jpg'), -35); shot(os.path.join(WORK, 'rig-walk-09-front.jpg'), 0)

# ------------------------------------------------------------------ export
set_action(main, None)
ad = main.animation_data
for name in ('Idle', 'Walk'):
    tr = ad.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, int(actions[name].frame_range[0]), actions[name]); st.name = name
    try:
        st.action_slot = actions[name].slots[0]
    except Exception:
        pass
scene.frame_set(1)
for o in list(bpy.data.objects):
    if o.name.startswith('Preview'):
        o.hide_render = True
bpy.ops.object.select_all(action='DESELECT')
main.select_set(True); body.select_set(True); vl.objects.active = main
os.makedirs(OUT, exist_ok=True); os.makedirs(KEEP, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'gus.glb'), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_optimize_animation_size=False,
    export_skins=True, export_yup=True, export_apply=False, export_materials='EXPORT',
    export_image_format='JPEG', export_jpeg_quality=88, export_tangents=False,
)
meta['tris'] = sum(len(p.vertices) - 2 for p in body.data.polygons)
meta['glbBytes'] = os.path.getsize(os.path.join(OUT, 'gus.glb'))
json.dump(meta, open(os.path.join(OUT, 'gus.meta.json'), 'w'), indent=2)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(KEEP, 'gus.blend')))
print('META ' + json.dumps(meta))
