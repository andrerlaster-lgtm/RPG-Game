# Night lighting, atmosphere and ground: phase 1

Scope: the 3D exploration view only (`render3d.js`, new `light3d.js`). The 2D combat screen, gameplay, movement, camera and maps are unchanged. Three.js stays at r169; no new dependencies or image files (every texture is drawn at start-up).

## What changed

| Priority | Change |
|---|---|
| Warm lantern light, cool shadow | Hemisphere light is a cool blue sky over a violet bounce; the moon is cooler; the 6 real lamp lights are a warmer orange. Fog is a cool blue haze instead of near-black. |
| Cobblestones | Street tiles get real cobbles: a seamless 1024 px texture (22 stones per side, 4 tiles per repeat) with a normal map for relief and a small sheen (`MeshPhongMaterial`) so lantern light glints on the stones. A low-res "tint" map adds worn and damp patches. |
| Fog and lantern glow | Every lamp gets a lantern (post, glowing core, cap), a soft halo sprite and a pool of warm light on the street. Low drifting mist patches hang over the streets (skipped on touch devices). |
| Windows and building light | Lit windows have frames and a cross, a different warmth and brightness each, a soft glow around the glass, and a pool of light on the street in front. |
| Grounding | The tint map darkens the ground where it meets walls (ambient occlusion) and under stalls and tables. Figure shadows are soft and stretch away from the nearest lantern. |

## Tone mapping

Same street, six options (`tone-mapping-comparison.jpg`; exposure chosen per mapper so overall brightness is similar):

- **None**: keeps colours but flat-clips the lamps and lit timber.
- **Reinhard**, **AgX**: washed out; the blues and the warm light both go grey.
- **ACES Filmic**: punchy but pushes the oranges and reds hard and loses the blue shadows.
- **Cineon**: warm and contrasty, a little muddy.
- **Neutral** (chosen, exposure 1.05): keeps the blue shadows and orange light separate and rolls highlights off smoothly. Change it in `render3d.js` (`LOOK`) or at run time with `R3D.setLook({ tone: 'aces', exposure: 1.3 })`.

## Performance

Measured headless with software WebGL (Chromium + SwiftShader, no GPU), so only the comparison matters, not the absolute numbers. Before and after were measured in alternation on the same fixed street, 6 runs each, median of ms per frame:

| | Before | After |
|---|---|---|
| Draw calls (street scene) | 201 | 200 |
| Triangles | 46,403 | 48,247 |
| Median frame time (768x576, software GL) | 333 ms | 333-364 ms (runs ranged 0.83x to 1.09x, i.e. within noise) |
| Start-up texture drawing | 0 | about 85 ms on a desktop CPU (once) |
| Extra texture memory | 0 | about 11 MB (cobble colour + normal) |

Draw calls stay flat because the lamp posts, cores and caps are now instanced and the window halos and pools are one instanced draw each. Not measured: a real iPad or phone GPU. The costs that could matter there are the lit ground (one `MeshPhongMaterial` over the streets) and the additive halos and pools (fill rate); mist is turned off on touch devices.

## How to review

Open the game (Options → View: 3D) and walk the Lantern Quarter at night. The fixed camera comparisons are the three `*-before-after.jpg` files here.
