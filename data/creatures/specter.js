// Данные существа: характеристики, графика и раскладка книги.
window.CREATURE_TEMPLATES['specter'] = {
  name: 'Спектр', type: 'specter', ai: 'specter',
  level: 1, baseHP: 8, hpPerLevel: 5, baseWP: 15, wpPerLevel: 6, baseAP: 6, baseMP: 4, baseES: 0, baseVS: 0, baseRA: 0,
  baseACC: 100, baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 2, str: 2, att: 1, int: 2, wis: 2, cha: 1, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/specter.png',
    portrait: 'assets/homm2/portrait-specter.png',
    sourceSize: { width: 72, height: 86 },
    displaySize: { width: 72, height: 86 },
    padding: { top: 0, right: 8, bottom: 3, left: 7 },
    svg: `<path d="M16 14 Q10 8 16 4 Q23 1 25 8 L23 14 L29 20 L34 29 L30 31 L25 24 L25 30 L30 38 H23 L20 31 L17 38 H10 L15 28 L14 22 L9 31 L5 29 L10 19 Z M17 8 H20 V10 H17 Z M18 18 H21 V21 H18 Z M21 25 H23 V28 H21 Z" fill="#000" fill-rule="evenodd"/>`
  },
  // Собственных умений пока нет; заклинания монаха не наследуются.
  spells: [],
  spellPages: [
    [null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
