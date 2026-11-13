"""Mountain FBX (Sand_mount.fbx, mountain-new.fbx)  ->  browser-ready mountain assets.

The source is a 5.18M-triangle photogrammetry scan with vertex colours, no UVs and no
textures. This script keeps the original shape and look but makes it web-sized:

  1. bakes the per-vertex colours into a top-down colour texture (a mesh without vertex
     colours gets a placeholder sand colour from height and slope instead)
  2. bakes the full-resolution surface detail into an object-space normal map
  3. decimates the original mesh (collapse) into a desktop LOD and a mobile LOD
  4. gives both LODs planar UVs that match the two textures
  5. writes bounds + a preview image so routes and cameras can be planned

Run with Blender 4.4+/5.x or the `bpy` PyPI module:
    blender -b -P scripts/convert_mountain.py -- assets/Sand_mount.fbx public
    python     scripts/convert_mountain.py    assets/Sand_mount.fbx public

The source FBX is only read.
"""
import bpy, sys, os, json, time
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SRC, PUB = argv[0], argv[1]
COLOR_RES, DETAIL_RES = 2048, 1024
LODS = [("mountain", 320_000), ("mountain-lite", 70_000)]  # (file name, target triangles)

t0 = time.time()
def log(*a): print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
ob = next(o for o in bpy.data.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
nv, nl = len(me.vertices), len(me.loops)
log("imported", ob.name, "verts", nv, "tris", len(me.polygons))

co = np.empty(nv * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
if len(me.color_attributes):
    attr = me.color_attributes[0]
    log("colour attribute", attr.name, attr.domain, attr.data_type)
    n_el = nv if attr.domain == 'POINT' else nl
    col = np.empty(n_el * 4, np.float32); attr.data.foreach_get("color", col); col = col.reshape(-1, 4)[:, :3]
    if attr.domain != 'POINT':
        li = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", li)
        vc = np.zeros((nv, 3), np.float32); vc[li] = col; col = vc
    # Blender hands colours back linear; textures are stored sRGB
    col = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(np.clip(col, 1e-9, None), 1 / 2.4) - 0.055).astype(np.float32)
else:
    # no vertex colours (the mesh's own image textures are not embedded): placeholder sand,
    # darker on steep gully walls and low ground, lighter on ridge tops
    vn = np.empty(nv * 3, np.float32); me.vertices.foreach_get("normal", vn); vn = vn.reshape(-1, 3)
    h = (co[:, 2] - co[:, 2].min()) / max(float(np.ptp(co[:, 2])), 1e-6)
    steep = np.clip((0.97 - np.abs(vn[:, 2])) / 0.35, 0, 1)
    sand, rock, crest = np.array([0.74, 0.62, 0.48]), np.array([0.45, 0.35, 0.28]), np.array([0.86, 0.76, 0.62])
    base = sand + (crest - sand) * np.clip((h - 0.45) / 0.55, 0, 1)[:, None]
    col = (base + (rock - base) * steep[:, None]).astype(np.float32)
    log("no vertex colours: placeholder colour from height + slope")

mn, mx = co.min(0), co.max(0)
size = mx - mn
log("bounds min", mn.round(3), "max", mx.round(3), "size", size.round(3))

# how heightfield-like is the scan? (share of faces pointing downward)
pn = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get("normal", pn); pn = pn.reshape(-1, 3)
log("faces with downward normal: %.3f%%" % (100 * float((pn[:, 2] < 0).mean())),
    "steeper than 60deg: %.2f%%" % (100 * float((pn[:, 2] < 0.5).mean())))
del pn

def cell(res):
    u = np.clip(((co[:, 0] - mn[0]) / size[0] * res).astype(np.int32), 0, res - 1)
    v = np.clip(((co[:, 1] - mn[1]) / size[1] * res).astype(np.int32), 0, res - 1)
    return v * res + u

def splat_mean(res, values):
    idx = cell(res)
    cnt = np.bincount(idx, minlength=res * res).astype(np.float32)
    out = np.stack([np.bincount(idx, weights=values[:, k], minlength=res * res) for k in range(values.shape[1])], -1)
    has = cnt > 0
    out[has] /= cnt[has, None]
    return out.reshape(res, res, -1).astype(np.float32), has.reshape(res, res)

def pyramid_fill(res, values):
    """Mean of the vertices in each cell; empty cells are filled from coarser levels."""
    img, has = splat_mean(res, values)
    r = res
    while not has.all() and r > 4:
        r //= 2
        low, lhas = splat_mean(r, values)
        k = res // r
        up = np.repeat(np.repeat(low, k, 0), k, 1)
        uph = np.repeat(np.repeat(lhas, k, 0), k, 1)
        take = ~has & uph
        img[take] = up[take]
        has |= take
    return img, has

def save_image(path, rgb, fmt, non_color=False, quality=90):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new("tmp", w, h, alpha=False)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    px = np.ones((h, w, 4), np.float32); px[..., :3] = rgb
    img.pixels.foreach_set(px.ravel())
    s = bpy.context.scene.render.image_settings
    try:
        s.media_type = 'IMAGE'
    except Exception:
        pass
    s.file_format = fmt; s.color_mode = 'RGB'; s.quality = quality
    bpy.context.scene.view_settings.view_transform = 'Standard'
    img.save_render(path, scene=bpy.context.scene) if not non_color else None
    if non_color:  # bypass colour management entirely for data textures
        img.filepath_raw = path; img.file_format = fmt; img.save()
    bpy.data.images.remove(img)

os.makedirs(os.path.join(PUB, "textures"), exist_ok=True)
os.makedirs(os.path.join(PUB, "models"), exist_ok=True)

# 1. colour texture ---------------------------------------------------------------
color, _ = pyramid_fill(COLOR_RES, col)
log("colour texture baked; mean sRGB", color.reshape(-1, 3).mean(0).round(3))

# 2. object-space normal map from the full-resolution surface ----------------------
hgt, has = pyramid_fill(DETAIL_RES, co[:, 2:3])
hgt = hgt[..., 0]
def blur(a):
    p = np.pad(a, 1, mode='edge')
    return (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:] + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9
hs = blur(hgt)
dzdy, dzdx = np.gradient(hs, size[1] / DETAIL_RES, size[0] / DETAIL_RES)
nrm = np.stack([-dzdx, -dzdy, np.ones_like(hs)], -1)
nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
# Blender (x, y, z-up)  ->  glTF / three.js (x, y-up, z) = (x, z, -y)
nrm_gl = np.stack([nrm[..., 0], nrm[..., 2], -nrm[..., 1]], -1)
log("detail normals baked")

save_image(os.path.join(PUB, "textures", "mountain-color.webp"), color, 'WEBP', quality=88)
save_image(os.path.join(PUB, "textures", "mountain-normal.webp"), nrm_gl * 0.5 + 0.5, 'WEBP', non_color=True, quality=92)

# preview for planning (top-down, +Y of the scan is up in the image)
shade = np.clip(0.25 + 0.9 * (nrm @ np.array([-0.5, 0.45, 0.74], np.float32)), 0, 1)
k = COLOR_RES // DETAIL_RES
prev = color.reshape(DETAIL_RES, k, DETAIL_RES, k, 3).mean((1, 3)) * shade[..., None] * 1.5
os.makedirs(os.path.join(os.path.dirname(PUB), ".cache"), exist_ok=True)
save_image(os.path.join(os.path.dirname(PUB), ".cache", "mountain-topdown.png"), np.clip(prev, 0, 1), 'PNG')
np.save(os.path.join(os.path.dirname(PUB), ".cache", "height1024.npy"), hgt)

meta = {
    "source": os.path.basename(SRC),
    "sourceTriangles": len(me.polygons),
    "boundsBlender": {"min": [float(v) for v in mn], "max": [float(v) for v in mx]},
    # three.js space (Y-up):  x = x, y = z, z = -y
    "boundsThree": {"min": [float(mn[0]), float(mn[2]), float(-mx[1])], "max": [float(mx[0]), float(mx[2]), float(-mn[1])]},
    "lods": {},
}
del co, col, color

# 3 + 4. decimate, UV, export ------------------------------------------------------
mat = bpy.data.materials.new("Mountain")
total = len(me.polygons)
for name, target in LODS:
    mod = ob.modifiers.new("dec", 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = min(1.0, target / total)
    dg = bpy.context.evaluated_depsgraph_get()
    new_me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    ob.modifiers.remove(mod)
    for a in list(new_me.color_attributes):
        new_me.color_attributes.remove(a)
    n = len(new_me.vertices)
    vco = np.empty(n * 3, np.float32); new_me.vertices.foreach_get("co", vco); vco = vco.reshape(-1, 3)
    li = np.empty(len(new_me.loops), np.int32); new_me.loops.foreach_get("vertex_index", li)
    uv = np.stack([(vco[li, 0] - mn[0]) / size[0], (vco[li, 1] - mn[1]) / size[1]], -1).astype(np.float32)
    layer = new_me.uv_layers.new(name="UVMap")
    layer.data.foreach_set("uv", uv.ravel())
    new_me.materials.clear(); new_me.materials.append(mat)
    new_me.polygons.foreach_set("use_smooth", np.ones(len(new_me.polygons), bool))
    new_me.update()
    lod = bpy.data.objects.new("Mountain", new_me)
    bpy.context.scene.collection.objects.link(lod)
    bpy.ops.object.select_all(action='DESELECT')
    lod.select_set(True)
    out = os.path.join(os.path.dirname(PUB), ".cache", name + ".raw.glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_animations=False, export_materials='EXPORT',
                              export_normals=True, export_texcoords=True)
    meta["lods"][name] = {"triangles": len(new_me.polygons), "vertices": n}
    log("exported", name, len(new_me.polygons), "tris", round(os.path.getsize(out) / 1e6, 2), "MB")
    bpy.data.objects.remove(lod)

with open(os.path.join(PUB, "models", "mountain.meta.json"), "w") as f:
    json.dump(meta, f, indent=2)
log("done")
