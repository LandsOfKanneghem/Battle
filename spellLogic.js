// Обычный скрипт: глобальные точки входа; данные по-прежнему передаются аргументами.
// Чистая геометрия и выбор целей: все данные поля и существ передаются явно.
window.getConeCells = function(center, direction, SIZE) {
  const points = [];
  if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) return points;
  for (let depth = 1; depth <= 3; depth++) {
    for (let offset = 1 - depth; offset < depth; offset++) {
      const x = center.x + direction.x * depth - direction.y * offset;
      const y = center.y + direction.y * depth + direction.x * offset;
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) points.push({ x, y, depth });
    }
  }
  return points;
};

window.getBlockedConeCells = function(coneCells, direction, entities, obstacles, keyOf) {
  const blocked = new Set();
  const axis = coneCells.find(point => point.depth === 1);
  if (!axis) return blocked;
  const offsetOf = point => (point.x - axis.x) * -direction.y + (point.y - axis.y) * direction.x;
  const shadows = new Set();
  for (const point of coneCells) {
    const crate = obstacles.get(keyOf(point)) === 'crate';
    const creature = entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(point));
    if (crate) blocked.add(keyOf(point)); // Ящики не получают урон и не входят в подсветку.
    if ((!crate && !creature) || point.depth === 3) continue;
    if (point.depth === 1) {
      // Ближайшее препятствие закрывает весь конус за собой: второй и третий ряды.
      for (const behind of coneCells) {
        if (behind.depth > 1) blocked.add(keyOf(behind));
      }
      continue;
    }
    const offset = offsetOf(point);
    // Из второго ряда блокируется только соответствующий сектор третьего.
    const sector = offset === 0 ? [-1, 0, 1]
      : offset < 0 ? [-2, -1] : [1, 2];
    for (const side of sector) shadows.add(side);
  }
  for (const point of coneCells) {
    if (point.depth === 3 && shadows.has(offsetOf(point))) blocked.add(keyOf(point));
  }
  return blocked;
};

window.findSparkTargets = function(primaryTarget, radius, count, entities) {
  if (!primaryTarget) return [];
  // Манхэттенская дистанция, затем угол по часовой стрелке: право → вниз → лево → верх.
  // LOS для отскоков не проверяется; источник тоже может оказаться среди целей.
  return entities.filter(entity => entity.hp > 0 && entity.id !== primaryTarget.id)
    .map(entity => {
      const dx = entity.position.x - primaryTarget.position.x;
      const dy = entity.position.y - primaryTarget.position.y;
      return { entity, distance: Math.abs(dx) + Math.abs(dy), angle: (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2) };
    })
    .filter(candidate => candidate.distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.angle - b.angle || a.entity.id.localeCompare(b.entity.id))
    .slice(0, count).map(candidate => candidate.entity);
};

window.affectedCells = function(center, spell, caster, entities, obstacles, terrain, keyOf, SIZE) {
  if (spell.isSparks) {
    const primary = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(center));
    return primary ? [primary, ...findSparkTargets(primary, spell.sparkRadius, spell.sparkCount, entities)].map(entity => entity.position) : [center];
  }
  if (spell.isCone) {
    if (!caster) return [];
    const direction = { x: center.x - caster.position.x, y: center.y - caster.position.y };
    const cone = getConeCells(caster.position, direction, SIZE);
    const blocked = getBlockedConeCells(cone, direction, entities, obstacles, keyOf);
    return cone.filter(point => !blocked.has(keyOf(point)));
  }
  const points = [];
  if (spell.isGlobal) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) points.push({ x, y });
    return points;
  }
  const radius = Math.floor(spell.aoeSize / 2);
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) points.push({ x, y });
    }
  }
  return points;
};

// Данные берём из общего gameState; функции эффектов, UI и анимаций — из deps.
// Только эффект: ресурсы уже оплачены в первой фазе каста.
window.applySpellEffect = function(spell, target, caster, deps, sparkTargets = null, shotHit = null) {
  const { entities, cells, SIZE, keyOf, obstacles, terrain, isAlly } = window.gameState;
  const {
    stateTypes, applyState, applyDamage, applySpellOnEntity, shotHits, playMissAnimation,
    renderPosition, findSparkTargets, affectedCells, addElementalShield,
    resolveStateSuppression, recalculateStateStats
  } = deps;
  const directTarget = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target));
  // Пустая клетка — допустимый выстрел, но без урона, состояния и броска уклонения.
  if (spell.isShot && !directTarget) return;
  // Один бросок по основной цели; Искры передают уже полученный в анимации результат.
  if (spell.isShot && directTarget && !(shotHit ?? shotHits(caster, directTarget))) {
    // Общая точка промаха, включая готовый результат Искр: надпись появляется один раз.
    playMissAnimation(cells[target.y * SIZE + target.x]);
    return;
  }
  if (spell.isSummon) {
    const creature = window.createCreature('lake-spirit', target);
    creature.ownerId = caster.id;
    creature.summonDuration = spell.summonDuration;
    entities.push(creature);
    const gameState = window.gameState;
    const casterIndex = gameState.turnOrderIds.indexOf(caster.id);
    const existingSummons = gameState.turnOrderIds.filter(id => {
      const creature = entities.find(item => item.id === id);
      return creature?.isSummon && creature.ownerId === caster.id;
    }).length;
    const insertIndex = casterIndex + 1 + existingSummons;
    gameState.turnOrderIds.splice(insertIndex, 0, creature.id);
    const slot = document.createElement('div');
    slot.className = 'turn-slot';
    slot.classList.add('summon');
    slot.setAttribute('aria-label', creature.name);
    slot.appendChild(creature.svg.cloneNode(true));
    slot.addEventListener('contextmenu', event => {
      event.preventDefault();
      window.selectEntity(creature.id);
    });
    slot.addEventListener('mouseenter', () => {
      gameState.queueHoveredEntityId = creature.id;
      window.updatePanel();
    });
    slot.addEventListener('mouseleave', () => {
      gameState.queueHoveredEntityId = null;
      window.updatePanel();
    });
    gameState.turnSlots.set(creature.id, slot);
    // Визуальная очередь повторяет порядок ID, включая несколько духов владельца.
    const nextSlot = gameState.turnOrderIds.slice(insertIndex + 1)
      .map(id => gameState.turnSlots.get(id)).find(Boolean);
    gameState.turnOrder.insertBefore(slot, nextSlot ?? null);
    renderPosition();
    applySpellOnEntity(creature, {
      id: 'summon-time', sourceId: 'summon-time', name: 'Время жизни',
      icon: window.SUMMON_TIME_ICON, stackable: false,
      duration: spell.summonDuration, casterId: caster.id, casterName: caster.name,
      description: 'Время жизни призывного существа.'
    });
    return;
  } else if (spell.isWeaknessVigor) {
    // Общие правила иммунитета, снятия Слабости и обновления срока остаются в applyState.
    if (directTarget) applyState(directTarget, {
      id: isAlly(directTarget) ? 'vigor' : 'weakness', duration: spell.stateDuration,
      casterId: caster.id, casterName: caster.name
    });
  } else if (spell.isMpBuff) {
    if (directTarget && isAlly(directTarget)) applySpellOnEntity(directTarget, {
      id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg, stackable: spell.stackable,
      duration: spell.effectDuration, casterId: caster.id, casterName: caster.name,
      mpAmount: spell.mpAmount, description: `+${spell.mpAmount} MP`
    });
  } else if (spell.isSkyShot) {
    if (directTarget && isAlly(directTarget)) applySpellOnEntity(directTarget, {
      id: spell.id, name: spell.name, icon: spell.svg, isSkyShot: true,
      description: spell.effectDescription, duration: spell.effectDuration,
      casterId: caster.id, casterName: caster.name
    });
  } else if (spell.isSparks) {
    if (directTarget) {
      // Выбираем отскоки до урона: смерть основной цели не меняет уже выбранную цепь.
      const targets = sparkTargets ?? findSparkTargets(directTarget, spell.sparkRadius, spell.sparkCount, entities);
      applyDamage(spell, directTarget);
      for (const secondary of targets) {
        if (secondary.hp > 0) applyDamage({ damage: Math.floor(spell.damage / 2), damageType: spell.damageType }, secondary);
      }
    }
  } else if (spell.id === 'ice-arrow') {
    if (directTarget) {
      // Сначала сопротивление → ES → HP, затем Охлаждение у выжившей цели.
      // Общая проверка попадания выше не допускает состояния при промахе.
      applyDamage(spell, directTarget);
      if (directTarget.hp > 0) applyState(directTarget, {
        id: spell.stateId, duration: spell.stateDuration, casterId: caster.id, casterName: caster.name
      });
    }
  } else if (spell.isWindRose) {
    // Принудительное перемещение: не расходуем MP и не запускаем очередь шагов.
    for (const direction of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]) {
      const source = { x: target.x + direction.x, y: target.y + direction.y };
      const destination = { x: target.x + 2 * direction.x, y: target.y + 2 * direction.y };
      const victim = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(source));
      // Тяжесть блокирует только толчок: обычная ходьба остаётся доступной.
      if (!victim || victim.states.some(state => state.id === 'heavy' && !state.suppressed
        && (state.duration > 0 || state.permanent || state.innate)) || destination.x < 0 || destination.x >= SIZE || destination.y < 0 || destination.y >= SIZE
        || obstacles.get(keyOf(destination)) === 'crate' || terrain.get(keyOf(destination)) === 'deep-water'
        || entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(destination))) continue;
      victim.position = destination;
    }
    renderPosition();
  } else if (spell.isRain) {
    // Влага действует на всех живых существ в квадрате, включая самого кастера.
    const area = new Set(affectedCells(target, spell, caster, entities, obstacles, terrain, keyOf, SIZE).map(keyOf));
    for (const victim of entities) {
      if (victim.hp > 0 && area.has(keyOf(victim.position))) applyState(victim, {
        id: spell.stateId, duration: spell.stateDuration, casterId: caster.id, casterName: caster.name
      });
    }
  } else if (spell.isMembrane) {
    if (directTarget && isAlly(directTarget)) applySpellOnEntity(directTarget, {
      id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg, stackable: spell.stackable,
      duration: spell.effectDuration, casterId: caster.id, casterName: caster.name,
      esAmount: spell.esAmount, evaAmount: spell.evaAmount,
      description: `+${spell.esAmount} ES, +${spell.evaAmount} EVA`
    });
  } else if (spell.isHealHarm) {
    if (directTarget && isAlly(directTarget)) {
      directTarget.hp = Math.min(directTarget.maxHP ?? directTarget.hp, directTarget.hp + spell.healAmount);
      const last = directTarget.states.filter(state => state.id === 'bleeding' && !state.suppressed)
        .reduce((latest, state) => !latest || state.appliedOrder > latest.appliedOrder ? state : latest, null);
      directTarget.states = directTarget.states.filter(state => state !== last);
      resolveStateSuppression(directTarget);
      recalculateStateStats(directTarget);
    } else if (directTarget) {
      applyDamage(spell, directTarget);
      if (directTarget.hp > 0) applyState(directTarget, {
        id: spell.stateId, duration: spell.bleedDuration, casterId: caster.id, casterName: caster.name
      });
    }
  } else if (spell.stateId) {
    const recipient = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)
      && (!spell.allyOnly || isAlly(entity)) && (!spell.enemyOnly || !isAlly(entity)));
    if (recipient) applySpellOnEntity(recipient, {
      id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg,
      description: stateTypes.get(spell.stateId).name,
      duration: spell.effectDuration, casterId: caster.id, casterName: caster.name,
      stateId: spell.stateId, stateDuration: spell.stateDuration, stackable: spell.stackable
    });
  } else if (spell.isElementalShield) {
    const ally = entities.find(entity => entity.hp > 0 && isAlly(entity)
      && keyOf(entity.position) === keyOf(target));
    if (ally) addElementalShield(ally, spell, caster);
  } else {
    const area = new Set(affectedCells(target, spell, caster, entities, obstacles, terrain, keyOf, SIZE).map(keyOf));
    for (const victim of entities) {
      if (area.has(keyOf(victim.position)) && (spell.isAOE || victim.id !== caster.id)
        && (!spell.enemyOnly || !isAlly(victim))) {
        applyDamage(spell, victim);
        if (spell.id === 'burning-hands') {
          // Сначала урон: Влага и Заморозка ещё защищают от текущего удара.
          // Затем прямое снятие у всех задетых целей, даже при поглощении/иммунитете.
          // Заблокированные клетки сюда не попадают; нейтрализацию не вызываем.
          victim.states = victim.states.filter(state => !['wet', 'chill', 'freeze'].includes(state.id));
          resolveStateSuppression(victim);
          recalculateStateStats(victim);
        }
        // Горение по-прежнему накладывают заклинания с burnDuration (например, куб).
        if (spell.burnDuration && victim.hp > 0) applyState(victim, {
          id: 'burning', duration: spell.burnDuration, casterId: caster.id, casterName: caster.name
        });
      }
    }
  }
};

// Каждый id имеет явный обработчик; обработчики только запускают анимацию и завершают каст.
const spellAnimationHandlers = {
  'sprint': ctx => {
    ctx.deps.playSprintAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'fire-shot': ctx => {
    ctx.deps.playProjectileAnimation(ctx.fromCell, ctx.targetCell, 'fire', () => ctx.setTimeout(ctx.finishCast, 0));
  },
  'ice-arrow': ctx => {
    ctx.deps.playProjectileAnimation(ctx.fromCell, ctx.targetCell, 'ice', () => ctx.setTimeout(ctx.finishCast, 0));
  },
  'sparks': ctx => {
    const { cells, SIZE } = window.gameState;
    const { playSparksAnimation, shotHits } = ctx.deps;
    const sparkCells = ctx.sparkTargets.map(entity => cells[entity.position.y * SIZE + entity.position.x]);
    playSparksAnimation(ctx.fromCell, ctx.targetCell, sparkCells, () => ctx.setTimeout(ctx.finishCast, 0), () => {
      if (!ctx.primaryTarget) return false;
      // Один результат живёт в контексте и затем читается finishCast, без повторного броска.
      ctx.shotHit = shotHits(ctx.caster, ctx.primaryTarget);
      return ctx.shotHit;
    });
  },
  'weakness-vigor': ctx => {
    const { entities, keyOf, isAlly } = window.gameState;
    const { playWeaknessVigorAnimation } = ctx.deps;
    const recipient = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(ctx.target));
    playWeaknessVigorAnimation(ctx.targetCell, isAlly(recipient));
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'fire-cube': ctx => {
    ctx.deps.playProjectileAnimation(ctx.fromCell, ctx.targetCell, 'fire-cube', () => {
      ctx.deps.playCubeExplosion(ctx.targetCell, ctx.spell);
      // Отсчёт после прибытия: сохраняем снаряд 350 мс + взрыв 400 мс.
      ctx.setTimeout(ctx.finishCast, 400);
    });
  },
  'heal-harm': ctx => {
    const { entities, keyOf, isAlly } = window.gameState;
    const target = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(ctx.target));
    ctx.deps.playHealHarmAnimation(ctx.targetCell, target, isAlly(target) ? 'ally' : 'enemy');
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'light-flash': ctx => {
    ctx.deps.playLightFlashAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 400);
  },
  'haste': ctx => {
    ctx.deps.playStateAnimation(ctx.targetCell, ctx.spell.stateId);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'slow': ctx => {
    ctx.deps.playStateAnimation(ctx.targetCell, ctx.spell.stateId);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'deep-freeze': ctx => {
    ctx.deps.playStateAnimation(ctx.targetCell, ctx.spell.stateId);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'liquid-membrane': ctx => {
    ctx.deps.playMembraneAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'rain': ctx => {
    ctx.deps.playRainAnimation(ctx.target, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 900);
  },
  'wind-rose': ctx => {
    ctx.deps.playWindRoseAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'dead-weight': ctx => {
    ctx.deps.playStateAnimation(ctx.targetCell, ctx.spell.stateId);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'burning-hands': ctx => {
    ctx.deps.playBurningHandsAnimation(ctx.fromCell, {
      x: ctx.target.x - ctx.caster.position.x, y: ctx.target.y - ctx.caster.position.y
    });
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'reckless': ctx => {
    ctx.deps.playStateAnimation(ctx.targetCell, ctx.spell.stateId);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'sky-shot': ctx => {
    ctx.deps.playSkyShotAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'armageddon': ctx => {
    ctx.deps.playArmageddonAnimation();
    ctx.setTimeout(ctx.finishCast, 900);
  },
  'fire-shield': ctx => {
    ctx.deps.playElementalShieldAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'water-shield': ctx => {
    ctx.deps.playElementalShieldAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'earth-shield': ctx => {
    ctx.deps.playElementalShieldAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'air-shield': ctx => {
    ctx.deps.playElementalShieldAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'stone-skin': ctx => {
    ctx.deps.playElementalShieldAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  }
};

window.castSpell = function(targetCell, deps) {
  const gameState = window.gameState;
  const { entities, cells, SIZE, keyOf, activeEntity, isAlly } = gameState;
  const {
    canPrepareSpell, canTarget,
    findSparkTargets, applySpellEffect, updatePanel, removeDefeatedEntities,
    cancelSpell, getEffectiveStat, playFailureAnimation, setTimeout, queueMicrotask
  } = deps;
  if (gameState.isCasting) return false;
  const target = { x: Number(targetCell.dataset.x), y: Number(targetCell.dataset.y) };
  const spell = activeEntity()?.availableSpells.find(item => item.id === gameState.preparedSpellId);
  if (!canPrepareSpell(spell) || !canTarget(target, spell)) return false;
  // Занятая клетка не расходует ресурсы призыва и сохраняет подготовку.
  if (spell.isSummon && entities.some(entity => entity.hp > 0
    && keyOf(entity.position) === keyOf(target))) return false;
  // Лечение и защита требуют живого союзника до оплаты.
  if ((spell.isElementalShield || spell.isMembrane || spell.isSkyShot || spell.isMpBuff) && !entities.some(entity => entity.hp > 0 && isAlly(entity)
    && keyOf(entity.position) === keyOf(target))) return false;
  if (spell.stateId && !spell.isRain && !spell.isShot && !entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)
    && (!spell.allyOnly || isAlly(entity)) && (!spell.enemyOnly || !isAlly(entity)))) return false;
  if (spell.enemyOnly && !entities.some(entity => entity.hp > 0 && !isAlly(entity)
    && keyOf(entity.position) === keyOf(target))) return false;
  if (spell.isWeaknessVigor && !entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target))) return false;
  const caster = activeEntity();
  // Отдельный бросок до оплаты: при SFC = 0 последовательность бросков выстрелов не меняется.
  const sfc = getEffectiveStat(caster, 'sfc');
  const failed = sfc > 0 && Math.random() * 100 < sfc;
  const primaryTarget = spell.isSparks ? entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)) : null;
  // Этот же снимок целей используется для анимации и последующего урона.
  const sparkTargets = spell.isSparks ? findSparkTargets(primaryTarget, spell.sparkRadius, spell.sparkCount, entities) : null;
  const fromCell = cells[caster.position.y * SIZE + caster.position.x];

  // Фаза 1: фиксируем цель и оплачиваем попытку каста независимо от результата SFC.
  caster.ap -= spell.apCost;
  spell.usesThisTurn++;
  if (spell.maxUsesPerBattle !== undefined) spell.usesTotal++;
  spell.cooldown = spell.maxCooldown;
  // Расходуем бафф после проверки цели и оплаты, даже при промахе или провале SFC.
  // Срок и смерть источника обслуживаются общим механизмом spellsOnMe.
  if (spell.isShot) caster.appliedEffects = caster.appliedEffects.filter(effect => !effect.isSkyShot);
  if (failed) {
    // Оплата общая с успешным кастом; провал не запускает эффект, уклонение и блокировку действий.
    playFailureAnimation(targetCell);
    cancelSpell();
    return true;
  }
  gameState.isCasting = true;
  cancelSpell(); // Также очищает превью и обновляет disabled у кнопок.

  const ctx = { spell, target, caster, targetCell, fromCell, sparkTargets, primaryTarget,
    shotHit: null, finishCast, deps,
    // Обёртка сохраняет обычный вызов браузерного таймера без привязки this к ctx.
    setTimeout: (callback, delay) => setTimeout(callback, delay) };

  function finishCast() {
    // Фаза 2: HP и очередь меняются лишь после завершения анимации.
    applySpellEffect(spell, target, caster, deps, sparkTargets, ctx.shotHit);
    removeDefeatedEntities();
    // Обновление UI выполнится сразу после callback, уже со снятой блокировкой.
    queueMicrotask(updatePanel);
    gameState.isCasting = false;
  }

  const handler = spellAnimationHandlers[spell.id];
  if (handler) {
    handler(ctx);
  } else if (spell.isSummon) {
    // До реализации анимации призыва завершаем оплаченный каст без снаряда.
    setTimeout(finishCast, 0);
  } else {
    // Защитный fallback для ещё не зарегистрированного заклинания.
    deps.playProjectileAnimation(fromCell, targetCell, 'fire', () => setTimeout(finishCast, 0));
  }
  return true;
};
