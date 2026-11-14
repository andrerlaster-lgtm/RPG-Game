import sys,os,json,bpy,addon_utils
from pathlib import Path
ROOT=Path(sys.argv[sys.argv.index('--')+1]).resolve()
sys.path.insert(0,str(ROOT/'work/mpfb2/src'))
cache=ROOT/'work/zay-build/mpfb-cache';cache.mkdir(exist_ok=True)
bpy.utils.extension_path_user=lambda *a,**k:str(cache)
addon_utils.enable('mpfb',default_set=True,persistent=False)
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
m=TargetService.get_default_macro_info_dict();m.update(gender=1,age=.3,muscle=.65,weight=.38,height=.55,proportions=.6);m['race']={'african':1.0,'asian':0.0,'caucasian':0.0}
body=HumanService.create_human(macro_detail_dict=m)
rig=HumanService.add_builtin_rig(body,'game_engine')
bpy.context.view_layer.update()
print('BODY',list(body.dimensions),list(body.location),len(body.data.vertices))
print('MODIFIERS',[(x.name,x.type) for x in body.modifiers])
print('GROUPS',[v.name for v in body.vertex_groups if any(k in v.name.lower() for k in ['ear','eye','lip','brow','head','scalp'])])
print('BONES',[(b.name,list(b.head_local),list(b.tail_local)) for b in rig.data.bones if not any(x in b.name for x in ['index','thumb','middle','ring','pinky'])])
print('BOUNDS',[(a,min(v.co[a] for v in body.data.vertices),max(v.co[a] for v in body.data.vertices)) for a in range(3)])
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'work/zay-build/base.blend'))
