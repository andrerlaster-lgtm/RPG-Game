'use strict';

// People and furniture in the city: NPCs you can talk to (Tiled `npc` points) and low, solid furniture
// (Tiled `prop` rectangles: counter, table, stage). Looks follow Andre's character model sheet; what
// people say follows the Bellemorne Master Canon (Noe's rule, Severin watching from neutral ground).

const NPC_LOOKS = {
  noe: { coat: '#e6dccb', low: '#2a2320', trim: '#6b3d27', sash: '#7a1f2a', skin: '#5a3424', hair: '#160d09', hairStyle: 'curls' },
  severin: { coat: '#26262c', low: '#17171b', trim: '#b9bcc8', sash: '#4b2552', skin: '#4b3b3e', hair: '#a3a3ab', hairStyle: 'locs', seated: true },
  patrons: [
    { coat: '#3a2d4a', low: '#1d1822', trim: '#c9a25a', skin: '#6a4430', hair: '#1a120d', hairStyle: 'hat' },
    { coat: '#2f4a3e', low: '#18241f', trim: '#d8c9a0', skin: '#4e3022', hair: '#140c08', hairStyle: 'short' },
    { coat: '#5a2e2e', low: '#251616', trim: '#e0b070', skin: '#7a5038', hair: '#2a1a10', hairStyle: 'wrap' },
    { coat: '#2e3550', low: '#151a28', trim: '#b0b8d0', skin: '#5e3c2a', hair: '#0e0a08', hairStyle: 'hat' }
  ]
};
const npcLook = (n) => (n.who === 'patron' ? NPC_LOOKS.patrons[n.look % NPC_LOOKS.patrons.length] : NPC_LOOKS[n.who] || NPC_LOOKS.patrons[0]);

// Who is in the room this visit. Severin isn't always there; he is the night you finish the ledger job.
function presentNpcs() {
  return NPCS.filter((n) => {
    if (n.who !== 'severin') return true;
    if (state.jobsDone.has('veyrane-ledger') && !state.deeds.severinLedgerLine) return true;
    return Math.random() < 0.6;
  });
}

const npcNear = (p, r = 44) => {
  let best = null;
  for (const n of state.npcs || []) if (dist(n, p) < Math.max(r, n.reach || 0) && (!best || dist(n, p) < dist(best, p))) best = n;
  return best;
};

// ---------- What people say ----------
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const PATRON_LINES = [
  ['Noe’s rule: whatever you are outside, you behave inside.'],
  ['They say there are three rogues at this bar most nights.', 'I’ve never once spotted one.'],
  ['Music hall down the street was half empty last night.', 'Never used to be.'],
  ['Veyrane men were in here asking about the deed.', 'Noe sent them out smiling. They didn’t know why.'],
  ['You’re the one who does the card trick. My cousin still owes me for that.']
];

async function talkTo(n) {
  if (n.who === 'noe') return talkToNoe();
  if (n.who === 'severin') return talkToSeverin();
  return say('patron', ...(n.line ? [n.line] : pick(PATRON_LINES)));
}

async function talkToNoe() {
  const d = state.deeds;
  const done = state.jobsDone.has('veyrane-ledger');
  if (done && !d.reportedLedger) {
    await say('noe', 'Zay. You’re dripping on my floor.', '…Is that what I think it is?');
    await say('zay', 'Veyrane’s ledger. Your page is in my coat. The rest of their tidy little rows are somewhere at the bottom of the river.');
    await say('noe', 'I’m not going to ask how.', 'Thank you. I mean it.');
    d.reportedLedger = true;
    addRep(10);
    writeSave();
    hudCache = '';
    return;
  }
  if (done) {
    return say('noe', pick([
      'Whatever you are outside, you behave inside. That includes you.',
      'Drink’s on the house. Don’t tell anyone.',
      'The room’s quieter when you’re not performing. I almost miss it.'
    ]));
  }
  if (state.jobsTaken.has('veyrane-ledger')) {
    return say('noe', 'You already said you’d do it. So go do it, and come back in one piece.');
  }
  await say('noe',
    'Zay. Sit for a second. You look like you haven’t slept.',
    'Veyrane’s collectors came by again. New penalties. Payments they say I missed. I didn’t miss them.',
    'It’s all in their ledger, in the counting house up in the Crown Quarter.');
  const c = await choose('noe', 'I’m not asking you to do anything.', [
    { text: 'You don’t have to ask. I’ll get it.', value: 'yes' },
    { text: 'Give me a little time.', value: 'no' }
  ]);
  if (c === 'yes') {
    state.jobsTaken.add('veyrane-ledger');
    writeSave();
    hudCache = '';
    await say('noe', 'No casualties. And you come back. Both of those, Zay.');
  } else {
    await say('noe', 'Take your time. Just don’t take too long.');
  }
}

// Severin never fights here and never threatens openly. He sits, and lets ZAY feel how far his reach goes.
async function talkToSeverin() {
  const d = state.deeds;
  if (state.jobsDone.has('veyrane-ledger') && !d.severinLedgerLine) {
    d.severinLedgerLine = true;
    await say('severin', 'House Veyrane misplaced something tonight.');
    await say('zay', 'Careless of them.');
    await say('severin', 'Yes.', 'Careless.');
    return;
  }
  const n = (d.severinTalks = (d.severinTalks || 0) + 1);
  if (n === 1) {
    await say('severin', 'Neutral ground, performer. Sit or don’t.');
    await say('zay', 'I’ll stand.');
  } else if (n % 3 === 0) {
    await say('severin', 'Noe keeps a warm house.');
  } else {
    await say('severin', '…');
  }
}

// ---------- Furniture ----------
const PROP_STYLE = {
  counter: { h: 0.32, top: '#6a4128', side: '#3e2617', edge: '#8a5a32' },
  table: { h: 0.22, top: '#5a3a24', side: '#33210f', edge: '#7a5232' },
  stage: { h: 0.1, top: '#3c2a40', side: '#21162a', edge: '#c9a25a' }
};
function drawFurniture() {
  for (const pr of PROPS) {
    if (!inView(pr.x, pr.y, 80)) continue;
    const st = PROP_STYLE[pr.kind] || PROP_STYLE.table;
    const k = ROOF_LIFT * st.h;
    const x0 = pr.x, y0 = pr.y, x1 = pr.x + pr.w, y1 = pr.y + pr.h;
    const L = (x, y) => [liftX(x, k), liftY(y, k)];
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x0 - 2, y0 + 2, pr.w + 4, pr.h + 3);
    ctx.fillStyle = st.side;
    // Sides facing the camera (same rule as building walls).
    if (liftY(y1, k) < y1) quad(ctx, [[x0, y1], [x1, y1], L(x1, y1), L(x0, y1)]);
    if (liftY(y0, k) > y0) quad(ctx, [[x0, y0], [x1, y0], L(x1, y0), L(x0, y0)]);
    if (liftX(x1, k) < x1) quad(ctx, [[x1, y0], [x1, y1], L(x1, y1), L(x1, y0)]);
    if (liftX(x0, k) > x0) quad(ctx, [[x0, y0], [x0, y1], L(x0, y1), L(x0, y0)]);
    ctx.fillStyle = st.top;
    quad(ctx, [L(x0, y0), L(x1, y0), L(x1, y1), L(x0, y1)]);
    ctx.strokeStyle = st.edge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(...L(x0, y1)); ctx.lineTo(...L(x1, y1)); ctx.stroke();
    if (pr.kind === 'table') {   // a candle, and a branded Crooked Halo glass
      const [cx, cy] = L(x0 + pr.w / 2, y0 + pr.h / 2);
      ctx.fillStyle = '#e8d9b0'; ctx.fillRect(cx - 1, cy - 4, 2, 4);
      ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.arc(cx, cy - 5, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(214,160,80,.8)'; ctx.fillRect(cx + 5, cy - 1, 3, 3);
    }
  }
}

// ---------- NPC figures (same sprite stacking as ZAY and the guards) ----------
function drawNpc(n) {
  const L = npcLook(n);
  const f = L.seated ? 0.6 : 1;
  feetShadow(n.x, n.y, 11);
  for (let i = 0; i < STACK_SLICES * f; i++) {
    const [ox, oy] = standUp(n.x, n.y, i / STACK_SLICES);
    ctx.save(); ctx.translate(n.x + ox, n.y + oy); ctx.rotate(n.dir);
    ctx.fillStyle = i / STACK_SLICES < 0.45 ? L.low : L.coat;
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const [ox, oy] = standUp(n.x, n.y, f);
  ctx.save();
  ctx.translate(n.x + ox, n.y + oy);
  ctx.rotate(n.dir);
  // Body, with the character's trim: Noe's corset, Severin's silver embroidery, a patron's coat edge.
  ctx.fillStyle = L.coat;
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(170,180,220,.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = L.trim;
  if (n.who === 'noe') ctx.fillRect(-4, -7, 6, 14);
  else { ctx.fillRect(-2, -10, 2, 20); }
  if (L.sash) { ctx.fillStyle = L.sash; ctx.fillRect(-6, 4, 9, 3); }
  // Head and hair
  ctx.fillStyle = L.skin;
  ctx.beginPath(); ctx.arc(2, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.hair;
  if (L.hairStyle === 'curls') {
    for (const [hx, hy] of [[-3, -5], [-4, 0], [-3, 5], [1, -6], [1, 6], [-6, -3], [-6, 3]]) { ctx.beginPath(); ctx.arc(hx, hy, 3.2, 0, Math.PI * 2); ctx.fill(); }
  } else if (L.hairStyle === 'locs') {
    ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    ctx.strokeStyle = L.hair; ctx.lineWidth = 1.6;
    for (const s of [-5, -2, 2, 5]) { ctx.beginPath(); ctx.moveTo(-2, s); ctx.lineTo(-9, s * 1.3); ctx.stroke(); }
  } else if (L.hairStyle === 'hat') {
    ctx.fillStyle = '#16141c'; ctx.beginPath(); ctx.arc(1, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.trim; ctx.beginPath(); ctx.arc(1, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  } else if (L.hairStyle === 'wrap') {
    ctx.fillStyle = L.trim; ctx.beginPath(); ctx.arc(0, 0, 5.8, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(1, 0, 5.8, Math.PI * 0.6, Math.PI * 1.4); ctx.fill();
  }
  // Eyes: Noe's brown-gold, Severin's pale silver
  ctx.fillStyle = n.who === 'severin' ? '#dfe3ee' : n.who === 'noe' ? '#c99a52' : '#f1ead9';
  ctx.fillRect(5.5, -2.4, 1.6, 1.4); ctx.fillRect(5.5, 1, 1.6, 1.4);
  ctx.restore();
}
function drawNpcs() {
  for (const n of state.npcs || []) if (inView(n.x, n.y)) drawNpc(n);
}
