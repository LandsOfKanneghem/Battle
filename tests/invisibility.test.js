const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  const element = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {},
    classList: { add() {}, remove() {} } });
  const ctx = { document: { getElementById: () => element(), createElement: element, createElementNS: element },
    setTimeout() {}, renderPosition() {}, updatePanel() {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);
  for (const file of ['gameState.js', ...scripts, 'combat.js', 'spellTargeting.js', 'spellLogic.js', 'movement.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  require('./fixtures/trained-heroes.cjs')(ctx);
  const state = ctx.gameState;
  state.cells = Array.from({ length: 144 }, element);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) state.terrain.set(`${x},${y}`, 'grass');
  const wizard = ctx.createCreature('wizard', { x: 1, y: 1 });
  const shadow = ctx.createCreature('shadow', { x: 3, y: 1 });
  const monk = ctx.createCreature('monk', { x: 8, y: 8 });
  state.entities = [wizard, shadow, monk];
  state.activeEntityId = wizard.id;
  const hide = entity => ctx.applyState(entity, { id: 'invisibility', duration: 2, casterId: entity.id, casterName: entity.name });
  const deps = { ...ctx, stateTypes: vm.runInContext('stateTypes', ctx), shotHits: () => true, playMissAnimation() {} };
  const spell = id => vm.runInContext(`SPELL_DEFINITIONS.find(spell => spell.id === '${id}')`, ctx);
  return { ctx, state, wizard, shadow, monk, hide, deps, spell };
}

for (const [id, stateId] of [['slow', 'slowness'], ['apply-old-age', 'old-age'], ['dead-weight', 'heavy'], ['deep-freeze', 'freeze']]) {
  for (const targetKind of ['empty', 'ally', 'hidden-enemy']) {
    test(`${id}: paid cast on ${targetKind}, effects follow target type`, () => {
      const { ctx, state, wizard, shadow, monk, hide, deps, spell } = setup();
      const debuff = wizard.availableSpells.find(item => item.id === id)
        ?? { ...spell(id), cooldown: 0, usesThisTurn: 0, usesTotal: 0 };
      if (!wizard.availableSpells.includes(debuff)) wizard.availableSpells.push(debuff);
      monk.position = { x: 2, y: 2 };
      hide(shadow); wizard.ap = 100;
      const target = targetKind === 'empty' ? { x: 1, y: 3 } : targetKind === 'ally' ? monk.position : shadow.position;
      state.preparedSpellId = id;
      assert(ctx.canTarget(target, debuff));
      assert.equal(ctx.isSpellPreviewTarget(targetKind === 'ally' ? monk : shadow, debuff, wizard, target), id === 'dead-weight' && targetKind === 'ally');
      const allyStates = plain(monk.states), casterStates = plain(wizard.states);
      const cell = { dataset: { x: target.x, y: target.y } };
      assert(ctx.castSpell(cell, { ...deps, setTimeout: callback => callback(), queueMicrotask: callback => callback(),
        removeDefeatedEntities() {}, playStateAnimation() {}, playOldAgeAnimation() {} }));
      assert.equal(wizard.ap, 100 - debuff.apCost);
      assert.equal(debuff.cooldown, debuff.maxCooldown);
      assert.equal(debuff.usesThisTurn, 1);
      if (id === 'dead-weight' && targetKind === 'ally') assert(ctx.hasActiveState(monk, 'heavy'));
      else assert.deepEqual(plain(monk.states), allyStates);
      assert.deepEqual(plain(wizard.states), casterStates);
      assert.equal(ctx.hasActiveState(shadow, stateId), targetKind === 'hidden-enemy');
      assert(state.isHiddenFromPlayer(shadow));
    });
  }
}

test('visibility is relative to teams and respects suppression and expiry', () => {
  const { ctx, state, wizard, shadow, monk, hide } = setup();
  hide(shadow); hide(monk);
  assert.equal(state.isHiddenFrom(shadow, wizard), true);
  assert.equal(state.isHiddenFrom(monk, wizard), false);
  assert.equal(state.isHiddenFrom(monk, shadow), true);
  assert.equal(state.isHiddenFromPlayer(monk), false);
  assert.equal(state.isHiddenFromPlayer(shadow), true);
  shadow.states[0].suppressed = true;
  assert.equal(state.isHiddenFromPlayer(shadow), false);
  shadow.states[0].suppressed = false;
  ctx.tickCasterEffects(shadow.id);
  assert.equal(state.isHiddenFromPlayer(shadow), true);
  ctx.tickCasterEffects(shadow.id);
  assert.equal(state.isHiddenFromPlayer(shadow), false);
});

test('path preview ignores hidden enemies, while real occupancy still blocks teleport/summon/forced movement', () => {
  const { ctx, state, wizard, shadow, hide } = setup();
  const target = { x: 5, y: 1 };
  const emptyPath = ctx.buildPath(wizard.position, target, wizard);
  hide(shadow);
  const path = ctx.buildPath(wizard.position, target, wizard);
  assert.deepEqual(plain(path), [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, target]);
  assert.equal(emptyPath.length > path.length, true);
  assert.equal(state.isFree(shadow.position, wizard), false);
  assert.equal(state.isFree(shadow.position, wizard, true), true);
  assert.equal(ctx.buildPath(wizard.position, shadow.position, wizard).length, 2);
  state.obstacles.set('2,1', 'crate');
  assert.equal(ctx.buildPath(wizard.position, target, wizard).some(p => p.x === 2 && p.y === 1), false);
});

test('walking follows the planned path until collision and charges only completed steps', () => {
  const { ctx, state, wizard, shadow, hide } = setup();
  hide(shadow);
  const messages = [], labels = [];
  ctx.battleLog = { blocked: () => messages.push('blocked') };
  ctx.playBarrierAnimation = cell => labels.push(cell);
  state.stepQueue = ctx.buildPath(wizard.position, { x: 5, y: 1 }, wizard);
  state.isMoving = true;
  const mp = wizard.mp;
  ctx.takeStep();
  assert.deepEqual(plain(wizard.position), { x: 2, y: 1 });
  assert.equal(wizard.mp, mp - 1);
  ctx.takeStep();
  assert.deepEqual(plain(wizard.position), { x: 2, y: 1 });
  assert.equal(wizard.mp, mp - 1);
  assert.equal(state.isMoving, false);
  assert.equal(state.stepQueue.length, 0);
  assert.deepEqual(messages, ['blocked']);
  assert.equal(labels[0], state.cells[14]);
  // Clicking the adjacent occupied cell again does not consume any MP.
  state.stepQueue = ctx.buildPath(wizard.position, shadow.position, wizard);
  state.isMoving = true;
  ctx.takeStep();
  assert.equal(wizard.mp, mp - 1);
  assert.equal(messages.length, 2);
});

test('invisible enemies have no damage preview but receive direct, state and area effects', () => {
  const { ctx, state, wizard, shadow, monk, hide, deps, spell } = setup();
  hide(shadow);
  const fire = spell('fire-shot');
  const area = [shadow.position, monk.position];
  ctx.altHeld = true;
  ctx.showEffectPreview(area, fire, shadow.position);
  assert.equal(state.effectBadges.length, 1, 'only the visible monk receives a preview');
  const before = shadow.hp;
  ctx.applySpellEffect(fire, shadow.position, wizard, deps, null, true);
  assert.equal(shadow.hp, before - ctx.getSpellDamage(fire, wizard));
  ctx.applySpellEffect(spell('slow'), shadow.position, wizard, deps);
  assert.equal(ctx.hasActiveState(shadow, 'slowness'), true);
  const cube = spell('fire-cube');
  const hp = shadow.hp;
  ctx.applySpellEffect(cube, { x: 3, y: 2 }, wizard, deps);
  assert.equal(shadow.hp < hp, true, 'AOE hits the hidden enemy off-center');
  assert.equal(ctx.hasActiveState(shadow, 'invisibility'), true);
});

test('casting a spell and using a weapon do not break invisibility', () => {
  const { ctx, shadow, wizard, hide, deps } = setup();
  hide(shadow);
  ctx.applySpellEffect(shadow.availableSpells[0], shadow.position, shadow, deps);
  ctx.applySpellEffect({ id: 'test-hit', abilityType: 'weapon-strike', damageBase: 1,
    damageType: 'physical', target: 'enemy', aoeSize: 1 }, wizard.position, shadow, deps, null, true);
  assert.equal(ctx.hasActiveState(shadow, 'invisibility'), true);
});

test('Sparks preview treats a hidden primary as empty while a real hit bounces only to non-invisible creatures', () => {
  const { ctx, state, wizard, shadow, monk, hide, deps, spell } = setup();
  wizard.position = { x: 0, y: 0 };
  shadow.position = { x: 4, y: 1 };
  monk.position = { x: 11, y: 11 };
  const visible = ctx.createCreature('wolf', { x: 4, y: 2 });
  const hidden = ctx.createCreature('specter', { x: 5, y: 1 });
  state.entities.push(visible, hidden);
  hide(shadow); hide(hidden);
  const sparks = spell('sparks');
  state.preparedSpellId = sparks.id;
  ctx.highlightSpellRange(shadow.position);
  assert.equal(state.highlightedCells.length, 1, 'no bounce cell when hovering a hidden primary');
  assert.equal(state.highlightedCells[0], state.cells[16]);
  assert.equal(state.effectBadges.length, 0);
  assert.deepEqual(plain(ctx.findSparkTargets(shadow, 3, 2, state.entities).map(e => e.id)), [visible.id]);
  const original = { primary: shadow.hp, secondary: visible.hp, hidden: hidden.hp };
  ctx.applySpellEffect(sparks, shadow.position, wizard, deps, null, true);
  assert.equal(shadow.hp, original.primary - 4);
  assert.equal(visible.hp, original.secondary - 2);
  assert.equal(hidden.hp, original.hidden);
  // A hidden creature is never used to fill a spare bounce slot.
  visible.hp = 0;
  assert.equal(ctx.findSparkTargets(shadow, 3, 2, state.entities).length, 0);
});

test('Sparks ignore invisible secondary targets in the preview and damage of a visible primary', () => {
  const { ctx, state, wizard, shadow, monk, hide, deps, spell } = setup();
  wizard.position = { x: 0, y: 0 };
  shadow.position = { x: 4, y: 1 };
  monk.position = { x: 4, y: 2 };
  hide(monk);
  const sparks = spell('sparks');
  state.preparedSpellId = sparks.id;
  ctx.highlightSpellRange(shadow.position);
  assert.equal(state.highlightedCells.length, 1);
  assert.equal(state.highlightedCells[0], state.cells[16]);
  const hp = monk.hp;
  ctx.applySpellEffect(sparks, shadow.position, wizard, deps, null, true);
  assert.equal(monk.hp, hp, 'even an invisible ally cannot receive an automatic bounce');
});

test('invisible creatures block neither LOS nor the fire cone, while crates, void and visible creatures still do', () => {
  const { ctx, state, wizard, shadow, hide, spell } = setup();
  const beyond = { x: 5, y: 1 };
  assert.equal(ctx.checkLOS(wizard.position, beyond), false);
  shadow.position = { x: 2, y: 1 };
  const area = () => ctx.affectedCells(shadow.position, spell('burning-hands'), wizard,
    state.entities, state.obstacles, state.terrain, state.keyOf, 12);
  assert.equal(area().length, 1);
  hide(shadow);
  assert.equal(ctx.checkLOS(wizard.position, beyond), true);
  assert.equal(area().length, 8);
  state.preparedSpellId = 'burning-hands';
  ctx.highlightSpellRange(shadow.position);
  assert.equal(state.highlightedCells.length, 8);
  for (const [collection, value] of [[state.obstacles, 'crate'], [state.terrain, 'void']]) {
    collection.set('2,1', value);
    assert.equal(ctx.checkLOS(wizard.position, beyond), false);
    if (collection === state.obstacles) collection.delete('2,1');
    else collection.set('2,1', 'grass');
  }
  shadow.states[0].suppressed = true;
  assert.equal(ctx.checkLOS(wizard.position, beyond), false);
});

for (const spellId of ['teleport', 'lake-spirit', 'future-empty-cell-spell']) {
  test(`${spellId} pays and fails on a concealed occupant, but pays nothing on a visible occupant`, () => {
    const { ctx, state, wizard, shadow, hide, deps } = setup();
    const spell = spellId === 'future-empty-cell-spell'
      ? { ...wizard.availableSpells.find(s => s.id === 'teleport'), id: spellId,
        isTeleport: false, requiresEmptyCell: true, maxUsesPerBattle: 1 }
      : wizard.availableSpells.find(s => s.id === spellId);
    if (spellId === 'future-empty-cell-spell') wizard.availableSpells.push(spell);
    state.preparedSpellId = spell.id;
    shadow.position = { x: 2, y: 1 };
    const targetCell = { dataset: { x: shadow.position.x, y: shadow.position.y } };
    const failures = [];
    const castDeps = { ...deps, playFailureAnimation: cell => failures.push(cell) };
    const initial = { ap: wizard.ap, scc: wizard.spellCastCount, position: plain(wizard.position), count: state.entities.length };
    assert.equal(ctx.castSpell(targetCell, castDeps), false);
    assert.equal(wizard.ap, initial.ap);
    assert.equal(spell.cooldown, 0);
    hide(shadow);
    assert.equal(ctx.castSpell(targetCell, castDeps), true);
    assert.equal(wizard.ap, initial.ap - spell.apCost);
    assert.equal(wizard.spellCastCount, initial.scc + 1);
    assert.equal(spell.cooldown, spell.maxCooldown);
    assert.equal(spell.usesThisTurn, 1);
    if (spell.maxUsesPerBattle !== undefined) assert.equal(spell.usesTotal, 1);
    assert.deepEqual(plain(wizard.position), initial.position);
    assert.equal(state.entities.length, initial.count, 'no creature is summoned');
    assert.deepEqual(failures, [targetCell]);
    assert.equal(state.preparedSpellId, null);
    assert.equal(state.isCasting, false);
  });
}

test('Spectral Strike uses INT, dark magical damage and no shot/evasion checks, and preserves invisibility', () => {
  const { ctx, state, wizard, shadow, hide, deps } = setup();
  const strike = shadow.availableSpells.find(spell => spell.id === 'spectral-strike');
  assert.equal(strike.name, 'Спектральный удар');
  for (const [key, value] of Object.entries({ abilityType: 'spell', magicSchool: 'dark',
    damageType: 'dark', damageBase: 6, damagePerInt: 1, isShot: false,
    target: 'any', minRange: 1, range: 4, modifiable: false, noLOS: false,
    apCost: 3, maxCooldown: 0, maxUsesPerTurn: 2, isAOE: false, aoeSize: 1 })) {
    assert.equal(strike[key], value, key);
  }
  assert.equal(ctx.getSpellDamage(strike, shadow), 8);
  shadow.attributes.int = 10;
  assert.equal(ctx.getSpellDamage(strike, shadow), 16);
  shadow.attributes.int = 2;
  wizard.eva = 1000;
  wizard.baseES = 3;
  const hp = wizard.hp;
  hide(shadow);
  ctx.applySpellEffect(strike, wizard.position, shadow, {
    ...deps, shotHits() { throw new Error('Spectral Strike must not roll accuracy'); }
  });
  assert.equal(wizard.hp, hp - 5, 'dark damage is absorbed by ES before HP');
  assert.equal(ctx.hasActiveState(shadow, 'invisibility'), true);
  ctx.applyState(shadow, { id: 'exhaustion', duration: 2, casterId: shadow.id });
  const victim = ctx.createCreature('wolf', { x: 5, y: 1 });
  state.entities.push(victim);
  const victimHP = victim.hp;
  ctx.applySpellEffect(strike, victim.position, shadow, deps);
  assert.equal(victim.hp, victimHP - 6, 'Exhaustion applies to the new spell too');
});

test('crit annotates damage without changing it and never triggers on a miss or immunity', () => {
  const { ctx, state, wizard, deps } = setup();
  const wolf = ctx.createCreature('wolf', { x: 2, y: 1 });
  state.entities.push(wolf);
  wolf.cri = 100;
  const bite = wolf.availableSpells[0];
  const records = [], popups = [];
  let misses = 0;
  ctx.battleLog = { damage: (...args) => records.push(args), miss: () => misses++, applied() {} };
  ctx.playCritAnimation = cell => popups.push(cell);
  vm.runInContext('Math.random = () => 0.5', ctx);
  const hp = wizard.hp;
  ctx.applySpellEffect(bite, wizard.position, wolf, deps, null, true);
  assert.equal(wizard.hp, hp - 4);
  assert.equal(records.length, 1);
  assert.equal(records[0][3], true);
  assert.equal(popups.length, 1);
  ctx.applySpellEffect(bite, wizard.position, wolf, deps, null, false);
  assert.equal(misses, 1);
  assert.equal(records.length, 1);
  assert.equal(popups.length, 1);
  wizard.states.push({ id: 'freeze', duration: 2 });
  ctx.applyDamage({ ...bite, damage: 4 }, wizard, wolf);
  assert.equal(records.length, 1);
  assert.equal(popups.length, 1);
});

test('Alt preview reports capped hit chance, critical chance and current critical damage without revealing hidden targets', () => {
  const { ctx, state, wizard, shadow, hide } = setup();
  wizard.attributes.att = 25;
  wizard.cri = 10;
  ctx.altHeld = false;
  state.preparedSpellId = 'fire-shot';
  ctx.highlightSpellRange(shadow.position);
  assert.equal(state.effectBadges.length, 0, 'no ordinary numeric preview');
  assert.ok(state.highlightedCells.length > 0, 'area highlighting remains');
  ctx.altHeld = true;
  ctx.highlightSpellRange(shadow.position);
  assert.equal(state.effectBadges[0].textContent, 'Урон: 4 [Крит: 4]\nПопадание: 100%\nКрит: 25%');
  assert.deepEqual(plain(state.spellPreviewCenter), plain(shadow.position));
  ctx.clearHighlight();
  assert.equal(state.spellPreviewCenter, null);
  hide(shadow);
  ctx.highlightSpellRange(shadow.position);
  assert.equal(state.effectBadges.length, 0);
});

test('outline eligibility respects target teams, living targets and invisibility', () => {
  const { ctx, wizard, shadow, monk, hide } = setup();
  assert.equal(ctx.isSpellPreviewTarget(shadow, { target: 'ally' }, wizard, shadow.position), false);
  assert.equal(ctx.isSpellPreviewTarget(monk, { target: 'ally' }, wizard, monk.position), true);
  assert.equal(ctx.isSpellPreviewTarget(wizard, { target: 'enemy' }, wizard, wizard.position), false);
  assert.equal(ctx.isSpellPreviewTarget(shadow, { target: 'enemy' }, wizard, shadow.position), true);
  assert.equal(ctx.isSpellPreviewTarget(shadow, { target: 'any' }, wizard, shadow.position), true);
  assert.equal(ctx.isSpellPreviewTarget(monk, { target: 'none', isSummon: true }, wizard, monk.position), false);
  hide(shadow);
  assert.equal(ctx.isSpellPreviewTarget(shadow, { target: 'any' }, wizard, shadow.position), false);
  monk.hp = 0;
  assert.equal(ctx.isSpellPreviewTarget(monk, { target: 'ally' }, wizard, monk.position), false);
});
