# ZAY: temporary detailed rogue

The playable 3D character now uses **Shadow the Rogue Assassin by Grigory Petrov**. This is a prebuilt, AI-assisted third-party mesh, not a new canonical design for ZAY. His name, story, stats, collision capsule, movement, stealth, camera, quests, saves and ATB battles retain their existing systems. The old MPFB prototype remains available for comparison.

## What changed

- Replaced the plain prototype with a skinned mesh containing sculpted facial features, hood/hair, layered cloth and leather, cross-body straps, buckles, bracers, hip panels, knee guards and boots.
- Connected the pack's actual normal, roughness and metallic textures. Removed the incorrect base-color-as-emission setup and excessive specular extension.
- Resized the base color map to 2048² (JPEG) and the normal map to 1024², packed roughness/metallic into 1024² (both JPEG without colour subsampling since November 14, which cut the file from 10.3 MB to 3.6 MB with no visible change in game; see `tools/shrink_rogue_textures.py`), smoothed split normals across shallow seams and baked explicit UV tangents. No primitive clothing or body geometry was generated.
- Preserved the supplied idle, walking, running and kick animations. Added short ZAY-specific card throw, crouching dodge and interaction gestures on the same skeleton. Clips crossfade, restart correctly and use a common horizontal root anchor; the gameplay controller owns all translation.
- Added a soft following spotlight with a 512² moving shadow on high quality. Low quality retains contact shadows. The larger district moon shadow is cached, with ZAY excluded during refresh to prevent a stale silhouette.
- Moved model path, scale, facing, semantic clips, timings and root/bone names into `hero-config.js`. `hero3d.js` measures the configured idle pose rather than an arbitrary exported pose and reports semantic roles for tests.

## Source and license

Source: <https://grigory-petrov.itch.io/shadowrogue>, downloaded through the creator's free itch.io download flow. The listing discloses AI-assisted graphics; the files identify Meshy as the creation pipeline. No Mixamo files, commercial-game rips, or geometry from the user's reference image were used.

The archive's `README.txt.txt` grants royalty-free use in games and commercial projects, prohibits reselling the raw model, and makes credit optional. Its original full text is preserved in `models/zay/LICENSE-SHADOW.txt`. Credit is included anyway. This asset is **not CC0 or MIT**; its custom terms remain attached to this game's incorporated asset. Do not offer the model as a standalone asset for resale. The source ZIP is not committed or redistributed in the review package.

Source archive SHA-256: `1c30da2f3b188afea6f24f1293cce6493ffaefbac50b5ebbd1e1226dd9ddf0f4` (175,475,482 bytes).

Runtime GLB SHA-256: `84c9aaae57b0243b320a5f0114fbb2b1216275384f05c4f85eb03c3a614b9b11` (3,629,292 bytes). Before the texture shrink it was `9ddf2d8427dfe865f459e2042823d241435a5772c4074c9a813ce3dd4d2cc66f` (10,328,300 bytes).

Actual runtime contents: **20,590 triangles, 21,961 exported vertices, one material, 24 skin joints, three embedded textures and ten animation clips**. The supplied README's approximate 5K triangle count and advertised animation names do not match the archive; the numbers and mappings here come from inspecting the GLB.

## Candidates evaluated

| Resource | Decision |
| --- | --- |
| Existing MPFB ZAY and KayKit rogue | Reused the modular controller and kept both assets. Neither existing outfit meets the requested detail target. |
| [Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Adobe documents free, royalty-free game use with an Adobe ID. No new Mixamo account workflow or assets needed because the selected pack already has a rig and locomotion. |
| [Quaternius RPG characters](https://quaternius.com/packs/rpgcharacters.html) | Six rigged/animated CC0 fantasy characters; useful stylized alternatives, but not selected for this more detailed clothing target. |
| [Sketchfab Rogue by OliverMatheGames](https://sketchfab.com/3d-models/rogue-002c266eb95a45039fc4b9da9875a2ab) | CC BY 4.0, about 18K triangles. Inspected the viewer: simple/unfinished facial detail and loose robes are a weaker match. Download also requires sign-in. Not incorporated. |
| [Wander Sols Rogue on Fab](https://www.fab.com/listings/15e2afd1-11c0-4679-832c-ebbfb6162583) | Promising 22K-triangle UE mannequin character with 2K/4K textures. Marketplace licensing/acquisition would need a separate review; not downloaded or incorporated. |
| [Kenney](https://kenney.nl/assets) / [Poly Haven](https://polyhaven.com/license) | Reviewed as supporting libraries. No additional assets needed: the selected pack already supplies matching UV-specific materials. |

## Reproduce and review

1. Download the source pack from its creator and extract it outside the repository.
2. With Python 3 and Pillow available, run `python3 tools/prepare_rogue.py /absolute/path/to/extracted/RogueAssassin_Shadow_Free_3D_Character_v1.0.zip`.
3. Serve the repo locally, e.g. `python3 -m http.server 8000 --bind 127.0.0.1`. Open `/tools/zay-review.html` for full-body, close-up, back, before/after and animation controls. Open `/index.html` for the playable game.
4. Run `npm test`, `npm run check` and the optional browser suite documented in README.

The prep script reads asset data and never runs code from the downloaded archive. Pillow is an offline preparation dependency only; the game still has no runtime package installation or build step.

## Replacing the temporary character

Export the custom model as skinned GLB with baked animations. Set its path, height, facing rotation, root motion node(s), diagnostic bones and semantic clip map in `hero-config.js`. Idle/walk/run are required. Optional actions can be mapped without touching gameplay logic. Keep each clip's horizontal root anchor consistent. The current model's source skeleton uses a scaled Armature parent; preserve its hierarchy when editing it. Replace it normally when importing a different rig.

## Validation and remaining limits

Nine movement/camera unit tests and JS/map/config validation pass. All 20 browser checks pass. The suite checks actual loading, all required PBR maps, animated locomotion/crossfades, in-place roots, repeated combat, card throw, dodge collisions, camera, district resource lifetime, high/low shadows, saves, quests, ATB battle, Classic fallback, mobile viewport and missing-asset fallback. Review screenshots are actual Three.js renders of the shipped mesh, including in-game views.

Khronos glTF Validator reports **zero errors and one warning**: the source skinned mesh is under a scaled Armature parent (`NODE_SKINNED_MESH_NON_ROOT`). That original hierarchy is retained because its skinning is verified in the target Three.js runtime. No unused-accessor, missing-tangent or buffer target issues remain.

This is a substantial asset upgrade, not a final AAA character. The hood hides most of the hair; the face has no expression rig, fingers have no separate animation bones, and extreme leg poses can stretch the skirt panels. The dodge is a brief crouching evade rather than a full somersault; timing, distance, invulnerability and collisions are unchanged. Combat currently uses a kick. Foot IK, cloth simulation, final canonical anatomy/locs/tail, and a full campaign/physical-device performance pass remain future work. The existing ATB battle view is still 2D.

The development branch disables automatic deployment. No merge, production deployment, public preview link or protection change is part of this work.
