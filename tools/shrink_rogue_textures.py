"""Shrink the playable ZAY model's textures in place, so the game loads faster.

Usage: python3 tools/shrink_rogue_textures.py [models/zay/shadow-rogue.glb]
Requires Pillow. Reads and rewrites only the given GLB; nothing else changes.

What it does (the mesh, skeleton, skin weights, tangents and animations are copied byte for byte):
  - the tangent-space normal map: lossless PNG at 2048 x 2048  ->  JPEG (quality 92) at 1024 x 1024
  - the packed roughness/metallic map: PNG  ->  JPEG (quality 92), same size
  - the base colour map is already a JPEG and is left alone, so faces and leather keep their full detail.
Running it twice does nothing the second time (only PNG images are converted).
tools/prepare_rogue.py writes the same formats when the model is rebuilt from the original pack.
"""
import io, json, pathlib, struct, sys
from PIL import Image

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[1] / 'models/zay/shadow-rogue.glb')
raw = path.read_bytes()
magic, version, _ = struct.unpack_from('<4sII', raw, 0)
assert magic == b'glTF' and version == 2, 'not a glTF 2.0 binary'
jlen, jtype = struct.unpack_from('<I4s', raw, 12)
assert jtype == b'JSON'
g = json.loads(raw[20:20 + jlen])
blen, btype = struct.unpack_from('<I4s', raw, 20 + jlen)
assert btype == b'BIN\x00'
binary = raw[28 + jlen:28 + jlen + blen]

SIZES = {'Shadow tangent-space normal': 1024}   # longest side after shrinking; others keep their size
replace = {}
for im in g['images']:
    if im.get('mimeType') != 'image/png':
        continue
    v = g['bufferViews'][im['bufferView']]
    pic = Image.open(io.BytesIO(binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])).convert('RGB')
    if im.get('name') in SIZES:
        pic.thumbnail((SIZES[im['name']],) * 2, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    pic.save(out, format='JPEG', quality=92, subsampling=0, optimize=True)   # no colour subsampling: keeps normal and ORM channels apart
    replace[im['bufferView']] = out.getvalue()
    im['mimeType'] = 'image/jpeg'
    print(f"{im.get('name')}: {v['byteLength']:,} -> {len(replace[im['bufferView']]):,} bytes ({pic.width}x{pic.height})")

if not replace:
    sys.exit('nothing to shrink (no PNG images left)')

# Re-pack every buffer view in order, 4-byte aligned, so no dead bytes are left behind.
buf = bytearray()
for i, v in enumerate(g['bufferViews']):
    data = replace.get(i, binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])
    v['byteOffset'] = len(buf); v['byteLength'] = len(data)
    buf.extend(data); buf.extend(b'\0' * (-len(buf) % 4))
g['buffers'][0]['byteLength'] = len(buf)

js = json.dumps(g, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
total = 12 + 8 + len(js) + 8 + len(buf)
path.write_bytes(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(buf), b'BIN\x00') + bytes(buf))
print(f'{path.name}: {len(raw):,} -> {total:,} bytes')
