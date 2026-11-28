// Друид: союзный герой с однократными бессрочными призывами существ.
const DRUID_SUMMON_WOLF = {
  id: 'summon-wolf', name: 'Призыв волка', abilityType: 'spell', level: 1, magicSchool: 'nature', isShot: false,
  description: 'Призывает Волка.',
  stackable: false,
  apCost: 1, maxUsesPerTurn: 1, maxCooldown: 0,
  range: 2, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
  target: 'none', isSummon: true, summonType: 'wolf', permanentSummon: true,
  requiresEmptyCell: true, maxUsesPerBattle: 1,
  iconPath: 'assets/homm2/spell-summon-wolf.png',
  svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-summon-wolf.png" width="64" height="64"/></svg>'
};

const DRUID_SUMMON_BLACK_WOLF = {
  id: 'summon-black-wolf', name: 'Призыв Чёрного волка', abilityType: 'spell', level: 1, magicSchool: 'nature', isShot: false,
  description: 'Призывает Чёрного волка.',
  stackable: false,
  apCost: 1, maxUsesPerTurn: 1, maxCooldown: 0,
  range: 2, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
  target: 'none', isSummon: true, summonType: 'black-wolf', permanentSummon: true,
  requiresEmptyCell: true, maxUsesPerBattle: 1,
  iconPath: 'assets/homm2/spell-summon-black-wolf.png',
  svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-summon-black-wolf.png" width="64" height="64"/></svg>'
};

const DRUID_SUMMON_BEAR = {
  id: 'summon-bear', name: 'Призыв Медведя', abilityType: 'spell', level: 1, magicSchool: 'nature', isShot: false,
  description: 'Призывает Медведя.',
  stackable: false,
  apCost: 1, maxUsesPerTurn: 1, maxCooldown: 0,
  range: 2, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
  target: 'none', isSummon: true, summonType: 'bear', permanentSummon: true,
  requiresEmptyCell: true, maxUsesPerBattle: 1,
  iconPath: 'assets/homm2/spell-summon-bear.png',
  svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-summon-bear.png" width="64" height="64"/></svg>'
};

window.CREATURE_TEMPLATES.druid = {
  name: 'Друид', type: 'druid', partyOrder: 6,
  level: 1, baseHP: 8, hpPerLevel: 4, baseWP: 15, wpPerLevel: 5,
  baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  Equipment: {
    head: null,
    boots: null,
    gloves: null,
    belt: window.EQUIPMENT_ITEMS['starter-belt'],
    chest: null,
    rightHand: null,
    leftHand: null,
    other1: null,
    other2: null,
  },
  attributes: { vit: 2, str: 0, att: 0, int: 2, wis: 2, cha: 1, luc: 1 },
  appearance: {
    sprite: 'assets/map-editor/mobs/druid.png', portrait: 'assets/homm2/portrait-druid.png',
    displaySize: { width: 72, height: 86 }, padding: { top: 4, right: 4, bottom: 4, left: 4 },
    svg: '<image href="assets/map-editor/mobs/druid.png" width="40" height="40"/>'
  },
  spells: [DRUID_SUMMON_WOLF, DRUID_SUMMON_BLACK_WOLF, DRUID_SUMMON_BEAR],
  spellPages: [
    ['summon-wolf', null, null, null, null,
      'summon-black-wolf', null, null, null, null,
      'summon-bear', null, null, null, null,
      null, null, null, null, null]
  ]
};
