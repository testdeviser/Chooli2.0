"""Shared helpers for the Gus build (headless Blender / bpy)."""
import bpy, numpy as np, math, os

HEIGHT = 2.2  # metres


def load_rgb(path):
    """Image as float array [row (top-down), col, 3], display (sRGB) values 0..1."""
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1, :, :3].copy()


def figure_mask(rgb):
    """Foreground = saturated or dark pixels (white background and grey floor shadow are dropped)."""
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    return (sat > 0.22) | (mx < 0.45)


def runs(row, min_len=6, merge_gap=8):
    d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
    s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    out = []
    for a, b in zip(s, e):
        if out and a - out[-1][1] < merge_gap:
            out[-1][1] = b
        else:
            out.append([a, b])
    return [(a, b) for a, b in out if b - a >= min_len]


def bbox_rows(mask, min_px=12):
    rows = np.where(mask.sum(1) >= min_px)[0]
    return int(rows[0]), int(rows[-1]) + 1


def smooth1d(a, k):
    if k <= 1:
        return a
    pad = np.pad(a, k, mode='edge')
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    return np.convolve(pad, ker, mode='same')[k:-k]


def preview_setup(res=(560, 900), samples=12):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.image_settings.file_format = 'JPEG'
    sc.view_settings.view_transform = 'Standard'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 0.3
    cam = bpy.data.objects.get('PreviewCam')
    if cam is None:
        cam = bpy.data.objects.new('PreviewCam', bpy.data.cameras.new('PreviewCam'))
        sc.collection.objects.link(cam)
        sun = bpy.data.objects.new('PreviewSun', bpy.data.lights.new('PreviewSun', 'SUN'))
        sun.data.energy = 2.5
        sun.rotation_euler = (math.radians(55), 0, math.radians(-30))
        sc.collection.objects.link(sun)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.5
    sc.camera = cam
    return cam


def render_views(path_prefix, objs_hide=(), res=(560, 900), samples=12):
    """Front / side / back / three-quarter orthographic previews (Cycles CPU, works headless)."""
    sc = bpy.context.scene
    cam = preview_setup(res, samples)
    views = {'front': 0, 'side': -90, 'back': 180, 'tq': -35}
    for name, deg in views.items():
        a = math.radians(deg)
        cam.location = (math.sin(a) * 8, -math.cos(a) * 8, 1.12)
        cam.rotation_euler = (math.radians(90), 0, a)
        sc.render.filepath = f'{path_prefix}-{name}.jpg'
        bpy.ops.render.render(write_still=True)
