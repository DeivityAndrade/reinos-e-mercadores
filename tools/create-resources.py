"""Original weathered resources. Run with Blender --background --python this_file.

Arguments after --: --only stone_A goldore (optional representative build).
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils import noise

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


def field(p, frequency, seed):
    return noise.noise_vector(p * frequency + Vector((seed * .73, seed * 1.17, seed * .41)))[0]


def rock_shape(seed, width, depth, height):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1)
    for vertex in bm.verts:
        p = vertex.co.copy()
        # Broad asymmetric masses, chipped ridges, and shallow weathering.
        boxiness = max(abs(p.x), abs(p.y), abs(p.z)) ** -.28
        broad = field(p, 1.6, seed)
        fine = field(p, 8, seed)
        fissure = abs(p.x * .78 + p.y * .35 + p.z * .31 + .12 + field(p, 2.4, seed) * .1)
        notch = max(0, 1 - fissure / .035) * .055
        vertex.co = p * (boxiness * (1 + broad * .19 + fine * .028) - notch)
        vertex.co.x += p.z * .12 + p.y * .04
    # True cut planes produce broad fracture surfaces instead of regular rings.
    for normal, distance in [(Vector((0, 0, -1)), .58),
                             (Vector((.83, .25, .43)).normalized(), .98),
                             (Vector((-.22, -.93, .29)).normalized(), .99)]:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                               plane_co=normal * distance, plane_no=normal,
                               dist=1e-6, clear_outer=True)
        boundary = [edge for edge in bm.edges if edge.is_boundary]
        if boundary:
            bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(edge.is_manifold for edge in bm.edges), "rock must remain closed"
    low = Vector([min(v.co[i] for v in bm.verts) for i in range(3)])
    high = Vector([max(v.co[i] for v in bm.verts) for i in range(3)])
    for vertex in bm.verts:
        p = vertex.co
        vertex.co = Vector(((p.x - (low.x + high.x) / 2) / (high.x - low.x) * width,
                            (p.y - (low.y + high.y) / 2) / (high.y - low.y) * depth,
                            (p.z - low.z) / (high.z - low.z) * height))
    mesh = bpy.data.meshes.new("weathered_rock")
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def make_asset(name, seed, dimensions, ore=None):
    mesh = rock_shape(seed, *dimensions)
    mesh.name = name + "_mesh"
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new("Preserve_fractures", "DECIMATE")
    modifier.ratio = .28
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh = obj.data
    floor = min(v.co.z for v in mesh.vertices)
    for vertex in mesh.vertices:
        vertex.co.z -= floor
    mesh.update()
    assert not mesh.validate(), name + ": invalid mesh repaired"
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(e.is_manifold for e in bm.edges), name + ": open surface"
    bm.to_mesh(mesh)
    bm.free()
    color = mesh.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    for face in mesh.polygons:
        face.use_smooth = False
        for loop in face.loop_indices:
            co = mesh.vertices[mesh.loops[loop].vertex_index].co
            p = Vector((co.x / dimensions[0], co.y / dimensions[1], co.z / dimensions[2]))
            coarse, grain = field(p, 5, seed), field(p, 42, seed)
            strata = math.sin((p.z + .23 * p.x + .08 * coarse) * 48)
            brightness = .91 + coarse * .13 + grain * .08 + strata * .025
            rgb = tuple(v * brightness for v in ROCK[seed % 3])
            fracture = abs(p.x * .78 + p.y * .35 + p.z * .31 - .04 + coarse * .06)
            if fracture < .012:
                rgb = tuple(v * .61 for v in rgb)
            if not ore and p.z > .38 and face.normal.z > .18 and coarse > .13:
                amount = min(.65, (coarse - .13) * 2)
                rgb = tuple(a * (1 - amount) + b * amount for a, b in zip(rgb, MOSS[seed % 2]))
            if ore:
                # Continuous geological fields across shared vertices: mineral
                # seams stay embedded instead of becoming triangular decals.
                band = abs(p.z + .34 * p.x + coarse * .08 - .57)
                mineral = (band < .12 if ore == "coal" else
                           coarse > .05 and p.z > .22 if ore == "ironore" else
                           band < .035 or abs(p.x - .26 * p.z + coarse * .05 + .06) < .025)
                if mineral:
                    base = ORE[ore][0 if grain < .12 else 1]
                    rgb = tuple(v * (1 + grain * .15) for v in base)
            color.data[loop].color = (*rgb, 1)
    mesh.materials.append(material)
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
    assert len(obj.data.loop_triangles) < 1800
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
    "assets": manifest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("RESOURCE_CHECK", json.dumps(manifest))
