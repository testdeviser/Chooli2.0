"""Stage 1 - Gus body mesh from the front and side reference views.

Every horizontal slice of the body is rebuilt from the silhouettes: the front view gives the
width of each part (torso, arms, legs) and the side view gives its depth. The slices are
unioned in a voxel grid and turned into a smooth mesh.

    python -I scripts/gus/shape.py references/gus .cache/gus
"""
import bpy, numpy as np, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

REF, OUT = sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
V = 0.008  # voxel size, metres

# ---------------------------------------------------------------- front view
front = figure_mask(load_rgb(os.path.join(REF, 'front.webp')))
r0, r1 = bbox_rows(front)
sf = HEIGHT / (r1 - r0)                      # metres per pixel
zrow = lambda r: (r1 - r) * sf
rowz = lambda z: int(round(r1 - z / sf))

# symmetry axis from the head
mids = []
for r in range(rowz(2.1), rowz(1.85)):
    c = np.where(front[r])[0]
    if len(c):
        mids.append((c[0] + c[-1]) / 2)
xc = float(np.median(mids))

# ----------------------------------------------------------------- side view
side = figure_mask(load_rgb(os.path.join(REF, 'side.webp')))
s0, s1 = bbox_rows(side)
ss = HEIGHT / (s1 - s0)
nS = s1 - s0
yb_px, yf_px = np.zeros(nS), np.zeros(nS)
for i, r in enumerate(range(s0, s1)):
    c = np.where(side[r])[0]
    yb_px[i], yf_px[i] = (c[0], c[-1]) if len(c) else (np.nan, np.nan)
zs = (s1 - np.arange(s0, s1)) * ss           # height of each side row
torso = (zs > 1.15) & (zs < 1.6)
c0 = float(np.nanmedian((yb_px[torso] + yf_px[torso]) / 2))
# model: character faces -Y. side image faces right, so larger column = more negative y
y_back = -(yb_px - c0) * ss                  # positive
y_front = -(yf_px - c0) * ss                 # negative
# the forearm and fist hide the belly/hip line in the side view: bridge across them
za, zb = 1.30, 0.64
ia, ib = int(np.argmin(abs(zs - za))), int(np.argmin(abs(zs - zb)))
t = np.linspace(0, 1, ib - ia)
y_front[ia:ib] = y_front[ia] * (1 - t) + y_front[ib] * t - 0.03 * np.sin(np.pi * t)
y_back, y_front = smooth1d(y_back, 4), smooth1d(y_front, 3)
y_front_soft = smooth1d(y_front, 45)         # profile without nose / brow, used away from the centre line

def side_at(z):
    i = int(np.clip(np.argmin(abs(zs - z)), 0, nS - 1))
    return y_back[i], y_front[i], y_front_soft[i]

# ---------------------------------------------------------------- voxel fill
X0, X1, Y0, Y1 = -0.66, 0.66, -0.62, 0.46
nx, ny, nz = int((X1 - X0) / V), int((Y1 - Y0) / V), int(HEIGHT / V) + 2
xs = X0 + (np.arange(nx) + 0.5) * V
ys = Y0 + (np.arange(ny) + 0.5) * V
XX, YY = np.meshgrid(xs, ys, indexing='ij')
occ = np.zeros((nx, ny, nz), bool)
occ_arm = np.zeros((nx, ny, nz), bool)      # which voxels are arm / hand (used to keep skin weights apart)
report = []

def blob(cx, a, yb, yf, yfs=None, power=2.0, nose=0.05):
    """Rounded cross-section: half-width a, back at yb (>centre), front at yf (<centre)."""
    cy = (yb + yf) / 2
    u = np.clip(np.abs(XX - cx) / max(a, 1e-4), 0, None)
    f = yf
    if yfs is not None:  # sharp profile only near the centre line (nose, brow, beard)
        f = yfs + (yf - yfs) * np.exp(-((XX - cx) / nose) ** 2)
    half = np.where(YY > cy, yb - cy, cy - f)
    w = np.abs(YY - cy) / np.maximum(half, 1e-4)
    return u ** power + w ** power <= 1.0

def row_segments(z):
    r = rowz(z)
    if r < r0 or r >= r1:
        return None, None
    row = front[r].copy()
    c = np.where(row)[0]
    ext = ((c[0] - xc) * sf, (c[-1] + 1 - xc) * sf) if len(c) else None
    if z > 1.56 and len(c):                     # head / shoulders: no holes (teeth, eyes)
        row[c[0]:c[-1] + 1] = True
    segs = runs(row, merge_gap=26 if z < 0.2 else 8)
    return [((a - xc) * sf, (b - xc) * sf) for a, b in segs], ext

ARM_Z0, ARM_Z1 = 0.87, 1.84                     # arm zone: hip line .. top of the shoulders
def is_clean(segs):
    return (len(segs) == 3 and segs[1][0] < 0 < segs[1][1]
            and segs[0][1] < -0.2 and segs[2][0] > 0.2 and segs[1][0] - segs[0][1] > 0.012 and segs[2][0] - segs[1][1] > 0.012)

fit_z, fit_inner, fit_tw = [], [], []
for k in range(nz):
    z = (k + 0.5) * V
    if ARM_Z0 < z < ARM_Z1:
        segs, _ = row_segments(z)
        if segs and is_clean(segs):
            fit_z.append(z)
            fit_inner.append((-segs[0][1] + segs[2][0]) / 2)
            fit_tw.append((-segs[1][0] + segs[1][1]) / 2)
inner_fit = np.polyfit(fit_z, fit_inner, 1)
z_top_clean = max(fit_z)
tw_top = float(np.mean([t for zz, t in zip(fit_z, fit_tw) if zz > z_top_clean - 0.08]))
print('ARMFIT', inner_fit, z_top_clean, tw_top, len(fit_z))

_hs, _he = row_segments(ARM_Z1 + 0.01)
HEAD_HW = (_he[1] - _he[0]) / 2

def arm_blob(z, x_in, x_out, sgn):
    cx, hw = sgn * (x_in + x_out) / 2, (x_out - x_in) / 2
    tt = np.clip((1.65 - z) / 0.9, 0, 1)
    cy = 0.03 - 0.15 * tt                       # arms hang slightly forward of the body
    d = min(hw, 0.135) * (0.82 if z < 0.95 else 1.0)
    return blob(cx, hw, cy + d, cy - d)

for k in range(nz):
    z = (k + 0.5) * V
    segs, ext = row_segments(z)
    if not segs:
        continue
    yb, yf, yfs = side_at(z)
    sl = np.zeros((nx, ny), bool)
    sa = np.zeros((nx, ny), bool)
    kinds = []
    if ARM_Z0 < z < ARM_Z1:
        if is_clean(segs):
            kinds = ['A', 'T', 'A']
            sa |= arm_blob(z, -segs[0][1], -segs[0][0], -1)
            sa |= arm_blob(z, segs[2][0], segs[2][1], 1)
            sl |= sa
            sl |= blob((segs[1][0] + segs[1][1]) / 2, (segs[1][1] - segs[1][0]) / 2, yb, yf, power=2.3)
        else:                                   # arm fused with the torso in the silhouette: rebuild both
            kinds = ['a', 't', 'a']
            inner = float(np.clip(np.polyval(inner_fit, z), 0.17, 0.4))
            for sgn, outer in ((-1, -ext[0]), (1, ext[1])):
                x_in = min(inner, outer - 0.16)
                fade = np.clip((1.77 - z) / 0.14, 0, 1)   # round the shoulder off at the top
                if z < 1.77:
                    sa |= arm_blob(z, outer - (outer - x_in) * (0.45 + 0.55 * fade), outer, sgn)
            sl |= sa
            tw = max(tw_top, inner + 0.03) if z > z_top_clean else float(np.interp(z, fit_z, fit_tw))
            if z > 1.58:                        # chest narrows into the neck under the shoulders
                tw = float(np.interp(z, [1.58, ARM_Z1], [tw, HEAD_HW]))
            tw = min(tw, min(-ext[0], ext[1]))
            sl |= blob(0.0, tw, yb, yf, yfs if z > 1.72 else None, power=2.3 if z < 1.6 else 2.0)
    else:
        for x0, x1 in segs:
            cx, hw = (x0 + x1) / 2, (x1 - x0) / 2
            if x0 < 0 < x1 and z > 0.86:        # head / neck
                kinds.append('T')
                sl |= blob(cx, hw, yb, yf, yfs if z > 1.72 else None, power=2.0)
            elif abs(cx) > 0.37 and z > 0.6:    # hand
                kinds.append('A')
                sa |= arm_blob(z, abs(cx) - hw, abs(cx) + hw, 1 if cx > 0 else -1)
                sl |= sa
            else:                               # leg / foot
                kinds.append('L')
                sl |= blob(cx, hw, yb, yf, power=2.4)
    occ[:, :, k] = sl
    occ_arm[:, :, k] = sa
    if k % 12 == 0:
        report.append([round(z, 2), ''.join(kinds), [[round(a, 2), round(b, 2)] for a, b in segs], round(float(yf), 2), round(float(yb), 2)])

np.savez_compressed(os.path.join(OUT, 'labels.npz'), arm=occ_arm, body=occ & ~occ_arm, origin=np.array([X0, Y0, 0.0]), voxel=V)

# soften: blur the occupancy and re-threshold
f = occ.astype(np.float32)
for ax, n in ((0, 2), (1, 2), (2, 7)):          # extra smoothing along the height removes slice banding
    for _ in range(n):
        f = (np.roll(f, 1, ax) + 2 * f + np.roll(f, -1, ax)) / 4
occ = f > 0.5
occ[:, :, 0] = False

# ------------------------------------------------------- voxels -> quad mesh
p = np.pad(occ, 1)
quads = []
for ax in range(3):
    b_ax, c_ax = (ax + 1) % 3, (ax + 2) % 3
    for sign in (1, -1):
        face = p & ~np.roll(p, -sign, axis=ax)
        idx = np.argwhere(face) - 1
        base = idx.copy()
        if sign == 1:
            base[:, ax] += 1
        corners = [(0, 0), (1, 0), (1, 1), (0, 1)]
        if sign == -1:
            corners = corners[::-1]
        q = []
        for cb, cc in corners:
            v = base.copy()
            v[:, b_ax] += cb
            v[:, c_ax] += cc
            q.append(v[:, 0] + (nx + 1) * (v[:, 1] + (ny + 1) * v[:, 2]))
        quads.append(np.stack(q, 1))
quads = np.concatenate(quads)
uniq, inv = np.unique(quads, return_inverse=True)
inv = inv.reshape(quads.shape)
vx = uniq % (nx + 1)
vy = (uniq // (nx + 1)) % (ny + 1)
vz = uniq // ((nx + 1) * (ny + 1))
co = np.stack([X0 + vx * V, Y0 + vy * V, vz * V], 1).astype(np.float32)

bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new('GusBody')
me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel())
me.loops.add(inv.size); me.loops.foreach_set('vertex_index', inv.ravel().astype(np.int32))
me.polygons.add(len(inv))
me.polygons.foreach_set('loop_start', np.arange(0, inv.size, 4, dtype=np.int32))
me.polygons.foreach_set('loop_total', np.full(len(inv), 4, np.int32))
me.update(calc_edges=True); me.validate()
ob = bpy.data.objects.new('GusBody', me)
bpy.context.scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)

m = ob.modifiers.new('Smooth', 'SMOOTH'); m.factor = 0.7; m.iterations = 14
m = ob.modifiers.new('Decimate', 'DECIMATE'); m.ratio = min(1.0, 60000 / (len(inv) * 2))
dg = bpy.context.evaluated_depsgraph_get()
final = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
ob.modifiers.clear()
ob.data = final
for poly in final.polygons:
    poly.use_smooth = True
mat = bpy.data.materials.new('Clay'); mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.45, 0.2, 0.1, 1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
final.materials.append(mat)

vs = np.array([v.co[:] for v in final.vertices])
params = {
    'front': {'r0': r0, 'r1': r1, 'xc': xc, 'scale': sf},
    'side': {'s0': s0, 's1': s1, 'c0': c0, 'scale': ss},
    'bounds': {'min': vs.min(0).round(3).tolist(), 'max': vs.max(0).round(3).tolist()},
    'tris': sum(len(p.vertices) - 2 for p in final.polygons),
    'slices': report,
}
json.dump(params, open(os.path.join(OUT, 'shape.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(OUT, 'shape.blend')))
render_views(os.path.join(OUT, 'shape'))
print('SHAPE', json.dumps({k: params[k] for k in ('front', 'side', 'bounds', 'tris')}))
for row in report:
    print(row)
