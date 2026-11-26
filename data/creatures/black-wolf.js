// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['black-wolf'] = {
  name: 'Чёрный волк', type: 'black-wolf', ai: 'black-wolf',
  level: 4, baseHP: 8, hpPerLevel: 5, baseWP: 8, wpPerLevel: 3, baseAP: 7, baseMP: 6, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 25, baseEVA: 30, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 3, str: 2, att: 5, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/black-wolf.png',
    portrait: 'assets/homm2/portrait-black-wolf.png',
    displaySize: { width: 90, height: 108 },
    padding: { top: 43, right: 3.6, bottom: 4.777778, left: 3.6 },
    svg: `
        <path d="M11 21 L3 12 L2 23 L10 28 Z" fill="#73818e" stroke="#344453"/>
        <path d="M10 22 Q17 16 28 21 L30 29 H10 Z" fill="#8e9ca8" stroke="#344453"/>
        <path d="M11 27 L10 36 H14 L16 27 M18 28 L18 36 H22 L23 27
                 M25 26 L26 36 H30 L29 26 M30 25 L32 35 H36 L34 24" fill="#73818e" stroke="#344453"/>
        <path d="M25 22 L25 7 L30 12 L35 6 L36 17 L39 21 L35 26 L28 25 Z" fill="#a8b5bf" stroke="#344453"/>
        <path d="M27 11 L27 15 L30 14 M33 13 L35 10 L35 15" fill="#dfb0ac"/>
        <path d="M27 22 L32 27 L35 24" fill="#d9e0e5"/>
        <circle cx="33" cy="18" r="1.2" fill="#eaca70"/>
        <path d="M37 20 L39 21 L37 23 Z" fill="#23323e"/>`
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'bite', baseCritChance: 5, isShot: false, effectDescription: 'Кровотечение [75%]', abilityType: 'weapon-strike', baseAccuracy: 100, magicSchool: null, name: 'Укус волка', stackable: false,
    damageBase: 4, damagePerStr: 1, damageType: 'physical', target: 'any',
    description: 'Наносит физический урон и с шансом 75% накладывает на цель 1 стак кровотечения.',
    stateId: 'bleeding', bleedChance: 75, bleedDuration: 2,
    range: 1, minRange: 1, modifiable: false, noLOS: false,
    apCost: 3, maxUsesPerTurn: 2, maxCooldown: 0, isAOE: false, aoeSize: 1,
    iconPath: 'assets/homm2/spell-bite.png',
    svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 8 Q10 4 14 6 L18 10 Q20 8 22 10 L26 6 Q30 4 32 8 L28 18 L32 28 Q30 32 26 30 L22 26 Q20 28 18 26 L14 30 Q10 32 8 28 L12 18 Z" fill="#c93650" stroke="#ffadb6" stroke-width="2"/><circle cx="16" cy="14" r="2" fill="#fff"/><circle cx="24" cy="14" r="2" fill="#fff"/></svg>`
  }],
  spellPages: [
    ['bite', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
