// Обычный скрипт: глобальные точки входа; данные по-прежнему передаются аргументами.
// Чистая геометрия и выбор целей: все данные поля и существ передаются явно.
window.getConeCells = function(center, direction, SIZE, HEIGHT = SIZE) {
  const points = [];
  if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) return points;
  for (let depth = 1; depth <= 3; depth++) {
    for (let offset = 1 - depth; offset < depth; offset++) {
      const x = center.x + direction.x * depth - direction.y * offset;
      const y = center.y + direction.y * depth + direction.x * offset;
      if (x >= 0 && x < SIZE && y >= 0 && y < HEIGHT) points.push({ x, y, depth });
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
    const obstacle = obstacles.get(keyOf(point));
    const solid = obstacle === 'crate' || obstacle === 'void';
    const creature = entities.some(entity => entity.hp > 0 && !window.gameState.isInvisible(entity)
      && keyOf(entity.position) === keyOf(point));
    if (solid) blocked.add(keyOf(point)); // Ящики и стены не входят в подсветку.
    if ((!solid && !creature) || point.depth === 3) continue;
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
  // Невидимость исключает автоматический отскок, но не прямое попадание.
  return entities.filter(entity => entity.hp > 0 && entity.id !== primaryTarget.id
    && !window.gameState.isInvisible(entity))
    .map(entity => {
      const dx = entity.position.x - primaryTarget.position.x;
      const dy = entity.position.y - primaryTarget.position.y;
      return { entity, distance: Math.abs(dx) + Math.abs(dy), angle: (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2) };
    })
    .filter(candidate => candidate.distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.angle - b.angle || a.entity.id.localeCompare(b.entity.id))
    .slice(0, count).map(candidate => candidate.entity);
};

window.affectedCells = function(center, spell, caster, entities, obstacles, terrain, keyOf, SIZE, HEIGHT = SIZE) {
  if (spell.isSparks) {
    const primary = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(center));
    return primary ? [primary, ...findSparkTargets(primary, spell.sparkRadius, spell.sparkCount, entities)].map(entity => entity.position) : [center];
  }
  if (spell.isCone) {
    if (!caster) return [];
    const direction = { x: center.x - caster.position.x, y: center.y - caster.position.y };
    const cone = getConeCells(caster.position, direction, SIZE, HEIGHT);
    const blocked = getBlockedConeCells(cone, direction, entities, obstacles, keyOf);
    return cone.filter(point => !blocked.has(keyOf(point)));
  }
  const points = [];
  if (spell.isGlobal) {
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < SIZE; x++) points.push({ x, y });
    return points;
  }
  const radius = Math.floor(spell.aoeSize / 2);
  if (spell.isDiamond) {
    // D7: центр и клетки в манхэттенском радиусе 3, с обрезкой по краям поля.
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        if (Math.abs(x - center.x) + Math.abs(y - center.y) <= radius
          && x >= 0 && x < SIZE && y >= 0 && y < HEIGHT) points.push({ x, y });
      }
    }
    return points;
  }
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (x >= 0 && x < SIZE && y >= 0 && y < HEIGHT) points.push({ x, y });
    }
  }
  return points;
};

// Ось фиксируется по исходному положению; диагональ сдвигается на одну клетку.
window.getTonguePullDestination = function(caster, target) {
  const state = window.gameState;
  const dx = caster.position.x - target.position.x;
  const dy = caster.position.y - target.position.y;
  const diagonal = Math.abs(dx) === Math.abs(dy);
  const stepX = diagonal || Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
  const stepY = diagonal || Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0;
  let point = { ...target.position };
  for (let step = 0; step < (diagonal ? 1 : 2); step++) {
    const next = { x: point.x + stepX, y: point.y + stepY };
    const key = state.keyOf(next);
    // Не перепрыгиваем через препятствия и существ, не занимаем клетку самого кастера.
    if (next.x < 0 || next.x >= state.SIZE || next.y < 0 || next.y >= state.HEIGHT
      || state.obstacles.has(key) || state.terrain.get(key) === 'void' || state.isWater(state.terrain.get(key))
      || state.entities.some(entity => entity !== target && entity.hp > 0 && state.keyOf(entity.position) === key)) break;
    point = next;
  }
  return point;
};

// Данные берём из общего gameState; функции эффектов, UI и анимаций — из deps.
// Только эффект: ресурсы уже оплачены в первой фазе каста.
window.applySpellEffect = function(spell, target, caster, deps, sparkTargets = null, shotHit = null) {
  const { entities, cells, SIZE, HEIGHT, keyOf, obstacles, terrain, isAlly } = window.gameState;
  if (terrain?.get(keyOf(target)) === 'void') return;
  const {
    stateTypes, applyState, applyDamage, applySpellOnEntity, hasActiveState, shotHits, playMissAnimation,
    renderPosition, findSparkTargets, affectedCells, addElementalShield,
    resolveStateSuppression, recalculateStateStats
  } = deps;
  const directTarget = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target));
  const baseDamage = window.getSpellDamage(spell, caster);
  // Округляем штраф до защиты/ES, сохраняя исходные данные заклинания или атаки.
  const isNonSpell = spell.abilityType === 'ability' || spell.abilityType === 'weapon-strike';
  const damageMultiplier = caster && ((spell.abilityType === 'spell' && hasActiveState(caster, 'exhaustion'))
    || (isNonSpell && hasActiveState(caster, 'weakness'))) ? 0.8 : 1;
  const adjustedSpell = { ...spell, damage: Math.floor((baseDamage ?? 0) * damageMultiplier) };
  // Фиксируем срок один раз до эффектов: собственный бафф INT от Часа силы его не меняет.
  const duration = window.getSpellDuration(spell, caster);
  const effectArea = affectedCells(target, spell, caster, entities, obstacles, terrain, keyOf, SIZE, HEIGHT);
  // Без существа выстрел действует только на факелы; броска уклонения нет.
  if (spell.isShot && !directTarget) {
    window.applyTorchSpell?.(effectArea, spell, caster);
    return;
  }
  // Один бросок по основной цели; Искры передают уже полученный в анимации результат.
  if ((spell.isShot || spell.isHit) && directTarget && !(shotHit ?? shotHits(caster, directTarget))) {
    // Общая точка промаха, включая готовый результат Искр: надпись появляется один раз.
    window.battleLog?.miss(caster, directTarget);
    playMissAnimation(cells[target.y * SIZE + target.x]);
    return;
  }
  window.applyTorchSpell?.(effectArea, spell, caster);
  if (spell.isSummon) {
    const creature = window.createCreature('lake-spirit', target);
    // Поставленный на карту дух — обычный моб; призыв управляется его владельцем.
    creature.isSummon = true;
    delete creature.ai;
    creature.ownerId = caster.id;
    creature.summonDuration = duration;
    entities.push(creature);
    window.battleLog?.summoned(caster, creature);
    const gameState = window.gameState;
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
    window.turnQueue.addSummon(creature);
    renderPosition();
    applySpellOnEntity(creature, {
      id: 'summon-time', sourceId: 'summon-time', name: 'Время жизни',
      icon: window.SUMMON_TIME_ICON, stackable: false,
      duration, casterId: caster.id, casterName: caster.name
    });
    return;
  } else if (spell.isTeleport) {
    if (caster) {
      caster.position = { x: target.x, y: target.y };
      renderPosition(); // Мгновенное перемещение без шагов и расхода MP.
    }
  } else if (spell.isTonguePull) {
    if (directTarget && caster) {
      directTarget.position = window.getTonguePullDestination(caster, directTarget);
      renderPosition();
      // Сторона определяется относительно кастера, включая умение вражеского ИИ.
      if (isAlly(directTarget) !== isAlly(caster)) applyDamage(adjustedSpell, directTarget, caster);
    }
  } else if (spell.isPowerHour) {
    const area = new Set(affectedCells(target, spell, caster, entities, obstacles, terrain, keyOf, SIZE, HEIGHT).map(keyOf));
    for (const victim of entities) {
      if (victim.hp > 0 && isAlly(victim) && area.has(keyOf(victim.position))) {
        applySpellOnEntity(victim, {
          id: spell.id, name: spell.name, icon: spell.svg, stackable: spell.stackable,
          modifiers: { vit: 3, str: 3, att: 3, int: 3, wis: 3, cha: 3, luc: 3 },
          duration, casterId: caster.id, casterName: caster.name,
          description: spell.effectDescription
        });
      }
    }
  } else if (spell.isWeaknessVigor) {
    // Общие правила иммунитета, снятия Слабости и обновления срока остаются в applyState.
    if (directTarget) applyState(directTarget, {
      id: isAlly(directTarget) ? 'vigor' : 'weakness', duration,
      casterId: caster.id, casterName: caster.name
    });
  } else if (spell.isTorchLight) {
    if (directTarget && isAlly(directTarget) === isAlly(caster)) {
      applySpellOnEntity(directTarget, {
        id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg,
        isTorchLight: true, duration, casterId: caster.id, casterName: caster.name,
        description: spell.effectDescription, stackable: false
      });
      window.refreshTorchLighting?.();
    }
  } else if (spell.isMpBuff) {
    if (directTarget && isAlly(directTarget)) applySpellOnEntity(directTarget, {
      id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg, stackable: spell.stackable,
      duration, casterId: caster.id, casterName: caster.name,
      mpAmount: spell.mpAmount, description: `+${spell.mpAmount} MP`
    });
  } else if (spell.isSkyShot) {
    if (directTarget && isAlly(directTarget)) applySpellOnEntity(directTarget, {
      id: spell.id, name: spell.name, icon: spell.svg, isSkyShot: true,
      description: spell.effectDescription, duration,
      casterId: caster.id, casterName: caster.name
    });
  } else if (spell.isSparks) {
    if (directTarget) {
      // Выбираем отскоки до урона: смерть основной цели не меняет уже выбранную цепь.
      const targets = sparkTargets ?? findSparkTargets(directTarget, spell.sparkRadius, spell.sparkCount, entities);
      applyDamage(adjustedSpell, directTarget, caster);
      for (const secondary of targets) {
        if (secondary.hp > 0) applyDamage({ ...adjustedSpell, damage: Math.floor(adjustedSpell.damage / 2) }, secondary, caster);
      }
    }
  } else if (spell.id === 'ice-arrow') {
    if (directTarget) {
      // Сначала сопротивление → ES → HP, затем Охлаждение у выжившей цели.
      // Общая проверка попадания выше не допускает состояния при промахе.
      applyDamage(adjustedSpell, directTarget, caster);
      if (directTarget.hp > 0) applyState(directTarget, {
        id: spell.stateId, duration, casterId: caster.id, casterName: caster.name
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
        && (state.duration > 0 || state.permanent || state.innate)) || destination.x < 0 || destination.x >= SIZE || destination.y < 0 || destination.y >= HEIGHT
        || obstacles.has(keyOf(destination)) || terrain.get(keyOf(destination)) === 'void'
        || gameState.isWater(terrain.get(keyOf(destination)))
        || entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(destination))) continue;
      victim.position = destination;
    }
    renderPosition();
  } else if (spell.isRain) {
    // Влага действует на всех живых существ в квадрате, включая самого кастера.
    const area = new Set(affectedCells(target, spell, caster, entities, obstacles, terrain, keyOf, SIZE, HEIGHT).map(keyOf));
    for (const victim of entities) {
      if (victim.hp > 0 && area.has(keyOf(victim.position))) applyState(victim, {
        id: spell.stateId, duration, casterId: caster.id, casterName: caster.name
      });
    }
  } else if (spell.isMembrane) {
    if (directTarget && isAlly(directTarget)) {
      const esAmount = Math.floor(spell.esAmount + (spell.effectValuePerLvl ?? 0) * (caster?.level ?? 1));
      applySpellOnEntity(directTarget, {
        id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg, stackable: spell.stackable,
        duration, casterId: caster.id, casterName: caster.name,
        esAmount, baseEsAmount: spell.esAmount, evaAmount: spell.evaAmount,
        description: `+${esAmount} ES, +${spell.evaAmount} EVA`
      });
    }
  } else if (spell.isHealHarm) {
    if (directTarget && isAlly(directTarget)) {
      const hpBefore = directTarget.hp;
      directTarget.hp = Math.min(directTarget.maxHP ?? directTarget.hp, directTarget.hp + spell.healAmount);
      window.battleLog?.heal(directTarget, directTarget.hp - hpBefore, caster);
      const last = directTarget.states.filter(state => state.id === 'bleeding' && !state.suppressed)
        .reduce((latest, state) => !latest || state.appliedOrder > latest.appliedOrder ? state : latest, null);
      directTarget.states = directTarget.states.filter(state => state !== last);
      resolveStateSuppression(directTarget);
      recalculateStateStats(directTarget);
    } else if (directTarget) {
      applyDamage(adjustedSpell, directTarget, caster);
      if (directTarget.hp > 0) applyState(directTarget, {
        id: spell.stateId, duration: spell.bleedDuration, casterId: caster.id, casterName: caster.name
      });
    }
  } else if (spell.id === 'bite') {
    if (directTarget) {
      applyDamage(adjustedSpell, directTarget, caster);
      if (directTarget.hp > 0 && Math.random() * 100 < spell.bleedChance) {
        applyState(directTarget, { id: spell.stateId, duration: spell.bleedDuration,
          casterId: caster.id, casterName: caster.name });
      }
    }
  } else if (spell.stateId) {
    const recipient = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)
      && (spell.target !== 'ally' || isAlly(entity) === isAlly(caster)) && (spell.target !== 'enemy' || isAlly(entity) !== isAlly(caster)));
    if (recipient) applySpellOnEntity(recipient, {
      id: spell.id, sourceId: spell.id, name: spell.name, icon: spell.svg,
      description: stateTypes.get(spell.stateId).name,
      duration, casterId: caster.id, casterName: caster.name,
      stateId: spell.stateId, stackable: spell.stackable
    });
  } else if (spell.isElementalShield) {
    const ally = entities.find(entity => entity.hp > 0 && isAlly(entity)
      && keyOf(entity.position) === keyOf(target));
    if (ally) addElementalShield(ally, spell, caster, duration);
  } else {
    const area = new Set(affectedCells(target, spell, caster, entities, obstacles, terrain, keyOf, SIZE, HEIGHT).map(keyOf));
    for (const victim of entities) {
      if (area.has(keyOf(victim.position)) && (spell.isAOE || victim.id !== caster.id)
        && (spell.target !== 'enemy' || !isAlly(victim))) {
        applyDamage(adjustedSpell, victim, caster);
        if (spell.id === 'burning-hands') {
          // Сначала урон: Влага и Заморозка ещё защищают от текущего удара.
          // Затем прямое снятие у всех задетых целей, даже при поглощении/иммунитете.
          // Заблокированные клетки сюда не попадают; нейтрализацию не вызываем.
          victim.states = victim.states.filter(state => !['wet', 'chill', 'freeze'].includes(state.id));
          resolveStateSuppression(victim);
          recalculateStateStats(victim);
        }
        // Горение использует общий срок заклинания (например, у Огненного куба).
        if (spell.appliesBurning && victim.hp > 0) applyState(victim, {
          id: 'burning', duration, casterId: caster.id, casterName: caster.name
        });
      }
    }
  }
};

// Каждый id имеет явный обработчик; обработчики только запускают анимацию и завершают каст.
const spellAnimationHandlers = {
  'sword-strike': ctx => {
    window.playSwordStrikeAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 400);
  },
  'torch': ctx => ctx.setTimeout(ctx.finishCast, 0),
  'spectral-strike': ctx => {
    ctx.deps.playSpectralStrikeAnimation(ctx.targetCell, ctx.spell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'turn-invisible': ctx => {
    ctx.deps.playStateAnimation(ctx.targetCell, ctx.spell.stateId);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'tongue-pull': ctx => {
    ctx.deps.playTonguePullAnimation(ctx.fromCell, ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'power-hour': ctx => {
    const { entities, obstacles, terrain, keyOf, SIZE, HEIGHT, cells, isAlly } = window.gameState;
    const area = new Set(ctx.deps.affectedCells(ctx.target, ctx.spell, ctx.caster,
      entities, obstacles, terrain, keyOf, SIZE, HEIGHT).map(keyOf));
    for (const victim of entities) {
      if (victim.hp > 0 && isAlly(victim) && area.has(keyOf(victim.position))) {
        ctx.deps.playPowerHourAnimation(cells[victim.position.y * SIZE + victim.position.x]);
      }
    }
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'apply-old-age': ctx => {
    ctx.deps.playOldAgeAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'teleport': ctx => {
    ctx.deps.playTeleportAnimation(ctx.fromCell);
    ctx.deps.playTeleportAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'sprint': ctx => {
    ctx.deps.playSprintAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
  },
  'fire-shot': ctx => {
    ctx.deps.playProjectileAnimation(ctx.fromCell, ctx.targetCell, 'fire', () => ctx.setTimeout(ctx.finishCast, 0));
  },
  'water-shot': ctx => {
    ctx.deps.playProjectileAnimation(ctx.fromCell, ctx.targetCell, 'water', () => ctx.setTimeout(ctx.finishCast, 0), ctx.spell);
  },
  'bite': ctx => {
    ctx.deps.playBiteAnimation(ctx.targetCell);
    ctx.setTimeout(ctx.finishCast, 500);
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

// Общий учёт оплаченных заклинаний игрока и ИИ, включая провалы.
window.recordSpellAttempt = function(spell, caster, deps) {
  if (spell.abilityType === 'spell' && (caster.spellCastCount ?? 0) < caster.maxSpellCasts) {
    caster.spellCastCount = (caster.spellCastCount ?? 0) + 1;
    if (caster.spellCastCount >= caster.maxSpellCasts && !caster.states?.some(state => state.id === 'exhaustion' && state.permanent)) {
      deps.applyState(caster, {
        id: 'exhaustion', duration: 0, permanent: true,
        casterId: caster.id, casterName: caster.name
      });
    }
  }
};

// Общий учёт оплаченных попыток атаки игрока и ИИ, включая промахи.
window.recordHitAttempt = function(spell, caster, deps) {
  if ((spell.abilityType === 'ability' || spell.abilityType === 'weapon-strike')
    && (caster.hitCount ?? 0) < caster.maxHitCount) {
    caster.hitCount = (caster.hitCount ?? 0) + 1;
    if (caster.hitCount >= caster.maxHitCount && !caster.states?.some(state => state.id === 'weakness' && state.permanent)) {
      deps.applyState(caster, {
        id: 'weakness', duration: 0, permanent: true,
        casterId: caster.id, casterName: caster.name
      });
    }
  }
};

window.castSpell = function(targetCell, deps) {
  const gameState = window.gameState;
  const battleVersion = gameState.battleVersion;
  const { entities, cells, SIZE, keyOf, activeEntity, isAlly } = gameState;
  const {
    canPrepareSpell, canTarget,
    findSparkTargets, applySpellEffect, updatePanel, removeDefeatedEntities,
    cancelSpell, getEffectiveStat, hasActiveState, applyState, playFailureAnimation, setTimeout, queueMicrotask
  } = deps;
  if (gameState.isCasting) return false;
  const target = { x: Number(targetCell.dataset.x), y: Number(targetCell.dataset.y) };
  const caster = activeEntity();
  const spell = caster?.availableSpells.find(item => item.id === gameState.preparedSpellId);
  if (!canPrepareSpell(spell) || !canTarget(target, spell)) return false;
  // Единое правило: новые заклинания с требованием пустой клетки помечаются requiresEmptyCell.
  const requiresEmptyCell = spell.requiresEmptyCell || spell.isSummon || spell.isTeleport;
  const occupant = requiresEmptyCell && entities.find(entity => entity.hp > 0
    && keyOf(entity.position) === keyOf(target));
  const hiddenObstacle = occupant && gameState.isHiddenFrom(occupant, caster);
  // Видимую занятую клетку отклоняем до оплаты; скрытое препятствие обнаруживается только при касте.
  if (occupant && !hiddenObstacle) return false;
  // Лечение и защита требуют живого союзника до оплаты.
  if ((spell.isElementalShield || spell.isMembrane || spell.isSkyShot || spell.isMpBuff) && !entities.some(entity => entity.hp > 0 && isAlly(entity)
    && keyOf(entity.position) === keyOf(target))) return false;
  if (spell.stateId && !spell.canCastOnAnyCell && !spell.isRain && !spell.isShot && !window.isTorchSpellTarget?.(target, spell, caster) && !entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)
    && (spell.target !== 'ally' || isAlly(entity)) && (spell.target !== 'enemy' || !isAlly(entity)))) return false;
  if (spell.target === 'enemy' && !spell.canCastOnAnyCell && !window.isTorchSpellTarget?.(target, spell, caster) && !entities.some(entity => entity.hp > 0 && !isAlly(entity)
    && keyOf(entity.position) === keyOf(target))) return false;
  if (spell.isWeaknessVigor && !entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target))) return false;
  // Отдельный бросок до оплаты: при SFC = 0 последовательность бросков выстрелов не меняется.
  const sfc = getEffectiveStat(caster, 'sfc');
  const failed = hiddenObstacle || (spell.abilityType === 'spell' && sfc > 0 && Math.random() * 100 < sfc);
  const primaryTarget = spell.isSparks ? entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)) : null;
  // Этот же снимок целей используется для анимации и последующего урона.
  const sparkTargets = spell.isSparks ? findSparkTargets(primaryTarget, spell.sparkRadius, spell.sparkCount, entities) : null;
  const fromCell = cells[caster.position.y * SIZE + caster.position.x];

  // Фаза 1: фиксируем цель и оплачиваем попытку каста независимо от результата SFC.
  caster.ap -= spell.apCost;
  window.battleLog?.cast(caster, spell, entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(target)));
  // Считаем оплаченные заклинания до лимита, включая провалы SFC; способности не учитываем.
  window.recordSpellAttempt(spell, caster, deps);
  spell.usesThisTurn++;
  if (spell.maxUsesPerBattle !== undefined) spell.usesTotal++;
  spell.cooldown = spell.maxCooldown;
  window.recordHitAttempt(spell, caster, deps);
  // Расходуем бафф после проверки цели и оплаты, даже при промахе или провале SFC.
  // Срок и смерть источника обслуживаются общим механизмом spellsOnMe.
  if (spell.isShot) caster.appliedEffects = caster.appliedEffects.filter(effect => !effect.isSkyShot);
  if (failed) {
    window.battleLog?.failure(caster, spell);
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
    setTimeout: (callback, delay) => setTimeout(() => {
      if (battleVersion === gameState.battleVersion) callback();
    }, delay) };

  function finishCast() {
    if (battleVersion !== gameState.battleVersion) return;
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
