// Данные существа и его собственных способностей.
window.CREATURE_TEMPLATES['lake-spirit'] = {
  name: 'Дух озера', type: 'lake-spirit', ai: 'lake-spirit',
  level: 1, baseHP: 1, hpPerLevel: 0, baseWP: 0, wpPerLevel: 0, baseAP: 6, baseMP: 3, baseES: 0, baseVS: 0, baseRA: 0,
  baseCRI: 0, baseEVA: 0, baseSFC: 0, baseBLO: 0, baseINI: 0,
  baseAC: 0, basePhysical: 0, baseFire: 0, baseWater: 0, baseAir: 0,
  baseEarth: 0, baseMind: 0, basePoison: 0,
  attributes: { vit: 0, str: 0, att: 0, int: 0, wis: 0, cha: 0, luc: 0 },
  innateStates: ['water-entity', { id: 'levitation', permanent: true }],
  appearance: {
    sprite: 'assets/map-editor/mobs/lake-spirit.png',
    portrait: 'assets/homm2/portrait-lake-spirit.png',
    sourceSize: { width: 60, height: 72 },
    displaySize: { width: 60, height: 72 },
    padding: { top: 4, right: 3, bottom: 4, left: 2 },
    svg: `<circle cx="20" cy="22" r="12" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><ellipse cx="15" cy="17" rx="3" ry="2" fill="#fff" opacity=".6"/>`
  },
  // Собственные способности: одинаковые id у других существ не связывают их параметры.
  spells: [{
    id: 'water-shot', abilityType: 'spell', magicSchool: 'water', isShot: true, baseAccuracy: 80, baseCritChance: 10,
    name: 'Водный выстрел', stackable: false, damageBase: 3, damageType: 'water', target: 'any',
    description: 'Наносит небольшой урон водой.',
    range: 4, minRange: 1, modifiable: false, noLOS: false,
    apCost: 3, maxUsesPerTurn: 2, maxCooldown: 0,
    isAOE: false, aoeSize: 1,
    iconPath: 'assets/homm2/spell-water-shot.png',
    svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 30 Q2 22 10 14 Q18 6 28 10 Q36 14 34 24 Q32 34 20 34 Q12 34 8 30 Z" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><path d="M14 22 Q18 18 24 20" fill="none" stroke="#d0f4ff" stroke-width="1.5" opacity=".7"/></svg>`
  }],
  spellPages: [
    ['water-shot', null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null,
      null, null, null, null, null]
  ]
};
