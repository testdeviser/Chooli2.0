"""Gus in T-pose from ONE front view (references/gus/tpose-clean.webp) -> textured GLB.

Width of every part comes from the image; depth is estimated (there is no side or back view).
The back of the model reuses the front fur (with the face and toes replaced by plain fur).

    python -I scripts/gus/tpose.py references/gus/tpose-clean.webp .cache/gus-tpose assets/gus-tpose
"""
import bpy, numpy as np, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SRC, WORK, OUT = sys.argv[-3:]
os.makedirs(WORK, exist_ok=True); os.makedirs(OUT, exist_ok=True)
V, SIZE = 0.008, 2048
ARM_X = 0.33                      # where the arms leave the torso
NECK_Z, CROTCH_Z, WRIST_X = 1.74, 0.99, 1.03


def grow(m, n):
    for _ in range(n):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m

# ------------------------------------------------------------ image clean-up
rgb = load_rgb(SRC)
Himg, Wimg = rgb.shape[:2]
mx, mn = rgb.max(2), rgb.min(2)
sat = (mx - mn) / np.maximum(mx, 1e-4)
fur = (sat > 0.25) & (rgb[..., 0] > rgb[..., 2] + 0.06)          # brown only: black line art is not fur
solid = ~grow(~grow(fur, 6), 6)                                  # close the cuts the line art makes
r0, r1 = bbox_rows(solid, 20)
sf = HEIGHT / (r1 - r0)
zrow = lambda r: (r1 - r) * sf
rowz = lambda z: int(round(r1 - z / sf))
mids = []
for r in range(rowz(2.1), rowz(1.9)):
    c = np.where(solid[r])[0]
    mids.append((c[0] + c[-1]) / 2)
xc = float(np.median(mids))
rows_z = zrow(np.arange(Himg))[:, None]
cols_x = ((np.arange(Wimg) - xc) * sf)[None, :]

face = (rows_z > 1.80) & (np.abs(cols_x) < 0.17)
line = np.zeros_like(solid)                                      # the clean view has no marker lines to paint out
keep = ~grow(~solid, 2) & ~line & (grow(fur, 1) | face)        # white between the legs is background, teeth are not
col = rgb * keep[..., None]
filled = keep.copy()
for _ in range(170):
    acc = np.zeros_like(col); cnt = np.zeros((Himg, Wimg), np.float32)
    for ax, d in ((0, 1), (0, -1), (1, 1), (1, -1)):
        acc += np.roll(col, d, ax); cnt += np.roll(filled, d, ax)
    new = ~filled & (cnt > 0)
    col[new] = acc[new] / cnt[new, None]
    filled |= new
col[~filled] = rgb[keep].mean(0)

# back view: same fur, but the face and the toes are replaced with plain fur from chest / shin
back = col.copy()
rn, rt = rowz(NECK_Z), r0
src_r = np.linspace(rowz(1.66), rowz(1.26), rn - rt).astype(int)
cc = np.clip((xc + (np.arange(Wimg) - xc) * 0.55).astype(int), 0, Wimg - 1)
back[rt:rn] = col[src_r][:, cc]
back[:rt] = back[rt]
rf = rowz(0.15)
src_r = np.linspace(rowz(0.5), rowz(0.3), r1 - rf).astype(int)
back[rf:r1] = col[src_r]
back[r1:] = back[r1 - 1]

def to_image(name, arr):
    img = bpy.data.images.new(name, Wimg, Himg, alpha=False)
    px = np.ones((Himg, Wimg, 4), np.float32); px[..., :3] = arr[::-1]
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.abspath(os.path.join(WORK, name + '.png')); img.file_format = 'PNG'; img.save()
    return img

# ------------------------------------------------------------------ voxels
X0, X1, Y0, Y1 = -1.34, 1.34, -0.5, 0.42
nx, ny, nz = int((X1 - X0) / V), int((Y1 - Y0) / V), int(HEIGHT / V) + 3
xs = X0 + (np.arange(nx) + 0.5) * V
ys = Y0 + (np.arange(ny) + 0.5) * V
zs = (np.arange(nz) + 0.5) * V
occ = np.zeros((nx, ny, nz), bool)
XX, YY = np.meshgrid(xs, ys, indexing='ij')

def blob(cx, a, yb, yf, power=2.0):
    cy = (yb + yf) / 2
    u = np.abs(XX - cx) / max(a, 1e-4)
    w = np.abs(YY - cy) / max((yb - yf) / 2, 1e-4)
    return u ** power + w ** power <= 1.0

# arm height band, measured where the silhouette is outside the torso
arm_cols = np.where(np.abs(cols_x[0]) > 0.6)[0]
arm_rows = np.where(solid[:, arm_cols].any(1))[0]
arm_z = zrow((arm_rows[0] + arm_rows[-1]) / 2)
band = (arm_z - 0.24, arm_z + 0.24)
report = {'armZ': round(arm_z, 3), 'slices': []}

for k, z in enumerate(zs):
    r = rowz(z)
    if r < r0 or r >= r1:
        continue
    row = solid[r].copy()
    if band[0] < z < band[1]:
        row &= np.abs(cols_x[0]) <= ARM_X
    if z > CROTCH_Z:                         # torso / head: no holes (teeth, eyes)
        c = np.where(row)[0]
        if len(c):
            row[c[0]:c[-1] + 1] = True
    sl = np.zeros((nx, ny), bool)
    segs = [((a - xc) * sf, (b - xc) * sf) for a, b in runs(row, merge_gap=14)]
    for x0, x1 in segs:
        cx, hw = (x0 + x1) / 2, (x1 - x0) / 2
        if x0 < 0 < x1 and z > CROTCH_Z - 0.06:
            if z > NECK_Z:                       # head
                sl |= blob(cx, hw, 0.92 * hw + 0.02, -0.98 * hw)
            else:                                # torso
                d = min(0.72 * hw, 0.25)
                sl |= blob(cx, hw, d + 0.02, -d, power=2.3)
        elif abs(cx) < 0.6:                      # leg / foot
            t = float(np.clip((0.22 - z) / 0.22, 0, 1)) ** 0.8
            hip = float(np.clip((z - (CROTCH_Z - 0.4)) / 0.4, 0, 1))
            d = min(hw * 1.1, 0.2) * (1 - hip) + 0.215 * hip          # thighs widen into the hips, no ledge
            sl |= blob(cx, hw, d + 0.03 * t, -d - (0.36 - d) * t, power=2.3)
    occ[:, :, k] = sl
    if k % 14 == 0:
        report['slices'].append([round(float(z), 2), [[round(a, 2), round(b, 2)] for a, b in segs]])

# arms: one cross-section per column, round in the (depth, height) plane
ZZ, YYz = np.meshgrid(zs, ys, indexing='ij')     # [nz, ny]
for i, x in enumerate(xs):
    if abs(x) < ARM_X - 0.06:
        continue
    c = int(round(xc + x / sf))
    if c < 0 or c >= Wimg:
        continue
    colmask = solid[:, c]
    best = None
    for a, b in runs(colmask, merge_gap=10):
        z0, z1 = zrow(b), zrow(a)
        z0, z1 = max(z0, band[0]), min(z1, band[1])
        if z1 - z0 > 0.02 and (best is None or z1 - z0 > best[1] - best[0]):
            best = (z0, z1)
    if best is None:
        continue
    zc, rz = (best[0] + best[1]) / 2, (best[1] - best[0]) / 2
    hand = np.clip((abs(x) - WRIST_X) / 0.06, 0, 1)
    ry = min(rz * 0.95, 0.15) * (1 - hand) + 0.075 * hand        # hands are flat, palm down
    sec = ((ZZ - zc) / rz) ** 2 + (YYz / ry) ** 2 <= 1.0         # [nz, ny]
    occ[i] |= sec.T

f = occ.astype(np.float32)
for ax, n in ((0, 3), (1, 2), (2, 5)):
    for _ in range(n):
        f = (np.roll(f, 1, ax) + 2 * f + np.roll(f, -1, ax)) / 4
occ = f > 0.5
occ[:, :, 0] = False

p = np.pad(occ, 1)
quads = []
for ax in range(3):
    b_ax, c_ax = (ax + 1) % 3, (ax + 2) % 3
    for sign in (1, -1):
        idx = np.argwhere(p & ~np.roll(p, -sign, axis=ax)) - 1
        if sign == 1:
            idx[:, ax] += 1
        corners = [(0, 0), (1, 0), (1, 1), (0, 1)]
        q = []
        for cb, cc_ in (corners if sign == 1 else corners[::-1]):
            v = idx.copy(); v[:, b_ax] += cb; v[:, c_ax] += cc_
            q.append(v[:, 0] + (nx + 1) * (v[:, 1] + (ny + 1) * v[:, 2]))
        quads.append(np.stack(q, 1))
quads = np.concatenate(quads)
uniq, inv = np.unique(quads, return_inverse=True)
inv = inv.reshape(quads.shape)
co = np.stack([X0 + (uniq % (nx + 1)) * V, Y0 + ((uniq // (nx + 1)) % (ny + 1)) * V,
               (uniq // ((nx + 1) * (ny + 1))) * V], 1).astype(np.float32)

bpy.ops.wm.read_factory_settings(use_empty=True)
imgF, imgB = to_image('tpose-front-clean', col), to_image('tpose-back-fur', back)
me = bpy.data.meshes.new('GusTPose')
me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel())
me.loops.add(inv.size); me.loops.foreach_set('vertex_index', inv.ravel().astype(np.int32))
me.polygons.add(len(inv))
me.polygons.foreach_set('loop_start', np.arange(0, inv.size, 4, dtype=np.int32))
me.polygons.foreach_set('loop_total', np.full(len(inv), 4, np.int32))
me.update(calc_edges=True); me.validate()
ob = bpy.data.objects.new('GusTPose', me)
bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
m = ob.modifiers.new('Smooth', 'SMOOTH'); m.factor = 0.7; m.iterations = 14
m = ob.modifiers.new('Decimate', 'DECIMATE'); m.ratio = min(1.0, 60000 / (len(inv) * 2))
final = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
ob.modifiers.clear(); ob.data = final
for poly in final.polygons:
    poly.use_smooth = True

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')

# ------------------------------------------------------ projection + bake
mat = bpy.data.materials.new('Projection'); mat.use_nodes = True
nt = mat.node_tree; nt.nodes.clear(); N = nt.nodes.new
geo = N('ShaderNodeNewGeometry')
pos = N('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], pos.inputs[0])
nrm = N('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], nrm.inputs[0])

def mnode(op, a, b=None, c=None):
    n = N('ShaderNodeMath'); n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]

def sample(img, x_socket):
    comb = N('ShaderNodeCombineXYZ')
    nt.links.new(mnode('MULTIPLY_ADD', x_socket, 1 / (sf * Wimg), xc / Wimg), comb.inputs[0])
    nt.links.new(mnode('MULTIPLY_ADD', pos.outputs[2], 1 / (sf * Himg), 1 - r1 / Himg), comb.inputs[1])
    tex = N('ShaderNodeTexImage'); tex.image = img; tex.extension = 'EXTEND'
    nt.links.new(comb.outputs[0], tex.inputs[0])
    return tex.outputs[0]

X, Y, Z = pos.outputs
cF, cB = sample(imgF, X), sample(imgB, X)
# surfaces facing sideways would smear a single pixel column: wrap fur around them instead
leg = mnode('LESS_THAN', Z, CROTCH_Z)
centre = mnode('MULTIPLY', mnode('MULTIPLY', leg, mnode('SIGN', X)), 0.2)
cS = sample(imgB, mnode('MULTIPLY_ADD', Y, 0.55, centre))

def mix(a, b, fac):
    n = N('ShaderNodeMix'); n.data_type = 'RGBA'
    nt.links.new(fac, n.inputs['Factor']); nt.links.new(a, n.inputs['A']); nt.links.new(b, n.inputs['B'])
    return n.outputs['Result']

mr = N('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
mr.inputs['From Min'].default_value = -0.12; mr.inputs['From Max'].default_value = 0.12
nt.links.new(nrm.outputs[1], mr.inputs['Value'])
base = mix(cF, cB, mr.outputs['Result'])
inner = mnode('LESS_THAN', mnode('ABSOLUTE', X), 0.5)            # torso / legs / head only, not the arms
side_w = mnode('MULTIPLY', mnode('MINIMUM', mnode('MULTIPLY', mnode('POWER', mnode('ABSOLUTE', nrm.outputs[0]), 3.0), 1.4), 1.0), inner)
colour = mix(base, cS, side_w)
emit = N('ShaderNodeEmission'); nt.links.new(colour, emit.inputs[0])
outn = N('ShaderNodeOutputMaterial'); nt.links.new(emit.outputs[0], outn.inputs[0])
albedo = bpy.data.images.new('gus-tpose-albedo', SIZE, SIZE, alpha=False)
target = N('ShaderNodeTexImage'); target.image = albedo
nt.nodes.active = target; target.select = True
final.materials.append(mat)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
sc.render.bake.margin = 12
bpy.ops.object.bake(type='EMIT')
albedo.filepath_raw = os.path.abspath(os.path.join(OUT, 'gus-tpose-albedo.png')); albedo.file_format = 'PNG'; albedo.save()

a = np.empty(SIZE * SIZE * 4, np.float32); albedo.pixels.foreach_get(a)
lum = (a.reshape(SIZE, SIZE, 4)[..., :3] * (0.3, 0.55, 0.15)).sum(2)
def blur(x, n):
    for _ in range(n):
        for ax in (0, 1):
            x = (np.roll(x, 1, ax) + 2 * x + np.roll(x, -1, ax)) / 4
    return x
hgt = blur(lum, 2) - blur(lum, 24)
dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
nmap = np.stack([-dx * 9, -dy * 9, np.ones_like(dx)], 2)
nmap /= np.linalg.norm(nmap, axis=2, keepdims=True)
px = np.ones((SIZE, SIZE, 4), np.float32); px[..., :3] = nmap * 0.5 + 0.5
normal = bpy.data.images.new('gus-tpose-normal', SIZE, SIZE, alpha=False)
normal.colorspace_settings.name = 'Non-Color'
normal.pixels.foreach_set(px.ravel())
normal.filepath_raw = os.path.abspath(os.path.join(OUT, 'gus-tpose-normal.png')); normal.file_format = 'PNG'; normal.save()

gm = bpy.data.materials.new('Gus'); gm.use_nodes = True
ft = gm.node_tree; bsdf = ft.nodes['Principled BSDF']
t1 = ft.nodes.new('ShaderNodeTexImage'); t1.image = albedo
t2 = ft.nodes.new('ShaderNodeTexImage'); t2.image = normal
nm = ft.nodes.new('ShaderNodeNormalMap')
ft.links.new(t1.outputs[0], bsdf.inputs['Base Color'])
ft.links.new(t2.outputs[0], nm.inputs['Color']); ft.links.new(nm.outputs[0], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.88
final.materials.clear(); final.materials.append(gm)

vs = np.array([v.co[:] for v in final.vertices])
report.update({'scale_m_per_px': sf, 'bounds': [vs.min(0).round(3).tolist(), vs.max(0).round(3).tolist()],
               'tris': sum(len(p_.vertices) - 2 for p_ in final.polygons)})
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'gus-tpose.glb'), export_format='GLB', use_selection=True,
                          export_animations=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=90)
report['glbBytes'] = os.path.getsize(os.path.join(OUT, 'gus-tpose.glb'))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(OUT, 'gus-tpose.blend')))

cam = preview_setup((760, 760), 16)
cam.data.ortho_scale = 2.9
for name, deg in (('front', 0), ('tq', -40), ('side', -90), ('back', 180)):
    ang = math.radians(deg)
    cam.location = (math.sin(ang) * 8, -math.cos(ang) * 8, 1.12)
    cam.rotation_euler = (math.radians(90), 0, ang)
    sc.render.filepath = os.path.join(WORK, f'tpose-{name}.jpg')
    bpy.ops.render.render(write_still=True)
print('TPOSE', json.dumps(report))
