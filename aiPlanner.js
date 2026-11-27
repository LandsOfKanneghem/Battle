// Bounded, target-by-target turn search. Only snapshots and probabilities: no UI, RNG or live mutations.
(() => {
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const active = (unit, id) => window.hasActiveState(unit, id);
  const clone = unit => ({ ...unit, position: { ...unit.position }, attributes: { ...unit.attributes },
    states: (unit.states ?? []).map(s => ({ ...s })),
    ...Object.fromEntries(['appliedEffects', 'elementalShields', 'esBonuses', 'evaBonuses', 'armorSources'].map(key =>
      [key, (unit[key] ?? []).map(value => ({ ...value }))])),
    availableSpells: (unit.availableSpells ?? []).map(s => ({ ...s })), baseES: unit.baseES ?? 0 });
  const copy = world => ({ ...world, actor: clone(world.actor), target: clone(world.target) });
  const usable = (actor, spell) => spell && !window.isJumpBlocked(spell, actor) && spell.apCost > 0 && actor.ap >= spell.apCost && !(spell.cooldown > 0)
    && (spell.usesThisTurn ?? 0) < (spell.maxUsesPerTurn ?? Infinity)
    && (spell.usesTotal ?? 0) < (spell.maxUsesPerBattle ?? Infinity);
  const occupants = world => [world.actor, world.target, ...world.others].filter(unit => unit.hp > 0);
  const free = (point, world) => point.x >= 0 && point.x < world.map.SIZE && point.y >= 0 && point.y < world.map.HEIGHT
    && Number.isFinite(world.map.entryCost(point, world.actor)) && !world.map.obstacles.has(world.map.keyOf(point))
    && !occupants(world).some(unit => unit !== world.actor && distance(unit.position, point) === 0);
  const los = (from, to, world) => window.checkLOS(from, to, world.actor.id, occupants(world));
  const land = (point, world) => !world.map.isWater(world.map.terrain.get(world.map.keyOf(point)));
  function canAttack(world, spell) {
    const range = window.effectiveSpellRange(spell, world.actor);
    const d = distance(world.actor.position, world.target.position);
    const charge = spell.isCharge ? window.getChargeRoute(world.actor, world.target.position, occupants(world)) : null;
    if (spell.isCharge && (!charge || charge.blocked)) return false;
    return world.actor.hp > 0 && world.target.hp > 0 && usable(world.actor, spell)
      && spell.target !== 'none' && spell.target !== 'ally' && window.getSpellDamage(spell, world.actor) > 0
      && d >= (spell.minRange ?? 1) && d <= range && land(world.actor.position, world)
      && (spell.noLOS || los(world.actor.position, world.target.position, world));
  }
  function spend(actor, spell) {
    actor.ap -= spell.apCost; spell.usesThisTurn = (spell.usesThisTurn ?? 0) + 1;
    spell.usesTotal = (spell.usesTotal ?? 0) + 1; spell.cooldown = spell.maxCooldown ?? 0;
    const magical = spell.abilityType === 'spell';
    const count = magical ? 'spellCastCount' : 'hitCount', limit = magical ? 'maxSpellCasts' : 'maxHitCount';
    actor[count] = Math.min(actor[limit] ?? Infinity, (actor[count] ?? 0) + 1);
    const id = magical ? 'exhaustion' : 'weakness';
    if (actor[count] >= actor[limit] && !active(actor, id) && !active(actor, 'adrenaline')
      && (magical || !active(actor, 'vigor'))) {
      actor.states.push({ id, duration: 0, permanent: true, accuracyBonus: magical ? 0 : -30, sfcBonus: magical ? 30 : 0 });
    }
  }
  // Dijkstra over walking + at most one displacement ability. Retain separate AP/MP alternatives.
  function mobility(world) {
    const actor = world.actor;
    const jumps = actor.availableSpells.filter(s => s.isTeleport && s.target === 'none' && usable(actor, s));
    const first = { point: actor.position, cost: 0, water: 0, jump: null, commands: [] };
    const nodes = new Map(), open = [first], results = [];
    const key = n => `${n.point.x},${n.point.y}:${n.jump?.id ?? ''}:${n.water}`;
    nodes.set(key(first), first);
    function add(n) {
      if (n.cost > Math.max(0, actor.mp) || n.cost >= (nodes.get(key(n))?.cost ?? Infinity)) return;
      nodes.set(key(n), n); open.push(n);
    }
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost);
      const node = open.shift();
      if (nodes.get(key(node)) !== node) continue;
      if (land(node.point, world)) results.push(node);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const point = { x: node.point.x + dx, y: node.point.y + dy };
        if (!free(point, world)) continue;
        const step = world.map.entryCost(point, actor), water = !land(point, world);
        const commands = node.commands.slice(), last = commands.at(-1);
        if (last?.kind === 'move') commands[commands.length - 1] = { kind: 'move', path: [...last.path, point] };
        else commands.push({ kind: 'move', path: [point] });
        add({ ...node, point, cost: node.cost + step, water: water ? node.water + step : 0, commands });
      }
      if (node.jump || !land(node.point, world)) continue;
      for (const jump of jumps) {
        const range = window.effectiveSpellRange(jump, actor);
        for (let y = Math.max(0, node.point.y - range); y <= Math.min(world.map.HEIGHT - 1, node.point.y + range); y++) {
          for (let x = Math.max(0, node.point.x - range); x <= Math.min(world.map.SIZE - 1, node.point.x + range); x++) {
            const point = { x, y }, d = distance(point, node.point);
            if (d < (jump.minRange ?? 1) || d > range || !free(point, world) || !land(point, world)
              || (!jump.noLOS && !los(node.point, point, world))) continue;
            add({ point, cost: node.cost, water: 0, jump,
              commands: [...node.commands, { kind: 'jump', spellId: jump.id, point }] });
          }
        }
      }
    }
    return results;
  }
  function relocate(world, commands) {
    const next = copy(world);
    for (const command of commands) {
      if (command.kind === 'move') {
        for (const point of command.path) {
          const cost = next.map.entryCost(point, next.actor);
          if (!free(point, next) || next.actor.mp < cost) return null;
          next.actor.mp -= cost; next.actor.position = { ...point };
        }
      } else {
        const spell = next.actor.availableSpells.find(s => s.id === command.spellId);
        const d = distance(next.actor.position, command.point);
        if (!usable(next.actor, spell) || !free(command.point, next) || !land(command.point, next)
          || d < (spell.minRange ?? 1) || d > window.effectiveSpellRange(spell, next.actor)
          || (!spell.noLOS && !los(next.actor.position, command.point, next))) return null;
        spend(next.actor, spell); next.actor.position = { ...command.point };
      }
    }
    return next;
  }
  function hurt(spell, target, attacker = null) {
    const damage = window.damageBreakdown(spell, target, attacker);
    window.consumeES(target, damage.absorbed);
    target.hp = Math.max(0, target.hp - damage.hpDamage);
    if (spell.abilityType === 'weapon-strike' && !window.isFrozen(target)) window.wearArmor(target);
    return damage.absorbed + damage.hpDamage;
  }
  function attack(world, spellId) {
    const spell = world.actor.availableSpells.find(s => s.id === spellId);
    if (!canAttack(world, spell)) return [world];
    const charge = spell.isCharge ? window.getChargeRoute(world.actor, world.target.position, occupants(world)) : null;
    if (charge?.path.length) world.actor.position = { ...charge.path.at(-1) };
    spend(world.actor, spell);
    const probability = (spell.abilityType === 'spell' ? 1 - Math.max(0, Math.min(100,
      window.getEffectiveStat(world.actor, 'sfc'))) / 100 : 1)
      * (spell.isShot || spell.abilityType === 'weapon-strike' ? window.getHitChance(spell, world.actor, world.target) / 100 : 1);
    const outcomes = [];
    if (probability < 1) outcomes.push({ ...copy(world), probability: world.probability * (1 - probability) });
    if (probability > 0) {
      const hit = copy(world), actor = hit.actor, target = hit.target;
      if (spell.isTonguePull) target.position = window.getTonguePullDestination(actor, target, occupants(hit));
      const debuffed = active(actor, spell.abilityType === 'spell' ? 'exhaustion' : 'weakness');
      const amount = Math.floor(window.getSpellDamage(spell, actor, charge?.path.length ?? 0) * (debuffed ? 0.8 : 1));
      const damage = hurt({ ...spell, damage: amount }, target, actor);
      if (damage > 0 && spell.abilityType === 'weapon-strike' && !spell.isShot && active(target, 'sharp-shell')) {
        hurt({ damage: 3, damageType: 'physical' }, actor);
      }
      if (spell.stateId === 'weak-poison' && target.hp > 0 && !active(target, 'weak-poison')) {
        target.states.push({ id: 'weak-poison', duration: window.getSpellDuration(spell, actor) });
      }
      hit.probability *= probability; outcomes.push(hit);
    }
    return outcomes;
  }
  function value(node, initial) {
    return node.outcomes.reduce((sum, w) => {
      const dealt = Math.min(initial.target.hp, initial.target.hp - w.target.hp);
      const newPoison = !active(initial.target, 'weak-poison') && active(w.target, 'weak-poison') && w.target.hp > 0;
      // Only half of one future poison tick: healing/expiry can prevent it. Never credit duplicate poison.
      const poison = newPoison ? Math.min(w.target.hp,
        window.spellDamage({ damage: 2, damageType: 'poison' }, w.target)) * 0.5 : 0;
      return sum + w.probability * (300 * Number(w.target.hp <= 0)
        + 100 * (dealt + poison) / (initial.target.maxHP || initial.target.hp)
        - 300 * Number(w.actor.hp <= 0)
        - 100 * (initial.actor.hp - w.actor.hp) / (initial.actor.maxHP || initial.actor.hp));
    }, 0);
  }
  function compare(a, b) {
    return b.score - a.score || b.resources - a.resources || a.order - b.order;
  }
  window.planAIAction = function(actor) {
    const map = window.gameState;
    // Hidden opponents do not participate in targets, LOS, collision or pull simulation.
    const visible = map.entities.filter(unit => unit.hp > 0 && !map.isHiddenFrom(unit, actor));
    const targets = visible.filter(unit => map.isAlly(unit) !== map.isAlly(actor)).sort((a, b) => a.id.localeCompare(b.id));
    let best = null, order = 0;
    for (const target of targets) {
      const initial = { actor: clone(actor), target: clone(target), map,
        others: visible.filter(unit => unit !== actor && unit !== target), probability: 1 };
      let beam = [{ outcomes: [initial], first: null }];
      const minCost = Math.min(...actor.availableSpells.filter(s => s.target !== 'none'
        && window.getSpellDamage(s, actor) > 0 && s.apCost > 0).map(s => s.apCost));
      const depth = Math.min(6, Math.floor(actor.ap / minCost));
      for (let step = 0; step < depth && beam.length; step++) {
        const candidates = [];
        for (const node of beam) {
          const sample = node.outcomes.filter(w => w.actor.hp > 0 && w.target.hp > 0)
            .sort((a, b) => b.probability - a.probability)[0];
          if (!sample) continue;
          for (const position of mobility(sample)) {
            const moved = relocate(sample, position.commands);
            for (const spell of moved.actor.availableSpells) {
              if (!canAttack(moved, spell)) continue;
              const outcomes = node.outcomes.flatMap(w => {
                if (w.actor.hp <= 0 || w.target.hp <= 0) return [w];
                const relocated = relocate(w, position.commands);
                return relocated ? attack(relocated, spell.id) : [w];
              });
              const next = { outcomes, first: node.first ?? position.commands[0]
                ?? { kind: 'cast', spellId: spell.id, targetId: target.id }, order: order++ };
              next.score = value(next, initial);
              next.resources = outcomes.reduce((sum, w) => sum + w.probability * (w.actor.ap * 10 + w.actor.mp), 0);
              candidates.push(next);
              if (next.score > 0 && (!best || compare(next, best) < 0)) best = next;
            }
          }
        }
        // Identical states can arise from attack order and walking/jumping permutations.
        candidates.sort(compare);
        const seen = new Set();
        beam = candidates.filter(n => {
          const key = JSON.stringify(n.outcomes.map(w => [w.probability, w.actor.position, w.actor.ap, w.actor.mp,
            w.actor.hp, w.actor.states, w.target.position, w.target.hp, w.target.baseES, w.target.esBonuses,
            w.target.states, w.target.armorSources,
            w.actor.availableSpells.map(s => [s.usesThisTurn, s.cooldown]) ]));
          if (seen.has(key)) return false;
          seen.add(key); return true;
        }).slice(0, 8);
      }
    }
    return best?.first ?? null;
  };
})();
