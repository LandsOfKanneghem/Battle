// Проверки заклинаний и превью: общий gameState, геометрия и расчёт урона.
// DOM и зависимости используются только при вызове; clearHighlight остаётся в index.html.

window.canPrepareSpell = function(spell) {
  const caster = window.gameState.activeEntity();
  return !!spell && !!caster && caster.hp > 0 && caster.spells.includes(spell) && !window.gameState.isMoving && !window.gameState.isCasting && !window.gameState.isSkippingTurn && !window.isFrozen(caster)
    && caster.ap >= spell.apCost && spell.usesThisTurn < spell.maxUsesPerTurn
    && (spell.maxUsesPerBattle === undefined || spell.usesTotal < spell.maxUsesPerBattle)
    && spell.cooldown === 0;
};

// Supercover от центра до центра с исключением для углов при 45°. Сравниваем моменты
// пересечения границ целыми числами, без погрешностей float.
window.checkLOS = function(from, to) {
  const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y);
  const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
  let x = from.x, y = from.y;
  let crossedX = 0, crossedY = 0;

  function blocked(cx, cy) {
    if (window.gameState.obstacles.get(`${cx},${cy}`) === 'crate') return true;
    // Существо в исходной или целевой клетке не закрывает выстрел.
    if ((cx === from.x && cy === from.y) || (cx === to.x && cy === to.y)) return false;
    return window.gameState.entities.some(entity => entity.position.x === cx && entity.position.y === cy);
  }

  if (blocked(x, y)) return false;
  while (x !== to.x || y !== to.y) {
    const nextX = (2 * crossedX + 1) * dy;
    const nextY = (2 * crossedY + 1) * dx;
    if (nextX === nextY) {
      // Только при точных 45° разрешаем касание углов боковых клеток.
      // Диагональную клетку по-прежнему проверяем на препятствия.
      if (dx !== dy && (blocked(x + sx, y) || blocked(x, y + sy))) return false;
      x += sx;
      y += sy;
      crossedX++;
      crossedY++;
    } else if (nextX < nextY) {
      x += sx;
      crossedX++;
    } else {
      y += sy;
      crossedY++;
    }
    if (blocked(x, y)) return false;
  }
  return true;
};

window.hasSkyShotBuff = function(entity) {
  return !!entity?.spellsOnMe.some(effect => effect.isSkyShot && effect.duration > 0 && !effect.suppressed);
};

window.effectiveSpellRange = function(spell, caster = window.gameState.activeEntity()) {
  // RANGE и бонус следующего выстрела меняют только модифицируемую верхнюю границу.
  const skyBonus = spell.isShot && window.hasSkyShotBuff(caster) ? 2 : 0;
  return spell.modifiable
    ? Math.max(spell.minRange ?? 0, spell.range + (caster?.attributes.ra ?? 0) + skyBonus)
    : spell.range;
};

window.inSpellReach = function(target, spell) {
  const caster = window.gameState.activeEntity();
  if (!caster || !spell || !caster.spells.includes(spell)) return false;
  const distance = Math.abs(target.x - caster.position.x) + Math.abs(target.y - caster.position.y);
  return target.x >= 0 && target.x < window.gameState.SIZE && target.y >= 0 && target.y < window.gameState.SIZE
    // Даже без LOS ящик в самой целевой клетке остаётся недопустимым.
    && (spell.isHeal || !window.gameState.obstacles.has(window.gameState.keyOf(target)))
    && distance >= (spell.isHeal ? 0 : (spell.minRange ?? 1)) && distance <= window.effectiveSpellRange(spell, caster)
    && (distance === 0 || spell.noLOS === true || (spell.isShot && window.hasSkyShotBuff(caster)) || window.checkLOS(caster.position, target));
};

window.canTarget = function(target, spell) {
  if (spell?.isGlobal) {
    const caster = window.gameState.activeEntity();
    return !!caster && caster.spells.includes(spell) && window.gameState.keyOf(target) === window.gameState.keyOf(caster.position);
  }
  // Доступность клетки не зависит от наличия существа: эффект
  // определяется отдельно при касте (в том числе лечение в пустоту).
  return window.inSpellReach(target, spell);
};

window.highlightSpellRange = function(center = null) {
  window.clearHighlight();
  const spell = window.gameState.activeEntity()?.spells.find(item => item.id === window.gameState.preparedSpellId);
  if (!spell) return;
  // Зелёный фон — допустимые центры; голубая обводка — зона удара.
  for (let y = 0; y < window.gameState.SIZE; y++) for (let x = 0; x < window.gameState.SIZE; x++) {
    if (!window.canTarget({ x, y }, spell)) continue;
    const cell = window.gameState.cells[y * window.gameState.SIZE + x];
    // Дальность одинакова для всех заклинаний; размер зоны задаёт aoeSize.
    cell.classList.add('spell-range');
    window.gameState.rangeHighlightedCells.push(cell);
  }
  if (center && window.canTarget(center, spell)) {
    const area = window.affectedCells(center, spell, window.gameState.activeEntity(), window.gameState.entities, window.gameState.obstacles, window.gameState.terrain, window.gameState.keyOf, window.gameState.SIZE);
    for (const point of area) {
      const cell = window.gameState.cells[point.y * window.gameState.SIZE + point.x];
      cell.classList.add('spell-aoe');
      window.gameState.highlightedCells.push(cell);
    }
    window.showEffectPreview(area, spell, center);
  }
};

window.showEffectPreview = function(area, spell, center = area[0]) {
  // Бейдж нужен только для урона; дальность и зона подсвечиваются отдельно.
  if (!(spell.damage > 0)) return;
  const keys = new Set(area.map(window.gameState.keyOf));
  const primary = spell.isSparks ? window.gameState.entities.find(entity => window.gameState.keyOf(entity.position) === window.gameState.keyOf(center)) : null;
  for (const entity of window.gameState.entities) {
    if (entity.hp <= 0 || !keys.has(window.gameState.keyOf(entity.position))) continue;
    if (spell.enemyOnly && window.gameState.isAlly(entity)) continue;
    const badge = document.createElement('span');
    if (spell.isHealHarm && window.gameState.isAlly(entity)) {
      // Показываем только недостающее HP, включая +0 при полном здоровье.
      badge.className = 'effect-preview heal';
      badge.textContent = `+${Math.min(spell.healAmount, entity.maxHP - entity.hp)}`;
    } else {
      // Защита учитывается как в настоящем уроне; текущий HP не ограничивает превью.
      badge.className = 'effect-preview damage';
      const previewSpell = spell.isSparks && entity !== primary ? { ...spell, damage: Math.floor(spell.damage / 2) } : spell;
      badge.textContent = `-${window.spellDamage(previewSpell, entity)}`;
    }
    window.gameState.cells[entity.position.y * window.gameState.SIZE + entity.position.x].appendChild(badge);
    window.gameState.effectBadges.push(badge);
  }
};
