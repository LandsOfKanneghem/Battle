// Экипировка копируется на каждый бой; предмет брони и источник AC — один объект.
window.EQUIPMENT_SLOTS = Object.freeze({head:'Голова',boots:'Обувь',gloves:'Перчатки',belt:'Пояс',chest:'Нагрудник',rightHand:'Правая рука',leftHand:'Левая рука',other1:'Прочее 1',other2:'Прочее 2'});
window.createEquipment = function(definition = {}) {
  return Object.fromEntries(Object.keys(window.EQUIPMENT_SLOTS).map(slot => {
    const source = definition?.[slot];
    if (!source) return [slot,null];
    const item = {...source};
    if (item.attack) item.attack = {...item.attack};
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
