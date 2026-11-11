// Шаблоны существ и фабрика. Счётчики типов приватны; изменяемые данные не разделяются.
(() => {
  window.createAttributes = function(overrides = {}) {
    // Только врождённые атрибуты; боевые характеристики хранятся у существа.
    return { vit: 2, str: 2, att: 2, int: 2, wis: 2, cha: 2, luc: 2, ...overrides };
  };

  const CREATURE_TEMPLATES = {
    wizard: {
      name: 'Волшебник', type: 'wizard',
      baseHP: 12, baseWP: 10, baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
      baseACC: 100, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
      baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
      baseEarth: 0, baseMind: 0, basePoison: 0,
      attributes: { str: 0, att: 1, cha: 1, luc: 0 },
      spellPages: [
        ['fire-shot', 'burning-hands', 'reckless', null,
          'liquid-membrane', 'rain', 'ice-arrow', 'lake-spirit',
          'haste', 'wind-rose', 'sparks', 'sky-shot',
          'slow', 'dead-weight', null, 'teleport'],
        ['fire-shield', 'water-shield', 'earth-shield', 'air-shield',
          'stone-skin', null, null, null,
          null, null, null, null,
          null, null, null, null]
      ]
    },
    monk: {
      name: 'Монах', type: 'monk',
      baseHP: 12, baseWP: 10, baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
      baseACC: 100, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
      baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
      baseEarth: 0, baseMind: 0, basePoison: 0,
      attributes: { str: 0, att: 1, cha: 1, luc: 0 },
      spellPages: [
        ['fire-cube', 'heal-harm', 'light-flash', 'haste',
          'weakness-vigor', 'sprint', null, null,
          null, null, null, null, null, null, null, null]
      ]
    },
    'lake-spirit': {
      name: 'Дух озера', type: 'lake-spirit',
      baseHP: 1, baseWP: 0, baseAP: 6, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
      baseACC: 100, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
      baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
      baseEarth: 0, baseMind: 0, basePoison: 0,
      attributes: { vit: 0, str: 0, att: 0, int: 0, wis: 0, cha: 0, luc: 0 },
      isSummon: true, innateStates: ['water-entity', { id: 'levitation', permanent: true }],
      spellPages: [
        ['water-shot', null, null, null, null, null, null, null,
          null, null, null, null, null, null, null, null]
      ]
    },
    'hill-giant': {
      name: 'Холмовой Великан', type: 'hill-giant', ai: 'hill-giant',
      baseHP: 30, baseWP: 10, baseAP: 5, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
      baseACC: 100, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
      baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
      baseEarth: 0, baseMind: 0, basePoison: 0,
      attributes: { str: 5, att: 1, cha: 1, luc: 0 },
      innateStates: [{ id: 'heavy', permanent: true }],
      spellPages: [
        ['club-smash', 'boulder-throw', null, null,
          null, null, null, null, null, null, null, null,
          null, null, null, null]
      ]
    },
    wolf: {
      name: 'Волк', type: 'wolf', ai: 'wolf',
      baseHP: 6, baseWP: 4, baseAP: 6, baseMP: 6, baseES: 0, baseVS: 0, baseRA: 0,
      baseACC: 100, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
      baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
      baseEarth: 0, baseMind: 0, basePoison: 0,
      attributes: { vit: 1, str: 1, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
      spellPages: [
        ['bite', null, null, null, null, null, null, null,
          null, null, null, null, null, null, null, null]
      ]
    }
  };

  const SVG_ART = {
    'hill-giant': `<path d="M8 37 L10 19 Q20 13 29 20 L31 37 H23 L21 29 L18 37 Z" fill="#807467" stroke="#c7b69c"/><path d="M10 21 L4 30 L8 33 L15 25 M27 22 L34 27" fill="none" stroke="#a59580" stroke-width="6" stroke-linecap="round"/><circle cx="20" cy="11" r="8" fill="#a59580" stroke="#5f544b"/><path d="M13 8 L17 4 H25 L28 10" fill="#544638"/><circle cx="17" cy="11" r="1.2" fill="#fff0c6"/><circle cx="23" cy="11" r="1.2" fill="#fff0c6"/><path d="M17 16 H23 M35 35 L32 15" stroke="#493425" stroke-width="3"/><path d="M29 4 L35 3 L39 17 L32 20 Z" fill="#76502d" stroke="#b18a53" stroke-width="2"/>`,
    'lake-spirit': `<circle cx="20" cy="22" r="12" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><ellipse cx="15" cy="17" rx="3" ry="2" fill="#fff" opacity=".6"/>`,
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

  window.createCreatureSvg = function(kind) {
    if (!Object.hasOwn(SVG_ART, kind)) throw new Error(`Неизвестный спрайт существа: ${kind}`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('class', kind);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', CREATURE_TEMPLATES[kind].name);
    svg.innerHTML = SVG_ART[kind];
    if (kind === 'hill-giant') {
      // Новый спрайт и его копия очереди вписываются в контейнер без изменения общей CSS.
      Object.assign(svg.style, { display: 'block', width: '100%', height: '100%',
        position: 'absolute', inset: '0', zIndex: '3', pointerEvents: 'none' });
    }
    return svg;
  };

  const typeCounters = new Map();
  window.createCreature = function(templateId, position) {
    if (!Object.hasOwn(CREATURE_TEMPLATES, templateId)) throw new Error(`Неизвестный шаблон существа: ${templateId}`);
    const template = CREATURE_TEMPLATES[templateId];
    let id = template.type;
    if (template.type !== 'wizard' && template.type !== 'monk') {
      const next = (typeCounters.get(template.type) ?? 0) + 1;
      typeCounters.set(template.type, next);
      id = `${template.type}-${next}`;
    }
    const creature = {
      id, name: template.name, type: template.type,
      baseHP: template.baseHP, hp: template.baseHP, maxHP: template.baseHP,
      baseWP: template.baseWP, wp: template.baseWP, maxWP: template.baseWP,
      baseAP: template.baseAP, ap: template.baseAP, maxAP: template.baseAP,
      baseMP: template.baseMP, mp: template.baseMP, maxMP: template.baseMP,
      baseES: template.baseES, esBonuses: [], evaBonuses: [],
      baseVS: template.baseVS, vs: template.baseVS, maxVS: template.baseVS,
      baseINI: template.baseINI, ini: template.baseINI,
      baseACC: template.baseACC, acc: template.baseACC,
      baseEVA: template.baseEVA, eva: template.baseEVA,
      baseSFC: template.baseSFC, sfc: template.baseSFC,
      baseBLO: template.baseBLO, blo: template.baseBLO,
      baseRA: template.baseRA, ra: template.baseRA,
      baseAC: template.baseAC, ac: template.baseAC,
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
      attributes: window.createAttributes(template.attributes),
      position: { x: position.x, y: position.y }, svg: window.createCreatureSvg(template.type)
    };
    if (template.ai) creature.ai = template.ai;
    if (template.isSummon) {
      creature.isSummon = true;
      creature.ownerId = null; // Владелец будет назначен механикой призыва.
    }
    if (template.spellPages) {
      // Одна копия способности на владельца; страницы и flat-массив делят её счётчики.
      const resolved = new Map();
      creature.spellPages = template.spellPages.map(page => page.map(id => {
        if (id === null) return null;
        if (!resolved.has(id)) {
          // Часть старых способностей монаха пока определена только в MONK_SPELLS.
          const spell = SPELL_DEFINITIONS.find(spell => spell.id === id)
            ?? MONK_SPELLS.find(spell => spell.id === id);
          resolved.set(id, spell ? { ...spell } : null);
        }
        return resolved.get(id);
      }));
      creature.availableSpells = creature.spellPages.flat().filter(Boolean);
    }
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
    return creature;
  };
})();
