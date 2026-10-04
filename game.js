'use strict';

// Bellemorne: Paper Thief — a top-down stealth level built from the Bellemorne canon.
// ZAY slips into House Veyrane's estate, steals the debt ledger, and escapes to the river.

const TILE = 32;
const W = 64;
const H = 44;

// ---------- Map ----------
// '#' building/wall, '.' street, 'g' garden, 'h' hedge (hide), 'f' floor, 'w' river
const grid = Array.from({ length: H }, () => Array(W).fill('#'));
function fill(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    if (i >= 0 && j >= 0 && i < W && j < H) grid[j][i] = c;
  }
}
fill(2, 34, 10, 8, '.');   // Soot Quarter alley (start)
fill(2, 28, 58, 4, '.');   // Lantern Quarter avenue
fill(12, 6, 3, 36, '.');   // Street A
fill(30, 4, 3, 28, '.');   // Street B
fill(12, 6, 40, 3, '.');   // Crown Quarter upper avenue
fill(18, 16, 8, 6, '.');   // Market plaza
fill(15, 18, 3, 2, '.');
fill(26, 18, 4, 2, '.');
fill(4, 22, 3, 6, '.');    // Soot dead-end
fill(39, 11, 19, 13, 'g'); // Veyrane garden
fill(44, 13, 10, 5, '#');  // Counting house
fill(45, 14, 8, 3, 'f');   // Counting house interior
grid[17][48] = 'f';        // House door
fill(47, 24, 2, 1, 'g');   // Estate gate
fill(46, 25, 4, 3, '.');   // Gate approach
fill(33, 16, 5, 2, '.');   // Side alley to the wall
fill(41, 19, 2, 2, 'h');   // Hedges
fill(54, 14, 2, 3, 'h');
fill(42, 13, 1, 3, 'h');
fill(50, 20, 3, 1, 'h');
fill(60, 0, 4, 44, 'w');   // River
fill(56, 32, 4, 3, '.');   // Dock

const tileAt = (px, py) => {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return '#';
  return grid[ty][tx];
};
const solidTile = (t) => t === '#' || t === 'w';
const isSolidAt = (tx, ty) => tx < 0 || ty < 0 || tx >= W || ty >= H || solidTile(grid[ty][tx]);
const centre = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

const LAMPS = [[6,35],[13,24],[8,28],[20,31],[27,28],[36,31],[44,28],[52,31],[13,12],[22,6],[31,14],[40,8],[48,25],[21,18],[58,33],[41,23],[55,11],[46,14]]
  .map(([x, y]) => ({ ...centre(x, y), r: grid[y][x] === 'f' ? 92 : 128 }));

// Visibility polygon for a light (like Godot's LightOccluder2D): cast rays until they hit a building.
// Rays go a few pixels into the wall so the façade facing the light still glows.
function lightPolygon(x, y, r, rays = 160) {
  const pts = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const cx = Math.cos(a), cy = Math.sin(a);
    let d = 0;
    for (; d < r; d += 4) {
      if (tileAt(x + cx * d, y + cy * d) === '#') { d += 10; break; }
    }
    d = Math.min(d, r);
    pts.push(x + cx * d, y + cy * d);
  }
  return pts;
}
LAMPS.forEach((l) => { l.poly = lightPolygon(l.x, l.y, l.r); });

const VAULTS = [{ wall: centre(38, 16), a: centre(37, 16), b: centre(39, 16) }];
const BOAT = { x: 60 * TILE + 16, y: 33 * TILE + 16 };
const KID = { ...centre(57, 34), helped: false };
const LEDGER_SPOT = centre(52, 15);

const GUARD_ROUTES = [
  [[16,29],[28,29],[28,30],[16,30]],
  [[31,9],[31,26]],
  [[18,7],[46,7]],
  [[46,23],[49,23]],
  [[40,12],[56,12],[56,22],[40,22]],
  [[38,30],[55,30]],
  [[46,15],[51,15]],
  [[19,17],[24,20],[19,20]]
];

// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const dark = document.createElement('canvas');
const dctx = dark.getContext('2d');
let vw = 0, vh = 0, dpr = 1, zoom = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth;
  vh = window.innerHeight;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';
  dark.width = canvas.width;
  dark.height = canvas.height;
  zoom = Math.max(0.7, Math.min(1.6, Math.min(vw / (22 * TILE), vh / (14 * TILE))));
}
window.addEventListener('resize', resize);
resize();

// Seeded random so the city looks the same every run.
let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- Pre-rendered map ----------
const mapCanvas = document.createElement('canvas');
mapCanvas.width = W * TILE;
mapCanvas.height = H * TILE;
const WINDOWS = [];
(function renderMap() {
  const m = mapCanvas.getContext('2d');
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = grid[ty][tx];
    const x = tx * TILE, y = ty * TILE;
    if (t === '.' || t === 'g' || t === 'h') {
      if (t === '.') {
        m.fillStyle = '#34323f';
        m.fillRect(x, y, TILE, TILE);
        for (let k = 0; k < 4; k++) {
          const sx = x + (k % 2) * 16 + (ty % 2) * 8, sy = y + Math.floor(k / 2) * 16;
          const shade = 54 + Math.floor(rand() * 16);
          m.fillStyle = `rgb(${shade},${shade - 2},${shade + 8})`;
          m.beginPath();
          m.roundRect(sx + 1.5, sy + 1.5, 13, 13, 4);
          m.fill();
          if (rand() < 0.18) { m.fillStyle = 'rgba(120,140,190,.10)'; m.fillRect(sx + 3, sy + 9, 9, 2); }
        }
      } else {
        m.fillStyle = '#1a2a1e';
        m.fillRect(x, y, TILE, TILE);
        for (let k = 0; k < 10; k++) {
          m.fillStyle = rand() < 0.5 ? '#21352a' : '#152319';
          m.fillRect(x + rand() * 30, y + rand() * 30, 2, 3);
        }
      }
    } else if (t === 'f') {
      m.fillStyle = '#3a2a20';
      m.fillRect(x, y, TILE, TILE);
      m.fillStyle = '#2e2119';
      for (let k = 0; k < 4; k++) m.fillRect(x, y + k * 8 + 7, TILE, 1);
    } else if (t === 'w') {
      m.fillStyle = '#0b1729';
      m.fillRect(x, y, TILE, TILE);
    } else {
      // Rooftops: slate with ridges, gold trim where they meet the street.
      const v = 11 + Math.floor(rand() * 5);
      m.fillStyle = `rgb(${v + 4},${v},${v + 12})`;
      m.fillRect(x, y, TILE, TILE);
      m.fillStyle = 'rgba(255,255,255,.025)';
      m.fillRect(x, y + (tx + ty) % 3 * 8, TILE, 2);
      const below = ty + 1 < H ? grid[ty + 1][tx] : '#';
      if (below !== '#' && below !== 'w') {
        // Façade facing the viewer: brick band, balcony rail, maybe a lit window.
        m.fillStyle = '#3a2c35';
        m.fillRect(x, y + TILE - 14, TILE, 14);
        m.fillStyle = '#8a6a33';
        m.fillRect(x, y + TILE - 15, TILE, 2);
        if (rand() < 0.55) WINDOWS.push({ x: x + 8 + rand() * 10, y: y + TILE - 11, w: 8, h: 8 });
        else { m.fillStyle = '#1d161c'; m.fillRect(x + 11, y + TILE - 12, 10, 12); }
      }
      for (const [dx, dy] of [[1,0],[-1,0],[0,-1]]) {
        const n = grid[ty + dy] && grid[ty + dy][tx + dx];
        if (n && n !== '#' && n !== 'w') {
          m.fillStyle = '#6d5326';
          if (dx === 1) m.fillRect(x + TILE - 2, y, 2, TILE);
          if (dx === -1) m.fillRect(x, y, 2, TILE);
          if (dy === -1) m.fillRect(x, y, TILE, 2);
        }
      }
    }
  }
  // Hedges drawn as round bushes on top of the garden.
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (grid[ty][tx] !== 'h') continue;
    const c = centre(tx, ty);
    m.fillStyle = '#244a2f';
    m.beginPath(); m.arc(c.x, c.y, 17, 0, Math.PI * 2); m.fill();
    m.fillStyle = '#2f5c3a';
    m.beginPath(); m.arc(c.x - 4, c.y - 5, 9, 0, Math.PI * 2); m.fill();
  }
  // Dock planks
  m.fillStyle = '#4a3523';
  for (let ty = 32; ty <= 34; ty++) for (let k = 0; k < 4; k++) m.fillRect(56 * TILE, ty * TILE + k * 8, 4 * TILE, 6);
})();

// ---------- State ----------
let state;
function newState() {
  return {
    running: false,
    paused: false,
    over: false,
    mode: 'field',
    party: makeParty(),
    items: { Potion: 2 },
    battles: 0,
    stolen: [],
    time: 0,
    player: {
      x: 4 * TILE + 16, y: 38 * TILE + 16, r: 10, dir: -Math.PI / 2,
      gold: 0, given: 0, cards: 5, invuln: 0, dashT: 0, dashCd: 0, slashCd: 0, slashT: 0,
      noiseT: 0, lit: false, hidden: false, moving: false, sprint: false, hasLedger: false, step: 0
    },
    guards: GUARD_ROUTES.map((route, i) => {
      const pts = route.map(([x, y]) => centre(x, y));
      return {
        kind: i === 4 || i === 6 ? 'captain' : 'guard',
        x: pts[0].x, y: pts[0].y, r: 11, dir: 0, route: pts, ri: 1 % pts.length,
        state: 'patrol', meter: 0, hp: 3, path: [], pathT: 0, pathGoal: null, target: null,
        lostT: 0, lookT: 0, attackCd: 0, windup: 0, stunT: 0, seenBodies: new Set(), speed: 52
      };
    }),
    coins: [[13,9],[31,5],[24,20],[5,23],[40,21],[56,21],[51,15],[35,17],[58,29],[10,40],[44,7]].map(([x, y]) => ({ ...centre(x, y), taken: false })),
    cardPickups: [[20,20],[31,24],[9,36]].map(([x, y]) => ({ ...centre(x, y), taken: false })),
    projectiles: [],
    effects: [],
    alarms: 0,
    kos: 0,
    ledgerTaken: false
  };
}
state = newState();

// ---------- Input ----------
const keys = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, wx: 0, wy: 0, has: false };
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
  if ((k === 'p' || (k === 'escape' && state.mode !== 'battle')) && state.running && !state.over) togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Input map (like Godot's InputMap): gamepad buttons feed the same actions as keys.
// Standard layout: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 9 Start, 12-15 d-pad.
const PAD_MAP = {
  field: { 0: 'e', 1: ' ', 2: 'q', 4: 'shift', 5: 'shift', 9: 'p', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' },
  battle: { 0: 'enter', 1: 'escape', 9: 'p', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' }
};
const padHeld = new Set();
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads || []).find((g) => g && g.connected);
  const now = new Set();
  if (pad) {
    const map = PAD_MAP[state.mode === 'battle' ? 'battle' : 'field'];
    pad.buttons.forEach((b, i) => { if (b.pressed && map[i]) now.add(map[i]); });
    const [ax = 0, ay = 0] = pad.axes;
    const dead = 0.45;
    if (ax < -dead) now.add('arrowleft');
    if (ax > dead) now.add('arrowright');
    if (ay < -dead) now.add('arrowup');
    if (ay > dead) now.add('arrowdown');
  }
  for (const k of now) if (!padHeld.has(k)) { pressed.add(k); keys.add(k); }
  for (const k of padHeld) if (!now.has(k)) keys.delete(k);
  padHeld.clear();
  now.forEach((k) => padHeld.add(k));
  if (pressed.has('p') && now.has('p') && state.running && !state.over) togglePause();
}
window.addEventListener('gamepadconnected', () => toast('Controller connected', 1500));
window.addEventListener('blur', () => { keys.clear(); if (state.running && !state.over && !state.paused) togglePause(); });
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.has = true; });
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) pressed.add('mouse-card');
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.querySelectorAll('[data-act]').forEach((b) => {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('touch-' + b.dataset.act); });
});
// Arrow pad and Sprint: held buttons behave like held keys.
document.querySelectorAll('[data-key], [data-hold]').forEach((b) => {
  const key = b.dataset.key || b.dataset.hold;
  const release = () => { keys.delete(key); b.classList.remove('is-held'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch { /* keep working without capture */ }
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
    b.classList.add('is-held');
  });
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
});

// ---------- Audio ----------
let audio = null;
function sfx(freq, dur = 0.08, type = 'square', vol = 0.05, slide = 0) {
  if (!audio) return;
  const t = audio.currentTime;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ---------- Helpers ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
function lineOfSight(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) {
    if (tileAt(ax + (bx - ax) * i / n, ay + (by - ay) * i / n) === '#') return false;
  }
  return true;
}
function collides(e) {
  const x0 = Math.floor((e.x - e.r) / TILE), x1 = Math.floor((e.x + e.r) / TILE);
  const y0 = Math.floor((e.y - e.r) / TILE), y1 = Math.floor((e.y + e.r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolidAt(tx, ty)) return true;
  return false;
}
function move(e, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < steps; i++) {
    e.x += dx / steps; if (collides(e)) e.x -= dx / steps;
    e.y += dy / steps; if (collides(e)) e.y -= dy / steps;
  }
}
function bfs(from, to) {
  const sx = Math.floor(from.x / TILE), sy = Math.floor(from.y / TILE);
  const gx = Math.floor(to.x / TILE), gy = Math.floor(to.y / TILE);
  if (isSolidAt(gx, gy)) return [];
  const prev = new Int32Array(W * H).fill(-1);
  const start = sy * W + sx, goal = gy * W + gx;
  const queue = [start];
  prev[start] = start;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur === goal) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (isSolidAt(nx, ny)) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (prev[goal] === -1) return [];
  const path = [];
  for (let c = goal; c !== start; c = prev[c]) path.push(centre(c % W, (c / W) | 0));
  return path.reverse();
}
function toast(text, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, ms);
}
function effect(kind, x, y, extra = {}) { state.effects.push({ kind, x, y, t: 0, ...extra }); }

function noise(x, y, radius) {
  effect('noise', x, y, { r: radius });
  for (const g of state.guards) {
    if (g.state === 'down' || g.state === 'alert' || g.state === 'stunned') continue;
    if (Math.hypot(g.x - x, g.y - y) < radius) {
      g.state = 'suspicious';
      g.target = { x, y };
      g.meter = Math.max(g.meter, 0.4);
      g.lookT = 2.6;
      g.pathGoal = null;
    }
  }
}

// ---------- Player ----------
function updatePlayer(dt) {
  const p = state.player;
  let mx = 0, my = 0;
  if (keys.has('arrowup')) my -= 1;
  if (keys.has('arrowdown')) my += 1;
  if (keys.has('arrowleft')) mx -= 1;
  if (keys.has('arrowright')) mx += 1;
  const mag = Math.hypot(mx, my);
  p.moving = mag > 0.15;
  if (mag > 1) { mx /= mag; my /= mag; }
  if (p.moving) p.dir = Math.atan2(my, mx);
  if (!isTouch && mouse.has && !p.moving) {
    // Face the cursor when standing still so card throws aim naturally.
    p.dir = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
  }

  p.sprint = keys.has('shift');
  const inHedge = tileAt(p.x, p.y) === 'h';
  let speed = p.sprint ? 185 : 118;
  if (inHedge) speed *= 0.6;

  p.dashCd -= dt; p.slashCd -= dt; p.invuln -= dt; p.slashT -= dt;
  if ((pressed.has(' ') || pressed.has('touch-dash')) && p.dashCd <= 0) {
    p.dashT = 0.17; p.dashCd = 0.8; p.invuln = Math.max(p.invuln, 0.2);
    sfx(300, 0.12, 'triangle', 0.04, -150);
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    move(p, Math.cos(p.dir) * 520 * dt, Math.sin(p.dir) * 520 * dt);
  } else if (p.moving) {
    move(p, mx * speed * dt, my * speed * dt);
    p.step += dt * (p.sprint ? 14 : 9);
  }

  if (p.moving && p.sprint && !inHedge) {
    p.noiseT -= dt;
    if (p.noiseT <= 0) { noise(p.x, p.y, 95); p.noiseT = 0.4; }
  }

  // Light and cover
  p.hidden = inHedge;
  p.lit = !inHedge && (LAMPS.some((l) => Math.hypot(l.x - p.x, l.y - p.y) < l.r * 0.72 && lineOfSight(l.x, l.y, p.x, p.y)) ||
    state.guards.some((g) => g.state !== 'down' && Math.hypot(g.x - p.x, g.y - p.y) < 58));

  // Actions
  if (pressed.has('e') || pressed.has('touch-use')) use();
  if (pressed.has('q') || pressed.has('mouse-card') || pressed.has('touch-card')) throwCard(pressed.has('mouse-card') || (pressed.has('q') && mouse.has));

  // Pickups
  for (const c of state.coins) {
    if (!c.taken && dist(c, p) < 20) { c.taken = true; p.gold += 12; sfx(880, 0.07, 'square', 0.035, 400); effect('sparkle', c.x, c.y); }
  }
  for (const c of state.cardPickups) {
    if (!c.taken && dist(c, p) < 20) { c.taken = true; p.cards += 3; sfx(620, 0.08, 'triangle', 0.04, 200); toast('+3 cards'); }
  }

  // Boat
  if (Math.hypot(p.x - BOAT.x, p.y - BOAT.y) < 70) {
    if (p.hasLedger) finish(true);
    else if (!updatePlayer.boatHint) { toast("Not leaving without Veyrane's ledger."); updatePlayer.boatHint = true; }
  } else updatePlayer.boatHint = false;
}

function behind(g, p) {
  const toPlayer = Math.atan2(p.y - g.y, p.x - g.x);
  return Math.abs(angDiff(g.dir, toPlayer)) > 1.9;
}

function use() {
  const p = state.player;
  // 1. Silent takedown
  let best = null;
  for (const g of state.guards) {
    if (g.state === 'down' || g.state === 'alert') continue;
    const d = dist(g, p);
    if (d < 40 && (behind(g, p) || g.state === 'stunned') && (!best || d < dist(best, p))) best = g;
  }
  if (best) { knockOut(best, true); return; }
  // 2. Tail vault over the estate wall
  for (const v of VAULTS) {
    if (dist(v.wall, p) < 46) {
      const dest = dist(v.a, p) < dist(v.b, p) ? v.b : v.a;
      p.x = dest.x; p.y = dest.y;
      effect('vault', v.wall.x, v.wall.y);
      sfx(500, 0.18, 'sine', 0.05, 300);
      toast('Tail on the ledge, over the wall.');
      return;
    }
  }
  // 3. The ledger
  if (!state.ledgerTaken && dist(LEDGER_SPOT, p) < 40) {
    state.ledgerTaken = true;
    p.hasLedger = true;
    sfx(660, 0.25, 'triangle', 0.06, 330);
    toast("Veyrane's ledger. Noe's contract is in here. Now get to the river.", 3200);
    return;
  }
  // 4. The Soot kid at the docks
  if (dist(KID, p) < 44) {
    if (p.gold > 0) {
      p.given += p.gold;
      toast(`${p.gold} gold to the kid. The mark never knew it was his.`, 2800);
      p.gold = 0;
      KID.helped = true;
      sfx(520, 0.3, 'sine', 0.05, 520);
    } else {
      toast('"Got anything, Zay?" Not yet.');
    }
    return;
  }
  // 5. Wedge yourself into cover tip
  if (tileAt(p.x, p.y) !== 'h') toast('Nothing to use here.', 1100);
}

function knockOut(g, silent) {
  g.state = 'down';
  g.meter = 0;
  state.kos += 1;
  effect('ko', g.x, g.y);
  shake(0.2);
  sfx(silent ? 140 : 110, 0.15, 'triangle', 0.07, -60);
  if (!silent) noise(g.x, g.y, 120);
  else noise(g.x, g.y, 50);
}

function throwCard(aimAtMouse) {
  const p = state.player;
  if (p.cards <= 0) { toast('Out of cards.', 1000); return; }
  p.cards -= 1;
  const a = aimAtMouse ? Math.atan2(mouse.wy - p.y, mouse.wx - p.x) : p.dir;
  state.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 0.62, spin: 0 });
  sfx(1200, 0.05, 'triangle', 0.03, -400);
}

function updateProjectiles(dt) {
  for (const c of state.projectiles) {
    c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; c.spin += dt * 20;
    for (const g of state.guards) {
      if (g.state === 'down' || c.done) continue;
      if (Math.hypot(g.x - c.x, g.y - c.y) < 15) {
        c.done = true;
        g.stunT = g.state === 'alert' ? 0.6 : 1.6;
        if (g.state !== 'alert') { g.prevState = g.state; g.state = 'stunned'; g.meter = Math.min(0.9, g.meter + 0.3); }
        effect('stun', g.x, g.y);
        sfx(420, 0.1, 'square', 0.04);
      }
    }
    if (!c.done && (solidTile(tileAt(c.x, c.y)) || c.life <= 0)) {
      c.done = true;
      noise(c.x, c.y, 175);
      effect('card', c.x, c.y);
      sfx(260, 0.06, 'square', 0.03);
    }
  }
  state.projectiles = state.projectiles.filter((c) => !c.done);
}

// ---------- Guards ----------
function raiseAlarm(g) {
  if (g.state !== 'alert') {
    state.alarms += 1;
    sfx(180, 0.35, 'sawtooth', 0.05, 220);
    toast('Spotted!', 1100);
    shake(0.45);
  }
  g.state = 'alert';
  g.meter = 1;
  g.lostT = 0;
  g.target = { x: state.player.x, y: state.player.y };
  // Shouting brings nearby guards running.
  for (const o of state.guards) {
    if (o !== g && o.state !== 'down' && o.state !== 'alert' && dist(o, g) < 220) {
      o.state = 'suspicious'; o.target = { x: state.player.x, y: state.player.y }; o.lookT = 3; o.pathGoal = null;
      o.meter = Math.max(o.meter, 0.6);
    }
  }
}

function canSee(g, p) {
  const d = dist(g, p);
  if (d < 26) return true;
  if (p.hidden && d > 42) return false;
  const range = p.lit ? 205 : 108;
  if (d > range) return false;
  if (Math.abs(angDiff(g.dir, Math.atan2(p.y - g.y, p.x - g.x))) > 0.62) return false;
  return lineOfSight(g.x, g.y, p.x, p.y);
}

function walkTo(g, goal, speed, dt) {
  const d = dist(g, goal);
  if (d < 4) return true;
  if (lineOfSight(g.x, g.y, goal.x, goal.y) && d < 160) {
    const a = Math.atan2(goal.y - g.y, goal.x - g.x);
    move(g, Math.cos(a) * Math.min(d, speed * dt), Math.sin(a) * Math.min(d, speed * dt));
    turnTo(g, a, dt);
    return false;
  }
  g.pathT -= dt;
  const goalKey = Math.floor(goal.x / TILE) + ',' + Math.floor(goal.y / TILE);
  if (g.pathT <= 0 || g.pathGoal !== goalKey || !g.path.length) {
    g.path = bfs(g, goal);
    g.pathGoal = goalKey;
    g.pathT = 0.5;
  }
  const next = g.path[0];
  if (!next) return true;
  const nd = dist(g, next);
  if (nd < 6) { g.path.shift(); return false; }
  const a = Math.atan2(next.y - g.y, next.x - g.x);
  move(g, Math.cos(a) * Math.min(nd, speed * dt), Math.sin(a) * Math.min(nd, speed * dt));
  turnTo(g, a, dt);
  return false;
}
function turnTo(g, a, dt, rate = 7) {
  const d = angDiff(g.dir, a);
  g.dir += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
}

function updateGuard(g, dt) {
  if (g.state === 'down') return;
  const p = state.player;
  g.attackCd -= dt;
  if (g.stunT > 0) {
    g.stunT -= dt;
    if (g.stunT <= 0 && g.state === 'stunned') {
      g.state = 'suspicious'; g.target = { x: p.x, y: p.y }; g.lookT = 2.5; g.pathGoal = null;
    }
    return;
  }

  const sees = canSee(g, p);
  if (sees) {
    const range = p.lit ? 205 : 108;
    const d = dist(g, p);
    const rate = (p.lit ? 1.9 : 1.05) * (1.25 - Math.min(1, d / range) * 0.6);
    g.meter = Math.min(1, g.meter + rate * dt);
    g.lastSeen = { x: p.x, y: p.y };
    if (g.meter >= 1) raiseAlarm(g);
    else if (g.meter > 0.35 && (g.state === 'patrol' || g.state === 'return')) {
      g.state = 'suspicious'; g.target = { ...g.lastSeen }; g.lookT = 2.6; g.pathGoal = null;
    } else if (g.state === 'suspicious') g.target = { ...g.lastSeen };
  } else if (g.state !== 'alert') {
    g.meter = Math.max(0, g.meter - 0.22 * dt);
  }

  // Spotting a knocked-out colleague raises suspicion once per body.
  if (g.state !== 'alert') {
    for (const o of state.guards) {
      if (o === g || o.state !== 'down' || g.seenBodies.has(o)) continue;
      const d = dist(g, o);
      if (d < 170 && Math.abs(angDiff(g.dir, Math.atan2(o.y - g.y, o.x - g.x))) < 0.7 && lineOfSight(g.x, g.y, o.x, o.y)) {
        g.seenBodies.add(o);
        g.state = 'suspicious'; g.target = { x: o.x, y: o.y }; g.lookT = 4; g.pathGoal = null;
        g.meter = Math.max(g.meter, 0.7);
      }
    }
  }

  switch (g.state) {
    case 'patrol': {
      const wp = g.route[g.ri];
      if (walkTo(g, wp, g.speed, dt)) g.ri = (g.ri + 1) % g.route.length;
      break;
    }
    case 'return': {
      const wp = g.route[g.ri];
      if (walkTo(g, wp, 70, dt)) g.state = 'patrol';
      break;
    }
    case 'suspicious':
    case 'search': {
      const arrived = walkTo(g, g.target, g.state === 'search' ? 95 : 72, dt);
      if (arrived) {
        g.lookT -= dt;
        g.dir += Math.sin(state.time * 2.4) * 2.2 * dt;
        if (g.lookT <= 0) { g.state = 'return'; g.meter = Math.min(g.meter, 0.3); g.pathGoal = null; }
      }
      break;
    }
    case 'alert': {
      if (sees || !g.target) { g.lostT = 0; g.target = { x: p.x, y: p.y }; }
      else {
        g.lostT += dt;
        if (g.lostT > 3.2) {
          g.state = 'search'; g.target = g.lastSeen || g.target; g.lookT = 4; g.meter = 0.6; g.pathGoal = null;
          break;
        }
      }
      if (dist(g, p) < 30 && p.invuln <= 0 && state.mode === 'field') {
        startBattle(g);
        return;
      }
      walkTo(g, g.target, 128, dt);
      break;
    }
  }
}

// ---------- Rendering ----------
let camX = 0, camY = 0, shakeX = 0, shakeY = 0;
const CAMERA_SMOOTHING = 6; // Godot Camera2D position_smoothing_speed
let trauma = 0;
function shake(amount) { trauma = Math.min(1, trauma + amount); }
function updateCamera(dt = 0, snap = false) {
  const p = state.player;
  const viewW = vw / zoom, viewH = vh / zoom;
  // On touch screens the thumb controls cover the bottom of the view, so keep ZAY in the upper part
  // and let the camera scroll past the map's bottom edge.
  const controls = isTouch ? (vh * 0.34) / zoom : 0;
  const targetX = Math.max(0, Math.min(W * TILE - viewW, p.x - viewW / 2));
  const targetY = Math.max(0, Math.min(H * TILE - viewH + controls, p.y - (viewH - controls) / 2));
  // Camera2D smoothing: pos += (target - pos) * speed * delta
  const c = snap ? 1 : Math.min(1, CAMERA_SMOOTHING * dt);
  camX += (targetX - camX) * c;
  camY += (targetY - camY) * c;
  // Trauma-based shake that fades out
  trauma = Math.max(0, trauma - dt * 1.6);
  const k = trauma * trauma * 7;
  shakeX = (Math.random() * 2 - 1) * k;
  shakeY = (Math.random() * 2 - 1) * k;
  mouse.wx = camX + mouse.x / zoom;
  mouse.wy = camY + mouse.y / zoom;
}
const camLeft = () => camX + shakeX, camTop = () => camY + shakeY;
const inView = (x, y, m = 160) => x > camX - m && y > camY - m && x < camX + vw / zoom + m && y < camY + vh / zoom + m;

function render() {
  const s = dpr * zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, -camLeft() * s, -camTop() * s);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mapCanvas, 0, 0);
  ctx.imageSmoothingEnabled = true;

  drawWater();
  drawProps();
  for (const g of state.guards) if (inView(g.x, g.y)) drawCone(g);
  for (const g of state.guards) if (inView(g.x, g.y)) drawGuard(g);
  drawPlayer();
  for (const c of state.projectiles) drawCard(c.x, c.y, c.spin);

  // Darkness with light cut-outs
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = 'rgba(6,8,24,0.7)';
  dctx.fillRect(0, 0, dark.width, dark.height);
  dctx.setTransform(s, 0, 0, s, -camLeft() * s, -camTop() * s);
  dctx.globalCompositeOperation = 'destination-out';
  const flick = 1 + Math.sin(state.time * 9) * 0.02;
  for (const l of LAMPS) if (inView(l.x, l.y, l.r)) cutLight(l.x, l.y, l.r * flick, 1, l.poly);
  for (const g of state.guards) {
    if (g.state === 'down' || !inView(g.x, g.y)) continue;
    const lx = g.x + Math.cos(g.dir) * 10, ly = g.y + Math.sin(g.dir) * 10;
    cutLight(lx, ly, 66, 0.9, lightPolygon(lx, ly, 66, 48));
  }
  const p = state.player;
  cutLight(p.x, p.y, 54, 0.45);
  cutLight(BOAT.x, BOAT.y, 70, 0.6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(dark, 0, 0);
  ctx.setTransform(s, 0, 0, s, -camLeft() * s, -camTop() * s);

  // Warm glows and emissive bits over the dark
  ctx.globalCompositeOperation = 'lighter';
  for (const l of LAMPS) if (inView(l.x, l.y, l.r)) glow(l.x, l.y, l.r * 0.85, 'rgba(233,170,80,0.2)', l.poly);
  ctx.globalCompositeOperation = 'source-over';
  for (const w of WINDOWS) if (inView(w.x, w.y, 40)) { ctx.fillStyle = 'rgba(240,190,110,0.78)'; ctx.fillRect(w.x, w.y, w.w, w.h); ctx.fillStyle = 'rgba(60,35,20,.9)'; ctx.fillRect(w.x + 3.5, w.y, 1, w.h); }
  for (const l of LAMPS) if (inView(l.x, l.y, 40)) drawLamp(l.x, l.y);
  drawEffects();
  drawObjectiveArrow();
}
function tracePoly(c, poly) {
  c.beginPath();
  c.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) c.lineTo(poly[i], poly[i + 1]);
  c.closePath();
}
function cutLight(x, y, r, strength, poly) {
  const g = dctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.7})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  dctx.fillStyle = g;
  if (poly) tracePoly(dctx, poly);
  else { dctx.beginPath(); dctx.arc(x, y, r, 0, Math.PI * 2); }
  dctx.fill();
}
function glow(x, y, r, color, poly) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  if (poly) tracePoly(ctx, poly);
  else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
  ctx.fill();
}
function drawLamp(x, y) {
  ctx.fillStyle = '#121019';
  ctx.beginPath(); ctx.arc(x, y + 3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd88a';
  ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
}
function drawWater() {
  const x0 = 60 * TILE, t = state.time;
  if (!inView(x0, camY + 100, 200)) return;
  ctx.strokeStyle = 'rgba(120,160,220,0.18)';
  ctx.lineWidth = 1.5;
  for (let y = Math.floor(camY / 24) * 24; y < camY + vh / zoom + 24; y += 24) {
    ctx.beginPath();
    for (let x = x0; x <= x0 + 4 * TILE; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.08 + t * 1.6 + y) * 2.5);
    ctx.stroke();
  }
  // The boat
  ctx.save();
  ctx.translate(BOAT.x + 8, BOAT.y + Math.sin(t * 1.5) * 1.5);
  ctx.fillStyle = '#5a3d24';
  ctx.beginPath(); ctx.ellipse(0, 0, 18, 42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2716';
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e9b65a';
  ctx.beginPath(); ctx.arc(0, -26, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawProps() {
  const t = state.time;
  for (const c of state.coins) if (!c.taken && inView(c.x, c.y)) {
    const b = Math.sin(t * 4 + c.x) * 1.5;
    ctx.fillStyle = '#7a5a2a';
    ctx.beginPath(); ctx.arc(c.x, c.y + 3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9b65a';
    ctx.beginPath(); ctx.arc(c.x, c.y + b, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff2c4';
    ctx.fillRect(c.x - 1.5, c.y - 3 + b, 2, 2);
  }
  for (const c of state.cardPickups) if (!c.taken && inView(c.x, c.y)) drawCard(c.x, c.y + Math.sin(t * 3) * 2, 0.3);
  if (!state.ledgerTaken) {
    const l = LEDGER_SPOT;
    ctx.fillStyle = '#4a2e1c';
    ctx.fillRect(l.x - 13, l.y - 9, 26, 18);
    ctx.fillStyle = '#7a1f22';
    ctx.fillRect(l.x - 8, l.y - 7, 16, 12);
    ctx.fillStyle = '#e9b65a';
    ctx.fillRect(l.x - 8, l.y - 1, 16, 1.5);
  }
  for (const v of VAULTS) {
    ctx.strokeStyle = 'rgba(233,182,90,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(v.wall.x - 8, v.wall.y - 6); ctx.lineTo(v.wall.x + 8, v.wall.y - 6); ctx.stroke();
  }
  // The Soot kid
  const k = KID;
  ctx.fillStyle = '#2d2a3a';
  ctx.beginPath(); ctx.arc(k.x, k.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a35';
  ctx.beginPath(); ctx.arc(k.x, k.y - 2, 4.5, 0, Math.PI * 2); ctx.fill();
  if (KID.helped) { ctx.fillStyle = '#e9b65a'; ctx.beginPath(); ctx.arc(k.x + 9, k.y + 5, 3, 0, Math.PI * 2); ctx.fill(); }
}
function drawCard(x, y, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(-4, -6, 8, 12);
  ctx.fillStyle = '#9b2c2c';
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}
function drawCone(g) {
  if (g.state === 'down' || g.state === 'stunned') return;
  const p = state.player;
  const range = p.lit ? 205 : 108;
  const color = g.state === 'alert' ? 'rgba(226,87,76,0.16)' : g.state === 'suspicious' || g.state === 'search' ? 'rgba(240,150,70,0.14)' : 'rgba(233,182,90,0.08)';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const a = g.dir - 0.62 + (1.24 * i) / steps;
    let r = 0;
    for (; r < range; r += 8) if (tileAt(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r) === '#') break;
    ctx.lineTo(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}
function drawGuard(g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  if (g.state === 'down') {
    ctx.rotate(g.dir + 1.2);
    ctx.fillStyle = '#26304d';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3b2b';
    ctx.beginPath(); ctx.arc(11, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 6, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(g.dir);
  ctx.fillStyle = g.windup > 0 ? '#5a2430' : '#26304d';
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b08a3e';
  ctx.fillRect(-3, -12, 6, 24);
  ctx.fillStyle = '#5a3b2b';
  ctx.beginPath(); ctx.arc(2, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b2238';
  ctx.beginPath(); ctx.arc(1, 0, 6.5, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = '#ffd88a';
  ctx.beginPath(); ctx.arc(9, 9, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Awareness marker
  if (g.meter > 0.05 || g.state === 'stunned') {
    const y = g.y - 24;
    if (g.state === 'alert') {
      ctx.fillStyle = '#e2574c';
      ctx.font = '800 16px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', g.x, y + 5);
    } else if (g.state === 'stunned') {
      ctx.strokeStyle = '#f3d79a'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = state.time * 5 + i * 2.1; ctx.beginPath(); ctx.arc(g.x + Math.cos(a) * 9, y + Math.sin(a) * 3, 1.6, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(g.x, y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = g.meter > 0.35 ? '#f0964a' : '#e9b65a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(g.x, y, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.meter); ctx.stroke();
    }
  }
}
function drawPlayer() {
  const p = state.player;
  const t = state.time;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  if (p.hidden) ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 6, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.dir);
  // Tail sways behind him
  ctx.strokeStyle = '#2a1a14';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  const sway = Math.sin(t * 5 + p.step) * 6;
  ctx.quadraticCurveTo(-18, sway, -24, sway * 1.6 + 4);
  ctx.stroke();
  // Body: black rogue layers
  ctx.fillStyle = '#121218';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  // Katana across the back
  ctx.strokeStyle = '#c9c9d6';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(6, 10); ctx.stroke();
  ctx.fillStyle = '#e9b65a';
  ctx.fillRect(-11, -11, 3, 3);
  // Hood and eyes
  ctx.fillStyle = '#1c1c26';
  ctx.beginPath(); ctx.arc(2, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f3c25c';
  ctx.fillRect(5, -3, 2, 1.6);
  ctx.fillRect(5, 1.4, 2, 1.6);
  // Blade swing
  if (p.slashT > 0) {
    const k = 1 - p.slashT / 0.16;
    ctx.strokeStyle = 'rgba(240,235,220,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34, -1.1 + k * 0.4, 1.1 * (k * 2 - 1)); ctx.stroke();
  }
  ctx.restore();
  if (p.hasLedger) { ctx.fillStyle = '#7a1f22'; ctx.fillRect(p.x + 8, p.y - 16, 8, 6); }
}
function drawEffects() {
  for (const e of state.effects) {
    const k = Math.max(0, e.t);
    if (e.kind === 'noise') {
      ctx.strokeStyle = `rgba(243,215,154,${0.35 * (1 - k / 0.6)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * Math.min(1, k / 0.6), 0, Math.PI * 2); ctx.stroke();
    } else if (e.kind === 'sparkle') {
      ctx.fillStyle = `rgba(255,236,170,${1 - k / 0.5})`;
      for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.fillRect(e.x + Math.cos(a) * k * 40, e.y + Math.sin(a) * k * 40, 2, 2); }
    } else if (e.kind === 'ko' || e.kind === 'stun' || e.kind === 'vault') {
      ctx.strokeStyle = `rgba(240,235,220,${1 - k / 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 10 + k * 40, 0, Math.PI * 2); ctx.stroke();
    } else if (e.kind === 'swing') {
      ctx.strokeStyle = `rgba(226,87,76,${1 - k / 0.25})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, 30, e.dir - 0.9, e.dir + 0.9); ctx.stroke();
    } else if (e.kind === 'hurt') {
      ctx.fillStyle = `rgba(226,87,76,${0.4 * (1 - k / 0.4)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 24, 0, Math.PI * 2); ctx.fill();
    } else if (e.kind === 'card') {
      drawCard(e.x, e.y, 0.5);
    }
  }
}
function drawObjectiveArrow() {
  const p = state.player;
  const goal = state.ledgerTaken ? BOAT : LEDGER_SPOT;
  const d = dist(goal, p);
  if (d < 120) return;
  const a = Math.atan2(goal.y - p.y, goal.x - p.x);
  ctx.save();
  ctx.translate(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(243,215,154,.75)';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4.5); ctx.lineTo(-4, 4.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------- HUD ----------
const hudEls = {
  hud: document.getElementById('hud'), hpFill: document.getElementById('hp-fill'), hpText: document.getElementById('hp-text'), gold: document.getElementById('gold'),
  cards: document.getElementById('cards'), vis: document.getElementById('vis'), objective: document.getElementById('objective')
};
let hudCache = '';
function updateHud() {
  const p = state.player;
  const vis = p.hidden ? 'Hidden' : p.lit ? 'In the light' : 'Shadow';
  const objective = !state.ledgerTaken ? "Steal the ledger from House Veyrane's counting house"
    : KID.helped ? 'Reach the river boat' : 'Reach the river boat · give your coin to the kid on the dock';
  const lead = state.party[0];
  const key = [lead.hp, p.gold, p.cards, vis, objective].join('|');
  if (key === hudCache) return;
  hudCache = key;
  hudEls.hpFill.style.transform = `scaleX(${lead.hp / lead.maxHp})`;
  hudEls.hpText.textContent = `${lead.hp}/${lead.maxHp}`;
  hudEls.gold.textContent = p.gold;
  hudEls.cards.textContent = p.cards;
  hudEls.vis.textContent = vis;
  hudEls.vis.className = 'vis' + (p.lit ? ' lit' : p.hidden ? ' hidden-state' : '');
  hudEls.objective.textContent = objective;
}

// ---------- Flow ----------
function finish(won) {
  if (state.over) return;
  state.over = true;
  state.running = false;
  const p = state.player;
  const end = document.getElementById('end');
  const mins = Math.floor(state.time / 60), secs = String(Math.floor(state.time % 60)).padStart(2, '0');
  let rating;
  if (!won) rating = 'Caught';
  else if (state.alarms === 0 && state.kos === 0) rating = 'Ghost of the Lantern Quarter';
  else if (state.alarms === 0) rating = 'Shadow';
  else if (state.alarms <= 2) rating = 'Rogue';
  else rating = 'Brawler — the guild will have words';
  document.getElementById('end-kicker').textContent = won ? 'Job complete' : 'Job failed';
  document.getElementById('end-title').textContent = rating;
  document.getElementById('end-text').textContent = won
    ? (p.given > 0 ? 'The boat slides off into the dark with the ledger, and a Soot kid eats well tonight.' : 'The boat slides off into the dark with the ledger. Noe never has to know how close it was.')
    : 'Veyrane’s guards drag ZAY into the lantern light. Severin will hear about this.';
  const stats = [
    ['Time', `${mins}:${secs}`],
    ['Times spotted', state.alarms],
    ['Battles', state.battles],
    ['Stolen in battle', state.stolen.length ? state.stolen.join(', ') : 'nothing'],
    ['Guards knocked out', state.kos],
    ['Casualties', '0 · the code held'],
    ['Gold given away', p.given],
    ['Gold kept', p.gold]
  ];
  document.getElementById('end-stats').innerHTML = stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.getElementById('touch').hidden = true;
  end.hidden = false;
  sfx(won ? 520 : 140, 0.6, 'sine', 0.06, won ? 260 : -60);
}

function start() {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; } }
  state = newState();
  KID.helped = false;
  hudCache = '';
  state.running = true;
  document.getElementById('title').hidden = true;
  document.getElementById('end').hidden = true;
  document.getElementById('pause').hidden = true;
  document.getElementById('battle-ui').hidden = true;
  B.active = false;
  hudEls.hud.hidden = false;
  document.getElementById('touch').hidden = !isTouch;
  toast('The Soot Quarter. Veyrane’s estate is north-east, past the lanterns.', 3000);
  trauma = 0;
  updateCamera(0, true);
  updateHud();
}
function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pause').hidden = !state.paused;
}
document.getElementById('start').addEventListener('click', start);
document.getElementById('again').addEventListener('click', start);
document.getElementById('resume').addEventListener('click', togglePause);
document.getElementById('restart-pause').addEventListener('click', start);
document.getElementById('pause-btn').addEventListener('click', () => { if (state.running) togglePause(); });

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  pollGamepad();
  if (state.running && !state.paused) {
    state.time += dt;
    if (state.mode === 'battle') updateBattle(dt);
    else {
      updatePlayer(dt);
      updateProjectiles(dt);
      for (const g of state.guards) updateGuard(g, dt);
      for (const e of state.effects) e.t += dt;
      state.effects = state.effects.filter((e) => e.t < 0.7);
      updateHud();
    }
  }
  pressed.clear();
  if (state.mode === 'battle') renderBattle();
  else {
    updateCamera(dt);
    render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
