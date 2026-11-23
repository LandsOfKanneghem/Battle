// Те же 48×48 атласы, маски и порядок слоёв, что в MapEditor.
(() => {
  const TILE_SIZE = 48, COLUMNS = 12, ROWS = 12;
  const TERRAIN = Object.freeze({ grass: 0, sand: 1, 'deep-water': 2, dirt: 3, swamp: 4, 'shallow-water': 5,
    'monastery-floor': 6, 'cave-earth': 7, void: 8 });
  const landLayers = [
    { terrain: TERRAIN.dirt, image: 'dirt', level: 1 },
    { terrain: TERRAIN.swamp, image: 'swamp', level: 2 },
    { terrain: TERRAIN.sand, image: 'sand', level: 3 }
  ];
  const terrainLevels = [0, 3, 4, 1, 2, 4];
  const isWater = terrain => terrain === TERRAIN['deep-water'] || terrain === TERRAIN['shallow-water'];
  const MASKS = [0, 1, 4, 5, 7, 16, 17, 20, 21, 23, 28, 29, 31, 64, 65, 68, 69, 71, 80, 81, 84, 85, 87, 92, 93, 95, 112, 113, 116, 117, 119, 124, 125, 127, 193, 197, 199, 209, 213, 215, 221, 223, 241, 245, 247, 253, 255];
  const maskIndex = new Map(MASKS.map((mask, index) => [mask, index]));
  const neighbors = [[0, -1, 1], [1, -1, 2], [1, 0, 4], [1, 1, 8], [0, 1, 16], [-1, 1, 32], [-1, 0, 64], [-1, -1, 128]];

  let artwork;
  function loadArtwork() {
    return artwork ??= Promise.all(['base', 'sand', 'water', 'dirt', 'swamp', 'shallow-water', 'monastery-floor', 'cave-earth',
      'monastery-floor-edges', 'cave-earth-edges', 'wall-monastery', 'wall-dungeon'].map(name =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve([name, image]);
        image.onerror = () => reject(new Error('Не удалось загрузить графику поверхности.'));
        image.src = `assets/map-editor/terrain/${name}.png`;
      }))).then(Object.fromEntries);
  }

  // Готовим холст до замены текущего боя: ошибка загрузки ресурсов его не разрушает.
  window.createBattleTerrain = async function(tiles, mapType = 'surface', wallStyles = null, lighting = null) {
    const images = await loadArtwork();
    const map = tiles.map(row => row.map(name => TERRAIN[name]));
    const mapDocument = { mapType, tiles: map, wallStyles };
    const canvas = document.createElement('canvas');
    canvas.className = 'battle-terrain';
    canvas.width = COLUMNS * TILE_SIZE;
    canvas.height = ROWS * TILE_SIZE;
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    function normalizeMask(mask) {
      for (const [diagonal, a, b] of [[2, 1, 4], [8, 4, 16], [32, 16, 64], [128, 64, 1]]) {
        if (!(mask & a && mask & b)) mask &= ~diagonal;
      }
      return mask;
    }

    function terrainMask(x, y, level) {
      let mask = 0;
      for (const [dx, dy, bit] of neighbors) {
        // Continue the edge terrain visually; no cells exist outside the map.
        let terrain = map[Math.max(0, Math.min(ROWS - 1, y + dy))][Math.max(0, Math.min(COLUMNS - 1, x + dx))];
        if (mapType === 'underground' &&
            (terrain === TERRAIN.void || terrainLevels[terrain] === undefined)) terrain = map[y][x];
        if (terrainLevels[terrain] >= level) mask |= bit;
      }
      return normalizeMask(mask);
    }

    function drawBase(material, variant, x, y) {
      context.drawImage(images.base, variant * TILE_SIZE, material * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    function drawOverlay(layer, mask, x, y) {
      const index = maskIndex.get(mask);
      context.drawImage(images[layer], (index % 8) * TILE_SIZE, Math.floor(index / 8) * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    function wallInfo(x, y) {
      if (mapType !== 'underground' || !wallStyles || map[y][x] !== TERRAIN.void) return null;
      let mask = 0, inherited = null;
      // Same cardinal-first order as MapEditor when a wall has no explicit style.
      for (const [dx, dy, bit] of [[0,-1,1],[1,0,4],[0,1,16],[-1,0,64],
        [1,-1,2],[1,1,8],[-1,1,32],[-1,-1,128]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= COLUMNS || ny < 0 || ny >= ROWS || map[ny][nx] === TERRAIN.void) continue;
        mask |= bit;
        inherited ??= wallStyles[ny][nx];
      }
      return mask ? { mask, style: wallStyles[y][x] ?? inherited ?? 'monastery' } : null;
    }

    function drawCell(x, y) {
      const terrain = map[y][x];
      const variant = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 3;
      if (terrain === TERRAIN.void) {
        context.fillStyle = '#000';
        context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        const wall = wallInfo(x, y);
        if (wall) context.drawImage(window.UndergroundRenderer.wallTile(wall.style, wall.mask, images[`wall-${wall.style}`]),
          x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        return;
      }
      if (terrain === TERRAIN['monastery-floor'] || terrain === TERRAIN['cave-earth']) {
        drawFloor(x, y, terrain, variant);
        return;
      }
      drawBase(TERRAIN.grass, variant, x, y);
      // Matching land masks let each upper layer cover the lower ones cleanly.
      // Sand remains the last land layer, preserving the beach around all water.
      for (const layer of landLayers) {
        if (terrainLevels[terrain] < layer.level) continue;
        const mask = terrainMask(x, y, layer.level);
        if (mask === 255) drawBase(layer.terrain, variant, x, y);
        else drawOverlay(layer.image, mask, x, y);
      }
      if (isWater(terrain)) {
        const mask = terrainMask(x, y, 4);
        if (mask === 255) drawBase(terrain, variant, x, y);
        else drawOverlay(terrain === TERRAIN['deep-water'] ? 'water' : 'shallow-water', mask, x, y);
      }
    }

    function drawFloor(x, y, terrain, variant) {
      const name = terrain === TERRAIN['monastery-floor'] ? 'monastery-floor' : 'cave-earth';
      const underground = mapDocument.mapType === 'underground';
      // Underground floor cells stay completely filled, including at the void boundary.
      let mask = 0;
      for (const [dx, dy, bit] of neighbors) {
        const t = map[Math.max(0, Math.min(ROWS - 1, y + dy))][Math.max(0, Math.min(COLUMNS - 1, x + dx))];
        if (underground ? t !== TERRAIN['cave-earth'] : t === terrain) mask |= bit;
      }
      mask = normalizeMask(mask);
      if (underground && terrain === TERRAIN['cave-earth']) mask = 255;
      if (mask === 255) {
        context.drawImage(images[name], variant * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
          x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      } else {
        if (underground) context.drawImage(images['cave-earth'], variant * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
          x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        else drawBase(TERRAIN.grass, variant, x, y);
        drawOverlay(`${name}-edges`, mask, x, y);
      }
    }


    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLUMNS; x++) drawCell(x, y);
    // Apply light once to the completed original tile, as in MapEditor.
    const litCanvas = canvas.cloneNode();
    const lit = litCanvas.getContext('2d');
    lit.imageSmoothingEnabled = false;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLUMNS; x++) {
      lit.filter = `brightness(${window.BattleLighting.at(lighting, x, y)})`;
      lit.drawImage(canvas, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    return litCanvas;
  };
})();
