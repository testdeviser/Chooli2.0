"""Gus (Gorilla-Walking-updated) -> public/models/gus-character.glb

Source files (assets/):
  Gorilla-Walking-updated.fbx  rig (33-bone Mixamo skeleton), six meshes, straight walk clip
  Gorilla-Walking-updated.glb  the same character with its textures embedded (no rig)
  Main Character.fbx / Arm-Stretching.fbx   stand-in Idle / Arm Stretch motions

  * the walk is Gus's own clip, made in-place (linear hip drift removed); stride measured
  * Idle and Stretch are retargeted from the stand-in: bones matched by name, each target
    bone gets the source bone's WORLD rotation change from rest; hips scaled by hip height
  * textures come from the GLB (matched by material name), extra UV sets dropped, the
    body mesh decimated for the web

    python -I scripts/build_gorilla_character.py assets public/models
"""
import bpy, sys, os, json, math, re
import numpy as np
from mathutils import Matrix, Vector
from bpy_extras import anim_utils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SRC, OUT = argv[0], argv[1]
P = 'mixamorig:'
HIPS = P + 'Hips'
BODY_RATIO = 0.4          # decimate the 81k-triangle body mesh to ~32k
TEX_PX = 2048

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
vl = bpy.context.view_layer
info = {}


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


def hips_fcurves(act):
    return [fc for fc in anim_utils.action_get_channelbag_for_slot(act, act.slots[0]).fcurves
            if fc.data_path == f'pose.bones["{HIPS}"].location']


# ----------------------------------------------------------------- the character
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, 'Gorilla-Walking-updated.fbx'), use_anim=True)
new = [o for o in bpy.data.objects if o not in before]
tgt = next(o for o in new if o.type == 'ARMATURE')
meshes = [o for o in new if o.type == 'MESH']
# lift the rig out of the Sketchfab wrapper empties, keeping its world transform
mw = tgt.matrix_world.copy()
tgt.parent = None
tgt.matrix_world = mw
for o in new:
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o, do_unlink=True)
vl.update()
walk = tgt.animation_data.action
walk.name = 'Walk'
walk.use_fake_user = True

# walk: measure root motion, then make it in-place
f0, f1 = (int(v) for v in walk.frame_range)
H = lambda: (tgt.matrix_world @ tgt.pose.bones[HIPS].matrix).translation.copy()
scene.frame_set(f0); a = H()
scene.frame_set(f1); b = H()
d = b - a
info['walkRootMotion'] = [round(v, 4) for v in d]
info['stride'] = round(math.hypot(d.x, d.y), 4)
for fc in hips_fcurves(walk):
    v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
    k = (v1 - v0) / (f1 - f0)
    for kp in fc.keyframe_points:
        kp.handle_left.y -= k * (kp.handle_left.x - f0)
        kp.handle_right.y -= k * (kp.handle_right.x - f0)
        kp.co.y -= k * (kp.co.x - f0)
    fc.update()
scene.frame_set(f0); a = H()
scene.frame_set(f1); b = H()
info['walkResidual'] = round((b - a).length, 5)

# ------------------------------------------------------------- textures from the GLB
before = set(bpy.data.objects)
mats_before = set(bpy.data.materials)
bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'Gorilla-Walking-updated.glb'))
glb_objs = [o for o in bpy.data.objects if o not in before]
# Blender renames the GLB's duplicate material names with a .001 suffix; strip only that suffix
glb_mats = {re.sub(r'\.\d{3}$', '', m.name): m for m in bpy.data.materials if m not in mats_before}
tex_report = {}
for o in meshes:
    for mat in o.data.materials:
        src_mat = glb_mats.get(mat.name)
        if src_mat is None:
            continue
        src_img = next((n.image for n in src_mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
        nodes = mat.node_tree.nodes
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        tex = next((n for n in nodes if n.type == 'TEX_IMAGE'), None) or nodes.new('ShaderNodeTexImage')
        tex.image = src_img
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        # fur cards: use the texture's alpha as a cut-out if it has one
        px = np.empty(src_img.size[0] * src_img.size[1] * 4, np.float32); src_img.pixels.foreach_get(px)
        alpha_min = float(px[3::4].min())
        if alpha_min < 0.5:
            mat.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            try:
                mat.blend_method = 'CLIP'
            except Exception:
                pass
            try:
                mat.alpha_threshold = 0.5
            except Exception:
                pass
        else:
            for l in list(bsdf.inputs['Alpha'].links):
                mat.node_tree.links.remove(l)
            try:
                mat.blend_method = 'OPAQUE'
            except Exception:
                pass
        bsdf.inputs['Roughness'].default_value = 0.9
        bsdf.inputs['Metallic'].default_value = 0.0
        tex_report[mat.name] = {'image': src_img.name, 'size': list(src_img.size), 'cutout': alpha_min < 0.5}
for o in glb_objs:
    bpy.data.objects.remove(o, do_unlink=True)
info['textures'] = tex_report
for img in bpy.data.images:
    if img.size[0] > TEX_PX:
        img.scale(TEX_PX, TEX_PX)

# one UV set per mesh, body decimated
tris0 = 0
for o in meshes:
    uvs = o.data.uv_layers
    while len(uvs) > 1:
        uvs.remove(uvs[len(uvs) - 1])
    tris0 += sum(len(p.vertices) - 2 for p in o.data.polygons)
body = max(meshes, key=lambda o: len(o.data.polygons))
activate([body], body)
mod = body.modifiers.new('dec', 'DECIMATE')
mod.decimate_type = 'COLLAPSE'
mod.ratio = BODY_RATIO
mod.use_collapse_triangulate = True
while body.modifiers[0] != mod:
    bpy.ops.object.modifier_move_up(modifier=mod.name)
bpy.ops.object.modifier_apply(modifier=mod.name)
info['trisBefore'] = tris0
info['trisAfter'] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)

# rest height
tgt.data.pose_position = 'REST'
vl.update()
dg = bpy.context.evaluated_depsgraph_get()
zs = []
for o in meshes:
    ev = o.evaluated_get(dg)
    co = np.empty(len(ev.data.vertices) * 3, np.float32); ev.data.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3) @ np.array(o.matrix_world.to_3x3()).T + np.array(o.matrix_world.translation)
    zs += [co[:, 2].min(), co[:, 2].max()]
info['height'] = round(float(max(zs) - min(zs)), 3)
info['groundZ'] = round(float(min(zs)), 4)

# ----------------------------------------------------- Idle + Stretch from the stand-in
src, actions = None, {}
for name, fname in (('Idle', 'Main Character.fbx'), ('Stretch', 'Arm-Stretching.fbx')):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fname), use_anim=True)
    added = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in added if o.type == 'ARMATURE')
    act = arm.animation_data.action
    act.name = 'src_' + name
    act.use_fake_user = True
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

set_action(tgt, None)
for pb in tgt.pose.bones:
    pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.rotation_euler = (0, 0, 0)
src.data.pose_position = 'REST'
vl.update()
Ws, Wt = src.matrix_world.copy(), tgt.matrix_world.copy()
Wt_rot_inv = Wt.to_quaternion().inverted()
Wt_inv = Wt.inverted()
rest_s = {b.name: (Ws @ b.matrix_local) for b in src.data.bones}
rest_t_world = {b.name: (Wt @ b.matrix_local) for b in tgt.data.bones}
ratio = (rest_t_world[HIPS].translation.z - info['groundZ']) / rest_s[HIPS].translation.z
info['hipRatio'] = round(ratio, 4)
# rest-pose correction: the two rigs rest in different postures (this one in an A-pose, the
# source in a T-pose). For each bone, the rotation that turns the target's rest direction onto
# the source's rest direction is applied before the source motion, so limbs follow the source
# bone DIRECTIONS rather than its raw rotation from a different starting pose.
def ydir(M):
    return (M.to_3x3() @ Vector((0, 1, 0))).normalized()
align = {}
for b in tgt.data.bones:
    if b.name in rest_s:
        align[b.name] = ydir(rest_t_world[b.name]).rotation_difference(ydir(rest_s[b.name]))
src.data.pose_position = 'POSE'
tgt.data.pose_position = 'POSE'

order = sorted(tgt.data.bones, key=lambda b: len(b.parent_recursive))
for pb in tgt.pose.bones:
    pb.rotation_mode = 'QUATERNION'
info['bonesMatched'] = f"{sum(1 for b in order if b.name in src.data.bones)}/{len(order)}"

out_actions = {'Walk': walk}
for name, act in actions.items():
    set_action(src, act)
    a0, a1 = (int(v) for v in act.frame_range)
    new_act = bpy.data.actions.new(name)
    new_act.use_fake_user = True
    set_action(tgt, new_act)
    for f in range(a0, a1 + 1):
        scene.frame_set(f)
        pose_arm = {}
        for b in order:
            n = b.name
            R = b.matrix_local
            par = b.parent
            chain = pose_arm[par.name] @ (par.matrix_local.inverted() @ R) if par is not None else R.copy()
            if n in src.pose.bones:
                Ms = Ws @ src.pose.bones[n].matrix
                delta = Ms.to_quaternion() @ rest_s[n].to_quaternion().inverted()
                q_arm = Wt_rot_inv @ (delta @ align[n] @ rest_t_world[n].to_quaternion())
            else:
                q_arm = chain.to_quaternion()
            pos = chain.translation.copy()
            if n == HIPS:
                hs = (Ws @ src.pose.bones[n].matrix).translation
                world = rest_t_world[n].translation + (hs - rest_s[n].translation) * ratio
                pos = Wt_inv @ world
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
    print('retargeted', name, a0, a1, flush=True)
bpy.data.objects.remove(src, do_unlink=True)

# ------------------------------------------------------------------- previews
prev_dir = os.path.abspath(os.path.join('.cache', 'gorilla-char'))
os.makedirs(prev_dir, exist_ok=True)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.8
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (0.9, 0, 0.5)
scene.collection.objects.link(sun)
scene.world = bpy.data.worlds.new('w'); scene.world.use_nodes = True; scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.7
scene.render.engine = 'CYCLES'; scene.cycles.samples = 8; scene.cycles.use_denoising = False
scene.render.resolution_x, scene.render.resolution_y = 420, 600
scene.render.image_settings.file_format = 'JPEG'
def shot(path, deg):
    ang = math.radians(deg)
    cam.location = (math.sin(ang) * 6, -math.cos(ang) * 6, 1.1)
    cam.rotation_euler = (math.radians(90), 0, ang)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
for name, frames in (('Idle', (1,)), ('Walk', (1, 9, 17)), ('Stretch', (60, 120))):
    set_action(tgt, out_actions[name])
    for f in frames:
        scene.frame_set(f)
        shot(os.path.join(prev_dir, f'{name}-{f:03d}-front.jpg'), 0)
        shot(os.path.join(prev_dir, f'{name}-{f:03d}-side.jpg'), -90)

# --------------------------------------------------------------------- export
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
activate([tgt] + meshes, tgt)
os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, 'gus-character.glb')
bpy.ops.export_scene.gltf(
    filepath=path, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_optimize_animation_size=False,
    export_skins=True, export_yup=True, export_apply=False, export_materials='EXPORT',
    export_image_format='WEBP', export_image_quality=88,
)
info['glbBytes'] = os.path.getsize(path)
json.dump(info, open(os.path.join(OUT, 'gus-character.meta.json'), 'w'), indent=2)
print('META ' + json.dumps(info))
