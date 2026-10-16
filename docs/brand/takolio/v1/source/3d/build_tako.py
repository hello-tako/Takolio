import bpy, math, json, os, sys
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

OUT = Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -0.15
scene.world.color = (0.35, 0.35, 0.35)
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices: device.use = device.type == 'METAL'
    if any(d.type == 'METAL' for d in prefs.devices): scene.cycles.device = 'GPU'
except Exception as error:
    print('METAL_UNAVAILABLE', str(error), flush=True)


def linear(value):
    c = int(value, 16) / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name, color, rough=0.35, subsurface=0, coat=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    c = tuple(linear(color[i:i+2]) for i in (0, 2, 4)) + (1,)
    m.diffuse_color = c
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = c
    p.inputs['Roughness'].default_value = rough
    p.inputs['Subsurface Weight'].default_value = subsurface
    p.inputs['Subsurface Radius'].default_value = (1, 0.45, 0.3)
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.2
    return m

skin = material('Takolio Coral FF6B6B - soft vinyl', 'FF6B6B', 0.33, 0.07, 0.12)
brow_mat = skin.copy();brow_mat.name='Soft coral brows'
cream = material('Chef hat - warm ivory', 'FFF8ED', 0.49, 0.025)
apron_mat = material('Apron - cream cotton', 'F7EFE3', 0.61)
navy = material('Facial navy 0F2D46', '0F2D46', 0.31)
eye_mat = material('Glossy pupil - deep navy', '07121D', 0.09, 0, 0.5)
white = material('Eye catchlight - ivory', 'FFFDF8', 0.16)
blush = material('Cheeks FFB3B3', 'FFB3B3', 0.4, 0.05)
mouth_mat = material('Smile - warm burgundy', '65232F', 0.43)
tongue_mat = material('Tongue - rose', 'F88E9C', 0.37, 0.025)
green = material('Leaf 4CAF6B', '4CAF6B', 0.39)
vein_mat = material('Leaf vein', '2B8C4A', 0.44)
sucker_mat = material('Suckers - warm blush cream', 'FFD2B7', 0.39, 0.03)
actor = []
arm_meshes = []


def finish(obj, name, mat, actor_part=True):
    obj.name = name
    if mat: obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for polygon in obj.data.polygons: polygon.use_smooth = True
    if actor_part: actor.append(obj)
    return obj


def sphere(name, center, scale, mat, segments=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat)


def curve(name, points, bevel, mat, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 24
    data.bevel_depth = bevel
    data.bevel_resolution = 4
    data.use_fill_caps = True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    finish(obj, name, mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj


def front(x, z, offset=0):
    v = max(0.08, 1 - (x/0.96)**2 - ((z-1.55)/1.03)**2)
    y = -0.73 * math.sqrt(v)
    normal = Vector((x/(0.96**2), y/(0.73**2), (z-1.55)/(1.03**2))).normalized()
    return Vector((x, y, z)) + normal * offset, normal


def face_blob(name, x, z, scale, mat, offset=0.015):
    point, normal = front(x, z, offset)
    obj = sphere(name, point, scale, mat)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, -1, 0)).rotation_difference(normal)
    return obj

body = sphere('Tako / continuous mantle and body', (0, 0, 1.55), (0.96, 0.73, 1.03), skin, 64, 48)
body['brand_master'] = 'Takolio_Brand_OS_Kit_v1.0.zip / mascot master-front'
body['candidate_status'] = '3D_CANDIDATE_REVIEW_REQUIRED'

paths = [
    [(-0.67,0.03,1.12),(-1.04,-0.02,1.08),(-1.43,-0.06,1.29),(-1.58,-0.08,1.63),(-1.48,-0.11,1.82)],
    [(0.68,0.13,1.09),(1.03,0.16,1.04),(1.42,0.14,1.19),(1.57,0.1,1.49),(1.45,0.07,1.64)],
    [(-0.53,0.26,0.85),(-0.91,0.45,0.44),(-1.17,0.69,0.22),(-1.02,0.89,0.27)],
    [(0.55,0.27,0.84),(0.91,0.48,0.43),(1.16,0.74,0.21),(0.97,0.91,0.28)],
    [(-0.54,-0.35,0.85),(-0.87,-0.57,0.47),(-1.15,-0.68,0.28),(-1.31,-0.58,0.45)],
    [(0.55,-0.34,0.83),(0.91,-0.55,0.45),(1.23,-0.6,0.29),(1.38,-0.48,0.48)],
    [(-0.22,-0.51,0.81),(-0.34,-0.81,0.39),(-0.49,-0.98,0.23),(-0.64,-0.88,0.34)],
    [(0.21,-0.51,0.8),(0.36,-0.81,0.38),(0.55,-0.99,0.22),(0.7,-0.85,0.34)],
]


def catmull(points, u):
    points = [Vector(v) for v in points]
    t = u*(len(points)-1)
    i = min(int(t), len(points)-2)
    t -= i
    a,b,c,d = points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
    return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)


def tube(name, path):
    verts,faces = [],[]
    sections,sides = 64,24
    for i in range(sections+1):
        u = i/sections
        point = catmull(path,u)
        tangent = (catmull(path,min(1,u+0.005))-catmull(path,max(0,u-0.005))).normalized()
        axis = tangent.cross(Vector((0,1,0))).normalized()
        other = tangent.cross(axis).normalized()
        radius = 0.245*(1-0.62*u)
        if u > 0.87: radius *= math.sqrt(max(0.0001,1-((u-0.87)/0.13)**2))
        for j in range(sides):
            angle = 2*math.pi*j/sides
            verts.append(point + radius*(axis*math.cos(angle)+other*math.sin(angle)))
        if i:
            for j in range(sides):
                a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple(sections*sides+j for j in range(sides))]
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    finish(obj,name,skin)
    sub=obj.modifiers.new('Rounded continuous tentacle surface','SUBSURF');sub.levels=1
    arm_meshes.append(obj)
    return obj

for index,path in enumerate(paths):
    limb=tube('Tentacle_%02d'%(index+1),path)
    limb['tentacle_index']=index+1
    if index in [0,1,4,5,6,7]:
        for n,u in enumerate([0.45,0.59,0.72,0.82]):
            point=catmull(path,u)
            point.y -= 0.245*(1-0.62*u)*0.9
            cup=sphere('Sucker_%02d_%02d'%(index+1,n+1),point,(0.058,0.021,0.047),sucker_mat,24,16)
            cup['follow_tentacle']=index
            cup['follow_u']=u

# Facial forms follow the actual ellipsoid surface rather than a flat billboard.
face_blob('Eye / ivory rim',-0.36,1.96,(0.205,0.064,0.265),white,0.035)
face_blob('Eye / glossy dark pupil',-0.36,1.96,(0.177,0.073,0.233),eye_mat,0.083)
face_blob('Eye / large catchlight',-0.405,2.045,(0.064,0.016,0.077),white,0.156)
face_blob('Eye / small catchlight',-0.31,1.88,(0.022,0.009,0.025),white,0.159)
wink=[]
for i in range(17):
    t=i/16;x=0.22+0.42*t;z=1.95+0.12*math.sin(math.pi*t)
    point,_=front(x,z,0.035);wink.append(point)
curve('Expression / joyful wink',wink,0.039,navy)
for i,point in enumerate([wink[0],wink[-1]]):sphere('Wink / rounded end '+str(i),point,(0.039,0.039,0.039),navy,24,16)
for sign in [-1,1]:
    brow=[]
    for t in [0,0.3,0.7,1]:
        x=sign*(0.29+0.19*t);z=2.27+0.025*math.sin(math.pi*t)
        p,_=front(x,z,0.024);brow.append(p)
    curve('Soft coral brow '+str(sign),brow,0.027,brow_mat)
    for i,point in enumerate([brow[0],brow[-1]]):sphere('Brow / rounded end '+str(sign)+' '+str(i),point,(0.027,0.027,0.027),brow_mat,24,16)

outline=[(-0.22,1.51),(-0.1,1.49),(0,1.5),(0.11,1.49),(0.22,1.51),(0.19,1.4),(0.12,1.31),(0,1.29),(-0.12,1.32),(-0.19,1.4)]
points=[]
for i in range(80):
    t=i/80*len(outline);j=int(t);f=t-j
    a,b,c,d=[Vector(outline[k%len(outline)]) for k in [j-1,j,j+1,j+2]]
    xy=0.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)
    points.append(front(xy.x,xy.y,0.032)[0])
mesh=bpy.data.meshes.new('Smile interior');mesh.from_pydata(points,[],[tuple(range(len(points)))]);mesh.update()
obj=bpy.data.objects.new('Expression / open smile',mesh);scene.collection.objects.link(obj);finish(obj,obj.name,mouth_mat)
bev=obj.modifiers.new('Soft lip edge','SOLIDIFY');bev.thickness=0.012
face_blob('Expression / tongue',0,1.335,(0.11,0.014,0.044),tongue_mat,0.055)

# A fitted curved apron, with geometry and thickness.
verts,faces=[],[]
for row in range(17):
    v=row/16;z=1.18-v*0.49;width=0.31+0.16*v
    for col in range(17):
        u=col/16;x=(2*u-1)*width
        p,_=front(x,z+0.035*(2*u-1)**2,0.036);verts.append(p)
        if row and col:
            a=(row-1)*17+col-1;faces.append((a,a+1,a+18,a+17))
mesh=bpy.data.meshes.new('Fitted apron');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Apron / fitted cream bib',mesh);scene.collection.objects.link(obj);finish(obj,obj.name,apron_mat)
solid=obj.modifiers.new('Cotton thickness','SOLIDIFY');solid.thickness=0.018
sub=obj.modifiers.new('Soft cloth edge','SUBSURF');sub.levels=2
neckline=[front(x,1.18-0.038*(1-(x/0.31)**2),0.057)[0] for x in [-0.31,-0.2,0,0.2,0.31]]
curve('Apron / rolled neckline',neckline,0.019,cream)


def leaf(name,center,width,height,mat,tilt=0):
    # Lens-shaped leaf with a raised center ridge and a real thickness.
    c=Vector(center);verts=[]
    for t in [i/16 for i in range(17)]:
        w=width*math.sin(math.pi*t)**0.85
        for s in [-1,0,1]:
            x=s*w+tilt*t;z=height*t;y=-0.018*math.sin(math.pi*t)*(1-abs(s))
            verts.append(c+Vector((x,y,z)))
    faces=[]
    for i in range(16):
        for j in range(2):a=i*3+j;faces.append((a,a+1,a+4,a+3))
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);finish(obj,name,mat)
    sol=obj.modifiers.new('Leaf thickness','SOLIDIFY');sol.thickness=0.012
    sub=obj.modifiers.new('Leaf soft edges','SUBSURF');sub.levels=2
    curve(name+' / vein',[c+Vector((tilt*t,-0.022,height*t)) for t in [0,0.3,0.65,0.94]],0.006,vein_mat)
    return obj

p,_=front(-0.015,0.92,0.072)
leaf('Apron / green leaf embroidery',p,0.075,0.18,green,0.1)
leaf('Apron / small leaf embroidery',p+Vector((-0.012,0,0.01)),0.04,0.1,green,-0.065)

# Chef hat: a soft tapered band and a genuinely joined, remeshed crown.
bpy.ops.mesh.primitive_cone_add(vertices=96,radius1=0.64,radius2=0.69,depth=0.34,location=(0,0,2.57))
band=finish(bpy.context.object,'Hat / soft tapered chef band',cream)
bevel=band.modifiers.new('Rounded fabric seam','BEVEL');bevel.width=0.055;bevel.segments=4
puffs=[]
for i,(x,y,z,sx,sy,sz) in enumerate([(-0.49,0,2.93,0.38,0.41,0.39),(-0.28,0.04,3.12,0.4,0.43,0.43),(0.06,0.06,3.19,0.42,0.44,0.44),(0.4,0.03,3.09,0.4,0.43,0.42),(0.57,0,2.92,0.34,0.39,0.34)]):
    puffs.append(sphere('Crown puff '+str(i),(x,y,2.7+(z-2.7)*0.6),(sx,sy,sz*0.75),cream))
bpy.ops.object.select_all(action='DESELECT')
for puff in puffs:puff.select_set(True);actor.remove(puff)
bpy.context.view_layer.objects.active=puffs[0];bpy.ops.object.join()
crown=bpy.context.object;crown.name='Hat / unified sculpted crown';actor.append(crown)
remesh=crown.modifiers.new('Joined organic chef crown','REMESH');remesh.mode='VOXEL';remesh.voxel_size=0.035;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=crown.modifiers.new('Soft fabric crown','SMOOTH');smooth.factor=1;smooth.iterations=4
sub=crown.modifiers.new('Crown finish','SUBSURF');sub.levels=1
leaf('Hat / green leaf badge',(0.005,-0.674,2.55),0.075,0.22,green,0.14)
leaf('Hat / small green leaf badge',(-0.01,-0.679,2.56),0.047,0.13,green,-0.075)

# Join mantle and limbs into a single continuous skin before assigning deformation weights.
parts=[body]+arm_meshes
bpy.ops.object.select_all(action='DESELECT')
for part in parts:
    actor.remove(part);part.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
body=bpy.context.object;body.name='Tako / unified organic skin - eight tentacles'
actor.append(body)
remesh=body.modifiers.new('Continuous skin union','REMESH');remesh.mode='VOXEL';remesh.voxel_size=0.026;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=body.modifiers.new('Organic junction polish','SMOOTH');smooth.factor=1.1;smooth.iterations=12
bpy.ops.object.modifier_apply(modifier=smooth.name)
sub=body.modifiers.new('Skin surface finish','SUBSURF');sub.levels=1
# Soft blush is vertex color on the skin, not glued-on discs or image texture.
colors=body.data.color_attributes.new(name='SkinColor',type='FLOAT_COLOR',domain='POINT')
base=Vector(tuple(linear('FF6B6B'[i:i+2]) for i in [0,2,4]))
cheek=Vector(tuple(linear('FFB3B3'[i:i+2]) for i in [0,2,4]))
for vertex in body.data.vertices:
    point=body.matrix_world@vertex.co
    weight=0
    if point.y < -0.25:
        weight=max(math.exp(-((point.x-sign*0.655)/0.16)**2-((point.z-1.69)/0.085)**2) for sign in [-1,1])*0.68
    c=base.lerp(cheek,weight)
    colors.data[vertex.index].color=(*c,1)
attribute=skin.node_tree.nodes.new('ShaderNodeVertexColor');attribute.layer_name='SkinColor'
skin.node_tree.links.new(attribute.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
centerlines=[]
for i,path in enumerate(paths):
    for j in range(65):centerlines.append((catmull(path,j/64),i,j/64))
kdtree=KDTree(len(centerlines))
for i,(point,_,_) in enumerate(centerlines):kdtree.insert(point,i)
kdtree.balance()

# Native armature: body root plus four deform bones for each of eight arms.
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
rig=bpy.context.object;rig.name='Tako_Rig / eight articulated tentacles'
root=rig.data.edit_bones[0];root.name='Body';root.head=(0,0,0.75);root.tail=(0,0,1.7)
for index,path in enumerate(paths):
    parent=root
    for j in range(4):
        bone=rig.data.edit_bones.new('Arm_%02d_%02d'%(index+1,j+1))
        bone.head=catmull(path,j/4);bone.tail=catmull(path,(j+1)/4)
        bone.parent=parent;bone.use_connect=j>0;parent=bone
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True;rig.data.display_type='BBONE'
rig['Status']='Editable 3D candidate. Starter armature; not a certified production rig.'
for obj in actor:
    if obj.type!='MESH':continue
    arm_index=None
    if 'follow_tentacle' in obj:arm_index=int(obj['follow_tentacle'])
    if obj==body:
        body_group=obj.vertex_groups.new(name='Body')
        all_groups=[[obj.vertex_groups.new(name='Arm_%02d_%02d'%(i+1,j+1)) for j in range(4)] for i in range(8)]
        for vertex in obj.data.vertices:
            world=obj.matrix_world@vertex.co
            _,nearest,_=kdtree.find(world)
            _,index,u=centerlines[nearest]
            ellipsoid=math.sqrt((world.x/0.96)**2+(world.y/0.73)**2+((world.z-1.55)/1.03)**2)
            influence=max(0,min(1,(ellipsoid-1.01)/0.20))
            if influence<1:body_group.add([vertex.index],1-influence,'REPLACE')
            if influence>0:
                weights=[max(0,1-abs(u-(j+0.5)/4)/0.30) for j in range(4)];total=sum(weights)
                for group,w in zip(all_groups[index],weights):
                    if w:group.add([vertex.index],influence*w/total,'REPLACE')
    elif arm_index is None:
        group=obj.vertex_groups.new(name='Body');group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    else:
        groups=[obj.vertex_groups.new(name='Arm_%02d_%02d'%(arm_index+1,j+1)) for j in range(4)]
        for vertex in obj.data.vertices:
            u=vertex.index//24/64 if obj in arm_meshes else float(obj['follow_u'])
            weights=[max(0,1-abs(u-(j+0.5)/4)/0.30) for j in range(4)];total=sum(weights)
            for group,w in zip(groups,weights):
                if w:group.add([vertex.index],w/total,'REPLACE')
    mod=obj.modifiers.new('Tako starter deformation rig','ARMATURE');mod.object=rig
    obj.parent=rig
# A small editable wave cycle demonstrates the armature, without claiming six finished poses.
wave=rig.pose.bones['Arm_01_04'];wave.rotation_mode='XYZ'
for frame,angle in [(1,0),(13,-0.16),(25,0.14),(37,-0.12),(49,0)]:
    wave.rotation_euler.z=angle;wave.keyframe_insert(data_path='rotation_euler',frame=frame,group='Welcome wave')
scene.frame_start=1;scene.frame_end=49;scene.frame_set(1)


def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,1.5));return obj
light('Studio / warm key',(-3.5,-4.5,6.5),400,4)
light('Studio / soft fill',(4,-3,3.5),180,3)
light('Studio / crown rim',(2,3,5.5),350,3)
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(0.75,0.78,0.82,1);world.node_tree.nodes['Background'].inputs[1].default_value=0.22
bpy.ops.object.camera_add(location=(3.1,-8,3.35));camera=bpy.context.object;camera.name='Camera / product portrait';camera.data.type='ORTHO';camera.data.ortho_scale=4.55;scene.camera=camera;aim(camera,(0,0,1.77))
scene['brand']='Takolio / Tako'
scene['provenance']='Original procedural geometry based on supplied mascot SVG silhouette and written bible. Reference board viewed for style only; no crop/trace/texture extraction.'
scene['status']='3D_CANDIDATE_REVIEW_REQUIRED / PREMIUM_APPROVAL_PENDING'
scene['source_zip_sha256']='d2f77b552c07570d846a20d2602dd3a6c41ebb4fd9c66328234bf86da8ca1142'
scene['source_mascot']='03_Mascot/SVG/takolio-mascot-master-front.svg'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tako-3d-candidate-v1.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in actor:obj.select_set(True)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'tako-3d-candidate-v1.glb'),export_format='GLB',use_selection=True,export_animations=True,export_extras=True)
scene.render.filepath=str(OUT/'tako-hero-preview.png')
bpy.ops.render.render(write_still=True)
report={'status':'3D_CANDIDATE_REVIEW_REQUIRED','geometry':'genuine meshes, materials and armature; not 2D extrusion or board crop','blender':bpy.app.version_string,'tentacles':len(paths),'deformBones':len(rig.data.bones),'nativeMaster':'tako-3d-candidate-v1.blend','webModel':'tako-3d-candidate-v1.glb','animation':'starter 49-frame tip wave','premiumApproved':False,'remaining':['visual review and refinement','production deformation/weight polish','six finished purpose-specific poses','2048px final alpha exports','64px simplification','mobile GPU/device acceptance']}
(OUT/'model-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('TAKO_MODEL_AND_PREVIEW_COMPLETE',json.dumps(report),flush=True)
