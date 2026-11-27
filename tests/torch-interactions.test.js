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

for (const adrenalineFirst of [true, false]) {
  test(`monk SCC exhaustion survives Adrenaline (${adrenalineFirst ? 'limit reached during buff' : 'buff applied after limit'})`, () => {
    const { ctx, state, wizard, deps } = setup();
    const monk = ctx.createCreature('monk', { x: 2, y: 1 });
    state.entities.push(monk);
    const buff = () => ctx.applyState(monk, { id: 'adrenaline', duration: 2, casterId: wizard.id, casterName: wizard.name });
    if (adrenalineFirst) buff();
    monk.spellCastCount = monk.maxSpellCasts - 1;
    ctx.recordSpellAttempt(monk.availableSpells[0], monk, deps());
    if (!adrenalineFirst) buff();
    const exhaustion = monk.states.find(s => s.id === 'exhaustion');
    assert(exhaustion && exhaustion.permanent && exhaustion.suppressed);
    assert.equal(ctx.getEffectiveStat(monk, 'sfc'), 0);
    ctx.recordSpellAttempt(monk.availableSpells[0], monk, deps());
    assert.equal(monk.spellCastCount, monk.maxSpellCasts);
    assert.equal(monk.states.filter(s => s.id === 'exhaustion').length, 1);
    ctx.tickCasterEffects(wizard.id); ctx.tickCasterEffects(wizard.id);
    assert(ctx.hasActiveState(monk, 'exhaustion'));
    assert.equal(ctx.getEffectiveStat(monk, 'sfc'), 40, '30 exhaustion + 10 adrenaline crash');
    ctx.tickCasterEffects(wizard.id);
    assert.equal(ctx.getEffectiveStat(monk, 'sfc'), 30);
    assert.equal(monk.states.find(s => s.id === 'exhaustion'), exhaustion);
  });
}

for (const buffId of ['vigor', 'adrenaline']) {
  for (const buffFirst of [true, false]) {
    test(`HC weakness survives ${buffId}: ${buffFirst ? 'limit during buff' : 'buff after limit'}`, () => {
      const { ctx, state, wizard, deps } = setup();
      const warrior = ctx.createCreature('warrior', { x: 2, y: 1 }); state.entities.push(warrior);
      const initialACC = ctx.getRawHitChance(warrior.availableSpells[0], warrior, null);
      const buff = () => ctx.applyState(warrior, { id: buffId, duration: 2, casterId: wizard.id });
      if (buffFirst) buff();
      warrior.hitCount = warrior.maxHitCount - 1;
      ctx.recordHitAttempt(warrior.availableSpells[0], warrior, deps());
      if (!buffFirst) buff();
      const weakness = warrior.states.find(s => s.id === 'weakness');
      assert(weakness && weakness.permanent && weakness.suppressed);
      assert.equal(ctx.getRawHitChance(warrior.availableSpells[0], warrior, null), initialACC);
      ctx.recordHitAttempt(warrior.availableSpells[0], warrior, deps());
      assert.equal(warrior.hitCount, warrior.maxHitCount);
      ctx.tickCasterEffects(wizard.id); ctx.tickCasterEffects(wizard.id);
      assert(ctx.hasActiveState(warrior, 'weakness'));
      assert.equal(ctx.getRawHitChance(warrior.availableSpells[0], warrior, null), initialACC - 30 - (buffId === 'adrenaline' ? 10 : 0));
      ctx.tickCasterEffects(wizard.id);
      assert.equal(ctx.getRawHitChance(warrior.availableSpells[0], warrior, null), initialACC - 30);
      assert.equal(warrior.states.find(s => s.id === 'weakness'), weakness);
      assert.equal(warrior.states.filter(s => s.id === 'weakness').length, 1);
    });
  }
}

test('permanent weakness stays suppressed until all suppressing buffs are gone', () => {
  const { ctx, state, wizard, deps } = setup();
  const warrior = ctx.createCreature('warrior', { x: 2, y: 1 }); state.entities.push(warrior);
  warrior.hitCount = warrior.maxHitCount - 1;
  ctx.recordHitAttempt(warrior.availableSpells[0], warrior, deps());
  ctx.applyState(warrior, { id: 'adrenaline', duration: 3, casterId: wizard.id });
  ctx.applyState(warrior, { id: 'vigor', duration: 1, casterId: wizard.id });
  ctx.tickCasterEffects(wizard.id);
  assert(!ctx.hasActiveState(warrior, 'weakness'));
  ctx.removeState(warrior, 'adrenaline');
  assert(ctx.hasActiveState(warrior, 'weakness'));
  ctx.applyState(warrior, { id: 'vigor', duration: 2, casterId: wizard.id });
  ctx.removeCasterEffects(wizard.id);
  assert(ctx.hasActiveState(warrior, 'weakness'), 'death of the buff caster restores the warrior-owned penalty');
  assert.equal(warrior.states.filter(s => s.id === 'weakness').length, 1);
});

test('limit penalties upgrade existing temporary Weakness and Exhaustion to permanent', () => {
  const { ctx, wizard, deps } = setup();
  ctx.applyState(wizard, { id: 'weakness', duration: 2 });
  wizard.hitCount = wizard.maxHitCount - 1;
  ctx.recordHitAttempt({ abilityType: 'weapon-strike' }, wizard, deps());
  assert(wizard.states.find(s => s.id === 'weakness').permanent);
  ctx.applyState(wizard, { id: 'exhaustion', duration: 2 });
  wizard.spellCastCount = wizard.maxSpellCasts - 1;
  ctx.recordSpellAttempt(wizard.availableSpells[0], wizard, deps());
  // Already active temporary penalties must also be promoted by the counter handler.
  assert(wizard.states.find(s => s.id === 'exhaustion').permanent);
});


test('toad jump pays AP and cooldown, moves without MP and rejects walls, water, occupied and distant cells', () => {
  for (const kind of ['clear', 'crate', 'void', 'water', 'occupied', 'distant', 'self', 'hidden']) {
    const { ctx, state, deps } = setup();
    const toad = ctx.createCreature('giant-toad', { x: 1, y: 1 });
    state.entities = [toad]; state.activeEntityId = toad.id;
    for (const cell of state.cells) cell.getBoundingClientRect = () => ({ left: cell.dataset.x * 48, top: cell.dataset.y * 48 });
    const jump = toad.availableSpells.find(spell => spell.id === 'jump');
    assert.equal(jump.abilityType, 'ability'); assert.equal(jump.noLOS, false);
    assert.equal(jump.target, 'none'); assert.equal(jump.range, 2); assert.equal(jump.minRange, 1);
    state.preparedSpellId = jump.id;
    let target = { x: 3, y: 1 };
    if (kind === 'crate') state.obstacles.set('2,1', 'crate');
    if (kind === 'void') state.terrain.set('2,1', 'void');
    if (kind === 'water') state.terrain.set('3,1', 'shallow-water');
    if (kind === 'distant') target.x = 4;
    if (kind === 'self') target.x = 1;
    if (kind === 'occupied' || kind === 'hidden') {
      const other = ctx.createCreature('wizard', target); state.entities.push(other);
      if (kind === 'hidden') ctx.applyState(other, { id: 'invisibility', duration: 2, casterId: other.id });
    }
    const ap = toad.ap, mp = toad.mp;
    const paid = kind === 'clear' || kind === 'hidden';
    assert.equal(ctx.castSpell(state.cells[target.y * 12 + target.x], deps()), paid, kind);
    assert.equal(toad.position.x, kind === 'clear' ? 3 : 1, kind);
    assert.equal(toad.mp, mp, kind);
    assert.equal(toad.ap, ap - (paid ? 2 : 0), kind);
    assert.equal(jump.cooldown, paid ? 1 : 0, kind);
    assert.equal(jump.usesThisTurn, paid ? 1 : 0, kind);
  }
});

test('poison bite deals STR physical damage and applies one timed poison; misses and lethal hits do not poison', () => {
  for (const kind of ['hit', 'miss', 'lethal']) {
    const { ctx, state, wizard, deps } = setup();
    const toad = ctx.createCreature('giant-toad', { x: 2, y: 1 }); state.entities.push(toad);
    const bite = toad.availableSpells.find(s => s.id === 'poison-bite');
    const hp = wizard.hp = kind === 'lethal' ? 1 : wizard.maxHP;
    ctx.applySpellEffect(bite, wizard.position, toad, deps(), null, kind !== 'miss');
    assert.equal(wizard.hp, kind === 'miss' ? hp : Math.max(0, hp - 13));
    assert.equal(wizard.states.filter(s => s.id === 'weak-poison').length, kind === 'hit' ? 1 : 0);
    if (kind === 'hit') {
      wizard.hp = 100;
      ctx.applySpellEffect(bite, wizard.position, toad, deps(), null, true);
      assert.equal(wizard.states.filter(s => s.id === 'weak-poison').length, 1);
      assert.equal(wizard.states.find(s => s.id === 'weak-poison').duration, 3);
      ctx.tickCasterEffects(toad.id); ctx.tickCasterEffects(toad.id); ctx.tickCasterEffects(toad.id);
      assert(!ctx.hasActiveState(wizard, 'weak-poison'));
    }
  }
});

test('weak poison ticks once at turn start, respects poison resistance and freeze, and handles death', () => {
  for (const kind of ['normal', 'resistant', 'immune', 'frozen', 'lethal']) {
    const { ctx, state, wizard } = setup();
    ctx.applyState(wizard, { id: 'weak-poison', duration: 3, casterId: 'toad-source' });
    if (kind === 'resistant') wizard.poison = 1;
    if (kind === 'immune') wizard.poison = 2;
    if (kind === 'frozen') ctx.applyState(wizard, { id: 'freeze', duration: 2, casterId: 'toad-source' });
    const hp = wizard.hp = kind === 'lethal' ? 1 : wizard.maxHP;
    let removed = false;
    ctx.turnQueue = { activate: () => wizard };
    ctx.endTurn = () => {};
    ctx.renderSpellPanel = () => {}; ctx.clearHighlight = () => {};
    ctx.removeDefeatedEntities = () => { removed = true; };
    ctx.beginTurn();
    const damage = ['immune', 'frozen'].includes(kind) ? 0 : kind === 'resistant' ? 1 : 2;
    assert.equal(wizard.hp, Math.max(0, hp - damage), kind);
    assert.equal(removed, kind === 'lethal', kind);
  }
});

test('healing cures weak poison even at full HP and preserves existing bleeding removal', () => {
  for (const full of [true, false]) {
    const { ctx, wizard, deps, spell } = setup();
    wizard.hp = wizard.maxHP - (full ? 0 : 5);
    ctx.applyState(wizard, { id: 'weak-poison', duration: 3, casterId: 'toad-source' });
    ctx.applyState(wizard, { id: 'bleeding', duration: 2, casterId: 'toad-source' });
    const heal = ctx.createCreature('monk', { x: 2, y: 1 }).availableSpells.find(s => s.id === 'heal-harm');
    const before = wizard.hp;
    ctx.applySpellEffect(heal, wizard.position, wizard, deps());
    assert(!ctx.hasActiveState(wizard, 'weak-poison'));
    assert(!ctx.hasActiveState(wizard, 'bleeding'));
    assert.equal(wizard.hp, Math.min(wizard.maxHP, before + heal.healAmount));
  }
});

test('Maiming Strike inherits sword parameters and deals only STR damage; maims enemies but not allies', () => {
  for (const kind of ['enemy', 'ally', 'miss']) {
    const { ctx, state, deps } = setup();
    const warrior = ctx.createCreature('warrior', { x: 1, y: 1 });
    const target = ctx.createCreature(kind === 'ally' ? 'wizard' : 'wolf', { x: 2, y: 1 });
    state.entities = [warrior, target];state.activeEntityId = warrior.id;
    const [sword, maim] = warrior.availableSpells;
    for (const key of ['baseAccuracy', 'baseCritChance', 'apCost', 'range', 'minRange', 'modifiable', 'damageType', 'damagePerStr']) {
      assert.equal(maim[key], sword[key], key);
    }
    assert.equal(maim.magicSchool, 'war'); assert.equal(maim.maxCooldown, 3);
    assert.equal(maim.durationBase, 2); assert.equal(maim.damageBase, 0);
    assert.equal(ctx.getSpellDamage(maim, warrior), 2);
    const hp = target.hp, maxMP = target.maxMP;
    ctx.applySpellEffect(maim, target.position, warrior, deps(), null, kind !== 'miss');
    assert.equal(target.hp, hp - (kind === 'miss' ? 0 : 2));
    assert.equal(ctx.hasActiveState(target, 'maimed'), kind === 'enemy');
    if (kind === 'enemy') {
      assert.equal(target.maxMP, maxMP - 2);
      ctx.applySpellEffect(maim, target.position, warrior, deps(), null, true);
      assert.equal(target.states.filter(s => s.id === 'maimed').length, 1);
      assert.equal(target.maxMP, maxMP - 2);
      ctx.tickCasterEffects(warrior.id);ctx.tickCasterEffects(warrior.id);
      assert.equal(ctx.hasActiveState(target, 'maimed'), false);
      assert.equal(target.maxMP, maxMP);
    }
  }
});

test('Maiming Strike pays weapon AP, starts its own cooldown and preserves the ordinary sword counter', () => {
  const { ctx, state, deps } = setup();
  const warrior = ctx.createCreature('warrior', { x: 1, y: 1 });
  const wolf = ctx.createCreature('wolf', { x: 2, y: 1 });
  state.entities = [warrior, wolf];state.activeEntityId = warrior.id;
  const [sword, maim] = warrior.availableSpells;
  state.preparedSpellId = maim.id;
  const ap = warrior.ap;
  assert(ctx.castSpell(state.cells[14], { ...deps(), playBiteAnimation() {} }));
  assert.equal(warrior.ap, ap - sword.apCost);
  assert.equal(maim.cooldown, 3);assert.equal(maim.usesThisTurn, 1);
  assert.equal(sword.cooldown, 0);assert.equal(sword.usesThisTurn, 0);
});

test('Charge moves only along cardinal lines and adds weapon STR damage per actual movement cell', () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const range of [1, 2, 3]) {
    const { ctx, state, deps } = setup();
    const warrior = ctx.createCreature('warrior', { x: 5, y: 5 });
    const target = ctx.createCreature('wolf', { x: 5 + dx * range, y: 5 + dy * range });
    state.entities = [warrior, target];state.activeEntityId = warrior.id;
    const charge = warrior.availableSpells.find(s => s.id === 'charge');
    state.preparedSpellId = charge.id;
    const hp = target.hp, mp = warrior.mp, ap = warrior.ap;
    assert(ctx.canTarget(target.position, charge));
    assert(ctx.castSpell(state.cells[target.position.y * 12 + target.position.x], { ...deps(), playBiteAnimation() {} }));
    assert.equal(warrior.position.x, 5 + dx * (range - 1));
    assert.equal(warrior.position.y, 5 + dy * (range - 1));
    assert.equal(target.hp, hp - (2 + 2 * range));
    assert.equal(warrior.ap, ap - 4);assert.equal(warrior.mp, mp);
    assert.equal(charge.cooldown, 3);assert.equal(charge.maxUsesPerTurn, 1);
  }
});

test('Charge rejects diagonal, distant, obstructed and unwalkable routes before spending AP', () => {
  for (const kind of ['diagonal', 'distant', 'crate', 'water', 'void', 'creature']) {
    const { ctx, state, deps } = setup();
    const warrior = ctx.createCreature('warrior', { x: 1, y: 1 });
    const target = ctx.createCreature('wolf', { x: 4, y: 1 });
    state.entities = [warrior, target];state.activeEntityId = warrior.id;
    const charge = warrior.availableSpells.find(s => s.id === 'charge');state.preparedSpellId = charge.id;
    if (kind === 'diagonal') target.position = { x: 2, y: 2 };
    if (kind === 'distant') target.position.x = 5;
    if (kind === 'crate') state.obstacles.set('2,1', 'crate');
    if (kind === 'water') state.terrain.set('2,1', 'deep-water');
    if (kind === 'void') state.terrain.set('2,1', 'void');
    if (kind === 'creature') state.entities.push(ctx.createCreature('monk', { x: 2, y: 1 }));
    const ap = warrior.ap;
    assert.equal(ctx.canTarget(target.position, charge), false, kind);
    assert.equal(ctx.castSpell(state.cells[target.position.y * 12 + target.position.x], deps()), false, kind);
    assert.equal(warrior.ap, ap);assert.equal(charge.cooldown, 0);
  }
});

test('Charge movement survives an attack miss and can damage an allied target', () => {
  for (const ally of [false, true]) {
    const { ctx, state, deps } = setup();
    const warrior = ctx.createCreature('warrior', { x: 1, y: 1 });
    const target = ctx.createCreature(ally ? 'wizard' : 'wolf', { x: 4, y: 1 });
    state.entities = [warrior, target];state.activeEntityId = warrior.id;
    const charge = warrior.availableSpells.find(s => s.id === 'charge');state.preparedSpellId = charge.id;
    const hp = target.hp;
    assert(ctx.castSpell(state.cells[16], { ...deps(), playBiteAnimation() {}, shotHits: () => ally }));
    assert.equal(warrior.position.x, 3);
    assert.equal(target.hp, hp - (ally ? 8 : 0));
  }
});

test('Charge preview includes travel damage but an unseen blocker stops the actual movement and attack', () => {
  const { ctx, state, deps } = setup();
  const warrior = ctx.createCreature('warrior', { x: 1, y: 1 });
  const target = ctx.createCreature('wolf', { x: 4, y: 1 });
  const hidden = ctx.createCreature('monk', { x: 3, y: 1 });hidden.team = 'enemy';
  state.entities = [warrior, target, hidden];state.activeEntityId = warrior.id;
  ctx.applyState(hidden, { id: 'invisibility', duration: 2, casterId: hidden.id });
  const charge = warrior.availableSpells.find(s => s.id === 'charge');state.preparedSpellId = charge.id;
  assert(ctx.canTarget(target.position, charge));
  ctx.altHeld = true;ctx.showEffectPreview([target.position], charge, target.position);
  assert(state.effectBadges[0].textContent.startsWith('Урон: 8 [Крит: 8]'));
  const hp = target.hp;let blocked = false;
  ctx.battleLog = { cast() {}, blocked() { blocked = true; } };
  assert(ctx.castSpell(state.cells[16], { ...deps(), playBiteAnimation() {} }));
  assert.equal(warrior.position.x, 2);
  assert.equal(target.hp, hp);assert.equal(blocked, true);
});


test('Charge range includes empty cardinal cells; casting there pays and fails without movement', () => {
  for (const deadTarget of [false, true]) {
    const { ctx, state, deps } = setup();
    const warrior = ctx.createCreature('warrior', { x: 5, y: 5 });
    state.entities = [warrior];state.activeEntityId = warrior.id;
    const charge = warrior.availableSpells.find(s => s.id === 'charge');state.preparedSpellId = charge.id;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 1; d <= 3; d++) {
      assert(ctx.canTarget({ x: 5 + dx * d, y: 5 + dy * d }, charge));
    }
    if (deadTarget) {
      const corpse = ctx.createCreature('wolf', { x: 8, y: 5 });corpse.hp = 0;state.entities.push(corpse);
    }
    let failures = 0, animations = 0;
    ctx.battleLog = { cast() {}, failure() { failures++; } };
    const ap = warrior.ap, mp = warrior.mp;
    assert(ctx.castSpell(state.cells[5 * 12 + 8], { ...deps(), playFailureAnimation() { animations++; },
      playChargeAnimation() { throw new Error('empty-cell charge must not move'); } }));
    assert.equal(warrior.position.x, 5);assert.equal(warrior.position.y, 5);
    assert.equal(warrior.ap, ap - charge.apCost);assert.equal(warrior.mp, mp);
    assert.equal(charge.cooldown, 3);assert.equal(charge.usesThisTurn, 1);
    assert.equal(failures, 1);assert.equal(animations, 1);
  }
});

test('movement penalties stack without a lower bound and removal preserves negative spent MP', () => {
  const { ctx, state } = setup();
  const toad = ctx.createCreature('giant-toad', { x: 2, y: 1 });state.entities.push(toad);
  toad.mp = 1; // Two points already spent out of three.
  ctx.applyState(toad, { id: 'slowness', duration: 2 });
  assert.equal(toad.maxMP, 1);assert.equal(toad.mp, -1);
  ctx.applyState(toad, { id: 'maimed', duration: 2 });
  assert.equal(toad.maxMP, -1);assert.equal(toad.mp, -3);
  ctx.removeState(toad, 'slowness');
  assert.equal(toad.maxMP, 1);assert.equal(toad.mp, -1);
  ctx.applyState(toad, { id: 'slowness', duration: 2, mpBonus: -100 });
  assert.equal(toad.maxMP, -99);assert.equal(toad.mp, -101);
  ctx.removeState(toad, 'slowness');ctx.removeState(toad, 'maimed');
  assert.equal(toad.maxMP, 3);assert.equal(toad.mp, 1);
});

test('Heavy blocks jumping before AP payment, Light restores it, and teleport remains allowed', () => {
  const { ctx, state, wizard, deps } = setup();
  const toad = ctx.createCreature('giant-toad', { x: 1, y: 1 });
  state.entities = [toad];state.activeEntityId = toad.id;
  const jump = toad.availableSpells.find(s => s.id === 'jump');state.preparedSpellId = jump.id;
  ctx.applyState(toad, { id: 'heavy', duration: 2 });
  assert.equal(ctx.canPrepareSpell(jump), false);assert.equal(ctx.canTarget({ x: 3, y: 1 }, jump), false);
  const ap = toad.ap;
  assert.equal(ctx.castSpell(state.cells[15], deps()), false);
  assert.equal(toad.ap, ap);assert.equal(jump.cooldown, 0);
  ctx.applySpellEffect(jump, { x: 3, y: 1 }, toad, deps());
  assert.equal(toad.position.x, 1);
  ctx.applyState(toad, { id: 'light', duration: 2 });
  assert.equal(ctx.canPrepareSpell(jump), true);
  assert.equal(ctx.canTarget({ x: 3, y: 1 }, jump), true);
  state.entities = [wizard];state.activeEntityId = wizard.id;
  const teleport = wizard.availableSpells.find(s => s.id === 'teleport');state.preparedSpellId = teleport.id;
  ctx.applyState(wizard, { id: 'heavy', duration: 2 });
  assert.equal(ctx.canPrepareSpell(teleport), true);
  assert(ctx.castSpell(state.cells[15], { ...deps(), playTeleportAnimation() {} }));
  assert.equal(wizard.position.x, 3);
});

test('Heavy suppresses levitation regardless of application order and Light restores water crossing', () => {
  for (const heavyFirst of [false, true]) {
    const { ctx, state, wizard } = setup();
    const apply = id => ctx.applyState(wizard, { id, duration: 3, casterId: wizard.id });
    if (heavyFirst) apply('heavy');
    apply('levitation');
    if (!heavyFirst) apply('heavy');
    state.terrain.set('2,1', 'shallow-water');
    const levitation = wizard.states.find(s => s.id === 'levitation');
    assert(levitation && levitation.suppressed);
    assert.equal(ctx.hasActiveState(wizard, 'levitation'), false);
    assert.equal(state.entryCost({ x: 2, y: 1 }, wizard), Infinity);
    apply('light');
    assert.equal(ctx.hasActiveState(wizard, 'heavy'), false);
    assert.equal(ctx.hasActiveState(wizard, 'levitation'), true);
    assert.equal(state.entryCost({ x: 2, y: 1 }, wizard), 1);
    ctx.removeState(wizard, 'light');
    assert.equal(ctx.hasActiveState(wizard, 'levitation'), false);
    ctx.removeState(wizard, 'heavy');
    assert.equal(ctx.hasActiveState(wizard, 'levitation'), true);
  }
});

test('suppressed levitation still expires and is not recreated when Heavy is removed', () => {
  const { ctx, state, wizard } = setup();
  const toad = ctx.createCreature('giant-toad', { x: 2, y: 1 });state.entities.push(toad);
  ctx.applyState(wizard, { id: 'levitation', duration: 1, casterId: wizard.id });
  ctx.applyState(wizard, { id: 'heavy', duration: 3, casterId: toad.id });
  ctx.tickCasterEffects(wizard.id);
  assert(!wizard.states.some(s => s.id === 'levitation'));
  ctx.removeState(wizard, 'heavy');
  assert.equal(ctx.hasActiveState(wizard, 'levitation'), false);
});
