const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function setup(targetType = 'wizard') {
  const ctx = {
    gameState: { SIZE: 12, HEIGHT: 12, effectOrder: 0, entities: [], terrain: new Map(), obstacles: new Map(),
      cells: Array.from({ length: 144 }, () => ({ appendChild() {} })), effectBadges: [],
      keyOf: point => `${point.x},${point.y}`, isWater: type => ['deep-water', 'shallow-water'].includes(type),
      activeEntity() { return this.entities[0]; } },
    document: { getElementById: () => ({}), createElementNS: () => ({ style: {}, setAttribute() {} }), createElement: () => ({ classList: { add() {} } }) },
    renderPosition() {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const fixtureState = ctx.gameState;
  vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), ctx);
  Object.assign(ctx.gameState, fixtureState);
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);
  for (const file of [...scripts, 'combat.js', 'spellTargeting.js', 'spellLogic.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  const state = ctx.gameState;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) state.terrain.set(`${x},${y}`, 'grass');
  const caster = ctx.createCreature('giant-toad', { x: 5, y: 5 });
  const target = ctx.createCreature(targetType, { x: 9, y: 5 });
  state.entities.push(caster, target);
  const spell = caster.availableSpells[0];
  const deps = { ...ctx, stateTypes: vm.runInContext('stateTypes', ctx) };
  const point = () => JSON.parse(JSON.stringify(ctx.getTonguePullDestination(caster, target)));
  const apply = () => ctx.applySpellEffect(spell, target.position, caster, deps);
  return { ctx, state, caster, target, spell, deps, point, apply };
}

test('tongue has the requested costs, STR damage, fixed range and no weapon hit or spell failure flags', () => {
  const { ctx, caster, spell } = setup();
  assert.equal(spell.abilityType, 'weapon-strike');
  assert.equal(spell.target, 'any');
  assert.equal(spell.apCost, 3);
  assert.equal(spell.maxCooldown, 1);
  assert.equal(spell.isAOE, false);
  assert.equal(spell.minRange, 1);
  assert.equal(spell.noLOS, false);
  assert.equal(spell.modifiable, false);
  assert.ok(!spell.isShot && !spell.isHit);
  caster.ra = 100;
  assert.equal(ctx.effectiveSpellRange(spell, caster), 6);
  assert.equal(ctx.getSpellDamage(spell, caster), 9);
});

test('exact diagonals move one diagonal cell; dominant axes stay fixed for both steps', () => {
  for (const [from, expected] of [
    [[8, 8], [7, 7]], [[2, 2], [3, 3]], [[8, 2], [7, 3]], [[2, 8], [3, 7]],
    [[9, 7], [7, 7]], [[1, 3], [3, 3]], [[7, 9], [7, 7]], [[3, 1], [3, 3]],
    [[9, 5], [7, 5]], [[5, 9], [5, 7]], [[7, 6], [5, 6]], [[6, 7], [6, 5]]
  ]) {
    const { target, point } = setup();
    target.position = { x: from[0], y: from[1] };
    assert.deepEqual(point(), { x: expected[0], y: expected[1] }, JSON.stringify(from));
  }
});

test('close targets never enter or cross the caster cell', () => {
  for (const [from, expected] of [
    [[6, 5], [6, 5]], [[6, 6], [6, 6]], [[7, 5], [6, 5]], [[5, 7], [5, 6]]
  ]) {
    const { target, point } = setup();
    target.position = { x: from[0], y: from[1] };
    assert.deepEqual(point(), { x: expected[0], y: expected[1] });
  }
});

test('each intermediate cell blocks pulling: crates, living creatures and both water types', () => {
  for (const kind of ['crate', 'creature', 'deep-water', 'shallow-water']) {
    for (const x of [8, 7]) {
      const { ctx, state, target, point } = setup();
      if (kind === 'crate') state.obstacles.set(`${x},5`, 'crate');
      else if (kind === 'creature') state.entities.push(ctx.createCreature('monk', { x, y: 5 }));
      else state.terrain.set(`${x},5`, kind);
      assert.deepEqual(point(), { x: x === 8 ? 9 : 8, y: 5 }, `${kind} at ${x}`);
      assert.deepEqual(JSON.parse(JSON.stringify(target.position)), { x: 9, y: 5 }, 'planning has no side effects');
    }
  }
});

test('enemies take STR physical damage after moving; allied targets only move, for either team', () => {
  for (const targetType of ['wizard', 'monk', 'wolf', 'giant-toad']) {
    const { caster, target, apply } = setup(targetType);
    const hp = target.hp, mp = target.mp, ap = target.ap;
    apply();
    assert.deepEqual(JSON.parse(JSON.stringify(target.position)), { x: 7, y: 5 });
    assert.equal(target.hp, hp - (['wizard', 'monk'].includes(targetType) ? 9 : 0));
    assert.equal(target.mp, mp);
    assert.equal(target.ap, ap);
    assert.equal(caster.hp, caster.maxHP);
  }
  const { ctx, state, target, spell, deps } = setup('monk');
  const player = ctx.createCreature('wizard', { x: 5, y: 5 });
  state.entities[0] = player;
  const hp = target.hp;
  ctx.applySpellEffect(spell, target.position, player, deps);
  assert.equal(target.hp, hp);
  assert.equal(target.position.x, 7);
});

test('damage still applies when movement is blocked, with Weakness and physical resistance', () => {
  const { ctx, state, caster, target, apply } = setup();
  state.obstacles.set('8,5', 'crate');
  target.physical = 1;
  ctx.applyState(caster, 'weakness', 2);
  const hp = target.hp;
  apply();
  assert.equal(target.position.x, 9);
  assert.equal(target.hp, hp - 6); // floor((4 + 5 STR) * .8) - 1 physical
});

test('range 1 through 6 requires a living target and LOS before any cast payment', () => {
  const { ctx, state, caster, target, spell } = setup();
  caster.position = { x: 4, y: 4 };
  for (const [x, expected] of [[4, false], [5, true], [10, true], [11, false]]) {
    target.position = { x, y: 4 };
    assert.equal(ctx.canTarget(target.position, spell), expected, `distance ${x - 4}`);
  }
  target.position = { x: 8, y: 4 };
  state.obstacles.set('6,4', 'crate');
  assert.equal(ctx.canTarget(target.position, spell), false);
  state.obstacles.clear();
  state.entities.push(ctx.createCreature('wolf', { x: 6, y: 4 }));
  assert.equal(ctx.canTarget(target.position, spell), false);
  state.entities.pop();
  target.hp = 0;
  assert.equal(ctx.canTarget(target.position, spell), false);
  assert.equal(ctx.canTarget({ x: 4, y: 5 }, spell), false);
});

test('preview shows enemy damage and no damage badge on allied targets', () => {
  for (const type of ['wizard', 'wolf']) {
    const { ctx, state, target, spell } = setup(type);
    ctx.altHeld = true;
    ctx.showEffectPreview([target.position], spell);
    assert.equal(state.effectBadges.length, type === 'wizard' ? 1 : 0);
    if (type === 'wizard') assert.ok(state.effectBadges[0].textContent.startsWith('Урон: 9 [Крит: 9]'));
  }
});

test('tongue has no melee hit flag and does not trigger Sharp Shell retaliation', () => {
  const { ctx, state, target, spell, deps } = setup('dragon-turtle');
  const player = ctx.createCreature('wizard', { x: 5, y: 5 });
  state.entities[0] = player;
  const hp = player.hp, targetHP = target.hp;
  ctx.applySpellEffect(spell, target.position, player, deps);
  assert.equal(target.hp, targetHP - 4);
  assert.equal(player.hp, hp);
});
