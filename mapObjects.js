/* Shared map-object rules and torch lighting. Keep identical in Battle and MapEditor. */
((root) => {
  'use strict';
  const TYPES = Object.freeze({
    crate: { name: 'Ящик', category: 'massive', blocking: true, interactive: false },
    torch: { name: 'Горящий факел', category: 'small', lightRadius: 2, blocking: false, interactive: true },
    'unlit-torch': { name: 'Потухший факел', category: 'small', lightRadius: 0, blocking: false, interactive: true },
    'wall-torch': { name: 'Горящий настенный факел', category: 'small', lightRadius: 2, blocking: false, interactive: true },
    'unlit-wall-torch': { name: 'Потухший настенный факел', category: 'small', lightRadius: 0, blocking: false, interactive: true }
  });
  const isWallTorch = object => object?.type === 'wall-torch' || object?.type === 'unlit-wall-torch';
  const isTorch = object => isWallTorch(object) || object?.type === 'torch' || object?.type === 'unlit-torch';
  const isLit = object => isTorch(object) && TYPES[object.type].lightRadius > 0;
  const torchType = (object, lit) => isWallTorch(object) ? (lit ? 'wall-torch' : 'unlit-wall-torch') : (lit ? 'torch' : 'unlit-torch');
  const spriteName = object => isWallTorch(object) ? (isLit(object) ? 'wall-torch-top' : 'unlit-wall-torch-top') : object.type;
  const FACES = Object.freeze({ south: [0, 1], east: [1, 0], north: [0, -1], west: [-1, 0],
    'north-east': [1, -1], 'south-east': [1, 1], 'south-west': [-1, 1], 'north-west': [-1, -1] });
  const isVoid = tile => tile === 'void' || tile === 8;
  const inside = (map, x, y) => Number.isInteger(x) && Number.isInteger(y) && y >= 0 && y < map.tiles.length && x >= 0 && x < map.tiles[y].length;
  function wallMounts(map, x, y) {
    if (map.mapType !== 'underground' || !inside(map, x, y) || !isVoid(map.tiles[y][x])) return [];
    const open = (dx, dy) => inside(map, x + dx, y + dy) && !isVoid(map.tiles[y + dy][x + dx]);
    const mounts = [], joined = new Set();
    const add = (facing, kind) => {
      const [dx, dy] = FACES[facing];
      const offset = kind === 'concave' ? 24 : 27;
      mounts.push({ facing, kind, offsetX: dx * offset, offsetY: dy * offset,
        source: { x: x + dx, y: y + dy } });
    };
    for (const facing of ['north-east', 'south-east', 'south-west', 'north-west']) {
      const [dx, dy] = FACES[facing];
      if (!open(dx, dy)) continue;
      const horizontal = open(dx, 0), vertical = open(0, dy);
      if (horizontal && vertical) {
        add(facing, 'convex');
        joined.add(dx > 0 ? 'east' : 'west'); joined.add(dy > 0 ? 'south' : 'north');
      } else if (!horizontal && !vertical) add(facing, 'concave');
    }
    for (const facing of ['south', 'east', 'north', 'west']) {
      const [dx, dy] = FACES[facing];
      if (open(dx, dy) && !joined.has(facing)) add(facing, 'straight');
    }
    return mounts;
  }
  const wallFaces = (map, x, y) => wallMounts(map, x, y).map(mount => mount.facing);
  function wallMount(map, object) {
    const requested = FACES[object.facing];
    if (!requested) return null;
    const anchored = object.wallX !== undefined || object.wallY !== undefined;
    const mounts = wallMounts(map, anchored ? object.wallX : object.x, anchored ? object.wallY : object.y)
      .filter(mount => !anchored || (mount.source.x === object.x && mount.source.y === object.y));
    const exact = mounts.find(mount => mount.facing === object.facing);
    // Old cardinal placements snap to the new corner geometry, preserving their wall side.
    const score = mount => { const [dx, dy] = FACES[mount.facing]; return (dx * requested[0] + dy * requested[1]) / Math.hypot(dx, dy); };
    const selected = exact ?? mounts.filter(mount => score(mount) > 0).sort((a, b) => score(b) - score(a))[0];
    if (!selected) return null;
    if (selected.kind !== 'straight') return selected;
    const wallX = anchored ? object.wallX : object.x, wallY = anchored ? object.wallY : object.y;
    // A floor cell at an inside corner also adjoins two straight wall tiles.
    // Snap their visual mount to the corner, keeping the saved attachment and light source.
    const corners = floorMounts(map, selected.source.x, selected.source.y).filter(mount => mount.kind === 'concave');
    const distance = corner => Math.hypot((corner.wallX - wallX) * 48 + corner.offsetX - selected.offsetX,
      (corner.wallY - wallY) * 48 + corner.offsetY - selected.offsetY);
    corners.sort((a, b) => distance(a) - distance(b));
    const corner = corners[0];
    return corner ? { ...selected, kind: 'concave',
      offsetX: (corner.wallX - wallX) * 48 + corner.offsetX,
      offsetY: (corner.wallY - wallY) * 48 + corner.offsetY } : selected;
  }
  function floorMounts(map, x, y) {
    if (!inside(map, x, y) || isVoid(map.tiles[y][x])) return [];
    const mounts = Object.values(FACES).flatMap(([dx, dy]) => wallMounts(map, x - dx, y - dy)
      .filter(mount => mount.source.x === x && mount.source.y === y)
      .map(mount => ({ ...mount, wallX: x - dx, wallY: y - dy })));
    const corners = mounts.filter(mount => mount.kind === 'concave');
    return corners.length ? corners : mounts;
  }
  function canonicalObject(map, object) {
    const item = { type: object.type, x: object.x, y: object.y };
    if (isWallTorch(object)) {
      const mount = wallMount(map, object);
      if (!mount) throw new Error('Настенному факелу нужна соседняя стена.');
      Object.assign(item, mount.source, { wallX: object.wallX ?? object.x, wallY: object.wallY ?? object.y, facing: mount.facing });
    }
    return item;
  }
  function canPlace(map, object, mobs = [], except = null) {
    if (!TYPES[object.type] || !inside(map, object.x, object.y)) return false;
    if ((map.objects ?? []).some(other => other !== except && other.x === object.x && other.y === object.y
      && (TYPES[other.type]?.blocking || TYPES[object.type].blocking
        || (!isWallTorch(other) && !isWallTorch(object))
        || (isWallTorch(other) && isWallTorch(object) && other.wallX === object.wallX && other.wallY === object.wallY)))) return false;
    if (isWallTorch(object)) return !!wallMount(map, object);
    if (isVoid(map.tiles[object.y][object.x])) return false;
    return !TYPES[object.type].blocking || !mobs.some(mob => mob.x === object.x && mob.y === object.y);
  }
  function readObjects(saved, map, mobs = [], version = 7) {
    if (!Array.isArray(saved) || saved.length > map.tiles.length * map.tiles[0].length * 9) throw new Error('Неверный список объектов карты.');
    const result = [];
    for (const object of saved) {
      if (!object || !Object.hasOwn(TYPES, object.type)) throw new Error('Недостаточно данных для загрузки карты');
      const def = TYPES[object.type];
      if (object.blocking !== def.blocking || object.interactive !== (version >= 8 ? def.interactive : false)) throw new Error('Неверные свойства объекта.');
      if (version >= 8 && isWallTorch(object) && (!Number.isInteger(object.wallX) || !Number.isInteger(object.wallY))) throw new Error('Неверное крепление настенного факела.');
      const item = canonicalObject(map, version < 8 ? { type: object.type, x: object.x, y: object.y, facing: object.facing } : object);
      if (!canPlace({ ...map, objects: result }, item, mobs)) throw new Error('Недопустимое положение объекта.');
      result.push(item);
    }
    return result;
  }
  // Same supercover and exact-diagonal corner rule as Battle.checkLOS; only static blockers.
  function lightLOS(from, to, blocked) {
    const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y);
    const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
    let x = from.x, y = from.y, crossedX = 0, crossedY = 0;
    if (blocked(x, y)) return false;
    while (x !== to.x || y !== to.y) {
      const nextX = (2 * crossedX + 1) * dy, nextY = (2 * crossedY + 1) * dx;
      if (nextX === nextY) {
        if (dx !== dy && (blocked(x + sx, y) || blocked(x, y + sy))) return false;
        x += sx; y += sy; crossedX++; crossedY++;
      } else if (nextX < nextY) { x += sx; crossedX++; }
      else { y += sy; crossedY++; }
      if (blocked(x, y)) return false;
    }
    return true;
  }
  function illuminated(map) {
    const result = new Set(), massive = new Set((map.objects ?? []).filter(o => TYPES[o.type]?.blocking).map(o => `${o.x},${o.y}`));
    const blocked = (x, y) => !inside(map, x, y) || isVoid(map.tiles[y][x]) || massive.has(`${x},${y}`);
    for (const torch of map.objects ?? []) {
      const radius = TYPES[torch.type]?.lightRadius ?? 0;
      if (!radius) continue;
      const source = isWallTorch(torch) ? wallMount(map, torch)?.source : { x: torch.x, y: torch.y };
      if (!source) continue;
      for (let y = source.y - radius; y <= source.y + radius; y++) for (let x = source.x - radius; x <= source.x + radius; x++) {
        if (inside(map, x, y) && Math.abs(x - source.x) + Math.abs(y - source.y) <= radius && lightLOS(source, { x, y }, blocked)) result.add(`${x},${y}`);
      }
    }
    return result;
  }
  const api = Object.freeze({ TYPES, FACES, isWallTorch, isTorch, isLit, torchType, spriteName,
    wallFaces, wallMounts, wallMount, floorMounts, canonicalObject, canPlace, readObjects, lightLOS, illuminated });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MapObjects = api;
})(typeof window === 'undefined' ? globalThis : window);
