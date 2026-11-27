// Данные существа: характеристики, графика и раскладка книги.
window.CREATURE_TEMPLATES['wizard'] = {
  name: 'Волшебник', type: 'wizard',
  partyOrder: 1,
  level: 1, baseHP: 8, hpPerLevel: 4, baseWP: 15, wpPerLevel: 5, baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
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
  attributes: { vit: 2, str: 0, att: 1, int: 2, wis: 2, cha: 1, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/wizard.png',
    portrait: 'assets/homm2/portrait-wizard.png',
    displaySize: { width: 72, height: 86 },
    padding: { top: 4.777778, right: 8.4, bottom: 4.777778, left: 8.4 },
    svg: `
      <path d="M11 36 L15 20 L25 20 L30 36 Z" fill="#287dff" stroke="#102e70"/>
      <circle cx="20" cy="17" r="6" fill="#ffd6a0"/>
      <path d="M9 13 L20 2 L30 13 Z" fill="#ffdc36" stroke="#a77c00"/>
      <path d="M8 13 H32" stroke="#ffdc36" stroke-width="3"/>
      <circle cx="18" cy="17" r="1" fill="#20202b"/>
      <circle cx="23" cy="17" r="1" fill="#20202b"/>
      <path d="M17 22 L21 29 L25 22" fill="#f5f0df"/>
      <path d="M32 35 L34 20" stroke="#ce9b56" stroke-width="2"/>
      <circle cx="34" cy="19" r="2.5" fill="#86e8ff"/>`
  },
  spellPages: [
    ['fire-shot', 'burning-hands', 'reckless', 'torch', 'teleport',
      'liquid-membrane', 'rain', 'ice-arrow', 'lake-spirit', null,
      'haste', 'wind-rose', 'sparks', 'sky-shot', 'water-walk',
      'slow', 'dead-weight', 'enchant-stones', null, 'apply-old-age'],
    ['fire-shield', 'water-shield', 'earth-shield', 'air-shield', 'stone-skin',
      'fire-cube', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
