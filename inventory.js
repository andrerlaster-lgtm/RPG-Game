'use strict';

// Inventory screen in the style of Zelda: Breath of the Wild, adapted from the ideas in
// alfredbaudisch/GodotDynamicInventorySystem (Apache 2.0): category tabs, an item grid,
// an info panel with stats and description, equipment slots and a character panel.
// Re-written for this game; icons are drawn here, no art copied.

// ---------- Icons ----------
// Item icons come from icons.js (design-system set, MIT), tinted with each item's colour.
function itemIcon(name) {
  const item = ITEMS[name];
  if (!item) return '';
  return `<span class="item-icon-wrap" style="color:${item.color}">${dsIcon(item.icon, 'item-icon')}</span>`;
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
  play('uiOpen'); play('belt', { vol: 0.5 });
  renderInventory();
}
function closeInventory() {
  if (!INV.open) return;
  INV.open = false;
  iui.root.hidden = true;
  state.mode = 'field';
  document.getElementById('touch').hidden = !isTouch;
  hudCache = '';
  play('uiClose');
}

function switchTab(delta) {
  INV.tab = (INV.tab + delta + ITEM_CATEGORIES.length) % ITEM_CATEGORIES.length;
  INV.index = 0;
  INV.actions = null;
  play('uiTick');
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
  play('uiMove');
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
    if (m.equip[slot] === name) list.push({ label: 'Unequip', run: () => { m.equip[slot] = null; play('cloth'); } });
    else list.push({ label: 'Equip', run: () => { m.equip[slot] = name; play('belt'); play(item.category === 'weapon' ? 'draw' : 'cloth', { delay: 0.08 }); } });
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
  play('heal');
  toast(`${m.name} used ${name}.`, 1400);
}

function confirmInventory() {
  const items = tabItems();
  if (INV.actions) {
    const action = INV.actions[INV.actionIndex];
    if (action.disabled) { play('uiError'); return; }
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
  play('uiConfirm', { vol: 0.7 });
  renderInventory();
}

function backInventory() {
  if (INV.actions) { INV.actions = null; play('uiBack'); renderInventory(); return; }
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
    const hasNew = [...(state.newItems || [])].some((n) => ITEMS[n] && ITEMS[n].category === c.id);
    b.innerHTML = `${escapeHtml(c.label)}<small>${count}</small>` + (hasNew ? '<span class="badge-dot" aria-label="new"></span>' : '');
    b.addEventListener('click', () => { INV.tab = i; INV.index = 0; INV.actions = null; renderInventory(); });
    iui.tabs.append(b);
  });
  const items = tabItems();
  const viewing = items[INV.index];
  const wasNew = viewing && state.newItems && state.newItems.has(viewing.name);
  iui.grid.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'inv-cell' + (i === INV.index ? ' is-selected' : '') + (isEquipped(it.name) ? ' is-equipped' : '');
    b.setAttribute('aria-label', it.name + (it.count > 1 ? `, ${it.count}` : '') + (isEquipped(it.name) ? ', equipped' : ''));
    b.innerHTML = itemIcon(it.name) + (it.count > 1 ? `<span class="cell-count">${it.count}</span>` : '') + (isEquipped(it.name) ? '<span class="cell-eq">E</span>' : '') +
      (state.newItems && state.newItems.has(it.name) && i !== INV.index ? '<span class="cell-new">New</span>' : '');
    b.addEventListener('click', () => {
      if (INV.index === i && !INV.actions) { confirmInventory(); return; }
      INV.index = i; INV.actions = null; play('uiMove'); renderInventory();
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
  if (wasNew) {
    // Seen it now (like Breath of the Wild): clear the badge after this render.
    state.newItems.delete(viewing.name);
    updateBagBadge();
  }
}

iui.close.addEventListener('click', closeInventory);
document.getElementById('bag-btn').addEventListener('click', () => { if (state.mode === 'field') openInventory(); });
document.getElementById('pause-inventory').addEventListener('click', () => { if (state.paused) togglePause(); openInventory(); });
