// Guards, Noe, Severin and the townsfolk in the 3D view. Original procedural art: no outside models.
//
// Each person is ONE skinned mesh (one draw call) built from simple shapes and painted with vertex colours:
// a body with knees, elbows, hands, boots, a coat with a skirt, a face, and the hair or hat from the
// character's look in people.js / characters.js. Twelve bones move it; animate() poses them every frame
// (walk cycle with bending knees, breathing, looking at ZAY, sitting, falling when knocked out).
//
// A figure faces +x, stands on y = 0 and an adult is about 1.25 units tall, to match ZAY's model.
// Swinging a limb forward is a positive turn about z.

import * as THREE from './vendor/three/three.module.min.js';
import { mergeGeometries } from './vendor/three/addons/BufferGeometryUtils.js';

const BONES = {
  //          parent      x      y      z   (where the joint sits when standing, in figure space)
  hips:     [null,        0,   0.62,   0],
  spine:    ['hips',      0,   0.70,   0],
  head:     ['spine',     0,   1.02,   0],
  armL:     ['spine',     0,   0.965, -0.178],
  foreL:    ['armL',      0,   0.74,  -0.19],
  armR:     ['spine',     0,   0.965,  0.178],
  foreR:    ['armR',      0,   0.74,   0.19],
  thighL:   ['hips',      0,   0.60,  -0.085],
  shinL:    ['thighL',    0,   0.32,  -0.085],
  thighR:   ['hips',      0,   0.60,   0.085],
  shinR:    ['thighR',    0,   0.32,   0.085]
};
const NAMES = Object.keys(BONES);
const STEEL = 0x69718a, LEATHER = 0x2a1d14, BOOT = 0x17151a, WOOD = 0x3b2616;

export function makePeople() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd88a });
  const glowGeo = new THREE.SphereGeometry(0.034, 8, 6);
  const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

  /** look: { coat, low, trim, skin, hair, hairStyle, sash, eyes, scale, role: 'guard'|'watch'|'captain'|'kid'|'fence'|undefined, who } (colours as hex numbers) */
  function build(look) {
    const parts = [];
    // One shape, bound to one bone. p = centre, r = euler turn, s = stretch.
    const put = (geo, bone, color, p = [0, 0, 0], r = null, s = null) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      g.deleteAttribute('uv');
      _m.compose(new THREE.Vector3(...p), r ? _q.setFromEuler(_e.set(...r)) : _q.identity(), s ? new THREE.Vector3(...s) : new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(_m);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      _c.set(color);
      const b = NAMES.indexOf(bone);
      for (let i = 0; i < n; i++) { col.set([_c.r, _c.g, _c.b], i * 3); si[i * 4] = b; sw[i * 4] = 1; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      parts.push(g);
    };
    const sphere = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
    const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8);
    const cyl = (r0, r1, h, n = 10, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const lathe = (pts, n = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
    const dome = (r, frac = 0.5) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI * frac);

    const { coat, low, trim, skin, hair, role } = look;
    const guard = role === 'guard' || role === 'watch' || role === 'captain';
    const kid = role === 'kid';
    const long = look.who === 'noe' || look.who === 'severin';   // Noe's skirts, Severin's long coat
    const dark = (c, k = 0.6) => _c.set(c).multiplyScalar(k).getHex();

    // ---- Legs and boots ----
    for (const [S, z] of [['L', -0.085], ['R', 0.085]]) {
      put(capsule(0.064, 0.2), 'thigh' + S, low, [0, 0.46, z]);
      put(capsule(0.05, 0.14), 'shin' + S, low, [0, 0.22, z]);
      put(cyl(0.058, 0.052, 0.17), 'shin' + S, BOOT, [0, 0.105, z]);
      put(capsule(0.042, 0.1), 'shin' + S, BOOT, [0.05, 0.04, z], [0, 0, Math.PI / 2], [0.8, 1, 1.05]);
      if (guard) put(cyl(0.062, 0.06, 0.035), 'shin' + S, trim, [0, 0.19, z]);
    }
    put(sphere(0.13), 'hips', low, [0, 0.62, 0], null, [0.82, 0.7, 1.12]);

    // ---- Coat: chest, skirt, belt, front trim, collar ----
    put(lathe([[0.112, 0.6], [0.122, 0.7], [0.138, 0.84], [0.15, 0.93], [0.125, 0.99], [0.06, 1.02], [0, 1.025]]), 'spine', coat, [0, 0, 0], null, [0.8, 1, 1.14]);
    const hem = long ? 0.2 : guard ? 0.43 : 0.37;
    put(lathe([[0.116, 0.67], [0.14, 0.56], [long ? 0.2 : 0.165, hem]]), 'hips', coat, [0, 0, 0], null, [0.86, 1, 1.12]);
    put(lathe([[long ? 0.2 : 0.165, hem], [long ? 0.203 : 0.168, hem - 0.018]]), 'hips', look.who === 'noe' ? coat : trim, [0, 0, 0], null, [0.86, 1, 1.12]);
    put(cyl(0.128, 0.131, look.sash ? 0.075 : 0.045, 12), 'hips', look.sash || LEATHER, [0, 0.655, 0], null, [0.86, 1, 1.13]);
    if (look.sash) put(box(0.03, 0.17, 0.055), 'hips', look.sash, [0.03, 0.56, 0.135], [0.1, 0, 0]);
    else put(box(0.02, 0.04, 0.045), 'hips', trim, [0.108, 0.655, 0]);
    if (look.who === 'noe') put(box(0.03, 0.26, 0.15), 'spine', trim, [0.094, 0.79, 0]);     // her laced corset front
    else put(box(0.02, 0.3, 0.03), 'spine', trim, [0.108, 0.83, 0]);
    put(new THREE.TorusGeometry(0.066, 0.02, 5, 12), 'spine', trim, [0, 1.0, 0], [Math.PI / 2, 0, 0], [0.9, 1.1, 1]);
    if (look.who === 'severin') for (const z of [-0.05, 0.05]) put(box(0.015, 0.34, 0.012), 'spine', trim, [0.1, 0.81, z]);   // silver embroidery

    // ---- Arms and hands ----
    for (const [S, z] of [['L', -1], ['R', 1]]) {
      put(sphere(0.066), 'arm' + S, coat, [0, 0.965, z * 0.172]);
      put(capsule(0.049, 0.14), 'arm' + S, coat, [0, 0.855, z * 0.186]);
      put(capsule(0.043, 0.12), 'fore' + S, coat, [0, 0.645, z * 0.19]);
      put(cyl(0.049, 0.049, 0.035), 'fore' + S, trim, [0, 0.565, z * 0.19]);
      put(sphere(0.046, 8, 6), 'fore' + S, guard ? LEATHER : skin, [0, 0.515, z * 0.19], null, [1, 1.15, 0.8]);
      if (guard) put(dome(0.082), 'arm' + S, STEEL, [0, 0.965, z * 0.176], [z * -0.35, 0, 0]);   // pauldron
    }

    // ---- Head and face ----
    const hs = kid ? 1.14 : 1, HY = 1.02 + 0.125 * hs;   // head centre
    const head = (geo, color, p, r, s) => put(geo, 'head', color, [p[0] * hs + 0.012, 1.02 + (p[1] - 1.02) * hs, p[2] * hs], r, s ? s.map((v) => v * hs) : [hs, hs, hs]);
    put(cyl(0.045, 0.05, 0.09, 8), 'head', skin, [0, 1.04, 0]);
    head(sphere(0.105, 14, 10), skin, [0, 1.145, 0], null, [1, 1.1, 0.94]);
    head(sphere(0.08, 10, 8), skin, [0.018, 1.085, 0], null, [1, 0.9, 0.95]);          // jaw
    head(box(0.03, 0.036, 0.024), skin, [0.103, 1.125, 0], [0, 0, -0.25]);                // nose
    for (const z of [-1, 1]) {
      head(sphere(0.024, 6, 5), skin, [0, 1.135, z * 0.099], null, [0.6, 1, 0.5]);       // ears
      head(sphere(0.017, 8, 6), look.eyes ?? 0xf1ead9, [0.089, 1.152, z * 0.04], null, [0.6, 0.8, 1]);
      head(sphere(0.008, 6, 4), 0x120c08, [0.1, 1.152, z * 0.04]);
      head(box(0.014, 0.01, 0.042), dark(hair, 0.8), [0.094, 1.178, z * 0.04], [z * 0.12, 0, 0]);   // brows
    }
    head(box(0.012, 0.008, 0.042), dark(skin, 0.55), [0.099, 1.086, 0]);                 // mouth
    void HY;

    // ---- Hair, hats and helmets ----
    const style = look.hairStyle;
    const cap = (r, frac, tilt, color = hair) => head(dome(r, frac), color, [-0.006, 1.15, 0], [0, 0, tilt], [1, 1.1, 0.96]);
    if (role === 'guard' || role === 'captain') {
      cap(0.113, 0.62, 0.45);                                                            // hair at the neck
      head(dome(0.119, 0.5), STEEL, [0, 1.165, 0], null, [1.02, 1.05, 0.98]);            // steel cap
      head(cyl(0.155, 0.16, 0.014, 14), STEEL, [0.01, 1.166, 0], [0, 0, -0.08]);         // brim
      head(box(0.2, 0.03, 0.016), trim, [0, 1.285, 0]);                                  // crest
      if (role === 'captain') head(capsule(0.03, 0.12), 0xa8323a, [-0.05, 1.33, 0], [0, 0, 0.9]);   // red plume
    } else if (role === 'watch') {
      cap(0.113, 0.62, 0.45);
      head(cyl(0.2, 0.2, 0.016, 16), LEATHER, [0.005, 1.2, 0], [0, 0, -0.06]);           // the city watch wear a round felt hat
      head(cyl(0.1, 0.114, 0.09, 14), LEATHER, [0, 1.25, 0]);
      head(cyl(0.116, 0.116, 0.022, 14), trim, [0, 1.215, 0]);
    } else if (style === 'hat') {
      cap(0.113, 0.62, 0.45);
      head(cyl(0.215, 0.215, 0.016, 16), 0x16141c, [0.005, 1.2, 0], [0, 0, -0.07]);
      head(cyl(0.098, 0.114, 0.13, 14), 0x16141c, [0, 1.27, 0]);
      head(cyl(0.117, 0.117, 0.028, 14), trim, [0, 1.222, 0]);
    } else if (style === 'curls') {
      // A full head of curls: a ring round the crown, then a looser ring down to the neck.
      cap(0.115, 0.6, 0.35);
      for (let i = 0; i < 9; i++) { const a = Math.PI * (0.32 + 1.36 * i / 8); head(sphere(0.062, 7, 5), hair, [Math.cos(a) * 0.07 - 0.01, 1.215, Math.sin(a) * 0.092]); }
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.5 + i / 6); head(sphere(0.058, 7, 5), hair, [Math.cos(a) * 0.105 - 0.01, 1.13 - (i % 2) * 0.035, Math.sin(a) * 0.105]); }
      head(sphere(0.07, 7, 5), hair, [0.01, 1.268, 0]);
      for (const z of [-0.06, 0.06]) head(sphere(0.05, 7, 5), hair, [0.07, 1.238, z]);
    } else if (style === 'locs') {
      cap(0.115, 0.56, 0.3);
      for (let i = 0; i < 11; i++) {   // locs falling to the shoulders, round the back and sides
        const a = Math.PI * (0.42 + 1.16 * i / 10), len = 0.2 + (i % 3) * 0.035;
        head(capsule(0.017, len), hair, [Math.cos(a) * 0.108 - 0.012, 1.19 - len / 2 - 0.02, Math.sin(a) * 0.104], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12 + 0.05]);
      }
      head(sphere(0.022, 6, 4), trim, [-0.115, 1.12, 0]);                                // a silver ring in the locs
    } else if (style === 'wrap') {
      head(dome(0.118, 0.56), trim, [-0.004, 1.152, 0], [0, 0, 0.22], [1.02, 1.12, 0.98]);
      head(sphere(0.045, 7, 5), trim, [-0.07, 1.262, 0], null, [1.2, 0.8, 1]);           // the knot
      head(box(0.02, 0.02, 0.2), dark(trim, 0.75), [0.085, 1.2, 0]);
    } else {
      cap(0.114, 0.58, 0.32);
    }

    // ---- What they carry ----
    if (guard) {
      put(cyl(0.02, 0.028, 0.44, 7), 'foreR', WOOD, [0.13, 0.5, 0.19], [0, 0, -1.25]);    // baton, held low and forward
      put(cyl(0.031, 0.031, 0.03, 7), 'foreR', trim, [-0.065, 0.435, 0.19], [0, 0, -1.25]);
      put(box(0.065, 0.1, 0.065), 'foreL', 0x15121c, [0.02, 0.41, -0.19]);               // hand lantern
      put(new THREE.TorusGeometry(0.03, 0.006, 4, 8), 'foreL', 0x15121c, [0.02, 0.475, -0.19]);
      put(new THREE.TorusGeometry(0.146, 0.017, 4, 16), 'spine', trim, [0, 0.82, 0], [Math.PI / 2 + 0.8, 0, 0], [0.8, 1.2, 1]);   // cross-belt
      if (role === 'captain') put(lathe([[0.13, 1.0], [0.19, 0.72], [0.21, 0.45]], 10), 'spine', 0x7a1f2a, [-0.07, 0, 0], null, [0.6, 1, 0.8]);   // short cape
    }

    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());

    // ---- Skeleton ----
    const bones = {};
    for (const [name, [parent, x, y, z]] of Object.entries(BONES)) {
      const b = new THREE.Bone(); b.name = name;
      const pb = parent && BONES[parent];
      b.position.set(x - (pb ? pb[1] : 0), y - (pb ? pb[2] : 0), z - (pb ? pb[3] : 0));
      b.rotation.order = 'YXZ';
      if (parent) bones[parent].add(b);
      bones[name] = b;
    }
    const own = guard ? material.clone() : material;   // guards flush red on a wind-up, so each has their own
    const skinned = new THREE.SkinnedMesh(geometry, own);
    skinned.add(bones.hips);
    bones.hips.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(NAMES.map((n) => bones[n])));
    skinned.castShadow = true; skinned.receiveShadow = true;
    // The pose moves, so a fixed generous ball is used for "is it on screen" instead of the bind pose's.
    skinned.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 1.5);
    skinned.boundingBox = new THREE.Box3(new THREE.Vector3(-1.5, -0.2, -1.5), new THREE.Vector3(1.5, 1.6, 1.5));

    const inner = new THREE.Group();
    inner.rotation.order = 'YXZ';
    inner.scale.setScalar(look.scale || 1);
    inner.add(skinned);
    if (guard || role === 'fence') {   // the lit heart of the lantern (bloom picks it up on High)
      const g = new THREE.Mesh(glowGeo, glow);
      if (guard) { g.position.set(0.02, -0.33, 0); bones.foreL.add(g); } else { g.position.set(0.06, -0.26, 0); bones.foreR.add(g); }
    }
    const group = new THREE.Group();
    group.add(inner);
    group.userData = { people: true, inner, bones, skinned, mat: own, ownMat: own !== material, role, seed: Math.random() * 20, walk: 0, stride: 0, fall: 0, alertK: 0, lookYaw: 0, sit: 0 };
    return group;
  }

  /** Frees a figure made by build(). */
  function release(group) {
    const u = group.userData;
    u.skinned.geometry.dispose();
    u.skinned.skeleton.dispose();
    if (u.ownMat) u.mat.dispose();
  }

  const damp = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, dt));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /**
   * Poses a figure for this frame.
   * o: { dt, t, moved (map px this frame), speed (px/s), lying, seated, stunned, alert (0..1), lookYaw (radians, + = to the figure's right, or null),
   *      carry (true for a guard holding his lantern out), scan (true: an idle guard looks about) }
   */
  function animate(group, o) {
    const u = group.userData, B = u.bones, dt = o.dt, t = o.t + u.seed;
    const k = (rate) => damp(rate, dt);
    u.walk += Math.min(o.moved, 12) / 8.2;
    u.stride += (clamp(o.speed / 105, 0, 1.6) - u.stride) * k(12);
    u.fall += ((o.lying ? 1 : 0) - u.fall) * k(o.lying ? 9 : 5);
    u.sit += ((o.seated ? 1 : 0) - u.sit) * k(8);
    u.alertK += ((o.alert || 0) - u.alertK) * k(7);
    const s = u.stride * (1 - u.fall), ph = u.walk, sn = Math.sin(ph), cs = Math.cos(ph), al = u.alertK * (1 - u.fall);
    const amp = (0.36 + 0.2 * Math.min(1, s)) * Math.min(1, s * 1.6);

    // Legs: the thigh swings, the knee folds as the foot comes through and gives a little as it lands.
    B.thighL.rotation.set(0, 0, sn * amp + 0.05 * s);
    B.thighR.rotation.set(0, 0, -sn * amp + 0.05 * s);
    B.shinL.rotation.set(0, 0, -(0.06 + Math.max(0, cs) * 0.95 + Math.max(0, -cs) * 0.12) * Math.min(1, s * 1.6));
    B.shinR.rotation.set(0, 0, -(0.06 + Math.max(0, -cs) * 0.95 + Math.max(0, cs) * 0.12) * Math.min(1, s * 1.6));
    // Arms swing against the legs and hang a little away from the coat.
    const breathe = Math.sin(t * 1.7) * 0.5 + 0.5, sway = Math.sin(t * 0.55);
    B.armL.rotation.set(0.09 + breathe * 0.012, 0, -sn * amp * 0.8 + sway * 0.02);
    B.armR.rotation.set(-0.09 - breathe * 0.012, 0, sn * amp * 0.8 - sway * 0.02);
    B.foreL.rotation.set(0, 0, 0.12 + 0.3 * Math.min(1, s) + Math.max(0, -sn) * 0.3 * s);
    B.foreR.rotation.set(0, 0, 0.12 + 0.3 * Math.min(1, s) + Math.max(0, sn) * 0.3 * s);
    // Body: hips and shoulders turn against each other, a lean into the walk, breathing when still.
    B.hips.rotation.set(sway * 0.025 * (1 - Math.min(1, s)), -sn * 0.09 * s, 0);
    B.spine.rotation.set(-sway * 0.03 * (1 - Math.min(1, s)), sn * 0.2 * s, -0.05 * s - al * 0.12 + breathe * 0.012);
    B.spine.scale.set(1 + breathe * 0.012, 1, 1);
    u.inner.position.y = (Math.abs(cs) * 0.035 - 0.02) * Math.min(1, s * 1.6);

    // Head: follows whatever caught the eye, or an idle guard looks up and down the street.
    let yaw = 0, nod = Math.sin(t * 0.9) * 0.02;
    if (o.lookYaw != null) yaw = clamp(o.lookYaw, -1.15, 1.15);
    else if (o.scan && s < 0.2) yaw = Math.sin(t * 0.6) * 0.55;
    u.lookYaw += (yaw - u.lookYaw) * k(o.lookYaw != null ? 6 : 2.5);
    B.head.rotation.set(0, -sn * 0.12 * s - u.lookYaw, nod + al * 0.1);

    // A guard carries his lantern out in front; on alert the baton comes up.
    if (o.carry) {
      const lift = 0.5 + al * 0.35 + Math.sin(t * 1.3) * 0.02;
      B.armL.rotation.set(0.05, 0, lift + sn * 0.05 * s);
      B.foreL.rotation.set(0, 0, 0.95 - al * 0.2);
      B.armR.rotation.z += al * 0.9; B.foreR.rotation.z += al * 1.1;
    }
    if (o.stunned) {
      B.spine.rotation.x += Math.sin(t * 7) * 0.14; B.spine.rotation.z -= 0.22;
      B.head.rotation.set(Math.sin(t * 7 + 1) * 0.2, 0, -0.4);
      B.armL.rotation.set(0.25, 0, 0.1); B.armR.rotation.set(-0.25, 0, 0.1); B.foreL.rotation.z = B.foreR.rotation.z = 0.3;
    }
    // Sitting: thighs forward, shins down, hands on the knees.
    if (u.sit > 0.01) {
      const q = u.sit;
      for (const S of ['L', 'R']) {
        B['thigh' + S].rotation.z = 1.45 * q; B['shin' + S].rotation.z = -1.45 * q;
        B['arm' + S].rotation.z = 0.55 * q; B['fore' + S].rotation.z = 0.75 * q;
      }
      B.spine.rotation.z = 0.06 * q + breathe * 0.012;
      u.inner.position.y = -0.27 * q;
    }
    // Knocked out: topple backwards and lie sprawled.
    const f = u.fall;
    u.inner.rotation.z = f * Math.PI / 2 + (o.rock || 0);
    if (f > 0.01) {
      const e = f * f * (3 - 2 * f);
      u.inner.position.y = u.inner.position.y * (1 - e) + 0.11 * e;
      B.armL.rotation.set(1.1 * e, 0, 0.5 * e); B.armR.rotation.set(-0.8 * e, 0, -0.3 * e);
      B.foreL.rotation.z = 0.5 * e; B.foreR.rotation.z = 0.9 * e;
      B.thighL.rotation.set(0.22 * e, 0, 0.25 * e); B.thighR.rotation.set(-0.3 * e, 0, -0.05 * e);
      B.shinL.rotation.z = -0.5 * e; B.shinR.rotation.z = -0.1 * e;
      B.head.rotation.set(0.5 * e, 0.3 * e, 0);
    }
  }

  return { build, release, animate, material };
}
