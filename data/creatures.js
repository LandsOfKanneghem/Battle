// Реестр и фабрика существ. Шаблоны подключаются из data/creatures/*.js и data/allies/*.js. Счётчики типов приватны; изменяемые данные не разделяются.
window.BASE_SPELL_CASTS = 10;
window.BASE_HIT_COUNT = 10;
window.DEFAULT_CREATURE_SOURCE_SIZE = Object.freeze({ width: 72, height: 86 });

// Один раз перед боем: фиксируем уникальные номера 1…N только для персонажей игрока.
window.preparePartyOrder = function(entities) {
  const rank = entity => Number.isInteger(entity.partyOrder) && entity.partyOrder > 0
    ? entity.partyOrder : Infinity;
  const party = entities.filter(entity => entity.hp > 0 && !entity.isSummon && window.gameState.isAlly(entity));
  party.sort((a, b) => rank(a) - rank(b)
    || a.id.localeCompare(b.id, 'en', { numeric: true })
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  party.forEach((entity, index) => Object.defineProperty(entity, 'partyOrder', {
    value: index + 1, enumerable: true, writable: false, configurable: false
  }));
};

// Снимок фиксируется один раз и учитывает врождённые состояния и производные статы.
window.captureInitialStats = function(creature) {
  if (creature.initialStats || !window.getEffectiveStat || !window.getCurrentES) return;
  const keys = ['ra', 'cri', 'sfc', 'eva', 'blo', 'vs', 'es', 'ini',
    'str', 'vit', 'att', 'int', 'wis', 'cha', 'luc',
    'ac', 'physical', 'fire', 'water', 'air', 'earth', 'mind', 'poison'];
  creature.initialStats = {
    ...Object.fromEntries(keys.map(key => [key, key === 'es'
      ? window.getCurrentES(creature) : window.getEffectiveStat(creature, key)])),
    maxHP: creature.maxHP, maxWP: creature.maxWP,
    maxAP: creature.maxAP, maxMP: creature.maxMP
  };
};

(() => {
  window.createAttributes = function(overrides = {}) {
    // Только врождённые атрибуты; боевые характеристики хранятся у существа.
    return { vit: 0, str: 0, att: 0, int: 0, wis: 0, cha: 0, luc: 0, ...overrides };
  };

  const CREATURE_TEMPLATES = window.CREATURE_TEMPLATES = {};

  window.createCreatureSvg = function(kind) {
    const template = CREATURE_TEMPLATES[kind];
    if (!template?.appearance) throw new Error(`Неизвестный спрайт существа: ${kind}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('class', kind);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', template.name);
    svg.innerHTML = template.appearance.svg;
    Object.assign(svg.style, template.appearance.svgStyle ?? {});
    return svg;
  };

  const typeCounters = new Map();
  window.resetCreatureCounters = () => typeCounters.clear();
  window.createCreature = function(templateId, position, loadout = {}) {
    if (!Object.hasOwn(CREATURE_TEMPLATES, templateId)) throw new Error(`Неизвестный шаблон существа: ${templateId}`);
    const template = CREATURE_TEMPLATES[templateId];
    const next = (typeCounters.get(template.type) ?? 0) + 1;
    typeCounters.set(template.type, next);
    // Редактор допускает несколько магов/монахов: каждому нужен отдельный ID.
    const id = next === 1 && ['wizard', 'monk', 'warrior', 'archer', 'halfling', 'druid'].includes(template.type)
      ? template.type : `${template.type}-${next}`;
    const attributes = window.createAttributes(loadout.progression
      ? window.HeroProgression.attributes(loadout.progression) : template.attributes);
    // При создании учитываем только гарантированную часть; шанс бросается в начале хода.
    const wisBonus = Math.floor(attributes.wis / 20);
    const strBonus = Math.floor(attributes.str / 20);
    const level = loadout.progression?.level ?? template.level ?? 1;
    const maxHP = template.baseHP + template.hpPerLevel * (level + attributes.vit);
    const maxWP = template.baseWP + template.wpPerLevel * (level + attributes.cha);
    const equipmentDefinition = loadout.equipment === undefined ? template.Equipment
      : Object.fromEntries(Object.entries(loadout.equipment).map(([slot, id]) => [slot, id === null ? null : window.EQUIPMENT_ITEMS[id]]));
    const Equipment = window.createEquipment(equipmentDefinition);
    const consumables = (loadout.consumables ?? Array(6).fill(null))
      .map(id => id === null ? null : window.createEquipmentItem(window.EQUIPMENT_ITEMS[id]));
    // Каждый источник получает отдельную полную прочность на новый бой.
    const armorSources = template.Equipment ? Object.values(Equipment).filter(item => item?.ac !== undefined) : (template.armorSources ?? ((template.baseAC ?? 0) > 0
      ? [{ id: 'armor', name: 'Броня', ac: template.baseAC, maxDurability: 10 }] : []))
      .map(source => {
        const maxDurability = Math.max(0, Math.floor(source.maxDurability ?? 10));
        return { ...source, indestructible: source.indestructible === true,
          maxDurability, durability: maxDurability };
      });
    const creature = {
      id, name: template.name, type: template.type, Equipment, consumables,
      level, baseHP: template.baseHP, hpPerLevel: template.hpPerLevel, hp: maxHP, maxHP,
      baseWP: template.baseWP, wpPerLevel: template.wpPerLevel, wp: maxWP, maxWP,
      baseAP: template.baseAP, ap: template.baseAP + wisBonus, maxAP: template.baseAP + wisBonus,
      baseMP: template.baseMP, mp: template.baseMP + strBonus, maxMP: template.baseMP + strBonus,
      baseES: template.baseES, esBonuses: [], evaBonuses: [],
      baseVS: template.baseVS, vs: template.baseVS, maxVS: template.baseVS,
      baseINI: template.baseINI, ini: template.baseINI,
      baseCRI: template.baseCRI ?? 0, cri: template.baseCRI ?? 0,
      baseEVA: template.baseEVA, eva: template.baseEVA,
      baseSFC: template.baseSFC, sfc: template.baseSFC,
      baseBLO: template.baseBLO, blo: template.baseBLO,
      baseRA: template.baseRA, ra: template.baseRA,
      baseAC: armorSources.reduce((sum, source) => sum + source.ac, 0), ac: 0, armorSources,
      basePhysical: template.basePhysical, physical: template.basePhysical,
      baseFire: template.baseFire, fire: template.baseFire,
      baseWater: template.baseWater, water: template.baseWater,
      baseAir: template.baseAir, air: template.baseAir,
      baseEarth: template.baseEarth, earth: template.baseEarth,
      baseMind: template.baseMind, mind: template.baseMind,
      basePoison: template.basePoison, poison: template.basePoison,
      elementalShields: [],
      appliedEffects: [],
      states: [],
      availableSpells: [],
      spellCastCount: 0,
      // Лимит фиксируется по базовой WIS при создании и не пересчитывается в бою.
      maxSpellCasts: (window.BASE_SPELL_CASTS ?? 5) + attributes.wis,
      hitCount: 0,
      // Как и SCC, лимит ударов фиксируется по базовому атрибуту при создании.
      maxHitCount: (window.BASE_HIT_COUNT ?? 5) + attributes.vit,
      attributes,
      position: { x: position.x, y: position.y }, svg: window.createCreatureSvg(template.type)
    };
    if (template.ai) creature.ai = template.ai;
    if (template.partyOrder !== undefined) creature.partyOrder = template.partyOrder;
    if (template.isSummon) {
      creature.isSummon = true;
      creature.ownerId = null; // Владелец будет назначен механикой призыва.
    }
    window.rebuildEquipmentSpells(creature);
    // Врождённые состояния имеют отдельные экземпляры и источник — само существо.
    for (const entry of template.innateStates ?? []) {
      const id = typeof entry === 'string' ? entry : entry.id;
      const overrides = typeof entry === 'string' ? {} : entry;
      const templateState = stateTypes.get(id);
      if (templateState) creature.states.push({ ...templateState, ...overrides,
        casterId: creature.id, casterName: creature.name, suppressed: false,
        appliedOrder: ++window.gameState.effectOrder,
        overrides: [...(overrides.overrides ?? templateState.overrides)],
        neutralizes: [...(overrides.neutralizes ?? templateState.neutralizes)],
        blocks: [...(overrides.blocks ?? templateState.blocks)] });
    }
    creature.svg.setAttribute('aria-label', creature.name);
    window.recalculateStateStats?.(creature);
    window.captureInitialStats(creature);
    return creature;
  };
})();
