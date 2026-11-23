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
  for (const type of ['alligator-snapping-turtle', 'hound', 'werewolf']) {
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

test('giant toad has giant stats, independent attributes and its own tongue ability', () => {
  const ctx = setup();
  const giant = ctx.CREATURE_TEMPLATES['hill-giant'];
  const toad = ctx.CREATURE_TEMPLATES['giant-toad'];
  const statKeys = Object.keys(giant).filter(key => typeof giant[key] === 'number');
  for (const key of statKeys) assert.equal(toad[key], giant[key], key);
  assert.deepEqual(toad.attributes, giant.attributes);
  assert.notEqual(toad.attributes, giant.attributes);
  const entity = ctx.createCreature('giant-toad', { x: 2, y: 1 });
  assert.equal(entity.type, 'giant-toad');
  assert.equal(entity.ai, 'giant-toad');
  assert.equal(entity.availableSpells.length, 1);
  assert.equal(entity.availableSpells[0].id, 'tongue-pull');
  assert.equal(entity.spellPages.length, 1);
  assert.equal(entity.spellPages[0][0], entity.availableSpells[0]);
  assert.ok(entity.spellPages[0].slice(1).every(slot => slot === null));
  assert.equal(entity.hitCount, 0);
  const creature = ctx.createCreature('hill-giant', { x: 3, y: 1 });
  for (const key of ['level', 'hp', 'maxHP', 'wp', 'maxWP', 'ap', 'maxAP', 'mp', 'maxMP', 'maxHitCount']) {
    assert.equal(entity[key], creature[key], key);
  }
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
    assert.equal(entity.availableSpells.length, 1);
    assert.equal(entity.spellPages.length, 1);
    assert.equal(entity.spellPages[0][0].id, 'turn-invisible');
    assert.ok(entity.spellPages[0].slice(1).every(slot => slot === null));
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
