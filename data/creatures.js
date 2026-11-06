// Шаблоны существ и фабрика. Счётчики типов приватны; изменяемые данные не разделяются.
(() => {
  window.createAttributes = function(overrides = {}) {
    const { resistances, baseWP = 10, baseVS = 0, ...attributes } = overrides;
    return {
      ra: 0,
      vit: 2, str: 2, att: 2, int: 2, wis: 2, cha: 2, luc: 2,
      // Частичный override сохраняет остальные стихии и всегда создаёт новый объект.
      resistances: { ac: 0, physical: 0, fire: 0, water: 0, air: 0, earth: 0, mind: 0, poison: 0, ...resistances },
      acc: 100, sfc: 0, eva: 0, blo: 0, ini: 0,
      ...attributes,
      // Текущие и максимальные ресурсы при создании выводятся только из базы.
      baseWP, wp: baseWP, maxWP: baseWP,
      baseVS, vs: baseVS, maxVS: baseVS
    };
  };

  const ENTITY_TEMPLATES = {
    wizard: {
      name: 'Волшебник', type: 'wizard', baseHP: 12, baseAP: 6, baseMP: 4,
      attributes: { str: 0, att: 1, cha: 1, luc: 0 }, spellsKey: 'wizard', spellPagesSplit: true
    },
    monk: {
      name: 'Монах', type: 'monk', baseHP: 12, baseAP: 6, baseMP: 4,
      attributes: { str: 0, att: 1, cha: 1, luc: 0 }, spellsKey: 'monk', spellPagesSplit: false
    },
    wolf: {
      name: 'Волк', type: 'wolf', baseHP: 6, baseAP: 6, baseMP: 5,
      attributes: { baseWP: 4, vit: 1, str: 1, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
      spellsKey: null, spellPagesSplit: false
    }
  };

  const SVG_ART = {
    wizard: `
      <path d="M11 36 L15 20 L25 20 L30 36 Z" fill="#287dff" stroke="#102e70"/>
      <circle cx="20" cy="17" r="6" fill="#ffd6a0"/>
      <path d="M9 13 L20 2 L30 13 Z" fill="#ffdc36" stroke="#a77c00"/>
      <path d="M8 13 H32" stroke="#ffdc36" stroke-width="3"/>
      <circle cx="18" cy="17" r="1" fill="#20202b"/>
      <circle cx="23" cy="17" r="1" fill="#20202b"/>
      <path d="M17 22 L21 29 L25 22" fill="#f5f0df"/>
      <path d="M32 35 L34 20" stroke="#ce9b56" stroke-width="2"/>
      <circle cx="34" cy="19" r="2.5" fill="#86e8ff"/>`,
    wolf: `
        <path d="M11 21 L3 12 L2 23 L10 28 Z" fill="#73818e" stroke="#344453"/>
        <path d="M10 22 Q17 16 28 21 L30 29 H10 Z" fill="#8e9ca8" stroke="#344453"/>
        <path d="M11 27 L10 36 H14 L16 27 M18 28 L18 36 H22 L23 27
                 M25 26 L26 36 H30 L29 26 M30 25 L32 35 H36 L34 24" fill="#73818e" stroke="#344453"/>
        <path d="M25 22 L25 7 L30 12 L35 6 L36 17 L39 21 L35 26 L28 25 Z" fill="#a8b5bf" stroke="#344453"/>
        <path d="M27 11 L27 15 L30 14 M33 13 L35 10 L35 15" fill="#dfb0ac"/>
        <path d="M27 22 L32 27 L35 24" fill="#d9e0e5"/>
        <circle cx="33" cy="18" r="1.2" fill="#eaca70"/>
        <path d="M37 20 L39 21 L37 23 Z" fill="#23323e"/>`,
    monk: `
      <path d="M10 37 L14 21 L26 21 L31 37 Z" fill="#b86028" stroke="#713c22"/>
      <path d="M15 22 L25 35 M25 22 L15 35" stroke="#e7a34a" stroke-width="3"/>
      <circle cx="20" cy="13" r="7" fill="#f1be8d"/>
      <circle cx="18" cy="13" r="1" fill="#30241e"/>
      <circle cx="23" cy="13" r="1" fill="#30241e"/>
      <path d="M12 27 L20 29 L28 27" fill="none" stroke="#f1be8d" stroke-width="3"/>
      <path d="M33 36 V10" stroke="#bc9159" stroke-width="2"/>`
  };

  window.createEntitySvg = function(kind) {
    if (!Object.hasOwn(SVG_ART, kind)) throw new Error(`Неизвестный спрайт существа: ${kind}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('class', kind);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', ENTITY_TEMPLATES[kind].name);
    svg.innerHTML = SVG_ART[kind];
    return svg;
  };

  const typeCounters = new Map();
  window.createCreature = function(templateId, position) {
    if (!Object.hasOwn(ENTITY_TEMPLATES, templateId)) throw new Error(`Неизвестный шаблон существа: ${templateId}`);
    const template = ENTITY_TEMPLATES[templateId];
    let id = template.type;
    if (template.type !== 'wizard' && template.type !== 'monk') {
      const next = (typeCounters.get(template.type) ?? 0) + 1;
      typeCounters.set(template.type, next);
      id = `${template.type}-${next}`;
    }
    const entity = {
      attributes: window.createAttributes(template.attributes),
      id, name: template.name, type: template.type, baseHP: template.baseHP, hp: template.baseHP, maxHP: template.baseHP,
      spells: [], elementalShields: [], states: [], spellsOnMe: [], baseES: 0, esBonuses: [], evaBonuses: [],
      baseInitiative: 0, initiative: 0,
      baseAP: template.baseAP, maxAP: template.baseAP, ap: template.baseAP,
      baseMP: template.baseMP, maxMP: template.baseMP, mp: template.baseMP,
      position: { x: position.x, y: position.y }, svg: window.createEntitySvg(template.type)
    };
    entity.svg.setAttribute('aria-label', entity.name);
    if (template.spellsKey) {
      entity.spells = template.spellsKey === 'wizard' ? WIZARD_SPELLS : MONK_SPELLS;
      entity.spellPages = template.spellPagesSplit
        ? [entity.spells.filter(spell => !spell.isElementalShield), entity.spells.filter(spell => spell.isElementalShield)]
        : [entity.spells];
    }
    return entity;
  };
})();
