"""Original faceted resources. Run with Blender --background --python this_file.

Arguments after --: --only stone_A goldore (optional representative build).
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "own" / "resources"
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--only", nargs="+")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


def linear(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in channels)


ROCK = [linear(c) for c in ("#928b7c", "#7e796f", "#aba18c", "#69665e")]
MOSS = [linear(c) for c in ("#647545", "#798653")]
ORE = {
    "coal": [linear(c) for c in ("#24242a", "#38363f", "#504b50")],
    "ironore": [linear(c) for c in ("#ac512e", "#d27b43", "#793d2e")],
    "goldore": [linear(c) for c in ("#eab83e", "#ffdc6a", "#b98625")],
}
material = bpy.data.materials.new("Resource_VertexPalette")
material.use_nodes = True
shader = material.node_tree.nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = 0.92
color_node = material.node_tree.nodes.new("ShaderNodeVertexColor")
color_node.layer_name = "Color"
material.node_tree.links.new(color_node.outputs["Color"], shader.inputs["Base Color"])


def rock_shape(seed, width, depth, height, sides=7):
    rng = random.Random(seed)
    vertices, faces = [], []
    radii = [rng.uniform(0.86, 1.13) for _ in range(sides)]
    # Offset stratified rings form chipped shoulders and a broad, irregular crown.
    for level, (z, radius, twist) in enumerate([(0, .78, 0), (.26, 1, .04), (.73, .91, -.07), (1, .56, .13)]):
        for i in range(sides):
            a = i * math.tau / sides + twist
            r = radius * radii[i] * rng.uniform(.92, 1.07)
            vertices.append((math.cos(a) * width * .5 * r + level * width * .025,
                             math.sin(a) * depth * .5 * r,
                             height * (z + (rng.uniform(-.07, .06) if level else 0))))
    faces.append(tuple(reversed(range(sides))))
    for level in range(3):
        for i in range(sides):
            a, b = level * sides + i, level * sides + (i + 1) % sides
            c, d = b + sides, a + sides
            faces.extend([(a, b, c), (a, c, d)])
    vertices.append((width * .08, -depth * .04, height * 1.04))
    for i in range(sides):
        faces.append((3 * sides + i, 3 * sides + (i + 1) % sides, len(vertices) - 1))
    return vertices, faces


def make_asset(name, seed, dimensions, ore=None):
    rng = random.Random(seed + 300)
    vertices, faces = rock_shape(seed, *dimensions)
    colors = []
    additions = []
    height = dimensions[2]
    for face in faces:
        points = [Vector(vertices[i]) for i in face]
        center = sum(points, Vector()) / len(points)
        palette = MOSS if not ore and center.z > height * .65 and rng.random() < .27 else ROCK
        colors.append(rng.choice(palette))
        if not ore or len(face) != 3 or center.z < height * .28:
            continue
        # Mineral patches follow the surface; they are shallow closed prisms,
        # not hovering crystals. Coal uses broad seams, iron broken deposits,
        # gold narrow branching veins across the upper facets.
        if rng.random() > {"coal": .56, "ironore": .52, "goldore": .65}[ore]:
            continue
        normal = (points[1] - points[0]).cross(points[2] - points[0]).normalized()
        if ore == "goldore":
            p, q = points[0].lerp(points[1], .25), points[0].lerp(points[2], .72)
            mid = (p + q) * .5
            outline = [p.lerp(center, .06), q.lerp(center, .06), mid.lerp(center, .34)]
        else:
            coverage = .85 if ore == "coal" else .67
            outline = [center.lerp(p, coverage) for p in points]
        lower = [p + normal * .0004 for p in outline]
        upper = [p + normal * (.004 if ore == "goldore" else .008) for p in outline]
        additions.append((lower + upper, [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]))
    for patch_vertices, patch_faces in additions:
        offset = len(vertices)
        vertices.extend(tuple(p) for p in patch_vertices)
        for face in patch_faces:
            faces.append(tuple(offset + i for i in face))
            colors.append(rng.choice(ORE[ore]))
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    assert not mesh.validate(), name + ": invalid mesh repaired"
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(e.is_manifold for e in bm.edges), name + ": open surface"
    bm.to_mesh(mesh)
    bm.free()
    color = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    for face, rgb in zip(mesh.polygons, colors):
        for loop in face.loop_indices:
            color.data[loop].color = (*rgb, 1)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["resource"] = ore or "stone"
    obj["authoring"] = "Original / Blender / Reinos & Mercadores"
    obj["pivot"] = "ground center; Blender Z-up, exported glTF Y-up"
    return obj


SPECS = [
    ("stone_A", 11, (.32, .26, .16), None),
    ("stone_B", 12, (.27, .25, .24), None),
    ("stone_C", 13, (.37, .24, .12), None),
    ("stone_D", 14, (.24, .23, .29), None),
    ("stone_E", 15, (.31, .30, .19), None),
    ("coal", 21, (.31, .27, .19), "coal"),
    ("ironore", 22, (.32, .25, .22), "ironore"),
    ("goldore", 23, (.30, .27, .22), "goldore"),
]
assets, manifest = [], []
for name, seed, dimensions, ore in SPECS:
    if args.only and name not in args.only:
        continue
    obj = make_asset(name, seed, dimensions, ore)
    assets.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name + ".glb")), export_format="GLB",
                              use_selection=True, export_yup=True, export_normals=True,
                              export_materials="EXPORT", export_extras=True)
    obj.data.calc_loop_triangles()
    bounds = [list(v) for v in (Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)]),
                               Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)]))]
    assert abs(bounds[0][2]) < 1e-6 and all(math.isfinite(x) for b in bounds for x in b)
    assert len(obj.data.loop_triangles) < 400
    manifest.append({"name": name, "file": name + ".glb", "resource": ore or "stone",
                     "vertices": len(obj.data.vertices), "triangles": len(obj.data.loop_triangles),
                     "bounds_blender": bounds, "bytes": (OUT / (name + ".glb")).stat().st_size})

# Presentation objects stay in a separate collection and never enter exports.
presentation = bpy.data.collections.new("Presentation_only")
bpy.context.scene.collection.children.link(presentation)


def present(obj):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    presentation.objects.link(obj)


ink = bpy.data.materials.new("Preview_ink")
ink.diffuse_color = (*linear("#d9cdb5"), 1)
for obj in assets:
    idx = next(i for i, spec in enumerate(SPECS) if spec[0] == obj.name)
    obj.location = ((idx - 2) * .52, .37, 0) if idx < 5 else ((idx - 6) * .64, -.43, 0)
    obj.rotation_euler.z = .15 * (idx % 3 - 1)
    bpy.ops.object.text_add(location=(obj.location.x, obj.location.y - .24, .001))
    label = bpy.context.object
    label.name = "Label_" + obj.name
    label.data.body = {"coal": "CARVAO", "ironore": "FERRO", "goldore": "OURO"}.get(obj.name, "PEDRA " + obj.name[-1])
    label.data.align_x = "CENTER"
    label.data.size = .055
    label.data.materials.append(ink)
    present(label)

bpy.ops.mesh.primitive_plane_add(size=200)
ground = bpy.context.object
ground.name = "Preview_ground"
ground.location.z = -.002
ground_mat = bpy.data.materials.new("Preview_ground_material")
ground_mat.diffuse_color = (*linear("#333d35"), 1)
ground.data.materials.append(ground_mat)
present(ground)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.camera_add(location=(.85, -2.9, 3.8))
camera = bpy.context.object
camera.name = "Preview_camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.95
aim(camera, (0, .05, 0))
present(camera)
scene = bpy.context.scene
scene.camera = camera
for name, location, power, size, rgb in [
    ("Key", (-2, -3, 4), 420, 3, (1, .86, .70)),
    ("Fill", (2, 1, 3), 240, 3, (.75, .85, 1)),
]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = "Preview_" + name
    light.data.energy = power
    light.data.shape = "DISK"
    light.data.size = size
    light.data.color = rgb
    aim(light, (0, 0, 0))
    present(light)
scene.world.color = (.22, .22, .22)
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"
scene.render.filepath = str(OUT / "resources-preview.png")
bpy.ops.object.select_all(action="DESELECT")
for obj in assets:
    obj.select_set(True)
bpy.context.view_layer.objects.active = assets[0]
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "resources.blend"))
bpy.ops.render.render(write_still=True)
(OUT / "manifest.json").write_text(json.dumps({"generator": "Blender " + bpy.app.version_string,
    "coordinate_system": "GLB: Y up; pivot at ground; dimensions in game units",
    "assets": manifest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("RESOURCE_CHECK", json.dumps(manifest))
