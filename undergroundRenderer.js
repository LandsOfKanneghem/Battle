/* Eight-neighbor wall masks occupy void cells, never floor cells. */
window.UndergroundRenderer = (() => {
  'use strict';
  const cache = new Map();
  function wallTile(style, mask, texture) {
    const key = `${style}:${mask}`;
    if (cache.has(key)) return cache.get(key);
    const tile = document.createElement('canvas');
    tile.width = tile.height = 24;
    const ctx = tile.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(texture, 0, 0, 24, 24);
    // Build the alpha mask separately; never read pixels from loaded images.
    // That also permits opening index.html directly with file:// in browsers.
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = alphaCanvas.height = 24;
    const alphaContext = alphaCanvas.getContext('2d');
    const pixels = alphaContext.createImageData(24, 24);
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= 24 || y >= 24) return false;
      const depthX = style === 'dungeon' ? 8 + [0, 1, -1, 1][y % 4] : 9;
      const depthY = style === 'dungeon' ? 8 + [1, 0, 1, -1][x % 4] : 9;
      return Boolean(((mask & 1) && y < depthY) || ((mask & 4) && x >= 24 - depthX) ||
        ((mask & 16) && y >= 24 - depthY) || ((mask & 64) && x < depthX) ||
        ((mask & 2) && x >= 24 - depthX && y < depthY) ||
        ((mask & 8) && x >= 24 - depthX && y >= 24 - depthY) ||
        ((mask & 32) && x < depthX && y >= 24 - depthY) ||
        ((mask & 128) && x < depthX && y < depthY));
    };
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const i = (y * 24 + x) * 4;
      if (!solid(x, y)) continue;
      pixels.data[i + 3] = 255;
      const edge = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) =>
        x + dx >= 0 && x + dx < 24 && y + dy >= 0 && y + dy < 24 && !solid(x + dx, y + dy));
      const lip = ((mask & 1) && y < 2) || ((mask & 4) && x >= 22) ||
        ((mask & 16) && y >= 22) || ((mask & 64) && x < 2);
      if (edge || lip) {
        ctx.fillStyle = edge ? 'rgba(0,0,0,.65)' : `rgba(255,255,255,${style === 'monastery' ? .15 : .1})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    alphaContext.putImageData(pixels, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(alphaCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    cache.set(key, tile);
    return tile;
  }
  return Object.freeze({ wallTile });
})();
