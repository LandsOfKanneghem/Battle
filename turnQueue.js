// Очередь текущего раунда. Призывы следуют за владельцем и не сравнивают свою INI.
(() => {
  const state = () => window.gameState;
  let initiatives = new Map();
  let activeRootId = null;
  const alive = () => state().entities.filter(entity => entity.hp > 0);
  const entityById = id => state().entities.find(entity => entity.id === id);
  const initiative = entity => window.getEffectiveStat(entity, 'ini');
  const compare = (a, b) => initiative(b) - initiative(a)
    || Number(state().isAlly(b)) - Number(state().isAlly(a))
    || a.id.localeCompare(b.id, 'en', { numeric: true });
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
  }
  function protectedLength() {
    let length = 0;
    while (length < state().turnOrderIds.length
      && rootOf(entityById(state().turnOrderIds[length]))?.id === activeRootId) length++;
    return length;
  }
  function render() {
    const current = state();
    const slots = current.turnOrderIds.map(id => current.turnSlots.get(id)).filter(Boolean);
    if (slots.length !== current.turnOrder.children.length
      || slots.some((slot, index) => slot !== current.turnOrder.children[index])) {
      const scrollTop = current.turnOrder.scrollTop;
      current.turnOrder.replaceChildren(...slots);
      current.turnOrder.scrollTop = scrollTop;
    }
    if (!current.turnOrderIds.includes(current.queueHoveredEntityId)) current.queueHoveredEntityId = null;
  }
  function sync() {
    prune();
    const changedBlocks = [];
    for (const entity of alive()) {
      if (entity.isSummon) continue;
      const value = initiative(entity);
      const changed = initiatives.has(entity.id) && initiatives.get(entity.id) !== value;
      initiatives.set(entity.id, value);
      // Активный блок и уже сходившие владельцы сохраняют место до следующего раунда.
      if (!changed || entity.id === activeRootId || !state().turnOrderIds.includes(entity.id)) continue;
      const moving = state().turnOrderIds.filter(id => rootOf(entityById(id))?.id === entity.id);
      changedBlocks.push({ entity, moving });
    }
    // Сначала извлекаем все изменённые блоки: иначе ещё не переставленный участник
    // с уже новой INI мог бы исказить место вставки другого изменённого участника.
    const movedIds = new Set(changedBlocks.flatMap(item => item.moving));
    state().turnOrderIds = state().turnOrderIds.filter(id => !movedIds.has(id));
    for (const { entity, moving } of changedBlocks) {
      let index = protectedLength();
      while (index < state().turnOrderIds.length) {
        const other = rootOf(entityById(state().turnOrderIds[index]));
        if (compare(entity, other) < 0) break;
        do { index++; }
        while (index < state().turnOrderIds.length
          && rootOf(entityById(state().turnOrderIds[index]))?.id === other.id);
      }
      state().turnOrderIds.splice(index, 0, ...moving);
    }
    render();
  }
  function startRound() {
    const roots = alive().filter(entity => !entity.isSummon).sort(compare);
    activeRootId = null;
    initiatives = new Map(roots.map(entity => [entity.id, initiative(entity)]));
    state().turnOrderIds = roots.flatMap(entity => block(entity));
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
      state().roundNumber = 0;
      state().turnOrderIds = [];
    },
    sync,
    activate() {
      const entity = next();
      activeRootId = rootOf(entity)?.id ?? null;
      return entity;
    },
    finishTurn() {
      this.remove(state().activeEntityId);
    },
    remove(id) {
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
