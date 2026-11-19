// Presentation only: painted raster artwork, portraits and terrain decoration.
// Spell/state values, targeting, timing and creature registration stay in their modules.
(() => {
  const artRoot = 'assets/homm2/';
  const sprite = name => `<svg viewBox="0 0 40 40" aria-hidden="true"><image href="${artRoot}${name}.png" width="40" height="40"/></svg>`;
  const spellArt = new Set(`fire-shot burning-hands reckless fire-cube armageddon
    water-shot liquid-membrane rain ice-arrow deep-freeze lake-spirit
    haste wind-rose sparks sky-shot teleport water-walk slow dead-weight stone-skin
    heal-harm weakness-vigor sprint light-flash power-hour apply-old-age
    bite club-smash boulder-throw fire-shield water-shield earth-shield air-shield`.split(/\s+/));
  // Some book entries are copies of definitions. Decorate each distinct object,
  // preserving all references subsequently used as keys by spellSlots.
  for (const spell of new Set([...SPELL_DEFINITIONS, ...MONK_SPELLS, ...ELEMENTAL_SHIELD_SPELLS])) {
    if (spellArt.has(spell.id)) spell.svg = sprite(`spell-${spell.id}`);
  }
  for (const state of stateTypes.values()) state.icon = sprite(`state-${state.id}`);

  const kinds = new Set(['wizard', 'monk', 'wolf', 'hill-giant', 'lake-spirit']);
  // Исходники 60×72 и фактические размеры совпадают с MapEditor.
  const fieldSizes = {
    wolf: [90, 108, [36, 3, 4, 3]], 'hill-giant': [90, 108, [4, 2, 4, 2]],
    wizard: [72, 86, [4, 7, 4, 7]], monk: [72, 86, [6, 9, 4, 9]]
  };
  const createSvg = window.createCreatureSvg;
  window.createCreatureSvg = function(kind) {
    const svg = createSvg(kind);
    if (fieldSizes[kind]) {
      const [width, height, [top, right, bottom, left]] = fieldSizes[kind];
      svg.removeAttribute('style');
      svg.classList.add('battle-creature');
      svg.setAttribute('viewBox', '0 0 60 72');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.setProperty('--sprite-width', `${width}px`);
      svg.style.setProperty('--sprite-height', `${height}px`);
      // Убираем те же прозрачные поля исходника, что и редактор.
      svg.style.setProperty('--sprite-clip', `inset(${top * height / 72}px ${right * width / 60}px ${bottom * height / 72}px ${left * width / 60}px)`);
      svg.innerHTML = `<image href="assets/map-editor/mobs/${kind}.png" width="60" height="72"/>`;
    } else if (kinds.has(kind)) svg.innerHTML = `<image href="${artRoot}${kind}.png" width="40" height="40"/>`;
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
      const kind = kinds.has(creature?.type) ? creature.type : 'wizard';
      const url = `${artRoot}portrait-${kind}.png`;
      if (portrait.getAttribute('src') !== url) portrait.setAttribute('src', url);
      portrait.hidden = !creature;
    };
    new MutationObserver(updatePortrait).observe(name, { childList: true });
    updatePortrait();

    // Queue thumbnails use the matching painted face; battlefield SVGs remain intact.
    const updateQueueArtwork = () => {
      for (const [id, slot] of window.gameState.turnSlots) {
        const creature = window.gameState.entities.find(item => item.id === id);
        if (!kinds.has(creature?.type)) continue;
        const image = slot.querySelector('svg image');
        const url = `${artRoot}portrait-${creature.type}.png`;
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
