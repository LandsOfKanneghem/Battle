// Интерфейс игры: панели, страницы заклинаний и тултипы. Обычный скрипт window.*.
// gameState и функции других скриптов используются только при вызове обработчиков.

// Текущие тултипы и ключ кэша панели эффектов принадлежат UI.
window.SUMMON_TIME_ICON = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#1a1e24" stroke="#a9b1bf" stroke-width="2"/><path d="M20 8 V20 L27 24" fill="none" stroke="#ffdc36" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="20" r="2" fill="#ffdc36"/></svg>`;

let spellTooltip = null;
window.spellTooltipIcon = null;
window.spellTooltipSpell = null;
window.shiftHeld = false;
let effectPanelKey = null;
let effectTooltip = null;

window.getSpellPages = function(entity = window.gameState.activeEntity()) {
  return entity?.spellPages ?? [entity?.availableSpells ?? []];
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
  window.spellTooltipIcon?.removeAttribute('aria-describedby');
  spellTooltip = null;
  window.spellTooltipIcon = null;
  window.spellTooltipSpell = null;
};

window.spellTurnLabel = function(n) {
  // Для нулевого кулдауна используем принятый в книге вариант «0 хода».
  const word = n === 0 ? 'хода' : n % 10 === 1 && n % 100 !== 11 ? 'ход'
    : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'хода' : 'ходов';
  return `${n} ${word}`;
};

window.showSpellTooltip = function(icon, spell) {
  hideSpellTooltip();
  const caster = window.gameState.activeEntity();
  const tooltip = document.createElement('div');
  tooltip.className = 'spell-tooltip';
  tooltip.id = 'spell-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  const title = document.createElement('strong');
  title.className = 'spell-title';
  title.textContent = spell.name;
  tooltip.appendChild(title);
  if (spell.description) {
    const description = document.createElement('p');
    description.className = 'spell-description';
    description.textContent = spell.description;
    tooltip.appendChild(description);
  }
  const addLine = (label, value, color) => {
    const line = document.createElement('p');
    const caption = document.createElement('strong');
    caption.textContent = `${label}:`;
    if (color === undefined) line.append(caption, ` ${value}`);
    else {
      const span = document.createElement('span');
      span.textContent = value;
      span.style.color = color;
      line.append(caption, ' ', span);
    }
    tooltip.appendChild(line);
  };
  const typeName = spell.abilityType === 'weapon-strike' ? 'Атака оружием'
    : spell.abilityType === 'ability' ? 'Способность' : 'Заклинание';
  const schoolNames = { fire: 'Огонь', water: 'Вода', air: 'Воздух', earth: 'Земля',
    body: 'Тело', light: 'Свет', dark: 'Тьма' };
  const schoolLabel = spell.magicSchool ? ` [${schoolNames[spell.magicSchool] ?? spell.magicSchool}]` : '';
  addLine('Тип', `${typeName}${schoolLabel}`);
  addLine('ОД', spell.apCost);
  const elements = { fire: 'огонь', water: 'вода', earth: 'земля', air: 'воздух', light: 'свет', physical: 'физический' };
  if (spell.damageBase !== undefined || spell.damage > 0) {
    const damage = window.getSpellDamage(spell, caster);
    const isNonSpell = spell.abilityType === 'ability' || spell.abilityType === 'weapon-strike';
    const hasDebuff = caster && ((spell.abilityType === 'spell' && window.hasActiveState(caster, 'exhaustion'))
      || (isNonSpell && window.hasActiveState(caster, 'weakness')));
    const mult = hasDebuff ? 0.8 : 1;
    const finalDamage = Math.floor(damage * mult);
    if (finalDamage > 0) {
      const showFormula = window.shiftHeld && spell.damageBase !== undefined;
      const damageText = showFormula ? `${spell.damageBase} + ${spell.damagePerInt ?? 0}*INT`
        : `${finalDamage} ${elements[spell.damageType] ?? spell.damageType}`;
      const isDamageModifiable = spell.damageBase !== undefined;
      const damageColor = showFormula ? '' : !isDamageModifiable ? '' : hasDebuff ? '#ff4d4d' : '#4ade80';
      addLine('Урон', damageText, damageColor);
    }
  }
  if (spell.isHealHarm) addLine('Лечение', spell.healAmount);
  if (spell.isSummon) {
    addLine('Призыв', spell.name);
    addLine('Длительность', spellTurnLabel(window.getSpellDuration(spell, caster)));
  }
  const effects = [];
  let effectColor;
  if (spell.isHealHarm) effects.push('Кровотечение [враг] / Снимает 1 стак кровотечения [союз]');
  else if (spell.effectDescription) effects.push(spell.effectDescription);
  else if (spell.stateId) effects.push(stateTypes.get(spell.stateId)?.name ?? spell.stateId);
  if (spell.appliesBurning) effects.push(stateTypes.get('burning').name);
  if (spell.isElementalShield) {
    const shieldAmount = Math.floor(spell.shieldAmount + (spell.effectValuePerLvl ?? 0) * (caster?.level ?? 1));
    const shieldText = window.shiftHeld ? `${spell.shieldAmount} + ${spell.effectValuePerLvl ?? 0}*LVL` : shieldAmount;
    effects.push(spell.damageType === 'physical' ? `Блокирует ${shieldText} ед. физического урона` : `Блокирует ${shieldText} ед. урона ${{ fire: 'огнём', water: 'водой', earth: 'землёй', air: 'воздухом' }[spell.damageType]}`);
    if (!window.shiftHeld && shieldAmount > spell.shieldAmount) effectColor = '#4ade80';
  }
  if (spell.isMembrane) {
    const esAmount = Math.floor(spell.esAmount + (spell.effectValuePerLvl ?? 0) * (caster?.level ?? 1));
    const esText = window.shiftHeld ? `${spell.esAmount} + ${spell.effectValuePerLvl ?? 0}*LVL` : esAmount;
    effects.push(`+${esText} ES, +${spell.evaAmount}% уклонения`);
    if (!window.shiftHeld && esAmount > spell.esAmount) effectColor = '#4ade80';
  }
  if (spell.isMpBuff) effects.push(`+${spell.mpAmount} MP`);
  if (effects.length) {
    effects.forEach((effect, index) => {
      if (index === 0) addLine('Эффекты', effect, effectColor);
      else { const line = document.createElement('p'); line.textContent = effect; tooltip.appendChild(line); }
    });
    const duration = window.getSpellDuration(spell, caster);
    if (spell.isHealHarm) addLine('Длительность', `${spell.bleedDuration} [враг]`);
    else if (spell.isSkyShot) addLine('Длительность', '1 ход или до первого применения');
    else if (spell.durationBase !== undefined) {
      const showFormula = window.shiftHeld && (spell.durationPerInt ?? 0) !== 0;
      const durationText = showFormula ? `${spell.durationBase} + ${spell.durationPerInt ?? 0}*INT`
        : spellTurnLabel(duration);
      const baseDuration = spell.durationBase;
      const durationColor = window.shiftHeld ? '' : duration > baseDuration ? '#4ade80' : duration < baseDuration ? '#ff4d4d' : '';
      addLine('Длительность', durationText, durationColor);
    } else if (spell.bleedDuration !== undefined) addLine('Длительность', spellTurnLabel(spell.bleedDuration));
  }
  addLine('КД', spellTurnLabel(spell.maxCooldown));
  if (spell.maxUsesPerBattle !== undefined) {
    addLine('Раз за бой', spell.maxUsesPerBattle);
  } else if (spell.maxUsesPerTurn > 1) {
    addLine('Раз в ход', spell.maxUsesPerTurn);
  }
  const finalRange = spell.modifiable && caster ? window.effectiveSpellRange(spell, caster) : spell.range;
  // Минимальную границу сохраняем в обоих режимах; Shift использует базовый максимум.
  const baseRangeText = spell.minRange === undefined || spell.minRange === spell.range
    ? spell.range : `${spell.minRange}–${spell.range}`;
  const range = window.shiftHeld ? baseRangeText
    : spell.minRange === undefined || spell.minRange === finalRange ? finalRange : `${spell.minRange}–${finalRange}`;
  const rangeColor = window.shiftHeld || !spell.modifiable ? ''
    : finalRange > spell.range ? '#4ade80' : finalRange < spell.range ? '#ff4d4d' : '';
  addLine('Дальность', `${range} [${spell.modifiable ? 'изменяемая' : 'неизменяемая'}]`, rangeColor);
  const areaLabel = spell.isGlobal ? 'вся карта' : spell.isCone ? `конус D${spell.aoeSize}` : spell.isDiamond ? `ромб D${spell.aoeSize}` : spell.aoeSize === 1 ? '1 клетка' : `квадрат D${spell.aoeSize}`;
  // Тип атаки дополняет форму АОЕ.
  const typeLabel = spell.isShot ? ' [тип: Выстрел]' : spell.isHit ? ' [тип: Удар]' : '';
  addLine('АОЕ', `${areaLabel}${typeLabel}`);
  addLine('Цель', { any: 'любая', ally: 'союзник', enemy: 'враг', none: 'нет' }[spell.target] ?? 'нет');
  addLine('LOS', spell.noLOS ? 'не требует' : 'требует');
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
  window.spellTooltipIcon = icon;
  window.spellTooltipSpell = spell;
};

// Обновляем только бейдж, сохраняя сам слот, фокус и обработчики тултипа.
function updateCooldownBadge(slot, spell) {
  let badge = slot.querySelector('.cooldown-badge');
  if (!(spell.cooldown > 0)) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'cooldown-badge';
    badge.setAttribute('aria-hidden', 'true');
    slot.appendChild(badge);
  }
  badge.textContent = String(spell.cooldown);
}

// Показываем лимит за бой или несколько применений за ход; одиночный лимит скрываем.
function updateUsesBadge(slot, spell) {
  const perBattle = spell.maxUsesPerBattle > 0;
  const maximum = perBattle ? spell.maxUsesPerBattle : spell.maxUsesPerTurn;
  let badge = slot.querySelector('.uses-badge');
  if (!perBattle && !(spell.maxUsesPerTurn > 1)) {
    badge?.remove();
    return;
  }
  const used = perBattle ? (spell.usesTotal ?? 0) : (spell.usesThisTurn ?? 0);
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'uses-badge';
    badge.setAttribute('aria-hidden', 'true');
    slot.appendChild(badge);
  }
  badge.textContent = `${maximum - used}/${maximum}`;
}

// Ключ — объект, поэтому одноимённые кубы разных владельцев не пересекаются.
window.renderSpellPanel = function(resetPage = true) {
  if (resetPage) window.gameState.currentSpellPage = 0;
  hideSpellTooltip();
  document.getElementById('spells').replaceChildren();
  window.gameState.spellSlots.clear();
  const pages = getSpellPages();
  if (window.gameState.currentSpellPage >= pages.length) window.gameState.currentSpellPage = 0;
  const currentSpells = pages[window.gameState.currentSpellPage] ?? [];
  for (let i = 0; i < 20; i++) {
    const spell = currentSpells[i] ?? null;
    if (!spell) {
      const slot = document.createElement('div');
      slot.className = 'spell-slot';
      document.getElementById('spells').appendChild(slot);
      continue;
    }
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'spell-slot';
    if (spell.magicSchool) slot.classList.add(`school-${spell.magicSchool}`);
    slot.innerHTML = spell.svg;
    updateCooldownBadge(slot, spell);
    updateUsesBadge(slot, spell);
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
    ? [...(effect.description === undefined ? [] : [effect.description]),
      ...(effect.permanent ? [] : [`Длительность: ${n} ${word}`]),
      ...(effect.innate ? ['Врождённое'] : []), ...(effect.permanent ? ['Перманентное'] : []), ...(effect.unremovable || weaknessLocked ? [effect.id === 'weakness' ? 'Неснимаемая' : 'Неснимаемое'] : [])]
    : [...(spellDescription === undefined ? [] : [spellDescription]), `Длительность: ${n} ${word}${effect.isSkyShot ? ' или до первого применения' : ''}`,
      `Источник: ${effect.casterName ?? 'Неизвестно'}`];
  for (const text of lines) {
    const line = document.createElement('p');
    line.textContent = text;
    tooltip.appendChild(line);
  }
  if (effect.suppressed) {
    const line = document.createElement('p');
    line.textContent = 'Неактивно';
    line.style.color = '#ff6b6b';
    line.style.marginTop = '6px';
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
  const effects = [...window.elementalShieldEffects(entity), ...entity.appliedEffects]
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
    ...entity.states.map(effect => ({ effect, kind: 'state' }))
  ]) {
    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'spell-slot effect-icon';
    if (kind === 'state' && effect.suppressed) icon.classList.add('suppressed');
    const sourceSpell = window.gameState.entities.flatMap(item => item.availableSpells).find(item => item.id === effect.sourceId);
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

window.showDefeatOverlay = function() {
  const overlay = document.getElementById('defeat-overlay');
  if (overlay?.hidden) window.gameState.turnVersion++; // Старые таймеры ИИ/пропуска больше не действуют.
  if (overlay) overlay.hidden = false;
  window.gameState.isCasting = true;
  window.gameState.isMoving = false;
  window.gameState.stepQueue = [];
  window.gameState.preparedSpellId = null;
  window.gameState.activeEntityId = null;
  window.gameState.battlefield.classList.remove('moving');
  window.clearHighlight?.();
  hideSpellTooltip();
  hideEffectTooltip();
  window.updatePanel();
};

window.updatePanel = function() {
  // Завершение ранее начатого каста может сбросить isCasting; экран поражения сохраняет блокировку.
  if (document.getElementById('defeat-overlay')?.hidden === false) window.gameState.isCasting = true;
  window.gameState.hoveredEntityId = window.gameState.queueHoveredEntityId ?? window.gameState.fieldHoveredEntityId;
  if (window.gameState.selectedEntityId !== null && !window.gameState.entities.some(entity => entity.id === window.gameState.selectedEntityId)) window.gameState.selectedEntityId = null;
  const displayed = window.gameState.entities.find(entity => entity.id === (window.gameState.selectedEntityId ?? window.gameState.hoveredEntityId ?? window.gameState.activeEntityId));
  const viewingEffects = window.gameState.selectedEntityId !== null;
  if (viewingEffects) hideSpellTooltip();
  const pages = getSpellPages();
  // У управляемого призыва показываем и полностью пустую книгу.
  const hasSpells = pages.some(page => page.some(Boolean)
    || (window.gameState.activeEntity()?.isSummon === true && page.length > 0));
  const active = window.gameState.activeEntity();
  const canShowSpells = !!active && window.gameState.isAlly(active);
  document.getElementById('spells').hidden = viewingEffects || !hasSpells || !canShowSpells;
  window.gameState.spellPageControls.hidden = viewingEffects || !hasSpells || !canShowSpells;
  window.gameState.previousSpellPageButton.disabled = window.gameState.nextSpellPageButton.disabled = pages.length < 2 || window.gameState.isCasting || window.gameState.isMoving;
  document.getElementById('effects-panel').hidden = !viewingEffects;
  if (viewingEffects) renderEffectPanel();
  else { effectPanelKey = null; hideEffectTooltip(); }
  document.getElementById('character-name').textContent = displayed ? `${displayed.name} ${displayed.level} ур.` : '—';
  document.getElementById('hp').textContent = displayed ? `HP: ${displayed.hp} / ${displayed.maxHP}` : '—';
  // Подсвечиваем только текущий ресурс; максимум сохраняет обычный цвет.
  for (const [stat, label, bonus] of [['ap', 'AP', 'bonusAP'], ['mp', 'MP', 'bonusMP']]) {
    const element = document.getElementById(stat);
    element.textContent = '';
    if (displayed) {
      const current = document.createElement('span');
      current.textContent = `${label}: ${displayed[stat]}`;
      if (displayed[bonus] > 0) current.style.color = '#4ade80';
      element.append(current, document.createTextNode(` / ${displayed[`max${label}`]}`));
    } else element.textContent = '—';
  }
  const attributes = displayed?.attributes;
  const writeAttribute = (id, text) => { document.getElementById(id).textContent = attributes ? text : '—'; };
  for (const key of ['ra', 'vs', 'es', 'vit', 'str', 'att', 'int', 'wis', 'cha', 'luc', 'ini']) {
    writeAttribute(key, `${key.toUpperCase()}: ${window.getEffectiveStat(displayed, key)}`);
  }
  writeAttribute('wp', `WP: ${window.getEffectiveStat(displayed, 'wp')} / ${window.getEffectiveStat(displayed, 'maxWP')}`);
  writeAttribute('acc', `ACC: ${window.getEffectiveStat(displayed, 'acc')}%`);
  writeAttribute('cri', `CRI: ${window.getEffectiveStat(displayed, 'cri')}%`);
  const sccEl = document.getElementById('scc');
  const spellCastCount = displayed?.spellCastCount ?? 0;
  const maxSpellCasts = displayed?.maxSpellCasts ?? 0;
  sccEl.textContent = displayed ? `SCC: ${spellCastCount} / ${maxSpellCasts}` : '—';
  sccEl.style.color = displayed && spellCastCount >= maxSpellCasts ? '#ff4d4d' : '';
  const hcEl = document.getElementById('hc');
  const hitCount = displayed?.hitCount ?? 0;
  const maxHitCount = displayed?.maxHitCount ?? 0;
  hcEl.textContent = displayed ? `HC: ${hitCount} / ${maxHitCount}` : '—';
  hcEl.style.color = displayed && hitCount >= maxHitCount ? '#ff4d4d' : '';
  writeAttribute('sfc', `SFC: ${window.getEffectiveStat(displayed, 'sfc')}%`);
  writeAttribute('eva', `EVA: ${window.getEffectiveStat(displayed, 'eva')}% / ${displayed?.baseEVA}`);
  writeAttribute('blo', `BLO: ${window.getEffectiveStat(displayed, 'blo')}% / ${displayed?.baseBLO}`);
  for (const [key, label] of Object.entries({ ac: 'Броня', physical: 'Физика', fire: 'Огонь', water: 'Вода', air: 'Воздух', earth: 'Земля', mind: 'Разум', poison: 'Яд' })) {
    const id = `res-${key}`;
    // Базовая защита и бонусы читаются по имени характеристики в корне.
    const value = window.getEffectiveStat(displayed, key);
    writeAttribute(id, String(value));
    document.getElementById(id).parentElement.setAttribute('aria-label', attributes ? `${label}: ${value}` : `${label}: —`);
  }
  window.gameState.endTurnButton.disabled = !displayed || window.gameState.isMoving || window.gameState.isCasting || window.gameState.isSkippingTurn || window.isFrozen(window.gameState.activeEntity()) || !window.activeMover();
  // Характеристики учитывают наведение, заклинания — только активного участника.
  for (const spell of window.gameState.activeEntity()?.availableSpells ?? []) {
    const slot = window.gameState.spellSlots.get(spell);
    if (!slot) continue; // Доступность обновляем только у слотов открытой страницы.
    updateCooldownBadge(slot, spell);
    updateUsesBadge(slot, spell);
    slot.disabled = !displayed || window.gameState.isCasting || !canPrepareSpell(spell);
    slot.classList.toggle('prepared', window.gameState.activeEntity()?.availableSpells.includes(spell) && window.gameState.preparedSpellId === spell.id);
    slot.setAttribute('aria-pressed', window.gameState.activeEntity()?.availableSpells.includes(spell) && window.gameState.preparedSpellId === spell.id ? 'true' : 'false');
  }
  for (const cell of window.gameState.cells) cell.classList.remove('entity-hover');
  for (const entity of window.gameState.entities) {
    const active = entity.id === window.gameState.activeEntityId;
    window.gameState.turnSlots.get(entity.id).classList.toggle('active', active);
    window.gameState.turnSlots.get(entity.id).setAttribute('aria-current', active ? 'true' : 'false');
    if (entity.isSummon) {
      const slot = window.gameState.turnSlots.get(entity.id);
      if (slot) {
        let badge = slot.querySelector('.summon-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'summon-badge';
          slot.appendChild(badge);
        }
        badge.textContent = String(entity.summonDuration ?? 0);
      }
    }
    if (window.gameState.queueHoveredEntityId === entity.id) {
      window.gameState.cells[entity.position.y * window.gameState.SIZE + entity.position.x].classList.add('entity-hover');
    }
  }
};
