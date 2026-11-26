const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function setup({ mp = 3, ap = 7, start = { x: 5, y: 3 }, mage = { x: 4, y: 6 }, warrior = { x: 5, y: 4 } } = {}) {
  const timers = [], casts = [], moves = [];
  const element = () => ({ hidden: true, style: {}, setAttribute() {}, appendChild() {}, remove() {},
    classList: { add() {}, remove() {} } });
  const ctx = { document: { getElementById: element, createElement: element, createElementNS: element,
    querySelectorAll: () => [] }, Math: Object.create(Math),
    setTimeout: fn => timers.push(fn), queueMicrotask: fn => fn(),
    updatePanel() {}, removeDefeatedEntities() {}, playBiteAnimation() {}, playJumpAnimation() {}, playFailureAnimation() {},
    playTonguePullAnimation() {}, playMissAnimation() {}, playStateAnimation() {},
    playProjectileAnimation: (from, to, type, done) => done() };
  ctx.window = ctx; vm.createContext(ctx);
  const data = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="(data\/[^\"]+\.js)"/g)].map(m => m[1]);
  for (const file of ['gameState.js', ...data, 'combat.js', 'spellTargeting.js', 'spellLogic.js', 'aiPlanner.js', 'ai.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  const state = ctx.gameState;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) state.terrain.set(`${x},${y}`, 'grass');
  state.cells = Array.from({ length: 144 }, element);
  const toad = ctx.createCreature('giant-toad', start), wizard = ctx.createCreature('wizard', mage), fighter = ctx.createCreature('warrior', warrior);
  state.entities = [toad, wizard, fighter];state.activeEntityId = toad.id;state.turnVersion = 1;
  toad.mp = mp; toad.ap = ap;
  ctx.renderPosition = () => moves.push({ ...toad.position });
  ctx.battleLog = { cast: (actor, spell, target) => casts.push({ id: spell.id, target: target.id }), damage() {}, applied() {}, failure() {}, miss() {} };
  ctx.endTurn = () => { state.activeEntityId = wizard.id; };
  ctx.spellDeps = { ...ctx, stateTypes: vm.runInContext('stateTypes', ctx) };
  const plan = () => JSON.parse(JSON.stringify(ctx.planAIAction(toad)));
  const turn = () => {
    ctx.Math.random = () => 0.01;
    ctx.runAI(toad);
    for (let i = 0; timers.length; i++) { assert(i < 100, 'turn must terminate');timers.shift()(); }
  };
  return { ctx, state, toad, wizard, fighter, plan, turn, casts, moves };
}

test('walks past an immediately attackable armored warrior to bite the vulnerable mage', () => {
  const h = setup();
  assert.equal(h.plan().kind, 'move');
  h.turn();
  assert(h.moves.length > 0);
  assert(h.casts.some(c => c.id === 'poison-bite' && c.target === h.wizard.id));
  assert(!h.casts.some(c => c.target === h.fighter.id));
});

test('plans tongue pull then bite instead of wasting the turn attacking armor', () => {
  const h = setup({ start: { x: 5, y: 2 }, mage: { x: 5, y: 5 }, warrior: { x: 4, y: 2 }, mp: 0, ap: 6 });
  assert.equal(h.plan().spellId, 'tongue-pull');
  assert.equal(h.plan().targetId, h.wizard.id);
  h.turn();
  assert.deepEqual(h.casts.map(c => c.id), ['tongue-pull', 'poison-bite']);
  assert(h.casts.every(c => c.target === h.wizard.id));
  assert.equal(h.wizard.hp, 0);
});

test('spends AP on a jump for one mage bite when its percentage exceeds an armored attack', () => {
  const h = setup({ start: { x: 5, y: 2 }, mage: { x: 7, y: 3 }, warrior: { x: 5, y: 3 }, mp: 0, ap: 5 });
  assert.equal(h.plan().kind, 'jump');
  h.turn();
  assert.deepEqual(h.casts.map(c => c.id), ['jump', 'poison-bite']);
  assert.equal(h.casts[1].target, h.wizard.id);
  assert.equal(h.toad.mp, 0);
  assert.equal(h.toad.ap, 0);
});

test('planner is deterministic, uses no random draws and leaves the live battle untouched', () => {
  const h = setup();
  const before = JSON.stringify(h.state.entities);
  h.ctx.Math.random = () => { throw new Error('planning must not roll dice'); };
  const first = h.plan();
  assert.deepEqual(h.plan(), first);
  assert.equal(JSON.stringify(h.state.entities), before);
  assert.equal(h.casts.length, 0);assert.equal(h.moves.length, 0);
});

test('hidden opponents affect neither targets, collision, LOS nor pull planning', () => {
  const h = setup();
  const first = h.plan();
  const hidden = h.ctx.createCreature('monk', { ...first.path[0] });
  hidden.states.push({ id: 'invisibility', duration: 2 });hidden.hp = 1;
  h.state.entities.push(hidden);
  assert.deepEqual(h.plan(), first);
  h.wizard.states.push({ id: 'invisibility', duration: 2 });
  const action = h.plan();
  assert.equal(action.targetId, h.fighter.id);
});

test('low hit probability reduces expected value rather than granting a guaranteed kill', () => {
  const h = setup({ mage: { x: 4, y: 3 }, mp: 0, ap: 3 });
  h.wizard.hp = 1; h.wizard.eva = 1000;
  assert.equal(h.plan().targetId, h.fighter.id);
});

test('blocked LOS and occupied jump landings never create a false lethal combo', () => {
  const h = setup({ start: { x: 5, y: 2 }, mage: { x: 5, y: 5 }, warrior: { x: 4, y: 2 }, mp: 0, ap: 6 });
  h.state.obstacles.set('5,3', 'crate');h.state.obstacles.set('5,4', 'crate');
  h.toad.availableSpells.find(s => s.id === 'jump').cooldown = 1;
  assert.equal(h.plan().targetId, h.fighter.id);
});

test('replans after an actual missed tongue pull instead of biting the old target cell', () => {
  const h = setup({ start: { x: 5, y: 2 }, mage: { x: 5, y: 5 }, warrior: { x: 4, y: 2 }, mp: 0, ap: 6 });
  h.ctx.spellDeps.shotHits = () => false;
  h.turn();
  assert.equal(h.casts[0].id, 'tongue-pull');
  assert.equal(h.casts[0].target, h.wizard.id);
  assert.equal(h.casts[1].target, h.fighter.id);
  assert.equal(h.wizard.hp, h.wizard.maxHP);
});


test('credits new poison over refreshing an already poisoned otherwise equal target', () => {
  const h = setup({ mage: { x: 4, y: 3 }, mp: 0, ap: 3 });
  h.fighter.armorSources = []; h.fighter.ac = 0; h.fighter.attributes.luc = 0;
  h.fighter.hp = h.fighter.maxHP = h.wizard.hp;
  h.fighter.states.push({ id: 'weak-poison', duration: 3 });
  assert.equal(h.plan().targetId, h.wizard.id);
});

test('a likely finishing blow wins over a larger percentage of damage without a kill', () => {
  const h = setup({ mage: { x: 4, y: 3 }, mp: 0, ap: 3 });
  h.fighter.hp = 2;
  assert.equal(h.plan().targetId, h.fighter.id);
});
