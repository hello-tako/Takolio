#!/usr/bin/env python3
"""
Takolio V4 — Procedural Blender 4.x Architectural Culinary Scenes (`build_culinary_scenes_v4.py`)
=================================================================================================
Headless Blender 4.x (`blender -b -P scripts/3d/blender/build_culinary_scenes_v4.py`)
procedural scene generator exporting the 4 interactive 3D culinary stages:

1. `kitchen-island-hero.glb`
   - Isometric Smart Kitchen Island diorama with named interactive groups:
     `Zone_Fridge`, `Zone_Cooktop`, `Zone_Prep`, `Tako_Hero`, `Floating_Ingredients`.
2. `onboarding-mam-com.glb`
   - Traditional circular Vietnamese `mâm cơm` rattan/wooden tray with central
     braised claypot, sour soup bowl, stir-fry greens plate, chili-lime saucer,
     and 5 individually named place-setting nodes (`Place_1`..`Place_5`).
3. `smart-fridge-3zone.glb`
   - Sculpted 3-compartment Smart Fridge (`Zone_Cool` Ngăn mát, `Zone_Freeze`
     Ngăn đá, `Zone_Pantry` Tủ đồ khô) with frosted glass shelves, food category
     clusters, and pulsing amber freshness orbs.
4. `culinary-cookware-stage.glb`
   - Modular Active Cooking Stage with switchable cookware groups (`Rig_Wok`,
     `Rig_Claypot`, `Rig_Stockpot`, `Rig_Steamer`, `Rig_PrepBoard`) + `Flame_Ring`.
"""

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector

ROOT_DIR = Path(__file__).resolve().parents[3]
DEFAULT_OUT = ROOT_DIR / "public" / "takolio" / "v4" / "3d"
OUT_DIR = Path(os.environ.get("TAKO_V4_OUT", str(DEFAULT_OUT)))
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Shared PBR Material & Procedural Geometry Helpers
# ---------------------------------------------------------------------------
def srgb_to_linear(hex_str: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    clean = hex_str.lstrip("#")
    rgb = []
    for i in (0, 2, 4):
        c = int(clean[i : i + 2], 16) / 255.0
        rgb.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (rgb[0], rgb[1], rgb[2], alpha)


def make_mat(
    name: str,
    hex_color: str,
    roughness: float = 0.45,
    metallic: float = 0.0,
    subsurface: float = 0.0,
    emissive_hex: str | None = None,
    emissive_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    rgba = srgb_to_linear(hex_color, alpha)
    mat.diffuse_color = rgba
    if alpha < 0.999:
        mat.blend_method = "BLEND"

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if "Subsurface Weight" in bsdf.inputs:
            bsdf.inputs["Subsurface Weight"].default_value = subsurface
        if emissive_hex is not None and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emissive_hex)
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return mat


def clear_scene() -> bpy.types.Scene:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for col in (bpy.data.meshes, bpy.data.materials):
        for item in list(col):
            if item.users == 0:
                col.remove(item)
    return bpy.context.scene


def empty_group(name: str, location: tuple[float, float, float] = (0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def add_bevel_box(
    name: str,
    location: tuple[float, float, float],
    dims: tuple[float, float, float],
    mat: bpy.types.Material,
    bevel_width: float = 0.03,
    parent=None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = bevel_width
    bev.segments = 3
    bpy.ops.object.modifier_apply(modifier=bev.name)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if parent is not None:
        obj.parent = parent
    return obj


def add_lathed_vessel(
    name: str,
    profile_rz: list[tuple[float, float]],
    location: tuple[float, float, float],
    mat: bpy.types.Material,
    segments: int = 48,
    parent=None,
) -> bpy.types.Object:
    verts: list[Vector] = []
    faces: list[tuple[int, ...]] = []
    ring_count = len(profile_rz)
    for r_val, z_val in profile_rz:
        rad = max(0.002, r_val)
        for seg in range(segments):
            theta = (2.0 * math.pi * seg) / segments
            verts.append(Vector((rad * math.cos(theta), rad * math.sin(theta), z_val)))
    for row in range(1, ring_count):
        prev_base = (row - 1) * segments
        curr_base = row * segments
        for seg in range(segments):
            nxt = (seg + 1) % segments
            faces.append((prev_base + seg, prev_base + nxt, curr_base + nxt, curr_base + seg))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if parent is not None:
        obj.parent = parent
    return obj


def add_ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    mat: bpy.types.Material,
    parent=None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=24, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if parent is not None:
        obj.parent = parent
    return obj


def export_glb(filename: str) -> str:
    out_path = OUT_DIR / filename
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )
    return str(out_path)


# ---------------------------------------------------------------------------
# Scene 1: `kitchen-island-hero.glb`
# ---------------------------------------------------------------------------
def build_kitchen_island_hero() -> str:
    clear_scene()
    wood_butcher = make_mat("Wood_ButcherBlock", "#C98E5B", roughness=0.48)
    cabinet_jade = make_mat("Cabinet_BotanicalJade", "#1B6B4A", roughness=0.52)
    steel_brushed = make_mat("Steel_Brushed", "#CED6DC", roughness=0.26, metallic=0.82)
    fridge_glow = make_mat(
        "Fridge_WarmIvory", "#FFF9EE", roughness=0.25, emissive_hex="#FFE8B8", emissive_strength=0.45
    )
    glass_frost = make_mat("Glass_Frosted", "#E8F6F2", roughness=0.14, alpha=0.45)
    claypot_terra = make_mat("Claypot_BatTrang", "#8C3B24", roughness=0.34)
    burner_glow = make_mat(
        "Induction_Glow", "#FF8A3D", roughness=0.22, emissive_hex="#FF6A2B", emissive_strength=1.2
    )
    coral_tako = make_mat("Tako_Coral", "#E5533D", roughness=0.40, subsurface=0.32)
    ivory_mat = make_mat("Toque_Ivory", "#FBF8F3", roughness=0.62)
    tomato_mat = make_mat("Ing_TomatoRed", "#E03C28", roughness=0.26, subsurface=0.28)
    greens_mat = make_mat("Ing_BokChoyJade", "#2D8A57", roughness=0.38, subsurface=0.22)
    tofu_mat = make_mat("Ing_TofuCream", "#F8F0DC", roughness=0.44, subsurface=0.30)
    egg_mat = make_mat("Ing_FarmEgg", "#EEC094", roughness=0.36, subsurface=0.18)
    pork_mat = make_mat("Ing_BraiseCut", "#D96A5B", roughness=0.40, subsurface=0.24)

    island_root = empty_group("Island_Root")
    add_bevel_box("Island_Cabinet", (0.0, 0.0, 0.44), (2.50, 1.36, 0.86), cabinet_jade, 0.04, island_root)
    add_bevel_box("Island_Countertop", (0.0, 0.0, 0.92), (2.68, 1.52, 0.12), wood_butcher, 0.03, island_root)

    # Zone_Fridge
    zone_fridge = empty_group("Zone_Fridge", (-1.05, 0.42, 0.0))
    add_bevel_box("Fridge_Body", (0.0, 0.0, 1.05), (0.92, 0.78, 2.04), steel_brushed, 0.04, zone_fridge)
    add_bevel_box("Fridge_BackGlow", (0.0, 0.12, 1.12), (0.78, 0.06, 1.76), fridge_glow, 0.01, zone_fridge)
    for idx, z_h in enumerate((0.68, 1.14, 1.58)):
        add_bevel_box(f"Fridge_Shelf_{idx}", (0.0, -0.04, z_h), (0.76, 0.56, 0.025), glass_frost, 0.006, zone_fridge)

    # Zone_Cooktop
    zone_cooktop = empty_group("Zone_Cooktop", (-0.42, -0.05, 0.98))
    add_bevel_box("Induction_Hob", (0.0, 0.0, 0.02), (0.78, 0.68, 0.03), steel_brushed, 0.01, zone_cooktop)
    add_ellipsoid("Induction_Ring", (0.0, 0.0, 0.04), (0.26, 0.26, 0.01), burner_glow, zone_cooktop)
    add_lathed_vessel(
        "Claypot_Hero",
        [(0.01, 0.05), (0.20, 0.05), (0.29, 0.14), (0.27, 0.27), (0.30, 0.30), (0.24, 0.30), (0.22, 0.12)],
        (0.0, 0.0, 0.04),
        claypot_terra,
        48,
        zone_cooktop,
    )

    # Zone_Prep
    zone_prep = empty_group("Zone_Prep", (0.62, -0.08, 0.98))
    add_bevel_box("Prep_CuttingBoard", (0.0, 0.0, 0.03), (0.72, 0.52, 0.045), wood_butcher, 0.015, zone_prep)
    add_bevel_box("Prep_KnifeBlade", (0.14, -0.06, 0.07), (0.34, 0.07, 0.012), steel_brushed, 0.003, zone_prep)

    # Tako_Hero beside the island
    tako_hero = empty_group("Tako_Hero", (1.68, 0.15, 0.55))
    add_ellipsoid("Tako_Head", (0.0, 0.0, 0.62), (0.42, 0.36, 0.45), coral_tako, tako_hero)
    add_ellipsoid("Tako_Toque", (0.0, 0.0, 1.12), (0.28, 0.28, 0.22), ivory_mat, tako_hero)

    # Floating_Ingredients orbiting above island
    floating = empty_group("Floating_Ingredients", (0.10, -0.05, 1.65))
    add_ellipsoid("Ing_Tomato", (-0.52, -0.18, 0.12), (0.11, 0.11, 0.095), tomato_mat, floating)
    add_ellipsoid("Ing_Egg", (-0.18, 0.24, 0.26), (0.075, 0.075, 0.10), egg_mat, floating)
    add_ellipsoid("Ing_Greens", (0.24, -0.22, 0.18), (0.14, 0.08, 0.16), greens_mat, floating)
    add_bevel_box("Ing_Tofu", (0.52, 0.16, 0.08), (0.15, 0.15, 0.11), tofu_mat, 0.02, floating)
    add_bevel_box("Ing_PorkFish", (-0.06, -0.26, 0.32), (0.18, 0.11, 0.08), pork_mat, 0.02, floating)
    add_ellipsoid("Ing_Chili", (0.38, 0.28, 0.30), (0.03, 0.12, 0.03), tomato_mat, floating)

    return export_glb("kitchen-island-hero.glb")


# ---------------------------------------------------------------------------
# Scene 2: `onboarding-mam-com.glb`
# ---------------------------------------------------------------------------
def build_onboarding_mam_com() -> str:
    clear_scene()
    rattan_wood = make_mat("Rattan_WarmWood", "#C58D56", roughness=0.54)
    ceramic_ivory = make_mat("Ceramic_BatTrangIvory", "#FAF5EC", roughness=0.22)
    ceramic_jade = make_mat("Ceramic_CeladonRim", "#2D7A58", roughness=0.26)
    claypot_terra = make_mat("Claypot_DarkGlaze", "#7B321D", roughness=0.30)
    braise_sauce = make_mat("Sauce_CaramelKho", "#9E3818", roughness=0.16)
    soup_broth = make_mat("Soup_CanhChua", "#E89B3C", roughness=0.18)
    greens_mat = make_mat("Greens_StirFry", "#267B4B", roughness=0.34, subsurface=0.20)
    rice_fluffy = make_mat("Rice_Jasmine", "#FFFDF9", roughness=0.58, subsurface=0.25)
    bamboo_chop = make_mat("Bamboo_Chopstick", "#D7A96E", roughness=0.42)
    chili_red = make_mat("Chili_Fresh", "#DC2F1F", roughness=0.28)

    tray_root = empty_group("MamCom_Tray")
    add_lathed_vessel(
        "Tray_Base",
        [(0.01, 0.0), (1.42, 0.0), (1.48, 0.08), (1.45, 0.12), (1.38, 0.04), (0.01, 0.04)],
        (0.0, 0.0, 0.0),
        rattan_wood,
        64,
        tray_root,
    )

    # Central shared Vietnamese dishes
    claypot = add_lathed_vessel(
        "Dish_Claypot",
        [(0.01, 0.04), (0.28, 0.04), (0.36, 0.14), (0.34, 0.24), (0.28, 0.24), (0.26, 0.14)],
        (-0.34, 0.24, 0.02),
        claypot_terra,
        44,
        tray_root,
    )
    add_ellipsoid("Claypot_Fill", (0.0, 0.0, 0.18), (0.28, 0.28, 0.03), braise_sauce, claypot)

    soup = add_lathed_vessel(
        "Dish_Soup",
        [(0.01, 0.04), (0.22, 0.04), (0.38, 0.18), (0.40, 0.26), (0.36, 0.26), (0.22, 0.10)],
        (0.36, 0.22, 0.02),
        ceramic_ivory,
        44,
        tray_root,
    )
    add_ellipsoid("Soup_Fill", (0.0, 0.0, 0.20), (0.34, 0.34, 0.03), soup_broth, soup)

    plate = add_lathed_vessel(
        "Dish_StirFry",
        [(0.01, 0.04), (0.32, 0.04), (0.42, 0.09), (0.38, 0.10), (0.01, 0.06)],
        (0.0, -0.34, 0.02),
        ceramic_jade,
        44,
        tray_root,
    )
    add_ellipsoid("StirFry_Greens", (0.0, 0.0, 0.10), (0.26, 0.22, 0.07), greens_mat, plate)

    garnish = empty_group("Garnish_Spice", (0.0, 0.02, 0.06), tray_root)
    add_lathed_vessel(
        "Dish_Dip",
        [(0.01, 0.0), (0.12, 0.0), (0.16, 0.05), (0.14, 0.06), (0.01, 0.02)],
        (0.0, 0.0, 0.0),
        ceramic_ivory,
        32,
        garnish,
    )
    add_ellipsoid("Dip_Sauce", (0.0, 0.0, 0.035), (0.12, 0.12, 0.015), braise_sauce, garnish)
    add_ellipsoid("Dip_Chili", (0.02, 0.0, 0.05), (0.05, 0.02, 0.015), chili_red, garnish)

    # 5 radial Place_1 .. Place_5 nodes around perimeter
    radius_ring = 1.02
    for idx in range(5):
        angle = -math.pi * 0.5 + (2.0 * math.pi * idx) / 5.0
        px = radius_ring * math.cos(angle)
        py = radius_ring * math.sin(angle)
        place = empty_group(f"Place_{idx + 1}", (px, py, 0.04))
        place.rotation_euler = (0.0, 0.0, angle + math.pi * 0.5)

        add_lathed_vessel(
            f"Bowl_{idx + 1}",
            [(0.01, 0.0), (0.11, 0.0), (0.21, 0.11), (0.22, 0.16), (0.19, 0.16), (0.10, 0.04)],
            (0.0, 0.0, 0.0),
            ceramic_ivory,
            36,
            place,
        )
        add_ellipsoid(f"Rice_{idx + 1}", (0.0, 0.0, 0.13), (0.17, 0.17, 0.065), rice_fluffy, place)
        for c_idx, offset in enumerate((-0.028, 0.028)):
            add_bevel_box(
                f"Chopstick_{idx + 1}_{c_idx}",
                (0.25, offset, 0.025),
                (0.014, 0.44, 0.014),
                bamboo_chop,
                0.003,
                place,
            )

    return export_glb("onboarding-mam-com.glb")


# ---------------------------------------------------------------------------
# Scene 3: `smart-fridge-3zone.glb`
# ---------------------------------------------------------------------------
def build_smart_fridge_3zone() -> str:
    clear_scene()
    chassis_mat = make_mat("Fridge_BrushedTitanium", "#CFD8DE", roughness=0.28, metallic=0.78)
    liner_cream = make_mat("Fridge_LinerCream", "#FCF8F0", roughness=0.35)
    shelf_cool = make_mat("Shelf_CoolGlass", "#DCF4EC", roughness=0.14, alpha=0.48)
    shelf_freeze = make_mat("Shelf_FreezeFrost", "#D8EEFF", roughness=0.20, alpha=0.55)
    drawer_pantry = make_mat("Drawer_WarmOak", "#C9925B", roughness=0.48)
    veg_jade = make_mat("Food_FreshGreens", "#2A8754", roughness=0.36, subsurface=0.22)
    meat_coral = make_mat("Food_FrozenProtein", "#DC6458", roughness=0.38, subsurface=0.20)
    grain_gold = make_mat("Food_PantryGrain", "#E3AE52", roughness=0.52)
    amber_orb = make_mat(
        "Freshness_AmberOrb", "#F59E0B", roughness=0.18, emissive_hex="#FBBF24", emissive_strength=1.6
    )

    chassis = empty_group("Fridge_Chassis")
    add_bevel_box("Chassis_Back", (0.0, 0.36, 1.20), (1.42, 0.10, 2.40), chassis_mat, 0.04, chassis)
    add_bevel_box("Chassis_Left", (-0.68, 0.0, 1.20), (0.08, 0.78, 2.40), chassis_mat, 0.03, chassis)
    add_bevel_box("Chassis_Right", (0.68, 0.0, 1.20), (0.08, 0.78, 2.40), chassis_mat, 0.03, chassis)
    add_bevel_box("Chassis_Top", (0.0, 0.0, 2.38), (1.42, 0.78, 0.08), chassis_mat, 0.03, chassis)
    add_bevel_box("Chassis_Bottom", (0.0, 0.0, 0.04), (1.42, 0.78, 0.08), chassis_mat, 0.03, chassis)

    # Zone_Cool (Upper compartment: Ngăn mát)
    zone_cool = empty_group("Zone_Cool", (0.0, 0.0, 1.72))
    add_bevel_box("Cool_BackGlow", (0.0, 0.28, 0.0), (1.24, 0.03, 0.96), liner_cream, 0.008, zone_cool)
    add_bevel_box("Cool_Shelf_Upper", (0.0, -0.02, 0.14), (1.24, 0.64, 0.025), shelf_cool, 0.006, zone_cool)
    add_bevel_box("Cool_Shelf_Lower", (0.0, -0.02, -0.34), (1.24, 0.64, 0.025), shelf_cool, 0.006, zone_cool)
    add_ellipsoid("Cool_GreensCluster", (-0.32, -0.04, 0.26), (0.20, 0.14, 0.12), veg_jade, zone_cool)
    add_ellipsoid("Orb_Cool", (0.50, -0.26, 0.34), (0.055, 0.055, 0.055), amber_orb, zone_cool)

    # Zone_Freeze (Middle cryo compartment: Ngăn đá)
    zone_freeze = empty_group("Zone_Freeze", (0.0, 0.0, 0.96))
    add_bevel_box("Freeze_Drawer", (0.0, -0.02, -0.18), (1.24, 0.64, 0.035), shelf_freeze, 0.008, zone_freeze)
    add_bevel_box("Freeze_SalmonCut", (-0.26, -0.04, -0.08), (0.34, 0.22, 0.10), meat_coral, 0.02, zone_freeze)
    add_ellipsoid("Orb_Freeze", (0.50, -0.26, 0.10), (0.055, 0.055, 0.055), amber_orb, zone_freeze)

    # Zone_Pantry (Lower dry storage drawer: Tủ đồ khô)
    zone_pantry = empty_group("Zone_Pantry", (0.0, 0.0, 0.36))
    add_bevel_box("Pantry_WoodTray", (0.0, -0.02, -0.16), (1.24, 0.66, 0.18), drawer_pantry, 0.02, zone_pantry)
    add_ellipsoid("Pantry_RiceSack", (-0.28, -0.02, 0.04), (0.22, 0.18, 0.18), grain_gold, zone_pantry)
    add_ellipsoid("Orb_Pantry", (0.50, -0.26, 0.12), (0.055, 0.055, 0.055), amber_orb, zone_pantry)

    return export_glb("smart-fridge-3zone.glb")


# ---------------------------------------------------------------------------
# Scene 4: `culinary-cookware-stage.glb`
# ---------------------------------------------------------------------------
def build_culinary_cookware_stage() -> str:
    clear_scene()
    hob_dark = make_mat("Hob_CeramicObsidian", "#1C2428", roughness=0.22, metallic=0.35)
    cast_iron = make_mat("Wok_SeasonedCastIron", "#272D30", roughness=0.38, metallic=0.68)
    clay_terra = make_mat("Claypot_BatTrangTerra", "#8E3A22", roughness=0.32)
    steel_pot = make_mat("Stockpot_BrushedSteel", "#D2DADF", roughness=0.22, metallic=0.88)
    broth_gold = make_mat("Broth_SimmerGold", "#E6A13B", roughness=0.14)
    bamboo_weave = make_mat("Steamer_NaturalBamboo", "#D8AA6C", roughness=0.56)
    butcher_oak = make_mat("PrepBoard_EndGrainOak", "#C48850", roughness=0.46)
    flame_amber = make_mat(
        "Burner_FlameCore", "#FF7B38", roughness=0.18, emissive_hex="#FF6B2B", emissive_strength=2.2
    )
    herb_jade = make_mat("Prep_FreshHerbs", "#268452", roughness=0.36, subsurface=0.22)

    hob = empty_group("Burner_Base")
    add_bevel_box("Hob_Plate", (0.0, 0.0, 0.06), (1.65, 1.45, 0.12), hob_dark, 0.03, hob)

    flame_ring = empty_group("Flame_Ring", (0.0, 0.0, 0.14))
    for i in range(12):
        theta = (2.0 * math.pi * i) / 12.0
        add_ellipsoid(
            f"Flame_Jet_{i}",
            (0.42 * math.cos(theta), 0.42 * math.sin(theta), 0.04),
            (0.045, 0.045, 0.085),
            flame_amber,
            flame_ring,
        )

    # 1. Rig_Wok
    rig_wok = empty_group("Rig_Wok", (0.0, 0.0, 0.16))
    add_lathed_vessel(
        "Wok_Body",
        [(0.01, 0.02), (0.34, 0.08), (0.64, 0.30), (0.72, 0.40), (0.69, 0.40), (0.32, 0.10)],
        (0.0, 0.0, 0.0),
        cast_iron,
        48,
        rig_wok,
    )
    add_bevel_box("Wok_Handle", (-0.96, 0.0, 0.44), (0.56, 0.08, 0.08), butcher_oak, 0.02, rig_wok)
    add_bevel_box("Wok_Spatula", (0.18, -0.08, 0.42), (0.62, 0.11, 0.02), steel_pot, 0.005, rig_wok)

    # 2. Rig_Claypot
    rig_claypot = empty_group("Rig_Claypot", (0.0, 0.0, 0.16))
    add_lathed_vessel(
        "Claypot_Vessel",
        [(0.01, 0.0), (0.40, 0.0), (0.54, 0.18), (0.50, 0.38), (0.55, 0.42), (0.46, 0.42), (0.42, 0.16)],
        (0.0, 0.0, 0.0),
        clay_terra,
        48,
        rig_claypot,
    )
    lid = add_lathed_vessel(
        "Claypot_Lid",
        [(0.01, 0.54), (0.09, 0.56), (0.06, 0.50), (0.49, 0.42), (0.01, 0.42)],
        (0.0, 0.0, 0.0),
        clay_terra,
        48,
        rig_claypot,
    )
    lid.location.z = 0.01

    # 3. Rig_Stockpot
    rig_stockpot = empty_group("Rig_Stockpot", (0.0, 0.0, 0.16))
    add_lathed_vessel(
        "Stockpot_Body",
        [(0.01, 0.0), (0.52, 0.0), (0.54, 0.52), (0.57, 0.55), (0.50, 0.55), (0.49, 0.05)],
        (0.0, 0.0, 0.0),
        steel_pot,
        48,
        rig_stockpot,
    )
    add_ellipsoid("Stockpot_Broth", (0.0, 0.0, 0.44), (0.49, 0.49, 0.02), broth_gold, rig_stockpot)

    # 4. Rig_Steamer
    rig_steamer = empty_group("Rig_Steamer", (0.0, 0.0, 0.16))
    for tier_idx, z_off in enumerate((0.0, 0.24)):
        add_lathed_vessel(
            f"Steamer_Tier_{tier_idx + 1}",
            [(0.01, z_off), (0.52, z_off), (0.52, z_off + 0.23), (0.47, z_off + 0.23), (0.47, z_off + 0.03)],
            (0.0, 0.0, 0.0),
            bamboo_weave,
            48,
            rig_steamer,
        )
    add_lathed_vessel(
        "Steamer_Lid",
        [(0.01, 0.58), (0.53, 0.48), (0.53, 0.44), (0.01, 0.48)],
        (0.0, 0.0, 0.0),
        bamboo_weave,
        48,
        rig_steamer,
    )

    # 5. Rig_PrepBoard
    rig_prep = empty_group("Rig_PrepBoard", (0.0, 0.0, 0.14))
    add_bevel_box("Prep_Block", (0.0, 0.0, 0.06), (1.32, 0.96, 0.10), butcher_oak, 0.025, rig_prep)
    add_bevel_box("Prep_Knife", (0.16, -0.08, 0.16), (0.64, 0.12, 0.016), steel_pot, 0.004, rig_prep)
    add_ellipsoid("Prep_Herbs", (-0.24, 0.08, 0.14), (0.22, 0.18, 0.06), herb_jade, rig_prep)

    return export_glb("culinary-cookware-stage.glb")


def main() -> None:
    outputs = [
        build_kitchen_island_hero(),
        build_onboarding_mam_com(),
        build_smart_fridge_3zone(),
        build_culinary_cookware_stage(),
    ]
    print("TAKO_V4_CULINARY_SCENES_EXPORT_OK", json.dumps({"exported": outputs}))


if __name__ == "__main__":
    main()
