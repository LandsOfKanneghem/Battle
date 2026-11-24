const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function setup() {
  const element = () => {
    const classes = new Set();
    return { dataset: {}, style: { setProperty() {} }, setAttribute() {}, appendChild() {}, remove() {}, querySelector() { return null; },
      classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) } };
  };
  const ctx = { document: { getElementById: element, createElement: element, createElementNS: element },
    renderPosition() {}, updatePanel() {}, removeDefeatedEntities() {}, setTimeout: callback => callback(), queueMicrotask: callback => callback() };
  ctx.window = ctx;
  vm.createContext(ctx);
  const data = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);
  for (const file of ['gameState.js', ...data, 'mapObjects.js', 'lighting.js', 'torchInteractions.js', 'combat.js', 'spellTargeting.js', 'spellLogic.js', 'movement.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  }
  const state = ctx.gameState;
  const tiles = Array.from({ length: 12 }, () => Array(12).fill('grass'));
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) state.terrain.set(`${x},${y}`, tiles[y][x]);
  state.cells = Array.from({ length: 144 }, (_, i) => Object.assign(element(), { dataset: { x: i % 12, y: Math.floor(i / 12) } }));
  state.lighting = ctx.BattleLighting.read(); state.lighting.ambient = 60;
  state.battleMap = { mapType: 'surface', tiles, objects: state.mapObjects };
  const wizard = ctx.createCreature('wizard', { x: 1, y: 1 });
  wizard.ap = 100;
  state.entities = [wizard]; state.activeEntityId = wizard.id;
  const spell = id => vm.runInContext(`SPELL_DEFINITIONS.find(spell => spell.id === '${id}')`, ctx);
  const torch = (type, x, y) => { const object = { type, x, y, element: element() }; state.mapObjects.push(object); return object; };
  ctx.playMissAnimation = () => {};
  ctx.playFailureAnimation = () => {};
  ctx.playProjectileAnimation = (from, to, type, onDone) => onDone();
  const deps = () => ({ ...ctx, stateTypes: vm.runInContext('stateTypes', ctx), shotHits: () => true });
  return { ctx, state, wizard, torch, spell, deps };
}

test('non-shot fire lights a torch; non-shot water extinguishes it and restores underlying light', () => {
  const { ctx, state, wizard, torch, spell, deps } = setup();
  const object = torch('unlit-torch', 3, 1);
  state.lighting.cells[1][3] = 120;
  ctx.applySpellEffect(spell('fire-cube'), object, wizard, deps());
  assert.equal(object.type, 'torch');
  assert.equal(ctx.BattleLighting.at(state.lighting, 3, 1), 1);
  const water = { abilityType: 'spell', isShot: false, damageBase: 3, damageType: 'water', aoeSize: 1 };
  ctx.applySpellEffect(water, object, wizard, deps());
  assert.equal(object.type, 'unlit-torch');
  assert.equal(ctx.BattleLighting.at(state.lighting, 3, 1), 1.2);
  assert.equal(ctx.BattleLighting.at(state.lighting, 4, 1), .6);
  assert.equal(state.lighting.cells[1][3], 120, 'torch never overwrites brush values');
});

test('AOE and Wet affect both variants; unrelated spells and already matching states are not outlined', () => {
  const { ctx, wizard, torch, spell, deps } = setup();
  const a = torch('unlit-torch', 3, 1), b = torch('wall-torch', 4, 2), far = torch('torch', 10, 10);
  const area = [{ x: 3, y: 1 }, { x: 4, y: 2 }];
  ctx.highlightTorchChanges(area, spell('fire-cube'), wizard);
  assert(a.element.classList.contains('spell-target'));
  assert(!b.element.classList.contains('spell-target'));
  ctx.clearHighlight();
  assert(!a.element.classList.contains('spell-target'));
  ctx.applySpellEffect(spell('fire-cube'), { x: 3, y: 1 }, wizard, deps());
  assert.equal(a.type, 'torch');
  ctx.highlightTorchChanges(area, spell('rain'), wizard);
  assert(a.element.classList.contains('spell-target') && b.element.classList.contains('spell-target'));
  ctx.applySpellEffect(spell('rain'), { x: 3, y: 1 }, wizard, deps());
  assert.equal(a.type, 'unlit-torch'); assert.equal(b.type, 'unlit-wall-torch'); assert.equal(far.type, 'torch');
  assert.equal(ctx.torchChanges(area, spell('rain'), wizard).length, 0);
  assert.equal(ctx.torchChanges(area, spell('haste'), wizard).length, 0);
  assert.equal(ctx.torchChanges(area, spell('sparks'), wizard).length, 0);
});

test('paid failed casts and missed shots do not change torches', () => {
  const { ctx, state, wizard, torch, deps } = setup();
  const object = torch('unlit-torch', 3, 1);
  const fire = wizard.availableSpells.find(spell => spell.id === 'fire-shot');
  state.preparedSpellId = fire.id;
  ctx.getEffectiveStat = () => 100; // SFC guarantees failure.
  assert(ctx.castSpell(state.cells[15], deps()));
  assert.equal(object.type, 'unlit-torch');
  assert.equal(wizard.ap, 100 - fire.apCost);
  assert.equal(fire.usesThisTurn, 1);
  const enemy = ctx.createCreature('wolf', { x: 3, y: 1 }); state.entities.push(enemy);
  ctx.applySpellEffect(fire, object, wizard, { ...deps(), shotHits: () => false });
  assert.equal(object.type, 'unlit-torch', 'a miss on a creature sharing the torch cell has no effect');
});

test('floor-anchored wall torch is targetable with ordinary LOS, and walls still block light and casts', () => {
  const { ctx, state, wizard, torch, deps } = setup();
  state.battleMap.mapType = 'underground';
  for (let x = 0; x < 12; x++) {
    state.battleMap.tiles[0][x] = 'void'; state.terrain.set(`${x},0`, 'void'); state.obstacles.set(`${x},0`, 'void');
  }
  const object = torch('unlit-wall-torch', 3, 1);
  Object.assign(object, { wallX: 3, wallY: 0, facing: 'south' });
  const fire = wizard.availableSpells.find(spell => spell.id === 'fire-shot');
  fire.isShot = false; // A non-shot fire spell exercises wall targeting.
  assert(ctx.MapObjects.canPlace(state.battleMap, object, [], object));
  assert(ctx.canTarget(object, fire));
  state.preparedSpellId = fire.id;
  assert(ctx.castSpell(state.cells[15], deps()));
  assert.equal(object.type, 'wall-torch');
  assert(!state.lighting.torchCells.has('3,0'));
  state.terrain.set('2,1', 'void'); state.obstacles.set('2,1', 'void');
  assert(!ctx.canTarget(object, fire), 'the wall between caster and torch blocks the spell');
  assert.equal(wizard.mp, wizard.maxMP, 'torch interactions do not spend movement');
});

test('cone shadows also exclude torches behind solid obstacles', () => {
  const { ctx, state, wizard, torch, spell, deps } = setup();
  const near = torch('unlit-torch', 2, 1), behind = torch('unlit-torch', 3, 1);
  state.obstacles.set('2,1', 'crate');
  ctx.applySpellEffect(spell('burning-hands'), { x: 2, y: 1 }, wizard, deps());
  assert.equal(near.type, 'unlit-torch'); assert.equal(behind.type, 'unlit-torch');
  state.obstacles.clear();
  ctx.applySpellEffect(spell('burning-hands'), { x: 2, y: 1 }, wizard, deps());
  assert.equal(near.type, 'torch'); assert.equal(behind.type, 'torch');
});

test('Torch spell follows its carrier, survives rain, and expires after three caster ticks', () => {
  const { ctx, state, wizard, spell, deps } = setup();
  const light = wizard.availableSpells.find(spell => spell.id === 'torch');
  assert(light && light.magicSchool === 'fire');
  assert.equal(light.apCost, 2); assert.equal(light.maxCooldown, 5);
  assert.equal(ctx.getSpellDuration(light, wizard), 3);
  assert(ctx.canTarget(wizard.position, light));
  assert(!ctx.canTarget({ x: 2, y: 1 }, light));
  state.preparedSpellId = light.id;
  assert(ctx.castSpell(state.cells[13], deps()));
  assert.equal(wizard.ap, 98); assert.equal(light.cooldown, 5);
  assert.equal(wizard.appliedEffects.find(effect => effect.isTorchLight).duration, 3);
  assert.equal(state.lighting.torchCells.size, 11, 'D5 is clipped at the map edge');
  wizard.position = { x: 5, y: 5 }; ctx.refreshTorchLighting();
  assert.equal(state.lighting.torchCells.size, 13);
  assert.equal(ctx.BattleLighting.at(state.lighting, 1, 1), .6);
  assert.equal(ctx.BattleLighting.at(state.lighting, 7, 5), 1);
  ctx.applySpellEffect(spell('rain'), wizard.position, wizard, deps());
  assert(ctx.hasActiveState(wizard, 'wet'));
  assert.equal(wizard.appliedEffects.find(effect => effect.isTorchLight).duration, 3);
  assert.equal(ctx.BattleLighting.at(state.lighting, 7, 5), 1);
  ctx.tickCasterEffects(wizard.id); ctx.tickCasterEffects(wizard.id);
  assert.equal(ctx.BattleLighting.at(state.lighting, 7, 5), 1);
  ctx.tickCasterEffects(wizard.id);
  assert(!wizard.appliedEffects.some(effect => effect.isTorchLight));
  assert.equal(ctx.BattleLighting.at(state.lighting, 7, 5), .6);
});

test('mobile light respects static blockers and disappears with its source effect', () => {
  const { ctx, state, wizard, spell, deps } = setup();
  wizard.position = { x: 5, y: 5 };
  state.mapObjects.push({ type: 'crate', x: 6, y: 5 });
  ctx.applySpellEffect(spell('torch'), wizard.position, wizard, deps());
  assert.equal(ctx.BattleLighting.at(state.lighting, 7, 5), .6);
  assert.equal(ctx.BattleLighting.at(state.lighting, 5, 7), 1);
  ctx.removeCasterEffects(wizard.id);
  assert.equal(ctx.BattleLighting.at(state.lighting, 5, 7), .6);
});

test('shots never change or outline any torch, including shots with an AOE or Wet', () => {
  const { ctx, wizard, torch, spell, deps } = setup();
  for (const type of ['torch', 'unlit-torch', 'wall-torch', 'unlit-wall-torch']) {
    const object = torch(type, 3, 1);
    for (const shot of [spell('fire-shot'), { ...spell('ice-arrow'), isAOE: true, aoeSize: 3 },
      { ...spell('rain'), isShot: true }]) {
      assert.equal(ctx.torchChanges([object], shot, wizard).length, 0);
      ctx.highlightTorchChanges([object], shot, wizard);
      assert(!object.element.classList.contains('spell-target'));
      ctx.applySpellEffect(shot, object, wizard, deps());
      assert.equal(object.type, type);
    }
  }
});

test('Light Flash pays for empty and allied cells but damages only enemies', () => {
  const { ctx, state, wizard, deps } = setup();
  const monk = ctx.createCreature('monk', { x: 1, y: 2 });
  const enemy = ctx.createCreature('wolf', { x: 3, y: 2 });
  state.entities.push(monk, enemy); state.activeEntityId = monk.id; monk.ap = 100;
  const flash = monk.availableSpells.find(spell => spell.id === 'light-flash');
  const before = wizard.hp;
  const cast = point => {
    flash.usesThisTurn = 0; state.preparedSpellId = flash.id;
    assert(ctx.canTarget(point, flash));
    const ap = monk.ap;
    assert(ctx.castSpell(state.cells[point.y * 12 + point.x], { ...deps(), playLightFlashAnimation() {} }));
    assert.equal(monk.ap, ap - flash.apCost);
    assert.equal(flash.usesThisTurn, 1);
  };
  cast({ x: 2, y: 2 });
  cast(wizard.position); assert.equal(wizard.hp, before);
  assert(!ctx.isSpellPreviewTarget(wizard, flash, monk, wizard.position));
  const hp = enemy.hp; cast(enemy.position);
  assert(enemy.hp < hp);
});
