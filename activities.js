'use strict';

// Side activities in the city, following the Master Canon:
// - Passers-by (Tiled `walker` polylines). Lift a purse from behind with Use / E. Well-off Crown marks
//   are fair game (ZAY takes from people who can afford it); lifting from a local worker costs Name.
//   From the front, or sometimes in lantern light, they notice and shout for the watch.
// - ZAY's card hustle (an `npc` with who = hustle): hook a greedy mark, bleed him, then bet him a child
//   can beat him at a child's game, and decide where the winnings go. Once per night.
// - Soot Quarter folk in need (`npc` with who = needy, properties need / ask / thanks). Once per night each.
// A "night" ends each time you finish a job, so these can't be farmed by walking out and back in.
const nightNo = () => state.jobsDone.size;

NPC_LOOKS.marks = [
  { coat: '#2a2140', low: '#15111f', trim: '#e9b65a', sash: '#7a1f2a', skin: '#6a4430', hair: '#16141c', hairStyle: 'hat' },
  { coat: '#1f2f45', low: '#111a26', trim: '#d8c9a0', sash: '#c9a25a', skin: '#5e3c2a', hair: '#0e0a08', hairStyle: 'hat' },
  { coat: '#3e2433', low: '#1c1018', trim: '#f3d79a', skin: '#7a5038', hair: '#2a1a10', hairStyle: 'short' }
];
NPC_LOOKS.locals = [
  { coat: '#4a4236', low: '#24201a', trim: '#8a7a5a', skin: '#5a3424', hair: '#160d09', hairStyle: 'wrap' },
  { coat: '#36403a', low: '#1a201c', trim: '#7a8a7a', skin: '#4e3022', hair: '#140c08', hairStyle: 'short' },
  { coat: '#4a3530', low: '#221815', trim: '#9a7a62', skin: '#6a4430', hair: '#1a120d', hairStyle: 'wrap' }
];

// ---------- Passers-by ----------
function makeWalkers() {
  return WALKERS.map((w, i) => ({
    ...w, who: w.kind === 'mark' ? 'mark' : 'local', x: w.pts[0].x, y: w.pts[0].y, r: 9, dir: 0,
    ri: 1 % w.pts.length, path: [], pathT: 0, pathGoal: null, speed: 30 + (i % 3) * 6, robbed: false, startled: 0,
    isWalker: true
  }));
}
function updateWalkers(dt) {
  for (const w of state.walkers || []) {
    if (w.startled > 0) { w.startled -= dt; continue; }   // stops and stares after catching a thief
    if (walkTo(w, w.pts[w.ri], w.speed, dt)) w.ri = (w.ri + 1) % w.pts.length;
  }
}
function drawWalkers() {
  for (const w of state.walkers || []) if (inView(w.x, w.y)) drawNpc(w);
}
function walkerNear(p, r = 34) {
  let best = null;
  for (const w of state.walkers || []) if (dist(w, p) < r && (!best || dist(w, p) < dist(best, p))) best = w;
  return best;
}

// Someone shouts: every watchman within earshot comes running, no line of sight needed.
function shoutForWatch(x, y) {
  let heard = false;
  for (const g of state.guards) {
    if (!g.watch || g.state === 'down' || dist(g, { x, y }) > 300) continue;
    g.hostile = true;
    heard = true;
    raiseAlarm(g);
  }
  if (heard) toast('The watch heard that!', 1600);
}

function tryPickpocket(w) {
  const p = state.player;
  if (w.robbed) { toast('Pockets already empty.', 1100); return; }
  const noticed = !behind(w, p) || (p.lit && Math.random() < 0.25);
  if (noticed) {
    bark(w.kind === 'mark' ? 'Hey! Thief! Watch!' : 'Oi! Hands off!', w, 0, 2.4);
    w.startled = 2.5;
    play('uiError');
    shoutForWatch(w.x, w.y);
    return;
  }
  const gold = w.kind === 'mark' ? 12 + Math.floor(Math.random() * 16) : 4 + Math.floor(Math.random() * 5);
  w.robbed = true;
  p.gold += gold;
  play('coins2', { vol: 0.7 });
  if (w.kind === 'mark') toast(`Lifted ${gold} gold. He'll never miss it.`, 1800);
  else { toast(`Lifted ${gold} gold from a Soot Quarter worker.`, 2000); addRep(-10); }
  witnessCrime(p.x, p.y, null, 120);   // only a watchman standing close spots a clean lift
}

// ---------- ZAY's card hustle ----------
async function talkToHustle() {
  const d = state.deeds;
  const p = state.player;
  if (d.hustleNight === nightNo()) {
    return say('mark', pick(['You again. No. Absolutely not.', 'I know what you did. I just don’t know how.']));
  }
  const open = await choose('mark', 'Cards? With a Lantern Quarter street act? Go on, then. Show me.', [
    { text: 'Let him win the first hand.', value: 'hook' },
    { text: 'Take him straight away.', value: 'greedy' },
    { text: 'Not tonight.', value: 'no' }
  ]);
  if (open === 'no') return;
  d.hustleNight = nightNo();
  if (open === 'greedy') {
    await say('mark', 'Ha. …Again? No. I know a hustle when I lose to one.');
    return hustlePayout(8);
  }
  await say('zay', 'Lucky hand, friend. Again?');
  await say('mark', 'Again. Double it. I’ve got your trick now.');
  const mid = await choose('zay', '(He’s hooked. He thinks he’s found the tell.)', [
    { text: 'Bleed him slow, a few coins a hand.', value: 'slow' },
    { text: 'Take the whole stack now.', value: 'fast' }
  ]);
  if (mid === 'fast') {
    await say('mark', 'That’s… no. No more. You’re a cheat.');
    return hustlePayout(20);
  }
  await say('mark', 'This is rigged. It has to be rigged.', 'One more. Name the game.');
  const last = await choose('zay', 'Last one, then.', [
    { text: 'A child’s game. I bet a kid from the crowd can beat you at it.', value: 'kid' },
    { text: 'Call it a night while he still has his shoes.', value: 'stop' }
  ]);
  if (last === 'stop') return hustlePayout(30);
  await say('zay', 'You. Kid. Yeah, you. Come show the gentleman how it’s done.');
  await say('mark', '…A child. I lost to a child.');
  const pot = 65;
  const where = await choose('zay', `(The kid is holding ${pot} gold and staring at it.)`, [
    { text: 'Keep it, kid. All of it.', value: 'all' },
    { text: 'Split it with the kid.', value: 'half' },
    { text: 'Take it back off the kid.', value: 'keep' }
  ]);
  if (where === 'all') {
    p.given += pot; KID.helped = true; addRep(15); play('coins');
    await say('zay', 'Some Crown Quarter mark paid for that. He just doesn’t know it yet.');
  } else if (where === 'half') {
    const half = Math.floor(pot / 2);
    p.given += pot - half; p.gold += half; KID.helped = true; addRep(6); play('coins');
  } else {
    p.gold += pot; addRep(-10); play('coins2');
    toast('The kid’s face says everything.', 2000);
  }
  hudCache = '';
}
function hustlePayout(gold) {
  state.player.gold += gold;
  play('coins2');
  toast(`+${gold} gold`, 1400);
  hudCache = '';
}

// ---------- Soot Quarter folk in need ----------
async function talkToNeedy(n) {
  const helped = (state.deeds.helpedNight = state.deeds.helpedNight || {});
  const p = state.player;
  const who = n.name || 'needy';
  if (helped[n.id] === nightNo()) return say(who, n.thanks || 'Bless you, Zay.');
  await say(who, n.need || 'Guards come late. Buildings rot. Taxes still come.');
  const ask = n.ask || 20;
  const c = await choose(who, 'Anything helps.', [
    ...(p.gold >= ask ? [{ text: `Here. (give ${ask} gold)`, value: 'give' }] : []),
    { text: p.gold >= ask ? 'Not tonight.' : `I’ve got nothing on me. (needs ${ask} gold)`, value: 'no' }
  ]);
  if (c !== 'give') return;
  p.gold -= ask;
  p.given += ask;
  helped[n.id] = nightNo();
  state.deeds.sootHelped = (state.deeds.sootHelped || 0) + 1;
  addRep(8);
  play('coins');
  hudCache = '';
  await say(who, n.thanks || 'Bless you, Zay.');
}
