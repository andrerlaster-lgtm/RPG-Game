// Original procedural Bellemorne art: no external textures or runtime network dependencies.
import * as THREE from './vendor/three/three.module.min.js';
import { seeded } from './light3d.js';

function texture(size, paint, color = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function makePlaster() {
  const map = texture(256, (c, n) => {
    const rnd = seeded(73); c.fillStyle = '#dfd9ca'; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 6500; i++) {
      const v = 150 + Math.floor(rnd() * 100); c.fillStyle = `rgba(${v},${v},${v},.16)`;
      c.fillRect(rnd()*n, rnd()*n, 1+rnd()*3, 1+rnd()*3);
    }
    const damp = c.createLinearGradient(0, n*.7, 0, n); damp.addColorStop(0, '#2c363000'); damp.addColorStop(1, '#2c363060');
    c.fillStyle=damp;c.fillRect(0,0,n,n);
    for(let i=0;i<25;i++){c.fillStyle='rgba(92,79,60,.1)';c.fillRect(rnd()*n,n-rnd()*45,2+rnd()*8,rnd()*20);}
  });
  // Color and height textures have different transfer functions.
  const bump = map.clone(); bump.colorSpace = THREE.NoColorSpace; bump.needsUpdate = true;
  return { map, bump };
}
export function makeWetness() {
  return texture(256, (c,n) => {
    const rnd=seeded(451); c.fillStyle='#c5c5c5';c.fillRect(0,0,n,n);
    for(let i=0;i<35;i++){
      const x=rnd()*n,y=rnd()*n,r=12+rnd()*35;
      for(const dx of [-n,0,n])for(const dy of [-n,0,n]){
        const g=c.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,r);
        g.addColorStop(0,'#353535');g.addColorStop(1,'#35353500');c.fillStyle=g;c.fillRect(x+dx-r,y+dy-r,r*2,r*2);
      }
    }
  },false);
}
export const MOODS = {
  night: { top:'#061125', horizon:'#354864', ground:'#171b24', fog:0x17283b, sky:0x93b8e0, sun:0xa4c8fa, ambient:1.1, direct:1.3, env:0.6, lamps:1, exposure:1.15 },
  dusk: { top:'#253759', horizon:'#dba376', ground:'#38323b', fog:0x756d7b, sky:0xc2b9e2, sun:0xffb474, ambient:1.5, direct:2, env:0.8, lamps:0.8, exposure:1.05 },
  day: { top:'#3f76ac', horizon:'#c3deeb', ground:'#726e5d', fog:0x9bbbc9, sky:0xc4e4ff, sun:0xffead0, ambient:1.8, direct:2.5, env:1, lamps:0.12, exposure:1 }
};
export function createAtmosphere(renderer, scene, hemi, sun) {
  const cache=new Map(), pmrem=new THREE.PMREMGenerator(renderer);
  let current=null;
  function skyTexture(mood) {
    const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');
    const m=MOODS[mood],g=x.createLinearGradient(0,0,0,512);
    g.addColorStop(0,m.top);g.addColorStop(.48,m.horizon);g.addColorStop(.53,m.ground);g.addColorStop(1,m.ground);x.fillStyle=g;x.fillRect(0,0,1024,512);
    const rnd=seeded(678);
    // Soft, layered clouds around the horizon; deterministic and seamless in longitude.
    for(let i=0;i<48;i++){
      const px=rnd()*1024,py=105+rnd()*120,rx=25+rnd()*85;
      for(const offset of [-1024,0,1024]){
        x.save();x.translate(px+offset,py);x.scale(1,.16+rnd()*.12);
        const cloud=x.createRadialGradient(0,0,0,0,0,rx);cloud.addColorStop(0,mood==='night'?'#9baac020':'#fff0dc65');cloud.addColorStop(1,'#ffffff00');
        x.fillStyle=cloud;x.fillRect(-rx,-rx,rx*2,rx*2);x.restore();
      }
    }
    if(mood==='night'){
      for(let i=0;i<140;i++){x.fillStyle=`rgba(210,229,255,${.2+rnd()*.6})`;x.fillRect(rnd()*1024,rnd()*160,1,1);}
      x.fillStyle='#e5edff';x.beginPath();x.arc(720,120,9,0,Math.PI*2);x.fill();
    }
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.mapping=THREE.EquirectangularReflectionMapping;
    const env=pmrem.fromEquirectangular(tex);
    return {tex,env};
  }
  return {
    apply(name='night', indoors=false) {
      const key=MOODS[name]?name:'night', m=MOODS[key];
      if(!cache.has(key))cache.set(key,skyTexture(key));
      const entry=cache.get(key);scene.background=entry.tex;scene.environment=entry.env.texture;scene.environmentIntensity=indoors?.25:m.env;
      scene.fog.color.setHex(indoors?0x30231e:m.fog);scene.fog.near=indoors?9:12;scene.fog.far=indoors?30:42;
      hemi.color.setHex(indoors?0xe8be94:m.sky);hemi.groundColor.setHex(indoors?0x684839:0x44463f);hemi.intensity=indoors?1.7:m.ambient;
      sun.color.setHex(m.sun);sun.intensity=indoors?.35:m.direct;
      renderer.toneMappingExposure=m.exposure;current=key;renderer.shadowMap.needsUpdate=true;
      return {...m,lamps:indoors?1:m.lamps};
    },
    get current(){return current;}
  };
}

// Decorative geometry is batched by material and never changes navigation or interaction locations.
export function addFacadeArt({world, edges, grid, W, H, S, estate}) {
  const batches=new Map(), matrix=new THREE.Matrix4(), q=new THREE.Quaternion();
  const mats={trim:new THREE.MeshStandardMaterial({color:estate?0xc5bdad:0xddd1b3,roughness:.85}),
    iron:new THREE.MeshStandardMaterial({color:0x283c40,metalness:.75,roughness:.4}),
    shutter:new THREE.MeshStandardMaterial({color:0x365e59,roughness:.85}),
    pot:new THREE.MeshStandardMaterial({color:0x9a634a,roughness:1}),
    leaf:new THREE.MeshStandardMaterial({color:0x446b40,roughness:.95}),
    flower:new THREE.MeshStandardMaterial({color:0xbc667b,roughness:.85})};
  const box=new THREE.BoxGeometry(1,1,1), scroll=new THREE.TorusGeometry(.085,.012,3,8,Math.PI*1.65), leaf=new THREE.IcosahedronGeometry(1,1);
  function add(geo,mat,x,y,z,sx,sy,sz,rotation=0){
    const key=geo.uuid+mat+':'+Math.floor(x/8)+':'+Math.floor(z/8); if(!batches.has(key))batches.set(key,{geo,mat:mats[mat],transforms:[]});
    q.setFromAxisAngle(new THREE.Vector3(0,1,0),rotation);
    matrix.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz));batches.get(key).transforms.push(matrix.clone());
  }
  for(const e of edges){
    const x=(e.x0+e.x1)*S/2,z=(e.y0+e.y1)*S/2;
    const [nx,nz]={s:[0,1],n:[0,-1],e:[1,0],w:[-1,0]}[e.side];
    const tx=Math.floor(x+nx*.3),tz=Math.floor(z+nz*.3);
    if(grid[tz]?.[tx]!=='.')continue;
    const angle=Math.atan2(nx,nz), hash=Math.abs(Math.round(x*17+z*37));
    function part(mat,a,out,y,w,h,d,geo=box){add(geo,mat,x+nz*a+nx*out,y,z-nx*a+nz*out,w,h,d,angle);}
    // Continuous cornice, string course, base course and raised sidewalk margin.
    part('trim',0,.025,2.36,1.02,.13,.18);part('trim',0,.02,1.39,1.01,.07,.1);
    part('trim',0,.025,.14,1,.26,.1);part('trim',0,.17,.023,1,.04,.34);
    if(!e.win)continue;
    for(const y of [.95,1.75]){
      for(const side of [-1,1]){
        part('trim',side*.25,.025,y,.045,.64,.08);
        part('shutter',side*.35,.045,y,.15,.58,.05);
        for(let k=0;k<7;k++)part('iron',side*.35,.077,y-.23+k*.075,.13,.014,.015);
      }
      part('trim',0,.05,y+.32,.57,.065,.12);part('trim',0,.07,y-.32,.59,.07,.19);
    }
    // Scrolls and flower boxes turn the original straight railings into iron galleries.
    if(Math.round(x+z)%3!==0){
      for(const a of [-.28,0,.28])part('iron',a,.475,1.73,1,1,1,scroll);
      if(hash%4===0){
        part('pot',0,.35,1.49,.42,.14,.19);
        for(let i=0;i<5;i++){
          part('leaf',(i-2)*.075,.36,1.61,.09,.12,.1,leaf);
          part('flower',(i-2)*.07,.4,1.69+(i%2)*.025,.045,.045,.045,leaf);
        }
      }
    }
    // Recessed ground-floor shop panels framed with pale stone on selected bays.
    if(hash%7===0){part('shutter',0,.015,.54,.39,.8,.045);for(const side of [-1,1])part('trim',side*.22,.045,.54,.05,.91,.08);part('trim',0,.045,1,.49,.08,.1);}
  }
  for(let z=1;z<H-1;z++)for(let x=1;x<W-1;x++)if(grid[z][x]==='h'){
    for(let i=0;i<4;i++)add(leaf,'leaf',x+.2+(i%2)*.55,.45+(i%3)*.07,z+.2+Math.floor(i/2)*.55,.36,.45,.36,i);
  }
  const detail=new THREE.Group();detail.name='Facade detail';world.add(detail);
  for(const {geo,mat,transforms} of batches.values()){
    const im=new THREE.InstancedMesh(geo,mat,transforms.length);transforms.forEach((m,i)=>im.setMatrixAt(i,m));im.castShadow=true;im.receiveShadow=true;im.computeBoundingSphere();detail.add(im);
  }
  // Batch culling keeps distant decorative work out of the frame without touching building silhouettes.
  return detail;
}
