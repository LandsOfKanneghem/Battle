/* Shared map-object rules and static torch lighting. Keep identical in Battle and MapEditor. */
((root) => {
  'use strict';
  const TYPES = Object.freeze({
    crate: { name: 'Ящик', category: 'massive', blocking: true, interactive: false },
    torch: { name: 'Обычный факел', category: 'small', lightRadius: 2, blocking: false, interactive: false },
    'wall-torch': { name: 'Настенный факел', category: 'small', lightRadius: 2, blocking: false, interactive: false }
  });
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
    const mounts = wallMounts(map, object.x, object.y);
    const exact = mounts.find(mount => mount.facing === object.facing);
    if (exact) return exact;
    // Old cardinal placements snap to the new corner geometry, preserving their wall side.
    const score = mount => { const [dx, dy] = FACES[mount.facing]; return (dx * requested[0] + dy * requested[1]) / Math.hypot(dx, dy); };
    return mounts.filter(mount => score(mount) > 0).sort((a, b) => score(b) - score(a))[0] ?? null;
  }
  function canPlace(map, object, mobs = [], except = null) {
    if (!TYPES[object.type] || !inside(map, object.x, object.y)) return false;
    if ((map.objects ?? []).some(other => other !== except && other.x === object.x && other.y === object.y)) return false;
    if (object.type === 'wall-torch') return !!wallMount(map, object);
    if (isVoid(map.tiles[object.y][object.x])) return false;
    return !TYPES[object.type].blocking || !mobs.some(mob => mob.x === object.x && mob.y === object.y);
  }
  function readObjects(saved, map, mobs = []) {
    if (!Array.isArray(saved) || saved.length > map.tiles.length * map.tiles[0].length) throw new Error('Неверный список объектов карты.');
    const result = [];
    for (const object of saved) {
      if (!object || !Object.hasOwn(TYPES, object.type)) throw new Error('Недостаточно данных для загрузки карты');
      const def = TYPES[object.type];
      if (object.blocking !== def.blocking || object.interactive !== false) throw new Error('Неверные свойства объекта.');
      const item = { type: object.type, x: object.x, y: object.y };
      if (object.type === 'wall-torch') {
        item.facing = object.facing;
        const mount = wallMount(map, item);
        if (mount) item.facing = mount.facing;
      }
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
      const source = torch.type === 'wall-torch' ? wallMount(map, torch)?.source : { x: torch.x, y: torch.y };
      if (!source) continue;
      for (let y = source.y - radius; y <= source.y + radius; y++) for (let x = source.x - radius; x <= source.x + radius; x++) {
        if (inside(map, x, y) && Math.abs(x - source.x) + Math.abs(y - source.y) <= radius && lightLOS(source, { x, y }, blocked)) result.add(`${x},${y}`);
      }
    }
    return result;
  }
  const api = Object.freeze({ TYPES, FACES, wallFaces, wallMounts, wallMount, canPlace, readObjects, lightLOS, illuminated });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MapObjects = api;
})(typeof window === 'undefined' ? globalThis : window);
