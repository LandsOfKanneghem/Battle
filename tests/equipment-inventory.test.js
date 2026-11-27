const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function setup(){
 const root=path.join(__dirname,'..'),ctx={gameState:{entities:[],effectOrder:0},document:{createElementNS:()=>({style:{},setAttribute(){}})}};ctx.window=ctx;vm.createContext(ctx);
 const data=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="(data\/[^\"]+\.js)"/g)].map(m=>m[1]);
 for(const file of [...data,'combat.js','spellTargeting.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 ctx.resetSharedBackpack();const hero=ctx.createCreature('warrior',{x:1,y:1});ctx.gameState.entities=[hero];ctx.gameState.activeEntity=()=>hero;
 return {ctx,hero,bag:ctx.gameState.backpack,index:id=>ctx.gameState.backpack.findIndex(item=>item?.id===id)};
}
test('shared inventory starts with all 45 distinct generated items and valid icons',()=>{
 const {ctx,bag}=setup();assert.equal(bag.length,45);assert.equal(new Set(bag.map(i=>i.id)).size,45);
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
 const all=[...bag.filter(Boolean),...Object.values(hero.Equipment).filter(Boolean)];assert.equal(new Set(all).size,all.length);assert.equal(all.length,48);
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
