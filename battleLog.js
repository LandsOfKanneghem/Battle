// Только журнал: не изменяет ресурсы, очередь или результаты боевых бросков.
(() => {
  let disappearing = new WeakSet();
  let turnStartEntries = null;
  let copyFeedbackTimer;
  const legacyCopy = text => {
    const focus = document.activeElement;
    const selection = window.getSelection?.();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(input);
    try {
      input.focus({ preventScroll: true });
      input.select();
      return document.execCommand('copy');
    } finally {
      input.remove();
      focus?.focus({ preventScroll: true });
      if (selection) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range); }
    }
  };
  const beneficialEffects = new Set([
    'invisibility', 'speed', 'light', 'adrenaline', 'vigor', 'levitation', 'water-entity',
    'liquid-membrane', 'sky-shot', 'power-hour', 'sprint',
    'fire-shield', 'water-shield', 'earth-shield', 'air-shield', 'stone-skin'
  ]);
  const damageColors = { fire: '#dc6500', water: '#173d99', air: '#367c8c', earth: '#80502d',
    poison: '#19812b', physical: '#666666', light: '#a17c00', dark: '#8436ad' };
  const plainText = value => typeof value === 'string' ? value : value.text;
  const appendLine = (text, kind = 'event') => {
    const list = document.getElementById('battle-log-entries');
    if (!list) return;
    const scroll = document.getElementById('battle-log-scroll') ?? list;
    const follow = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 24;
    const line = document.createElement('p');
    line.className = `battle-log-${kind}`;
    line.textContent = plainText(text);
    if (text.segments && typeof line.append === 'function') {
      line.replaceChildren();
      for (const segment of text.segments) {
        const span = document.createElement('span');
        if (segment.numbers) {
          for (const fragment of segment.text.split(/(\d+(?:[.,]\d+)?)/)) {
            if (/^\d/.test(fragment)) {
              const number = document.createElement('strong');
              number.textContent = fragment;
              span.append(number);
            } else span.append(fragment);
          }
        } else span.textContent = segment.text;
        if (segment.damageType !== undefined) span.style.color = damageColors[segment.damageType] ?? '#8b1c1c';
        line.append(span);
      }
    }
    list.appendChild(line);
    if (follow) scroll.scrollTop = scroll.scrollHeight;
  };
  const write = (text, kind = 'event') => {
    if (turnStartEntries) turnStartEntries.push([text, kind]);
    else appendLine(text, kind);
  };
  const finishTurnStart = () => {
    const entries = turnStartEntries ?? [];
    turnStartEntries = null;
    for (const [text, kind] of entries) appendLine(text, kind);
  };
  const sourceName = effect => effect.casterName
    || window.gameState.entities.find(entity => entity.id === effect.casterId)?.name;
  window.battleLog = {
    getText() {
      const entries = Array.from(document.getElementById('battle-log-entries')?.children ?? [], line => line.textContent);
      return [...entries, ...(turnStartEntries ?? []).map(([text]) => plainText(text))].join('\n');
    },
    async copy() {
      const text = window.battleLog.getText();
      let copied = false;
      try {
        if (window.navigator?.clipboard?.writeText) {
          try { await window.navigator.clipboard.writeText(text); copied = true; } catch { /* Try local-file compatible copying. */ }
        }
        if (!copied) copied = legacyCopy(text);
      } catch { copied = false; }
      const button = document.getElementById('copy-battle-log');
      if (button) {
        clearTimeout(copyFeedbackTimer);
        button.dataset.copied = String(copied);
        button.title = copied ? 'Логи скопированы' : 'Не удалось скопировать логи. Попробуйте ещё раз.';
        button.setAttribute('aria-label', button.title);
        copyFeedbackTimer = setTimeout(() => {
          delete button.dataset.copied;
          button.title = 'Скопировать все логи';
          button.setAttribute('aria-label', button.title);
        }, 2000);
      }
      return copied;
    },
    reset() {
      disappearing = new WeakSet();
      turnStartEntries = null;
      document.getElementById('battle-log-entries')?.replaceChildren();
      const scroll = document.getElementById('battle-log-scroll');
      if (scroll) scroll.scrollTop = 0;
    },
    beginRound(number) {
      finishTurnStart();
      write(`Ход ${number}`, 'round');
    },
    beginTurn(entity) {
      finishTurnStart();
      write(`Ходит: ${entity.name}`, 'turn');
      // Броски происходят после тиков. В журнале сначала показываем бонусы начала хода,
      // затем возникшие состояния и урон, сохраняя порядок самих боевых вычислений.
      turnStartEntries = [];
    },
    finishTurnStart,
    summoned(caster, entity) {
      write(`${caster.name} призывает: ${entity.name}.`);
    },
    bonus(entity, resource) { appendLine(`${entity.name}: +1 ${resource} в начале хода!`, 'benefit'); },
    heal(entity, amount, caster) {
      write(`${entity.name} +${amount} ОЗ (лечение${caster ? `: ${caster.name}` : ''}).`, 'benefit');
    },
    cast(caster, spell, target) {
      write(`${caster.name} применяет «${spell.name}»${spell.target !== 'none' && target?.name ? ` — цель: ${target.name}` : ''}.`);
    },
    blocked() { write('Что-то преграждает дорогу!'); },
    miss(caster, target) { write(`${caster.name}: промах по цели ${target.name}.`); },
    failure(caster, spell) { write(`${caster.name}: заклинание «${spell.name}» провалилось!`); },
    applied(entity, effect, kind = 'состояние', refreshed = false) {
      const source = sourceName(effect);
      write(`${source ? `${source} ${refreshed ? 'обновляет' : 'накладывает'} ${kind}` : `${entity.name}: ${kind}`} «${effect.name}»${source ? ` — цель: ${entity.name}` : ''}.`,
        beneficialEffects.has(effect.stateId ?? effect.id) ? 'benefit' : 'event');
    },
    damage(entity, amount, absorbed = 0, critical = false, parts = null) {
      const components = parts ?? [{ amount, damageType: 'other', kind: 'base' }];
      const base = components.find(part => part.kind === 'base') ?? components[0];
      const terms = [base];
      if (critical) terms.push({ amount: 0, damageType: base.damageType, kind: 'crit' });
      terms.push(...components.filter(part => part.kind === 'modifier'));
      const segments = [{ text: `${critical ? 'Критический удар!\n' : ''}${entity.name} получил урон: ` }];
      terms.forEach((part, index) => {
        if (index) segments.push({ text: ' + ' });
        let value = String(part.rawDamage ?? part.amount);
        const resistance = part.resistance ?? 0;
        if (resistance > 0) value += ` - ${resistance}`;
        else if (resistance < 0) value += ` + ${-resistance}`;
        if (part.absorbed > 0) value += ` - ${part.absorbed} [ES]`;
        if (resistance !== 0 || part.absorbed > 0) value = `(${value})`;
        segments.push({ text: `${value}${part.kind === 'crit' ? ' [крит]' : part.kind === 'modifier' ? ' [модификаторы]' : ''}`,
          damageType: part.damageType ?? 'other', numbers: true });
      });
      segments.push({ numbers: true, text: `${terms.length > 1 ? ` = ${amount}` : ''}${absorbed ? ` (${absorbed} урона поглощено ES)` : ''}.` });
      write({ text: segments.map(segment => segment.text).join(''), segments }, 'damage');
    },
    markDisappearance(entity) { disappearing.add(entity); },
    removed(entity) {
      finishTurnStart();
      write(`${entity.name} ${disappearing.has(entity) ? 'исчезает' : 'погибает'}.`, 'death');
    }
  };
})();
