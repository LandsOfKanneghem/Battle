// Presentation only: painted raster artwork, portraits and terrain decoration.
// Spell/state values, targeting, timing and creature registration stay in their modules.
(() => {
  const artRoot = 'assets/homm2/';
  const icon = path => `<svg viewBox="0 0 40 40" aria-hidden="true"><image href="${path}" width="40" height="40"/></svg>`;
  const sprite = name => icon(`${artRoot}${name}.png`);
  const templates = window.CREATURE_TEMPLATES;
  const spellArt = new Set(`fire-shot burning-hands reckless fire-cube armageddon
    liquid-membrane rain ice-arrow deep-freeze lake-spirit
    haste wind-rose sparks sky-shot teleport water-walk slow dead-weight stone-skin
    heal-harm weakness-vigor sprint light-flash power-hour apply-old-age
    fire-shield water-shield earth-shield air-shield`.split(/\s+/));
  // Some book entries are copies of definitions. Decorate each distinct object,
  // preserving all references subsequently used as keys by spellSlots.
  for (const spell of new Set([...SPELL_DEFINITIONS, ...MONK_SPELLS, ...ELEMENTAL_SHIELD_SPELLS,
    ...Object.values(templates).flatMap(template => template.spells ?? [])])) {
    if (spell.iconPath || spellArt.has(spell.id)) spell.svg = icon(spell.iconPath ?? `${artRoot}spell-${spell.id}.png`);
  }
  for (const state of stateTypes.values()) {
    if (state.id !== 'invisibility') state.icon = sprite(`state-${state.id}`);
  }

  const createSvg = window.createCreatureSvg;
  window.createCreatureSvg = function(kind) {
    const svg = createSvg(kind);
    const appearance = templates[kind].appearance;
    if (appearance.sprite) {
      const { width, height } = appearance.displaySize;
      const { width: sourceWidth, height: sourceHeight } = appearance.sourceSize ?? window.DEFAULT_CREATURE_SOURCE_SIZE;
      const { top, right, bottom, left } = appearance.padding;
      svg.removeAttribute('style');
      svg.classList.add('battle-creature');
      svg.setAttribute('viewBox', `0 0 ${sourceWidth} ${sourceHeight}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.setProperty('--sprite-width', `${width}px`);
      svg.style.setProperty('--sprite-height', `${height}px`);
      // Убираем те же прозрачные поля исходника, что и редактор.
      svg.style.setProperty('--sprite-clip', `inset(${top * height / sourceHeight}px ${right * width / sourceWidth}px ${bottom * height / sourceHeight}px ${left * width / sourceWidth}px)`);
      svg.innerHTML = `<image href="${appearance.sprite}" width="${sourceWidth}" height="${sourceHeight}"/>`;
    }
    return svg;
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.SUMMON_TIME_ICON = sprite('state-summon-time');
    for (const stat of document.querySelectorAll('.resistance-stat')) {
      const key = stat.querySelector('span').id.replace('res-', '');
      stat.querySelector('svg').innerHTML = `<image href="${artRoot}res-${key}.png" width="16" height="16"/>`;
    }
    const portrait = document.getElementById('creature-portrait');
    const name = document.getElementById('character-name');
    const updatePortrait = () => {
      const state = window.gameState;
      const creature = state.entities.find(item => item.id === (state.selectedEntityId ?? state.hoveredEntityId ?? state.activeEntityId));
      const url = (templates[creature?.type] ?? templates.wizard).appearance.portrait;
      if (portrait.getAttribute('src') !== url) portrait.setAttribute('src', url);
      portrait.hidden = !creature;
    };
    new MutationObserver(updatePortrait).observe(name, { childList: true });
    updatePortrait();

    // Queue thumbnails use the matching painted face; battlefield SVGs remain intact.
    const updateQueueArtwork = () => {
      for (const [id, slot] of window.gameState.turnSlots) {
        const creature = window.gameState.entities.find(item => item.id === id);
        if (!templates[creature?.type]?.appearance.portrait) continue;
        const image = slot.querySelector('svg image');
        const url = templates[creature.type].appearance.portrait;
        if (image && image.getAttribute('href') !== url) {
          image.parentElement.setAttribute('viewBox', '0 0 40 40');
          image.setAttribute('href', url);
          image.setAttribute('width', '40');
          image.setAttribute('height', '40');
        }
      }
    };
    new MutationObserver(updateQueueArtwork).observe(window.gameState.turnOrder, { childList: true });
    updateQueueArtwork();

    // On the long mobile layout, native focus can scroll a spell into view.
    // The existing scroll listener hides its tooltip; restore the visual focus
    // after that scroll, using the icon's existing tooltip handler.
    document.addEventListener('focusin', event => {
      const icon = event.target;
      if (!icon.matches('button.spell-slot')) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (icon.isConnected && document.activeElement === icon) icon.dispatchEvent(new FocusEvent('focus'));
      }));
    });
  });
})();
