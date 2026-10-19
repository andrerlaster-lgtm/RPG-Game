'use strict';

// "Name": how the Lantern Quarter sees ZAY, from -100 (Feared) to +100 (Beloved). It resets every run.
// It moves when ZAY does something kind or cruel (see addRep calls in dialog.js and shop.js) and the
// fence reads it: prices change, and a Feared ZAY isn't served at all.
// A clean run (never spotted, nobody knocked out) adds a live +10 on top, so it can drop mid-level.

const REP_TIERS = [
  { min: 40, label: 'Beloved', mood: 'good', price: 0.8, tip: 'The Quarter speaks well of you. Friend prices at the fence.' },
  { min: 15, label: 'Liked', mood: 'good', price: 0.9, tip: 'People have heard good things. Slightly better prices.' },
  { min: -14, label: 'Unknown', mood: '', price: 1, tip: 'Nobody has made up their mind about you yet.' },
  { min: -34, label: 'Distrusted', mood: 'bad', price: 1.25, tip: 'Word gets around. The fence charges more.' },
  { min: -100, label: 'Feared', mood: 'bad', price: null, tip: 'The fence will not deal with you.' }
];

function repScore() {
  const clean = state.alarms === 0 && state.kos === 0 ? 10 : 0;
  return Math.max(-100, Math.min(100, state.rep + clean));
}

function repTier() {
  const s = repScore();
  return REP_TIERS.find((t) => s >= t.min);
}

// Change Name and tell the player when their standing (not just the number) changes.
function addRep(delta) {
  const before = repTier();
  state.rep = Math.max(-100, Math.min(100, state.rep + delta));
  const after = repTier();
  hudCache = '';
  if (after !== before) toast(`Your name in the Quarter: ${after.label}`, 2600);
}

// The fence's price for an item, scaled by Name.
function buyPrice(name) {
  return Math.max(1, Math.round(ITEMS[name].price * (repTier().price || 1)));
}
