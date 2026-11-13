"""Main Character.fbx + Walking.fbx  ->  public/models/character.glb

Clips written to the GLB:
  Idle  - the clip that ships inside Main Character.fbx (standing)
  Walk  - Walking.fbx, converted to an in-place cycle (linear root motion removed from
          the hips) so the website can drive world translation from scroll progress.
  Stretch - Arm-Stretching.fbx (played once when Gus introduces himself)

The measured stride (metres travelled per walk cycle) is written to character.meta.json;
the site uses it to advance the walk cycle by distance, which is what prevents foot sliding.

Run with Blender 4.4+/5.x or the `bpy` PyPI module:
    blender -b -P scripts/build_character.py -- assets public/models
    python     scripts/build_character.py    assets public/models

The source FBX files are only read.
"""
import bpy, sys, os, json
from bpy_extras import anim_utils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SRC, OUT = argv[0], argv[1]
CLIPS = [("Idle", "Main Character.fbx", False), ("Walk", "Walking.fbx", True), ("Stretch", "Arm-Stretching.fbx", False)]
HIPS = "mixamorig:Hips"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
main_arm, main_bones, actions, meta = None, None, {}, {"clips": {}}

def hips_world(arm):
    return (arm.matrix_world @ arm.pose.bones[HIPS].matrix).translation.copy()

for name, fname, in_place in CLIPS:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, fname), use_anim=True)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    act = arm.animation_data.action
    act.name = name
    act.use_fake_user = True
    actions[name] = act
    f0, f1 = (int(v) for v in act.frame_range)
    info = {"file": fname, "frames": f1 - f0, "seconds": round((f1 - f0) / 30.0, 4)}

    bones = {b.name: round(b.length, 5) for b in arm.data.bones}
    if main_arm is None:
        main_arm, main_bones = arm, bones
        meta["bones"] = len(bones)
        meta["height"] = round(max((arm.matrix_world @ b.head_local).z for b in arm.data.bones), 3)
    else:
        assert bones.keys() == main_bones.keys(), f"{fname}: bone names differ from the main character"
        worst = max(abs(bones[b] - main_bones[b]) for b in bones)
        assert worst < 1e-3, f"{fname}: bone lengths differ ({worst})"
        info["skeletonMatch"] = True

    if in_place:
        scene.frame_set(f0); a = hips_world(arm)
        scene.frame_set(f1); b = hips_world(arm)
        d = b - a
        info["rootMotion"] = [round(v, 4) for v in d]                 # Blender world, metres
        info["stride"] = round((d.x ** 2 + d.y ** 2) ** 0.5, 4)       # metres per cycle
        slot = act.slots[0]
        for fc in anim_utils.action_get_channelbag_for_slot(act, slot).fcurves:
            if fc.data_path == f'pose.bones["{HIPS}"].location':
                v0, v1 = fc.evaluate(f0), fc.evaluate(f1)
                k = (v1 - v0) / (f1 - f0)
                for kp in fc.keyframe_points:
                    kp.handle_left.y -= k * (kp.handle_left.x - f0)
                    kp.handle_right.y -= k * (kp.handle_right.x - f0)
                    kp.co.y -= k * (kp.co.x - f0)
                fc.update()
        scene.frame_set(f0); a = hips_world(arm)
        scene.frame_set(f1); b = hips_world(arm)
        info["residualAfterInPlace"] = round((b - a).length, 5)
        # foot contact report: which phase each foot is planted (lowest)
        rows = []
        for i in range(8):
            scene.frame_set(round(f0 + (f1 - f0) * i / 8))
            l = (arm.matrix_world @ arm.pose.bones["mixamorig:LeftToeBase"].matrix).translation
            r = (arm.matrix_world @ arm.pose.bones["mixamorig:RightToeBase"].matrix).translation
            rows.append([round(i / 8, 3), round(l.z, 3), round(r.z, 3), round(l.y, 3), round(r.y, 3)])
        info["phase_Lz_Rz_Ly_Ry"] = rows
    if not in_place:
        # how far the hips drift over the clip (an in-place clip should be ~0)
        scene.frame_set(f0); a = hips_world(arm)
        scene.frame_set(f1); b = hips_world(arm)
        info["hipsDrift"] = [round(v, 4) for v in (b - a)]
    meta["clips"][name] = info

    if arm is not main_arm:
        arm.animation_data.action = None
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)

# one NLA track per clip -> the glTF exporter writes one named animation per track
ad = main_arm.animation_data
ad.action = None
for name, _, _ in CLIPS:
    tr = ad.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, int(actions[name].frame_range[0]), actions[name]); st.name = name
    try:
        st.action_slot = actions[name].slots[0]
    except Exception:
        pass
scene.frame_set(1)
main_arm.name = "CharacterRig"

os.makedirs(OUT, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "character.glb"), export_format='GLB',
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_optimize_animation_size=False,
    export_skins=True, export_yup=True, export_apply=False, export_materials='EXPORT',
)
with open(os.path.join(OUT, "character.meta.json"), "w") as f:
    json.dump(meta, f, indent=2)
print("META " + json.dumps(meta))
