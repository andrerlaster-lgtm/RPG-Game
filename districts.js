'use strict';

// Districts: Bellemorne is split into Tiled maps you walk between (see README, "Districts").
// Walk into an `exit` object to load its district at the named `spawn`. Your character (gold, items,
// gear, level, Name, jobs) comes with you; each district remembers its opened chests and picked-up
// coins and cards, but guards reset every visit. Entering a district saves the game.

const DISTRICTS = {
  lantern: { url: 'levels/lantern-quarter.tmj', name: 'Lantern Quarter', look: 'town' },
  'crooked-halo': { url: 'levels/crooked-halo.tmj', name: 'The Crooked Halo', look: 'town' },
  'crown-estate': { url: 'levels/paper-thief.tmj', name: 'Crown Quarter · House Veyrane estate', look: 'rogue' }
};
const START_DISTRICT = 'lantern';

const mapCache = {};
function loadDistrict(id) {
  if (!mapCache[id]) {
    mapCache[id] = fetch(DISTRICTS[id].url)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch((e) => { delete mapCache[id]; throw e; });
  }
  return mapCache[id];
}

// What a district remembers between visits (stored in the save as state.world).
function rememberDistrict() {
  if (!state.district) return;
  const taken = (list, key) => list.map((x, i) => (x[key] ? i : -1)).filter((i) => i >= 0);
  state.world[state.district] = {
    chests: taken(state.chests, 'opened'),
    coins: taken(state.coins, 'taken'),
    cards: taken(state.cardPickups, 'taken')
  };
}

// Fresh per-visit state for the current LEVEL: guards, pickups, alarms. The character is untouched.
function resetDistrict() {
  const mem = state.world[state.district] || {};
  const has = (list, i) => (list || []).includes(i);
  state.chests = LEVEL.chests.map((c, i) => ({ ...c, opened: has(mem.chests, i) }));
  state.coins = LEVEL.coins.map((c, i) => ({ ...c, taken: has(mem.coins, i) }));
  state.cardPickups = LEVEL.cards.map((c, i) => ({ ...c, taken: has(mem.cards, i) }));
  state.overhears = LEVEL.overhears.map((o) => ({ ...o, done: false }));
  state.guards = GUARD_ROUTES.map(makeGuard);
  state.projectiles = [];
  state.effects = [];
  state.alarms = 0;
  state.kos = 0;
  state.battles = 0;
  state.stolen = [];
  state.time = 0;
  state.ledgerTaken = state.jobsDone.has('veyrane-ledger');
  state.leaving = false;
  state.player.hasLedger = false;
  state.npcs = presentNpcs();
  BARKS.length = 0;
}

const fadeEl = document.getElementById('fade');
async function enterDistrict(id, spawn = 'start', { save = true } = {}) {
  if (!DISTRICTS[id]) return false;
  rememberDistrict();
  const prevMode = state.mode;
  state.mode = 'loading';
  fadeEl.classList.add('is-on');
  let map;
  try { map = await loadDistrict(id); } catch {
    toast(`Couldn't load the ${DISTRICTS[id].name}. Check your connection and try again.`, 3200);
    state.mode = prevMode === 'loading' ? 'field' : prevMode;
    fadeEl.classList.remove('is-on');
    return false;
  }
  buildLevel(map);
  state.district = id;
  state.spawn = SPAWNS[spawn] ? spawn : 'start';
  resetDistrict();
  const at = SPAWNS[state.spawn];
  state.player.x = at.x; state.player.y = at.y;
  // Exits stay off until you've walked a little way from where you arrived, so holding the direction you
  // came in doesn't bounce you straight back through the door.
  state.exitLock = true;
  state.arrival = { x: at.x, y: at.y };
  updateCamera(0, true);
  hudCache = '';
  state.mode = 'field';
  fadeEl.classList.remove('is-on');
  toast(DISTRICTS[id].name, 2000);
  if (save) writeSave();
  return true;
}

// Called every field frame: walking into an exit travels, unless guards are on you.
function checkExits(p) {
  const inside = EXITS.find((e) => p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h);
  if (state.exitLock) {
    if (!inside && (!state.arrival || dist(p, state.arrival) > 44)) state.exitLock = false;
    return;
  }
  if (!inside) { checkExits.warned = false; return; }
  if (state.mode !== 'field') return;
  if (state.guards.some((g) => g.state === 'alert')) {
    if (!checkExits.warned) { toast('Lose the guards first.'); checkExits.warned = true; }
    return;
  }
  state.exitLock = true;
  enterDistrict(inside.to, inside.spawn);
}

// The HUD objective line and where the gold arrow points, for the current district.
function objectiveInfo() {
  const done = state.jobsDone.has('veyrane-ledger');
  const exitTo = (to) => { const e = EXITS.find((x) => x.to === to); return e ? { x: e.x + e.w / 2, y: e.y + e.h / 2 } : null; };
  if (state.district === 'crown-estate') {
    if (done && !state.player.hasLedger) return { text: 'Nothing left here tonight. Head back to the Lantern Quarter.', goal: exitTo('lantern') };
    if (!state.ledgerTaken) return { text: "Steal the ledger from House Veyrane's counting house", goal: LEDGER_SPOT };
    return { text: 'Reach the river boat', goal: BOAT };
  }
  const taken = state.jobsTaken.has('veyrane-ledger');
  const reported = state.deeds.reportedLedger;
  const noe = () => (state.npcs || []).find((n) => n.who === 'noe') || null;
  if (state.district === 'crooked-halo') {
    if (!taken && !done) return { text: 'Noe wants a word. She’s behind the bar.', goal: noe() };
    if (!done) return { text: "Head east to the Crown Quarter: House Veyrane's estate", goal: exitTo('lantern') };
    if (!reported) return { text: 'Tell Noe it’s done.', goal: noe() };
    return { text: 'Noe keeps the peace in here.', goal: null };
  }
  if (!taken && !done) return { text: 'Noe wants a word. Find her at the Crooked Halo.', goal: exitTo('crooked-halo') };
  if (!done) return { text: "Head east to the Crown Quarter: House Veyrane's estate", goal: exitTo('crown-estate') };
  if (!reported) return { text: 'Tell Noe it’s done. She’s at the Crooked Halo.', goal: exitTo('crooked-halo') };
  return { text: 'The Lantern Quarter is yours tonight.', goal: null };
}

// Place names painted over the map (Tiled `label` objects), drawn above the night overlay.
function drawLabels() {
  ctx.font = '700 11px Cinzel, serif';
  ctx.textAlign = 'center';
  for (const l of LABELS) {
    if (!inView(l.x, l.y, 80)) continue;
    const x = liftX(l.x), y = liftY(l.y);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillText(l.text, x + 1, y + 1);
    ctx.fillStyle = 'rgba(243,215,154,.92)';
    ctx.fillText(l.text, x, y);
  }
}
