// Same optional lighting field and legacy conversion as MapEditor.
window.BattleLighting = (() => {
  const WIDTH = 12, HEIGHT = 12;
  const matrix = value => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(value));
  const createLighting = () => ({ mode: 'absolute', ambient: 100, cells: matrix(null) });
  const validBrightness = value => Number.isFinite(value) && value >= 0 && value <= 200;
  const clampBrightness = value => Math.max(60, Math.min(120, value));
  function readLighting(value) {
    if (value === undefined) return createLighting();
    const absolute = value?.mode === 'absolute';
    const validCell = v => absolute ? v === null || (Number.isFinite(v) && v >= 0 && v <= 400) : validBrightness(v);
    if (!value || !validBrightness(value.ambient) || !Array.isArray(value.cells) || value.cells.length !== HEIGHT ||
        (value.mode !== undefined && !absolute) ||
        value.cells.some(row => !Array.isArray(row) || row.length !== WIDTH || row.some(v => !validCell(v)))) {
      throw new Error('Неверные настройки освещения карты.');
    }
    return { mode: 'absolute', ambient: clampBrightness(value.ambient), cells: value.cells.map(row => row.map(v =>
      absolute ? v === null ? null : clampBrightness(v)
        : v === 100 ? null : clampBrightness(value.ambient * v / 100))) };
  }

  const at = (lighting, x, y) => lighting?.torchCells?.has(`${x},${y}`) ? 1
    : clampBrightness(lighting?.cells[y]?.[x] ?? lighting?.ambient ?? 100) / 100;
  return Object.freeze({ read: readLighting, at });
})();
