const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function setup() {
  const ctx = { gameState: { effectOrder: 0, entities: [], activeEntityId: null,
    activeEntity() { return this.entities.find(entity => entity.id === this.activeEntityId); } },
    document: { createElementNS: () => ({ style: {}, setAttribute() {} }) } };
  ctx.window = ctx;
  vm.createContext(ctx);
  const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);
  for (const file of [...scripts, 'combat.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  function make(type = 'wizard', { ini = 5, mp = 4, cha = 3 } = {}) {
    const template = ctx.CREATURE_TEMPLATES[type];
    Object.assign(template, { baseINI: ini, baseMP: mp });
    Object.assign(template.attributes, { cha, str: 0 });
    const creature = ctx.createCreature(type, { x: 1, y: 1 });
    ctx.gameState.entities.push(creature);
    return creature;
  }
  return { ctx, make, ini: entity => ctx.getEffectiveStat(entity, 'ini') };
}

test('initiative includes maxMP and CHA at creation, with the initial-stat baseline already correct', () => {
  const { make, ini } = setup();
  const creature = make();
  assert.equal(ini(creature), 12); // 4 maxMP + 5 baseINI + 3 CHA
  assert.equal(creature.initialStats.ini, 12);
  creature.mp = 0;
  assert.equal(ini(creature), 12, 'spent movement cannot lower initiative');
  creature.mp = creature.maxMP + 1;
  creature.bonusMP = 1;
  assert.equal(ini(creature), 12, 'the temporary random movement point is not maxMP');
});

test('effective CHA buffs and expiration update initiative without changing base initiative', () => {
  const { ctx, make, ini } = setup();
  const creature = make();
  ctx.applySpellOnEntity(creature, { id: 'test-cha', name: 'CHA', duration: 1,
    modifiers: { cha: 2 }, casterId: creature.id });
  assert.equal(ini(creature), 14);
  assert.equal(creature.baseINI, 5);
  ctx.tickCasterEffects(creature.id);
  assert.equal(ini(creature), 12);
});

test('state movement and initiative bonuses are counted once and follow suppression', () => {
  const { ctx, make, ini } = setup();
  const creature = make();
  ctx.applyState(creature, { id: 'speed', duration: 3, mpBonus: 2, initiativeBonus: 5, casterId: creature.id });
  assert.equal(creature.maxMP, 6);
  assert.equal(ini(creature), 19); // 6 maxMP + 5 baseINI + 5 speed + 3 CHA
  ctx.applyState(creature, { id: 'slowness', duration: 2, mpBonus: -2, initiativeBonus: -5, casterId: creature.id });
  assert.equal(ini(creature), 5); // 2 maxMP + 5 baseINI - 5 slowness + 3 CHA
  ctx.removeState(creature, 'slowness');
  assert.equal(ini(creature), 19);
  ctx.removeState(creature, 'speed');
  assert.equal(ini(creature), 12);
});

test('temporary maxMP, guaranteed STR movement and direct initiative modifiers keep contributing', () => {
  const { ctx, make, ini } = setup();
  const creature = make();
  ctx.applySpellOnEntity(creature, { id: 'test-mp', name: 'MP', duration: 3,
    mpAmount: 3, casterId: creature.id });
  assert.equal(ini(creature), 15);
  ctx.applyState(creature, { id: 'vigor', duration: 3, modifiers: { str: 20 }, casterId: creature.id });
  assert.equal(ini(creature), 16);
  ctx.applySpellOnEntity(creature, { id: 'test-ini', name: 'INI', duration: 3,
    modifiers: { ini: 4 }, casterId: creature.id });
  assert.equal(ini(creature), 20);
});

test('CHA changes reorder only waiting actors, while the forecast includes completed creatures', () => {
  const { ctx, make } = setup();
  const a = make('wizard', { ini: 50 });
  const b = make('monk', { ini: 5, cha: 1 });
  const c = make('wolf', { ini: 2, cha: 1 });
  const state = ctx.gameState;
  Object.assign(state, { roundNumber: 0, turnOrderIds: [],
    turnSlots: new Map(state.entities.map(entity => [entity.id, { id: entity.id }])),
    turnOrder: { children: [], scrollTop: 0, replaceChildren(...children) { this.children = children; } } });
  vm.runInContext(fs.readFileSync(path.join(root, 'turnQueue.js'), 'utf8'), ctx);
  ctx.updatePanel = () => ctx.turnQueue.sync();
  state.activeEntityId = ctx.turnQueue.activate().id;
  ctx.applySpellOnEntity(c, { id: 'test-cha', name: 'CHA', duration: 3,
    modifiers: { cha: 5 }, casterId: c.id });
  assert.deepEqual(Array.from(state.turnOrderIds), [c.id, b.id]);
  assert.equal(state.activeEntityId, a.id);
  ctx.turnQueue.finishTurn();
  state.activeEntityId = ctx.turnQueue.activate().id;
  ctx.applySpellOnEntity(a, { id: 'test-cha-down', name: 'CHA down', duration: 3,
    modifiers: { cha: -100 }, casterId: c.id });
  assert.deepEqual(Array.from(state.turnOrderIds), [b.id]);
  assert.deepEqual(Array.from(ctx.turnQueue.preview()), [c.id, b.id, a.id]);
});
