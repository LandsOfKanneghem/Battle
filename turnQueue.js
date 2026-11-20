// Очередь текущего раунда. Призывы следуют за владельцем и не сравнивают свою INI.
(() => {
  const state = () => window.gameState;
  let initiatives = new Map();
  let activeRootId = null;
  let activeId = null;
  const alive = () => state().entities.filter(entity => entity.hp > 0);
  const entityById = id => state().entities.find(entity => entity.id === id);
  const initiative = entity => window.getEffectiveStat(entity, 'ini');
  const team = entity => state().isAlly(entity) ? 'ally' : 'enemy';
  const compareIds = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  function orderRoots(roots, previousIds, startingRound) {
    const groups = new Map();
    const positions = new Map(previousIds.map((id, index) => [id, index]));
    for (const entity of roots) {
      const value = initiative(entity);
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(entity);
    }
    // roots содержит только ожидающих обычных существ: активный и призывы вне максимума.
    const values = [...groups.keys()].sort((a, b) => b - a);
    const attacker = state().attackingTeam ?? 'ally';
    return values.flatMap(value => {
      const group = groups.get(value);
      const sides = {
        ally: group.filter(entity => team(entity) === 'ally').sort(compareIds),
        enemy: group.filter(entity => team(entity) === 'enemy').sort(compareIds)
      };
      const earliest = group.reduce((first, entity) =>
        positions.get(entity.id) < positions.get(first.id) ? entity : first);
      let side = startingRound || value === values[0] ? attacker : team(earliest);
      const ordered = [];
      const offsets = { ally: 0, enemy: 0 };
      while (ordered.length < group.length) {
        if (offsets[side] >= sides[side].length) side = side === 'ally' ? 'enemy' : 'ally';
        ordered.push(sides[side][offsets[side]++]);
        side = side === 'ally' ? 'enemy' : 'ally';
      }
      return ordered;
    });
  }
  function rootOf(entity) {
    while (entity?.isSummon) entity = entityById(entity.ownerId);
    return entity;
  }
  function block(root) {
    return [root.id, ...alive().filter(entity => entity.isSummon && entity.ownerId === root.id)
      .flatMap(entity => block(entity))];
  }
  function prune() {
    const ids = new Set(alive().map(entity => entity.id));
    state().turnOrderIds = state().turnOrderIds.filter(id => ids.has(id));
    if (!ids.has(activeId)) activeId = null;
  }
  function protectedLength() {
    let length = 0;
    while (length < state().turnOrderIds.length
      && rootOf(entityById(state().turnOrderIds[length]))?.id === activeRootId) length++;
    return length;
  }
  function render() {
    const current = state();
    // Активный портрет остаётся видимым, но само существо уже извлечено из очереди.
    const visibleIds = activeId ? [activeId, ...current.turnOrderIds] : current.turnOrderIds;
    const slots = visibleIds.map(id => current.turnSlots.get(id)).filter(Boolean);
    if (slots.length !== current.turnOrder.children.length
      || slots.some((slot, index) => slot !== current.turnOrder.children[index])) {
      const scrollTop = current.turnOrder.scrollTop;
      current.turnOrder.replaceChildren(...slots);
      current.turnOrder.scrollTop = scrollTop;
    }
    if (!visibleIds.includes(current.queueHoveredEntityId)) current.queueHoveredEntityId = null;
  }
  function sync() {
    prune();
    let changedPending = false;
    for (const entity of alive()) {
      if (entity.isSummon) continue;
      const value = initiative(entity);
      const changed = initiatives.has(entity.id) && initiatives.get(entity.id) !== value;
      initiatives.set(entity.id, value);
      // Активный блок и уже сходившие владельцы сохраняют место до следующего раунда.
      if (!changed || entity.id === activeRootId || !state().turnOrderIds.includes(entity.id)) continue;
      changedPending = true;
    }
    if (changedPending) {
      // Сторону, которая раньше стояла в группе, определяем до любой перестановки.
      const previous = [...state().turnOrderIds];
      const locked = previous.slice(0, protectedLength());
      const roots = previous.map(entityById).filter(entity => !entity.isSummon);
      const blocks = new Map(roots.map(root => [root.id,
        previous.filter(id => rootOf(entityById(id))?.id === root.id)]));
      state().turnOrderIds = [...locked,
        ...orderRoots(roots, previous, false).flatMap(root => blocks.get(root.id))];
    }
    render();
  }
  function startRound() {
    const roots = alive().filter(entity => !entity.isSummon);
    activeRootId = null;
    activeId = null;
    initiatives = new Map(roots.map(entity => [entity.id, initiative(entity)]));
    state().turnOrderIds = orderRoots(roots, [], true).flatMap(entity => block(entity));
    if (state().turnOrderIds.length) {
      state().roundNumber++;
      window.battleLog?.beginRound(state().roundNumber);
    }
    render();
  }
  function next() {
    sync();
    if (!state().turnOrderIds.length) startRound();
    return entityById(state().turnOrderIds[0]);
  }
  window.turnQueue = {
    reset() {
      initiatives = new Map();
      activeRootId = null;
      activeId = null;
      state().roundNumber = 0;
      state().turnOrderIds = [];
    },
    sync,
    activate() {
      const entity = next();
      if (entity) state().turnOrderIds.shift();
      activeId = entity?.id ?? null;
      activeRootId = rootOf(entity)?.id ?? null;
      render();
      return entity;
    },
    finishTurn() {
      this.remove(state().activeEntityId);
    },
    remove(id) {
      if (activeId === id) activeId = null;
      state().turnOrderIds = state().turnOrderIds.filter(other => other !== id);
      initiatives.delete(id);
    },
    addSummon(entity) {
      // Существующий хвост блока сохраняет порядок создания, в том числе у вложенного призыва.
      const descendants = new Set(block(entityById(entity.ownerId)));
      let index = state().turnOrderIds.indexOf(entity.ownerId) + 1;
      while (index < state().turnOrderIds.length && descendants.has(state().turnOrderIds[index])) index++;
      state().turnOrderIds.splice(index, 0, entity.id);
      render();
    }
  };
})();
