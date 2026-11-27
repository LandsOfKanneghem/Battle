const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function setup() {
  const ctx = { document: { getElementById: () => ({}), createElement: () => ({}) }, setTimeout() {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['gameState.js', 'mapObjects.js', 'mapEquipment.js', 'lighting.js', 'init.js', 'spellTargeting.js', 'movement.js', 'spellLogic.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  ctx.CREATURE_TEMPLATES = { wizard: { type: 'wizard' }, wolf: { type: 'wolf' } };
  ctx.hasActiveState = (entity, id) => entity.states?.some(s => s.id === id);
  ctx.isFrozen = () => false;
  ctx.isJumpBlocked = (spell, entity) => !!spell?.isJump && ctx.hasActiveState(entity, 'heavy');
  ctx.getEffectiveStat = () => 0;
  return ctx;
}

function fixture(mapType = 'surface') {
  const map = { format: 'kanneghem-map', version: 6, width: 12, height: 12, mapType,
    tiles: Array.from({ length: 12 }, () => Array(12).fill(mapType === 'surface' ? 'grass' : 'void')),
    mobs: [], objects: [] };
  if (mapType === 'underground') map.wallStyles = Array.from({ length: 12 }, () => Array(12).fill(null));
  return map;
}

test('v9 hero loadouts are validated and copied before replacing combat; old heroes retain defaults', () => {
  const ctx = setup();
  ctx.CREATURE_TEMPLATES.warrior = { type: 'warrior' };
  ctx.EQUIPMENT_ITEMS = {
    belt: { allowedSlots: ['belt'], consumableSlots: 2 },
    sword: { allowedSlots: ['rightHand'], hands: 1 },
    bow: { allowedSlots: ['rightHand'], hands: 2 },
    shield: { allowedSlots: ['leftHand'] },
    potion: { allowedSlots: ['consumables'], consumable: { heal: 10 } }
  };
  const data = { ...fixture(), version: 9 };
  data.mobs = [{ type: 'warrior', team: 'ally', x: 2, y: 3,
    equipment: { belt: 'belt', rightHand: 'sword' },
    consumables: ['potion', 'potion', null, null, null, null] }];
  const normalized = ctx.validateBattleMap(data).mobs[0];
  assert.equal(normalized.equipment.rightHand, 'sword');
  assert.equal(normalized.equipment.chest, null);
  assert.equal(normalized.consumables[0], 'potion');
  normalized.equipment.rightHand = null;
  normalized.consumables[0] = null;
  assert.equal(data.mobs[0].equipment.rightHand, 'sword');
  assert.equal(data.mobs[0].consumables[0], 'potion');
  const entities = ctx.gameState.entities;
  for (const change of [
    m => { m.equipment.rightHand = 'unknown-item'; },
    m => { m.equipment.head = 'sword'; },
    m => { m.equipment.rightHand = 'bow'; m.equipment.leftHand = 'shield'; },
    m => { m.consumables[2] = 'potion'; },
    m => { m.type = 'wolf'; }
  ]) {
    const invalid = plain(data);
    change(invalid.mobs[0]);
    assert.throws(() => ctx.validateBattleMap(invalid));
    assert.equal(ctx.gameState.entities, entities);
  }
  delete data.mobs[0].equipment; delete data.mobs[0].consumables;
  assert.equal(ctx.validateBattleMap(data).mobs[0].equipment, undefined);
});

test('load a version 6 underground with both floor materials and mixed wall styles', () => {
  const ctx = setup(), data = fixture('underground');
  data.tiles[4][4] = 'monastery-floor';
  data.tiles[4][5] = 'cave-earth';
  data.mobs.push({ type: 'wizard', team: 'ally', x: 4, y: 4 });
  data.objects.push({ type: 'crate', x: 5, y: 4, blocking: true, interactive: false });
  data.wallStyles[3][4] = 'monastery';
  data.wallStyles[3][5] = 'dungeon';
  const loaded = ctx.validateBattleMap(data);
  assert.equal(loaded.mapType, 'underground');
  assert.equal(loaded.tiles[4][5], 'cave-earth');
  assert.equal(loaded.wallStyles[3][5], 'dungeon');
  assert.deepEqual(plain(loaded.mobs), data.mobs);
  loaded.tiles[4][4] = 'dirt';
  loaded.wallStyles[3][5] = null;
  assert.equal(data.tiles[4][4], 'monastery-floor', 'loading does not mutate input');
  assert.equal(data.wallStyles[3][5], 'dungeon');
});

test('same floor types are accepted above ground and in the underground', () => {
  const ctx = setup();
  for (const mapType of ['surface', 'underground']) {
    const data = fixture(mapType);
    data.tiles[0] = ['grass', 'sand', 'dirt', 'swamp', 'deep-water', 'shallow-water',
      'monastery-floor', 'cave-earth', 'grass', 'grass', 'grass', 'grass'];
    assert.deepEqual(plain(ctx.validateBattleMap(data).tiles[0]), data.tiles[0]);
  }
});

for (const version of [1, 2, 3, 4]) {
  test(`legacy map version ${version} remains loadable`, () => {
    const ctx = setup(), data = fixture();
    data.version = version;
    delete data.mapType;
    if (version === 1) { delete data.mobs; delete data.objects; }
    else data.mobs.push({ type: 'wolf', x: 2, y: 3, ...(version === 4 ? { team: 'enemy' } : {}) });
    if (version === 2) delete data.objects;
    const map = ctx.validateBattleMap(data);
    assert.equal(map.mapType, 'surface');
    assert.equal(map.wallStyles, null);
    assert.equal(map.mobs.length, version === 1 ? 0 : 1);
  });
}

test('version 5 imports its selected level, matching MapEditor', () => {
  const ctx = setup(), surface = fixture(), underground = fixture('underground');
  underground.tiles[5][5] = 'cave-earth';
  const old = { format: 'kanneghem-map', version: 5, width: 12, height: 12,
    activeLevel: 'underground', levels: { surface, underground } };
  assert.equal(ctx.validateBattleMap(old).tiles[5][5], 'cave-earth');
  old.activeLevel = 'surface';
  assert.equal(ctx.validateBattleMap(old).tiles[5][5], 'grass');
});

const invalid = {
  'unknown terrain': d => { d.tiles[0][0] = 'lava'; },
  'unknown mob': d => { d.mobs.push({ type: 'gnome', x: 1, y: 1 }); },
  'unknown map type': d => { d.mapType = 'other'; },
  'void on surface': d => { d.mapType = 'surface'; },
  'invalid wall style': d => { d.wallStyles[0][0] = 'marble'; },
  'missing wall styles': d => { delete d.wallStyles; },
  'mob in void': d => { d.mobs.push({ type: 'wolf', team: 'enemy', x: 1, y: 1 }); },
  'crate in void': d => { d.objects.push({ type: 'crate', x: 1, y: 1, blocking: true, interactive: false }); },
  'incorrect team': d => { d.tiles[1][1] = 'grass'; d.mobs.push({ type: 'wolf', team: 'unknown', x: 1, y: 1 }); }
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`reject ${name} before changing current combat`, async () => {
    const ctx = setup(), data = fixture('underground');
    const entity = { id: 'existing', hp: 7 };
    ctx.gameState.entities.push(entity);
    const version = ctx.gameState.battleVersion;
    let rendered = false;
    ctx.createBattleTerrain = async () => { rendered = true; };
    mutate(data);
    await assert.rejects(ctx.startBattleFromMap(data));
    assert.equal(ctx.gameState.entities[0], entity);
    assert.equal(ctx.gameState.battleVersion, version);
    assert.equal(rendered, false);
  });
}

test('missing artwork does not reset the current combat', async () => {
  const ctx = setup();
  const entity = { id: 'existing' };
  ctx.gameState.entities.push(entity);
  ctx.createBattleTerrain = async () => { throw new Error('artwork missing'); };
  await assert.rejects(ctx.startBattleFromMap(fixture()), /artwork missing/);
  assert.equal(ctx.gameState.entities[0], entity);
  assert.equal(ctx.gameState.battleVersion, 0);
});

test('new floors cost 1; void cannot be walked into even with Levitation', () => {
  const ctx = setup(), state = ctx.gameState;
  const caster = { id: 'wizard', type: 'wizard', hp: 20, position: { x: 1, y: 1 }, states: [], availableSpells: [] };
  state.entities.push(caster);state.activeEntityId = caster.id;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) state.terrain.set(`${x},${y}`, 'void');
  for (const [x, type] of [[1, 'monastery-floor'], [2, 'cave-earth'], [3, 'dirt']]) {
    state.terrain.set(`${x},1`, type);
    assert.equal(state.entryCost({ x, y: 1 }, caster), 1);
  }
  assert.equal(ctx.buildPath(caster.position, { x: 3, y: 1 }, caster).length, 2);
  assert.equal(state.pathCost([{ x: 2, y: 1 }, { x: 3, y: 1 }], caster), 2);
  caster.states.push({ id: 'levitation' });
  assert.equal(state.entryCost({ x: 4, y: 1 }, caster), Infinity);
  assert.equal(state.isFree({ x: 4, y: 1 }, caster), false);
  assert.equal(ctx.buildPath(caster.position, { x: 4, y: 1 }, caster), null);
});

test('void blocks LOS and spell targets; no-LOS can reach valid floor across it', () => {
  const ctx = setup(), state = ctx.gameState;
  const caster = { id: 'wizard', type: 'wizard', hp: 20, position: { x: 1, y: 1 }, availableSpells: [], appliedEffects: [] };
  state.entities.push(caster);state.activeEntityId = caster.id;
  state.terrain.set('1,1', 'cave-earth');state.terrain.set('2,1', 'void');state.terrain.set('3,1', 'monastery-floor');
  const spell = { range: 5, minRange: 1, modifiable: false, noLOS: true };
  caster.availableSpells.push(spell);
  assert.equal(ctx.checkLOS(caster.position, { x: 3, y: 1 }), false);
  assert.equal(ctx.inSpellReach({ x: 3, y: 1 }, spell), true);
  for (const flags of [{}, { isTeleport: true }, { isSummon: true }, { isHeal: true }]) {
    Object.assign(spell, flags);
    assert.equal(ctx.inSpellReach({ x: 2, y: 1 }, spell), false);
  }
});

test('tongue pull and cone cannot cross void walls', () => {
  const ctx = setup(), state = ctx.gameState;
  const caster = { position: { x: 1, y: 1 } }, target = { position: { x: 4, y: 1 }, hp: 10 };
  state.entities.push(caster, target);
  state.terrain.set('3,1', 'void');
  assert.deepEqual(plain(ctx.getTonguePullDestination(caster, target)), { x: 4, y: 1 });
  const cone = ctx.getConeCells(caster.position, { x: 1, y: 0 }, 12, 12);
  const blocked = ctx.getBlockedConeCells(cone, { x: 1, y: 0 }, [], new Map([['2,1', 'void']]), state.keyOf);
  assert.equal(blocked.size, cone.length);
});

test('direct effect calls cannot teleport or summon into void', () => {
  const ctx = setup(), state = ctx.gameState;
  const caster = { position: { x: 1, y: 1 } };
  state.terrain.set('2,1', 'void');
  for (const spell of [{ isTeleport: true }, { isSummon: true }]) {
    ctx.applySpellEffect(spell, { x: 2, y: 1 }, caster, {});
  }
  assert.deepEqual(caster.position, { x: 1, y: 1 });
  assert.equal(state.entities.length, 0);
});

test('absolute lighting loads with independent copies and default day light', () => {
  const ctx = setup(), data = fixture();
  assert.equal(ctx.BattleLighting.at(ctx.validateBattleMap(data).lighting, 0, 0), 1);
  data.lighting = { mode: 'absolute', ambient: 80, cells: Array.from({ length: 12 }, () => Array(12).fill(null)) };
  data.lighting.cells[0][0] = 100;
  const loaded = ctx.validateBattleMap(data);
  assert.equal(ctx.BattleLighting.at(loaded.lighting, 0, 0), 1);
  assert.equal(ctx.BattleLighting.at(loaded.lighting, 1, 0), .8);
  data.lighting.cells[0][0] = 60;
  assert.equal(loaded.lighting.cells[0][0], 100);
});

test('older relative and out-of-range light follows editor migration rules', () => {
  const ctx = setup(), data = fixture();
  data.lighting = { ambient: 60, cells: Array.from({ length: 12 }, () => Array(12).fill(100)) };
  data.lighting.cells[0][0] = 150;
  const light = ctx.validateBattleMap(data).lighting;
  assert.equal(light.mode, 'absolute');
  assert.equal(ctx.BattleLighting.at(light, 0, 0), .9);
  assert.equal(light.cells[1][1], null);
  data.lighting = { mode: 'absolute', ambient: 20, cells: Array.from({ length: 12 }, () => Array(12).fill(180)) };
  const migrated = ctx.validateBattleMap(data).lighting;
  assert.equal(migrated.ambient, 60);
  assert.equal(migrated.cells[0][0], 120);
});

for (const bad of [null, {}, { ambient: 80, cells: [] },
  { mode: 'unknown', ambient: 80, cells: Array.from({ length: 12 }, () => Array(12).fill(100)) }]) {
  test(`invalid lighting rejects the map before combat resets: ${JSON.stringify(bad).slice(0, 50)}`, async () => {
    const ctx = setup(), data = fixture();
    data.lighting = bad;
    await assert.rejects(ctx.startBattleFromMap(data), /освещения/);
    assert.equal(ctx.gameState.battleVersion, 0);
  });
}

test('legacy turtle map ids normalize to dragon-turtle without mutating the file', () => {
  const ctx = setup(), data = fixture();
  ctx.CREATURE_TEMPLATES['dragon-turtle'] = { type: 'dragon-turtle', ai: 'dragon-turtle' };
  data.mobs.push({ type: 'alligator-snapping-turtle', team: 'enemy', x: 3, y: 3 });
  const loaded = ctx.validateBattleMap(data);
  assert.equal(loaded.mobs[0].type, 'dragon-turtle');
  assert.equal(data.mobs[0].type, 'alligator-snapping-turtle');
});

test('map side can differ from the default for creatures but never for heroes', () => {
  const ctx = setup(), data = fixture();
  data.mobs = [{ type: 'wolf', team: 'ally', x: 3, y: 3 }];
  assert.equal(ctx.validateBattleMap(data).mobs[0].team, 'ally');
  data.mobs[0] = { type: 'wizard', team: 'enemy', x: 3, y: 3 };
  assert.throws(() => ctx.validateBattleMap(data));
});

test('version 7 torches share creature cells, light a D5 area, and do not count as massive blockers', () => {
  const ctx = setup(), data = fixture(); data.version = 7;
  data.lighting = { mode: 'absolute', ambient: 60, cells: Array.from({ length: 12 }, () => Array(12).fill(null)) };
  data.mobs.push({ type: 'wizard', team: 'ally', x: 5, y: 5 });
  data.objects.push({ type: 'torch', x: 5, y: 5, blocking: false, interactive: false });
  data.objects.push({ type: 'crate', x: 6, y: 5, blocking: true, interactive: false });
  const loaded = ctx.validateBattleMap(data);
  assert.equal(ctx.BattleLighting.at(loaded.lighting, 5, 5), 1);
  assert.equal(ctx.BattleLighting.at(loaded.lighting, 7, 5), 0.6);
  assert.equal(ctx.BattleLighting.at(loaded.lighting, 6, 6), 1);
  assert.equal(ctx.BattleLighting.at(loaded.lighting, 5, 8), 0.6);
  assert.equal(loaded.objects[0].type, 'torch');
  data.objects[0].blocking = true;
  assert.throws(() => ctx.validateBattleMap(data));
});
test('a wall torch requires a real wall with its face directed into open terrain', () => {
  const ctx = setup(), data = fixture('underground'); data.version = 7;
  data.tiles[5][5] = 'monastery-floor';
  data.objects = [{ type: 'wall-torch', x: 5, y: 4, facing: 'south', blocking: false, interactive: false }];
  assert.equal(ctx.validateBattleMap(data).objects[0].facing, 'south');
  data.objects[0].facing = 'north';
  assert.throws(() => ctx.validateBattleMap(data));
});
test('torch rays match Battle static LOS including its corner rules', () => {
  const ctx = setup();
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) ctx.gameState.terrain.set(`${x},${y}`, 'grass');
  ctx.gameState.obstacles.set('6,5', 'crate');
  ctx.gameState.terrain.set('4,6', 'void');
  const blocked = (x, y) => ctx.gameState.obstacles.has(`${x},${y}`) || ctx.gameState.terrain.get(`${x},${y}`) === 'void';
  for (let y = 2; y < 9; y++) for (let x = 2; x < 9; x++) {
    assert.equal(ctx.MapObjects.lightLOS({ x: 5, y: 5 }, { x, y }, blocked), ctx.checkLOS({ x: 5, y: 5 }, { x, y }));
  }
});

test('convex wall torch imports old cardinal facing as a diagonal light source', () => {
  const ctx = setup(), data = fixture('underground'); data.version = 7;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (x < 5 || y < 5) data.tiles[y][x] = 'cave-earth';
  data.lighting = { mode: 'absolute', ambient: 60, cells: Array.from({ length: 12 }, () => Array(12).fill(null)) };
  data.objects = [{ type: 'wall-torch', x: 5, y: 5, facing: 'west', blocking: false, interactive: false }];
  const map = ctx.validateBattleMap(data);
  assert.equal(map.objects[0].facing, 'north-west');
  assert.equal(ctx.BattleLighting.at(map.lighting, 2, 4), 1);
  assert.equal(ctx.BattleLighting.at(map.lighting, 5, 2), 0.6);
  assert.deepEqual(plain(map.objects[0]), { type: 'wall-torch', x: 4, y: 4, wallX: 5, wallY: 5, facing: 'north-west' });
});

test('v8 lit and unlit wall torches load on floor cells with separate valid wall anchors', () => {
  const ctx = setup(), data = fixture('underground'); data.version = 8;
  for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) data.tiles[y][x] = 'monastery-floor';
  data.lighting = { mode: 'absolute', ambient: 60, cells: Array.from({ length: 12 }, () => Array(12).fill(null)) };
  data.objects = [{ type: 'unlit-wall-torch', x: 5, y: 2, wallX: 5, wallY: 1, facing: 'south', blocking: false, interactive: true },
    { type: 'unlit-torch', x: 6, y: 6, blocking: false, interactive: true }];
  let map = ctx.validateBattleMap(data);
  assert.equal(map.objects[0].x, 5); assert.equal(map.objects[0].y, 2);
  assert.equal(map.lighting.torchCells.size, 0);
  data.objects[0].type = 'wall-torch'; map = ctx.validateBattleMap(data);
  assert.equal(ctx.BattleLighting.at(map.lighting, 5, 3), 1);
  data.objects[0].wallY = 2;
  assert.throws(() => ctx.validateBattleMap(data), /крепление|стена/);
});
