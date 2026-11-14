// Characters for the 3D view: jointed figures (hips, spine, head, two-part arms and legs) built from simple
// shapes in each character's model-sheet colours, and the animation that moves them (walk, run, idle,
// sit, roll, hop, knocked out). Used by render3d.js only; it never touches the game rules.
//
// A figure faces +x, stands on y = 0 and is about 1.1 units tall at scale 1 (one unit = one map tile).
// To keep the draw calls down, everything that hangs off one joint is baked into a single mesh with the
// colours stored per vertex, so a whole person is about a dozen meshes sharing one material.
import * as THREE from './vendor/three/three.module.min.js';
import { mergeGeometries } from './vendor/three/addons/BufferGeometryUtils.js';

const SIZE = 0.9;            // overall size of a figure at scale 1
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// Shared source shapes (never drawn directly; bake() copies them).
const SRC = {};
const src = (key, make) => SRC[key] || (SRC[key] = make());
const cap = (r, len) => src(`c${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));
const ball = (r, ws = 10, hs = 7, phiL = Math.PI * 2, th0 = 0, thL = Math.PI) => src(`s${r}|${ws}|${hs}|${phiL}|${th0}|${thL}`, () => new THREE.SphereGeometry(r, ws, hs, 0, phiL, th0, thL));
const tube = (rt, rb, h, seg = 10, open = false) => src(`t${rt}|${rb}|${h}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
const box = (x, y, z) => src(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
/** A placed part: [shape, colour, x, y, z, { s: [sx, sy, sz], r: [rx, ry, rz] }] */
function bake(parts, withColour = true) {
  const list = parts.map(([g, colour, x = 0, y = 0, z = 0, o = {}]) => {
    const c = g.clone();
    const s = o.s || [1, 1, 1], r = o.r || [0, 0, 0];
    c.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2])));
    c.deleteAttribute('uv');
    if (withColour) {
      _c.set(colour);
      const n = c.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
      c.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    return c;
  });
  const merged = mergeGeometries(list);
  list.forEach((g) => g.dispose());
  return merged;
}
const shade = (hex, k) => { _c.set(hex).multiplyScalar(k); return _c.getHex(); };

export function makeFigures({ glowMat, shadowMat }) {
  function hairParts(style, o) {
    const { hair, trim } = o, R = 0.095, hy = 0.085, P = [];
    if (style === 'hat') {
      const felt = 0x16141c;
      P.push([tube(0.17, 0.175, 0.016, 14), felt, 0, hy + 0.062, 0], [tube(0.082, 0.094, 0.11, 12), felt, 0, hy + 0.122, 0], [tube(0.096, 0.096, 0.026, 12), trim, 0, hy + 0.08, 0]);
      P.push([ball(R * 1.02, 10, 6, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.3), hair, -0.008, hy, 0]);   // hair showing under the brim
    } else if (style === 'curls') {
      for (const [x, y, z, r] of [[-0.02, 0.1, 0, 0.07], [-0.07, 0.04, 0.06, 0.06], [-0.07, 0.04, -0.06, 0.06], [0.03, 0.09, 0.06, 0.05], [0.03, 0.09, -0.06, 0.05], [-0.1, -0.02, 0, 0.062], [-0.05, -0.04, 0.085, 0.05], [-0.05, -0.04, -0.085, 0.05], [0.0, 0.03, 0.095, 0.042], [0.0, 0.03, -0.095, 0.042], [-0.09, -0.08, 0.05, 0.045], [-0.09, -0.08, -0.05, 0.045]])
        P.push([ball(1, 7, 5), hair, x, hy + y, z, { s: [r, r, r] }]);
    } else if (style === 'wrap') {
      P.push([ball(R * 1.07, 12, 7, Math.PI * 2, 0, Math.PI * 0.52), trim, -0.006, hy + 0.004, 0, { r: [0, 0, 0.3] }], [ball(0.034, 7, 5), trim, -0.1, hy + 0.03, 0.03], [box(0.02, 0.1, 0.045), trim, -0.115, hy - 0.03, 0.03, { r: [0, 0, -0.3] }]);
    } else if (style === 'locs') {
      P.push([ball(R * 1.06, 12, 7, Math.PI * 2, 0, Math.PI * 0.55), hair, -0.006, hy + 0.004, 0, { r: [0, 0, 0.32] }]);
      for (const [a, len] of [[2.2, 0.2], [2.55, 0.23], [2.9, 0.25], [Math.PI, 0.26], [-2.9, 0.25], [-2.55, 0.23], [-2.2, 0.2], [1.75, 0.15], [-1.75, 0.15]]) {
        const x = Math.cos(a) * 0.088, z = Math.sin(a) * 0.088;
        P.push([cap(0.017, len), hair, x * 1.12, hy - len / 2 + 0.02, z * 1.12, { r: [z * 1.2, 0, -x * 1.6 - 0.05] }]);
        if (o.beads) P.push([ball(0.021, 6, 4), trim, x * 1.3, hy - len + 0.02, z * 1.3]);
      }
    } else if (style === 'hood') {
      const cloth = 0x1c1c26;
      P.push([ball(R * 1.2, 12, 8, Math.PI * 2, 0, Math.PI * 0.68), cloth, -0.018, hy + 0.012, 0, { r: [0, 0, 0.5], s: [1.05, 1.06, 1] }], [tube(0.075, 0.125, 0.09, 10, true), cloth, -0.01, -0.035, 0]);
    } else if (style === 'helmet') {
      const steel = 0x3a4052;
      P.push([ball(R * 1.12, 12, 7, Math.PI * 2, 0, Math.PI * 0.5), steel, 0, hy + 0.012, 0], [tube(R * 1.3, R * 1.34, 0.014, 14), steel, 0, hy + 0.014, 0], [box(0.014, 0.075, 0.02), steel, R * 1.02, hy + 0.01, 0], [ball(0.02, 6, 4), trim, 0, hy + 0.12, 0]);
      P.push([ball(R * 1.03, 10, 6, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.3), hair, -0.012, hy, 0]);
    } else {
      P.push([ball(R * 1.05, 12, 7, Math.PI * 2, 0, Math.PI * 0.5), hair, -0.008, hy + 0.004, 0, { r: [0, 0, 0.36] }]);
    }
    return P;
  }

  /**
   * coat/low/trim/skin/hair: colours. hairStyle: hat, curls, wrap, locs, hood, helmet, short.
   * skirt: how far a coat hangs below the belt (0 = none). corset: a wide band of trim round the waist.
   * extra: { spine: [...parts], head: [...parts] } baked onto those joints (a sword, a satchel).
   */
  function figure(o) {
    const { coat, low, trim, skin, hair, hairStyle = 'short', sash, scale = 1, eyes = 0xf1ead9, skirt = 0, corset = false, headScale = 1, extra = {} } = o;
    const g = new THREE.Group(), inner = new THREE.Group();
    inner.scale.setScalar(scale * SIZE);
    g.add(inner);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: skirt ? THREE.DoubleSide : THREE.FrontSide });
    const bone = (parent, x, y, z, parts) => {
      const b = new THREE.Group();
      b.position.set(x, y, z);
      if (parts && parts.length) { const m = new THREE.Mesh(bake(parts), mat); m.castShadow = true; m.userData.own = true; b.add(m); }
      parent.add(b);
      return b;
    };
    const boot = shade(low, 0.55), sleeve = shade(coat, 0.9), belt = sash || shade(trim, 0.6);
    const HIP_Y = 0.565;
    const hips = bone(inner, 0, HIP_Y, 0, [
      [ball(0.105, 10, 6), low, 0, 0, 0, { s: [0.8, 0.72, 1.16] }],
      ...(skirt ? [[tube(0.098, 0.098 + skirt * 0.2, skirt, 12, true), coat, -0.005, 0.03 - skirt / 2, 0, { s: [0.86, 1, 1.2] }]] : [])
    ]);
    const leg = (z) => {
      const thigh = bone(hips, 0, -0.02, z, [[cap(0.057, 0.17), low, 0, -0.135, 0]]);
      const shin = bone(thigh, 0, -0.27, 0, [[cap(0.046, 0.17), low, 0, -0.125, 0], [tube(0.052, 0.048, 0.11, 8), boot, 0, -0.2, 0], [box(0.15, 0.056, 0.086), boot, 0.032, -0.262, 0]]);
      return { thigh, shin };
    };
    const legL = leg(-0.068), legR = leg(0.068);
    const spine = bone(hips, 0, 0.05, 0, [
      [tube(0.118, 0.094, 0.34, 10), coat, 0, 0.2, 0, { s: [0.72, 1, 1.18] }],
      [ball(0.118, 10, 6, Math.PI * 2, 0, Math.PI * 0.5), coat, 0, 0.37, 0, { s: [0.72, 0.5, 1.18] }],
      [tube(0.1, 0.098, corset ? 0.15 : 0.05, 10), corset ? trim : belt, 0, corset ? 0.11 : 0.045, 0, { s: [0.76, 1, 1.2] }],
      ...(corset ? [[tube(0.1, 0.1, 0.04, 10), belt, 0, 0.03, 0, { s: [0.78, 1, 1.22] }]] : [[box(0.012, 0.3, 0.05), trim, 0.078, 0.215, 0, { r: [0, 0, 0.055] }]]),
      [tube(0.036, 0.04, 0.07, 8), skin, 0, 0.42, 0],
      ...(extra.spine || [])
    ]);
    const arm = (z) => {
      const upper = bone(spine, 0, 0.355, z, [[ball(0.052, 8, 6), coat, 0, 0, 0], [cap(0.04, 0.15), sleeve, 0, -0.115, 0]]);
      const fore = bone(upper, 0, -0.23, 0, [[cap(0.034, 0.14), sleeve, 0, -0.1, 0], [ball(0.038, 8, 6), skin, 0.004, -0.215, 0, { s: [1, 1.15, 0.8] }]]);
      return { upper, fore };
    };
    const armL = arm(-0.158), armR = arm(0.158);
    const R = 0.095, hy = 0.085;
    const head = bone(spine, 0, 0.445, 0, [
      [ball(R, 14, 10), skin, 0, hy, 0, { s: [0.95, 1.08, 0.9] }],
      [ball(0.019, 6, 4), shade(skin, 0.92), 0.09, hy - 0.012, 0],
      [ball(0.02, 6, 4), skin, 0, hy - 0.005, 0.086], [ball(0.02, 6, 4), skin, 0, hy - 0.005, -0.086],
      ...hairParts(hairStyle, o), ...(extra.head || [])
    ]);
    head.scale.setScalar(headScale);
    const eyeMesh = new THREE.Mesh(bake([[ball(0.014, 6, 4), 0, 0.084, hy + 0.012, 0.034], [ball(0.014, 6, 4), 0, 0.084, hy + 0.012, -0.034]], false), glowMat(eyes));
    eyeMesh.userData.own = true;
    head.add(eyeMesh);
    // A soft shadow at the feet (stretched away from the nearest lantern by render3d).
    const sh = new THREE.Mesh(src('blob', () => new THREE.PlaneGeometry(0.95, 0.95)), shadowMat);
    sh.position.y = 0.014; sh.rotation.order = 'YXZ'; sh.rotation.x = -Math.PI / 2; sh.renderOrder = 2;
    g.add(sh);
    g.userData = { inner, hips, spine, head, legL, legR, armL, armR, mat, shadow: sh, HIP_Y, seed: Math.random() * 100, ph: 0, speed: 0, yaw: null, fall: 0, turn: 0, crouch: 0, lookYaw: 0, sit: 0 };
    return g;
  }

  /** Frees what a figure made for itself (the shared source shapes stay). */
  function dispose(g) {
    g.traverse((o) => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
    if (g.userData.mat) g.userData.mat.dispose();
  }

  /**
   * Move a figure to where its game object is and animate it.
   * a: { x, y (map pixels), dir, dt, t, S (units per pixel), lying, seated, z (hop height), roll (0..1 through a
   *      tumble, or -1), crouch (0..1), look: { x, y } to turn the head to, talk, windup (0..1), throwing (0..1), alert }
   */
  function pose(g, a) {
    const u = g.userData, dt = a.dt, S = a.S, t = a.t + u.seed;
    const first = u.yaw === null;
    if (first) { u.lx = a.x; u.ly = a.y; u.yaw = a.dir; }
    const moved = Math.hypot(a.x - u.lx, a.y - u.ly) * S;
    u.lx = a.x; u.ly = a.y;
    const ease = (r) => 1 - Math.exp(-r * dt);
    const raw = dt > 0 && moved < 2 ? moved / dt : 0;         // a teleport (new district) isn't a sprint
    u.speed += (raw - u.speed) * ease(10);
    const sp = u.speed;
    const w = clamp(sp / 0.9), w2 = w * w * (3 - 2 * w);        // how much of the walk is blended in
    const run = clamp((sp - 4.4) / 1.3);
    if (moved < 2) u.ph += moved / (0.34 + Math.min(0.78, sp * 0.16)) * Math.PI;
    // Facing: turn smoothly, and lean into fast turns.
    const dYaw = angDiff(u.yaw, a.dir);
    const stepYaw = dYaw * ease(16);
    u.yaw += stepYaw;
    u.turn += ((dt > 0 ? stepYaw / dt : 0) - u.turn) * ease(8);
    g.position.set(a.x * S, a.z || 0, a.y * S);
    g.rotation.y = -u.yaw;

    const s = Math.sin(u.ph), c = Math.cos(u.ph);
    const idle = 1 - w2;
    u.fall += ((a.lying ? 1 : 0) - u.fall) * ease(a.lying ? 7 : 4);
    u.sit += ((a.seated ? 1 : 0) - u.sit) * ease(6);
    u.crouch += ((a.crouch || 0) - u.crouch) * ease(9);
    const air = a.z > 0 ? 1 : 0, sit = u.sit, cr = u.crouch;
    const rolling = a.roll >= 0 && a.roll < 1;
    const tuck = rolling ? Math.sin(Math.PI * clamp(a.roll * 1.15)) : 0;

    // Legs
    const A = (0.5 + 0.32 * run) * w2;
    const bend = (k) => (0.1 + (0.75 + 0.55 * run) * Math.pow(Math.max(0, k), 1.4)) * w2;
    const legPose = (L, sw, k) => {
      let th = sw * A + 0.12 * run * w2, kn = bend(k);
      th = th * (1 - sit) + 1.5 * sit; kn = kn * (1 - sit) + 1.5 * sit;
      th += cr * 0.75 + air * (sw > 0 ? 0.7 : 0.15) + tuck * 1.5; kn += cr * 1.3 + air * 0.9 + tuck * 1.9;
      L.thigh.rotation.z = th; L.shin.rotation.z = -kn;
      L.thigh.rotation.x = u.fall * 0.25 * (L === u.legL ? 1 : -1);
    };
    legPose(u.legL, s, c); legPose(u.legR, -s, -c);
    // Hips: bob with each step, sink when crouched or sitting, sway a little at rest.
    const sway = Math.sin(t * 0.47) * idle;
    u.hips.position.y = u.HIP_Y - (0.03 + 0.03 * run) * w2 * Math.abs(s) - cr * 0.16 - sit * 0.2 - tuck * 0.12;
    u.hips.rotation.y = s * 0.09 * w2;
    u.hips.rotation.x = sway * 0.035;
    u.hips.position.z = sway * 0.012;
    // Spine: lean into a run, breathe at rest.
    const breath = Math.sin(t * 1.7);
    u.spine.rotation.z = -(0.035 * w2 + 0.2 * run + cr * 0.32 + tuck * 0.9) + 0.012 * breath * idle + sit * 0.06;
    u.spine.rotation.y = -s * 0.11 * w2;
    u.spine.rotation.x = -sway * 0.035 + clamp(u.turn * 0.02, -0.16, 0.16) * w2;
    u.spine.scale.y = 1 + 0.012 * breath * idle;
    // Arms: swing against the legs; hang loose at rest.
    const armPose = (R, sw, side) => {
      let sh = -sw * (0.42 + 0.45 * run) * w2 + Math.sin(t * 0.9 + side) * 0.03 * idle, el = 0.14 + (0.2 + 0.95 * run) * w2;
      sh = sh * (1 - sit) + 0.5 * sit; el = el * (1 - sit) + 0.9 * sit;
      sh += air * (1.0 + side * 0.3) + tuck * 1.3 + cr * 0.3; el += air * 0.4 + tuck * 1.4 + cr * 0.5;
      R.upper.rotation.z = sh; R.fore.rotation.z = el;
      R.upper.rotation.x = side * (0.07 + 0.07 * run * w2 + air * 0.5 + u.fall * 0.9);
    };
    armPose(u.armL, s, 1); armPose(u.armR, -s, -1);
    if (a.windup > 0) { u.armR.upper.rotation.z = 0.4 + 2.2 * a.windup; u.armR.fore.rotation.z = 0.9; }
    if (a.throwing > 0) { const k = Math.sin(Math.PI * a.throwing); u.armR.upper.rotation.z = 0.3 + 1.4 * k; u.armR.fore.rotation.z = 0.2 + 0.9 * (1 - k); u.spine.rotation.y += 0.35 * k; }
    if (a.talk) { const k = 0.5 + 0.5 * Math.sin(t * 2.3); u.armR.upper.rotation.z = 0.25 + 0.35 * k; u.armR.fore.rotation.z = 1.0 + 0.5 * Math.sin(t * 3.1); }
    // Head: look at whoever's near, otherwise glance about.
    let want = Math.sin(t * 0.31) * 0.32 * idle + (a.scan ? Math.sin(t * 0.8) * 0.3 : 0);
    if (a.look) want = clamp(angDiff(u.yaw, Math.atan2(a.look.y - a.y, a.look.x - a.x)), -1.15, 1.15);
    u.lookYaw += (want - u.lookYaw) * ease(5);
    u.head.rotation.y = -u.lookYaw - u.spine.rotation.y;
    u.head.rotation.z = (0.03 * w2 + 0.17 * run + cr * 0.25) + Math.sin(t * 0.23) * 0.03 * idle - u.fall * 0.2;
    // Whole body: knocked flat, or tumbling through a roll.
    if (rolling) {
      const phi = -a.roll * Math.PI * 2, hc = 0.3;
      u.inner.rotation.z = phi;
      u.inner.position.set(hc * Math.sin(phi), hc - hc * Math.cos(phi), 0);
    } else {
      u.inner.rotation.z = u.fall * Math.PI / 2;
      u.inner.position.set(0, u.fall * 0.09, 0);
    }
    u.inner.rotation.x = -clamp(u.turn * 0.022, -0.2, 0.2) * run;
    if (u.tail) u.tail.forEach((seg, i) => { seg.rotation.y = Math.sin(t * 2.2 - i * 0.9) * (0.22 + 0.2 * w2) + clamp(u.turn * 0.05, -0.5, 0.5); seg.rotation.z = (i ? 0.25 : 0.2) + Math.sin(t * 1.3 - i) * 0.08 - run * 0.2; });
  }

  // ---------- The cast (colours and details follow the model sheet; see README) ----------
  function zay(town) {
    const sword = [
      [box(0.026, 0.62, 0.03), 0x23151a, -0.1, 0.2, 0, { r: [0.82, 0, 0.12] }],                   // lacquered scabbard across his back
      [box(0.05, 0.022, 0.06), 0xe9b65a, -0.1, 0.2 + 0.31 * Math.cos(0.82), 0.31 * Math.sin(0.82), { r: [0.82, 0, 0.12] }],   // gold guard
      [box(0.024, 0.17, 0.028), 0xc9c9d6, -0.1, 0.2 + 0.4 * Math.cos(0.82), 0.4 * Math.sin(0.82), { r: [0.82, 0, 0.12] }],    // wrapped grip
      [box(0.014, 0.4, 0.034), 0x4a3523, 0.082, 0.21, 0, { r: [0.72, 0, 0.05] }]                    // the strap across his chest
    ];
    const g = figure(town
      ? { coat: 0x2c2f36, low: 0x1c1d22, trim: 0xb39a72, skin: 0x5a3b2b, hair: 0x1a110c, hairStyle: 'locs', eyes: 0xf3c25c, skirt: 0.3, extra: { spine: sword } }
      : { coat: 0x121218, low: 0x0b0b10, trim: 0x2a2a38, skin: 0x5a3b2b, hair: 0x1a110c, hairStyle: 'hood', eyes: 0xf3c25c, sash: 0x1c1c26, extra: { spine: sword } });
    const u = g.userData;
    // His tail: three joints so it whips behind him.
    const seg = (parent, x, y, r, len) => {
      const b = new THREE.Group(); b.position.set(x, y, 0);
      const m = new THREE.Mesh(bake([[cap(r, len), 0x2a1a14, -len / 2 - r * 0.5, 0, 0, { r: [0, 0, Math.PI / 2] }]]), u.mat);
      m.castShadow = true; m.userData.own = true; b.add(m); parent.add(b); return b;
    };
    const t1 = seg(u.hips, -0.07, -0.02, 0.03, 0.13), t2 = seg(t1, -0.17, 0, 0.026, 0.13), t3 = seg(t2, -0.17, 0, 0.02, 0.12);
    u.tail = [t1, t2, t3];
    // The ledger, tucked under his arm when he's carrying it.
    const ledger = new THREE.Mesh(bake([[box(0.05, 0.2, 0.16), 0x7a1f22, 0, 0, 0], [box(0.054, 0.18, 0.012), 0xe9b65a, 0, 0, 0.06]]), u.mat);
    ledger.position.set(0.02, 0.16, 0.17); ledger.userData.own = true; ledger.castShadow = true;
    u.spine.add(ledger);
    u.ledger = ledger; u.town = town;
    return g;
  }
  function npc(L, who) {
    const fine = who === 'mark' || who === 'hustle' || who === 'collector';
    return figure({ coat: L.coat, low: L.low, trim: L.trim, skin: L.skin, hair: L.hair, hairStyle: L.hairStyle, sash: L.sash,
      eyes: who === 'severin' ? 0xdfe3ee : who === 'noe' ? 0xc99a52 : 0xf1ead9,
      corset: who === 'noe', beads: who === 'severin', skirt: who === 'severin' ? 0.3 : fine ? 0.26 : 0 });
  }
  function guard(def, watch) {
    const f = figure({ coat: def.coat, low: watch ? 0x21140f : 0x141a2c, trim: def.trim, skin: 0x5a3b2b, hair: 0x1b2238, hairStyle: 'helmet', scale: 1.08, skirt: 0.16,
      extra: { spine: [[box(0.02, 0.5, 0.03), 0x2a2f3e, -0.02, 0.1, -0.13, { r: [0, 0, -0.25] }]] } });   // a cudgel at the belt
    const lamp = new THREE.Mesh(bake([[ball(0.045, 8, 6), 0, 0.02, -0.3, 0], [tube(0.012, 0.012, 0.06, 5), 0, 0.02, -0.25, 0]], false), glowMat(0xffd88a));
    lamp.userData.own = true;
    f.userData.armL.fore.add(lamp);
    return f;
  }
  const kid = () => figure({ coat: 0x4a4236, low: 0x24201a, trim: 0x8a7a5a, skin: 0x5a3424, hair: 0x160d09, hairStyle: 'short', scale: 0.68, headScale: 1.22 });
  function fence() {
    const f = figure({ coat: 0x3a3428, low: 0x1c1912, trim: 0xc9a25a, skin: 0x6a4430, hair: 0x1a120d, hairStyle: 'hat', skirt: 0.28 });
    const lamp = new THREE.Mesh(bake([[ball(0.05, 8, 6), 0, 0.02, -0.3, 0]], false), glowMat(0xffc670));
    lamp.userData.own = true;
    f.userData.armR.fore.add(lamp);
    return f;
  }
  return { figure, pose, dispose, zay, npc, guard, kid, fence };
}
