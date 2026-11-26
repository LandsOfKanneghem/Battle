const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup() {
  const ctx = { gameState: {}, Math: Object.create(Math) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../combat.js'), 'utf8'), ctx);
  const entity = (luc = 0) => ({ eva: 0, attributes: { att: 0, luc }, states: [],
    appliedEffects: [], elementalShields: [], evaBonuses: [] });
  return { ctx, spell: { abilityType: 'weapon-strike', baseAccuracy: 100 }, caster: entity(), target: entity() };
}
test('only negative attacker luck reduces hit chance, at five percentage points per point', () => {
  const { ctx, spell, caster, target } = setup();
  for (const [luck, chance] of [[0, 100], [5, 100], [-1, 95], [-5, 75], [-20, 0], [-30, 0]]) {
    caster.attributes.luc = luck;
    assert.equal(ctx.getHitChance(spell, caster, target), chance, `LUC ${luck}`);
  }
});
test('per-attack accuracy, ATT, effects and evasion retain their contributions', () => {
  const { ctx, spell, caster, target } = setup();
  caster.attributes.att = 10;
  target.eva = 20;
  assert.equal(ctx.getHitChance(spell, caster, target), 90);
  caster.states.push({ id: 'test', duration: 2, modifiers: { luc: -5 }, accuracyBonus: -10 });
  assert.equal(ctx.getHitChance(spell, caster, target), 55);
  spell.baseAccuracy = 80; // A future change of the base accuracy must still work.
  assert.equal(ctx.getHitChance(spell, caster, target), 35);
  caster.states[0].suppressed = true;
  assert.equal(ctx.getHitChance(spell, caster, target), 70);
});
test('the actual hit roll uses the revised probability and preserves zero/100 percent bounds', () => {
  const { ctx, spell, caster, target } = setup();
  caster.attributes.luc = -5;
  ctx.Math.random = () => 0.7499;
  assert.equal(ctx.shotHits(spell, caster, target), true);
  ctx.Math.random = () => 0.75;
  assert.equal(ctx.shotHits(spell, caster, target), false);
  caster.attributes.luc = -30;
  ctx.Math.random = () => 0;
  assert.equal(ctx.shotHits(spell, caster, target), false);
  caster.attributes.luc = 0;
  ctx.Math.random = () => 0.9999;
  assert.equal(ctx.shotHits(spell, caster, target), true);
});

test('crit combines weapon base, effective CRI and unclamped hit overflow', () => {
  const { ctx, spell, caster, target } = setup();
  caster.attributes.att = 25;
  caster.attributes.luc = 10; // Existing CRI = 20.
  assert.equal(ctx.getRawHitChance(spell, caster, target), 125);
  assert.equal(ctx.getHitChance(spell, caster, target), 100);
  assert.equal(ctx.getCritChance({ baseAccuracy: 100, abilityType: 'weapon-strike', baseCritChance: 5 }, caster, target), 50);
  target.eva = 15;
  assert.equal(ctx.getCritChance({ baseAccuracy: 100, abilityType: 'weapon-strike', baseCritChance: 5 }, caster, target), 35);
  caster.attributes.luc = -5; // -25 hit penalty and CRI -10; no overflow remains.
  assert.equal(ctx.getCritChance({ baseAccuracy: 100, abilityType: 'weapon-strike', baseCritChance: 5 }, caster, target), 0);
});
test('shot spells use their base crit and accuracy overflow; non-shot spells use only CRI', () => {
  const { ctx, spell, caster, target } = setup();
  caster.attributes.att = 25;
  caster.cri = 10;
  assert.equal(ctx.getCritChance({ baseAccuracy: 100, abilityType: 'spell', baseCritChance: 90 }, caster, target), 10);
  assert.equal(ctx.getCritChance({ baseAccuracy: 100, abilityType: 'spell', isShot: true, baseCritChance: 10 }, caster, target), 45);
  assert.equal(ctx.getCritChance({ abilityType: 'weapon-strike', baseAccuracy: 100 }, caster, target), 35);
  assert.equal(ctx.getCritChance({ damage: 2 }, caster, target), 0, 'ticks and reflected damage cannot crit');
  caster.cri = 200;
  assert.equal(ctx.getCritChance({ abilityType: 'spell' }, caster, target), 100);
});


test('each attack owns its base accuracy; targetless tooltip values preserve overflow', () => {
  const { ctx, caster, target } = setup();
  caster.attributes.att = 10;
  caster.appliedEffects.push({ duration: 2, accuracyBonus: -5 });
  const low = { abilityType: 'weapon-strike', baseAccuracy: 70 };
  const high = { abilityType: 'spell', isShot: true, baseAccuracy: 100 };
  assert.equal(ctx.getRawHitChance(low, caster, null), 75);
  assert.equal(ctx.getRawHitChance(high, caster, null), 105);
  target.eva = 20;
  assert.equal(ctx.getHitChance(low, caster, target), 55);
  assert.equal(ctx.getHitChance(high, caster, target), 85);
  assert.equal(ctx.getRawHitChance(low, null, null), 70);
  caster.appliedEffects[0].suppressed = true;
  assert.equal(ctx.getRawHitChance(low, caster, null), 80);
});
