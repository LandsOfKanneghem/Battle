// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['giant-toad'] = {
  name: 'Гигантская жаба', type: 'giant-toad', ai: 'giant-toad',
  level: 6, baseHP: 24, hpPerLevel: 8, baseWP: 12, wpPerLevel: 6, baseAP: 7, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 1, baseWater: 3, baseAir: -1,
  baseEarth: 0, baseMind: 0, basePoison: 4,
  attributes: { vit: 4, str: 5, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/giant-toad.png',
    portrait: 'assets/homm2/portrait-giant-toad.png',
    displaySize: { width: 90, height: 108 },
    padding: { top: 44.194444, right: 2.4, bottom: 4.777778, left: 2.4 },
    svg: `
        <ellipse cx="17" cy="25" rx="14" ry="10" fill="#a34422" stroke="#3e221d" stroke-width="2"/>
        <path d="M10 26 Q0 25 3 34 L12 34 M26 26 L27 35 H35 L31 32 L30 25" fill="#bd5727" stroke="#3e221d" stroke-width="2"/>
        <ellipse cx="27" cy="22" rx="11" ry="8" fill="#bd5727" stroke="#3e221d" stroke-width="2"/>
        <path d="M19 27 Q29 36 36 26" fill="#c98a3d" stroke="#6f331d"/>
        <circle cx="24" cy="17" r="4" fill="#e58e24" stroke="#71351c"/>
        <path d="M22 17 H26 M29 26 L37 25" stroke="#291c1b" stroke-width="2"/>
        <circle cx="9" cy="21" r="2" fill="#6d2e22"/><circle cx="15" cy="18" r="2" fill="#de7530"/>`
  },
  // Собственное умение жабы, независимо от общих школ магии.
  spells: [{
    id: 'tongue-pull', name: 'Захват языком', abilityType: 'weapon-strike', magicSchool: null,
    description: 'Притягивает языком цель на 2 клетки к себе. Вражеская цель при этом получает физический урон.',
    damageBase: 6, damagePerStr: 1, damageType: 'physical', baseAccuracy: 95, baseCritChance: 0,
    stackable: false,
    apCost: 3, maxUsesPerTurn: 1, maxCooldown: 1,
    range: 6, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
    isTonguePull: true, target: 'any',
    effectDescription: 'Притягивает цель на 2 клетки к заклинателю.',
    iconPath: 'assets/homm2/spell-tongue-pull.png',
    svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 34 Q10 18 24 20 Q36 20 31 8 Q23 1 20 12" fill="none" stroke="#6e203d" stroke-width="9"/><path d="M5 34 Q10 18 24 20 Q36 20 31 8 Q23 1 20 12" fill="none" stroke="#e56991" stroke-width="5" stroke-linecap="round"/></svg>`
  }, {
    id: 'jump', name: 'Прыжок', abilityType: 'ability', magicSchool: null,
    description: 'Совершает прыжок на несколько клеток.',
    apCost: 2, maxUsesPerTurn: 1, maxCooldown: 1,
    range: 2, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
    target: 'none', isTeleport: true, isJump: true, requiresEmptyCell: true,
    iconPath: 'assets/homm2/spell-jump.png',
    svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-jump.png" width="64" height="64"/></svg>'
  }, {
    id: 'poison-bite', name: 'Ядовитый укус', abilityType: 'weapon-strike', magicSchool: null,
    description: 'Наносит физический урон и накладывает слабый яд.',
    damageBase: 8, damagePerStr: 1, damageType: 'physical', baseAccuracy: 95, baseCritChance: 5,
    stateId: 'weak-poison', durationBase: 3, durationPerInt: 0, stackable: false,
    apCost: 3, maxUsesPerTurn: 2, maxCooldown: 0,
    range: 1, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
    target: 'any',
    effectDescription: 'Слабый яд',
    iconPath: 'assets/homm2/spell-poison-bite.png',
    svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-poison-bite.png" width="64" height="64"/></svg>'
  }],
  spellPages: [
    ['tongue-pull', 'jump', 'poison-bite', null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
