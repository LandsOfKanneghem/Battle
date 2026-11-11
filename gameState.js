// Единый контейнер состояния: изменяемые значения хранятся только в его свойствах.
// Карта и существа заполняются в index.html; подключение идёт после разметки DOM.
window.gameState = {
  SIZE: 16,
  STEP_MS: 90,
  entities: [],
  cells: [],
  terrain: new Map(),
  obstacles: new Map(),
  turnOrderIds: [],
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
  highlightedCells: [],
  rangeHighlightedCells: [],
  effectBadges: [],
  previewKey: null,

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
  entryCost(point, entity = gameState.activeEntity()) {
    const terrain = gameState.terrain.get(gameState.keyOf(point));
    if (terrain === 'deep-water') {
      return entity && window.hasActiveState?.(entity, 'levitation') ? 1 : Infinity;
    }
    return { grass: 1, sand: 2 }[terrain] ?? Infinity;
  },
  pathCost: (path, entity = gameState.activeEntity()) => path.reduce((cost, point) => cost + gameState.entryCost(point, entity), 0),
  isFree: ({ x, y }, entity = gameState.activeEntity()) => x >= 0 && x < gameState.SIZE && y >= 0 && y < gameState.SIZE
    && Number.isFinite(gameState.entryCost({ x, y }, entity)) && gameState.obstacles.get(`${x},${y}`) !== 'crate'
    && !gameState.entities.some(other => other.id !== (entity?.id ?? gameState.activeEntityId)
      && other.position.x === x && other.position.y === y),
  activeEntity() {
    return gameState.entities.find(entity => entity.id === gameState.activeEntityId);
  },
  isAlly: entity => entity.type === 'wizard' || entity.type === 'monk',
  nextLivingEntity(afterId) {
    const index = gameState.turnOrderIds.indexOf(afterId);
    for (let offset = 1; offset <= gameState.turnOrderIds.length; offset++) {
      const id = gameState.turnOrderIds[(index + offset) % gameState.turnOrderIds.length];
      const entity = gameState.entities.find(item => item.id === id && item.hp > 0);
      if (entity) return entity;
    }
    return null;
  },
};
