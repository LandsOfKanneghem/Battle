// Текущее оружие воина; приёмы берут его параметры из этого определения.
const WARRIOR_SWORD_STRIKE = window.EQUIPMENT_ITEMS['warrior-weapon'].attack;

// Воин: союзный герой с собственным оружейным умением.
window.CREATURE_TEMPLATES.warrior = {
  name: 'Воин', type: 'warrior', partyOrder: 3,
  level: 1, baseHP: 16, hpPerLevel: 8, baseWP: 10, wpPerLevel: 4,
  baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  Equipment: {
    head: null,
    boots: null,
    gloves: null,
    belt: window.EQUIPMENT_ITEMS['starter-belt'],
    chest: window.EQUIPMENT_ITEMS['body-armor'],
    rightHand: window.EQUIPMENT_ITEMS['warrior-weapon'],
    leftHand: window.EQUIPMENT_ITEMS['shield'],
    other1: null,
    other2: null,
  },
  attributes: { vit: 2, str: 2, att: 2, int: 0, wis: 1, cha: 0, luc: 1 },
  appearance: {
    sprite: 'assets/map-editor/mobs/warrior.png', portrait: 'assets/homm2/portrait-warrior.png',
    displaySize: { width: 72, height: 86 }, padding: { top: 4, right: 13, bottom: 4, left: 12 },
    svg: '<image href="assets/map-editor/mobs/warrior.png" width="40" height="40"/>'
  },
  spells: [{
    id: 'maiming-strike', name: 'Калечащий удар', abilityType: 'weapon-strike', level: 1, magicSchool: 'war', isShot: WARRIOR_SWORD_STRIKE.isShot,
    description: 'Атака наносит урон оружием только от бонуса Силы, накладывает Увечье на вражескую цель.',
    damageBase: 0, damagePerStr: WARRIOR_SWORD_STRIKE.damagePerStr, damageType: WARRIOR_SWORD_STRIKE.damageType, baseAccuracy: WARRIOR_SWORD_STRIKE.baseAccuracy, baseCritChance: WARRIOR_SWORD_STRIKE.baseCritChance,
    stateId: 'maimed', durationBase: 2, durationPerInt: 0, stackable: false,
    apCost: WARRIOR_SWORD_STRIKE.apCost, maxUsesPerTurn: 1, maxCooldown: 3,
    range: WARRIOR_SWORD_STRIKE.range, minRange: WARRIOR_SWORD_STRIKE.minRange, modifiable: WARRIOR_SWORD_STRIKE.modifiable, noLOS: false, isAOE: false, aoeSize: 1,
    target: 'any', isMaimingStrike: true, canCastOnAnyCell: true,
    effectDescription: 'Увечье [враг]',
    iconPath: 'assets/homm2/spell-maiming-strike.png',
    svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-maiming-strike.png" width="64" height="64"/></svg>'
  }, {
    id: 'charge', name: 'Рывок', abilityType: 'weapon-strike', level: 1, magicSchool: 'war', isShot: false,
    description: 'Заклинатель перемещается по прямой линии на несколько клеток к выбранной цели и наносит бонусный урон от силы за каждую клетку движения.',
    damageBase: WARRIOR_SWORD_STRIKE.damageBase, damagePerStr: WARRIOR_SWORD_STRIKE.damagePerStr, damageType: WARRIOR_SWORD_STRIKE.damageType, baseAccuracy: WARRIOR_SWORD_STRIKE.baseAccuracy, baseCritChance: WARRIOR_SWORD_STRIKE.baseCritChance,
    stackable: false,
    apCost: WARRIOR_SWORD_STRIKE.apCost + 1, maxUsesPerTurn: 1, maxCooldown: 3,
    range: 3, minRange: 1, modifiable: false, noLOS: false, isAOE: false, aoeSize: 1,
    target: 'any', isCharge: true,
    effectDescription: `За каждую пройденную клетку: +${WARRIOR_SWORD_STRIKE.damagePerStr}*STR к урону`,
    iconPath: 'assets/homm2/spell-charge.png',
    svg: '<svg viewBox="0 0 64 64" aria-hidden="true"><image href="assets/homm2/spell-charge.png" width="64" height="64"/></svg>'
  }],
  spellPages: [
    ['weapon-attack', 'maiming-strike', 'charge', null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
