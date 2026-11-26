// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['hound'] = {
  name: 'Гончая', type: 'hound', ai: 'hound',
  level: 3, baseHP: 8, hpPerLevel: 4, baseWP: 8, wpPerLevel: 3, baseAP: 6, baseMP: 5, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 2, str: 2, att: 3, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/hound.png',
    portrait: 'assets/homm2/portrait-hound.png',
    displaySize: { width: 72, height: 86 },
    padding: { top: 22.694444, right: 7.2, bottom: 4.777778, left: 6 },
    svg: `
        <path d="M7 20 L3 14 L2 21 L8 26 M9 24 L8 36 H13 L15 27 M23 25 L24 36 H29 L28 24" fill="#794a30" stroke="#302128"/>
        <path d="M8 20 Q17 15 27 21 L29 29 H9 Z" fill="#925735" stroke="#302128"/>
        <path d="M9 19 L19 18 L22 25 H10 Z M23 21 L28 20 L29 27 H24 Z" fill="#b6b4bd" stroke="#493747"/>
        <path d="M27 22 L26 11 Q31 6 36 12 L38 19 L35 25 Z" fill="#a86b3d" stroke="#302128"/>
        <path d="M27 11 Q22 11 25 20 L29 17 Z" fill="#594039"/>
        <path d="M27 24 L35 26" stroke="#6f2625" stroke-width="3"/>
        <circle cx="34" cy="15" r="1" fill="#f7bf54"/>
        <path d="M36 17 L39 18 L37 20 Z" fill="#302128"/>`
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'bite', baseCritChance: 5, isShot: false, effectDescription: 'Кровотечение [50%]', abilityType: 'weapon-strike', baseAccuracy: 95, magicSchool: null, name: 'Укус волка', stackable: false,
    damageBase: 2, damagePerStr: 1, damageType: 'physical', target: 'any',
    description: 'Наносит физический урон и с шансом 50% накладывает на цель 1 стак кровотечения.',
    stateId: 'bleeding', bleedChance: 50, bleedDuration: 2,
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
