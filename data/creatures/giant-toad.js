// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['giant-toad'] = {
  name: 'Гигантская жаба', type: 'giant-toad', ai: 'giant-toad',
  level: 6, baseHP: 25, hpPerLevel: 10, baseWP: 32, wpPerLevel: 8, baseAP: 5, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
  baseACC: 100, baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 4, str: 5, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
  appearance: {
    sprite: 'assets/map-editor/mobs/giant-toad.png',
    portrait: 'assets/homm2/portrait-giant-toad.png',
    sourceSize: { width: 60, height: 72 },
    displaySize: { width: 90, height: 108 },
    padding: { top: 37, right: 2, bottom: 4, left: 2 },
    svg: `
        <ellipse cx="17" cy="25" rx="14" ry="10" fill="#a34422" stroke="#3e221d" stroke-width="2"/>
        <path d="M10 26 Q0 25 3 34 L12 34 M26 26 L27 35 H35 L31 32 L30 25" fill="#bd5727" stroke="#3e221d" stroke-width="2"/>
        <ellipse cx="27" cy="22" rx="11" ry="8" fill="#bd5727" stroke="#3e221d" stroke-width="2"/>
        <path d="M19 27 Q29 36 36 26" fill="#c98a3d" stroke="#6f331d"/>
        <circle cx="24" cy="17" r="4" fill="#e58e24" stroke="#71351c"/>
        <path d="M22 17 H26 M29 26 L37 25" stroke="#291c1b" stroke-width="2"/>
        <circle cx="9" cy="21" r="2" fill="#6d2e22"/><circle cx="15" cy="18" r="2" fill="#de7530"/>`
  },
  // Способностей пока нет; каталог остаётся собственным и не наследует умения великана.
  spells: [],
  spellPages: [
    [null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
