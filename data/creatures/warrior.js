// Воин: союзный герой с собственным оружейным умением.
window.CREATURE_TEMPLATES.warrior = {
  name: 'Воин', type: 'warrior', partyOrder: 3,
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
    sprite: 'assets/map-editor/mobs/warrior.png', portrait: 'assets/homm2/portrait-warrior.png',
    displaySize: { width: 72, height: 86 }, padding: { top: 4, right: 13, bottom: 4, left: 12 },
    svg: '<image href="assets/map-editor/mobs/warrior.png" width="40" height="40"/>'
  },
  spells: [{
    id: 'sword-strike', name: 'Удар мечом', abilityType: 'weapon-strike', baseAccuracy: 100,
    isShot: false, baseCritChance: 5, stackable: false, target: 'any',
    apCost: 3, maxCooldown: 0, maxUsesPerTurn: 2,
    damageType: 'physical', damageBase: 2, damagePerStr: 1,
    minRange: 1, range: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
    iconPath: 'assets/homm2/spell-sword-strike.png',
    svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-sword-strike.png" width="64" height="64"/></svg>'
  }],
  spellPages: [
    ['sword-strike', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
