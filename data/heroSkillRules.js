// Pure skill effects shared with MapEditor. Creature abilities are not skill-gated.
((root) => {
  'use strict';
  const HEROES = ['wizard', 'monk', 'warrior', 'archer', 'halfling', 'druid'];
  const schools = { fire: ['fire-magic', 'Магия огня'], water: ['water-magic', 'Магия воды'],
    earth: ['earth-magic', 'Магия земли'], air: ['air-magic', 'Магия воздуха'], light: ['light-magic', 'Магия света'],
    dark: ['dark-magic', 'Магия тьмы'], order: ['order-magic', 'Магия порядка'], chaos: ['chaos-magic', 'Магия хаоса'],
    nature: ['nature-magic', 'Магия природы'], body: ['body-magic', 'Магия тела'], war: ['warfare', 'Военное дело'] };
  const ranks = ['Ученик', 'Эксперт', 'Мастер', 'Грандмастер'];
  const isHero = entity => HEROES.includes(entity?.type);
  const has = (entity, id) => Array.isArray(entity?.skills) && entity.skills.includes(id);
  const hasRank = (entity, branch, rank) => (Array.isArray(entity?.skills) ? entity.skills : []).some(id =>
    typeof id === 'string' && id.startsWith(`${branch}-`) && Number(id.slice(branch.length + 1)) >= rank);
  function spellRequirement(spell) {
    if (spell?.level === undefined || !schools[spell.magicSchool]) return null;
    const [branch, name] = schools[spell.magicSchool];
    return { id: `${branch}-${spell.level}`, name: `${name} [${ranks[spell.level - 1] ?? spell.level}]` };
  }
  function canUseSpell(entity, spell) {
    const requirement = spellRequirement(spell);
    return !isHero(entity) || !requirement || hasRank(entity, schools[spell.magicSchool][0], spell.level);
  }
  function spellName(spell) {
    return spell.level === undefined ? spell.name : `${spell.name} [${['I', 'II', 'III', 'IV'][spell.level - 1] ?? spell.level} ур.]`;
  }
  function equipmentSkill(item) {
    if (!item) return null;
    const weapons = { sword: 'sword', axe: 'axe', bow: 'shooting', crossbow: 'shooting', sling: 'throwing',
      staff: 'magic-items', wand: 'magic-items', orb: 'magic-items', 'magic-orb': 'magic-items', 'magic-sphere': 'magic-items' };
    const branch = weapons[item.weaponType] ?? (item.equipmentType === 'shield' ? 'shield' : item.armorType === 'medium' ? 'medium-armor' : null);
    return branch ? `${branch}-1` : null;
  }
  function canEquip(entity, item) {
    const required = equipmentSkill(item);
    return !isHero(entity) || !required || hasRank(entity, required.slice(0, -2), 1);
  }
  function consumableCost(entity, item) {
    return Math.max(0, (item?.consumable?.apCost ?? 2) - (has(entity, 'quick-hands') ? 1 : 0));
  }
  const api = Object.freeze({ isHero, has, spellRequirement, canUseSpell, spellName, equipmentSkill, canEquip, consumableCost });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HeroSkillRules = api;
})(typeof window === 'undefined' ? globalThis : window);
