"""Stage 2 - project the front / side / back reference views onto the body and bake one texture.

    python -I scripts/gus/texture.py references/gus .cache/gus
"""
import bpy, numpy as np, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

REF, OUT = sys.argv[-2], sys.argv[-1]
SIZE = 2048
P = json.load(open(os.path.join(OUT, 'shape.json')))


def shift_or(m, n=1):
    for _ in range(n):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def prepare(name):
    """Extend the figure's colours outward over the white background so projection never picks up white."""
    rgb = load_rgb(os.path.join(REF, name + '.webp'))
    mask = figure_mask(rgb)
    h, w = mask.shape
    # background connected to the border (computed at 1/4 resolution)
    hh, ww = h // 4 * 4, w // 4 * 4
    small_bg = ~mask[:hh, :ww].reshape(hh // 4, 4, ww // 4, 4).any((1, 3))
    out = np.zeros_like(small_bg)
    out[0, :] = small_bg[0, :]; out[-1, :] = small_bg[-1, :]; out[:, 0] = small_bg[:, 0]; out[:, -1] = small_bg[:, -1]
    while True:
        nxt = shift_or(out) & small_bg
        nxt[0, :] |= out[0, :]; nxt[-1, :] |= out[-1, :]
        if (nxt == out).all():
            break
        out = nxt
    outside = np.ones((h, w), bool)
    outside[:hh, :ww] = np.repeat(np.repeat(out, 4, 0), 4, 1)
    q0, q1 = bbox_rows(mask)
    rr = (np.arange(h)[:, None] - q0) / (q1 - q0)
    holes_ok = (rr < 0.22) | (rr > 0.9)           # white teeth / eyes / nails are real; gaps beside the arms are not
    keep = np.where(holes_ok, ~(shift_or(outside, 4) & ~mask), mask)
    keep = ~shift_or(~keep, 3)                    # drop the pale anti-aliased fringe
    col = rgb * keep[..., None]
    filled = keep.copy()
    for _ in range(140):
        acc = np.zeros_like(col); cnt = np.zeros((h, w), np.float32)
        for ax, d in ((0, 1), (0, -1), (1, 1), (1, -1)):
            acc += np.roll(col, d, ax); cnt += np.roll(filled, d, ax)
        new = ~filled & (cnt > 0)
        col[new] = acc[new] / cnt[new, None]
        filled |= new
    col[~filled] = rgb[keep].mean(0)
    img = bpy.data.images.new('proj-' + name, w, h, alpha=False)
    px = np.ones((h, w, 4), np.float32); px[..., :3] = col[::-1]
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = os.path.abspath(os.path.join(OUT, f'proj-{name}.png')); img.file_format = 'PNG'; img.save()
    return img, mask, (w, h)


bpy.ops.wm.open_mainfile(filepath=os.path.abspath(os.path.join(OUT, 'shape.blend')))
ob = bpy.data.objects['GusBody']
imgF, mF, (wF, hF) = prepare('front')
imgS, mS, (wS, hS) = prepare('side')
imgB, mB, (wB, hB) = prepare('back')

b0, b1 = bbox_rows(mB)
sb = HEIGHT / (b1 - b0)
mids = []
for r in range(int(b1 - 2.1 / sb), int(b1 - 1.85 / sb)):
    c = np.where(mB[r])[0]
    if len(c):
        mids.append((c[0] + c[-1]) / 2)
xcb = float(np.median(mids))
F, S = P['front'], P['side']

# ------------------------------------------------------------------ UVs
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')

# -------------------------------------------------- projection material
mat = bpy.data.materials.new('GusProjection'); mat.use_nodes = True
nt = mat.node_tree; nt.nodes.clear()
N = nt.nodes.new
geo = N('ShaderNodeNewGeometry')
pos = N('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], pos.inputs[0])
nrm = N('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], nrm.inputs[0])

def math_node(op, a, b=None, c=None):
    n = N('ShaderNodeMath'); n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]

def project(img, u_src, ku, u0, v_src, kv, v0):
    comb = N('ShaderNodeCombineXYZ')
    nt.links.new(math_node('MULTIPLY_ADD', u_src, ku, u0), comb.inputs[0])
    nt.links.new(math_node('MULTIPLY_ADD', v_src, kv, v0), comb.inputs[1])
    tex = N('ShaderNodeTexImage'); tex.image = img; tex.extension = 'EXTEND'
    nt.links.new(comb.outputs[0], tex.inputs[0])
    return tex.outputs[0]

X, Y, Z = pos.outputs
cF = project(imgF, X, 1 / (F['scale'] * wF), F['xc'] / wF, Z, 1 / (F['scale'] * hF), 1 - F['r1'] / hF)
cS = project(imgS, Y, -1 / (S['scale'] * wS), S['c0'] / wS, Z, 1 / (S['scale'] * hS), 1 - S['s1'] / hS)
cB = project(imgB, X, -1 / (sb * wB), xcb / wB, Z, 1 / (sb * hB), 1 - b1 / hB)
# surfaces facing straight up or down have no matching view: use the fur of the middle of the back
cU = project(imgB, X, -0.4 / (sb * wB), xcb / wB, Y, 0.4 / (sb * hB), 1 - (b1 - 1.3 / sb) / hB)

SHARP = 4.0
wF_ = math_node('MULTIPLY', math_node('POWER', math_node('MAXIMUM', math_node('MULTIPLY', nrm.outputs[1], -1.0), 0.0), SHARP), 2.5)
wB_ = math_node('POWER', math_node('MAXIMUM', nrm.outputs[1], 0.0), SHARP)
wS_ = math_node('POWER', math_node('ABSOLUTE', nrm.outputs[0]), SHARP)
wU_ = math_node('MULTIPLY', math_node('POWER', math_node('ABSOLUTE', nrm.outputs[2]), SHARP), 0.6)

acc, wacc = cF, wF_
for col, w in ((cS, wS_), (cB, wB_), (cU, wU_)):
    tot = math_node('ADD', wacc, w)
    mix = N('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(math_node('DIVIDE', w, tot), mix.inputs['Factor'])
    nt.links.new(acc, mix.inputs['A']); nt.links.new(col, mix.inputs['B'])
    acc, wacc = mix.outputs['Result'], tot

emit = N('ShaderNodeEmission'); nt.links.new(acc, emit.inputs[0])
outn = N('ShaderNodeOutputMaterial'); nt.links.new(emit.outputs[0], outn.inputs[0])
albedo = bpy.data.images.new('gus-albedo', SIZE, SIZE, alpha=False)
target = N('ShaderNodeTexImage'); target.image = albedo
nt.nodes.active = target; target.select = True
ob.data.materials.clear(); ob.data.materials.append(mat)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
sc.render.bake.margin = 12
bpy.ops.object.bake(type='EMIT')
albedo.filepath_raw = os.path.abspath(os.path.join(OUT, 'gus-albedo.png')); albedo.file_format = 'PNG'; albedo.save()

# ----------------------------------- fur relief: normal map from the albedo
a = np.empty(SIZE * SIZE * 4, np.float32); albedo.pixels.foreach_get(a)
lum = (a.reshape(SIZE, SIZE, 4)[..., :3] * (0.3, 0.55, 0.15)).sum(2)
def blur(x, n):
    for _ in range(n):
        for ax in (0, 1):
            x = (np.roll(x, 1, ax) + 2 * x + np.roll(x, -1, ax)) / 4
    return x
hgt = blur(lum, 1) - blur(lum, 24)                # strands only, large-scale shading removed
dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
STRENGTH = 9.0
n = np.stack([-dx * STRENGTH, -dy * STRENGTH, np.ones_like(dx)], 2)
n /= np.linalg.norm(n, axis=2, keepdims=True)
px = np.ones((SIZE, SIZE, 4), np.float32); px[..., :3] = n * 0.5 + 0.5
normal = bpy.data.images.new('gus-normal', SIZE, SIZE, alpha=False)
normal.colorspace_settings.name = 'Non-Color'
normal.pixels.foreach_set(px.ravel())
normal.filepath_raw = os.path.abspath(os.path.join(OUT, 'gus-normal.png')); normal.file_format = 'PNG'; normal.save()

# --------------------------------------------------------- final material
final = bpy.data.materials.new('Gus'); final.use_nodes = True
ft = final.node_tree
bsdf = ft.nodes['Principled BSDF']
t1 = ft.nodes.new('ShaderNodeTexImage'); t1.image = albedo
t2 = ft.nodes.new('ShaderNodeTexImage'); t2.image = normal
nm = ft.nodes.new('ShaderNodeNormalMap')
ft.links.new(t1.outputs[0], bsdf.inputs['Base Color'])
ft.links.new(t2.outputs[0], nm.inputs['Color']); ft.links.new(nm.outputs[0], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.88
bsdf.inputs['Metallic'].default_value = 0.0
ob.data.materials.clear(); ob.data.materials.append(final)
for im in (imgF, imgS, imgB):
    im.use_fake_user = False

bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(OUT, 'textured.blend')))
render_views(os.path.join(OUT, 'tex'), samples=16)
print('TEXTURED', json.dumps({'back': {'b0': b0, 'b1': b1, 'xc': xcb, 'scale': sb}}))
