const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function setup(){
 const root=path.join(__dirname,'..'),ctx={gameState:{entities:[],effectOrder:0,SIZE:12,cells:Array(144).fill({})},document:{createElementNS:()=>({style:{},setAttribute(){}})}};ctx.window=ctx;vm.createContext(ctx);
 const data=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="(data\/[^\"]+\.js)"/g)].map(m=>m[1]);
 for(const file of [...data,'combat.js','spellTargeting.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  require('./fixtures/trained-heroes.cjs')(ctx);
 ctx.resetSharedBackpack();const hero=ctx.createCreature('warrior',{x:1,y:1});ctx.gameState.entities=[hero];ctx.gameState.activeEntity=()=>hero;
 return {ctx,hero,bag:ctx.gameState.backpack,index:id=>ctx.gameState.backpack.findIndex(item=>item?.id===id)};
}
test('shared inventory starts with starter items and independent healing potions and valid icons',()=>{
 const {ctx,bag}=setup();assert.equal(bag.length,82);assert.equal(new Set(bag.map(i=>i.id)).size,66);assert.equal(new Set(bag.filter(i=>i.id==='healing-potion')).size,5);
 for(const item of bag)assert(fs.existsSync(path.join(__dirname,'..',item.iconPath)));
 const before=bag[0];ctx.resetSharedBackpack();assert.notEqual(before,ctx.gameState.backpack[0]);
});
test('equipping modifiers recomputes stats without refilling spent AP/MP and preserves worn durability',()=>{
 const {ctx,hero,bag,index}=setup();const hp=hero.maxHP,ap=hero.ap;hero.mp-=2;
 assert(ctx.changeEquipment(hero,index('patched-cap'),'head'));assert.equal(hero.maxHP,hp+1);assert.equal(hero.hp,hp+1);assert.equal(hero.ap,ap);
 const mp=hero.mp,max=hero.maxMP;assert(ctx.changeEquipment(hero,index('adventurer-boots'),'boots'));assert.equal(hero.mp,mp+1);assert.equal(hero.maxMP,max+1);
 assert(ctx.changeEquipment(hero,null,'boots'));assert.equal(hero.mp,mp);
 const armor=hero.Equipment.chest;ctx.wearArmor(hero);const durability=armor.durability;
 assert(ctx.changeEquipment(hero,null,'chest'));const pos=bag.indexOf(armor);assert(pos>=0);assert(ctx.changeEquipment(hero,pos,'chest'));assert.equal(hero.Equipment.chest.durability,durability);
 assert(!ctx.changeEquipment(hero,index('copper-ring'),'head'));
});
test('two-handed gear returns displaced equipment and shields clear two-handed weapons without duplication',()=>{
 const {ctx,hero,bag,index}=setup();const shield=hero.Equipment.leftHand,sword=hero.Equipment.rightHand;
 assert(ctx.changeEquipment(hero,index('shortbow'),'rightHand'));assert.equal(hero.Equipment.leftHand,null);assert(bag.includes(shield));assert(bag.includes(sword));
 const bow=hero.Equipment.rightHand;assert(ctx.changeEquipment(hero,index('wood-buckler'),'leftHand'));assert.equal(hero.Equipment.rightHand,null);assert(bag.includes(bow));
 const all=[...bag.filter(Boolean),...Object.values(hero.Equipment).filter(Boolean)];assert.equal(new Set(all).size,all.length);assert.equal(all.length,86);
});
test('weapon replacement updates attacks and techniques while preserving counters and other spell cooldowns',()=>{
 const {ctx,hero,index}=setup();hero.availableSpells[0].usesThisTurn=2;hero.availableSpells.find(s=>s.isCharge).cooldown=2;
 assert(ctx.changeEquipment(hero,index('iron-dagger'),'rightHand'));
 const attack=hero.availableSpells.find(s=>s.fromEquipment);assert.equal(attack.baseAccuracy,100);assert.equal(attack.apCost,2);assert.equal(attack.usesThisTurn,2);
 const charge=hero.availableSpells.find(s=>s.isCharge);assert.equal(charge.apCost,3);assert.equal(charge.cooldown,2);
 assert(ctx.changeEquipment(hero,null,'rightHand'));assert(!ctx.canPrepareSpell(hero.availableSpells.find(s=>s.isMaimingStrike)));
 const mage=ctx.createCreature('wizard',{x:2,y:1});ctx.gameState.entities.push(mage);assert(ctx.changeEquipment(mage,index('simple-sling'),'rightHand'));
 assert(mage.availableSpells.some(s=>s.fromEquipment&&s.projectileType==='sling-stone'));
 assert(mage.spellPages.every(page=>page.length===20));
});
test('accessories fit either miscellaneous slot; broken armor reduces all bonuses',()=>{
 const {ctx,hero,index}=setup();assert(ctx.changeEquipment(hero,index('copper-ring'),'other2'));
 const armor=hero.Equipment.chest;armor.modifiers={str:4,maxHP:4};ctx.recalculateStateStats(hero);const hp=hero.maxHP;
 armor.durability=1;ctx.wearArmor(hero);assert.equal(ctx.getEquipmentBonus(hero,'str'),1);assert(hero.maxHP<hp);
 ctx.gameState.isCasting=true;assert(!ctx.changeEquipment(hero,null,'chest'));
});

test('new accessories grant one action or movement point with reversible current/max changes',()=>{
 const {ctx,hero,index}=setup();const ap=hero.ap,mp=hero.mp;
 assert(ctx.changeEquipment(hero,index('sun-amulet'),'other1'));assert.equal(hero.maxAP,7);assert.equal(hero.ap,ap+1);
 assert(ctx.changeEquipment(hero,index('wind-ring'),'other2'));assert.equal(hero.maxMP,5);assert.equal(hero.mp,mp+1);
 assert(ctx.changeEquipment(hero,null,'other1'));assert.equal(hero.ap,ap);assert.equal(hero.maxAP,6);
 assert(ctx.changeEquipment(hero,null,'other2'));assert.equal(hero.mp,mp);
});
test('belts provide 1–5 consumable slots, accessory adds one, and shrinking slots returns items intact',()=>{
 const {ctx,hero,bag,index}=setup();assert.equal(ctx.getConsumableSlotCount(hero),2);
 assert(ctx.changeEquipment(hero,index('hunter-belt'),'belt'));assert.equal(ctx.getConsumableSlotCount(hero),5);
 assert(ctx.changeEquipment(hero,index('potion-holder'),'other1'));assert.equal(ctx.getConsumableSlotCount(hero),6);
 bag.push(ctx.createEquipmentItem(ctx.EQUIPMENT_ITEMS['healing-potion']));
 for(let slot=0;slot<6;slot++)assert(ctx.changeConsumable(hero,index('healing-potion'),slot));
 const potions=[...hero.consumables];assert(ctx.changeEquipment(hero,index('worn-belt'),'belt'));
 assert.equal(ctx.getConsumableSlotCount(hero),2);assert.equal(hero.consumables.filter(Boolean).length,2);
 for(const potion of potions.slice(2))assert(bag.includes(potion));
 assert(!ctx.changeConsumable(hero,index('healing-potion'),2));
 assert(ctx.changeEquipment(hero,null,'other1'));assert.equal(ctx.getConsumableSlotCount(hero),1);
 assert(ctx.changeEquipment(hero,null,'belt'));assert.equal(ctx.getConsumableSlotCount(hero),0);assert(hero.consumables.every(i=>i===null));
 for(const potion of potions)assert.equal(bag.filter(item=>item===potion).length,1);
});
test('healing potion costs exactly 2 AP, heals 10 once, and respects owner turn, AP and slot locks',()=>{
 const {ctx,hero,index}=setup();ctx.gameState.activeEntityId=hero.id;hero.hp-=15;hero.ap=3;
 assert(ctx.changeConsumable(hero,index('healing-potion'),0));assert(ctx.changeConsumable(hero,index('healing-potion'),1));
 const hp=hero.hp;assert(ctx.useConsumable(hero,0));assert.equal(hero.hp,hp+10);assert.equal(hero.ap,1);assert.equal(hero.consumables[0],null);
 assert(!ctx.useConsumable(hero,0));assert(!ctx.useConsumable(hero,1));assert.equal(hero.hp,hp+10);
 hero.ap=6;ctx.gameState.activeEntityId='someone-else';assert(!ctx.useConsumable(hero,1));
});
test('new weapon damage components use separate resistances, one armor wear, and stack with stone enchantment',()=>{
 const {ctx,hero,index}=setup();assert(ctx.changeEquipment(hero,index('ember-sword'),'rightHand'));
 const victim=ctx.createCreature('warrior',{x:2,y:1});victim.physical=1;victim.fire=1;victim.baseES=0;
 const attack=hero.availableSpells.find(s=>s.fromEquipment);const hit={...attack,damage:ctx.getSpellDamage(attack,hero)};
 assert.equal(ctx.spellDamage(hit,victim,hero),1);const hp=victim.hp,dur=victim.Equipment.chest.durability;
 ctx.applyDamage(hit,victim,hero);assert.equal(victim.hp,hp-1);assert.equal(victim.Equipment.chest.durability,dur-1);
 assert(ctx.changeEquipment(hero,index('earth-sling'),'rightHand'));
 ctx.applySpellOnEntity(hero,{id:'enchant-stones',name:'Зачаровать камни',duration:3,isEnchantStones:true,stoneDamageBonus:2});
 const sling=hero.availableSpells.find(s=>s.fromEquipment),parts=ctx.damageBreakdown({...sling,damage:4},victim,hero,true).parts;
 assert.equal(parts.length,3);assert.equal(parts[1].rawDamage,2);assert.equal(parts[2].rawDamage,2);
 const maim=hero.availableSpells.find(s=>s.isMaimingStrike);assert.equal(maim.bonusDamage[0].damageType,'earth');
});

test('item catalog has no legacy slot or suggestedLevel and contains ten new named items',()=>{
 const {ctx}=setup();
 for(const item of Object.values(ctx.EQUIPMENT_ITEMS)){assert(!Object.hasOwn(item,'slot'));assert(!Object.hasOwn(item,'suggestedLevel'));}
 for(const id of ['dawn-crown','star-robe','dragon-scale-armor','windwalker-boots','scarlet-grasp','noon-blade','moon-hunter-bow','lion-shield','ancient-root-ring','moon-seal'])assert(ctx.EQUIPMENT_ITEMS[id]);
});
test('antidote removes poison for 2 AP; bandages remove exactly one bleeding stack for 1 AP',()=>{
 const {ctx,hero,index}=setup();ctx.gameState.activeEntityId=hero.id;
 ctx.applyState(hero,{id:'weak-poison',duration:3,casterId:hero.id});
 assert(ctx.changeConsumable(hero,index('antidote'),0));const hp=hero.hp;
 assert(ctx.useConsumable(hero,0));assert.equal(hero.ap,4);assert.equal(hero.hp,hp);assert(!hero.states.some(s=>s.id==='weak-poison'));
 for(let i=0;i<3;i++)ctx.applyState(hero,{id:'bleeding',duration:3,casterId:'source-'+i});
 assert.equal(hero.states.filter(s=>s.id==='bleeding').length,3);
 assert(ctx.changeConsumable(hero,index('bandages'),0));assert(ctx.useConsumable(hero,0));
 assert.equal(hero.ap,3);assert.equal(hero.states.filter(s=>s.id==='bleeding').length,2);
});
test('volatile mixture prepares a target without paying or consuming and stays out of the spell book',()=>{
 const {ctx,hero,index}=setup();ctx.gameState.activeEntityId=hero.id;
 ctx.highlightSpellRange=()=>{};
 assert(ctx.changeConsumable(hero,index('volatile-mixture'),0));const item=hero.consumables[0],ap=hero.ap;
 assert(ctx.useConsumable(hero,0));assert.equal(hero.ap,ap);assert.equal(hero.consumables[0],item);
 const spell=ctx.getPreparedSpell();assert(spell.consumableCast);assert.equal(spell.damageBase,6);assert.equal(spell.aoeSize,3);assert.equal(spell.apCost,2);assert.equal(spell.durationBase,2);
 assert.equal(spell.range,5);assert.equal(spell.noLOS,false);assert.equal(spell.target,'any');assert(ctx.canPrepareSpell(spell));
 assert(!hero.availableSpells.includes(spell));assert.equal(ctx.getCritChance(spell,hero,hero),0);
 hero.consumables[0]=null;assert(!ctx.canPrepareSpell(spell));
});
