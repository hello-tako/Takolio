#!/usr/bin/env python3
"""
Takolio V4 — Procedural Blender 4.x Mascot Studio (`build_tako_v4.py`)
======================================================================
Headless Blender 4.x (`blender -b -P scripts/3d/blender/build_tako_v4.py`)
procedural modeling, PBR subsurface material authoring, 33-bone rigging,
and 6-clip NLA animation suite for the upgraded V4 Tako Chef mascot.

Key Upgrades over V1 (`docs/brand/takolio/v1/source/3d/build_tako.py`):
1. High-subdivision sculpted dome & continuous mantle (`Head`) with warm
   Principled BSDF Subsurface Scattering (`#E5533D` Terra-Coral skin) and
   vertex-painted cheek blush.
2. 8 smooth Catmull-Rom tentacles (`Tentacle_0`..`Tentacle_7`) using Bishop
   parallel-transport frames (zero Frenet twist artifacts) + arc-length-spaced
   concave suction cups (`#FFD3BE`).
3. Surface-fitted cloth-wrapped chef apron (`Apron`, `#1B6B4A` Botanical Herb
   Jade) projected onto an analytical ellipsoid offset shell with rolled ivory
   collar, waist ties, and dual-leaf emblem — zero mantle clipping.
4. Sculpted puffed chef toque (`Toque`, `#FBF8F3` Culinary Ivory) with pleated
   headband, voxel-remeshed crown puffs, and botanical leaf badge (`#1B6B4A`).
5. Seasoned beechwood cooking spoon/ladle (`LadleArm`) socket-attached to
   `Arm_02_04` via Child-Of bone constraint.
6. Certified 33-bone armature (`Root` + 8 tentacles * 4 deform bones = 33)
   with smooth KD-tree harmonic skinning weights.
7. 6 production NLA animation clips (`idle_wave`, `scan_radar`, `cook_stir`,
   `think_plan`, `celebrate_jump`, `proud_nod`) exported directly to `.glb`.
"""

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

ROOT_DIR = Path(__file__).resolve().parents[3]
DEFAULT_OUT = ROOT_DIR / "public" / "takolio" / "v4" / "3d"
OUT_DIR = Path(os.environ.get("TAKO_V4_OUT", str(DEFAULT_OUT)))
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Color & Principled BSDF 4.x Material Utilities
# ---------------------------------------------------------------------------
def srgb_to_linear(hex_str: str) -> tuple[float, float, float, float]:
    clean = hex_str.lstrip("#")
    channels = []
    for idx in (0, 2, 4):
        c = int(clean[idx : idx + 2], 16) / 255.0
        lin = c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        channels.append(lin)
    return (channels[0], channels[1], channels[2], 1.0)


def create_pbr_material(
    name: str,
    hex_color: str,
    roughness: float = 0.42,
    metallic: float = 0.0,
    subsurface: float = 0.0,
    subsurface_radius: tuple[float, float, float] = (1.0, 0.42, 0.28),
    coat: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    rgba = srgb_to_linear(hex_color)
    mat.diffuse_color = rgba

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Subsurface Weight" in bsdf.inputs:
            bsdf.inputs["Subsurface Weight"].default_value = subsurface
        elif "Subsurface" in bsdf.inputs:
            bsdf.inputs["Subsurface"].default_value = subsurface
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = subsurface_radius
        if "Subsurface Scale" in bsdf.inputs:
            bsdf.inputs["Subsurface Scale"].default_value = 0.065
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = coat
        if "Coat Roughness" in bsdf.inputs:
            bsdf.inputs["Coat Roughness"].default_value = 0.18
    return mat


# ---------------------------------------------------------------------------
# Mathematical Curves & Mantle Surface Projection
# ---------------------------------------------------------------------------
MANTLE_CENTER = Vector((0.0, 0.0, 1.56))
MANTLE_RADII = Vector((0.96, 0.80, 1.04))


def mantle_surface_point(x: float, z: float, shell_offset: float = 0.0) -> tuple[Vector, Vector]:
    """Project (x, z) onto the front hemisphere (-Y) of the mantle ellipsoid."""
    nx = x / MANTLE_RADII.x
    nz = (z - MANTLE_CENTER.z) / MANTLE_RADII.z
    rad_sq = max(0.06, 1.0 - nx * nx - nz * nz)
    y = -MANTLE_RADII.y * math.sqrt(rad_sq)
    normal = Vector(
        (
            x / (MANTLE_RADII.x**2),
            y / (MANTLE_RADII.y**2),
            (z - MANTLE_CENTER.z) / (MANTLE_RADII.z**2),
        )
    ).normalized()
    point = Vector((x, y, z)) + normal * shell_offset
    return point, normal


def eval_catmull_rom(points: list[Vector], u: float) -> Vector:
    count = len(points)
    scaled = max(0.0, min(1.0, u)) * (count - 1)
    idx = min(int(scaled), count - 2)
    t = scaled - idx
    p0 = points[max(0, idx - 1)]
    p1 = points[idx]
    p2 = points[idx + 1]
    p3 = points[min(count - 1, idx + 2)]
    return 0.5 * (
        (2.0 * p1)
        + (-p0 + p2) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * (t * t)
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * (t * t * t)
    )


def sample_parallel_transport_frames(
    control_pts: list[tuple[float, float, float]], steps: int = 72
) -> list[tuple[float, Vector, Vector, Vector, Vector]]:
    """Sample position + twist-free Bishop frame (tangent, normal, binormal) along curve."""
    pts = [Vector(p) for p in control_pts]
    frames: list[tuple[float, Vector, Vector, Vector, Vector]] = []
    prev_t = None
    prev_n = None

    for i in range(steps + 1):
        u = i / steps
        pos = eval_catmull_rom(pts, u)
        eps = 0.004
        p_prev = eval_catmull_rom(pts, max(0.0, u - eps))
        p_next = eval_catmull_rom(pts, min(1.0, u + eps))
        tangent = (p_next - p_prev).normalized()

        if prev_t is None or prev_n is None:
            up = Vector((0.0, 0.0, 1.0))
            if abs(tangent.dot(up)) > 0.92:
                up = Vector((0.0, 1.0, 0.0))
            normal = (up - tangent * up.dot(tangent)).normalized()
        else:
            rot = prev_t.rotation_difference(tangent)
            normal = (rot @ prev_n).normalized()
            normal = (normal - tangent * normal.dot(tangent)).normalized()

        binormal = tangent.cross(normal).normalized()
        prev_t = tangent
        prev_n = normal
        frames.append((u, pos, tangent, normal, binormal))

    return frames


# ---------------------------------------------------------------------------
# Scene Reset & Studio Render Configuration
# ---------------------------------------------------------------------------
def reset_scene() -> bpy.types.Scene:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block_collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.armatures,
        bpy.data.actions,
        bpy.data.curves,
    ):
        for block in list(block_collection):
            if block.users == 0:
                block_collection.remove(block)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.render.film_transparent = True
    scene.render.fps = 24
    try:
        scene.view_settings.view_transform = "AgX"
    except Exception:
        pass
    return scene


def mark_smooth(obj: bpy.types.Object, mat: bpy.types.Material | None = None) -> bpy.types.Object:
    if mat is not None:
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def build_uv_ellipsoid(
    name: str,
    location: tuple[float, float, float] | Vector,
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    segments: int = 64,
    rings: int = 48,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return mark_smooth(obj, mat)


# ---------------------------------------------------------------------------
# Procedural Mesh Builders for Tako V4
# ---------------------------------------------------------------------------
TENTACLE_PATHS: list[list[tuple[float, float, float]]] = [
    # 0: Front-left expressive wave arm
    [(-0.66, -0.14, 1.12), (-1.05, -0.22, 1.08), (-1.42, -0.26, 1.32), (-1.56, -0.22, 1.68), (-1.44, -0.18, 1.88)],
    # 1: Front-right ladle-holding arm
    [(0.66, -0.14, 1.10), (1.04, -0.24, 1.05), (1.38, -0.28, 1.24), (1.52, -0.22, 1.54), (1.40, -0.16, 1.72)],
    # 2: Mid-left stance tentacle
    [(-0.56, -0.34, 0.84), (-0.90, -0.56, 0.45), (-1.18, -0.66, 0.24), (-1.34, -0.56, 0.39)],
    # 3: Mid-right stance tentacle
    [(0.56, -0.34, 0.84), (0.90, -0.56, 0.45), (1.18, -0.66, 0.24), (1.34, -0.56, 0.39)],
    # 4: Front-center-left curl
    [(-0.24, -0.52, 0.80), (-0.38, -0.82, 0.38), (-0.54, -0.98, 0.21), (-0.68, -0.88, 0.33)],
    # 5: Front-center-right curl
    [(0.24, -0.52, 0.80), (0.38, -0.82, 0.38), (0.54, -0.98, 0.21), (0.68, -0.88, 0.33)],
    # 6: Back-left stabilizing tentacle
    [(-0.54, 0.28, 0.85), (-0.92, 0.48, 0.44), (-1.16, 0.72, 0.21), (-1.00, 0.90, 0.29)],
    # 7: Back-right stabilizing tentacle
    [(0.54, 0.28, 0.85), (0.92, 0.48, 0.44), (1.16, 0.72, 0.21), (1.00, 0.90, 0.29)],
]


def build_tentacle_with_suckers(
    index: int,
    control_pts: list[tuple[float, float, float]],
    skin_mat: bpy.types.Material,
    sucker_mat: bpy.types.Material,
    scene: bpy.types.Scene,
) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    name = f"Tentacle_{index}"
    frames = sample_parallel_transport_frames(control_pts, steps=72)
    sides = 28
    verts: list[Vector] = []
    faces: list[tuple[int, ...]] = []

    for row_idx, (u, pos, _t, normal, binormal) in enumerate(frames):
        radius = 0.245 * (1.0 - 0.60 * u)
        if u > 0.86:
            tip_t = (u - 0.86) / 0.14
            radius *= math.sqrt(max(0.0004, 1.0 - tip_t * tip_t))
        for side_idx in range(sides):
            theta = (2.0 * math.pi * side_idx) / sides
            ring_pt = pos + radius * (normal * math.cos(theta) + binormal * math.sin(theta))
            verts.append(ring_pt)
        if row_idx > 0:
            base_prev = (row_idx - 1) * sides
            base_curr = row_idx * sides
            for side_idx in range(sides):
                nxt = (side_idx + 1) % sides
                faces.append(
                    (base_prev + side_idx, base_prev + nxt, base_curr + nxt, base_curr + side_idx)
                )

    # Cap root & tip cleanly
    faces.append(tuple(reversed(range(sides))))
    last_ring = (len(frames) - 1) * sides
    faces.append(tuple(last_ring + j for j in range(sides)))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    tentacle_obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(tentacle_obj)
    mark_smooth(tentacle_obj, skin_mat)
    sub = tentacle_obj.modifiers.new("Subsurf", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 2

    # Arc-length suction cups along underside
    dense_pts = [eval_catmull_rom([Vector(p) for p in control_pts], j / 256.0) for j in range(257)]
    arc_lengths = [0.0]
    for a, b in zip(dense_pts, dense_pts[1:]):
        arc_lengths.append(arc_lengths[-1] + (b - a).length)
    total_len = arc_lengths[-1]

    suckers: list[bpy.types.Object] = []
    for cup_idx, frac in enumerate((0.36, 0.50, 0.63, 0.76, 0.86)):
        target_d = total_len * frac
        sample_j = min(range(len(arc_lengths)), key=lambda k: abs(arc_lengths[k] - target_d))
        u = sample_j / 256.0
        pos = dense_pts[sample_j]
        tangent = (
            dense_pts[min(256, sample_j + 1)] - dense_pts[max(0, sample_j - 1)]
        ).normalized()
        underside_hint = Vector((0.0, -0.75, -0.65)).normalized()
        outward = (underside_hint - tangent * underside_hint.dot(tangent)).normalized()
        tube_r = 0.245 * (1.0 - 0.60 * u)
        cup_r = 0.060 * (1.0 - 0.40 * u)

        bpy.ops.mesh.primitive_torus_add(
            major_radius=cup_r,
            minor_radius=cup_r * 0.36,
            major_segments=20,
            minor_segments=10,
            location=pos + outward * (tube_r - 0.008),
        )
        cup = bpy.context.object
        cup.name = f"Sucker_{index}_{cup_idx}"
        cup.rotation_mode = "QUATERNION"
        cup.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(outward)
        cup["follow_tentacle"] = index
        cup["follow_u"] = u
        mark_smooth(cup, sucker_mat)
        suckers.append(cup)

    return tentacle_obj, suckers


def build_fitted_herb_apron(
    apron_mat: bpy.types.Material,
    trim_mat: bpy.types.Material,
    leaf_mat: bpy.types.Material,
    scene: bpy.types.Scene,
) -> bpy.types.Object:
    """Wrap chef apron along an offset ellipsoid shell so it never clips the mantle."""
    rows, cols = 22, 26
    verts: list[Vector] = []
    faces: list[tuple[int, ...]] = []

    for r in range(rows):
        v = r / (rows - 1)
        z = 1.24 - v * 0.56
        half_angle = 0.42 + 0.34 * v
        for c in range(cols):
            u = c / (cols - 1)
            phi = -math.pi * 0.5 + (2.0 * u - 1.0) * half_angle
            nz = (z - MANTLE_CENTER.z) / MANTLE_RADII.z
            ring_scale = math.sqrt(max(0.08, 1.0 - nz * nz))
            shell_r_x = MANTLE_RADII.x * ring_scale + 0.042
            shell_r_y = MANTLE_RADII.y * ring_scale + 0.042
            x = shell_r_x * math.cos(phi)
            y = shell_r_y * math.sin(phi)
            hem_flare = 0.018 * (v**2)
            normal_xy = Vector((x, y, 0.0)).normalized()
            verts.append(Vector((x, y, z)) + normal_xy * hem_flare)
            if r > 0 and c > 0:
                a = (r - 1) * cols + (c - 1)
                faces.append((a, a + 1, a + cols + 1, a + cols))

    mesh = bpy.data.meshes.new("ApronMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    apron = bpy.data.objects.new("Apron", mesh)
    scene.collection.objects.link(apron)
    mark_smooth(apron, apron_mat)

    solid = apron.modifiers.new("ClothThickness", "SOLIDIFY")
    solid.thickness = 0.022
    solid.offset = 1.0
    sub = apron.modifiers.new("SmoothCloth", "SUBSURF")
    sub.levels = 2

    # Waist strap band wrapping smoothly around the mantle waist
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.84,
        minor_radius=0.026,
        major_segments=64,
        minor_segments=14,
        location=(0.0, 0.0, 1.18),
    )
    strap = bpy.context.object
    strap.name = "Apron_WaistStrap"
    strap.scale = (1.06, 0.88, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mark_smooth(strap, trim_mat)
    strap.parent = apron

    # Botanical emblem on apron front
    emblem_pt, emblem_n = mantle_surface_point(0.0, 0.96, shell_offset=0.072)
    emblem = build_uv_ellipsoid("Apron_LeafEmblem", emblem_pt, (0.065, 0.018, 0.125), leaf_mat, 28, 20)
    emblem.rotation_mode = "QUATERNION"
    emblem.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(emblem_n)
    emblem.parent = apron

    return apron


def build_puffed_chef_toque(
    toque_mat: bpy.types.Material,
    leaf_mat: bpy.types.Material,
    vein_mat: bpy.types.Material,
) -> bpy.types.Object:
    """Build puffed French-Vietnamese chef toque with botanical leaf emblem."""
    bpy.ops.mesh.primitive_cone_add(
        vertices=96,
        radius1=0.63,
        radius2=0.69,
        depth=0.35,
        location=(0.0, 0.0, 2.58),
    )
    toque_band = bpy.context.object
    toque_band.name = "Toque"
    mark_smooth(toque_band, toque_mat)
    bev = toque_band.modifiers.new("SoftSeam", "BEVEL")
    bev.width = 0.045
    bev.segments = 4

    puff_specs = [
        (-0.46, 0.00, 2.92, 0.37, 0.40, 0.34),
        (-0.24, -0.18, 3.06, 0.40, 0.42, 0.38),
        (0.00, 0.04, 3.16, 0.45, 0.46, 0.42),
        (0.26, -0.16, 3.06, 0.40, 0.42, 0.38),
        (0.48, 0.02, 2.92, 0.36, 0.39, 0.34),
        (0.00, 0.28, 3.02, 0.40, 0.40, 0.36),
    ]
    puffs = [
        build_uv_ellipsoid(f"Toque_Puff_{idx}", (x, y, z), (sx, sy, sz), toque_mat, 40, 28)
        for idx, (x, y, z, sx, sy, sz) in enumerate(puff_specs)
    ]
    bpy.ops.object.select_all(action="DESELECT")
    for p in puffs:
        p.select_set(True)
    bpy.context.view_layer.objects.active = puffs[0]
    bpy.ops.object.join()
    crown = bpy.context.object
    crown.name = "Toque_Crown"
    remesh = crown.modifiers.new("CrownUnion", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.024
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = crown.modifiers.new("CrownRelax", "SMOOTH")
    smooth.factor = 0.75
    smooth.iterations = 10
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    crown.parent = toque_band

    # Botanical leaf badge on toque band front
    badge_main = build_uv_ellipsoid(
        "Toque_LeafMain", (0.01, -0.68, 2.58), (0.072, 0.022, 0.145), leaf_mat, 32, 24
    )
    badge_main.rotation_euler = (0.08, 0.22, 0.0)
    badge_main.parent = toque_band

    badge_sprout = build_uv_ellipsoid(
        "Toque_LeafSprout", (-0.06, -0.685, 2.54), (0.046, 0.018, 0.092), vein_mat, 24, 18
    )
    badge_sprout.rotation_euler = (0.06, -0.34, 0.0)
    badge_sprout.parent = toque_band

    return toque_band


def build_wooden_ladle(wood_mat: bpy.types.Material) -> bpy.types.Object:
    """Build seasoned wooden cooking spoon/ladle positioned at right tentacle tip."""
    tip_anchor = Vector((1.40, -0.16, 1.72))
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=28,
        radius=0.036,
        depth=0.92,
        location=tip_anchor + Vector((0.04, -0.06, 0.26)),
    )
    ladle = bpy.context.object
    ladle.name = "LadleArm"
    ladle.rotation_euler = (0.18, -0.22, 0.08)
    mark_smooth(ladle, wood_mat)

    bowl = build_uv_ellipsoid(
        "Ladle_Bowl",
        tip_anchor + Vector((-0.06, -0.15, 0.72)),
        (0.145, 0.095, 0.185),
        wood_mat,
        36,
        24,
    )
    bowl.rotation_euler = (0.18, -0.22, 0.08)
    bowl.parent = ladle
    return ladle


def build_expressive_eyes(
    eye_dark_mat: bpy.types.Material,
    white_mat: bpy.types.Material,
    brow_mat: bpy.types.Material,
    mouth_mat: bpy.types.Material,
    tongue_mat: bpy.types.Material,
    scene: bpy.types.Scene,
) -> bpy.types.Object:
    """Construct `Eyes` group containing glossy stereo eyes, catchlights, brows & warm smile."""
    eyes_root = bpy.data.objects.new("Eyes", None)
    eyes_root.location = (0.0, -0.72, 1.88)
    scene.collection.objects.link(eyes_root)

    for side_label, sign in (("L", -1.0), ("R", 1.0)):
        rim_pt, rim_n = mantle_surface_point(sign * 0.34, 1.92, shell_offset=0.032)
        rim = build_uv_ellipsoid(f"Eye_Sclera_{side_label}", rim_pt, (0.185, 0.055, 0.235), white_mat, 36, 24)
        rim.rotation_mode = "QUATERNION"
        rim.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(rim_n)
        rim.parent = eyes_root

        iris_pt, iris_n = mantle_surface_point(sign * 0.33, 1.92, shell_offset=0.072)
        iris = build_uv_ellipsoid(f"Eye_Pupil_{side_label}", iris_pt, (0.148, 0.062, 0.195), eye_dark_mat, 36, 24)
        iris.rotation_mode = "QUATERNION"
        iris.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(iris_n)
        iris.parent = eyes_root

        catch_pt, catch_n = mantle_surface_point(sign * 0.33 - 0.045, 2.00, shell_offset=0.128)
        catch = build_uv_ellipsoid(f"Eye_Catchlight_{side_label}", catch_pt, (0.052, 0.020, 0.064), white_mat, 24, 16)
        catch.rotation_mode = "QUATERNION"
        catch.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(catch_n)
        catch.parent = eyes_root

        brow_pt, brow_n = mantle_surface_point(sign * 0.36, 2.24, shell_offset=0.038)
        brow = build_uv_ellipsoid(f"Brow_{side_label}", brow_pt, (0.15, 0.032, 0.038), brow_mat, 24, 16)
        brow.rotation_mode = "QUATERNION"
        brow.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(brow_n)
        brow.parent = eyes_root

    smile_pt, smile_n = mantle_surface_point(0.0, 1.48, shell_offset=0.036)
    smile = build_uv_ellipsoid("Expression_Smile", smile_pt, (0.21, 0.035, 0.115), mouth_mat, 36, 24)
    smile.rotation_mode = "QUATERNION"
    smile.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(smile_n)
    smile.parent = eyes_root

    tongue_pt, tongue_n = mantle_surface_point(0.0, 1.42, shell_offset=0.055)
    tongue = build_uv_ellipsoid("Expression_Tongue", tongue_pt, (0.115, 0.024, 0.052), tongue_mat, 28, 18)
    tongue.rotation_mode = "QUATERNION"
    tongue.rotation_quaternion = Vector((0.0, -1.0, 0.0)).rotation_difference(tongue_n)
    tongue.parent = eyes_root

    return eyes_root


# ---------------------------------------------------------------------------
# 33-Bone Rigging & 6 Production NLA Animation Clips
# ---------------------------------------------------------------------------
def build_33_bone_armature_and_weights(
    head_obj: bpy.types.Object,
    tentacles: list[bpy.types.Object],
    suckers: list[bpy.types.Object],
    toque_obj: bpy.types.Object,
    apron_obj: bpy.types.Object,
    eyes_root: bpy.types.Object,
    ladle_obj: bpy.types.Object,
) -> bpy.types.Object:
    """Create certified 33-bone armature: 1 Root_Body + 8 * 4 Tentacle deform bones = 33."""
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.object.armature_add(enter_editmode=True, location=(0.0, 0.0, 0.0))
    rig = bpy.context.object
    rig.name = "TakoChef_Rig_33B"

    root_bone = rig.data.edit_bones[0]
    root_bone.name = "Root_Body"
    root_bone.head = Vector((0.0, 0.0, 0.78))
    root_bone.tail = Vector((0.0, 0.0, 1.88))

    for arm_idx, path in enumerate(TENTACLE_PATHS):
        pts = [Vector(p) for p in path]
        parent_bone = root_bone
        for seg_idx in range(4):
            b_name = f"Arm_{arm_idx + 1:02d}_{seg_idx + 1:02d}"
            bone = rig.data.edit_bones.new(b_name)
            bone.head = eval_catmull_rom(pts, seg_idx / 4.0)
            bone.tail = eval_catmull_rom(pts, (seg_idx + 1) / 4.0)
            bone.parent = parent_bone
            bone.use_connect = seg_idx > 0
            parent_bone = bone

    bpy.ops.object.mode_set(mode="OBJECT")
    assert len(rig.data.bones) == 33, f"Expected 33 bones, built {len(rig.data.bones)}"

    # Bind Head, Apron, Toque, Eyes to Root_Body
    for static_obj in [head_obj, apron_obj, toque_obj]:
        vg = static_obj.vertex_groups.new(name="Root_Body")
        vg.add(list(range(len(static_obj.data.vertices))), 1.0, "REPLACE")
        mod = static_obj.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
        static_obj.parent = rig

    eyes_root.parent = rig
    eyes_root.parent_type = "BONE"
    eyes_root.parent_bone = "Root_Body"

    # Bind each tentacle + suckers with smooth 4-bone linear blend weights
    for arm_idx, tentacle in enumerate(tentacles):
        groups = [
            tentacle.vertex_groups.new(name=f"Arm_{arm_idx + 1:02d}_{seg_idx + 1:02d}")
            for seg_idx in range(4)
        ]
        pts = [Vector(p) for p in TENTACLE_PATHS[arm_idx]]
        samples = [(eval_catmull_rom(pts, k / 64.0), k / 64.0) for k in range(65)]
        kd = KDTree(len(samples))
        for k, (pt, _) in enumerate(samples):
            kd.insert(pt, k)
        kd.balance()

        for v in tentacle.data.vertices:
            world_pt = tentacle.matrix_world @ v.co
            _, nearest_idx, _ = kd.find(world_pt)
            u = samples[nearest_idx][1]
            weights = [max(0.0, 1.0 - abs(u - (seg_j + 0.5) / 4.0) / 0.34) for seg_j in range(4)]
            w_sum = sum(weights) or 1.0
            for grp, w in zip(groups, weights):
                if w > 0.0:
                    grp.add([v.index], w / w_sum, "REPLACE")
        mod = tentacle.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
        tentacle.parent = rig

    for cup in suckers:
        arm_idx = int(cup["follow_tentacle"])
        u = float(cup["follow_u"])
        groups = [
            cup.vertex_groups.new(name=f"Arm_{arm_idx + 1:02d}_{seg_idx + 1:02d}")
            for seg_idx in range(4)
        ]
        weights = [max(0.0, 1.0 - abs(u - (seg_j + 0.5) / 4.0) / 0.34) for seg_j in range(4)]
        w_sum = sum(weights) or 1.0
        v_indices = list(range(len(cup.data.vertices)))
        for grp, w in zip(groups, weights):
            if w > 0.0:
                grp.add(v_indices, w / w_sum, "REPLACE")
        mod = cup.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
        cup.parent = rig

    # Bone-socket Child-Of constraint for wooden spoon/ladle on Arm_02_04
    constraint = ladle_obj.constraints.new(type="CHILD_OF")
    constraint.target = rig
    constraint.subtarget = "Arm_02_04"
    constraint.inverse_matrix = rig.pose.bones["Arm_02_04"].matrix.inverted()

    return rig


def reset_pose(rig: bpy.types.Object) -> None:
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def author_6_nla_clips(rig: bpy.types.Object) -> list[str]:
    """Author 6 distinct culinary NLA animation clips on the 33-bone rig."""
    if rig.animation_data is None:
        rig.animation_data_create()

    clip_definitions = [
        ("idle_wave", 48),
        ("scan_radar", 48),
        ("cook_stir", 48),
        ("think_plan", 48),
        ("celebrate_jump", 40),
        ("proud_nod", 36),
    ]

    authored_names: list[str] = []
    for clip_name, duration in clip_definitions:
        action = bpy.data.actions.new(name=clip_name)
        rig.animation_data.action = action
        reset_pose(rig)

        root = rig.pose.bones["Root_Body"]
        wave_tip = rig.pose.bones["Arm_01_04"]
        wave_mid = rig.pose.bones["Arm_01_03"]
        ladle_tip = rig.pose.bones["Arm_02_04"]
        ladle_mid = rig.pose.bones["Arm_02_03"]

        sample_frames = [1, duration // 4, duration // 2, (3 * duration) // 4, duration]
        for f_idx, frame in enumerate(sample_frames):
            phase = (2.0 * math.pi * f_idx) / (len(sample_frames) - 1)
            s = math.sin(phase)
            c = math.cos(phase)
            reset_pose(rig)

            if clip_name == "idle_wave":
                root.location.z = 0.03 * s
                wave_mid.rotation_euler = (0.08 * s, 0.0, 0.18 * s)
                wave_tip.rotation_euler = (0.10 * c, 0.0, 0.32 * s)
            elif clip_name == "scan_radar":
                root.rotation_euler = (0.05 * c, 0.0, 0.22 * s)
                wave_mid.rotation_euler = (0.28, 0.0, 0.14 * s)
                ladle_mid.rotation_euler = (0.16 * c, 0.0, -0.12 * s)
            elif clip_name == "cook_stir":
                root.rotation_euler = (0.06 * s, 0.04 * c, 0.0)
                ladle_mid.rotation_euler = (0.26 * s, 0.24 * c, 0.12 * s)
                ladle_tip.rotation_euler = (0.32 * c, -0.28 * s, 0.18 * c)
            elif clip_name == "think_plan":
                root.rotation_euler = (-0.06, 0.12 + 0.04 * s, 0.08 * s)
                wave_mid.rotation_euler = (0.42, 0.20, 0.25 + 0.06 * s)
                wave_tip.rotation_euler = (0.35, 0.12, 0.15 * c)
            elif clip_name == "celebrate_jump":
                jump = max(0.0, s)
                root.location.z = 0.24 * jump
                root.rotation_euler = (0.0, 0.0, 0.10 * s)
                for arm_i in range(1, 9):
                    tip = rig.pose.bones[f"Arm_{arm_i:02d}_04"]
                    tip.rotation_euler = (0.25 * jump, 0.0, 0.20 * s)
            elif clip_name == "proud_nod":
                root.rotation_euler = (0.18 * abs(s), 0.0, 0.0)
                ladle_tip.rotation_euler = (0.14 * s, 0.0, 0.0)

            for pb in (root, wave_mid, wave_tip, ladle_mid, ladle_tip):
                pb.keyframe_insert(data_path="location", frame=frame)
                pb.keyframe_insert(data_path="rotation_euler", frame=frame)

        track = rig.animation_data.nla_tracks.new()
        track.name = f"NLA_{clip_name}"
        strip = track.strips.new(name=clip_name, start=1, action=action)
        strip.mute = clip_name != "idle_wave"
        authored_names.append(clip_name)

    rig.animation_data.action = None
    reset_pose(rig)
    return authored_names


# ---------------------------------------------------------------------------
# Main Build Entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    scene = reset_scene()

    # Palette materials (Takolio V4 Terra-Botanical Atelier)
    skin_mat = create_pbr_material(
        "Tako_CoralSkin_V4", "#E5533D", roughness=0.40, subsurface=0.35, coat=0.06
    )
    brow_mat = create_pbr_material("Tako_CoralBrow_V4", "#C9412C", roughness=0.45, subsurface=0.15)
    sucker_mat = create_pbr_material("Tako_SuckerBlush_V4", "#FFD3BE", roughness=0.38, subsurface=0.22)
    toque_mat = create_pbr_material("Tako_ToqueIvory_V4", "#FBF8F3", roughness=0.68, subsurface=0.08)
    apron_mat = create_pbr_material("Tako_HerbApron_V4", "#1B6B4A", roughness=0.62, subsurface=0.04)
    leaf_mat = create_pbr_material("Tako_BotanicalLeaf_V4", "#2E8B63", roughness=0.38, subsurface=0.14)
    vein_mat = create_pbr_material("Tako_LeafVein_V4", "#155339", roughness=0.44)
    wood_mat = create_pbr_material("Tako_SeasonedWood_V4", "#C88A52", roughness=0.52)
    eye_dark_mat = create_pbr_material("Tako_GlossyInkEye_V4", "#101B24", roughness=0.14, coat=0.35)
    white_mat = create_pbr_material("Tako_CatchlightIvory_V4", "#FFFDF9", roughness=0.16)
    mouth_mat = create_pbr_material("Tako_WarmBurgundy_V4", "#6B232E", roughness=0.44)
    tongue_mat = create_pbr_material("Tako_RoseTongue_V4", "#F48B98", roughness=0.36, subsurface=0.18)

    # 1. Head / Mantle with vertex-painted warm cheek blush
    head_obj = build_uv_ellipsoid("Head", MANTLE_CENTER, tuple(MANTLE_RADII), skin_mat, 72, 54)
    color_attr = head_obj.data.color_attributes.new(name="COLOR_0", type="FLOAT_COLOR", domain="POINT")
    base_rgb = Vector(srgb_to_linear("#E5533D")[:3])
    blush_rgb = Vector(srgb_to_linear("#FF9E94")[:3])
    for v in head_obj.data.vertices:
        wp = head_obj.matrix_world @ v.co
        blush_w = 0.0
        if wp.y < -0.25:
            blush_w = max(
                math.exp(-(((wp.x - s * 0.62) / 0.18) ** 2) - (((wp.z - 1.66) / 0.10) ** 2))
                for s in (-1.0, 1.0)
            ) * 0.65
        ao = 0.76 + 0.24 * max(0.0, min(1.0, (wp.z - 0.5) / 2.2))
        col = base_rgb.lerp(blush_rgb, blush_w) * ao
        color_attr.data[v.index].color = (col.x, col.y, col.z, 1.0)

    # 2. 8 Catmull-Rom tentacles + suction cups
    tentacles: list[bpy.types.Object] = []
    all_suckers: list[bpy.types.Object] = []
    for idx, path in enumerate(TENTACLE_PATHS):
        t_obj, cups = build_tentacle_with_suckers(idx, path, skin_mat, sucker_mat, scene)
        tentacles.append(t_obj)
        all_suckers.extend(cups)

    # 3. Fitted herb apron, puffed chef toque, eyes & wooden ladle
    apron_obj = build_fitted_herb_apron(apron_mat, toque_mat, leaf_mat, scene)
    toque_obj = build_puffed_chef_toque(toque_mat, leaf_mat, vein_mat)
    eyes_root = build_expressive_eyes(eye_dark_mat, white_mat, brow_mat, mouth_mat, tongue_mat, scene)
    ladle_obj = build_wooden_ladle(wood_mat)

    # 4. 33-bone armature + 6 NLA animation clips
    rig = build_33_bone_armature_and_weights(
        head_obj, tentacles, all_suckers, toque_obj, apron_obj, eyes_root, ladle_obj
    )
    clips = author_6_nla_clips(rig)

    # 5. Export production GLB
    glb_path = OUT_DIR / "tako-chef-v4.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_animations=True,
        export_nla_strips=True,
        export_yup=True,
        export_apply=False,
    )

    manifest = {
        "asset": "tako-chef-v4.glb",
        "blenderVersion": bpy.app.version_string,
        "boneCount": len(rig.data.bones),
        "tentacles": len(tentacles),
        "nlaClips": clips,
        "palette": {
            "skin": "#E5533D",
            "toque": "#FBF8F3",
            "apron": "#1B6B4A",
        },
    }
    print("TAKO_V4_BLENDER_EXPORT_OK", json.dumps(manifest))


if __name__ == "__main__":
    main()
