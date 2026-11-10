// Начальное заполнение gameState: карта, существа, спрайты, клетки и очередь.
// Выполняется после gameState.js; обработчики и первое обновление UI остаются в index.html.
// Полная карта поверхностей независима от ящиков.
for (let y = 0; y < window.gameState.SIZE; y++) for (let x = 0; x < window.gameState.SIZE; x++) {
  window.gameState.terrain.set(`${x},${y}`, x >= 9 && x <= 12 && y >= 5 && y <= 11 ? 'sand' : 'grass');
}
const waterCells = [[5,7], [5,8], [6,8], [10,12], [11,12]];
// Остров (14,14): восемь водных клеток делают его недоступным пешком.
for (let y = 13; y <= 15; y++) for (let x = 13; x <= 15; x++) {
  if (x !== 14 || y !== 14) waterCells.push([x, y]);
}
for (const [x,y] of waterCells) window.gameState.terrain.set(`${x},${y}`, 'deep-water');
window.gameState.obstacles = new Map([
  ['3,3', 'crate'], ['4,4', 'crate'], ['7,6', 'crate'],
  ['11,10', 'crate'], ['12,4', 'crate'], ['4,12', 'crate'], ['15,15', 'crate']
]);

const terrainArt = {
  grass: `<rect width="40" height="40" fill="#304c36"/><path d="M7 15 L5 10 M7 15 L9 8 M27 32 L25 26 M27 32 L30 24 M19 12 V7" stroke="#62825a" fill="none"/>`,
  sand: `<rect width="40" height="40" fill="#a18b59"/><path d="M5 12 Q10 9 15 12 M23 29 Q28 26 35 29" stroke="#d4bd82" fill="none"/><g fill="#77623b"><circle cx="25" cy="8" r="1"/><circle cx="10" cy="30" r="1"/><circle cx="20" cy="20" r="1"/></g>`,
  'deep-water': `<rect width="40" height="40" fill="#1251a0"/><path d="M3 10 Q7 6 11 10 T19 10 T27 10 T37 10 M3 21 Q7 17 11 21 T19 21 T27 21 T37 21 M3 32 Q7 28 11 32 T19 32 T27 32 T37 32" fill="none" stroke="#6ecfff" stroke-width="2"/>`
};
function createTerrain(type) {
  const layer = document.createElement('div');
  layer.className = 'terrain';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<svg viewBox="0 0 40 40" preserveAspectRatio="none">${terrainArt[type]}</svg>`;
  return layer;
}
function createObstacle() {
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('viewBox', '0 0 40 40');
  sprite.setAttribute('class', 'obstacle');
  sprite.setAttribute('role', 'img');
  sprite.setAttribute('aria-label', 'Ящик');
  sprite.innerHTML = `<rect x="4" y="4" width="32" height="32" rx="2" fill="#925c32" stroke="#d5a36a" stroke-width="2"/><path d="M6 13 H34 M6 26 H34" stroke="#57351e" stroke-width="2"/><path d="M7 7 L33 33 M33 7 L7 33" stroke="#d5a36a" stroke-width="4"/>`;
  return sprite;
}

// Порядок создания волков определяет их стабильные id в очереди.
const character = window.createCreature('wizard', { x: 8, y: 8 });
const wolf1 = window.createCreature('wolf', { x: 3, y: 4 });
const wolf2 = window.createCreature('wolf', { x: 7, y: 7 });
const wolf3 = window.createCreature('wolf', { x: 12, y: 5 });
const monk = window.createCreature('monk', { x: 7, y: 8 });
window.gameState.entities = [character, wolf1, wolf2, wolf3, monk];
// Порядок ходов не зависит от порядка хранения и удаления существ.
window.gameState.turnOrderIds = ['wizard', 'wolf-1', 'monk', 'wolf-2', 'wolf-3'];
// Свободная травяная клетка; общий цикл ниже создаёт слот и для великана.
const giant = window.createCreature('hill-giant', { x: 13, y: 2 });
window.gameState.entities.push(giant);
window.gameState.turnOrderIds.push(giant.id);

window.gameState.activeEntityId = character.id;
window.gameState.costLabel.className = 'path-cost';

for (const id of window.gameState.turnOrderIds) {
  const entity = window.gameState.entities.find(item => item.id === id);
  if (!entity) continue;
  const slot = document.createElement('div');
  slot.className = 'turn-slot';
  slot.setAttribute('aria-label', entity.name);
  const queueSprite = entity.svg.cloneNode(true);
  if (entity.type === 'hill-giant') {
    queueSprite.style.position = 'static';
    queueSprite.style.inset = 'auto';
  }
  slot.appendChild(queueSprite);
  window.gameState.turnSlots.set(entity.id, slot);
  window.gameState.turnOrder.appendChild(slot);
}

for (let y = 0; y < window.gameState.SIZE; y++) {
  for (let x = 0; x < window.gameState.SIZE; x++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.x = x;
    cell.dataset.y = y;
    cell.dataset.terrain = window.gameState.terrain.get(`${x},${y}`);
    cell.appendChild(createTerrain(cell.dataset.terrain));
    if (cell.dataset.terrain === 'deep-water') cell.classList.add('blocked');
    const type = window.gameState.obstacles.get(`${x},${y}`);
    if (type) {
      cell.classList.add('blocked');
      cell.appendChild(createObstacle(type));
    }
    window.gameState.battlefield.appendChild(cell);
    window.gameState.cells.push(cell);
  }
}
