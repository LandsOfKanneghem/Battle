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
  for (const flags of [{ isShot: false }, { isShot: true }, {}]) {
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
  for (const flags of [{ abilityType: 'spell' }, { abilityType: 'ability' }, {}]) {
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
  assert.deepEqual([...names].sort(), ['bite', 'boulder-smash', 'boulder-throw', 'maiming-strike', 'poison-bite', 'sword-strike', 'tongue-pull']);
});

test('armor sources are independent per creature and reset to full durability at creation', () => {
  const { ctx } = setup();
  const first = ctx.createCreature('dragon-turtle', { x: 1, y: 1 });
  const second = ctx.createCreature('dragon-turtle', { x: 2, y: 1 });
  assert.equal(first.armorSources[0].durability, 10);
  assert.equal(first.armorSources[0].maxDurability, 10);
  assert.equal(ctx.getEffectiveStat(first, 'ac'), 2);
  first.armorSources[0].durability = 0;
  assert.equal(ctx.getEffectiveStat(first, 'ac'), 0);
  assert.equal(second.armorSources[0].durability, 10);
  assert.equal(ctx.CREATURE_TEMPLATES['dragon-turtle'].armorSources[0].durability, undefined);
  assert.equal(ctx.createCreature('dragon-turtle', { x: 3, y: 1 }).armorSources[0].durability, 10);
  assert.deepEqual(Array.from(ctx.createCreature('wolf', { x: 4, y: 1 }).armorSources), []);
});

test('all sources lose durability on blocked weapon hits and break independently after that hit', () => {
  const { ctx } = setup();
  ctx.CREATURE_TEMPLATES.wizard.armorSources = [
    { id: 'body', ac: 3, maxDurability: 10 }, { id: 'shield', ac: 1, maxDurability: 5 }
  ];
  const target = ctx.createCreature('wizard', { x: 1, y: 1 }); target.hp = 100;
  const hit = { damage: 4, damageType: 'physical', abilityType: 'weapon-strike', isShot: true };
  for (let i = 0; i < 5; i++) ctx.applyDamage(hit, target);
  assert.equal(target.hp, 100, 'the breaking hit is still protected by AC 4');
  assert.deepEqual(Array.from(target.armorSources, source => source.durability), [5, 0]);
  assert.equal(ctx.getEffectiveStat(target, 'ac'), 3);
  assert.equal(ctx.spellDamage(hit, target), 1);
  assert.deepEqual(Array.from(target.armorSources, source => source.durability), [5, 0], 'preview never wears armor');
  for (let i = 0; i < 5; i++) ctx.applyDamage(hit, target);
  assert.equal(target.hp, 95);
  assert.equal(ctx.getEffectiveStat(target, 'ac'), 0);
  assert.equal(target.armorSources.length, 2);
  assert.deepEqual(Array.from(target.armorSources, source => source.durability), [0, 0]);
  assert.deepEqual(Array.from(target.armorSources, source => source.maxDurability), [10, 5]);
  ctx.applyDamage(hit, target);
  assert.equal(target.hp, 91);
});

test('broken sources keep floor(25% AC), indestructible sources never wear', () => {
  const { ctx } = setup();
  ctx.CREATURE_TEMPLATES.wizard.armorSources = [
    { id: 'body', ac: 7, maxDurability: 1 },
    { id: 'shield', ac: 4, maxDurability: 1, indestructible: true }
  ];
  const target = ctx.createCreature('wizard', { x: 1, y: 1 });
  ctx.applyDamage({ damage: 1, damageType: 'physical', abilityType: 'weapon-strike' }, target);
  assert.equal(ctx.getEffectiveStat(target, 'ac'), 5); // floor(7/4) + 4
  assert.deepEqual(Array.from(target.armorSources, source => source.durability), [0, 1]);
});

test('spells, reflection and immunity do not spend armor durability', () => {
  const { ctx } = setup();
  const target = ctx.createCreature('dragon-turtle', { x: 1, y: 1 });
  for (const flags of [{ abilityType: 'spell' }, { abilityType: 'ability' }, {}]) {
    ctx.applyDamage({ damage: 1, damageType: 'physical', ...flags }, target);
  }
  assert.equal(target.armorSources[0].durability, 10);
  ctx.applyState(target, 'freeze', 2);
  ctx.applyDamage({ damage: 10, damageType: 'physical', abilityType: 'weapon-strike' }, target);
  assert.equal(target.armorSources[0].durability, 10);
});
