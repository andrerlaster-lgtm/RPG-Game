'use strict';

// Saved game: kept in this browser on this device (localStorage), never sent anywhere.
// It is written when you enter a district and when a job is completed. Getting caught does not save, so you go back to the last save.
// Bump SAVE_VERSION if the shape changes; an old or broken save is ignored instead of crashing the game.

const SAVE_KEY = 'bellemorne-paper-thief-save';
const SAVE_VERSION = 1;
const SAVED_STATS = ['level', 'exp', 'maxHp', 'maxMp', 'atk', 'def', 'mag', 'spd'];

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return s && s.v === SAVE_VERSION ? s : null;
  } catch { return null; }
}

// where: override the saved location (after a job you return to the city).
function writeSave(where = {}) {
  const p = state.player;
  const data = {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    gold: p.gold, given: p.given, cards: p.cards,
    items: { ...state.items },
    party: state.party.map((m) => {
      const out = { id: m.id, equip: { ...m.equip } };
      for (const k of SAVED_STATS) out[k] = m[k];
      return out;
    }),
    rep: state.rep, deeds: { ...state.deeds },
    kidHelped: KID.helped,
    jobsDone: [...state.jobsDone],
    jobsTaken: [...state.jobsTaken],
    district: where.district || state.district,
    spawn: where.spawn || state.spawn,
    world: state.world
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}

// Put a save onto a fresh state from newState(). Party members are matched by id; HP and MP start full.
function applySave(s) {
  const p = state.player;
  p.gold = s.gold || 0; p.given = s.given || 0; p.cards = s.cards ?? p.cards;
  state.items = { ...s.items };
  for (const saved of s.party || []) {
    const m = state.party.find((x) => x.id === saved.id);
    if (!m) continue;
    for (const k of SAVED_STATS) if (typeof saved[k] === 'number') m[k] = saved[k];
    m.equip = { ...m.equip, ...saved.equip };
    m.hp = m.maxHp; m.mp = m.maxMp;
  }
  state.rep = s.rep || 0;
  state.deeds = { ...s.deeds };
  KID.helped = !!s.kidHelped;
  state.jobsDone = new Set(s.jobsDone || []);
  state.jobsTaken = new Set(s.jobsTaken || s.jobsDone || []);
  state.world = s.world || {};
}

// One line for the title screen: "Level 2 · 45 gold · Liked · 1 job done".
function saveSummary(s) {
  const lead = (s.party || [])[0] || {};
  const score = Math.max(-100, Math.min(100, s.rep || 0));
  const tier = REP_TIERS.find((t) => score >= t.min);
  const jobs = (s.jobsDone || []).length;
  return `Level ${lead.level || 1} · ${s.gold || 0} gold · ${tier.label} · ${jobs} job${jobs === 1 ? '' : 's'} done`;
}
