const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dataScripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .matchAll(/src="(data\/[^\"]+\.js)"/g)].map(match => match[1]);

function setup() {
  const context = { gameState: { effectOrder: 0 },
    document: { createElementNS: () => ({ style: {}, setAttribute() {} }) } };
  context.window = context;
  vm.createContext(context);
  for (const file of dataScripts) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('every creature template file is connected to the game', () => {
  for (const file of fs.readdirSync(path.join(root, 'data/creatures')).filter(file => file.endsWith('.js'))) {
    assert.ok(dataScripts.includes(`data/creatures/${file}`), `${file} must be loaded by index.html`);
  }
});

test('warrior is the third allied hero with separate body armor and shield and a sword strike', () => {
  const ctx = setup();
  vm.runInContext(fs.readFileSync(path.join(root, 'combat.js'), 'utf8'), ctx);
  const warrior = ctx.createCreature('warrior', { x: 1, y: 1 });
  assert.equal(warrior.name, 'Воин'); assert.equal(warrior.level, 1);
  assert.equal(warrior.id, 'warrior'); assert(ctx.gameState.isAlly(warrior));
  assert.equal(warrior.ai, undefined); assert.equal(warrior.partyOrder, 3);
  assert.equal(warrior.baseHP, 16); assert.equal(warrior.hpPerLevel, 8); assert.equal(warrior.maxHP, 40);
  assert.equal(warrior.baseWP, 10); assert.equal(warrior.wpPerLevel, 4); assert.equal(warrior.maxWP, 14);
  assert.equal(warrior.maxAP, 6); assert.equal(warrior.maxMP, 4);
  assert.equal(JSON.stringify(warrior.attributes), JSON.stringify({vit:2,str:2,att:2,int:0,wis:1,cha:0,luc:1}));
  assert.equal(ctx.getEffectiveStat(warrior, 'ac'), 5);
  assert.deepEqual(Array.from(warrior.armorSources, source => [source.ac, source.maxDurability, source.durability]), [[4,10,10],[1,5,5]]);
  assert.equal(warrior.availableSpells.length, 3);
  const strike = warrior.availableSpells[0];
  for (const [key, value] of Object.entries({ id: 'sword-strike', name: 'Удар мечом', description: undefined,
    abilityType: 'weapon-strike', apCost: 3, maxCooldown: 0, maxUsesPerTurn: 2,
    damageType: 'physical', damageBase: 2, damagePerStr: 1, minRange: 1, range: 1,
    modifiable: false, noLOS: false, aoeSize: 1, target: 'any', isShot: false })) assert.equal(strike[key], value, key);
  assert.equal(ctx.getSpellDamage(strike, warrior), 4);
  const mage = ctx.createCreature('wizard', { x: 2, y: 1 }), monk = ctx.createCreature('monk', { x: 3, y: 1 });
  ctx.preparePartyOrder([warrior, monk, mage]);
  assert.deepEqual([mage.partyOrder, monk.partyOrder, warrior.partyOrder], [1,2,3]);
});

test('all registered creature books resolve, with independent local catalogs for nonheroes', () => {
  const ctx = setup();
  const common = vm.runInContext('SPELL_DEFINITIONS', ctx);
  for (const id of ['bite', 'boulder-smash', 'boulder-throw', 'water-shot']) {
    assert.equal(common.some(spell => spell.id === id), false, `${id} moved out of shared spells`);
  }
  for (const [type, template] of Object.entries(ctx.CREATURE_TEMPLATES)) {
    const creature = ctx.createCreature(type, { x: 1, y: 1 });
    assert.ok(template.spellPages.every(page => page.length === 20));
    const count = template.spellPages.flat().filter(Boolean).length;
    assert.equal(creature.availableSpells.length, count, `${type} has no unresolved slots`);
    if (type === 'wizard' || type === 'monk') assert.equal(template.spells, undefined);
    else {
      assert.ok(Array.isArray(template.spells));
      for (const spell of creature.availableSpells) {
        assert.ok(template.spells.some(definition => definition.id === spell.id));
      }
    }
  }
});

test('wolf ability tuning is local even when another creature or shared spell has the same id', () => {
  const ctx = setup();
  const wolf = ctx.CREATURE_TEMPLATES.wolf.spells[0];
  const blackWolf = ctx.CREATURE_TEMPLATES['black-wolf'].spells[0];
  assert.notEqual(wolf, blackWolf);
  assert.equal(wolf.name, blackWolf.name);
  const originalBlackDamage = blackWolf.damageBase;
  wolf.damageBase += 7;
  vm.runInContext("SPELL_DEFINITIONS.push({ id: 'bite', damageBase: 999 })", ctx);
  assert.equal(ctx.createCreature('wolf', { x: 1, y: 1 }).availableSpells[0].damageBase, wolf.damageBase);
  assert.equal(ctx.createCreature('black-wolf', { x: 2, y: 1 }).availableSpells[0].damageBase, originalBlackDamage);
});

test('ability instances, counters and innate state arrays are not shared between creatures', () => {
  const ctx = setup();
  const first = ctx.createCreature('lake-spirit', { x: 1, y: 1 });
  const second = ctx.createCreature('lake-spirit', { x: 2, y: 1 });
  const definition = ctx.CREATURE_TEMPLATES['lake-spirit'].spells[0];
  const spell = first.availableSpells[0];
  assert.equal(first.spellPages[0][0], spell);
  assert.notEqual(spell, definition);
  assert.notEqual(spell, second.availableSpells[0]);
  spell.cooldown = 3;
  spell.usesThisTurn = 2;
  spell.usesTotal = 9;
  assert.equal(second.availableSpells[0].cooldown, 0);
  assert.equal(second.availableSpells[0].usesThisTurn, 0);
  assert.equal(second.availableSpells[0].usesTotal, 0);
  assert.equal(definition.cooldown, undefined);
  first.states[0].overrides.push('test');
  assert.equal(second.states[0].overrides.includes('test'), false);
});

test('creatures with their own bite can be tuned without changing wolves or existing instances', () => {
  const ctx = setup();
  const wolfTemplate = ctx.CREATURE_TEMPLATES.wolf;
  const wolfDamage = wolfTemplate.spells[0].damageBase;
  for (const type of ['dragon-turtle', 'hound', 'werewolf']) {
    const template = ctx.CREATURE_TEMPLATES[type];
    assert.notEqual(template.attributes, wolfTemplate.attributes);
    assert.notEqual(template.spells[0], wolfTemplate.spells[0]);
    const creature = ctx.createCreature(type, { x: 2, y: 1 });
    const damage = creature.availableSpells[0].damageBase;
    creature.availableSpells[0].usesThisTurn = 1;
    template.spells[0].damageBase += 5;
    assert.equal(creature.availableSpells[0].damageBase, damage);
    assert.equal(ctx.createCreature('wolf', { x: 1, y: 1 }).availableSpells[0].usesThisTurn, 0);
    assert.equal(wolfTemplate.spells[0].damageBase, wolfDamage);
  }
});

test('hound starts with the ordinary wolf stats and abilities', () => {
  const ctx = setup();
  const wolfTemplate = ctx.CREATURE_TEMPLATES.wolf;
  const houndTemplate = ctx.CREATURE_TEMPLATES.hound;
  const stats = template => Object.fromEntries(Object.entries(template)
    .filter(([key]) => !['name', 'type', 'ai', 'appearance'].includes(key)));
  assert.deepEqual(stats(houndTemplate), stats(wolfTemplate));
  const wolf = ctx.createCreature('wolf', { x: 1, y: 1 });
  const hound = ctx.createCreature('hound', { x: 2, y: 1 });
  for (const key of ['level', 'hp', 'maxHP', 'wp', 'maxWP', 'ap', 'maxAP', 'mp', 'maxMP', 'maxHitCount']) {
    assert.equal(hound[key], wolf[key], key);
  }
  assert.equal(hound.ai, hound.type);
});

test('sprite, portrait and local ability icon paths live with each creature and point to existing assets', () => {
  const ctx = setup();
  for (const template of Object.values(ctx.CREATURE_TEMPLATES)) {
    const { sprite, portrait, displaySize, padding } = template.appearance;
    const sourceSize = template.appearance.sourceSize ?? ctx.DEFAULT_CREATURE_SOURCE_SIZE;
    const png = fs.readFileSync(path.join(root, sprite));
    assert.equal(png.readUInt32BE(16), sourceSize.width, `${template.type} PNG width`);
    assert.equal(png.readUInt32BE(20), sourceSize.height, `${template.type} PNG height`);
    for (const file of [sprite, portrait, ...(template.spells ?? []).map(spell => spell.iconPath).filter(Boolean)]) {
      assert.ok(fs.existsSync(path.join(root, file)), file);
    }
    assert.ok(displaySize.width > 0 && displaySize.height > 0);
    assert.ok(padding.left + padding.right < sourceSize.width);
    assert.ok(padding.top + padding.bottom < sourceSize.height);
  }
});

test('giant toad has its own tuned stats, independent attributes and three abilities', () => {
  const ctx = setup();
  const giant = ctx.CREATURE_TEMPLATES['hill-giant'];
  const toad = ctx.CREATURE_TEMPLATES['giant-toad'];
  assert.equal(toad.baseHP, 24); assert.equal(toad.hpPerLevel, 8);
  assert.equal(toad.baseAP, 7); assert.equal(toad.basePoison, 4);
  assert.deepEqual(toad.attributes, giant.attributes);
  assert.notEqual(toad.attributes, giant.attributes);
  const entity = ctx.createCreature('giant-toad', { x: 2, y: 1 });
  assert.equal(entity.type, 'giant-toad');
  assert.equal(entity.ai, 'giant-toad');
  assert.equal(entity.availableSpells.length, 3);
  assert.equal(entity.availableSpells[0].id, 'tongue-pull');
  assert.equal(entity.spellPages.length, 1);
  assert.equal(entity.spellPages[0][0], entity.availableSpells[0]);
  assert.equal(entity.spellPages[0][1].id, 'jump');
  assert.equal(entity.spellPages[0][2].id, 'poison-bite');
  assert.ok(entity.spellPages[0].slice(3).every(slot => slot === null));
  assert.equal(entity.hitCount, 0);
  for (const key of ['level', 'baseHP', 'hpPerLevel', 'baseWP', 'wpPerLevel']) assert.equal(entity[key], toad[key], key);
});

test('player party order is copied from templates and fixed for the battle', () => {
  const ctx = setup();
  ctx.gameState.isAlly = entity => ['wizard', 'monk'].includes(entity.type) || entity.isSummon === true;
  const wizard = ctx.createCreature('wizard', { x: 1, y: 1 });
  const monk = ctx.createCreature('monk', { x: 2, y: 1 });
  assert.equal(wizard.partyOrder, 1);
  assert.equal(monk.partyOrder, 2);
  ctx.preparePartyOrder([monk, wizard]);
  ctx.CREATURE_TEMPLATES.wizard.partyOrder = 10;
  assert.equal(wizard.partyOrder, 1, 'editing a template cannot change an ongoing battle');
  assert.equal(Reflect.set(wizard, 'partyOrder', 2), false, 'battle ranks are immutable');
  wizard.hp = 0;
  assert.equal(monk.partyOrder, 2, 'death does not renumber the party');
  const nextWizard = ctx.createCreature('wizard', { x: 1, y: 2 });
  const nextMonk = ctx.createCreature('monk', { x: 2, y: 2 });
  ctx.preparePartyOrder([nextWizard, nextMonk]);
  assert.equal(nextMonk.partyOrder, 1);
  assert.equal(nextWizard.partyOrder, 2, 'new template preferences apply in the next battle');
});

test('werewolf has independent giant stats and its own copy of the ordinary wolf bite', () => {
  const ctx = setup();
  const giant = ctx.CREATURE_TEMPLATES['hill-giant'];
  const wolf = ctx.CREATURE_TEMPLATES.wolf;
  const werewolf = ctx.CREATURE_TEMPLATES.werewolf;
  for (const key of Object.keys(giant).filter(key => typeof giant[key] === 'number')) {
    assert.equal(werewolf[key], giant[key], key);
  }
  assert.deepEqual(werewolf.attributes, giant.attributes);
  assert.notEqual(werewolf.attributes, giant.attributes);
  assert.deepEqual(werewolf.spells, wolf.spells);
  assert.notEqual(werewolf.spells[0], wolf.spells[0]);
  const entity = ctx.createCreature('werewolf', { x: 2, y: 1 });
  const other = ctx.createCreature('hill-giant', { x: 3, y: 1 });
  for (const key of ['level', 'hp', 'maxHP', 'wp', 'maxWP', 'ap', 'maxAP', 'mp', 'maxMP', 'maxHitCount']) {
    assert.equal(entity[key], other[key], key);
  }
  assert.equal(entity.ai, 'werewolf');
  assert.equal(entity.availableSpells.length, 1);
  assert.equal(entity.spellPages[0][0].id, 'bite');
  assert.ok(entity.spellPages[0].slice(1).every(slot => slot === null));
});

test('battle party numbers are exactly 1..N for subsets and duplicate hero types, excluding enemies and summons', () => {
  const ctx = setup();
  ctx.gameState.isAlly = entity => ['wizard', 'monk'].includes(entity.type) || entity.isSummon === true;
  const onlyMonk = ctx.createCreature('monk', { x: 0, y: 0 });
  ctx.preparePartyOrder([onlyMonk]);
  assert.equal(onlyMonk.partyOrder, 1);
  const first = ctx.createCreature('wizard', { x: 1, y: 1 });
  const second = ctx.createCreature('wizard', { x: 2, y: 1 });
  const monk = ctx.createCreature('monk', { x: 3, y: 1 });
  const wolf = ctx.createCreature('wolf', { x: 4, y: 1 });
  const spirit = ctx.createCreature('lake-spirit', { x: 5, y: 1 });
  spirit.isSummon = true;
  ctx.preparePartyOrder([monk, second, first, wolf, spirit]);
  assert.deepEqual([first.partyOrder, second.partyOrder, monk.partyOrder], [1, 2, 3]);
  assert.equal(Object.hasOwn(wolf, 'partyOrder'), false);
  assert.equal(Object.hasOwn(spirit, 'partyOrder'), false);
});

test('specter and shadow use their own stats without inheriting a party rank or spell book', () => {
  const ctx = setup();
  for (const type of ['specter', 'shadow']) {
    const template = ctx.CREATURE_TEMPLATES[type];
    const entity = ctx.createCreature(type, { x: 2, y: 1 });
    assert.equal(entity.level, template.level);
    assert.equal(entity.hp, template.baseHP + template.hpPerLevel * (template.level + template.attributes.vit));
    assert.equal(entity.wp, template.baseWP + template.wpPerLevel * (template.level + template.attributes.cha));
    assert.deepEqual(entity.attributes, template.attributes);
    assert.notEqual(entity.attributes, template.attributes);
    assert.equal(entity.ai, type);
    assert.equal(entity.partyOrder, undefined);
    assert.equal(entity.availableSpells.length, 2);
    assert.equal(entity.spellPages.length, 1);
    assert.equal(entity.spellPages[0][0].id, 'turn-invisible');
    assert.equal(entity.spellPages[0][1].id, 'spectral-strike');
    assert.ok(entity.spellPages[0].slice(2).every(slot => slot === null));
    assert.notEqual(entity.availableSpells[0], template.spells[0]);
  }
});

test('invisibility spells are local, self-range dark spells with fixed two-turn duration', () => {
  const ctx = setup();
  const shadow = ctx.createCreature('shadow', { x: 1, y: 1 });
  const specter = ctx.createCreature('specter', { x: 2, y: 1 });
  const spell = shadow.availableSpells[0];
  for (const [key, value] of Object.entries({ abilityType: 'spell', magicSchool: 'dark',
    target: 'ally', range: 0, minRange: 0, modifiable: false, noLOS: false,
    apCost: 3, maxCooldown: 4, maxUsesPerTurn: 1, durationBase: 2, durationPerInt: 0,
    isAOE: false, aoeSize: 1, stateId: 'invisibility' })) assert.equal(spell[key], value, key);
  assert.notEqual(spell, specter.availableSpells[0]);
  spell.cooldown = 4;
  assert.equal(specter.availableSpells[0].cooldown, 0);
  const state = vm.runInContext("stateTypes.get('invisibility')", ctx);
  assert.equal(state.description, 'Цель становится невидимой для своих врагов. Использование умений и заклинаний не снимает невидимость.');
  assert.equal(state.permanent, false);
  assert.equal(state.modifiers, undefined);
});


test('accuracy belongs to every weapon attack and shot, never to a creature', () => {
  const ctx = setup();
  vm.runInContext(fs.readFileSync(path.join(root, 'combat.js'), 'utf8'), ctx);
  const common = vm.runInContext('SPELL_DEFINITIONS', ctx);
  const check = spell => {
    if (spell.abilityType === 'weapon-strike' || spell.isShot) {
      const accuracy = spell.isShot ? 80 : spell.id === 'boulder-smash' ? 90 : 95;
      assert.equal(spell.baseAccuracy, accuracy, spell.id);
      if (spell.isShot) assert.equal(spell.baseCritChance, 10, spell.id);
      if (spell.id === 'boulder-smash') assert.equal(spell.baseCritChance, 0);
      if (spell.id === 'sword-strike') assert.equal(spell.baseCritChance, 5);
    }
    else assert.equal(spell.baseAccuracy, undefined, spell.id);
  };
  for (const spell of Object.values(common)) check(spell);
  for (const type of Object.keys(ctx.CREATURE_TEMPLATES)) {
    const entity = ctx.createCreature(type, { x: 0, y: 0 });
    assert.equal(entity.acc, undefined, type);
    assert.equal(entity.baseACC, undefined, type);
    assert.equal(entity.initialStats.acc, undefined, type);
    for (const spell of entity.availableSpells.filter(Boolean)) check(spell);
  }
});


test('archer is an allied fourth hero whose bow inherits sword damage but uses ranged accuracy and critical chance', () => {
  const ctx = setup();
  vm.runInContext(fs.readFileSync(path.join(root, 'combat.js'), 'utf8'), ctx);
  const archer = ctx.createCreature('archer', { x: 1, y: 1 });
  const warrior = ctx.createCreature('warrior', { x: 2, y: 1 });
  assert.equal(archer.id, 'archer'); assert(ctx.gameState.isAlly(archer));
  assert.equal(archer.ai, undefined); assert.equal(archer.partyOrder, 4);
  for (const key of ['attributes', 'baseHP', 'hpPerLevel', 'baseWP', 'wpPerLevel', 'maxAP', 'maxMP']) {
    assert.equal(JSON.stringify(archer[key]), JSON.stringify(warrior[key]), key);
  }
  assert.equal(archer.availableSpells.length, 1);
  const shot = archer.availableSpells[0], sword = warrior.availableSpells[0];
  for (const key of ['damageBase', 'damagePerStr', 'damageType', 'apCost', 'maxCooldown', 'maxUsesPerTurn', 'noLOS', 'target']) {
    assert.equal(shot[key], sword[key], key);
  }
  for (const [key, value] of Object.entries({id:'bow-shot', abilityType:'weapon-strike', isShot:true,
    minRange:1, range:6, modifiable:true, baseAccuracy:80, baseCritChance:10})) assert.equal(shot[key], value, key);
  assert.equal(ctx.getSpellDamage(shot, archer), ctx.getSpellDamage(sword, warrior));
  const enemy = ctx.createCreature('wolf', { x: 7, y: 1 });
  enemy.attributes.luc = 0; enemy.baseEVA = 0;
  assert.equal(ctx.getHitChance(shot, archer, enemy), 82);
  assert.equal(ctx.getCritChance(shot, archer, enemy), 12);
});
