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
  play('encounter');
  setMusic('battle');
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
  setMusic('night');
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
  play('uiOpen', { vol: 0.8 });
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
    if (opt.disabled) { play('uiError'); return; }
    play('uiConfirm', { vol: 0.7 });
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
    if (!opt || opt.disabled) { play('uiError'); return; }
    play('uiConfirm', { vol: 0.7 });
    if (menu.stage === 'magic') return chooseTarget(SPELLS[opt.label].target, { type: 'magic', spell: opt.label, label: opt.label });
    const item = ITEMS[opt.label];
    if (item.target === 'none') return execute({ type: 'item', item: opt.label, label: opt.label, targets: [] });
    return chooseTarget('party', { type: 'item', item: opt.label, label: opt.label }, Boolean(item.effect.revive));
  } else if (menu.stage === 'target') {
    const target = menu.targets[menu.index];
    if (!target) return;
    play('uiConfirm', { vol: 0.7 });
    execute({ ...menu.pending, targets: [target] });
  }
}

function backMenu() {
  const menu = B.menu;
  if (!menu || menu.stage === 'command') return;
  play('uiBack');
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
  play('uiMove');
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
  if (SETTINGS.shake) B.shake = Math.min(1, (B.shake || 0) + (crit ? 0.55 : 0.28));
  popup(target, String(amount) + (crit ? '!' : ''), crit ? '#ffe08a' : '#ffffff');
  if (target.hp === 0) {
    target.alive = false;
    target.atb = 0;
    play('thud'); play('ko', { delay: 0.05 });
  }
}

function heal(target, amount) {
  target.hp = Math.min(target.maxHp, target.hp + amount);
  popup(target, String(amount), '#8ef0a2');
  play('heal');
}

function useItemOn(name, target) {
  const fx = ITEMS[name].effect;
  if (fx.revive) {
    if (target.alive) { popup(target, 'No effect', '#c9c3b2'); return false; }
    target.alive = true;
    target.hp = Math.max(1, Math.round(target.maxHp * fx.revive));
    popup(target, 'Revived', '#8ef0a2');
    play('heal'); play('uiConfirm', { delay: 0.2 });
    return true;
  }
  if (!target.alive) { popup(target, 'No effect', '#c9c3b2'); return false; }
  if (fx.heal) heal(target, fx.heal);
  if (fx.mp) {
    target.mp = Math.min(target.maxMp, target.mp + fx.mp);
    popup(target, `+${fx.mp} MP`, '#9fd3ff');
    play('heal');
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
    if (actor.side === 'party') play(d.crit ? 'clang' : (Math.random() < 0.5 ? 'slice' : 'slice2'), { vol: d.crit ? 0.8 : 1 });
    else { play('chop'); play('thump', { delay: 0.02 }); }
  } else if (a.type === 'slash') {
    for (const t of aliveOn('enemy')) { const d = damage(stat(actor, 'atk'), stat(t, 'def'), 0.85); hurt(t, d.amount, d.crit); }
    play('draw'); play('slice', { delay: 0.12 }); play('slice2', { delay: 0.22 });
  } else if (a.type === 'magic') {
    const spell = SPELLS[a.spell];
    const t = targets[0];
    if (!t) return;
    B.fx.push({ kind: a.spell, target: t, t: 0, color: spell.color });
    if (spell.kind === 'heal') heal(t, Math.round(stat(actor, 'mag') * spell.power * randBetween(0.95, 1.1)));
    else {
      hurt(t, Math.max(1, Math.round(stat(actor, 'mag') * spell.power * randBetween(0.9, 1.1) - stat(t, 'def') * 0.5)), false);
      play(a.spell === 'Fire' ? 'fire' : 'ice');
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
        noteNewItem(loot.item);
        state.stolen.push(loot.item);
        popup(t, loot.item, '#f3d79a');
        showMsg(`Stole a ${loot.item}!`);
      }
      play('coins2');
    } else {
      popup(t, 'Missed', '#c9c3b2');
      play('miss');
      showMsg("Couldn't steal anything.");
    }
  } else if (a.type === 'item') {
    const item = ITEMS[a.item];
    if (item.effect.escape) {
      B.result = 'run';
      B.fx.push({ kind: 'smoke', target: actor, t: 0, color: '#c9cbd8' });
      showMsg('A pop, a cloud, and ZAY is gone.');
      play('smoke');
      return;
    }
    const t = targets[0];
    if (t) useItemOn(a.item, t);
  } else if (a.type === 'run') {
    if (Math.random() < 0.6) { B.result = 'run'; showMsg('Slipped away into the dark.'); play('cloth2'); play('swish', { delay: 0.1 }); }
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
    setMusic(null);
    play('jVictory');
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
      if (Math.random() < d.chance) { found.push(d.item); state.items[d.item] = (state.items[d.item] || 0) + 1; noteNewItem(d.item); }
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
    if (r.levelUps.length) play('jLevel', { delay: 1.0 });
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
  for (const c of all) c.atb = Math.min(100, c.atb + stat(c, 'spd') * dt * 3 * SETTINGS.battleSpeed);
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
  const s = Math.max(0.72, Math.min(1.5, areaH / 360));
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
  for (const e of [...B.enemies].sort((a, b) => a.by - b.by)) {
    if (e.fade >= 1) continue;
    ctx.save();
    ctx.globalAlpha = 1 - e.fade;
    drawBattleGuard(e.bx + lunge(e), e.by, s, e);
    ctx.restore();
  }
  for (const m of [...B.party].sort((a, b) => a.by - b.by)) drawBattleHero(m.bx + lunge(m), m.by, s, m, B.menu && B.menu.actor === m);

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

// ---------- Battle character models ----------
// Figures are drawn facing right in local units (feet at y = 0, about 100 units tall), then scaled.
// Party members are mirrored so they face the enemies. Poses: idle breathing, attack wind-up and strike,
// flinch when hit, a kneel at low HP (Final Fantasy "critical"), and knocked out.

function poseOf(c) {
  const a = B.anim;
  const attacking = a && a.actor === c && (a.type === 'hit' || a.type === 'slash' || a.type === 'steal');
  const casting = a && a.actor === c && (a.type === 'magic' || a.type === 'item');
  const k = attacking || casting ? Math.min(1, a.t / a.dur) : 0;
  // swing: 0 = rest, -1 = wound up, +1 = follow-through
  let swing = 0;
  if (attacking) swing = k < 0.35 ? -Ease.cubicOut(k / 0.35) : k < 0.55 ? -1 + 2 * Ease.backOut((k - 0.35) / 0.2) : 1 - Ease.sineInOut((k - 0.55) / 0.45);
  return {
    t: B.t + (c.bx || 0) * 0.01,
    breathe: Math.sin((B.t + (c.by || 0) * 0.02) * 2.6),
    swing,
    attacking: Boolean(attacking),
    casting: casting ? Math.sin(Math.PI * k) : 0,
    flinch: c.flash > 0 ? c.flash / 0.25 : 0,
    critical: c.alive && c.maxHp && c.hp / c.maxHp <= 0.25
  };
}

function limb(x1, y1, x2, y2, w, fill, edge) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = edge;
  ctx.lineWidth = w + 2.2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
// Two-bone limb from a root with two angles (radians, 0 = pointing down).
function arm(x, y, a1, l1, a2, l2, w, fill, edge) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const hx = ex + Math.sin(a1 + a2) * l2, hy = ey + Math.cos(a1 + a2) * l2;
  limb(x, y, ex, ey, w, fill, edge);
  limb(ex, ey, hx, hy, w * 0.86, fill, edge);
  return { ex, ey, hx, hy, ang: a1 + a2 };
}
function shade(top, bottom, y1, y2) {
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}
function groundShadow(w) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  g.addColorStop(0, 'rgba(0,0,0,.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, w, w * 0.26, 0, 0, Math.PI * 2); ctx.fill();
}
function flashOver(p) { return p.flinch > 0 && Math.floor(p.flinch * 8) % 2 === 0; }

function drawBattleGuard(x, y, s, e) {
  const p = poseOf(e);
  const captain = e.name === 'Estate Captain';
  const coat = e.coat, coatDark = captain ? '#241733' : '#141a2e', trim = e.trim, skin = '#5a3b2b', skinDark = '#3e281d';
  const edge = '#07080f';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  groundShadow(30);
  ctx.rotate(-p.flinch * 0.12);
  const lean = p.flinch * -4 + p.swing * 3;
  const by = p.breathe * 0.8;
  const hipX = lean * 0.4, hipY = -46;
  const shX = 3 + lean, shY = -74 + by;

  // Captain's cape behind everything
  if (captain) {
    ctx.fillStyle = shade('#6a1f2c', '#3a0f18', -78, -14);
    ctx.beginPath();
    ctx.moveTo(shX - 12, shY + 2);
    ctx.quadraticCurveTo(-26 + Math.sin(p.t * 1.7) * 3, -40, -22 + Math.sin(p.t * 1.7) * 4, -14);
    ctx.lineTo(4, -18); ctx.lineTo(shX + 8, shY + 2); ctx.closePath(); ctx.fill();
  }
  // Back leg
  limb(hipX - 3, hipY, hipX - 10, -24, 8, '#151520', edge);
  limb(hipX - 10, -24, hipX - 8, -4, 7, '#151520', edge);
  ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.ellipse(hipX - 5, -2, 8, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  // Back arm holding the lantern
  const back = arm(shX - 8, shY + 4, 0.25, 15, -0.35, 14, 6.5, coatDark, edge);
  const flick = 0.75 + Math.sin(p.t * 11) * 0.12 + Math.sin(p.t * 7.3) * 0.08;
  const lg = ctx.createRadialGradient(back.hx, back.hy + 6, 0, back.hx, back.hy + 6, 34);
  lg.addColorStop(0, `rgba(255,200,110,${0.42 * flick})`);
  lg.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(back.hx, back.hy + 6, 34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(back.hx, back.hy); ctx.lineTo(back.hx, back.hy + 3); ctx.stroke();
  ctx.fillStyle = '#2a1e14'; ctx.fillRect(back.hx - 4.5, back.hy + 3, 9, 2); ctx.fillRect(back.hx - 4.5, back.hy + 12, 9, 2);
  ctx.fillStyle = `rgba(255,214,140,${flick})`; ctx.fillRect(back.hx - 3.5, back.hy + 5, 7, 7);
  // Coat skirt
  ctx.fillStyle = shade(coat, coatDark, -50, -16);
  ctx.beginPath();
  ctx.moveTo(hipX - 12, -50); ctx.lineTo(hipX + 13, -50);
  ctx.lineTo(hipX + 16 + lean * 0.3, -17); ctx.quadraticCurveTo(hipX, -14, hipX - 15, -18);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(hipX - 15, -18.5); ctx.quadraticCurveTo(hipX, -14.5, hipX + 16 + lean * 0.3, -17.5); ctx.stroke();
  // Front leg
  limb(hipX + 4, hipY, hipX + 9, -24, 8.5, '#1b1b27', edge);
  limb(hipX + 9, -24, hipX + 7, -4, 7.5, '#1b1b27', edge);
  ctx.fillStyle = '#0d0d13'; ctx.beginPath(); ctx.ellipse(hipX + 11, -2.5, 9, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  // Torso
  ctx.fillStyle = flashOver(p) ? '#ffffff' : shade(coat, coatDark, shY - 4, -46);
  ctx.beginPath();
  ctx.moveTo(shX - 13, shY + 1); ctx.quadraticCurveTo(shX + 2, shY - 4, shX + 14, shY + 1);
  ctx.lineTo(hipX + 12, -48); ctx.lineTo(hipX - 11, -48); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke();
  // Lapel, buttons, sash, belt
  ctx.strokeStyle = trim; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(shX + 4, shY + 1); ctx.lineTo(hipX + 3, -50); ctx.stroke();
  ctx.fillStyle = trim;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(shX + 7 - i * 0.8, shY + 7 + i * 6, 1.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = captain ? '#8a2333' : '#7a1f22';
  ctx.beginPath(); ctx.moveTo(shX - 10, shY + 3); ctx.lineTo(shX - 4, shY + 3); ctx.lineTo(hipX + 12, -52); ctx.lineTo(hipX + 6, -52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a120c'; ctx.fillRect(hipX - 12, -51, 25, 4);
  ctx.fillStyle = trim; ctx.fillRect(hipX + 1, -51, 4, 4);
  if (captain) {
    ctx.fillStyle = trim;
    ctx.beginPath(); ctx.ellipse(shX + 10, shY + 1, 6, 2.4, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(shX - 9, shY + 1, 5, 2.2, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  // Head
  const hx = shX + 2, hy = shY - 13;
  limb(shX + 1, shY, hx, hy + 6, 5, skinDark, edge);
  ctx.fillStyle = flashOver(p) ? '#ffffff' : skin;
  ctx.beginPath(); ctx.ellipse(hx, hy, 8, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = skinDark; ctx.beginPath(); ctx.ellipse(hx - 5, hy + 1, 2.4, 3.4, 0, 0, Math.PI * 2); ctx.fill(); // ear
  ctx.fillStyle = '#f1ead9'; ctx.fillRect(hx + 4, hy - 1.5, 2.6, 1.8);
  ctx.fillStyle = '#1a120c'; ctx.fillRect(hx + 5.2, hy - 1.4, 1.3, 1.6);
  ctx.strokeStyle = skinDark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + 4, hy + 5); ctx.lineTo(hx + 7, hy + 4.5); ctx.stroke();
  // Tricorne
  ctx.fillStyle = '#10121c';
  ctx.beginPath(); ctx.moveTo(hx - 13, hy - 4); ctx.quadraticCurveTo(hx, hy - 9, hx + 14, hy - 5); ctx.lineTo(hx + 6, hy - 16); ctx.lineTo(hx - 6, hy - 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(hx - 13, hy - 4); ctx.quadraticCurveTo(hx, hy - 9, hx + 14, hy - 5); ctx.stroke();
  if (captain) {
    ctx.strokeStyle = '#c63a4a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - 4, hy - 14); ctx.quadraticCurveTo(hx - 16, hy - 26 + Math.sin(p.t * 3) * 2, hx - 22, hy - 18); ctx.stroke();
  }
  // Weapon arm: rest -> wind up (raised) -> strike forward
  const a1 = 0.55 + p.swing * 1.25, a2 = -0.9 - p.swing * 0.5;
  const front = arm(shX + 9, shY + 3, a1 + Math.PI * 0, 15, a2, 14, 7, coat, edge);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(front.hx, front.hy, 3.4, 0, Math.PI * 2); ctx.fill();
  const wAng = front.ang + Math.PI - 0.5;
  const wl = captain ? 34 : 26;
  const tipX = front.hx + Math.sin(wAng) * wl, tipY = front.hy + Math.cos(wAng) * wl;
  if (captain) {
    ctx.strokeStyle = '#d4d8e4'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(front.hx, front.hy); ctx.quadraticCurveTo((front.hx + tipX) / 2 + 4, (front.hy + tipY) / 2, tipX, tipY); ctx.stroke();
    ctx.fillStyle = trim; ctx.fillRect(front.hx - 3, front.hy - 1.5, 6, 3);
  } else {
    limb(front.hx, front.hy, tipX, tipY, 4.2, '#4a3220', edge);
    ctx.fillStyle = '#6b6b78'; ctx.beginPath(); ctx.arc(tipX, tipY, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  if (p.attacking && Math.abs(p.swing) > 0.3) {
    ctx.strokeStyle = `rgba(255,236,200,${0.35 * Math.abs(p.swing)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(shX + 9, shY + 3, wl + 26, -1.2, 0.6 + p.swing * 0.6); ctx.stroke();
  }
  ctx.restore();
}

function drawBattleHero(x, y, s, m, active) {
  const p = poseOf(m);
  const look = m.look;
  const edge = '#050507';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-s, s); // face the enemies on the left

  if (!m.alive) {
    // Knocked out: lying on the street
    groundShadow(36);
    ctx.fillStyle = look.body;
    ctx.beginPath(); ctx.ellipse(-4, -6, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(26, -8, 7, 0, Math.PI * 2); ctx.fill();
    if (look.tail) { ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-30, -6); ctx.quadraticCurveTo(-44, -2, -50, -10); ctx.stroke(); }
    ctx.restore();
    return;
  }
  groundShadow(30);
  if (active) {
    const g = ctx.createRadialGradient(0, -48, 0, 0, -48, 58);
    g.addColorStop(0, 'rgba(243,215,154,.22)');
    g.addColorStop(1, 'rgba(243,215,154,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -48, 58, 0, Math.PI * 2); ctx.fill();
  }
  ctx.rotate(-p.flinch * 0.14);
  const kneel = p.critical ? 1 : 0;
  const lean = 5 + p.swing * 4 - p.flinch * 5 + kneel * 4;
  const by = p.breathe * (p.critical ? 1.8 : 0.9);
  const hipY = -42 + kneel * 12, hipX = lean * 0.3;
  const shX = 4 + lean, shY = -68 + by + kneel * 14;
  const cloth = look.body, clothHi = look.style === 'rogue' ? '#262634' : look.trim;

  // Tail (ZAY): long, darker than his skin, with its own attitude
  if (look.tail) {
    const sw = Math.sin(p.t * 2.2) * 7, sw2 = Math.cos(p.t * 1.6) * 6;
    ctx.strokeStyle = edge; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hipX - 6, hipY - 2); ctx.bezierCurveTo(-30, hipY + 6 + sw, -40, hipY - 26 + sw2, -30 + sw2, hipY - 44); ctx.stroke();
    ctx.strokeStyle = '#2e1d15'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hipX - 6, hipY - 2); ctx.bezierCurveTo(-30, hipY + 6 + sw, -40, hipY - 26 + sw2, -30 + sw2, hipY - 44); ctx.stroke();
  }
  // Back leg (crouched rogue stance)
  const knee2 = kneel ? { x: hipX - 14, y: -2 } : { x: hipX - 12, y: -22 };
  limb(hipX - 3, hipY, knee2.x, knee2.y, 8, '#101016', edge);
  limb(knee2.x, knee2.y, hipX - 16, -3, 7, '#101016', edge);
  ctx.fillStyle = '#08080c'; ctx.beginPath(); ctx.ellipse(hipX - 13, -2, 7.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  // Back arm
  const backA = p.casting ? arm(shX - 7, shY + 4, 2.4, 13, 0.2, 13, 6, cloth, edge)
    : arm(shX - 7, shY + 4, -0.35 + p.swing * 0.3, 14, -0.6, 13, 6, cloth, edge);
  ctx.fillStyle = '#d8d2c4'; ctx.beginPath(); ctx.arc(backA.hx, backA.hy, 2.6, 0, Math.PI * 2); ctx.fill(); // wrapped wrist
  // Hip daggers (rogue): one on each hip
  if (look.style === 'rogue') {
    ctx.fillStyle = '#c9c9d6'; ctx.fillRect(hipX - 12, hipY - 3, 3, 12);
    ctx.fillStyle = '#5a3b2b'; ctx.fillRect(hipX - 12.5, hipY - 7, 4, 5);
  }
  // Coat / robe
  if (look.style === 'caster') {
    ctx.fillStyle = shade(cloth, '#120c1c', shY, 0);
    ctx.beginPath(); ctx.moveTo(shX - 11, shY + 2); ctx.lineTo(shX + 11, shY + 2); ctx.lineTo(hipX + 18, -2); ctx.lineTo(hipX - 18, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = look.trim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hipX - 18, -3); ctx.lineTo(hipX + 18, -3); ctx.stroke();
  } else {
    ctx.fillStyle = shade(clothHi, cloth, hipY - 8, hipY + 18);
    ctx.beginPath();
    ctx.moveTo(hipX - 11, hipY - 6); ctx.lineTo(hipX + 12, hipY - 6);
    ctx.lineTo(hipX + 13 + Math.sin(p.t * 2) * 1.5, hipY + 14); ctx.lineTo(hipX - 14 + Math.sin(p.t * 2 + 1) * 1.5, hipY + 12);
    ctx.closePath(); ctx.fill();
  }
  // Front leg
  const knee1 = kneel ? { x: hipX + 12, y: -14 } : { x: hipX + 11, y: -22 };
  limb(hipX + 4, hipY, knee1.x, knee1.y, 8.5, '#15151d', edge);
  limb(knee1.x, knee1.y, hipX + 10, -3, 7.5, '#15151d', edge);
  ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.ellipse(hipX + 14, -2.4, 8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  // Torso: hooded half coat
  ctx.fillStyle = flashOver(p) ? '#ffffff' : shade(clothHi, cloth, shY - 2, hipY);
  ctx.beginPath();
  ctx.moveTo(shX - 11, shY + 1); ctx.quadraticCurveTo(shX + 1, shY - 3, shX + 11, shY + 1);
  ctx.lineTo(hipX + 11, hipY - 4); ctx.lineTo(hipX - 10, hipY - 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke();
  if (look.style === 'sword') { ctx.fillStyle = 'rgba(210,215,230,.55)'; ctx.fillRect(shX - 9, shY + 4, 18, 9); }
  ctx.strokeStyle = look.trim; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(hipX - 10, hipY - 6); ctx.lineTo(hipX + 11, hipY - 6); ctx.stroke();
  ctx.globalAlpha = 1;
  // Katana across the back when not in hand is skipped: in battle he holds it.
  // Head
  const hx = shX + 3, hy = shY - 12;
  limb(shX + 1, shY, hx, hy + 6, 5, look.skin, edge);
  if (look.style === 'rogue') {
    // Locs gathered back, under the hood
    ctx.strokeStyle = '#1a110c'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx - 5, hy - 2 + i * 2); ctx.quadraticCurveTo(hx - 14, hy + 2 + i * 3 + Math.sin(p.t * 2 + i) * 1.5, hx - 15, hy + 9 + i * 2); ctx.stroke(); }
  }
  ctx.fillStyle = flashOver(p) ? '#ffffff' : look.skin;
  ctx.beginPath(); ctx.ellipse(hx, hy, 7.5, 9, 0.05, 0, Math.PI * 2); ctx.fill();
  if (look.style === 'rogue') {
    // Hood and mask; hazel-gold eyes; a pointed elven ear
    ctx.fillStyle = '#0c0c12';
    ctx.beginPath(); ctx.moveTo(hx - 10, hy + 7); ctx.quadraticCurveTo(hx - 12, hy - 14, hx + 3, hy - 12); ctx.quadraticCurveTo(hx + 10, hy - 10, hx + 9, hy - 3); ctx.lineTo(hx + 2, hy - 4); ctx.quadraticCurveTo(hx - 4, hy - 6, hx - 5, hy + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#121218';
    ctx.beginPath(); ctx.moveTo(hx - 3, hy + 1); ctx.lineTo(hx + 8.5, hy + 0.5); ctx.quadraticCurveTo(hx + 9, hy + 7, hx + 3, hy + 9); ctx.lineTo(hx - 4, hy + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = look.skin;
    ctx.beginPath(); ctx.moveTo(hx - 5, hy - 3); ctx.lineTo(hx - 12, hy - 9); ctx.lineTo(hx - 6, hy + 1); ctx.closePath(); ctx.fill();
    const glow = 0.85 + Math.sin(p.t * 3) * 0.15;
    ctx.fillStyle = `rgba(243,194,92,${glow})`; ctx.fillRect(hx + 3.5, hy - 2.4, 3.2, 1.8);
    ctx.fillStyle = 'rgba(243,194,92,.25)'; ctx.beginPath(); ctx.arc(hx + 5, hy - 1.5, 4, 0, Math.PI * 2); ctx.fill();
  } else if (look.style === 'caster') {
    ctx.fillStyle = '#f1ead9'; ctx.fillRect(hx + 3.5, hy - 2, 2.4, 1.8);
    ctx.fillStyle = look.trim;
    ctx.beginPath(); ctx.moveTo(hx - 14, hy - 5); ctx.lineTo(hx + 12, hy - 6); ctx.lineTo(hx - 6, hy - 30 + Math.sin(p.t * 2) * 2); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#f1ead9'; ctx.fillRect(hx + 3.5, hy - 2, 2.4, 1.8);
    ctx.fillStyle = '#8a8fa0';
    ctx.beginPath(); ctx.arc(hx, hy - 3, 9, Math.PI, 0); ctx.fill();
  }
  // Weapon arm
  let a1, a2;
  if (p.casting) { a1 = 2.5; a2 = 0.3; } else { a1 = 0.7 + p.swing * 1.3; a2 = -1.0 - p.swing * 0.4; }
  const front = arm(shX + 8, shY + 3, a1, 14, a2, 13, 6.5, cloth, edge);
  ctx.fillStyle = '#d8d2c4'; ctx.beginPath(); ctx.arc(front.hx, front.hy, 2.8, 0, Math.PI * 2); ctx.fill();
  const wAng = front.ang + Math.PI - 0.35;
  if (look.style === 'caster') {
    const tx = front.hx + Math.sin(wAng) * -10, ty = front.hy + Math.cos(wAng) * -10;
    limb(front.hx - Math.sin(wAng) * 30, front.hy - Math.cos(wAng) * 30, tx, ty, 3, '#8a6a3a', edge);
    ctx.fillStyle = '#9fd3ff'; ctx.beginPath(); ctx.arc(front.hx - Math.sin(wAng) * 30, front.hy - Math.cos(wAng) * 30, 4 + p.casting * 3, 0, Math.PI * 2); ctx.fill();
  } else {
    // Katana (or greatsword): guard, curved blade, glint
    const len = look.style === 'sword' ? 46 : 40;
    const bx = front.hx + Math.sin(wAng) * len, byy = front.hy + Math.cos(wAng) * len;
    ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(front.hx - Math.sin(wAng) * 7, front.hy - Math.cos(wAng) * 7); ctx.lineTo(front.hx, front.hy); ctx.stroke();
    ctx.fillStyle = look.trim; ctx.beginPath(); ctx.arc(front.hx, front.hy, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e4e6f0'; ctx.lineWidth = look.style === 'sword' ? 4 : 2.4;
    ctx.beginPath(); ctx.moveTo(front.hx, front.hy);
    ctx.quadraticCurveTo((front.hx + bx) / 2 + Math.cos(wAng) * 4, (front.hy + byy) / 2 - Math.sin(wAng) * 4, bx, byy); ctx.stroke();
    const glint = (Math.sin(p.t * 1.3) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + glint * 0.5})`;
    ctx.beginPath(); ctx.arc(front.hx + (bx - front.hx) * (0.3 + glint * 0.5), front.hy + (byy - front.hy) * (0.3 + glint * 0.5), 1.6, 0, Math.PI * 2); ctx.fill();
    if (p.attacking && Math.abs(p.swing) > 0.25) {
      ctx.strokeStyle = `rgba(243,215,154,${0.45 * Math.abs(p.swing)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(shX + 8, shY + 3, len + 12, -1.3, 0.5 + p.swing * 0.7); ctx.stroke();
    }
  }
  // Warm rim light from the street lanterns on the leading edge
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(233,170,80,.18)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(shX + 11, shY + 2); ctx.lineTo(hipX + 11, hipY - 4); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
