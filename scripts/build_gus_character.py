"""New character (Walking-Left-Turn.fbx) + the existing Mixamo motions -> public/models/gus-character.glb

The new character comes with its own 41-bone Mixamo skeleton and only a turning walk.
The site needs a standing idle, a straight in-place walk and the arm stretch, so those are
retargeted from the stand-in's clips (Main Character.fbx, Walking.fbx, Arm-Stretching.fbx):

  * bones are matched by name; each target bone gets the source bone's WORLD rotation change
    from its rest pose (robust to differences in bone roll between the two rigs)
  * the hips' translation is scaled by the ratio of hip heights, so the feet do not slide
  * the walk's forward root motion is removed first (in-place cycle, like build_character.py)

The character is turned to face the camera (-Y in Blender = +Z in three.js), scaled to the
stand-in's height, decimated for the web and its textures downsized.

    python -I scripts/build_gus_character.py assets public/models
"""
import bpy, bmesh, sys, os, json, math
import numpy as np
from mathutils import Matrix, Vector, Quaternion
from bpy_extras import anim_utils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SRC, OUT = argv[0], argv[1]
HEIGHT = 1.786          # same as the stand-in, so the existing camera framing still fits
TARGET_TRIS = 60_000
TEX_PX = 2048
P = 'mixamorig:'
HIPS = P + 'Hips'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
vl = bpy.context.view_layer


def activate(objs, active):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    vl.objects.active = active


def set_action(arm, act):
    arm.animation_data_create()
    arm.animation_data.action = act
    if act is not None:
        try:
            arm.animation_data.action_slot = act.slots[0]
        except Exception:
            pass


# ------------------------------------------------------------- the new character
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, 'Walking-Left-Turn.fbx'), use_anim=False)
new = [o for o in bpy.data.objects if o not in before]
tgt = next(o for o in new if o.type == 'ARMATURE')
mesh = next(o for o in new if o.type == 'MESH')
for o in new:
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)
if tgt.animation_data:
    tgt.animation_data.action = None
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
tgt.data.pose_position = 'REST'

# face -Y like the stand-in (the import faces +Y: its feet point +Y)
tgt.rotation_euler.z = 0.0
vl.update()
foot = tgt.data.bones[P + 'LeftFoot']
fdir = (tgt.matrix_world.to_3x3() @ (foot.tail_local - foot.head_local)).normalized()
if fdir.y > 0:
    tgt.rotation_euler.z = math.pi
activate([tgt, mesh], tgt)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def mesh_bounds():
    vl.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    co = np.empty(len(ev.data.vertices) * 3, np.float32); ev.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3) @ np.array(mesh.matrix_world.to_3x3()).T + np.array(mesh.matrix_world.translation)
    return co.min(0), co.max(0)

mn, mx = mesh_bounds()
s = HEIGHT / float(mx[2] - mn[2])
hx, hy = (tgt.matrix_world @ tgt.data.bones[HIPS].head_local).xy
tgt.scale = (s, s, s)
tgt.location = (-hx * s, -hy * s, -mn[2] * s)
activate([tgt, mesh], tgt)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mn, mx = mesh_bounds()
info = {'heightAfterScale': round(float(mx[2] - mn[2]), 3), 'scaleFactor': s}

# ------------------------------------------------------------------ decimate + textures
tris0 = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
if tris0 > TARGET_TRIS:
    activate([mesh], mesh)
    mod = mesh.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = TARGET_TRIS / tris0
    mod.use_collapse_triangulate = True
    while mesh.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
info['trisBefore'] = tris0
info['trisAfter'] = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
for img in bpy.data.images:
    if img.size[0] > TEX_PX:
        img.scale(TEX_PX, TEX_PX)
mesh.data.materials[0].name = 'Gus_MAT'

# --------------------------------------------------------------- source motions
src, actions = None, {}
for name, fname, in_place in (('Idle', 'Main Character.fbx', False), ('Walk', 'Walking.fbx', True), ('Stretch', 'Arm-Stretching.fbx', False)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fname), use_anim=True)
    added = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in added if o.type == 'ARMATURE')
    act = arm.animation_data.action
    act.name = 'src_' + name
    act.use_fake_user = True
    if in_place:
        f0, f1 = (int(v) for v in act.frame_range)
        for fc in anim_utils.action_get_channelbag_for_slot(act, act.slots[0]).fcurves:
            if fc.data_path == f'pose.bones["{HIPS}"].location':
                v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
                k = (v1 - v0) / (f1 - f0)
                for kp in fc.keyframe_points:
                    kp.handle_left.y -= k * (kp.handle_left.x - f0)
                    kp.handle_right.y -= k * (kp.handle_right.x - f0)
                    kp.co.y -= k * (kp.co.x - f0)
                fc.update()
    actions[name] = act
    for o in added:
        if src is None and o is arm:
            continue
        bpy.data.objects.remove(o, do_unlink=True)
    if src is None:
        src = arm
for o in list(bpy.data.objects):
    if o.parent is src and o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

# ------------------------------------------------------------------- retarget
tgt.data.pose_position = 'POSE'
src.data.pose_position = 'REST'
vl.update()
Ws, Wt = src.matrix_world.copy(), tgt.matrix_world.copy()
Wt_rot_inv = Wt.to_quaternion().inverted()
rest_s = {b.name: (Ws @ b.matrix_local) for b in src.data.bones}
rest_t_world = {b.name: (Wt @ b.matrix_local) for b in tgt.data.bones}
hip_s = rest_s[HIPS].translation.z
hip_t = rest_t_world[HIPS].translation.z
ratio = hip_t / hip_s
info['hipRatio'] = round(ratio, 4)
src.data.pose_position = 'POSE'

order = sorted(tgt.data.bones, key=lambda b: len(b.parent_recursive))
for pb in tgt.pose.bones:
    pb.rotation_mode = 'QUATERNION'
shared = [b.name for b in order if b.name in src.data.bones]
info['bonesMatched'] = f'{len(shared)}/{len(order)}'

out_actions = {}
for name, act in actions.items():
    set_action(src, act)
    f0, f1 = (int(v) for v in act.frame_range)
    new_act = bpy.data.actions.new(name)
    new_act.use_fake_user = True
    set_action(tgt, new_act)
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        pose_arm = {}  # target armature-space pose matrices computed this frame
        for b in order:
            n = b.name
            R = b.matrix_local                      # rest, armature space
            par = b.parent
            if par is not None:
                chain = pose_arm[par.name] @ (par.matrix_local.inverted() @ R)
            else:
                chain = R.copy()
            if n in src.pose.bones:
                Ms = Ws @ src.pose.bones[n].matrix
                delta = Ms.to_quaternion() @ rest_s[n].to_quaternion().inverted()
                q_world = delta @ rest_t_world[n].to_quaternion()
                q_arm = Wt_rot_inv @ q_world
            else:
                q_arm = chain.to_quaternion()
            pos = chain.translation.copy()
            if n == HIPS:
                hs = (Ws @ src.pose.bones[n].matrix).translation
                world = rest_t_world[n].translation + (hs - rest_s[n].translation) * ratio
                pos = Wt.inverted() @ world
            Pm = Matrix.Translation(pos) @ q_arm.to_matrix().to_4x4()
            pose_arm[n] = Pm
            parent_term = (pose_arm[par.name] @ (par.matrix_local.inverted() @ R)) if par is not None else R
            basis = parent_term.inverted() @ Pm
            pb = tgt.pose.bones[n]
            loc, rot, _ = basis.decompose()
            pb.location = loc if n == HIPS else Vector((0, 0, 0))
            pb.rotation_quaternion = rot
            pb.keyframe_insert('rotation_quaternion', frame=f, group=n)
            if n == HIPS:
                pb.keyframe_insert('location', frame=f, group=n)
    out_actions[name] = new_act
    print('retargeted', name, f0, f1, flush=True)

# --------------------------------------------------------------- checks + stride
def bone_world(name):
    return (tgt.matrix_world @ tgt.pose.bones[P + name].matrix).translation.copy()

set_action(tgt, out_actions['Walk'])
f0, f1 = (int(v) for v in out_actions['Walk'].frame_range)
rows = []
for f in range(f0, f1 + 1):
    scene.frame_set(f)
    rows.append([bone_world('LeftToeBase'), bone_world('RightToeBase'), bone_world('LeftFoot').z, bone_world('RightFoot').z])
info['stride'] = round(sum(max(b[0].y - a[0].y, b[1].y - a[1].y, 0.0) for a, b in zip(rows, rows[1:])), 4)
info['walkToeMinZ'] = round(min(min(r[0].z, r[1].z) for r in rows), 4)
set_action(tgt, out_actions['Idle']); scene.frame_set(1)
info['idleToeZ'] = round(min(bone_world('LeftToeBase').z, bone_world('RightToeBase').z), 4)

# ----------------------------------------------------------------- previews
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.4
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (0.9, 0, 0.5)
scene.collection.objects.link(sun)
scene.world = bpy.data.worlds.new('w'); scene.world.use_nodes = True; scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
scene.render.engine = 'CYCLES'; scene.cycles.samples = 8; scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 420, 560
scene.render.image_settings.file_format = 'JPEG'
prev_dir = os.path.abspath(os.path.join('.cache', 'gus-char'))  # run from the project root
os.makedirs(prev_dir, exist_ok=True)
def shot(path, deg):
    a = math.radians(deg)
    cam.location = (math.sin(a) * 6, -math.cos(a) * 6, 0.95)
    cam.rotation_euler = (math.radians(90), 0, a)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
for name, frames in (('Idle', (1,)), ('Walk', (1, 9, 17)), ('Stretch', (60, 120, 180))):
    set_action(tgt, out_actions[name])
    for f in frames:
        scene.frame_set(f)
        shot(os.path.join(prev_dir, f'{name}-{f:03d}-front.jpg'), 0)
        shot(os.path.join(prev_dir, f'{name}-{f:03d}-side.jpg'), -90)

# -------------------------------------------------------------------- export
set_action(tgt, None)
for pb in tgt.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)
ad = tgt.animation_data
for name in ('Idle', 'Walk', 'Stretch'):
    act = out_actions[name]
    tr = ad.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, int(act.frame_range[0]), act); st.name = name
    try:
        st.action_slot = act.slots[0]
    except Exception:
        pass
scene.frame_set(1)
tgt.name = 'CharacterRig'
for o in list(bpy.data.objects):
    if o not in (tgt, mesh):
        o.hide_render = True
activate([tgt, mesh], tgt)
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, 'gus-character.glb')
bpy.ops.export_scene.gltf(
    filepath=path, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_optimize_animation_size=False,
    export_skins=True, export_yup=True, export_apply=False, export_materials='EXPORT',
    export_image_format='WEBP', export_image_quality=86,
)
info['glbBytes'] = os.path.getsize(path)
info['height'] = HEIGHT
json.dump(info, open(os.path.join(OUT, 'gus-character.meta.json'), 'w'), indent=2)
print('META ' + json.dumps(info))
