// Чистая геометрия и выбор целей: все данные поля и существ передаются явно.
export function getConeCells(center, direction, SIZE) {
  const points = [];
  if (Math.abs(direction.x) + Math.abs(direction.y) !== 1) return points;
  for (let depth = 1; depth <= 3; depth++) {
    for (let offset = 1 - depth; offset < depth; offset++) {
      const x = center.x + direction.x * depth - direction.y * offset;
      const y = center.y + direction.y * depth + direction.x * offset;
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) points.push({ x, y, depth });
    }
  }
  return points;
}

export function getBlockedConeCells(coneCells, direction, entities, obstacles, keyOf) {
  const blocked = new Set();
  const axis = coneCells.find(point => point.depth === 1);
  if (!axis) return blocked;
  const offsetOf = point => (point.x - axis.x) * -direction.y + (point.y - axis.y) * direction.x;
  const shadows = new Set();
  for (const point of coneCells) {
    const crate = obstacles.get(keyOf(point)) === 'crate';
    const creature = entities.some(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(point));
    if (crate) blocked.add(keyOf(point)); // Ящики не получают урон и не входят в подсветку.
    if ((!crate && !creature) || point.depth === 3) continue;
    if (point.depth === 1) {
      // Ближайшее препятствие закрывает весь конус за собой: второй и третий ряды.
      for (const behind of coneCells) {
        if (behind.depth > 1) blocked.add(keyOf(behind));
      }
      continue;
    }
    const offset = offsetOf(point);
    // Из второго ряда блокируется только соответствующий сектор третьего.
    const sector = offset === 0 ? [-1, 0, 1]
      : offset < 0 ? [-2, -1] : [1, 2];
    for (const side of sector) shadows.add(side);
  }
  for (const point of coneCells) {
    if (point.depth === 3 && shadows.has(offsetOf(point))) blocked.add(keyOf(point));
  }
  return blocked;
}

export function findSparkTargets(primaryTarget, radius, count, entities) {
  if (!primaryTarget) return [];
  // Манхэттенская дистанция, затем угол по часовой стрелке: право → вниз → лево → верх.
  // LOS для отскоков не проверяется; источник тоже может оказаться среди целей.
  return entities.filter(entity => entity.hp > 0 && entity.id !== primaryTarget.id)
    .map(entity => {
      const dx = entity.position.x - primaryTarget.position.x;
      const dy = entity.position.y - primaryTarget.position.y;
      return { entity, distance: Math.abs(dx) + Math.abs(dy), angle: (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2) };
    })
    .filter(candidate => candidate.distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.angle - b.angle || a.entity.id.localeCompare(b.entity.id))
    .slice(0, count).map(candidate => candidate.entity);
}

export function affectedCells(center, spell, caster, entities, obstacles, terrain, keyOf, SIZE) {
  if (spell.isSparks) {
    const primary = entities.find(entity => entity.hp > 0 && keyOf(entity.position) === keyOf(center));
    return primary ? [primary, ...findSparkTargets(primary, spell.sparkRadius, spell.sparkCount, entities)].map(entity => entity.position) : [center];
  }
  if (spell.isCone) {
    if (!caster) return [];
    const direction = { x: center.x - caster.position.x, y: center.y - caster.position.y };
    const cone = getConeCells(caster.position, direction, SIZE);
    const blocked = getBlockedConeCells(cone, direction, entities, obstacles, keyOf);
    return cone.filter(point => !blocked.has(keyOf(point)));
  }
  const points = [];
  if (spell.isGlobal) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) points.push({ x, y });
    return points;
  }
  const radius = Math.floor(spell.aoeSize / 2);
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) points.push({ x, y });
    }
  }
  return points;
}
