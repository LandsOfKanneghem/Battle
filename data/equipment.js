window.EQUIPMENT_ITEMS = {};
window.STARTER_BACKPACK_IDS = ["patched-cap", "apprentice-hood", "padded-coif", "leather-cap", "iron-kettle-helm", "worn-shoes", "ankle-boots", "adventurer-boots", "wrapped-shoes", "fur-boots", "fingerless-gloves", "cloth-gloves", "work-gloves", "padded-mitts", "reinforced-gloves", "worn-belt", "rope-belt", "broad-belt", "utility-belt", "hunter-belt", "patched-tunic", "quilted-gambeson", "leather-vest", "apprentice-robe", "short-chainmail", "iron-dagger", "worn-shortsword", "woodcutter-axe", "simple-sling", "shortbow", "wood-buckler", "wicker-shield", "plank-shield", "hide-shield", "iron-rim-shield", "copper-ring", "wood-beads", "green-stone-ring", "bone-pendant", "cloth-charm", "patched-cloak", "copper-brooch", "green-cape", "brass-medallion", "blue-pebble-ring"];
// Экипировка копируется на каждый бой; предмет брони и источник AC — один объект.
window.EQUIPMENT_SLOTS = Object.freeze({head:'Голова',boots:'Обувь',gloves:'Перчатки',belt:'Пояс',chest:'Нагрудник',rightHand:'Правая рука',leftHand:'Левая рука',other1:'Прочее 1',other2:'Прочее 2'});
window.createEquipment = function(definition = {}) {
  return Object.fromEntries(Object.keys(window.EQUIPMENT_SLOTS).map(slot => {
    const source = definition?.[slot];
    if (!source) return [slot,null];
    const item = {...source};
    if (item.attack) item.attack = {...item.attack};
    if (item.modifiers) item.modifiers = {...item.modifiers};
    if (item.allowedSlots) item.allowedSlots = [...item.allowedSlots];
    if (item.ac !== undefined) {
      item.maxDurability = Math.max(0,Math.floor(item.maxDurability ?? 10));
      item.durability = item.maxDurability;
    }
    return [slot,item];
  }));
};
window.equipmentSpellDefinitions = function(template, equipment, defaults) {
  const weapon = equipment.rightHand?.attack;
  const definitions = [...(template.spells ?? defaults)];
  if (weapon) definitions.push(weapon);
  return definitions.map(spell => {
    if (!weapon || (!spell.isMaimingStrike && !spell.isCharge)) return spell;
    const properties = Object.fromEntries(['damagePerStr','damageType','baseAccuracy','baseCritChance','isShot'].map(key => [key,weapon[key]]));
    return {...spell,...properties,damageBase:spell.isMaimingStrike ? 0 : weapon.damageBase,
      apCost:weapon.apCost+(spell.isCharge ? 1 : 0),
      ...(spell.isMaimingStrike ? {range:weapon.range,minRange:weapon.minRange,modifiable:weapon.modifiable} : {})};
  });
};

window.createEquipmentItem = function(source) {
  return window.createEquipment({rightHand:source}).rightHand;
};
window.getEquipmentBonus = function(entity, stat) {
  return Object.values(entity?.Equipment ?? {}).reduce((sum,item) => {
    const value=item?.modifiers?.[stat] ?? 0;
    return sum+(item?.ac !== undefined && window.isArmorBroken?.(item) ? Math.floor(value*.25) : value);
  },0);
};
window.resetSharedBackpack = function() {
  window.gameState.backpack=window.STARTER_BACKPACK_IDS.map(id=>window.createEquipmentItem(window.EQUIPMENT_ITEMS[id]));
  window.gameState.backpackPage=0;window.gameState.selectedBackpackIndex=null;
};
window.rebuildEquipmentSpells = function(entity) {
  const template=window.CREATURE_TEMPLATES[entity.type];
  if(!template.spellPages)return;
  const old=new Map((entity.availableSpells??[]).map(spell=>[spell.id,spell]));
  const previousWeapon=(entity.availableSpells??[]).find(spell=>spell.fromEquipment)??entity._weaponSpellState;
  const weapon=entity.Equipment.rightHand?.attack;
  const definitions=window.equipmentSpellDefinitions(template,entity.Equipment,[...SPELL_DEFINITIONS,...MONK_SPELLS]);
  const pages=template.spellPages.map(page=>[...page]);
  if(weapon&&!pages.some(page=>page.includes('weapon-attack'))){
    let page=pages.find(page=>page.includes(null));
    if(!page){page=Array(20).fill(null);pages.push(page);}
    page[page.indexOf(null)]='weapon-attack';
  }
  const resolved=new Map();
  entity.spellPages=pages.map(page=>page.map(id=>{
    if(id===null)return null;
    if(!resolved.has(id)){
      const definition=id==='weapon-attack'?weapon:definitions.find(spell=>spell.id===id);
      const previous=id==='weapon-attack'?previousWeapon:old.get(id);
      const spell=definition?{...definition,cooldown:previous?.cooldown??0,usesThisTurn:previous?.usesThisTurn??0,usesTotal:previous?.usesTotal??0,
        ...(id==='weapon-attack'?{fromEquipment:true}:{}),
        ...((definition.isMaimingStrike||definition.isCharge)?{requiresWeapon:true}: {})}:null;
      resolved.set(id,spell);
    }
    return resolved.get(id);
  }));
  entity.availableSpells=entity.spellPages.flat().filter(Boolean);
  entity._weaponSpellState=entity.availableSpells.find(spell=>spell.fromEquipment)??previousWeapon;
};
window.canManageEquipment = entity => !!entity && entity.hp>0 && !!window.CREATURE_TEMPLATES[entity.type]?.Equipment
  && window.gameState.isAlly(entity) && !window.gameState.isCasting && !window.gameState.isMoving && !window.gameState.isSkippingTurn;
window.changeEquipment = function(entity, index, slot) {
  const state=window.gameState;
  if(!window.canManageEquipment(entity)||!Object.hasOwn(window.EQUIPMENT_SLOTS,slot))return false;
  const bag=state.backpack, item=index===null?null:bag?.[index];
  if(index!==null&&(!item||!item.allowedSlots?.includes(slot)))return false;
  if(index===null&&slot==='leftHand'&&entity.Equipment.rightHand?.hands===2)slot='rightHand';
  const old=entity.Equipment[slot];
  if(!item&&!old)return false;
  const store=value=>{if(!value)return;let free=bag.indexOf(null);if(free<0)free=bag.length;bag[free]=value;};
  if(item){bag[index]=old??null;entity.Equipment[slot]=item;}
  else {entity.Equipment[slot]=null;store(old);}
  if(item?.hands===2&&slot==='rightHand'){store(entity.Equipment.leftHand);entity.Equipment.leftHand=null;}
  if(item&&slot==='leftHand'&&entity.Equipment.rightHand?.hands===2){store(entity.Equipment.rightHand);entity.Equipment.rightHand=null;}
  entity.armorSources=Object.values(entity.Equipment).filter(item=>item?.ac!==undefined);
  window.rebuildEquipmentSpells(entity);
  window.recalculateStateStats(entity);
  state.preparedSpellId=null;state.selectedBackpackIndex=null;
  window.clearHighlight?.();window.renderSpellPanel?.(false);window.updatePanel?.();
  return true;
};
