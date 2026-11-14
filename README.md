# Bellemorne: Paper Thief

A third-person stealth game set in Andre's Bellemorne story (with the original top-down view as an option).

ZAY slips into House Veyrane's Crown Quarter estate at night, steals the ledger holding the debt that is choking Noe's Crooked Halo, and escapes to a boat on the river.

The story source is the Bellemorne Master Canon in the Obsidian vault (`11 Books/Bellemorne/`). The game borrows from it loosely: House Veyrane "steals with paper," ZAY's card-hustle misdirection, his performer footwork, the tail, the katana and the daggers, the guild's "no casualties" code, and his habit of moving a mark's coin to someone who needs it.

## How to play

- **Goal:** take the ledger from the Veyrane counting house, then use the river boat at the east docks to escape. Optional: give the coin you pick up (or steal) to the Soot kid by the street stage in the Lantern Quarter.
- **Stealth:** lantern light makes you easy to see; shadows halve how far guards can see you; garden hedges hide you. A ring over each guard fills while they can see you; when it's full they raise the alarm and nearby guards come running.
- **No casualties:** every takedown and every battle win is a knockout.

| Action | Keyboard / mouse | Touch | Controller |
|---|---|---|---|
| Move (3D view) | WASD relative to camera; arrows retain forward/back/turn | Wheel: push up to walk, sideways to turn, down to step back (push further to go faster) | D-pad or left stick, same as keys |
| Move (Classic view) | Arrow keys or WASD | Wheel: ZAY walks the way you push | D-pad or left stick |
| Look around (3D) | Left-drag view; wheel or +/− zoom; C recenter | Drag the open view | — |
| Sprint (noisy) | Shift | Hold Sprint | Hold LB or RB |
| Interact, talk, pick a quest action, or take down a guard from behind | E | Use | A |
| Throw a card (noise lure; stuns on a direct hit) | Q or right-click (3D: straight ahead; Classic: aims at the cursor) | Card (throws where you face) | X |
| Roll | Space | Roll | B |
| Bag (inventory) | I or Tab | Bag button (top) | Y |
| Pause | Esc or P | II button | Start |

In battles a controller uses the d-pad to choose, **A** to confirm and **B** to go back.

When a quest prompt appears, press **E** / **Use** / **A**. Pick an option with the arrow keys and Enter, the d-pad and **A**, or by tapping it.

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

- **Options** (title screen or pause menu): sound volume, guard vision cones on/off, screen shake on/off, **View** (3D or Classic) and battle speed (Slow / Normal / Fast). Settings are saved in this browser on this device.
- **Minimap** (top right in the field): the streets around ZAY, the ways out (gold squares), the objective (a gold ring, pinned to the edge when it's off the map), and only the guards ZAY could see for himself or who are already chasing him. In 3D it turns with the camera; the N shows north. Code: `minimap.js`.
- **District name card:** arriving in a district shows its name in large letters for a few seconds (it replaced the small toast).
- **Graphics quality** has **Auto** (the default for new players): High until the device shows it can't keep up (about 4 seconds under ~25 frames a second), then Low for the rest of the session. A choice already saved on a device (Low or High) is kept.
- **Restart level** asks for confirmation first.
- **Bag badge:** a red number on the Bag button counts new items; tabs with new items get a dot, and new items show a "New" tag until you select them.
- **Tooltips:** hover (or focus, or long-press on a phone) the HP, gold, cards, visibility, Bag and Pause items in the HUD.

The bag uses larger item slots and separate character and item details, with a scrollable layout on smaller screens. Battle commands, opponents and party status have separate panels so target selection stays visible.

## Districts

Bellemorne is split into districts you walk between. A new game starts in the **Lantern Quarter** outside the Crooked Halo (walk in to meet Noe); walk east down the main street to reach the **Crown Quarter** (House Veyrane's estate, the ledger job). The estate's west gate leads back.

- Your character comes with you: gold, items, gear, level, Name and finished jobs. Each district remembers its opened chests and picked-up coins and cards; guards reset on every visit.
- You can't leave a district while guards are chasing you.
- Finishing the ledger job shows the job summary, then sends you back to the Lantern Quarter by the Crooked Halo. Coming back to the estate afterwards is quiet: the ledger is gone.
- The Soot Quarter comes next, following the Master Canon (four quarters: Crown, Lantern, River, Soot).
- Districts are listed in `districts.js`; to add one, add a map in `levels/`, list it there, and connect it with `exit` and `spawn` objects.

## The Lantern Quarter and the city watch

The Lantern Quarter is lively, not poor (as the canon insists): a main street with food stalls and a mask stall, a square with a street stage, a music hall, a card room, a narrow cut through the card-room block, a side yard behind the mask shop, and the Crooked Halo. Vendors and a regular at the stage have a line each. The **Soot kid** now waits by the street stage (give or take coin there).

- **The city watch** (reddish-brown coats) patrols the main street, the square and the south lane. They ignore ZAY, even in full lantern light, until a watchman sees a crime: a takedown, a card hitting someone, or shaking down the kid. Then "The watch saw that!", they raise the alarm, and it plays like the estate: chase, battle, knockout or get away.
- Hostile watchmen stay hostile for the rest of that visit; leaving and coming back resets them.
- Caught by the watch: "The city watch drags ZAY off to the Crown Quarter cells", and you go back to your last save.
- Patrol routes are Tiled `guard` polylines with `kind` = `watch`.

## The River Quarter

South of the Lantern Quarter (the street at the south end of the middle cross street), where money moves near water: a dock road along the river, a boardwalk and four piers, **Blackwater Market**, a fish market, dark warehouses with an alley between them, a cargo office and a river tavern.

- **The Blackwater fence** now trades here, in the market (same prices, Name rules and choices as before). He has left the estate docks.
- **The smuggler slip:** the boatman on the east pier takes you upriver to the Veyrane estate's back docks for 5 gold, a second way into the ledger job. A skiff on those docks brings you back to the slip.
- Dockworkers and merchants to pickpocket, two watch patrols, a chest and coins in the warehouse alley, a fish porter who needs 15 gold (the Crown's new river toll), and regulars with rumors: a fence on the east piers who hasn't opened in a week, someone asking about rogue cards.
- **Carrying the ledger:** it only leaves the estate by the river boat. Every other exit says "Not with the ledger. Get it to the river boat." (Before, walking out another way lost it.)

## Job 2: the collector's satchel

After you've told Noe the ledger job is done, she has a second one. Veyrane sent a collector who says she missed three payments this spring; he has papers to prove it, and the papers are forged.

1. Agree, and the **collector** appears on the Lantern Quarter's main street, walking it every night with **two of House Veyrane's men** at his sides.
2. Like the watch, the escorts don't attack on sight in the city, but their vision cones show: every few seconds one of them glances back over his shoulder. Come up behind the collector between glances, ideally out of the lantern light, and **Lift** the forged claim (plus 20 gold).
3. Grab from the front, or while an escort is looking, and it's "Thief! Get him!": the escorts and any watch in earshot come after you. Knocking an escort out in front of the other counts as a crime too.
4. Bring the claim to Noe ("That's not my hand. That's not anyone's hand."). Job complete, +8 Name, and a new night begins. Severin has something to say about it on your next visit.

- Tiled: the collector is a `walker` with `kind` = `collector`; his escorts are `guard`s with `escort` = `collector` (they walk in formation beside him, so their own route doesn't matter).

## Side activities in the Lantern Quarter

- **Pickpocketing.** Passers-by walk the streets: well-off **Crown marks** (fine coats, gold trim, hats) and **locals** (Soot Quarter workers). Come up behind one and the prompt says **Lift**; press Use / E to take their purse. Marks carry more and lifting from them costs nothing: ZAY takes from people who can afford it. Lifting from a local costs 10 Name. Grab from the front and they shout "Thief!": every watchman within earshot comes running. In lantern light a mark sometimes notices even from behind, so work the shadows. A watchman standing close can also spot a clean lift.
- **ZAY's card hustle** (the Crown gent at the card table by the street stage, once per night), from Chapter 1: let him win the first hand to hook him, bleed him slow, then bet him a kid from the crowd can beat him at a child's game. Then choose: the kid keeps all 65 gold (+15 Name), split it (+6), or take it back off the kid (−10). Push too greedy too early and he walks away with you only a few coins up.
- **Helping the Soot Quarter.** A washerwoman in the west back alley and a shrine keeper in the yard behind the mask shop each need a little gold (20 and 30). Giving it: +8 Name each, once per night.
- A night ends each time you finish a job, so the hustle and the helping can't be repeated by walking out and back in. Pickpocketed purses reset each visit.
- Tiled: passers-by are `walker` polylines (`kind` = `mark` or `local`, `look`); the hustle is an `npc` with `who` = `hustle`; people in need are `npc`s with `who` = `needy` and `need`, `ask`, `thanks`.

## The Crooked Halo, Noe and Severin

The first story loop of the open city:

1. A new game starts outside **the Crooked Halo**. Walk in through its door (south side of the main street).
2. **Noe** is behind the bar. Ask what the ledger will buy her, agree to bring it back, or take more time. The same five gold you could give the Soot kid will buy passage upriver if you have it.
3. Walk east to the Crown Quarter or take the smuggler's boat. At the old wall you can choose whether to tail-vault it. At the hedge south of the counting house, scout the patrol or spend a card to draw it away from the door.
4. At the ledger, take it quickly or inspect the silver seal. Lingering can alert a nearby guard, and what you learn changes ZAY's report to Noe. At the east docks, lose any active pursuit and choose to push off. You can spend a card to draw a patrol away first.
5. You're sent back outside the Halo. Give Noe the ledger (+10 Name). The collector's satchel job opens after you report back.

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

Each district is a [Tiled](https://www.mapeditor.org/) map in `levels/` (`lantern-quarter.tmj`, `crooked-halo.tmj`, `river-quarter.tmj`, and `paper-thief.tmj` for the Veyrane estate) (Tiled is installed in Applications). Open it in Tiled, edit, save, and reload the game.

- **ground** (tile layer): building, street, garden, hedge (hides ZAY), floor, river, dock. Paint with the `bellemorne-tiles` tileset.
- **objects** (object layer). Set each object's **Class** to one of:
  - `start` — where ZAY begins
  - `lamp` — a street lamp (optional `radius`, default 128)
  - `chest` — property `item` (any item name from `characters.js`)
  - `coin` — property `gold`; `cards` — property `count`
  - `ledger`, `ledger-scout`, `kid`, `boat` — the objective, the patrol overlook, the Soot kid, the escape boat
  - `vault` — draw a 2-point line across a 1-tile wall where ZAY can tail-vault
  - `exit` — a rectangle; walking into it loads another district. Properties `to` (district id from `districts.js`) and `spawn` (spawn name there)
  - `spawn` — a named arrival point (the object's name); `start` is also a spawn
  - `label` — a place name painted on the map (the object's name is the text)
  - `npc` — a person you can talk to (Use / E). Properties `who` (`noe`, `severin` or `patron`), `look` (patron style 0–3), `dir` (facing, in degrees), `line` (what a patron says), `reach` (talk distance, e.g. across the bar)
  - `prop` — low, solid furniture drawn with a little height. Property `kind`: `counter`, `table`, `stage` or `stall` (a striped awning)
  - `guard` — draw a polyline for the patrol route; property `kind` = `guard`, `captain` or `watch` (the city watch: calm until it sees a crime)

## 3D view (third person)

The field is drawn in 3D by default, with a chase camera behind ZAY (`render3d.js`, using [Three.js](https://threejs.org) r169, MIT, copied into `vendor/three/`). Battles are still the 2D Final Fantasy-style screen.

- **Shared game systems.** Maps, collision, stealth, guard vision, saves and every job use the same code as the Classic view. The 3D controls add smoothing on top of those rules. Options → View switches between them at any time.
- **Controls:** WASD moves relative to the camera with smooth facing, acceleration and quick braking. Arrow keys, the touch wheel and controller retain forward/back/turn. Left-drag the open view to orbit (also on touch); wheel or +/− zoom; C recenters. Cards still fly where ZAY faces. Footsteps and sprint noise follow actual movement, so pushing into a wall stays quiet.
- **Camera:** follows behind and above ZAY, with a stable heading during WASD movement. It sweeps a camera-sized volume against buildings, roof heights, furniture and projecting balconies, pulls in immediately, and eases back out. The smoothed camera path is checked too, preventing corner cutting. Very close cameras hide ZAY briefly to keep the view clear. On phones the view is shifted up so ZAY stands above the thumb controls.
- **What's drawn:** the same map as Classic, with wet cobbles, varied plaster/brick buildings (cut stone on the Veyrane estate), pitched roofs, pale cornices, framed windows, louvered shutters, scrollwork balconies, flower boxes and layered planting. Existing market/street furniture, boat, exits, labels, awareness markers and interaction prompts remain.
- **Market stalls, stools and kegs are real models:** CC0 models by Polygonal Mind (`models/props.glb`, 644 KB, loaded by `vendor/three/addons/GLTFLoader.js`). Food and mask stalls use the market booths, facing the open street and fitted to the stall's tiles. Tables get stools, and the Crooked Halo bar gets kegs. If the file can't load, the simple boxes are used instead.
- **ZAY's playable 3D mock:** a custom MPFB-based CC0 skinned prototype with locs, pointed ears, a coat and animated tail, using idle/walk/run, dodge, throw and takedown clips. His name, story, portraits and abilities remain intact. NPCs keep their procedural figures, and failed downloads use the procedural ZAY fallback. The earlier KayKit rogue is retained as an alternative asset. Model configuration and animation mappings live in `hero3d.js`; see `docs/graphics/zay-3d-mock.md` for the prototype's limits and `docs/graphics/major-overhaul.md` for the replacement workflow.
- **Lighting and quality:** Options → Scene lighting selects Night, Dusk or Day, with generated skies, environment lighting, fog and wet-surface response. These are visual previews; stealth still uses the existing night rules. Low quality reduces resolution, local lights, distant decorations and mist, and disables directional shadows. Settings persist on this device.
- **Night look (phase 1):** warm lantern light against cool shadows, real cobbles with relief, lantern halos and light pools, glowing framed windows, soft lantern-aware shadows and low mist, drawn by `light3d.js` with no extra image files. See `docs/graphics/night-lighting-phase1.md` for the before/after pictures, the tone-mapping comparison and the performance numbers.
- **Polish pass:** iron galleries on street-facing windows, garden plants, static moon shadows and animated river highlights above the painted ground. Static character parts are batched; district rebuilds dispose their GPU resources. See `docs/graphics/third-person-polish.md` for provenance, validation and remaining work.
- **Street life** (`streetlife3d.js`): a door with a stone step on each house's street side (on a wall without windows, so the shutters and galleries stay), door lanterns, painted shop signs on iron brackets (not on the estate), chimneys with drifting smoke, strings of paper lanterns across the Lantern Quarter's streets (fewer in the River Quarter), plank docks on posts, and trees. Rooms like the Crooked Halo no longer show street windows on their inside walls.
- **Trees are solid.** `plantTrees` in `game.js` plants them by rule rather than in Tiled: on open garden ground and in the middle of wide squares, never within about two tiles of any Tiled object or patrol/walking route. A tree blocks its tile in both views (it joins `FURN`, like furniture), so guards path round it. Classic draws it as a crown seen from above.
- **Glow** (`post3d.js`, High only): bloom round lanterns and windows, a cool-shadow / warm-highlight grade, a vignette, and a faint red edge while guards are chasing. Low draws straight to the screen.
- **No WebGL:** if the device can't run 3D, the game stays in Classic and Options says so.
- Tune it in `render3d.js`: `WALL_H` (building height), `zoomBack` / `pitch` (camera distance and angle), and `TURN_RATE` in `game.js`.

## 2.5D look (Classic view)

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
- `game.js` — map, lighting, guards, stealth, the Classic renderer, and the switch into battles
- `traversal.js` — tested velocity and camera-clearance math
- `render3d.js` — the third-person 3D view (Three.js)
- `streetlife3d.js` — doors, signs, chimney smoke, lantern strings, docks and trees in 3D
- `post3d.js` — the High-quality finishing pass (bloom, colour grade, vignette)
- `minimap.js` — the minimap and the district name card
- `light3d.js` — the 3D night look: generated cobble, glow, shadow and mist textures
- `world-art3d.js` — generated plaster/wetness, sky/environment lighting, instanced facade and foliage detail
- `hero-config.js` — replaceable ZAY model path, orientation and semantic animation mappings
- `hero3d.js` — reusable ZAY loading, normalization and animation controller
- `models/zay/` — current Shadow rogue, previous prototypes, and their separate license notices
- `vendor/three/` — Three.js r169 (MIT), plus its GLTF loader and post-processing add-ons in `addons/`
- `models/props.glb` — CC0 market stalls, stools and kegs (Polygonal Mind)
- `battle.js` — Final Fantasy-style battles (ATB gauges, commands, help window, victory screen)
- `inventory.js` — the bag screen, item icons, equipping and field item use

## Validation

`npm test` runs the movement/camera math regressions. `npm run check` checks JavaScript syntax and all Tiled map structures. There is still no build step and no runtime package installation.

`npm run test:smoke` (`tests/smoke.cjs`) is a second real-browser check that drives the game loop in fixed steps, so it also passes on slow machines and software graphics: movement, collision from 16 directions, camera drag/zoom/clearance, all four districts (exits reachable, trees solid, patrols moving), takedown, cards, coins, bag, pause, save, talking to Noe, a battle, Classic, Low/High/Auto graphics and GPU resource counts across district changes. It needs Playwright: `npm i -g playwright`, then `NODE_PATH=$(npm root -g) npm run test:smoke`.

For the optional real-browser suite, make `playwright-core` available separately and run:

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core CHROME_PATH=/absolute/path/to/chrome npm run test:browser
```

The suite starts its own localhost server and writes screenshots/results under `work/playtest/` (override with `TEST_ARTIFACTS`). It uses keyboard/pointer controls plus deterministic scene fixtures; it is not a complete campaign playthrough. Physical controllers and real mobile GPUs remain unverified.

`vercel.json` disables automatic Git deployments for `feat/third-person-polish` and `feat/major-graphics-overhaul`, so review can happen before deployment approval. It does not alter login protection or the production branch.

## Deploying

The owner merges the reviewed branch. Pushing to `main` on `andrerlaster-lgtm/RPG-Game` deploys this game to the `bellemorne-rogue-game` Vercel project. Keep every deployment login-protected. Follow `AGENTS.md`: do not run manual deploy/promote/alias commands, publish preview links, or change project protection settings. Check the result in the private LasterLab studio under Deploy Check after a merge.

## ZAY character review

The current development branch replaces the plain MPFB prototype with a detailed, rigged third-party Shadow rogue: layered leather/cloth gear, sculpted face, hood/hair, straps, buckles and reinforced boots. Its supplied PBR textures are repaired and optimized, locomotion/actions blend through the reusable controller, and high quality adds a small moving shadow. The source is AI-assisted and uses a custom game-use license, not CC0.

See `docs/graphics/zay-shadow-rogue.md` for provenance, license terms, reproduction, replacement instructions and remaining limitations. Serve the repository locally and open `tools/zay-review.html` for the real mesh's before/after comparison and animation review. The previous MPFB and KayKit assets remain available. ZAY's established identity and gameplay are unchanged. Automatic deployment is disabled for `feat/zay-authored-character`; the owner reviews and merges.
