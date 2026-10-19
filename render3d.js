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
  renderer.setClearColor(0x07080f);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x07080f, 9, 26);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.08, 60);
  scene.add(new THREE.HemisphereLight(0x5a6890, 0x14101c, 1.1));
  const moon = new THREE.DirectionalLight(0x9aa8d8, 0.9);
  moon.position.set(-6, 14, -4);
  scene.add(moon, moon.target);

  // Street lamps light the scene; only the ones nearest ZAY get a real light (phones can't afford all).
  const LIGHTS = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xffb45a, 0, 7, 1.6);
    scene.add(l);
    LIGHTS.push(l);
  }
  // ZAY's own faint glow so he never disappears into the dark.
  const zayLight = new THREE.PointLight(0x8fa0d8, 1.2, 3.5, 1.5);
  scene.add(zayLight);

  const resize3d = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    camera.fov = 2 * Math.atan(Math.tan(vfov / 2) * fullH / h) * 180 / Math.PI;
    if (extra) camera.setViewOffset(w, fullH, 0, 2 * extra, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize3d);
  resize3d();

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
  const wallTex = canvasTex(64, 160, (c, w, h) => {
    c.fillStyle = '#6e5462'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) {
      const off = (y / 10) % 2 ? 0 : 16;
      for (let x = -16; x < w; x += 32) {
        const v = 92 + ((x * 7 + y * 13) % 17);
        c.fillStyle = `rgb(${v + 14},${v - 10},${v + 2})`;
        c.fillRect(x + off + 1, y + 1, 30, 8);
      }
    }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, h - 12, w, 12);              // damp at the foot of the wall
    c.fillStyle = '#6d5326'; c.fillRect(0, 0, w, 5);                           // gold trim under the eaves
  });
  const roofTex = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#2e2a3a'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.06)';
    for (let y = 6; y < h; y += 12) c.fillRect(0, y, w, 2);
    c.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < h; y += 12) for (let x = (y / 12) % 2 ? 0 : 8; x < w; x += 16) c.fillRect(x, y, 2, 12);
  });
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex });

  // ---------- The district (rebuilt whenever a new map loads) ----------
  let world = null, builtFor = null;
  let LABEL_SPRITES = [], EXIT_MARKS = [];
  function build() {
    if (world) {
      scene.remove(world);
      world.traverse((o) => {
        if (o.userData.keep) return;   // shared with the loaded models
        if (o.geometry) o.geometry.dispose();
        const tex = o.material && !Array.isArray(o.material) && o.material.map;
        if (tex && tex !== wallTex && tex !== roofTex) tex.dispose();
      });
    }
    world = new THREE.Group();
    builtFor = LEVEL;
    LABEL_SPRITES = []; EXIT_MARKS = [];

    // Ground: the same painted map as the Classic view.
    const groundTex = new THREE.CanvasTexture(mapCanvas);
    groundTex.colorSpace = THREE.SRGBColorSpace;
    groundTex.anisotropy = 4;
    const ground = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: groundTex }), W / 2, 0, H / 2);
    ground.rotation.x = -Math.PI / 2;
    world.add(ground);
    const beyond = mesh(new THREE.PlaneGeometry(W + 80, H + 80), lambert(0x0b0a10), W / 2, -0.02, H / 2);
    beyond.rotation.x = -Math.PI / 2;
    world.add(beyond);

    // Buildings: one box per building tile, all in a single instanced draw.
    const solid = [];
    const hedges = [];
    const water = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const t = grid[ty][tx];
      if (t === '#') solid.push([tx, ty]);
      else if (t === 'h') hedges.push([tx, ty]);
      else if (t === 'w') water.push([tx, ty]);
    }
    const m4 = new THREE.Matrix4();
    if (solid.length) {
      const box = new THREE.BoxGeometry(1, WALL_H, 1);
      const blocks = new THREE.InstancedMesh(box, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat], solid.length);
      solid.forEach(([tx, ty], i) => blocks.setMatrixAt(i, m4.makeTranslation(tx + 0.5, WALL_H / 2, ty + 0.5)));
      world.add(blocks);
    }
    if (hedges.length) {
      const bush = new THREE.IcosahedronGeometry(0.55, 1);
      const hm = new THREE.InstancedMesh(bush, lambert(0x2a5233), hedges.length);
      const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 0.75, 1);
      hedges.forEach(([tx, ty], i) => hm.setMatrixAt(i, m4.compose(new THREE.Vector3(tx + 0.5, 0.38, ty + 0.5), q, sc)));
      world.add(hm);
    }
    if (water.length) {
      const wm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x1c3a66, transparent: true, opacity: 0.45 }), water.length);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), one = new THREE.Vector3(1, 1, 1);
      water.forEach(([tx, ty], i) => wm.setMatrixAt(i, m4.compose(new THREE.Vector3(tx + 0.5, -0.05, ty + 0.5), q, one)));
      world.add(wm);
    }

    // Windows on street-facing walls: warm lit panes or dark shutters.
    const lit = [], shut = [];
    for (const e of EDGES) if (e.win) (e.win.lit ? lit : shut).push(e);
    const ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
    const NORMAL = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
    const pane = new THREE.PlaneGeometry(0.26, 0.4);
    for (const [list, mat] of [[lit, glowMat(0xd9a456)], [shut, lambert(0x3a2618)]]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(pane, mat, list.length * 2);
      const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      let i = 0;
      for (const e of list) {
        const [nx, nz] = NORMAL[e.side];
        q.setFromAxisAngle(up, ROT[e.side]);
        const cx = (e.x0 + e.x1) / 2 * S + nx * 0.01, cz = (e.y0 + e.y1) / 2 * S + nz * 0.01;
        im.setMatrixAt(i++, m4.compose(new THREE.Vector3(cx, 0.95, cz), q, one));
        im.setMatrixAt(i++, m4.compose(new THREE.Vector3(cx, 1.75, cz), q, one));
      }
      world.add(im);
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

    // Street lamps.
    const post = new THREE.CylinderGeometry(0.035, 0.05, 1.9, 6);
    const head = new THREE.SphereGeometry(0.11, 10, 8);
    for (const l of LAMPS) {
      world.add(mesh(post, lambert(0x121019), l.x * S, 0.95, l.y * S));
      world.add(mesh(head, glowMat(0xffd88a), l.x * S, 1.95, l.y * S));
    }

    // The river boat.
    if (BOAT.x > -1e4) {
      const boat = new THREE.Group();
      boat.position.set(BOAT.x * S, 0, BOAT.y * S);
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

    scene.add(world);
    for (const [obj, g] of figures) { scene.remove(g); figures.delete(obj); }
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

  // ---------- Figures (placeholders until CC0 models are added) ----------
  // Built from capsules and spheres in each character's colours. part names: legs, body, head, hair.
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
  function figure({ coat, low, trim, skin, hair, hairStyle, sash, scale = 1, eyes = 0xf1ead9 }) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(scale);
    g.add(inner);
    const legL = mesh(capsule(0.075, 0.28), lambert(low), 0, 0.2, -0.09);
    const legR = mesh(capsule(0.075, 0.28), lambert(low), 0, 0.2, 0.09);
    const body = mesh(capsule(0.17, 0.3), lambert(coat), 0, 0.58, 0);
    body.scale.set(0.85, 1, 1.1);
    const trimM = mesh(new THREE.BoxGeometry(0.03, 0.34, 0.08), lambert(trim), 0.15, 0.6, 0);
    const head = mesh(new THREE.SphereGeometry(0.13, 14, 10), lambert(skin), 0.02, 0.93, 0);
    inner.add(legL, legR, body, trimM, head);
    if (sash) inner.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.36), lambert(sash), 0, 0.46, 0));
    // Eyes
    for (const z of [-0.045, 0.045]) inner.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), glowMat(eyes), 0.135, 0.95, z));
    // Hair
    const hm = lambert(hair);
    if (hairStyle === 'hat') {
      inner.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 16), lambert(0x16141c), 0.02, 1.02, 0));
      inner.add(mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.14, 14), lambert(0x16141c), 0.02, 1.09, 0));
      inner.add(mesh(new THREE.CylinderGeometry(0.131, 0.131, 0.03, 14), lambert(trim), 0.02, 1.04, 0));
    } else if (hairStyle === 'curls') {
      for (const [x, y, z] of [[-0.05, 1.0, 0], [-0.09, 0.93, 0.09], [-0.09, 0.93, -0.09], [0, 1.03, 0.07], [0, 1.03, -0.07], [-0.12, 0.86, 0]]) inner.add(mesh(new THREE.SphereGeometry(0.075, 8, 6), hm, x, y, z));
    } else if (hairStyle === 'wrap') {
      const w = mesh(new THREE.SphereGeometry(0.14, 12, 8, Math.PI / 2, Math.PI, 0, Math.PI * 0.55), lambert(trim), 0.01, 0.95, 0);
      inner.add(w);
    } else if (hairStyle === 'locs') {
      const cap = mesh(new THREE.SphereGeometry(0.137, 12, 8, Math.PI / 2, Math.PI, 0, Math.PI * 0.6), hm, 0.01, 0.94, 0);
      inner.add(cap);
      for (const z of [-0.08, -0.03, 0.03, 0.08]) { const l = mesh(capsule(0.02, 0.22), hm, -0.12, 0.8, z); l.rotation.z = -0.35; inner.add(l); }
    } else if (hairStyle === 'hood') {
      inner.add(mesh(new THREE.SphereGeometry(0.155, 14, 10, Math.PI / 2, Math.PI * 1.25, 0, Math.PI * 0.7), lambert(0x1c1c26), 0.0, 0.95, 0));
    } else {
      inner.add(mesh(new THREE.SphereGeometry(0.137, 12, 8, Math.PI / 2, Math.PI, 0, Math.PI * 0.5), hm, 0.01, 0.95, 0));
    }
    // A blob shadow at the feet.
    const sh = mesh(new THREE.CircleGeometry(0.26, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }), 0, 0.012, 0);
    sh.rotation.x = -Math.PI / 2;
    g.add(sh);
    g.userData = { inner, legL, legR, body, head };
    return g;
  }
  function zayFigure(town) {
    const g = figure(town
      ? { coat: 0x2c2f36, low: 0x1c1d22, trim: 0xb39a72, skin: 0x5a3b2b, hair: 0x1a110c, hairStyle: 'locs', eyes: 0xf3c25c }
      : { coat: 0x121218, low: 0x0b0b10, trim: 0x1c1c26, skin: 0x5a3b2b, hair: 0x1a110c, hairStyle: 'hood', eyes: 0xf3c25c });
    const inner = g.userData.inner;
    // Katana across his back, gold at the guard.
    const blade = mesh(new THREE.BoxGeometry(0.03, 0.75, 0.025), lambert(0xc9c9d6), -0.17, 0.66, 0);
    blade.rotation.x = 0.8;
    blade.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.07), lambert(0xe9b65a), 0, 0.2, 0));
    inner.add(blade);
    // His tail, swaying behind him.
    const tail = new THREE.Group();
    tail.position.set(-0.15, 0.45, 0);
    const t1 = mesh(capsule(0.035, 0.3), lambert(0x2a1a14), -0.17, -0.08, 0);
    t1.rotation.z = 1.1;
    tail.add(t1);
    inner.add(tail);
    // The ledger, when he's carrying it.
    const ledger = mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), lambert(0x7a1f22), -0.05, 0.62, 0.2);
    inner.add(ledger);
    g.userData.tail = tail;
    g.userData.ledger = ledger;
    g.userData.town = town;
    return g;
  }
  const hex = (s) => new THREE.Color(s).getHex();
  function npcFigure(n) {
    const L = npcLook(n);
    return figure({ coat: hex(L.coat), low: hex(L.low), trim: hex(L.trim), skin: hex(L.skin), hair: hex(L.hair), hairStyle: L.hairStyle, sash: L.sash && hex(L.sash),
      eyes: n.who === 'severin' ? 0xdfe3ee : n.who === 'noe' ? 0xc99a52 : 0xf1ead9 });
  }
  function guardFigure(g) {
    const def = ENEMIES[g.kind] || ENEMIES.guard;
    const f = figure({ coat: hex(def.coat), low: g.watch ? 0x21140f : 0x141a2c, trim: hex(def.trim), skin: 0x5a3b2b, hair: 0x1b2238, hairStyle: 'short', scale: 1.08 });
    const inner = f.userData.inner;
    // Helmet and a hand lantern.
    inner.add(mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), lambert(0x2a2f3e), 0.02, 0.97, 0));
    inner.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMat(0xffd88a), 0.2, 0.42, 0.2));
    f.userData.coatMat = f.userData.body.material;
    return f;
  }
  function kidFigure() {
    return figure({ coat: 0x4a4236, low: 0x24201a, trim: 0x8a7a5a, skin: 0x5a3424, hair: 0x160d09, hairStyle: 'short', scale: 0.7 });
  }
  function fenceFigure() {
    const f = figure({ coat: 0x3a3428, low: 0x1c1912, trim: 0xc9a25a, skin: 0x6a4430, hair: 0x1a120d, hairStyle: 'hat' });
    f.userData.inner.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(0xffc670), 0.25, 0.7, 0.25));
    return f;
  }

  // Each game object gets its own figure the first time it shows up; figures whose object is gone are removed.
  const figures = new Map();
  let frameNo = 0;
  function figureFor(obj, make) {
    let g = figures.get(obj);
    if (!g) { g = make(); figures.set(obj, g); scene.add(g); g.userData.lx = obj.x; g.userData.ly = obj.y; g.userData.walk = 0; }
    g.userData.seen = frameNo;
    g.visible = true;
    return g;
  }
  function place(g, x, y, dir, dt, { lying = false } = {}) {
    const u = g.userData;
    const moved = Math.hypot(x - u.lx, y - u.ly);
    u.lx = x; u.ly = y;
    const speed = dt > 0 ? moved / dt : 0;
    u.walk = speed > 8 ? u.walk + dt * Math.min(16, speed / 9) : u.walk * 0.85;
    g.position.set(x * S, 0, y * S);
    g.rotation.y = -dir;
    const swing = speed > 8 ? Math.sin(u.walk) * 0.5 : 0;
    u.legL.rotation.z = swing; u.legR.rotation.z = -swing;
    u.inner.position.y = speed > 8 ? Math.abs(Math.sin(u.walk)) * 0.035 : 0;
    u.inner.rotation.x = 0;
    u.inner.rotation.z = lying ? Math.PI / 2 : 0;
    if (lying) u.inner.position.y = 0.17;
  }

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
  let camYaw = 0, snapCamera = true;
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  const CAM_BACK = 3.7, CAM_UP = 2.9, HEAD = 0.95;
  // How far back the camera can sit before a building gets in the way (walks the grid from ZAY's head).
  function clearDistance(px, pz, dx, dz, back, up) {
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * back;
      const x = px - dx * t, z = pz - dz * t, y = HEAD + (up - HEAD) * (t / back);
      const tx = Math.floor(x), tz = Math.floor(z);
      const solid = tx < 0 || tz < 0 || tx >= W || tz >= H || grid[tz][tx] === '#';
      if (solid && y < WALL_H + 0.15) return Math.max(0.6, t - 0.3);
    }
    return back;
  }
  function updateCamera3d(dt) {
    const p = state.player;
    const px = p.x * S, pz = p.y * S;
    const target = p.dir;
    const snap = snapCamera;
    if (snapCamera) { camYaw = target; snapCamera = false; }
    else camYaw += angDiff(camYaw, target) * Math.min(1, dt * 4.5);
    const dx = Math.cos(camYaw), dz = Math.sin(camYaw);
    const back = clearDistance(px, pz, dx, dz, CAM_BACK, CAM_UP);
    const k = back / CAM_BACK;
    // In a tight street the camera comes in closer but stays up above the walls, looking down.
    const want = new THREE.Vector3(px - dx * back, CAM_UP + (1 - k) * 0.6, pz - dz * back);
    if (snap || k < 0.999) camPos.copy(want); else camPos.lerp(want, Math.min(1, dt * 10));
    look.set(px + dx * 1.1, 0.75, pz + dz * 1.1);
    camera.position.copy(camPos);
    camera.position.x += shakeX * S * 0.6;
    camera.position.y += shakeY * S * 0.6;
    camera.lookAt(look);
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
    if (zay && zay.userData.town !== town) { scene.remove(zay); figures.delete(p); }
    zay = figureFor(p, () => zayFigure(town));
    place(zay, p.x, p.y, p.dir, dt);
    zay.userData.tail.rotation.y = Math.sin(t * 5 + p.step) * 0.5;
    zay.userData.ledger.visible = !!p.hasLedger;
    const faded = p.hidden || (p.invuln > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2 === 0);
    zay.traverse((o) => { if (o.isMesh && o.material && !o.material.isMeshBasicMaterial) { if (!o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; } o.material.transparent = faded; o.material.opacity = faded ? 0.5 : 1; } });
    zayLight.position.set(p.x * S, 1.3, p.y * S);

    // Guards
    for (const g of state.guards) {
      const f = figureFor(g, () => guardFigure(g));
      place(f, g.x, g.y, g.dir, dt, { lying: g.state === 'down' });
      f.userData.coatMat.color.setHex(g.windup > 0 ? 0x5a2430 : hex((ENEMIES[g.kind] || ENEMIES.guard).coat));
      updateCone(g);
      updateMark(g, f);
    }
    // People
    for (const n of state.npcs || []) {
      const f = figureFor(n, () => npcFigure(n));
      place(f, n.x, n.y, n.dir, dt);
      if (npcLook(n).seated) { f.userData.inner.position.y = -0.2; f.userData.legL.rotation.z = f.userData.legR.rotation.z = 1.4; }
    }
    for (const w of state.walkers || []) place(figureFor(w, () => npcFigure(w)), w.x, w.y, w.dir, dt);
    if (KID.x > -1e4) place(figureFor(KID, kidFigure), KID.x, KID.y, Math.atan2(p.y - KID.y, p.x - KID.x), dt);
    if (FENCE.x > -1e4 && FENCE.x) place(figureFor(FENCE, fenceFigure), FENCE.x, FENCE.y, Math.PI / 2, dt);

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
    for (const [obj, g] of figures) if (g.userData.seen !== frameNo) { scene.remove(g); figures.delete(obj); }
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
    const flick = 1 + Math.sin(t * 9) * 0.04;
    LIGHTS.forEach((L, i) => {
      const l = near[i] && near[i][0];
      if (!l) { L.intensity = 0; return; }
      L.position.set(l.x * S, 1.9, l.y * S);
      L.distance = l.r * S * 1.6;
      L.intensity = 6 * flick;
    });

    updateCamera3d(dt);
    renderer.render(scene, camera);
  }

  window.R3D = { ready: true, render, canvas: el, resetCamera: () => { snapCamera = true; }, debug: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, cam: camera.position.toArray().map((v) => +v.toFixed(2)), look: look.toArray().map((v) => +v.toFixed(2)) }) };
}
