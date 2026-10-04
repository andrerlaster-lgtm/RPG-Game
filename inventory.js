'use strict';

// Inventory screen in the style of Zelda: Breath of the Wild, adapted from the ideas in
// alfredbaudisch/GodotDynamicInventorySystem (Apache 2.0): category tabs, an item grid,
// an info panel with stats and description, equipment slots and a character panel.
// Re-written for this game; icons are drawn here, no art copied.

// ---------- Icons ----------
const ICON_PATHS = {
  flask: '<path d="M10 3h4v4l4 7a5 5 0 0 1-4.5 7h-3A5 5 0 0 1 6 14l4-7z" fill="{c}"/><path d="M9 3h6" stroke="#f1ead9" stroke-width="1.6"/><path d="M7.5 14h9" stroke="rgba(255,255,255,.45)" stroke-width="1.4"/>',
  pouch: '<path d="M7 9h10l1.5 9a3 3 0 0 1-3 3.4h-7A3 3 0 0 1 5.5 18z" fill="{c}"/><path d="M8 9c1-3 7-3 8 0" stroke="{c}" stroke-width="2" fill="none"/><path d="M9 9l6 0" stroke="#5a4426" stroke-width="1.4"/>',
  bomb: '<circle cx="11" cy="14" r="6.5" fill="{c}"/><path d="M15 9l2.5-2.5" stroke="#8a6a3a" stroke-width="2"/><circle cx="18.5" cy="5.5" r="1.6" fill="#ffd36b"/><circle cx="9" cy="12" r="1.6" fill="rgba(255,255,255,.4)"/>',
  sword: '<path d="M18.5 3.5l2 2-11 11-2-2z" fill="{c}"/><path d="M6 15l3 3" stroke="#e9b65a" stroke-width="2.6"/><path d="M5.5 18.5l-2 2" stroke="#5a3b2b" stroke-width="2.6" stroke-linecap="round"/>',
  daggers: '<path d="M8 3l2 2-4.5 9.5-1.5-1.5z" fill="{c}"/><path d="M16 3l-2 2 4.5 9.5 1.5-1.5z" fill="{c}"/><path d="M4 14l3 3M20 14l-3 3" stroke="#e9b65a" stroke-width="2.2"/><path d="M4.5 18.5l-1.5 1.5M19.5 18.5l1.5 1.5" stroke="#5a3b2b" stroke-width="2.2" stroke-linecap="round"/>',
  armor: '<path d="M8 3l4 2 4-2 4 3-2 4v10H6V10L4 6z" fill="{c}"/><path d="M12 5v15" stroke="rgba(255,255,255,.25)" stroke-width="1.4"/><path d="M7 13h10" stroke="#e9b65a" stroke-width="1.4"/>',
  necklace: '<path d="M5 4c0 8 3 11 7 11s7-3 7-11" stroke="#c9c3b2" stroke-width="1.6" fill="none"/><circle cx="12" cy="17" r="3.6" fill="{c}"/><circle cx="11" cy="16" r="1.1" fill="rgba(255,255,255,.6)"/>',
  coin: '<circle cx="12" cy="12" r="8" fill="{c}"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#9b6a22" stroke-width="1.4"/><path d="M10.5 9.5h3M10.5 14.5h3M12 8v8" stroke="#9b6a22" stroke-width="1.4"/>'
};
function itemIcon(name) {
  const item = ITEMS[name];
  if (!item) return '';
  const svg = (ICON_PATHS[item.icon] || ICON_PATHS.pouch).replace(/\{c\}/g, item.color);
  return `<svg class="item-icon" viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
}

// ---------- State ----------
const INV = { open: false, tab: 0, index: 0, member: 0, actions: null, actionIndex: 0 };
const iui = {
  root: document.getElementById('inventory'),
  tabs: document.getElementById('inv-tabs'),
  gold: document.getElementById('inv-gold'),
  grid: document.getElementById('inv-grid'),
  info: document.getElementById('inv-info'),
  char: document.getElementById('inv-char'),
  close: document.getElementById('inv-close')
};

const currentMember = () => state.party[Math.min(INV.member, state.party.length - 1)];
const tabItems = () => {
  const cat = ITEM_CATEGORIES[INV.tab].id;
  return Object.entries(state.items).filter(([name, n]) => n > 0 && ITEMS[name] && ITEMS[name].category === cat).map(([name, n]) => ({ name, count: n }));
};
const isEquipped = (name) => state.party.some((m) => Object.values(m.equip || {}).includes(name));

function openInventory() {
  if (state.mode !== 'field' || !state.running || state.over) return;
  state.mode = 'inventory';
  Object.assign(INV, { open: true, index: 0, actions: null, actionIndex: 0 });
  iui.root.hidden = false;
  document.getElementById('touch').hidden = true;
  sfx(520, 0.08, 'triangle', 0.04, 260);
  renderInventory();
}
function closeInventory() {
  if (!INV.open) return;
  INV.open = false;
  iui.root.hidden = true;
  state.mode = 'field';
  document.getElementById('touch').hidden = !isTouch;
  hudCache = '';
  sfx(420, 0.08, 'triangle', 0.04, -200);
}

function switchTab(delta) {
  INV.tab = (INV.tab + delta + ITEM_CATEGORIES.length) % ITEM_CATEGORIES.length;
  INV.index = 0;
  INV.actions = null;
  sfx(760, 0.04, 'square', 0.025);
  renderInventory();
}

function gridColumns() {
  const cols = getComputedStyle(iui.grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  return Math.max(1, cols);
}

function moveSelection(dx, dy) {
  if (INV.actions) {
    const n = INV.actions.length;
    INV.actionIndex = (INV.actionIndex + dy + dx + n) % n;
  } else {
    const items = tabItems();
    if (!items.length) return;
    const cols = gridColumns();
    INV.index = Math.max(0, Math.min(items.length - 1, INV.index + dx + dy * cols));
  }
  sfx(660, 0.03, 'square', 0.02);
  renderInventory();
}

function actionsFor(name) {
  const item = ITEMS[name];
  const m = currentMember();
  const list = [];
  if (item.category === 'consumable') {
    if (item.battleOnly) list.push({ label: 'Use', disabled: true, note: 'Only in battle' });
    else list.push({ label: 'Use', run: () => fieldUse(name) });
  } else {
    const slot = item.category;
    if (m.equip[slot] === name) list.push({ label: 'Unequip', run: () => { m.equip[slot] = null; sfx(380, 0.1, 'triangle', 0.04); } });
    else list.push({ label: 'Equip', run: () => { m.equip[slot] = name; sfx(880, 0.12, 'triangle', 0.05, 200); } });
  }
  list.push({ label: 'Cancel', run: () => {} });
  return list;
}

function fieldUse(name) {
  const m = currentMember();
  const fx = ITEMS[name].effect;
  const full = (fx.heal && m.hp >= m.maxHp && !fx.mp) || (fx.mp && m.mp >= m.maxMp && !fx.heal) || (fx.revive && m.alive);
  if (full || (!m.alive && !fx.revive)) { toast('It would have no effect.', 1300); return; }
  if (fx.revive) { m.alive = true; m.hp = Math.max(1, Math.round(m.maxHp * fx.revive)); }
  if (fx.heal) m.hp = Math.min(m.maxHp, m.hp + fx.heal);
  if (fx.mp) m.mp = Math.min(m.maxMp, m.mp + fx.mp);
  state.items[name] -= 1;
  sfx(700, 0.25, 'sine', 0.05, 500);
  toast(`${m.name} used ${name}.`, 1400);
}

function confirmInventory() {
  const items = tabItems();
  if (INV.actions) {
    const action = INV.actions[INV.actionIndex];
    if (action.disabled) { sfx(140, 0.08, 'square', 0.03); return; }
    action.run();
    INV.actions = null;
    const after = tabItems();
    INV.index = Math.min(INV.index, Math.max(0, after.length - 1));
    renderInventory();
    return;
  }
  const sel = items[INV.index];
  if (!sel) return;
  INV.actions = actionsFor(sel.name);
  INV.actionIndex = 0;
  sfx(1040, 0.04, 'square', 0.03);
  renderInventory();
}

function backInventory() {
  if (INV.actions) { INV.actions = null; sfx(520, 0.04, 'square', 0.03); renderInventory(); return; }
  closeInventory();
}

function updateInventory() {
  if (pressed.has('arrowleft')) moveSelection(-1, 0);
  if (pressed.has('arrowright')) moveSelection(1, 0);
  if (pressed.has('arrowup')) moveSelection(0, -1);
  if (pressed.has('arrowdown')) moveSelection(0, 1);
  if (pressed.has('q') || pressed.has('[')) switchTab(-1);
  if (pressed.has('e') || pressed.has(']') || pressed.has('tab')) switchTab(1);
  if (pressed.has('enter') || pressed.has('z') || pressed.has(' ')) confirmInventory();
  if (pressed.has('escape') || pressed.has('x') || pressed.has('backspace')) backInventory();
  else if (pressed.has('i')) closeInventory();
}

// ---------- Rendering ----------
function statDelta(name) {
  // Compare a weapon/armor/charm with what the current character has in that slot.
  const item = ITEMS[name];
  const m = currentMember();
  if (item.category === 'consumable') return null;
  const slot = item.category;
  const before = {};
  for (const k of Object.keys(STAT_LABELS)) before[k] = stat(m, k);
  const saved = m.equip[slot];
  m.equip[slot] = name;
  const after = {};
  for (const k of Object.keys(STAT_LABELS)) after[k] = stat(m, k);
  m.equip[slot] = saved;
  return { before, after };
}

function renderCharacter() {
  const m = currentMember();
  const next = expToNext(m.level);
  const stats = Object.entries(STAT_LABELS).map(([k, label]) => `<div class="cs-stat"><span>${label}</span><b>${stat(m, k)}</b></div>`).join('');
  const slots = EQUIP_SLOTS.map((slot) => {
    const name = m.equip[slot.id];
    return `<div class="eq-slot${name ? ' is-filled' : ''}"><span class="eq-icon">${name ? itemIcon(name) : ''}</span>` +
      `<span class="eq-text"><small>${slot.label}</small><b>${name ? escapeHtml(name) : 'Empty'}</b></span></div>`;
  }).join('');
  iui.char.innerHTML =
    `<div class="cs-head"><b>${escapeHtml(m.name)}</b><span>${CLASSES[m.cls].label} · Lv ${m.level}</span></div>` +
    `<div class="cs-bars"><div><small>HP</small>${bar('hp', m.hp, m.maxHp)}<span>${m.hp}/${m.maxHp}</span></div>` +
    (m.maxMp ? `<div><small>MP</small>${bar('mp', m.mp, m.maxMp)}<span>${m.mp}/${m.maxMp}</span></div>` : '') +
    `<div><small>EXP</small>${bar('exp', m.exp, next)}<span>${m.exp}/${next}</span></div></div>` +
    `<div class="cs-stats">${stats}</div><div class="eq-slots">${slots}</div>`;
}

function renderInfo(sel) {
  if (!sel) {
    iui.info.innerHTML = `<p class="info-empty">Nothing here yet. Open chests and pick pockets to fill your bag.</p>`;
    return;
  }
  const item = ITEMS[sel.name];
  const cat = ITEM_CATEGORIES.find((c) => c.id === item.category).label;
  let chips = '';
  if (item.effectText) chips += `<span class="chip">${escapeHtml(item.effectText)}</span>`;
  const delta = statDelta(sel.name);
  if (delta) {
    for (const k of Object.keys(STAT_LABELS)) {
      const diff = delta.after[k] - delta.before[k];
      if (!diff && !(item.stats && item.stats[k] !== undefined)) continue;
      const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
      chips += `<span class="chip stat-${dir}">${STAT_LABELS[k]} ${delta.before[k]} → ${delta.after[k]}</span>`;
    }
  }
  if (item.trait) chips += `<span class="chip trait">${escapeHtml(item.trait)}</span>`;
  const equippedBy = state.party.find((m) => Object.values(m.equip).includes(sel.name));
  const actions = INV.actions
    ? `<div class="inv-actions">${INV.actions.map((a, i) => `<button type="button" data-action="${i}" class="${i === INV.actionIndex ? 'is-cursor' : ''}${a.disabled ? ' is-disabled' : ''}">${a.label}${a.note ? `<small>${a.note}</small>` : ''}</button>`).join('')}</div>`
    : `<p class="info-hint">${isTouch ? 'Tap again for actions' : 'Enter for actions'}</p>`;
  iui.info.innerHTML =
    `<div class="info-head">${itemIcon(sel.name)}<div><h3>${escapeHtml(sel.name)}</h3><span>${cat}${sel.count > 1 ? ` · ×${sel.count}` : ''}${equippedBy ? ` · Equipped by ${escapeHtml(equippedBy.name)}` : ''}</span></div></div>` +
    `<div class="chips">${chips}</div><p class="info-desc">${escapeHtml(item.desc)}</p>${actions}`;
  iui.info.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => { INV.actionIndex = Number(b.dataset.action); confirmInventory(); }));
}

function renderInventory() {
  iui.gold.textContent = state.player.gold;
  iui.tabs.innerHTML = '';
  ITEM_CATEGORIES.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'inv-tab' + (i === INV.tab ? ' is-active' : '');
    b.setAttribute('aria-pressed', String(i === INV.tab));
    const count = Object.entries(state.items).filter(([n, k]) => k > 0 && ITEMS[n] && ITEMS[n].category === c.id).length;
    b.innerHTML = `${escapeHtml(c.label)}<small>${count}</small>`;
    b.addEventListener('click', () => { INV.tab = i; INV.index = 0; INV.actions = null; renderInventory(); });
    iui.tabs.append(b);
  });
  const items = tabItems();
  iui.grid.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'inv-cell' + (i === INV.index ? ' is-selected' : '') + (isEquipped(it.name) ? ' is-equipped' : '');
    b.setAttribute('aria-label', it.name + (it.count > 1 ? `, ${it.count}` : '') + (isEquipped(it.name) ? ', equipped' : ''));
    b.innerHTML = itemIcon(it.name) + (it.count > 1 ? `<span class="cell-count">${it.count}</span>` : '') + (isEquipped(it.name) ? '<span class="cell-eq">E</span>' : '');
    b.addEventListener('click', () => {
      if (INV.index === i && !INV.actions) { confirmInventory(); return; }
      INV.index = i; INV.actions = null; sfx(660, 0.03, 'square', 0.02); renderInventory();
    });
    li.append(b);
    iui.grid.append(li);
  });
  for (let i = items.length; i < Math.max(12, Math.ceil(items.length / 4) * 4); i++) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="inv-cell is-empty"></span>';
    iui.grid.append(li);
  }
  renderCharacter();
  renderInfo(items[INV.index]);
}

iui.close.addEventListener('click', closeInventory);
document.getElementById('bag-btn').addEventListener('click', () => { if (state.mode === 'field') openInventory(); });
document.getElementById('pause-inventory').addEventListener('click', () => { if (state.paused) togglePause(); openInventory(); });
