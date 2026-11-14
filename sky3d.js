// The night sky and air for the 3D view: a sky dome (gradient, stars, moon, drifting cloud), a far skyline of
// rooftops round the district, and motes drifting in the lantern light. All drawn by small shaders and one
// generated texture, so there are no image files to download. Used by render3d.js only.
import * as THREE from './vendor/three/three.module.min.js';
import { seeded } from './light3d.js';

const NOISE = /* glsl */`
  float hash1(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(11.7, 5.3); a *= 0.5; } return s; }
`;

/** The sky dome. It is drawn at the far plane and turns with the camera, so it never needs to move. */
export function makeSky() {
  const uniforms = {
    uTime: { value: 0 }, uMoon: { value: new THREE.Vector3(-0.4, 0.8, -0.3).normalize() },
    uZenith: { value: new THREE.Color(0x05081a) }, uHorizon: { value: new THREE.Color(0x16224a) }, uGlow: { value: new THREE.Color(0x6a3d1e) },
    uCloud: { value: 0.6 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uCloud; uniform vec3 uMoon, uZenith, uHorizon, uGlow;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
        col += uGlow * pow(1.0 - h, 9.0) * 0.55;                         // the city's lanterns on the low haze
        float md = dot(d, uMoon);
        // cloud: a flat layer far overhead, drifting
        vec2 cuv = d.xz / (d.y + 0.22) * 1.25 + uTime * vec2(0.007, 0.0025);
        float n = fbm(cuv) * 0.75 + fbm(cuv * 2.7 - uTime * 0.004) * 0.25;
        float cloud = smoothstep(1.02 - uCloud, 1.25 - uCloud * 0.7, n * 1.6) * smoothstep(0.0, 0.16, d.y);
        // stars: one in a few hundred cells, each with its own slow twinkle
        vec3 sp = d * 150.0, ip = floor(sp);
        float r = hash1(ip);
        float star = step(0.9962, r) * smoothstep(0.45, 0.0, length(fract(sp) - 0.5));
        float r2 = fract(r * 913.0);
        star *= 0.55 + 0.45 * sin(uTime * (0.7 + r2 * 2.6) + r2 * 60.0);
        col += vec3(0.75, 0.84, 1.0) * star * 1.6 * smoothstep(0.03, 0.3, d.y) * (1.0 - cloud);
        // moon: a pale disc with soft maria, and a wide halo
        float disc = smoothstep(0.99935, 0.99955, md);
        vec3 mcol = vec3(1.25, 1.3, 1.45) * (0.82 + 0.3 * fbm(d.xy * 60.0 + d.zx * 31.0));
        col += vec3(0.5, 0.6, 0.9) * (pow(max(md, 0.0), 420.0) * 0.6 + pow(max(md, 0.0), 26.0) * 0.14) * (1.0 - cloud * 0.6);
        col = mix(col, mcol, disc * (1.0 - cloud * 0.85));
        vec3 ccol = mix(uZenith * 1.5 + vec3(0.012, 0.016, 0.03), vec3(0.3, 0.36, 0.52), pow(max(md, 0.0), 5.0) * 0.75 + 0.08);
        ccol += uGlow * 0.2 * pow(1.0 - h, 3.0);
        col = mix(col, ccol, cloud * 0.82);
        col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.25, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return { mesh: sky, uniforms };
}

/**
 * The city beyond the district: a ring of rooftops, towers and spires with a few lit windows, standing in the
 * haze. One generated texture wrapped round a wide, open cylinder.
 */
export function makeSkylineTexture(seed = 5) {
  const rnd = seeded(seed), w = 2048, h = 256, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const layer = (base, col, lit, towers) => {
    let px = 0;
    while (px < w) {
      const bw = 26 + rnd() * 60, bh = base * (0.45 + rnd() * 0.75), y = h - bh;
      x.fillStyle = col;
      x.fillRect(px, y, bw + 1, bh);
      const kind = rnd();
      if (kind < 0.55) { x.beginPath(); x.moveTo(px - 3, y); x.lineTo(px + bw / 2, y - bw * (0.35 + rnd() * 0.3)); x.lineTo(px + bw + 3, y); x.fill(); }             // gable
      else if (kind < 0.7 && towers) { const tw = 12 + rnd() * 10, th = 40 + rnd() * 70, tx = px + bw / 2 - tw / 2; x.fillRect(tx, y - th, tw, th); x.beginPath(); x.moveTo(tx - 3, y - th); x.lineTo(tx + tw / 2, y - th - tw * (1.6 + rnd())); x.lineTo(tx + tw + 3, y - th); x.fill(); }   // spire
      if (rnd() < 0.5) x.fillRect(px + bw * (0.2 + rnd() * 0.5), y - 12 - rnd() * 10, 5, 24);                                                                         // chimney
      for (let k = 0; k < bw * bh / 900 * lit; k++) {
        if (rnd() < 0.5) continue;
        x.fillStyle = `rgba(255,${150 + rnd() * 70 | 0},${50 + rnd() * 50 | 0},${0.55 + rnd() * 0.45})`;
        x.fillRect(px + 4 + rnd() * (bw - 10), y + 5 + rnd() * Math.max(4, bh - 22), 2.5, 4);
      }
      px += bw;
    }
  };
  layer(70, '#141c36', 0.5, true);     // far, hazier
  layer(46, '#0a0e1e', 1.2, false);    // near, darker
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3; t.anisotropy = 4;
  return t;
}
export function makeSkyline(tex, W, H) {
  const R = Math.hypot(W, H) / 2 + 14, height = R * 0.26;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, height, 56, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: true }));
  m.position.set(W / 2, height / 2 - 0.4, H / 2);
  m.renderOrder = -5;
  return m;
}

/** Motes drifting in the air (dust and the odd moth in the lantern light). They wrap round the camera, so a few hundred fill the whole city. */
export function makeMotes(count = 220) {
  const rnd = seeded(21), pos = new Float32Array(count * 3), seedA = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = rnd() * 18; pos[i * 3 + 1] = 0.25 + rnd() * 3.2; pos[i * 3 + 2] = rnd() * 18; seedA[i] = rnd(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1));
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: 30 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      uniform float uTime, uSize; uniform vec3 uCam; attribute float aSeed; varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.21 + aSeed * 40.0) * 0.7 + uTime * 0.05; p.z += cos(uTime * 0.17 + aSeed * 31.0) * 0.7; p.y += sin(uTime * 0.33 + aSeed * 17.0) * 0.25;
        p.xz = mod(p.xz - uCam.xz + 9.0, 18.0) - 9.0 + uCam.xz;        // wrap round the camera
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vA = (0.35 + 0.65 * sin(uTime * (0.6 + aSeed) + aSeed * 50.0)) * smoothstep(9.0, 5.0, d) * smoothstep(0.6, 1.6, d);
        gl_PointSize = uSize * (0.5 + aSeed) / max(d, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * vA * smoothstep(0.5, 0.0, r) * 0.9, 1.0); }`
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return { points: pts, uniforms };
}

// The night moves slowly from blue hour to the small hours and back. Each stop: sky colours, haze, moonlight.
const NIGHTS = [
  { zen: 0x0a1230, hor: 0x24386a, glow: 0x7a4420, fog: 0x101a34, moon: 0x9ab0e8, k: 1.25, amb: 1.0, az: -0.9, el: 0.62 },   // blue hour
  { zen: 0x04061a, hor: 0x141f44, glow: 0x6a3a1c, fog: 0x0b1122, moon: 0x86a0e0, k: 1.45, amb: 0.9, az: 0.2, el: 1.0 },     // midnight
  { zen: 0x070418, hor: 0x1c1a40, glow: 0x5a3320, fog: 0x0e0f24, moon: 0x9a98e0, k: 1.15, amb: 0.95, az: 1.2, el: 0.68 }    // small hours
].map((n) => ({ ...n, zen: new THREE.Color(n.zen), hor: new THREE.Color(n.hor), glow: new THREE.Color(n.glow), fog: new THREE.Color(n.fog), moon: new THREE.Color(n.moon) }));
const NIGHT_LEN = 420;   // seconds from one stop to the next
const _a = new THREE.Color();
/** Where the night is at `clock` seconds: blended colours, the moon's direction (a unit vector) and strengths. */
export function nightAt(clock, out) {
  const span = NIGHTS.length - 1, u = (clock / NIGHT_LEN) % (span * 2), v = u > span ? span * 2 - u : u;
  const i = Math.min(span - 1, Math.floor(v)), f = v - i, e = f * f * (3 - 2 * f), A = NIGHTS[i], B = NIGHTS[i + 1];
  for (const key of ['zen', 'hor', 'glow', 'fog', 'moon']) out[key].copy(A[key]).lerp(_a.copy(B[key]), e);
  out.k = A.k + (B.k - A.k) * e; out.amb = A.amb + (B.amb - A.amb) * e;
  const az = A.az + (B.az - A.az) * e, el = A.el + (B.el - A.el) * e;
  out.dir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  return out;
}
export const newNight = () => ({ zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), fog: new THREE.Color(), moon: new THREE.Color(), dir: new THREE.Vector3(), k: 1, amb: 1 });
