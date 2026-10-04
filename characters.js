'use strict';

// Party, classes, spells, items and enemies for battles.
//
// To add a character later:
//   1. Add an entry to CHARACTERS with a class from CLASSES ('rogue', 'caster' or 'sword').
//   2. Put its id in STARTING_PARTY (up to 4).
// Every character gets Hit, Item and Run; the class adds its own command.

const CLASSES = {
  rogue:  { label: 'Rogue',        command: 'Steal' },
  caster: { label: 'Spellcaster',  command: 'Magic', spells: ['Fire', 'Ice', 'Cure'] },
  sword:  { label: 'Swordfighter', command: 'Slash' }
};

const SPELLS = {
  Fire: { mp: 6, kind: 'damage', power: 3.1, color: '#ff8a3c', target: 'enemy' },
  Ice:  { mp: 6, kind: 'damage', power: 2.9, color: '#8fd3ff', target: 'enemy' },
  Cure: { mp: 5, kind: 'heal',   power: 3.6, color: '#8ef0a2', target: 'party' }
};

const ITEMS = {
  Potion: { heal: 60, target: 'party' }
};

// look.style picks how the battle sprite is drawn: 'rogue', 'caster' or 'sword'.
const CHARACTERS = {
  zay: {
    name: 'ZAY', cls: 'rogue',
    maxHp: 140, maxMp: 0, atk: 19, def: 7, mag: 4, spd: 15,
    look: { style: 'rogue', body: '#14141c', trim: '#e9b65a', skin: '#5a3b2b', tail: true }
  }
};

const STARTING_PARTY = ['zay'];

const ENEMIES = {
  guard: {
    name: 'Veyrane Guard', maxHp: 64, atk: 15, def: 4, spd: 9,
    coat: '#26304d', trim: '#b08a3e',
    steal: [{ gold: 18 }, { gold: 12 }, { item: 'Potion' }]
  },
  captain: {
    name: 'Estate Captain', maxHp: 96, atk: 19, def: 6, spd: 10,
    coat: '#3d2a4f', trim: '#e9b65a',
    steal: [{ gold: 35 }, { item: 'Potion' }]
  }
};

function makeParty() {
  return STARTING_PARTY.map((id) => {
    const c = CHARACTERS[id];
    return { id, ...c, look: { ...c.look }, hp: c.maxHp, mp: c.maxMp, atb: 0, alive: true };
  });
}
