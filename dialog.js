'use strict';

// Dialogs with choices, story scenes and overheard guard talk.
// Pattern from RPG-JS (MIT): scripts read like a story — `await say(...)`, `await choose(...)`.
// Re-written for this game; no RPG-JS code is used.

const DLG = { open: false, lines: [], index: 0, shown: 0, full: '', resolve: null, choice: null, prevMode: 'field', speed: 48 };
const dui = {
  root: document.getElementById('dialog'),
  portrait: document.getElementById('dialog-portrait'),
  name: document.getElementById('dialog-name'),
  text: document.getElementById('dialog-text'),
  choices: document.getElementById('dialog-choices'),
  next: document.getElementById('dialog-next')
};

// ---------- Portraits (small drawn faces) ----------
const PORTRAITS = {
  zay: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="#141826"/><path d="M8 48c2-12 8-17 16-17s14 5 16 17z" fill="#14141c"/><ellipse cx="24" cy="23" rx="10" ry="12" fill="#5a3b2b"/><path d="M11 30c-2-14 4-21 13-21s15 7 13 21l-4-1c1-8-3-13-9-13s-10 5-9 13z" fill="#0c0c12"/><path d="M15 26h18c0 5-4 8-9 8s-9-3-9-8z" fill="#121218"/><path d="M14 20l-6-7 7 3z" fill="#5a3b2b"/><rect x="17" y="21" width="5" height="2.2" rx="1" fill="#f3c25c"/><rect x="26" y="21" width="5" height="2.2" rx="1" fill="#f3c25c"/></svg>`,
  guard: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="#141826"/><path d="M8 48c2-12 8-16 16-16s14 4 16 16z" fill="#26304d"/><path d="M20 32l4 8 4-8" fill="#7a1f22"/><ellipse cx="24" cy="24" rx="9" ry="11" fill="#5a3b2b"/><rect x="18" y="22" width="3" height="2" fill="#1a120c"/><rect x="27" y="22" width="3" height="2" fill="#1a120c"/><path d="M20 30h8" stroke="#3e281d" stroke-width="1.5"/><path d="M6 17c8-4 28-4 36 0l-8-9H14z" fill="#10121c"/><path d="M6 17c8-4 28-4 36 0" stroke="#b08a3e" stroke-width="1.5" fill="none"/></svg>`,
  kid: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="#141826"/><path d="M10 48c2-10 7-14 14-14s12 4 14 14z" fill="#2d2a3a"/><ellipse cx="24" cy="26" rx="9" ry="10" fill="#6b4a35"/><path d="M15 22c0-8 4-11 9-11s9 3 9 11c-3-3-6-4-9-4s-6 1-9 4z" fill="#1a110c"/><circle cx="20" cy="26" r="1.5" fill="#1a120c"/><circle cx="28" cy="26" r="1.5" fill="#1a120c"/><path d="M21 31c2 1.5 4 1.5 6 0" stroke="#3e281d" stroke-width="1.4" fill="none"/></svg>`,
  fence: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" fill="#141826"/><path d="M6 48c2-13 9-18 18-18s16 5 18 18z" fill="#2a2f2a"/><path d="M11 30c-1-15 5-22 13-22s14 7 13 22c-3-6-7-9-13-9s-10 3-13 9z" fill="#1d221d"/><ellipse cx="24" cy="27" rx="8" ry="9" fill="#7a5440"/><rect x="18" y="24" width="5" height="3" rx="1" fill="#0c0c12"/><circle cx="29" cy="26" r="1.4" fill="#1a120c"/><path d="M19 32c3 1 7 1 10-1" stroke="#3e281d" stroke-width="1.4" fill="none"/><circle cx="33" cy="34" r="2" fill="#e9b65a"/></svg>`
};
const SPEAKERS = {
  zay: { name: 'ZAY', portrait: 'zay' },
  guard: { name: 'Veyrane Guard', portrait: 'guard' },
  captain: { name: 'Estate Captain', portrait: 'guard' },
  kid: { name: 'Soot kid', portrait: 'kid' },
  fence: { name: 'Blackwater fence', portrait: 'fence' }
};

// ---------- Core: say / choose ----------
function say(who, ...texts) {
  return new Promise((resolve) => {
    openDialog();
    DLG.lines = texts.map((text) => ({ who, text }));
    DLG.index = 0;
    DLG.choice = null;
    DLG.resolve = resolve;
    showLine();
  });
}

function choose(who, prompt, options) {
  return new Promise((resolve) => {
    openDialog();
    DLG.lines = [{ who, text: prompt }];
    DLG.index = 0;
    DLG.choice = { options, index: options.findIndex((o) => !o.disabled), resolve };
    if (DLG.choice.index < 0) DLG.choice.index = 0;
    DLG.resolve = null;
    showLine();
  });
}

function openDialog() {
  if (!DLG.open) {
    DLG.prevMode = state.mode === 'dialog' ? DLG.prevMode : state.mode;
    state.mode = 'dialog';
    DLG.open = true;
    dui.root.hidden = false;
    hudEls.hud.hidden = true;
    document.getElementById('touch').hidden = true;
  }
}

function closeDialog() {
  DLG.open = false;
  dui.root.hidden = true;
  if (state.mode === 'dialog') state.mode = DLG.prevMode === 'dialog' ? 'field' : DLG.prevMode;
  if (state.mode === 'field' && !state.over) {
    hudEls.hud.hidden = false;
    document.getElementById('touch').hidden = !isTouch;
    hudCache = '';
  }
}

function showLine() {
  const line = DLG.lines[DLG.index];
  const sp = SPEAKERS[line.who] || { name: line.who, portrait: 'guard' };
  dui.name.textContent = sp.name;
  dui.portrait.innerHTML = PORTRAITS[sp.portrait] || '';
  DLG.full = line.text;
  DLG.shown = 0;
  dui.text.textContent = '';
  dui.choices.hidden = true;
  dui.next.hidden = true;
}

function lineDone() { return DLG.shown >= DLG.full.length; }

function renderChoices() {
  const c = DLG.choice;
  dui.choices.innerHTML = '';
  c.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = (i === c.index ? 'is-cursor' : '') + (o.disabled ? ' is-disabled' : '');
    b.textContent = o.text;
    b.addEventListener('click', () => { c.index = i; confirmDialog(); });
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && c.index !== i) { c.index = i; renderChoices(); } });
    const li = document.createElement('li');
    li.append(b);
    dui.choices.append(li);
  });
  dui.choices.hidden = false;
}

function confirmDialog() {
  if (!lineDone()) { DLG.shown = DLG.full.length; dui.text.textContent = DLG.full; afterLine(); return; }
  if (DLG.choice) {
    const opt = DLG.choice.options[DLG.choice.index];
    if (opt.disabled) { play('uiError'); return; }
    play('uiConfirm', { vol: 0.7 });
    const r = DLG.choice.resolve;
    DLG.choice = null;
    closeDialog();
    r(opt.value);
    return;
  }
  play('uiTick', { vol: 0.8 });
  if (DLG.index < DLG.lines.length - 1) { DLG.index += 1; showLine(); return; }
  const r = DLG.resolve;
  DLG.resolve = null;
  closeDialog();
  if (r) r();
}

function afterLine() {
  if (DLG.choice) renderChoices();
  else dui.next.hidden = false;
}

function updateDialog(dt) {
  if (!DLG.open) return;
  if (!lineDone()) {
    const before = Math.floor(DLG.shown);
    DLG.shown = Math.min(DLG.full.length, DLG.shown + DLG.speed * dt);
    const now = Math.floor(DLG.shown);
    if (now !== before) {
      dui.text.textContent = DLG.full.slice(0, now);
      if (now % 3 === 0 && /\w/.test(DLG.full[now - 1] || '')) play('uiTick', { vol: 0.18, rate: 1.4 });
    }
    if (lineDone()) afterLine();
  }
  const ok = pressed.has('enter') || pressed.has('e') || pressed.has(' ') || pressed.has('z');
  if (DLG.choice && lineDone()) {
    const n = DLG.choice.options.length;
    if (pressed.has('arrowup') || pressed.has('arrowleft')) { DLG.choice.index = (DLG.choice.index - 1 + n) % n; play('uiMove'); renderChoices(); }
    if (pressed.has('arrowdown') || pressed.has('arrowright')) { DLG.choice.index = (DLG.choice.index + 1) % n; play('uiMove'); renderChoices(); }
  }
  if (ok) confirmDialog();
}

dui.root.addEventListener('click', (e) => { if (e.target.closest('#dialog-choices')) return; confirmDialog(); });

// ---------- Overheard talk: speech bubbles over guards, the game keeps running ----------
const BARKS = [];
function bark(text, anchor, delay = 0, dur = 3.2) {
  BARKS.push({ text, anchor, t: -delay, dur });
}
function updateBarks(dt) {
  for (const b of BARKS) b.t += dt;
  for (let i = BARKS.length - 1; i >= 0; i--) if (BARKS[i].t > BARKS[i].dur) BARKS.splice(i, 1);
}
function drawBarks() {
  ctx.font = '600 11px Barlow, sans-serif';
  ctx.textAlign = 'center';
  for (const b of BARKS) {
    if (b.t < 0) continue;
    const a = b.anchor;
    if (a.state === 'down') continue;
    const alpha = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
    const words = b.text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 26) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
    if (cur.trim()) lines.push(cur.trim());
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
    const h = lines.length * 13 + 8;
    const x = a.x, y = a.y - 34 - h;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(241,234,217,.95)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y + h); ctx.lineTo(x, y + h + 6); ctx.lineTo(x + 4, y + h); ctx.fill();
    ctx.fillStyle = '#1a1206';
    lines.forEach((l, i) => ctx.fillText(l, x, y + 15 + i * 13));
    ctx.globalAlpha = 1;
  }
}

// Overheard spots come from Tiled objects of class "overhear" (property "lines": "guard: text | guard: text").
function checkOverhear() {
  const p = state.player;
  for (const o of state.overhears) {
    if (o.done || Math.hypot(p.x - o.x, p.y - o.y) > o.radius) continue;
    if (state.guards.some((g) => g.state === 'alert')) continue;
    const speakers = state.guards
      .filter((g) => g.state !== 'down' && Math.hypot(g.x - o.x, g.y - o.y) < o.radius + 120)
      .sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y));
    if (!speakers.length) continue;
    o.done = true;
    o.lines.forEach((text, i) => bark(text, speakers[i % speakers.length], i * 3.0));
  }
}

// ---------- Story scripts ----------
async function openingScene() {
  await say('zay',
    'House Veyrane steals with paper. Tonight, I steal it back.',
    "Noe's contract is somewhere in their counting house. Get in, get the ledger, get to the river.",
    'And nobody gets hurt. Guild code.');
  toast('Veyrane’s estate is north-east, past the lanterns.', 2600);
}

async function ledgerScene() {
  await say('zay',
    "Veyrane's ledger. Every debt in the Lantern Quarter, in tidy little rows.",
    "There's Noe's page. Next to Veyrane's seal there's a second one I don't know. Silver ink.",
    'Later. River first.');
}

async function endingScene() {
  await say('zay',
    'The boat slides off into the dark. Behind me, a lantern starts swinging at the counting house.',
    "Noe's going to ask where this came from. I'll tell her I won it at cards.");
}

async function talkToKid() {
  const p = state.player;
  if (state.deeds.robbedKid) {
    await say('kid', "...", "I'm not talking to you, Zay.");
    return;
  }
  const canRob = !KID.helped;
  if (KID.helped && p.gold === 0) {
    await say('kid', 'Noe says you’re trouble, Zay.', 'Good trouble, though. Mostly.');
    return;
  }
  if (p.gold === 0 && !canRob) return;
  const choice = await choose('kid', p.gold === 0 ? 'Got anything, Zay?' : KID.helped ? 'Zay! Back again?' : "Zay! You look like you're up to something.", [
    ...(p.gold > 0 ? [{ text: `Here. Take this. (give ${p.gold} gold)`, value: 'all' }] : []),
    ...(p.gold >= 20 ? [{ text: 'Here, half of it. (give ' + Math.floor(p.gold / 2) + ' gold)', value: 'half' }] : []),
    ...(canRob ? [{ text: 'Turn out your pockets, kid. (take 15 gold)', value: 'rob' }] : []),
    { text: 'Not now, kid.', value: 'no' }
  ]);
  if (choice === 'no') {
    if (p.gold === 0) await say('zay', 'Not yet. Give me a little while.');
    else await say('kid', 'Fine. I saw nothing. I always see nothing.');
    return;
  }
  if (choice === 'rob') {
    p.gold += 15;
    state.deeds.robbedKid = true;
    play('coins');
    addRep(-30);
    await say('kid', 'Zay... that was my whole week.');
    await say('zay', 'The guild code covers blood. It never covered this. It should have.');
    return;
  }
  const amount = choice === 'all' ? p.gold : Math.floor(p.gold / 2);
  p.gold -= amount;
  p.given += amount;
  KID.helped = true;
  play('coins');
  addRep(Math.min(25, 5 + Math.floor(amount / 4)));
  await say('kid', amount >= 40 ? "That's... that's a lot of gold, Zay." : 'For real? Thanks, Zay!');
  await say('zay', 'Some Crown Quarter mark paid for that. He just doesn’t know it yet.');
}

// ---------- Interaction prompt ("E" bubble over what you can use) ----------
function interactTarget() {
  const p = state.player;
  for (const c of state.chests) if (!c.opened && dist(c, p) < 40) return c;
  if (!state.ledgerTaken && dist(LEDGER_SPOT, p) < 40) return LEDGER_SPOT;
  if (dist(KID, p) < 44) return KID;
  if (FENCE.x && dist(FENCE, p) < 44) return FENCE;
  for (const v of VAULTS) if (dist(v.wall, p) < 46) return v.wall;
  return null;
}
function drawInteractPrompt() {
  if (state.mode !== 'field') return;
  const t = interactTarget();
  if (!t) return;
  const label = isTouch ? 'Use' : 'E';
  const bob = Math.sin(state.time * 5) * 1.5;
  ctx.font = '800 10px Barlow, sans-serif';
  const w = Math.max(16, ctx.measureText(label).width + 10);
  const x = t.x, y = t.y - 26 + bob;
  ctx.fillStyle = 'rgba(233,182,90,.95)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 9, w, 16, 5); ctx.fill();
  ctx.fillStyle = '#1a1206';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 3);
}
