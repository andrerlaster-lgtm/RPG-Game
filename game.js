'use strict';

// Bellemorne: Paper Thief — a top-down stealth level built from the Bellemorne canon.
// ZAY slips into House Veyrane's estate, steals the debt ledger, and escapes to the river.

const TILE = 32;
// ---------- Level (Tiled map) ----------
// Each district is a Tiled map in levels/ (list in districts.js), editable in Tiled (mapeditor.org).
//   Tile layer "ground": tiles 1-7 = building, street, garden, hedge, floor, river, dock.
//   Object layer "objects" (object Class/Type):
//     start, lamp (radius), chest (item), coin (gold), cards (count), ledger, kid, boat,
//     vault (a 2-point line across a wall), guard (polyline patrol route; kind = guard/captain),
//     fence (the Blackwater shop), overhear (radius, lines = "text | text | text": guards talk nearby),
//     exit (rectangle; to = district id, spawn = spawn name there), spawn (named arrival point),
//     label (a place name painted on the map; the object's name is the text),
//     npc (who = noe/severin/patron/hustle/needy, look, dir in degrees, line, reach = talk distance;
//          needy: need, ask, thanks), walker (polyline route; kind = mark/local, look: passers-by to pickpocket), prop (rectangle; kind = counter/table/stage).
const KIND_BY_TILE = ['#', '.', 'g', 'h', 'f', 'w', 'd'];
let W = 64;
let H = 44;
let grid = Array.from({ length: H }, () => Array(W).fill('#'));
let LEVEL = null;
let LAMPS = [];
let VAULTS = [];
let GUARD_ROUTES = [];
let EXITS = [];
let SPAWNS = {};
let LABELS = [];
let NPCS = [];
let WALKERS = [];
let PROPS = [];
let FURN = new Set();   // tiles blocked by furniture (props)
const BOAT = { x: 0, y: 0 };
const KID = { x: 0, y: 0, helped: false };
const LEDGER_SPOT = { x: 0, y: 0 };
const FENCE = { x: 0, y: 0 };

const tileAt = (px, py) => {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return '#';
  return grid[ty][tx];
};
const solidTile = (t) => t === '#' || t === 'w';
const isSolidAt = (tx, ty) => tx < 0 || ty < 0 || tx >= W || ty >= H || solidTile(grid[ty][tx]) || FURN.has(ty * W + tx);
const centre = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

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

function buildLevel(map) {
  W = map.width;
  H = map.height;
  const ground = map.layers.find((l) => l.type === 'tilelayer');
  const first = (map.tilesets && map.tilesets[0] && map.tilesets[0].firstgid) || 1;
  grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => KIND_BY_TILE[ground.data[y * W + x] - first] || '#'));
  const objects = (map.layers.find((l) => l.type === 'objectgroup') || { objects: [] }).objects;
  const kindOf = (o) => o.type || o.class || '';
  const of = (kind) => objects.filter((o) => kindOf(o) === kind);
  const prop = (o, name, fallback) => {
    const p = (o.properties || []).find((q) => q.name === name);
    return p ? p.value : fallback;
  };
  const at = (o) => ({ x: o.x, y: o.y });
  const line = (o) => (o.polyline || o.polygon || [{ x: 0, y: 0 }]).map((q) => ({ x: o.x + q.x, y: o.y + q.y }));
  const start = of('start')[0];
  LEVEL = {
    title: prop(map, 'title', 'Paper Thief'),
    start: start ? at(start) : centre(4, 38),
    coins: of('coin').map((o) => ({ ...at(o), gold: prop(o, 'gold', 12) })),
    cards: of('cards').map((o) => ({ ...at(o), count: prop(o, 'count', 3) })),
    chests: of('chest').map((o) => ({ ...at(o), item: prop(o, 'item', o.name) })),
    overhears: of('overhear').map((o) => ({ ...at(o), radius: prop(o, 'radius', 110), lines: String(prop(o, 'lines', '')).split('|').map((x) => x.trim()).filter(Boolean) }))
  };
  LAMPS = of('lamp').map((o) => ({ ...at(o), r: prop(o, 'radius', tileAt(o.x, o.y) === 'f' ? 92 : 128) }));
  LAMPS.forEach((l) => { l.poly = lightPolygon(l.x, l.y, l.r); });
  VAULTS = of('vault').map((o) => {
    const pts = line(o);
    const a = pts[0], b = pts[pts.length - 1];
    return { a, b, wall: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  });
  // One-of-a-kind spots; a district without one parks it far off the map.
  for (const [target, kind] of [[BOAT, 'boat'], [KID, 'kid'], [LEDGER_SPOT, 'ledger'], [FENCE, 'fence']]) {
    const o = of(kind)[0];
    Object.assign(target, o ? at(o) : { x: -1e5, y: -1e5 });
  }
  EXITS = of('exit').map((o) => ({ x: o.x, y: o.y, w: o.width || TILE, h: o.height || TILE, to: prop(o, 'to', ''), spawn: prop(o, 'spawn', 'start') }));
  SPAWNS = { start: LEVEL.start };
  for (const o of of('spawn')) SPAWNS[o.name] = at(o);
  LABELS = of('label').map((o) => ({ ...at(o), text: o.name || prop(o, 'text', '') }));
  NPCS = of('npc').map((o) => ({
    ...at(o), id: o.id, name: o.name, who: prop(o, 'who', 'patron'), look: prop(o, 'look', 0), dir: prop(o, 'dir', 90) * Math.PI / 180,
    line: prop(o, 'line', ''), reach: prop(o, 'reach', 44), need: prop(o, 'need', ''), ask: prop(o, 'ask', 20), thanks: prop(o, 'thanks', '')
  }));
  WALKERS = of('walker').map((o, i) => ({ pts: line(o), kind: prop(o, 'kind', 'local'), look: prop(o, 'look', i) }));
  PROPS = of('prop').map((o) => ({ x: o.x, y: o.y, w: o.width || TILE, h: o.height || TILE, kind: prop(o, 'kind', 'table') }));
  FURN = new Set();
  for (const pr of PROPS) {
    for (let ty = Math.floor(pr.y / TILE); ty <= Math.floor((pr.y + pr.h - 1) / TILE); ty++)
      for (let tx = Math.floor(pr.x / TILE); tx <= Math.floor((pr.x + pr.w - 1) / TILE); tx++) FURN.add(ty * W + tx);
  }
  GUARD_ROUTES = of('guard').map((o) => ({ kind: prop(o, 'kind', 'guard'), pts: line(o), escort: prop(o, 'escort', '') }));
  renderMap();
}

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
const roofCanvas = document.createElement('canvas');
const EDGES = [];   // building walls: {x0, y0, x1, y1, side, win}
const SHADOWS = [];
function renderMap() {
  seed = 7;
  EDGES.length = 0;
  SHADOWS.length = 0;
  mapCanvas.width = roofCanvas.width = W * TILE;
  mapCanvas.height = roofCanvas.height = H * TILE;
  const m = mapCanvas.getContext('2d');
  const r = roofCanvas.getContext('2d');
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
    } else if (t === 'd') {
      m.fillStyle = '#0b1729';
      m.fillRect(x, y, TILE, TILE);
      m.fillStyle = '#4a3523';
      for (let k = 0; k < 4; k++) m.fillRect(x, y + k * 8, TILE, 6);
    } else if (t === 'f') {
      m.fillStyle = '#3a2a20';
      m.fillRect(x, y, TILE, TILE);
      m.fillStyle = '#2e2119';
      for (let k = 0; k < 4; k++) m.fillRect(x, y + k * 8 + 7, TILE, 1);
    } else if (t === 'w') {
      m.fillStyle = '#0b1729';
      m.fillRect(x, y, TILE, TILE);
    } else {
      // Building footprint. The ground here is only seen through gaps; walls and the roof are
      // drawn every frame by drawBuildings() so they can lean with the camera.
      m.fillStyle = '#0d0b12';
      m.fillRect(x, y, TILE, TILE);
      const v = 30 + Math.floor(rand() * 6);
      r.fillStyle = `rgb(${v + 6},${v},${v + 14})`;
      r.fillRect(x, y, TILE, TILE);
      r.fillStyle = 'rgba(255,255,255,.05)';
      for (let k = 0; k < 4; k++) r.fillRect(x, y + k * 8 + 6, TILE, 1);   // slate rows
      r.fillStyle = 'rgba(0,0,0,.18)';
      r.fillRect(x, y + (tx + ty) % 3 * 8, TILE, 2);
      for (const [dx, dy, side] of [[0, 1, 's'], [1, 0, 'e'], [-1, 0, 'w'], [0, -1, 'n']]) {
        const n = grid[ty + dy] && grid[ty + dy][tx + dx];
        if (!n || n === '#') continue;
        // Gold trim along the roof edge.
        r.fillStyle = '#6d5326';
        if (side === 'e') r.fillRect(x + TILE - 2, y, 2, TILE);
        if (side === 'w') r.fillRect(x, y, 2, TILE);
        if (side === 'n') r.fillRect(x, y, TILE, 2);
        if (side === 's') { r.fillRect(x, y + TILE - 3, TILE, 3); r.fillStyle = 'rgba(255,230,170,.35)'; r.fillRect(x, y + TILE - 3, TILE, 1); }
        // The wall below that edge, with a window (lit or shuttered) on street-facing sides.
        const e = side === 's' ? { x0: x, y0: y + TILE, x1: x + TILE, y1: y + TILE }
          : side === 'n' ? { x0: x, y0: y, x1: x + TILE, y1: y }
          : side === 'e' ? { x0: x + TILE, y0: y, x1: x + TILE, y1: y + TILE }
          : { x0: x, y0: y, x1: x, y1: y + TILE };
        e.side = side;
        e.win = rand() < (side === 's' ? 0.75 : 0.45) ? { a: 0.25 + rand() * 0.25, lit: rand() < 0.65 } : null;
        EDGES.push(e);
        // Soft contact shadow on the ground where the wall meets it.
        const g = side === 's' ? m.createLinearGradient(0, y + TILE, 0, y + TILE + 12)
          : side === 'n' ? m.createLinearGradient(0, y, 0, y - 12)
          : side === 'e' ? m.createLinearGradient(x + TILE, 0, x + TILE + 12, 0)
          : m.createLinearGradient(x, 0, x - 12, 0);
        g.addColorStop(0, 'rgba(0,0,0,.42)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        SHADOWS.push({ g, rect: side === 's' ? [x, y + TILE, TILE, 12] : side === 'n' ? [x, y - 12, TILE, 12] : side === 'e' ? [x + TILE, y, 12, TILE] : [x - 12, y, 12, TILE] });
      }
    }
  }
  for (const sh of SHADOWS) { m.fillStyle = sh.g; m.fillRect(...sh.rect); }
  // Hedges drawn as round bushes on top of the garden.
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (grid[ty][tx] !== 'h') continue;
    const c = centre(tx, ty);
    m.fillStyle = '#244a2f';
    m.beginPath(); m.arc(c.x, c.y, 17, 0, Math.PI * 2); m.fill();
    m.fillStyle = '#2f5c3a';
    m.beginPath(); m.arc(c.x - 4, c.y - 5, 9, 0, Math.PI * 2); m.fill();
  }
}

// ---------- State ----------
let state;
function makeGuard(route) {
  const pts = route.pts;
  return {
    kind: route.kind,
    x: pts[0].x, y: pts[0].y, r: 11, dir: 0, route: pts, ri: 1 % pts.length,
    state: 'patrol', meter: 0, hp: 3, path: [], pathT: 0, pathGoal: null, target: null,
    lostT: 0, lookT: 0, attackCd: 0, windup: 0, stunT: 0, seenBodies: new Set(), speed: 52,
    watch: route.kind === 'watch', escort: !!route.escort, hostile: false
  };
}
function newState() {
  return {
    running: false,
    paused: false,
    over: false,
    mode: 'field',
    party: makeParty(),
    items: { ...STARTING_BAG },
    chests: LEVEL.chests.map((c) => ({ ...c, opened: false })),
    battles: 0,
    rep: 0,
    deeds: {},
    jobsDone: new Set(),
    jobsTaken: new Set(),
    npcs: [],
    stolen: [],
    newItems: new Set(),
    time: 0,
    player: {
      x: LEVEL.start.x, y: LEVEL.start.y, r: 10, dir: -Math.PI / 2,
      gold: 0, given: 0, cards: 5, invuln: 0, dashT: 0, dashCd: 0, slashCd: 0, slashT: 0,
      noiseT: 0, lit: false, hidden: false, moving: false, sprint: false, hasLedger: false, step: 0
    },
    guards: GUARD_ROUTES.map(makeGuard),
    district: null,
    spawn: 'start',
    world: {},
    coins: LEVEL.coins.map((c) => ({ ...c, taken: false })),
    cardPickups: LEVEL.cards.map((c) => ({ ...c, taken: false })),
    overhears: LEVEL.overhears.map((o) => ({ ...o, done: false })),
    projectiles: [],
    effects: [],
    alarms: 0,
    kos: 0,
    ledgerTaken: false
  };
}
// Placeholder until the level file loads.
state = { running: false, paused: false, over: false, mode: 'title', party: [], items: {}, newItems: new Set(), player: { gold: 0 } };

// ---------- Input ----------
const keys = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, wx: 0, wy: 0, has: false };
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
  if ((k === 'p' || (k === 'escape' && state.mode === 'field')) && (state.mode === 'field' || state.mode === 'battle') && state.running && !state.over) togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Input map (like Godot's InputMap): gamepad buttons feed the same actions as keys.
// Standard layout: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 9 Start, 12-15 d-pad.
const PAD_MAP = {
  field: { 0: 'e', 1: ' ', 2: 'q', 3: 'i', 4: 'shift', 5: 'shift', 9: 'p', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' },
  inventory: { 0: 'enter', 1: 'escape', 3: 'i', 4: 'q', 5: 'e', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' },
  dialog: { 0: 'enter', 1: 'enter', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' },
  shop: { 0: 'enter', 1: 'escape', 4: 'q', 5: 'q', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' },
  battle: { 0: 'enter', 1: 'escape', 9: 'p', 12: 'arrowup', 13: 'arrowdown', 14: 'arrowleft', 15: 'arrowright' }
};
const padHeld = new Set();
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads || []).find((g) => g && g.connected);
  const now = new Set();
  if (pad) {
    const map = PAD_MAP[state.mode] || PAD_MAP.field;
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
  if (pressed.has('p') && now.has('p') && (state.mode === 'field' || state.mode === 'battle') && state.running && !state.over) togglePause();
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
// The touch wheel: drag the knob; how far you push sets how fast ZAY moves (stick.x / stick.y, -1..1).
const stick = { x: 0, y: 0, on: false };
const stickEl = document.getElementById('stick');
const knobEl = stickEl.querySelector('.stick-knob');
function stickAt(e) {
  const r = stickEl.getBoundingClientRect();
  const max = r.width * 0.32;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  stick.x = dx / max; stick.y = dy / max;
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
}
function stickRelease() {
  stick.on = false; stick.x = stick.y = 0;
  knobEl.style.transform = '';
  stickEl.classList.remove('is-held');
}
stickEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { stickEl.setPointerCapture(e.pointerId); } catch { /* keep working without capture */ }
  stick.on = true;
  stickEl.classList.add('is-held');
  stickAt(e);
});
stickEl.addEventListener('pointermove', (e) => { if (stick.on) stickAt(e); });
stickEl.addEventListener('pointerup', stickRelease);
stickEl.addEventListener('pointercancel', stickRelease);
stickEl.addEventListener('lostpointercapture', stickRelease);
// Sprint: a held button behaves like a held key.
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
  if (!audio || SETTINGS.volume <= 0) return;
  const t = audio.currentTime;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(Math.max(0.0001, vol * SETTINGS.volume), t);
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
  // People stand their ground.
  if (state && state.npcs) for (const n of state.npcs) if (Math.hypot(n.x - e.x, n.y - e.y) < e.r + 9) return true;
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
// The 3D view (render3d.js) takes over drawing the field once WebGL is up, unless Options says Classic.
const use3D = () => SETTINGS.view === '3d' && !!window.R3D && window.R3D.ready;
const TURN_RATE = 3;   // radians a second, turning in the 3D view
function updatePlayer(dt) {
  const p = state.player;
  let mx = 0, my = 0;
  const wheel = stick.on && Math.hypot(stick.x, stick.y) > 0.15;
  if (use3D()) {
    // Third person: Left/Right turn ZAY, Up walks forward, Down steps back.
    // The wheel works the same way: push up to walk, sideways to turn, both to walk round a corner.
    const turn = wheel ? Math.sign(stick.x) * Math.max(0, Math.abs(stick.x) - 0.15) / 0.85
      : (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0);
    p.dir += turn * TURN_RATE * dt;
    const fwd = wheel ? (stick.y < 0 ? -stick.y : -stick.y * 0.6) * (Math.abs(stick.y) > 0.2 ? 1 : 0)
      : (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 0.6 : 0);
    mx = Math.cos(p.dir) * fwd;
    my = Math.sin(p.dir) * fwd;
  } else if (wheel) {
    mx = stick.x; my = stick.y;
  } else {
    if (keys.has('arrowup')) my -= 1;
    if (keys.has('arrowdown')) my += 1;
    if (keys.has('arrowleft')) mx -= 1;
    if (keys.has('arrowright')) mx += 1;
  }
  const mag = Math.hypot(mx, my);
  p.moving = mag > 0.15;
  if (mag > 1) { mx /= mag; my /= mag; }
  if (p.moving && !use3D()) p.dir = Math.atan2(my, mx);
  if (!isTouch && mouse.has && !p.moving && !use3D()) {
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
    play('cloth2', { vol: 0.7 }); play('swish');
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    move(p, Math.cos(p.dir) * 520 * dt, Math.sin(p.dir) * 520 * dt);
  } else if (p.moving) {
    move(p, mx * speed * dt, my * speed * dt);
    p.step += dt * (p.sprint ? 14 : 9);
    p.stepT = (p.stepT || 0) - dt;
    if (p.stepT <= 0) {
      if (inHedge) play('rustle'); else playStep(p.sprint);
      p.stepT = p.sprint ? 0.27 : 0.4;
    }
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
  if (pressed.has('i') || pressed.has('tab')) { openInventory(); return; }
  if (pressed.has('e') || pressed.has('touch-use')) use();
  if (pressed.has('q') || pressed.has('mouse-card') || pressed.has('touch-card')) throwCard(pressed.has('mouse-card') || (pressed.has('q') && mouse.has));

  // Pickups
  for (const c of state.coins) {
    if (!c.taken && dist(c, p) < 20) { c.taken = true; p.gold += c.gold; play('coins2', { vol: 0.8 }); effect('sparkle', c.x, c.y); }
  }
  for (const c of state.cardPickups) {
    if (!c.taken && dist(c, p) < 20) { c.taken = true; p.cards += c.count; play('belt', { vol: 0.8 }); play('card', { delay: 0.05 }); toast(`+${c.count} cards`); }
  }

  // Boat
  if (Math.hypot(p.x - BOAT.x, p.y - BOAT.y) < 70) {
    if (p.hasLedger && !state.leaving) { state.leaving = true; endingScene().then(() => finish(true)); }
    else if (!state.ledgerTaken && !updatePlayer.boatHint) { toast("Not leaving without Veyrane's ledger."); updatePlayer.boatHint = true; }
  } else updatePlayer.boatHint = false;
  checkExits(p);
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
  // 1b. Lift a purse from a passer-by (wins over a takedown when they're the closer of the two)
  const lift = walkerNear(p);
  if (lift && !lift.robbed && behind(lift, p) && (!best || dist(lift, p) <= dist(best, p))) { tryPickpocket(lift); return; }
  if (best) { knockOut(best, true); return; }
  // (from the front it's a clumsy grab and they shout; skip it if you're clearly here to talk to someone else)
  const mark = walkerNear(p);
  const otherNear = npcNear(p) || dist(KID, p) < 44 || dist(FENCE, p) < 44;
  if (mark && (behind(mark, p) || !otherNear)) { tryPickpocket(mark); return; }
  // 2. Tail vault over the estate wall
  for (const v of VAULTS) {
    if (dist(v.wall, p) < 46) {
      const dest = dist(v.a, p) < dist(v.b, p) ? v.b : v.a;
      p.x = dest.x; p.y = dest.y;
      effect('vault', v.wall.x, v.wall.y);
      play('cloth', { vol: 0.9 }); play('swish', { delay: 0.1 });
      toast('Tail on the ledge, over the wall.');
      return;
    }
  }
  // 3. The ledger
  if (!state.ledgerTaken && dist(LEDGER_SPOT, p) < 40) {
    state.ledgerTaken = true;
    p.hasLedger = true;
    play('book'); play('jComplete', { vol: 0.7, delay: 0.25 });
    ledgerScene();
    return;
  }
  // 4. Chests
  for (const c of state.chests) {
    if (!c.opened && dist(c, p) < 40) {
      c.opened = true;
      state.items[c.item] = (state.items[c.item] || 0) + 1;
      noteNewItem(c.item);
      effect('sparkle', c.x, c.y);
      play('latch');
      play('creak', { delay: 0.12 });
      toast(`Found ${c.item}. Press I to open your bag.`, 2600);
      return;
    }
  }
  // 5. The Soot kid (by the street stage in the Lantern Quarter)
  if (dist(KID, p) < 44) {
    talkToKid();
    return;
  }
  // 6. The Blackwater fence
  if (FENCE.x && dist(FENCE, p) < 44) { talkToFence(); return; }
  // 7. People
  const n = npcNear(p);
  if (n) { talkTo(n); return; }
  // 8. Nothing nearby
  if (tileAt(p.x, p.y) !== 'h') toast('Nothing to use here.', 1100);
}

// A crime in front of the city watch: any watchman who can see ZAY or the spot turns hostile.
// watchOnly: a quiet crime (a clean lift) that only a close city watchman could spot.
function witnessCrime(x, y, victim = null, radius = 230, watchOnly = false) {
  const p = state.player;
  let seen = false;
  for (const g of state.guards) {
    if (!(g.watch || (g.escort && !watchOnly)) || g.state === 'down' || g.hostile) continue;
    const sees = (q) => dist(g, q) < radius && lineOfSight(g.x, g.y, q.x, q.y);
    if (g === victim || sees(p) || sees({ x, y })) {
      g.hostile = true;
      seen = true;
      if (g.state !== 'stunned') raiseAlarm(g);
    }
  }
  if (seen) toast('The watch saw that!', 1600);
}

function knockOut(g, silent) {
  g.state = 'down';
  g.meter = 0;
  state.kos += 1;
  effect('ko', g.x, g.y);
  shake(0.2);
  play('thud'); if (!silent) play('chop', { vol: 0.8 });
  if (!silent) noise(g.x, g.y, 120);
  else noise(g.x, g.y, 50);
  witnessCrime(g.x, g.y);
}

function throwCard(aimAtMouse) {
  const p = state.player;
  if (p.cards <= 0) { toast('Out of cards.', 1000); return; }
  p.cards -= 1;
  const a = aimAtMouse && !use3D() ? Math.atan2(mouse.wy - p.y, mouse.wx - p.x) : p.dir;
  state.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 0.62, spin: 0 });
  play('card');
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
        play('chop', { vol: 0.6 });
        witnessCrime(c.x, c.y, g.watch ? g : null);
      }
    }
    if (!c.done && (solidTile(tileAt(c.x, c.y)) || c.life <= 0)) {
      c.done = true;
      noise(c.x, c.y, 175);
      effect('card', c.x, c.y);
      play('uiTick', { vol: 0.9 }); play('card', { delay: 0.02 });
    }
  }
  state.projectiles = state.projectiles.filter((c) => !c.done);
}

// ---------- Guards ----------
function raiseAlarm(g) {
  if (g.state !== 'alert') {
    state.alarms += 1;
    play('jSpotted', { vol: 0.9 });
    toast('Spotted!', 1100);
    shake(0.45);
  }
  g.state = 'alert';
  g.meter = 1;
  g.lostT = 0;
  g.hostile = true;
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

  // The city watch (and a collector's escort) ignore ZAY until someone sees him commit a crime (see witnessCrime).
  if ((g.watch || g.escort) && !g.hostile && g.state !== 'alert') {
    g.state = 'patrol';
    g.meter = 0;
    // An escort keeps formation at the collector's side, facing the way he walks.
    const c = g.escort && (state.walkers || []).find((w) => w.kind === 'collector');
    if (c) {
      const a = c.dir + (g.side || 1) * Math.PI / 2;
      const lead = 6;   // aim a little ahead so they walk level with him instead of trailing
      const tx = c.x + Math.cos(a) * 18 + Math.cos(c.dir) * lead, ty = c.y + Math.sin(a) * 18 + Math.sin(c.dir) * lead;
      move(g, (tx - g.x) * Math.min(1, dt * 14), (ty - g.y) * Math.min(1, dt * 14));
      // Every few seconds each escort glances back over his shoulder (watch the cone, time the lift).
      g.glanceT = (g.glanceT ?? (g.side > 0 ? 2.2 : 4.4)) - dt;
      if (g.glanceT < -1.3) g.glanceT = 3.2 + Math.random() * 2;
      const back = g.glanceT < 0;
      turnTo(g, back ? c.dir + Math.PI : c.dir, dt, 9);
      return;
    }
    if (walkTo(g, g.route[g.ri], g.speed * 0.8, dt)) g.ri = (g.ri + 1) % g.route.length;
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
function shake(amount) { if (SETTINGS.shake) trauma = Math.min(1, trauma + amount); }
function updateCamera(dt = 0, snap = false) {
  const p = state.player;
  const viewW = vw / zoom, viewH = vh / zoom;
  // On touch screens the thumb controls cover the bottom of the view, so keep ZAY in the upper part
  // and let the camera scroll past the map's bottom edge.
  const controls = isTouch ? (vh * 0.34) / zoom : 0;
  // Maps smaller than the screen (like the Crooked Halo) sit in the middle of the visible area.
  const targetX = W * TILE <= viewW ? (W * TILE - viewW) / 2 : Math.max(0, Math.min(W * TILE - viewW, p.x - viewW / 2));
  const targetY = H * TILE <= viewH - controls ? (H * TILE - (viewH - controls)) / 2 : Math.max(0, Math.min(H * TILE - viewH + controls, p.y - (viewH - controls) / 2));
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

// ---------- 2.5D buildings ----------
// A simple 2.5D trick: the camera is tilted, so a roof is drawn a little higher up the screen (ROOF_TILT)
// and scaled up around the point the camera looks at (ROOF_LIFT), so tall things also lean away from
// the centre of the screen. The walls in between show on the sides facing the camera.
const ROOF_LIFT = 0.05;    // perspective lean (0 = none)
const ROOF_TILT = 22;      // how far a roof sits above its footprint on screen, in pixels
const LAMP_LIFT = 0.025;   // lamp heads sit lower than rooftops
let focusX = 0, focusY = 0;
function updateFocus() {
  const controls = isTouch ? (vh * 0.34) / zoom : 0;
  focusX = camLeft() + vw / zoom / 2;
  focusY = camTop() + (vh / zoom - controls) / 2;
}
const liftX = (x, k = ROOF_LIFT) => focusX + (x - focusX) * (1 + k);
const liftY = (y, k = ROOF_LIFT) => focusY + (y - focusY) * (1 + k) - ROOF_TILT * (k / ROOF_LIFT);
const WALL_COLOR = { s: '#7a5c68', e: '#5c4651', w: '#5c4651', n: '#43333c' };
function edgeFacesCamera(e) {
  return e.side === 's' ? liftY(e.y0) < e.y0 : e.side === 'n' ? liftY(e.y0) > e.y0 : e.side === 'e' ? liftX(e.x0) < e.x0 : liftX(e.x0) > e.x0;
}
// A point on a wall: t runs along the base edge (0..1), h is height up the wall (0 = ground, 1 = roof).
function wallPoint(e, t, h) {
  const bx = e.x0 + (e.x1 - e.x0) * t, by = e.y0 + (e.y1 - e.y0) * t;
  return [bx + (liftX(bx) - bx) * h, by + (liftY(by) - by) * h];
}
function quad(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  c.fill();
}
function wallHeight(e) { const [x, y] = wallPoint(e, 0.5, 1); return Math.hypot(x - (e.x0 + e.x1) / 2, y - (e.y0 + e.y1) / 2); }
function windowQuad(e) {
  const w = e.win, h0 = 0.3, h1 = 0.72;
  return [wallPoint(e, w.a, h0), wallPoint(e, w.a + 0.25, h0), wallPoint(e, w.a + 0.25, h1), wallPoint(e, w.a, h1)];
}
function drawBuildings() {
  const visible = EDGES.filter((e) => inView(e.x0, e.y0, 60) && edgeFacesCamera(e));
  // Farthest walls first so nearer ones overlap them.
  visible.sort((a, b) => Math.hypot(b.x0 - focusX, b.y0 - focusY) - Math.hypot(a.x0 - focusX, a.y0 - focusY));
  for (const e of visible) {
    const [bx, by] = wallPoint(e, 0.5, 0), [tx, ty] = wallPoint(e, 0.5, 1);
    const shade = ctx.createLinearGradient(bx, by, tx, ty);
    shade.addColorStop(0, '#17121a');
    shade.addColorStop(1, WALL_COLOR[e.side]);
    ctx.fillStyle = shade;
    quad(ctx, [wallPoint(e, 0, 0), wallPoint(e, 1, 0), wallPoint(e, 1, 1), wallPoint(e, 0, 1)]);
    ctx.fillStyle = 'rgba(0,0,0,.28)';   // darker foundation band
    quad(ctx, [wallPoint(e, 0, 0), wallPoint(e, 1, 0), wallPoint(e, 1, 0.18), wallPoint(e, 0, 0.18)]);
    ctx.fillStyle = 'rgba(138,106,51,.8)'; // balcony rail under the roof
    quad(ctx, [wallPoint(e, 0, 0.86), wallPoint(e, 1, 0.86), wallPoint(e, 1, 0.92), wallPoint(e, 0, 0.92)]);
    if (e.win && !e.win.lit && wallHeight(e) > 14) { ctx.fillStyle = '#1d161c'; quad(ctx, windowQuad(e)); }
  }
  // Roofs: the roof layer drawn scaled up around the focus point (only the visible part).
  const S = 1 + ROOF_LIFT;
  const viewW = vw / zoom, viewH = vh / zoom;
  const sx = Math.max(0, focusX + (camLeft() - focusX) / S - 8), sy = Math.max(0, focusY + (camTop() + ROOF_TILT - focusY) / S - 8);
  const sw = Math.min(roofCanvas.width - sx, viewW / S + 16), sh = Math.min(roofCanvas.height - sy, viewH / S + 16);
  if (sw <= 0 || sh <= 0) return;
  ctx.save();
  ctx.translate(focusX, focusY - ROOF_TILT);
  ctx.scale(S, S);
  ctx.translate(-focusX, -focusY);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(roofCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.restore();
}
// Is this ground point hidden under a drawn roof? (Inverse of the roof transform, then a tile lookup.)
function underRoof(x, y) {
  const S = 1 + ROOF_LIFT;
  return tileAt(focusX + (x - focusX) / S, focusY + (y + ROOF_TILT - focusY) / S) === '#' && tileAt(x, y) !== '#';
}
// Faint see-through outlines for anyone a roof is covering, so stealth stays readable.
function drawXray() {
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (const g of state.guards) if (g.state !== 'down' && inView(g.x, g.y) && underRoof(g.x, g.y)) drawGuard(g);
  const p = state.player;
  if (underRoof(p.x, p.y)) drawPlayer();
  ctx.restore();
}
function drawLitWindows() {
  for (const e of EDGES) {
    if (!e.win || !e.win.lit || !inView(e.x0, e.y0, 60) || !edgeFacesCamera(e) || wallHeight(e) <= 14) continue;
    ctx.fillStyle = 'rgba(240,190,110,0.78)';
    quad(ctx, windowQuad(e));
  }
}

function render() {
  const s = dpr * zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, -camLeft() * s, -camTop() * s);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mapCanvas, 0, 0);
  ctx.imageSmoothingEnabled = true;
  updateFocus();

  drawWater();
  drawFurniture();
  drawProps();
  for (const g of state.guards) if (inView(g.x, g.y)) drawCone(g);
  for (const g of state.guards) if (inView(g.x, g.y)) drawGuard(g);
  drawNpcs();
  drawWalkers();
  drawPlayer();
  for (const c of state.projectiles) drawCard(c.x, c.y, c.spin);
  drawBuildings();
  drawXray();

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
  if (FENCE.x) cutLight(FENCE.x + 10, FENCE.y + 4, 60, 0.7, lightPolygon(FENCE.x + 10, FENCE.y + 4, 60, 40));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(dark, 0, 0);
  ctx.setTransform(s, 0, 0, s, -camLeft() * s, -camTop() * s);

  // Warm glows and emissive bits over the dark
  ctx.globalCompositeOperation = 'lighter';
  for (const l of LAMPS) if (inView(l.x, l.y, l.r)) glow(l.x, l.y, l.r * 0.85, 'rgba(233,170,80,0.2)', l.poly);
  ctx.globalCompositeOperation = 'source-over';
  drawLitWindows();
  drawLabels();
  for (const l of LAMPS) if (inView(l.x, l.y, 40)) drawLamp(l.x, l.y);
  drawEffects();
  drawBarks();
  drawInteractPrompt();
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
  // A post from the ground up to the lamp head, which leans with the camera like the rooftops.
  const hx = liftX(x, LAMP_LIFT), hy = liftY(y, LAMP_LIFT);
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(x, y + 1, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#121019';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = '#121019';
  ctx.beginPath(); ctx.arc(hx, hy + 3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd88a';
  ctx.beginPath(); ctx.arc(hx, hy, 3.2, 0, Math.PI * 2); ctx.fill();
}
function drawWater() {
  const t = state.time;
  // Ripples on every water tile in view (the river can sit anywhere in the Tiled map).
  const tx0 = Math.max(0, Math.floor(camX / TILE)), tx1 = Math.min(W - 1, Math.ceil((camX + vw / zoom) / TILE));
  const ty0 = Math.max(0, Math.floor(camY / TILE)), ty1 = Math.min(H - 1, Math.ceil((camY + vh / zoom) / TILE));
  ctx.strokeStyle = 'rgba(120,160,220,0.18)';
  ctx.lineWidth = 1.5;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (grid[ty][tx] !== 'w') continue;
    for (const oy of [6, 22]) {
      const y = ty * TILE + oy;
      ctx.beginPath();
      for (let x = tx * TILE; x <= tx * TILE + TILE; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.08 + t * 1.6 + y) * 2.5);
      ctx.stroke();
    }
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
  for (const c of state.chests) if (inView(c.x, c.y)) drawChest(c, t);
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
  // The Blackwater fence, hooded, with a lantern on the dock
  if (FENCE.x && inView(FENCE.x, FENCE.y)) {
    const f = FENCE;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d221d';
    ctx.beginPath(); ctx.arc(f.x, f.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5440';
    ctx.beginPath(); ctx.arc(f.x - 1, f.y - 2, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2f2a';
    ctx.beginPath(); ctx.arc(f.x - 1, f.y - 3, 5.5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,214,140,${0.8 + Math.sin(state.time * 7) * 0.15})`;
    ctx.beginPath(); ctx.arc(f.x + 10, f.y + 4, 3, 0, Math.PI * 2); ctx.fill();
  }
  // The Soot kid
  const k = KID;
  ctx.fillStyle = '#2d2a3a';
  ctx.beginPath(); ctx.arc(k.x, k.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a35';
  ctx.beginPath(); ctx.arc(k.x, k.y - 2, 4.5, 0, Math.PI * 2); ctx.fill();
  if (KID.helped) { ctx.fillStyle = '#e9b65a'; ctx.beginPath(); ctx.arc(k.x + 9, k.y + 5, 3, 0, Math.PI * 2); ctx.fill(); }
}
function drawChest(c, t) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(-11, 5, 22, 4);
  ctx.fillStyle = c.opened ? '#3a2a1c' : '#6b4524';
  ctx.fillRect(-11, -6, 22, 12);
  ctx.fillStyle = c.opened ? '#24180f' : '#835a2e';
  ctx.fillRect(-11, -10, 22, c.opened ? 3 : 6);
  ctx.fillStyle = '#e9b65a';
  ctx.fillRect(-11, -5, 22, 1.5);
  if (!c.opened) {
    ctx.fillRect(-2, -5, 4, 5);
    ctx.globalAlpha = 0.5 + Math.sin(t * 3 + c.x) * 0.3;
    ctx.fillStyle = '#fff2c4';
    ctx.fillRect(7, -12, 2, 2);
  }
  ctx.restore();
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
  if (!SETTINGS.cones) return;
  if (g.state === 'down' || g.state === 'stunned') return;
  if (g.watch && !g.hostile) return;   // a calm watchman isn't looking for anyone
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
// Characters stand up like the buildings (sprite stacking): a shadow at the feet, a stack of body
// slices, and the detailed top-down figure on top, leaning with the same camera tilt.
const CHAR_HEIGHT = 0.45;   // fraction of a building's height
const STACK_SLICES = 6;
function standUp(x, y, f = 1) {
  return [(liftX(x) - x) * CHAR_HEIGHT * f, (liftY(y) - y) * CHAR_HEIGHT * f];
}
function drawStack(x, y, dir, rx, ry, low, high) {
  for (let i = 0; i < STACK_SLICES; i++) {
    const f = i / STACK_SLICES;
    const [ox, oy] = standUp(x, y, f);
    ctx.save();
    ctx.translate(x + ox, y + oy);
    ctx.rotate(dir);
    ctx.fillStyle = f < 0.45 ? low : high;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * (f < 0.45 ? 0.8 : 1), ry * (f < 0.45 ? 0.75 : 1), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function feetShadow(x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
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
  ctx.restore();
  feetShadow(g.x, g.y, 12);
  const def = ENEMIES[g.kind] || ENEMIES.guard;
  drawStack(g.x, g.y, g.dir, 10, 12, g.watch ? '#21140f' : '#141a2c', g.windup > 0 ? '#3e1a22' : g.watch ? '#33201a' : '#1c2440');
  const [gox, goy] = standUp(g.x, g.y);
  ctx.save();
  ctx.translate(g.x + gox, g.y + goy);
  ctx.rotate(g.dir);
  ctx.fillStyle = g.windup > 0 ? '#5a2430' : def.coat;
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(170,180,220,.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = def.trim;
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
    const y = g.y + goy - 24;
    if (g.state === 'alert') {
      ctx.fillStyle = '#e2574c';
      ctx.font = '800 16px Barlow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', g.x + gox, y + 5);
    } else if (g.state === 'stunned') {
      ctx.strokeStyle = '#f3d79a'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = state.time * 5 + i * 2.1; ctx.beginPath(); ctx.arc(g.x + gox + Math.cos(a) * 9, y + Math.sin(a) * 3, 1.6, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(g.x + gox, y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = g.meter > 0.35 ? '#f0964a' : '#e9b65a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(g.x + gox, y, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.meter); ctx.stroke();
    }
  }
}
function drawPlayer() {
  const p = state.player;
  const t = state.time;
  ctx.save();
  if (p.invuln > 0 && p.dashT <= 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha *= 0.45;
  if (p.hidden) ctx.globalAlpha *= 0.55;
  feetShadow(p.x, p.y, 11);
  drawStack(p.x, p.y, p.dir, 9, 11, '#08080c', '#0e0e14');
  const [pox, poy] = standUp(p.x, p.y);
  ctx.translate(p.x + pox, p.y + poy);
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
  // Body: black rogue layers on a job; in town, his long charcoal coat over a tan shirt (model sheet).
  const town = (DISTRICTS[state.district] || {}).look === 'town';
  ctx.fillStyle = town ? '#2c2f36' : '#121218';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  if (town) { ctx.fillStyle = '#b39a72'; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(1, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(150,160,205,.35)'; ctx.lineWidth = 1; ctx.stroke();   // moonlit rim
  // Katana across the back
  ctx.strokeStyle = '#c9c9d6';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(6, 10); ctx.stroke();
  ctx.fillStyle = '#e9b65a';
  ctx.fillRect(-11, -11, 3, 3);
  // Hood and eyes (rogue) or bare head with his locs ponytail (town)
  if (town) {
    ctx.fillStyle = '#5a3b2b'; ctx.beginPath(); ctx.arc(2, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a110c'; ctx.beginPath(); ctx.arc(1, 0, 6.3, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    ctx.strokeStyle = '#1a110c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-9, 1, -12, -1); ctx.stroke();
  } else {
    ctx.fillStyle = '#1c1c26';
    ctx.beginPath(); ctx.arc(2, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  }
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
  if (p.hasLedger) { ctx.fillStyle = '#7a1f22'; ctx.fillRect(p.x + pox + 8, p.y + poy - 16, 8, 6); }
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
  const goal = objectiveInfo().goal;
  if (!goal) return;
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
  cards: document.getElementById('cards'), vis: document.getElementById('vis'), rep: document.getElementById('rep'), objective: document.getElementById('objective')
};
let hudCache = '';
function updateHud() {
  const p = state.player;
  const vis = p.hidden ? 'Hidden' : p.lit ? 'In the light' : 'Shadow';
  const objective = objectiveInfo().text;
  const lead = state.party[0];
  const tier = repTier();
  const key = [lead.hp, p.gold, p.cards, vis, objective, tier.label].join('|');
  if (key === hudCache) return;
  hudCache = key;
  hudEls.hpFill.style.transform = `scaleX(${lead.hp / lead.maxHp})`;
  hudEls.hpText.textContent = `${lead.hp}/${lead.maxHp}`;
  hudEls.gold.textContent = p.gold;
  hudEls.cards.textContent = p.cards;
  hudEls.vis.textContent = vis;
  hudEls.vis.className = 'vis' + (p.lit ? ' lit' : p.hidden ? ' hidden-state' : '');
  hudEls.rep.textContent = tier.label;
  hudEls.rep.className = 'vis hud-tip' + (tier.mood ? ' rep-' + tier.mood : '');
  hudEls.objective.textContent = objective;
}

// ---------- Flow ----------
function finish(won) {
  if (state.over) return;
  state.over = true;
  state.running = false;
  const p = state.player;
  // A finished job is saved; getting caught isn't, so the next try starts from the last save.
  let saveNote = loadSave() ? 'Not saved · back to your last save' : 'Not saved';
  if (won) {
    state.jobsDone.add('veyrane-ledger');
    rememberDistrict();
    // You come back to the city by the Crooked Halo after a job.
    saveNote = writeSave({ district: START_DISTRICT, spawn: 'halo' }) ? 'Saved on this device' : 'Could not save (browser storage is off)';
  }
  document.getElementById('again').textContent = won ? 'Back to the Lantern Quarter' : loadSave() ? 'Try again from your last save' : 'Try again';
  const end = document.getElementById('end');
  const mins = Math.floor(state.time / 60), secs = String(Math.floor(state.time % 60)).padStart(2, '0');
  let rating;
  if (!won) rating = 'Caught';
  else if (state.alarms === 0 && state.kos === 0) rating = 'Ghost of the Lantern Quarter';
  else if (state.alarms === 0) rating = 'Shadow';
  else if (state.alarms <= 2) rating = 'Rogue';
  else rating = 'Brawler — the guild will have words';
  document.getElementById('end-kicker').textContent = won ? 'Job complete' : state.district === 'crown-estate' ? 'Job failed' : 'Caught';
  document.getElementById('end-title').textContent = rating;
  document.getElementById('end-text').textContent = won
    ? (p.given > 0 ? 'The boat slides off into the dark with the ledger, and a Soot kid has eaten well tonight.' : 'The boat slides off into the dark with the ledger. Noe never has to know how close it was.')
    : state.district === 'crown-estate' ? 'Veyrane’s guards drag ZAY into the lantern light. Severin will hear about this.'
      : 'The city watch drags ZAY off to the Crown Quarter cells. Noe will hear about this by morning.';
  const stats = [
    ['Time', `${mins}:${secs}`],
    ['Times spotted', state.alarms],
    ['Battles', state.battles],
    ['ZAY reached', `Level ${state.party[0].level}`],
    ['Stolen in battle', state.stolen.length ? state.stolen.join(', ') : 'nothing'],
    ['Guards knocked out', state.kos],
    ['Casualties', '0 · the code held'],
    ['Gold given away', p.given],
    ['Name in the Quarter', repTier().label],
    ['Gold kept', p.gold],
    ['Progress', saveNote]
  ];
  document.getElementById('end-stats').innerHTML = stats.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.getElementById('touch').hidden = true;
  end.hidden = false;
  setMusic(null);
  play(won ? 'jComplete' : 'jCaught');
}

// fromSave: carry over the saved character (gold, items, gear, level, Name, jobs) and where you were,
// instead of starting fresh in the Lantern Quarter.
async function start(fromSave = false) {
  initAudio();
  const save = fromSave ? loadSave() : null;
  state = newState();
  KID.helped = false;
  if (save) applySave(save);
  const where = save && DISTRICTS[save.district] ? save.district : START_DISTRICT;
  if (!(await enterDistrict(where, save ? save.spawn : 'start', { save: !save }))) return;
  hudCache = '';
  state.running = true;
  document.getElementById('title').hidden = true;
  document.getElementById('end').hidden = true;
  document.getElementById('pause').hidden = true;
  document.getElementById('battle-ui').hidden = true;
  document.getElementById('inventory').hidden = true;
  INV.open = false;
  B.active = false;
  hudEls.hud.hidden = false;
  document.getElementById('touch').hidden = !isTouch;
  trauma = 0;
  updateCamera(0, true);
  setMusic('night');
  updateHud();
  BARKS.length = 0;
  if (!save) setTimeout(() => { if (state.running && state.mode === 'field') openingScene(); }, 350);
  updateBagBadge();
}
function togglePause() {
  state.paused = !state.paused;
  suspendMusic(state.paused);
  document.getElementById('pause').hidden = !state.paused;
}
document.getElementById('start').addEventListener('click', async () => {
  if (loadSave()) {
    const ok = await askConfirm('Start a new game?', 'Your saved game on this device will be erased: gold, items, levels and your Name.', 'New game');
    if (!ok) return;
    clearSave();
  }
  start();
});
document.getElementById('continue').addEventListener('click', () => start(true));
document.getElementById('again').addEventListener('click', () => start(!!loadSave()));
document.getElementById('resume').addEventListener('click', togglePause);
document.getElementById('restart-pause').addEventListener('click', async () => {
  const saved = !!loadSave();
  const ok = await askConfirm('Restart the level?', saved
    ? 'ZAY goes back to your last save. Anything since then is lost.'
    : 'ZAY goes back to the start of the Lantern Quarter. Everything from this run is lost: gold, items, levels.', 'Restart');
  if (ok) start(saved);
});
document.getElementById('pause-btn').addEventListener('click', () => { if (state.running) togglePause(); });

// Battles always draw on the 2D canvas; the field uses the 3D canvas when that view is on.
function show3D(on) {
  if (!window.R3D || R3D.canvas.hidden === !on) return;
  R3D.canvas.hidden = !on;
  canvas.hidden = on;
}
let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  pollGamepad();
  if (state.running && !state.paused) {
    state.time += dt;
    if (state.mode === 'battle') updateBattle(dt);
    else if (state.mode === 'inventory') updateInventory();
    else if (state.mode === 'dialog') { if (DLG.prevMode === 'battle') updateBattle(dt); updateDialog(dt); }
    else if (state.mode === 'shop') updateShop();
    else if (state.mode === 'loading') { /* a district is loading */ }
    else {
      updatePlayer(dt);
      updateProjectiles(dt);
      for (const g of state.guards) updateGuard(g, dt);
      updateWalkers(dt);
      updateBarks(dt);
      checkOverhear();
      for (const e of state.effects) e.t += dt;
      state.effects = state.effects.filter((e) => e.t < 0.7);
      updateHud();
    }
  }
  pressed.clear();
  const field3d = !!LEVEL && state.mode !== 'battle' && use3D();
  show3D(field3d);
  if (!LEVEL) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#07080f'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  else if (state.mode === 'battle') renderBattle();
  else {
    updateCamera(dt);
    if (field3d) R3D.render(dt); else render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const startBtn = document.getElementById('start');
// Title buttons: Continue + New game when there's a save, otherwise just Begin the job.
function refreshTitle() {
  const save = loadSave();
  const cont = document.getElementById('continue'), summary = document.getElementById('save-summary');
  cont.hidden = !save;
  summary.hidden = !save;
  if (save) summary.textContent = 'Saved on this device: ' + saveSummary(save);
  startBtn.textContent = save ? 'New game' : 'Begin the job';
  startBtn.className = 'btn ' + (save ? 'btn--secondary' : 'btn--primary');
  // Returning players shouldn't have to scroll past the instructions to find Continue.
  if (save) document.querySelector('#title .lede').after(summary, startBtn.parentElement);
}
startBtn.disabled = true;
startBtn.textContent = 'Loading the city…';
loadDistrict(START_DISTRICT)
  .then((map) => {
    buildLevel(map);
    state = newState();
    startBtn.disabled = false;
    refreshTitle();
  })
  .catch(() => { startBtn.textContent = 'Could not load the level. Reload to try again.'; });
