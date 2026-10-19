'use strict';

// Shared UI pieces: icon slots, settings + Options dialog, confirm dialog, HUD tooltips,
// and the "new item" badge on the Bag button. Component patterns follow
// sinanata/unity-ui-toolkit-design-system (MIT).

// ---------- Icon slots ----------
function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.dataset.filled) { el.innerHTML = dsIcon(el.dataset.icon); el.dataset.filled = '1'; }
  });
}
fillIcons();

// ---------- Settings (kept on this device) ----------
const SETTINGS_KEY = 'bellemorne-settings-v1';
const SETTINGS = { volume: 0.7, music: 0.6, cones: true, shake: true, battleSpeed: 1, view: '3d' };
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (saved && typeof saved === 'object') {
    if (typeof saved.volume === 'number') SETTINGS.volume = Math.max(0, Math.min(1, saved.volume));
    if (typeof saved.music === 'number') SETTINGS.music = Math.max(0, Math.min(1, saved.music));
    if (typeof saved.cones === 'boolean') SETTINGS.cones = saved.cones;
    if (typeof saved.shake === 'boolean') SETTINGS.shake = saved.shake;
    if ([0.7, 1, 1.4].includes(saved.battleSpeed)) SETTINGS.battleSpeed = saved.battleSpeed;
    if (['3d', 'classic'].includes(saved.view)) SETTINGS.view = saved.view;
  }
} catch { /* settings fall back to defaults */ }
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch { /* not saved; still works this session */ }
}

// ---------- Modal plumbing ----------
let openModal = null;
let modalReturnFocus = null;
function showModal(el, focusEl) {
  modalReturnFocus = document.activeElement;
  el.hidden = false;
  openModal = el;
  (focusEl || el.querySelector('button, input')).focus({ preventScroll: true });
}
function hideModal(el) {
  el.hidden = true;
  if (openModal === el) openModal = null;
  if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus({ preventScroll: true });
}

// Keys go to the open dialog first so Esc closes it instead of pausing the game.
window.addEventListener('keydown', (e) => {
  if (!openModal) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); openModal === confirmEl ? resolveConfirm(false) : closeOptions(); return; }
  if (k === 'tab') {
    // Keep keyboard focus inside the dialog.
    const items = [...openModal.querySelectorAll('button, input')].filter((x) => !x.disabled && x.offsetParent);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }
  e.stopImmediatePropagation(); // don't move ZAY while a dialog is open
}, true);

// ---------- Options ----------
const optEls = {
  root: document.getElementById('options'),
  volume: document.getElementById('opt-volume'),
  volumeValue: document.getElementById('opt-volume-value'),
  music: document.getElementById('opt-music'),
  musicValue: document.getElementById('opt-music-value'),
  cones: document.getElementById('opt-cones'),
  shake: document.getElementById('opt-shake'),
  speed: document.getElementById('opt-speed'),
  view: document.getElementById('opt-view')
};
function renderOptions() {
  optEls.volume.value = String(Math.round(SETTINGS.volume * 100));
  optEls.volumeValue.textContent = String(Math.round(SETTINGS.volume * 100));
  optEls.music.value = String(Math.round(SETTINGS.music * 100));
  optEls.musicValue.textContent = String(Math.round(SETTINGS.music * 100));
  optEls.cones.setAttribute('aria-checked', String(SETTINGS.cones));
  optEls.shake.setAttribute('aria-checked', String(SETTINGS.shake));
  optEls.speed.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.speed) === SETTINGS.battleSpeed)));
  optEls.view.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === SETTINGS.view)));
  // No WebGL on this device: the 3D view can't run, so say so instead of offering it.
  const no3d = !window.R3D;
  optEls.view.querySelector('[data-view="3d"]').disabled = no3d;
  document.getElementById('opt-view-note').textContent = no3d ? 'This device can’t show 3D. Using Classic.' : 'Third person, or the top-down map';
}
function openOptions() { renderOptions(); showModal(optEls.root, document.getElementById('options-done')); }
function closeOptions() { hideModal(optEls.root); }
optEls.volume.addEventListener('input', () => {
  SETTINGS.volume = Number(optEls.volume.value) / 100;
  optEls.volumeValue.textContent = optEls.volume.value;
  saveSettings();
  applyVolumes();
});
optEls.music.addEventListener('input', () => {
  SETTINGS.music = Number(optEls.music.value) / 100;
  optEls.musicValue.textContent = optEls.music.value;
  saveSettings();
  applyVolumes();
});
optEls.volume.addEventListener('change', () => { initAudio(); play('coins2'); });
optEls.cones.addEventListener('click', () => { SETTINGS.cones = !SETTINGS.cones; saveSettings(); renderOptions(); play('uiToggle', { vol: 0.6 }); });
optEls.shake.addEventListener('click', () => { SETTINGS.shake = !SETTINGS.shake; saveSettings(); renderOptions(); play('uiToggle', { vol: 0.6 }); });
optEls.speed.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { SETTINGS.battleSpeed = Number(b.dataset.speed); saveSettings(); renderOptions(); }));
optEls.view.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { SETTINGS.view = b.dataset.view; saveSettings(); renderOptions(); if (window.R3D) R3D.resetCamera(); }));
document.getElementById('options-done').addEventListener('click', closeOptions);
optEls.root.addEventListener('click', (e) => { if (e.target === optEls.root) closeOptions(); });
document.getElementById('title-options').addEventListener('click', openOptions);
document.getElementById('pause-options').addEventListener('click', openOptions);

// ---------- Confirm dialog ----------
const confirmEl = document.getElementById('confirm');
let confirmResolve = null;
function askConfirm(title, text, okLabel) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  document.getElementById('confirm-ok').textContent = okLabel;
  showModal(confirmEl, document.getElementById('confirm-cancel'));
  return new Promise((resolve) => { confirmResolve = resolve; });
}
function resolveConfirm(value) {
  hideModal(confirmEl);
  if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(value); }
}
document.getElementById('confirm-ok').addEventListener('click', () => resolveConfirm(true));
document.getElementById('confirm-cancel').addEventListener('click', () => resolveConfirm(false));
confirmEl.addEventListener('click', (e) => { if (e.target === confirmEl) resolveConfirm(false); });

// ---------- HUD tooltips (hover, keyboard focus, or long-press on touch) ----------
const TIPS = {
  hp: ['Health', "ZAY's HP. It carries between battles. Potions and Hi-Potions restore it."],
  gold: ['Gold', "Picked up or stolen. The Soot kid by the street stage in the Lantern Quarter could use it."],
  cards: ['Cards', 'Throw one (Q) to make noise and lure guards away. A direct hit stuns them.'],
  vis: ['Visibility', 'Shadow: guards spot you only up close. In the light: from much farther. Hidden: hedges keep you out of sight.'],
  rep: ['Name', 'How the Lantern Quarter sees ZAY. Kindness lowers prices at the fence. Cruelty raises them, and the worst name gets you turned away.'],
  bag: ['Bag (I)', 'Items, gear and ZAY’s stats. A red badge means something new.'],
  pause: ['Pause (Esc)', 'Pause, open Options, or restart the level.']
};
const tipEl = document.getElementById('tooltip');
let tipTimer = 0;
function showTip(target) {
  const tip = TIPS[target.dataset.tip];
  if (!tip) return;
  tipEl.innerHTML = `<b>${escapeHtml(tip[0])}</b>${escapeHtml(tip[1])}`;
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const top = r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8;
  tipEl.style.left = left + 'px';
  tipEl.style.top = top + 'px';
}
function hideTip() { clearTimeout(tipTimer); tipEl.hidden = true; }
document.querySelectorAll('[data-tip]').forEach((el) => {
  if (!el.matches('button')) el.tabIndex = 0;
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(el); });
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => showTip(el));
  el.addEventListener('blur', hideTip);
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { showTip(el); setTimeout(hideTip, 2600); }, 450);
  });
  el.addEventListener('pointerup', () => clearTimeout(tipTimer));
});

// ---------- New-item badge ----------
function noteNewItem(name) {
  if (!state.newItems) state.newItems = new Set();
  state.newItems.add(name);
  updateBagBadge();
}
function updateBagBadge() {
  const badge = document.getElementById('bag-badge');
  const n = state.newItems ? state.newItems.size : 0;
  badge.hidden = n === 0;
  badge.textContent = String(n);
  document.getElementById('bag-btn').setAttribute('aria-label', n ? `Open bag, ${n} new` : 'Open bag');
}
