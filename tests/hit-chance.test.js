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
  const entity = (luc = 0) => ({ acc: 100, eva: 0, attributes: { att: 0, luc }, states: [],
    appliedEffects: [], elementalShields: [], evaBonuses: [] });
  return { ctx, caster: entity(), target: entity() };
}
test('only negative attacker luck reduces hit chance, at five percentage points per point', () => {
  const { ctx, caster, target } = setup();
  for (const [luck, chance] of [[0, 100], [5, 100], [-1, 95], [-5, 75], [-20, 0], [-30, 0]]) {
    caster.attributes.luc = luck;
    assert.equal(ctx.getHitChance(caster, target), chance, `LUC ${luck}`);
  }
});
test('accuracy, ATT, effects and evasion retain their existing contributions without adding Base twice', () => {
  const { ctx, caster, target } = setup();
  caster.attributes.att = 10;
  target.eva = 20;
  assert.equal(ctx.getHitChance(caster, target), 90);
  caster.states.push({ id: 'test', duration: 2, modifiers: { luc: -5 }, accuracyBonus: -10 });
  assert.equal(ctx.getHitChance(caster, target), 55);
  caster.acc = 80; // A future change of the base accuracy must still work.
  assert.equal(ctx.getHitChance(caster, target), 35);
  caster.states[0].suppressed = true;
  assert.equal(ctx.getHitChance(caster, target), 70);
});
test('the actual hit roll uses the revised probability and preserves zero/100 percent bounds', () => {
  const { ctx, caster, target } = setup();
  caster.attributes.luc = -5;
  ctx.Math.random = () => 0.7499;
  assert.equal(ctx.shotHits(caster, target), true);
  ctx.Math.random = () => 0.75;
  assert.equal(ctx.shotHits(caster, target), false);
  caster.attributes.luc = -30;
  ctx.Math.random = () => 0;
  assert.equal(ctx.shotHits(caster, target), false);
  caster.attributes.luc = 0;
  ctx.Math.random = () => 0.9999;
  assert.equal(ctx.shotHits(caster, target), true);
});

test('crit combines weapon base, effective CRI and unclamped hit overflow', () => {
  const { ctx, caster, target } = setup();
  caster.attributes.att = 25;
  caster.attributes.luc = 10; // Existing CRI = 20.
  assert.equal(ctx.getRawHitChance(caster, target), 125);
  assert.equal(ctx.getHitChance(caster, target), 100);
  assert.equal(ctx.getCritChance({ abilityType: 'weapon-strike', baseCritChance: 5 }, caster, target), 50);
  target.eva = 15;
  assert.equal(ctx.getCritChance({ abilityType: 'weapon-strike', baseCritChance: 5 }, caster, target), 35);
  caster.attributes.luc = -5; // -25 hit penalty and CRI -10; no overflow remains.
  assert.equal(ctx.getCritChance({ abilityType: 'weapon-strike', baseCritChance: 5 }, caster, target), 0);
});
test('spells ignore weapon base and only shot spells can convert accuracy overflow into crit', () => {
  const { ctx, caster, target } = setup();
  caster.attributes.att = 25;
  caster.cri = 10;
  assert.equal(ctx.getCritChance({ abilityType: 'spell', baseCritChance: 90 }, caster, target), 10);
  assert.equal(ctx.getCritChance({ abilityType: 'spell', isShot: true, baseCritChance: 90 }, caster, target), 35);
  assert.equal(ctx.getCritChance({ abilityType: 'weapon-strike' }, caster, target), 35);
  assert.equal(ctx.getCritChance({ damage: 2 }, caster, target), 0, 'ticks and reflected damage cannot crit');
  caster.cri = 200;
  assert.equal(ctx.getCritChance({ abilityType: 'spell' }, caster, target), 100);
});
