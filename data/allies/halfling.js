// Полурослик: союзный герой с собственным стрелковым оружием.
const HALFLING_SLING_SHOT = window.EQUIPMENT_ITEMS['halfling-weapon'].attack;

window.CREATURE_TEMPLATES.halfling = {
  name: 'Полурослик', type: 'halfling', partyOrder: 5,
  level: 1, baseHP: 14, hpPerLevel: 7, baseWP: 10, wpPerLevel: 4,
  baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  Equipment: {
    head: null,
    boots: null,
    gloves: null,
    belt: null,
    chest: window.EQUIPMENT_ITEMS['lightweight-chest-protector'],
    rightHand: window.EQUIPMENT_ITEMS['halfling-weapon'],
    leftHand: null,
    other1: null,
    other2: null,
  },
  attributes: { vit: 2, str: 2, att: 2, int: 0, wis: 1, cha: 0, luc: 1 },
  appearance: {
    sprite: 'assets/map-editor/mobs/halfling.png', portrait: 'assets/homm2/portrait-halfling.png',
    displaySize: { width: 72, height: 86 }, padding: { top: 4, right: 4, bottom: 4, left: 4 },
    svg: '<image href="assets/map-editor/mobs/halfling.png" width="40" height="40"/>'
  },
  spells: [],
  spellPages: [
    ['weapon-attack', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
