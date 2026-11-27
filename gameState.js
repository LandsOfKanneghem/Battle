// Единый контейнер состояния: изменяемые значения хранятся только в его свойствах.
// Карта и существа заполняются загрузчиком init.js; подключение идёт после разметки DOM.
window.gameState = {
  SIZE: 12, // Ширина поля и шаг строки в массиве cells.
  HEIGHT: 12,
  STEP_MS: 90,
  entities: [],
  cells: [],
  terrain: new Map(),
  mapType: 'surface',
  lighting: null,
  battleMap: null,
  mapObjects: [],
  obstacles: new Map(),
  turnOrderIds: [],
  roundNumber: 0,
  attackingTeam: 'ally', // По умолчанию атакует команда игрока.
  activeEntityId: null,
  isMoving: false,
  isCasting: false, // Блокировка действий до завершения визуального эффекта.
  isSkippingTurn: false, // В том числе последний ход самоналоженной Заморозки.
  preparedSpellId: null,
  selectedEntityId: null,
  hoveredEntityId: null,
  // Источники наведения разделены: очередь имеет приоритет над полем.
  fieldHoveredEntityId: null,
  queueHoveredEntityId: null,
  currentSpellPage: 0,
  effectOrder: 0, // Порядок наложения, независимый от номера хода.
  stepQueue: [],
  turnVersion: 0, // Защита от таймеров предыдущего хода.
  battleVersion: 0, // Загрузка карты отменяет действия предыдущего боя.
  highlightedCells: [],
  rangeHighlightedCells: [],
  effectBadges: [],
  previewKey: null,
  spellPreviewCenter: null,
  aoeOverlay: null,

  // DOM-ссылки и коллекции элементов интерфейса.
  battlefield: document.getElementById('battlefield'),
  turnOrder: document.getElementById('turn-order'),
  turnSlots: new Map(),
  endTurnButton: document.getElementById('end-turn'),
  spellPageControls: document.getElementById('spell-pages'),
  previousSpellPageButton: document.getElementById('spell-page-prev'),
  nextSpellPageButton: document.getElementById('spell-page-next'),
  spellSlots: new Map(),
  costLabel: document.createElement('span'),

  // Утилиты читают актуальные свойства контейнера, а не снимки при загрузке скрипта.
  keyOf: ({ x, y }) => `${x},${y}`,
  isWater: terrain => terrain === 'deep-water' || terrain === 'shallow-water',
  entryCost(point, entity = gameState.activeEntity()) {
    const terrain = gameState.terrain.get(gameState.keyOf(point));
    if (gameState.isWater(terrain)) {
      return entity && window.hasActiveState?.(entity, 'levitation') ? 1 : Infinity;
    }
    return { grass: 1, dirt: 1, 'monastery-floor': 1, 'cave-earth': 1, sand: 2, swamp: 2 }[terrain] ?? Infinity;
  },
  pathCost: (path, entity = gameState.activeEntity()) => path.reduce((cost, point) => cost + gameState.entryCost(point, entity), 0),
  isInvisible(entity) {
    return !!entity?.states && !!window.hasActiveState?.(entity, 'invisibility');
  },
  isHiddenFrom(entity, observer) {
    return !!entity && !!observer && gameState.isAlly(entity) !== gameState.isAlly(observer)
      && gameState.isInvisible(entity);
  },
  isHiddenFromPlayer(entity) {
    return !!entity && !gameState.isAlly(entity)
      && gameState.isInvisible(entity);
  },
  // Планирование игнорирует скрытых противников; физическая занятость клетки — никогда.
  isFree: ({ x, y }, entity = gameState.activeEntity(), ignoreHidden = false) => x >= 0 && x < gameState.SIZE && y >= 0 && y < gameState.HEIGHT
    && Number.isFinite(gameState.entryCost({ x, y }, entity)) && gameState.obstacles.get(`${x},${y}`) !== 'crate'
    && !gameState.entities.some(other => other.id !== (entity?.id ?? gameState.activeEntityId)
      && !(ignoreHidden && gameState.isHiddenFrom(other, entity))
      && other.position.x === x && other.position.y === y),
  activeEntity() {
    return gameState.entities.find(entity => entity.id === gameState.activeEntityId);
  },
  isAlly: entity => entity.isSummon === true || entity.team === 'ally'
    || (entity.team === undefined && ['wizard', 'monk', 'warrior', 'archer'].includes(entity.type)),
};
