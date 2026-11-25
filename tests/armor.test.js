const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function setup() {
  const ctx = { document: { createElementNS: () => ({ style: {}, setAttribute() {} }) },
    gameState: { entities: [], effectOrder: 0, SIZE: 12, cells: Array(144).fill({}), activeEntity() { return this.entities[0]; } } };
  ctx.window = ctx; vm.createContext(ctx);
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);
  for (const file of [...scripts, 'combat.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  const target = ctx.createCreature('wizard', { x: 5, y: 5 });
  target.ac = 3; target.physical = 2; target.baseES = 10;
  ctx.gameState.entities.push(target);
  return { ctx, target };
}

test('physical weapon damage combines AC and physical resistance in preview and actual damage', () => {
  const { ctx, target } = setup();
  for (const flags of [{ isHit: true }, { isShot: true }, {}]) {
    const attack = { damage: 10, damageType: 'physical', abilityType: 'weapon-strike', ...flags };
    const hp = target.hp;
    assert.equal(ctx.spellDamage(attack, target), 5);
    ctx.applyDamage(attack, target);
    assert.equal(target.hp, Math.max(0, hp - 5));
    assert.equal(target.baseES, 10, 'physical damage bypasses ES');
  }
  assert.equal(ctx.spellDamage({ damage: 4, damageType: 'physical', abilityType: 'weapon-strike' }, target), 0);
});

test('non-weapon physical damage ignores AC but keeps physical resistance', () => {
  const { ctx, target } = setup();
  for (const flags of [{ abilityType: 'spell' }, { abilityType: 'ability', isHit: true }, {}]) {
    const attack = { damage: 10, damageType: 'physical', ...flags };
    assert.equal(ctx.spellDamage(attack, target), 8);
  }
  assert.equal(ctx.spellDamage({ damage: 3, damageType: 'physical' }, target), 1, 'shell reflection is physical, not a weapon hit');
  target.baseES = 0;
  assert.equal(ctx.spellDamage({ damage: 10, damageType: 'fire', abilityType: 'weapon-strike' }, target), 10);
});

test('effective armor and resistance bonuses stack before damage is clamped', () => {
  const { ctx, target } = setup();
  ctx.applySpellOnEntity(target, { id: 'armor-test', name: 'Защита', duration: 2, modifiers: { ac: 2, physical: 1 } });
  assert.equal(ctx.spellDamage({ damage: 10, damageType: 'physical', abilityType: 'weapon-strike' }, target), 2);
  assert.equal(ctx.spellDamage({ damage: 10, damageType: 'physical', abilityType: 'spell' }, target), 7);
});

test('every current creature weapon attack receives AC mitigation, including ranged and tongue attacks', () => {
  const { ctx, target } = setup();
  const names = new Set();
  for (const [type, template] of Object.entries(ctx.CREATURE_TEMPLATES)) {
    const caster = ctx.createCreature(type, { x: 1, y: 1 });
    for (const attack of template.spells ?? []) {
      if (attack.abilityType !== 'weapon-strike' || attack.damageType !== 'physical') continue;
      const damage = ctx.getSpellDamage(attack, caster);
      assert.equal(ctx.spellDamage({ ...attack, damage }, target), Math.max(0, damage - 5), `${type}: ${attack.name}`);
      names.add(attack.id);
    }
  }
  assert.deepEqual([...names].sort(), ['bite', 'boulder-smash', 'boulder-throw', 'tongue-pull']);
});
