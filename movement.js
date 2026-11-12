// Движение, подсветка пути, смена ходов и удаление побеждённых.
// Состояние читается из window.gameState; боевые и UI-функции вызываются через window.*.
// При загрузке только объявляем функции: работа начинается после инициализации index.html.

window.buildPath = function(start, target, entity = window.gameState.activeEntity()) {
  if (!window.gameState.isFree(start, entity) || !window.gameState.isFree(target, entity)) return null;
  // Воду можно пересекать с Левитацией, но точка назначения всегда на суше.
  if (window.gameState.terrain.get(window.gameState.keyOf(target)) === 'deep-water') return null;
  const heuristic = (point) => Math.abs(point.x - target.x) + Math.abs(point.y - target.y);
  const open = [{ ...start, g: 0, h: heuristic(start), parent: null, axis: null, turn: 0 }];
  const bestCost = new Map([[window.gameState.keyOf(start), 0]]);
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // A*: g учитывает вход на поверхность, h — Манхэттен (минимальная цена шага 1).
  // Чередование осей влияет только на выбор среди равных оценок,
  // поэтому не мешает находить кратчайшие обходные маршруты.
  while (open.length > 0) {
    open.sort((a, b) => (a.g + a.h) - (b.g + b.h) || a.h - b.h || a.turn - b.turn);
    const current = open.shift();
    if (current.g !== bestCost.get(window.gameState.keyOf(current))) continue;
    if (current.x === target.x && current.y === target.y) {
      const path = [];
      for (let node = current; node.parent; node = node.parent) {
        path.push({ x: node.x, y: node.y });
      }
      return path.reverse();
    }
    for (const [dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!window.gameState.isFree(next, entity)) continue;
      const g = current.g + window.gameState.entryCost(next, entity);
      if (g >= (bestCost.get(window.gameState.keyOf(next)) ?? Infinity)) continue;
      bestCost.set(window.gameState.keyOf(next), g);
      const axis = dx ? 'x' : 'y';
      open.push({ ...next, g, h: heuristic(next), parent: current, axis,
        turn: axis === current.axis ? 1 : 0 });
    }
  }
  return null; // Свободная цель может быть отрезана препятствиями.
};

// Двигаться могут управляемые союзники.
window.activeMover = function() {
  if (window.gameState.isSkippingTurn) return undefined;
  return window.gameState.entities.find(entity => entity.id === window.gameState.activeEntityId && entity.hp > 0 && !window.isFrozen(entity)
    && (entity.type === 'wizard' || entity.type === 'monk' || entity.isSummon === true));
};

window.takeStep = function() {
  if (window.gameState.isCasting) return;
  const mover = window.activeMover();
  if (!window.gameState.isMoving || !mover || window.gameState.stepQueue.length === 0) return;
  const next = window.gameState.stepQueue[0];
  if (window.gameState.entryCost(next, mover) > mover.mp) {
    window.gameState.stepQueue = [];
    window.gameState.isMoving = false;
    window.gameState.battlefield.classList.remove('moving');
    window.updatePanel();
    return;
  }
  mover.position = window.gameState.stepQueue.shift();
  mover.mp -= window.gameState.entryCost(mover.position, mover);
  window.renderPosition();
  if (window.gameState.stepQueue.length > 0) {
    setTimeout(window.takeStep, window.gameState.STEP_MS);
  } else {
    window.gameState.isMoving = false;
    window.gameState.battlefield.classList.remove('moving');
  }
  window.updatePanel();
};

window.beginTurn = function(entity) {
  if (document.getElementById('defeat-overlay')?.hidden === false) return;
  window.gameState.isSkippingTurn = false;
  // Если участник удалён, выбираем следующего живого по фиксированной очереди.
  if (window.gameState.entities.indexOf(entity) === -1) {
    entity = window.gameState.nextLivingEntity(window.gameState.activeEntityId);
  }
  const version = ++window.gameState.turnVersion;
  window.gameState.preparedSpellId = null;
  if (!entity) {
    window.gameState.activeEntityId = null;
    window.renderSpellPanel();
    window.clearHighlight();
    window.updatePanel();
    return;
  }
  // Урон Горения срабатывает только у цели, без отсчёта длительности.
  // При самоналожении сохраняем урон до истечения защит/ES и самого Горения.
  // Активируем получателя хода заранее, чтобы его смерть сразу передала ход после него.
  window.gameState.activeEntityId = entity.id;
  const burning = entity.states.find(state => state.id === 'burning' && !state.suppressed
    && (state.duration > 0 || state.permanent || state.innate));
  if (burning) {
    window.applyDamage({ damage: burning.tickDamage, damageType: burning.damageType }, entity);
    if (entity.hp <= 0) {
      window.removeDefeatedEntities();
      return;
    }
  }
  // Каждый активный стак обходит защиты и ES, но Заморозка сохраняет иммунитет к урону.
  if (!window.isFrozen(entity)) {
    for (const bleed of entity.states.filter(state => state.id === 'bleeding' && !state.suppressed
      && (state.duration > 0 || state.permanent || state.innate))) {
      entity.hp = Math.max(0, entity.hp - 2);
      if (entity.hp <= 0) {
        window.removeDefeatedEntities();
        return;
      }
    }
  }
  // Проверяем ДО тика: последний ход самоналоженной Заморозки тоже пропускается.
  window.gameState.isSkippingTurn = window.isFrozen(entity);
  // Длительности меняются только по casterId, один раз даже для caster = target.
  window.tickCasterEffects(entity.id);
  if (window.gameState.entities.some(target => target.hp <= 0)) {
    window.removeDefeatedEntities();
    // Если ход сменился, beginTurn уже вызван удалением. Живой владелец продолжает без повторного тика.
    if (!window.gameState.entities.includes(entity) || window.gameState.turnVersion !== version) return;
  }
  // Начало личного хода обновляет только заклинания этого участника.
  for (const spell of entity.availableSpells) {
    spell.usesThisTurn = 0;
    spell.cooldown = Math.max(0, spell.cooldown - 1);
  }
  window.gameState.activeEntityId = entity.id;
  window.renderSpellPanel();
  entity.ap = entity.maxAP;
  entity.mp = entity.maxMP;
  // Независимые броски на каждый ход: бонус к остатку может превышать максимум на 1.
  const wisChance = (window.getEffectiveStat(entity, 'wis') % 20) * 5;
  if (wisChance > 0 && Math.random() * 100 < wisChance) entity.ap += 1;
  const strChance = (window.getEffectiveStat(entity, 'str') % 20) * 5;
  if (strChance > 0 && Math.random() * 100 < strChance) entity.mp += 1;
  window.clearHighlight();
  window.updatePanel(); // HP не является ресурсом хода.
  if (entity.ai && !window.isFrozen(entity)) {
    window.runAI(entity);
    return;
  }
  if (window.gameState.isSkippingTurn) {
    // Замороженный участник виден 100 мс, но действовать не может.

    setTimeout(() => {
      // Смерть или новая передача уже завершили этот ход: старый таймер не действует.
      if (version !== window.gameState.turnVersion) return;
      const index = window.gameState.entities.indexOf(entity);
      if (index === -1) {
        window.beginTurn(window.gameState.nextLivingEntity(window.gameState.activeEntityId));
        return;
      }
      entity.ap = entity.maxAP;
      entity.mp = entity.maxMP;
      window.beginTurn(window.gameState.nextLivingEntity(entity.id));
    }, 100);
  }
};

window.removeDefeatedEntities = function() {
  const activeIndex = window.gameState.entities.findIndex(entity => entity.id === window.gameState.activeEntityId);
  const activeBefore = window.gameState.entities[activeIndex];
  const orderBefore = [...window.gameState.turnOrderIds];
  // Удаляем именно сущность по ID: одинаковые имена не связывают врагов.
  for (let i = window.gameState.entities.length - 1; i >= 0; i--) {
    const entity = window.gameState.entities[i];
    if (entity.hp > 0) continue;
    window.removeCasterEffects(entity.id);
    entity.svg.remove();
    window.gameState.turnSlots.get(entity.id).remove();
    window.gameState.turnSlots.delete(entity.id);
    if (entity.isSummon) {
      window.gameState.turnOrderIds = window.gameState.turnOrderIds.filter(id => id !== entity.id);
    }
    if (window.gameState.selectedEntityId === entity.id) window.gameState.selectedEntityId = null;
    if (window.gameState.hoveredEntityId === entity.id) window.gameState.hoveredEntityId = null;
    if (window.gameState.fieldHoveredEntityId === entity.id) window.gameState.fieldHoveredEntityId = null;
    if (window.gameState.queueHoveredEntityId === entity.id) window.gameState.queueHoveredEntityId = null;
    window.gameState.entities.splice(i, 1);
    // Смерть владельца могла пометить духа в уже пройденной части массива.
    i = window.gameState.entities.length;
  }
  const activeDied = !!activeBefore && !window.gameState.entities.includes(activeBefore);
  // ID погибшего духа уже удалён: ищем преемника по прежней очереди среди оставшихся живых.
  const activeOrderIndex = orderBefore.indexOf(activeBefore?.id);
  const nextAfterSummon = activeDied && activeBefore.isSummon
    ? [...orderBefore.slice(activeOrderIndex + 1), ...orderBefore.slice(0, activeOrderIndex + 1)]
      .map(id => window.gameState.entities.find(entity => entity.id === id && entity.hp > 0)).find(Boolean)
    : null;
  const alliesAlive = window.gameState.entities.some(entity => entity.hp > 0 && window.gameState.isAlly(entity));
  if (!alliesAlive) {
    window.showDefeatOverlay?.();
    return;
  }
  if (activeDied || window.gameState.entities.length === 0) {
    window.gameState.isMoving = false;
    window.gameState.stepQueue = [];
    window.gameState.battlefield.classList.remove('moving');
    window.beginTurn(nextAfterSummon ?? window.gameState.nextLivingEntity(window.gameState.activeEntityId)); // Смена активного участника происходит сразу.
  } else {
    window.updatePanel();
  }
};

window.highlightPath = function(path, mp, entity = window.gameState.activeEntity()) {
  window.clearHighlight();
  let cost = 0;
  path.forEach(point => {
    cost += window.gameState.entryCost(point, entity);
    const cell = window.gameState.cells[point.y * window.gameState.SIZE + point.x];
    cell.classList.add(cost <= mp ? 'path-reachable' : 'path-over-budget');
    window.gameState.highlightedCells.push(cell);
  });
};

window.clearHighlight = function() {
  for (const badge of window.gameState.effectBadges) badge.remove();
  window.gameState.effectBadges = [];
  for (const cell of window.gameState.highlightedCells) {
    cell.classList.remove('path-reachable', 'path-over-budget', 'spell-aoe');
  }
  window.gameState.highlightedCells = [];
  for (const cell of window.gameState.rangeHighlightedCells) cell.classList.remove('spell-range');
  window.gameState.rangeHighlightedCells = [];
  window.gameState.previewKey = null;
  window.gameState.costLabel.remove();
};

window.cancelSpell = function() {
  window.gameState.preparedSpellId = null;
  window.clearHighlight();
  window.updatePanel();
};
