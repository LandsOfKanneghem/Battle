// Проверки заклинаний и превью: общий gameState, геометрия и расчёт урона.
// DOM и зависимости используются только при вызове; clearHighlight остаётся в index.html.

window.canPrepareSpell = function(spell) {
  const caster = window.gameState.activeEntity();
  return !!spell && !!caster && caster.hp > 0 && caster.availableSpells.includes(spell) && !window.gameState.isMoving && !window.gameState.isCasting && !window.gameState.isSkippingTurn && !window.isFrozen(caster)
    && caster.ap >= spell.apCost && spell.usesThisTurn < spell.maxUsesPerTurn
    && (spell.maxUsesPerBattle === undefined || spell.usesTotal < spell.maxUsesPerBattle)
    && spell.cooldown === 0;
};

// Supercover от центра до центра с исключением для углов при 45°. Сравниваем моменты
// пересечения границ целыми числами, без погрешностей float.
// ИИ может оценить будущую позицию, исключив самого себя из препятствий.
window.checkLOS = function(from, to, ignoredEntityId = null) {
  const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y);
  const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
  let x = from.x, y = from.y;
  let crossedX = 0, crossedY = 0;

  function blocked(cx, cy) {
    const key = `${cx},${cy}`;
    if (window.gameState.obstacles.get(key) === 'crate' || window.gameState.terrain.get(key) === 'void') return true;
    // Существо в исходной или целевой клетке не закрывает выстрел.
    if ((cx === from.x && cy === from.y) || (cx === to.x && cy === to.y)) return false;
    return window.gameState.entities.some(entity => entity.id !== ignoredEntityId
      && !window.gameState.isInvisible(entity) && entity.position.x === cx && entity.position.y === cy);
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
  return !!entity?.appliedEffects.some(effect => effect.isSkyShot && effect.duration > 0 && !effect.suppressed);
};

window.effectiveSpellRange = function(spell, caster = window.gameState.activeEntity()) {
  // RANGE и бонус следующего выстрела меняют только модифицируемую верхнюю границу.
  const skyBonus = spell.isShot && window.hasSkyShotBuff(caster) ? 2 : 0;
  return spell.modifiable
    ? Math.max(spell.minRange ?? 0, spell.range + window.getEffectiveStat(caster, 'ra') + skyBonus)
    : spell.range;
};

window.inSpellReach = function(target, spell) {
  const caster = window.gameState.activeEntity();
  if (!caster || !spell || !caster.availableSpells.includes(spell)) return false;
  const distance = Math.abs(target.x - caster.position.x) + Math.abs(target.y - caster.position.y);
  return target.x >= 0 && target.x < window.gameState.SIZE && target.y >= 0 && target.y < window.gameState.HEIGHT
    && window.gameState.terrain.get(window.gameState.keyOf(target)) !== 'void'
    // Даже без LOS ящик в самой целевой клетке остаётся недопустимым.
    && (spell.isHeal || !window.gameState.obstacles.has(window.gameState.keyOf(target)))
    && !((spell.isSummon || spell.isTeleport) && window.gameState.isWater(window.gameState.terrain.get(window.gameState.keyOf(target))))
    && distance >= (spell.isHeal ? 0 : (spell.minRange ?? 1)) && distance <= window.effectiveSpellRange(spell, caster)
    && (distance === 0 || spell.noLOS === true || (spell.isShot && window.hasSkyShotBuff(caster)) || window.checkLOS(caster.position, target));
};

window.canTarget = function(target, spell) {
  if (spell?.isTonguePull && !window.gameState.entities.some(entity => entity.hp > 0
    && window.gameState.keyOf(entity.position) === window.gameState.keyOf(target))) return false;
  if (spell?.isGlobal) {
    const caster = window.gameState.activeEntity();
    return !!caster && caster.availableSpells.includes(spell) && window.gameState.keyOf(target) === window.gameState.keyOf(caster.position);
  }
  // Доступность клетки не зависит от наличия существа: эффект
  // определяется отдельно при касте (в том числе лечение в пустоту).
  return window.inSpellReach(target, spell);
};

// Подходящая цель превью: сторона относительно кастера, без раскрытия невидимых врагов.
window.isSpellPreviewTarget = function(entity, spell, caster, center) {
  const state = window.gameState;
  if (!entity || entity.hp <= 0 || !caster || state.isHiddenFromPlayer(entity)
    || spell.isSummon || spell.isTeleport || spell.target === 'none') return false;
  const sameTeam = state.isAlly(entity) === state.isAlly(caster);
  if ((spell.target === 'ally' && !sameTeam) || (spell.target === 'enemy' && sameTeam)) return false;
  if (spell.isWindRose && Math.abs(entity.position.x - center.x) + Math.abs(entity.position.y - center.y) !== 1) return false;
  return true;
};

window.highlightSpellRange = function(center = null) {
  window.clearHighlight();
  const spell = window.gameState.activeEntity()?.availableSpells.find(item => item.id === window.gameState.preparedSpellId);
  if (!spell) return;
  // Зелёный фон — допустимые центры; голубая обводка — зона удара.
  for (let y = 0; y < window.gameState.HEIGHT; y++) for (let x = 0; x < window.gameState.SIZE; x++) {
    if (!window.canTarget({ x, y }, spell)) continue;
    const cell = window.gameState.cells[y * window.gameState.SIZE + x];
    // Дальность одинакова для всех заклинаний; размер зоны задаёт aoeSize.
    cell.classList.add('spell-range');
    window.gameState.rangeHighlightedCells.push(cell);
  }
  if (center && window.canTarget(center, spell)) {
    window.gameState.spellPreviewCenter = { ...center };
    // Превью строится по видимым существам; настоящий каст использует полный список.
    const previewEntities = window.gameState.entities.filter(entity => !window.gameState.isHiddenFromPlayer(entity));
    const area = window.affectedCells(center, spell, window.gameState.activeEntity(), previewEntities, window.gameState.obstacles, window.gameState.terrain, window.gameState.keyOf, window.gameState.SIZE, window.gameState.HEIGHT);
    for (const point of area) {
      const cell = window.gameState.cells[point.y * window.gameState.SIZE + point.x];
      cell.classList.add('spell-aoe');
      window.gameState.highlightedCells.push(cell);
    }
    window.drawSpellAreaOverlay(area, center);
    const keys = new Set(area.map(window.gameState.keyOf));
    for (const entity of previewEntities) {
      if (keys.has(window.gameState.keyOf(entity.position))
        && window.isSpellPreviewTarget(entity, spell, window.gameState.activeEntity(), center)) {
        entity.svg?.classList?.add('spell-target');
      }
    }
    window.highlightTorchChanges?.(area, spell, window.gameState.activeEntity());
    window.showEffectPreview(area, spell, center);
  }
};

window.showEffectPreview = function(area, spell, center = area[0]) {
  if (!window.altHeld) return;
  // Бейдж нужен только для урона; дальность и зона подсвечиваются отдельно.
  if (spell.damageBase === undefined && !(spell.damage > 0)) return;
  const caster = window.gameState.activeEntity();
  const baseDamage = window.getSpellDamage(spell, caster);
  const isNonSpell = spell.abilityType === 'ability' || spell.abilityType === 'weapon-strike';
  const mult = caster && ((spell.abilityType === 'spell' && window.hasActiveState(caster, 'exhaustion'))
    || (isNonSpell && window.hasActiveState(caster, 'weakness'))) ? 0.8 : 1;
  const dmgSpell = { ...spell, damage: Math.floor(baseDamage * mult) };
  const keys = new Set(area.map(window.gameState.keyOf));
  const primary = spell.isSparks ? window.gameState.entities.find(entity => window.gameState.keyOf(entity.position) === window.gameState.keyOf(center)) : null;
  for (const entity of window.gameState.entities) {
    if (entity.hp <= 0 || window.gameState.isHiddenFromPlayer(entity) || !keys.has(window.gameState.keyOf(entity.position))) continue;
    if (spell.isTonguePull && caster && window.gameState.isAlly(entity) === window.gameState.isAlly(caster)) continue;
    if (spell.target === 'enemy' && window.gameState.isAlly(entity)) continue;
    const badge = document.createElement('span');
    if (spell.isHealHarm && window.gameState.isAlly(entity)) {
      // Показываем только недостающее HP, включая +0 при полном здоровье.
      badge.className = 'effect-preview heal';
      badge.textContent = `+${Math.min(spell.healAmount, entity.maxHP - entity.hp)}`;
    } else {
      // Защита учитывается как в настоящем уроне; текущий HP не ограничивает превью.
      badge.className = 'effect-preview damage';
      // Отскок — половина уже уменьшенного урона, как и в applySpellEffect.
      const previewSpell = spell.isSparks && entity !== primary ? { ...dmgSpell, damage: Math.floor(dmgSpell.damage / 2) } : dmgSpell;
      const damage = window.spellDamage(previewSpell, entity);
      if (window.altHeld) {
        const hitChance = spell.isShot || spell.abilityType === 'weapon-strike' ? window.getHitChance(caster, entity) : 100;
        const critChance = window.getCritChance(spell, caster, entity);
        badge.classList.add('detailed-preview');
        // Крит пока не меняет урон: показываем то же итоговое значение после защит и ES.
        badge.textContent = `Урон: ${damage} [Крит: ${damage}]
Попадание: ${hitChance}%
Крит: ${critChance}%`;
      } else badge.textContent = `-${damage}`;
    }
    window.gameState.cells[entity.position.y * window.gameState.SIZE + entity.position.x].appendChild(badge);
    window.gameState.effectBadges.push(badge);
  }
  if (window.altHeld) window.layoutDetailedPreviews();
};

window.layoutDetailedPreviews = function() {
  const field = window.gameState.battlefield?.getBoundingClientRect?.();
  if (!field) return;
  const placed = [];
  for (const badge of window.gameState.effectBadges) {
    if (!badge.classList.contains('detailed-preview')) continue;
    const rect = badge.getBoundingClientRect();
    const clampX = x => Math.max(field.left + 2, Math.min(x, field.right - rect.width - 2));
    const clampY = y => Math.max(field.top + 2, Math.min(y, field.bottom - rect.height - 2));
    const xs = [rect.left, ...placed.flatMap(r => [r.left - rect.width - 4, r.right + 4])].map(clampX);
    const ys = [rect.top, ...placed.flatMap(r => [r.top - rect.height - 4, r.bottom + 4])].map(clampY);
    const candidates = xs.flatMap(x => ys.map(y => ({ left: x, top: y, right: x + rect.width, bottom: y + rect.height })));
    candidates.sort((a, b) => Math.hypot(a.left - rect.left, a.top - rect.top) - Math.hypot(b.left - rect.left, b.top - rect.top));
    const position = candidates.find(r => placed.every(p => r.right + 3 <= p.left || r.left >= p.right + 3 || r.bottom + 3 <= p.top || r.top >= p.bottom + 3)) ?? candidates[0];
    badge.style.transform = `translate(${position.left - rect.left}px, ${position.top - rect.top}px)`;
    placed.push(position);
  }
};

// Обводим только открытые стороны клеток: соседние клетки не создают внутренних линий.
window.getSpellAreaPaths = function(area, size = 48) {
  const cells = new Map(area.map(point => [`${point.x},${point.y}`, point]));
  const fill = [], outline = [];
  for (const { x, y } of cells.values()) {
    const left = x * size, top = y * size, right = left + size, bottom = top + size;
    fill.push(`M${left} ${top}H${right}V${bottom}H${left}Z`);
    if (!cells.has(`${x},${y - 1}`)) outline.push(`M${left} ${top}H${right}`);
    if (!cells.has(`${x + 1},${y}`)) outline.push(`M${right} ${top}V${bottom}`);
    if (!cells.has(`${x},${y + 1}`)) outline.push(`M${right} ${bottom}H${left}`);
    if (!cells.has(`${x - 1},${y}`)) outline.push(`M${left} ${bottom}V${top}`);
  }
  return { fill: fill.join(''), outline: outline.join('') };
};

window.drawSpellAreaOverlay = function(area, center) {
  if (!area.length) return;
  const state = window.gameState;
  const size = 48;
  const paths = window.getSpellAreaPaths(area, size);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spell-area-overlay');
  svg.setAttribute('viewBox', `0 0 ${state.SIZE * size} ${state.HEIGHT * size}`);
  svg.setAttribute('aria-hidden', 'true');
  const x = center.x * size + 6, y = center.y * size + 6, endX = x + size - 12, endY = y + size - 12;
  const marker = `M${x} ${y + 8}V${y}H${x + 8}M${endX - 8} ${y}H${endX}V${y + 8}`
    + `M${endX} ${endY - 8}V${endY}H${endX - 8}M${x + 8} ${endY}H${x}V${endY - 8}`;
  svg.innerHTML = `<path class="spell-area-fill" d="${paths.fill}"/>`
    + `<path class="spell-area-underlay" d="${paths.outline}"/>`
    + `<path class="spell-area-contour" d="${paths.outline}"/>`
    + `<path class="spell-area-marker-underlay" d="${marker}"/>`
    + `<path class="spell-area-marker" d="${marker}"/>`;
  state.aoeOverlay = svg;
  state.battlefield.appendChild(svg);
};
