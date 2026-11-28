const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function setup() {
  const damage = [], labels = [];
  const ctx = {
    gameState: { effectOrder: 0, SIZE: 12, HEIGHT: 12, cells: Array(144).fill({}), entities: [],
      keyOf: point => `${point.x},${point.y}`, activeEntity() { return this.entities[0]; } },
    battleLog: { damage: (entity, hp, es) => damage.push([entity.id, hp, es]), miss() {}, applied() {} },
    playDamageAnimation: (cell, amount) => labels.push(amount),
    document: { createElementNS: () => ({ style: {}, setAttribute() {} }) }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);
  for (const file of [...scripts, 'combat.js', 'spellLogic.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  const make = (type, x) => {
    const entity = ctx.createCreature(type, { x, y: 1 });
    ctx.gameState.entities.push(entity);
    return entity;
  };
  const attacker = make('wolf', 1);
  const turtle = make('dragon-turtle', 2);
  const hit = { damage: 4, damageType: 'physical', abilityType: 'weapon-strike' };
  const deps = { ...ctx, stateTypes: vm.runInContext('stateTypes', ctx) };
  return { ctx, make, attacker, turtle, hit, damage, labels, deps };
}

test('every turtle has its own permanent unremovable shell, surviving removal and turn ticks', () => {
  const { ctx, make, attacker, turtle } = setup();
  const shell = turtle.states.find(state => state.id === 'sharp-shell');
  assert.ok(shell.permanent && shell.unremovable && !shell.suppressed);
  assert.equal(shell.duration, 0);
  assert.equal(shell.casterId, turtle.id);
  assert.equal(attacker.states.some(state => state.id === shell.id), false);
  assert.notEqual(shell, make('dragon-turtle', 3).states[0]);
  ctx.removeState(turtle, shell.id);
  for (let i = 0; i < 4; i++) ctx.tickCasterEffects(turtle.id);
  assert.ok(ctx.hasActiveState(turtle, shell.id));
  assert.equal(ctx.applyState(turtle, { id: shell.id, permanent: true }), false);
  assert.equal(turtle.states.filter(state => state.id === shell.id).length, 1);
});

test('real bite effect reflects once and produces damage logs and floating labels', () => {
  const { ctx, attacker, turtle, damage, labels, deps } = setup();
  const attackerHP = attacker.hp, turtleHP = turtle.hp;
  ctx.applySpellEffect({ ...attacker.availableSpells[0], bleedChance: 0 }, turtle.position, attacker, deps, null, true);
  assert.equal(turtle.hp, turtleHP - 2); // AC 2 reduces the bite; reflection ignores AC.
  assert.equal(attacker.hp, attackerHP - 3);
  assert.deepEqual(labels, [2, 3]);
  assert.deepEqual(damage, [[turtle.id, 2, 0], [attacker.id, 3, 0]]);
});

test('spells, abilities, ranged weapons and periodic damage do not reflect', () => {
  for (const patch of [
    { abilityType: 'spell' }, { abilityType: 'ability' },
    { isShot: true },
    { abilityType: undefined, damageType: 'fire' }
  ]) {
    const { ctx, attacker, turtle, hit } = setup();
    const hp = attacker.hp;
    ctx.applyDamage({ ...hit, ...patch }, turtle, attacker);
    assert.equal(attacker.hp, hp, JSON.stringify(patch));
  }
});

test('misses, zero raw damage and frozen targets cause no reflection', () => {
  const { ctx, attacker, turtle, hit, deps, damage } = setup();
  const hp = attacker.hp;
  deps.playMissAnimation = () => {};
  ctx.applySpellEffect(attacker.availableSpells[0], turtle.position, attacker, deps, null, false);
  assert.equal(damage.length, 0);
  assert.equal(turtle.armorSources[0].durability, 10, 'a missed weapon attack never wears armor');
  ctx.applyDamage({ ...hit, damage: 0 }, turtle, attacker);
  ctx.applyState(turtle, 'freeze', 2);
  ctx.applyDamage(hit, turtle, attacker);
  assert.equal(attacker.hp, hp);
  assert.equal(turtle.hp, turtle.maxHP);
});

test('armor and physical resistance can absorb a hit completely without cancelling shell contact', () => {
  for (const resistance of [0, 10]) {
    const { ctx, attacker, turtle, hit, damage } = setup();
    turtle.physical = resistance;
    const hp = attacker.hp;
    ctx.applyDamage({ ...hit, damage: 2 }, turtle, attacker);
    assert.equal(turtle.hp, turtle.maxHP);
    assert.equal(attacker.hp, hp - 3);
    assert.deepEqual(damage, [[turtle.id, 0, 0], [attacker.id, 3, 0]]);
  }
});

test('reflected damage respects physical protection and freeze, and bypasses ES as physical damage', () => {
  for (const protection of [0, 1, 3]) {
    const { ctx, attacker, turtle, hit } = setup();
    const hp = attacker.hp;
    attacker.physical = protection;
    attacker.baseES = 10;
    ctx.applyDamage(hit, turtle, attacker);
    assert.equal(attacker.hp, hp - (3 - protection));
    assert.equal(attacker.baseES, 10);
  }
  const { ctx, attacker, turtle, hit } = setup();
  ctx.applyState(attacker, 'freeze', 2);
  const hp = attacker.hp;
  ctx.applyDamage(hit, turtle, attacker);
  assert.equal(attacker.hp, hp);
});

test('two shells do not recurse; reflected damage is not reduced by Weakness or Exhaustion', () => {
  const { ctx, make, turtle, hit, damage } = setup();
  const attacker = make('dragon-turtle', 3);
  ctx.applyState(turtle, 'weakness', 2);
  ctx.applyState(turtle, 'exhaustion', 2);
  const hp = attacker.hp, targetHP = turtle.hp;
  ctx.applyDamage(hit, turtle, attacker);
  assert.equal(attacker.hp, hp - 3);
  assert.equal(turtle.hp, targetHP - 2);
  assert.equal(damage.length, 2);
});

test('lethal incoming hits still reflect and reflection can kill the attacker', () => {
  const { ctx, attacker, turtle, hit } = setup();
  turtle.hp = 1;
  attacker.hp = 2;
  ctx.applyDamage(hit, turtle, attacker);
  assert.equal(turtle.hp, 0);
  assert.equal(attacker.hp, 0);
});

test('suppressed shells, dead targets, missing sources and self-damage cannot reflect', () => {
  for (const mode of ['suppressed', 'dead', 'no-source', 'self']) {
    const { ctx, attacker, turtle, hit, damage } = setup();
    if (mode === 'suppressed') turtle.states[0].suppressed = true;
    if (mode === 'dead') turtle.hp = 0;
    const hp = attacker.hp;
    ctx.applyDamage(hit, turtle, mode === 'no-source' ? null : mode === 'self' ? turtle : attacker);
    assert.equal(attacker.hp, hp);
    assert.equal(damage.length, 1);
  }
});
