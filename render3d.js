// Third-person 3D view (Options → View: 3D). Draws the same districts in 3D with Three.js
// (vendor/three, MIT) and a chase camera behind ZAY. Only the picture changes: the game rules, guards,
// maps and saves are the same as the Classic top-down view, which renders with render() in game.js.
// This is an ES module, loaded after the classic scripts, so it reads their globals directly
// (state, LEVEL, grid, W, H, LAMPS, EDGES, PROPS, ...). It sets window.R3D once WebGL is working.
//
// Scale: one map tile (32 px) is one unit. The map's x runs along x, its y along z, and up is y.
// A figure faces +x, so a game direction `dir` is rotation.y = -dir.
// Characters are placeholder figures built from simple shapes in the model-sheet colours until
// proper CC0 character models are added (see README, "3D view").

import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/addons/GLTFLoader.js';
import { makeFigures } from './figure3d.js';
import { makeSky, makeSkylineTexture, makeSkyline, makeMotes, nightAt, newNight } from './sky3d.js';
import { makePost } from './post3d.js';
import { makeWorldKit, STOREY, WATER_Y } from './world3d.js';
import { makeCobbles, makeTint, withTint, makeGlow, makeWindow, makeBlob, makeMist } from './light3d.js';

const S = 1 / TILE;
const WALL_H = 2.4;
const FIG_H = 1.05;   // a standing person

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  renderer = null;   // no WebGL: the game stays in the Classic view
}

if (renderer) {
  const el = renderer.domElement;
  el.id = 'game3d';
  el.setAttribute('aria-label', 'Game view');
  el.hidden = true;
  canvas.before(el);
  el.addEventListener('mousedown', (e) => { if (e.button === 2) pressed.add('mouse-card'); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // Look around: drag on the picture (mouse or a finger) to swing the camera, wheel or pinch to zoom.
  el.style.touchAction = 'none';
  const drags = new Map();
  let pinch = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.setPointerCapture(e.pointerId); } catch { /* fine without capture */ }
    pinch = 0;
  });
  el.addEventListener('pointermove', (e) => {
    const d = drags.get(e.pointerId);
    if (!d || state.mode !== 'field' || state.paused) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    if (drags.size >= 2) {
      const [a, b] = [...drags.values()], span = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomCamera(pinch / Math.max(1, span));
      pinch = span;
      return;
    }
    const k = e.pointerType === 'mouse' ? 0.0052 : 0.0075;
    orbitCamera(dx * k, dy * k * 0.8);
  });
  const dragEnd = (e) => { drags.delete(e.pointerId); pinch = 0; };
  el.addEventListener('pointerup', dragEnd);
  el.addEventListener('pointercancel', dragEnd);
  el.addEventListener('lostpointercapture', dragEnd);
  el.addEventListener('wheel', (e) => { e.preventDefault(); if (state.mode === 'field') zoomCamera(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  renderer.setClearColor(0x07080f);
  // Colour handling. The tone mapper squeezes bright lamps and windows into the screen's range without washing out the
  // dark blues; Options keeps the choice in one place (LOOK) so it can be compared and tuned.
  const TONES = { none: THREE.NoToneMapping, linear: THREE.LinearToneMapping, reinhard: THREE.ReinhardToneMapping, cineon: THREE.CineonToneMapping, aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping };
  const LOOK = { tone: 'neutral', exposure: 1.05 };   // chosen by comparing six mappers on the same street (see docs/graphics)
  function setLook(l = {}) {
    Object.assign(LOOK, l);
    renderer.toneMapping = TONES[LOOK.tone] ?? THREE.NoToneMapping;
    renderer.toneMappingExposure = LOOK.exposure;
  }
  setLook();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1122, 9, 34);   // cool blue haze: far streets fade into night, not into black
  const camera = new THREE.PerspectiveCamera(60, 1, 0.08, 170);
  renderer.info.autoReset = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const hemi = new THREE.HemisphereLight(0x6a7fb0, 0x1c1a2c, 0.9);   // cool sky above, violet bounce from the ground
  scene.add(hemi);
  const OUTDOOR = { sky: new THREE.Color(0x6a7fb0), ground: new THREE.Color(0x1c1a2c), k: 0.9 };
  const INDOOR = { sky: new THREE.Color(0xd0a070), ground: new THREE.Color(0x40281a), k: 1.3 };   // rooms with no street: a warm glow instead of cold sky
  const moon = new THREE.DirectionalLight(0x86a0e0, 0.85);
  moon.position.set(-6, 14, -4);
  scene.add(moon, moon.target);
  moon.shadow.camera.left = moon.shadow.camera.bottom = -14; moon.shadow.camera.right = moon.shadow.camera.top = 14;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 90;
  moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.035;
  // The sky, the far skyline's texture and the drifting motes are made once; the night moves slowly through them.
  const SKY = makeSky(), MOTES = makeMotes(), skylineTex = makeSkylineTexture(), NIGHT = newNight();
  scene.add(SKY.mesh, MOTES.points);
  let nightClock = 150 + Math.random() * 200, indoors = false;
  const post = makePost(renderer, scene, camera);

  // ---------- Graphics quality (Options → Graphics) ----------
  // pr: sharpest pixel ratio allowed. shadow: moon shadow map size (0 = soft blobs only). post: bloom and grading.
  // msaa: edge smoothing samples in the post buffer. veg: how much grass and scatter to plant.
  const QUALITY = {
    low: { pr: 1, shadow: 0, post: false, msaa: 0, motes: false, veg: 0.35 },
    medium: { pr: 1.25, shadow: 1024, post: true, msaa: 0, motes: true, veg: 0.7 },
    high: { pr: 1.75, shadow: 2048, post: true, msaa: 4, motes: true, veg: 1 }
  };
  const LEVELS = ['low', 'medium', 'high'];
  let Q = QUALITY.high, qName = 'high', slowFor = 0, lastNow = 0;
  function setQuality(name) {
    const auto = !QUALITY[name];
    const pick = auto ? (isTouch ? 'medium' : 'high') : name;
    const veg = Q.veg;
    Q = QUALITY[pick]; qName = pick; slowFor = 0;
    setQuality.auto = auto;
    renderer.shadowMap.enabled = !!Q.shadow;
    moon.castShadow = !!Q.shadow && !indoors;
    if (Q.shadow && moon.shadow.mapSize.x !== Q.shadow) { moon.shadow.mapSize.set(Q.shadow, Q.shadow); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } }
    post.set(Q.post, Q.msaa);
    MOTES.points.visible = Q.motes;
    SHADOW_MAT.opacity = Q.shadow ? 0.6 : 1;
    scene.traverse((o) => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true; });
    if (veg !== Q.veg) builtFor = null;
    resize3d();
  }

  // Street lamps light the scene; only the ones nearest ZAY get a real light (phones can't afford all).
  const LIGHTS = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xff9a3c, 0, 7, 1.6);   // warm lantern light
    scene.add(l);
    LIGHTS.push(l);
  }
  // ZAY's own faint glow so he never disappears into the dark.
  const zayLight = new THREE.PointLight(0x9fb0e8, 3.4, 5.2, 1.5);
  scene.add(zayLight);

  let baseFov = 60;
  const resize3d = () => {
    const pr = Math.min(window.devicePixelRatio || 1, Q.pr);
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    el.style.width = window.innerWidth + 'px';
    el.style.height = window.innerHeight + 'px';
    const w = window.innerWidth, h = window.innerHeight;
    // Keep about 64 degrees across the screen, so a tall phone sees more than a keyhole.
    const hfov = 64 * Math.PI / 180;
    const vfov = Math.min(74, Math.max(50, 2 * Math.atan(Math.tan(hfov / 2) / (w / h)) * 180 / Math.PI)) * Math.PI / 180;
    // On phones the thumb controls cover the bottom third, so the picture's centre (where ZAY stands)
    // moves up into the part you can see: render the top of a taller, off-centre view.
    const extra = isTouch ? 0.17 * h : 0;
    const fullH = h + 2 * extra;
    camera.aspect = w / fullH;
    camera.fov = baseFov = 2 * Math.atan(Math.tan(vfov / 2) * fullH / h) * 180 / Math.PI;
    if (extra) camera.setViewOffset(w, fullH, 0, 2 * extra, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    post.resize(w, h, pr);
  };
  window.addEventListener('resize', resize3d);

  // ---------- Small helpers ----------
  const mats = new Map();
  const lambert = (color) => {
    const key = 'l' + color;
    if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color }));
    return mats.get(key);
  };
  const glowMat = (color, opacity = 1) => {
    const key = 'b' + color + opacity;
    if (!mats.has(key)) mats.set(key, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, fog: true }));
    return mats.get(key);
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // A text label that always faces the camera.
  function textSprite(lines, { font = '600 26px Barlow, sans-serif', fg = '#1a1206', bg = 'rgba(241,234,217,.95)', pad = 12, height = 0.32 } = {}) {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const lh = parseInt(font.match(/(\d+)px/)[1], 10) * 1.2;
    const w = Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width)) + pad * 2);
    const h = Math.ceil(lines.length * lh + pad);
    const tex = canvasTex(w, h, (c) => {
      if (bg) { c.fillStyle = bg; c.beginPath(); c.roundRect(0, 0, w, h, 12); c.fill(); }
      c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (!bg) { c.fillStyle = 'rgba(0,0,0,.6)'; lines.forEach((l, i) => c.fillText(l, w / 2 + 2, pad / 2 + lh * (i + 0.5) + 2)); }
      c.fillStyle = fg;
      lines.forEach((l, i) => c.fillText(l, w / 2, pad / 2 + lh * (i + 0.5)));
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
    const lineH = height / Math.max(1, lines.length) * lines.length;
    sp.scale.set(lineH * w / h, lineH, 1);
    sp.renderOrder = 10;
    return sp;
  }
  const wrap = (text, n = 26) => {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  // ---------- Textures ----------
  // Night-look textures, drawn once (see light3d.js).
  const cobbles = makeCobbles({ maxAniso: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
  const glowTex = makeGlow(), windowTex = makeWindow(), blobTex = makeBlob(), mistTex = makeMist();
  const KIT = makeWorldKit({ glowTex, maxAniso: Math.min(4, renderer.capabilities.getMaxAnisotropy()) });
  const SHARED_TEX = new Set([...KIT.textures, skylineTex, cobbles.albedo, cobbles.normal, glowTex, windowTex, blobTex, mistTex]);
  let tintTex = null;
  let MIST = [];
  const addMat = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const POOL_BASE = 0.34, HALO_BASE = 0.8;
  const POOL_MAT = addMat(glowTex, 0xff9232, POOL_BASE);
  const SHADOW_MAT = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 1, depthWrite: false, fog: false });
  const MIST_MAT = new THREE.SpriteMaterial({ map: mistTex, color: 0x5d72a8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const HALO_MAT = new THREE.SpriteMaterial({ map: glowTex, color: 0xffa646, transparent: true, opacity: HALO_BASE, blending: THREE.AdditiveBlending, depthWrite: false });
  // How high the top of each tile is (walls, plus the roof over them), for the camera.
  let TOPS = new Float32Array(0);

  // ---------- The district (rebuilt whenever a new map loads) ----------
  let world = null, builtFor = null;
  setQuality(SETTINGS.quality);
  let LABEL_SPRITES = [], EXIT_MARKS = [], BOAT_MESH = null;
  function build() {
    if (world) {
      scene.remove(world);
      world.traverse((o) => {
        if (o.userData.keep) return;   // shared with the loaded models
        if (o.geometry && !o.geometry.userData.keepGeo) o.geometry.dispose();
        const tex = o.material && !Array.isArray(o.material) && o.material.map;
        if (tex && !SHARED_TEX.has(tex)) tex.dispose();
      });
    }
    world = new THREE.Group();
    builtFor = LEVEL;
    LABEL_SPRITES = []; EXIT_MARKS = []; BOAT_MESH = null;

    // Ground: the same painted map as the Classic view.
    const groundTex = new THREE.CanvasTexture(mapCanvas);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.anisotropy = 4;
    indoors = !grid.some((row) => row.includes('.') || row.includes('w') || row.includes('g'));
    moon.castShadow = !!Q.shadow && !indoors;
    const mood = indoors ? INDOOR : OUTDOOR;
    hemi.color.copy(mood.sky); hemi.groundColor.copy(mood.ground); hemi.intensity = mood.k;
    if (tintTex) tintTex.dispose();
    tintTex = makeTint({ grid, W, H, props: PROPS, TILE });
    // Cobbled streets: the street tiles get real cobbles with relief (normal map) and a little lantern sheen,
    // over the painted ground, which stays underneath for everything else (doorsteps, grass, wooden floors).
    {
      const street = [];
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (grid[ty][tx] === '.') street.push([tx, ty]);
      if (street.length) {
        const pos = new Float32Array(street.length * 12), uv = new Float32Array(street.length * 8), tuv = new Float32Array(street.length * 8), nor = new Float32Array(street.length * 12), idx = new Uint16Array(street.length * 6);
        const PERIOD = 4;   // one cobble texture covers 4 x 4 tiles
        street.forEach(([tx, ty], i) => {
          [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([dx, dz], k) => {
            const x = tx + dx, z = ty + dz, v = i * 4 + k;
            pos.set([x, 0.004, z], v * 3); nor.set([0, 1, 0], v * 3);
            uv.set([x / PERIOD, z / PERIOD], v * 2); tuv.set([x / W, 1 - z / H], v * 2);
          });
          idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6);
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('tintUv', new THREE.BufferAttribute(tuv, 2));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        const mat = withTint(new THREE.MeshPhongMaterial({ map: cobbles.albedo, normalMap: cobbles.normal, normalScale: new THREE.Vector2(1.1, 1.1), specular: 0x3c3224, shininess: 22, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), tintTex);
        const cob = new THREE.Mesh(geo, mat); cob.userData.noCast = true;
        world.add(cob);
      }
    }
    // Buildings, ground, river and plants (world3d.js).
    const district = DISTRICTS[state.district] || {};
    const town = KIT.build(world, { grid, W, H, TILE, EDGES, TREES, LAMPS, estate: district.look === 'rogue', indoors, veg: Q.veg,
      town: indoors || district.look === 'rogue' ? 0 : state.district === 'lantern' ? 1 : 0.5, groundTex, tintTex });
    TOPS = town.TOPS;
    const beyond = mesh(new THREE.PlaneGeometry(W + 160, H + 160), lambert(0x0b0a10), W / 2, town.hasWater ? WATER_Y - 0.12 : -0.02, H / 2);
    beyond.rotation.x = -Math.PI / 2;
    beyond.userData.noCast = true;
    world.add(beyond);
    if (!indoors) world.add(makeSkyline(skylineTex, W, H));
    const m4 = new THREE.Matrix4();

    // Windows on street-facing walls: warm lit panes or dark shutters.
    const lit = [], shut = [];
    for (const e of EDGES) if (e.win) (e.win.lit ? lit : shut).push(e);
    const ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
    const NORMAL = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
    const pane = new THREE.PlaneGeometry(0.3, 0.44);
    pane.translate(0, 0, 0.028);
    const frameGeo = new THREE.BoxGeometry(0.4, 0.54, 0.05), sillGeo = new THREE.BoxGeometry(0.46, 0.05, 0.12);
    const paneMat = new THREE.MeshBasicMaterial({ map: windowTex });
    const haloGeo = new THREE.PlaneGeometry(0.78, 0.98), flatGeo = new THREE.PlaneGeometry(1, 1);
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const warm = new THREE.Color();
    for (const [list, mat] of [[lit, paneMat], [shut, lambert(0x3a2618)]]) {
      if (!list.length || indoors) continue;   // a room's walls have no street windows
      const isLit = list === lit;
      const floors = list.map((e) => town.storeysAt(e)), total = floors.reduce((a, b) => a + b, 0);
      const im = new THREE.InstancedMesh(pane, mat, total);
      const frames = [];
      // Lit windows also get a soft glow around the glass and a pool of light on the street in front of them.
      const halo = isLit ? new THREE.InstancedMesh(haloGeo, addMat(glowTex, 0xff8f2e, 0.55), total) : null;
      const pool = isLit ? new THREE.InstancedMesh(flatGeo, addMat(glowTex, 0xff8f2e, 0.2), list.length) : null;
      const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      let i = 0, j = 0;
      for (const e of list) {
        const [nx, nz] = NORMAL[e.side];
        q.setFromAxisAngle(up, ROT[e.side]);
        const cx = (e.x0 + e.x1) / 2 * S + nx * 0.01, cz = (e.y0 + e.y1) / 2 * S + nz * 0.01;
        const hsh = ((Math.round(cx * 31) * 73856093) ^ (Math.round(cz * 31) * 19349663)) >>> 0;
        const n = town.storeysAt(e);
        for (let fl = 0; fl < n; fl++) {
          const y = 0.76 + fl * STOREY;
          // a door takes the place of the ground-floor window on that wall
          if (fl === 0 && town.doorEdges.has(e)) { im.setMatrixAt(i, m4.makeScale(0, 0, 0)); if (isLit) halo.setMatrixAt(i, m4.makeScale(0, 0, 0)); i++; continue; }
          im.setMatrixAt(i, m4.compose(new THREE.Vector3(cx, y, cz), q, one));
          frames.push([cx, y, cz, ROT[e.side]]);
          if (isLit) {
            // each window a slightly different warmth and brightness (candle, lamp, hearth)
            const k = ((hsh >>> (fl * 4)) % 100) / 100;
            warm.setRGB(0.62 + 0.38 * k, 0.5 + 0.4 * k * k, 0.3 + 0.3 * k);
            im.setColorAt(i, warm);
            halo.setMatrixAt(i, m4.compose(new THREE.Vector3(cx + nx * 0.012, y, cz + nz * 0.012), q, one));
            halo.setColorAt(i, warm);
          }
          i++;
        }
        if (isLit) { pool.setMatrixAt(j++, n ? m4.compose(new THREE.Vector3(cx + nx * 0.85, 0.011, cz + nz * 0.85), flat, new THREE.Vector3(2.3, 2.3, 1)) : m4.makeScale(0, 0, 0)); }
      }
      world.add(im);
      // A timber frame and a stone sill round every window, so the glass sits in the wall instead of on it.
      if (frames.length) {
        const fm = new THREE.InstancedMesh(frameGeo, lambert(0x2a1a12), frames.length), sm = new THREE.InstancedMesh(sillGeo, lambert(0x8a857c), frames.length);
        const eu = new THREE.Euler();
        frames.forEach(([x, y, z, r], k) => {
          q.setFromEuler(eu.set(0, r, 0));
          fm.setMatrixAt(k, m4.compose(new THREE.Vector3(x, y, z), q, one));
          sm.setMatrixAt(k, m4.compose(new THREE.Vector3(x, y - 0.27, z), q, one));
        });
        fm.userData.noCast = sm.userData.noCast = true;
        world.add(fm, sm);
      }
      if (isLit) {
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
        halo.renderOrder = 2; pool.renderOrder = 1;
        world.add(halo, pool);
      }
    }

    // Furniture (counters, tables, the stage, market stalls). Stalls use the CC0 market booths once
    // models/props.glb has loaded; until then (or if it can't load) they are simple boxes.
    let stallNo = 0;
    for (const pr of PROPS) {
      const st = PROP_STYLE[pr.kind] || PROP_STYLE.table;
      const h = Math.max(0.12, st.h * WALL_H);
      const g = new THREE.Group();
      g.position.set((pr.x + pr.w / 2) * S, 0, (pr.y + pr.h / 2) * S);
      if (pr.kind === 'stall' && MODELS) {
        const kind = /mask/i.test(pr.name || '') ? 'masks' : ['food', 'pretzel', 'masks'][stallNo++ % (pr.name ? 2 : 3)];
        g.add(fitModel(kind, pr));
        world.add(g);
        continue;
      }
      if (pr.kind === 'counter' && MODELS) {   // kegs at both ends, on the side away from the room
        const back = facing(pr) + Math.PI;
        for (const sx of [-1, 1]) {
          const k = place3d('keg', 1.0);
          k.position.set(sx * (pr.w * S / 2 - 0.3), 0, 0);
          k.position.x += Math.sin(back) * 0.75; k.position.z += Math.cos(back) * 0.75;
          g.add(k);
        }
      }
      if (pr.kind === 'table' && MODELS) {   // two stools pulled up to each table
        for (const sx of [-1, 1]) { const st2 = place3d('stool', 0.42); st2.position.set(sx * 0.62, 0, 0.05 * sx); g.add(st2); }
      }
      g.add(mesh(new THREE.BoxGeometry(pr.w * S, h, pr.h * S), [lambert(st.side), lambert(st.side), lambert(st.top), lambert(st.side), lambert(st.side), lambert(st.side)], 0, h / 2, 0));
      if (pr.kind === 'stall') {   // a striped awning on poles
        const aw = mesh(new THREE.BoxGeometry(pr.w * S + 0.2, 0.06, pr.h * S + 0.2), lambert(st.top), 0, 1.7, 0);
        aw.rotation.x = 0.12;
        g.add(aw);
        for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(pr.w * S / 8, 0.065, pr.h * S + 0.21), lambert(st.stripes), (-0.5 + (k + 0.25) / 4) * pr.w * S, 1.7, 0));
        for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7), lambert(0x2a1a10), sx * pr.w * S / 2, 0.85, pr.h * S / 2));
      }
      if (pr.kind === 'table') {
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12), lambert(0xe8d9b0), 0, h + 0.06, 0));
        g.add(mesh(new THREE.SphereGeometry(0.03), glowMat(0xffcf7a), 0, h + 0.15, 0));
      }
      world.add(g);
    }

    // Street lamps: iron post, lantern with a glowing core, a cap, a soft halo and a pool of light on the street.
    // The posts, cores and caps are drawn instanced (three draw calls for every lamp in the district).
    if (LAMPS.length) {
      const dark = lambert(0x15121c);
      const parts = [
        [new THREE.CylinderGeometry(0.035, 0.055, 1.85, 6), dark, 0.925],
        [new THREE.CylinderGeometry(0.1, 0.07, 0.05, 8), dark, 1.84],
        [new THREE.CylinderGeometry(0.075, 0.09, 0.2, 8), glowMat(0xffd48a), 1.96],
        [new THREE.ConeGeometry(0.15, 0.12, 8), dark, 2.12],
      ];
      for (const [geo, mat, y] of parts) {
        const im = new THREE.InstancedMesh(geo, mat, LAMPS.length);
        LAMPS.forEach((l, i) => im.setMatrixAt(i, m4.makeTranslation(l.x * S, y, l.y * S)));
        world.add(im);
      }
      const pool = new THREE.InstancedMesh(flatGeo, POOL_MAT, LAMPS.length);
      pool.renderOrder = 1;
      LAMPS.forEach((l, i) => {
        pool.setMatrixAt(i, m4.compose(new THREE.Vector3(l.x * S, 0.01, l.y * S), flat, new THREE.Vector3(l.r * S * 1.5, l.r * S * 1.5, 1)));
        const sp = new THREE.Sprite(HALO_MAT); sp.position.set(l.x * S, 1.97, l.y * S); sp.scale.setScalar(1.25); sp.renderOrder = 3;
        world.add(sp);
      });
      world.add(pool);
    }

    // Low mist: a few soft patches hanging over the streets (skipped on phones and tablets to keep the fill cost down).
    MIST = [];
    if (!isTouch) {
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
        if (grid[ty][tx] !== '.' || ((tx * 7349 + ty * 3571 + tx * ty) >>> 0) % 17 !== 0) continue;
        const sp = new THREE.Sprite(MIST_MAT); sp.scale.set(5.5, 2.2, 1); sp.position.set(tx + 0.5, 0.75, ty + 0.5); sp.renderOrder = 4;
        world.add(sp); MIST.push({ sp, x: tx + 0.5, z: ty + 0.5, ph: tx * 1.7 + ty * 0.9 });
      }
    }

    // The river boat.
    if (BOAT.x > -1e4) {
      const boat = new THREE.Group();
      boat.position.set(BOAT.x * S, tileAt(BOAT.x, BOAT.y) === 'w' ? WATER_Y + 0.02 : 0, BOAT.y * S);
      BOAT_MESH = boat;
      boat.add(mesh(new THREE.BoxGeometry(2, 0.3, 0.8), lambert(0x4a3523), 0, 0.05, 0));
      boat.add(mesh(new THREE.BoxGeometry(1.8, 0.05, 0.6), lambert(0x2a1d12), 0, 0.22, 0));
      boat.add(mesh(new THREE.SphereGeometry(0.08), glowMat(0xffc670), 0.8, 0.6, 0));
      world.add(boat);
    }

    // Place names, floating above the street.
    for (const l of LABELS) {
      const sp = textSprite([l.text], { font: '700 30px Cinzel, serif', fg: 'rgba(243,215,154,.95)', bg: null, height: 0.26 });
      sp.material.depthTest = true;
      sp.position.set(l.x * S, 2.7, l.y * S);
      world.add(sp);
      LABEL_SPRITES.push(sp);
    }

    // Exits: a soft gold glow over each way out of the district.
    for (const e of EXITS) {
      const m = mesh(new THREE.BoxGeometry(e.w * S, 1.6, e.h * S), new THREE.MeshBasicMaterial({ color: 0xe9b65a, transparent: true, opacity: 0.08, depthWrite: false }), (e.x + e.w / 2) * S, 0.8, (e.y + e.h / 2) * S);
      world.add(m);
      EXIT_MARKS.push(m);
    }

    // Solid things cast and catch the moon's shadows; glows, glass and mist don't.
    world.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const solid = !!m && !m.transparent && !m.isMeshBasicMaterial && !m.isShaderMaterial;
      o.castShadow = solid && !o.userData.noCast;
      o.receiveShadow = solid && !o.userData.noReceive;
    });
    scene.add(world);
    for (const [obj, g] of figures) { drop(g); figures.delete(obj); }
    // Cones and marks belong to the last visit's guards.
    for (const c of allCones) { scene.remove(c); c.geometry.dispose(); }
    for (const m of allMarks) { scene.remove(m); m.material.map.dispose(); }
    allCones.clear(); allMarks.clear();
    snapCamera = true;
  }

  // ---------- CC0 models (models/props.glb, Polygonal Mind, see THIRD_PARTY_NOTICES.md) ----------
  // One file holds every model; each is a top-level node named for its job (food, pretzel, masks, table,
  // stool, keg, barrel). Materials become simple Lambert ones to match the rest of the scene and stay cheap.
  let MODELS = null;
  const modelSize = {};
  new GLTFLoader().load('models/props.glb', (gltf) => {
    const found = {};
    for (const node of [...gltf.scene.children]) {
      node.traverse((o) => {
        o.userData.keep = true;
        if (!o.isMesh) return;
        const m = o.material;
        o.material = new THREE.MeshLambertMaterial({ map: m.map, color: m.color.clone().multiplyScalar(0.72), transparent: m.transparent, alphaTest: m.alphaTest, side: m.side });   // a little darker: it's night
      });
      const box = new THREE.Box3().setFromObject(node);
      modelSize[node.name] = { size: box.getSize(new THREE.Vector3()), centre: box.getCenter(new THREE.Vector3()), min: box.min.clone() };
      found[node.name] = node;
    }
    MODELS = found;
    builtFor = null;   // rebuild the district with the models in
  }, undefined, () => { /* no models: the boxes stay */ });
  // A copy of a model standing on the ground at the origin, scaled to `height` units tall.
  function place3d(name, height) {
    const src = MODELS[name], sz = modelSize[name];
    const k = height / sz.size.y;
    const inner = src.clone(true);
    inner.position.set(-sz.centre.x, -sz.min.y, -sz.centre.z);
    const g = new THREE.Group();
    g.add(inner);
    g.scale.setScalar(k);
    return g;
  }
  // Which way a prop's front faces: towards whichever long side has open street (radians, model +z = 0).
  function facing(pr) {
    const tx0 = Math.floor(pr.x / TILE), ty0 = Math.floor(pr.y / TILE), tx1 = Math.floor((pr.x + pr.w - 1) / TILE), ty1 = Math.floor((pr.y + pr.h - 1) / TILE);
    const open = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && !solidTile(grid[ty][tx]) && !FURN.has(ty * W + tx);
    const count = (xs, ys) => { let n = 0; for (const ty of ys) for (const tx of xs) n += open(tx, ty) ? 1 : 0; return n; };
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    if (pr.w >= pr.h) return count(range(tx0, tx1), [ty1 + 1]) >= count(range(tx0, tx1), [ty0 - 1]) ? 0 : Math.PI;
    return count([tx1 + 1], range(ty0, ty1)) >= count([tx0 - 1], range(ty0, ty1)) ? Math.PI / 2 : -Math.PI / 2;
  }
  // A market booth fitted to a stall's footprint: as wide as the stall, its front to the street,
  // squeezed front-to-back so it never pokes out past the tiles ZAY collides with.
  function fitModel(name, pr) {
    const sz = modelSize[name].size;
    const along = Math.max(pr.w, pr.h) * S, across = Math.min(pr.w, pr.h) * S;
    const k = along / sz.x;
    const g = place3d(name, sz.y * k);
    g.scale.z = Math.min(k, across / sz.z);
    const wrap = new THREE.Group();
    wrap.add(g);
    wrap.rotation.y = facing(pr);
    return wrap;
  }

  // ---------- Figures (jointed characters; see figure3d.js) ----------
  const FIG = makeFigures({ glowMat, shadowMat: SHADOW_MAT });
  const hex = (s) => new THREE.Color(s).getHex();
  const zayFigure = (town) => FIG.zay(town);
  const npcFigure = (n) => FIG.npc(npcLook(n), n.who);
  const guardFigure = (g) => FIG.guard(ENEMIES[g.kind] || ENEMIES.guard, g.watch);
  const kidFigure = () => FIG.kid();
  const fenceFigure = () => FIG.fence();

  // Each game object gets its own figure the first time it shows up; figures whose object is gone are removed.
  const figures = new Map();
  let frameNo = 0;
  function figureFor(obj, make) {
    let g = figures.get(obj);
    if (!g) { g = make(); figures.set(obj, g); scene.add(g); }
    g.userData.seen = frameNo;
    g.visible = true;
    return g;
  }
  // Which way a lantern throws a figure's shadow: away from the nearest one (and a little away from the moon).
  const MOON_AWAY = new THREE.Vector2(6, 4).normalize();
  function castShadow(g) {
    const sh = g.userData.shadow;
    if (!sh) return;
    let bx = 0, bz = 0, bd = 1e9;
    for (const l of LAMPS) {
      const dx = g.position.x - l.x * S, dz = g.position.z - l.y * S, d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; bx = dx; bz = dz; }
    }
    const k = bd < 6 ? Math.pow(1 - bd / 6, 0.8) : 0;
    const vx = MOON_AWAY.x * 0.22 + (bd > 0.01 ? bx / bd : 0) * k * 0.9, vz = MOON_AWAY.y * 0.22 + (bd > 0.01 ? bz / bd : 0) * k * 0.9, m = Math.hypot(vx, vz);
    const ph = g.rotation.y, lx = (vx * Math.cos(ph) - vz * Math.sin(ph)) / m, lz = (vx * Math.sin(ph) + vz * Math.cos(ph)) / m;
    sh.rotation.y = Math.atan2(-lz, lx);
    sh.scale.set(1 + 0.9 * m, 1 - 0.1 * m, 1);
    sh.position.set(lx * 0.12 * m, 0.014 - g.position.y, lz * 0.12 * m);
  }
  // Put a figure where its game object is and animate it. Far-off figures are hidden (the haze covers them anyway).
  function place(g, x, y, dir, dt, extra = {}) {
    if (g.userData.pose === false) { g.position.set(x * S, 0, y * S); return; }
    const away = Math.hypot(x * S - camera.position.x, y * S - camera.position.z);
    g.visible = away < 27;
    // Only people near the camera throw a real shadow; the rest keep the soft blob at their feet.
    const cast = away < 13;
    if (g.userData.cast !== cast) { g.userData.cast = cast; g.traverse((o) => { if (o.isMesh && o.userData.own) o.castShadow = cast; }); }
    FIG.pose(g, { x, y, dir, dt, t: state.time, S, roll: -1, ...extra });
    castShadow(g);
  }
  const drop = (g) => { scene.remove(g); if (g.userData.hips) FIG.dispose(g); };

  // ---------- Pickups, cards, cones, markers ----------
  const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 14);
  const cardGeo = new THREE.BoxGeometry(0.16, 0.01, 0.24);
  const cardMat = [lambert(0xf4efe2), lambert(0xf4efe2), lambert(0x9b2c2c), lambert(0xf4efe2), lambert(0xf4efe2), lambert(0xf4efe2)];
  function pickupFor(obj, make) { return figureFor(obj, make); }
  function chestMesh() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.36), lambert(0x5a3a1c), 0, 0.15, 0));
    const lid = new THREE.Group();
    lid.position.set(0, 0.3, -0.18);
    lid.add(mesh(new THREE.BoxGeometry(0.52, 0.08, 0.38), lambert(0x6e4824), 0, 0.04, 0.18));
    lid.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.02), lambert(0xe9b65a), 0, 0.02, 0.37));
    g.add(lid);
    g.userData.lid = lid;
    return g;
  }

  // Vision cones: a flat fan on the ground, cut short by walls like the Classic view.
  const coneMat = { calm: new THREE.MeshBasicMaterial({ color: 0xe9b65a, transparent: true, opacity: 0.1, depthWrite: false }),
    sus: new THREE.MeshBasicMaterial({ color: 0xf0964a, transparent: true, opacity: 0.18, depthWrite: false }),
    alert: new THREE.MeshBasicMaterial({ color: 0xe2574c, transparent: true, opacity: 0.22, depthWrite: false }) };
  const CONE_STEPS = 14;
  function coneFor(g) {
    let c = g.__cone;
    if (!c) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((CONE_STEPS + 2) * 3), 3));
      const idx = [];
      for (let i = 1; i <= CONE_STEPS; i++) idx.push(0, i + 1, i);
      geo.setIndex(idx);
      c = new THREE.Mesh(geo, coneMat.calm);
      c.renderOrder = 2;
      c.frustumCulled = false;
      Object.defineProperty(g, '__cone', { value: c, enumerable: false });
      scene.add(c);
    }
    return c;
  }
  const allCones = new Set();
  function updateCone(g) {
    const show = SETTINGS.cones && g.state !== 'down' && g.state !== 'stunned' && !(g.watch && !g.hostile);
    if (!show) { if (g.__cone) g.__cone.visible = false; return; }
    const c = coneFor(g);
    allCones.add(c);
    c.visible = true;
    c.userData.seen = frameNo;
    c.material = g.state === 'alert' ? coneMat.alert : g.state === 'suspicious' || g.state === 'search' ? coneMat.sus : coneMat.calm;
    const range = state.player.lit ? 205 : 108;
    const pos = c.geometry.attributes.position;
    pos.setXYZ(0, g.x * S, 0.03, g.y * S);
    for (let i = 0; i <= CONE_STEPS; i++) {
      const a = g.dir - 0.62 + (1.24 * i) / CONE_STEPS;
      let r = 0;
      for (; r < range; r += 8) if (tileAt(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r) === '#') break;
      pos.setXYZ(i + 1, (g.x + Math.cos(a) * r) * S, 0.03, (g.y + Math.sin(a) * r) * S);
    }
    pos.needsUpdate = true;
    c.geometry.computeBoundingSphere();
  }

  // Awareness marks over guards: a filling ring, "!" when alert, stars when stunned.
  const allMarks = new Set();
  function awarenessSprite(g) {
    let sp = g.__mark;
    if (!sp) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const tex = new THREE.CanvasTexture(c);
      sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
      sp.scale.set(0.34, 0.34, 1);
      sp.renderOrder = 11;
      sp.userData.ctx = c.getContext('2d');
      Object.defineProperty(g, '__mark', { value: sp, enumerable: false });
      scene.add(sp);
      allMarks.add(sp);
    }
    return sp;
  }
  function updateMark(g, fig) {
    const show = (g.meter > 0.05 || g.state === 'stunned') && g.state !== 'down';
    if (!show) { if (g.__mark) g.__mark.visible = false; return; }
    const sp = awarenessSprite(g);
    sp.visible = true;
    sp.userData.seen = frameNo;
    sp.position.set(fig.position.x, 1.45, fig.position.z);
    const key = g.state + Math.round(g.meter * 20) + (g.state === 'stunned' ? Math.floor(state.time * 10) : '');
    if (sp.userData.key === key) return;
    sp.userData.key = key;
    const c = sp.userData.ctx;
    c.clearRect(0, 0, 64, 64);
    if (g.state === 'alert') {
      c.font = '900 52px Barlow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillText('!', 34, 35);
      c.fillStyle = '#e2574c'; c.fillText('!', 32, 33);
    } else if (g.state === 'stunned') {
      c.strokeStyle = '#f3d79a'; c.lineWidth = 4;
      for (let i = 0; i < 3; i++) { const a = state.time * 5 + i * 2.1; c.beginPath(); c.arc(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 8, 4, 0, Math.PI * 2); c.stroke(); }
    } else {
      c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 12;
      c.beginPath(); c.arc(32, 32, 18, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = g.meter > 0.35 ? '#f0964a' : '#e9b65a'; c.lineWidth = 7;
      c.beginPath(); c.arc(32, 32, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.meter); c.stroke();
    }
    sp.material.map.needsUpdate = true;
  }

  // The "E / Use / Lift" prompt over whatever you can use.
  const prompts = {};
  const promptSprite = (label) => prompts[label] || (prompts[label] = (() => {
    const sp = textSprite([label], { font: '800 30px Barlow, sans-serif', bg: 'rgba(233,182,90,.95)', height: 0.2 });
    scene.add(sp);
    return sp;
  })());

  // Speech bubbles (overheard guards, shouting marks).
  const barkSprites = new Map();

  // Objective arrow: a gold chevron on the ground pointing the way.
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0.24, 0); arrowShape.lineTo(-0.14, -0.16); arrowShape.lineTo(-0.06, 0); arrowShape.lineTo(-0.14, 0.16); arrowShape.closePath();
  const arrow = mesh(new THREE.ShapeGeometry(arrowShape), new THREE.MeshBasicMaterial({ color: 0xf3d79a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  arrow.renderOrder = 3;
  scene.add(arrow);

  // Noise rings and sparkles.
  const ringGeo = new THREE.RingGeometry(0.93, 1, 40);
  const ringPool = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.05);

  // ---------- Chase camera ----------
  // An orbit camera that follows ZAY. game.js owns where it should be (CAM3: yaw, pitch, dist); here it is
  // smoothed, kept out of buildings, and nudged up over the rooftops when a street is too tight to sit behind him.
  let snapCamera = true;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), focus = new THREE.Vector3();
  const HEAD = 0.95;
  let yawS = 0, pitchS = 0.5, distS = 4, liftS = 0, kickS = 0;
  // How far along a ray from ZAY's head the camera can go before a building is in the way.
  function clearDistance(px, py, pz, dx, dy, dz, want) {
    const steps = Math.ceil(want / 0.16);
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * want;
      const x = px + dx * t, y = py + dy * t, z = pz + dz * t;
      const tx = Math.floor(x), tz = Math.floor(z);
      const out = tx < 0 || tz < 0 || tx >= W || tz >= H;
      const top = out ? WALL_H : TOPS[tz * W + tx] || (grid[tz][tx] === '#' ? WALL_H : 0);
      if (top && y < top + 0.12) return Math.max(0.5, t - 0.28);
    }
    return want;
  }
  const offsetFor = (yaw, pitch) => [-Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.sin(yaw) * Math.cos(pitch)];
  function updateCamera3d(dt) {
    const p = state.player;
    const px = p.x * S, pz = p.y * S, py = HEAD + (p.z || 0) * 0.6;
    const snap = snapCamera;
    if (snap) { CAM3.yaw = p.dir; yawS = CAM3.yaw; pitchS = CAM3.pitch; distS = CAM3.dist; liftS = 0; focus.set(px, py, pz); snapCamera = false; }
    const ease = (r) => 1 - Math.exp(-r * dt);
    yawS += angDiff(yawS, CAM3.yaw) * ease(16);
    pitchS += (CAM3.pitch - pitchS) * ease(16);
    // Follow point: ZAY's head, a touch ahead of where he's running, eased so stops and starts don't jolt.
    const lead = 0.16;
    focus.x += (px + (p.vx || 0) * S * lead - focus.x) * ease(9);
    focus.z += (pz + (p.vy || 0) * S * lead - focus.z) * ease(9);
    focus.y += (py - focus.y) * ease(7);
    // Blocked behind? Try looking from higher up before settling for a close-up.
    let lift = 0, best = 0;
    for (const extra of [0, 0.22, 0.44, 0.66, 0.88]) {
      const pit = Math.min(1.35, pitchS + extra);
      const [ox, oy, oz] = offsetFor(yawS, pit);
      const c = clearDistance(focus.x, focus.y, focus.z, ox, oy, oz, CAM3.dist);
      if (c > best + 0.05) { best = c; lift = pit - pitchS; }
      if (c >= CAM3.dist * 0.8) break;
    }
    liftS += (lift - liftS) * ease(lift > liftS ? 7 : 2.2);
    const [ox, oy, oz] = offsetFor(yawS, Math.min(1.35, pitchS + liftS));
    const clear = clearDistance(focus.x, focus.y, focus.z, ox, oy, oz, CAM3.dist);
    distS = clear < distS ? clear : distS + (clear - distS) * ease(3.5);   // in at once, back out gently
    camPos.set(focus.x + ox * distS, focus.y + oy * distS, focus.z + oz * distS);
    look.copy(focus); look.y -= 0.12;
    camera.position.copy(camPos);
    camera.position.x += shakeX * S * 0.6;
    camera.position.y += shakeY * S * 0.6;
    camera.lookAt(look);
    // A little wider when sprinting.
    const kick = p.sprint && (p.speedNow || 0) > 140 ? 1 : 0;
    kickS += (kick - kickS) * ease(4);
    const fov = baseFov * (1 + kickS * 0.07);
    if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  // ---------- Each frame ----------
  function render(dt) {
    if (!LEVEL) return;
    if (builtFor !== LEVEL) build();
    frameNo++;
    const p = state.player;
    const t = state.time;
    const town = (DISTRICTS[state.district] || {}).look === 'town';

    // ZAY
    let zay = figures.get(p);
    if (zay && zay.userData.town !== town) { drop(zay); figures.delete(p); }
    zay = figureFor(p, () => zayFigure(town));
    place(zay, p.x, p.y, p.dir, dt, { z: p.z || 0, roll: p.rollT > 0 ? 1 - p.rollT / 0.42 : -1, crouch: Math.max(p.hidden ? 0.75 : 0, (p.landT || 0) / 0.18 * 0.5), throwing: p.throwT > 0 ? 1 - p.throwT / 0.3 : 0 });
    if (p.throwT > 0) p.throwT -= dt;
    zay.userData.ledger.visible = !!p.hasLedger;
    const faded = p.hidden || (p.invuln > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2 === 0);
    const zm = zay.userData.mat;
    if (zm.transparent !== faded) { zm.transparent = faded; zm.opacity = faded ? 0.55 : 1; zm.needsUpdate = true; }
    // A faint cool light just camera-side of ZAY, so his outline always reads against the dark.
    zayLight.position.set(p.x * S + (camera.position.x - p.x * S) * 0.22, 1.5, p.y * S + (camera.position.z - p.y * S) * 0.22);

    // Guards
    for (const g of state.guards) {
      const f = figureFor(g, () => guardFigure(g));
      const hunting = g.state === 'alert' || g.state === 'suspicious' || g.state === 'search';
      place(f, g.x, g.y, g.dir, dt, { lying: g.state === 'down', windup: g.windup > 0 ? Math.min(1, g.windup * 3) : 0, scan: !hunting && g.state !== 'stunned',
        look: g.state === 'alert' ? p : null, crouch: g.state === 'stunned' ? 0.45 : 0 });
      f.userData.mat.color.setHex(g.windup > 0 ? 0xff8f8f : 0xffffff);
      updateCone(g);
      updateMark(g, f);
    }
    // People: they turn their heads to ZAY when he comes close, and the ones with something to say gesture.
    const close = (o, r) => Math.hypot(o.x - p.x, o.y - p.y) < r;
    for (const n of state.npcs || []) {
      const f = figureFor(n, () => npcFigure(n));
      place(f, n.x, n.y, n.dir, dt, { seated: !!npcLook(n).seated, look: close(n, 120) ? p : null, talk: (n.who === 'hustle' || n.who === 'needy') && close(n, 90) });
    }
    for (const w of state.walkers || []) place(figureFor(w, () => npcFigure(w)), w.x, w.y, w.dir, dt, { look: w.startled > 0 || close(w, 46) ? p : null });
    if (KID.x > -1e4) place(figureFor(KID, kidFigure), KID.x, KID.y, Math.atan2(p.y - KID.y, p.x - KID.x), dt, { look: p });
    if (FENCE.x > -1e4 && FENCE.x) place(figureFor(FENCE, fenceFigure), FENCE.x, FENCE.y, Math.PI / 2, dt, { look: close(FENCE, 130) ? p : null, talk: close(FENCE, 80) });

    // Pickups and things
    for (const c of state.coins) {
      if (c.taken) continue;
      const m = pickupFor(c, () => { const g = new THREE.Group(); const coin = mesh(coinGeo, lambert(0xe9b65a), 0, 0.25, 0); coin.rotation.x = Math.PI / 2; g.add(coin); return g; });
      m.position.set(c.x * S, Math.sin(t * 3 + c.x) * 0.04, c.y * S);
      m.rotation.y = t * 2;
    }
    for (const c of state.cardPickups) {
      if (c.taken) continue;
      const m = pickupFor(c, () => { const g = new THREE.Group(); g.add(mesh(cardGeo, cardMat, 0, 0.2, 0)); g.add(mesh(cardGeo, cardMat, 0.03, 0.22, 0.02)); return g; });
      m.position.set(c.x * S, 0, c.y * S);
      m.rotation.y = t;
    }
    for (const c of state.chests) {
      const m = pickupFor(c, chestMesh);
      m.position.set(c.x * S, 0, c.y * S);
      m.userData.lid.rotation.x = c.opened ? -1.6 : 0;
    }
    if (!state.ledgerTaken && LEDGER_SPOT.x > -1e4) {
      const m = pickupFor(LEDGER_SPOT, () => { const g = new THREE.Group(); g.add(mesh(new THREE.BoxGeometry(0.26, 0.06, 0.34), lambert(0x7a1f22), 0, 0.8, 0)); g.add(mesh(new THREE.BoxGeometry(0.4, 0.75, 0.4), lambert(0x3e2617), 0, 0.37, 0)); return g; });
      m.position.set(LEDGER_SPOT.x * S, 0, LEDGER_SPOT.y * S);
    }
    for (const c of state.projectiles) {
      const m = pickupFor(c, () => mesh(cardGeo, cardMat));
      m.position.set(c.x * S, 0.7, c.y * S);
      m.rotation.y = -c.spin;
    }

    // Effects
    let ri = 0;
    for (const e of state.effects) {
      const k = Math.max(0, e.t);
      if (e.kind === 'noise' || e.kind === 'ko' || e.kind === 'stun' || e.kind === 'vault') {
        let r = ringPool[ri];
        if (!r) { r = mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf3d79a, transparent: true, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; scene.add(r); ringPool.push(r); }
        ri++;
        r.visible = true;
        const rad = e.kind === 'noise' ? e.r * Math.min(1, k / 0.6) * S : (10 + k * 40) * S;
        r.scale.setScalar(Math.max(0.01, rad));
        r.position.set(e.x * S, e.kind === 'noise' ? 0.05 : 0.6, e.y * S);
        r.material.opacity = e.kind === 'noise' ? 0.4 * (1 - k / 0.6) : 1 - k / 0.5;
      } else if (e.kind === 'sparkle') {
        const m = pickupFor(e, () => { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(mesh(sparkGeo, glowMat(0xffecaa))); return g; });
        m.position.set(e.x * S, 0.4, e.y * S);
        m.children.forEach((s, i) => { const a = i * 1.05; s.position.set(Math.cos(a) * k * 1.2, k * 0.8, Math.sin(a) * k * 1.2); });
      }
    }
    for (let i = ri; i < ringPool.length; i++) ringPool[i].visible = false;

    // Remove figures for things that are gone (picked up, guards from another visit, finished effects).
    for (const [obj, g] of figures) if (g.userData.seen !== frameNo) { drop(g); figures.delete(obj); }
    for (const c of allCones) if (c.userData.seen !== frameNo) c.visible = false;
    for (const m of allMarks) if (m.userData.seen !== frameNo) m.visible = false;

    // Speech bubbles
    const live = new Set();
    for (const b of BARKS) {
      if (b.t < 0 || b.anchor.state === 'down') continue;
      live.add(b);
      let sp = barkSprites.get(b);
      if (!sp) { sp = textSprite(wrap(b.text), { font: '600 24px Barlow, sans-serif', fg: '#1a1206', height: 0.16 * wrap(b.text).length + 0.04 }); scene.add(sp); barkSprites.set(b, sp); }
      sp.position.set(b.anchor.x * S, 1.55 + sp.scale.y / 2, b.anchor.y * S);
      sp.material.opacity = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
    }
    for (const [b, sp] of barkSprites) if (!live.has(b)) { scene.remove(sp); sp.material.map.dispose(); sp.material.dispose(); barkSprites.delete(b); }

    // Interact prompt
    for (const k in prompts) prompts[k].visible = false;
    if (state.mode === 'field') {
      const target = interactTarget();
      if (target) {
        const sp = promptSprite(target.isWalker ? 'Lift' : isTouch ? 'Use' : 'E');
        sp.visible = true;
        sp.position.set(target.x * S, 1.32 + Math.sin(t * 5) * 0.03, target.y * S);
      }
    }

    // Objective arrow
    const goal = state.mode === 'field' ? objectiveInfo().goal : null;
    arrow.visible = !!goal && dist(goal, p) > 120;
    if (arrow.visible) {
      const a = Math.atan2(goal.y - p.y, goal.x - p.x);
      arrow.position.set(p.x * S + Math.cos(a) * 0.75, 0.05, p.y * S + Math.sin(a) * 0.75);
      arrow.rotation.set(-Math.PI / 2, 0, -a);
    }

    // Labels only show up close, so the far ones don't clutter the street.
    for (const sp of LABEL_SPRITES) {
      const d = Math.hypot(sp.position.x - camera.position.x, sp.position.z - camera.position.z);
      sp.visible = d > 3.5 && d < 12;
    }
    for (const m of EXIT_MARKS) m.material.opacity = 0.07 + Math.sin(t * 2) * 0.03;

    // Lamps: give the real lights to the nearest few, with the same gentle flicker as Classic.
    const near = LAMPS.map((l) => [l, Math.hypot(l.x - p.x, l.y - p.y)]).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 6; i++) nearLamps[i] = near[i] ? [near[i][0].x * S, near[i][0].y * S] : null;
    const flick = 1 + Math.sin(t * 9) * 0.04;
    LIGHTS.forEach((L, i) => {
      const l = near[i] && near[i][0];
      if (!l) { L.intensity = 0; return; }
      L.position.set(l.x * S, 1.9, l.y * S);
      L.distance = l.r * S * 1.6;
      L.intensity = 7 * flick;
    });
    POOL_MAT.opacity = POOL_BASE * flick; HALO_MAT.opacity = HALO_BASE * flick;
    for (const m of MIST) {
      m.sp.visible = Math.hypot(m.x - camera.position.x, m.z - camera.position.z) < 14;
      m.sp.position.set(m.x + Math.sin(t * 0.15 + m.ph) * 0.9, 0.75 + Math.sin(t * 0.2 + m.ph * 2) * 0.1, m.z + Math.cos(t * 0.12 + m.ph) * 0.6);
    }

    updateCamera3d(dt);
    atmosphere(dt, p);
    renderer.info.reset();
    if (post.on) post.render(dt, { alert: alertS, hidden: hiddenS });
    else renderer.render(scene, camera);
    // On Auto, step the quality down if this device can't keep up (about 25 frames a second for 4 seconds).
    const now = performance.now(), ms = now - lastNow; lastNow = now;
    if (setQuality.auto && ms < 500 && !document.hidden) {
      slowFor = ms > 40 ? slowFor + ms : Math.max(0, slowFor - ms * 2);
      if (slowFor > 4000 && qName !== 'low') { const down = LEVELS[LEVELS.indexOf(qName) - 1]; setQuality(down); setQuality.auto = true; }
    }
  }

  // The air each frame: where the night has got to (sky, haze, moonlight), the moon's shadow following ZAY,
  // and how tense things are (the red edge when guards are on you).
  let alertS = 0, hiddenS = 0;
  const nearLamps = [];
  const shadowAt = new THREE.Vector3();
  function atmosphere(dt, p) {
    nightClock += dt;
    nightAt(nightClock, NIGHT);
    SKY.uniforms.uTime.value = nightClock; SKY.uniforms.uMoon.value.copy(NIGHT.dir);
    SKY.uniforms.uZenith.value.copy(NIGHT.zen); SKY.uniforms.uHorizon.value.copy(NIGHT.hor); SKY.uniforms.uGlow.value.copy(NIGHT.glow);
    SKY.mesh.visible = !indoors;
    scene.fog.color.copy(NIGHT.fog);
    moon.color.copy(NIGHT.moon); moon.intensity = indoors ? 0.3 : NIGHT.k;
    const mood = indoors ? INDOOR : OUTDOOR;
    hemi.intensity = mood.k * (indoors ? 1 : NIGHT.amb);
    // Keep the shadow box centred near ZAY, moved in whole steps so shadow edges don't crawl as he walks.
    shadowAt.set(Math.round(p.x * S * 2) / 2, 0, Math.round(p.y * S * 2) / 2);
    moon.target.position.copy(shadowAt);
    moon.position.copy(shadowAt).addScaledVector(NIGHT.dir, 45);
    MOON_AWAY.set(-NIGHT.dir.x, -NIGHT.dir.z).normalize();
    KIT.tick(nightClock, NIGHT, nearLamps, renderer.getPixelRatio() * (window.innerHeight / 720));
    if (BOAT_MESH && BOAT_MESH.position.y < 0) { BOAT_MESH.position.y = WATER_Y + 0.02 + Math.sin(nightClock * 1.1) * 0.015; BOAT_MESH.rotation.z = Math.sin(nightClock * 0.8) * 0.025; }
    MOTES.uniforms.uTime.value = nightClock; MOTES.uniforms.uCam.value.copy(camera.position);
    MOTES.uniforms.uSize.value = 26 * renderer.getPixelRatio() * (window.innerHeight / 720);
    const k = Math.min(1, dt * 3);
    alertS += ((state.guards.some((g) => g.state === 'alert') ? 1 : 0) - alertS) * k;
    hiddenS += ((p.hidden ? 1 : 0) - hiddenS) * k;
  }

  window.R3D = { ready: true, render, setLook, setQuality, get quality() { return qName; }, look: LOOK, scene, canvas: el, resetCamera: () => { snapCamera = true; }, debug: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, cam: camera.position.toArray().map((v) => +v.toFixed(2)), look: look.toArray().map((v) => +v.toFixed(2)) }) };
}
