// Визуальные эффекты игры: глобальные функции window.play* без изменения состояния боя.
// Поле и клетки доступны через window.gameState; DOM создаётся только при вызове анимации.

window.playHealAnimation = function(cell) {
  // Каждый каст владеет своим набором частиц и отдельным таймером очистки.
  const sparks = [];
  for (let i = 0; i < 5; i++) {
    const spark = document.createElement('span');
    spark.className = 'heal-spark';
    spark.textContent = '+';
    spark.setAttribute('aria-hidden', 'true');
    // Оставляем место справа под ширину символа даже в маленькой клетке.
    spark.style.left = `${Math.random() * Math.max(0, cell.clientWidth - 12)}px`;
    spark.style.animationDelay = `${Math.random() * 100}ms`;
    cell.appendChild(spark);
    sparks.push(spark);
  }
  setTimeout(() => sparks.forEach(spark => spark.remove()), 600);
};

window.playProjectileAnimation = function(fromCell, toCell, type = 'fire', onArrival = null) {
  const from = fromCell.getBoundingClientRect();
  const to = toCell.getBoundingClientRect();
  const isCube = type === 'fire-cube';
  const duration = isCube ? 350 : type === 'spark' ? 220 : type === 'spark-bounce' ? 180 : 250;
  const size = Math.min(from.width, from.height) * (isCube ? .65 : type === 'spark-bounce' ? .3 : .5);
  const projectile = document.createElement('span');
  projectile.className = 'spell-projectile';
  projectile.dataset.type = type;
  projectile.setAttribute('aria-hidden', 'true');
  projectile.innerHTML = type.startsWith('spark')
    ? WIZARD_SPELLS.find(spell => spell.id === 'sparks').svg
    : type === 'ice'
    ? WIZARD_SPELLS.find(spell => spell.id === 'ice-arrow').svg
    : `<svg viewBox="0 0 40 40"><path d="M20 2 Q24 14 32 17 Q40 29 28 36 Q10 43 6 29 Q3 20 13 12 L12 24 Q22 19 20 2" fill="#f65a25"/><path d="M22 17 Q35 34 21 35 Q11 34 15 25 L19 28 Z" fill="#ffdc36"/></svg>`;
  projectile.style.width = projectile.style.height = `${size}px`;
  projectile.style.left = `${from.left + from.width / 2 + window.scrollX - size / 2}px`;
  projectile.style.top = `${from.top + from.height / 2 + window.scrollY - size / 2}px`;
  document.body.appendChild(projectile);
  // Анимация в экранных координатах: прямая между центрами, без шагов сетки.
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const flight = projectile.animate([
    { transform: 'translate(0, 0)' },
    { transform: `translate(${dx}px, ${dy}px)` }
  ], { duration, easing: 'linear', fill: 'forwards' });
  let arrived = false;
  function finishFlight() {
    // Событие окончания и страховочный таймер не дублируют взрыв.
    if (arrived) return;
    arrived = true;
    projectile.remove();
    if (onArrival) onArrival();
  }
  flight.onfinish = finishFlight;
  // Страховочная очистка, даже если браузер приостановил отрисовку.
  setTimeout(finishFlight, duration + 50);
};

window.playSparksAnimation = function(fromCell, primaryCell, sparkCells, onArrival, onPrimaryImpact) {
  playProjectileAnimation(fromCell, primaryCell, 'spark', () => {
    // Без существа в точке каста или при промахе цепь заканчивается без отскоков.
    if (!onPrimaryImpact()) { onArrival(); return; }
    if (!sparkCells.length) { setTimeout(onArrival, 180); return; }
    let pending = sparkCells.length;
    for (const cell of sparkCells) {
      playProjectileAnimation(primaryCell, cell, 'spark-bounce', () => {
        if (--pending === 0) onArrival();
      });
    }
  });
};

window.playCubeExplosion = function(centerCell, spell) {
  const center = { x: Number(centerCell.dataset.x), y: Number(centerCell.dataset.y) };
  const flashes = [];
  // Зона берётся из той же функции, что и для урона, включая обрезку краёв.
  for (const point of affectedCells(center, spell, window.gameState.activeEntity(), window.gameState.entities, window.gameState.obstacles, window.gameState.terrain, window.gameState.keyOf, window.gameState.SIZE)) {
    const flash = document.createElement('span');
    flash.className = 'cube-explosion';
    flash.setAttribute('aria-hidden', 'true');
    window.gameState.cells[point.y * window.gameState.SIZE + point.x].appendChild(flash);
    flashes.push(flash);
  }
  setTimeout(() => flashes.forEach(flash => flash.remove()), 500);
};

window.playArmageddonAnimation = function(water = false) {
  const rain = document.createElement('div');
  rain.className = `armageddon-rain${water ? ' water' : ''}`;
  rain.setAttribute('aria-hidden', 'true');
  // Плотная сетка из 320 капель покрывает всё поле без крупных пробелов.
  // Разброс внутри каждого участка не даёт дождю выглядеть строем.
  const columns = 20, rows = 16;
  for (let i = 0; i < columns * rows; i++) {
    const drop = document.createElement('span');
    drop.className = 'armageddon-drop';
    drop.style.left = `${((i % columns) + .15 + Math.random() * .7) * 100 / columns}%`;
    drop.style.top = `${(Math.floor(i / columns) + .15 + Math.random() * .7) * 100 / rows}%`;
    drop.style.animationDelay = `${Math.random() * 100}ms`;
    rain.appendChild(drop);
  }
  window.gameState.battlefield.appendChild(rain);
  setTimeout(() => rain.remove(), 900);
};

window.playRainAnimation = function(center, spell) {
  const area = affectedCells(center, spell, window.gameState.activeEntity(), window.gameState.entities, window.gameState.obstacles, window.gameState.terrain, window.gameState.keyOf, window.gameState.SIZE);
  const layers = [];
  for (const point of area) {
    const cell = window.gameState.cells[point.y * window.gameState.SIZE + point.x];
    const { width, height } = cell.getBoundingClientRect();
    const layer = document.createElement('span');
    layer.className = 'rain-cell';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.setProperty('--rain-distance', `${height * 1.5}px`);
    // Отдельный обрезающий слой удерживает капли внутри каждой клетки АОЕ.
    for (let i = 0; i < 3; i++) {
      const drop = document.createElement('span');
      drop.className = 'rain-drop';
      drop.style.left = `${Math.random() * Math.max(0, width - 3)}px`;
      drop.style.top = `${-35 - Math.random() * 10}%`;
      drop.style.animationDelay = `${Math.random() * 150}ms`;
      layer.appendChild(drop);
    }
    cell.appendChild(layer);
    layers.push(layer);
  }
  setTimeout(() => layers.forEach(layer => layer.remove()), 900);
};

window.playMissAnimation = function(cell) {
  const label = document.createElement('span');
  label.className = 'miss-label';
  label.textContent = 'MISS';
  label.setAttribute('aria-hidden', 'true');
  cell.appendChild(label);
  setTimeout(() => label.remove(), 500);
};

window.playFailureAnimation = function(cell) {
  const label = document.createElement('span');
  label.className = 'failure-label';
  label.textContent = 'FAILURE';
  label.setAttribute('aria-hidden', 'true');
  cell.appendChild(label);
  setTimeout(() => label.remove(), 500);
};

window.playElementalShieldAnimation = function(cell, spell) {
  const flash = document.createElement('span');
  flash.className = 'elemental-shield-flash';
  flash.setAttribute('aria-hidden', 'true');
  flash.innerHTML = spell.svg;
  cell.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
};

window.playFreezeAnimation = function(cell) {
  const crystals = document.createElement('span');
  crystals.className = 'freeze-animation';
  crystals.setAttribute('aria-hidden', 'true');
  crystals.innerHTML = FREEZE.icon;
  cell.appendChild(crystals);
  setTimeout(() => crystals.remove(), 500);
};

window.playSkyShotAnimation = function(cell, spell) {
  const arrow = document.createElement('span');
  arrow.className = 'state-animation sky-shot';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = spell.svg;
  cell.appendChild(arrow);
  setTimeout(() => arrow.remove(), 500);
};

window.playWeaknessVigorAnimation = function(cell, ally) {
  const choice = document.createElement('span');
  choice.className = `state-animation weakness-vigor ${ally ? 'ally' : 'enemy'}`;
  choice.setAttribute('aria-hidden', 'true');
  choice.innerHTML = ally ? VIGOR.icon : WEAKNESS.icon;
  cell.appendChild(choice);
  setTimeout(() => choice.remove(), 500);
};

window.playHeavyAnimation = function(cell) {
  const impact = document.createElement('span');
  impact.className = 'state-animation heavy';
  impact.setAttribute('aria-hidden', 'true');
  impact.innerHTML = `${HEAVY.icon}<span class="heavy-impact"></span>`;
  cell.appendChild(impact);
  setTimeout(() => impact.remove(), 500);
};

window.playStateAnimation = function(cell, stateId) {
  if (stateId === 'freeze') { playFreezeAnimation(cell); return; }
  if (stateId === 'heavy') { playHeavyAnimation(cell); return; }
  if (stateId === 'adrenaline') {
    const pulse = document.createElement('span');
    pulse.className = 'state-animation adrenaline';
    pulse.setAttribute('aria-hidden', 'true');
    pulse.innerHTML = ADRENALINE.icon;
    cell.appendChild(pulse);
    setTimeout(() => pulse.remove(), 500);
    return;
  }
  const animation = document.createElement('span');
  animation.className = `state-animation ${stateId === 'speed' ? 'wind' : 'mud'}`;
  animation.setAttribute('aria-hidden', 'true');
  animation.innerHTML = stateId === 'speed'
    ? `<svg viewBox="0 0 40 40"><path d="M1 10 H29 Q38 10 33 5 M4 21 H33 Q40 21 35 28 M1 32 H23 Q30 32 26 36" fill="none" stroke="#c3ffff" stroke-width="2" stroke-linecap="round"/></svg>`
    : `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="25" rx="17" ry="10" fill="#86552c" fill-opacity=".6"/><g fill="none" stroke="#c6a06a" stroke-width="2"><ellipse cx="20" cy="25" rx="12" ry="7"/><ellipse cx="20" cy="25" rx="5" ry="3"/></g></svg>`;
  cell.appendChild(animation);
  setTimeout(() => animation.remove(), 500);
};

window.playLightFlashAnimation = function(cell) {
  const flash = document.createElement('span');
  flash.className = 'light-flash';
  flash.setAttribute('aria-hidden', 'true');
  flash.innerHTML = MONK_SPELLS.find(spell => spell.id === 'light-flash').svg;
  cell.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
};

window.playMembraneAnimation = function(cell) {
  const bubble = document.createElement('span');
  bubble.className = 'membrane-animation';
  bubble.setAttribute('aria-hidden', 'true');
  bubble.innerHTML = WIZARD_SPELLS.find(spell => spell.isMembrane).svg;
  cell.appendChild(bubble);
  setTimeout(() => bubble.remove(), 500);
};

window.playBurningHandsAnimation = function(centerCell, direction) {
  const origin = { x: Number(centerCell.dataset.x), y: Number(centerCell.dataset.y) };
  const cone = getConeCells(origin, direction, window.gameState.SIZE);
  const blocked = getBlockedConeCells(cone, direction, window.gameState.entities, window.gameState.obstacles, window.gameState.keyOf);
  const flames = [];
  for (const point of cone) {
    if (blocked.has(window.gameState.keyOf(point))) continue;
    const flame = document.createElement('span');
    flame.className = 'burning-hands-flame';
    flame.setAttribute('aria-hidden', 'true');
    flame.style.animationDelay = `${point.depth * 40}ms`;
    window.gameState.cells[point.y * window.gameState.SIZE + point.x].appendChild(flame);
    flames.push(flame);
  }
  setTimeout(() => flames.forEach(flame => flame.remove()), 500);
};

window.playWindRoseAnimation = function(centerCell) {
  const gust = document.createElement('span');
  gust.className = 'state-animation wind-rose';
  gust.setAttribute('aria-hidden', 'true');
  gust.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="#c3ffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 48 V12 M49 24 L60 12 L71 24 M60 72 V108 M49 96 L60 108 L71 96 M48 60 H12 M24 49 L12 60 L24 71 M72 60 H108 M96 49 L108 60 L96 71"/><circle cx="60" cy="60" r="9" stroke="#82c9dc"/></g></svg>`;
  centerCell.appendChild(gust);
  setTimeout(() => gust.remove(), 500);
};
