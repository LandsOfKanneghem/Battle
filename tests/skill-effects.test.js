const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function setup(type = 'wizard', skills = [], progression) {
  const element = () => ({ dataset: {}, style: {}, setAttribute() {}, appendChild() {}, remove() {}, querySelector() {},
    classList: { add() {}, remove() {} } });
  const ctx = { document: { getElementById: element, createElement: element, createElementNS: element },
    setTimeout: fn => fn(), queueMicrotask: fn => fn(), renderPosition() {}, updatePanel() {}, removeDefeatedEntities() {},
    playCubeExplosion() {}, playMissAnimation() {}, playFailureAnimation() {}, highlightSpellRange() {},
    playProjectileAnimation(from, to, kind, callback) { callback(); } };
  ctx.window = ctx; vm.createContext(ctx);
  const data = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/src="(data\/[^\"]+\.js)"/g)].map(m => m[1]);
  for (const file of ['gameState.js', ...data, 'mapObjects.js', 'mapEquipment.js', 'heroProgression.js', 'heroSkills.js',
    'combat.js', 'spellTargeting.js', 'spellLogic.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  const hero = ctx.createCreature(type, { x: 1, y: 1 }, { skills, ...(progression ? { progression } : {}) });
  const state = ctx.gameState;
  ctx.highlightSpellRange = () => {};
  ctx.clearHighlight = () => {};
  state.entities = [hero]; state.activeEntityId = hero.id;
  state.cells = Array.from({ length: 144 }, (_, index) => Object.assign(element(), { dataset: { x: index % 12, y: Math.floor(index / 12) } }));
  for (let y=0;y<12;y++) for (let x=0;x<12;x++) state.terrain.set(`${x},${y}`, 'grass');
  ctx.cancelSpell = () => { state.preparedSpellId = null; };
  ctx.resetSharedBackpack();
  const index = id => state.backpack.findIndex(item => item?.id === id);
  const deps = () => ({ ...ctx, stateTypes: vm.runInContext('stateTypes', ctx), shotHits: () => true });
  return { ctx, hero, state, index, deps };
}

test('only hero spells and explicitly levelled warrior techniques have levels', () => {
  const { ctx } = setup();
  const common = vm.runInContext('[...SPELL_DEFINITIONS,...MONK_SPELLS]',ctx);
  for (const spell of common) if(spell.abilityType==='spell') assert.equal(spell.level,1,spell.id);
  for (const template of Object.values(ctx.CREATURE_TEMPLATES)) {
    for (const spell of template.spells ?? []) {
      if(!template.Equipment) assert.equal(spell.level,undefined,`${template.type}: ${spell.id}`);
      else assert.equal(spell.level,1,spell.id);
    }
  }
  for (const item of Object.values(ctx.EQUIPMENT_ITEMS)) if(item.attack) assert.equal(item.attack.level,undefined,item.id);
  for (const spell of ctx.CREATURE_TEMPLATES.druid.spells) assert.equal(spell.magicSchool,'nature');
});

test('skill-less spells stay in the book but cannot prepare or spend AP; higher ranks unlock the matching level', () => {
  const { ctx, hero, state, deps }=setup();
  const fire=hero.availableSpells.find(spell=>spell.id==='fire-shot');
  const bookCount=hero.availableSpells.length,ap=hero.ap;
  state.preparedSpellId=fire.id;
  assert(!ctx.canPrepareSpell(fire));
  assert(!ctx.castSpell(state.cells[1*12+3],deps()));
  assert.equal(hero.ap,ap);assert.equal(fire.cooldown,0);assert.equal(hero.availableSpells.length,bookCount);
  hero.skills=['fire-magic-1'];assert(ctx.canPrepareSpell(fire));
  fire.level=2;assert(!ctx.canPrepareSpell(fire));
  hero.skills.push('fire-magic-2');assert(ctx.canPrepareSpell(fire));
  fire.level=3;assert(!ctx.canPrepareSpell(fire));
  hero.skills.push('fire-magic-3');assert(ctx.canPrepareSpell(fire));
});

test('warrior needs the weapon skill to equip a sword and Warfare for levelled techniques', () => {
  const { ctx, hero, index }=setup('warrior');
  assert.equal(hero.Equipment.rightHand,null);assert.equal(hero.Equipment.leftHand,null);assert.equal(hero.Equipment.chest,null);
  assert(!ctx.changeEquipment(hero,index('worn-shortsword'),'rightHand'));
  assert(!ctx.changeEquipment(hero,index('wood-buckler'),'leftHand'));
  hero.skills=['sword-1'];assert(ctx.changeEquipment(hero,index('worn-shortsword'),'rightHand'));
  const ordinary=hero.availableSpells.find(spell=>spell.fromEquipment),charge=hero.availableSpells.find(spell=>spell.isCharge);
  assert(ctx.canPrepareSpell(ordinary));assert(!ctx.canPrepareSpell(charge));
  hero.skills.push('warfare-1');assert(ctx.canPrepareSpell(charge));
  hero.skills=[];assert(!ctx.canPrepareSpell(ordinary));
  const reload=ctx.createCreature('warrior',{x:2,y:1},{equipment:{rightHand:'warrior-weapon',chest:'body-armor',leftHand:'shield'},skills:[]});
  assert.equal(reload.Equipment.rightHand,null);assert.equal(reload.Equipment.chest,null);assert.equal(reload.Equipment.leftHand,null);
});

test('Quick Hands affects actual healing, zero-AP bandages and prepared mixture payment', () => {
  const { ctx, hero, state, index, deps }=setup('wizard',['quick-hands']);
  hero.hp-=10;hero.ap=1;
  assert(ctx.changeConsumable(hero,index('healing-potion'),0));
  assert(ctx.useConsumable(hero,0));assert.equal(hero.ap,0);assert.equal(hero.hp,hero.maxHP);
  ctx.applyState(hero,{id:'bleeding',duration:3,casterId:'enemy'});
  assert(ctx.changeConsumable(hero,index('bandages'),0));
  assert(ctx.canUseConsumable(hero,0));assert(ctx.useConsumable(hero,0));assert.equal(hero.ap,0);
  assert(!hero.states.some(s=>s.id==='bleeding'));
  hero.ap=1;assert(ctx.changeConsumable(hero,index('volatile-mixture'),0));
  assert(ctx.useConsumable(hero,0));assert.equal(hero.ap,1);
  const spell=ctx.getPreparedSpell();assert.equal(spell.apCost,1);assert(ctx.canPrepareSpell(spell));
  assert(ctx.castSpell(state.cells[3*12+3],deps()));
  assert.equal(hero.ap,0);assert.equal(hero.consumables[0],null);assert.equal(state.pendingConsumable,null);
});

test('without Quick Hands the same AP does not pay for a potion or bandage', () => {
  const { ctx, hero, index }=setup();hero.ap=1;
  assert(ctx.changeConsumable(hero,index('healing-potion'),0));assert(!ctx.useConsumable(hero,0));assert.equal(hero.ap,1);
  assert(ctx.changeConsumable(hero,index('bandages'),1));hero.ap=0;
  assert(!ctx.useConsumable(hero,1));assert.equal(hero.consumables[1].id,'bandages');
});

test('bonus allocations become real combat attributes and derived resources', () => {
  const { ctx }=setup();
  const progression=ctx.HeroProgression.create(16),skills=['battle-hardened','veteran'];
  for(let n=0;n<16;n++)ctx.HeroProgression.allocate(progression,'int',2,1);
  ctx.HeroProgression.allocate(progression,'int',2,1,skills);
  ctx.HeroProgression.allocate(progression,'int',2,1,skills);
  const hero=ctx.createCreature('wizard',{x:2,y:1},{progression,skills});
  assert.equal(hero.attributes.int,36);assert.equal(hero.initialStats.int,36);
  assert.equal(hero.level,16);assert.equal(hero.hp,8+4*16);
});
