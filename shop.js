'use strict';

// The Blackwater fence: buy supplies, sell loot. Shop idea from RPG-JS (MIT); written for this game.
// Canon gear (price 0: Severin's Katana, Twin Daggers, Rogue Blacks, Mother's Necklace) can't be sold.

const SHOP_STOCK = ['Potion', 'Hi-Potion', 'Ether', 'Smoke Bomb'];
const SHOP = { open: false, tab: 'buy', index: 0, prevMode: 'field' };
const sui = {
  root: document.getElementById('shop'),
  tabs: document.getElementById('shop-tabs'),
  list: document.getElementById('shop-list'),
  info: document.getElementById('shop-info'),
  gold: document.getElementById('shop-gold'),
  close: document.getElementById('shop-close')
};

const sellPrice = (name) => Math.floor((ITEMS[name].price || 0) / 2);
function shopRows() {
  if (SHOP.tab === 'buy') {
    return SHOP_STOCK.map((name) => ({ name, price: buyPrice(name), owned: state.items[name] || 0, canAct: state.player.gold >= buyPrice(name) }));
  }
  return Object.entries(state.items)
    .filter(([name, n]) => n > 0 && ITEMS[name] && ITEMS[name].price > 0)
    .map(([name, n]) => {
      const equipped = isEquipped(name) && n <= 1;
      return { name, price: sellPrice(name), owned: n, canAct: !equipped, note: equipped ? 'Equipped' : '' };
    });
}

function openShop() {
  SHOP.open = true;
  SHOP.prevMode = 'field';
  SHOP.tab = 'buy';
  SHOP.index = 0;
  state.mode = 'shop';
  sui.root.hidden = false;
  hudEls.hud.hidden = true;
  document.getElementById('touch').hidden = true;
  play('uiOpen'); play('coins2', { vol: 0.4, delay: 0.1 });
  renderShop();
}
function closeShop() {
  SHOP.open = false;
  sui.root.hidden = true;
  state.mode = 'field';
  hudEls.hud.hidden = false;
  document.getElementById('touch').hidden = !isTouch;
  hudCache = '';
  play('uiClose');
}

function shopAct() {
  const row = shopRows()[SHOP.index];
  if (!row) return;
  if (!row.canAct) { play('uiError'); return; }
  if (SHOP.tab === 'buy') {
    state.player.gold -= row.price;
    state.items[row.name] = (state.items[row.name] || 0) + 1;
    noteNewItem(row.name);
  } else {
    state.items[row.name] -= 1;
    state.player.gold += row.price;
    const left = shopRows();
    SHOP.index = Math.min(SHOP.index, Math.max(0, left.length - 1));
  }
  play('coins2');
  renderShop();
}

function updateShop() {
  const rows = shopRows();
  if (pressed.has('arrowup')) { SHOP.index = Math.max(0, SHOP.index - 1); play('uiMove'); renderShop(); }
  if (pressed.has('arrowdown')) { SHOP.index = Math.min(rows.length - 1, SHOP.index + 1); play('uiMove'); renderShop(); }
  if (pressed.has('arrowleft') || pressed.has('arrowright') || pressed.has('q') || pressed.has('tab')) {
    SHOP.tab = SHOP.tab === 'buy' ? 'sell' : 'buy'; SHOP.index = 0; play('uiTick'); renderShop();
  }
  if (pressed.has('enter') || pressed.has('z') || pressed.has(' ') || pressed.has('e')) shopAct();
  if (pressed.has('escape') || pressed.has('x') || pressed.has('backspace')) closeShop();
}

function renderShop() {
  sui.gold.textContent = state.player.gold;
  sui.tabs.innerHTML = '';
  for (const [id, label] of [['buy', 'Buy'], ['sell', 'Sell']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'inv-tab' + (SHOP.tab === id ? ' is-active' : '');
    b.setAttribute('aria-pressed', String(SHOP.tab === id));
    b.textContent = label;
    b.addEventListener('click', () => { SHOP.tab = id; SHOP.index = 0; play('uiTick'); renderShop(); });
    sui.tabs.append(b);
  }
  const rows = shopRows();
  sui.list.innerHTML = '';
  if (!rows.length) {
    sui.list.innerHTML = `<li class="shop-empty">${SHOP.tab === 'sell' ? 'Nothing the fence wants. Your own gear stays with you.' : 'Sold out.'}</li>`;
  }
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shop-row' + (i === SHOP.index ? ' is-cursor' : '') + (r.canAct ? '' : ' is-disabled');
    b.innerHTML = `<span class="shop-icon">${itemIcon(r.name)}</span><span class="shop-name">${escapeHtml(r.name)}<small>Owned ${r.owned}${r.note ? ' · ' + r.note : ''}</small></span>` +
      `<span class="shop-price"><span class="stat-icon">${dsIcon('coin')}</span>${r.price}</span>`;
    b.addEventListener('click', () => {
      if (SHOP.index !== i) { SHOP.index = i; play('uiMove'); renderShop(); if (!isTouch) return; }
      shopAct();
    });
    li.append(b);
    sui.list.append(li);
  });
  const sel = rows[SHOP.index];
  sui.info.innerHTML = sel
    ? `<b>${escapeHtml(sel.name)}</b><span>${escapeHtml(ITEMS[sel.name].effectText || ITEMS[sel.name].trait || '')}</span><p>${escapeHtml(ITEMS[sel.name].desc)}</p>` +
      `<small>${SHOP.tab === 'buy' ? (sel.canAct ? (isTouch ? 'Tap again to buy' : 'Enter to buy') : 'Not enough gold') : (sel.canAct ? (isTouch ? 'Tap again to sell' : 'Enter to sell') : 'Unequip it first')}</small>`
    : '';
}

sui.close.addEventListener('click', closeShop);

async function talkToFence() {
  const tier = repTier();
  if (tier.price === null) {
    await say('fence', 'Not you, Zay. Not after what I’ve heard.', 'Keep walking.');
    return;
  }
  const d = state.deeds;
  const greeting = tier.label === 'Beloved' ? 'Zay! The whole Quarter’s talking about you. Friend prices tonight.'
    : tier.label === 'Distrusted' ? 'Prices went up, Zay. Word gets around.'
    : KID.helped ? 'Blackwater prices, Zay. Heard you were generous tonight.'
    : 'Blackwater prices, Zay. No questions, no names.';
  const choice = await choose('fence', greeting, [
    { text: 'Show me what you have.', value: 'shop' },
    ...(!d.tippedFence && state.player.gold >= 20 ? [{ text: 'Keep the change for the trouble. (tip 20 gold)', value: 'tip' }] : []),
    ...(!d.tookShelf ? [{ text: 'Take a Potion off the shelf while he looks away.', value: 'steal' }] : []),
    { text: 'Just passing through.', value: 'no' }
  ]);
  if (choice === 'shop') openShop();
  else if (choice === 'tip') {
    state.player.gold -= 20;
    d.tippedFence = true;
    play('coins');
    addRep(8);
    hudCache = '';
    await say('fence', 'Huh. Nobody tips me. Remember I said that.');
  } else if (choice === 'steal') {
    d.tookShelf = true;
    state.items.Potion = (state.items.Potion || 0) + 1;
    noteNewItem('Potion');
    play('cloth');
    addRep(-20);
    await say('fence', '...I saw that, Zay.');
  }
}
