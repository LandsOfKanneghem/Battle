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

function createAttributes() {
  // Начальный VS равен нулю; расходуемый ES хранится отдельно от базовых характеристик.
  return {
    ra: 0, wp: 10, maxWP: 10, vs: 0,
    vit: 2, str: 2, att: 2, int: 2, wis: 2, cha: 2, luc: 2, ac: 0, physical: 0,
    resistances: { fire: 0, water: 0, air: 0, earth: 0, mind: 0, poison: 0 },
    acc: 100, sfc: 0, eva: 0, blo: 0, ini: 0
  };
}

// HP постоянен между ходами; AP и MP — расходуемые ресурсы хода.
const character = {
  attributes: { ...createAttributes(), str: 0, att: 1, cha: 1, luc: 0 },
  id: 'wizard', name: 'Волшебник', type: 'wizard', hp: 12, maxHP: 12, spells: [], elementalShields: [], states: [], spellsOnMe: [], baseES: 0, esBonuses: [], evaBonuses: [], baseInitiative: 0, initiative: 0,
  baseMaxAP: 6, maxAP: 6, ap: 6, baseMaxMP: 4, maxMP: 4, mp: 4,
  position: { x: 8, y: 8 }
};
function createWolf(id, position) {
  // У волков свои базовые характеристики; ресурсы и массивы эффектов независимы.
  return {
    attributes: { ...createAttributes(), wp: 4, maxWP: 4, vit: 1, str: 1, att: 1, int: 0, wis: 0, cha: 0, luc: 0 },
    id, name: 'Волк', type: 'wolf', hp: 6, maxHP: 6, spells: [], elementalShields: [],
    states: [], spellsOnMe: [], baseES: 0, esBonuses: [], evaBonuses: [], baseInitiative: 0, initiative: 0,
    baseMaxAP: 6, maxAP: 6, ap: 6, baseMaxMP: 5, maxMP: 5, mp: 5, position
  };
}
// Свободные стартовые клетки: без ящиков, глубоководья и союзников.
const wolf1 = createWolf('wolf-1', { x: 3, y: 4 });
const wolf2 = createWolf('wolf-2', { x: 7, y: 7 });
const wolf3 = createWolf('wolf-3', { x: 12, y: 5 });
const monk = {
  attributes: { ...createAttributes(), str: 0, att: 1, cha: 1, luc: 0 },
  id: 'monk', name: 'Монах', type: 'monk', hp: 12, maxHP: 12, spells: [], elementalShields: [], states: [], spellsOnMe: [], baseES: 0, esBonuses: [], evaBonuses: [], baseInitiative: 0, initiative: 0,
  baseMaxAP: 6, maxAP: 6, ap: 6, baseMaxMP: 4, maxMP: 4, mp: 4,
  position: { x: 7, y: 8 }
};
window.gameState.entities = [character, wolf1, wolf2, wolf3, monk];
// Порядок ходов не зависит от порядка хранения и удаления существ.
window.gameState.turnOrderIds = ['wizard', 'wolf-1', 'monk', 'wolf-2', 'wolf-3'];

window.gameState.activeEntityId = character.id;
window.gameState.costLabel.className = 'path-cost';

character.spells = WIZARD_SPELLS;
monk.spells = MONK_SPELLS;
// Стабильная сортировка сохраняет исходный порядок заклинаний внутри каждой школы.
const SCHOOL_ORDER = { fire: 0, water: 1, air: 2, earth: 3, body: 4, light: 5 };
character.spells.sort((a, b) => SCHOOL_ORDER[a.magicSchool] - SCHOOL_ORDER[b.magicSchool]);
monk.spells.sort((a, b) => SCHOOL_ORDER[a.magicSchool] - SCHOOL_ORDER[b.magicSchool]);
// Страницы содержат те же объекты: кулдауны и лимиты не зависят от открытой страницы.
character.spellPages = [character.spells.filter(spell => !spell.isElementalShield),
  character.spells.filter(spell => spell.isElementalShield)];
monk.spellPages = [monk.spells];

const wizard = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
wizard.setAttribute('viewBox', '0 0 40 40');
wizard.setAttribute('class', 'wizard');
wizard.setAttribute('role', 'img');
wizard.setAttribute('aria-label', 'Волшебник');
wizard.innerHTML = `
      <path d="M11 36 L15 20 L25 20 L30 36 Z" fill="#287dff" stroke="#102e70"/>
      <circle cx="20" cy="17" r="6" fill="#ffd6a0"/>
      <path d="M9 13 L20 2 L30 13 Z" fill="#ffdc36" stroke="#a77c00"/>
      <path d="M8 13 H32" stroke="#ffdc36" stroke-width="3"/>
      <circle cx="18" cy="17" r="1" fill="#20202b"/>
      <circle cx="23" cy="17" r="1" fill="#20202b"/>
      <path d="M17 22 L21 29 L25 22" fill="#f5f0df"/>
      <path d="M32 35 L34 20" stroke="#ce9b56" stroke-width="2"/>
      <circle cx="34" cy="19" r="2.5" fill="#86e8ff"/>`;

character.svg = wizard;
// Один рисунок, но отдельный SVG-элемент для каждого волка.
for (const wolf of [wolf1, wolf2, wolf3]) {
  wolf.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wolf.svg.setAttribute('viewBox', '0 0 40 40');
  wolf.svg.setAttribute('class', 'wolf');
  wolf.svg.setAttribute('role', 'img');
  wolf.svg.setAttribute('aria-label', wolf.name);
  wolf.svg.innerHTML = `
        <path d="M11 21 L3 12 L2 23 L10 28 Z" fill="#73818e" stroke="#344453"/>
        <path d="M10 22 Q17 16 28 21 L30 29 H10 Z" fill="#8e9ca8" stroke="#344453"/>
        <path d="M11 27 L10 36 H14 L16 27 M18 28 L18 36 H22 L23 27
                 M25 26 L26 36 H30 L29 26 M30 25 L32 35 H36 L34 24" fill="#73818e" stroke="#344453"/>
        <path d="M25 22 L25 7 L30 12 L35 6 L36 17 L39 21 L35 26 L28 25 Z" fill="#a8b5bf" stroke="#344453"/>
        <path d="M27 11 L27 15 L30 14 M33 13 L35 10 L35 15" fill="#dfb0ac"/>
        <path d="M27 22 L32 27 L35 24" fill="#d9e0e5"/>
        <circle cx="33" cy="18" r="1.2" fill="#eaca70"/>
        <path d="M37 20 L39 21 L37 23 Z" fill="#23323e"/>`;
}

monk.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
monk.svg.setAttribute('viewBox', '0 0 40 40');
monk.svg.setAttribute('class', 'monk');
monk.svg.setAttribute('role', 'img');
monk.svg.setAttribute('aria-label', monk.name);
monk.svg.innerHTML = `
      <path d="M10 37 L14 21 L26 21 L31 37 Z" fill="#b86028" stroke="#713c22"/>
      <path d="M15 22 L25 35 M25 22 L15 35" stroke="#e7a34a" stroke-width="3"/>
      <circle cx="20" cy="13" r="7" fill="#f1be8d"/>
      <circle cx="18" cy="13" r="1" fill="#30241e"/>
      <circle cx="23" cy="13" r="1" fill="#30241e"/>
      <path d="M12 27 L20 29 L28 27" fill="none" stroke="#f1be8d" stroke-width="3"/>
      <path d="M33 36 V10" stroke="#bc9159" stroke-width="2"/>`;

for (const id of window.gameState.turnOrderIds) {
  const entity = window.gameState.entities.find(item => item.id === id);
  if (!entity) continue;
  const slot = document.createElement('div');
  slot.className = 'turn-slot';
  slot.setAttribute('aria-label', entity.name);
  slot.appendChild(entity.svg.cloneNode(true));
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
