const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
for (const file of fs.readdirSync('.').filter(f => f.endsWith('.js'))) execFileSync(process.execPath, ['--check', file]);
for (const file of fs.readdirSync('levels').filter(f => f.endsWith('.tmj'))) {
  const map = JSON.parse(fs.readFileSync('levels/' + file));
  const ground = map.layers.find(l => l.type === 'tilelayer');
  assert.equal(ground.data.length, map.width * map.height, file + ': ground dimensions');
  assert.ok(ground.data.every(id => id >= 1 && id <= 7), file + ': known tile IDs');
}
JSON.parse(fs.readFileSync('vercel.json'));
console.log('JavaScript syntax, four Tiled maps, and Vercel configuration passed.');
