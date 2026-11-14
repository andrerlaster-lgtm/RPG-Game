# Third-person and environment polish — November 13, 2026

## Continuation point

The remote default branch was `main` at `5a25172`, with the phase-one night-lighting work merged in PR #17. The existing local working checkout was clean on `feat/ledger-quest-dialogue` at `3cf674e`, matching draft PR #18. An older original app folder was also clean, at `7123ee2`. Remote branches were fetched and inspected. No unpublished changes were found in either available checkout.

The graphics commits are authored as Claude; the repository does not identify a separate Fable author or contain Fable's private working session. No missing changes have been reconstructed or claimed as recovered.

Already present: vendored Three.js r169, third-person and Classic renderers, touch wheel, CC0 prop models, timber/stone buildings with pitched roofs, warm lamps and windows, cobble normal maps, fog/mist/contact shadows, districts, NPC dialogue, card hustle, ledger and collector jobs, inventory, ATB combat, reputation and saves. PR #18 adds interactive ledger choices and remains intact beneath this branch.

The documented unfinished character work was an MPFB2 modeling guide, not completed rigged character assets. The previous camera had no independent orbit or zoom, sampled only its centre ray, ignored furniture and could smooth through corners. Movement started/stopped instantly and footsteps were based on input, even against walls. The old river overlay sat below the ground plane.

## Implemented increment

- Camera-relative WASD, smooth facing, acceleration and quick braking. Original arrows, controller mapping and touch wheel remain supported. Classic gains WASD aliases while retaining immediate movement.
- Distance-based footsteps and locomotion blend; blocked movement no longer produces running footsteps or sprint noise. Roll movement consumes only its remaining duration, avoiding a final oversized step. Pause/blur clear held controls and momentum; district changes and the existing tail vault clear momentum.
- Left-drag/touch-drag orbit, wheel and keyboard zoom, C recenter. WASD maintains a stable camera basis. Camera-volume sweeps cover walls, conservative roof ridges, furniture and raised galleries, including the smoothed path. Obstructions pull the camera in immediately; release eases out. Extreme close-up hides the player model. The 3D camera omits positional shake to keep obstruction clearance stable; Classic/battle retain their effects.
- Articulated arms and hip-pivoted legs, boots, blended strides, a roll pose, ZAY's pointed ears, loc crown and tied ponytail, curved long tail, split coat and secondary motion. These are still procedural stylized figures, not imported humanoid rigs.
- Batched iron galleries and garden planting on existing map surfaces; static moon shadow maps (2048 desktop / 1024 touch), refreshed only on scene rebuild. Existing lantern lighting and contact shadows remain.
- Animated lit river surface above the painted ground, with procedural ripple normals and specular highlights. These are lighting highlights, not planar scene reflections.
- Static figure meshes merge by material using the already-vendored Three.js utility. Removed figures and district materials/geometries are disposed. Guard markers are recreated correctly after scene rebuilds.

Maps, dialogue text, quests, inventories, save schema and battle rules are preserved. No external assets, runtime dependencies, APIs, or new lore were added. `THIRD_PARTY_NOTICES.md` already covers the vendored Three.js utilities used here.

## Verification

- `npm test`: 9/9 tests passed for velocity limits, diagonal acceleration, timestep-independent damping, and camera clearance against walls, corners, furniture and elevated galleries.
- `npm run check`: all root JavaScript syntax, all four Tiled map dimensions/tile IDs, and configuration JSON passed. No build step exists.
- `git diff --check`: passed.
- `npm run test:browser` with a separately available Playwright Core and local headless Chrome: 15/15 checks passed. This covers startup, actual keyboard/pointer movement, animated stride, orbit/zoom/recenter, card throwing, deterministic sprint/roll/collision fixtures, repeated district travel, camera clearance, stable GPU resource counts, pause/inventory, held controller Start via an injected standard gamepad, Noe interaction, save/continue, a battle attack and return, existing vault endpoint, Classic, touch-layout controls, and disabled-WebGL fallback. No runtime/shader errors or failed local game assets in the successful run.
- Screenshots were inspected for the Lantern Quarter, Crooked Halo, River Quarter, estate and portrait mobile layout. Scene fixtures position the player for specific checks; this was not a full campaign playthrough.
- Early test setup problems: Python's default small connection queue intermittently reset asset requests; the checked-in suite uses its own Node server. Two assertions were corrected to use the actual battle menu property and the appropriate district for a Classic movement fixture. The final suite passed.

Opening Lantern Quarter at 1280×800, one local Chrome comparison of 100 animation frames each:

| Metric | Preserved baseline | This pass |
| --- | ---: | ---: |
| Visible draw calls | 196 | 133 |
| Visible triangles | 40,968 | 58,562 |
| Median frame interval | 16.7 ms | 16.7 ms |
| 95th percentile frame interval | 16.7 ms | 16.7 ms |

This is a display-capped local check, not proof of a frame-rate gain. Shadow setup has a one-time rebuild cost. Real phones/tablets, physical gamepads, Safari, full quest completion and long-session GPU profiling still need testing. Mobile checks use Chrome touch emulation, not real mobile hardware.

## Remaining work and workflow

Next art step: authored, canon-reviewed skinned character models and animation clips via the existing MPFB2 plan. Further passes can refine facial detail, interiors, vegetation and distant scenery. Free jumping/climbing and a continuous animated vault are not implemented; the existing discrete tail-vault mechanic is preserved. Chapters 1–2 campaign work, Rika/Kairo scenes and new cinematics remain pending story source and direction.

Branch: `feat/third-person-polish`, based on `feat/ledger-quest-dialogue`. Its PR targets that branch to keep the review focused; it should be retargeted after PR #18 is merged. Nothing is merged into main.

`vercel.json` disables automatic Git deployments for this exact review branch using `git.deploymentEnabled`, per https://vercel.com/docs/project-configuration/git-configuration. No production project settings, protection settings, domains or environment variables were changed. Deployment requires the owner's approval.
