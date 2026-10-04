'use strict';

// Party, classes, spells, items, equipment and enemies.
//
// To add a character later:
//   1. Add an entry to CHARACTERS with a class from CLASSES ('rogue', 'caster' or 'sword').
//   2. Put its id in STARTING_PARTY (up to 4).
// Every character gets Hit, Item and Run; the class adds its own command.
//
// Item database idea (categories, stats, effects, descriptions, equipment slots) adapted from
// alfredbaudisch/GodotDynamicInventorySystem (Apache 2.0). Rewritten here; no code or art copied.

const CLASSES = {
  rogue:  { label: 'Rogue',        command: 'Steal' },
  caster: { label: 'Spellcaster',  command: 'Magic', spells: ['Fire', 'Ice', 'Cure'] },
  sword:  { label: 'Swordfighter', command: 'Slash' }
};

const COMMAND_HELP = {
  hit: 'Strike one enemy with your weapon.',
  steal: "Pick an enemy's pocket for gold or an item.",
  magic: 'Cast a spell. Uses MP.',
  slash: 'A sweeping cut that hits every enemy.',
  item: 'Use something from the bag.',
  run: 'Try to slip away into the dark.'
};

const SPELLS = {
  Fire: { mp: 6, kind: 'damage', power: 3.1, color: '#ff8a3c', target: 'enemy', desc: 'Lantern fire on one enemy.' },
  Ice:  { mp: 6, kind: 'damage', power: 2.9, color: '#8fd3ff', target: 'enemy', desc: 'River-cold shards on one enemy.' },
  Cure: { mp: 5, kind: 'heal',   power: 3.6, color: '#8ef0a2', target: 'party', desc: 'Restores HP to one ally.' }
};

const ITEM_CATEGORIES = [
  { id: 'consumable', label: 'Supplies' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'charm', label: 'Charms' }
];

const EQUIP_SLOTS = [
  { id: 'weapon', label: 'Weapon' },
  { id: 'armor', label: 'Armor' },
  { id: 'charm', label: 'Charm' }
];

const STAT_LABELS = { atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD' };

// icon: a name from icons.js (potion, heart, bomb, sword, swords, shirt, shield, gem, coin)
const ITEMS = {
  'Potion': {
    category: 'consumable', icon: 'potion', color: '#e2574c', price: 50, target: 'party',
    effect: { heal: 60 }, effectText: 'Restores 60 HP',
    desc: 'A red tonic from a Lantern Quarter apothecary. Tastes like cinnamon and regret.'
  },
  'Hi-Potion': {
    category: 'consumable', icon: 'potion', color: '#ff9a3c', price: 180, target: 'party',
    effect: { heal: 150 }, effectText: 'Restores 150 HP',
    desc: 'The good stuff, the kind the Crown Quarter keeps for itself.'
  },
  'Ether': {
    category: 'consumable', icon: 'potion', color: '#6fb7ff', price: 220, target: 'party',
    effect: { mp: 25 }, effectText: 'Restores 25 MP',
    desc: 'Blue and faintly humming. Spellcasters pay well for it.'
  },
  'Smelling Salts': {
    category: 'consumable', icon: 'heart', color: '#f08a9a', price: 120, target: 'party',
    effect: { revive: 0.3 }, effectText: 'Revives a fallen ally with 30% HP',
    desc: "Noe's father taught her what to keep behind the bar."
  },
  'Smoke Bomb': {
    category: 'consumable', icon: 'bomb', color: '#b9bed2', price: 90, target: 'none', battleOnly: true,
    effect: { escape: true }, effectText: 'Escape any battle',
    desc: 'A guild trick. A pop, a cloud, and nobody remembers your face.'
  },
  "Severin's Katana": {
    category: 'weapon', icon: 'sword', color: '#d4d4e0', price: 0, stats: { atk: 11 },
    trait: 'Cannot be sold',
    desc: 'Taken during the castle job. The blade Severin carried for centuries.'
  },
  'Twin Daggers': {
    category: 'weapon', icon: 'swords', color: '#c9c9d6', price: 0, stats: { atk: 7, spd: 3 }, bonus: { steal: 0.1 },
    trait: 'Steal +10%',
    desc: 'One from Rika, one from Kairo. Light, quick, and heavy in other ways.'
  },
  'Veyrane Baton': {
    category: 'weapon', icon: 'sword', color: '#c09060', price: 60, stats: { atk: 8 },
    desc: "A guard's lead-weighted baton. Crude, but it doesn't care."
  },
  'Rogue Blacks': {
    category: 'armor', icon: 'shirt', color: '#9a9ab4', price: 0, stats: { def: 4, spd: 1 },
    trait: 'Quiet',
    desc: 'Fitted black layers. Nothing shiny. Nothing that catches light.'
  },
  'Veyrane Brigandine': {
    category: 'armor', icon: 'shield', color: '#b08ad0', price: 400, stats: { def: 11, spd: -2 },
    trait: 'Heavy',
    desc: "An estate captain's armor. Sturdy, loud, and slow."
  },
  "Mother's Necklace": {
    category: 'charm', icon: 'gem', color: '#e9b65a', price: 0, stats: { def: 2, mag: 2 },
    trait: 'Cannot be sold',
    desc: 'A simple necklace from his mother, worn close to the chest.'
  },
  'Lucky Coin': {
    category: 'charm', icon: 'coin', color: '#f3d79a', price: 150, stats: { spd: 1 }, bonus: { steal: 0.2 },
    trait: 'Steal +20%',
    desc: 'Rigged to land however you need. Every card table in the Lantern Quarter wants it back.'
  }
};

const STARTING_BAG = {
  'Potion': 2, 'Smoke Bomb': 1,
  "Severin's Katana": 1, 'Twin Daggers': 1, 'Rogue Blacks': 1, "Mother's Necklace": 1
};

// Base stats before equipment. look.style picks the battle sprite: 'rogue', 'caster' or 'sword'.
const CHARACTERS = {
  zay: {
    name: 'ZAY', cls: 'rogue',
    maxHp: 140, maxMp: 0, atk: 8, def: 3, mag: 2, spd: 14,
    equip: { weapon: "Severin's Katana", armor: 'Rogue Blacks', charm: "Mother's Necklace" },
    look: { style: 'rogue', body: '#14141c', trim: '#e9b65a', skin: '#5a3b2b', tail: true }
  }
};

const STARTING_PARTY = ['zay'];

const ENEMIES = {
  guard: {
    name: 'Veyrane Guard', maxHp: 64, atk: 15, def: 4, mag: 2, spd: 9, exp: 34, gold: 6,
    coat: '#26304d', trim: '#b08a3e',
    steal: [{ gold: 18 }, { gold: 12 }, { item: 'Potion' }, { item: 'Smoke Bomb' }],
    drops: [{ item: 'Potion', chance: 0.3 }, { item: 'Veyrane Baton', chance: 0.08 }]
  },
  captain: {
    name: 'Estate Captain', maxHp: 96, atk: 19, def: 6, mag: 3, spd: 10, exp: 62, gold: 14,
    coat: '#3d2a4f', trim: '#e9b65a',
    steal: [{ gold: 35 }, { item: 'Hi-Potion' }, { item: 'Ether' }],
    drops: [{ item: 'Hi-Potion', chance: 0.4 }]
  }
};

const LEVEL_GAINS = {
  rogue:  { maxHp: 12, atk: 2, def: 1, mag: 1, spd: 1, maxMp: 0 },
  caster: { maxHp: 8,  atk: 1, def: 1, mag: 3, spd: 1, maxMp: 6 },
  sword:  { maxHp: 16, atk: 3, def: 2, mag: 0, spd: 0, maxMp: 0 }
};
const expToNext = (level) => level * 100;

function makeParty() {
  return STARTING_PARTY.map((id) => {
    const c = CHARACTERS[id];
    return {
      id, ...c, look: { ...c.look }, equip: { ...(c.equip || {}) },
      hp: c.maxHp, mp: c.maxMp, atb: 0, alive: true, level: 1, exp: 0
    };
  });
}

// Effective stat: base plus equipment for party members; enemies use their own numbers.
function stat(c, key) {
  if (c.side === 'enemy' || !c.equip) return c[key];
  let total = c[key];
  for (const slot of EQUIP_SLOTS) {
    const item = ITEMS[c.equip[slot.id]];
    if (item && item.stats && item.stats[key]) total += item.stats[key];
  }
  return Math.max(1, total);
}

function stealBonus(c) {
  if (!c.equip) return 0;
  return EQUIP_SLOTS.reduce((sum, slot) => {
    const item = ITEMS[c.equip[slot.id]];
    return sum + (item && item.bonus && item.bonus.steal ? item.bonus.steal : 0);
  }, 0);
}

// Adds EXP and applies level-ups. Returns a list of { level, gains } for the victory screen.
function gainExp(member, amount) {
  const ups = [];
  member.exp += amount;
  while (member.exp >= expToNext(member.level)) {
    member.exp -= expToNext(member.level);
    member.level += 1;
    const gains = LEVEL_GAINS[member.cls] || LEVEL_GAINS.rogue;
    for (const [k, v] of Object.entries(gains)) member[k] += v;
    member.hp = Math.min(member.maxHp, member.hp + gains.maxHp);
    member.mp = Math.min(member.maxMp, member.mp + gains.maxMp);
    ups.push({ level: member.level, gains });
  }
  return ups;
}
