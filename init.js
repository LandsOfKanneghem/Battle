// Загрузка карт MapEditor. Весь файл проверяется до изменения текущего боя.
(() => {
  const terrainTypes = new Set(['grass', 'sand', 'deep-water', 'shallow-water', 'dirt', 'swamp',
    'monastery-floor', 'cave-earth', 'void']);
  const mapTypes = new Set(['surface', 'underground']);
  const wallTypes = new Set(['monastery', 'dungeon']);
  const teamOf = template => ['wizard', 'monk', 'warrior'].includes(template.type) || template.isSummon ? 'ally' : 'enemy';

  window.validateBattleMap = function(data) {
    const state = window.gameState;
    if (data?.format !== 'kanneghem-map' || ![1, 2, 3, 4, 5, 6, 7, 8].includes(data.version)) {
      throw new Error('Неподдерживаемый формат или версия карты.');
    }
    if (data.width !== state.SIZE || data.height !== state.HEIGHT) throw new Error('Размер карты должен быть 12×12.');
    const mapType = data.version >= 6 ? data.mapType : data.version === 5 ? data.activeLevel : 'surface';
    if (!mapTypes.has(mapType)) throw new Error('Неизвестный тип карты.');
    const content = data.version === 5 ? data.levels?.[mapType] : data;
    if (!Array.isArray(content?.tiles) || content.tiles.length !== state.HEIGHT ||
        content.tiles.some(row => !Array.isArray(row) || row.length !== state.SIZE)) {
      throw new Error('Неверное количество строк или клеток карты.');
    }
    for (const row of content.tiles) for (const type of row) {
      if (!terrainTypes.has(type)) throw new Error('Недостаточно данных для загрузки карты');
      if (mapType === 'surface' && type === 'void') throw new Error('Пустота допустима только под землёй.');
    }
    let wallStyles = null;
    if (mapType === 'underground') {
      if (!Array.isArray(content.wallStyles) || content.wallStyles.length !== state.HEIGHT ||
          content.wallStyles.some(row => !Array.isArray(row) || row.length !== state.SIZE ||
            row.some(style => style !== null && !wallTypes.has(style)))) {
        throw new Error('Неверные стили стен подземелья.');
      }
      wallStyles = content.wallStyles.map(row => [...row]);
    }
    const mobs = data.version === 1 ? [] : content.mobs;
    const objects = data.version < 3 ? [] : content.objects;
    if (!Array.isArray(mobs) || !Array.isArray(objects) || (mobs.length > state.SIZE * state.HEIGHT || objects.length > state.SIZE * state.HEIGHT * 9)) {
      throw new Error('Неверный список существ или объектов карты.');
    }
    const occupied = new Set();
    const checkPosition = item => {
      if (!item || !Number.isInteger(item.x) || !Number.isInteger(item.y) ||
          item.x < 0 || item.x >= state.SIZE || item.y < 0 || item.y >= state.HEIGHT) {
        throw new Error('Неверные координаты существа или объекта.');
      }
      const key = state.keyOf(item);
      if (content.tiles[item.y][item.x] === 'void') throw new Error('Существо или объект не может находиться в пустоте.');
      if (occupied.has(key)) throw new Error('На одной клетке не может быть несколько существ или объектов.');
      occupied.add(key);
    };
    const normalizedMobs = mobs.map(savedMob => {
      const mob = savedMob?.type === 'alligator-snapping-turtle'
        ? { ...savedMob, type: 'dragon-turtle' } : savedMob;
      if (!mob || !Object.hasOwn(window.CREATURE_TEMPLATES, mob.type)) {
        throw new Error('Недостаточно данных для загрузки карты');
      }
      checkPosition(mob);
      const team = data.version >= 4 ? mob.team : teamOf(window.CREATURE_TEMPLATES[mob.type]);
      if (!['ally', 'enemy'].includes(team) || (['wizard', 'monk', 'warrior'].includes(mob.type) && team !== 'ally'))
        throw new Error('Неверная сторона существа.');
      return { type: mob.type, team, x: mob.x, y: mob.y };
    });
    const normalizedObjects = window.MapObjects.readObjects(objects, { mapType, tiles: content.tiles }, normalizedMobs, data.version);
    const lighting = window.BattleLighting.read(content.lighting);
    if (normalizedObjects.some(object => !window.MapObjects.TYPES[object.type].blocking)) {
      lighting.torchCells = window.MapObjects.illuminated({ mapType, tiles: content.tiles, objects: normalizedObjects });
    }
    return { mapType, wallStyles, lighting, tiles: content.tiles.map(row => [...row]), mobs: normalizedMobs, objects: normalizedObjects };
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
    const terrainCanvas = await window.createBattleTerrain(map.tiles, map.mapType, map.wallStyles, map.lighting);
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
    state.mapType = map.mapType;
    state.battleMap = map;
    state.mapObjects = map.objects;
    state.lighting = map.lighting;
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
    for (const object of map.objects) if (window.MapObjects.TYPES[object.type].blocking) state.obstacles.set(state.keyOf(object), object.type);
    for (let y = 0; y < state.HEIGHT; y++) for (let x = 0; x < state.SIZE; x++) {
      const type = map.tiles[y][x];
      state.terrain.set(`${x},${y}`, type);
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.dataset.terrain = type;
      if (type === 'void') state.obstacles.set(`${x},${y}`, 'void');
      if (state.isWater(type) || type === 'void') cell.classList.add('blocked');
      if (state.obstacles.get(`${x},${y}`) === 'crate') {
        cell.classList.add('blocked');
        const image = document.createElement('img');
        image.className = 'obstacle';
        image.src = 'assets/map-editor/objects/crate.png';
        image.alt = 'Ящик';
        image.draggable = false;
        image.style.setProperty('--entity-lighting', window.BattleLighting.at(map.lighting, x, y));
        cell.appendChild(image);
      }
      state.cells.push(cell);
      state.battlefield.appendChild(cell);
    }
    for (const object of map.objects.filter(object => !window.MapObjects.TYPES[object.type].blocking)) {
      const image = document.createElement('img');
      image.className = 'small-map-object';
      image.src = `assets/map-editor/objects/${window.MapObjects.spriteName(object)}.png`;
      image.alt = window.MapObjects.TYPES[object.type].name;
      image.draggable = false;
      const mount = window.MapObjects.isWallTorch(object) ? window.MapObjects.wallMount(map, object) : null;
      image.style.left = `${(mount ? object.wallX : object.x) * 48 + (mount?.offsetX ?? 0)}px`;
      image.style.top = `${(mount ? object.wallY : object.y) * 48 + (mount?.offsetY ?? 0)}px`;
      image.dataset.mountKind = mount?.kind ?? '';
      image.dataset.mountFacing = mount?.facing ?? '';
      image.dataset.x = object.x;
      image.dataset.y = object.y;
      image.dataset.type = object.type;
      object.element = image;
      state.battlefield.appendChild(image);
    }
    window.refreshTorchLighting();
    for (const mob of map.mobs) {
      const creature = window.createCreature(mob.type, mob);
      creature.team = mob.team;
      if (mob.team === 'ally') delete creature.ai;
      state.entities.push(creature);
      createTurnSlot(creature);
    }
    window.preparePartyOrder(state.entities);
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
