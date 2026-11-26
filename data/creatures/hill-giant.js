// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['hill-giant'] = {
  name: 'Холмовой Великан', type: 'hill-giant', ai: 'hill-giant',
  level: 6, baseHP: 25, hpPerLevel: 10, baseWP: 32, wpPerLevel: 8, baseAP: 5, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
  baseACC: 100, baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 4, str: 5, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
  innateStates: [{ id: 'heavy', permanent: true }],
  appearance: {
    sprite: 'assets/map-editor/mobs/hill-giant.png',
    portrait: 'assets/homm2/portrait-hill-giant.png',
    displaySize: { width: 90, height: 108 },
    padding: { top: 4.777778, right: 10.8, bottom: 4.777778, left: 9.6 },
    svg: `<path d="M8 37 L10 19 Q20 13 29 20 L31 37 H23 L21 29 L18 37 Z" fill="#807467" stroke="#c7b69c"/><path d="M10 21 L4 30 L8 33 L15 25 M27 22 L34 27" fill="none" stroke="#a59580" stroke-width="6" stroke-linecap="round"/><circle cx="20" cy="11" r="8" fill="#a59580" stroke="#5f544b"/><path d="M13 8 L17 4 H25 L28 10" fill="#544638"/><circle cx="17" cy="11" r="1.2" fill="#fff0c6"/><circle cx="23" cy="11" r="1.2" fill="#fff0c6"/><path d="M17 16 H23 M35 35 L32 15" stroke="#493425" stroke-width="3"/><path d="M29 4 L35 3 L39 17 L32 20 Z" fill="#76502d" stroke="#b18a53" stroke-width="2"/>`,
    svgStyle: { display: 'block', width: '100%', height: '100%',
      position: 'absolute', inset: '0', zIndex: '3', pointerEvents: 'none' }
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'boulder-smash', abilityType: 'weapon-strike', name: 'Удар булыжником', stackable: false,
    damageBase: 18, damagePerStr: 2, damageType: 'physical', target: 'any',
    range: 1, minRange: 1, modifiable: false, noLOS: false,
    apCost: 4, maxUsesPerTurn: 1, maxCooldown: 1,
    isAOE: false, aoeSize: 1, isShot: false,
    iconPath: 'assets/homm2/spell-boulder-smash.png',
    svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 12 L22 5 L34 13 L36 28 L24 36 L7 30 L3 20 Z" fill="#8b8f96" stroke="#d1d5dc" stroke-width="2"/><path d="M9 12 L17 22 L7 30 M17 22 L31 18 L34 13 M17 22 L24 36" fill="none" stroke="#565d68" stroke-width="2"/></svg>`
  }, {
    id: 'boulder-throw', abilityType: 'weapon-strike', name: 'Бросок булыжника', stackable: false,
    damageBase: 10, damagePerStr: 1.5, damageType: 'physical', target: 'any',
    range: 4, minRange: 1, modifiable: false, noLOS: false,
    apCost: 4, maxUsesPerTurn: 1, maxCooldown: 3,
    isAOE: false, aoeSize: 1, isShot: true,
    description: 'Бросает булыжник, нанося физический урон по цели.',
    iconPath: 'assets/homm2/spell-boulder-throw.png',
    svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 12 L22 5 L34 13 L36 28 L24 36 L7 30 L3 20 Z" fill="#8b8f96" stroke="#d1d5dc" stroke-width="2"/><path d="M9 12 L17 22 L7 30 M17 22 L31 18 L34 13 M17 22 L24 36" fill="none" stroke="#565d68" stroke-width="2"/></svg>`
  }],
  spellPages: [
    ['boulder-smash', 'boulder-throw', null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
