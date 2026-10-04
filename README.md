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
| Pause | Esc or P | II button | Start |

In battles a controller uses the d-pad to choose, **A** to confirm and **B** to go back.

## Battles (Final Fantasy style)

If an alerted guard catches ZAY, the screen switches to a battle: guards on the left, your party on the right, blue command windows at the bottom. It uses Active Time Battle in wait mode: each fighter's gauge fills over time, and the clock pauses while you choose.

- **Every character:** Hit, Item, Run.
- **Class command:** Rogue → **Steal** (gold or items; stolen gold goes to your pocket for the kid), Spellcaster → **Magic** (Fire, Ice, Cure; costs MP), Swordfighter → **Slash** (hits every enemy).
- **Controls:** ↑/↓ choose, Enter (or Z/E/Space) confirm, Esc (or X/Backspace) back. On touch, tap a command, then tap a target.
- Win and the guards are knocked out on the map. Run (60% chance) leaves them stunned for a few seconds. If the whole party falls, ZAY is caught.

The party is just ZAY for now. To add a character, edit `characters.js`: add an entry to `CHARACTERS` with a class (`rogue`, `caster` or `sword`) and put its id in `STARTING_PARTY` (up to 4). Spells, items and enemy stats live in the same file.

Your end rating depends on how often you were spotted and how many guards you knocked out: **Ghost of the Lantern Quarter** (never spotted, no knockouts), **Shadow**, **Rogue**, or **Brawler**.

## Borrowed from Godot

Techniques from the [Godot Engine](https://github.com/godotengine/godot) (MIT), re-written in this game's JavaScript:

- **Camera2D smoothing:** the camera eases toward ZAY (`pos += (target − pos) × speed × delta`) and shakes when you're spotted or a guard goes down.
- **Light2D + LightOccluder2D:** each lamp's light is clipped by the buildings around it, so light doesn't leak through walls.
- **Tween easing:** battle lunges, damage numbers and the encounter swirl use Godot's back, expo, cubic and sine curves (`scene/animation/easing_equations.h`).
- **InputMap:** controller buttons feed the same actions as the keyboard, with a different mapping in battles.

## Run it

No dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 5192 --directory "/Users/andrelaster/app ideas/bellemorne-rogue-game"
```

Then open <http://localhost:5192>.

## Files

- `index.html` — screens, HUD, touch controls
- `style.css` — HUD and screen styling
- `characters.js` — classes, party, spells, items, enemies
- `game.js` — map, lighting, guards, stealth, and the switch into battles
- `battle.js` — Final Fantasy-style battles (ATB gauges, commands, battle screen)

## Preview

Stable preview link (needs your Vercel login): https://bellemorne-rogue-game-preview-andrerlaster-lgtms-projects.vercel.app

To update it, run `npm run deploy`, then point the stable link at the new deployment:

```bash
vercel alias set <new-deployment-url> bellemorne-rogue-game-preview-andrerlaster-lgtms-projects.vercel.app --scope andrerlaster-lgtms-projects
```

The project's very first deploy (2026-10-03) went to production by Vercel's default for new projects. Its public aliases (`bellemorne-rogue-game.vercel.app` and the team alias) were removed right away, so only the login-protected preview is in use.
