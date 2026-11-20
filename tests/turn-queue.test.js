const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const creature = (id, ini, extra = {}) => ({ id, ini, hp: 100, ally: false, ...extra });
function setup(entities) {
  const rounds = [];
  const state = {
    entities, turnOrderIds: [], roundNumber: 0, activeEntityId: null,
    turnSlots: new Map(entities.map(entity => [entity.id, { id: entity.id }])),
    turnOrder: { children: [], scrollTop: 0, replaceChildren(...children) { this.children = children; } },
    isAlly: entity => entity.ally === true
  };
  const ctx = { gameState: state, getEffectiveStat: entity => entity.ini,
    battleLog: { beginRound: number => rounds.push(number) } };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../turnQueue.js'), 'utf8'), ctx);
  const queue = ctx.turnQueue;
  function begin() {
    const entity = queue.activate();
    state.activeEntityId = entity?.id ?? null;
    return entity?.id;
  }
  function end() { queue.finishTurn(); return begin(); }
  function add(id, ownerId, ini = 999) {
    const entity = creature(id, ini, { ownerId, isSummon: true });
    state.entities.push(entity);
    state.turnSlots.set(id, { id });
    queue.addSummon(entity);
    return entity;
  }
  function kill(entity) {
    entity.hp = 0;
    queue.remove(entity.id);
    state.entities = state.entities.filter(other => other !== entity);
    state.turnSlots.delete(entity.id);
    queue.sync();
  }
  return { state, queue, rounds, begin, end, add, kill,
    ids: () => state.turnOrder.children.map(slot => slot.id),
    waiting: () => Array.from(state.turnOrderIds),
    portraits: () => state.turnOrder.children.map(slot => slot.id) };
}

test('descending initiative forms each round; completed actors and portraits leave the queue', () => {
  const h = setup([creature('slow', -3), creature('fast', 10), creature('middle', 2)]);
  assert.equal(h.begin(), 'fast');
  assert.deepEqual(h.ids(), ['fast', 'middle', 'slow']);
  assert.equal(h.end(), 'middle');
  assert.deepEqual(h.portraits(), ['middle', 'slow']);
  assert.equal(h.end(), 'slow');
  assert.equal(h.end(), 'fast');
  assert.deepEqual(h.rounds, [1, 2]);
});

test('ties alternate teams with natural IDs, independent of entity array order', () => {
  const a = creature('wizard', 0, { ally: true });
  const b = creature('monk', 0, { ally: true });
  const h = setup([creature('wolf-10', 0), a, creature('wolf-2', 0), b]);
  h.begin();
  const expected = ['monk', 'wolf-2', 'wizard', 'wolf-10'];
  assert.deepEqual(h.ids(), expected);
  h.state.entities.reverse();
  for (let i = 0; i < 4; i++) h.end();
  assert.deepEqual(h.ids(), expected);
});

test('every initial initiative group starts with attackers and appends the larger team remainder', () => {
  const h = setup([
    creature('enemy-20', 10), creature('enemy-10', 10), creature('ally-10', 10, { ally: true }),
    creature('enemy-top', 50), creature('ally-top', 50, { ally: true }),
    creature('ally-2', 10, { ally: true }), creature('enemy-2', 10)
  ]);
  assert.equal(h.begin(), 'ally-top');
  assert.deepEqual(h.ids(), ['ally-top', 'enemy-top', 'ally-2', 'enemy-2', 'ally-10', 'enemy-10', 'enemy-20']);
  assert.equal(h.waiting().includes('ally-top'), false, 'active actor is extracted from the actual queue');
  assert.equal(h.end(), 'enemy-top', 'ordinary turn advancement does not re-sort ties');
});

test('equivalent numeric ID spellings still have a deterministic final tie-breaker', () => {
  const roots = [creature('unit-1', 10), creature('unit-01', 10)];
  const first = setup(roots);first.begin();
  const second = setup([...roots].reverse());second.begin();
  assert.deepEqual(first.ids(), ['unit-01', 'unit-1']);
  assert.deepEqual(second.ids(), first.ids());
});

test('the configured attacking side, rather than an absolute ally preference, starts initial ties', () => {
  const h = setup([creature('ally', 10, { ally: true }), creature('enemy', 10),
    creature('ally-low', 0, { ally: true }), creature('enemy-low', 0)]);
  h.state.attackingTeam = 'enemy';
  assert.equal(h.begin(), 'enemy');
  assert.deepEqual(h.ids(), ['enemy', 'ally', 'enemy-low', 'ally-low']);
});

test('maximum initiative excludes the active actor even when its initiative is higher', () => {
  const leader = creature('leader', 100);
  const ally = creature('ally', 20, { ally: true });
  const h = setup([leader, creature('enemy-1', 30), creature('enemy-2', 30), ally]);h.begin();
  ally.ini = 30;h.queue.sync();
  assert.deepEqual(h.waiting(), ['ally', 'enemy-1', 'enemy-2']);
  assert.deepEqual(h.ids(), ['leader', 'ally', 'enemy-1', 'enemy-2']);
});

test('a lower initiative group preserves its earliest side, while each side sorts its own IDs', () => {
  const a2 = creature('ally-2', 20, { ally: true });
  const a10 = creature('ally-10', 20, { ally: true });
  const h = setup([creature('leader', 100), creature('cap', 80),
    creature('enemy-10', 30), creature('enemy-2', 30), a10, a2]);h.begin();
  a10.ini = 30;h.queue.sync();
  assert.deepEqual(h.waiting(), ['cap', 'enemy-2', 'ally-10', 'enemy-10', 'ally-2']);
  a2.ini = 30;h.queue.sync();
  assert.deepEqual(h.waiting(), ['cap', 'enemy-2', 'ally-2', 'enemy-10', 'ally-10']);
});

test('the incoming actor participates in deciding which side was earliest before the re-sort', () => {
  const incoming = creature('ally', 40, { ally: true });
  const h = setup([creature('leader', 100), creature('cap', 80), incoming,
    creature('enemy-1', 30), creature('enemy-2', 30)]);h.begin();
  incoming.ini = 30;h.queue.sync();
  assert.deepEqual(h.waiting(), ['cap', 'ally', 'enemy-1', 'enemy-2']);
});

test('completed actors, death and plain sync do not trigger alternating-group re-sorts', () => {
  const active = creature('ally-1', 30, { ally: true });
  const extra = creature('extra', 0), dead = creature('dead', 0);
  const h = setup([creature('enemy-1', 30), creature('ally-2', 30, { ally: true }),
    creature('enemy-2', 30), active, extra, dead]);h.begin();
  active.ini = 10000;h.queue.sync();
  h.kill(dead);
  assert.deepEqual(h.waiting(), ['enemy-1', 'ally-2', 'enemy-2', 'extra']);
  h.queue.sync();
  assert.deepEqual(h.waiting(), ['enemy-1', 'ally-2', 'enemy-2', 'extra']);
  // A genuine change to a waiting creature triggers the rules for all pending groups.
  extra.ini = -1;h.queue.sync();
  assert.deepEqual(h.waiting(), ['ally-2', 'enemy-1', 'enemy-2', 'extra']);
  h.end();
  active.ini = -999;h.queue.sync();
  assert.deepEqual(h.waiting(), ['enemy-1', 'enemy-2', 'extra']);
});

test('summons never participate in alternation or the maximum, and their owner block stays locked', () => {
  const owner = creature('ally-1', 30, { ally: true });
  const ally = creature('ally-2', 30, { ally: true });
  const e1 = creature('enemy-1', 30), e2 = creature('enemy-2', 30);
  const h = setup([e1, owner, ally, e2]);h.begin();
  const first = h.add('summon-1', owner.id), second = h.add('summon-2', owner.id);
  first.ini = 10000;second.ini = -10000;h.queue.sync();
  assert.deepEqual(h.waiting(), ['summon-1', 'summon-2', 'enemy-1', 'ally-2', 'enemy-2']);
  e2.ini = 40;h.queue.sync();
  ally.ini = 40;h.queue.sync();
  assert.deepEqual(h.waiting(), ['summon-1', 'summon-2', 'ally-2', 'enemy-2', 'enemy-1']);
  assert.equal(h.end(), 'summon-1');
  e1.ini = 40;h.queue.sync();
  assert.deepEqual(h.waiting(), ['summon-2', 'ally-2', 'enemy-1', 'enemy-2']);
});

test('only a changed pending actor moves; the active actor stays first even after debuffs', () => {
  const a = creature('a', 30), b = creature('b', 20), c = creature('c', 10), d = creature('d', 0);
  const h = setup([a, b, c, d]);h.begin();
  c.ini = 100;h.queue.sync();
  assert.deepEqual(h.ids(), ['a', 'c', 'b', 'd']);
  c.ini = -10;a.ini = -100;h.queue.sync();
  assert.deepEqual(h.ids(), ['a', 'b', 'd', 'c']);
  assert.equal(h.end(), 'b');
});

test('already completed actors cannot return mid-round, but their new initiative applies next round', () => {
  const a = creature('a', 30), b = creature('b', 20), c = creature('c', 10);
  const h = setup([a, b, c]);h.begin();h.end();
  a.ini = 300;h.queue.sync();
  assert.deepEqual(h.ids(), ['b', 'c']);
  h.end();assert.equal(h.end(), 'a');
  assert.equal(h.state.roundNumber, 2);
});

test('several initiative changes in one effect keep pending roots correctly ordered', () => {
  const roots = Array.from({ length: 12 }, (_, index) => creature(`mob-${index}`, 100 - index));
  const h = setup(roots);h.begin();
  let seed = 12345;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
  for (let pass = 0; pass < 200; pass++) {
    for (const root of roots.slice(1)) if (random() % 3 === 0) root.ini = (random() % 31) - 15;
    h.queue.sync();
    const expected = roots.slice(1).sort((a, b) => b.ini - a.ini
      || a.id.localeCompare(b.id, 'en', { numeric: true })).map(root => root.id);
    assert.deepEqual(h.ids(), [roots[0].id, ...expected]);
  }
});

test('a pending owner moves with all summons; summon initiative is ignored in every round', () => {
  const a = creature('a', 30), b = creature('b', 20), c = creature('c', 10);
  const s1 = creature('s1', -999, { isSummon: true, ownerId: 'b' });
  const s2 = creature('s2', 999, { isSummon: true, ownerId: 'b' });
  const h = setup([s2, a, b, c, s1]);h.begin();
  // Creation order is the order of living entities, not IDs or initiative.
  assert.deepEqual(h.ids(), ['a', 'b', 's2', 's1', 'c']);
  b.ini = 0;h.queue.sync();
  assert.deepEqual(h.ids(), ['a', 'c', 'b', 's2', 's1']);
  s1.ini = 10000;s2.ini = -10000;h.queue.sync();
  assert.deepEqual(h.ids(), ['a', 'c', 'b', 's2', 's1']);
  for (let i = 0; i < 5; i++) h.end();
  assert.deepEqual(h.ids(), ['a', 'c', 'b', 's2', 's1']);
});

test('new summons immediately follow their caster, without interleaving other initiative changes', () => {
  const a = creature('a', 20), b = creature('b', 10);
  const h = setup([a, b]);h.begin();
  h.add('first', a.id);h.add('second', a.id, -999);
  b.ini = 100;h.queue.sync();
  assert.deepEqual(h.ids(), ['a', 'first', 'second', 'b']);
  assert.equal(h.end(), 'first');
  a.ini = -100;b.ini = 200;h.queue.sync();
  assert.deepEqual(h.ids(), ['first', 'second', 'b']);
  assert.equal(h.end(), 'second');
  assert.equal(h.end(), 'b');
  assert.deepEqual(h.rounds, [1]);
  assert.equal(h.end(), 'b');
  assert.deepEqual(h.ids(), ['b', 'a', 'first', 'second']);
  assert.deepEqual(h.rounds, [1, 2]);
});

test('a summon can summon its own child without splitting either owner block', () => {
  const h = setup([creature('a', 20), creature('b', 10)]);h.begin();
  h.add('first', 'a');h.add('second', 'a');h.end();
  h.add('child', 'first');
  assert.deepEqual(h.ids(), ['first', 'child', 'second', 'b']);
  assert.equal(h.end(), 'child');
});

test('deaths remove only the dead participants; death on turn start does not skip the successor', () => {
  const a = creature('a', 30), b = creature('b', 20), c = creature('c', 10);
  const h = setup([a, b, c]);h.begin();
  h.kill(b);assert.deepEqual(h.ids(), ['a', 'c']);
  h.kill(a);assert.equal(h.begin(), 'c');
  h.kill(a);assert.deepEqual(h.ids(), ['c']);
  assert.equal(h.end(), 'c');
  assert.deepEqual(h.rounds, [1, 2]);
});

test('death of the owner and its summons passes to the next root, even when a summon is active', () => {
  const a = creature('a', 20), b = creature('b', 10);
  const h = setup([a, b]);h.begin();
  const first = h.add('first', 'a'), second = h.add('second', 'a');h.end();
  h.kill(a);h.kill(first);h.kill(second);
  assert.equal(h.begin(), 'b');
  assert.deepEqual(h.ids(), ['b']);
  assert.deepEqual(h.rounds, [1]);
});

test('empty battles do not start phantom rounds; loading a new battle resets the scheduler', () => {
  const a = creature('a', 1);const h = setup([a]);h.begin();
  h.kill(a);assert.equal(h.begin(), undefined);assert.deepEqual(h.rounds, [1]);
  h.queue.reset();h.state.entities.push(creature('new', 0));h.state.turnSlots.set('new', { id: 'new' });
  assert.equal(h.begin(), 'new');assert.equal(h.state.roundNumber, 1);
});
