// Друид: союзный герой с однократным бессрочным призывом волка.
const DRUID_SUMMON_WOLF = {
  id: 'summon-wolf', name: 'Призыв волка', abilityType: 'spell', isShot: false,
  description: 'Призывает Волка.',
  stackable: false,
  apCost: 0, maxUsesPerTurn: 1, maxCooldown: 0,
  range: 2, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
  target: 'none', isSummon: true, summonType: 'wolf', permanentSummon: true,
  requiresEmptyCell: true, maxUsesPerBattle: 1,
  iconPath: 'assets/homm2/spell-summon-wolf.png',
  svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-summon-wolf.png" width="64" height="64"/></svg>'
};

window.CREATURE_TEMPLATES.druid = {
  name: 'Друид', type: 'druid', partyOrder: 6,
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
    sprite: 'assets/map-editor/mobs/druid.png', portrait: 'assets/homm2/portrait-druid.png',
    displaySize: { width: 72, height: 86 }, padding: { top: 4, right: 4, bottom: 4, left: 4 },
    svg: '<image href="assets/map-editor/mobs/druid.png" width="40" height="40"/>'
  },
  spells: [DRUID_SUMMON_WOLF],
  spellPages: [
    ['summon-wolf', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
