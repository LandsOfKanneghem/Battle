// Интерфейс игры: панели, страницы заклинаний и тултипы. Обычный скрипт window.*.
// gameState и функции других скриптов используются только при вызове обработчиков.

// Текущие тултипы и ключ кэша панели эффектов принадлежат UI.
let spellTooltip = null;
let spellTooltipIcon = null;
let effectPanelKey = null;
let effectTooltip = null;

window.getSpellPages = function(entity = window.gameState.activeEntity()) {
  return entity?.spellPages ?? [entity?.spells ?? []];
};

window.changeSpellPage = function(offset) {
  const pages = getSpellPages();
  if (window.gameState.isCasting || window.gameState.isMoving || window.gameState.selectedEntityId !== null || pages.length < 2) return;
  window.gameState.currentSpellPage = (window.gameState.currentSpellPage + offset + pages.length) % pages.length;
  // Подготовка и подсветка предыдущей страницы не должны оставаться после переключения.
  window.gameState.preparedSpellId = null;
  clearHighlight();
  renderSpellPanel(false);
  updatePanel();
};

window.hideSpellTooltip = function() {
  spellTooltip?.remove();
  spellTooltipIcon?.removeAttribute('aria-describedby');
  spellTooltip = null;
  spellTooltipIcon = null;
};

window.spellTurnLabel = function(n) {
  // Для нулевого кулдауна используем принятый в книге вариант «0 хода».
  const word = n === 0 ? 'хода' : n % 10 === 1 && n % 100 !== 11 ? 'ход'
    : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'хода' : 'ходов';
  return `${n} ${word}`;
};

window.showSpellTooltip = function(icon, spell) {
  hideSpellTooltip();
  const tooltip = document.createElement('div');
  tooltip.className = 'spell-tooltip';
  tooltip.id = 'spell-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  const title = document.createElement('strong');
  title.className = 'spell-title';
  title.textContent = spell.name;
  tooltip.appendChild(title);
  const description = document.createElement('p');
  description.className = 'spell-description';
  description.textContent = spell.description ?? 'NULL';
  tooltip.appendChild(description);
  const addLine = (label, value) => {
    const line = document.createElement('p');
    const caption = document.createElement('strong');
    caption.textContent = `${label}:`;
    line.append(caption, ` ${value}`);
    tooltip.appendChild(line);
  };
  addLine('ОД', spell.apCost);
  addLine('КД', spellTurnLabel(spell.maxCooldown));
  if (spell.maxUsesPerBattle !== undefined) addLine('Раз за бой', spell.maxUsesPerBattle);
  else addLine('Раз в ход', spell.maxUsesPerTurn);
  // Совпадающие границы показываем одним числом, сохраняя отметку изменяемости.
  const range = spell.minRange === undefined || spell.minRange === spell.range
    ? spell.range : `${spell.minRange}–${spell.range}`;
  addLine('Дальность', `${range} [${spell.modifiable ? 'изменяемая' : 'неизменяемая'}]`);
  const areaLabel = spell.isGlobal ? 'вся карта' : spell.isCone ? `конус D${spell.aoeSize}` : spell.aoeSize === 1 ? '1 клетка' : `квадрат D${spell.aoeSize}`;
  // Тип выстрела дополняет форму АОЕ, не меняя её и остальные строки тултипа.
  addLine('АОЕ', `${areaLabel}${spell.isShot ? ' [тип: Выстрел]' : ''}`);
  addLine('Цель', { any: 'любая', ally: 'союзник', enemy: 'враг' }[spell.target] ?? 'нет');
  addLine('LOS', spell.noLOS ? 'не требует' : 'требует');
  const elements = { fire: 'огонь', water: 'вода', earth: 'земля', air: 'воздух', light: 'свет' };
  if (spell.damage > 0) addLine('Урон', `${spell.damage} ${elements[spell.damageType] ?? spell.damageType}`);
  if (spell.isHeal) addLine('Лечение', spell.healAmount);
  const effects = [];
  if (spell.stateId) effects.push(stateTypes.get(spell.stateId)?.name ?? spell.stateId);
  if (spell.burnDuration) effects.push(stateTypes.get('burning').name);
  if (spell.isElementalShield) effects.push(spell.damageType === 'physical' ? `Блокирует ${spell.shieldAmount} ед. физического урона` : `Блокирует ${spell.shieldAmount} ед. урона ${{ fire: 'огнём', water: 'водой', earth: 'землёй', air: 'воздухом' }[spell.damageType]}`);
  if (spell.isSkyShot || spell.isWeaknessVigor) effects.push(spell.effectDescription);
  if (spell.isMembrane) effects.push(`+${spell.esAmount} ES, +${spell.evaAmount}% уклонения`);
  if (effects.length) {
    effects.forEach((effect, index) => {
      if (index === 0) addLine('Эффекты', effect);
      else { const line = document.createElement('p'); line.textContent = effect; tooltip.appendChild(line); }
    });
    addLine('Длительность', spell.isSkyShot ? '1 ход или до первого применения' : spellTurnLabel(spell.stateDuration ?? spell.shieldDuration ?? spell.effectDuration ?? spell.burnDuration));
  }
  document.body.appendChild(tooltip);
  // Предпочитаем свободную сторону; на узком экране — место сверху или снизу.
  const r = icon.getBoundingClientRect();
  let t = tooltip.getBoundingClientRect(), left, top;
  if (r.left >= t.width + 16) { left = r.left - t.width - 8; top = r.top; }
  else if (innerWidth - r.right >= t.width + 16) { left = r.right + 8; top = r.top; }
  else {
    const below = innerHeight - r.bottom - 16, above = r.top - 16;
    const useBelow = below >= above;
    tooltip.style.maxHeight = `${Math.max(0, useBelow ? below : above)}px`;
    t = tooltip.getBoundingClientRect();
    left = r.left;
    top = useBelow ? r.bottom + 8 : r.top - t.height - 8;
  }
  tooltip.style.left = `${Math.max(8, Math.min(left, innerWidth - t.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(top, innerHeight - t.height - 8))}px`;
  icon.setAttribute('aria-describedby', tooltip.id);
  spellTooltip = tooltip;
  spellTooltipIcon = icon;
};

// Ключ — объект, поэтому одноимённые кубы разных владельцев не пересекаются.
window.renderSpellPanel = function(resetPage = true) {
  if (resetPage) window.gameState.currentSpellPage = 0;
  hideSpellTooltip();
  document.getElementById('spells').replaceChildren();
  window.gameState.spellSlots.clear();
  const pages = getSpellPages();
  if (window.gameState.currentSpellPage >= pages.length) window.gameState.currentSpellPage = 0;
  const currentSpells = pages[window.gameState.currentSpellPage] ?? [];
  for (const spell of currentSpells) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'spell-slot';
    slot.innerHTML = spell.svg;
    slot.setAttribute('aria-label', spell.name);
    slot.addEventListener('mouseenter', () => showSpellTooltip(slot, spell));
    slot.addEventListener('mouseleave', hideSpellTooltip);
    slot.addEventListener('focus', () => showSpellTooltip(slot, spell));
    slot.addEventListener('blur', hideSpellTooltip);
    slot.addEventListener('click', () => {
      if (window.gameState.isCasting) return;
      if (!canPrepareSpell(spell)) return;
      hideSpellTooltip();
      window.gameState.preparedSpellId = spell.id;
      highlightSpellRange();
      updatePanel();
    });
    window.gameState.spellSlots.set(spell, slot);
    document.getElementById('spells').appendChild(slot);
  }
  for (let i = currentSpells.length; i < 16; i++) {
    const slot = document.createElement('div');
    slot.className = 'spell-slot';
    document.getElementById('spells').appendChild(slot);
  }

};

window.hideEffectTooltip = function() {
  effectTooltip?.remove();
  effectTooltip = null;
};

window.showEffectTooltip = function(icon, effect, kind = 'spell') {
  hideEffectTooltip();
  const tooltip = document.createElement('div');
  tooltip.className = 'effect-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  const title = document.createElement('strong');
  title.className = 'effect-title';
  title.textContent = effect.name ?? icon.getAttribute('aria-label') ?? 'Эффект';
  tooltip.appendChild(title);
  const n = kind === 'state' ? effect.duration : (effect.duration ?? effect.turnsLeft);
  const word = n % 10 === 1 && n % 100 !== 11 ? 'ход' :
    n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'хода' : 'ходов';
  // Для защиты выводим силу именно наложенного эффекта, а не шаблона заклинания.
  const spellDescription = effect.amount !== undefined
    ? effect.damageType === 'physical' ? `Блокирует ${effect.amount} ед. физического урона`
      : `Блокирует ${effect.amount} ед. урона стихии ${{ fire: 'огня', water: 'воды', earth: 'земли', air: 'воздуха' }[effect.damageType]}` : effect.description;
  const weaknessLocked = kind === 'state' && effect.id === 'weakness' && window.gameState.entities.some(entity =>
    entity.states.includes(effect) && window.hasActiveState(entity, 'adrenaline-crash'));
  const lines = kind === 'state'
    ? [effect.description, `Длительность: ${n} ${word}`,
      ...(effect.innate ? ['Врождённое'] : []), ...(effect.permanent ? ['Перманентное'] : []), ...(effect.unremovable || weaknessLocked ? [effect.id === 'weakness' ? 'Неснимаемая' : 'Неснимаемое'] : [])]
    : [spellDescription, `Длительность: ${n} ${word}${effect.isSkyShot ? ' или до первого применения' : ''}`,
      `Источник: ${effect.casterName ?? 'Неизвестно'}`];
  for (const text of lines) {
    const line = document.createElement('p');
    line.textContent = text;
    tooltip.appendChild(line);
  }
  document.body.appendChild(tooltip);
  // Сначала пробуем сбоку от иконки, на узком экране — снизу или сверху.
  const r = icon.getBoundingClientRect(), t = tooltip.getBoundingClientRect();
  let left, top;
  if (r.left - t.width >= 16) { left = r.left - t.width - 8; top = r.top; }
  else if (r.right + t.width + 16 <= innerWidth) { left = r.right + 8; top = r.top; }
  else { left = r.left; top = r.bottom + 8 + t.height <= innerHeight - 8 ? r.bottom + 8 : r.top - t.height - 8; }
  tooltip.style.left = `${scrollX + Math.max(8, Math.min(left, innerWidth - t.width - 8))}px`;
  tooltip.style.top = `${scrollY + Math.max(8, Math.min(top, innerHeight - t.height - 8))}px`;
  effectTooltip = tooltip;
};

window.renderEffectPanel = function() {
  const entity = window.gameState.entities.find(item => item.id === window.gameState.selectedEntityId);
  if (!entity) return;
  const effects = [...window.elementalShieldEffects(entity), ...entity.spellsOnMe]
    .sort((a, b) => (a.appliedOrder ?? 0) - (b.appliedOrder ?? 0));
  const key = JSON.stringify([entity.id, effects, entity.states]);
  // Не пересоздаём иконки на каждом mousemove: тултип остаётся стабильным.
  if (effectPanelKey === key) return;
  effectPanelKey = key;
  hideEffectTooltip();
  const spellEffects = document.getElementById('spell-effects');
  spellEffects.replaceChildren();
  const stateEffects = document.getElementById('state-effects');
  stateEffects.replaceChildren();
  for (const { effect, kind } of [
    ...effects.filter(item => item.sourceId).map(effect => ({ effect, kind: 'spell' })),
    ...entity.states.filter(state => !state.suppressed).map(effect => ({ effect, kind: 'state' }))
  ]) {
    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'spell-slot effect-icon';
    const sourceSpell = window.gameState.entities.flatMap(item => item.spells).find(item => item.id === effect.sourceId);
    const svg = effect.icon ?? effect.svg ?? sourceSpell?.svg;
    if (svg) icon.innerHTML = svg;
    else icon.textContent = '?';
    icon.setAttribute('aria-label', effect.name ?? sourceSpell?.name ?? effect.sourceId);
    icon.addEventListener('mouseenter', () => showEffectTooltip(icon, effect, kind));
    icon.addEventListener('mouseleave', hideEffectTooltip);
    icon.addEventListener('focus', () => showEffectTooltip(icon, effect, kind));
    icon.addEventListener('blur', hideEffectTooltip);
    (kind === 'state' ? stateEffects : spellEffects).appendChild(icon);
  }
};

window.selectEntity = function(id) {
  if (!window.gameState.entities.some(entity => entity.id === id && entity.hp > 0)) return;
  window.gameState.selectedEntityId = id;
  updatePanel();
};

window.updatePanel = function() {
  window.gameState.hoveredEntityId = window.gameState.queueHoveredEntityId ?? window.gameState.fieldHoveredEntityId;
  if (window.gameState.selectedEntityId !== null && !window.gameState.entities.some(entity => entity.id === window.gameState.selectedEntityId)) window.gameState.selectedEntityId = null;
  const displayed = window.gameState.entities.find(entity => entity.id === (window.gameState.selectedEntityId ?? window.gameState.hoveredEntityId ?? window.gameState.activeEntityId));
  const viewingEffects = window.gameState.selectedEntityId !== null;
  if (viewingEffects) hideSpellTooltip();
  const pages = getSpellPages();
  const hasSpells = pages.some(page => page.length > 0);
  document.getElementById('spells').hidden = viewingEffects || !hasSpells;
  window.gameState.spellPageControls.hidden = viewingEffects || !hasSpells;
  window.gameState.previousSpellPageButton.disabled = window.gameState.nextSpellPageButton.disabled = pages.length < 2 || window.gameState.isCasting || window.gameState.isMoving;
  document.getElementById('effects-panel').hidden = !viewingEffects;
  if (viewingEffects) renderEffectPanel();
  else { effectPanelKey = null; hideEffectTooltip(); }
  document.getElementById('character-name').textContent = displayed?.name ?? '—';
  document.getElementById('hp').textContent = displayed ? `HP: ${displayed.hp} / ${displayed.maxHP}` : '—';
  document.getElementById('ap').textContent = displayed ? `AP: ${displayed.ap} / ${displayed.maxAP}` : '—';
  document.getElementById('mp').textContent = displayed ? `MP: ${displayed.mp} / ${displayed.maxMP}` : '—';
  const attributes = displayed?.attributes;
  const writeAttribute = (id, text) => { document.getElementById(id).textContent = attributes ? text : '—'; };
  for (const key of ['ra', 'vs', 'es', 'vit', 'str', 'att', 'int', 'wis', 'cha', 'luc', 'ini']) {
    writeAttribute(key, `${key.toUpperCase()}: ${window.getEffectiveStat(displayed, key)}`);
  }
  writeAttribute('wp', `WP: ${window.getEffectiveStat(displayed, 'wp')} / ${window.getEffectiveStat(displayed, 'maxWP')}`);
  writeAttribute('acc', `ACC: ${window.getEffectiveStat(displayed, 'acc')}%`);
  writeAttribute('eva', `EVA: ${window.getEffectiveStat(displayed, 'eva')}% / ${attributes?.eva}`);
  writeAttribute('blo', `BLO: ${window.getEffectiveStat(displayed, 'blo')}% / ${window.getEffectiveStat(displayed, 'blo')}`);
  for (const [key, label] of Object.entries({ ac: 'Броня', physical: 'Физика', fire: 'Огонь', water: 'Вода', air: 'Воздух', earth: 'Земля', mind: 'Разум', poison: 'Яд' })) {
    const id = key === 'ac' ? 'ac' : `res-${key}`;
    // Броня и Физика — отдельные характеристики; физические защиты входят в physical.
    const value = window.getEffectiveStat(displayed, key === 'ac' || key === 'physical' ? key : `resistances.${key}`);
    writeAttribute(id, String(value));
    document.getElementById(id).parentElement.setAttribute('aria-label', attributes ? `${label}: ${value}` : `${label}: —`);
  }
  window.gameState.endTurnButton.disabled = !displayed || window.gameState.isMoving || window.gameState.isCasting || window.gameState.isSkippingTurn || window.isFrozen(window.gameState.activeEntity()) || ![character.id, monk.id].includes(window.gameState.activeEntityId);
  // Характеристики учитывают наведение, заклинания — только активного участника.
  for (const spell of window.gameState.activeEntity()?.spells ?? []) {
    const slot = window.gameState.spellSlots.get(spell);
    if (!slot) continue; // Доступность обновляем только у слотов открытой страницы.
    slot.disabled = !displayed || window.gameState.isCasting || !canPrepareSpell(spell);
    slot.classList.toggle('prepared', window.gameState.activeEntity()?.spells.includes(spell) && window.gameState.preparedSpellId === spell.id);
    slot.setAttribute('aria-pressed', window.gameState.activeEntity()?.spells.includes(spell) && window.gameState.preparedSpellId === spell.id ? 'true' : 'false');
  }
  for (const cell of window.gameState.cells) cell.classList.remove('entity-hover');
  for (const entity of window.gameState.entities) {
    const active = entity.id === window.gameState.activeEntityId;
    window.gameState.turnSlots.get(entity.id).classList.toggle('active', active);
    window.gameState.turnSlots.get(entity.id).setAttribute('aria-current', active ? 'true' : 'false');
    if (window.gameState.queueHoveredEntityId === entity.id) {
      window.gameState.cells[entity.position.y * window.gameState.SIZE + entity.position.x].classList.add('entity-hover');
    }
  }
};
