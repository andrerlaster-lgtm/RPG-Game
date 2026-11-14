"""Blender builder for ZAY; uses an MPFB CC0 anatomy/weight base. Arguments: BASE.blend OUTPUT."""
import bpy,bmesh,math,sys,random
from pathlib import Path
from mathutils import Vector,Quaternion
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(args[0]).resolve()))
body=next(o for o in bpy.data.objects if o.type=='MESH');rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.name='ZAY_Rig'
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.convert(target='MESH');body=bpy.context.object;body.name='ZAY'
def mat(n,c,r=.85,m=0):
 a=bpy.data.materials.new(n);a.diffuse_color=(*c,1);a.use_nodes=True;p=a.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;p.inputs['Metallic'].default_value=m;return a
skin=mat('Dark brown skin',(.065,.025,.013),.72);cloth=mat('Charcoal coat',(.027,.032,.04));linen=mat('Tan linen',(.34,.24,.145));pants=mat('Trousers',(.023,.027,.033));leather=mat('Worn leather',(.035,.021,.014));gold=mat('Antique brass',(.34,.21,.07),.55,.55);hair=mat('Black locs',(.004,.002,.001));tailmat=mat('Brown tail',(.045,.025,.014));white=mat('Eye sclera',(.4,.35,.27),.4);iris=mat('Hazel gold',(.44,.26,.045),.35);black=mat('Pupil',(.002,.001,.001),.4)
body.data.materials.clear();body.data.materials.append(skin)
ear=body.vertex_groups['ears'].index
for v in body.data.vertices:
 if any(g.group==ear for g in v.groups):
  f=max(0,min(1,(abs(v.co.x)-.056)/.026))*max(0,min(1,(v.co.z-1.438)/.038));v.co.x+=math.copysign(.025*f,v.co.x);v.co.z+=.038*f
body.data.update()
def bind(o,b=None):
 o.parent=rig
 for m in list(o.modifiers):
  if m.type=='ARMATURE':o.modifiers.remove(m)
 if b:
  for g in list(o.vertex_groups):o.vertex_groups.remove(g)
  o.vertex_groups.new(name=b).add(list(range(len(o.data.vertices))),1,'REPLACE')
 a=o.modifiers.new('Skin','ARMATURE');a.object=rig
 for p in o.data.polygons:p.use_smooth=True
 return o

def mesh(n,vs,fs,m,b=None):
 d=bpy.data.meshes.new(n);d.from_pydata(vs,[],fs);d.materials.append(m);d.update();o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o)
 if b:bind(o,b)
 return o

def garment(n,keep,m,offset):
 o=body.copy();o.data=body.data.copy();bpy.context.collection.objects.link(o);o.name=n;o.data.materials.clear();o.data.materials.append(m)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if not keep(f.calc_center_median())],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.normal_update()
 for iteration in range(6):
  border=[v for v in bm.verts if any(e.is_boundary for e in v.link_edges)]
  coords={v:sum((e.other_vert(v).co for e in v.link_edges if e.is_boundary),Vector())/sum(e.is_boundary for e in v.link_edges) for v in border}
  for v in border:v.co=v.co.lerp(coords[v],.5)
 bm.normal_update()
 for v in bm.verts:v.co+=v.normal*offset
 bm.to_mesh(o.data);bm.free()
 for p in o.data.polygons:p.material_index=0
 return bind(o)
garment('Shirt',lambda p:.89<p.z<1.335 and abs(p.x)<.21,linen,.007)
garment('Trousers',lambda p:.22<p.z<.96 and abs(p.x)<.24,pants,.012)
garment('Coat torso and sleeves',lambda p:.96<p.z<1.325 and abs(p.x)<.37 and not(p.y<-.015 and abs(p.x)<.035+max(0,p.z-1.15)*.25),cloth,.020)
garment('Scalp',lambda p:p.z>1.52 or(p.z>1.465 and p.y>-.012),hair,.002)
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if not(f.calc_center_median().z>1.315 or(abs(f.calc_center_median().x)>.35 and f.calc_center_median().z>.84))],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free();bind(body)
def tube(n,points,r,m,b=None,sides=8,taper=.7):
 pts=[Vector(p) for p in points];smooth=[]
 for i in range(len(pts)-1):
  p0,p1,p2,p3=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
  for j in range(5):
   t=j/5;smooth.append(.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
 smooth.append(pts[-1]);vs=[];fs=[]
 for i,p in enumerate(smooth):
  d=(smooth[min(i+1,len(smooth)-1)]-smooth[max(0,i-1)]).normalized();ref=Vector((1,0,0)) if abs(d.x)<.95 else Vector((0,1,0));u=d.cross(ref).normalized();v=d.cross(u).normalized();rr=r*(1-(1-taper)*i/(len(smooth)-1))
  for k in range(sides):vs.append(p+rr*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v))
 for i in range(len(smooth)-1):
  for k in range(sides):fs.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
 fs.extend([tuple(reversed(range(sides))),tuple(range((len(smooth)-1)*sides,len(smooth)*sides))]);return mesh(n,vs,fs,m,b)
def sphere(n,loc,scale,m,b,segments=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=12,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(m);return bind(o,b)
def box(n,loc,size,m,b):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.scale=size;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(m);be=o.modifiers.new('Soft edges','BEVEL');be.width=.004;be.segments=2;bpy.ops.object.modifier_apply(modifier=be.name);return bind(o,b)
# Accessory bones.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,parent):
 b=rig.data.edit_bones.new(n);b.head=h;b.tail=t;b.parent=rig.data.edit_bones[parent]
bone('ponytail',(0,.065,1.56),(0,.12,1.31),'head')
tp=[(0,.085,.87),(.025,.2,.83),(.055,.34,.76),(.1,.47,.66),(.16,.57,.59),(.24,.63,.60),(.31,.64,.68)]
for i in range(6):bone('tail_%d'%i,tp[i],tp[i+1],'pelvis' if i==0 else 'tail_%d'%(i-1))
bpy.ops.object.mode_set(mode='OBJECT')
# Skirt with open front, rear split, and soft weight blending into legs.
levels=[(.97,.14,.10),(.84,.16,.115),(.69,.19,.135),(.54,.21,.15)];N=40;vs=[];fs=[]
for z,rx,ry in levels:
 for i in range(N+1):
  a=.4+(math.tau-.8)*i/N;vs.append((rx*math.sin(a),.01-ry*math.cos(a),z))
for j in range(3):
 for i in range(N):
  a=.4+(math.tau-.8)*(i+.5)/N
  if j>0 and abs(a-math.pi)<.14:continue
  fs.append((j*(N+1)+i,j*(N+1)+i+1,(j+1)*(N+1)+i+1,(j+1)*(N+1)+i))
skirt=mesh('Split coat tails',vs,fs,cloth)
for v in skirt.data.vertices:
 k=max(0,min(.25,(.97-v.co.z)*.6))
 for n,w in [('pelvis',1-k),('thigh_l' if v.co.x>0 else 'thigh_r',k)]:
  g=skirt.vertex_groups.get(n) or skirt.vertex_groups.new(name=n);g.add([v.index],w,'REPLACE')
bind(skirt)
for side in [-1,1]:
 a=.4 if side>0 else math.tau-.4;tube('Coat piping',[(rx*math.sin(a),.008-ry*math.cos(a),z) for z,rx,ry in levels],.0018,gold,'pelvis',6,1)
# Open standing collar.
vs=[];fs=[]
for z,rx,ry in [(1.30,.068,.064),(1.36,.065,.06)]:
 for i in range(25):
  a=.7+(math.tau-1.4)*i/24;vs.append((rx*math.sin(a),-.014-ry*math.cos(a),z))
for i in range(24):fs.append((i,i+1,i+26,i+25))
mesh('Standing collar',vs,fs,cloth,'spine_03')
tube('Collar piping',vs[25:],.0017,gold,'spine_03',6,1)
tube('Belt',[(.146*math.sin(k*math.tau/24),.006-.105*math.cos(k*math.tau/24),.945) for k in range(25)],.013,leather,'pelvis',8,1)
box('Buckle',(0,-.108,.945),(.04,.01,.03),gold,'pelvis');box('Card pouch',(.1,-.11,.89),(.065,.035,.08),leather,'pelvis')
tube('Necklace',[(-.038,-.05,1.32),(-.024,-.093,1.26),(0,-.107,1.235),(.024,-.093,1.26),(.038,-.05,1.32)],.0015,leather,'spine_03',6,1);sphere('Pendant',(0,-.112,1.235),(.008,.002,.012),gold,'spine_03',16)
for side,s in [('l',1),('r',-1)]:
 f=rig.data.bones['foot_'+side].head_local;c=rig.data.bones['calf_'+side].head_local
 sphere('Boot foot '+side,(s*.18,-.098,.051),(.052,.13,.05),leather,'foot_'+side);sphere('Boot sole '+side,(s*.18,-.095,.021),(.055,.134,.017),cloth,'foot_'+side)
 vs=[];fs=[]
 for z,rx,ry in [(.065,.049,.050),(.14,.058,.060),(.28,.074,.071),(.38,.073,.068)]:
  xx=f.x+(c.x-f.x)*(z-.066)/.408;yy=-.015-(z-.14)*.1
  for k in range(20):vs.append((xx+rx*math.cos(k*math.tau/20),yy+ry*math.sin(k*math.tau/20),z))
 for j in range(3):
  for k in range(20):fs.append((j*20+k,j*20+(k+1)%20,(j+1)*20+(k+1)%20,(j+1)*20+k))
 mesh('Boot shaft '+side,vs,fs,leather,'calf_'+side)
 for z in [.15,.33]:
  xx=f.x+(c.x-f.x)*(z-.066)/.408;tube('Boot strap',[(xx+.076*math.cos(k*math.tau/20),-.03+.072*math.sin(k*math.tau/20),z) for k in range(21)],.0045,cloth,'calf_'+side,6,1);box('Boot buckle',(xx+s*.076,-.03,z),(.008,.024,.019),gold,'calf_'+side)
# Eyes and brows.
for s in [-1,1]:
 x=s*.02889;sphere('Eye',(x,-.1273,1.47385),(.0143,.0153,.014),white,'head',32);sphere('Iris',(x,-.1415,1.47385),(.0068,.0022,.0068),iris,'head');sphere('Pupil',(x,-.1432,1.47385),(.0027,.0011,.0037),black,'head');tube('Brow',[(s*.013,-.14,1.496),(s*.03,-.14,1.501),(s*.047,-.129,1.496)],.003,hair,'head',6,.45)
# Individual swept locs and tied ponytail.
for i in range(18):
 a=i*math.tau/18;x=.067*math.sin(a);y=-.037-.084*math.cos(a)
 tube('Swept loc',[(x,y,1.53+.018*math.cos(a)),(x*.9,y*.6,1.58),(x*.5,.028,1.60),(x*.35,.068,1.565)],.0075,hair,'head',7,.8)
for i in range(17):
 a=i*2.39996;r=.014+.018*(i%4)/3;x=r*math.cos(a);y=.083+r*math.sin(a);length=.18+.1*(i%6)/5
 tube('Ponytail loc',[(x,.063,1.57),(x*1.3,y,1.53),(x*1.7,y+.025,1.43),(x*1.65,y+.035,1.56-length)],.0075,hair,'ponytail',7,.6)
for s in [-1,1]:tube('Face framing loc',[(s*.052,-.09,1.56),(s*.068,-.123,1.49),(s*.068,-.11,1.41)],.006,hair,'head',7,.6)
tube('Hair tie',[(.029*math.cos(k*math.tau/20),.065,1.565+.029*math.sin(k*math.tau/20)) for k in range(21)],.0032,gold,'head',6,1)
tail=tube('Prehensile tail',tp,.022,tailmat,None,10,.22)
for v in tail.data.vertices:
 ds=sorted([((v.co-Vector(p)).length,i) for i,p in enumerate(tp[:-1])])[:2];(a,i),(b,j)=ds
 for n,w in [('tail_%d'%i,b/(a+b)),('tail_%d'%j,a/(a+b))]:
  g=tail.vertex_groups.get(n) or tail.vertex_groups.new(name=n);g.add([v.index],w,'REPLACE')
bind(tail)
tube('Katana sheath',[(-.15,-.01,.91),(-.2,.03,.67),(-.25,.07,.38)],.016,leather,'pelvis',10,.7);tube('Katana grip',[(-.15,-.01,.91),(-.134,-.026,1.04)],.012,hair,'pelvis',10,1);sphere('Katana guard',(-.15,-.01,.915),(.034,.024,.006),gold,'pelvis')
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
  for p in o.data.polygons:p.use_smooth=True
# Merge pieces by material while preserving their common skeleton and named weights.
groups={}
for o in list(bpy.context.scene.objects):
 if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='ZAY_'+name.replace(' ','_')
# In-place motion prototypes, authored for this skeleton.
rig.animation_data_create()
def rot(n,axis,a):
 b=rig.pose.bones[n];r=b.bone.matrix_local.to_quaternion();b.rotation_quaternion=b.rotation_quaternion@r.inverted()@Quaternion(axis,a)@r

def pose(kind,t):
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=(1,0,0,0);b.location=(0,0,0)
 ph=t*math.tau;moving=kind in ['Walking_A','Running_A']
 for side,s in [('l',1),('r',-1)]:
  rot('upperarm_'+side,(0,1,0),s*.42);rot('lowerarm_'+side,(1,0,0),.62);rot('thigh_'+side,(0,1,0),s*.1)
  if moving:
   f=s*math.sin(ph);rot('thigh_'+side,(1,0,0),f*(.48 if kind=='Walking_A' else .75));rot('calf_'+side,(1,0,0),max(0,-f)*.9);rot('upperarm_'+side,(1,0,0),-f*.4)
 if moving:rig.pose.bones['pelvis'].location.z=.012*abs(math.sin(ph))
 if kind=='Idle':rot('spine_03',(1,0,0),.012*math.sin(ph))
 if kind=='Dodge_Forward':
  k=math.sin(math.pi*t);rot('pelvis',(1,0,0),-.6*k)
  for side in ['l','r']:rot('thigh_'+side,(1,0,0),-.6*k);rot('calf_'+side,(1,0,0),k)
 if kind in ['Throw','Dualwield_Melee_Attack_Slice','Interact']:
  k=math.sin(math.pi*t);rot('upperarm_r',(1,0,0),-k);rot('lowerarm_r',(1,0,0),-.4*k);rot('spine_03',(0,0,1),.25*math.sin(ph))
 rot('ponytail',(1,0,0),(.09 if moving else .035)*math.sin(ph))
 for i in range(6):rot('tail_%d'%i,(0,0,1),(.1 if moving else .045)*math.sin(ph-i*.5))
scene=bpy.context.scene;scene.render.fps=30
for name,end in [('Idle',60),('Walking_A',24),('Running_A',18),('Dodge_Forward',16),('Throw',20),('Dualwield_Melee_Attack_Slice',24),('Interact',30)]:
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(0,end+1,2):
  pose(name,frame/end)
  for b in rig.pose.bones:b.keyframe_insert(data_path='rotation_quaternion',frame=frame);b.keyframe_insert(data_path='location',frame=frame)
 action.use_fake_user=True
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in ['MESH','ARMATURE']:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/'zay-mock.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_morph=False)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.world.color=(.08,.08,.08);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.018));bpy.context.object.name='STUDIO_floor';bpy.context.object.data.materials.append(mat('Studio',(.12,.14,.16)))
for name,pos,power,size in [('Key',(-2,-3,4),180,4),('Fill',(2,-1,2.6),100,3),('Rim',(1,2,3),220,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Studio camera');c=bpy.data.objects.new('Studio camera',d);scene.collection.objects.link(c);scene.camera=c;d.type='ORTHO';d.ortho_scale=2.02;c.location=(2.3,-4.5,2.0);c.rotation_euler=(Vector((0,.04,.86))-c.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'zay-mock.blend'));scene.render.filepath=str(out/'zay-front.png');bpy.ops.render.render(write_still=True)
c.location=(2.7,4,1.8);c.rotation_euler=(Vector((0,.09,.85))-c.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/'zay-back.png');bpy.ops.render.render(write_still=True)
print('ZAY_COMPLETE')
