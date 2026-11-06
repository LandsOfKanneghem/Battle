// Состояния, защиты и урон. Обычный скрипт с глобальными точками входа window.*.
// Данные читаются из window.gameState; UI обновляется только при вызове функций,
// через window.updatePanel?.(), после инициализации основного скрипта.

// Состояния: наложение, подавление, пересчёт характеристик и сроки источника.
window.hasActiveState = function(entity, id) {
  return entity.states.some(state => state.id === id && !state.suppressed
    && (state.duration > 0 || state.permanent || state.innate));
};

window.restoreSuspendedWeakness = function(entity) {
  entity.states.push(...(entity.suspendedWeakness ?? []));
  entity.suspendedWeakness = [];
};

window.recalculateStateStats = function(entity, allowNegativeMP = false) {
  const oldMaxAP = entity.maxAP;
  entity.maxAP = Math.max(1, entity.baseAP + entity.states.filter(state => !state.suppressed)
    .reduce((sum, state) => sum + (state.apBonus ?? 0), 0));
  // Изменяется именно остаток AP: потраченные действия не возвращаем; долг AP допустим.
  entity.ap += entity.maxAP - oldMaxAP;
  const oldMaxMP = entity.maxMP;
  const tempMpBonus = (entity.mpBonuses ?? []).filter(bonus => bonus.turnsLeft > 0)
    .reduce((sum, bonus) => sum + bonus.amount, 0);
  entity.maxMP = Math.max(1, entity.baseMP + entity.states.filter(state => !state.suppressed).reduce((sum, state) => sum + state.mpBonus, 0) + tempMpBonus);
  entity.ini = entity.baseINI + entity.states.filter(state => !state.suppressed).reduce((sum, state) => sum + state.initiativeBonus, 0);
  // Берём фактическую дельту после ограничения maxMP >= 1, а не сумму бонусов.
  // Перекрытие Скорости Медлительностью, например, даёт сразу -4 MP.
  const delta = entity.maxMP - oldMaxMP;
  if (delta !== 0) {
    const adjusted = Math.min(entity.maxMP, entity.mp + delta);
    // Наложение допускает долг MP; при снятии/истечении остаток не ниже нуля.
    entity.mp = allowNegativeMP ? adjusted : Math.max(0, adjusted);
  }
};

window.resolveStateSuppression = function(entity) {
  // При взаимном overrides побеждает последнее успешно наложенное состояние.
  // Одностороннее overrides имеет приоритет независимо от времени наложения.
  let pending = [...entity.states].sort((a, b) => b.appliedOrder - a.appliedOrder);
  for (const state of pending) state.suppressed = true;
  while (pending.length) {
    const winner = pending.find(candidate => !pending.some(other => other !== candidate
      && other.overrides.includes(candidate.id)
      && (!candidate.overrides.includes(other.id) || other.appliedOrder > candidate.appliedOrder))) ?? pending[0];
    winner.suppressed = false;
    // Подавленные остаются в entity.states, но сами ничего не подавляют.
    pending = pending.filter(state => state !== winner && !winner.overrides.includes(state.id));
  }
};

window.applyState = function(entity, stateOrId, duration, casterName) {
  // Поддерживаем объект состояния; форма с id удобна для ручной отладки.
  const input = typeof stateOrId === 'string' ? { id: stateOrId, duration, casterName } : stateOrId;
  const template = stateTypes.get(input.id);
  if (!template) return false;
  const stateDuration = input.duration ?? template.duration;
  if (stateDuration <= 0) return false;
  // Иммунитет Адреналина действует самостоятельно, без Бодрости.
  if (['weakness', 'exhaustion'].includes(input.id) && hasActiveState(entity, 'adrenaline')) return false;
  if (input.id === 'weakness' && hasActiveState(entity, 'vigor')) return false;
  if (['adrenaline', 'vigor'].includes(input.id) && hasActiveState(entity, 'adrenaline-crash')) return false;
  const neutralizes = input.neutralizes ?? template.neutralizes;
  if (entity.states.some(state => neutralizes.includes(state.id))) {
    // A нейтрализует B: снимаем B, но A не появляется. Урон уже прошёл раньше.
    entity.states = entity.states.filter(state => !neutralizes.includes(state.id));
    resolveStateSuppression(entity);
    recalculateStateStats(entity);
    window.updatePanel?.();
    return false;
  }
  // Стакающиеся состояния всегда создают отдельный экземпляр и собственный таймер.
  const sameInstance = state => template.stackable !== true && state.id === input.id;
  const existing = entity.states.find(sameInstance);
  if (existing && (existing.unremovable || existing.permanent || existing.innate || existing.duration > stateDuration
    || (existing.duration === stateDuration && input.id !== 'burning'))) return false;
  // Равное по длительности Горение обновляет источник; меньшая длительность игнорируется.
  if (input.id === 'adrenaline' || input.id === 'vigor') {
    entity.suspendedWeakness ??= [];
    entity.states = entity.states.filter(state => {
      if (state.unremovable) return true;
      if (state.id === 'exhaustion' && input.id === 'adrenaline') return false;
      if (state.id !== 'weakness') return true;
      // Адреналин сохраняет постоянную Слабость для возврата после своего спада.
      if (state.permanent && input.id === 'adrenaline') entity.suspendedWeakness.push(state);
      return false;
    });
  }
  // Откат снимает Бодрость до создания Слабости, чтобы иммунитет уже не действовал.
  if (input.id === 'adrenaline-crash') entity.states = entity.states.filter(state => state.id !== 'vigor');
  entity.states = entity.states.filter(state => !sameInstance(state));
  entity.states.push({ ...template, ...input, duration: stateDuration, casterId: input.casterId ?? window.gameState.activeEntity()?.id,
    suppressed: false, appliedOrder: ++window.gameState.effectOrder,
    overrides: [...(input.overrides ?? template.overrides)],
    neutralizes: [...(input.neutralizes ?? template.neutralizes)], blocks: [...(input.blocks ?? template.blocks)] });
  resolveStateSuppression(entity);
  recalculateStateStats(entity, true);
  window.updatePanel?.();
  return true;
};

window.removeState = function(entity, stateId) {
  if (stateId === 'weakness' && hasActiveState(entity, 'adrenaline-crash')) return;
  const hadAdrenaline = entity.states.some(state => state.id === 'adrenaline');
  if (stateTypes.get(stateId)?.stackable === true) {
    const latest = entity.states.filter(state => state.id === stateId && !state.unremovable && !state.permanent && !state.innate)
      .reduce((last, state) => !last || state.appliedOrder > last.appliedOrder ? state : last, null);
    entity.states = entity.states.filter(state => state !== latest);
  } else {
    entity.states = entity.states.filter(state => state.id !== stateId || state.unremovable || state.permanent || state.innate);
  }
  if (hadAdrenaline && !entity.states.some(state => state.id === 'adrenaline')) {
    restoreSuspendedWeakness(entity);
  }
  resolveStateSuppression(entity);
  recalculateStateStats(entity);
  window.updatePanel?.();
};

window.getCurrentES = function(entity) {
  // baseES — оставшаяся базовая часть: тратится последней и не восполняется.
  return entity.baseES + entity.esBonuses.reduce((sum, bonus) => sum + bonus.remaining, 0);
};

window.consumeES = function(entity, amount) {
  let left = amount;
  // Старые бонусы -> новые бонусы -> база. Нулевые бонусы сохраняются до истечения.
  for (const bonus of entity.esBonuses) {
    const spent = Math.min(bonus.remaining, left);
    bonus.remaining -= spent;
    left -= spent;
    if (left === 0) break;
  }
  entity.baseES = Math.max(0, entity.baseES - left);
};

window.removeSpellBonuses = function(entity, applied, recalculate = true) {
  // Удаление бонуса убирает только его remaining из суммы, не затрагивая базу.
  entity.esBonuses = entity.esBonuses.filter(bonus => bonus.instanceId !== applied.appliedOrder);
  // EVA остаётся отдельным нерасходуемым бонусом с тем же сроком заклинания.
  entity.evaBonuses = entity.evaBonuses.filter(bonus => bonus.instanceId !== applied.appliedOrder);
  const oldMpCount = (entity.mpBonuses ?? []).length;
  entity.mpBonuses = (entity.mpBonuses ?? []).filter(bonus => bonus.instanceId !== applied.appliedOrder);
  if (recalculate && entity.mpBonuses.length !== oldMpCount) recalculateStateStats(entity);
};

window.tickTemporaryBonuses = function(entity, casterId) {
  const oldMpCount = (entity.mpBonuses ?? []).length;
  entity.mpBonuses = (entity.mpBonuses ?? []).map(bonus => bonus.casterId === casterId
    ? { ...bonus, turnsLeft: bonus.turnsLeft - 1 } : bonus).filter(bonus => bonus.turnsLeft > 0);
  if (entity.mpBonuses.length !== oldMpCount) recalculateStateStats(entity);
  entity.esBonuses = entity.esBonuses.map(bonus => bonus.casterId === casterId
    ? { ...bonus, turnsLeft: bonus.turnsLeft - 1 } : bonus)
    .filter(bonus => bonus.turnsLeft > 0);
  entity.evaBonuses = entity.evaBonuses.map(bonus => bonus.casterId === casterId
    ? { ...bonus, turnsLeft: bonus.turnsLeft - 1 } : bonus)
    .filter(bonus => bonus.turnsLeft > 0);
};

window.tickCasterEffects = function(casterId) {
  // Единственное место отсчёта: эффекты источника на ВСЕХ целях, включая его самого.
  for (const target of window.gameState.entities) {
    // Сначала тикают старые состояния. Новый откат не теряет ход в этом же проходе.
    const expiredAdrenaline = target.states.filter(state => state.id === 'adrenaline'
      && state.casterId === casterId && !state.permanent && !state.innate && state.duration <= 1);
    // Все состояния, включая Слабость, тикают только у своего источника.
    // Слабость от отката и сам откат имеют одинаковый срок и спадают вместе.
    // Подавленные состояния тоже тикают; врождённые и постоянные не истекают.
    target.states = target.states.map(state => state.casterId === casterId && !state.permanent && !state.innate
      ? { ...state, duration: state.duration - 1 } : state)
      .filter(state => state.permanent || state.innate || state.duration > 0);
    if (expiredAdrenaline.length) {
      for (const adrenaline of expiredAdrenaline) applyState(target, {
        id: 'adrenaline-crash', duration: 1, casterId: adrenaline.casterId, casterName: adrenaline.casterName
      });
      restoreSuspendedWeakness(target);
    }
    resolveStateSuppression(target);
    recalculateStateStats(target);
    // Срок заклинания независим от срока созданного им состояния.
    target.appliedEffects = target.appliedEffects.map(effect => effect.casterId === casterId
      ? { ...effect, duration: effect.duration - 1 } : effect)
      .filter(effect => effect.duration > 0);
    tickTemporaryBonuses(target, casterId);
    storeElementalShields(target, elementalShieldEffects(target)
      .map(effect => effect.casterId === casterId ? { ...effect, turnsLeft: effect.turnsLeft - 1 } : effect)
      .filter(effect => effect.turnsLeft > 0));
  }
};

window.removeCasterEffects = function(casterId) {
  // Смерть источника снимает его эффекты сразу, даже если сейчас ход другой цели.
  for (const target of window.gameState.entities) {
    const lostAdrenaline = target.states.some(state => state.id === 'adrenaline' && state.casterId === casterId);
    target.suspendedWeakness = (target.suspendedWeakness ?? []).filter(state => state.casterId !== casterId);
    target.states = target.states.filter(state => state.casterId !== casterId);
    // Смерть источника снимает его эффекты; чужая приостановленная Слабость возвращается.
    if (lostAdrenaline) restoreSuspendedWeakness(target);
    resolveStateSuppression(target);
    recalculateStateStats(target);
    target.appliedEffects = target.appliedEffects.filter(effect => effect.casterId !== casterId);
    target.esBonuses = target.esBonuses.filter(bonus => bonus.casterId !== casterId);
    target.evaBonuses = target.evaBonuses.filter(bonus => bonus.casterId !== casterId);
    const oldMpCount = (target.mpBonuses ?? []).length;
    target.mpBonuses = (target.mpBonuses ?? []).filter(bonus => bonus.casterId !== casterId);
    if (target.mpBonuses.length !== oldMpCount) recalculateStateStats(target);
    storeElementalShields(target, elementalShieldEffects(target).filter(effect => effect.casterId !== casterId));
  }
};

window.applySpellOnEntity = function(entity, spellOnMe) {
  const hadMpBonus = (entity.mpBonuses ?? []).some(bonus => bonus.turnsLeft > 0);
  // Каждый наложенный бафф имеет собственный срок и источник.
  // Его истечение не снимает состояние: оба таймера живут независимо.
  // По умолчанию заменяем ВСЕ одноимённые заклинания, независимо от id и силы.
  // Отсутствующий stackable равнозначен false; правила состояний не меняем.
  if (spellOnMe.stackable !== true) {
    // Пересчитываем MP один раз после замены, чтобы не вернуть потраченные очки.
    for (const old of entity.appliedEffects.filter(effect => effect.name === spellOnMe.name)) removeSpellBonuses(entity, old, false);
    entity.appliedEffects = entity.appliedEffects.filter(effect => effect.name !== spellOnMe.name);
  }
  const applied = { ...spellOnMe, casterId: spellOnMe.casterId ?? window.gameState.activeEntity()?.id,
    stackable: spellOnMe.stackable === true,
    sourceId: spellOnMe.sourceId ?? spellOnMe.id, appliedOrder: ++window.gameState.effectOrder };
  entity.appliedEffects.push(applied);
  const bonus = { sourceId: applied.sourceId, name: applied.name, turnsLeft: applied.duration,
    casterId: applied.casterId, casterName: applied.casterName, icon: applied.icon, instanceId: applied.appliedOrder };
  if (applied.esAmount) {
    if (!applied.stackable) {
      entity.esBonuses = entity.esBonuses.filter(old => old.sourceId !== applied.sourceId && old.name !== applied.name);
    }
    entity.esBonuses.push({ ...bonus, amount: applied.esAmount, remaining: applied.esAmount });
  }
  if (applied.evaAmount) entity.evaBonuses.push({ ...bonus, amount: applied.evaAmount });
  if (applied.mpAmount) {
    entity.mpBonuses ??= [];
    entity.mpBonuses.push({ ...bonus, amount: applied.mpAmount });
  }
  if (hadMpBonus || applied.mpAmount) recalculateStateStats(entity, true);
  if (applied.stateId) applyState(entity, {
    id: applied.stateId, duration: applied.stateDuration ?? applied.duration,
    casterId: applied.casterId, casterName: applied.casterName
  });
  window.updatePanel?.();
};

// Защиты от стихий и физического урона.
window.elementalShieldEffects = function(entity, damageType) {
  // Без типа возвращаем все защиты для панели, тика и снятия при смерти.
  return entity.elementalShields.filter(effect => effect.turnsLeft > 0
    && (damageType === undefined || effect.damageType === damageType));
};

window.storeElementalShields = function(entity, effects) {
  entity.elementalShields = effects;
};

window.addElementalShield = function(entity, spell, caster = window.gameState.activeEntity()) {
  const effects = elementalShieldEffects(entity);
  const fresh = { damageType: spell.damageType, amount: spell.shieldAmount, turnsLeft: spell.shieldDuration, sourceId: spell.id,
    casterId: caster?.id, casterName: caster?.name ?? 'Неизвестно', name: spell.name,
    svg: spell.svg, appliedOrder: ++window.gameState.effectOrder };
  const index = effects.findIndex(effect => effect.sourceId === spell.id);
  if (index === -1) effects.push(fresh);
  else effects[index] = fresh; // Тот же источник заменяется даже более слабой защитой.
  storeElementalShields(entity, effects);
};

window.elementalBlockAmount = function(entity, damageType) {
  return elementalShieldEffects(entity, damageType).reduce((sum, effect) => sum + effect.amount, 0);
};

// Расчёт сопротивлений, ES, HP и попадания выстрела.
window.isMagicalDamage = function(damageType) {
  return !['physical', 'poison', 'pure'].includes(damageType);
};

window.damageBreakdown = function(spell, entity) {
  if (isFrozen(entity)) return { absorbed: 0, hpDamage: 0 };
  // Учитываем защиту нужного типа (включая physical) один раз, до ES/HP.
  const resistance = getEffectiveStat(entity, spell.damageType);
  const afterResistance = Math.max(0, spell.damage - resistance);
  const absorbed = isMagicalDamage(spell.damageType)
    ? Math.min(getCurrentES(entity), afterResistance) : 0;
  return { absorbed, hpDamage: afterResistance - absorbed };
};

window.spellDamage = function(spell, entity) {
  // Превью не расходует ES и не бросает уклонение; показывает HP-урон при попадании.
  return damageBreakdown(spell, entity).hpDamage;
};

window.applyDamage = function(spell, entity) {
  if (isFrozen(entity)) return; // Не расходуем ни HP, ни ES, ни бонусы защиты.
  const { absorbed, hpDamage } = damageBreakdown(spell, entity);
  consumeES(entity, absorbed);
  entity.hp = Math.max(0, entity.hp - hpDamage);
};

window.shotHits = function(caster, target) {
  const hitChance = Math.max(0, Math.min(100, getEffectiveStat(caster, 'acc') - getEffectiveStat(target, 'eva')));
  return Math.random() * 100 < hitChance;
};

window.isFrozen = function(entity) {
  return !!entity && entity.states.some(state => state.id === 'freeze' && !state.suppressed
    && (state.duration > 0 || state.permanent || state.innate));
};

window.getEffectiveStat = function(entity, statName) {
  if (!entity) return 0;
  if (statName === 'es') return getCurrentES(entity);
  const valueAt = object => statName.split('.').reduce((value, key) => value?.[key], object);
  const innate = ['vit', 'str', 'att', 'int', 'wis', 'cha', 'luc'];
  const protectionStats = ['ac', 'physical', 'fire', 'water', 'air', 'earth', 'mind', 'poison'];
  const base = (innate.includes(statName) ? entity.attributes?.[statName] : entity[statName]) ?? 0;
  const effects = [
    ...entity.states.filter(state => !state.suppressed && (state.duration > 0 || state.permanent || state.innate)),
    ...entity.appliedEffects.filter(effect => effect.duration > 0 && !effect.suppressed),
    ...elementalShieldEffects(entity)
  ];
  // Физическая и стихийные защиты добавляются только к своей характеристике.
  const elementalProtection = protectionStats.includes(statName)
    ? elementalBlockAmount(entity, statName) : 0;
  const temporaryEvasion = statName === 'eva'
    ? entity.evaBonuses.filter(bonus => bonus.turnsLeft > 0).reduce((sum, bonus) => sum + bonus.amount, 0) : 0;
  return base + elementalProtection + temporaryEvasion + effects.reduce((sum, effect) => sum + (valueAt(effect.modifiers)
    // Данные состояний сохраняют прежний формат вложенных модификаторов защиты.
    ?? (protectionStats.includes(statName) ? effect.modifiers?.resistances?.[statName] : undefined)
    // ini уже включает initiativeBonus состояний после recalculateStateStats.
    ?? (statName === 'ini' ? (entity.states.includes(effect) ? 0 : effect.initiativeBonus ?? 0) : statName === 'eva' ? effect.evaBonus ?? 0
      : statName === 'acc' ? effect.accuracyBonus ?? 0 : statName === 'sfc' ? effect.sfcBonus ?? 0 : 0)), 0);
};
