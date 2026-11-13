// Общий боевой ИИ: выбор пары способность/цель, сближение и завершение хода.
(() => {
  const state = () => window.gameState;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const current = (entity, version) => state().turnVersion === version
    && state().activeEntityId === entity.id && entity.hp > 0 && state().entities.includes(entity);
  const enemies = () => state().entities.filter(target => target.hp > 0 && state().isAlly(target));
  const failureChance = entity => Math.max(0, Math.min(100, window.getEffectiveStat(entity, 'sfc'))) / 100;

  window.runAI = function(entity) {
    if (!entity.ai) return;
    state().isSkippingTurn = true; // Управление игрока заблокировано до конца хода ИИ.
    window.updatePanel();
    runCombatAI(entity, state().turnVersion);
  };

  function finishAITurn(entity, version) {
    setTimeout(() => {
      if (!current(entity, version)) return;
      window.beginTurn(state().nextLivingEntity(entity.id));
    }, 100);
  }

  function availablePairs(entity) {
    const pairs = [];
    for (const spell of entity.availableSpells) {
      const sfc = spell.abilityType === 'spell' ? failureChance(entity) : 0;
      if (entity.ap < spell.apCost || spell.cooldown > 0
        || (spell.maxUsesPerTurn !== undefined && spell.usesThisTurn >= spell.maxUsesPerTurn)
        || (spell.maxUsesPerBattle !== undefined && (spell.usesTotal ?? 0) >= spell.maxUsesPerBattle)) continue;
      for (const target of enemies()) {
        const distance = manhattan(entity.position, target.position);
        const range = spell.modifiable ? window.effectiveSpellRange(spell, entity) : spell.range;
        if (distance < (spell.minRange ?? 1) || distance > range
          || (!spell.noLOS && !window.checkLOS(entity.position, target.position))) continue;
        const factDamage = window.spellDamage({ ...spell, damage: window.getSpellDamage(spell, entity) }, target);
        const hitChance = (spell.isShot || spell.isHit) ? Math.max(0, Math.min(100,
          window.getEffectiveStat(entity, 'acc') - window.getEffectiveStat(target, 'eva'))) / 100 : 1;
        pairs.push({ spell, target, factDamage,
          pKill: factDamage >= target.hp ? (1 - sfc) * hitChance : 0 });
      }
    }
    return pairs;
  }

  function runCombatAI(entity, version) {
    if (!current(entity, version)) return;
    if (window.isFrozen(entity)) { finishAITurn(entity, version); return; }
    const pairs = availablePairs(entity);
    const isCharacter = target => target.type === 'wizard' || target.type === 'monk';
    pairs.sort((a, b) => {
      const aKill = Number(a.pKill >= 0.5), bKill = Number(b.pKill >= 0.5);
      if (aKill !== bKill) return bKill - aKill;
      const characterPriority = Number(isCharacter(b.target)) - Number(isCharacter(a.target));
      if (characterPriority) return characterPriority;
      if (aKill && a.pKill !== b.pKill) return b.pKill - a.pKill;
      if (!aKill && a.factDamage !== b.factDamage) return b.factDamage - a.factDamage;
      return a.target.hp - b.target.hp;
    });
    if (pairs.length) {
      const { spell, target } = pairs[0];
      aiCast(entity, spell, target, version, () => runCombatAI(entity, version));
      return;
    }
    if (entity.mp <= 0) { finishAITurn(entity, version); return; }
    const sorted = enemies().sort((a, b) => manhattan(entity.position, a.position) - manhattan(entity.position, b.position));
    for (const target of sorted) {
      const path = pathToTarget(entity, target);
      if (path === null) continue;
      if (!path.length) { finishAITurn(entity, version); return; }
      aiMove(entity, path, version, () => runCombatAI(entity, version));
      return;
    }
    // Ни к одной цели нет полного пути: идём к ближайшему достижимому берегу.
    let best = null;
    for (const target of sorted) {
      const reach = findReachableClosestTo(entity, target);
      if (reach && (!best || reach.dist < best.dist)) best = reach;
    }
    if (best) aiMove(entity, best.path, version, () => runCombatAI(entity, version));
    else finishAITurn(entity, version);
  }

  function pathToTarget(entity, target) {
    // Цель занята существом; путь заканчивается на свободной соседней клетке.
    const paths = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => {
      const cell = { x: target.position.x + dx, y: target.position.y + dy };
      return state().isFree(cell) ? window.buildPath(entity.position, cell) : null;
    }).filter(path => path !== null);
    paths.sort((a, b) => state().pathCost(a) - state().pathCost(b) || a.length - b.length);
    return paths[0] ?? null;
  }

  function findReachableClosestTo(entity, target) {
    let best = null;
    const startDistance = manhattan(entity.position, target.position);
    const radius = Math.min(state().SIZE * 2, Math.floor(entity.mp));
    for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const cell = { x: entity.position.x + dx, y: entity.position.y + dy };
      if (!state().isFree(cell)) continue;
      const dist = manhattan(cell, target.position);
      // Оставаться на месте лучше, чем ходить по берегу туда-сюда.
      if (dist >= startDistance || (best && dist > best.dist)) continue;
      const path = window.buildPath(entity.position, cell);
      if (!path?.length) continue;
      const cost = state().pathCost(path);
      if (cost > entity.mp) continue;
      if (!best || dist < best.dist || cost < best.cost) best = { cell, dist, path, cost };
    }
    return best;
  }

  function aiMove(entity, path, version, onDone) {
    let index = 0;
    function step() {
      if (!current(entity, version)) return;
      if (window.isFrozen(entity)) { finishAITurn(entity, version); return; }
      const next = path[index];
      const cost = state().entryCost(next);
      if (!state().isFree(next) || cost > entity.mp) { finishAITurn(entity, version); return; }
      entity.position = { ...next };
      entity.mp -= cost;
      index++;
      window.renderPosition();
      window.updatePanel();
      // Дальнобойное существо останавливается, как только появляется доступная атака.
      if (index >= path.length || availablePairs(entity).length) onDone();
      else setTimeout(step, state().STEP_MS);
    }
    setTimeout(step, state().STEP_MS);
  }

  function aiCast(caster, spell, target, version, onDone) {
    caster.ap -= spell.apCost;
    spell.usesThisTurn++;
    if (spell.maxUsesPerBattle !== undefined) spell.usesTotal++;
    spell.cooldown = spell.maxCooldown;
    window.recordHitAttempt(spell, caster, window.spellDeps);
    const cell = state().cells[target.position.y * state().SIZE + target.position.x];
    window.updatePanel();
    function finish() {
      if (!current(caster, version)) return;
      if (state().entities.includes(target) && target.hp > 0) {
        window.applySpellEffect(spell, target.position, caster, window.spellDeps);
        window.removeDefeatedEntities();
      }
      if (!current(caster, version)) return;
      window.updatePanel();
      onDone();
    }
    const sfc = spell.abilityType === 'spell' ? failureChance(caster) : 0;
    if (sfc > 0 && Math.random() < sfc) {
      window.playFailureAnimation(cell);
      setTimeout(() => { if (current(caster, version)) onDone(); }, 0);
    } else if (spell.isShot) {
      const type = spell.id === 'boulder-throw' ? 'rock' : spell.damageType === 'water' ? 'water' : 'fire';
      window.playProjectileAnimation(state().cells[caster.position.y * state().SIZE + caster.position.x], cell,
        type, () => setTimeout(finish, 0));
      // animations.js оставляем неизменным: для камня используем SVG самой способности.
      if (type === 'rock') {
        const projectile = [...document.querySelectorAll('.spell-projectile[data-type="rock"]')].at(-1);
        if (projectile) projectile.innerHTML = spell.svg;
      }
    } else {
      window.playBiteAnimation(cell);
      setTimeout(finish, 500);
    }
  }
})();
