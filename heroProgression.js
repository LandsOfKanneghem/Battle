// Shared editor/Battle rules. Normal levels and each training skill have separate allocations.
((root) => {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Equipment = node ? require('./mapEquipment.js') : root.MapEquipment;
  const ATTRIBUTES = Object.freeze(['vit', 'str', 'att', 'int', 'wis', 'cha', 'luc']);
  const MIN_LEVEL = 1, MAX_LEVEL = 30;
  const BONUSES = Object.freeze({
    'battle-hardened': Object.freeze({ two: 1, one: 2, minLevel: 8 }),
    veteran: Object.freeze({ two: 2, one: 3, minLevel: 16 })
  });
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validLevel = level => Number.isInteger(level) && level >= MIN_LEVEL && level <= MAX_LEVEL;
  const invalid = () => { throw new Error('Неверное распределение характеристик героя.'); };
  const empty = () => Object.fromEntries(ATTRIBUTES.map(stat => [stat, { two: 0, one: 0 }]));
  function create(level = MIN_LEVEL) {
    if (!validLevel(level)) invalid();
    return { level, allocations: empty() };
  }
  const sum = allocations => ATTRIBUTES.reduce((total, stat) => {
    total.two += allocations[stat].two; total.one += allocations[stat].one; return total;
  }, { two: 0, one: 0 });
  function sources(progression, skills = []) {
    return [{ allocations: progression.allocations, two: 3 * progression.level, one: 2 * progression.level, cap: progression.level },
      ...Object.entries(BONUSES).filter(([id, bonus]) => skills.includes(id) && progression.level >= bonus.minLevel)
        .map(([id, bonus]) => ({ id, ...bonus, cap: 1, allocations: progression.bonuses?.[id] ?? empty() }))];
  }
  function used(progression) {
    const result = sum(progression.allocations);
    for (const allocation of Object.values(progression.bonuses ?? {})) {
      const total = sum(allocation); result.two += total.two; result.one += total.one;
    }
    return result;
  }
  function remaining(progression, stat, skills = []) {
    return sources(progression, skills).reduce((result, source) => {
      const spent = sum(source.allocations);
      const free = stat === undefined ? Infinity : source.cap - source.allocations[stat].two - source.allocations[stat].one;
      result.two += Math.min(source.two - spent.two, free);
      result.one += Math.min(source.one - spent.one, free);
      return result;
    }, { two: 0, one: 0 });
  }
  function attributes(progression) {
    return Object.fromEntries(ATTRIBUTES.map(stat => [stat,
      [progression.allocations, ...Object.values(progression.bonuses ?? {})]
        .reduce((total, allocations) => total + 2 * allocations[stat].two + allocations[stat].one, 0)]));
  }
  function normalizeAllocation(value, cap, two, one) {
    if (!record(value) || Object.keys(value).some(stat => !ATTRIBUTES.includes(stat))) invalid();
    const result = empty();
    for (const stat of ATTRIBUTES) {
      const allocation = value[stat];
      if (!record(allocation) || Object.keys(allocation).some(key => !['two', 'one'].includes(key)) ||
          !['two', 'one'].every(key => Number.isSafeInteger(allocation[key]) && allocation[key] >= 0) ||
          allocation.two + allocation.one > cap) invalid();
      result[stat] = { two: allocation.two, one: allocation.one };
    }
    const spent = sum(result);
    if (spent.two > two || spent.one > one) invalid();
    return result;
  }
  function normalize(value, skills = []) {
    if (!record(value) || !validLevel(value.level) || !Array.isArray(skills) ||
        Object.keys(value).some(key => !['level', 'allocations', 'bonuses'].includes(key))) invalid();
    const result = { level: value.level,
      allocations: normalizeAllocation(value.allocations, value.level, 3 * value.level, 2 * value.level) };
    if (value.bonuses !== undefined) {
      if (!record(value.bonuses)) invalid();
      for (const [id, allocations] of Object.entries(value.bonuses)) {
        const bonus = BONUSES[id];
        if (!Object.hasOwn(BONUSES, id) || !skills.includes(id) || value.level < bonus.minLevel) invalid();
        result.bonuses ??= {};
        result.bonuses[id] = normalizeAllocation(allocations, 1, bonus.two, bonus.one);
      }
    }
    return result;
  }
  function read(mob) {
    if (mob.progression === undefined) return {};
    if (!Equipment.HEROES.includes(mob.type) || mob.team !== 'ally') invalid();
    return { progression: normalize(mob.progression, mob.skills ?? []) };
  }
  function reconcileBonuses(progression, skills) {
    const result = { level: progression.level, allocations: progression.allocations };
    for (const [id, allocations] of Object.entries(progression.bonuses ?? {})) {
      if (skills.includes(id) && Object.hasOwn(BONUSES, id) && progression.level >= BONUSES[id].minLevel) {
        result.bonuses ??= {}; result.bonuses[id] = allocations;
      }
    }
    return normalize(result, skills);
  }
  function changeLevel(progression, delta) {
    const level = progression.level + delta;
    if (!Number.isInteger(delta) || delta === 0 || !validLevel(level)) return false;
    if (delta < 0) {
      Object.assign(progression, create(level)); delete progression.bonuses;
    } else progression.level = level;
    return true;
  }
  function allocate(progression, stat, amount, delta, skills = []) {
    if (!ATTRIBUTES.includes(stat) || ![1, 2].includes(amount) || ![-1, 1].includes(delta)) return false;
    const key = amount === 2 ? 'two' : 'one';
    const candidates = sources(progression, skills);
    if (delta < 0) candidates.reverse();
    for (const source of candidates) {
      if (delta > 0 ? sum(source.allocations)[key] >= source[key]
          || source.allocations[stat].two + source.allocations[stat].one >= source.cap : source.allocations[stat][key] <= 0) continue;
      if (source.id) { progression.bonuses ??= {}; progression.bonuses[source.id] ??= source.allocations; }
      source.allocations[stat][key] += delta;
      return true;
    }
    return false;
  }
  const api = Object.freeze({ ATTRIBUTES, MIN_LEVEL, MAX_LEVEL, BONUSES, create, normalize, read, used, remaining, attributes, changeLevel, allocate, reconcileBonuses });
  if (node) module.exports = api;
  else root.HeroProgression = api;
})(typeof window === 'undefined' ? globalThis : window);
