import bpy, json, math
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'tako-3d-candidate-v1.blend'))
scene=bpy.context.scene
scene.cycles.samples=48
scene.render.resolution_x=scene.render.resolution_y=2048
scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.frame_set(1)
camera=scene.camera
views=[('front',(0,-8,2.6)),('three-quarter',(3.1,-8,3.35)),('side',(8,-0.2,2.8)),('back',(0,8,2.9))]
for name,position in views:
 camera.location=position
 camera.rotation_euler=(Vector((0,0,1.72))-camera.location).to_track_quat('-Z','Y').to_euler()
 camera.data.ortho_scale=4.45
 scene.render.filepath=str(out/('tako-'+name+'-2048.png'))
 bpy.ops.render.render(write_still=True)
 print('VIEW_COMPLETE',name,flush=True)
print('TURNAROUND_COMPLETE',flush=True)
