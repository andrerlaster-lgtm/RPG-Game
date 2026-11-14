"""Package the licensed Shadow mesh with its supplied PBR maps and in-place actions.

Usage: python3 tools/prepare_rogue.py /path/to/extracted/pack
Requires Pillow. No network access; never executes files from the asset archive.
"""
import copy, io, json, math, pathlib, struct, sys
from PIL import Image

source = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parents[1]
raw = next(source.rglob('*Merged_Animations.glb')).read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20+length]); binary = raw[28+length:]
# Repack views, dropping the original 27 MB image rather than leaving dead bytes.
old_images = {im['bufferView'] for im in g['images']}
buf = bytearray()
for i, view in enumerate(g['bufferViews']):
    offset = len(buf)
    data = b'' if i in old_images else binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    buf.extend(data); buf.extend(b'\0'*(-len(buf)%4))
    view.update(byteOffset=offset, byteLength=len(data))

def view(data):
    idx = len(g['bufferViews']); g['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':len(data)})
    buf.extend(data); buf.extend(b'\0'*(-len(buf)%4)); return idx

def image(im, name, fmt='PNG', **extra):
    stream = io.BytesIO(); im.save(stream,format=fmt,**({'quality':92, **extra} if fmt=='JPEG' else {}))
    g['images'].append({'name':name,'mimeType':'image/jpeg' if fmt=='JPEG' else 'image/png','bufferView':view(stream.getvalue())})
    g['textures'].append({'source':len(g['images'])-1,'sampler':0}); return len(g['textures'])-1

def texture(suffix, size):
    im = Image.open(next((source/'Textures').glob('*'+suffix+'.png'))).convert('RGB')
    im.thumbnail((size,size),Image.Resampling.LANCZOS); return im

g['images']=[];g['textures']=[]
g['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
base=image(texture('texture_0',2048),'Shadow base colour','JPEG')
# Normal and roughness/metallic maps are JPEG without colour subsampling (see tools/shrink_rogue_textures.py):
# the normal map at 1024 keeps the in-game look and cuts the download from about 10 MB to about 3.6 MB.
normal=image(texture('normal',1024),'Shadow tangent-space normal','JPEG',subsampling=0,optimize=True)
rough=texture('roughness',1024).getchannel('R'); metal=texture('metallic',1024).getchannel('R')
orm=image(Image.merge('RGB',(Image.new('L',rough.size,255),rough,metal)),'Shadow packed roughness metallic','JPEG',subsampling=0,optimize=True)
g['materials']=[{'name':'ZAY_Shadow_Leather_Cloth_Skin','doubleSided':True,
    'pbrMetallicRoughness':{'baseColorTexture':{'index':base},'metallicRoughnessTexture':{'index':orm},'metallicFactor':1,'roughnessFactor':1},
    'normalTexture':{'index':normal,'scale':0.7}}]
g.pop('extensionsUsed',None);g.pop('extensionsRequired',None)

def read_accessor(idx):
    a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    start=v['byteOffset']+a.get('byteOffset',0)
    fmt,width={5126:('f',4),5125:('I',4),5123:('H',2),5121:('B',1)}[a['componentType']]
    return [list(struct.unpack_from('<'+fmt*n,buf,start+i*n*width)) for i in range(a['count'])]

def accessor(rows, typ):
    flat=[x for row in rows for x in row]; idx=len(g['accessors'])
    a={'bufferView':view(struct.pack('<'+'f'*len(flat),*flat)),'componentType':5126,'count':len(rows),'type':typ}
    if typ=='SCALAR': a.update(min=[min(flat)],max=[max(flat)])
    g['accessors'].append(a);return idx

# The source splits normals at many UV seams, making cheeks and cloth look faceted.
# Smooth coincident vertices only across angles under 60 degrees; preserve hard gear edges,
# topology, UVs and skin weights. The source has no tangent attribute to invalidate.
for mesh in g['meshes']:
    for primitive in mesh['primitives']:
        attrs=primitive['attributes'];positions=read_accessor(attrs['POSITION']);normals=read_accessor(attrs['NORMAL'])
        groups={}
        for i,pos in enumerate(positions):groups.setdefault(tuple(round(x,6) for x in pos),[]).append(i)
        result=[None]*len(normals)
        for indices in groups.values():
            for i in indices:
                compatible=[normals[j] for j in indices if sum(a*b for a,b in zip(normals[i],normals[j]))>.5]
                total=[sum(n[k] for n in compatible) for k in range(3)]
                length=math.sqrt(sum(x*x for x in total))
                result[i]=[x/length for x in total] if length else normals[i]
        attrs['NORMAL']=accessor(result,'VEC3')
        g['bufferViews'][g['accessors'][attrs['NORMAL']]['bufferView']]['target']=34962
        # Bake an explicit UV tangent basis instead of relying on derivative-based
        # tangent generation in each renderer. Keep mirrored-UV handedness in w.
        uv=read_accessor(attrs['TEXCOORD_0']);indices=[r[0] for r in read_accessor(primitive['indices'])]
        tan=[[0.,0.,0.] for _ in positions];bitan=[[0.,0.,0.] for _ in positions]
        for a,b,c in zip(indices[::3],indices[1::3],indices[2::3]):
            e1=[positions[b][k]-positions[a][k] for k in range(3)];e2=[positions[c][k]-positions[a][k] for k in range(3)]
            du1,dv1=[uv[b][k]-uv[a][k] for k in range(2)];du2,dv2=[uv[c][k]-uv[a][k] for k in range(2)]
            determinant=du1*dv2-du2*dv1
            if abs(determinant)<1e-12:continue
            for i in (a,b,c):
                for k in range(3):
                    tan[i][k]+=(dv2*e1[k]-dv1*e2[k])/determinant
                    bitan[i][k]+=(du1*e2[k]-du2*e1[k])/determinant
        tangents=[]
        for n,t,b in zip(result,tan,bitan):
            dot=sum(a*b for a,b in zip(n,t));v=[t[k]-n[k]*dot for k in range(3)];length=math.sqrt(sum(x*x for x in v))
            if length<1e-12:
                axis=[1,0,0] if abs(n[0])<.9 else [0,1,0];dot=sum(a*b for a,b in zip(n,axis));v=[axis[k]-n[k]*dot for k in range(3)];length=math.sqrt(sum(x*x for x in v))
            v=[x/length for x in v];cross=[n[1]*v[2]-n[2]*v[1],n[2]*v[0]-n[0]*v[2],n[0]*v[1]-n[1]*v[0]]
            tangents.append(v+[-1 if sum(a*b for a,b in zip(cross,b))<0 else 1])
        attrs['TANGENT']=accessor(tangents,'VEC4')
        g['bufferViews'][g['accessors'][attrs['TANGENT']]['bufferView']]['target']=34962

# All supplied clips use the same skeleton, but their root starting positions differ.
# Use one common horizontal anchor so a crossfade cannot move the collision-independent mesh.
idle=next(a for a in g['animations'] if a['name']=='Idle_9')
hips=next(i for i,n in enumerate(g['nodes']) if n.get('name')=='Hips')
idle_channels={c['target']['node']:c for c in idle['channels'] if c['target']['path']=='rotation'}
root_channel=next(c for c in idle['channels'] if c['target']=={'node':hips,'path':'translation'})
anchor=read_accessor(idle['samplers'][root_channel['sampler']]['output'])[0]
for anim in g['animations']:
    for channel in anim['channels']:
        if channel['target']=={'node':hips,'path':'translation'}:
            sampler=anim['samplers'][channel['sampler']];rows=read_accessor(sampler['output'])
            for row in rows:row[0]=anchor[0];row[2]=anchor[2]
            sampler['output']=accessor(rows,'VEC3')

def mul(a,b):
    x,y,z,w=a;X,Y,Z,W=b
    return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]
def inv(q):return [-q[0],-q[1],-q[2],q[3]]
def axis(which,angle):
    q=[0,0,0,math.cos(angle/2)];q[which]=math.sin(angle/2);return q
parents={child:i for i,n in enumerate(g['nodes']) for child in n.get('children',[])}
base_pose={i:read_accessor(idle['samplers'][c['sampler']]['output'])[0] for i,c in idle_channels.items()}
def world(i):
    q=base_pose.get(i,g['nodes'][i].get('rotation',[0,0,0,1]))
    return mul(world(parents[i]),q) if i in parents else q
names={n.get('name'):i for i,n in enumerate(g['nodes'])}
# Short gameplay gestures over the supplied idle pose. Locomotion and melee remain
# the pack's authored skeletal clips. No mesh geometry is synthesized here.
for name,duration in [('ZAY_CardThrow',.45),('ZAY_Dodge',.17),('ZAY_Interact',.8)]:
    anim={'name':name,'samplers':[],'channels':[]};times=[duration*i/24 for i in range(25)];time_idx=accessor([[t] for t in times],'SCALAR')
    for channel in idle['channels']:
        target=channel['target'];node=target['node'];path=target['path'];sample=read_accessor(idle['samplers'][channel['sampler']]['output'])[0];rows=[]
        for t in times:
            u=t/duration;pulse=math.sin(math.pi*u);value=list(sample);bone=g['nodes'][node].get('name')
            if path=='rotation':
                angle=0;which=0
                if name=='ZAY_CardThrow':
                    if bone=='RightArm':angle=-1.2*pulse
                    if bone=='RightForeArm':angle=-.65*math.sin(math.pi*min(1,u*1.8))
                    if bone=='Spine02':which=1;angle=-.22*pulse
                elif name=='ZAY_Interact' and bone=='RightArm':angle=-.65*pulse
                elif name=='ZAY_Dodge':
                    if bone=='Hips':angle=.7*pulse
                    if bone in ('LeftUpLeg','RightUpLeg'):angle=-.55*pulse
                    if bone in ('LeftLeg','RightLeg'):angle=.8*pulse
                parent=world(parents[node]) if node in parents else [0,0,0,1]
                value=mul(mul(mul(inv(parent),axis(which,angle)),parent),value)
            elif path=='translation' and node==hips:
                value[0]=anchor[0];value[2]=anchor[2]
                if name=='ZAY_Dodge':value[1]-=10*pulse
            rows.append(value)
        anim['channels'].append({'sampler':len(anim['samplers']),'target':copy.deepcopy(target)})
        anim['samplers'].append({'input':time_idx,'output':accessor(rows,'VEC4' if path=='rotation' else 'VEC3'),'interpolation':'LINEAR'})
    g['animations'].append(anim)

# Remove superseded accessors and binary data as well as the original image.
refs=[]
for mesh in g['meshes']:
    for primitive in mesh['primitives']:
        refs.extend((primitive['attributes'],k) for k in primitive['attributes'])
        refs.append((primitive,'indices'))
refs.extend((s,'inverseBindMatrices') for s in g['skins'])
for animation in g['animations']:
    for sampler in animation['samplers']:refs.extend([(sampler,'input'),(sampler,'output')])
used=sorted({obj[key] for obj,key in refs});mapping={old:new for new,old in enumerate(used)}
g['accessors']=[g['accessors'][i] for i in used]
for obj,key in refs:obj[key]=mapping[obj[key]]
used=sorted({a['bufferView'] for a in g['accessors']+g['images']})
mapping={old:new for new,old in enumerate(used)}
g['bufferViews']=[g['bufferViews'][i] for i in used]
for obj in g['accessors']+g['images']:
    if 'bufferView' in obj:obj['bufferView']=mapping[obj['bufferView']]
compact=bytearray()
for item in g['bufferViews']:
    data=buf[item['byteOffset']:item['byteOffset']+item['byteLength']];item['byteOffset']=len(compact);compact.extend(data);compact.extend(b'\0'*(-len(compact)%4))
buf=compact
g['asset']['copyright']='Rogue Assassin by Grigory Petrov. Royalty-free for games and commercial projects; do not resell the raw model.'
g['asset']['extras']={'source':'https://grigory-petrov.itch.io/shadowrogue','aiAssisted':True,'modifications':'PBR repair, seam-normal smoothing, 2K textures, in-place roots, three ZAY gameplay gestures'}
g['buffers']=[{'byteLength':len(buf)}]
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
out=root/'models/zay/shadow-rogue.glb'
out.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(buf))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buf),0x004e4942)+buf)
print(out, out.stat().st_size, 'bytes;',len(g['animations']),'clips')
