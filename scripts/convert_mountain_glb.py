"""Textured mountain GLB (mountain-new-latest.glb)  ->  browser-ready mountain assets.

The source is a photogrammetry mountain with its own UVs and 8K colour / normal / ORM
textures. This script keeps its material and look but makes it web-sized:

  1. optionally (--skirt) extrudes the open border straight down to the lowest point
  2. stores an "edge" vertex colour (1 at the border, 0 inside); the site fades the border
     into the ground colour with it
  3. downsizes the textures (desktop 4096 colour + 2048 data maps, lite 2048 / 1024) to WebP
  4. writes a desktop LOD (full mesh) and a lite LOD (decimated)
  5. writes mountain.meta.json with bounds, the summit and the southern foot for planning

Run with Blender 4.4+/5.x or the `bpy` PyPI module:
    blender -b -P scripts/convert_mountain_glb.py -- assets/mountain-new-latest.glb public
    python     scripts/convert_mountain_glb.py    assets/mountain-new-latest.glb public
then `npm run assets:optimize`. The source file is only read.
"""
import bpy, bmesh, sys, os, json
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SRC, PUB = argv[0], argv[1]
SKIRT = '--skirt' in argv      # extrude the border down to the lowest point (off: the site sinks the border into the ground plane instead)
CACHE = os.path.join(os.path.dirname(os.path.abspath(PUB)), ".cache")
EDGE_BAND = 0.05          # source units over which the border fades to ground colour
LODS = [("mountain", None, 4096, 2048), ("mountain-lite", 40_000, 2048, 1024)]
os.makedirs(CACHE, exist_ok=True)
os.makedirs(os.path.join(PUB, "models"), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ob = next(o for o in bpy.data.objects if o.type == 'MESH')
for o in list(bpy.data.objects):
    if o is not ob:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
print("imported", ob.name, "verts", len(me.vertices), "tris", sum(len(p.vertices) - 2 for p in me.polygons))

co = np.array([v.co[:] for v in me.vertices])
mn, mx = co.min(0), co.max(0)
summit = co[co[:, 2].argmax()]

# ---------------------------------------------------------- skirt + edge colour
bm = bmesh.new(); bm.from_mesh(me)
# glTF stores every triangle with its own vertices: weld them (UVs live on the corners and survive)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
bm.verts.ensure_lookup_table(); bm.verts.index_update()
border = [v for v in bm.verts if v.is_boundary]
border_xy = np.array([(v.co.x, v.co.y) for v in border])
kd = KDTree(len(border))
for i, v in enumerate(border):
    kd.insert(Vector((v.co.x, v.co.y, 0)), i)
kd.balance()
border_z = np.array([v.co.z for v in border])
floor_z = float(mn[2]) - 0.01

col_layer = bm.loops.layers.color.new("Edge")
edge_val = {}
for v in bm.verts:
    _, _, d = kd.find(Vector((v.co.x, v.co.y, 0)))
    t = min(d / EDGE_BAND, 1.0)
    edge_val[v.index] = 1.0 - t * t * (3 - 2 * t)          # 1 at the border, 0 inside
for f in bm.faces:
    for l in f.loops:
        e = edge_val[l.vert.index]
        l[col_layer] = (e, e, e, 1.0)

if SKIRT:
    border_edges = [e for e in bm.edges if e.is_boundary]
    res = bmesh.ops.extrude_edge_only(bm, edges=border_edges)
    for g in res["geom"]:
        if isinstance(g, bmesh.types.BMVert):
            g.co.z = floor_z
        elif isinstance(g, bmesh.types.BMFace):
            for l in g.loops:
                l[col_layer] = (1.0, 1.0, 1.0, 1.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.to_mesh(me); bm.free()
ca = me.color_attributes["Edge"]
me.color_attributes.active_color = ca          # the glTF exporter writes the active colour layer as COLOR_0
try:
    me.color_attributes.render_color_index = me.color_attributes.find("Edge")
except Exception:
    pass
for p in me.polygons:
    p.use_smooth = True
me.update()
print("skirt: border verts", len(border), "border z range", border_z.min().round(3), border_z.max().round(3))

# the photogrammetry UV islands touch the border: copy the colour of the edge texel downward
# (the extruded loops already carry the UVs of the border they came from)

# ----------------------------------------------------- southern foot (planning)
# glTF / three: x = x, y = z, z = -y.  "South" = -y in Blender = +z in three = toward the camera
south = []
for x in np.linspace(mn[0], mx[0], 25):
    ys = border_xy[np.abs(border_xy[:, 0] - x) < (mx[0] - mn[0]) / 50, 1]
    if len(ys):
        south.append([round(float(x), 3), round(float(ys.min()), 3)])

meta = {
    "source": os.path.basename(SRC),
    "boundsBlender": {"min": mn.round(4).tolist(), "max": mx.round(4).tolist()},
    "summitBlender": summit.round(4).tolist(),
    "southBorderBlender": south,
    "floorZ": floor_z,
    "lods": {},
}

# ------------------------------------------------------------------ textures
mat = me.materials[0]
images = {}
for n in mat.node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image:
        role = 'color' if any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links) else 'data'
        images[n.image.name] = (n.image, role)
originals = {name: np.array(img.pixels[:], np.float32) for name, (img, _) in images.items()}
sizes = {name: tuple(img.size) for name, (img, _) in images.items()}

# ---------------------------------------------------------------- LOD export
total = len(me.polygons)
for name, target, color_px, data_px in LODS:
    for iname, (img, role) in images.items():
        w0, h0 = sizes[iname]
        img.scale(w0, h0)
        img.pixels.foreach_set(originals[iname])
        px = color_px if role == 'color' else data_px
        img.scale(px, px)
    lod_me = me.copy()
    lod = bpy.data.objects.new("Mountain", lod_me)
    bpy.context.scene.collection.objects.link(lod)
    if target and target < total:
        mod = lod.modifiers.new("dec", 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = target / total
        mod.use_collapse_triangulate = True
    bpy.ops.object.select_all(action='DESELECT')
    lod.select_set(True)
    out = os.path.join(CACHE, name + ".raw.glb")
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
        export_animations=False, export_materials='EXPORT', export_normals=True, export_texcoords=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_image_format='WEBP', export_image_quality=86,
    )
    dg = bpy.context.evaluated_depsgraph_get()
    tris = sum(len(p.vertices) - 2 for p in lod.evaluated_get(dg).data.polygons)
    meta["lods"][name] = {"triangles": tris, "textures": [color_px, data_px]}
    print("exported", name, tris, "tris", round(os.path.getsize(out) / 1e6, 2), "MB")
    bpy.data.objects.remove(lod)

# ground colour suggestion: average texture colour along the border
img_c = next(img for img, role in images.values() if role == 'color')
img_c.scale(*sizes[img_c.name]); img_c.pixels.foreach_set(originals[img_c.name]); img_c.scale(512, 512)
px = np.array(img_c.pixels[:], np.float32).reshape(512, 512, 4)
uv = me.uv_layers.active.data
samples = []
for poly in me.polygons:
    for li in poly.loop_indices:
        if me.attributes["Edge"].data[li].color[0] > 0.9:
            u, v = uv[li].uv
            samples.append(px[min(int(v * 511), 511), min(int(u * 511), 511), :3])
lin = np.mean(samples, 0)
srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
meta["borderColorSRGB"] = "#" + "".join(f"{int(round(c * 255)):02x}" for c in np.clip(srgb, 0, 1))
with open(os.path.join(PUB, "models", "mountain.meta.json"), "w") as f:
    json.dump(meta, f, indent=2)
print("META", json.dumps({k: meta[k] for k in ("boundsBlender", "summitBlender", "borderColorSRGB", "lods")}))
print("SOUTH", meta["southBorderBlender"])
