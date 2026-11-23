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
