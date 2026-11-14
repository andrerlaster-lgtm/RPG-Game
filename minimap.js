'use strict';

// HUD extras for the field: a round minimap (top right) and the district's name card when you arrive.
// The minimap shows the streets around ZAY, where the objective and the ways out are, and only the guards
// ZAY could see for himself (close by with a clear line of sight) or who are already chasing him, so it
// never gives away more than the vision cones on the ground do.

const MINI = { el: document.getElementById('minimap'), map: document.createElement('canvas'), px: 4, tick: 0, built: null };
MINI.ctx = MINI.el.getContext('2d');
const MINI_COLOURS = { '#': '#1b1a26', '.': '#5a586a', g: '#2f4a34', h: '#3c6a42', f: '#5a4334', w: '#1f3f73', d: '#7a5a3a' };

function buildMinimap() {
  const P = MINI.px, c = MINI.map;
  c.width = W * P; c.height = H * P;
  const x = c.getContext('2d');
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { x.fillStyle = MINI_COLOURS[grid[ty][tx]] || '#1b1a26'; x.fillRect(tx * P, ty * P, P, P); }
  x.fillStyle = '#3a2c22';
  for (const pr of PROPS) x.fillRect(pr.x / TILE * P, pr.y / TILE * P, pr.w / TILE * P, pr.h / TILE * P);
  x.fillStyle = '#3c6a42';
  for (const q of TREES) { x.beginPath(); x.arc(q.x / TILE * P, q.y / TILE * P, P * 0.6, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = 'rgba(255,190,110,.5)';
  for (const l of LAMPS) { x.beginPath(); x.arc(l.x / TILE * P, l.y / TILE * P, 1.4, 0, Math.PI * 2); x.fill(); }
  MINI.built = LEVEL;
}

function drawMinimap() {
  const show = state.running && state.mode === 'field' && !!LEVEL;
  if (MINI.el.hidden === show) MINI.el.hidden = !show;
  if (!show || (MINI.tick++ & 1)) return;        // every other frame is plenty
  if (MINI.built !== LEVEL) buildMinimap();
  const c = MINI.ctx, size = MINI.el.width, half = size / 2, P = MINI.px, k = P / TILE, p = state.player;
  // In 3D the map turns with the camera, so "up" on the map is the way you're looking.
  const turn = use3D() && R3D.heading ? -R3D.heading() - Math.PI / 2 : 0;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, size, size);
  c.save();
  c.beginPath(); c.arc(half, half, half - 1, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#0b0c16'; c.fillRect(0, 0, size, size);
  c.translate(half, half); c.rotate(turn); c.translate(-p.x * k, -p.y * k);
  c.imageSmoothingEnabled = false;
  c.drawImage(MINI.map, 0, 0);
  // Ways out
  c.fillStyle = '#f3d79a';
  for (const e of EXITS) c.fillRect((e.x + e.w / 2) * k - 2, (e.y + e.h / 2) * k - 2, 4, 4);
  // Guards ZAY can see, or who are after him
  for (const g of state.guards) {
    if (g.state === 'down' || (g.watch && !g.hostile)) continue;
    const seen = g.state === 'alert' || (dist(g, p) < 300 && lineOfSight(g.x, g.y, p.x, p.y));
    if (!seen) continue;
    c.fillStyle = g.state === 'alert' ? '#ff5a4c' : g.state === 'calm' || g.state === 'patrol' ? '#e9b65a' : '#f0964a';
    c.beginPath(); c.arc(g.x * k, g.y * k, 2.6, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  // The objective: a gold ring, pinned to the rim when it's off the map
  const goal = objectiveInfo().goal;
  if (goal) {
    const dx = (goal.x - p.x) * k, dy = (goal.y - p.y) * k, cs = Math.cos(turn), sn = Math.sin(turn);
    let gx = dx * cs - dy * sn, gy = dx * sn + dy * cs;
    const d = Math.hypot(gx, gy), max = half - 7;
    if (d > max) { gx *= max / d; gy *= max / d; }
    c.strokeStyle = '#f3d79a'; c.lineWidth = 2;
    c.beginPath(); c.arc(half + gx, half + gy, d > max ? 3 : 4.5, 0, Math.PI * 2); c.stroke();
    if (d > max) { c.fillStyle = '#f3d79a'; c.fill(); }
  }
  // ZAY: an arrow showing which way he faces
  c.save();
  c.translate(half, half); c.rotate(p.dir + turn);
  c.fillStyle = '#fff4d6'; c.strokeStyle = '#1a1206'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, -4); c.lineTo(-2, 0); c.lineTo(-4, 4); c.closePath(); c.fill(); c.stroke();
  c.restore();
  // North mark, so the turning map still tells you which way the city lies
  c.fillStyle = 'rgba(243,215,154,.9)'; c.font = '700 10px Barlow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', half + Math.sin(turn) * (half - 9), half - Math.cos(turn) * (half - 9));
}

// The district's name, shown large for a moment when you arrive.
const bannerEl = document.getElementById('banner');
function showBanner(title, sub = '') {
  bannerEl.querySelector('.banner-title').textContent = title;
  bannerEl.querySelector('.banner-sub').textContent = sub;
  bannerEl.hidden = false;
  bannerEl.classList.remove('is-on');
  void bannerEl.offsetWidth;   // restart the fade
  bannerEl.classList.add('is-on');
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => { bannerEl.hidden = true; }, 3400);
}
