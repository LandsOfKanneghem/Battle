const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const entries = {
    children: [], scrollTop: 0, clientHeight: 100,
    get scrollHeight() { return this.children.length * 30; },
    appendChild(line) { this.children.push(line); },
    replaceChildren() { this.children = []; this.scrollTop = 0; }
  };
  const wizard = { id: 'wizard', type: 'wizard', name: 'Волшебник', hp: 20 };
  const wolf = { id: 'wolf-1', type: 'wolf', name: 'Волк', hp: 16 };
  const context = { document: { getElementById: () => entries, createElement: () => ({}) },
    gameState: { entities: [wizard, wolf] } };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../battleLog.js'), 'utf8'), context);
  return { log: context.battleLog, entries, wizard, wolf, state: context.gameState,
    lines: () => entries.children.map(line => line.textContent) };
}

test('copy text includes all entries and queued turn events in order without changing the log', () => {
  const { log, wizard, wolf, lines } = setup();
  log.beginRound(1); log.beginTurn(wizard); log.damage(wolf, 4);
  assert.equal(log.getText(), 'Ход 1\nХодит: Волшебник\nВолк -4 ОЗ.');
  assert.equal(lines().length, 2, 'taking a copy does not flush queued events');
  log.finishTurnStart();
  const text = log.getText();
  assert.equal(text, 'Ход 1\nХодит: Волшебник\nВолк -4 ОЗ.');
  log.reset(); assert.equal(log.getText(), '');
});

test('round headings follow the scheduler rather than guessing from creature order', () => {
  const { log, wizard, wolf, lines } = setup();
  log.beginRound(1);
  log.beginTurn(wolf);
  log.beginTurn(wizard);
  log.beginRound(2);
  log.beginTurn(wizard);
  assert.deepEqual(lines(), ['Ход 1', 'Ходит: Волк', 'Ходит: Волшебник', 'Ход 2', 'Ходит: Волшебник']);
});

test('summoning and summon turns do not invent a new round', () => {
  const { log, wizard, state, lines } = setup();
  log.beginRound(1);
  log.beginTurn(wizard);
  const spirit = { id: 'spirit-1', type: 'lake-spirit', name: 'Дух озера', hp: 1 };
  state.entities.push(spirit);
  log.summoned(wizard, spirit);
  log.beginTurn(spirit);
  assert.equal(lines().filter(text => /^Ход [0-9]/.test(text)).length, 1);
  log.beginRound(2);
  log.beginTurn(wizard);
  assert.deepEqual(lines().slice(-2), ['Ход 2', 'Ходит: Волшебник']);
});

test('damage includes zero and ES; expired summons disappear while killed ones die', () => {
  const { log, wizard, wolf, lines } = setup();
  log.damage(wolf, 0, 4);
  log.removed(wolf);
  log.markDisappearance(wizard);
  log.removed(wizard);
  assert.deepEqual(lines(), ['Волк -0 ОЗ (4 урона поглощено ES).', 'Волк погибает.', 'Волшебник исчезает.']);
});

test('turn opening lists bonuses before automatic effects, but flushes before a death', () => {
  const { log, wizard, lines } = setup();
  log.beginRound(1);
  log.beginTurn(wizard);
  log.applied(wizard, { name: 'Адреналиновый откат', casterName: wizard.name });
  log.bonus(wizard, 'ОД');
  log.finishTurnStart();
  assert.ok(lines()[2].includes('+1 ОД'));
  assert.ok(lines()[3].includes('Адреналиновый откат'));
  log.beginTurn(wizard);
  log.damage(wizard, 2);
  log.removed(wizard);
  assert.deepEqual(lines().slice(-2), ['Волшебник -2 ОЗ.', 'Волшебник погибает.']);
});

test('scroll follows new entries only when the reader is near the bottom', () => {
  const { log, wizard, entries } = setup();
  for (let i = 0; i < 12; i++) log.bonus(wizard, 'ОД');
  assert.equal(entries.scrollTop, entries.scrollHeight);
  entries.scrollTop = 0;
  log.bonus(wizard, 'ОП');
  assert.equal(entries.scrollTop, 0);
});

test('loading a battle clears history and round/disappearance tracking; text stays plain', () => {
  const { log, wizard, entries, lines } = setup();
  log.markDisappearance(wizard);
  log.beginTurn(wizard);
  log.reset();
  log.beginRound(1);
  log.beginTurn(wizard);
  log.removed(wizard);
  log.cast(wizard, { name: '<img src=x>' });
  assert.deepEqual(lines().slice(0, 3), ['Ход 1', 'Ходит: Волшебник', 'Волшебник погибает.']);
  assert.equal(entries.children.at(-1).textContent, 'Волшебник применяет «<img src=x>».');
});

test('hidden obstacle message does not identify the concealed creature', () => {
  const { log, lines } = setup();
  log.blocked();
  assert.deepEqual(lines(), ['Что-то преграждает дорогу!']);
});

test('critical damage uses the requested prefix and damage color', () => {
  const { log, wolf, lines, entries } = setup();
  log.damage(wolf, 4, 0, true);
  assert.deepEqual(lines(), ['Критический удар! Волк -4 ОЗ.']);
  assert.equal(entries.children[0].className, 'battle-log-damage');
});
