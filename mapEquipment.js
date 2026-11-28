// Map loadouts contain only catalog IDs, never executable item data or combat durability.
((root) => {
  'use strict';
  const SkillRules = typeof module !== 'undefined' && module.exports ? require('./data/heroSkillRules.js') : root.HeroSkillRules;
  const SLOTS = Object.freeze(['head', 'boots', 'gloves', 'belt', 'chest', 'rightHand', 'leftHand', 'other1', 'other2']);
  const HEROES = Object.freeze(['wizard', 'monk', 'warrior', 'archer', 'halfling', 'druid']);
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const empty = () => Object.fromEntries(SLOTS.map(slot => [slot, null]));
  function capacity(equipment, items) {
    return Math.max(0, Math.min(6, (items[equipment.belt]?.consumableSlots ?? 0) +
      SLOTS.reduce((sum, slot) => sum + (items[equipment[slot]]?.modifiers?.consumableSlots ?? 0), 0)));
  }
  function read(mob, items) {
    if (mob.equipment === undefined && mob.consumables === undefined) return {};
    const invalid = () => { throw new Error('Неверная экипировка героя.'); };
    if (!HEROES.includes(mob.type) || mob.team !== 'ally' || !isRecord(mob.equipment)) invalid();
    const equipment = empty();
    if (Object.keys(mob.equipment).some(slot => !SLOTS.includes(slot))) invalid();
    for (const slot of SLOTS) {
      const id = mob.equipment[slot];
      if (id === undefined || id === null) continue;
      if (typeof id !== 'string' || !Object.hasOwn(items, id)) throw new Error('Недостаточно данных для загрузки карты');
      if (items[id].consumable || !items[id].allowedSlots?.includes(slot)) invalid();
      equipment[slot] = id;
    }
    if (items[equipment.rightHand]?.hands === 2 && equipment.leftHand !== null) invalid();
    for (const slot of SLOTS) if (!SkillRules.canEquip(mob, items[equipment[slot]])) equipment[slot] = null;
    const saved = mob.consumables ?? Array(6).fill(null);
    if (!Array.isArray(saved) || saved.length !== 6) invalid();
    const count = capacity(equipment, items);
    const consumables = saved.map((id, slot) => {
      if (id === null) return null;
      if (typeof id !== 'string' || !Object.hasOwn(items, id)) throw new Error('Недостаточно данных для загрузки карты');
      if (!items[id].consumable || slot >= count) invalid();
      return id;
    });
    return { equipment, consumables };
  }
  const api = Object.freeze({ SLOTS, HEROES, empty, capacity, read });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MapEquipment = api;
})(typeof window === 'undefined' ? globalThis : window);
