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
      assert.ok(template.spells.length > 0);
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

test('snapping turtle starts with wolf stats and an independently tunable copy of its bite', () => {
  const ctx = setup();
  const wolfTemplate = ctx.CREATURE_TEMPLATES.wolf;
  const turtleTemplate = ctx.CREATURE_TEMPLATES['alligator-snapping-turtle'];
  const stats = template => Object.fromEntries(Object.entries(template)
    .filter(([key]) => !['name', 'type', 'ai', 'appearance'].includes(key)));
  assert.deepEqual(stats(turtleTemplate), stats(wolfTemplate));
  assert.notEqual(turtleTemplate.attributes, wolfTemplate.attributes);
  assert.notEqual(turtleTemplate.spells[0], wolfTemplate.spells[0]);
  const wolf = ctx.createCreature('wolf', { x: 1, y: 1 });
  const turtle = ctx.createCreature('alligator-snapping-turtle', { x: 2, y: 1 });
  for (const key of ['level', 'hp', 'maxHP', 'wp', 'maxWP', 'ap', 'maxAP', 'mp', 'maxMP', 'maxHitCount']) {
    assert.equal(turtle[key], wolf[key], key);
  }
  assert.equal(turtle.ai, turtle.type);
  turtle.availableSpells[0].usesThisTurn = 1;
  turtleTemplate.spells[0].damageBase += 5;
  assert.equal(wolf.availableSpells[0].usesThisTurn, 0);
  assert.equal(wolfTemplate.spells[0].damageBase, 2);
  assert.equal(turtle.availableSpells[0].damageBase, 2);
});

test('sprite, portrait and local ability icon paths live with each creature and point to existing assets', () => {
  const ctx = setup();
  for (const template of Object.values(ctx.CREATURE_TEMPLATES)) {
    const { sprite, portrait, sourceSize, displaySize, padding } = template.appearance;
    for (const file of [sprite, portrait, ...(template.spells ?? []).map(spell => spell.iconPath)]) {
      assert.ok(fs.existsSync(path.join(root, file)), file);
    }
    assert.ok(displaySize.width > 0 && displaySize.height > 0);
    assert.ok(padding.left + padding.right < sourceSize.width);
    assert.ok(padding.top + padding.bottom < sourceSize.height);
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
