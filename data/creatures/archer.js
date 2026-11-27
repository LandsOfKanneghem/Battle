// Лучник: союзный герой с собственным стрелковым оружием.
const ARCHER_BOW_SHOT = {
  id: 'bow-shot', name: 'Выстрел из лука', abilityType: 'weapon-strike', isShot: true,
  damageBase: 2, damagePerStr: 1, damageType: 'physical', baseAccuracy: 80, baseCritChance: 10,
  stackable: false,
  apCost: 3, maxUsesPerTurn: 2, maxCooldown: 0,
  range: 6, minRange: 1, modifiable: true, noLOS: false, isAOE: false, aoeSize: 1,
  target: 'any',
  iconPath: 'assets/homm2/spell-bow-shot.png',
  svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-bow-shot.png" width="64" height="64"/></svg>'
};

window.CREATURE_TEMPLATES.archer = {
  name: 'Лучник', type: 'archer', partyOrder: 4,
  level: 1, baseHP: 16, hpPerLevel: 8, baseWP: 10, wpPerLevel: 4,
  baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 5, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  armorSources: [
    { id: 'body-armor', name: 'Доспех', ac: 4, maxDurability: 10 },
    { id: 'shield', name: 'Щит', ac: 1, maxDurability: 5 }
  ],
  attributes: { vit: 2, str: 2, att: 2, int: 0, wis: 1, cha: 0, luc: 1 },
  appearance: {
    sprite: 'assets/map-editor/mobs/archer.png', portrait: 'assets/homm2/portrait-archer.png',
    displaySize: { width: 72, height: 86 }, padding: { top: 4, right: 4, bottom: 4, left: 4 },
    svg: '<image href="assets/map-editor/mobs/archer.png" width="40" height="40"/>'
  },
  spells: [ARCHER_BOW_SHOT],
  spellPages: [
    ['bow-shot', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
