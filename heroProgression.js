// Shared editor/Battle rules. Allocations are base attributes, before equipment and states.
((root) => {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Equipment = node ? require('./mapEquipment.js') : root.MapEquipment;
  const ATTRIBUTES = Object.freeze(['vit', 'str', 'att', 'int', 'wis', 'cha', 'luc']);
  const MIN_LEVEL = 1, MAX_LEVEL = 30;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validLevel = level => Number.isInteger(level) && level >= MIN_LEVEL && level <= MAX_LEVEL;
  const invalid = () => { throw new Error('Неверное распределение характеристик героя.'); };
  function create(level = MIN_LEVEL) {
    if (!validLevel(level)) invalid();
    return { level, allocations: Object.fromEntries(ATTRIBUTES.map(stat => [stat, { two: 0, one: 0 }])) };
  }
  function used(progression) {
    return ATTRIBUTES.reduce((sum, stat) => {
      sum.two += progression.allocations[stat].two;
      sum.one += progression.allocations[stat].one;
      return sum;
    }, { two: 0, one: 0 });
  }
  function remaining(progression, stat) {
    const spent = used(progression);
    const total = { two: 3 * progression.level - spent.two, one: 2 * progression.level - spent.one };
    if (stat === undefined) return total;
    const allocation = progression.allocations[stat];
    const free = progression.level - allocation.two - allocation.one;
    return { two: Math.min(total.two, free), one: Math.min(total.one, free) };
  }
  function attributes(progression) {
    return Object.fromEntries(ATTRIBUTES.map(stat => [stat,
      2 * progression.allocations[stat].two + progression.allocations[stat].one]));
  }
  function normalize(value) {
    if (!record(value) || !validLevel(value.level) || !record(value.allocations) ||
        Object.keys(value).some(key => !['level', 'allocations'].includes(key)) ||
        Object.keys(value.allocations).some(stat => !ATTRIBUTES.includes(stat))) invalid();
    const result = create(value.level);
    for (const stat of ATTRIBUTES) {
      const allocation = value.allocations[stat];
      if (!record(allocation) || Object.keys(allocation).some(key => !['two', 'one'].includes(key)) ||
          !['two', 'one'].every(key => Number.isSafeInteger(allocation[key]) && allocation[key] >= 0) ||
          allocation.two + allocation.one > value.level) invalid();
      result.allocations[stat] = { two: allocation.two, one: allocation.one };
    }
    const total = remaining(result);
    if (total.two < 0 || total.one < 0) invalid();
    return result;
  }
  function read(mob) {
    if (mob.progression === undefined) return {};
    if (!Equipment.HEROES.includes(mob.type) || mob.team !== 'ally') invalid();
    return { progression: normalize(mob.progression) };
  }
  function changeLevel(progression, delta) {
    const level = progression.level + delta;
    if (!Number.isInteger(delta) || delta === 0 || !validLevel(level)) return false;
    if (delta < 0) Object.assign(progression, create(level));
    else progression.level = level;
    return true;
  }
  function allocate(progression, stat, amount, delta) {
    if (!ATTRIBUTES.includes(stat) || ![1, 2].includes(amount) || ![-1, 1].includes(delta)) return false;
    const key = amount === 2 ? 'two' : 'one';
    if (delta > 0 ? remaining(progression, stat)[key] <= 0 : progression.allocations[stat][key] <= 0) return false;
    // The two budgets and a shared per-attribute cap of level allow at most one
    // increase per attribute per level, regardless of whether it is +2 or +1.
    progression.allocations[stat][key] += delta;
    return true;
  }
  const api = Object.freeze({ ATTRIBUTES, MIN_LEVEL, MAX_LEVEL, create, normalize, read, used, remaining, attributes, changeLevel, allocate });
  if (node) module.exports = api;
  else root.HeroProgression = api;
})(typeof window === 'undefined' ? globalThis : window);
