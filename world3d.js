// The town itself for the 3D view: buildings of different heights with plaster, brick or cut-stone walls and
// pitched roofs, doors, hanging signs, chimneys with smoke, strings of paper lanterns over the streets,
// the river (moving water that mirrors the sky, the moon and the lamps), quays and plank docks, and the
// green things: grass, flowers, hedges, rocks and trees. Everything is generated from the district's tile map,
// with no image files. Used by render3d.js only; collision and the game rules stay in game.js.
import * as THREE from './vendor/three/three.module.min.js';
import { seeded, withTint } from './light3d.js';

export const STOREY = 1.25;      // height of one floor
export const WATER_Y = -0.2;     // the river sits a little below the streets
const hash2 = (x, y) => (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;
const frac = (h, k = 1) => ((h >>> (k * 5)) % 1000) / 1000;

function canvasTex(w, h, draw, aniso = 4) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  return t;
}

/** Collects four-cornered faces and turns them into one mesh (one draw call however many faces). */
class Quads {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.t = []; this.i = []; }
  add(a, b, c, d, n, uv = [0, 0, 1, 0, 1, 1, 0, 1], col = null, tint = null) {
    const k = this.p.length / 3;
    this.p.push(...a, ...b, ...c, ...d);
    for (let q = 0; q < 4; q++) { this.n.push(...n); if (col) this.c.push(col.r, col.g, col.b); }
    this.u.push(...uv);
    if (tint) this.t.push(...tint);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  get size() { return this.i.length / 6; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.t.length) g.setAttribute('tintUv', new THREE.Float32BufferAttribute(this.t, 2));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    return g;
  }
  mesh(mat) { return new THREE.Mesh(this.geometry(), mat); }
}
// A wall face between two points on the ground (left to right as you look at it), from y0 up to y1.
const wallQuad = (Q, ax, az, bx, bz, y0, y1, nx, nz, u0, u1, v0, v1, col) =>
  Q.add([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [nx, 0, nz], [u0, v0, u1, v0, u1, v1, u0, v1], col);
// The four sides of a tile: which neighbour, the outward normal, and the face's two corners (left, right).
const SIDES = [
  { k: 's', dx: 0, dy: 1, nx: 0, nz: 1, a: [0, 1], b: [1, 1] },
  { k: 'n', dx: 0, dy: -1, nx: 0, nz: -1, a: [1, 0], b: [0, 0] },
  { k: 'e', dx: 1, dy: 0, nx: 1, nz: 0, a: [1, 1], b: [1, 0] },
  { k: 'w', dx: -1, dy: 0, nx: -1, nz: 0, a: [0, 0], b: [0, 1] }
];

export function makeWorldKit({ glowTex, maxAniso = 4 }) {
  const TIME = { value: 0 };
  const rnd = seeded(31);
  const speckle = (c, w, h, n, a) => { for (let k = 0; k < n; k++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${a * rnd()})`; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); } };
  // ---------- Wall finishes (one storey tall; timber is two tiles wide so neighbouring panels differ) ----------
  const timber = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#d9cdb4'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 900, 0.07);
    for (let k = 0; k < 30; k++) { const g = c.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, 40); g.addColorStop(0, 'rgba(90,70,40,.10)'); g.addColorStop(1, 'rgba(90,70,40,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    const beam = (x0, y0, x1, y1, t) => {
      c.strokeStyle = '#33211a'; c.lineWidth = t; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = 'rgba(120,84,50,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 1, y0 + 1); c.lineTo(x1 + 1, y1 + 1); c.stroke();
    };
    for (const x of [0, 128]) { beam(x + 4, 0, x + 4, h, 9); beam(x + 124, 0, x + 124, h, 9); }
    beam(0, 5, w, 5, 11); beam(0, h - 5, w, h - 5, 11);
    beam(8, h - 10, 120, 12, 7);                                   // left panel: one long brace
    beam(132, 104, 252, 104, 6); beam(190, 104, 190, h - 10, 6);   // right panel: a rail under the window and a short post
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 10, w, 4);
  }, maxAniso);
  const brick = canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = '#3d2c2e'; c.fillRect(0, 0, w, h);
    for (let y = 12, row = 0; y < h; y += 10, row++) for (let x = row % 2 ? -11 : 0; x < w; x += 22) {
      const v = 0.8 + rnd() * 0.4, warm = rnd();
      c.fillStyle = `rgb(${150 * v + warm * 20 | 0},${92 * v | 0},${84 * v - warm * 10 | 0})`;
      c.fillRect(x + 1, y + 1, 20, 8);
      if (rnd() < 0.12) { c.fillStyle = 'rgba(30,20,24,.35)'; c.fillRect(x + 1, y + 1, 20, 8); }
    }
    c.fillStyle = '#8f8a84'; c.fillRect(0, 0, w, 12);                 // a stone course at each floor
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 10, w, 3);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, w, 2);
    speckle(c, w, h, 500, 0.08);
  }, maxAniso);
  const stone = canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = '#55525a'; c.fillRect(0, 0, w, h);
    for (let y = 16, row = 0; y < h; y += 24, row++) for (let x = row % 2 ? -32 : 0; x < w; x += 64) {
      const v = 138 + rnd() * 34;
      c.fillStyle = `rgb(${v | 0},${v - 3 | 0},${v + 8 | 0})`; c.fillRect(x + 1.5, y + 1.5, 61, 21);
      c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(x + 1.5, y + 1.5, 61, 2);
      c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x + 1.5, y + 20, 61, 2.5);
    }
    c.fillStyle = '#a79f8f'; c.fillRect(0, 0, w, 16);                 // cornice
    c.fillStyle = '#8a6a32'; c.fillRect(0, 12, w, 3);                 // House Veyrane's gold line
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, 15, w, 3);
    speckle(c, w, h, 700, 0.07);
  }, maxAniso);
  const plinth = canvasTex(128, 32, (c, w, h) => {
    c.fillStyle = '#3c3a42'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { const v = 96 + rnd() * 30; c.fillStyle = `rgb(${v | 0},${v | 0},${v + 8 | 0})`; c.fillRect(x + 1, 2, 30, h - 4); }
    c.fillStyle = 'rgba(40,70,50,.25)'; c.fillRect(0, h - 9, w, 9);   // damp and moss at the foot
    speckle(c, w, h, 200, 0.1);
  });
  const slate = (base, hi) => canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 16, row++) for (let x = row % 2 ? -8 : 0; x < w; x += 16) {
      c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : hi},${0.05 + rnd() * 0.16})`; c.fillRect(x + 1, y + 1, 14, 15);
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x, y, 1, 16);
    }
    for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, y, w, 2); c.fillStyle = `rgba(${hi},.10)`; c.fillRect(0, y + 2, w, 1); }
  }, maxAniso);
  const planks = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#2a1c12'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { const v = 78 + rnd() * 26; c.fillStyle = `rgb(${v | 0},${v * 0.68 | 0},${v * 0.46 | 0})`; c.fillRect(0, y + 1, w, 14); for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(rnd() * w, y + 2 + rnd() * 11, 8 + rnd() * 20, 1); } }
    c.fillStyle = '#15100c'; for (const x of [6, 58]) for (let y = 8; y < h; y += 16) c.fillRect(x, y, 2, 2);
  });
  const door = canvasTex(64, 112, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#8b857c'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, 30); c.quadraticCurveTo(w / 2, -12, w, 30); c.lineTo(w, h); c.fill();     // stone surround
    c.fillStyle = '#3f2a1a'; c.beginPath(); c.moveTo(7, h); c.lineTo(7, 32); c.quadraticCurveTo(w / 2, -2, w - 7, 32); c.lineTo(w - 7, h); c.fill();
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 16; x < w - 8; x += 9) c.fillRect(x, 12, 1.5, h);
    c.fillStyle = '#17120e'; c.fillRect(7, 44, w - 14, 5); c.fillRect(7, 86, w - 14, 5);
    c.fillStyle = '#c9a25a'; c.beginPath(); c.arc(w - 16, 68, 3, 0, 7); c.fill();
  });
  door.wrapS = door.wrapT = THREE.ClampToEdgeWrapping;
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
  signs.wrapS = signs.wrapT = THREE.ClampToEdgeWrapping;
  const paper = canvasTex(32, 64, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3a2a20'); g.addColorStop(0.1, '#b8a890'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(0.62, '#fff4d8'); g.addColorStop(0.9, '#b09880'); g.addColorStop(1, '#3a2a20');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(60,30,10,.22)'; for (let y = 10; y < h - 6; y += 7) c.fillRect(0, y, w, 1.5);
  });
  const textures = [timber, brick, stone, plinth, planks, door, signs, paper];
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const WALLS = { timber: lam({ map: timber, vertexColors: true }), brick: lam({ map: brick, vertexColors: true }), stone: lam({ map: stone, vertexColors: true }) };
  const SLOPES = [['#3a3a4c', '190,200,255'], ['#2c4a3e', '170,255,210'], ['#5e3529', '255,190,150'], ['#33303a', '210,200,230']].map(([b, hi]) => { const t = slate(b, hi); textures.push(t); return lam({ map: t, side: THREE.DoubleSide }); });
  const MATS = {
    plinth: lam({ map: plinth }), top: lam({ map: SLOPES[3].map }), planks: lam({ map: planks }), quay: lam({ map: stone, color: 0x8a8c9c }),
    door: lam({ map: door, alphaTest: 0.5 }), sign: lam({ map: signs, side: THREE.DoubleSide }), dark: lam({ color: 0x17130f }),
    chimney: lam({ map: brick, color: 0xb0a0a0 }), cord: new THREE.LineBasicMaterial({ color: 0x1c1512 }),
    paper: new THREE.MeshBasicMaterial({ map: paper, color: new THREE.Color(1.7, 1.7, 1.7) }), stoneBit: lam({ color: 0x77757f }), pot: lam({ color: 0x6b4634 }), bark: lam({ color: 0x3a2a20 }),
    glow: new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9838, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  };
  // Leaves and grass sway: the vertex shader pushes the tops about with the wind.
  const swaying = (mat, amount, key) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = TIME;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 wp = (instanceMatrix * vec4(position, 1.0)).xyz;
          #else
            vec3 wp = position;
          #endif
          float sw = sin(uWind * 1.3 + wp.x * 0.9 + wp.z * 1.3) + 0.5 * sin(uWind * 2.9 + wp.x * 2.1 - wp.z * 1.7);
          transformed.x += sw * ${amount.toFixed(3)} * max(position.y, 0.0);
          transformed.z += sw * ${(amount * 0.6).toFixed(3)} * max(position.y, 0.0);`);
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  };
  MATS.grass = swaying(lam({ side: THREE.DoubleSide, emissive: 0x16240f }), 0.35, 'grass');
  MATS.leaf = swaying(lam({ flatShading: true }), 0.022, 'leaf');
  MATS.hedge = lam({ flatShading: true });
  MATS.flower = lam({ color: 0xffffff });

  // ---------- Water ----------
  const waterU = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: TIME, uMoon: { value: new THREE.Vector3(0, 1, 0) }, uMoonCol: { value: new THREE.Color(0x9ab0e8) },
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uLamps: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }
  };
  MATS.water = new THREE.ShaderMaterial({
    uniforms: waterU, fog: true,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uMoon, uMoonCol, uZenith, uHorizon; uniform vec4 uLamps[6];
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) { return d * (a * f * cos(dot(d, p) * f + uTime * s)); }
      void main() {
        vec2 p = vWorld.xz;
        // the river's surface: a slow swell along the current, cross-chop, and fine ripple
        vec2 g = wave(p, vec2(0.96, 0.28), 1.7, 0.9, 0.05) + wave(p, vec2(-0.35, 0.94), 2.9, 1.3, 0.035) + wave(p, vec2(0.7, -0.71), 5.3, 2.1, 0.016) + wave(p, vec2(0.2, 0.98), 9.1, 2.8, 0.008);
        vec2 q = p * 3.2 + vec2(uTime * 0.35, uTime * 0.12); float e = 0.08;
        g += vec2(vn(q + vec2(e, 0.0)) - vn(q - vec2(e, 0.0)), vn(q + vec2(0.0, e)) - vn(q - vec2(0.0, e))) * 0.55;
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 skyc = mix(uHorizon * 1.25, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.45));
        vec3 col = mix(vec3(0.008, 0.02, 0.045), skyc, F);
        float md = max(dot(R, uMoon), 0.0);
        col += uMoonCol * (pow(md, 220.0) * 2.4 + pow(md, 18.0) * 0.1);                      // moon glitter
        for (int i = 0; i < 6; i++) {                                                          // lantern light dancing on the water
          vec3 L = uLamps[i].xyz - vWorld; float d = length(L);
          float sp = pow(max(dot(R, L / d), 0.0), 34.0);
          col += vec3(1.0, 0.56, 0.2) * sp * uLamps[i].w / (1.0 + d * d * 0.05) * 2.2;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  // Chimney smoke: a handful of soft puffs per chimney, all in one draw.
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

  // Shared shapes (kept between districts).
  const keep = (g) => { g.userData.keepGeo = true; return g; };
  const GEO = {
    blade: (() => {   // a tuft: five bent blades
      const p = [], n = [], r = seeded(4);
      for (let k = 0; k < 5; k++) {
        const a = k * 1.26 + r() * 0.5, d = 0.02 + r() * 0.09, h = 0.07 + r() * 0.1, wv = 0.007, lean = 0.02 + r() * 0.05;
        const bx = Math.cos(a) * d, bz = Math.sin(a) * d, px = -Math.sin(a) * wv, pz = Math.cos(a) * wv, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
        p.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + lx * 0.4, h * 0.6, bz + lz * 0.4, bx + px * 0.5 + lx * 0.4, h * 0.6, bz + pz * 0.5 + lz * 0.4, bx - px * 0.5 + lx * 0.4, h * 0.6, bz - pz * 0.5 + lz * 0.4, bx + lx, h, bz + lz);
        for (let q = 0; q < 6; q++) n.push(lx * 2, 1, lz * 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
      return keep(g);
    })(),
    blob: (() => {    // a lumpy ball for tree crowns, bushes and rocks
      const g = new THREE.IcosahedronGeometry(1, 1), pos = g.attributes.position, r = seeded(9), seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        if (!seen.has(key)) seen.set(key, 0.82 + r() * 0.36);
        const k = seen.get(key);
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
      return keep(g);
    })(),
    trunk: keep(new THREE.CylinderGeometry(0.07, 0.15, 1, 7)), cone: keep(new THREE.ConeGeometry(1, 1, 8)),
    box: keep(new THREE.BoxGeometry(1, 1, 1)), post: keep(new THREE.CylinderGeometry(0.07, 0.08, 1, 7)),
    lantern: keep(new THREE.SphereGeometry(1, 8, 6)), flat: keep(new THREE.PlaneGeometry(1, 1)), petal: keep(new THREE.OctahedronGeometry(1, 0)),
    ring: keep(new THREE.CylinderGeometry(0.46, 0.5, 0.2, 14))
  };
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
    return im;
  }

  // Building tiles are grouped into rectangles; each rectangle is one house.
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
  const PLASTER = [0xf2e6cf, 0xe6d3b0, 0xdcc7c0, 0xcfd2cf, 0xe9dcc2, 0xd6c3a2];
  const BRICKS = [0xd8d0d0, 0xc8b8b4, 0xc0c4d0];

  /**
   * Builds the district's buildings, ground, water and plants into `world`.
   * ctx: { grid, W, H, TILE, EDGES, TREES, LAMPS, estate, indoors, town (0..1 how festive), veg (0..1), groundTex, tintTex }
   * Returns { TOPS, storeysAt(edge), doorEdges, boatY }.
   */
  function build(world, ctx) {
    const { grid, W, H, estate, indoors, veg } = ctx;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : grid[y][x]);
    const add = (o, flags = {}) => { Object.assign(o.userData, flags); world.add(o); return o; };
    const TOPS = new Float32Array(W * H), wallH = new Float32Array(W * H), rectOf = new Int32Array(W * H).fill(-1);
    const R = rects(grid, W, H);
    const tint = new THREE.Color();

    // ----- Houses: heights, walls, roofs -----
    R.forEach((r, ri) => {
      const hv = hash2(r.x * 3 + r.w, r.y * 5 + r.h);
      r.hv = hv; r.thin = Math.min(r.w, r.h) < 2;
      r.storeys = indoors || r.thin ? 2 : estate ? (hv % 4 === 0 ? 3 : 2) : (hv % 5 < 2 ? 3 : 2);
      r.h3 = indoors ? 1.7 : r.storeys * STOREY;   // rooms are cut away lower, so you can see in
      r.finish = estate ? 'stone' : hv % 5 < 3 ? 'timber' : 'brick';
      r.tint = r.finish === 'timber' ? PLASTER[(hv >>> 4) % PLASTER.length] : r.finish === 'brick' ? BRICKS[(hv >>> 4) % BRICKS.length] : 0xffffff;
      for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const k = (r.y + j) * W + r.x + i; wallH[k] = TOPS[k] = r.h3; rectOf[k] = ri; }
    });
    const faces = { timber: new Quads(), brick: new Quads(), stone: new Quads() }, base = new Quads(), tops = new Quads();
    for (const r of R) {
      tint.set(r.tint);
      const col = { r: tint.r, g: tint.g, b: tint.b };
      for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
        const tx = r.x + i, ty = r.y + j;
        for (const sd of SIDES) {
          const t = at(tx + sd.dx, ty + sd.dy);
          const nh = t === '#' ? wallH[(ty + sd.dy) * W + tx + sd.dx] : 0;
          if (nh >= r.h3 - 0.01) continue;
          const ax = tx + sd.a[0], az = ty + sd.a[1], bx = tx + sd.b[0], bz = ty + sd.b[1];
          const along = sd.dx ? ty : tx, u0 = r.finish === 'timber' ? (along % 2) * 0.5 : 0, u1 = u0 + (r.finish === 'timber' ? 0.5 : 1);
          wallQuad(faces[r.finish], ax, az, bx, bz, nh, r.h3, sd.nx, sd.nz, u0, u1, nh / STOREY, r.h3 / STOREY, col);
          if (t !== null && t !== '#' && !indoors) {   // a stone footing along the street
            const o = 0.035, px = sd.nx * o, pz = sd.nz * o;
            wallQuad(base, ax + px, az + pz, bx + px, bz + pz, 0, 0.24, sd.nx, sd.nz, along, along + 1, 0, 1);
            base.add([ax + px, 0.24, az + pz], [bx + px, 0.24, bz + pz], [bx, 0.26, bz], [ax, 0.26, az], [0, 1, 0], [along, 0.9, along + 1, 0.9, along + 1, 1, along, 1]);
          }
        }
      }
      // Roof: a ridge along the long side, or a flat stone top on walls one tile thick.
      if (r.thin) {
        for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const x = r.x + i, z = r.y + j; tops.add([x, r.h3, z + 1], [x + 1, r.h3, z + 1], [x + 1, r.h3, z], [x, r.h3, z], [0, 1, 0]); }
        continue;
      }
      const alongX = r.w >= r.h, span = alongX ? r.h : r.w, len = alongX ? r.w : r.h;
      const pitch = Math.min(1.25, span * 0.44), y0 = r.h3 - 0.02, y1 = r.h3 + pitch, O = 0.16;
      const P = (a, b, y) => (alongX ? [r.x + a, y, r.y + b] : [r.x + b, y, r.y + a]);
      r.roof = { alongX, span, len, pitch, y1, P, slope: estate ? (r.hv % 2 ? 3 : 0) : r.hv % 4 };
      for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
        const b = alongX ? j + 0.5 : i + 0.5;
        TOPS[(r.y + j) * W + r.x + i] = r.h3 + pitch * (1 - Math.abs(b - span / 2) / (span / 2));
      }
    }
    const slopeQ = SLOPES.map(() => new Quads()), gableP = { timber: [], brick: [], stone: [] }, chimneys = [], smokeAt = [];
    for (const r of R) {
      if (!r.roof) continue;
      const { span, len, pitch, y1, P, slope } = r.roof, O = 0.16, y0 = r.h3 - 0.02;
      const slopeLen = Math.hypot(span / 2 + O, pitch);
      for (const [b0, b1] of [[-O, span / 2], [span + O, span / 2]]) {
        const a = P(-O, b0, y0 - O * 0.45), b = P(len + O, b0, y0 - O * 0.45), c = P(len + O, b1, y1), d = P(-O, b1, y1);
        const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
        const n = e1.cross(e2).normalize(); if (n.y < 0) n.negate();
        slopeQ[slope].add(a, b, c, d, [n.x, n.y, n.z], [0, 0, len + 2 * O, 0, len + 2 * O, slopeLen, 0, slopeLen]);
      }
      tint.set(r.tint);
      for (const a of [0, len]) gableP[r.finish].push([P(a, 0, y0), P(a, span, y0), P(a, span / 2, y1), tint.r, tint.g, tint.b, span, pitch]);
      // A chimney near the ridge on most houses, smoking on some.
      if (r.hv % 3 !== 0 && !indoors) {
        const a = len * (0.25 + frac(r.hv, 2) * 0.5), b = span * (0.5 + (r.hv % 2 ? 0.16 : -0.16));
        const [cx, , cz] = P(a, b, 0), top = y1 + 0.28;
        chimneys.push({ p: [cx, top - 0.5, cz], s: [0.3, 1.0, 0.3] }, { p: [cx, top + 0.02, cz], s: [0.36, 0.06, 0.36], c: 0x6a6660 });
        if (r.hv % 2) smokeAt.push([cx, top + 0.1, cz]);
      }
    }
    for (const k of Object.keys(faces)) if (faces[k].size) add(faces[k].mesh(WALLS[k]));
    if (base.size) add(base.mesh(MATS.plinth), { noCast: true });
    if (tops.size) add(tops.mesh(MATS.top), { noCast: true });
    slopeQ.forEach((q, k) => { if (q.size) add(q.mesh(SLOPES[k])); });
    for (const [finish, list] of Object.entries(gableP)) {
      if (!list.length) continue;
      const pos = [], uv = [], col = [], nor = [];
      for (const [a, b, c, cr, cg, cb, span, pitch] of list) {
        pos.push(...a, ...b, ...c);
        const tw = finish === 'timber' ? 0.5 : 1;
        uv.push(0, 0, span * tw, 0, span * tw / 2, pitch / STOREY);
        for (let q = 0; q < 3; q++) col.push(cr, cg, cb);
        const n = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]).cross(new THREE.Vector3(0, 1, 0)).normalize();
        for (let q = 0; q < 3; q++) nor.push(n.x, 0, n.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const m = WALLS[finish].clone(); m.side = THREE.DoubleSide;
      add(new THREE.Mesh(g, m));
    }
    if (chimneys.length) add(instances(GEO.box, MATS.chimney, chimneys));
    if (smokeAt.length && veg > 0.5) {
      const N = 5, pos = new Float32Array(smokeAt.length * N * 3), sd = new Float32Array(smokeAt.length * N);
      smokeAt.forEach((p, i) => { for (let k = 0; k < N; k++) { pos.set(p, (i * N + k) * 3); sd[i * N + k] = k / N + frac(hash2(i, k), 1) * 0.15; } });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
      const pts = new THREE.Points(g, MATS.smoke); pts.frustumCulled = false; pts.renderOrder = 4;
      world.add(pts);
    }

    // ----- Doors, signs, pots (on the street side of each house) -----
    const tileOfEdge = (e) => {
      const x = Math.floor(e.x0 / ctx.TILE), y = Math.floor(e.y0 / ctx.TILE);
      return e.side === 's' ? [x, y - 1, x, y] : e.side === 'n' ? [x, y, x, y - 1] : e.side === 'e' ? [x - 1, y, x, y] : [x, y, x - 1, y];
    };
    const storeysAt = (e) => { if (indoors) return 0; const [bx, by] = tileOfEdge(e); return Math.max(1, Math.round((wallH[by * W + bx] || 2 * STOREY) / STOREY)); };
    const doorEdges = new Set();
    if (!indoors) {
      const byRect = new Map();
      for (const e of ctx.EDGES) {
        const [bx, by, ox, oy] = tileOfEdge(e), ri = rectOf[by * W + bx];
        if (ri < 0 || R[ri].thin || at(ox, oy) !== '.') continue;
        if (!byRect.has(ri)) byRect.set(ri, []);
        byRect.get(ri).push(e);
      }
      const NRM = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }, ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
      const doors = [], steps = [], lamps = [], halos = [], pools = [], pots = [], bushes = [], signQ = new Quads(), brackets = [];
      for (const [ri, list] of byRect) {
        const r = R[ri], e = list[r.hv % list.length];
        doorEdges.add(e);
        const [nx, nz] = NRM[e.side], cx = (e.x0 + e.x1) / 2 / ctx.TILE, cz = (e.y0 + e.y1) / 2 / ctx.TILE, rot = ROT[e.side];
        const txx = -nz, tzz = nx;   // along the wall
        doors.push({ p: [cx + nx * 0.045, 0.5, cz + nz * 0.045], s: [0.6, 1.0, 1], r: [0, rot, 0] });
        steps.push({ p: [cx + nx * 0.1, 0.03, cz + nz * 0.1], s: [0.72, 0.06, 0.2], r: [0, rot, 0] });
        if (r.hv % 3 !== 1) {   // a lantern over the door
          lamps.push({ p: [cx + nx * 0.1, 1.22, cz + nz * 0.1], s: [0.07, 0.11, 0.07], c: 0xffc878 });
          halos.push({ p: [cx + nx * 0.13, 1.22, cz + nz * 0.13], s: [0.9, 0.9, 1], r: [0, rot, 0] });
          pools.push({ p: [cx + nx * 0.6, 0.012, cz + nz * 0.6], s: [1.7, 1.7, 1], r: [-Math.PI / 2, 0, 0] });
        }
        if (r.hv % 2 === 0) {   // a potted shrub by the door
          const k = (r.hv >>> 3) % 2 ? 0.46 : -0.46, px = cx + txx * k + nx * 0.13, pz = cz + tzz * k + nz * 0.13;
          pots.push({ p: [px, 0.09, pz], s: [0.2, 0.18, 0.2] });
          bushes.push({ p: [px, 0.3, pz], s: [0.17, 0.2, 0.17], c: (r.hv >>> 6) % 2 ? 0x2f5c3a : 0x3a6a34, r: [0, frac(r.hv, 2) * 6, 0] });
        }
        if (!estate && r.hv % 5 < 3) {   // a painted sign on an iron bracket, hanging out over the street
          const icon = (r.hv >>> 7) % 8, u0 = (icon % 4) / 4, v0 = 1 - (Math.floor(icon / 4) + 1) / 2, y = 1.62;
          const ax = cx + nx * 0.12, az = cz + nz * 0.12, bx2 = cx + nx * 0.54, bz2 = cz + nz * 0.54;
          signQ.add([ax, y - 0.36, az], [bx2, y - 0.36, bz2], [bx2, y + 0.02, bz2], [ax, y + 0.02, az], [txx, 0, tzz], [u0, v0, u0 + 0.25, v0, u0 + 0.25, v0 + 0.5, u0, v0 + 0.5]);
          brackets.push({ p: [cx + nx * 0.3, y + 0.06, cz + nz * 0.3], s: [0.03, 0.03, 0.6], r: [0, rot, 0] });
        }
      }
      if (doors.length) add(instances(GEO.flat, MATS.door, doors), { noCast: true });
      if (steps.length) add(instances(GEO.box, MATS.stoneBit, steps), { noCast: true });
      if (lamps.length) { add(instances(GEO.box, MATS.paper, lamps)); const h = add(instances(GEO.flat, MATS.glow, [...halos, ...pools])); h.renderOrder = 2; }
      if (pots.length) { add(instances(GEO.trunk, MATS.pot, pots)); add(instances(GEO.blob, MATS.hedge, bushes)); }
      if (signQ.size) { add(signQ.mesh(MATS.sign)); add(instances(GEO.box, MATS.dark, brackets)); }
    }

    // ----- Paper lanterns strung across the streets (the Lantern Quarter's own look) -----
    if (ctx.town > 0 && !indoors) {
      const cord = [], lant = [], COLS = [0xffb347, 0xff7a3c, 0xe9435a, 0xffd98a, 0xffa23c, 0xc77dff];
      const span = (ax, az, bx, bz, hv) => {
        const len = Math.hypot(bx - ax, bz - az), y = 2.28, sag = 0.14 + len * 0.07, n = Math.max(2, Math.round(len * 1.25)), SEG = 10;
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
        world.add(new THREE.LineSegments(g, MATS.cord));
        add(instances(GEO.lantern, MATS.paper, lant));
      }
    }

    // ----- Ground, river, quays and docks -----
    const wet = (t) => t === 'w' || t === 'd';
    const groundQ = new Quads(), waterQ = new Quads(), quayQ = new Quads(), dockList = [], postList = [];
    let hasWater = false;
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const t = grid[ty][tx];
      if (!wet(t)) {
        if (t !== '#') groundQ.add([tx, 0, ty + 1], [tx + 1, 0, ty + 1], [tx + 1, 0, ty], [tx, 0, ty], [0, 1, 0],
          [tx / W, 1 - (ty + 1) / H, (tx + 1) / W, 1 - (ty + 1) / H, (tx + 1) / W, 1 - ty / H, tx / W, 1 - ty / H], null,
          [tx / W, 1 - (ty + 1) / H, (tx + 1) / W, 1 - (ty + 1) / H, (tx + 1) / W, 1 - ty / H, tx / W, 1 - ty / H]);
        continue;
      }
      hasWater = true;
      // water under this tile, stretched far out where the river leaves the map
      const x0 = tx === 0 ? -60 : tx, x1 = tx === W - 1 ? W + 60 : tx + 1, z0 = ty === 0 ? -60 : ty, z1 = ty === H - 1 ? H + 60 : ty + 1;
      waterQ.add([x0, WATER_Y, z1], [x1, WATER_Y, z1], [x1, WATER_Y, z0], [x0, WATER_Y, z0], [0, 1, 0]);
      if (t === 'd') {
        const alongX = wet(at(tx, ty - 1)) || wet(at(tx, ty + 1)) ? at(tx - 1, ty) === 'd' || at(tx + 1, ty) === 'd' : true;
        dockList.push({ p: [tx + 0.5, -0.04, ty + 0.5], s: [1, 0.08, 1], r: [0, alongX ? Math.PI / 2 : 0, 0] });
        for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const touches = [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]].some(([ox, oz]) => at(tx + ox, ty + oz) === 'w');
          if (touches && hash2(tx + cx, ty + cz) % 2 === 0) postList.push({ p: [tx + cx, -0.12, ty + cz], s: [1, 0.62, 1] });
        }
      }
      // the quay wall where a street or building meets the water
      for (const sd of SIDES) {
        const n = at(tx + sd.dx, ty + sd.dy);
        if (n === null || wet(n)) continue;
        const ax = tx + sd.b[0], az = ty + sd.b[1], bx = tx + sd.a[0], bz = ty + sd.a[1], along = sd.dx ? ty : tx;
        wallQuad(quayQ, ax, az, bx, bz, WATER_Y - 0.15, 0, -sd.nx, -sd.nz, along, along + 1, 0.4, 0.68);
      }
    }
    const groundMat = withTint(new THREE.MeshLambertMaterial({ map: ctx.groundTex }), ctx.tintTex);
    add(groundQ.mesh(groundMat), { noCast: true });
    if (hasWater) {
      const wm = waterQ.mesh(MATS.water); wm.frustumCulled = false;
      world.add(wm);
      if (quayQ.size) add(quayQ.mesh(MATS.quay), { noCast: true });
      if (dockList.length) add(instances(GEO.box, MATS.planks, dockList));
      if (postList.length) add(instances(GEO.post, MATS.bark, postList));
    }

    // ----- Green things -----
    const tufts = [], flowers = [], rocks = [], hedges = [];
    const GRASS = [0x7fae52, 0x93b85a, 0x6a9a4c, 0xa4bf62, 0x78a860];
    const GREENS = [0x2f5a2e, 0x3a6a34, 0x27502c, 0x466f33, 0x2c5a3c], PETALS = [0xf3e9d2, 0xe9b65a, 0xb48ae0, 0xd9535f, 0xf3e9d2];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const t = grid[ty][tx];
      if (t === 'h') {
        const hv = hash2(tx, ty);
        hedges.push({ p: [tx + 0.5, 0.36, ty + 0.5], s: [0.6, 0.5 + frac(hv, 1) * 0.12, 0.6], r: [0, frac(hv, 2) * 6.28, 0], c: GREENS[hv % 3] });
        hedges.push({ p: [tx + 0.5 + (frac(hv, 3) - 0.5) * 0.5, 0.62, ty + 0.5 + (frac(hv, 4) - 0.5) * 0.5], s: 0.34, r: [0, frac(hv, 1) * 6.28, 0], c: GREENS[(hv + 1) % 3] });
      }
      if (t !== 'g' && t !== 'h') continue;
      const r = seeded(hash2(tx, ty));
      const n = Math.round((t === 'g' ? 44 : 12) * veg);
      for (let k = 0; k < n; k++) tufts.push({ p: [tx + r(), 0, ty + r()], s: [0.9 + r() * 0.6, 0.7 + r() * 0.8, 0.9 + r() * 0.6], r: [0, r() * 6.28, 0], c: GRASS[Math.floor(r() * GRASS.length)] });
      if (t === 'g') {
        if (r() < 0.5 * veg) { const c = PETALS[Math.floor(r() * PETALS.length)], fx = tx + r(), fz = ty + r(); for (let k = 0; k < 3; k++) flowers.push({ p: [fx + (r() - 0.5) * 0.3, 0.13 + r() * 0.08, fz + (r() - 0.5) * 0.3], s: 0.028 + r() * 0.012, c }); }
        const byWall = SIDES.some((sd) => at(tx + sd.dx, ty + sd.dy) === '#');
        if (byWall && r() < 0.3) { const s = 0.08 + r() * 0.1; rocks.push({ p: [tx + 0.2 + r() * 0.6, s * 0.5, ty + 0.2 + r() * 0.6], s: [s * 1.3, s, s * 1.1], r: [r(), r() * 6, r()], c: r() < 0.5 ? 0x77757f : 0x666a72 }); }
      }
    }
    if (tufts.length) add(instances(GEO.blade, MATS.grass, tufts), { noCast: true });
    if (flowers.length) add(instances(GEO.petal, MATS.flower, flowers), { noCast: true });
    if (rocks.length) add(instances(GEO.blob, MATS.hedge, rocks));
    if (hedges.length) add(instances(GEO.blob, MATS.hedge, hedges));
    // Trees stand where game.js put them (they're solid there too).
    const trunks = [], crowns = [], cones = [], beds = [], roots = [];
    for (const tr of ctx.TREES || []) {
      const x = tr.x / ctx.TILE, z = tr.y / ctx.TILE, hv = hash2(Math.floor(x), Math.floor(z)), k = 0.85 + frac(hv, 1) * 0.4;
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
    if (beds.length) add(instances(GEO.ring, MATS.stoneBit, beds));
    if (roots.length) add(instances(GEO.blob, MATS.hedge, roots));
    return { TOPS, storeysAt, doorEdges, hasWater };
  }

  const _v = new THREE.Vector3();
  return {
    build, textures, STOREY,
    /** Each frame: the wind, and what the water mirrors (sky colours, moon, the lamps nearest ZAY). */
    tick(clock, night, lamps, pixelScale) {
      TIME.value = clock;
      waterU.uMoon.value.copy(night.dir); waterU.uMoonCol.value.copy(night.moon);
      waterU.uZenith.value.copy(night.zen); waterU.uHorizon.value.copy(night.hor);
      for (let i = 0; i < 6; i++) { const l = lamps[i]; if (l) waterU.uLamps.value[i].set(l[0], 1.9, l[1], 1); else waterU.uLamps.value[i].set(0, -99, 0, 0); }
      MATS.smoke.uniforms.uSize.value = 300 * pixelScale;
    }
  };
}
