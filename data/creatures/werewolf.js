// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['werewolf'] = {
  name: 'Оборотень', type: 'werewolf', ai: 'werewolf',
  level: 6, baseHP: 25, hpPerLevel: 10, baseWP: 32, wpPerLevel: 8, baseAP: 5, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
  baseACC: 100, baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 4, str: 5, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/werewolf.png',
    portrait: 'assets/homm2/portrait-werewolf.png',
    displaySize: { width: 90, height: 108 },
    padding: { top: 4.777778, right: 9.6, bottom: 4.777778, left: 8.4 },
    svg: `
        <path d="M13 24 L11 36 H17 L20 28 L23 36 H29 L27 24 Z" fill="#795134" stroke="#3c2c25"/>
        <path d="M14 13 Q20 10 26 16 L26 25 H14 Z M14 15 L6 26 M26 17 L34 27" fill="#cfb490" stroke="#654d3d" stroke-width="3"/>
        <path d="M13 13 L10 4 L15 6 L18 2 L21 8 L25 10 L22 14 Z M22 15 L22 7 L27 9 L30 5 L32 11 L38 14 L34 19 Z" fill="#dec5a2" stroke="#654d3d"/>
        <path d="M15 18 L22 20 M15 21 L22 23" stroke="#87674e"/>
        <circle cx="19" cy="8" r="1" fill="#ffc74a"/><circle cx="31" cy="12" r="1" fill="#ffc74a"/>`
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'bite', baseCritChance: 5, isShot: false, effectDescription: 'Кровотечение [50%]', abilityType: 'weapon-strike', magicSchool: null, name: 'Укус волка', stackable: false,
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
