# ZAY 3D mock — actual game asset

The separate output package contains real geometry, a skinned skeleton and embedded animations. Studio images are Blender renders of this mesh, and the in-game image is a local Chrome capture. This is a rough modeling and animation prototype, not the finished concept-art quality model.

## Open and inspect

- Open `zay-preview.html` in Chrome for an entirely offline viewer. Drag to orbit, scroll to zoom, and choose Idle/Walk/Run/Dodge/Throw/Melee. It embeds the GLB and the MIT-licensed Three.js runtime; no server or internet is needed.
- Import `zay-mock.glb` into a glTF-compatible tool or game engine.
- Open `zay-mock.blend` in Blender to edit the geometry, materials, skeleton and actions. Studio camera/lights are included only in the Blender file, not the GLB.

## Included

Dark brown skin, pointed ears, hazel-gold eyes, modeled locs and ponytail, charcoal split coat, tan shirt, trousers, boots, card pouch, pendant, sheathed katana and an articulated prehensile tail. The body's base mesh and skinning weights are adapted from MPFB's CC0 assets; clothing, hair, tail and in-place animation prototypes were authored for this mock.

Asset: 2,056,856 bytes, 52,496 triangles, 11 skinned mesh/material batches, 60 joints, seven embedded clips. Exact hash and clip names are in `asset-stats.json`. This is heavier than the previous temporary rogue and needs a later LOD pass for low-end phones.

## Game integration

The review branch uses `models/zay/zay-mock.glb` through the existing `hero3d.js` controller. It preserves imported materials and aligns the visual model at the skeleton origin so the long tail does not offset the player. Bone diagnostics are configurable. Gameplay position, camera, collisions, quests, saves and the existing 2D battles are unchanged. The original KayKit asset remains available in the repository; the procedural loading fallback remains tested.

## Validation

9/9 movement/camera tests, JavaScript/map/config checks and 18/18 browser checks passed. The latter covers skeletal deformation, blending, actions, collision/camera, district changes, save/continue, dialogue, battle, Classic, touch layout and failed-model/WebGL fallbacks. Actual front/back renders and an in-game capture were inspected. The offline viewer was separately checked for loading, animation selection and orbit.

The clothing and hair are intentionally simple. Coat fit, cuffs, footwear, facial detail, UV textures, foot planting and action poses still need an art pass; some garment intersections can appear during exaggerated motion. This is not final production animation or a faithful finished reproduction of the earlier concept sheet. No real mobile hardware, Safari or full campaign playthrough was verified.

## Provenance and reproduction

[MPFB](https://github.com/makehumancommunity/mpfb2), commit `9de0707fdc88438d7c53a1a2ac7937d9221e2431`: base anatomy, macro targets, game-engine skeleton and weights. Its bundled graphical assets are CC0; the add-on's source code is GPL and is not bundled in the game. Original asset license and explanatory license text are included. No new third-party clothes/hair packs were downloaded.

The repository's `tools/prepare_zay_base.py` creates the selected anatomy with MPFB in an isolated Blender process, and `tools/build_zay_mock.py` constructs the character, animations, GLB and Blender scene. To reproduce, use a workspace containing `work/mpfb2` at the commit above and create `work/zay-build/`. Run the preparation script with the workspace root after `--`; run the builder with the resulting base.blend and an output directory after `--`. Set BLENDER_USER_RESOURCES to a scratch folder to keep Blender settings isolated. Built with Blender 5.2.2.

No merge or deployment is performed by this task. The review branch is excluded from automatic deployment.
