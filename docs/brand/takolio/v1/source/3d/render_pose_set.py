import bpy, json, math, os
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
import bmesh

out = Path(os.environ.get('TAKO_POSE_OUT', str(Path(__file__).resolve().parents[2] / 'outputs/takolio-3d-candidate-v1')))
master = Path(os.environ.get('TAKO_MASTER', str(out / 'tako-3d-candidate-v1.blend')))
bpy.ops.wm.open_mainfile(filepath=str(master))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.seed = 17
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_x = scene.render.resolution_y = 2048
scene.render.resolution_percentage = 100
scene.frame_set(1)
rig = bpy.data.objects['Tako_Rig / eight articulated tentacles']
rig.animation_data_clear()
camera = scene.camera
camera.location = (1.25, -8, 3.05)
camera.data.ortho_scale = 4.65
camera.rotation_euler = (Vector((0, 0, 1.72)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
created = []


def mat(name, color, rough=0.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    values = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgb = [(v / 12.92 if v <= .04045 else ((v+.055)/1.055)**2.4) for v in values]
    node = m.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Roughness'].default_value = rough
    return m


gold = mat('Pose / Gold F7C15A', 'F7C15A')
wood = mat('Pose / Wood D99055', 'D99055')
coral = mat('Pose / Coral FF6B6B', 'FF6B6B')
navy = bpy.data.materials['Facial navy 0F2D46']
cream = bpy.data.materials['Chef hat - warm ivory']
green = bpy.data.materials['Leaf 4CAF6B']
white = bpy.data.materials['Eye catchlight - ivory']
pupil = bpy.data.materials['Glossy pupil - deep navy']


def finish(obj, name, material):
    obj.name = 'Pose / ' + name
    obj.data.materials.append(material)
    if obj.type == 'MESH':
        for face in obj.data.polygons:
            face.use_smooth = True
    created.append(obj)
    return obj


def sphere(name, point, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, location=point)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, material)


def tube(name, points, radius, material):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 4
    data.resolution_u = 20
    data.use_fill_caps = True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, point in zip(spline.bezier_points, points):
        p.co = point
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    return finish(obj, name, material)


def badge(name, points, center, scale, material):
    # Explicit front/back triangles avoid beveled 2D-curve cusp self-intersections.
    polygon = [Vector((x*scale, z*scale, 0)) for x,z in points]
    lookup = {tuple(point): i for i,point in enumerate(polygon)}
    count = len(points)
    vertices = [(point.x, depth, point.y) for depth in (-.035,.035) for point in polygon]
    faces = []
    for tri in tessellate_polygon([polygon]):
        indices = [point if isinstance(point, int) else lookup[tuple(point)] for point in tri]
        faces.append(tuple(reversed(indices)))
        faces.append(tuple(index+count for index in indices))
    for index in range(count):
        other = (index+1)%count
        faces.append((index,other,other+count,index+count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.location=center
    bevel=obj.modifiers.new('Soft badge edge','BEVEL');bevel.width=.012;bevel.segments=3
    finish(obj,name,material)
    # Flat front caps preserve the filled silhouette; curved side bevels supply depth.
    for face in obj.data.polygons:
        face.use_smooth=False
    return obj


def heart(center, scale=.016):
    points = []
    for i in range(96):
        t = i/96*math.tau
        points.append((16*math.sin(t)**3, 13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)))
    return badge('heart', points, center, scale, coral)


def star(center, scale=.22):
    points = []
    for i in range(10):
        t = math.pi/2 + i*math.pi/5
        radius = 1 if i % 2 == 0 else .48
        points.append((math.cos(t)*radius, math.sin(t)*radius))
    return badge('star', points, center, scale, gold)


def second_eye():
    def eye_part(name, x, z, scale, material, offset):
        y = -.73*math.sqrt(max(.08, 1-(x/.96)**2-((z-1.55)/1.03)**2))
        normal = Vector((x/.96**2, y/.73**2, (z-1.55)/1.03**2)).normalized()
        obj = sphere(name, Vector((x,y,z))+normal*offset, scale, material)
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = Vector((0,-1,0)).rotation_difference(normal)
    eye_part('right eye rim', .36, 1.96, (.205,.064,.265), white, .035)
    eye_part('right pupil', .36, 1.96, (.177,.073,.233), pupil, .083)
    eye_part('right catchlight', .31, 2.045, (.064,.016,.077), white, .156)
    eye_part('right catchlight small', .41, 1.88, (.022,.009,.025), white, .159)
    for obj in scene.objects:
        if obj.name.startswith(('Expression / joyful wink','Wink / rounded end')):
            obj.hide_render = True


def bowl():
    vertices, faces = [], []
    profile = [(0,.74),(.27,.74),(.38,.83),(.48,1.04),(.49,1.08),(.45,1.09),(.39,.91),(.26,.82),(0,.82)]
    for radius,z in profile:
        for j in range(64):
            a = math.tau*j/64
            vertices.append((.82+radius*math.cos(a), -.65+radius*math.sin(a), z))
    for row in range(len(profile)-1):
        for j in range(64):
            a=row*64+j; b=row*64+(j+1)%64
            faces.append((a,b,b+64,a+64))
    mesh=bpy.data.meshes.new('bowl');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('bowl',mesh);scene.collection.objects.link(obj);finish(obj,'bowl',cream)
    sphere('food rice',(.82,-.65,1.04),(.41,.38,.10),gold)
    for x,y,z in [(.7,-.69,1.14),(.95,-.62,1.14),(.78,-.47,1.13)]:
        sphere('greens',(x,y,z),(.10,.06,.035),green)


def spoon():
    tube('wooden spoon handle',[(-1.3,-.3,1.24),(-1.43,-.3,1.65),(-1.56,-.3,2.0)],.045,wood)
    sphere('wooden spoon head',(-1.60,-.3,2.12),(.11,.05,.19),wood)


def clear_pose():
    for obj in created:
        obj.hide_render = True
    created.clear()
    for obj in scene.objects:
        if obj.name.startswith(('Expression /','Wink /')):
            obj.hide_render = False
    for bone in rig.pose.bones:
        bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)


def pose_bone(arm, segment, angle):
    rig.pose.bones[f'Arm_{arm:02d}_{segment:02d}'].rotation_euler.z=angle


def configure(name):
    if name == 'welcome':
        pose_bone(1,4,-.20)
        heart((-1.2,-.1,2.48), .012)
    elif name == 'cooking':
        second_eye();bowl();spoon()
        pose_bone(2,4,.08)
    elif name == 'thinking':
        second_eye()
        for obj in scene.objects:
            if obj.name.startswith(('Expression / open smile','Expression / tongue')):
                obj.hide_render=True
        sphere('thinking mouth',(0,-.752,1.42),(.065,.025,.055),navy)
        tube('question hook',[(1.15,0,2.7),(1.18,0,2.84),(1.38,0,2.9),(1.53,0,2.77),(1.48,0,2.62),(1.34,0,2.5),(1.34,0,2.42)],.045,navy)
        sphere('question dot',(1.34,0,2.27),(.055,.045,.055),navy)
        pose_bone(1,4,-.12)
    elif name == 'excited':
        heart((-1.18,0,2.55));heart((1.18,0,2.5),.012)
        pose_bone(1,4,-.18);pose_bone(2,4,.18)
    elif name == 'completed':
        bowl();star((-1.25,0,2.55),.19);star((1.3,0,2.55),.12)
        pose_bone(1,4,-.12)
    elif name == 'cheering':
        second_eye();star((-1.2,0,2.65));star((1.23,0,2.65),.16)
        for x,z in [(-1.62,2.22),(-.94,3.20),(1.64,2.07),(1.05,3.16)]:
            tube('confetti',[(x,0,z),(x+.05,0,z+.10)],.025,gold if x<0 else green)
        pose_bone(1,4,-.2);pose_bone(2,4,.2)


receipt=[]
for name in os.environ.get('TAKO_POSES', 'welcome,cooking,thinking,excited,completed,cheering').split(','):
    clear_pose();configure(name)
    scene.render.filepath=str(out/f'tako-pose-{name}-2048.png')
    bpy.ops.render.render(write_still=True)
    receipt.append({'name':name,'file':f'tako-pose-{name}-2048.png','status':'candidate','blender':bpy.app.version_string})
    print('POSE_COMPLETE',name,flush=True)
clear_pose()
# The compact symbol keeps the eye/hat silhouette and omits apron/props and cups.
for obj in scene.objects:
    if obj.name.startswith(('Apron /','Sucker_')):
        obj.hide_render=True
scene.render.resolution_x=scene.render.resolution_y=256
scene.render.filepath=str(out/'tako-icon-256.png')
bpy.ops.render.render(write_still=True)
(out/'pose-list.json').write_text(json.dumps({'status':'3D_CANDIDATE_REVIEW_REQUIRED','poses':receipt,'icon':'tako-icon-256.png','nativeMaster':'tako-3d-candidate-v1.blend','premiumApproved':False,'remaining':['production facial controls','deformation/weight polish','physical-device acceptance','concept fidelity finishing']},indent=2)+'\n')
print('POSE_SET_COMPLETE',flush=True)
