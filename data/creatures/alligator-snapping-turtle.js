// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['alligator-snapping-turtle'] = {
  name: 'Грифовая черепаха', type: 'alligator-snapping-turtle', ai: 'alligator-snapping-turtle',
  level: 3, baseHP: 8, hpPerLevel: 4, baseWP: 8, wpPerLevel: 3, baseAP: 6, baseMP: 5, baseES: 0, baseVS: 0, baseRA: 0,
  baseACC: 100, baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 2, str: 2, att: 3, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/alligator-snapping-turtle.png',
    portrait: 'assets/homm2/portrait-alligator-snapping-turtle.png',
    sourceSize: { width: 60, height: 72 },
    displaySize: { width: 90, height: 108 },
    padding: { top: 41, right: 2, bottom: 4, left: 2 },
    svg: `
        <path d="M8 27 L5 34 H11 L15 27 M24 27 L25 34 H31 L29 26" fill="#66693b" stroke="#30291b"/>
        <path d="M4 26 Q4 13 18 13 Q31 13 33 26 Z" fill="#84602f" stroke="#30291b" stroke-width="2"/>
        <path d="M9 16 L11 11 L14 15 M18 14 L20 9 L23 15 M27 17 L29 13 L31 20" fill="#ba9954" stroke="#62451f"/>
        <path d="M29 23 Q34 17 38 22 L39 28 L34 27 L30 29 Z" fill="#777745" stroke="#30291b"/>
        <circle cx="36" cy="23" r="1" fill="#ffca36"/>`
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'bite', isHit: true, isShot: false, effectDescription: 'Кровотечение [50%]', abilityType: 'weapon-strike', magicSchool: null, name: 'Укус волка', stackable: false,
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
