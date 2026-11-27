// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['bear'] = {
  name: 'Медведь', type: 'bear', ai: 'bear',
  level: 4, baseHP: 8, hpPerLevel: 5, baseWP: 8, wpPerLevel: 3, baseAP: 7, baseMP: 6, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 25, baseEVA: 30, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 3, str: 2, att: 5, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/bear.png',
    portrait: 'assets/homm2/portrait-bear.png',
    displaySize: { width: 90, height: 108 },
    padding: { top: 30, right: 4, bottom: 4, left: 4 },
    svg: '<image href="assets/map-editor/mobs/bear.png" width="40" height="40"/>'
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'bite', name: 'Укус волка', abilityType: 'weapon-strike', magicSchool: null, isShot: false,
    description: 'Наносит физический урон и с шансом 75% накладывает на цель 1 стак кровотечения.',
    damageBase: 4, damagePerStr: 1, damageType: 'physical', baseAccuracy: 95, baseCritChance: 5,
    stateId: 'bleeding', stackable: false,
    apCost: 3, maxUsesPerTurn: 2, maxCooldown: 0,
    range: 1, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
    target: 'any', bleedChance: 75, bleedDuration: 2,
    effectDescription: 'Кровотечение [75%]',
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
