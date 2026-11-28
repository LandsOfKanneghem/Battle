// Shared editor/Battle skill catalog and prerequisites.
((root) => {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Equipment = node ? require('./mapEquipment.js') : root.MapEquipment;
  const Progression = node ? require('./heroProgression.js') : root.HeroProgression;
  const RANKS = Object.freeze(['Ученик', 'Эксперт', 'Мастер', 'Грандмастер']);
  const LEVELS = Object.freeze([1, 4, 8, 15]);
  const groups = [
    { name: 'Магия и военное дело', branches: [
      ['fire-magic', 'Магия огня'], ['water-magic', 'Магия воды'], ['earth-magic', 'Магия земли'],
      ['air-magic', 'Магия воздуха'], ['light-magic', 'Магия света'], ['dark-magic', 'Магия тьмы'],
      ['order-magic', 'Магия порядка'], ['chaos-magic', 'Магия хаоса'], ['nature-magic', 'Магия природы'],
      ['warfare', 'Военное дело'], ['body-magic', 'Магия тела']
    ] },
    { name: 'Оружие ближнего боя', branches: [
      ['axe', 'Топор'], ['sword', 'Меч'], ['spear', 'Копье'], ['blunt', 'Дробящее'], ['dagger', 'Кинжал']
    ] },
    { name: 'Дальний бой и предметы', branches: [
      ['shooting', 'Стрелковое'], ['throwing', 'Метательное'], ['magic-items', 'Магические предметы']
    ] },
    { name: 'Доспехи', branches: [
      ['light-armor', 'Легкие доспехи'], ['medium-armor', 'Средние доспехи'],
      ['heavy-armor', 'Тяжелые доспехи'], ['magic-robes', 'Магические одеяния']
    ] },
    { name: 'Приёмы боя', branches: [
      ['fencing', 'Фехтование'], ['dual-wielding', 'Бой двумя руками'], ['two-handed', 'Двуручное'], ['shield', 'Щит']
    ] },
    { name: 'Общие навыки', branches: [
      ['tactics', 'Тактика'], ['trading', 'Торговля'], ['alchemy', 'Алхимия'], ['awareness', 'Насмотренность'],
      ['item-identification', 'Опознание предметов'], ['secret-detection', 'Обнаружение тайников'],
      ['trap-disarming', 'Обезвреживание ловушек']
    ] }
  ];
  const catalog = [];
  const GROUPS = groups.map(group => Object.freeze({ name: group.name, branches: Object.freeze(group.branches.map(([id, name]) => {
    const skills = RANKS.map((rank, index) => Object.freeze({
      id: `${id}-${index + 1}`, name: `${name} [${rank}]`, rank, minLevel: LEVELS[index],
      prerequisite: index ? `${id}-${index}` : null
    }));
    catalog.push(...skills);
    return Object.freeze({ id, name, skills: Object.freeze(skills) });
  })) }));
  const quickHands = Object.freeze({ id: 'quick-hands', name: 'Быстрые руки', minLevel: 4, prerequisite: null,
    description: 'Использование расходников с пояса стоит на 1 ОД меньше, минимум 0 ОД.' });
  const hardened = Object.freeze({ id: 'battle-hardened', name: 'Закаленный в бою', minLevel: 8, prerequisite: null,
    description: 'Дополнительное повышение: один атрибут на +2 и два других на +1.' });
  const veteran = Object.freeze({ id: 'veteran', name: 'Ветеран', minLevel: 16, prerequisite: hardened.id,
    description: 'Дополнительное повышение: два разных атрибута на +2 и три других на +1. Складывается с «Закаленным в бою».' });
  catalog.push(quickHands, hardened, veteran);
  GROUPS.push(Object.freeze({ name: 'Особые навыки', branches: Object.freeze([
    Object.freeze({ id: 'quick-hands', name: '', skills: Object.freeze([quickHands]) }),
    Object.freeze({ id: 'veteran', name: '', skills: Object.freeze([hardened, veteran]) })
  ]) }));
  const BY_ID = Object.freeze(Object.fromEntries(catalog.map(skill => [skill.id, skill])));
  const invalid = () => { throw new Error('Неверный набор навыков героя.'); };
  function capacity(level) {
    if (!Number.isInteger(level) || level < Progression.MIN_LEVEL || level > Progression.MAX_LEVEL) invalid();
    return level + 2;
  }
  function normalize(selected, level) {
    const limit = capacity(level);
    if (!Array.isArray(selected) || selected.length > limit || new Set(selected).size !== selected.length) invalid();
    for (const id of selected) {
      if (typeof id !== 'string' || !Object.hasOwn(BY_ID, id)) throw new Error('Недостаточно данных для загрузки карты');
      const skill = BY_ID[id];
      if (level < skill.minLevel || (skill.prerequisite && !selected.includes(skill.prerequisite))) invalid();
    }
    return [...selected];
  }
  function read(mob) {
    if (mob.skills === undefined) return {};
    if (!Equipment.HEROES.includes(mob.type) || mob.team !== 'ally') invalid();
    return { skills: normalize(mob.skills, mob.progression?.level ?? 1) };
  }
  function reason(id, selected, level) {
    const skill = BY_ID[id];
    if (!skill) return 'Неизвестный навык.';
    if (level < skill.minLevel) return `Требуется уровень ${skill.minLevel}.`;
    if (skill.prerequisite && !selected.includes(skill.prerequisite)) return `Требуется: ${BY_ID[skill.prerequisite].name}.`;
    if (selected.length >= capacity(level)) return 'Нет свободных выборов навыков.';
    return '';
  }
  function prune(selected) {
    let result = selected;
    while (true) {
      const next = result.filter(id => !BY_ID[id].prerequisite || result.includes(BY_ID[id].prerequisite));
      if (next.length === result.length) return next;
      result = next;
    }
  }
  function toggle(selected, id, level) {
    if (!Object.hasOwn(BY_ID, id)) return [...selected];
    if (selected.includes(id)) return prune(selected.filter(value => value !== id));
    return reason(id, selected, level) ? [...selected] : [...selected, id];
  }
  function reconcile(selected, level) {
    const limit = capacity(level);
    let result = prune(selected.filter(id => Object.hasOwn(BY_ID, id) && BY_ID[id].minLevel <= level));
    while (result.length > limit) result = prune(result.slice(0, -1));
    return result;
  }
  function highest(selected) {
    const ancestors = new Set();
    for (const id of selected) {
      let parent = BY_ID[id]?.prerequisite;
      while (parent) { ancestors.add(parent); parent = BY_ID[parent].prerequisite; }
    }
    return selected.filter(id => Object.hasOwn(BY_ID, id) && !ancestors.has(id)).map(id => BY_ID[id]);
  }
  const api = Object.freeze({ GROUPS: Object.freeze(GROUPS), BY_ID, capacity, normalize, read, reason, toggle, reconcile, highest });
  if (node) module.exports = api;
  else root.HeroSkills = api;
})(typeof window === 'undefined' ? globalThis : window);
