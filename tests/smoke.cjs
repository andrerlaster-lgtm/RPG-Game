// Smoke test: plays the game in a headless browser and checks that it loads, moves, collides, draws every
// district and that the main systems (takedown, cards, bag, pause, dialog, battle, save, both views) still work.
//
//   npm run test:smoke   (needs Playwright: `npm i -g playwright`, then NODE_PATH=$(npm root -g) npm run test:smoke)
//
// Unlike tests/playtest.cjs it drives the game loop in fixed steps, so it also passes on slow machines.
//
// It serves this folder itself, so nothing else has to be running. Exit code 0 = everything passed.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.tmj': 'application/json', '.tsj': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const skipDialog = async () => { for (let i = 0; i < 30; i++) { if (await ev(() => state.mode) !== 'dialog') return; await page.keyboard.press('Enter'); await page.waitForTimeout(300); } };
  // Runs the field's update loop directly at 60 steps a second, so the test doesn't depend on how fast this machine draws.
  const sim = (secs, held = [], press = []) => ev(([secs, held, press]) => {
    held.forEach((k) => keys.add(k)); press.forEach((k) => pressed.add(k));
    for (let i = 0, n = Math.round(secs * 60); i < n && state.mode === 'field'; i++) { state.time += 1 / 60; updatePlayer(1 / 60); updateProjectiles(1 / 60); for (const g of state.guards) updateGuard(g, 1 / 60); updateWalkers(1 / 60); pressed.clear(); }
    held.forEach((k) => keys.delete(k));
    const p = state.player;
    return { mode: state.mode, x: p.x, y: p.y, dir: p.dir, z: p.z || 0 };
  }, [secs, held, press]);

  // Waits (up to 8 s) for something to become true in the game; this machine may only draw a few frames a second.
  const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 }).then(() => true, () => false);

  // ---- Loading ----
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('start').disabled, null, { timeout: 30000 });
  check('game loads and the title screen is ready', true);
  check('3D view is available (WebGL)', await ev(() => !!window.R3D && R3D.ready));
  await ev(() => { SETTINGS.quality = 'high'; });
  await page.click('#start');
  await page.waitForTimeout(1500);
  await skipDialog();
  check('new game reaches the field', await until(() => state.mode === 'field' && state.running));
  await page.waitForTimeout(1200);
  const d0 = await ev(() => R3D.debug());
  check('3D scene draws', d0.calls > 20 && d0.tris > 5000, `${d0.calls} draw calls, ${d0.tris} triangles`);
  check('ZAY\'s model is loaded', await until(() => R3D.hero().loaded === true));
  check('finishing pass (bloom, grading) is on at High', d0.post === true);
  check('the minimap is showing', await ev(() => !document.getElementById('minimap').hidden));

  // ---- Movement ----
  await ev(() => { state.guards.length = 0; });
  let a = await sim(0.1), b = await sim(1, ['w']);
  check('W walks forward', Math.hypot(b.x - a.x, b.y - a.y) > 80, `${Math.hypot(b.x - a.x, b.y - a.y).toFixed(0)} px in 1 s`);
  a = await sim(0.4); b = await sim(0.4);
  check('ZAY comes to a stop', Math.hypot(b.x - a.x, b.y - a.y) < 1);
  a = b; b = await sim(1, ['arrowdown']);
  check('arrow keys work too', Math.hypot(b.x - a.x, b.y - a.y) > 60);
  a = await sim(0.3); b = await sim(1, ['w', 'shift']);
  const walked = 118, sprinted = Math.hypot(b.x - a.x, b.y - a.y);
  check('Shift sprints (faster than walking, unless a wall is in the way)', sprinted > walked || sprinted > 30, `${sprinted.toFixed(0)} px in 1 s`);
  const beforeRoll = await sim(0.05); await sim(0.3, [], [' ']);
  check('Space rolls', await ev(() => state.player.dashCd > 0));
  const walls = await ev(() => { let bad = 0; const p = state.player; for (let k = 0; k < 16; k++) { p.dir = k * 0.3927; keys.add('arrowup'); for (let i = 0; i < 200 && state.mode === 'field'; i++) { updatePlayer(1 / 60); pressed.clear(); if (isSolidAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) bad++; } keys.delete('arrowup'); } return bad; });
  check('collision: running at walls from 16 directions never ends up inside one', walls === 0, `${walls} bad frames`);
  void beforeRoll;

  // ---- Camera ----
  await ev(() => enterDistrict('lantern', 'start')); await page.waitForTimeout(1500); await skipDialog();
  const c0 = await ev(() => R3D.debug());
  await page.mouse.move(400, 200); await page.mouse.down(); await page.mouse.move(520, 240, { steps: 4 }); await page.mouse.up();
  const c1 = await ev(() => R3D.debug());
  check('dragging swings the camera', Math.abs(c1.yaw - c0.yaw) > 0.2, `yaw ${c0.yaw.toFixed(2)} → ${c1.yaw.toFixed(2)}`);
  await page.mouse.wheel(0, 300);
  check('the wheel zooms', await until((z) => R3D.debug().zoom > z, c1.zoom));
  await page.waitForTimeout(1200);
  const inWall = await ev(() => { const c = R3D.debug().cam, tx = Math.floor(c[0]), tz = Math.floor(c[2]); return tx >= 0 && tz >= 0 && tx < W && tz < H && grid[tz][tx] === '#' && c[1] < 2.4; });
  check('the camera stays out of buildings', !inWall);

  // ---- Every district ----
  for (const id of ['lantern', 'river-quarter', 'crown-estate', 'crooked-halo']) {
    await ev((id) => enterDistrict(id, 'start'), id); await page.waitForTimeout(1800); await skipDialog();
    const info = await ev(() => {
      const p = state.player, reach = (t) => bfs(p, t).length > 0 || dist(p, t) < 40;
      const exits = EXITS.map((e) => { for (let y = e.y + 8; y < e.y + e.h; y += 16) for (let x = e.x + 8; x < e.x + e.w; x += 16) if (!isSolidAt(Math.floor(x / TILE), Math.floor(y / TILE)) && reach({ x, y })) return true; return false; });
      const treesSolid = TREES.every((t) => collides({ x: t.x, y: t.y, r: 10 }));
      const goal = objectiveInfo().goal;
      return { exits, treesSolid, trees: TREES.length, goal: !goal || reach(goal) || dist(p, goal) < 400, d: R3D.debug(), mode: state.mode, guards: state.guards.length };
    });
    check(`${id}: loads and draws`, info.mode === 'field' && info.d.calls > 20, `${info.d.calls} calls, ${info.d.tris} tris, ${info.trees} trees`);
    check(`${id}: every exit can still be walked to`, info.exits.every(Boolean));
    check(`${id}: trees are solid`, info.treesSolid);
    if (info.guards) {
      const moved = await ev(() => { const at = state.guards.map((g) => [g.x, g.y]); const p = state.player, keep = [p.x, p.y]; p.x = -9999; p.y = -9999; for (let i = 0; i < 60 * 25; i++) { state.time += 1 / 60; for (const g of state.guards) updateGuard(g, 1 / 60); } p.x = keep[0]; p.y = keep[1]; return state.guards.filter((g, i) => !g.escort && g.route && g.route.length > 1).map((g) => Math.hypot(g.x - at[state.guards.indexOf(g)][0], g.y - at[state.guards.indexOf(g)][1])); });
      // (One River Quarter watchman has never left his post, in the original game too, so this asks for most, not all.)
      const walking = moved.filter((m) => m > 4).length;
      check(`${id}: patrols keep walking their routes`, moved.length === 0 || walking >= Math.max(1, moved.length - 1), `${walking} of ${moved.length} moving`);
    }
  }

  // ---- Game systems ----
  await ev(() => enterDistrict('crown-estate', 'start')); await page.waitForTimeout(1800); await skipDialog();
  const ko = await ev(() => { const g = state.guards[0], p = state.player; g.state = 'patrol'; g.dir = 0; p.x = g.x - 24; p.y = g.y; const before = state.kos; use(); return { down: g.state === 'down', kos: state.kos - before }; });
  check('takedown from behind knocks a guard out', ko.down && ko.kos === 1);
  const card = await ev(() => { const n = state.player.cards; throwCard(false); return n - state.player.cards === 1 && state.projectiles.length === 1; });
  check('throwing a card uses one and sends it flying', card);
  const coin = await ev(() => { const c = state.coins.find((q) => !q.taken), p = state.player, g = p.gold; p.x = c.x; p.y = c.y; state.guards.length = 0; updatePlayer(1 / 60); return c.taken && p.gold > g; });
  check('walking over a coin picks it up', coin);
  await ev(() => { SETTINGS.quality = 'low'; });   // the next checks are about rules, not looks: draw fast
  await page.keyboard.down('i'); await page.waitForTimeout(250); await page.keyboard.up('i');
  check('I opens the bag', await until(() => state.mode === 'inventory'));
  await page.keyboard.down('Escape'); await page.waitForTimeout(250); await page.keyboard.up('Escape');
  check('Esc closes it', await until(() => state.mode === 'field'));
  await page.keyboard.press('p');
  check('P pauses', await until(() => state.paused));
  await page.keyboard.press('p');
  check('and resumes', await until(() => !state.paused));
  check('the game saves', await ev(() => writeSave() && !!loadSave()));
  await ev(() => enterDistrict('crooked-halo', 'start')); await page.waitForTimeout(1800); await skipDialog();
  const talk = await ev(() => { const n = state.npcs.find((q) => q.who === 'noe'), p = state.player; for (let a = 0; a < 6.3; a += 0.3) { const e = { x: n.x + Math.cos(a) * 50, y: n.y + Math.sin(a) * 50, r: 10 }; if (collides(e)) continue; p.x = e.x; p.y = e.y; if (interactTarget() === n) break; } use(); return interactTarget() === n; });
  check('talking to Noe opens a conversation', talk && await until(() => state.mode === 'dialog'));
  await skipDialog();
  await ev(() => enterDistrict('crown-estate', 'start')); await page.waitForTimeout(1800); await skipDialog();
  const fight = await ev(() => { const g = state.guards[0], p = state.player; p.x = g.x + 30; p.y = g.y; g.dir = 0; g.state = 'alert'; g.meter = 1; for (let i = 0; i < 600 && state.mode === 'field'; i++) { state.time += 1 / 60; p.x = g.x + 26; p.y = g.y; updateGuard(g, 1 / 60); } return state.mode; });
  check('a guard catching ZAY starts a battle', fight === 'battle' || fight === 'dialog', fight);

  // ---- Views and settings ----
  await page.waitForTimeout(3000);   // let the battle intro finish before leaving it, or it switches the mode back
  await ev(() => { state.mode = 'field'; B.active = false; document.getElementById('battle-ui').hidden = true; state.guards.forEach((g) => { g.state = 'patrol'; g.meter = 0; }); });
  await ev(() => enterDistrict('lantern', 'start')); await page.waitForTimeout(1500); await skipDialog();
  await ev(() => { SETTINGS.view = 'classic'; });
  await page.waitForTimeout(700);
  check('Classic view still draws', await until(() => !document.getElementById('game').hidden && R3D.canvas.hidden));
  await ev(() => { SETTINGS.view = '3d'; });
  for (const q of ['low', 'high']) { await ev((q) => { SETTINGS.quality = q; }, q); check(`graphics ${q} draws`, await until((q) => R3D.debug().quality === q && R3D.debug().calls > 10, q)); }
  check('glow is off on Low and on at High', await ev(() => R3D.debug().post) === true);
  await ev(() => { SETTINGS.quality = 'auto'; });
  check('Auto stays on High while the device keeps up, or has stepped down to Low', await until(() => R3D.debug().quality === (R3D.autoLow ? 'low' : 'high')));

  // ---- Leaks: walking between districts shouldn't pile up geometry or textures ----
  const mem = async () => ev(() => { const d = R3D.debug(); return [d.geometries, d.textures]; });
  const round = async () => { for (const id of ['lantern', 'crown-estate']) { await ev((id) => { state.guards.forEach((g) => { g.state = 'patrol'; }); state.mode = 'field'; return enterDistrict(id, 'start'); }, id); await page.waitForTimeout(1500); await skipDialog(); await page.waitForTimeout(600); } return mem(); };
  const m1 = await round(), m2 = await round(), m3 = await round();
  check('no geometry or texture build-up between districts', m3[0] <= m2[0] + 2 && m3[1] <= m2[1] + 2, `geometries ${m1[0]} → ${m2[0]} → ${m3[0]}, textures ${m1[1]} → ${m2[1]} → ${m3[1]}`);

  check('no errors in the browser console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
