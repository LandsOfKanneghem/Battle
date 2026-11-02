// Данные заклинаний. Размер глобальной зоны — все 16×16 клеток текущей карты.
const fireShieldSVG = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 19 Q1 10 12 2 L16 11 L25 1 L28 12 L36 7 Q41 25 26 35 H13 Z" fill="#f65a25"/><path d="M9 15 L20 10 L31 15 L29 28 Q26 34 20 37 Q14 34 11 28 Z" fill="#6d3f27" stroke="#ffce68" stroke-width="2"/><path d="M20 15 L17 23 H23 L20 31" fill="none" stroke="#ffe3a0" stroke-width="2"/></svg>`;

const WIZARD_SPELLS = [{
  id: 'fire-shot', isShot: true, name: 'Огненный выстрел', stackable: false, damage: 3, damageType: 'fire', burnDuration: 2,
  range: 6, apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 0, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 Q24 14 32 17 Q40 29 28 36 Q10 43 6 29 Q3 20 13 12 L12 24 Q22 19 20 2" fill="#f65a25"/><path d="M22 17 Q35 34 21 35 Q11 34 15 25 L19 28 Z" fill="#ffdc36"/></svg>`
}, {
  id: 'fire-cube', name: 'Огненный куб', stackable: false, damage: 6, damageType: 'fire', burnDuration: 2,
  range: 5, apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 2, isAOE: true, aoeSize: 3,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 24 Q0 14 8 3 L12 12 L20 1 L25 12 L34 4 Q42 19 35 31" fill="#f65a25"/><path d="M8 17 L20 10 L33 17 L33 31 L20 38 L8 31 Z" fill="#ff9d28" stroke="#ffdc36" stroke-width="2"/><path d="M8 17 L20 24 L33 17 M20 24 V38" fill="none" stroke="#ffe995" stroke-width="2"/></svg>`
}, {
  id: 'armageddon', name: 'Армагеддон', stackable: false, damage: 5, damageType: 'fire',
  range: 0, minRange: 0, apCost: 6, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 8, usesTotal: 0, maxUsesPerBattle: 1,
  isAOE: true, isGlobal: true, aoeSize: 16,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 16 Q0 10 8 8 Q10 1 17 6 Q24 0 28 7 Q37 5 38 12 Q40 18 32 18 H10 Z" fill="#f65a25"/><path d="M11 14 L14 8 L18 13 L23 6 L26 14" fill="#ffc04c"/><g stroke-linecap="round"><path d="M5 22 L10 29 M16 21 L22 30 M28 22 L34 31 M9 32 L13 38 M24 33 L28 38" stroke="#ff6425" stroke-width="4"/><path d="M9 27 L11 30 M21 28 L23 31 M33 29 L35 32 M12 36 L13 38 M27 36 L28 38" stroke="#ffdd75" stroke-width="2"/></g></svg>`
}, {
  id: 'fire-shield', name: 'Защита от Огня', stackable: false, isFireShield: true,
  shieldAmount: 2, shieldDuration: 2, minRange: 0, range: 5,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 1,
  isAOE: false, aoeSize: 1, svg: fireShieldSVG
}, {
  id: 'haste', name: 'Ускорение', stackable: false, magicSchool: 'air', stateId: 'speed', stateDuration: 3, effectDuration: 3, allyOnly: true,
  minRange: 0, range: 6, apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 1, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 12 H26 Q36 12 33 6 Q30 2 27 6 M4 20 H32 Q40 20 36 27 Q32 31 29 26 M6 29 H20 Q28 29 23 35" fill="none" stroke="#a7eced" stroke-width="3" stroke-linecap="round"/></svg>`
}, {
  id: 'slow', name: 'Замедление', stackable: false, magicSchool: 'earth', stateId: 'slowness', stateDuration: 2, effectDuration: 2, allyOnly: false,
  minRange: 0, range: 6, apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 1, isAOE: false, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 24 Q0 17 12 17 Q17 9 25 17 Q39 15 37 25 Q40 35 21 35 Q4 38 3 24" fill="#78522f" stroke="#bc8c50"/><ellipse cx="20" cy="24" rx="10" ry="4" fill="none" stroke="#c49e68"/><circle cx="29" cy="11" r="3" fill="#916337"/></svg>`
}, {
  id: 'deep-freeze', name: 'Глубокая заморозка', stackable: false, stateId: 'freeze', stateDuration: 2, effectDuration: 2, allyOnly: false,
  minRange: 1, range: 5, apCost: 4, maxUsesPerTurn: 1, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 4, isAOE: false, aoeSize: 1, svg: FREEZE.icon
}, {
  id: 'liquid-membrane', name: 'Жидкая мембрана', stackable: false, isMembrane: true, allyOnly: true,
  esAmount: 5, evaAmount: 50, effectDuration: 2, minRange: 0, range: 5,
  apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0, cooldown: 0, maxCooldown: 1,
  isAOE: true, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><radialGradient id="membrane-glow"><stop offset="0" stop-color="#e8ffff" stop-opacity=".25"/><stop offset=".75" stop-color="#70d4eb" stop-opacity=".5"/><stop offset="1" stop-color="#d3b4ff" stop-opacity=".8"/></radialGradient></defs><circle cx="20" cy="20" r="17" fill="url(#membrane-glow)" stroke="#a7f4ed" stroke-width="2"/><path d="M9 16 Q10 8 18 7 M24 33 Q32 31 33 24" fill="none" stroke="#ffdfae" stroke-width="2" stroke-linecap="round"/></svg>`
}];
// Все поля заклинания — примитивы, включая SVG-разметку, поэтому
// копии куба и ускорения имеют независимые cooldown и usesThisTurn.
const MONK_SPELLS = [{ ...WIZARD_SPELLS.find(spell => spell.id === 'fire-cube') }, {
  id: 'heal', name: 'Лечение', stackable: false, healAmount: 5, isHeal: true,
  range: 5, minRange: 0, apCost: 2, maxUsesPerTurn: 1, usesThisTurn: 0,
  // Одноклеточная зона использует те же два слоя подсветки, что и куб.
  cooldown: 0, maxCooldown: 1, isAOE: true, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#164a36" stroke="#83efac"/><path d="M15 8 H25 V15 H32 V25 H25 V32 H15 V25 H8 V15 H15 Z" fill="#74ef9e"/></svg>`
}, {
  id: 'light-flash', name: 'Вспышка света', stackable: false, damage: 2, damageType: 'light',
  minRange: 1, range: 6, apCost: 3, maxUsesPerTurn: 2, usesThisTurn: 0,
  cooldown: 0, maxCooldown: 0, noLOS: true, enemyOnly: true, isAOE: true, aoeSize: 1,
  svg: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 1 L24 13 L35 5 L28 17 L39 20 L28 24 L35 35 L24 28 L20 39 L16 28 L5 35 L12 24 L1 20 L12 16 L5 5 L16 12 Z" fill="#ffdb62"/><path d="M20 9 L23 17 L31 20 L23 23 L20 31 L17 23 L9 20 L17 17 Z" fill="#fffbe2"/></svg>`
}, { ...WIZARD_SPELLS.find(spell => spell.id === 'haste'), stateDuration: 2, effectDuration: 2 }];
