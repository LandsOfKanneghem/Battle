// Логика ИИ существ. Начало хода и тик эффектов остаются в movement.js.
(() => {
  const state = () => window.gameState;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const current = (entity, version) => state().turnVersion === version
    && state().activeEntityId === entity.id && entity.hp > 0 && state().entities.includes(entity);

  window.runAI = function(entity) {
    if (entity.ai === 'wolf') { runWolfAI(entity); return; }
    // runSkipAI(entity); // Режим простого пропуска для тестов.
  };

  function runSkipAI(entity, version = state().turnVersion) {
    state().isSkippingTurn = true;
    window.updatePanel();
    setTimeout(() => {
      if (!current(entity, version)) return;
      window.beginTurn(state().nextLivingEntity(entity.id));
    }, 100);
  }

  function pathToBite(entity, target) {
    // Клетка цели занята: строим путь до одной из четырёх свободных соседних.
    const paths = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => {
      const point = { x: target.position.x + dx, y: target.position.y + dy };
      if (!state().isFree(point) || !window.checkLOS(point, target.position)) return null;
      return window.buildPath(entity.position, point);
    }).filter(path => path !== null);
    paths.sort((a, b) => state().pathCost(a) - state().pathCost(b) || a.length - b.length);
    return paths[0] ?? null;
  }

  function runWolfAI(entity) {
    const version = state().turnVersion;
    // Блокировка действий игрока на всём ходу ИИ, включая паузы между укусами.
    state().isSkippingTurn = true;
    window.updatePanel();
    const done = () => runSkipAI(entity, version);
    const bite = entity.availableSpells.find(spell => spell.id === 'bite');
    if (window.isFrozen(entity) || !bite) { done(); return; }
    const enemies = state().entities.filter(target => target.hp > 0 && state().isAlly(target))
      .sort((a, b) => manhattan(entity.position, a.position) - manhattan(entity.position, b.position) || a.hp - b.hp);
    for (const target of enemies) {
      const path = pathToBite(entity, target);
      if (path === null) continue;
      aiMove(entity, path, target, version, () => aiBiteLoop(entity, bite, target, version, done));
      return;
    }
    done();
  }

  function aiMove(entity, path, target, version, onDone) {
    let index = 0;
    function step() {
      if (!current(entity, version)) return;
      if (target.hp <= 0 || !state().entities.includes(target) || window.isFrozen(entity)
        || manhattan(entity.position, target.position) === 1 || index >= path.length) { onDone(); return; }
      const next = path[index];
      const cost = state().entryCost(next);
      if (!state().isFree(next) || cost > entity.mp) { onDone(); return; }
      entity.position = { ...next };
      entity.mp -= cost;
      index++;
      window.renderPosition();
      window.updatePanel();
      // Последний шаг на соседнюю клетку тоже выполняется, а не отбрасывается.
      if (index < path.length && manhattan(entity.position, target.position) !== 1) {
        setTimeout(step, state().STEP_MS);
      } else onDone();
    }
    if (path.length) setTimeout(step, state().STEP_MS);
    else onDone();
  }

  function aiBiteLoop(entity, bite, target, version, onDone) {
    if (!current(entity, version)) return;
    if (!state().entities.includes(target) || target.hp <= 0 || window.isFrozen(entity)
      || entity.ap < bite.apCost || bite.usesThisTurn >= bite.maxUsesPerTurn || bite.cooldown > 0
      || manhattan(entity.position, target.position) !== 1 || !window.checkLOS(entity.position, target.position)) {
      onDone(); return;
    }
    aiCast(entity, bite, target, version, () => aiBiteLoop(entity, bite, target, version, onDone));
  }

  function aiCast(caster, spell, target, version, onDone) {
    caster.ap -= spell.apCost;
    spell.usesThisTurn++;
    if (spell.maxUsesPerBattle !== undefined) spell.usesTotal++;
    spell.cooldown = spell.maxCooldown;
    const cell = state().cells[target.position.y * state().SIZE + target.position.x];
    window.playBiteAnimation(cell);
    window.updatePanel();
    setTimeout(() => {
      if (!current(caster, version)) return;
      if (state().entities.includes(target) && target.hp > 0) {
        window.applySpellEffect(spell, target.position, caster, window.spellDeps);
        window.removeDefeatedEntities();
      }
      if (!current(caster, version)) return;
      window.updatePanel();
      onDone();
    }, 500);
  }
})();
