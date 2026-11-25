// Общий боевой ИИ: выбор пары способность/цель, сближение и завершение хода.
(() => {
  const state = () => window.gameState;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const current = (entity, version) => state().turnVersion === version
    && state().activeEntityId === entity.id && entity.hp > 0 && state().entities.includes(entity);
  const enemies = () => state().entities.filter(target => target.hp > 0 && state().isAlly(target)
    && !state().isHiddenFrom(target, state().activeEntity()));
  const failureChance = entity => Math.max(0, Math.min(100, window.getEffectiveStat(entity, 'sfc'))) / 100;

  window.runAI = function(entity) {
    if (!entity.ai) return;
    state().isSkippingTurn = true; // Управление игрока заблокировано до конца хода ИИ.
    window.updatePanel();
    runCombatAI(entity, state().turnVersion, { start: { ...entity.position } });
  };

  function finishAITurn(entity, version) {
    setTimeout(() => {
      if (!current(entity, version)) return;
      window.endTurn();
    }, 100);
  }

  function usableSpells(entity) {
    return entity.availableSpells.filter(spell => entity.ap >= spell.apCost && spell.cooldown <= 0
      && (spell.maxUsesPerTurn === undefined || spell.usesThisTurn < spell.maxUsesPerTurn)
      && (spell.maxUsesPerBattle === undefined || (spell.usesTotal ?? 0) < spell.maxUsesPerBattle));
  }

  function canAttackFrom(entity, spell, target, from) {
    const distance = manhattan(from, target.position);
    const range = spell.modifiable ? window.effectiveSpellRange(spell, entity) : spell.range;
    return distance >= (spell.minRange ?? 1) && distance <= range
      && (spell.noLOS || window.checkLOS(from, target.position, entity.id));
  }

  function availablePairs(entity) {
    const pairs = [];
    for (const spell of usableSpells(entity)) {
      const sfc = spell.abilityType === 'spell' ? failureChance(entity) : 0;
      for (const target of enemies()) {
        if (!canAttackFrom(entity, spell, target, entity.position)) continue;
        const factDamage = window.spellDamage({ ...spell, damage: window.getSpellDamage(spell, entity) }, target);
        const hitChance = (spell.isShot || spell.isHit) ? window.getHitChance(entity, target) / 100 : 1;
        pairs.push({ spell, target, factDamage,
          pKill: factDamage >= target.hp ? (1 - sfc) * hitChance : 0 });
      }
    }
    return pairs;
  }

  function runCombatAI(entity, version, turn) {
    if (!current(entity, version)) return;
    if (window.isFrozen(entity)) { finishAITurn(entity, version); return; }
    const invisibility = usableSpells(entity).find(spell => spell.id === 'turn-invisible'
      && !window.hasActiveState(entity, 'invisibility'));
    if (invisibility) {
      aiCast(entity, invisibility, entity, version, () => runCombatAI(entity, version, turn));
      return;
    }
    const pairs = availablePairs(entity);
    const isCharacter = target => ['wizard', 'monk', 'warrior'].includes(target.type);
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
      aiCast(entity, spell, target, version, () => runCombatAI(entity, version, turn));
      return;
    }
    if (entity.type === 'shadow' || entity.type === 'specter') {
      positionSpectralCaster(entity, version, turn);
      return;
    }
    if (entity.mp <= 0) { finishAITurn(entity, version); return; }
    const sorted = enemies().sort((a, b) => manhattan(entity.position, a.position) - manhattan(entity.position, b.position));
    // Планируем по всей доступной области, даже если обход займёт несколько ходов.
    const reachable = reachablePositions(entity);
    const spells = usableSpells(entity);
    for (const target of sorted) {
      const firingPosition = reachable.filter(node => spells.some(spell => canAttackFrom(entity, spell, target, node.point)))
        .sort((a, b) => a.cost - b.cost || manhattan(a.point, target.position) - manhattan(b.point, target.position))[0];
      if (firingPosition) { advanceTowards(entity, firingPosition, version, turn); return; }
    }
    // Если атаки сейчас потрачены, продолжаем обычное сближение до соседней клетки.
    for (const target of sorted) {
      const adjacent = reachable.filter(node => manhattan(node.point, target.position) === 1)
        .sort((a, b) => a.cost - b.cost)[0];
      if (adjacent) { advanceTowards(entity, adjacent, version, turn); return; }
    }
    // Цель может быть на отдельном острове: выбираем ближайший берег во ВСЕЙ области.
    let best = null;
    for (const target of sorted) {
      for (const node of reachable) {
        const distance = manhattan(node.point, target.position);
        if (!best || distance < best.distance || (distance === best.distance && node.cost < best.node.cost)) {
          best = { node, distance };
        }
      }
    }
    if (best) advanceTowards(entity, best.node, version, turn);
    else finishAITurn(entity, version);
  }

  function positionSpectralCaster(entity, version, turn) {
    const strike = entity.availableSpells.find(spell => spell.id === 'spectral-strike');
    const targets = enemies().sort((a, b) => manhattan(entity.position, a.position) - manhattan(entity.position, b.position)
      || a.id.localeCompare(b.id));
    if (!strike || entity.mp <= 0 || !targets.length) { finishAITurn(entity, version); return; }
    // Позицию для следующей атаки выбираем и после исчерпания ОД/лимита кастов.
    const reachable = reachablePositions(entity);
    const startKey = state().keyOf(turn.start);
    const candidates = [];
    for (const node of reachable) for (const target of targets) {
      if (canAttackFrom(entity, strike, target, node.point)) candidates.push({ node, target });
    }
    const affordable = candidates.filter(candidate => candidate.node.cost <= entity.mp);
    let destination;
    if (affordable.length) {
      // Сначала сохраняем дистанцию атаки и LOS, затем меняем стартовую клетку,
      // если это возможно; среди таких клеток предпочитаем дальность 4.
      const changed = affordable.filter(candidate => state().keyOf(candidate.node.point) !== startKey);
      const choices = changed.length ? changed : affordable;
      choices.sort((a, b) => manhattan(b.node.point, b.target.position) - manhattan(a.node.point, a.target.position)
        || a.node.cost - b.node.cost || a.node.point.y - b.node.point.y || a.node.point.x - b.node.point.x
        || a.target.id.localeCompare(b.target.id));
      destination = choices[0].node;
    } else if (candidates.length) {
      // Если стрельба пока недоступна, обходим препятствия к ближайшей огневой позиции.
      candidates.sort((a, b) => a.node.cost - b.node.cost
        || manhattan(b.node.point, b.target.position) - manhattan(a.node.point, a.target.position));
      destination = candidates[0].node;
    } else {
      // Отдельный остров или закрытая комната: приблизиться, не искать милишную клетку.
      const affordableNodes = reachable.filter(node => node.cost <= entity.mp);
      const changed = affordableNodes.filter(node => state().keyOf(node.point) !== startKey);
      const choices = changed.length ? changed : affordableNodes;
      const distance = node => Math.min(...targets.map(target => manhattan(node.point, target.position)));
      choices.sort((a, b) => distance(a) - distance(b) || a.cost - b.cost);
      destination = choices[0];
    }
    if (destination && destination.cost > 0) advanceTowards(entity, destination, version, turn);
    else finishAITurn(entity, version);
  }

  function reachablePositions(entity) {
    // Дейкстра учитывает цену песка/болота, препятствия, существ и Левитацию.
    const start = { point: { ...entity.position }, cost: 0, waterCost: 0, parent: null };
    const keyOfNode = node => `${state().keyOf(node.point)}:${node.waterCost}`;
    const nodes = new Map([[keyOfNode(start), start]]);
    const open = [start];
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost);
      const node = open.shift();
      if (nodes.get(keyOfNode(node)) !== node) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const point = { x: node.point.x + dx, y: node.point.y + dy };
        if (!state().isFree(point, entity)) continue;
        const stepCost = state().entryCost(point, entity);
        const cost = node.cost + stepCost;
        const water = state().isWater(state().terrain.get(state().keyOf(point)));
        const crossingCost = node.waterCost + stepCost;
        // Шаг или переправа должны помещаться в один ход; на воде ждать нельзя.
        const turnCost = water || node.waterCost > 0 ? crossingCost : stepCost;
        if (turnCost > (entity.maxMP ?? entity.mp) && cost > entity.mp) continue;
        const next = { point, cost, waterCost: water ? crossingCost : 0, parent: node };
        const key = keyOfNode(next);
        if (cost >= (nodes.get(key)?.cost ?? Infinity)) continue;
        nodes.set(key, next);
        open.push(next);
      }
    }
    return [...nodes.values()].filter(node => !state().isWater(state().terrain.get(state().keyOf(node.point))));
  }

  function advanceTowards(entity, destination, version, turn) {
    const path = [];
    for (let node = destination; node.parent; node = node.parent) path.push(node.point);
    path.reverse();
    let cost = 0, steps = 0;
    for (let i = 0; i < path.length; i++) {
      cost += state().entryCost(path[i], entity);
      if (cost > entity.mp) break;
      // Даже с Левитацией промежуточная остановка должна быть на суше.
      if (!state().isWater(state().terrain.get(state().keyOf(path[i])))) steps = i + 1;
    }
    if (steps) aiMove(entity, path.slice(0, steps), version, () => runCombatAI(entity, version, turn));
    else finishAITurn(entity, version);
  }

  function aiMove(entity, path, version, onDone) {
    let index = 0;
    function step() {
      if (!current(entity, version)) return;
      if (window.isFrozen(entity)) { finishAITurn(entity, version); return; }
      const next = path[index];
      const cost = state().entryCost(next, entity);
      if (!state().isFree(next, entity) || cost > entity.mp) { finishAITurn(entity, version); return; }
      entity.position = { ...next };
      entity.mp -= cost;
      index++;
      window.renderPosition();
      window.updatePanel();
      // Дальнобойное существо останавливается, как только появляется доступная атака.
      const onLand = !state().isWater(state().terrain.get(state().keyOf(next)));
      if (index >= path.length || (onLand && availablePairs(entity).length)) onDone();
      else setTimeout(step, state().STEP_MS);
    }
    setTimeout(step, state().STEP_MS);
  }

  function aiCast(caster, spell, target, version, onDone) {
    caster.ap -= spell.apCost;
    window.battleLog?.cast(caster, spell, target);
    spell.usesThisTurn++;
    if (spell.maxUsesPerBattle !== undefined) spell.usesTotal++;
    spell.cooldown = spell.maxCooldown;
    window.recordSpellAttempt?.(spell, caster, window.spellDeps);
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
      window.battleLog?.failure(caster, spell);
      window.playFailureAnimation(cell);
      setTimeout(() => { if (current(caster, version)) onDone(); }, 0);
    } else if (spell.id === 'turn-invisible') {
      window.playStateAnimation(cell, spell.stateId);
      setTimeout(finish, 500);
    } else if (spell.id === 'spectral-strike') {
      window.playSpectralStrikeAnimation(cell, spell);
      setTimeout(finish, 500);
    } else if (spell.isTonguePull) {
      window.playTonguePullAnimation(state().cells[caster.position.y * state().SIZE + caster.position.x], cell);
      setTimeout(finish, 500);
    } else if (spell.isShot) {
      const type = spell.id === 'boulder-throw' ? 'rock' : spell.damageType === 'water' ? 'water' : 'fire';
      window.playProjectileAnimation(state().cells[caster.position.y * state().SIZE + caster.position.x], cell,
        type, () => setTimeout(finish, 0), spell);
      // Для камня используем SVG самой способности.
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
