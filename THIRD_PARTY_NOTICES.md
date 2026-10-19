# Third-party notices

## Icons — unity-ui-toolkit-design-system

The icons in `icons.js` come from https://github.com/sinanata/unity-ui-toolkit-design-system (fills changed to `currentColor`).

```
MIT License

Copyright (c) 2026 Sinan Ata / Leap of Legends (https://leapoflegends.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


## Sounds — Kenney (CC0)

The files in `audio/` come from Kenney's RPG Audio, Interface Sounds and Music Jingles packs (https://kenney.nl), converted to AAC. Licence: Creative Commons Zero (CC0), public domain — no attribution required; credited here anyway.


## 3D engine — Three.js r169 (MIT)

`vendor/three/three.module.min.js` is Three.js 0.169.0 from https://github.com/mrdoob/three.js (npm package `three`), unmodified. It draws the 3D view in `render3d.js`. Its licence is also in `vendor/three/LICENSE`.

```
The MIT License

Copyright © 2010-2024 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

`vendor/three/addons/GLTFLoader.js` and `vendor/three/addons/BufferGeometryUtils.js` come from the same Three.js 0.169.0 package (`examples/jsm/`, MIT, same licence as above). The only change is their import lines, which point at `../three.module.min.js` and `./BufferGeometryUtils.js` so they load without an import map.


## 3D models — Polygonal Mind (CC0)

`models/props.glb` is built from models by [Polygonal Mind](https://www.polygonalmind.com), released under Creative Commons Zero (CC0 1.0, public domain). Found through the [Open Source 3D Assets](https://github.com/toxsam/open-source-3D-assets) registry and taken from https://github.com/ToxSam/cc0-models-Polygonal-Mind:

- `medieval-fair`: `Booth_Food02`, `Booth_Pretzelgame`, `Booth_Wearables`, `Table_Dinner`, `Barrel_Beer_Mountain`, `SmallBarrel_Art`
- `ca-world`: `Stool_01`

Changes: merged into one file, normal/roughness maps removed, colour textures shrunk to 256 px WebP, and geometry quantized (with gltf-transform). No attribution is required; credited here anyway.

