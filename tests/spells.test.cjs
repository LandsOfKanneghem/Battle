const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Минимальный DOM для проверки настоящего игрового скрипта и событий слотов.
function game() {
  const nodes = new Map(), timers = [];
  function element() {
    const classes = new Set();
    return { dataset: {}, children: [],
      classList: { add(...a) { a.forEach(x => classes.add(x)); }, remove(...a) { a.forEach(x => classes.delete(x)); },
        toggle(c,on) { on ? classes.add(c) : classes.delete(c); }, contains(c) { return classes.has(c); } },
      setAttribute() {}, appendChild(child) { this.children.push(child); },
      remove() { this.removed = true; }, contains() { return true; }, cloneNode: element,
      addEventListener(type, fn) { this[type] = fn; }
    };
  }
  const document = { createElement: element, createElementNS: element,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    addEventListener(type, fn) { this[type] = fn; }
  };
  const context = vm.createContext({ document, setTimeout(fn) { timers.push(fn); } });
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return { run: source => vm.runInContext(source, context), document, timers };
}

test('16 слотов, переключение подготовки и ESC', () => {
  const {run, document} = game();
  assert.equal(run("document.getElementById('spells').children.length"),16);
  run("spellSlots.get('fire-shot').click();spellSlots.get('fire-cube').click()");
  assert.equal(run('preparedSpellId'),'fire-cube');
  assert(run("spellSlots.get('fire-cube').classList.contains('prepared')"));
  assert(!run("spellSlots.get('fire-shot').classList.contains('prepared')"));
  document.keydown({key:'Escape'});
  assert.equal(run('preparedSpellId'),null);
  assert.equal(run('highlightedCells.length'),0);
});

test('АОЕ 3×3: превью, препятствия, урон всем, расход и кулдаун', () => {
  const {run,timers} = game();
  run(`obstacles.clear();phoenix.position={x:9,y:7};secondPhoenix.position={x:10,y:8};
    obstacles.set('9,9','crate');obstacles.set('10,9','water');
    spellSlots.get('fire-cube').click();highlightSpellRange({x:9,y:8})`);
  assert.equal(run('highlightedCells.length'),9);
  assert(run("cells[9*16+9].classList.contains('path-reachable')"));
  assert(run("cells[9*16+10].classList.contains('path-reachable')"));
  assert(run('castSpell(cells[8*16+9])'));
  assert.equal(run('character.hp'),4);
  assert.equal(run('phoenix.hp'),2);
  assert.equal(run('secondPhoenix.hp'),2);
  assert.equal(run('character.ap'),4);
  assert.equal(run('spells[1].cooldown'),2);
  assert.equal(run('spells[1].usesThisTurn'),1);
  assert(run("spellSlots.get('fire-cube').disabled"));
  assert.equal(run('preparedSpellId'),null);
  for (let turn=1;turn>=0;turn--) {
    run('endTurnButton.click()');
    while(timers.length)timers.shift()();
    assert.equal(run('spells[1].cooldown'),turn);
    assert.equal(run('spells[1].usesThisTurn'),0);
    assert.equal(run('canPrepareSpell(spells[1])'),turn===0);
    assert.equal(run('character.hp'),4);
  }
});

test('Недопустимый центр ничего не меняет, край карты обрезает АОЕ', () => {
  const {run} = game();
  run("obstacles.clear();character.position={x:0,y:1};obstacles.set('1,1','crate');spellSlots.get('fire-cube').click()");
  for(const index of [17,19,255]) {
    assert(!run(`castSpell(cells[${index}])`));
    assert.equal(run('character.ap'),8);
    assert.equal(run('preparedSpellId'),'fire-cube');
  }
  run('highlightSpellRange({x:0,y:0})');assert.equal(run('highlightedCells.length'),4);
  assert(run('castSpell(cells[0])'));
  assert.equal(run('character.hp'),4);
});

test('АОЕ убивает волшебника: корректная немедленная передача хода', () => {
  const {run,timers} = game();
  run("obstacles.clear();character.hp=6;spellSlots.get('fire-cube').click();castSpell(cells[8*16+9])");
  assert(!run('entities.includes(character)'));
  assert.equal(run('activeEntityId'),'phoenix');
  assert.equal(run('character.ap'),4);
  assert.equal(run('spells[1].cooldown'),2);
  timers.shift()();assert.equal(run('activeEntityId'),'phoenix-2');
});

test('Огненный выстрел сохраняет одиночный урон и лимит', () => {
  const {run} = game();
  run("obstacles.clear();phoenix.position={x:9,y:8};secondPhoenix.position={x:9,y:9};spellSlots.get('fire-shot').click();castSpell(cells[8*16+9])");
  assert.equal(run('phoenix.hp'),5);assert.equal(run('secondPhoenix.hp'),8);
  assert.equal(run('character.hp'),10);assert.equal(run('character.ap'),5);
  run("spellSlots.get('fire-shot').click();castSpell(cells[8*16+9])");
  assert.equal(run('phoenix.hp'),2);assert.equal(run('character.ap'),2);
  assert(!run('canPrepareSpell(spells[0])'));assert.equal(run('spells[0].cooldown'),0);
});
