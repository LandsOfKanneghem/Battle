// Данные существа: характеристики, графика и раскладка книги.
window.CREATURE_TEMPLATES['monk'] = {
  name: 'Монах', type: 'monk',
  partyOrder: 2,
  level: 1, baseHP: 8, hpPerLevel: 5, baseWP: 15, wpPerLevel: 6, baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
  baseACC: 100, baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 2, str: 2, att: 1, int: 2, wis: 2, cha: 1, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/monk.png',
    portrait: 'assets/homm2/portrait-monk.png',
    displaySize: { width: 72, height: 86 },
    padding: { top: 7.166667, right: 10.8, bottom: 4.777778, left: 10.8 },
    svg: `
      <path d="M10 37 L14 21 L26 21 L31 37 Z" fill="#b86028" stroke="#713c22"/>
      <path d="M15 22 L25 35 M25 22 L15 35" stroke="#e7a34a" stroke-width="3"/>
      <circle cx="20" cy="13" r="7" fill="#f1be8d"/>
      <circle cx="18" cy="13" r="1" fill="#30241e"/>
      <circle cx="23" cy="13" r="1" fill="#30241e"/>
      <path d="M12 27 L20 29 L28 27" fill="none" stroke="#f1be8d" stroke-width="3"/>
      <path d="M33 36 V10" stroke="#bc9159" stroke-width="2"/>`
  },
  spellPages: [
    ['sprint', 'heal-harm', 'weakness-vigor', null, null,
      'light-flash', 'power-hour', null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
