// Combat tests unrelated to skill access explicitly train fixture heroes.
// Access/validation tests pass their own skills and use the real restrictions.
module.exports = function trainedHeroes(context) {
  const novices = ['fire-magic', 'water-magic', 'earth-magic', 'air-magic', 'light-magic', 'dark-magic',
    'order-magic', 'chaos-magic', 'nature-magic', 'body-magic', 'warfare', 'sword', 'axe', 'shooting',
    'throwing', 'shield', 'medium-armor', 'magic-items'].map(branch => `${branch}-1`);
  const create = context.createCreature;
  context.createCreature = (type, position, loadout = {}) => create(type, position,
    context.HeroSkillRules.isHero({ type }) ? { skills: novices, ...loadout } : loadout);
};
