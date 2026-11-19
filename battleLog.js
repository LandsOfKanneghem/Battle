// Только журнал: не изменяет ресурсы, очередь или результаты боевых бросков.
(() => {
  let round = 0;
  let remaining = new Set();
  let disappearing = new WeakSet();
  let turnStartEntries = null;
  const turnNames = {
    wizard: 'Волшебника', monk: 'Монаха', wolf: 'Волка',
    'black-wolf': 'Чёрного волка', 'hill-giant': 'Холмового Великана',
    'lake-spirit': 'Духа озера', nymph: 'Нимфы'
  };
  const beneficialEffects = new Set([
    'speed', 'light', 'adrenaline', 'vigor', 'levitation', 'water-entity',
    'liquid-membrane', 'sky-shot', 'power-hour', 'sprint',
    'fire-shield', 'water-shield', 'earth-shield', 'air-shield', 'stone-skin'
  ]);
  const appendLine = (text, kind = 'event') => {
    const list = document.getElementById('battle-log-entries');
    if (!list) return;
    const follow = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    const line = document.createElement('p');
    line.className = `battle-log-${kind}`;
    line.textContent = text;
    list.appendChild(line);
    if (follow) list.scrollTop = list.scrollHeight;
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
    reset() {
      round = 0;
      remaining = new Set();
      disappearing = new WeakSet();
      turnStartEntries = null;
      document.getElementById('battle-log-entries')?.replaceChildren();
    },
    beginTurn(entity) {
      finishTurnStart();
      const alive = window.gameState.entities.filter(item => item.hp > 0);
      const aliveIds = new Set(alive.map(item => item.id));
      remaining = new Set([...remaining].filter(id => aliveIds.has(id)));
      if (!remaining.size) {
        round++;
        remaining = aliveIds;
        write(`Ход ${round}`, 'round');
      }
      remaining.delete(entity.id);
      write(`Ход ${turnNames[entity.type] ?? entity.name}`, 'turn');
      // Броски происходят после тиков. В журнале сначала показываем бонусы начала хода,
      // затем возникшие состояния и урон, сохраняя порядок самих боевых вычислений.
      turnStartEntries = [];
    },
    finishTurnStart,
    summoned(caster, entity) {
      remaining.add(entity.id);
      write(`${caster.name} призывает: ${entity.name}.`);
    },
    bonus(entity, resource) { appendLine(`${entity.name}: +1 ${resource} в начале хода!`, 'benefit'); },
    heal(entity, amount, caster) {
      write(`${entity.name} +${amount} ОЗ (лечение${caster ? `: ${caster.name}` : ''}).`, 'benefit');
    },
    cast(caster, spell, target) {
      write(`${caster.name} применяет «${spell.name}»${target ? ` — цель: ${target.name}` : ''}.`);
    },
    miss(caster, target) { write(`${caster.name}: промах по цели ${target.name}.`); },
    failure(caster, spell) { write(`${caster.name}: заклинание «${spell.name}» провалилось!`); },
    applied(entity, effect, kind = 'состояние', refreshed = false) {
      const source = sourceName(effect);
      write(`${source ? `${source} ${refreshed ? 'обновляет' : 'накладывает'} ${kind}` : `${entity.name}: ${kind}`} «${effect.name}»${source ? ` — цель: ${entity.name}` : ''}.`,
        beneficialEffects.has(effect.stateId ?? effect.id) ? 'benefit' : 'event');
    },
    damage(entity, amount, absorbed = 0) {
      write(`${entity.name} -${amount} ОЗ${absorbed ? ` (${absorbed} урона поглощено ES)` : ''}.`, 'damage');
    },
    markDisappearance(entity) { disappearing.add(entity); },
    removed(entity) {
      finishTurnStart();
      write(`${entity.name} ${disappearing.has(entity) ? 'исчезает' : 'погибает'}.`, 'death');
    }
  };
})();
