// Загрузка карт MapEditor. Весь файл проверяется до изменения текущего боя.
(() => {
  const terrainTypes = new Set(['grass', 'sand', 'deep-water', 'shallow-water', 'dirt', 'swamp']);
  const objectTypes = new Set(['crate']);
  const teamOf = template => template.type === 'wizard' || template.type === 'monk' || template.isSummon ? 'ally' : 'enemy';

  window.validateBattleMap = function(data) {
    const state = window.gameState;
    if (data?.format !== 'kanneghem-map' || ![1, 2, 3, 4].includes(data.version)) {
      throw new Error('Неподдерживаемый формат или версия карты.');
    }
    if (data.width !== state.SIZE || data.height !== state.HEIGHT) throw new Error('Размер карты должен быть 12×12.');
    if (!Array.isArray(data.tiles) || data.tiles.length !== state.HEIGHT ||
        data.tiles.some(row => !Array.isArray(row) || row.length !== state.SIZE)) {
      throw new Error('Неверное количество строк или клеток карты.');
    }
    for (const row of data.tiles) for (const type of row) {
      if (!terrainTypes.has(type)) throw new Error('Недостаточно данных для загрузки карты');
    }
    const mobs = data.version === 1 ? [] : data.mobs;
    const objects = data.version < 3 ? [] : data.objects;
    if (!Array.isArray(mobs) || !Array.isArray(objects) || mobs.length + objects.length > state.SIZE * state.HEIGHT) {
      throw new Error('Неверный список существ или объектов карты.');
    }
    const occupied = new Set();
    const checkPosition = item => {
      if (!item || !Number.isInteger(item.x) || !Number.isInteger(item.y) ||
          item.x < 0 || item.x >= state.SIZE || item.y < 0 || item.y >= state.HEIGHT) {
        throw new Error('Неверные координаты существа или объекта.');
      }
      const key = state.keyOf(item);
      if (occupied.has(key)) throw new Error('На одной клетке не может быть несколько существ или объектов.');
      occupied.add(key);
    };
    const normalizedMobs = mobs.map(mob => {
      if (!mob || !Object.hasOwn(window.CREATURE_TEMPLATES, mob.type)) {
        throw new Error('Недостаточно данных для загрузки карты');
      }
      checkPosition(mob);
      const team = teamOf(window.CREATURE_TEMPLATES[mob.type]);
      if (data.version === 4 && mob.team !== team) throw new Error('Неверная сторона существа.');
      return { type: mob.type, team, x: mob.x, y: mob.y };
    });
    const normalizedObjects = objects.map(object => {
      if (!object || !objectTypes.has(object.type)) throw new Error('Недостаточно данных для загрузки карты');
      checkPosition(object);
      if (object.blocking !== true || object.interactive !== false) throw new Error('Неверные свойства препятствия.');
      return { type: object.type, x: object.x, y: object.y };
    });
    return { tiles: data.tiles.map(row => [...row]), mobs: normalizedMobs, objects: normalizedObjects };
  };

  function createTurnSlot(entity) {
    const state = window.gameState;
    const slot = document.createElement('div');
    slot.className = 'turn-slot';
    slot.setAttribute('aria-label', entity.name);
    slot.appendChild(entity.svg.cloneNode(true));
    slot.addEventListener('contextmenu', event => {
      event.preventDefault();
      window.selectEntity(entity.id);
    });
    slot.addEventListener('mouseenter', () => {
      state.queueHoveredEntityId = entity.id;
      window.updatePanel();
    });
    slot.addEventListener('mouseleave', () => {
      state.queueHoveredEntityId = null;
      window.updatePanel();
    });
    state.turnSlots.set(entity.id, slot);
    state.turnOrder.appendChild(slot);
  }

  window.startBattleFromMap = async function(data) {
    const map = window.validateBattleMap(data);
    const terrainCanvas = await window.createBattleTerrain(map.tiles);
    const state = window.gameState;
    // ИИ/заморозка проверяют turnVersion, касты/шаги — battleVersion.
    state.turnVersion++;
    state.battleVersion++;
    window.clearHighlight();
    window.hideSpellTooltip();
    window.hideEffectTooltip();
    document.querySelectorAll('.spell-projectile').forEach(projectile => projectile.remove());
    state.entities = [];
    window.turnQueue.reset();
    state.turnSlots.clear();
    state.turnOrder.replaceChildren();
    state.spellSlots.clear();
    state.cells = [];
    state.terrain.clear();
    state.obstacles.clear();
    state.activeEntityId = null;
    state.selectedEntityId = null;
    state.hoveredEntityId = null;
    state.fieldHoveredEntityId = null;
    state.queueHoveredEntityId = null;
    state.preparedSpellId = null;
    state.currentSpellPage = 0;
    state.effectOrder = 0;
    state.isMoving = false;
    state.isCasting = false;
    state.isSkippingTurn = false;
    state.stepQueue = [];
    state.battlefield.classList.remove('moving');
    state.battlefield.replaceChildren(terrainCanvas);
    const grid = document.createElement('div');
    grid.className = 'battle-grid';
    grid.setAttribute('aria-hidden', 'true');
    state.battlefield.appendChild(grid);
    document.getElementById('defeat-overlay').hidden = true;
    window.resetCreatureCounters();
    state.costLabel.className = 'path-cost';
    for (const object of map.objects) state.obstacles.set(state.keyOf(object), object.type);
    for (let y = 0; y < state.HEIGHT; y++) for (let x = 0; x < state.SIZE; x++) {
      const type = map.tiles[y][x];
      state.terrain.set(`${x},${y}`, type);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.dataset.terrain = type;
      if (state.isWater(type)) cell.classList.add('blocked');
      if (state.obstacles.has(`${x},${y}`)) {
        cell.classList.add('blocked');
        const image = document.createElement('img');
        image.className = 'obstacle';
        image.src = 'assets/map-editor/objects/crate.png';
        image.alt = 'Ящик';
        image.draggable = false;
        cell.appendChild(image);
      }
      state.cells.push(cell);
      state.battlefield.appendChild(cell);
    }
    for (const mob of map.mobs) {
      const creature = window.createCreature(mob.type, mob);
      state.entities.push(creature);
      createTurnSlot(creature);
    }
    window.battleLog?.reset();
    window.renderPosition();
    window.renderSpellPanel();
    window.updatePanel();
    if (state.entities.some(entity => state.isAlly(entity))) {
      window.beginTurn();
    } else window.showDefeatOverlay();
  };

  window.loadDefaultBattle = async function() {
    if (!window.DEFAULT_BATTLE_MAP) throw new Error('Не удалось загрузить maps/MAP 1.js.');
    await window.startBattleFromMap(window.DEFAULT_BATTLE_MAP);
  };
})();
