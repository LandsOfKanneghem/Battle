const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = {}; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../spellTargeting.js'), 'utf8'), ctx);
const edges = area => (ctx.getSpellAreaPaths(area).outline.match(/M/g) ?? []).length;
test('area contours omit internal edges and deduplicate cells', () => {
  const square = Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3) }));
  assert.equal(edges(square), 12);
  assert.equal(edges([...square, ...square]), 12);
  assert.equal(edges([{ x: 0, y: 0 }]), 4);
  assert.equal(edges([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]), 8);
});
test('disconnected areas and holes retain all outer boundaries', () => {
  assert.equal(edges([{ x: 0, y: 0 }, { x: 2, y: 0 }]), 8);
  const ring = Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3) })).filter(p => p.x !== 1 || p.y !== 1);
  assert.equal(edges(ring), 16);
  assert.equal(edges([]), 0);
});
