# Bellemorne: Paper Thief

A top-down stealth game set in Andre's Bellemorne story. One level, a quick try.

ZAY slips into House Veyrane's Crown Quarter estate at night, steals the ledger holding the debt that is choking Noe's Crooked Halo, and escapes to a boat on the river.

The story source is the Bellemorne Master Canon in the Obsidian vault (`11 Books/Bellemorne/`). The game borrows from it loosely: House Veyrane "steals with paper," ZAY's card-hustle misdirection, his performer footwork, the tail, the katana and the daggers, the guild's "no casualties" code, and his habit of moving a mark's coin to someone who needs it.

## How to play

- **Goal:** take the ledger from the Veyrane counting house, then reach the river boat at the east docks. Optional: give the coin you pick up (or steal) to the Soot kid by the street stage in the Lantern Quarter.
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

## Options and HUD

- **Options** (title screen or pause menu): sound volume, guard vision cones on/off, screen shake on/off, and battle speed (Slow / Normal / Fast). Settings are saved in this browser on this device.
- **Restart level** asks for confirmation first.
- **Bag badge:** a red number on the Bag button counts new items; tabs with new items get a dot, and new items show a "New" tag until you select them.
- **Tooltips:** hover (or focus, or long-press on a phone) the HP, gold, cards, visibility, Bag and Pause items in the HUD.

The bag uses larger item slots and separate character and item details, with a scrollable layout on smaller screens. Battle commands, opponents and party status have separate panels so target selection stays visible.

## Districts

Bellemorne is split into districts you walk between. A new game starts in the **Lantern Quarter** outside the Crooked Halo (walk in to meet Noe); walk east down the main street to reach the **Crown Quarter** (House Veyrane's estate, the ledger job). The estate's west gate leads back.

- Your character comes with you: gold, items, gear, level, Name and finished jobs. Each district remembers its opened chests and picked-up coins and cards; guards reset on every visit.
- You can't leave a district while guards are chasing you.
- Finishing the ledger job shows the job summary, then sends you back to the Lantern Quarter by the Crooked Halo. Coming back to the estate afterwards is quiet: the ledger is gone.
- The River and Soot Quarters come next, following the Master Canon (four quarters: Crown, Lantern, River, Soot).
- Districts are listed in `districts.js`; to add one, add a map in `levels/`, list it there, and connect it with `exit` and `spawn` objects.

## The Lantern Quarter and the city watch

The Lantern Quarter is lively, not poor (as the canon insists): a main street with food stalls and a mask stall, a square with a street stage, a music hall, a card room, a narrow cut through the card-room block, a side yard behind the mask shop, and the Crooked Halo. Vendors and a regular at the stage have a line each. The **Soot kid** now waits by the street stage (give or take coin there).

- **The city watch** (reddish-brown coats) patrols the main street, the square and the south lane. They ignore ZAY, even in full lantern light, until a watchman sees a crime: a takedown, a card hitting someone, or shaking down the kid. Then "The watch saw that!", they raise the alarm, and it plays like the estate: chase, battle, knockout or get away.
- Hostile watchmen stay hostile for the rest of that visit; leaving and coming back resets them.
- Caught by the watch: "The city watch drags ZAY off to the Crown Quarter cells", and you go back to your last save.
- Patrol routes are Tiled `guard` polylines with `kind` = `watch`.

## Side activities in the Lantern Quarter

- **Pickpocketing.** Passers-by walk the streets: well-off **Crown marks** (fine coats, gold trim, hats) and **locals** (Soot Quarter workers). Come up behind one and the prompt says **Lift**; press Use / E to take their purse. Marks carry more and lifting from them costs nothing: ZAY takes from people who can afford it. Lifting from a local costs 10 Name. Grab from the front and they shout "Thief!": every watchman within earshot comes running. In lantern light a mark sometimes notices even from behind, so work the shadows. A watchman standing close can also spot a clean lift.
- **ZAY's card hustle** (the Crown gent at the card table by the street stage, once per night), from Chapter 1: let him win the first hand to hook him, bleed him slow, then bet him a kid from the crowd can beat him at a child's game. Then choose: the kid keeps all 65 gold (+15 Name), split it (+6), or take it back off the kid (−10). Push too greedy too early and he walks away with you only a few coins up.
- **Helping the Soot Quarter.** A washerwoman in the west back alley and a shrine keeper in the yard behind the mask shop each need a little gold (20 and 30). Giving it: +8 Name each, once per night.
- A night ends each time you finish a job, so the hustle and the helping can't be repeated by walking out and back in. Pickpocketed purses reset each visit.
- Tiled: passers-by are `walker` polylines (`kind` = `mark` or `local`, `look`); the hustle is an `npc` with `who` = `hustle`; people in need are `npc`s with `who` = `needy` and `need`, `ask`, `thanks`.

## The Crooked Halo, Noe and Severin

The first story loop of the open city:

1. A new game starts outside **the Crooked Halo**. Walk in through its door (south side of the main street).
2. **Noe** is behind the bar. She tells you about Veyrane's new penalties and the ledger; agree and the job is yours ("No casualties. And you come back.").
3. Walk east to the Crown Quarter, take the ledger and reach the boat as before.
4. You're sent back outside the Halo. Tell Noe it's done (+10 Name).

- **Severin** is sometimes at a corner table (always on the night you finish the ledger job). It's neutral ground: he doesn't fight and doesn't threaten. He sits, he watches, and he lets ZAY feel how far his reach goes.
- The regulars have a line each; the musician on the stage keeps playing.
- Looks follow the character model sheet: ZAY wears his long charcoal coat over a tan shirt in the city and his black rogue gear on the job; Noe has her curls, white blouse, brown corset and red sash; Severin his grey locs with beads, charcoal coat with silver embroidery, purple sash and silver eyes. Dialog portraits match. In the bag, Rika's wavy dagger, Kairo's ring-pommel dagger and the etched katana have their own icons.
- People and furniture live in `people.js`; the room is `levels/crooked-halo.tmj`.

## Saved game

Progress is saved in this browser on this device only (nothing is sent anywhere). It is written when you start a new game, each time you enter a district and when you complete a job; getting caught does not save, so the next try starts from where you last entered the district.

- **Saved:** gold, cards, items, equipped gear, ZAY's level, EXP and stats, your Name and the choices behind it, whether you helped the Soot kid, and finished jobs. HP and MP start full when you continue.
- **Title screen:** with a save you get **Continue** (with a one-line summary) and **New game**, which asks before erasing the save.
- **Restart level** (pause menu) goes back to your last save if there is one.
- Clearing the browser's site data, or a private window, means no save. The code is in `save.js`.
- Continue puts you back where you were saved.

## Your Name in the Quarter (good and bad)

A running score from -100 to +100, shown as a chip in the HUD: **Beloved**, **Liked**, **Unknown**, **Distrusted** or **Feared**. It starts neutral in a new game and is kept in your saved game. Hover or long-press the chip for what it means.

- **Kind:** give coin to the Soot kid (the more you give, the more it counts, up to +25), tip the fence 20 gold (+8), let the kid keep the card-hustle winnings (+15), help Soot Quarter folk in the alleys (+8 each). A run where you are never spotted and nobody is knocked out also gets a live +10, which disappears if that stops being true.
- **Cruel:** take 15 gold from the kid (-30; he stops talking to you), take a Potion off the fence's shelf (-20), lift a purse from a local worker (-10), take the hustle winnings back off the kid (-10).
- **What it changes (so far):** the fence only. Beloved is 20% off, Liked 10% off, Distrusted costs 25% more, and Feared is refused service entirely. His greeting changes too. Guards and the other dialog do not react yet.
- The numbers and tiers live in `reputation.js`; the choices are in `dialog.js` (the kid) and `shop.js` (the fence).

## Sound and music

- **Recorded effects** from Kenney's [RPG Audio](https://kenney.nl/assets/rpg-audio), [Interface Sounds](https://kenney.nl/assets/interface-sounds) and [Music Jingles](https://kenney.nl/assets/music-jingles) packs (CC0, free to use, no credit required): footsteps, coins, knife draws and slices, thuds, cloth, latches and creaks, menu clicks, and jingles for victory, level up, job complete, getting spotted and getting caught. They live in `audio/` as AAC (`.m4a`) so they play on iPhone too.
- **Generated effects** in the style of Bfxr/jfxr (noise, filters, envelopes): swishes, card flicks, hedge rustles, Fire, Ice, healing, the Smoke Bomb, the battle swirl.
- **Generated music:** a quiet night soundscape in the streets (river hum + a far-off Lantern Quarter band) and a driving battle theme. Options has separate Sound effects and Music sliders.

To swap a sound, replace the matching file in `audio/` (same name) or change the name in `audio.js`.

## Editing the level in Tiled

Each district is a [Tiled](https://www.mapeditor.org/) map in `levels/` (`lantern-quarter.tmj`, `paper-thief.tmj` for the Veyrane estate) (Tiled is installed in Applications). Open it in Tiled, edit, save, and reload the game.

- **ground** (tile layer): building, street, garden, hedge (hides ZAY), floor, river, dock. Paint with the `bellemorne-tiles` tileset.
- **objects** (object layer). Set each object's **Class** to one of:
  - `start` — where ZAY begins
  - `lamp` — a street lamp (optional `radius`, default 128)
  - `chest` — property `item` (any item name from `characters.js`)
  - `coin` — property `gold`; `cards` — property `count`
  - `ledger`, `kid`, `boat` — the objective, the Soot kid, the escape boat
  - `vault` — draw a 2-point line across a 1-tile wall where ZAY can tail-vault
  - `exit` — a rectangle; walking into it loads another district. Properties `to` (district id from `districts.js`) and `spawn` (spawn name there)
  - `spawn` — a named arrival point (the object's name); `start` is also a spawn
  - `label` — a place name painted on the map (the object's name is the text)
  - `npc` — a person you can talk to (Use / E). Properties `who` (`noe`, `severin` or `patron`), `look` (patron style 0–3), `dir` (facing, in degrees), `line` (what a patron says), `reach` (talk distance, e.g. across the bar)
  - `prop` — low, solid furniture drawn with a little height. Property `kind`: `counter`, `table`, `stage` or `stall` (a striped awning)
  - `guard` — draw a polyline for the patrol route; property `kind` = `guard`, `captain` or `watch` (the city watch: calm until it sees a crime)

## 2.5D look

The streets are still top-down, but buildings are drawn with height. The camera is treated as slightly tilted, so each roof sits a little up the screen from its footprint and also leans away from the centre of the view; the walls in between show the sides facing you, with windows (some lit). Lamps get posts whose heads lean the same way, and buildings have soft contact shadows on the ground. ZAY and the guards stand up too (sprite stacking): a shadow at the feet, a stack of body slices, and the detailed figure on top; knocked-out guards lie flat.

- Collision, stealth and guard vision are unchanged: they still use the flat map.
- Anyone a roof covers (a guard behind a building, or ZAY) shows as a faint see-through outline.
- Tune the look in `game.js`: `ROOF_TILT` (how tall buildings look), `ROOF_LIFT` (perspective lean) `LAMP_LIFT`, and `CHAR_HEIGHT` / `STACK_SLICES` for the characters.

## Borrowed from Godot

Techniques from the [Godot Engine](https://github.com/godotengine/godot) (MIT), re-written in this game's JavaScript:

- **Camera2D smoothing:** the camera eases toward ZAY (`pos += (target − pos) × speed × delta`) and shakes when you're spotted or a guard goes down.
- **Light2D + LightOccluder2D:** each lamp's light is clipped by the buildings around it, so light doesn't leak through walls.
- **Tween easing:** battle lunges, damage numbers and the encounter swirl use Godot's back, expo, cubic and sine curves (`scene/animation/easing_equations.h`).
- **InputMap:** controller buttons feed the same actions as the keyboard, with a different mapping in battles.

The bag, item database, equipment slots, item pickups and level/EXP panel follow the design of [GodotDynamicInventorySystem](https://github.com/alfredbaudisch/GodotDynamicInventorySystem) by Alfred Baudisch (Apache 2.0). Its ideas were re-written here; none of its code, art or sounds were copied.

The styling follows the structure of [unity-ui-toolkit-design-system](https://github.com/sinanata/unity-ui-toolkit-design-system) by Sinan Ata (MIT): one layer of design tokens in `style.css`, components that only use tokens, and hover / press / disabled / focus states on every control. Its icons (potion, bomb, sword, shield, gem, coin, bag, settings and others) are used in `icons.js` under the MIT licence; see `THIRD_PARTY_NOTICES.md`.

## Run it

No dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 5192 --directory "/Users/andrelaster/app ideas/bellemorne-rogue-game"
```

Then open <http://localhost:5192>.

In the Codex cloud environment, run `python3 -m http.server 5192 --bind 127.0.0.1 --directory /workspace/RPG-Game`. No dependency installation or build step is needed. Local startup, movement, inventory, and pause/resume were checked in Chromium.

## Files

- `index.html` — screens, HUD, touch controls
- `style.css` — HUD and screen styling
- `icons.js` — design-system icons (MIT), tintable with CSS colour
- `audio.js` — sound effects, generated music, volume buses
- `audio/` — Kenney CC0 sounds (AAC)
- `levels/` — the Tiled map, tileset and tileset image
- `ui.js` — settings and Options, confirm dialog, HUD tooltips, new-item badge
- `activities.js` — passers-by and pickpocketing, ZAY's card hustle, helping Soot Quarter folk
- `people.js` — NPCs (Noe, Severin, regulars), what they say, and furniture
- `districts.js` — the district list, travel between maps, objectives and map labels
- `save.js` — saved game (this device only): what is saved, loading and the title summary
- `reputation.js` — the Name score, its tiers and the fence price rule
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

## Deploying

Pushing to `main` on `andrerlaster-lgtm/RPG-Game` deploys this game to the `bellemorne-rogue-game` Vercel project. The project is login-protected for every deployment (Vercel Authentication: all), so the game is not public. Check the result in the LasterLab studio under Deploy Check.
