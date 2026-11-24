// Факелы занимают доступную клетку пола; wallX/wallY отвечают только за крепление спрайта.
window.torchSpellState = function(spell, caster) {
  if (!spell || spell.isSummon || spell.isTeleport) return null;
  if (spell.stateId === 'wet' || spell.isRain) return false;
  if (!(window.getSpellDamage(spell, caster) > 0)) return null;
  if (spell.damageType === 'water') return false;
  if (spell.damageType === 'fire') return true;
  return null;
};

window.isTorchSpellTarget = function(target, spell, caster) {
  return window.torchSpellState(spell, caster) !== null && window.gameState.mapObjects.some(object =>
    window.MapObjects.isTorch(object) && object.x === target.x && object.y === target.y);
};

window.torchChanges = function(area, spell, caster) {
  const lit = window.torchSpellState(spell, caster);
  if (lit === null) return [];
  const keys = new Set(area.map(window.gameState.keyOf));
  return window.gameState.mapObjects.filter(object => window.MapObjects.isTorch(object)
    && window.MapObjects.isLit(object) !== lit && keys.has(window.gameState.keyOf(object)));
};

window.highlightTorchChanges = function(area, spell, caster) {
  for (const object of window.torchChanges(area, spell, caster)) object.element?.classList.add('spell-target');
};

window.clearTorchHighlight = function() {
  for (const object of window.gameState.mapObjects) object.element?.classList.remove('spell-target');
};

window.applyTorchSpell = function(area, spell, caster) {
  const changed = window.torchChanges(area, spell, caster);
  const lit = window.torchSpellState(spell, caster);
  for (const object of changed) object.type = window.MapObjects.torchType(object, lit);
  if (changed.length) window.refreshTorchLighting();
};

window.refreshTorchLighting = function() {
  const state = window.gameState;
  if (!state.battleMap) return;
  state.lighting.torchCells = window.MapObjects.illuminated(state.battleMap);
  state.battlefield.querySelector('.battle-terrain')?.repaintLighting?.(state.lighting);
  for (const object of state.mapObjects) {
    if (!object.element) continue;
    object.element.src = `assets/map-editor/objects/${window.MapObjects.spriteName(object)}.png`;
    object.element.alt = window.MapObjects.TYPES[object.type].name;
    object.element.dataset.type = object.type;
    object.element.style.clipPath = window.MapObjects.isWallTorch(object) ? 'inset(14px)' : '';
    object.element.style.setProperty('--entity-lighting', window.MapObjects.isLit(object) ? 1 : window.BattleLighting.at(state.lighting, object.x, object.y));
    object.element.classList.remove('spell-target');
  }
  for (const cell of state.cells) {
    cell.querySelector('.obstacle')?.style.setProperty('--entity-lighting', window.BattleLighting.at(state.lighting, Number(cell.dataset.x), Number(cell.dataset.y)));
  }
  window.renderPosition?.();
};

// Клик по выступающему за край клетки спрайту адресуется его клетке пола, а не стене.
window.battleCellFromEvent = function(event) {
  const object = event.target.closest('.small-map-object');
  return object ? window.gameState.cells[Number(object.dataset.y) * window.gameState.SIZE + Number(object.dataset.x)]
    : event.target.closest('.cell');
};
