// Данные заклинаний. Размер глобальной зоны — все 16×16 клеток текущей карты.
const fireShieldSVG = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 19 Q1 10 12 2 L16 11 L25 1 L28 12 L36 7 Q41 25 26 35 H13 Z" fill="#f65a25"/><path d="M9 15 L20 10 L31 15 L29 28 Q26 34 20 37 Q14 34 11 28 Z" fill="#6d3f27" stroke="#ffce68" stroke-width="2"/><path d="M20 15 L17 23 H23 L20 31" fill="none" stroke="#ffe3a0" stroke-width="2"/></svg>`;

// Общие параметры защит; каждый слот хранит собственный кулдаун и лимит каста.
const ELEMENTAL_SHIELD_SPELLS = [
  { damageType: 'fire', name: 'Огня', svg: fireShieldSVG },
  { damageType: 'water', name: 'Воды', color: '#2465a5', edge: '#90ddff',
    symbol: '<path d="M20 12 Q10 25 16 28 Q20 32 24 28 Q30 25 20 12 Z" fill="#9ce7ff"/>' },
  { damageType: 'earth', name: 'Земли', color: '#775035', edge: '#dfbd7d',
    symbol: '<path d="M12 28 L18 16 L22 21 L25 18 L30 28 Z" fill="#d5b18a" stroke="#f3d9a3"/>' },
  { damageType: 'air', name: 'Воздуха', color: '#72aebc', edge: '#d3ffff',
    symbol: '<path d="M12 18 H24 Q30 18 27 14 Q25 11 23 14 M11 23 H28 Q33 23 29 27 M15 28 H21" fill="none" stroke="#e3ffff" stroke-width="2" stroke-linecap="round"/>' }
].map(element => ({
  id: `${element.damageType}-shield`, abilityType: 'spell', name: `Защита от ${element.name}`,
  stackable: false, isElementalShield: true, magicSchool: element.damageType, damageType: element.damageType, target: 'ally',
  description: `Союзная цель блокирует часть урона от ${{ fire: 'огня', water: 'воды', earth: 'земли', air: 'воздуха' }[element.damageType]}.`,
  shieldAmount: 2, durationBase: 3, durationPerInt: 0.05, minRange: 0, range: 4, modifiable: true,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1,
  svg: element.svg ?? `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 10 L20 3 L33 10 L31 27 Q28 34 20 38 Q12 34 9 27 Z" fill="${element.color}" stroke="${element.edge}" stroke-width="2"/>${element.symbol}</svg>`
}));

const SPELL_DEFINITIONS = [{
  id: 'power-hour', durationBase: 2, durationPerInt: 0.025, abilityType: 'spell', magicSchool: 'light',
  name: 'Час силы', stackable: false, target: 'ally',
  description: 'Все союзные существа в области вокруг заклинателя временно получают основные параметры.',
  effectDescription: '+3 ALL STATS',
  range: 0, minRange: 0, modifiable: false, noLOS: false,
  apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 5,
  isAOE: true, aoeSize: 7, isDiamond: true, isPowerHour: true,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="9" fill="#ffdc36" stroke="#fff9c4" stroke-width="2"/><path d="M20 2 V7 M20 33 V38 M2 20 H7 M33 20 H38 M7 7 L11 11 M29 29 L33 33 M7 33 L11 29 M29 11 L33 7" fill="none" stroke="#fff9c4" stroke-width="3" stroke-linecap="round"/><path d="M20 12 L17 21 H22 L20 28" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`
}, {
  id: 'apply-old-age', durationBase: 2, durationPerInt: 0.025, abilityType: 'spell', magicSchool: 'dark',
  name: 'Наложить Старость', stackable: false, target: 'enemy',
  description: 'Накладывает Старость на вражескую цель.', effectDescription: 'Старость',
  stateId: 'old-age',
  range: 6, minRange: 1, modifiable: false, noLOS: true,
  apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 4,
  isAOE: false, aoeSize: 1,
  svg: OLD_AGE.icon.replace('aria-hidden="true">', 'aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="3" fill="#101015"/>')
}, {
  id: 'water-walk', durationBase: 1, durationPerInt: 0, abilityType: 'spell', magicSchool: 'air',
  name: 'Хождение по воде', stackable: false, target: 'ally',
  description: 'Накладывает Левитацию на союзную цель.', effectDescription: 'Левитация',
  stateId: 'levitation',
  range: 0, minRange: 0, modifiable: false, noLOS: false,
  apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 4,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 24 Q10 18 20 20 Q30 22 36 18 M4 30 Q10 24 20 26 Q30 28 36 24" fill="none" stroke="#6fbaff" stroke-width="2"/><path d="M20 4 Q22 10 26 12 Q32 15 30 20 Q28 26 20 26 Q12 26 10 20 Q8 15 14 12 Q18 10 20 4 Z" fill="#d5edf6" stroke="#829ea9" stroke-width="2"/></svg>`
}, {
  id: 'teleport', abilityType: 'spell', magicSchool: 'air', isTeleport: true,
  name: 'Перемещение', stackable: false, target: 'none',
  description: 'Заклинатель телепортируется в указанную клетку.',
  range: 5, minRange: 1, modifiable: false, noLOS: true,
  apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="#a7eced" stroke-width="2" stroke-dasharray="4 3"/><path d="M20 6 V14 M14 10 L20 16 L26 10" fill="none" stroke="#c3ffff" stroke-width="2.5" stroke-linecap="round"/><path d="M20 34 V26 M14 30 L20 24 L26 30" fill="none" stroke="#c3ffff" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="20" r="3" fill="#86e8ff"/></svg>`
}, {
  id: 'club-smash', isHit: true, abilityType: 'weapon-strike', name: 'Удар дубиной', stackable: false,
  damage: 24, damageType: 'physical', target: 'any',
  range: 1, minRange: 1, modifiable: false, noLOS: false,
  apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 1,
  isAOE: false, aoeSize: 1, isShot: false,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M10 36 L23 13" stroke="#a77b4b" stroke-width="6" stroke-linecap="round"/><path d="M19 4 L31 2 L37 13 L25 23 L16 15 Z" fill="#775035" stroke="#d3ad76" stroke-width="2"/><path d="M24 7 L29 15 M30 6 L33 11" stroke="#493326" stroke-width="2"/></svg>`
}, {
  id: 'boulder-throw', abilityType: 'weapon-strike', name: 'Бросок булыжника', stackable: false,
  damage: 16, damageType: 'physical', target: 'any',
  range: 4, minRange: 1, modifiable: false, noLOS: false,
  apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 3,
  isAOE: false, aoeSize: 1, isShot: true,
  description: 'Бросает булыжник, нанося физический урон по цели.',
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 12 L22 5 L34 13 L36 28 L24 36 L7 30 L3 20 Z" fill="#8b8f96" stroke="#d1d5dc" stroke-width="2"/><path d="M9 12 L17 22 L7 30 M17 22 L31 18 L34 13 M17 22 L24 36" fill="none" stroke="#565d68" stroke-width="2"/></svg>`
}, {
  id: 'bite', isHit: true, isShot: false, effectDescription: 'Кровотечение [50%]', abilityType: 'weapon-strike', magicSchool: null, name: 'Укус волка', stackable: false,
  damage: 4, damageType: 'physical', target: 'any',
  description: 'Наносит физический урон и с шансом 50% накладывает на цель 1 стак кровотечения.',
  stateId: 'bleeding', bleedChance: 50, bleedDuration: 2,
  range: 1, minRange: 1, modifiable: false, noLOS: false,
  apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0, cooldown: 0, maxCooldown: 0, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 8 Q10 4 14 6 L18 10 Q20 8 22 10 L26 6 Q30 4 32 8 L28 18 L32 28 Q30 32 26 30 L22 26 Q20 28 18 26 L14 30 Q10 32 8 28 L12 18 Z" fill="#c93650" stroke="#ffadb6" stroke-width="2"/><circle cx="16" cy="14" r="2" fill="#fff"/><circle cx="24" cy="14" r="2" fill="#fff"/></svg>`
}, {
  id: 'water-shot', abilityType: 'spell', magicSchool: 'water', isShot: true,
  name: 'Водный выстрел', stackable: false, damage: 3, damageType: 'water', target: 'any',
  description: 'Наносит небольшой урон водой.',
  range: 4, minRange: 1, modifiable: false, noLOS: false,
  apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0, cooldown: 0, maxCooldown: 0,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 30 Q2 22 10 14 Q18 6 28 10 Q36 14 34 24 Q32 34 20 34 Q12 34 8 30 Z" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><path d="M14 22 Q18 18 24 20" fill="none" stroke="#d0f4ff" stroke-width="1.5" opacity=".7"/></svg>`
}, {
  id: 'lake-spirit', durationBase: 2, durationPerInt: 0, abilityType: 'spell', name: 'Дух озера', stackable: false, isSummon: true, target: 'none',
  description: 'Призывает левитирующий шар воды. Дух озера наносит слабый урон водой на небольшой дистанции. Исчезает, получив 1 атаку.',
  minRange: 1, range: 1, modifiable: false, noLOS: false,
  apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1, magicSchool: 'water',
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="12" fill="#2a7fff" stroke="#a0d4ff" stroke-width="2"/><ellipse cx="15" cy="17" rx="3" ry="2" fill="#d0f4ff" opacity=".7"/><path d="M8 14 Q14 8 22 10" fill="none" stroke="#a0d4ff" stroke-width="1.5" opacity=".6"/><path d="M20 6 V2 M14 4 L20 2 L26 4" fill="none" stroke="#c3ffff" stroke-width="2" stroke-linecap="round"/></svg>`
}, {
  id: 'fire-shot', abilityType: 'spell', magicSchool: 'fire', isShot: true, name: 'Огненный выстрел', stackable: false, damageBase: 2, damagePerInt: 1, damageType: 'fire', target: 'any',
  description: 'Наносит урон огнем по одиночной цели.',
  range: 6, minRange: 1, modifiable: true, noLOS: false, apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 0, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 Q24 14 32 17 Q40 29 28 36 Q10 43 6 29 Q3 20 13 12 L12 24 Q22 19 20 2" fill="#f65a25"/><path d="M22 17 Q35 34 21 35 Q11 34 15 25 L19 28 Z" fill="#ffdc36"/></svg>`
}, {
  id: 'fire-cube', durationBase: 2, durationPerInt: 0, abilityType: 'spell', magicSchool: 'fire', name: 'Огненный куб', stackable: false, damageBase: 8, damagePerInt: 2, damageType: 'fire', appliesBurning: true, target: 'any',
  range: 5, minRange: 1, modifiable: true, apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 2, isAOE: true, aoeSize: 3,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 24 Q0 14 8 3 L12 12 L20 1 L25 12 L34 4 Q42 19 35 31" fill="#f65a25"/><path d="M8 17 L20 10 L33 17 L33 31 L20 38 L8 31 Z" fill="#ff9d28" stroke="#ffdc36" stroke-width="2"/><path d="M8 17 L20 24 L33 17 M20 24 V38" fill="none" stroke="#ffe995" stroke-width="2"/></svg>`
}, {
  id: 'armageddon', abilityType: 'spell', magicSchool: 'fire', name: 'Армагеддон', stackable: false, damage: 5, damageType: 'fire', target: 'any',
  range: 0, minRange: 0, apCost: 6, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 8, usesTotal: 0, maxUsesPerBattle: 1,
  isAOE: true, isGlobal: true, aoeSize: 16,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 16 Q0 10 8 8 Q10 1 17 6 Q24 0 28 7 Q37 5 38 12 Q40 18 32 18 H10 Z" fill="#f65a25"/><path d="M11 14 L14 8 L18 13 L23 6 L26 14" fill="#ffc04c"/><g stroke-linecap="round"><path d="M5 22 L10 29 M16 21 L22 30 M28 22 L34 31 M9 32 L13 38 M24 33 L28 38" stroke="#ff6425" stroke-width="4"/><path d="M9 27 L11 30 M21 28 L23 31 M33 29 L35 32 M12 36 L13 38 M27 36 L28 38" stroke="#ffdd75" stroke-width="2"/></g></svg>`
}, {
  id: 'haste', durationBase: 2, durationPerInt: 0.025, abilityType: 'spell', effectDescription: 'Скорость', name: 'Ускорение', stackable: false, magicSchool: 'air', stateId: 'speed', target: 'ally',
  description: 'Накладывает на союзную цель Скорость.',
  minRange: 0, range: 4, modifiable: true, apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 2, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 12 H26 Q36 12 33 6 Q30 2 27 6 M4 20 H32 Q40 20 36 27 Q32 31 29 26 M6 29 H20 Q28 29 23 35" fill="none" stroke="#a7eced" stroke-width="3" stroke-linecap="round"/></svg>`
}, {
  id: 'slow', durationBase: 2, durationPerInt: 0, abilityType: 'spell', effectDescription: 'Медлительность', name: 'Замедление', stackable: false, magicSchool: 'earth', stateId: 'slowness', target: 'enemy',
  description: 'Накладывает на вражескую цель Медлительность.',
  minRange: 0, range: 4, modifiable: true, apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 2, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 24 Q0 17 12 17 Q17 9 25 17 Q39 15 37 25 Q40 35 21 35 Q4 38 3 24" fill="#78522f" stroke="#bc8c50"/><ellipse cx="20" cy="24" rx="10" ry="4" fill="none" stroke="#c49e68"/><circle cx="29" cy="11" r="3" fill="#916337"/></svg>`
}, {
  id: 'deep-freeze', durationBase: 2, durationPerInt: 0, abilityType: 'spell', effectDescription: 'Заморозка', magicSchool: 'water', name: 'Глубокая заморозка', stackable: false, stateId: 'freeze', target: 'any',
  minRange: 1, range: 5, modifiable: true, apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 4, isAOE: false, aoeSize: 1, svg: FREEZE.icon
}, ...ELEMENTAL_SHIELD_SPELLS, {
  id: 'liquid-membrane', durationBase: 2, durationPerInt: 0.05, abilityType: 'spell', magicSchool: 'water', name: 'Жидкая мембрана', stackable: false, isMembrane: true, target: 'ally',
  description: 'Дает союзной цели бонусное уклонение и энергощит.',
  esAmount: 4, evaAmount: 10, minRange: 0, range: 4, modifiable: true, noLOS: false,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><radialGradient id="membrane-glow"><stop offset="0" stop-color="#e8ffff" stop-opacity=".25"/><stop offset=".75" stop-color="#70d4eb" stop-opacity=".5"/><stop offset="1" stop-color="#d3b4ff" stop-opacity=".8"/></radialGradient></defs><circle cx="20" cy="20" r="17" fill="url(#membrane-glow)" stroke="#a7f4ed" stroke-width="2"/><path d="M9 16 Q10 8 18 7 M24 33 Q32 31 33 24" fill="none" stroke="#ffdfae" stroke-width="2" stroke-linecap="round"/></svg>`
}, {
  id: 'rain', durationBase: 3, durationPerInt: 0, abilityType: 'spell', effectDescription: 'Влага', magicSchool: 'water', name: 'Дождь', stackable: false, isRain: true, stateId: 'wet', target: 'any',
  description: 'Накладывает на все цели в области действия Влагу.',
  minRange: 0, range: 4, modifiable: true, noLOS: true,
  apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 3,
  isAOE: true, aoeSize: 3,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 22 Q1 21 4 14 Q6 9 12 11 Q13 2 22 5 Q29 4 31 12 Q39 11 37 19 Q36 23 30 22 Z" fill="#427fb6" stroke="#a0d4ff" stroke-width="2"/><path d="M11 27 L8 33 M21 27 L18 36 M31 27 L28 33" fill="none" stroke="#58b5ff" stroke-width="3" stroke-linecap="round"/></svg>`
}, {
  id: 'wind-rose', abilityType: 'spell', magicSchool: 'air', name: 'Роза ветров', stackable: false, isWindRose: true, target: 'any',
  description: 'Отталкивает существ, стоящих на соседних клетках от целевой клетки, на расстояние 1 клетки, если это возможно.',
  minRange: 0, range: 4, modifiable: true, noLOS: true,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 3,
  // Подсвечиваем только центр; толчок проверяет четыре соседние клетки отдельно.
  isAOE: true, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="none" stroke="#70aebc" stroke-width="2"/><path d="M20 2 L24 16 L38 20 L24 24 L20 38 L16 24 L2 20 L16 16 Z" fill="#b8f3f5" stroke="#498998"/><path d="M20 8 V32 M8 20 H32" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="3" fill="#447d99"/></svg>`
}, {
  id: 'dead-weight', durationBase: 2, durationPerInt: 0, abilityType: 'spell', effectDescription: 'Тяжесть', magicSchool: 'earth', name: 'Мёртвый груз', stackable: false, target: 'any', stateId: 'heavy',
  description: 'Накладывает на одиночную цель Тяжесть.',
  minRange: 0, range: 4, modifiable: true, noLOS: false,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 3,
  isAOE: false, aoeSize: 1, svg: HEAVY.icon
}, {
  id: 'burning-hands', abilityType: 'spell', magicSchool: 'fire', name: 'Опаляющие руки', stackable: false, isCone: true, target: 'any',
  description: 'Наносит урон огнем в конусном АОЕ на близкой дистанции. Снимает Влагу, Охлаждение и Заморозку.',
  damageBase: 4, damagePerInt: 1.5, damageType: 'fire', minRange: 1, range: 1, modifiable: false, noLOS: false,
  apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 1,
  isAOE: true, aoeSize: 3,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 23 Q1 14 10 3 L14 13 L20 1 L25 13 L33 5 Q42 25 30 34 H11 Z" fill="#fa642b"/><path d="M12 34 L9 23 Q9 19 12 21 L16 25 V13 Q16 10 19 12 V22 V10 Q21 7 23 11 V23 V14 Q26 11 27 15 V25 L30 21 Q34 20 32 26 L28 35 Z" fill="#ffd18b" stroke="#a95429"/><path d="M16 38 H28" stroke="#ffe4ac" stroke-width="2"/></svg>`
}, {
  id: 'ice-arrow', durationBase: 2, durationPerInt: 0, abilityType: 'spell', effectDescription: 'Охлаждение', magicSchool: 'water', name: 'Ледяная стрела', stackable: false, isShot: true, target: 'any',
  description: 'Наносит водой по одиночной цели и накладывает на нее Охлаждение.',
  damageBase: 2, damagePerInt: 1, damageType: 'water', stateId: 'chill',
  minRange: 1, range: 5, modifiable: true, noLOS: false,
  apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0, cooldown: 0, maxCooldown: 0,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 34 L29 12" stroke="#bcefff" stroke-width="4"/><path d="M19 11 L36 4 L29 21 L27 13 Z" fill="#80dcff" stroke="#e3faff" stroke-width="2"/><path d="M4 26 L12 28 L14 36 M7 22 L15 24 L18 33" fill="none" stroke="#5aaad6" stroke-width="3"/><path d="M28 4 V14 M23 9 H33" stroke="#f0fdff" stroke-width="1.5"/></svg>`
}, {
  id: 'stone-skin', abilityType: 'spell', magicSchool: 'earth', name: 'Каменная кожа', stackable: false, isElementalShield: true, damageType: 'physical', target: 'ally',
  description: 'Союзная цель блокирует часть физического урона.',
  shieldAmount: 2, durationBase: 3, durationPerInt: 0.05, minRange: 0, range: 4, modifiable: true, noLOS: false,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 5 L20 2 L32 7 L35 21 L29 33 L20 38 L8 32 L4 18 Z" fill="#858e98" stroke="#cdd4db" stroke-width="2"/><path d="M20 3 L17 13 L23 20 L17 28 L20 37 M17 13 L5 17 M23 20 L34 16 M17 28 L9 32 M23 20 L29 32" fill="none" stroke="#434e5a" stroke-width="2"/><path d="M10 8 L14 7 M27 9 L29 12" stroke="#e3e7eb" stroke-width="2" stroke-linecap="round"/></svg>`
}, {
  id: 'sparks', abilityType: 'spell', magicSchool: 'air', name: 'Искры', stackable: false, isSparks: true, isShot: true, target: 'any',
  description: 'Наносит урон воздухом по одиночной цели, от нее отскакивает 2 искры в ближайшие цели на расстоянии 3 клеток, наносящие половину урона (несколько искр в одну цель отлететь не могут).',
  damageBase: 2, damagePerInt: 1, damageType: 'air', sparkRadius: 3, sparkCount: 2,
  minRange: 1, range: 5, modifiable: true, noLOS: false,
  apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0, cooldown: 0, maxCooldown: 0,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M23 2 L9 22 H19 L15 38 L33 15 H23 Z" fill="#ffe36b" stroke="#fff5be" stroke-width="1.5"/><path d="M7 5 L3 12 L9 11 M34 28 L38 23 M32 35 L37 37 M8 30 L3 34" fill="none" stroke="#83eaff" stroke-width="2.5" stroke-linecap="round"/></svg>`
}, {
  id: 'sky-shot', durationBase: 1, durationPerInt: 0, abilityType: 'spell', magicSchool: 'air', name: 'Выстрел в небо', stackable: false, isSkyShot: true, target: 'ally',
  description: 'Следующая дальнобойная атака цели или заклинание с типом Выстрел не требует LOS, а дальность применения увеличивается (если дальность атаки или заклинания модифицируема).',
  effectDescription: 'Следующая дальнобойная атака цели или заклинание с типом Выстрел не требует LOS, а ее дальность увеличивается на 2 клетки.',
  minRange: 0, range: 4, modifiable: true, noLOS: false,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 29 Q0 27 4 23 Q7 20 11 22 Q12 16 18 18 Q24 16 27 22 Q35 20 36 27 Q35 31 29 30 Z" fill="#729cbf" stroke="#c4e7ff"/><path d="M20 35 V6 M11 15 L20 5 L29 15" fill="none" stroke="#ffe7a0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 3 V11 M28 7 H36" stroke="#d5f8ff" stroke-width="2"/></svg>`
}, {
  id: 'reckless', durationBase: 2, durationPerInt: 0.025, abilityType: 'spell', effectDescription: 'Адреналин', magicSchool: 'fire', name: 'Сорвиголова', stackable: false, target: 'ally',
  description: 'Накладывает на союзную цель состояние Адреналин.',
  stateId: 'adrenaline',
  minRange: 0, range: 4, modifiable: true, noLOS: false,
  apCost: 1, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 4,
  isAOE: false, aoeSize: 1, svg: ADRENALINE.icon
}];
// Определения сохранены; вернуть скрытые заклинания можно строкой WIZARD_SPELLS.push(...HIDDEN_SPELLS).
const HIDDEN_SPELLS = SPELL_DEFINITIONS.filter(spell => ['fire-cube', 'deep-freeze', 'armageddon'].includes(spell.id));
const WIZARD_SPELLS = [
  'fire-shot', 'fire-shield', 'water-shield', 'earth-shield', 'air-shield', 'stone-skin',
  'haste', 'slow', 'liquid-membrane', 'rain', 'wind-rose', 'dead-weight', 'burning-hands', 'ice-arrow', 'sparks', 'sky-shot', 'reckless', 'lake-spirit'
].map(id => SPELL_DEFINITIONS.find(spell => spell.id === id));

// Все поля заклинания — примитивы, включая SVG-разметку, поэтому
// копии куба и ускорения имеют независимые cooldown и usesThisTurn.
const MONK_SPELLS = [{ ...SPELL_DEFINITIONS.find(spell => spell.id === 'fire-cube') }, {
  id: 'heal-harm', abilityType: 'spell', magicSchool: 'body', name: 'Исцелить/ранить', stackable: false, isHealHarm: true, target: 'any',
  description: 'Исцеляет хп дружественной цели и снимает 1 стак кровотечения, либо наносит физический урон и накладывает 1 стак кровотечения.',
  minRange: 0, range: 4, modifiable: false, noLOS: false, apCost: 2,
  cooldown: 0, maxCooldown: 1, maxUsesPerTurn: 1, usesThisTurn: 0, isAOE: false, aoeSize: 1,
  damage: 4, damageType: 'physical', healAmount: 4, bleedDuration: 2, stateId: 'bleeding',
  effectDescription: 'Исцеляет 4 HP и снимает 1 стак кровотечения [союзник] / Наносит 4 физ. урона и накладывает 1 стак кровотечения [враг]',
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M15 3 H20 V37 H15 V25 H3 V15 H15 Z" fill="#74ef9e"/><path d="M20 3 H25 V15 H37 V25 H25 V37 H20 Z" fill="#ed5d70"/><path d="M20 3 V37" stroke="#fff1d2" stroke-width="1.5"/></svg>`
}, {
  id: 'light-flash', abilityType: 'spell', magicSchool: 'light', name: 'Вспышка света', stackable: false, damage: 2, damageType: 'light', target: 'enemy',
  minRange: 1, range: 6, modifiable: true, apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 0, noLOS: true, isAOE: true, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 1 L24 13 L35 5 L28 17 L39 20 L28 24 L35 35 L24 28 L20 39 L16 28 L5 35 L12 24 L1 20 L12 16 L5 5 L16 12 Z" fill="#ffdb62"/><path d="M20 9 L23 17 L31 20 L23 23 L20 31 L17 23 L9 20 L17 17 Z" fill="#fffbe2"/></svg>`
}, { ...WIZARD_SPELLS.find(spell => spell.id === 'haste') }, {
  id: 'weakness-vigor', durationBase: 2, durationPerInt: 0, abilityType: 'spell', magicSchool: 'body', name: 'Наложить слабость / бодрость', stackable: false, isWeaknessVigor: true, target: 'any',
  description: 'Накладывает Слабость на вражескую цель либо Бодрость на союзную цель.',
  effectDescription: 'Слабость [враг] / Бодрость [союз]',
  minRange: 0, range: 4, modifiable: false, noLOS: false,
  apCost: 3, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 2,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M11 5 V33 M4 25 L11 33 L18 25" fill="none" stroke="#ef777f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 35 V7 M22 15 L29 7 L36 15" fill="none" stroke="#82e9a5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}, {
  id: 'sprint', durationBase: 1, durationPerInt: 0, abilityType: 'spell', magicSchool: 'body', name: 'Спринт', stackable: false, isMpBuff: true, target: 'ally',
  description: 'Добавляет заклинателю несколько ОП на 1 ход.',
  mpAmount: 3, minRange: 0, range: 0, modifiable: false, noLOS: true,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 4,
  isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 10 H17 M1 20 H13 M3 30 H17" stroke="#a7eced" stroke-width="3" stroke-linecap="round"/><path d="M21 6 L35 20 L21 34 V25 H12 V15 H21 Z" fill="#74ef9e" stroke="#d9ffdf" stroke-width="2"/></svg>`
}];
