// Night-time look for the 3D view: generated textures (cobbles, glow, soft shadow, mist) and the shader tweak
// that lets painted "tint" maps darken the street where it meets walls. Everything is drawn into small canvases
// at start-up, so there are no new image files to download. Used by render3d.js only; it never touches game rules.
import * as THREE from './vendor/three/three.module.min.js';

export function seeded(seed) {   // small repeatable random numbers: the same street looks the same every visit
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/**
 * Seamless cobblestones: colour map and normal map from one height drawing. `period` is how many map tiles one
 * texture covers, `n` is stones per side. Returns { albedo, normal } canvas textures.
 */
export function makeCobbles({ size = 1024, n = 22, seed = 7, maxAniso = 4 } = {}) {
  const rnd = seeded(seed);
  const col = canvas(size, size), hgt = canvas(size, size);
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  c.fillStyle = '#25232e'; c.fillRect(0, 0, size, size);   // grout (kept close to the stones' colour so they read as one surface)
  h.fillStyle = '#000'; h.fillRect(0, 0, size, size);
  const cell = size / n;
  const PALETTE = [[80, 80, 86], [74, 74, 80], [86, 82, 84], [84, 78, 74], [78, 74, 68], [70, 76, 74], [92, 88, 80], [66, 66, 72]];
  const stones = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = (i + 0.5 + (rnd() - 0.5) * 0.34) * cell, cy = (j + 0.5 + (rnd() - 0.5) * 0.34) * cell;
    const rx = cell * (0.39 + rnd() * 0.07), ry = cell * (0.37 + rnd() * 0.07), rot = (rnd() - 0.5) * 0.9;
    const pts = [];
    const K = 14, ph = rnd() * 6.28, wob = 0.05 + rnd() * 0.05;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      const r = 1 + wob * Math.sin(a * 3 + ph) + wob * 0.6 * Math.sin(a * 5 + ph * 2);
      // squarish: push the radius out at the diagonals
      const sq = 1 + 0.16 * Math.abs(Math.sin(2 * a));
      pts.push([Math.cos(a) * rx * r * sq, Math.sin(a) * ry * r * sq]);
    }
    const base = PALETTE[Math.floor(rnd() * PALETTE.length)], lum = 0.88 + rnd() * 0.32;
    stones.push({ cx, cy, rot, pts, rgb: base.map((v) => Math.min(255, v * lum)), rx, ry, seed: rnd() });
  }
  const path = (ctx, s, ox, oy, k = 1) => {
    ctx.beginPath();
    s.pts.forEach(([px, py], i) => {
      const x = s.cx + ox + (px * Math.cos(s.rot) - py * Math.sin(s.rot)) * k, y = s.cy + oy + (px * Math.sin(s.rot) + py * Math.cos(s.rot)) * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  for (const s of stones) {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (s.cx + ox < -cell || s.cx + ox > size + cell || s.cy + oy < -cell || s.cy + oy > size + cell) continue;
      const gx = s.cx + ox, gy = s.cy + oy;
      // colour: a stone with a lit top-left and a darker rim
      const g = c.createRadialGradient(gx - s.rx * 0.25, gy - s.ry * 0.3, 2, gx, gy, Math.max(s.rx, s.ry) * 1.15);
      const [r, gg, b] = s.rgb;
      g.addColorStop(0, `rgb(${r * 1.12 | 0},${gg * 1.12 | 0},${b * 1.12 | 0})`);
      g.addColorStop(0.65, `rgb(${r | 0},${gg | 0},${b | 0})`);
      g.addColorStop(1, `rgb(${r * 0.8 | 0},${gg * 0.8 | 0},${b * 0.82 | 0})`);
      c.fillStyle = g; path(c, s, ox, oy); c.fill();
      // height: a low dome with a steep, rounded edge
      const hg = h.createRadialGradient(gx, gy, 0, gx, gy, Math.max(s.rx, s.ry) * 1.1);
      hg.addColorStop(0, '#fff'); hg.addColorStop(0.55, '#e2e2e2'); hg.addColorStop(0.9, '#b4b4b4'); hg.addColorStop(1, '#8a8a8a');
      h.fillStyle = hg; path(h, s, ox, oy); h.fill();
      // grit and a few chips
      if (ox === 0 && oy === 0) {
        c.save(); path(c, s, 0, 0, 0.96); c.clip();
        for (let q = 0; q < 26; q++) { c.fillStyle = q % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.12)'; c.fillRect(gx + (rnd() - 0.5) * s.rx * 1.8, gy + (rnd() - 0.5) * s.ry * 1.8, 1 + rnd() * 3, 1 + rnd() * 3); }
        if (s.seed > 0.82) { c.fillStyle = 'rgba(70,96,70,.30)'; c.beginPath(); c.ellipse(gx + s.rx * 0.2, gy + s.ry * 0.5, s.rx * 0.5, s.ry * 0.22, 0.3, 0, 7); c.fill(); }   // moss
        c.restore();
      }
    }
  }
  // Normal map from the height drawing (central differences, wrapping at the edges so it tiles).
  const hd = h.getImageData(0, 0, size, size).data;
  const nrm = canvas(size, size), nc = nrm.getContext('2d'), out = nc.createImageData(size, size), o = out.data;
  const at = (x, y) => hd[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const strength = 1.7;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;   // image y points down, texture v points up
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    o[i] = (dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  nc.putImageData(out, 0, 0);
  const albedo = new THREE.CanvasTexture(col), normal = new THREE.CanvasTexture(nrm);
  albedo.colorSpace = THREE.SRGBColorSpace;
  for (const t of [albedo, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  return { albedo, normal };
}

/**
 * A low-resolution colour map over the whole district (8 px per tile). On street tiles it varies the stone a little
 * (damp, dirty, worn) and it darkens ground along walls and under furniture, so buildings sit on the street instead
 * of floating on it. It is multiplied onto the ground in the shader (see withTint).
 */
export function makeTint({ grid, W, H, props, TILE, seed = 11 }) {
  const P = 8, c = canvas(W * P, H * P), x = c.getContext('2d');
  const rnd = seeded(seed);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W * P, H * P);
  const solid = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && grid[ty][tx] === '#';
  // Worn and damp patches: soft blobs across the whole map.
  for (let k = 0; k < W * H * 0.18; k++) {
    const px = rnd() * W * P, py = rnd() * H * P, r = (6 + rnd() * 22);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const dark = rnd() < 0.55;
    g.addColorStop(0, dark ? 'rgba(70,80,120,.30)' : 'rgba(255,235,200,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // Ambient occlusion: a dark band on open ground wherever a wall meets it.
  const band = 0.55 * P, dark = 'rgba(8,8,22,.62)', none = 'rgba(8,8,22,0)';
  const strip = (x0, y0, x1, y1, w, h, vertical, flip) => {
    const g = vertical ? x.createLinearGradient(x0, 0, x1, 0) : x.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, flip ? none : dark); g.addColorStop(1, flip ? dark : none);
    x.fillStyle = g; x.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
  };
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (grid[ty][tx] === '#') continue;
    const px = tx * P, py = ty * P;
    if (solid(tx - 1, ty)) strip(px, 0, px + band, 0, band, P, true, false);
    if (solid(tx + 1, ty)) strip(px + P - band, 0, px + P, 0, band, P, true, true);
    if (solid(tx, ty - 1)) strip(0, py, 0, py + band, P, band, false, false);
    if (solid(tx, ty + 1)) strip(0, py + P - band, 0, py + P, P, band, false, true);
    // inside corners
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (solid(tx + dx, ty + dy) && !solid(tx + dx, ty) && !solid(tx, ty + dy)) {
        const cx = px + (dx < 0 ? 0 : P), cy = py + (dy < 0 ? 0 : P);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, band * 1.2);
        g.addColorStop(0, dark); g.addColorStop(1, none);
        x.fillStyle = g; x.fillRect(px, py, P, P);
      }
    }
  }
  // Furniture and stalls: a soft contact shadow just outside their footprint.
  for (const pr of props) {
    const x0 = pr.x / TILE * P, y0 = pr.y / TILE * P, w = pr.w / TILE * P, h = pr.h / TILE * P, m = 0.35 * P;
    const g = x.createRadialGradient(x0 + w / 2, y0 + h / 2, Math.min(w, h) * 0.2, x0 + w / 2, y0 + h / 2, Math.max(w, h) / 2 + m);
    g.addColorStop(0, 'rgba(8,8,22,.7)'); g.addColorStop(0.7, 'rgba(8,8,22,.4)'); g.addColorStop(1, none);
    x.fillStyle = g; x.fillRect(x0 - m, y0 - m, w + 2 * m, h + 2 * m);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

/** Multiplies a material's colour by a tint map read through a second set of UVs (attribute `tintUv`). */
export function withTint(mat, tintTex) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tintMap = { value: tintTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 tintUv;\nvarying vec2 vTintUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTintUv = tintUv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tintMap;\nvarying vec2 vTintUv;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(tintMap, vTintUv).rgb;');
  };
  mat.customProgramCacheKey = () => 'tint';
  return mat;
}

/** Soft round glow (white in the middle, clear at the edge); colour it with the material. */
export function makeGlow({ size = 128, hard = 2.2 } = {}) {
  const c = canvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i <= 8; i++) { const t = i / 8; g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, hard).toFixed(3)})`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** A lit window pane: warm glass, a darker frame with a cross, and a brighter centre. */
export function makeWindow() {
  const w = 64, h = 96, c = canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffcf80'); g.addColorStop(1, '#ff9a3c');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = x.createRadialGradient(w / 2, h * 0.55, 2, w / 2, h * 0.55, h * 0.6);
  r.addColorStop(0, 'rgba(255,245,200,.7)'); r.addColorStop(1, 'rgba(255,245,200,0)');
  x.fillStyle = r; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(40,18,6,.85)';
  x.fillRect(0, 0, w, 6); x.fillRect(0, h - 6, w, 6); x.fillRect(0, 0, 6, h); x.fillRect(w - 6, 0, 6, h);   // frame
  x.fillRect(w / 2 - 2, 0, 4, h); x.fillRect(0, h * 0.45, w, 4);                                             // cross bars
  x.fillStyle = 'rgba(20,8,2,.22)'; x.fillRect(6, 6, w - 12, 10);                                              // shade under the lintel
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Soft, flat shadow: darkest in the middle. */
export function makeBlob() {
  const s = 64, c = canvas(s, s), x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.45, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

/** Soft, wispy cloud for the low mist. */
export function makeMist(seed = 3) {
  const rnd = seeded(seed), s = 128, c = canvas(s, s), x = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const px = s * (0.2 + rnd() * 0.6), py = s * (0.3 + rnd() * 0.4), r = s * (0.14 + rnd() * 0.2);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  // fade the border to nothing so the quad has no visible edge
  const m = x.createRadialGradient(s / 2, s / 2, s * 0.25, s / 2, s / 2, s / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = m; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
