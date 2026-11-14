// Street life for the 3D view, added on top of the city that render3d.js and world-art3d.js build:
// trees (planted by plantTrees in game.js, where they are also solid), strings of paper lanterns across the
// Lantern Quarter's streets, a door with a step and a hanging shop sign on each house's street side,
// chimneys with drifting smoke, and plank docks on posts over the river. Everything is generated from the
// tile map, with no image files, and it never changes collision or the game rules (trees aside, see game.js).
//
// Every object made here is marked userData.keep so render3d's own clean-up leaves it alone; this module
// frees the per-district pieces itself at the start of the next build().
import * as THREE from './vendor/three/three.module.min.js';
import { seeded } from './light3d.js';

const hash2 = (x, y) => (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;
const frac = (h, k = 1) => ((h >>> (k * 5)) % 1000) / 1000;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeStreetLife({ wallH = 2.4 } = {}) {
  const TIME = { value: 0 };
  // ---------- Textures ----------
  const door = canvasTex(64, 112, (c, w, h) => {
    c.fillStyle = '#d6cbb4'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, 30); c.quadraticCurveTo(w / 2, -12, w, 30); c.lineTo(w, h); c.fill();   // pale stone surround
    c.fillStyle = '#3f2a1a'; c.beginPath(); c.moveTo(7, h); c.lineTo(7, 32); c.quadraticCurveTo(w / 2, -2, w - 7, 32); c.lineTo(w - 7, h); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 16; x < w - 8; x += 9) c.fillRect(x, 12, 1.5, h);
    c.fillStyle = '#17120e'; c.fillRect(7, 44, w - 14, 5); c.fillRect(7, 86, w - 14, 5);
    c.fillStyle = '#c9a25a'; c.beginPath(); c.arc(w - 16, 68, 3, 0, 7); c.fill();
  });
  // Shop signs: eight plain symbols on painted boards (4 across, 2 down).
  const signs = canvasTex(256, 128, (c) => {
    const ink = '#2a1810', paint = ['#c9a25a', '#b5533c', '#d8c9a0', '#6f8f7a', '#c9a25a', '#8a6bb0', '#d8c9a0', '#b5533c'];
    for (let i = 0; i < 8; i++) {
      const x = (i % 4) * 64, y = Math.floor(i / 4) * 64, cx = x + 32, cy = y + 34;
      c.fillStyle = ink; c.fillRect(x + 2, y + 2, 60, 60);
      c.fillStyle = paint[i]; c.fillRect(x + 6, y + 6, 52, 52);
      c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = 4; c.beginPath();
      if (i === 0) { c.fillRect(cx - 12, cy - 12, 20, 26); c.arc(cx + 10, cy, 8, -1.4, 1.4); c.stroke(); }                       // tankard
      else if (i === 1) { c.ellipse(cx, cy - 2, 18, 12, 0, 0, 7); c.fill(); c.fillStyle = paint[i]; c.fillRect(cx - 11, cy - 6, 8, 5); c.fillRect(cx + 3, cy - 6, 8, 5); }   // mask
      else if (i === 2) { c.moveTo(cx, cy - 18); c.lineTo(cx + 13, cy); c.lineTo(cx, cy + 18); c.lineTo(cx - 13, cy); c.fill(); }   // diamond (cards)
      else if (i === 3) { c.ellipse(cx - 3, cy, 16, 9, 0, 0, 7); c.fill(); c.moveTo(cx + 10, cy); c.lineTo(cx + 22, cy - 10); c.lineTo(cx + 22, cy + 10); c.fill(); }   // fish
      else if (i === 4) { c.arc(cx - 6, cy, 9, 0, 7); c.stroke(); c.fillRect(cx + 2, cy - 2, 20, 4); c.fillRect(cx + 14, cy, 4, 9); }   // key
      else if (i === 5) { c.arc(cx, cy, 16, 0.5, 5.8); c.arc(cx + 7, cy, 12, 5.4, 0.9, true); c.fill(); }                           // crescent
      else if (i === 6) { c.fillRect(cx - 3, cy - 18, 6, 30); c.arc(cx, cy + 6, 13, 0.2, 2.94); c.stroke(); c.fillRect(cx - 10, cy - 12, 20, 4); }   // anchor
      else { c.arc(cx, cy + 2, 15, Math.PI, 0); c.fill(); c.fillRect(cx - 17, cy + 2, 34, 9); }                                   // loaf
    }
  });
  const paper = canvasTex(32, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a2a20'); g.addColorStop(0.1, '#b8a890'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(0.62, '#fff4d8'); g.addColorStop(0.9, '#b09880'); g.addColorStop(1, '#3a2a20');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(60,30,10,.22)'; for (let y = 10; y < h - 6; y += 7) c.fillRect(0, y, w, 1.5);
  });
  const planks = canvasTex(64, 64, (c, w, h) => {
    const r = seeded(17);
    c.fillStyle = '#2a1c12'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { const v = 78 + r() * 26; c.fillStyle = `rgb(${v | 0},${v * 0.68 | 0},${v * 0.46 | 0})`; c.fillRect(0, y + 1, w, 14); for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(r() * w, y + 2 + r() * 11, 8 + r() * 20, 1); } }
  });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
  const textures = [door, signs, paper, planks];

  // ---------- Materials (shared between districts) ----------
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
  const leafMat = std({ flatShading: true, roughness: 0.95 });
  leafMat.onBeforeCompile = (sh) => {   // crowns sway a little in the wind
    sh.uniforms.uWind = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wp = (instanceMatrix * vec4(position, 1.0)).xyz;
        float sw = sin(uWind * 1.3 + wp.x * 0.9 + wp.z * 1.3) + 0.5 * sin(uWind * 2.9 + wp.x * 2.1 - wp.z * 1.7);
        transformed.x += sw * 0.022 * max(position.y, 0.0); transformed.z += sw * 0.013 * max(position.y, 0.0);`);
  };
  leafMat.customProgramCacheKey = () => 'streetlife-leaf';
  const MATS = {
    door: std({ map: door, alphaTest: 0.5 }), sign: std({ map: signs, side: THREE.DoubleSide }), iron: std({ color: 0x1a1612, metalness: 0.6, roughness: 0.5 }),
    stone: std({ color: 0x8a867e }), paper: new THREE.MeshBasicMaterial({ map: paper, color: new THREE.Color(1.7, 1.7, 1.7) }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.6) }), cord: new THREE.LineBasicMaterial({ color: 0x1c1512 }),
    chimney: std({ color: 0x7a5048 }), cap: std({ color: 0x5a5650 }), planks: std({ map: planks }), bark: std({ color: 0x3a2a20 }), leaf: leafMat
  };
  MATS.smoke = new THREE.ShaderMaterial({
    uniforms: { uTime: TIME, uSize: { value: 300 } }, transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      uniform float uTime, uSize; attribute float aSeed; varying float vA;
      void main() {
        float life = fract(uTime * 0.09 + aSeed);
        vec3 p = position + vec3(life * 1.1 + sin(aSeed * 40.0 + life * 4.0) * 0.18 * life, life * 2.4, sin(aSeed * 23.0 + life * 3.0) * 0.25 * life);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vA = sin(3.14159 * life) * 0.16 * smoothstep(40.0, 16.0, -mv.z);
        gl_PointSize = uSize * (0.35 + life * 0.9) / max(-mv.z, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`varying float vA; void main() { float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.17, 0.2, 0.3), vA * smoothstep(0.5, 0.1, r)); }`
  });
  // ---------- Shapes (shared) ----------
  const blob = (() => {   // a lumpy ball for tree crowns
    const g = new THREE.IcosahedronGeometry(1, 1), pos = g.attributes.position, r = seeded(9), seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.82 + r() * 0.36);
      const k = seen.get(key);
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  })();
  const GEO = { blob, box: new THREE.BoxGeometry(1, 1, 1), flat: new THREE.PlaneGeometry(1, 1), trunk: new THREE.CylinderGeometry(0.07, 0.15, 1, 7), cone: new THREE.ConeGeometry(1, 1, 8),
    post: new THREE.CylinderGeometry(0.07, 0.08, 1, 7), lantern: new THREE.SphereGeometry(1, 8, 6), ring: new THREE.CylinderGeometry(0.46, 0.5, 0.2, 14) };
  const SHARED_GEO = new Set(Object.values(GEO));

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  /** One instanced mesh from a list of { p: [x,y,z], s: [x,y,z] | n, r: [x,y,z] (euler), c: colour } */
  function instances(geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      const s = o.s == null ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s, r = o.r || [0, 0, 0];
      im.setMatrixAt(i, _m.compose(_p.set(o.p[0], o.p[1], o.p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2])));
      if (o.c != null) im.setColorAt(i, _c.set(o.c));
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    return im;
  }
  // Building tiles grouped into rectangles, the same way render3d.js groups them for roofs.
  function rects(grid, W, H) {
    const used = new Uint8Array(W * H), out = [];
    const isB = (x, y) => x < W && y < H && grid[y][x] === '#' && !used[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isB(x, y)) continue;
      let w = 1; while (w < 12 && isB(x + w, y)) w++;
      let h = 1; while (h < 12 && [...Array(w).keys()].every((i) => isB(x + i, y + h))) h++;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[(y + j) * W + x + i] = 1;
      out.push({ x, y, w, h });
    }
    return out;
  }

  let made = [];   // this district's own geometries, freed on the next build
  /**
   * ctx: { grid, W, H, TILE, EDGES, TREES, estate, indoors, town (0 none, 0.5 a few, 1 many lantern strings), shadows (bool) }
   * Returns the group it added, so render3d can hide far-off parts.
   */
  function build(world, ctx) {
    for (const g of made) g.dispose();
    made = [];
    const { grid, W, H, TILE, estate, indoors } = ctx;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y][x]);
    const group = new THREE.Group();
    group.name = 'Street life';
    group.userData.keep = true;
    const add = (o, cast = true) => {
      o.userData.keep = true;
      o.castShadow = cast && ctx.shadows; o.receiveShadow = true;
      if (o.geometry && !SHARED_GEO.has(o.geometry)) made.push(o.geometry);
      group.add(o);
      return o;
    };
    const R = indoors ? [] : rects(grid, W, H);
    const rectOf = new Int32Array(W * H).fill(-1);
    R.forEach((r, ri) => { r.hv = hash2(r.x * 3 + r.w, r.y * 5 + r.h); for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) rectOf[(r.y + j) * W + r.x + i] = ri; });

    // ----- Doors, steps, door lanterns and hanging signs: one per house, on a plain stretch of street wall -----
    if (!indoors) {
      const NRM = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }, ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
      const byRect = new Map();
      for (const e of ctx.EDGES) {
        if (e.win) continue;   // the window bays keep their shutters and galleries
        const x = Math.floor(e.x0 / TILE), y = Math.floor(e.y0 / TILE);
        const [bx, by, ox, oy] = e.side === 's' ? [x, y - 1, x, y] : e.side === 'n' ? [x, y, x, y - 1] : e.side === 'e' ? [x - 1, y, x, y] : [x, y, x - 1, y];
        const ri = rectOf[by * W + bx];
        if (ri < 0 || Math.min(R[ri].w, R[ri].h) < 2 || at(ox, oy) !== '.') continue;
        if (!byRect.has(ri)) byRect.set(ri, []);
        byRect.get(ri).push(e);
      }
      const doors = [], steps = [], lamps = [], signsQ = [], brackets = [];
      for (const [ri, list] of byRect) {
        const r = R[ri], e = list[r.hv % list.length];
        const [nx, nz] = NRM[e.side], cx = (e.x0 + e.x1) / 2 / TILE, cz = (e.y0 + e.y1) / 2 / TILE, rot = ROT[e.side];
        const ax = -nz, az = nx;   // along the wall
        doors.push({ p: [cx + nx * 0.085, 0.58, cz + nz * 0.085], s: [0.62, 1.1, 1], r: [0, rot, 0] });   // in front of the stone base course
        steps.push({ p: [cx + nx * 0.22, 0.05, cz + nz * 0.22], s: [0.74, 0.06, 0.26], r: [0, rot, 0] });
        if (r.hv % 3 !== 1) lamps.push({ p: [cx + ax * 0.42 + nx * 0.12, 1.22, cz + az * 0.42 + nz * 0.1], s: [0.06, 0.1, 0.06] });
        if (!estate && r.hv % 5 < 3) {   // a painted board on an iron bracket, hanging out over the street
          const icon = (r.hv >>> 7) % 8, u0 = (icon % 4) / 4, v0 = 1 - (Math.floor(icon / 4) + 1) / 2, y = 1.3;
          const sx = cx - ax * 0.42, sz = cz - az * 0.42;
          signsQ.push([[sx + nx * 0.12, y - 0.36, sz + nz * 0.12], [sx + nx * 0.54, y - 0.36, sz + nz * 0.54], [sx + nx * 0.54, y + 0.02, sz + nz * 0.54], [sx + nx * 0.12, y + 0.02, sz + nz * 0.12], [ax, 0, az], [u0, v0, u0 + 0.25, v0, u0 + 0.25, v0 + 0.5, u0, v0 + 0.5]]);
          brackets.push({ p: [sx + nx * 0.3, y + 0.06, sz + nz * 0.3], s: [0.03, 0.03, 0.6], r: [0, rot, 0] });
        }
      }
      if (doors.length) { add(instances(GEO.flat, MATS.door, doors), false); add(instances(GEO.box, MATS.stone, steps), false); }
      if (lamps.length) add(instances(GEO.box, MATS.lamp, lamps), false);
      if (signsQ.length) {
        const pos = [], nor = [], uv = [], idx = [];
        signsQ.forEach(([a, b, c, d, n, u], k) => { pos.push(...a, ...b, ...c, ...d); for (let q = 0; q < 4; q++) nor.push(...n); uv.push(...u); idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
        add(new THREE.Mesh(g, MATS.sign));
        add(instances(GEO.box, MATS.iron, brackets));
      }
    }

    // ----- Chimneys on the ridge of most houses, smoking on some -----
    const chimneys = [], caps = [], smokeAt = [];
    for (const r of R) {
      if (Math.min(r.w, r.h) < 2 || r.hv % 3 === 0) continue;
      const alongX = r.w >= r.h, span = alongX ? r.h : r.w, len = alongX ? r.w : r.h, y1 = wallH + Math.min(1.1, span * 0.42);
      const a = len * (0.25 + frac(r.hv, 2) * 0.5), b = span * (0.5 + (r.hv % 2 ? 0.16 : -0.16));
      const cx = alongX ? r.x + a : r.x + b, cz = alongX ? r.y + b : r.y + a, top = y1 + 0.28;
      chimneys.push({ p: [cx, top - 0.5, cz], s: [0.3, 1.0, 0.3] }); caps.push({ p: [cx, top + 0.02, cz], s: [0.36, 0.06, 0.36] });
      if (r.hv % 2) smokeAt.push([cx, top + 0.1, cz]);
    }
    if (chimneys.length) { add(instances(GEO.box, MATS.chimney, chimneys)); add(instances(GEO.box, MATS.cap, caps)); }
    if (smokeAt.length) {
      const N = 5, pos = new Float32Array(smokeAt.length * N * 3), sd = new Float32Array(smokeAt.length * N);
      smokeAt.forEach((p, i) => { for (let k = 0; k < N; k++) { pos.set(p, (i * N + k) * 3); sd[i * N + k] = k / N + frac(hash2(i, k), 1) * 0.15; } });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
      const pts = add(new THREE.Points(g, MATS.smoke), false); pts.frustumCulled = false; pts.renderOrder = 4; pts.name = 'smoke';
    }

    // ----- Paper lanterns strung across the streets (many in the Lantern Quarter, a few in the River Quarter) -----
    if (ctx.town > 0 && !indoors) {
      const cord = [], lant = [], COLS = [0xffb347, 0xff7a3c, 0xe9435a, 0xffd98a, 0xffa23c, 0xc77dff];
      const span = (ax, az, bx, bz, hv) => {
        const len = Math.hypot(bx - ax, bz - az), y = 2.12, sag = 0.14 + len * 0.07, n = Math.max(2, Math.round(len * 1.25)), SEG = 10;
        const pt = (t) => [ax + (bx - ax) * t, y - sag * 4 * t * (1 - t), az + (bz - az) * t];
        for (let k = 0; k < SEG; k++) cord.push(...pt(k / SEG), ...pt((k + 1) / SEG));
        for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, p = pt(t); lant.push({ p: [p[0], p[1] - 0.09, p[2]], s: [0.062, 0.085, 0.062], c: COLS[(hv + k * 7) % (hv % 9 === 0 ? 6 : 5)] }); }
      };
      const every = ctx.town >= 1 ? 3 : 5;
      for (let ty = 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++) {
        if (grid[ty][tx] !== '.') continue;
        if (grid[ty][tx - 1] === '#' && ty % every === 1) {            // a street running north-south: string it east-west
          let w = 1; while (w <= 5 && at(tx + w, ty) === '.') w++;
          if (w >= 2 && w <= 5 && at(tx + w, ty) === '#' && hash2(tx, ty) % 3 !== 0) span(tx, ty + 0.5, tx + w, ty + 0.5, hash2(tx, ty));
        }
        if (grid[ty - 1][tx] === '#' && tx % every === 1) {            // a street running east-west
          let h = 1; while (h <= 5 && at(tx, ty + h) === '.') h++;
          if (h >= 2 && h <= 5 && at(tx, ty + h) === '#' && hash2(ty, tx) % 3 !== 0) span(tx + 0.5, ty, tx + 0.5, ty + h, hash2(ty, tx));
        }
      }
      if (lant.length) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(cord, 3));
        add(new THREE.LineSegments(g, MATS.cord), false);
        add(instances(GEO.lantern, MATS.paper, lant), false);
      }
    }

    // ----- Plank docks on posts (the 'd' tiles; the river stays where render3d draws it) -----
    const dockList = [], postList = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (grid[ty][tx] !== 'd') continue;
      const alongX = at(tx - 1, ty) === 'd' || at(tx + 1, ty) === 'd';
      dockList.push({ p: [tx + 0.5, 0.035, ty + 0.5], s: [1.002, 0.07, 1.002], r: [0, alongX ? 0 : Math.PI / 2, 0] });
      for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const touches = [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]].some(([ox, oz]) => at(tx + ox, ty + oz) === 'w');
        if (touches && hash2(tx + cx, ty + cz) % 2 === 0) postList.push({ p: [tx + cx, 0.12, ty + cz], s: [1, 0.32, 1] });
      }
    }
    if (dockList.length) add(instances(GEO.box, MATS.planks, dockList), false);
    if (postList.length) add(instances(GEO.post, MATS.bark, postList));

    // ----- Trees (solid: see plantTrees in game.js) -----
    const trunks = [], crowns = [], cones = [], beds = [], roots = [], GREENS = [0x2f5a2e, 0x3a6a34, 0x27502c, 0x466f33, 0x2c5a3c];
    for (const tr of ctx.TREES || []) {
      const x = tr.x / TILE, z = tr.y / TILE, hv = hash2(Math.floor(x), Math.floor(z)), k = 0.85 + frac(hv, 1) * 0.4;
      const cypress = estate && hv % 3 === 0, g1 = GREENS[hv % GREENS.length], g2 = GREENS[(hv + 2) % GREENS.length];
      if (tr.paved) beds.push({ p: [x, 0.1, z] }); else roots.push({ p: [x, 0.07, z], s: [0.34, 0.12, 0.34], r: [0, frac(hv, 2) * 6, 0], c: 0x3a2a20 });
      if (cypress) {
        trunks.push({ p: [x, 0.3, z], s: [0.9, 0.6, 0.9] });
        cones.push({ p: [x, 0.5 + 1.5 * k, z], s: [0.36, 3 * k, 0.36], c: 0x1f4630 }, { p: [x, 0.42 + 1.1 * k, z], s: [0.44, 2.2 * k, 0.44], c: 0x24502f, r: [0, 0.6, 0] });
      } else {
        const th = 1.2 * k;
        trunks.push({ p: [x, th / 2, z], s: [1.2, th, 1.2], r: [0, frac(hv, 3) * 6, 0] });
        crowns.push({ p: [x, th + 0.5 * k, z], s: [0.95 * k, 0.8 * k, 0.95 * k], r: [0, frac(hv, 2) * 6, 0], c: g1 },
          { p: [x + 0.5 * k, th + 0.25 * k, z + 0.15], s: 0.6 * k, r: [1, frac(hv, 1) * 6, 0], c: g2 },
          { p: [x - 0.42 * k, th + 0.3 * k, z - 0.3 * k], s: 0.62 * k, r: [2, frac(hv, 3) * 6, 0], c: g2 },
          { p: [x - 0.1, th + 0.95 * k, z + 0.3 * k], s: 0.55 * k, r: [0, 1, 2], c: g1 });
      }
    }
    if (trunks.length) add(instances(GEO.trunk, MATS.bark, trunks));
    if (crowns.length) add(instances(GEO.blob, MATS.leaf, crowns));
    if (cones.length) add(instances(GEO.cone, MATS.leaf, cones));
    if (beds.length) add(instances(GEO.ring, MATS.stone, beds));
    if (roots.length) add(instances(GEO.blob, MATS.bark, roots), false);

    world.add(group);
    return group;
  }

  return {
    build, textures,
    /** Each frame: the wind and the smoke. pixelScale keeps smoke puffs the same size on any screen. */
    tick(t, pixelScale = 1) { TIME.value = t; MATS.smoke.uniforms.uSize.value = 300 * pixelScale; }
  };
}
