# Bellemorne: Paper Thief

A top-down stealth game set in Andre's Bellemorne story. One level, a quick try.

ZAY slips into House Veyrane's Crown Quarter estate at night, steals the ledger holding the debt that is choking Noe's Crooked Halo, and escapes to a boat on the river.

The story source is the Bellemorne Master Canon in the Obsidian vault (`11 Books/Bellemorne/`). The game borrows from it loosely: House Veyrane "steals with paper," ZAY's card-hustle misdirection, his performer footwork, the tail, the katana and the daggers, the guild's "no casualties" code, and his habit of moving a mark's coin to someone who needs it.

## How to play

- **Goal:** take the ledger from the Veyrane counting house, then reach the river boat at the east docks. Optional: give the coin you pick up to the Soot kid on the dock.
- **Stealth:** lantern light (street lamps and guards' lanterns) makes you easy to see; shadows halve how far guards can see you; garden hedges hide you. A meter over each guard fills while they can see you; when it's full they raise the alarm and nearby guards come running.
- **No casualties:** every takedown is a knockout.

| Action | Keyboard / mouse | Touch |
|---|---|---|
| Move | WASD or arrows | Left thumb stick |
| Sprint (noisy) | Shift | Push the stick all the way |
| Takedown from behind, tail-vault the estate wall, grab the ledger, give coin | E | Use |
| Throw a card (noise lure; stuns on a direct hit) | Q or right-click (aims at the cursor) | Card (throws where you face) |
| Katana | J or left-click | Blade |
| Roll | Space | Roll |
| Pause | Esc or P | II button |

Your end rating depends on how often you were spotted and how many guards you knocked out: **Ghost of the Lantern Quarter** (never spotted, no knockouts), **Shadow**, **Rogue**, or **Brawler**.

## Run it

No dependencies. Serve the folder and open it in a browser:

```bash
python3 -m http.server 5192 --directory "/Users/andrelaster/app ideas/bellemorne-rogue-game"
```

Then open <http://localhost:5192>.

## Files

- `index.html` — screens, HUD, touch controls
- `style.css` — HUD and screen styling
- `game.js` — map, lighting, guards, stealth and combat

## Preview

Stable preview link (needs your Vercel login): https://bellemorne-rogue-game-preview-andrerlaster-lgtms-projects.vercel.app

To update it, run `npm run deploy`, then point the stable link at the new deployment:

```bash
vercel alias set <new-deployment-url> bellemorne-rogue-game-preview-andrerlaster-lgtms-projects.vercel.app --scope andrerlaster-lgtms-projects
```

The project's very first deploy (2026-10-03) went to production by Vercel's default for new projects. Its public aliases (`bellemorne-rogue-game.vercel.app` and the team alias) were removed right away, so only the login-protected preview is in use.
