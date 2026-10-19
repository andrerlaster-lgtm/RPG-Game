# Making the characters with MPFB2 (Blender)

How to make real 3D characters for the game (ZAY, Noe, Severin, the guards and the townsfolk) to replace the placeholder shape figures. You do the Blender part on your Mac; Claude does the rest (shrinking the files for phones, animation, putting them in the game).

**Licence:** the people MPFB2 makes are yours to use freely. Its assets are CC0, and the MakeHuman team claims nothing over exported files. We'll credit it in `THIRD_PARTY_NOTICES.md` anyway.

Menu names below come from MPFB 2's own code. If something is called slightly differently on your version, look for the closest match.

---

## 1. One-time setup (about 15 minutes)

1. **Install Blender 4.2 or newer** from https://www.blender.org/download/ (free).
2. **Install MPFB:** in Blender, go to *Edit → Preferences → Get Extensions*, search **MPFB**, then click *Install*.
3. **Get the body assets.** MPFB needs the free "system assets" pack (skins, eyes, hair, clothes):
   - Download the zip from https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
   - In Blender, press **N** to open the side panel and click the **MPFB** tab.
   - In **System and resources**, click **Load pack from zip file** and choose the zip.
   - Optional: other packs from https://static.makehumancommunity.org/assets/assetpacks.html add more clothes and hair. Stick to the ones marked CC0.

## 2. Make one character

Do ZAY first so we can test the whole pipeline before making the others.

1. **New human → From scratch → Create human.**
2. **Model** panel: set the body.
   - *Macrodetails*: gender, age, muscle, weight, height. ZAY is a lean young man and a performer, so give him low weight and medium-high muscle.
   - The race/ethnicity sliders give skin tone and face shape. Match your model sheet.
3. **Apply assets** panel:
   - **Skin:** pick a skin that matches the model sheet.
   - **Eyes:** pick the closest colour. ZAY's are gold, Noe's brown-gold, Severin's pale silver. Claude can tint them in the game if none match.
   - **Hair:** pick the closest. Locs (ZAY's ponytail, Severin's grey locs) may not be in the free pack; any similar hair works, and Claude can recolour it.
   - **Clothes:** a long coat, shirt, trousers and boots for ZAY. Anything close is fine, because colours can be changed in the game.
   - **Proxy / topology (important):** if the panel offers a *proxy* or low-poly body, choose it. Phones need each character to stay small: about 5,000–15,000 triangles.
4. **Rigging → Standard rig → Add standard rig**, and choose **Game engine** as the rig type. It's the light skeleton meant for games, and the animations will drive it.
5. **Skip:** the katana, tail and ledger (Claude adds those in the game), and posing or animating (also done in the game).

## 3. Export

1. Select the human: the body, its clothes, hair and eyes, and the rig. Clicking the rig and pressing **A** in the viewport selects everything.
2. Optional: **Create export copy** (in MPFB's operations) bakes everything into a clean copy. Use it if the export looks wrong.
3. **File → Export → glTF 2.0 (.glb)** with these settings:
   - *Include:* **Selected Objects**.
   - *Mesh:* **Apply Modifiers** on.
   - *Animation:* off. Claude adds animation.
   - *Compression:* off. Claude compresses the files.
4. Name the file after the character, for example `zay.glb`, and upload it to the chat.

## 4. The cast list

| File | Who | Notes from the model sheet / canon |
|---|---|---|
| `zay.glb` | ZAY | Lean performer. Long charcoal coat over a tan shirt, locs in a ponytail, gold eyes. |
| `noe.glb` | Noe | Cream blouse, dark corset, curls, brown-gold eyes. |
| `severin.glb` | Severin | Dark embroidered clothes, grey locs, pale silver eyes. He's seated in the Halo. |
| `guard.glb` | Veyrane guard | One body is enough. The game recolours it for guards, the captain, the city watch and the collector's escort. |
| `local.glb` | Townsperson | One or two bodies. The game recolours them for passers-by, patrons and marks. |

ZAY alone is enough to start.

## 5. What happens next (Claude's part)

- Shrink each file for phones: smaller textures, compressed geometry.
- Add walk, run, idle and takedown animations. These would come from a CC0 animation set for the Game engine rig (still to be found). If none is available, they'd be built in the game's own code.
- Add ZAY's tail, katana and the ledger, plus the guards' helmets and lanterns.
- Swap them in for the placeholder figures, keeping the Classic view and battles as they are.
