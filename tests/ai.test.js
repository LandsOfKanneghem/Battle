const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const spell = (id, range, extra = {}) => ({ id, range, minRange: 1, modifiable: false,
  noLOS: false, apCost: 4, cooldown: 0, maxCooldown: 0, usesThisTurn: 0,
  maxUsesPerTurn: 1, abilityType: 'weapon-strike', baseAccuracy: 100, damage: 4, ...extra });

function setup({ position, target, mp = 3, ap = 5, type = 'hill-giant', spells = [spell('bite', 1)], tiles, crates = [], levitation = false }) {
  const timers = [], moves = [], attacks = [];
  const ctx = { document: { getElementById: () => ({}), createElement: () => ({}), querySelectorAll: () => [] },
    setTimeout: fn => timers.push(fn) };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['gameState.js', 'combat.js', 'spellTargeting.js', 'movement.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  }
  const state = ctx.gameState;
  const caster = { id: 'mob', type, ai: 'mob', hp: 1000, ap,
    mp, maxMP: mp, position: { ...position }, availableSpells: spells,
    states: levitation ? [{ id: 'levitation', duration: 10 }] : [], sfc: 0 };
  const victim = { id: 'wizard', type: 'wizard', hp: 1000, eva: 0, position: { ...target } };
  state.entities = [caster, victim];
  state.turnOrderIds = [caster.id, victim.id];
  state.cells = Array.from({ length: 144 }, () => ({}));
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    state.terrain.set(`${x},${y}`, tiles?.[y]?.[x] ?? 'grass');
  }
  for (const point of crates) state.obstacles.set(state.keyOf(point), 'crate');
  ctx.hasActiveState = (entity, id) => entity?.states.some(s => s.id === id);
  ctx.isFrozen = () => false;
  ctx.getEffectiveStat = (entity, key) => entity?.[key] ?? 0;
  ctx.getSpellDamage = attack => attack.damage;
  ctx.spellDamage = attack => attack.damage;
  ctx.updatePanel = () => {};
  ctx.renderPosition = () => moves.push({ ...caster.position, mp: caster.mp });
  ctx.recordHitAttempt = () => {};
  ctx.playBiteAnimation = () => {};
  ctx.playStateAnimation = () => {};
  ctx.playSpectralStrikeAnimation = () => {};
  ctx.playProjectileAnimation = (from, to, type, arrive) => arrive();
  ctx.applySpellEffect = (attack, point) => {
    attacks.push({ id: attack.id, from: { ...caster.position }, to: { ...point } });
    if (attack.stateId === 'invisibility') caster.states.push({ id: 'invisibility', duration: 2 });
    assert.ok(distance(caster.position, point) <= attack.range);
    assert.ok(attack.noLOS || ctx.checkLOS(caster.position, point));
    assert.ok(!state.isWater(state.terrain.get(state.keyOf(caster.position))));
  };
  ctx.removeDefeatedEntities = () => {};
  ctx.spellDeps = {};
  ctx.endTurn = () => { state.activeEntityId = victim.id; };
  vm.runInContext(fs.readFileSync(path.join(root, 'ai.js'), 'utf8'), ctx);

  function turn() {
    state.turnVersion++;
    state.activeEntityId = caster.id;
    caster.ap = ap;
    caster.mp = mp;
    for (const attack of spells) {
      attack.usesThisTurn = 0;
      attack.cooldown = Math.max(0, attack.cooldown - 1);
    }
    ctx.runAI(caster);
    let callbacks = 0;
    while (timers.length) {
      assert.ok(callbacks++ < 2000, 'AI must finish its turn');
      timers.shift()();
    }
    assert.ok(caster.mp >= 0, 'movement budget must not be exceeded');
    assert.ok(!state.isWater(state.terrain.get(state.keyOf(caster.position))), 'end turn on land');
  }
  return { ctx, state, caster, victim, moves, attacks, turn };
}

const map = JSON.parse(fs.readFileSync(path.join(root, 'maps/MAP 1.json'), 'utf8'));

test('ranged AI goes around an underground void wall and never enters it', () => {
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('cave-earth'));
  for (let y = 0; y <= 6; y++) tiles[y][5] = 'void';
  const h = setup({ position: { x: 3, y: 3 }, target: { x: 7, y: 3 }, tiles,
    spells: [spell('boulder-throw', 4, { isShot: true })] });
  assert.equal(h.ctx.checkLOS(h.caster.position, h.victim.position), false);
  for (let i = 0; i < 10 && !h.attacks.length; i++) h.turn();
  assert.ok(h.attacks.length, 'AI finds the detour and opens LOS');
  assert.ok(h.moves.length);
  assert.ok(h.moves.every(point => tiles[point.y][point.x] !== 'void'));
});

test('giant walks left around the screenshot lake over several turns and throws a boulder', () => {
  const start = { x: 10, y: 6 }, target = { x: 10, y: 11 };
  const h = setup({ position: start, target, tiles: map.tiles, crates: map.objects,
    spells: [spell('boulder-smash', 1), spell('boulder-throw', 4, { isShot: true, maxCooldown: 3 })] });
  assert.equal(h.ctx.buildPath(start, { x: 11, y: 11 }, h.caster), null, 'no melee path across water');
  h.turn();
  assert.ok(h.moves.length > 0, 'do not idle on the upper bank');
  assert.ok(h.moves[0].x < start.x, 'start the left detour');
  assert.ok(distance(h.moves[0], target) > distance(start, target), 'first move may increase distance');
  for (let i = 0; i < 5 && !h.attacks.length; i++) h.turn();
  assert.ok(h.attacks.some(attack => attack.id === 'boulder-throw'));
});

test('a melee mob approaches the globally nearest bank and then stays there', () => {
  const h = setup({ position: { x: 10, y: 6 }, target: { x: 10, y: 11 }, tiles: map.tiles, crates: map.objects });
  for (let i = 0; i < 8; i++) h.turn();
  assert.equal(h.caster.position.x, 8);
  assert.equal(h.caster.position.y, 11);
  assert.equal(h.attacks.length, 0);
  const settledMoves = h.moves.length;
  h.turn();
  assert.equal(h.moves.length, settledMoves, 'no shoreline oscillation');
});

test('ranged mob moves around a crate wall until LOS opens', () => {
  const h = setup({ position: { x: 4, y: 3 }, target: { x: 4, y: 6 },
    crates: [{ x: 4, y: 4 }, { x: 4, y: 5 }], spells: [spell('boulder-throw', 4, { isShot: true })] });
  assert.equal(h.ctx.checkLOS(h.caster.position, h.victim.position), false);
  h.turn();
  assert.equal(h.attacks.length, 1);
  assert.ok(h.moves.length <= 3);
});

test('route cost accounts for sand/swamp, rather than choosing fewest steps', () => {
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('grass'));
  tiles[1][2] = 'sand'; tiles[1][3] = 'swamp'; tiles[1][4] = 'sand';
  const h = setup({ position: { x: 1, y: 1 }, target: { x: 5, y: 1 }, mp: 4, tiles });
  h.turn();
  assert.equal(h.moves.length, 4);
  assert.equal(h.caster.mp, 0);
  assert.ok(h.moves.every(point => tiles[point.y][point.x] === 'grass'));
  h.turn();
  assert.ok(h.attacks.length > 0);
});

test('levitating mob crosses shallow water and attacks/stops only on land', () => {
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('grass'));
  tiles[1][2] = 'shallow-water';
  const h = setup({ position: { x: 1, y: 1 }, target: { x: 4, y: 1 }, mp: 2, tiles,
    levitation: true, spells: [spell('water-shot', 2, { isShot: true })] });
  h.turn();
  assert.ok(h.moves.some(point => tiles[point.y][point.x] === 'shallow-water'));
  assert.equal(h.attacks.length, 1);
  assert.equal(h.caster.position.x, 3);
});

test('a mob with one MP detours around tiles whose entry cost exceeds its full turn', () => {
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('grass'));
  for (let x = 2; x <= 4; x++) tiles[1][x] = 'sand';
  const h = setup({ position: { x: 1, y: 1 }, target: { x: 5, y: 1 }, mp: 1, tiles });
  for (let i = 0; i < 8 && !h.attacks.length; i++) h.turn();
  assert.ok(h.attacks.length > 0);
  assert.ok(h.moves.every(point => tiles[point.y][point.x] === 'grass'));
});

test('levitating mob detours around water too wide to cross in one turn', () => {
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('grass'));
  for (let x = 2; x <= 4; x++) tiles[1][x] = 'deep-water';
  const h = setup({ position: { x: 1, y: 1 }, target: { x: 6, y: 1 }, mp: 2, tiles, levitation: true });
  for (let i = 0; i < 8 && !h.attacks.length; i++) h.turn();
  assert.ok(h.attacks.length > 0);
});

test('hypothetical LOS ignores only the caster, never crates or other creatures', () => {
  const h = setup({ position: { x: 2, y: 2 }, target: { x: 2, y: 5 } });
  const from = { x: 2, y: 1 };
  assert.equal(h.ctx.checkLOS(from, h.victim.position), false);
  assert.equal(h.ctx.checkLOS(from, h.victim.position, h.caster.id), true);
  h.state.entities.push({ id: 'blocker', position: { x: 2, y: 3 } });
  assert.equal(h.ctx.checkLOS(from, h.victim.position, h.caster.id), false);
  h.state.entities.pop();
  h.state.obstacles.set('2,4', 'crate');
  assert.equal(h.ctx.checkLOS(from, h.victim.position, h.caster.id), false);
});

test('AI attacks immediately when already in range', () => {
  const h = setup({ position: { x: 1, y: 1 }, target: { x: 2, y: 1 } });
  h.turn();
  assert.equal(h.attacks.length, 1);
  assert.equal(h.moves.length, 0);
});

test('AI does not attack or chase a hidden enemy, and resumes when it is visible', () => {
  const h = setup({ position: { x: 2, y: 2 }, target: { x: 4, y: 2 } });
  h.victim.states = [{ id: 'invisibility', duration: 2 }];
  h.turn();
  assert.equal(h.attacks.length, 0);
  assert.equal(h.moves.length, 0);
  h.victim.states = [];
  h.turn();
  assert.ok(h.attacks.length > 0);
});

const spectralStrike = () => spell('spectral-strike', 4, {
  apCost: 3, maxUsesPerTurn: 2, abilityType: 'spell', damage: 8, isShot: false
});
const invisibility = () => spell('turn-invisible', 0, {
  minRange: 0, apCost: 3, maxCooldown: 4, abilityType: 'spell', stateId: 'invisibility'
});

for (const type of ['shadow', 'specter']) {
  test(`${type} prioritizes invisibility, then strikes, and finishes on another cell at range four`, () => {
    const start = { x: 5, y: 5 }, target = { x: 1, y: 5 };
    const h = setup({ type, position: start, target, ap: 9, mp: 4,
      spells: [spectralStrike(), invisibility()] });
    h.turn();
    assert.deepEqual(h.attacks.map(a => a.id), ['turn-invisible', 'spectral-strike', 'spectral-strike']);
    assert.equal(distance(h.caster.position, target), 4);
    assert.notDeepEqual(h.caster.position, start);
    assert.ok(h.ctx.checkLOS(h.caster.position, target));
    assert.equal(h.caster.ap, 0);
  });
}

test('spectral caster retreats after spending its AP instead of approaching melee distance', () => {
  const h = setup({ type: 'specter', position: { x: 4, y: 5 }, target: { x: 5, y: 5 },
    ap: 6, mp: 4, spells: [spectralStrike()] });
  h.turn();
  assert.equal(h.attacks.length, 2);
  assert.equal(distance(h.caster.position, h.victim.position), 4);
  assert.ok(h.moves.length > 0);
});

test('spectral caster with no AP still changes position and stays in attack range', () => {
  const start = { x: 5, y: 5 }, target = { x: 1, y: 5 };
  const h = setup({ type: 'shadow', position: start, target, ap: 0, mp: 2, spells: [spectralStrike()] });
  h.turn();
  assert.equal(h.attacks.length, 0);
  assert.notDeepEqual(h.caster.position, start);
  assert.equal(distance(h.caster.position, target), 4);
});

test('spectral caster uses a closer firing cell when no other range-four position is reachable this turn', () => {
  const start = { x: 5, y: 5 }, target = { x: 1, y: 5 };
  const h = setup({ type: 'shadow', position: start, target, ap: 0, mp: 1, spells: [spectralStrike()] });
  h.turn();
  assert.notDeepEqual(h.caster.position, start);
  assert.equal(distance(h.caster.position, target), 3);
});

test('spectral caster stays put when surrounded instead of overlapping obstacles', () => {
  const start = { x: 5, y: 5 };
  const h = setup({ type: 'specter', position: start, target: { x: 1, y: 5 }, ap: 0, mp: 4,
    crates: [{ x: 4, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 6 }], spells: [spectralStrike()] });
  h.turn();
  assert.deepEqual(h.caster.position, start);
  assert.equal(h.moves.length, 0);
});

test('spectral caster outside range approaches an attack position over several turns', () => {
  const h = setup({ type: 'shadow', position: { x: 10, y: 5 }, target: { x: 1, y: 5 },
    ap: 6, mp: 2, spells: [spectralStrike()] });
  for (let i = 0; i < 5 && !h.attacks.length; i++) h.turn();
  assert.ok(h.attacks.length > 0);
  assert.equal(distance(h.caster.position, h.victim.position), 4);
  assert.ok(h.moves.every(p => distance(p, h.victim.position) >= 4));
});

test('spectral caster finds LOS around a wall and keeps ranged positioning after attacking', () => {
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('cave-earth'));
  for (let y = 0; y <= 6; y++) tiles[y][5] = 'void';
  const h = setup({ type: 'specter', position: { x: 3, y: 3 }, target: { x: 7, y: 3 },
    ap: 6, mp: 3, tiles, spells: [spectralStrike()] });
  for (let i = 0; i < 10 && !h.attacks.length; i++) h.turn();
  assert.ok(h.attacks.length > 0);
  assert.equal(distance(h.caster.position, h.victim.position), 4);
  assert.ok(h.ctx.checkLOS(h.caster.position, h.victim.position));
  assert.ok(h.moves.every(p => tiles[p.y][p.x] !== 'void'));
});
