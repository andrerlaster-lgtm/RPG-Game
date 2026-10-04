'use strict';

// Final Fantasy-style battles (Active Time Battle, wait mode): each fighter's gauge fills over time,
// and the clock pauses while you pick a command. Starts when an alerted guard catches ZAY.

const B = {
  active: false, enemies: [], party: [], anim: null, menu: null, popups: [], fx: [],
  result: null, guardRefs: [], intro: 0, t: 0, msgT: 0, exitT: 0, rewards: null
};

const bui = {
  root: document.getElementById('battle-ui'),
  help: document.getElementById('battle-help'),
  enemyList: document.getElementById('enemy-list'),
  partyList: document.getElementById('party-list'),
  cmdWin: document.getElementById('command-win'),
  cmdTitle: document.getElementById('command-title'),
  cmdList: document.getElementById('command-list'),
  msg: document.getElementById('battle-msg'),
  result: document.getElementById('battle-result'),
  resultTitle: document.getElementById('result-title'),
  resultText: document.getElementById('result-text'),
  resultList: document.getElementById('result-list'),
  resultBtn: document.getElementById('result-continue')
};

const randBetween = (a, b) => a + Math.random() * (b - a);

// Easing curves ported from Godot's scene/animation/easing_equations.h (Tween transitions),
// normalised to t in 0..1.
const Ease = {
  backOut: (t) => { const s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; },
  expoOut: (t) => (t >= 1 ? 1 : 1.001 * (1 - Math.pow(2, -10 * t))),
  cubicOut: (t) => { t -= 1; return t * t * t + 1; },
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2
};

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Start / end ----------
function startBattle(trigger) {
  const p = state.player;
  const group = state.guards
    .filter((g) => g.state !== 'down' && (g === trigger || (g.state === 'alert' && dist(g, p) < 170)))
    .slice(0, 3);
  state.mode = 'battle';
  state.battles += 1;
  Object.assign(B, { active: true, anim: null, menu: null, popups: [], fx: [], result: null, guardRefs: group, intro: 0.9, t: 0, exitT: 0, rewards: null });
  B.enemies = group.map((g) => {
    const def = ENEMIES[g.kind] || ENEMIES.guard;
    return { ...def, side: 'enemy', hp: def.maxHp, atb: randBetween(0, 35), alive: true, fade: 0, stolen: false, guard: g, flash: 0 };
  });
  B.party = state.party;
  B.party.forEach((m) => { m.side = 'party'; m.atb = m.alive ? randBetween(35, 70) : 0; m.flash = 0; });
  hudEls.hud.hidden = true;
  document.getElementById('touch').hidden = true;
  document.getElementById('toast').hidden = true;
  bui.root.hidden = false;
  bui.result.hidden = true;
  bui.cmdWin.hidden = true;
  bui.help.hidden = true;
  showMsg(B.enemies.length > 1 ? `${B.enemies.length} guards close in.` : `${B.enemies[0].name} blocks the way.`);
  renderBattleUI();
  [220, 330, 440, 660].forEach((f, i) => setTimeout(() => sfx(f, 0.12, 'square', 0.04), i * 70));
}

function endBattle() {
  const p = state.player;
  if (B.result === 'win') {
    for (const g of B.guardRefs) {
      if (g.state !== 'down') { g.state = 'down'; g.meter = 0; state.kos += 1; effect('ko', g.x, g.y); }
    }
    p.invuln = 1.5;
    state.party.forEach((m) => { if (!m.alive) { m.alive = true; m.hp = 1; } });
  } else if (B.result === 'run') {
    for (const g of B.guardRefs) {
      if (g.state !== 'down') { g.state = 'stunned'; g.stunT = 3; g.meter = 0.6; }
    }
    p.invuln = 2.5;
  } else if (B.result === 'lose') {
    B.active = false;
    bui.root.hidden = true;
    state.mode = 'field';
    finish(false);
    return;
  }
  B.active = false;
  state.mode = 'field';
  bui.root.hidden = true;
  hudEls.hud.hidden = false;
  document.getElementById('touch').hidden = !isTouch;
  hudCache = '';
}

// ---------- Commands ----------
const battleItems = () => Object.entries(state.items)
  .filter(([name, n]) => n > 0 && ITEMS[name] && ITEMS[name].category === 'consumable');

function commandsFor(m) {
  const special = m.cls === 'rogue' ? 'steal' : m.cls === 'caster' ? 'magic' : 'slash';
  return [
    { label: 'Hit', type: 'hit', help: COMMAND_HELP.hit },
    { label: CLASSES[m.cls].command, type: special, help: COMMAND_HELP[special] },
    { label: 'Item', type: 'item', disabled: battleItems().length === 0, help: battleItems().length ? COMMAND_HELP.item : 'The bag is empty.' },
    { label: 'Run', type: 'run', help: COMMAND_HELP.run }
  ];
}

function openMenu(m) {
  B.menu = { actor: m, stage: 'command', index: 0, options: commandsFor(m), pending: null };
  sfx(880, 0.05, 'square', 0.03);
  renderBattleUI();
}

function aliveOn(side) { return (side === 'enemy' ? B.enemies : B.party).filter((c) => c.alive); }

function setStage(stage, options, pending) {
  Object.assign(B.menu, { stage, options, index: 0, pending: pending || B.menu.pending });
  renderBattleUI();
}

function chooseTarget(side, pending, includeFallen = false) {
  const targets = includeFallen ? B.party.slice() : aliveOn(side);
  Object.assign(B.menu, { stage: 'target', side, targets, index: 0, pending, back: B.menu.stage });
  renderBattleUI();
}

function itemOptions() {
  return battleItems().map(([name, n]) => ({ label: name, count: n, type: 'item', help: `${ITEMS[name].effectText}. ${ITEMS[name].desc}` }));
}

function confirmMenu() {
  const menu = B.menu;
  if (!menu) return;
  const m = menu.actor;
  if (menu.stage === 'command') {
    const opt = menu.options[menu.index];
    if (opt.disabled) { sfx(140, 0.08, 'square', 0.03); return; }
    sfx(1040, 0.04, 'square', 0.03);
    if (opt.type === 'hit' || opt.type === 'steal') return chooseTarget('enemy', { type: opt.type, label: opt.label });
    if (opt.type === 'slash') return execute({ type: 'slash', label: 'Slash', targets: aliveOn('enemy') });
    if (opt.type === 'run') return execute({ type: 'run', label: 'Run', targets: [] });
    if (opt.type === 'magic') {
      return setStage('magic', CLASSES[m.cls].spells.map((name) => ({
        label: name, cost: SPELLS[name].mp, type: 'spell', disabled: m.mp < SPELLS[name].mp,
        help: `${SPELLS[name].desc} Costs ${SPELLS[name].mp} MP.` + (m.mp < SPELLS[name].mp ? ' Not enough MP.' : '')
      })));
    }
    if (opt.type === 'item') return setStage('item', itemOptions());
  } else if (menu.stage === 'magic' || menu.stage === 'item') {
    const opt = menu.options[menu.index];
    if (!opt || opt.disabled) { sfx(140, 0.08, 'square', 0.03); return; }
    sfx(1040, 0.04, 'square', 0.03);
    if (menu.stage === 'magic') return chooseTarget(SPELLS[opt.label].target, { type: 'magic', spell: opt.label, label: opt.label });
    const item = ITEMS[opt.label];
    if (item.target === 'none') return execute({ type: 'item', item: opt.label, label: opt.label, targets: [] });
    return chooseTarget('party', { type: 'item', item: opt.label, label: opt.label }, Boolean(item.effect.revive));
  } else if (menu.stage === 'target') {
    const target = menu.targets[menu.index];
    if (!target) return;
    sfx(1040, 0.04, 'square', 0.03);
    execute({ ...menu.pending, targets: [target] });
  }
}

function backMenu() {
  const menu = B.menu;
  if (!menu || menu.stage === 'command') return;
  sfx(520, 0.04, 'square', 0.03);
  if (menu.stage === 'target' && (menu.back === 'magic' || menu.back === 'item')) {
    const stage = menu.back;
    B.menu.stage = 'command';
    B.menu.options = commandsFor(menu.actor);
    B.menu.index = B.menu.options.findIndex((o) => o.type === (stage === 'magic' ? 'magic' : 'item'));
    confirmMenu();
    return;
  }
  Object.assign(B.menu, { stage: 'command', options: commandsFor(menu.actor), index: 0 });
  renderBattleUI();
}

function moveCursor(delta) {
  const menu = B.menu;
  if (!menu) return;
  const n = menu.stage === 'target' ? menu.targets.length : menu.options.length;
  if (!n) return;
  menu.index = (menu.index + delta + n) % n;
  sfx(660, 0.03, 'square', 0.02);
  renderBattleUI();
}

function execute(action) {
  const actor = B.menu ? B.menu.actor : action.actor;
  B.menu = null;
  if (action.type === 'magic') actor.mp -= SPELLS[action.spell].mp;
  if (action.type === 'item') state.items[action.item] -= 1;
  B.anim = { ...action, actor, t: 0, dur: action.type === 'magic' ? 1.0 : 0.8, hit: action.type === 'magic' ? 0.55 : 0.4, applied: false };
  if (action.type !== 'hit') showMsg(action.label);
  renderBattleUI();
}

// ---------- Resolving actions ----------
function damage(atk, def, scale = 1) {
  let d = (atk * 2 - def) * scale * randBetween(0.9, 1.1);
  const crit = Math.random() < 0.08;
  if (crit) d *= 1.5;
  return { amount: Math.max(1, Math.round(d)), crit };
}

function hurt(target, amount, crit) {
  target.hp = Math.max(0, target.hp - amount);
  target.flash = 0.25;
  B.shake = Math.min(1, (B.shake || 0) + (crit ? 0.55 : 0.28));
  popup(target, String(amount) + (crit ? '!' : ''), crit ? '#ffe08a' : '#ffffff');
  if (target.hp === 0) {
    target.alive = false;
    target.atb = 0;
    sfx(target.side === 'enemy' ? 160 : 90, 0.3, 'sawtooth', 0.05, -80);
  }
}

function heal(target, amount) {
  target.hp = Math.min(target.maxHp, target.hp + amount);
  popup(target, String(amount), '#8ef0a2');
  sfx(700, 0.25, 'sine', 0.05, 500);
}

function useItemOn(name, target) {
  const fx = ITEMS[name].effect;
  if (fx.revive) {
    if (target.alive) { popup(target, 'No effect', '#c9c3b2'); return false; }
    target.alive = true;
    target.hp = Math.max(1, Math.round(target.maxHp * fx.revive));
    popup(target, 'Revived', '#8ef0a2');
    sfx(600, 0.35, 'sine', 0.05, 600);
    return true;
  }
  if (!target.alive) { popup(target, 'No effect', '#c9c3b2'); return false; }
  if (fx.heal) heal(target, fx.heal);
  if (fx.mp) {
    target.mp = Math.min(target.maxMp, target.mp + fx.mp);
    popup(target, `+${fx.mp} MP`, '#9fd3ff');
    sfx(820, 0.25, 'sine', 0.05, 400);
  }
  return true;
}

function apply(a) {
  const actor = a.actor;
  const targets = a.targets.filter((t) => t.alive || a.type === 'item');
  if (a.type === 'hit') {
    const t = targets[0] || aliveOn(actor.side === 'party' ? 'enemy' : 'party')[0];
    if (!t) return;
    const d = damage(stat(actor, 'atk'), stat(t, 'def'));
    hurt(t, d.amount, d.crit);
    sfx(240, 0.08, 'square', 0.06, -120);
  } else if (a.type === 'slash') {
    for (const t of aliveOn('enemy')) { const d = damage(stat(actor, 'atk'), stat(t, 'def'), 0.85); hurt(t, d.amount, d.crit); }
    sfx(900, 0.18, 'sawtooth', 0.05, -700);
  } else if (a.type === 'magic') {
    const spell = SPELLS[a.spell];
    const t = targets[0];
    if (!t) return;
    B.fx.push({ kind: a.spell, target: t, t: 0, color: spell.color });
    if (spell.kind === 'heal') heal(t, Math.round(stat(actor, 'mag') * spell.power * randBetween(0.95, 1.1)));
    else {
      hurt(t, Math.max(1, Math.round(stat(actor, 'mag') * spell.power * randBetween(0.9, 1.1) - stat(t, 'def') * 0.5)), false);
      sfx(a.spell === 'Fire' ? 180 : 1400, 0.3, 'sawtooth', 0.04, a.spell === 'Fire' ? -100 : -900);
    }
  } else if (a.type === 'steal') {
    const t = targets[0];
    if (!t) return;
    if (t.stolen) { popup(t, 'Nothing left', '#c9c3b2'); showMsg('Pockets already empty.'); return; }
    const chance = 0.55 + (stat(actor, 'spd') - t.spd) * 0.03 + stealBonus(actor);
    if (Math.random() < chance) {
      t.stolen = true;
      const loot = t.steal[Math.floor(Math.random() * t.steal.length)];
      if (loot.gold) {
        state.player.gold += loot.gold;
        state.stolen.push(loot.gold + ' gold');
        popup(t, `+${loot.gold} gold`, '#f3d79a');
        showMsg(`Stole ${loot.gold} gold!`);
      } else {
        state.items[loot.item] = (state.items[loot.item] || 0) + 1;
        state.stolen.push(loot.item);
        popup(t, loot.item, '#f3d79a');
        showMsg(`Stole a ${loot.item}!`);
      }
      sfx(1200, 0.12, 'triangle', 0.05, 600);
    } else {
      popup(t, 'Missed', '#c9c3b2');
      showMsg("Couldn't steal anything.");
    }
  } else if (a.type === 'item') {
    const item = ITEMS[a.item];
    if (item.effect.escape) {
      B.result = 'run';
      B.fx.push({ kind: 'smoke', target: actor, t: 0, color: '#c9cbd8' });
      showMsg('A pop, a cloud, and ZAY is gone.');
      sfx(300, 0.4, 'triangle', 0.05, -200);
      return;
    }
    const t = targets[0];
    if (t) useItemOn(a.item, t);
  } else if (a.type === 'run') {
    if (Math.random() < 0.6) { B.result = 'run'; showMsg('Slipped away into the dark.'); sfx(400, 0.3, 'triangle', 0.05, 400); }
    else showMsg("Couldn't get away!");
  }
}

function enemyTurn(e) {
  const targets = aliveOn('party');
  if (!targets.length) return;
  const t = targets[Math.floor(Math.random() * targets.length)];
  B.anim = { type: 'hit', label: 'Attack', actor: e, targets: [t], t: 0, dur: 0.8, hit: 0.42, applied: false };
}

function checkEnd() {
  if (B.result === 'run') { if (!B.exitT) showResult(); return; }
  if (B.result) return;
  if (!aliveOn('enemy').length) {
    B.result = 'win';
    B.rewards = collectRewards();
    sfx(523, 0.15, 'square', 0.05);
    setTimeout(() => sfx(659, 0.15, 'square', 0.05), 150);
    setTimeout(() => sfx(784, 0.35, 'square', 0.05), 300);
  } else if (!aliveOn('party').length) {
    B.result = 'lose';
  }
  if (B.result) showResult();
}

// EXP, gold and drops, Final Fantasy style.
function collectRewards() {
  const exp = B.enemies.reduce((sum, e) => sum + e.exp, 0);
  const gold = B.enemies.reduce((sum, e) => sum + e.gold, 0);
  const found = [];
  for (const e of B.enemies) {
    for (const d of e.drops || []) {
      if (Math.random() < d.chance) { found.push(d.item); state.items[d.item] = (state.items[d.item] || 0) + 1; }
    }
  }
  state.player.gold += gold;
  const living = state.party.filter((m) => m.alive);
  const share = Math.round(exp / Math.max(1, living.length));
  const levelUps = [];
  for (const m of living) {
    for (const up of gainExp(m, share)) levelUps.push({ name: m.name, ...up });
  }
  return { exp: share, gold, found, levelUps };
}

function showResult() {
  B.menu = null;
  bui.cmdWin.hidden = true;
  bui.help.hidden = true;
  if (B.result === 'run') { B.exitT = 0.9; return; }
  bui.resultList.innerHTML = '';
  if (B.result === 'win') {
    const r = B.rewards;
    bui.resultTitle.textContent = 'Victory';
    bui.resultText.textContent = `${B.enemies.length === 1 ? 'The guard is' : 'The guards are'} out cold. The code holds: no casualties.`;
    const rows = [['EXP', `+${r.exp}`], ['Gold', `+${r.gold}`]];
    if (r.found.length) rows.push(['Found', r.found.join(', ')]);
    for (const up of r.levelUps) {
      const g = up.gains;
      const parts = [`HP +${g.maxHp}`];
      for (const k of ['atk', 'def', 'mag', 'spd']) if (g[k]) parts.push(`${STAT_LABELS[k]} +${g[k]}`);
      if (g.maxMp) parts.push(`MP +${g.maxMp}`);
      rows.push([`${up.name} Lv ${up.level}!`, parts.join(' · '), true]);
    }
    for (const [k, v, levelUp] of rows) {
      const li = document.createElement('li');
      if (levelUp) li.className = 'level-up';
      li.innerHTML = `<span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b>`;
      bui.resultList.append(li);
    }
    if (r.levelUps.length) setTimeout(() => sfx(988, 0.4, 'square', 0.05, 300), 500);
  } else {
    bui.resultTitle.textContent = 'ZAY is down';
    bui.resultText.textContent = 'The lantern light closes in.';
  }
  bui.result.hidden = false;
  bui.resultBtn.focus({ preventScroll: true });
}

// ---------- Update ----------
function popup(target, text, color) { B.popups.push({ target, text, color, t: 0 }); }
function showMsg(text) { bui.msg.textContent = text; bui.msg.hidden = false; B.msgT = 1.4; }

function handleBattleInput() {
  const up = pressed.has('arrowup') || pressed.has('arrowleft');
  const down = pressed.has('arrowdown') || pressed.has('arrowright');
  const ok = pressed.has('enter') || pressed.has('z') || pressed.has(' ') || pressed.has('e');
  const back = pressed.has('escape') || pressed.has('x') || pressed.has('backspace');
  if (B.result && B.result !== 'run') { if (ok) endBattle(); return; }
  if (!B.menu) return;
  if (up) moveCursor(-1);
  if (down) moveCursor(1);
  if (ok) confirmMenu();
  if (back) backMenu();
}

function updateBattle(dt) {
  B.t += dt;
  B.shake = Math.max(0, (B.shake || 0) - dt * 2.2);
  B.popups.forEach((p) => { p.t += dt; });
  B.popups = B.popups.filter((p) => p.t < 1.1);
  B.fx.forEach((f) => { f.t += dt; });
  B.fx = B.fx.filter((f) => f.t < 0.8);
  [...B.enemies, ...B.party].forEach((c) => { c.flash = Math.max(0, (c.flash || 0) - dt); if (!c.alive && c.side === 'enemy') c.fade = Math.min(1, c.fade + dt * 1.6); });
  if (B.msgT > 0) { B.msgT -= dt; if (B.msgT <= 0) bui.msg.hidden = true; }
  if (B.intro > 0) { B.intro -= dt; return; }
  handleBattleInput();
  if (B.result === 'run' && B.exitT > 0) { B.exitT -= dt; if (B.exitT <= 0) endBattle(); return; }
  if (B.result && !B.anim) return;

  if (B.anim) {
    const a = B.anim;
    a.t += dt;
    if (!a.applied && a.t >= a.hit) { a.applied = true; apply(a); renderBattleUI(); }
    if (a.t >= a.dur) {
      a.actor.atb = 0;
      B.anim = null;
      checkEnd();
      renderBattleUI();
    }
    return;
  }
  if (B.menu) return; // wait mode: time stops while you choose

  const all = [...B.enemies, ...B.party].filter((c) => c.alive);
  for (const c of all) c.atb = Math.min(100, c.atb + stat(c, 'spd') * dt * 3);
  const readyEnemy = B.enemies.find((e) => e.alive && e.atb >= 100);
  if (readyEnemy) { enemyTurn(readyEnemy); return; }
  const readyHero = B.party.find((m) => m.alive && m.atb >= 100);
  if (readyHero) openMenu(readyHero);
  updateGauges();
}

// ---------- Battle UI (DOM) ----------
const bar = (cls, value, max) => `<span class="meter ${cls}"><i style="transform:scaleX(${max ? Math.max(0, value / max) : 0})"></i></span>`;

function renderHelp() {
  const menu = B.menu;
  if (!menu) { bui.help.hidden = true; return; }
  let html = '';
  if (menu.stage === 'target') {
    const t = menu.targets[menu.index];
    if (t) {
      const isEnemy = t.side === 'enemy';
      const extra = isEnemy && menu.pending.type === 'steal' ? `<small>${t.stolen ? 'Pockets empty' : 'Pockets full'}</small>` : '';
      html = `<div class="help-target"><b>${escapeHtml(t.name)}</b>${extra}` +
        `${bar(isEnemy ? 'enemy-hp' : 'hp', t.hp, t.maxHp)}` +
        `<span class="help-num">${isEnemy ? '' : `${t.hp}/${t.maxHp}`}</span></div>`;
    }
  } else {
    const opt = menu.options[menu.index];
    if (opt && opt.help) {
      const icon = menu.stage === 'item' && typeof itemIcon === 'function' ? itemIcon(opt.label) : '';
      html = `<div class="help-line">${icon}<span>${escapeHtml(opt.help)}</span></div>`;
    }
  }
  bui.help.innerHTML = html;
  bui.help.hidden = !html;
}

function renderBattleUI() {
  const menu = B.menu;
  const targeting = menu && menu.stage === 'target' ? menu : null;
  bui.enemyList.innerHTML = '';
  B.enemies.forEach((e) => {
    if (!e.alive) return;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = e.name;
    const targetIndex = targeting && targeting.side === 'enemy' ? targeting.targets.indexOf(e) : -1;
    if (targetIndex !== -1) {
      btn.classList.add('selectable');
      if (targetIndex === targeting.index) btn.classList.add('is-cursor');
      btn.addEventListener('click', () => { B.menu.index = targetIndex; confirmMenu(); });
    } else btn.disabled = true;
    li.append(btn);
    bui.enemyList.append(li);
  });

  bui.partyList.innerHTML = '';
  B.party.forEach((m) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'party-row' + (!m.alive ? ' is-down' : '') + (menu && menu.actor === m ? ' is-active' : '') + (m.hp > 0 && m.hp <= m.maxHp * 0.25 ? ' is-low' : '');
    const targetIndex = targeting && targeting.side === 'party' ? targeting.targets.indexOf(m) : -1;
    if (targetIndex !== -1) {
      btn.classList.add('selectable');
      if (targetIndex === targeting.index) btn.classList.add('is-cursor');
      btn.addEventListener('click', () => { B.menu.index = targetIndex; confirmMenu(); });
    } else btn.disabled = true;
    btn.innerHTML =
      `<span class="pr-name">${escapeHtml(m.name)} <small>Lv ${m.level}</small></span>` +
      `<span class="pr-hp"><b>${m.hp}</b>/${m.maxHp}</span>` +
      `<span class="pr-bars">${bar('hp', m.hp, m.maxHp)}${m.maxMp ? bar('mp', m.mp, m.maxMp) : ''}</span>` +
      `<span class="atb"><i data-atb="${m.id}" style="transform:scaleX(${m.atb / 100})"></i></span>`;
    li.append(btn);
    bui.partyList.append(li);
  });

  bui.cmdWin.classList.toggle('is-targeting', Boolean(targeting));
  if (menu && menu.stage !== 'target') {
    bui.cmdWin.hidden = false;
    bui.cmdTitle.textContent = menu.stage === 'command' ? menu.actor.name : menu.stage === 'magic' ? 'Magic' : 'Item';
    bui.cmdList.innerHTML = '';
    menu.options.forEach((opt, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = (i === menu.index ? 'is-cursor' : '') + (opt.disabled ? ' is-disabled' : '');
      const label = document.createElement('span');
      label.textContent = opt.label;
      btn.append(label);
      if (opt.cost !== undefined) { const s = document.createElement('small'); s.textContent = opt.cost + ' MP'; btn.append(s); }
      if (opt.count !== undefined) { const s = document.createElement('small'); s.textContent = '×' + opt.count; btn.append(s); }
      btn.addEventListener('click', () => {
        if (B.menu.index !== i) { B.menu.index = i; renderBattleUI(); if (!isTouch) return; }
        confirmMenu();
      });
      btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && B.menu && B.menu.index !== i) { B.menu.index = i; renderBattleUI(); } });
      li.append(btn);
      bui.cmdList.append(li);
    });
  } else if (targeting) {
    bui.cmdWin.hidden = false;
    bui.cmdTitle.textContent = targeting.pending.label;
    bui.cmdList.innerHTML = '';
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'is-back';
    btn.textContent = 'Back';
    btn.addEventListener('click', backMenu);
    li.append(btn);
    const hint = document.createElement('li');
    hint.className = 'hint';
    hint.textContent = targeting.side === 'enemy' ? 'Choose a target' : 'Choose who';
    bui.cmdList.append(hint, li);
  } else {
    bui.cmdWin.hidden = true;
  }
  renderHelp();
}

function updateGauges() {
  for (const m of B.party) {
    const el = bui.partyList.querySelector(`[data-atb="${m.id}"]`);
    if (el) {
      el.style.transform = `scaleX(${m.atb / 100})`;
      el.parentElement.classList.toggle('is-full', m.atb >= 100);
    }
  }
}

bui.resultBtn.addEventListener('click', () => { if (B.result) endBattle(); });

// ---------- Battle rendering (canvas) ----------
const skyline = Array.from({ length: 26 }, (_, i) => ({ x: i / 26, w: 0.03 + Math.random() * 0.04, h: 0.12 + Math.random() * 0.22, win: Math.random() }));

function battlePositions(areaH) {
  const floorTop = areaH * 0.5;
  const place = (list, xFrac) => list.forEach((c, i) => {
    const n = list.length;
    c.bx = vw * xFrac + (i % 2 === 1 ? -vw * 0.06 : 0) * (n > 1 ? 1 : 0);
    c.by = floorTop + (areaH - floorTop) * ((i + 1) / (n + 1));
  });
  place(B.enemies, 0.26);
  place(B.party, 0.74);
}

function renderBattle() {
  const areaH = Math.max(200, vh - (bui.root.offsetHeight || 0));
  const s = Math.max(0.8, Math.min(1.7, areaH / 320));
  const quake = (B.shake || 0) ** 2 * 8;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#07080f';
  ctx.fillRect(0, 0, vw, vh);
  ctx.setTransform(dpr, 0, 0, dpr, (Math.random() * 2 - 1) * quake * dpr, (Math.random() * 2 - 1) * quake * dpr);
  // Night sky over the Crown Quarter
  const sky = ctx.createLinearGradient(0, 0, 0, areaH);
  sky.addColorStop(0, '#0a0d24');
  sky.addColorStop(0.55, '#1c1734');
  sky.addColorStop(1, '#120f1c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(243,232,200,.85)';
  ctx.beginPath(); ctx.arc(vw * 0.82, areaH * 0.14, 16 * s, 0, Math.PI * 2); ctx.fill();
  const floorTop = areaH * 0.5;
  for (const b of skyline) {
    const bx = b.x * vw, bw = b.w * vw, bh = b.h * areaH;
    ctx.fillStyle = '#0c0b16';
    ctx.fillRect(bx, floorTop - bh, bw, bh);
    if (b.win > 0.45) { ctx.fillStyle = 'rgba(240,190,110,.7)'; ctx.fillRect(bx + bw * 0.3, floorTop - bh * 0.7, 3 * s, 4 * s); }
  }
  // Wet cobblestone street
  const floor = ctx.createLinearGradient(0, floorTop, 0, areaH);
  floor.addColorStop(0, '#2a2733');
  floor.addColorStop(1, '#3a3645');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorTop, vw, areaH - floorTop);
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) { const y = floorTop + (areaH - floorTop) * (i / 7) ** 1.4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vw, y); ctx.stroke(); }
  for (const lx of [0.07, 0.5, 0.93]) {
    const x = vw * lx, y = floorTop - 4;
    const g = ctx.createRadialGradient(x, y - 30 * s, 0, x, y - 30 * s, 140 * s);
    g.addColorStop(0, 'rgba(233,170,80,.35)');
    g.addColorStop(1, 'rgba(233,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 160 * s, y - 180 * s, 320 * s, 320 * s);
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(x - 2 * s, y - 46 * s, 4 * s, 50 * s);
    ctx.fillStyle = '#ffd88a';
    ctx.beginPath(); ctx.arc(x, y - 48 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
  }

  battlePositions(areaH);
  const a = B.anim;
  const lunge = (c) => {
    if (!a || a.actor !== c || a.type === 'magic' || a.type === 'item' || a.type === 'run') return 0;
    const k = Math.min(1, a.t / a.dur);
    const reach = k < 0.45 ? Ease.backOut(k / 0.45) : k < 0.6 ? 1 : 1 - Ease.sineInOut((k - 0.6) / 0.4);
    return reach * 46 * s * (c.side === 'enemy' ? 1 : -1);
  };
  for (const e of B.enemies) {
    if (e.fade >= 1) continue;
    ctx.save();
    ctx.globalAlpha = 1 - e.fade;
    drawBattleGuard(e.bx + lunge(e), e.by, s, e);
    ctx.restore();
  }
  for (const m of B.party) drawBattleHero(m.bx + lunge(m), m.by, s, m, B.menu && B.menu.actor === m);

  // Spell effects
  for (const f of B.fx) {
    const t = f.target, k = f.t / 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const ang = i * 0.45 + f.t * 6;
      const r = (f.kind === 'Cure' ? 30 - k * 20 : 8 + k * 46) * s;
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(t.bx + Math.cos(ang) * r, t.by - 26 * s + Math.sin(ang) * r * (f.kind === 'Cure' ? 1 : 0.6) - (f.kind === 'Cure' ? k * 30 * s : 0), (f.kind === 'Ice' ? 3 : 5) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Target cursor
  if (B.menu && B.menu.stage === 'target') {
    const t = B.menu.targets[B.menu.index];
    if (t) {
      const bob = Math.sin(B.t * 8) * 4;
      const x = t.side === 'enemy' ? t.bx - 40 * s + bob : t.bx + 40 * s - bob;
      const y = t.by - 24 * s;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1b2a6b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const dir = t.side === 'enemy' ? 1 : -1;
      ctx.moveTo(x + dir * 12 * s, y); ctx.lineTo(x - dir * 6 * s, y - 9 * s); ctx.lineTo(x - dir * 6 * s, y + 9 * s); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }

  // Damage and loot numbers
  ctx.textAlign = 'center';
  for (const p of B.popups) {
    const k = p.t / 1.1;
    ctx.font = `800 ${Math.round(20 * s * (0.6 + 0.4 * Ease.backOut(Math.min(1, k * 4))))}px Barlow, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
    const y = p.target.by - 54 * s - Ease.expoOut(Math.min(1, k * 1.6)) * 22 * s;
    ctx.strokeText(p.text, p.target.bx, y);
    ctx.fillText(p.text, p.target.bx, y);
    ctx.globalAlpha = 1;
  }

  // Encounter swirl
  if (B.intro > 0) {
    const k = Ease.sineInOut(Math.max(0, B.intro / 0.9));
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, k - 0.6) * 2})`;
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2, areaH / 2);
    ctx.rotate(k * 4);
    ctx.fillStyle = '#05060c';
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(0, -k * vh * 0.12, vw * k * 1.2, k * vh * 0.24); }
    ctx.restore();
  }
}

function drawBattleGuard(x, y, s, e) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 2, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
  const flash = e.flash > 0 && Math.floor(e.flash * 30) % 2 === 0;
  // legs
  ctx.fillStyle = '#15151d';
  ctx.fillRect(-9, -18, 7, 18); ctx.fillRect(3, -18, 7, 18);
  // coat
  ctx.fillStyle = flash ? '#ffffff' : e.coat;
  ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(14, -16); ctx.lineTo(11, -52); ctx.lineTo(-11, -52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = e.trim;
  ctx.fillRect(-1.5, -52, 3, 36);
  ctx.fillRect(-12, -24, 24, 3);
  // head + tricorne
  ctx.fillStyle = '#5a3b2b';
  ctx.beginPath(); ctx.arc(2, -60, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#12141f';
  ctx.beginPath(); ctx.moveTo(-12, -64); ctx.lineTo(14, -66); ctx.lineTo(4, -76); ctx.closePath(); ctx.fill();
  // baton arm, lantern on the belt
  ctx.strokeStyle = '#3a2a1f'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, -44); ctx.lineTo(24, -30); ctx.stroke();
  ctx.fillStyle = '#ffd88a';
  ctx.beginPath(); ctx.arc(-14, -26, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBattleHero(x, y, s, m, active) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (!m.alive) {
    ctx.fillStyle = m.look.body;
    ctx.beginPath(); ctx.ellipse(0, -6, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0, 2, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (active) {
    const g = ctx.createRadialGradient(0, -36, 0, 0, -36, 46);
    g.addColorStop(0, 'rgba(243,215,154,.28)');
    g.addColorStop(1, 'rgba(243,215,154,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -36, 46, 0, Math.PI * 2); ctx.fill();
  }
  const flash = m.flash > 0 && Math.floor(m.flash * 30) % 2 === 0;
  const look = m.look;
  const breathe = Math.sin(B.t * 3) * 1;
  // tail (ZAY)
  if (look.tail) {
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    const sway = Math.sin(B.t * 4) * 6;
    ctx.beginPath(); ctx.moveTo(8, -24); ctx.quadraticCurveTo(26, -20 + sway, 30, -40 + sway); ctx.stroke();
  }
  // legs
  ctx.fillStyle = '#0d0d13';
  ctx.fillRect(-8, -18, 6, 18); ctx.fillRect(2, -18, 6, 18);
  // body
  ctx.fillStyle = flash ? '#ffffff' : look.body;
  if (look.style === 'caster') {
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(14, -2); ctx.lineTo(8, -50 + breathe); ctx.lineTo(-8, -50 + breathe); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-11, -16); ctx.lineTo(11, -16); ctx.lineTo(9, -50 + breathe); ctx.lineTo(-9, -50 + breathe); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = look.trim;
  ctx.fillRect(-10, -26, 20, 2.5);
  // head
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(-2, -58 + breathe, 8, 0, Math.PI * 2); ctx.fill();
  if (look.style === 'rogue') {
    // hood, mask and gold eyes
    ctx.fillStyle = '#0b0b10';
    ctx.beginPath(); ctx.arc(-1, -59 + breathe, 9, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
    ctx.fillRect(-10, -56 + breathe, 12, 5);
    ctx.fillStyle = '#f3c25c';
    ctx.fillRect(-8, -60 + breathe, 3, 2);
    // katana across the back, daggers at the hips
    ctx.strokeStyle = '#d4d4e0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, -66); ctx.lineTo(-6, -26); ctx.stroke();
    ctx.fillStyle = look.trim; ctx.fillRect(9, -70, 4, 6);
    ctx.fillStyle = '#c9c9d6'; ctx.fillRect(-13, -22, 3, 9); ctx.fillRect(10, -22, 3, 9);
  } else if (look.style === 'caster') {
    ctx.fillStyle = look.trim;
    ctx.beginPath(); ctx.moveTo(-14, -62 + breathe); ctx.lineTo(10, -62 + breathe); ctx.lineTo(-4, -86 + breathe); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -60); ctx.stroke();
    ctx.fillStyle = '#9fd3ff'; ctx.beginPath(); ctx.arc(-16, -62, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = '#d4d4e0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -36); ctx.lineTo(-30, -66); ctx.stroke();
    ctx.fillStyle = look.trim; ctx.fillRect(-14, -38, 6, 4);
  }
  ctx.restore();
}
