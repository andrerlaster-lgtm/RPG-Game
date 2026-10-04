# Bellemorne: Paper Thief

A top-down stealth game set in Andre's Bellemorne story. One level, a quick try.

ZAY slips into House Veyrane's Crown Quarter estate at night, steals the ledger holding the debt that is choking Noe's Crooked Halo, and escapes to a boat on the river.

The story source is the Bellemorne Master Canon in the Obsidian vault (`11 Books/Bellemorne/`). The game borrows from it loosely: House Veyrane "steals with paper," ZAY's card-hustle misdirection, his performer footwork, the tail, the katana and the daggers, the guild's "no casualties" code, and his habit of moving a mark's coin to someone who needs it.

## How to play

- **Goal:** take the ledger from the Veyrane counting house, then reach the river boat at the east docks. Optional: give the coin you pick up (or steal) to the Soot kid on the dock.
- **Stealth:** lantern light makes you easy to see; shadows halve how far guards can see you; garden hedges hide you. A ring over each guard fills while they can see you; when it's full they raise the alarm and nearby guards come running.
- **No casualties:** every takedown and every battle win is a knockout.

| Action | Keyboard / mouse | Touch | Controller |
|---|---|---|---|
| Move | Arrow keys | Arrow pad | D-pad or left stick |
| Sprint (noisy) | Shift | Hold Sprint | Hold LB or RB |
| Takedown from behind, tail-vault the estate wall, grab the ledger, give coin | E | Use | A |
| Throw a card (noise lure; stuns on a direct hit) | Q or right-click (aims at the cursor) | Card (throws where you face) | X |
| Roll | Space | Roll | B |
| Bag (inventory) | I or Tab | Bag button (top) | Y |
| Pause | Esc or P | II button | Start |

In battles a controller uses the d-pad to choose, **A** to confirm and **B** to go back.

## Battles (Final Fantasy style)

If an alerted guard catches ZAY, the screen switches to a battle: guards on the left, your party on the right, blue command windows at the bottom. It uses Active Time Battle in wait mode: each fighter's gauge fills over time, and the clock pauses while you choose.

- **Every character:** Hit, Item, Run.
- **Class command:** Rogue → **Steal** (gold or items; stolen gold goes to your pocket for the kid), Spellcaster → **Magic** (Fire, Ice, Cure; costs MP), Swordfighter → **Slash** (hits every enemy).
- **Controls:** ↑/↓ choose, Enter (or Z/E/Space) confirm, Esc (or X/Backspace) back. On touch, tap a command, then tap a target.
- Win and the guards are knocked out on the map. Run (60% chance) leaves them stunned for a few seconds. If the whole party falls, ZAY is caught.

**Fighting UI:** a help window at the top describes the highlighted command, spell or item; while you pick a target it shows that target's HP bar (and "Pockets full/empty" when stealing). The party window shows level, HP and MP bars and the time gauge. Winning shows EXP, gold, items found and any level-ups with their stat gains.

**Items in battle:** Potion (60 HP), Hi-Potion (150 HP), Ether (25 MP), Smelling Salts (revive at 30% HP), Smoke Bomb (guaranteed escape).

## Bag, equipment and levels

Press **I** (or the **Bag** button, or **Y** on a controller) to open a Breath of the Wild–style bag: tabs for Supplies, Weapons, Armor and Charms, an item grid, an info panel with stats and description, and ZAY's panel with level, HP, EXP, stats and equipment slots. Selecting gear shows how each stat would change (green up, red down). Use **Q / E** to switch tabs and **Enter** for actions (Use, Equip, Unequip).

- **Starting gear:** Severin's Katana, Rogue Blacks, Mother's Necklace, plus the Twin Daggers (one from Rika, one from Kairo) in the bag.
- **Chests** on the map hold a Lucky Coin (Steal +20%), a Hi-Potion, Smelling Salts, a Smoke Bomb, and an estate captain's Veyrane Brigandine inside the counting house.
- **EXP:** guards give 34, captains 62. Each level raises HP and stats (100 × level EXP to the next level).

The party is just ZAY for now. To add a character, edit `characters.js`: add an entry to `CHARACTERS` with a class (`rogue`, `caster` or `sword`) and put its id in `STARTING_PARTY` (up to 4). Spells, items and enemy stats live in the same file.

Your end rating depends on how often you were spotted and how many guards you knocked out: **Ghost of the Lantern Quarter** (never spotted, no knockouts), **Shadow**, **Rogue**, or **Brawler**.

## Borrowed from Godot

Techniques from the [Godot Engine](https://github.com/godotengine/godot) (MIT), re-written in this game's JavaScript:

- **Camera2D smoothing:** the camera eases toward ZAY (`pos += (target − pos) × speed × delta`) and shakes when you're spotted or a guard goes down.
- **Light2D + LightOccluder2D:** each lamp's light is clipped by the buildings around it, so light doesn't leak through walls.
- **Tween easing:** battle lunges, damage numbers and the encounter swirl use Godot's back, expo, cubic and sine curves (`scene/animation/easing_equations.h`).
- **InputMap:** controller buttons feed the same actions as the keyboard, with a different mapping in battles.

The bag, item database, equipment slots, item pickups and level/EXP panel follow the design of [GodotDynamicInventorySystem](https://github.com/alfredbaudisch/GodotDynamicInventorySystem) by Alfred Baudisch (Apache 2.0). Its ideas were re-written here; none of its code, art or sounds were copied.

## Run it

No dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 5192 --directory "/Users/andrelaster/app ideas/bellemorne-rogue-game"
```

Then open <http://localhost:5192>.

## Files

- `index.html` — screens, HUD, touch controls
- `style.css` — HUD and screen styling
- `characters.js` — classes, party, spells, item database, equipment, levels, enemies
- `game.js` — map, lighting, guards, stealth, and the switch into battles
- `battle.js` — Final Fantasy-style battles (ATB gauges, commands, help window, victory screen)
- `inventory.js` — the bag screen, item icons, equipping and field item use

## Preview

Stable preview link (needs your Vercel login): https://bellemorne-rogue-game-preview-andrerlaster-lgtms-projects.vercel.app

To update it, run `npm run deploy`, then point the stable link at the new deployment:

```bash
vercel alias set <new-deployment-url> bellemorne-rogue-game-preview-andrerlaster-lgtms-projects.vercel.app --scope andrerlaster-lgtms-projects
```

The project's very first deploy (2026-10-03) went to production by Vercel's default for new projects. Its public aliases (`bellemorne-rogue-game.vercel.app` and the team alias) were removed right away, so only the login-protected preview is in use.
